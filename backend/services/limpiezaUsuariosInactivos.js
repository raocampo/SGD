// ─────────────────────────────────────────────────────────────────────────────
// Bloqueo y eliminación de cuentas inactivas sin vínculo.
//
// Reglas (configurables por env):
//   - Usuarios con rol organizador/tecnico/dirigente/jugador que NO están ligados
//     a ninguna organización/campeonato/equipo:
//       · organizador  → 0 campeonatos creados
//       · téc/dir/jug  → 0 equipos asignados (usuario_equipos)
//   - Sin actividad (ultimo_acceso_at) por más de DIAS_BLOQUEO (30) → se desactivan.
//   - Si siguen inactivos y desactivados más de DIAS_ELIMINACION (60) → se eliminan.
//   - NUNCA se tocan administrador / operador / operador_sistema.
//   - NUNCA se elimina un usuario que ya tenga campeonatos o equipos.
// ─────────────────────────────────────────────────────────────────────────────
const pool = require("../config/database");
const UsuarioAuth = require("../models/UsuarioAuth");
const { ACCIONES, registrar: registrarAuditoria } = require("./auditoria");

const ROLES_OBJETIVO = ["organizador", "tecnico", "dirigente", "jugador"];

function diasEnv(nombre, defecto) {
  const v = Number.parseInt(process.env[nombre] || "", 10);
  return Number.isFinite(v) && v > 0 ? v : defecto;
}

async function obtenerCandidatos(client = pool) {
  const { rows } = await client.query(
    `
      SELECT
        u.id, u.rol, u.nombre, u.email, u.username, u.activo,
        COALESCE(u.ultimo_acceso_at, u.updated_at, u.created_at) AS ultimo_acceso_at,
        (SELECT COUNT(*)::int FROM campeonatos c WHERE c.creador_usuario_id = u.id) AS n_campeonatos,
        (SELECT COUNT(*)::int FROM usuario_equipos ue WHERE ue.usuario_id = u.id) AS n_equipos
      FROM usuarios u
      WHERE LOWER(u.rol) = ANY($1)
    `,
    [ROLES_OBJETIVO]
  );
  return rows;
}

function clasificar(rows, { diasBloqueo, diasEliminacion }) {
  const ahora = Date.now();
  const bloquear = [];
  const eliminar = [];

  for (const r of rows) {
    const sinVinculo = Number(r.n_campeonatos) === 0 && Number(r.n_equipos) === 0;
    if (!sinVinculo) continue;

    const ultimo = r.ultimo_acceso_at ? new Date(r.ultimo_acceso_at).getTime() : 0;
    const dias = ultimo ? Math.floor((ahora - ultimo) / 86400000) : 99999;

    if (r.activo === true && dias >= diasBloqueo) {
      bloquear.push({ ...r, dias_inactivo: dias });
    } else if (r.activo === false && dias >= diasEliminacion) {
      eliminar.push({ ...r, dias_inactivo: dias });
    }
  }
  return { bloquear, eliminar };
}

/**
 * @param {{dryRun?: boolean}} opts
 * @returns {Promise<{dryRun:boolean, diasBloqueo:number, diasEliminacion:number, bloqueados:Array, eliminados:Array}>}
 */
async function ejecutarLimpiezaUsuariosInactivos(opts = {}) {
  const dryRun = opts.dryRun !== false; // por defecto NO aplica cambios
  const diasBloqueo = diasEnv("LIMPIEZA_DIAS_BLOQUEO", 30);
  const diasEliminacion = diasEnv("LIMPIEZA_DIAS_ELIMINACION", 60);

  await UsuarioAuth.asegurarEsquema(); // garantiza la columna ultimo_acceso_at
  const rows = await obtenerCandidatos();
  const { bloquear, eliminar } = clasificar(rows, { diasBloqueo, diasEliminacion });

  const resumen = (u) => ({
    id: Number(u.id),
    rol: u.rol,
    nombre: u.nombre,
    email: u.email || u.username || null,
    dias_inactivo: u.dias_inactivo,
  });

  const bloqueados = [];
  const eliminados = [];

  if (!dryRun) {
    for (const u of bloquear) {
      try {
        await pool.query(
          `UPDATE usuarios SET activo = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND activo = TRUE`,
          [u.id]
        );
        bloqueados.push(resumen(u));
        registrarAuditoria({
          usuarioId: null,
          accion: ACCIONES.BLOQUEO_CUENTA_INACTIVA,
          entidad: "usuarios",
          entidadId: Number(u.id),
          detalle: { rol: u.rol, dias_inactivo: u.dias_inactivo, motivo: `inactividad > ${diasBloqueo} dias sin vinculo` },
        });
      } catch (error) {
        console.error(`[limpieza] no se pudo bloquear usuario ${u.id}:`, error?.message || error);
      }
    }

    for (const u of eliminar) {
      try {
        // Re-verificación defensiva: no eliminar si adquirió vínculos.
        const check = await pool.query(
          `SELECT
             (SELECT COUNT(*)::int FROM campeonatos c WHERE c.creador_usuario_id = $1) AS nc,
             (SELECT COUNT(*)::int FROM usuario_equipos ue WHERE ue.usuario_id = $1) AS ne`,
          [u.id]
        );
        if (Number(check.rows[0]?.nc) > 0 || Number(check.rows[0]?.ne) > 0) continue;

        await pool.query(`DELETE FROM usuarios WHERE id = $1`, [u.id]);
        eliminados.push(resumen(u));
        registrarAuditoria({
          usuarioId: null,
          accion: ACCIONES.ELIMINACION_CUENTA_INACTIVA,
          entidad: "usuarios",
          entidadId: Number(u.id),
          detalle: { rol: u.rol, dias_inactivo: u.dias_inactivo, motivo: `inactiva y desactivada > ${diasEliminacion} dias` },
        });
      } catch (error) {
        console.error(`[limpieza] no se pudo eliminar usuario ${u.id}:`, error?.message || error);
      }
    }
  }

  return {
    dryRun,
    diasBloqueo,
    diasEliminacion,
    bloqueados: dryRun ? bloquear.map(resumen) : bloqueados,
    eliminados: dryRun ? eliminar.map(resumen) : eliminados,
  };
}

// Programa la ejecución diaria. Solo APLICA cambios si LIMPIEZA_USUARIOS_INACTIVOS === "on".
function programarLimpiezaUsuariosInactivos() {
  const activo = String(process.env.LIMPIEZA_USUARIOS_INACTIVOS || "").toLowerCase() === "on";
  const correr = async () => {
    try {
      const r = await ejecutarLimpiezaUsuariosInactivos({ dryRun: !activo });
      const modo = r.dryRun ? "DRY-RUN (no aplica)" : "APLICADO";
      console.log(
        `[limpieza usuarios inactivos] ${modo} — bloqueo>${r.diasBloqueo}d: ${r.bloqueados.length}, ` +
          `eliminacion>${r.diasEliminacion}d: ${r.eliminados.length}`
      );
      if (r.bloqueados.length) console.log("  bloqueados:", r.bloqueados.map((x) => `#${x.id} ${x.rol}`).join(", "));
      if (r.eliminados.length) console.log("  eliminados:", r.eliminados.map((x) => `#${x.id} ${x.rol}`).join(", "));
    } catch (error) {
      console.error("[limpieza usuarios inactivos] error:", error?.message || error);
    }
  };
  // Primera pasada ~45s tras el arranque, luego cada 24h.
  setTimeout(correr, 45_000);
  setInterval(correr, 24 * 60 * 60 * 1000);
}

module.exports = {
  ejecutarLimpiezaUsuariosInactivos,
  programarLimpiezaUsuariosInactivos,
};
