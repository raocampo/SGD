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

function mapFixturePhase(row) {
  const round = String(row?.playoff_ronda || "").trim().toLowerCase();
  const labels = {
    reclasificacion: "Reclasificacion",
    "32vos": "32vos",
    "16vos": "16vos",
    "12vos": "12vos",
    "8vos": "8vos",
    "4tos": "4tos",
    semifinal: "Semifinal",
    final: "Finales",
    tercer_puesto: "Finales",
  };

  if (round) {
    return {
      key: ["final", "tercer_puesto"].includes(round) ? "finales" : round,
      label: labels[round] || row.playoff_ronda,
    };
  }

  return { key: "fase_grupos", label: "Fase de grupos" };
}

function parseBooleanFlag(value) {
  return value === true || String(value || "").trim().toLowerCase() === "true";
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function resolveSchedulingMode(body = {}) {
  const hasAutomatic = hasOwn(body, "programacion_automatica") || hasOwn(body, "automaticScheduling");
  const hasManual = hasOwn(body, "programacion_manual") || hasOwn(body, "manualScheduling");
  const automatic = parseBooleanFlag(body.programacion_automatica ?? body.automaticScheduling);
  const manual = parseBooleanFlag(body.programacion_manual ?? body.manualScheduling);

  if (!hasAutomatic && !hasManual) {
    return {
      programacion_automatica: true,
      programacion_manual: false,
      permitir_sobrantes_sin_fecha: true,
    };
  }

  if (automatic && manual) {
    throw new Error("Selecciona solo una opcion de programacion: automatica o manual.");
  }

  if (!automatic && !manual) {
    throw new Error("Selecciona una opcion de programacion para generar el fixture.");
  }

  return {
    programacion_automatica: automatic,
    programacion_manual: manual,
    permitir_sobrantes_sin_fecha: automatic,
  };
}

function canWriteCompetition(user) {
  return ["administrador", "organizador"].includes(String(user?.rol || "").toLowerCase());
}

function mapMobileRoleScope(user, teamIds) {
  const role = String(user?.rol || "").toLowerCase();
  return {
    role,
    canWrite: canWriteCompetition(user),
    scope: teamIds === null ? "global" : "team",
    teamIds: Array.isArray(teamIds) ? teamIds.map((id) => toId(id)) : [],
  };
}

async function obtenerCompetenciaEvento(user, eventoId) {
  const evento = await assertEventoAccess(user, eventoId);
  await Partido.asegurarEsquemaPlanilla();
  const [partidos, tablas, equipoIdsVisibles] = await Promise.all([
    Partido.obtenerPorEvento(evento.id),
    tablaInternals.generarTablasEventoInterna(evento.id),
    obtenerEquipoIdsVisibles(user),
  ]);

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
    const phase = mapFixturePhase(partido);

    jornadasMap.get(jornada).matches.push({
      id: toId(partido.id),
      status: String(partido.estado || "").toLowerCase() === "finalizado" ? "JUGADO" : "PROGRAMADO",
      groupLabel: partido.letra_grupo || partido.nombre_grupo || null,
      phaseKey: phase.key,
      phaseLabel: phase.label,
      venue: partido.cancha || null,
      scheduledAt: formatScheduledAt(partido),
      homeTeam: {
        id: toId(partido.equipo_local_id),
        name: partido.equipo_local_nombre || "",
        logoUrl: partido.equipo_local_logo_url || null,
      },
      awayTeam: {
        id: toId(partido.equipo_visitante_id),
        name: partido.equipo_visitante_nombre || "",
        logoUrl: partido.equipo_visitante_logo_url || null,
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
    qualifiersPerGroup: grupo.grupo?.clasificados_por_grupo == null
      ? null
      : toInteger(grupo.grupo.clasificados_por_grupo, 0),
    scoringSystem: grupo.sistema_puntuacion || null,
    manualOverride: grupo.grupo?.edicion_manual_activa === true,
    rows: (grupo.tabla || []).map((row) => ({
      position: toInteger(row.posicion, 0),
      classificationPosition:
        row.posicion_clasificacion == null ? null : toInteger(row.posicion_clasificacion, 0),
      teamId: toId(row.equipo?.id),
      teamName: row.equipo?.nombre || "",
      teamLogoUrl: row.equipo?.logo_url || null,
      played: toInteger(row.estadisticas?.partidos_jugados, 0),
      won: toInteger(row.estadisticas?.partidos_ganados, 0),
      drawn: toInteger(row.estadisticas?.partidos_empatados, 0),
      lost: toInteger(row.estadisticas?.partidos_perdidos, 0),
      goalsFor: toInteger(row.estadisticas?.goles_favor, 0),
      goalsAgainst: toInteger(row.estadisticas?.goles_contra, 0),
      goalDiff: toInteger(row.estadisticas?.diferencia_goles, 0),
      points: toInteger(row.puntos, 0),
      qualifies: row.clasifica === true,
      outsideQualification: row.fuera_clasificacion === true,
      eliminated: row.eliminado_competencia === true,
      noShows: toInteger(row.no_presentaciones, 0),
      eliminationReason: row.motivo_eliminacion_label || row.motivo_eliminacion || null,
    })),
  }));

  return {
    event: mapEvent(evento, 0),
    roleScope: mapMobileRoleScope(user, equipoIdsVisibles),
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

  const schedulingMode = resolveSchedulingMode(body);
  const resultado = await Partido.generarFixtureEvento({
    evento_id: evento.id,
    ida_y_vuelta: parseBooleanFlag(body.homeAndAway ?? body.ida_y_vuelta),
    duracion_min: toInteger(body.durationMinutes ?? body.duracion_min, 90),
    descanso_min: toInteger(body.breakMinutes ?? body.descanso_min, 10),
    reemplazar: parseBooleanFlag(body.overwrite ?? body.reemplazar),
    programacion_manual: schedulingMode.programacion_manual,
    programacion_automatica: schedulingMode.programacion_automatica,
    permitir_sobrantes_sin_fecha: schedulingMode.permitir_sobrantes_sin_fecha,
    modo: body.mode || body.modo || "auto",
    fecha_inicio: body.startDate || body.fecha_inicio || null,
    fecha_fin: body.endDate || body.fecha_fin || null,
  });
  const partidos = Array.isArray(resultado) ? resultado : resultado?.partidos || [];

  return {
    ok: true,
    total: partidos.length,
    ...(Array.isArray(resultado) ? {} : resultado),
  };
}

async function regenerarFixturePreservandoEvento(user, eventoId, body = {}) {
  const evento = await assertEventoAccess(user, eventoId);
  if (!canWriteCompetition(user)) {
    throw new Error("No autorizado para regenerar fixture");
  }

  const schedulingMode = resolveSchedulingMode(body);
  const resultado = await Partido.regenerarFixturePreservandoJugados({
    evento_id: evento.id,
    ida_y_vuelta: parseBooleanFlag(body.homeAndAway ?? body.ida_y_vuelta),
    duracion_min: toInteger(body.durationMinutes ?? body.duracion_min, 90),
    descanso_min: toInteger(body.breakMinutes ?? body.descanso_min, 10),
    programacion_manual: schedulingMode.programacion_manual,
    programacion_automatica: schedulingMode.programacion_automatica,
    permitir_sobrantes_sin_fecha: schedulingMode.permitir_sobrantes_sin_fecha,
  });
  const partidos = Array.isArray(resultado) ? resultado : resultado?.partidos || [];

  return {
    ok: true,
    total: partidos.length,
    mensaje: partidos.length
      ? `Fixture regenerado: ${partidos.length} partido(s) nuevo(s) creado(s).`
      : "No hay partidos pendientes que regenerar.",
    ...(Array.isArray(resultado) ? {} : resultado),
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
  regenerarFixturePreservandoEvento,
  registrarResultadoResumen,
};
