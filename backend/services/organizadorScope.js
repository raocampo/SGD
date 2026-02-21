const pool = require("../config/database");

function isOrganizador(user) {
  return String(user?.rol || "").toLowerCase() === "organizador";
}

function normalizar(v) {
  return String(v || "").trim().toLowerCase();
}

async function obtenerCampeonatoIdsOrganizador(user, client = pool) {
  if (!isOrganizador(user)) return null;
  const userId = Number.parseInt(user?.id, 10);
  if (!Number.isFinite(userId) || userId <= 0) return [];

  const nombre = normalizar(user?.nombre);
  const email = normalizar(user?.email);

  const r = await client.query(
    `
      SELECT id
      FROM campeonatos
      WHERE creador_usuario_id = $1
         OR (
           creador_usuario_id IS NULL
           AND LOWER(COALESCE(TRIM(organizador), '')) = ANY($2::text[])
         )
      ORDER BY id
    `,
    [userId, [nombre, email].filter(Boolean)]
  );

  const ids = r.rows
    .map((x) => Number.parseInt(x.id, 10))
    .filter((x) => Number.isFinite(x) && x > 0);

  if (!ids.length) return [];

  await client.query(
    `
      UPDATE campeonatos
      SET creador_usuario_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($2::int[])
        AND creador_usuario_id IS NULL
    `,
    [userId, ids]
  );

  return ids;
}

async function organizadorPuedeAccederCampeonato(user, campeonatoId, client = pool) {
  if (!isOrganizador(user)) return true;
  const campId = Number.parseInt(campeonatoId, 10);
  if (!Number.isFinite(campId) || campId <= 0) return false;
  const ids = await obtenerCampeonatoIdsOrganizador(user, client);
  return ids.includes(campId);
}

async function obtenerEquipoIdsOrganizador(user, client = pool) {
  if (!isOrganizador(user)) return null;
  const campeonatoIds = await obtenerCampeonatoIdsOrganizador(user, client);
  if (!campeonatoIds.length) return [];

  const r = await client.query(
    `
      SELECT id
      FROM equipos
      WHERE campeonato_id = ANY($1::int[])
      ORDER BY id
    `,
    [campeonatoIds]
  );

  return r.rows
    .map((x) => Number.parseInt(x.id, 10))
    .filter((x) => Number.isFinite(x) && x > 0);
}

async function organizadorPuedeAccederEquipo(user, equipoId, client = pool) {
  if (!isOrganizador(user)) return true;
  const id = Number.parseInt(equipoId, 10);
  if (!Number.isFinite(id) || id <= 0) return false;
  const ids = await obtenerEquipoIdsOrganizador(user, client);
  return ids.includes(id);
}

module.exports = {
  isOrganizador,
  obtenerCampeonatoIdsOrganizador,
  organizadorPuedeAccederCampeonato,
  obtenerEquipoIdsOrganizador,
  organizadorPuedeAccederEquipo,
};
