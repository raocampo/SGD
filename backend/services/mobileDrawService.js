const pool = require("../config/database");
const Eliminatoria = require("../models/Eliminatoria");
const Grupo = require("../models/Grupo");
const {
  assertEventoAccess,
  mapEvent,
  mapTeam,
  toId,
  toInteger,
} = require("./mobileAccessService");

function canWriteCompetition(user) {
  return ["administrador", "organizador"].includes(String(user?.rol || "").toLowerCase());
}

function requireWriteAccess(user) {
  if (!canWriteCompetition(user)) {
    throw new Error("No autorizado para administrar sorteo");
  }
}

async function listarEquiposEventoMapeados(eventoId) {
  const equiposR = await pool.query(
    `
      SELECT e.*
      FROM evento_equipos ee
      JOIN equipos e ON e.id = ee.equipo_id
      WHERE ee.evento_id = $1
      ORDER BY e.numero_campeonato ASC NULLS LAST, e.nombre ASC
    `,
    [eventoId]
  );

  const equipos = equiposR.rows || [];
  const ids = equipos.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
  const playerCounts = new Map();

  if (ids.length) {
    const countsR = await pool.query(
      `
        SELECT equipo_id, COUNT(*)::int AS total
        FROM jugadores
        WHERE equipo_id = ANY($1::int[])
        GROUP BY equipo_id
      `,
      [ids]
    );
    countsR.rows.forEach((row) => {
      playerCounts.set(Number(row.equipo_id), Number(row.total));
    });
  }

  return equipos.map((row) => mapTeam(row, playerCounts.get(Number(row.id)) || 0));
}

async function obtenerConteoCompetencia(eventoId) {
  await Eliminatoria.asegurarEsquema();
  const [partidosR, eliminatoriaR] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total FROM partidos WHERE evento_id = $1`, [eventoId]),
    pool.query(`SELECT COUNT(*)::int AS total FROM partidos_eliminatoria WHERE evento_id = $1`, [eventoId]),
  ]);

  return {
    matches: Number(partidosR.rows[0]?.total || 0),
    knockoutMatches: Number(eliminatoriaR.rows[0]?.total || 0),
  };
}

async function assertNoCompetitionData(eventoId) {
  const counts = await obtenerConteoCompetencia(eventoId);
  if (counts.matches > 0) {
    throw new Error("No se puede modificar el sorteo porque la categoría ya tiene fixture generado");
  }
  if (counts.knockoutMatches > 0) {
    throw new Error("No se puede modificar el sorteo porque la categoría ya tiene eliminatorias generadas");
  }
}

async function eliminarGruposEvento(eventoId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const gruposR = await client.query(`SELECT id FROM grupos WHERE evento_id = $1`, [eventoId]);
    const grupoIds = gruposR.rows
      .map((row) => Number.parseInt(row.id, 10))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (grupoIds.length) {
      await client.query(`DELETE FROM grupo_equipos WHERE grupo_id = ANY($1::int[])`, [grupoIds]);
      await client.query(`DELETE FROM grupos WHERE id = ANY($1::int[])`, [grupoIds]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function mezclarArray(items = []) {
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function mapGroup(grupo) {
  const equipos = Array.isArray(grupo?.equipos) ? grupo.equipos : [];
  return {
    id: toId(grupo.id),
    label: grupo.nombre_grupo || `Grupo ${grupo.letra_grupo || ""}`.trim(),
    letter: grupo.letra_grupo || "",
    teamCount: equipos.length,
    teams: equipos.map((team) => ({
      id: toId(team.id),
      name: team.nombre || "",
      seeded: team.cabeza_serie === true,
      logoUrl: team.logo_url || null,
      drawOrder: team.orden_sorteo == null ? null : toInteger(team.orden_sorteo, 0),
    })),
  };
}

async function buildDrawState(evento) {
  const [grupos, equipos] = await Promise.all([
    Grupo.obtenerConEquiposPorEvento(evento.id),
    listarEquiposEventoMapeados(evento.id),
  ]);

  const assignedIds = new Set();
  grupos.forEach((grupo) => {
    (grupo.equipos || []).forEach((team) => {
      assignedIds.add(String(team.id));
    });
  });

  const availableTeams = equipos.filter((team) => !assignedIds.has(String(team.id)));
  const totalTeams = equipos.length;
  const assignedTeams = totalTeams - availableTeams.length;
  const seededTeams = equipos.filter((team) => team.seeded).length;
  const format = String(evento.metodo_competencia || "").toLowerCase();

  return {
    event: mapEvent(evento, totalTeams),
    drawMode: format === "eliminatoria" ? "DIRECT_BRACKET" : format === "liga" ? "OPTIONAL" : "GROUPS",
    requiresGroups: format === "grupos" || format === "mixto",
    groups: grupos.map(mapGroup),
    availableTeams,
    stats: {
      totalTeams,
      assignedTeams,
      unassignedTeams: availableTeams.length,
      seededTeams,
      groupsCount: grupos.length,
    },
  };
}

async function prepararGruposParaSorteo(eventoId, groupsCount, overwrite) {
  const gruposActuales = await Grupo.obtenerConEquiposPorEvento(eventoId);
  const totalAsignados = gruposActuales.reduce(
    (acc, grupo) => acc + (Array.isArray(grupo.equipos) ? grupo.equipos.length : 0),
    0
  );

  const normalizedGroupsCount =
    groupsCount == null ? null : Math.max(1, Number.parseInt(groupsCount, 10) || 0);

  if (!gruposActuales.length) {
    if (!normalizedGroupsCount) {
      throw new Error("groupsCount es obligatorio cuando la categoría no tiene grupos");
    }
    await Grupo.crearGruposPorEvento(eventoId, normalizedGroupsCount);
    return Grupo.obtenerPorEvento(eventoId);
  }

  if (overwrite === true) {
    await assertNoCompetitionData(eventoId);
    await eliminarGruposEvento(eventoId);
    await Grupo.crearGruposPorEvento(eventoId, normalizedGroupsCount || gruposActuales.length);
    return Grupo.obtenerPorEvento(eventoId);
  }

  if (totalAsignados > 0) {
    throw new Error("La categoría ya tiene equipos sorteados. Usa overwrite para reiniciar");
  }

  if (normalizedGroupsCount && normalizedGroupsCount !== gruposActuales.length) {
    throw new Error("La categoría ya tiene grupos creados con otra cantidad. Usa overwrite para recrearlos");
  }

  return gruposActuales;
}

async function obtenerSorteoEvento(user, eventoId) {
  const evento = await assertEventoAccess(user, eventoId);
  return buildDrawState(evento);
}

async function crearGruposEvento(user, eventoId, body = {}) {
  requireWriteAccess(user);
  const evento = await assertEventoAccess(user, eventoId);
  const format = String(evento.metodo_competencia || "").toLowerCase();
  if (!["grupos", "mixto"].includes(format)) {
    throw new Error("Solo las categorías por grupos o mixtas requieren crear grupos");
  }

  await prepararGruposParaSorteo(evento.id, body.groupsCount, body.overwrite === true);
  return buildDrawState(evento);
}

async function generarSorteoAutomatico(user, eventoId, body = {}) {
  requireWriteAccess(user);
  const evento = await assertEventoAccess(user, eventoId);
  const format = String(evento.metodo_competencia || "").toLowerCase();
  if (!["grupos", "mixto"].includes(format)) {
    throw new Error("El sorteo automático de grupos solo aplica a categorías por grupos o mixtas");
  }

  const grupos = await prepararGruposParaSorteo(evento.id, body.groupsCount, body.overwrite === true);
  const gruposIds = grupos.map((grupo) => Number(grupo.id)).filter((id) => Number.isFinite(id) && id > 0);
  const equipos = await listarEquiposEventoMapeados(evento.id);

  if (equipos.length < 2) {
    throw new Error("La categoría necesita al menos 2 equipos para realizar el sorteo");
  }

  if (gruposIds.length < 1) {
    throw new Error("No se pudieron preparar grupos para el sorteo");
  }

  const useSeededTeams = body.useSeededTeams === true;
  let drawOrder = 1;
  const seededTeams = useSeededTeams ? mezclarArray(equipos.filter((team) => team.seeded)) : [];
  const regularTeams = mezclarArray(equipos.filter((team) => !useSeededTeams || !team.seeded));

  for (let index = 0; index < seededTeams.length; index += 1) {
    const grupoId = gruposIds[index % gruposIds.length];
    await Grupo.asignarEquipo(grupoId, Number(seededTeams[index].id), drawOrder);
    drawOrder += 1;
  }

  for (let index = 0; index < regularTeams.length; index += 1) {
    const grupoId = gruposIds[index % gruposIds.length];
    await Grupo.asignarEquipo(grupoId, Number(regularTeams[index].id), drawOrder);
    drawOrder += 1;
  }

  return buildDrawState(evento);
}

async function asignarEquipoAGrupo(user, grupoId, body = {}) {
  requireWriteAccess(user);
  const groupId = Number.parseInt(grupoId, 10);
  if (!Number.isFinite(groupId) || groupId <= 0) throw new Error("grupo_id invalido");

  const grupo = await Grupo.obtenerPorId(groupId);
  if (!grupo) throw new Error("Grupo no encontrado");
  const evento = await assertEventoAccess(user, grupo.evento_id);
  const format = String(evento.metodo_competencia || "").toLowerCase();
  if (!["grupos", "mixto"].includes(format)) {
    throw new Error("La asignación manual a grupos solo aplica a categorías por grupos o mixtas");
  }
  await assertNoCompetitionData(evento.id);

  const teamId = Number.parseInt(body.teamId, 10);
  if (!Number.isFinite(teamId) || teamId <= 0) throw new Error("teamId invalido");

  const ordenBaseR = await pool.query(
    `
      SELECT COALESCE(MAX(ge.orden_sorteo), 0)::int AS total
      FROM grupo_equipos ge
      JOIN grupos g ON g.id = ge.grupo_id
      WHERE g.evento_id = $1
    `,
    [evento.id]
  );
  const nextOrder =
    body.drawOrder == null
      ? Number(ordenBaseR.rows[0]?.total || 0) + 1
      : Math.max(1, Number.parseInt(body.drawOrder, 10) || 1);

  await Grupo.asignarEquipo(groupId, teamId, nextOrder);
  return buildDrawState(evento);
}

async function removerEquipoDeGrupo(user, grupoId, equipoId) {
  requireWriteAccess(user);
  const groupId = Number.parseInt(grupoId, 10);
  const teamId = Number.parseInt(equipoId, 10);
  if (!Number.isFinite(groupId) || groupId <= 0) throw new Error("grupo_id invalido");
  if (!Number.isFinite(teamId) || teamId <= 0) throw new Error("equipo_id invalido");

  const grupo = await Grupo.obtenerPorId(groupId);
  if (!grupo) throw new Error("Grupo no encontrado");
  const evento = await assertEventoAccess(user, grupo.evento_id);
  await assertNoCompetitionData(evento.id);
  await Grupo.removerEquipo(groupId, teamId);
  return buildDrawState(evento);
}

async function reiniciarSorteoEvento(user, eventoId) {
  requireWriteAccess(user);
  const evento = await assertEventoAccess(user, eventoId);
  const format = String(evento.metodo_competencia || "").toLowerCase();
  if (!["grupos", "mixto"].includes(format)) {
    throw new Error("Solo las categorías por grupos o mixtas tienen sorteo de grupos para reiniciar");
  }

  await assertNoCompetitionData(evento.id);
  await eliminarGruposEvento(evento.id);
  return buildDrawState(evento);
}

module.exports = {
  asignarEquipoAGrupo,
  crearGruposEvento,
  generarSorteoAutomatico,
  obtenerSorteoEvento,
  removerEquipoDeGrupo,
  reiniciarSorteoEvento,
};
