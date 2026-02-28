const Eliminatoria = require("../models/Eliminatoria");
const {
  assertEventoAccess,
  mapEvent,
  toId,
  toInteger,
} = require("./mobileAccessService");

const ROUND_ORDER = ["64vos", "32vos", "16vos", "8vos", "4tos", "semifinal", "final"];

function canWriteCompetition(user) {
  return ["administrador", "organizador"].includes(String(user?.rol || "").toLowerCase());
}

function requireWriteAccess(user) {
  if (!canWriteCompetition(user)) {
    throw new Error("No autorizado para administrar eliminatorias");
  }
}

function normalizeRoundLabel(value) {
  const raw = String(value || "").toLowerCase();
  const map = {
    "64vos": "64vos",
    "32vos": "32vos",
    "16vos": "16vos",
    "8vos": "8vos",
    "4tos": "4tos",
    semifinal: "Semifinal",
    final: "Final",
  };
  return map[raw] || value || "Ronda";
}

function mapKnockoutMatch(row) {
  const homeScore = row.resultado_local == null ? null : toInteger(row.resultado_local, 0);
  const awayScore = row.resultado_visitante == null ? null : toInteger(row.resultado_visitante, 0);
  return {
    id: toId(row.id),
    round: row.ronda || "",
    roundLabel: normalizeRoundLabel(row.ronda),
    matchNumber: toInteger(row.partido_numero, 0),
    status:
      Number.isFinite(homeScore) && Number.isFinite(awayScore)
        ? "JUGADO"
        : row.ganador_id
          ? "RESUELTO"
          : "PENDIENTE",
    homeTeam: row.equipo_local_id
      ? {
          id: toId(row.equipo_local_id),
          name: row.equipo_local_nombre || "Por definir",
          seedRef: row.seed_local_ref || null,
        }
      : null,
    awayTeam: row.equipo_visitante_id
      ? {
          id: toId(row.equipo_visitante_id),
          name: row.equipo_visitante_nombre || "Por definir",
          seedRef: row.seed_visitante_ref || null,
        }
      : null,
    result:
      Number.isFinite(homeScore) && Number.isFinite(awayScore)
        ? {
            homeScore,
            awayScore,
          }
        : null,
    winnerTeamId: row.ganador_id ? toId(row.ganador_id) : null,
    winnerName: row.ganador_nombre || null,
  };
}

function mapBracket(evento, partidos = [], meta = null) {
  const roundsMap = new Map();

  partidos.forEach((row) => {
    const key = row.ronda || "ronda";
    if (!roundsMap.has(key)) {
      roundsMap.set(key, {
        id: key,
        label: normalizeRoundLabel(key),
        matches: [],
      });
    }
    roundsMap.get(key).matches.push(mapKnockoutMatch(row));
  });

  const rounds = Array.from(roundsMap.values()).sort(
    (a, b) => ROUND_ORDER.indexOf(a.id) - ROUND_ORDER.indexOf(b.id)
  );
  rounds.forEach((round) => {
    round.matches.sort((a, b) => a.matchNumber - b.matchNumber);
  });

  return {
    event: mapEvent(evento, 0),
    rounds,
    totalMatches: partidos.length,
    generated: partidos.length > 0,
    meta,
  };
}

async function obtenerEliminatoriasEvento(user, eventoId) {
  const evento = await assertEventoAccess(user, eventoId);
  const partidos = await Eliminatoria.obtenerPorEvento(evento.id);
  return mapBracket(evento, partidos);
}

async function generarEliminatoriasEvento(user, eventoId, body = {}) {
  requireWriteAccess(user);
  const evento = await assertEventoAccess(user, eventoId);

  const existentes = await Eliminatoria.obtenerPorEvento(evento.id);
  if (existentes.length && body.overwrite !== true) {
    throw new Error("La categoría ya tiene eliminatorias generadas. Usa overwrite para regenerar");
  }

  const format = String(evento.metodo_competencia || "").toLowerCase();
  const origin = String(body.origin || (format === "mixto" ? "grupos" : "evento")).toLowerCase();

  let partidos = [];
  let meta = null;
  if (origin === "grupos") {
    const generado = await Eliminatoria.generarBracketDesdeGrupos(evento.id, {
      clasificados_por_grupo: body.qualifiersPerGroup,
      metodo_clasificacion: body.classificationMethod || "cruces_grupos",
      cruces_grupos: body.groupCrosses || null,
      cantidad_equipos: body.targetSize,
    });
    partidos = Array.isArray(generado?.partidos) ? generado.partidos : [];
    meta = generado?.meta || null;
  } else {
    partidos = await Eliminatoria.generarBracket(evento.id, body.targetSize || evento.eliminatoria_equipos || null);
  }

  return mapBracket(evento, partidos, meta);
}

async function actualizarResultadoEliminatoria(user, eliminatoriaId, body = {}) {
  requireWriteAccess(user);
  const slot = await Eliminatoria.obtenerSlotPorId(Number.parseInt(eliminatoriaId, 10));
  if (!slot) throw new Error("Partido eliminatorio no encontrado");

  const evento = await assertEventoAccess(user, slot.evento_id);
  const homeScore = Number.parseInt(body.homeScore, 10);
  const awayScore = Number.parseInt(body.awayScore, 10);
  const winnerTeamId =
    body.winnerTeamId == null || body.winnerTeamId === ""
      ? null
      : Number.parseInt(body.winnerTeamId, 10);

  if (!Number.isFinite(homeScore) || homeScore < 0) {
    throw new Error("homeScore invalido");
  }
  if (!Number.isFinite(awayScore) || awayScore < 0) {
    throw new Error("awayScore invalido");
  }
  if (homeScore === awayScore && !Number.isFinite(winnerTeamId)) {
    throw new Error("winnerTeamId es obligatorio cuando el resultado queda empatado");
  }

  await Eliminatoria.actualizarResultado(slot.id, homeScore, awayScore, winnerTeamId);
  const partidos = await Eliminatoria.obtenerPorEvento(evento.id);
  return mapBracket(evento, partidos);
}

module.exports = {
  actualizarResultadoEliminatoria,
  generarEliminatoriasEvento,
  obtenerEliminatoriasEvento,
};
