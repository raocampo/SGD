const pool = require("../config/database");
const { toUploadsRelativePath } = require("../config/uploads");
const { obtenerPlan } = require("../services/planLimits");
const { enviarEmailComprobanteRecibido } = require("../services/emailService");
const { ACCIONES, registrar: registrarAuditoria, extraerIp } = require("../services/auditoria");

// Asegurar tabla en BD (idempotente)
async function asegurarTabla() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comprobantes_pago (
      id            SERIAL PRIMARY KEY,
      usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      archivo_url   TEXT    NOT NULL,
      estado        VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
      nota_admin    TEXT,
      revisado_por  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// POST /api/comprobantes — usuario sube su comprobante
async function subirComprobante(req, res) {
  try {
    await asegurarTabla();

    if (req.fileValidationError) {
      return res.status(400).json({ error: req.fileValidationError });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Debes adjuntar un archivo (imagen o PDF)" });
    }

    const usuarioId = req.user?.id;
    if (!usuarioId) return res.status(401).json({ error: "No autenticado" });

    // Verificar que la cuenta esté en pendiente_pago
    const rUser = await pool.query(
      "SELECT id, nombre, email, plan_codigo, plan_estado FROM usuarios WHERE id = $1",
      [usuarioId]
    );
    const usuario = rUser.rows[0];
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

    if (String(usuario.plan_estado || "").toLowerCase() !== "pendiente_pago") {
      return res.status(400).json({ error: "Tu cuenta no tiene un pago pendiente" });
    }

    // Guardar comprobante
    const relativePath = toUploadsRelativePath(req.file.path);
    const archivoUrl = `/uploads/${relativePath}`;

    const r = await pool.query(
      `INSERT INTO comprobantes_pago (usuario_id, archivo_url)
       VALUES ($1, $2) RETURNING *`,
      [usuarioId, archivoUrl]
    );

    // Email al admin en background
    const plan = obtenerPlan(usuario.plan_codigo);
    Promise.resolve(
      enviarEmailComprobanteRecibido({
        nombre: usuario.nombre,
        email: usuario.email,
        plan,
        archivoUrl: (process.env.FRONTEND_URL || "").replace(/\/$/, "") + archivoUrl,
      })
    ).catch(() => {});

    // Auditoría
    registrarAuditoria({
      usuarioId,
      accion: "subida_comprobante",
      entidad: "comprobantes_pago",
      entidadId: r.rows[0].id,
      detalle: { plan: usuario.plan_codigo, archivo: archivoUrl },
      ip: extraerIp(req),
    });

    return res.status(201).json({
      ok: true,
      mensaje: "Comprobante recibido. El equipo de LT&C lo revisará y activará tu cuenta.",
      comprobante_id: r.rows[0].id,
    });
  } catch (err) {
    console.error("Error subirComprobante:", err);
    return res.status(500).json({ error: "No se pudo guardar el comprobante" });
  }
}

// GET /api/admin/comprobantes — admin lista comprobantes pendientes
async function listarComprobantes(req, res) {
  try {
    await asegurarTabla();
    const estado = req.query.estado || "pendiente";
    const r = await pool.query(
      `SELECT
         cp.id, cp.archivo_url, cp.estado, cp.nota_admin, cp.created_at,
         u.id AS usuario_id, u.nombre AS usuario_nombre, u.email AS usuario_email,
         u.plan_codigo, u.plan_estado,
         rev.nombre AS revisado_por_nombre
       FROM comprobantes_pago cp
       JOIN  usuarios u   ON u.id  = cp.usuario_id
       LEFT JOIN usuarios rev ON rev.id = cp.revisado_por
       WHERE cp.estado = $1
       ORDER BY cp.created_at DESC`,
      [estado]
    );
    return res.json({ ok: true, comprobantes: r.rows });
  } catch (err) {
    console.error("Error listarComprobantes:", err);
    return res.status(500).json({ error: "No se pudo obtener los comprobantes" });
  }
}

// PUT /api/admin/comprobantes/:id/activar — admin activa la cuenta
async function activarCuenta(req, res) {
  try {
    await asegurarTabla();
    const comprobanteId = Number.parseInt(req.params.id, 10);
    const nota = String(req.body?.nota || "").trim();

    const rc = await pool.query(
      "SELECT * FROM comprobantes_pago WHERE id = $1",
      [comprobanteId]
    );
    if (!rc.rows.length) return res.status(404).json({ error: "Comprobante no encontrado" });
    const comp = rc.rows[0];

    // Activar usuario
    await pool.query(
      "UPDATE usuarios SET plan_estado = 'activo', activo = true, updated_at = NOW() WHERE id = $1",
      [comp.usuario_id]
    );

    // Marcar comprobante como aprobado
    await pool.query(
      `UPDATE comprobantes_pago
       SET estado = 'aprobado', nota_admin = $1, revisado_por = $2, updated_at = NOW()
       WHERE id = $3`,
      [nota || null, req.user?.id, comprobanteId]
    );

    // Auditoría
    registrarAuditoria({
      usuarioId: req.user?.id,
      accion: ACCIONES.ACTIVACION_CUENTA,
      entidad: "usuarios",
      entidadId: comp.usuario_id,
      detalle: { comprobante_id: comprobanteId, admin: req.user?.email },
      ip: extraerIp(req),
    });

    return res.json({ ok: true, mensaje: "Cuenta activada correctamente" });
  } catch (err) {
    console.error("Error activarCuenta:", err);
    return res.status(500).json({ error: "No se pudo activar la cuenta" });
  }
}

// PUT /api/admin/comprobantes/:id/rechazar — admin rechaza el comprobante
async function rechazarComprobante(req, res) {
  try {
    await asegurarTabla();
    const comprobanteId = Number.parseInt(req.params.id, 10);
    const nota = String(req.body?.nota || "").trim();

    const rc = await pool.query(
      "SELECT * FROM comprobantes_pago WHERE id = $1",
      [comprobanteId]
    );
    if (!rc.rows.length) return res.status(404).json({ error: "Comprobante no encontrado" });

    await pool.query(
      `UPDATE comprobantes_pago
       SET estado = 'rechazado', nota_admin = $1, revisado_por = $2, updated_at = NOW()
       WHERE id = $3`,
      [nota || null, req.user?.id, comprobanteId]
    );

    registrarAuditoria({
      usuarioId: req.user?.id,
      accion: "rechazo_comprobante",
      entidad: "comprobantes_pago",
      entidadId: comprobanteId,
      detalle: { nota, admin: req.user?.email },
      ip: extraerIp(req),
    });

    return res.json({ ok: true, mensaje: "Comprobante rechazado" });
  } catch (err) {
    console.error("Error rechazarComprobante:", err);
    return res.status(500).json({ error: "No se pudo rechazar el comprobante" });
  }
}

module.exports = { subirComprobante, listarComprobantes, activarCuenta, rechazarComprobante };
