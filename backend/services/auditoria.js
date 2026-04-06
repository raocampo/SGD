const pool = require("../config/database");

// ── Asegurar tabla ────────────────────────────────────────────────────────────
let _tablaAsegurada = false;
async function asegurarTabla(client = pool) {
  if (_tablaAsegurada) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS auditoria (
      id           SERIAL PRIMARY KEY,
      usuario_id   INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      accion       VARCHAR(80)  NOT NULL,
      entidad      VARCHAR(60),
      entidad_id   INTEGER,
      detalle_json JSONB,
      ip           VARCHAR(45),
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_auditoria_accion  ON auditoria(accion)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_auditoria_created ON auditoria(created_at DESC)`);
  _tablaAsegurada = true;
}

// ── Acciones conocidas ────────────────────────────────────────────────────────
const ACCIONES = {
  LOGIN:                    "login",
  LOGOUT:                   "logout",
  REGISTRO:                 "registro",
  CAMBIO_PASSWORD:          "cambio_password",
  CAMBIO_PLAN_ESTADO:       "cambio_plan_estado",
  ACTIVACION_CUENTA:        "activacion_cuenta",
  ELIMINACION_CAMPEONATO:   "eliminacion_campeonato",
  ELIMINACION_EQUIPO:       "eliminacion_equipo",
  ELIMINACION_JUGADOR:      "eliminacion_jugador",
  CAMBIO_PRECIO_PLAN:       "cambio_precio_plan",
};

// ── Extraer IP del request ────────────────────────────────────────────────────
function extraerIp(req) {
  return (
    req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req?.socket?.remoteAddress ||
    req?.ip ||
    null
  );
}

// ── Registrar (no lanza excepción — auditoría no debe romper el flujo) ────────
async function registrar({ usuarioId, accion, entidad, entidadId, detalle, ip } = {}) {
  try {
    await asegurarTabla();
    await pool.query(
      `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle_json, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        usuarioId   ? Number(usuarioId) : null,
        String(accion).slice(0, 80),
        entidad     ? String(entidad).slice(0, 60) : null,
        entidadId   ? Number(entidadId) : null,
        detalle     ? JSON.stringify(detalle) : null,
        ip          ? String(ip).slice(0, 45) : null,
      ]
    );
  } catch (err) {
    // Solo loguea — nunca interrumpe el request
    console.error("[auditoria] Error registrando:", err.message);
  }
}

// ── Consultar (para el panel admin) ──────────────────────────────────────────
async function listar({ usuarioId, accion, desde, hasta, limit = 100, offset = 0 } = {}) {
  await asegurarTabla();

  const conds = [];
  const params = [];

  if (usuarioId) { params.push(Number(usuarioId)); conds.push(`a.usuario_id = $${params.length}`); }
  if (accion)    { params.push(accion);             conds.push(`a.accion = $${params.length}`); }
  if (desde)     { params.push(desde);              conds.push(`a.created_at >= $${params.length}`); }
  if (hasta)     { params.push(hasta);              conds.push(`a.created_at <= $${params.length}`); }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  params.push(Math.min(Number(limit) || 100, 500));
  params.push(Math.max(Number(offset) || 0, 0));

  const r = await pool.query(
    `SELECT
       a.id,
       a.accion,
       a.entidad,
       a.entidad_id,
       a.detalle_json,
       a.ip,
       a.created_at,
       u.nombre AS usuario_nombre,
       u.email  AS usuario_email,
       u.rol    AS usuario_rol
     FROM auditoria a
     LEFT JOIN usuarios u ON u.id = a.usuario_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = await pool.query(
    `SELECT COUNT(*)::int AS total FROM auditoria a ${where}`,
    params.slice(0, params.length - 2)
  );

  return { registros: r.rows, total: total.rows[0]?.total ?? 0 };
}

module.exports = { ACCIONES, registrar, listar, extraerIp, asegurarTabla };
