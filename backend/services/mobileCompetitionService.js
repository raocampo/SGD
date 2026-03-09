const pool = require("../config/database");
const Campeonato = require("../models/Campeonato");
const Finanza = require("../models/Finanza");
const Partido = require("../models/Partido");
const { _internals: tablaInternals } = require("../controllers/tablaController");
const {
  assertCampeonatoAccess,
  assertEquipoAccess,
  assertEventoAccess,
  mapEvent,
  mapTeam,
  mapTournament,
  obtenerEquipoIdsVisibles,
  toId,
  toInteger,
  toNumber,
} = require("./mobileAccessService");

function formatScheduledAt(row) {
  if (!row?.fecha_partido && !row?.hora_partido) return null;
  const fecha = row?.fecha_partido ? String(row.fecha_partido).slice(0, 10) : "";
  const hora = row?.hora_partido ? String(row.hora_partido).slice(0, 8) : "00:00:00";
  return fecha ? `${fecha}T${hora}` : null;
}

function canWriteCompetition(user) {
  return ["administrador", "organizador"].includes(String(user?.rol || "").toLowerCase());
}

async function obtenerCompetenciaEvento(user, eventoId) {
  const evento = await assertEventoAccess(user, eventoId);
  await Partido.asegurarEsquemaPlanilla();
  const partidos = await Partido.obtenerPorEvento(evento.id);
  const tablas = await tablaInternals.generarTablasEventoInterna(evento.id);

  const tarjetasR = await pool.query(
    `
      SELECT
        t.partido_id,
        t.equipo_id,
        SUM(CASE WHEN LOWER(t.tipo_tarjeta) = 'amarilla' THEN 1 ELSE 0 END)::int AS amarillas,
        SUM(CASE WHEN LOWER(t.tipo_tarjeta) = 'roja' THEN 1 ELSE 0 END)::int AS rojas
      FROM tarjetas t
      JOIN partidos p ON p.id = t.partido_id
      WHERE p.evento_id = $1
      GROUP BY t.partido_id, t.equipo_id
    `,
    [evento.id]
  );

  const tarjetasMap = new Map(
    tarjetasR.rows.map((row) => [
      `${row.partido_id}:${row.equipo_id}`,
      {
        amarillas: Number(row.amarillas || 0),
        rojas: Number(row.rojas || 0),
      },
    ])
  );

  const jornadasMap = new Map();
  for (const partido of partidos) {
    const jornada = toInteger(partido.jornada, 0);
    if (!jornadasMap.has(jornada)) {
      jornadasMap.set(jornada, {
        id: `jornada-${jornada}`,
        roundNumber: jornada,
        label: jornada > 0 ? `Fecha ${jornada}` : "Partidos",
        matches: [],
      });
    }

    const tarjetasLocal = tarjetasMap.get(`${partido.id}:${partido.equipo_local_id}`) || {
      amarillas: 0,
      rojas: 0,
    };
    const tarjetasVisitante = tarjetasMap.get(`${partido.id}:${partido.equipo_visitante_id}`) || {
      amarillas: 0,
      rojas: 0,
    };

    jornadasMap.get(jornada).matches.push({
      id: toId(partido.id),
      status: String(partido.estado || "").toLowerCase() === "finalizado" ? "JUGADO" : "PROGRAMADO",
      groupLabel: partido.letra_grupo || partido.nombre_grupo || null,
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
        partido.resultado_local === null || partido.resultado_visitante === null
          ? null
          : {
              homeScore: toInteger(partido.resultado_local, 0),
              awayScore: toInteger(partido.resultado_visitante, 0),
              homeYellowCards: tarjetasLocal.amarillas,
              awayYellowCards: tarjetasVisitante.amarillas,
              homeRedCards: tarjetasLocal.rojas,
              awayRedCards: tarjetasVisitante.rojas,
            },
    });
  }

  const standings = (tablas.grupos || []).map((grupo) => ({
    id: grupo.grupo?.id ? toId(grupo.grupo.id) : `tabla-${grupo.grupo?.letra_grupo || "general"}`,
    label:
      grupo.grupo?.letra_grupo && grupo.grupo?.letra_grupo !== "-"
        ? `Grupo ${grupo.grupo.letra_grupo}`
        : grupo.grupo?.nombre_grupo || "Tabla General",
    rows: (grupo.tabla || []).map((row) => ({
      position: toInteger(row.posicion, 0),
      teamId: toId(row.equipo?.id),
      teamName: row.equipo?.nombre || "",
      played: toInteger(row.estadisticas?.partidos_jugados, 0),
      won: toInteger(row.estadisticas?.partidos_ganados, 0),
      drawn: toInteger(row.estadisticas?.partidos_empatados, 0),
      lost: toInteger(row.estadisticas?.partidos_perdidos, 0),
      goalsFor: toInteger(row.estadisticas?.goles_favor, 0),
      goalsAgainst: toInteger(row.estadisticas?.goles_contra, 0),
      goalDiff: toInteger(row.estadisticas?.diferencia_goles, 0),
      points: toInteger(row.puntos, 0),
    })),
  }));

  return {
    event: mapEvent(evento, 0),
    fixture: Array.from(jornadasMap.values()).sort((a, b) => a.roundNumber - b.roundNumber),
    standings,
  };
}

async function obtenerFairPlayEvento(user, eventoId, query = {}) {
  const evento = await assertEventoAccess(user, eventoId);
  return tablaInternals.obtenerFairPlayEventoInterno(evento.id, query || {});
}

async function generarFixtureEvento(user, eventoId, body = {}) {
  const evento = await assertEventoAccess(user, eventoId);
  if (!canWriteCompetition(user)) {
    throw new Error("No autorizado para generar fixture");
  }

  const partidos = await Partido.generarFixtureEvento({
    evento_id: evento.id,
    ida_y_vuelta: body.homeAndAway === true,
    duracion_min: toInteger(body.durationMinutes, 90),
    descanso_min: toInteger(body.breakMinutes, 10),
    reemplazar: body.overwrite === true,
    programacion_manual: false,
    modo: "auto",
    fecha_inicio: body.startDate || null,
    fecha_fin: body.endDate || null,
  });

  return {
    ok: true,
    total: partidos.length,
  };
}

async function registrarResultadoResumen(user, partidoId, body = {}) {
  if (!canWriteCompetition(user)) {
    throw new Error("No autorizado para registrar resultados");
  }

  const id = Number.parseInt(partidoId, 10);
  if (!Number.isFinite(id) || id <= 0) throw new Error("partido_id invalido");

  const partido = await Partido.obtenerPorId(id);
  if (!partido) throw new Error("Partido no encontrado");
  await assertCampeonatoAccess(user, partido.campeonato_id);

  const resultadoLocal = toInteger(body.homeScore, NaN);
  const resultadoVisitante = toInteger(body.awayScore, NaN);
  const amarillasLocal = toInteger(body.homeYellowCards, 0);
  const amarillasVisitante = toInteger(body.awayYellowCards, 0);
  const rojasLocal = toInteger(body.homeRedCards, 0);
  const rojasVisitante = toInteger(body.awayRedCards, 0);

  if (!Number.isFinite(resultadoLocal) || resultadoLocal < 0) {
    throw new Error("homeScore invalido");
  }
  if (!Number.isFinite(resultadoVisitante) || resultadoVisitante < 0) {
    throw new Error("awayScore invalido");
  }

  const tarjetas = [];
  for (let i = 0; i < amarillasLocal; i += 1) {
    tarjetas.push({ equipo_id: partido.equipo_local_id, tipo_tarjeta: "amarilla" });
  }
  for (let i = 0; i < amarillasVisitante; i += 1) {
    tarjetas.push({ equipo_id: partido.equipo_visitante_id, tipo_tarjeta: "amarilla" });
  }
  for (let i = 0; i < rojasLocal; i += 1) {
    tarjetas.push({ equipo_id: partido.equipo_local_id, tipo_tarjeta: "roja" });
  }
  for (let i = 0; i < rojasVisitante; i += 1) {
    tarjetas.push({ equipo_id: partido.equipo_visitante_id, tipo_tarjeta: "roja" });
  }

  const payloadPlanilla = {
    resultado_local: resultadoLocal,
    resultado_visitante: resultadoVisitante,
    estado: "finalizado",
    tarjetas,
    pagos: {},
  };
  const motivoEdicion = String(body.editReason || body.motivoEdicion || body.motivo_edicion || "").trim();
  if (motivoEdicion) {
    payloadPlanilla.motivo_edicion = motivoEdicion;
  }

  await Partido.guardarPlanilla(
    id,
    payloadPlanilla,
    { usuario_id: user?.id || null }
  );

  return {
    ok: true,
    partidoId: toId(id),
  };
}

async function obtenerFinanzasCampeonato(user, campeonatoId, query = {}) {
  const campId = await assertCampeonatoAccess(user, campeonatoId);
  const campeonato = await Campeonato.obtenerPorId(campId);
  if (!campeonato) throw new Error("Campeonato no encontrado");
  const eventId = query.eventId ?? query.evento_id ?? null;
  const equipoIdsVisibles = await obtenerEquipoIdsVisibles(user);

  const filtros = {
    campeonato_id: campId,
    incluir_saldados: "true",
  };
  const filtrosMovimientos = {
    campeonato_id: campId,
    incluir_sistema: "true",
    limit: 500,
  };

  if (eventId) {
    filtros.evento_id = eventId;
    filtrosMovimientos.evento_id = eventId;
  }
  if (Array.isArray(equipoIdsVisibles) && equipoIdsVisibles.length) {
    filtros.equipo_ids = equipoIdsVisibles;
    filtrosMovimientos.equipo_ids = equipoIdsVisibles;
  } else if (Array.isArray(equipoIdsVisibles) && !equipoIdsVisibles.length) {
    return {
      tournament: mapTournament(campeonato),
      summary: [],
      charges: [],
    };
  }

  const [resumen, movimientos] = await Promise.all([
    Finanza.obtenerMorosidad(filtros),
    Finanza.listarMovimientos(filtrosMovimientos),
  ]);

  return {
    tournament: mapTournament(campeonato),
    summary: (resumen || []).map((row) => ({
      teamId: toId(row.equipo_id),
      teamName: row.equipo_nombre || "",
      pendingAmount: Math.max(toNumber(row.saldo, 0), 0),
      paidAmount: toNumber(row.total_abonos, 0),
      totalAmount: toNumber(row.total_cargos, 0),
      pendingCount: toNumber(row.saldo, 0) > 0 ? 1 : 0,
    })),
    charges: (movimientos || []).map((row) => ({
      id: toId(row.id),
      referenceCode:
        row.numero_recibo_campeonato != null
          ? `REC-${row.numero_recibo_campeonato}`
          : `MOV-${row.id}`,
      type: String(row.concepto || "otro").toUpperCase(),
      status: String(row.estado || "pendiente").toUpperCase(),
      quantity: 1,
      unitAmount: toNumber(row.monto, 0),
      totalAmount: toNumber(row.monto, 0),
      description: row.descripcion || null,
      paidAt: row.estado === "pagado" ? row.fecha_movimiento : null,
      team: {
        id: toId(row.equipo_id),
        name: row.equipo_nombre || "",
      },
      eventName: row.evento_nombre || null,
    })),
  };
}

async function marcarMovimientoPagado(user, movimientoId, body = {}) {
  if (!canWriteCompetition(user)) {
    throw new Error("No autorizado para registrar pagos");
  }

  const id = Number.parseInt(movimientoId, 10);
  if (!Number.isFinite(id) || id <= 0) throw new Error("movimiento_id invalido");

  const r = await pool.query(
    `
      SELECT id, campeonato_id
      FROM finanzas_movimientos
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );
  const movimiento = r.rows[0] || null;
  if (!movimiento) throw new Error("Movimiento no encontrado");
  await assertCampeonatoAccess(user, movimiento.campeonato_id);

  const actualizado = await Finanza.marcarMovimientoPagado(id, {
    metodo_pago: body.metodo_pago || "movil",
    referencia: body.referencia || null,
    fecha_movimiento: body.fecha_movimiento || null,
  });

  return {
    id: toId(actualizado.id),
    status: String(actualizado.estado || "pagado").toUpperCase(),
  };
}

function mapFinancialMovement(row) {
  return {
    id: toId(row.id),
    referenceCode:
      row.numero_recibo_campeonato != null
        ? `REC-${row.numero_recibo_campeonato}`
        : `MOV-${row.id}`,
    type: String(row.concepto || "otro").toUpperCase(),
    status: String(row.estado || "pendiente").toUpperCase(),
    quantity: 1,
    unitAmount: toNumber(row.monto, 0),
    totalAmount: toNumber(row.monto, 0),
    description: row.descripcion || null,
    paidAt: row.estado === "pagado" ? row.fecha_movimiento : null,
    team: {
      id: toId(row.equipo_id),
      name: row.equipo_nombre || "",
    },
    eventName: row.evento_nombre || null,
  };
}

async function obtenerEstadoCuentaEquipo(user, equipoId, query = {}) {
  const equipo = await assertEquipoAccess(user, equipoId);
  const data = await Finanza.obtenerEstadoCuentaEquipo(equipo.id, query);

  return {
    team: mapTeam(data.equipo, 0),
    summary: {
      totalCharges: toNumber(data.resumen?.total_cargos, 0),
      totalPayments: toNumber(data.resumen?.total_abonos, 0),
      balance: toNumber(data.resumen?.saldo, 0),
      registrationBalance: toNumber(data.resumen?.saldo_inscripcion, 0),
      refereeBalance: toNumber(data.resumen?.saldo_arbitraje, 0),
      finesBalance: toNumber(data.resumen?.saldo_multa, 0),
      pendingCharges: toNumber(data.resumen?.cargos_pendientes, 0),
      overdueCharges: toNumber(data.resumen?.cargos_vencidos, 0),
      status: String(data.resumen?.estado || "al_dia").toUpperCase(),
    },
    movements: (data.movimientos || []).map((row) =>
      mapFinancialMovement({
        ...row,
        equipo_id: data.equipo?.id,
        equipo_nombre: data.equipo?.nombre,
      })
    ),
  };
}

async function crearMovimientoFinanciero(user, body = {}) {
  if (!canWriteCompetition(user)) {
    throw new Error("No autorizado para registrar movimientos financieros");
  }

  const teamId = Number.parseInt(body.teamId ?? body.equipo_id, 10);
  if (!Number.isFinite(teamId) || teamId <= 0) {
    throw new Error("teamId invalido");
  }

  const equipo = await assertEquipoAccess(user, teamId);
  const championshipId = body.tournamentId
    ? await assertCampeonatoAccess(user, body.tournamentId)
    : await assertCampeonatoAccess(user, equipo.campeonato_id);

  const payload = {
    campeonato_id: championshipId,
    evento_id: body.eventId ?? body.evento_id ?? null,
    equipo_id: equipo.id,
    tipo_movimiento: String(body.type || body.tipo_movimiento || "abono").toLowerCase(),
    concepto: String(body.concept || body.concepto || "pago").toLowerCase(),
    descripcion: body.description || body.descripcion || null,
    monto: body.amount ?? body.monto,
    estado: body.status || body.estado || undefined,
    fecha_movimiento: body.paymentDate || body.fecha_movimiento || null,
    metodo_pago: body.paymentMethod || body.metodo_pago || "movil",
    referencia: body.reference || body.referencia || null,
    origen: "manual",
  };

  const movimiento = await Finanza.crearMovimiento(payload);
  return mapFinancialMovement({
    ...movimiento,
    equipo_id: equipo.id,
    equipo_nombre: equipo.nombre,
  });
}

module.exports = {
  crearMovimientoFinanciero,
  generarFixtureEvento,
  marcarMovimientoPagado,
  obtenerEstadoCuentaEquipo,
  obtenerCompetenciaEvento,
  obtenerFairPlayEvento,
  obtenerFinanzasCampeonato,
  registrarResultadoResumen,
};
