const pool = require("../config/database");
const Equipo = require("../models/Equipo");
const Jugador = require("../models/Jugador");
const Partido = require("../models/Partido");
const Pase = require("../models/Pase");
const UsuarioAuth = require("../models/UsuarioAuth");
const { obtenerPlanPorCampeonatoId } = require("./planLimits");
const {
  assertCampeonatoAccess,
  assertEquipoAccess,
  assertEventoAccess,
  esAdministrador,
  mapEvent,
  mapPlayer,
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

function parsePositiveInt(value, field) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${field} invalido`);
  }
  return parsed;
}

function parseOptionalPositiveInt(value, field) {
  if (value === undefined || value === null || `${value}`.trim() === "") return null;
  return parsePositiveInt(value, field);
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "si", "sí", "yes", "y", "x"].includes(raw);
}

function parseDecimalNonNegative(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const num = Number.parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Number(num.toFixed(2));
}

function parseDecimalNullable(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const num = Number.parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Number(num.toFixed(2));
}

function parseDateOnly(value, field) {
  const raw = String(value || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`${field} invalido`);
  }
  return raw;
}

function parseTimeHHMM(value, fallback) {
  if (!value) return fallback;
  const s = String(value).trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.length === 5 ? `${s}:00` : s;
  return fallback;
}

function normalizarMetodoCompetenciaMovil(value, fallback = "grupos") {
  const raw = String(value || fallback).trim().toLowerCase();
  const map = {
    grupos: "grupos",
    group: "grupos",
    groups: "grupos",
    liga: "liga",
    league: "liga",
    todos: "liga",
    todos_contra_todos: "liga",
    eliminatoria: "eliminatoria",
    eliminacion: "eliminatoria",
    eliminacion_directa: "eliminatoria",
    eliminatoria_directa: "eliminatoria",
    knockout: "eliminatoria",
    mixto: "mixto",
    mixed: "mixto",
    grupos_y_eliminatoria: "mixto",
  };
  return map[raw] || null;
}

function normalizarEliminatoriaEquipos(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  if (![4, 8, 16, 32].includes(n)) return null;
  return n;
}

let mobileEventoSchemaAsegurado = false;
async function asegurarEsquemaEventosMovil() {
  if (mobileEventoSchemaAsegurado) return;

  await pool.query(`
    ALTER TABLE eventos
    ADD COLUMN IF NOT EXISTS campeonato_id INTEGER,
    ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'activo',
    ADD COLUMN IF NOT EXISTS modalidad VARCHAR(20) DEFAULT 'weekend',
    ADD COLUMN IF NOT EXISTS costo_inscripcion NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS metodo_competencia VARCHAR(30) DEFAULT 'grupos',
    ADD COLUMN IF NOT EXISTS eliminatoria_equipos INTEGER,
    ADD COLUMN IF NOT EXISTS bloquear_morosos BOOLEAN,
    ADD COLUMN IF NOT EXISTS bloqueo_morosidad_monto NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS horario_weekday_inicio TIME,
    ADD COLUMN IF NOT EXISTS horario_weekday_fin TIME,
    ADD COLUMN IF NOT EXISTS horario_sab_inicio TIME,
    ADD COLUMN IF NOT EXISTS horario_sab_fin TIME,
    ADD COLUMN IF NOT EXISTS horario_dom_inicio TIME,
    ADD COLUMN IF NOT EXISTS horario_dom_fin TIME,
    ADD COLUMN IF NOT EXISTS numero_campeonato INTEGER
  `);

  await pool.query(`
    UPDATE eventos
    SET costo_inscripcion = 0
    WHERE costo_inscripcion IS NULL
  `);
  await pool.query(`
    UPDATE eventos
    SET metodo_competencia = 'grupos'
    WHERE metodo_competencia IS NULL OR TRIM(metodo_competencia) = ''
  `);
  await pool.query(`
    UPDATE eventos
    SET numero_campeonato = ranked.rn
    FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY campeonato_id
          ORDER BY id
        )::int AS rn
      FROM eventos
      WHERE campeonato_id IS NOT NULL
    ) ranked
    WHERE eventos.id = ranked.id
      AND eventos.numero_campeonato IS NULL
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_eventos_numero_campeonato
    ON eventos(campeonato_id, numero_campeonato)
    WHERE numero_campeonato IS NOT NULL
  `);

  mobileEventoSchemaAsegurado = true;
}

async function crearEventoMovil(user, body = {}) {
  if (!canWrite(user)) throw new Error("No autorizado para crear categorías");

  await asegurarEsquemaEventosMovil();

  const campeonatoId = parsePositiveInt(body.tournamentId ?? body.campeonato_id, "campeonato_id");
  const campId = await assertCampeonatoAccess(user, campeonatoId);

  const campR = await pool.query(`SELECT id FROM campeonatos WHERE id = $1 LIMIT 1`, [campId]);
  if (!campR.rows.length) throw new Error("Campeonato no encontrado");

  if (!esAdministrador(user)) {
    const plan = await obtenerPlanPorCampeonatoId(campId);
    if (
      plan?.max_categorias_por_campeonato !== null &&
      plan?.max_categorias_por_campeonato !== undefined
    ) {
      const countR = await pool.query(
        `SELECT COUNT(*)::int AS total FROM eventos WHERE campeonato_id = $1`,
        [campId]
      );
      const totalActual = Number(countR.rows[0]?.total || 0);
      if (totalActual >= Number(plan.max_categorias_por_campeonato)) {
        throw new Error(
          `Tu plan ${plan.nombre} permite máximo ${plan.max_categorias_por_campeonato} categorías por campeonato`
        );
      }
    }
  }

  const nombre = String(body.name ?? body.nombre ?? "").trim();
  if (!nombre) throw new Error("nombre obligatorio");

  const fechaInicio = parseDateOnly(body.startDate ?? body.fecha_inicio, "fecha_inicio");
  const fechaFin = parseDateOnly(body.endDate ?? body.fecha_fin, "fecha_fin");
  const metodoCompetencia = normalizarMetodoCompetenciaMovil(
    body.format ?? body.metodo_competencia ?? body.competitionMethod,
    "grupos"
  );
  if (!metodoCompetencia) {
    throw new Error("metodo_competencia invalido. Usa: grupos, liga, eliminatoria o mixto");
  }

  const eliminatoriaEquipos = normalizarEliminatoriaEquipos(
    body.eliminationSize ?? body.eliminatoria_equipos,
    null
  );
  if (
    (body.eliminationSize !== undefined || body.eliminatoria_equipos !== undefined) &&
    eliminatoriaEquipos === null
  ) {
    throw new Error("eliminatoria_equipos invalido. Valores permitidos: 4, 8, 16, 32");
  }

  const modalidad = String(body.modality ?? body.modalidad ?? "weekend").trim().toLowerCase() || "weekend";
  const organizador =
    String(body.organizer ?? body.organizador ?? "").trim() ||
    user?.organizacion_nombre ||
    user?.nombre ||
    user?.email ||
    null;

  const horarios = body.horarios || {};
  const wkStart = parseTimeHHMM(horarios?.weekday?.start, "19:00:00");
  const wkEnd = parseTimeHHMM(horarios?.weekday?.end, "22:00:00");
  const satStart = parseTimeHHMM(horarios?.weekend?.sat_start, "13:00:00");
  const satEnd = parseTimeHHMM(horarios?.weekend?.sat_end, "18:00:00");
  const sunStart = parseTimeHHMM(horarios?.weekend?.sun_start, "08:00:00");
  const sunEnd = parseTimeHHMM(horarios?.weekend?.sun_end, "17:00:00");

  const costoInscripcion = parseDecimalNonNegative(
    body.registrationFee ?? body.costo_inscripcion,
    0
  );
  const bloquearMorosos =
    body.blockDebtors === undefined &&
    body.bloquear_morosos === undefined &&
    body.debtBlockAmount === undefined &&
    body.bloqueo_morosidad_monto === undefined
      ? null
      : parseBoolean(body.blockDebtors ?? body.bloquear_morosos, false);
  const bloqueoMorosidadMonto = parseDecimalNullable(
    body.debtBlockAmount ?? body.bloqueo_morosidad_monto,
    null
  );

  const insertR = await pool.query(
    `
      WITH next_num AS (
        SELECT COALESCE(MAX(numero_campeonato), 0) + 1 AS next_num
        FROM eventos
        WHERE campeonato_id = $1
      )
      INSERT INTO eventos (
        campeonato_id, nombre, organizador, fecha_inicio, fecha_fin, estado,
        modalidad, metodo_competencia, eliminatoria_equipos, costo_inscripcion,
        bloquear_morosos, bloqueo_morosidad_monto,
        horario_weekday_inicio, horario_weekday_fin,
        horario_sab_inicio, horario_sab_fin,
        horario_dom_inicio, horario_dom_fin,
        numero_campeonato
      )
      SELECT
        $1, $2, $3, $4, $5, 'activo',
        $6, $7, $8, $9,
        $10, $11,
        $12, $13,
        $14, $15,
        $16, $17,
        next_num.next_num
      FROM next_num
      RETURNING *
    `,
    [
      campId,
      nombre,
      organizador,
      fechaInicio,
      fechaFin,
      modalidad,
      metodoCompetencia,
      eliminatoriaEquipos,
      costoInscripcion,
      bloquearMorosos,
      bloqueoMorosidadMonto,
      wkStart,
      wkEnd,
      satStart,
      satEnd,
      sunStart,
      sunEnd,
    ]
  );

  return mapEvent(insertR.rows[0], 0);
}

async function existeNombreEquipoEnEvento(eventoId, nombreEquipo, client = pool) {
  const evento = Number.parseInt(eventoId, 10);
  const nombre = String(nombreEquipo || "").trim().toLowerCase();
  if (!Number.isFinite(evento) || evento <= 0 || !nombre) return false;

  const r = await client.query(
    `
      SELECT 1
      FROM evento_equipos ee
      JOIN equipos e ON e.id = ee.equipo_id
      WHERE ee.evento_id = $1
        AND LOWER(TRIM(e.nombre)) = $2
      LIMIT 1
    `,
    [evento, nombre]
  );
  return r.rows.length > 0;
}

async function obtenerReglasDocumentosPorEquipo(equipoId) {
  const r = await pool.query(
    `
      SELECT
        COALESCE(c.requiere_cedula_jugador, true) AS requiere_cedula_jugador,
        COALESCE(c.requiere_foto_cedula, false) AS requiere_foto_cedula,
        COALESCE(c.requiere_foto_carnet, false) AS requiere_foto_carnet
      FROM equipos e
      JOIN campeonatos c ON c.id = e.campeonato_id
      WHERE e.id = $1
      LIMIT 1
    `,
    [equipoId]
  );

  return (
    r.rows[0] || {
      requiere_cedula_jugador: true,
      requiere_foto_cedula: false,
      requiere_foto_carnet: false,
    }
  );
}

async function crearEquipoMovil(user, body = {}) {
  if (!canWrite(user)) throw new Error("No autorizado para crear equipos");

  const campeonatoId = parsePositiveInt(body.tournamentId ?? body.campeonato_id, "campeonato_id");
  const eventoId = parsePositiveInt(body.eventId ?? body.evento_id, "evento_id");
  const nombre = String(body.name ?? body.nombre ?? "").trim();
  const directorTecnico = String(body.coachName ?? body.director_tecnico ?? "").trim();

  if (!nombre || !directorTecnico) {
    throw new Error("nombre y director_tecnico son obligatorios");
  }

  const campeonatoAccesoId = await assertCampeonatoAccess(user, campeonatoId);
  const evento = await assertEventoAccess(user, eventoId);
  if (Number(evento.campeonato_id) !== Number(campeonatoAccesoId)) {
    throw new Error("La categoría seleccionada no pertenece al campeonato seleccionado");
  }

  const existeNombre = await existeNombreEquipoEnEvento(evento.id, nombre);
  if (existeNombre) {
    throw new Error("Ya existe un equipo con ese nombre en la categoría seleccionada");
  }

  const colors = Array.isArray(body.colors)
    ? body.colors.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const colorPrimario = String(body.primaryColor ?? body.color_primario ?? colors[0] ?? "").trim() || null;
  const colorSecundario = String(body.secondaryColor ?? body.color_secundario ?? colors[1] ?? "").trim() || null;
  const colorTerciario = String(body.accentColor ?? body.color_terciario ?? colors[2] ?? "").trim() || null;
  const colorEquipo =
    String(body.color_equipo ?? body.color ?? "").trim() || colorPrimario || colorSecundario || colorTerciario;

  const equipo = await Equipo.crear(
    campeonatoAccesoId,
    nombre,
    directorTecnico,
    String(body.assistantCoach ?? body.asistente_tecnico ?? "").trim() || null,
    String(body.medic ?? body.medico ?? "").trim() || null,
    colorEquipo || null,
    colorPrimario,
    colorSecundario,
    colorTerciario,
    String(body.phone ?? body.telefono ?? "").trim() || null,
    String(body.email ?? "").trim() || null,
    null,
    parseBoolean(body.seeded ?? body.cabeza_serie, false)
  );

  await pool.query(
    `
      INSERT INTO evento_equipos (evento_id, equipo_id)
      VALUES ($1, $2)
      ON CONFLICT (evento_id, equipo_id) DO NOTHING
    `,
    [evento.id, equipo.id]
  );

  const detalle = await Equipo.obtenerPorId(Number(equipo.id));
  return mapTeam(detalle || equipo, 0);
}

async function crearJugadorMovil(user, body = {}) {
  if (!canWrite(user)) throw new Error("No autorizado para crear jugadores");

  const equipoId = parsePositiveInt(body.teamId ?? body.equipo_id, "equipo_id");
  const nombre = String(body.firstName ?? body.nombre ?? "").trim();
  const apellido = String(body.lastName ?? body.apellido ?? "").trim();
  const cedidentidad = String(body.nationalId ?? body.cedidentidad ?? "").trim() || null;
  const fechaNacimiento = String(body.birthDate ?? body.fecha_nacimiento ?? "").trim() || null;
  const posicion = String(body.position ?? body.posicion ?? "").trim() || null;
  const numeroRaw = body.shirtNumber ?? body.numero_camiseta;
  const esCapitan = parseBoolean(body.isCaptain ?? body.es_capitan, false);

  if (!nombre || !apellido) {
    throw new Error("nombre y apellido son obligatorios");
  }

  let numeroCamiseta = null;
  if (numeroRaw !== undefined && numeroRaw !== null && `${numeroRaw}`.trim() !== "") {
    const parsed = Number.parseInt(numeroRaw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("numero_camiseta invalido");
    }
    numeroCamiseta = parsed;
  }

  const equipo = await assertEquipoAccess(user, equipoId);
  const campeonatoId = parseOptionalPositiveInt(body.tournamentId ?? body.campeonato_id, "campeonato_id");
  if (campeonatoId && Number(equipo.campeonato_id) !== Number(campeonatoId)) {
    throw new Error("El equipo no pertenece al campeonato seleccionado");
  }

  const eventoId = parseOptionalPositiveInt(body.eventId ?? body.evento_id, "evento_id");
  if (eventoId) {
    const evento = await assertEventoAccess(user, eventoId);
    if (Number(evento.campeonato_id) !== Number(equipo.campeonato_id)) {
      throw new Error("El equipo no pertenece al campeonato seleccionado");
    }
    const r = await pool.query(
      `
        SELECT 1
        FROM evento_equipos
        WHERE evento_id = $1
          AND equipo_id = $2
        LIMIT 1
      `,
      [evento.id, equipo.id]
    );
    if (!r.rows.length) {
      throw new Error("El equipo no pertenece a la categoría seleccionada");
    }
  }

  const reglasDocs = await obtenerReglasDocumentosPorEquipo(Number(equipo.id));
  if (reglasDocs.requiere_cedula_jugador && !cedidentidad) {
    throw new Error("Este campeonato exige cédula de identidad para inscribir jugadores");
  }
  if (reglasDocs.requiere_foto_cedula) {
    throw new Error("Este campeonato exige foto de cédula para inscribir jugadores");
  }
  if (reglasDocs.requiere_foto_carnet) {
    throw new Error("Este campeonato exige foto carnet para inscribir jugadores");
  }

  const jugador = await Jugador.crear(
    equipo.id,
    nombre,
    apellido,
    cedidentidad,
    fechaNacimiento,
    posicion,
    numeroCamiseta,
    esCapitan,
    null,
    null
  );

  const detalle = await Jugador.obtenerPorId(Number(jugador.id));
  return mapPlayer(detalle || jugador);
}

async function eliminarJugadorMovil(user, jugadorId) {
  if (!canWrite(user)) throw new Error("No autorizado para eliminar jugadores");

  const id = parsePositiveInt(jugadorId, "jugador_id");
  const jugador = await Jugador.obtenerPorId(id);
  if (!jugador) throw new Error("Jugador no encontrado");

  await assertEquipoAccess(user, jugador.equipo_id);
  const eliminado = await Jugador.eliminar(id);
  if (!eliminado) throw new Error("Jugador no encontrado");

  return {
    id: toId(eliminado.id),
    teamId: toId(eliminado.equipo_id),
  };
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
  const suspension = player?.suspension || null;
  return {
    id: toId(player.id),
    teamId: toId(player.equipo_id),
    fullName: [player.nombre, player.apellido].filter(Boolean).join(" ").trim(),
    nationalId: player.cedidentidad || null,
    shirtNumber: player.numero_camiseta == null ? null : toInteger(player.numero_camiseta, null),
    position: player.posicion || "",
    suspension: suspension
      ? {
          suspended: suspension.suspendido === true,
          pendingMatches: toInteger(suspension.partidos_pendientes, 0),
          accumulatedYellows: toInteger(suspension.amarillas_acumuladas, 0),
          reason: suspension.motivo || null,
        }
      : null,
  };
}

function mapDebtNotice(notice) {
  if (!notice || typeof notice !== "object") return null;
  const teams = Array.isArray(notice.equipos)
    ? notice.equipos
        .map((item) => ({
          teamId: toId(item.equipo_id),
          teamName: item.nombre || "",
          balance: toNumber(item.saldo, 0),
        }))
        .filter((item) => Number.isFinite(item.teamId))
    : [];
  if (!teams.length) return null;
  return {
    total: toNumber(notice.total, teams.reduce((acc, item) => acc + toNumber(item.balance, 0), 0)),
    message: String(notice.mensaje || "").trim() || "Existe deuda pendiente en uno o ambos equipos.",
    teams,
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
    debtNotice: mapDebtNotice(data.aviso_morosidad),
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

  const guardado = await Partido.guardarPlanilla(Number(partido.id), {
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

  const data = await obtenerPlanillaPartido(user, partido.id);
  if (guardado?.aviso_morosidad) {
    data.debtNotice = mapDebtNotice(guardado.aviso_morosidad);
  }
  return data;
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
  crearEventoMovil,
  crearEquipoMovil,
  crearJugadorMovil,
  eliminarJugadorMovil,
  actualizarEstadoPase,
  guardarPlanillaPartido,
  listarEquiposVisibles,
  listarEventosVisibles,
  listarPartidosEvento,
  listarPasesVisibles,
  listarUsuariosVisibles,
  obtenerPlanillaPartido,
};
