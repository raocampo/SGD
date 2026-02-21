const UsuarioAuth = require("../models/UsuarioAuth");

function esTecnicoOdirigente(rol) {
  const valor = String(rol || "").toLowerCase();
  return valor === "tecnico" || valor === "dirigente";
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

module.exports = {
  obtenerEquiposPermitidosTecnico,
  tecnicoPuedeAccederEquipo,
  esTecnicoOdirigente,
};
