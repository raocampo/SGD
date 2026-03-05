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

let eventoEquiposOrdenSchemaReady = false;

function canWriteCompetition(user) {
  return ["administrador", "organizador"].includes(String(user?.rol || "").toLowerCase());
}

function requireWriteAccess(user) {
  if (!canWriteCompetition(user)) {
    throw new Error("No autorizado para administrar sorteo");
  }
}

function isGroupFormat(format) {
  return ["grupos", "mixto"].includes(String(format || "").toLowerCase());
}

function isSeedingFormat(format) {
  return ["liga", "eliminatoria"].includes(String(format || "").toLowerCase());
}

async function asegurarEventoEquiposOrdenSorteo() {
  if (eventoEquiposOrdenSchemaReady) return;
  await pool.query(`
    ALTER TABLE evento_equipos
    ADD COLUMN IF NOT EXISTS orden_sorteo INTEGER
  `);
  eventoEquiposOrdenSchemaReady = true;
}

async function listarEquiposEventoMapeados(eventoId) {
  await asegurarEventoEquiposOrdenSorteo();
  const equiposR = await pool.query(
    `
      SELECT
        e.*,
        ee.orden_sorteo AS evento_orden_sorteo
      FROM evento_equipos ee
      JOIN equipos e ON e.id = ee.equipo_id
      WHERE ee.evento_id = $1
      ORDER BY
        COALESCE(ee.orden_sorteo, 2147483647),
        e.numero_campeonato ASC NULLS LAST,
        e.nombre ASC
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

  return equipos.map((row) => ({
    ...mapTeam(row, playerCounts.get(Number(row.id)) || 0),
    drawOrder:
      row.evento_orden_sorteo == null ? null : toInteger(row.evento_orden_sorteo, 0),
  }));
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

  const totalTeams = equipos.length;
  const seededTeams = equipos.filter((team) => team.seeded).length;
  const format = String(evento.metodo_competencia || "").toLowerCase();
  const requiresGroups = isGroupFormat(format);
  const requiresSeeding = isSeedingFormat(format);
  let availableTeams = [];
  let assignedTeams = 0;
  let seedSlots = [];

  if (requiresGroups) {
    const assignedIds = new Set();
    grupos.forEach((grupo) => {
      (grupo.equipos || []).forEach((team) => {
        assignedIds.add(String(team.id));
      });
    });
    availableTeams = equipos.filter((team) => !assignedIds.has(String(team.id)));
    assignedTeams = totalTeams - availableTeams.length;
  } else if (requiresSeeding) {
    const slotMap = new Map();
    const assignedTeamIds = new Set();
    equipos.forEach((team) => {
      const slot = Number.parseInt(team.drawOrder, 10);
      if (Number.isFinite(slot) && slot > 0 && slot <= totalTeams && !slotMap.has(slot)) {
        slotMap.set(slot, team);
        assignedTeamIds.add(String(team.id));
      }
    });
    availableTeams = equipos.filter((team) => !assignedTeamIds.has(String(team.id)));
    assignedTeams = assignedTeamIds.size;
    seedSlots = Array.from({ length: totalTeams }).map((_, index) => {
      const slot = index + 1;
      return {
        slot,
        team: slotMap.get(slot) || null,
      };
    });
  } else {
    availableTeams = [...equipos];
    assignedTeams = 0;
  }

  return {
    event: mapEvent(evento, totalTeams),
    drawMode: format === "eliminatoria" ? "DIRECT_BRACKET" : format === "liga" ? "OPTIONAL" : "GROUPS",
    requiresGroups,
    requiresSeeding,
    groups: grupos.map(mapGroup),
    seedSlots,
    availableTeams,
    stats: {
      totalTeams,
      assignedTeams,
      unassignedTeams: availableTeams.length,
      seededTeams,
      groupsCount: grupos.length,
      seededOrderAssigned: requiresSeeding ? assignedTeams : 0,
      seededOrderPending: requiresSeeding ? availableTeams.length : 0,
    },
  };
}

async function limpiarSembradoEvento(eventoId) {
  await asegurarEventoEquiposOrdenSorteo();
  await pool.query(
    `
      UPDATE evento_equipos
      SET orden_sorteo = NULL
      WHERE evento_id = $1
    `,
    [eventoId]
  );
}

async function generarSembradoAutomatico(user, evento, body = {}) {
  const equipos = await listarEquiposEventoMapeados(evento.id);
  if (equipos.length < 2) {
    throw new Error("La categoría necesita al menos 2 equipos para realizar el sorteo");
  }

  const assigned = equipos.filter((team) => {
    const slot = Number.parseInt(team.drawOrder, 10);
    return Number.isFinite(slot) && slot > 0;
  });
  if (assigned.length > 0 && body.overwrite !== true) {
    throw new Error("La categoría ya tiene siembra registrada. Usa overwrite para regenerar");
  }

  await assertNoCompetitionData(evento.id);
  if (body.overwrite === true) {
    await limpiarSembradoEvento(evento.id);
  }

  const useSeededTeams = body.useSeededTeams === true;
  const seededTeams = useSeededTeams ? mezclarArray(equipos.filter((team) => team.seeded)) : [];
  const regularTeams = mezclarArray(equipos.filter((team) => !useSeededTeams || !team.seeded));
  const orderedTeams = [...seededTeams, ...regularTeams];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let index = 0; index < orderedTeams.length; index += 1) {
      await client.query(
        `
          UPDATE evento_equipos
          SET orden_sorteo = $1
          WHERE evento_id = $2 AND equipo_id = $3
        `,
        [index + 1, evento.id, Number(orderedTeams[index].id)]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function sembrarEquipoEnSlot(user, evento, body = {}) {
  const teamId = Number.parseInt(body.teamId, 10);
  const slot = Number.parseInt(body.slot, 10);
  if (!Number.isFinite(teamId) || teamId <= 0) throw new Error("teamId invalido");

  const equipos = await listarEquiposEventoMapeados(evento.id);
  if (!equipos.length) throw new Error("No hay equipos inscritos en esta categoría");
  if (!Number.isFinite(slot) || slot < 1 || slot > equipos.length) {
    throw new Error(`slot invalido. Debe estar entre 1 y ${equipos.length}`);
  }

  const selectedTeam = equipos.find((team) => Number(team.id) === teamId);
  if (!selectedTeam) throw new Error("El equipo no pertenece a esta categoría");
  await assertNoCompetitionData(evento.id);

  const slotTeam = equipos.find((team) => Number(team.drawOrder) === slot && Number(team.id) !== teamId);
  if (slotTeam && body.overwrite !== true) {
    throw new Error("Ese slot ya está ocupado. Usa overwrite para reemplazarlo");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        UPDATE evento_equipos
        SET orden_sorteo = NULL
        WHERE evento_id = $1 AND equipo_id = $2
      `,
      [evento.id, teamId]
    );
    if (slotTeam) {
      await client.query(
        `
          UPDATE evento_equipos
          SET orden_sorteo = NULL
          WHERE evento_id = $1 AND equipo_id = $2
        `,
        [evento.id, Number(slotTeam.id)]
      );
    }
    await client.query(
      `
        UPDATE evento_equipos
        SET orden_sorteo = $1
        WHERE evento_id = $2 AND equipo_id = $3
      `,
      [slot, evento.id, teamId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
  if (isSeedingFormat(format)) {
    await generarSembradoAutomatico(user, evento, body);
    return buildDrawState(evento);
  }
  if (!isGroupFormat(format)) {
    throw new Error("Esta categoría no soporta sorteo automático en este flujo");
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

  await assertNoCompetitionData(evento.id);
  if (isGroupFormat(format)) {
    await eliminarGruposEvento(evento.id);
  } else if (isSeedingFormat(format)) {
    await limpiarSembradoEvento(evento.id);
  } else {
    throw new Error("Esta categoría no soporta reinicio de sorteo en este flujo");
  }
  return buildDrawState(evento);
}

function elegirEquipoRuleta(availableTeams = [], useSeededTeams = false) {
  if (!Array.isArray(availableTeams) || !availableTeams.length) return null;
  if (useSeededTeams) {
    const seeded = availableTeams.filter((team) => team.seeded);
    if (seeded.length) {
      return mezclarArray(seeded)[0] || null;
    }
  }
  return mezclarArray(availableTeams)[0] || null;
}

async function extraerEquipoRuletaEvento(user, eventoId, body = {}) {
  requireWriteAccess(user);
  const evento = await assertEventoAccess(user, eventoId);
  const format = String(evento.metodo_competencia || "").toLowerCase();
  if (!isGroupFormat(format) && !isSeedingFormat(format)) {
    throw new Error("La ruleta manual no aplica a este formato");
  }

  await assertNoCompetitionData(evento.id);
  const drawState = await buildDrawState(evento);
  if (!drawState.availableTeams.length) {
    throw new Error("No hay equipos disponibles para ruleta");
  }

  const selectedTeam = elegirEquipoRuleta(drawState.availableTeams, body.useSeededTeams === true);
  if (!selectedTeam) throw new Error("No se pudo extraer equipo en ruleta");

  return {
    selectedTeam,
    availableBefore: drawState.availableTeams.length,
    availableAfter: Math.max(0, drawState.availableTeams.length - 1),
    drawState,
  };
}

async function asignarRuletaEvento(user, eventoId, body = {}) {
  requireWriteAccess(user);
  const evento = await assertEventoAccess(user, eventoId);
  const format = String(evento.metodo_competencia || "").toLowerCase();
  if (!isGroupFormat(format) && !isSeedingFormat(format)) {
    throw new Error("La ruleta manual no aplica a este formato");
  }

  await assertNoCompetitionData(evento.id);
  const drawState = await buildDrawState(evento);
  if (!drawState.availableTeams.length) {
    throw new Error("No hay equipos disponibles para asignar por ruleta");
  }

  const requestedTeamId = Number.parseInt(body.teamId, 10);
  const selectedTeam = Number.isFinite(requestedTeamId) && requestedTeamId > 0
    ? drawState.availableTeams.find((team) => Number(team.id) === requestedTeamId) || null
    : elegirEquipoRuleta(drawState.availableTeams, body.useSeededTeams === true);

  if (!selectedTeam) {
    throw new Error("El equipo no está disponible para asignación por ruleta");
  }

  let nextState = null;
  let assignedGroupId = null;
  let assignedSlot = null;

  if (isGroupFormat(format)) {
    const groupId = Number.parseInt(body.groupId, 10);
    if (!Number.isFinite(groupId) || groupId <= 0) {
      throw new Error("groupId invalido");
    }
    const grupo = await Grupo.obtenerPorId(groupId);
    if (!grupo || Number(grupo.evento_id) !== Number(evento.id)) {
      throw new Error("El grupo no pertenece a esta categoría");
    }

    nextState = await asignarEquipoAGrupo(user, groupId, {
      teamId: selectedTeam.id,
    });
    assignedGroupId = toId(groupId);
  } else {
    const slot = Number.parseInt(body.slot, 10);
    if (!Number.isFinite(slot) || slot <= 0) {
      throw new Error("slot invalido");
    }
    await sembrarEquipoEnSlot(user, evento, {
      teamId: selectedTeam.id,
      slot,
      overwrite: body.overwrite === true,
    });
    nextState = await buildDrawState(evento);
    assignedSlot = slot;
  }

  return {
    selectedTeam,
    assignedGroupId,
    assignedSlot,
    drawState: nextState,
  };
}

async function sembradoManualEvento(user, eventoId, body = {}) {
  requireWriteAccess(user);
  const evento = await assertEventoAccess(user, eventoId);
  const format = String(evento.metodo_competencia || "").toLowerCase();
  if (!isSeedingFormat(format)) {
    throw new Error("La siembra manual aplica solo a categorías de liga o eliminatoria");
  }

  await sembrarEquipoEnSlot(user, evento, body);
  return buildDrawState(evento);
}

async function quitarSembradoEvento(user, eventoId, body = {}) {
  requireWriteAccess(user);
  const evento = await assertEventoAccess(user, eventoId);
  const format = String(evento.metodo_competencia || "").toLowerCase();
  if (!isSeedingFormat(format)) {
    throw new Error("La siembra manual aplica solo a categorías de liga o eliminatoria");
  }
  await assertNoCompetitionData(evento.id);

  const teamId = Number.parseInt(body.teamId, 10);
  if (!Number.isFinite(teamId) || teamId <= 0) {
    throw new Error("teamId invalido");
  }

  await asegurarEventoEquiposOrdenSorteo();
  await pool.query(
    `
      UPDATE evento_equipos
      SET orden_sorteo = NULL
      WHERE evento_id = $1 AND equipo_id = $2
    `,
    [evento.id, teamId]
  );

  return buildDrawState(evento);
}

module.exports = {
  asignarRuletaEvento,
  asignarEquipoAGrupo,
  crearGruposEvento,
  extraerEquipoRuletaEvento,
  generarSorteoAutomatico,
  quitarSembradoEvento,
  obtenerSorteoEvento,
  removerEquipoDeGrupo,
  reiniciarSorteoEvento,
  sembradoManualEvento,
};
