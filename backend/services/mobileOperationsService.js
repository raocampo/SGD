const pool = require("../config/database");
const Partido = require("../models/Partido");
const Pase = require("../models/Pase");
const UsuarioAuth = require("../models/UsuarioAuth");
const {
  assertCampeonatoAccess,
  assertEquipoAccess,
  assertEventoAccess,
  mapEvent,
  mapTeam,
  toId,
  toInteger,
  toNumber,
  obtenerCampeonatoIdsVisibles,
  obtenerEquipoIdsVisibles,
} = require("./mobileAccessService");
const { isOrganizador, obtenerEquipoIdsOrganizador } = require("./organizadorScope");
const { esTecnicoOdirigente } = require("./roleScope");

function formatScheduledAt(row) {
  if (!row?.fecha_partido && !row?.hora_partido) return null;
  const fecha = row?.fecha_partido ? String(row.fecha_partido).slice(0, 10) : "";
  const hora = row?.hora_partido ? String(row.hora_partido).slice(0, 8) : "00:00:00";
  return fecha ? `${fecha}T${hora}` : null;
}

function canWrite(user) {
  return ["administrador", "organizador"].includes(String(user?.rol || "").toLowerCase());
}

async function listarEventosVisibles(user) {
  const campeonatoIds = await obtenerCampeonatoIdsVisibles(user);
  const equipoIds = await obtenerEquipoIdsVisibles(user);

  const where = [];
  const values = [];
  let i = 1;

  if (campeonatoIds !== null) {
    if (!campeonatoIds.length) return [];
    where.push(`e.campeonato_id = ANY($${i++}::int[])`);
    values.push(campeonatoIds);
  }

  const eventosR = await pool.query(
    `
      SELECT e.*
      FROM eventos e
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY e.campeonato_id ASC, e.numero_campeonato ASC NULLS LAST, e.id ASC
    `,
    values
  );

  let eventos = eventosR.rows || [];
  if (equipoIds !== null) {
    const permitidosR = await pool.query(
      `
        SELECT DISTINCT evento_id
        FROM evento_equipos
        WHERE equipo_id = ANY($1::int[])
      `,
      [equipoIds]
    );
    const permitidos = new Set(
      permitidosR.rows
        .map((row) => Number.parseInt(row.evento_id, 10))
        .filter((id) => Number.isFinite(id) && id > 0)
    );
    eventos = eventos.filter((evento) => permitidos.has(Number(evento.id)));
  }

  const ids = eventos.map((evento) => Number(evento.id)).filter((id) => Number.isFinite(id) && id > 0);
  const countsMap = new Map();
  if (ids.length) {
    const countsR = await pool.query(
      `
        SELECT evento_id, COUNT(*)::int AS total
        FROM evento_equipos
        WHERE evento_id = ANY($1::int[])
        GROUP BY evento_id
      `,
      [ids]
    );
    countsR.rows.forEach((row) => {
      countsMap.set(Number(row.evento_id), Number(row.total));
    });
  }

  return eventos.map((row) => mapEvent(row, countsMap.get(Number(row.id)) || 0));
}

async function listarEquiposVisibles(user) {
  const visibles = await obtenerEquipoIdsVisibles(user);
  const campeonatoIds = await obtenerCampeonatoIdsVisibles(user);

  const where = [];
  const values = [];
  let i = 1;

  if (visibles !== null) {
    if (!visibles.length) return [];
    where.push(`e.id = ANY($${i++}::int[])`);
    values.push(visibles);
  } else if (campeonatoIds !== null) {
    if (!campeonatoIds.length) return [];
    where.push(`e.campeonato_id = ANY($${i++}::int[])`);
    values.push(campeonatoIds);
  }

  const equiposR = await pool.query(
    `
      SELECT e.*
      FROM equipos e
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY e.campeonato_id ASC, e.numero_campeonato ASC NULLS LAST, e.nombre ASC
    `,
    values
  );
  const equipos = equiposR.rows || [];

  const ids = equipos.map((equipo) => Number(equipo.id)).filter((id) => Number.isFinite(id) && id > 0);
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

async function listarPartidosEvento(user, eventoId) {
  const evento = await assertEventoAccess(user, eventoId);
  await Partido.asegurarEsquemaPlanilla();
  const partidos = await Partido.obtenerPorEvento(evento.id);

  return {
    event: mapEvent(evento, 0),
    matches: partidos.map((partido) => ({
      id: toId(partido.id),
      status: String(partido.estado || "").toLowerCase() === "finalizado" ? "JUGADO" : "PROGRAMADO",
      groupLabel: partido.letra_grupo || partido.nombre_grupo || null,
      roundLabel: partido.jornada ? `Fecha ${partido.jornada}` : "Partido",
      venue: partido.cancha || null,
      scheduledAt: formatScheduledAt(partido),
      homeTeam: {
        id: toId(partido.equipo_local_id),
        name: partido.equipo_local_nombre || "",
      },
      awayTeam: {
        id: toId(partido.equipo_visitante_id),
        name: partido.equipo_visitante_nombre || "",
      },
      result:
        partido.resultado_local == null || partido.resultado_visitante == null
          ? null
          : {
              homeScore: toInteger(partido.resultado_local, 0),
              awayScore: toInteger(partido.resultado_visitante, 0),
            },
    })),
  };
}

function countCards(tarjetas = [], equipoId, tipo) {
  return tarjetas.filter(
    (item) =>
      Number(item.equipo_id) === Number(equipoId) &&
      String(item.tipo_tarjeta || "").toLowerCase() === tipo
  ).length;
}

function mapSquadPlayer(player) {
  return {
    id: toId(player.id),
    teamId: toId(player.equipo_id),
    fullName: [player.nombre, player.apellido].filter(Boolean).join(" ").trim(),
    nationalId: player.cedidentidad || null,
    shirtNumber: player.numero_camiseta == null ? null : toInteger(player.numero_camiseta, null),
    position: player.posicion || "",
  };
}

async function obtenerPlanillaPartido(user, partidoId) {
  const partido = await Partido.obtenerPorId(Number.parseInt(partidoId, 10));
  if (!partido) throw new Error("Partido no encontrado");
  await assertCampeonatoAccess(user, partido.campeonato_id);

  const data = await Partido.obtenerPlanilla(Number(partido.id));
  if (!data) throw new Error("Partido no encontrado");

  return {
    match: {
      id: toId(data.partido.id),
      eventId: toId(data.partido.evento_id),
      status: String(data.partido.estado || "").toLowerCase() === "finalizado" ? "JUGADO" : "PROGRAMADO",
      groupLabel: data.partido.letra_grupo || data.partido.nombre_grupo || null,
      roundLabel: data.partido.jornada ? `Fecha ${data.partido.jornada}` : "Partido",
      venue: data.partido.cancha || null,
      scheduledAt: formatScheduledAt(data.partido),
      homeTeam: {
        id: toId(data.partido.equipo_local_id),
        name: data.partido.equipo_local_nombre || "",
      },
      awayTeam: {
        id: toId(data.partido.equipo_visitante_id),
        name: data.partido.equipo_visitante_nombre || "",
      },
      result: {
        homeScore: toInteger(data.partido.resultado_local, 0),
        awayScore: toInteger(data.partido.resultado_visitante, 0),
      },
    },
    cards: {
      homeYellowCards: countCards(data.tarjetas, data.partido.equipo_local_id, "amarilla"),
      awayYellowCards: countCards(data.tarjetas, data.partido.equipo_visitante_id, "amarilla"),
      homeRedCards: countCards(data.tarjetas, data.partido.equipo_local_id, "roja"),
      awayRedCards: countCards(data.tarjetas, data.partido.equipo_visitante_id, "roja"),
    },
    payments: {
      homeRegistrationPayment: toNumber(data.planilla?.pago_local, 0),
      awayRegistrationPayment: toNumber(data.planilla?.pago_visitante, 0),
      homeRefereePayment: toNumber(data.planilla?.pago_arbitraje_local, 0),
      awayRefereePayment: toNumber(data.planilla?.pago_arbitraje_visitante, 0),
      homeYellowPayment: toNumber(data.planilla?.pago_ta_local, 0),
      awayYellowPayment: toNumber(data.planilla?.pago_ta_visitante, 0),
      homeRedPayment: toNumber(data.planilla?.pago_tr_local, 0),
      awayRedPayment: toNumber(data.planilla?.pago_tr_visitante, 0),
    },
    footballType: data.partido.tipo_futbol || "",
    fouls: {
      homeTeamFouls: toInteger(data.faltas?.local_total, 0),
      awayTeamFouls: toInteger(data.faltas?.visitante_total, 0),
    },
    homeSquad: (data.plantel_local || []).map(mapSquadPlayer),
    awaySquad: (data.plantel_visitante || []).map(mapSquadPlayer),
    scorers: (data.goleadores || []).map((item) => ({
      playerId: toId(item.jugador_id),
      teamId: toId(item.equipo_id),
      playerName: item.jugador_nombre || "",
      teamName: item.equipo_nombre || "",
      goals: toInteger(item.goles, 1),
      goalType: item.tipo_gol || "campo",
      minute: item.minuto == null ? null : toInteger(item.minuto, null),
    })),
    cardEvents: (data.tarjetas || []).map((item) => ({
      playerId: toId(item.jugador_id),
      teamId: toId(item.equipo_id),
      playerName: item.jugador_nombre || "",
      teamName: item.equipo_nombre || "",
      cardType: String(item.tipo_tarjeta || "").toUpperCase(),
      minute: item.minuto == null ? null : toInteger(item.minuto, null),
      observation: item.observacion || null,
    })),
    observations: data.planilla?.observaciones || "",
  };
}

async function guardarPlanillaPartido(user, partidoId, body = {}) {
  if (!canWrite(user)) {
    throw new Error("No autorizado para guardar planilla");
  }

  const partido = await Partido.obtenerPorId(Number.parseInt(partidoId, 10));
  if (!partido) throw new Error("Partido no encontrado");
  await assertCampeonatoAccess(user, partido.campeonato_id);

  const homeScore = toInteger(body.homeScore, 0);
  const awayScore = toInteger(body.awayScore, 0);
  const homeYellowCards = Math.max(0, toInteger(body.homeYellowCards, 0));
  const awayYellowCards = Math.max(0, toInteger(body.awayYellowCards, 0));
  const homeRedCards = Math.max(0, toInteger(body.homeRedCards, 0));
  const awayRedCards = Math.max(0, toInteger(body.awayRedCards, 0));

  let tarjetas = [];
  if (Array.isArray(body.cards) && body.cards.length) {
    tarjetas = body.cards
      .map((item) => ({
        jugador_id: item.playerId ? Number.parseInt(item.playerId, 10) : null,
        equipo_id: item.teamId ? Number.parseInt(item.teamId, 10) : null,
        tipo_tarjeta: String(item.cardType || "").trim().toLowerCase(),
        minuto: item.minute == null ? null : toInteger(item.minute, null),
        observacion: item.observation || null,
      }))
      .filter((item) => item.tipo_tarjeta === "amarilla" || item.tipo_tarjeta === "roja");
  } else {
    for (let i = 0; i < homeYellowCards; i += 1) {
      tarjetas.push({ equipo_id: partido.equipo_local_id, tipo_tarjeta: "amarilla" });
    }
    for (let i = 0; i < awayYellowCards; i += 1) {
      tarjetas.push({ equipo_id: partido.equipo_visitante_id, tipo_tarjeta: "amarilla" });
    }
    for (let i = 0; i < homeRedCards; i += 1) {
      tarjetas.push({ equipo_id: partido.equipo_local_id, tipo_tarjeta: "roja" });
    }
    for (let i = 0; i < awayRedCards; i += 1) {
      tarjetas.push({ equipo_id: partido.equipo_visitante_id, tipo_tarjeta: "roja" });
    }
  }

  const goles = Array.isArray(body.goals)
    ? body.goals
        .map((item) => ({
          jugador_id: item.playerId ? Number.parseInt(item.playerId, 10) : null,
          goles: toInteger(item.goals, 0),
          tipo_gol: item.goalType || "campo",
          minuto: item.minute == null ? null : toInteger(item.minute, null),
        }))
        .filter((item) => Number.isFinite(item.jugador_id) && item.goles > 0)
    : [];

  await Partido.guardarPlanilla(Number(partido.id), {
    resultado_local: homeScore,
    resultado_visitante: awayScore,
    estado: "finalizado",
    faltas_local_total: Math.max(0, toInteger(body.homeTeamFouls ?? body.fouls?.homeTeamFouls, 0)),
    faltas_visitante_total: Math.max(0, toInteger(body.awayTeamFouls ?? body.fouls?.awayTeamFouls, 0)),
    goles,
    tarjetas,
    pagos: {
      pago_local: toNumber(body.homeRegistrationPayment, 0),
      pago_visitante: toNumber(body.awayRegistrationPayment, 0),
      pago_arbitraje_local: toNumber(body.homeRefereePayment, 0),
      pago_arbitraje_visitante: toNumber(body.awayRefereePayment, 0),
      pago_ta_local: toNumber(body.homeYellowPayment, 0),
      pago_ta_visitante: toNumber(body.awayYellowPayment, 0),
      pago_tr_local: toNumber(body.homeRedPayment, 0),
      pago_tr_visitante: toNumber(body.awayRedPayment, 0),
    },
    observaciones: body.observations || "",
  });

  return obtenerPlanillaPartido(user, partido.id);
}

async function listarPasesVisibles(user, filtros = {}) {
  let pases = [];

  if (String(user?.rol || "").toLowerCase() === "administrador") {
    pases = await Pase.listar(filtros);
  } else if (isOrganizador(user)) {
    const campeonatoIds = await obtenerCampeonatoIdsVisibles(user);
    if (!campeonatoIds?.length) return [];
    pases = await Pase.listar({ ...filtros, campeonato_id: campeonatoIds.length === 1 ? campeonatoIds[0] : undefined });
    if (campeonatoIds.length > 1) {
      const permitidos = new Set(campeonatoIds);
      pases = pases.filter((pase) => permitidos.has(Number(pase.campeonato_id)));
    }
  } else if (esTecnicoOdirigente(user?.rol)) {
    const equipoIds = await obtenerEquipoIdsVisibles(user);
    if (!equipoIds?.length) return [];
    pases = await Pase.listar(filtros);
    const permitidos = new Set(equipoIds);
    pases = pases.filter(
      (pase) =>
        permitidos.has(Number(pase.equipo_origen_id)) ||
        permitidos.has(Number(pase.equipo_destino_id))
    );
  } else {
    return [];
  }

  return pases.map((pase) => ({
    id: toId(pase.id),
    championshipName: pase.campeonato_nombre || "",
    eventName: pase.evento_nombre || "",
    playerName: [pase.jugador_nombre, pase.jugador_apellido].filter(Boolean).join(" ").trim(),
    playerNationalId: pase.jugador_cedula || null,
    sourceTeamName: pase.equipo_origen_nombre || "",
    targetTeamName: pase.equipo_destino_nombre || "",
    amount: toNumber(pase.monto, 0),
    status: String(pase.estado || "").toUpperCase(),
    transferDate: pase.fecha_pase || null,
    observation: pase.observacion || null,
  }));
}

async function actualizarEstadoPase(user, paseId, body = {}) {
  if (!canWrite(user)) throw new Error("No autorizado para actualizar pases");
  const pase = await Pase.actualizarEstado(Number.parseInt(paseId, 10), body);
  if (!pase) throw new Error("Pase no encontrado");
  return {
    id: toId(pase.id),
    status: String(pase.estado || "").toUpperCase(),
  };
}

async function listarUsuariosVisibles(user) {
  const role = String(user?.rol || "").toLowerCase();
  if (!["administrador", "organizador"].includes(role)) {
    throw new Error("No autorizado para listar usuarios");
  }

  let usuarios = await UsuarioAuth.listar();
  if (role === "organizador") {
    const equiposPermitidos = await obtenerEquipoIdsOrganizador(user);
    const permitidos = new Set(equiposPermitidos || []);
    usuarios = usuarios.filter((u) => {
      if (u.rol === "organizador") return Number(u.id) === Number(user.id);
      if (!Array.isArray(u.equipo_ids) || !u.equipo_ids.length) return false;
      return u.equipo_ids.some((id) => permitidos.has(Number(id)));
    });
  }

  return usuarios.map((usuario) => ({
    id: toId(usuario.id),
    fullName: usuario.nombre || "",
    email: usuario.email || "",
    role: String(usuario.rol || "").toLowerCase(),
    active: usuario.activo === true,
    readOnly: usuario.solo_lectura === true,
    organizationName: usuario.organizacion_nombre || "",
    planCode: usuario.plan_codigo || "",
    planStatus: usuario.plan_estado || "",
    teamIds: Array.isArray(usuario.equipo_ids) ? usuario.equipo_ids.map((id) => toId(id)) : [],
  }));
}

module.exports = {
  actualizarEstadoPase,
  guardarPlanillaPartido,
  listarEquiposVisibles,
  listarEventosVisibles,
  listarPartidosEvento,
  listarPasesVisibles,
  listarUsuariosVisibles,
  obtenerPlanillaPartido,
};
