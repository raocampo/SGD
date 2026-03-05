const pool = require("../config/database");
const Campeonato = require("../models/Campeonato");
const Equipo = require("../models/Equipo");
const UsuarioAuth = require("../models/UsuarioAuth");
const { isOrganizador, obtenerCampeonatoIdsOrganizador } = require("./organizadorScope");
const { esTecnicoOdirigente, tecnicoPuedeAccederEquipo } = require("./roleScope");

function esAdministrador(user) {
  return String(user?.rol || "").toLowerCase() === "administrador";
}

function toId(value) {
  return value === undefined || value === null ? "" : String(value);
}

function toNumber(value, fallback = 0) {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? Number(num) : fallback;
}

function toInteger(value, fallback = 0) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) ? num : fallback;
}

function mapTournamentStatus(value) {
  const raw = String(value || "borrador").trim().toLowerCase();
  const map = {
    borrador: "DRAFT",
    inscripcion: "INSCRIPCION",
    en_curso: "EN_CURSO",
    finalizado: "FINALIZADO",
    archivado: "ARCHIVADO",
  };
  return map[raw] || "DRAFT";
}

function mapTournamentStatusToApi(value) {
  const raw = String(value || "DRAFT").trim().toUpperCase();
  const map = {
    DRAFT: "borrador",
    INSCRIPCION: "inscripcion",
    EN_CURSO: "en_curso",
    FINALIZADO: "finalizado",
    ARCHIVADO: "archivado",
  };
  return map[raw] || "borrador";
}

function mapFormat(value) {
  const raw = String(value || "grupos").trim().toLowerCase();
  const map = {
    grupos: "GRUPOS",
    liga: "LIGA",
    eliminatoria: "ELIMINATORIA",
    mixto: "MIXTO",
  };
  return map[raw] || "GRUPOS";
}

function mapUser(user) {
  return {
    id: toId(user?.id),
    fullName: user?.nombre || "",
    email: user?.email || "",
    role: String(user?.rol || "").toLowerCase(),
    organizationName: user?.organizacion_nombre || "",
    readOnly: user?.solo_lectura === true,
    planCode: user?.plan_codigo || "",
    planStatus: user?.plan_estado || "",
    teamIds: Array.isArray(user?.equipo_ids) ? user.equipo_ids.map((id) => toId(id)) : [],
  };
}

function mapTournament(row, counts = {}) {
  return {
    id: toId(row.id),
    name: row.nombre || "",
    organizer: row.organizador || "",
    startDate: row.fecha_inicio || null,
    endDate: row.fecha_fin || null,
    footballType: row.tipo_futbol || "",
    scoringSystem: row.sistema_puntuacion || "tradicional",
    maxTeams: row.max_equipos == null ? null : toInteger(row.max_equipos, 0),
    minPlayers: row.min_jugador == null ? null : toInteger(row.min_jugador, 0),
    maxPlayers: row.max_jugador == null ? null : toInteger(row.max_jugador, 0),
    status: mapTournamentStatus(row.estado),
    requireNationalId: row.requiere_cedula_jugador !== false,
    requireNationalIdPhoto: row.requiere_foto_cedula === true,
    requirePlayerCardPhoto: row.requiere_foto_carnet === true,
    generatePlayerCards: row.genera_carnets === true,
    refereeFeePerTeam: toNumber(row.costo_arbitraje, 0),
    yellowCardFee: toNumber(row.costo_tarjeta_amarilla, 0),
    redCardFee: toNumber(row.costo_tarjeta_roja, 0),
    playerCardFee: toNumber(row.costo_carnet, 0),
    createdAt: row.created_at || null,
    counts: {
      categories: counts.categories || 0,
      teams: counts.teams || 0,
    },
  };
}

function mapEvent(row, totalTeams = 0) {
  return {
    id: toId(row.id),
    tournamentId: toId(row.campeonato_id),
    name: row.nombre || "",
    organizer: row.organizador || "",
    startDate: row.fecha_inicio || null,
    endDate: row.fecha_fin || null,
    format: mapFormat(row.metodo_competencia),
    registrationFee: toNumber(row.costo_inscripcion, 0),
    eliminationSize: row.eliminatoria_equipos == null ? null : toInteger(row.eliminatoria_equipos, 0),
    modality: row.modalidad || "weekend",
    status: row.estado || "activo",
    createdAt: row.created_at || null,
    counts: {
      teams: totalTeams,
    },
  };
}

function mapTeam(row, playerCount = 0) {
  return {
    id: toId(row.id),
    tournamentId: toId(row.campeonato_id),
    name: row.nombre || "",
    coachName: row.director_tecnico || "",
    assistantCoach: row.asistente_tecnico || "",
    medic: row.medico || "",
    phone: row.telefono || "",
    email: row.email || "",
    colors: [row.color_primario, row.color_secundario, row.color_terciario].filter(Boolean),
    seeded: row.cabeza_serie === true,
    drawOrder:
      row.evento_orden_sorteo == null ? null : toInteger(row.evento_orden_sorteo, 0),
    logoUrl: row.logo_url || null,
    createdAt: row.created_at || null,
    counts: {
      players: playerCount,
    },
  };
}

function mapPlayer(row) {
  return {
    id: toId(row.id),
    teamId: toId(row.equipo_id),
    fullName: [row.nombre, row.apellido].filter(Boolean).join(" ").trim(),
    firstName: row.nombre || "",
    lastName: row.apellido || "",
    nationalId: row.cedidentidad || null,
    birthDate: row.fecha_nacimiento || null,
    position: row.posicion || "",
    shirtNumber: row.numero_camiseta == null ? null : toInteger(row.numero_camiseta, 0),
    isCaptain: row.es_capitan === true,
    teamName: row.nombre_equipo || "",
  };
}

async function obtenerEquipoIdsVisibles(user) {
  if (!user) return [];
  if (!esTecnicoOdirigente(user.rol)) return null;

  const directos = Array.isArray(user.equipo_ids)
    ? user.equipo_ids
        .map((item) => Number.parseInt(item, 10))
        .filter((item) => Number.isFinite(item) && item > 0)
    : [];
  if (directos.length) return directos;

  return UsuarioAuth.obtenerEquipoIds(user.id);
}

async function obtenerCampeonatoIdsVisibles(user) {
  if (esAdministrador(user)) return null;
  if (isOrganizador(user)) return obtenerCampeonatoIdsOrganizador(user);

  const equipoIds = await obtenerEquipoIdsVisibles(user);
  if (!equipoIds?.length) return [];

  const r = await pool.query(
    `
      SELECT DISTINCT campeonato_id
      FROM equipos
      WHERE id = ANY($1::int[])
      ORDER BY campeonato_id
    `,
    [equipoIds]
  );

  return r.rows
    .map((row) => Number.parseInt(row.campeonato_id, 10))
    .filter((id) => Number.isFinite(id) && id > 0);
}

async function assertCampeonatoAccess(user, campeonatoId) {
  const campId = Number.parseInt(campeonatoId, 10);
  if (!Number.isFinite(campId) || campId <= 0) {
    throw new Error("campeonato_id invalido");
  }

  if (esAdministrador(user)) return campId;
  const visibles = await obtenerCampeonatoIdsVisibles(user);
  if (visibles === null || visibles.includes(campId)) return campId;
  throw new Error("No autorizado para consultar este campeonato");
}

async function assertEventoAccess(user, eventoId) {
  const eventId = Number.parseInt(eventoId, 10);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    throw new Error("evento_id invalido");
  }

  const r = await pool.query(`SELECT * FROM eventos WHERE id = $1 LIMIT 1`, [eventId]);
  const evento = r.rows[0] || null;
  if (!evento) throw new Error("Evento no encontrado");

  await assertCampeonatoAccess(user, evento.campeonato_id);

  if (esTecnicoOdirigente(user.rol)) {
    const equipoIds = await obtenerEquipoIdsVisibles(user);
    if (!equipoIds?.length) throw new Error("No autorizado para consultar este evento");
    const permitido = await pool.query(
      `
        SELECT 1
        FROM evento_equipos
        WHERE evento_id = $1
          AND equipo_id = ANY($2::int[])
        LIMIT 1
      `,
      [eventId, equipoIds]
    );
    if (!permitido.rows.length) {
      throw new Error("No autorizado para consultar este evento");
    }
  }

  return evento;
}

async function assertEquipoAccess(user, equipoId) {
  const teamId = Number.parseInt(equipoId, 10);
  if (!Number.isFinite(teamId) || teamId <= 0) {
    throw new Error("equipo_id invalido");
  }

  const equipo = await Equipo.obtenerPorId(teamId);
  if (!equipo) throw new Error("Equipo no encontrado");

  await assertCampeonatoAccess(user, equipo.campeonato_id);
  if (esTecnicoOdirigente(user.rol)) {
    const permitido = await tecnicoPuedeAccederEquipo({ user }, teamId);
    if (!permitido) throw new Error("No autorizado para consultar este equipo");
  }

  return equipo;
}

module.exports = {
  assertCampeonatoAccess,
  assertEquipoAccess,
  assertEventoAccess,
  esAdministrador,
  mapEvent,
  mapFormat,
  mapPlayer,
  mapTeam,
  mapTournament,
  mapTournamentStatus,
  mapTournamentStatusToApi,
  mapUser,
  obtenerCampeonatoIdsVisibles,
  obtenerEquipoIdsVisibles,
  toId,
  toInteger,
  toNumber,
};
