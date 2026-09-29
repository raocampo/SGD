const pool = require("../config/database");
const UsuarioAuth = require("../models/UsuarioAuth");

function esTecnicoOdirigente(rol) {
  const valor = String(rol || "").toLowerCase();
  return valor === "tecnico" || valor === "dirigente" || valor === "jugador";
}

async function obtenerEquiposPermitidosTecnico(req) {
  if (!req?.user || !esTecnicoOdirigente(req.user.rol)) return null;

  const directos = Array.isArray(req.user.equipo_ids)
    ? req.user.equipo_ids
        .map((x) => Number.parseInt(x, 10))
        .filter((x) => Number.isFinite(x) && x > 0)
    : [];
  if (directos.length) return directos;

  return UsuarioAuth.obtenerEquipoIds(req.user.id);
}

async function tecnicoPuedeAccederEquipo(req, equipoId) {
  const permitidos = await obtenerEquiposPermitidosTecnico(req);
  if (permitidos === null) return true;
  const id = Number.parseInt(equipoId, 10);
  if (!Number.isFinite(id) || id <= 0) return false;
  return permitidos.includes(id);
}

// Campeonatos donde el usuario (tecnico/dirigente/jugador) tiene al menos un
// equipo asociado. Devuelve null cuando el rol no aplica restriccion (otros
// roles se manejan aparte, p.ej. organizador via creador_usuario_id).
async function obtenerCampeonatoIdsPermitidosTecnico(req) {
  const equipoIds = await obtenerEquiposPermitidosTecnico(req);
  if (equipoIds === null) return null;
  if (!equipoIds.length) return [];

  const r = await pool.query(
    `SELECT DISTINCT campeonato_id FROM equipos WHERE id = ANY($1::int[]) AND campeonato_id IS NOT NULL`,
    [equipoIds]
  );
  return r.rows.map((row) => Number(row.campeonato_id));
}

async function tecnicoPuedeAccederCampeonato(req, campeonatoId) {
  const permitidos = await obtenerCampeonatoIdsPermitidosTecnico(req);
  if (permitidos === null) return true;
  const id = Number.parseInt(campeonatoId, 10);
  if (!Number.isFinite(id) || id <= 0) return false;
  return permitidos.includes(id);
}

module.exports = {
  obtenerEquiposPermitidosTecnico,
  tecnicoPuedeAccederEquipo,
  obtenerCampeonatoIdsPermitidosTecnico,
  tecnicoPuedeAccederCampeonato,
  esTecnicoOdirigente,
};
