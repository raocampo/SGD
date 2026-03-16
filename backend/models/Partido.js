// backend/models/Partido.js
const pool = require("../config/database");
const Finanza = require("./Finanza");

// ===============================
// Helpers (NO se redeclaran)
// ===============================
const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const fromMinutesSQL = (min) => {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}:00`;
};

const formatYMD = (d) => d.toISOString().split("T")[0];
const INASISTENCIAS_PLANILLA_VALIDAS = new Set(["ninguno", "local", "visitante", "ambos"]);
const GOLES_WALKOVER = 3;
const MAX_FALTAS_PLANILLA = 6;
let _schemaOverrideCompeticion = null;

function normalizarInasistenciaEquipoPlanilla(valor) {
  const raw = String(valor || "ninguno").trim().toLowerCase();
  return INASISTENCIAS_PLANILLA_VALIDAS.has(raw) ? raw : "ninguno";
}

function resultadosImpactanTabla(previo = {}, siguiente = {}) {
  const normalizar = (valor) => {
    if (valor === null || valor === undefined || valor === "") return null;
    const n = Number.parseInt(valor, 10);
    return Number.isFinite(n) ? n : null;
  };
  return (
    String(previo?.estado || "") !== String(siguiente?.estado || "") ||
    normalizar(previo?.resultado_local) !== normalizar(siguiente?.resultado_local) ||
    normalizar(previo?.resultado_visitante) !== normalizar(siguiente?.resultado_visitante) ||
    normalizar(previo?.resultado_local_shootouts) !== normalizar(siguiente?.resultado_local_shootouts) ||
    normalizar(previo?.resultado_visitante_shootouts) !== normalizar(siguiente?.resultado_visitante_shootouts) ||
    Boolean(previo?.shootouts) !== Boolean(siguiente?.shootouts)
  );
}

async function detectarSchemaOverrideCompeticion(client = pool) {
  if (_schemaOverrideCompeticion) return _schemaOverrideCompeticion;
  const r = await client.query(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'tabla_posiciones_manuales'
      ) AS tiene_tabla_manual,
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'tabla_posiciones_auditoria'
      ) AS tiene_tabla_auditoria,
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'evento_clasificados_manuales'
      ) AS tiene_clasificados_manuales,
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'evento_reclasificaciones_playoff'
      ) AS tiene_reclasificaciones,
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'partidos_eliminatoria'
      ) AS tiene_partidos_eliminatoria
  `);
  _schemaOverrideCompeticion = r.rows[0] || {};
  return _schemaOverrideCompeticion;
}

async function invalidarOverridesCompeticionPorResultado(
  partido = {},
  { usuarioId = null, motivo = "" } = {},
  client = pool
) {
  const eventoId = Number.parseInt(partido?.evento_id, 10);
  if (!Number.isFinite(eventoId) || eventoId <= 0) return false;

  const schema = await detectarSchemaOverrideCompeticion(client);
  const comentario =
    String(motivo || "").trim() ||
    `Invalidación automática por actualización de resultado en partido #${Number.parseInt(partido?.id, 10) || "?"}.`;

  if (schema.tiene_tabla_manual === true) {
    const manualesR = await client.query(
      `
        SELECT evento_id, grupo_id, payload
        FROM tabla_posiciones_manuales
        WHERE evento_id = $1
      `,
      [eventoId]
    );
    const manuales = manualesR.rows || [];

    if (manuales.length && schema.tiene_tabla_auditoria === true) {
      for (const row of manuales) {
        await client.query(
          `
            INSERT INTO tabla_posiciones_auditoria (
              evento_id,
              grupo_id,
              comentario,
              usuario_id,
              snapshot_anterior,
              snapshot_nuevo
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
          `,
          [
            eventoId,
            row.grupo_id ?? null,
            comentario,
            Number.isFinite(Number.parseInt(usuarioId, 10)) ? Number.parseInt(usuarioId, 10) : null,
            JSON.stringify(Array.isArray(row.payload) ? row.payload : []),
            JSON.stringify([]),
          ]
        );
      }
    }

    await client.query(`DELETE FROM tabla_posiciones_manuales WHERE evento_id = $1`, [eventoId]);
  }

  if (schema.tiene_clasificados_manuales === true) {
    await client.query(`DELETE FROM evento_clasificados_manuales WHERE evento_id = $1`, [eventoId]);
  }
  if (schema.tiene_reclasificaciones === true) {
    await client.query(`DELETE FROM evento_reclasificaciones_playoff WHERE evento_id = $1`, [eventoId]);
  }
  if (schema.tiene_partidos_eliminatoria === true) {
    await client.query(`DELETE FROM partidos_eliminatoria WHERE evento_id = $1`, [eventoId]);
  }

  return true;
}

function obtenerResultadoPorInasistenciaEquipo(tipo = "ninguno") {
  switch (normalizarInasistenciaEquipoPlanilla(tipo)) {
    case "local":
      return { resultadoLocal: 0, resultadoVisitante: GOLES_WALKOVER, estado: "finalizado" };
    case "visitante":
      return { resultadoLocal: GOLES_WALKOVER, resultadoVisitante: 0, estado: "finalizado" };
    case "ambos":
      return { resultadoLocal: null, resultadoVisitante: null, estado: "no_presentaron_ambos" };
    default:
      return { resultadoLocal: null, resultadoVisitante: null, estado: null };
  }
}

function normalizarConteoFaltasPlanilla(valor = 0) {
  const n = Number.parseInt(valor, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), MAX_FALTAS_PLANILLA);
}

function normalizarFaltasPlanillaPayload(faltas = {}) {
  const localPrimerTiempo = normalizarConteoFaltasPlanilla(
    faltas?.local_1er ?? faltas?.local_1 ?? faltas?.local_primer_tiempo ?? faltas?.faltas_local_1er
  );
  const localSegundoTiempo = normalizarConteoFaltasPlanilla(
    faltas?.local_2do ?? faltas?.local_2 ?? faltas?.local_segundo_tiempo ?? faltas?.faltas_local_2do
  );
  const visitantePrimerTiempo = normalizarConteoFaltasPlanilla(
    faltas?.visitante_1er ??
      faltas?.visitante_1 ??
      faltas?.visitante_primer_tiempo ??
      faltas?.faltas_visitante_1er
  );
  const visitanteSegundoTiempo = normalizarConteoFaltasPlanilla(
    faltas?.visitante_2do ??
      faltas?.visitante_2 ??
      faltas?.visitante_segundo_tiempo ??
      faltas?.faltas_visitante_2do
  );

  return {
    local_1er: localPrimerTiempo,
    local_2do: localSegundoTiempo,
    visitante_1er: visitantePrimerTiempo,
    visitante_2do: visitanteSegundoTiempo,
    local_total: localPrimerTiempo + localSegundoTiempo,
    visitante_total: visitantePrimerTiempo + visitanteSegundoTiempo,
  };
}

function normalizarConteoTarjetas(amarillas = 0, rojas = 0) {
  const ta = Number.isFinite(Number.parseInt(amarillas, 10))
    ? Math.max(Number.parseInt(amarillas, 10), 0)
    : 0;
  const tr = Number.isFinite(Number.parseInt(rojas, 10))
    ? Math.max(Number.parseInt(rojas, 10), 0)
    : 0;
  const rojasPorDobleAmarilla = Math.floor(ta / 2);
  return {
    amarillas: ta % 2,
    rojas: tr + rojasPorDobleAmarilla,
    rojasDirectas: tr,
    rojasPorDobleAmarilla,
  };
}

function normalizarTarjetasPlanilla(tarjetas = []) {
  const grupos = new Map();
  const directas = [];

  (Array.isArray(tarjetas) ? tarjetas : []).forEach((item) => {
    const tipo = String(item?.tipo_tarjeta || "").trim().toLowerCase();
    if (tipo !== "amarilla" && tipo !== "roja") return;

    const jugadorId = Number.parseInt(item?.jugador_id, 10);
    const equipoId = Number.parseInt(item?.equipo_id, 10);
    if (!Number.isFinite(jugadorId) || jugadorId <= 0 || !Number.isFinite(equipoId) || equipoId <= 0) {
      directas.push({
        ...item,
        tipo_tarjeta: tipo,
      });
      return;
    }

    const key = `${equipoId}:${jugadorId}`;
    const bucket = grupos.get(key) || {
      equipo_id: equipoId,
      jugador_id: jugadorId,
      amarillas: 0,
      rojasDirectas: 0,
      rojasDobleAmarilla: 0,
      minuto: item?.minuto ?? null,
      observacionAmarilla: item?.observacion ?? null,
      observacionRojaDirecta: item?.observacion ?? null,
      observacionRojaDoble: "Expulsión por doble amarilla",
    };
    if (tipo === "amarilla") bucket.amarillas += 1;
    if (tipo === "amarilla" && item?.observacion) {
      bucket.observacionAmarilla = item.observacion;
    }
    if (tipo === "roja") {
      if (tarjetaEsRojaPorDobleAmarilla(item)) {
        bucket.rojasDobleAmarilla += 1;
        bucket.observacionRojaDoble = item.observacion || bucket.observacionRojaDoble;
      } else {
        bucket.rojasDirectas += 1;
        if (item?.observacion) bucket.observacionRojaDirecta = item.observacion;
      }
    }
    grupos.set(key, bucket);
  });

  const normalizadas = [...directas];
  grupos.forEach((bucket) => {
    const conteo = normalizarConteoTarjetas(bucket.amarillas, bucket.rojasDirectas);
    const rojasDobleAmarilla = bucket.rojasDobleAmarilla + conteo.rojasPorDobleAmarilla;
    for (let i = 0; i < conteo.amarillas; i += 1) {
      normalizadas.push({
        equipo_id: bucket.equipo_id,
        jugador_id: bucket.jugador_id,
        tipo_tarjeta: "amarilla",
        minuto: bucket.minuto,
        observacion: bucket.observacionAmarilla,
      });
    }
    for (let i = 0; i < conteo.rojasDirectas; i += 1) {
      normalizadas.push({
        equipo_id: bucket.equipo_id,
        jugador_id: bucket.jugador_id,
        tipo_tarjeta: "roja",
        minuto: bucket.minuto,
        observacion: bucket.observacionRojaDirecta,
      });
    }
    for (let i = 0; i < rojasDobleAmarilla; i += 1) {
      normalizadas.push({
        equipo_id: bucket.equipo_id,
        jugador_id: bucket.jugador_id,
        tipo_tarjeta: "roja",
        minuto: bucket.minuto,
        observacion: bucket.observacionRojaDoble || "Expulsión por doble amarilla",
      });
    }
  });

  return normalizadas;
}

function resolverTarjetasDisciplinariasPartido({
  amarillas = 0,
  rojasDirectas = 0,
  rojasDirectasMarcadas = 0,
  rojasSinMarca = 0,
  rojasDobleAmarilla = 0,
} = {}) {
  const ta = Number.isFinite(Number.parseInt(amarillas, 10))
    ? Math.max(Number.parseInt(amarillas, 10), 0)
    : 0;
  const trDirectasCompat = Number.isFinite(Number.parseInt(rojasDirectas, 10))
    ? Math.max(Number.parseInt(rojasDirectas, 10), 0)
    : 0;
  const trDirectasMarcadas = Number.isFinite(Number.parseInt(rojasDirectasMarcadas, 10))
    ? Math.max(Number.parseInt(rojasDirectasMarcadas, 10), 0)
    : 0;
  const trSinMarca = Number.isFinite(Number.parseInt(rojasSinMarca, 10))
    ? Math.max(Number.parseInt(rojasSinMarca, 10), 0)
    : 0;
  const trDobles = Number.isFinite(Number.parseInt(rojasDobleAmarilla, 10))
    ? Math.max(Number.parseInt(rojasDobleAmarilla, 10), 0)
    : 0;

  let suspensionesPorRojaDirecta = trDirectasMarcadas;
  let suspensionesPorDobleAmarilla = trDobles;
  let amarillasDisponibles = Math.max(ta - trDobles * 2, 0);
  let rojasAmbiguas = trSinMarca;

  // Compatibilidad de firma antigua: si no se envia desglose, tratar rojasDirectas como ambiguas.
  if (
    rojasAmbiguas <= 0 &&
    suspensionesPorRojaDirecta <= 0 &&
    trDirectasCompat > 0
  ) {
    rojasAmbiguas = trDirectasCompat;
  }

  if (rojasAmbiguas > 0) {
    const doblesDisponiblesPorAmarillas = Math.floor(amarillasDisponibles / 2);
    const reasignadasPorAmarillas = Math.min(doblesDisponiblesPorAmarillas, rojasAmbiguas);
    if (reasignadasPorAmarillas > 0) {
      suspensionesPorDobleAmarilla += reasignadasPorAmarillas;
      rojasAmbiguas -= reasignadasPorAmarillas;
      amarillasDisponibles = Math.max(amarillasDisponibles - reasignadasPorAmarillas * 2, 0);
    }
    if (rojasAmbiguas > 0) {
      // Históricos sin observacion: por defecto no aplicar castigo de roja directa (2 partidos).
      suspensionesPorDobleAmarilla += rojasAmbiguas;
      rojasAmbiguas = 0;
    }
  }

  if (amarillasDisponibles >= 2) {
    const doblesInferidas = Math.floor(amarillasDisponibles / 2);
    if (doblesInferidas > 0) {
      if (suspensionesPorRojaDirecta > 0) {
        // Compatibilidad con historicos: roja autogenerada por doble amarilla sin observacion.
        const reasignadas = Math.min(doblesInferidas, suspensionesPorRojaDirecta);
        suspensionesPorRojaDirecta -= reasignadas;
        suspensionesPorDobleAmarilla += reasignadas;
        amarillasDisponibles = Math.max(amarillasDisponibles - reasignadas * 2, 0);
      } else {
        suspensionesPorDobleAmarilla += doblesInferidas;
        amarillasDisponibles = Math.max(amarillasDisponibles - doblesInferidas * 2, 0);
      }
    }
  }

  return {
    amarillasAcumulables: amarillasDisponibles,
    suspensionesPorDobleAmarilla,
    suspensionesPorRojaDirecta,
  };
}

function obtenerUmbralAmarillasSuspension(tipoFutbol = "") {
  const tipo = String(tipoFutbol || "").trim().toLowerCase();
  if (tipo.includes("11")) return 4;
  return 0;
}

function tarjetaEsRojaPorDobleAmarilla(item = {}) {
  const tipo = String(item?.tipo_tarjeta || "").trim().toLowerCase();
  if (tipo !== "roja") return false;
  const observacion = String(item?.observacion || "").trim().toLowerCase();
  return observacion.includes("doble amarilla");
}

function tarjetaEsRojaDirectaMarcada(item = {}) {
  const tipo = String(item?.tipo_tarjeta || "").trim().toLowerCase();
  if (tipo !== "roja") return false;
  const observacion = String(item?.observacion || "").trim().toLowerCase();
  return observacion.includes("roja directa");
}

function partidoCuentaParaSuspension(estado = "") {
  const value = String(estado || "").trim().toLowerCase();
  return value === "finalizado" || value === "no_presentaron_ambos";
}

function normalizarIdsJugadores(jugadores = []) {
  return (Array.isArray(jugadores) ? jugadores : [])
    .map((jugador) => Number.parseInt(jugador?.id, 10))
    .filter((id) => Number.isFinite(id) && id > 0);
}

async function calcularEstadoDisciplinarioEquipo({
  eventoIdRaw,
  equipoIdRaw,
  jugadores = [],
  partidoIdRaw = null,
  tipoFutbol = "",
} = {}) {
  const equipoId = Number.parseInt(equipoIdRaw, 10);
  const eventoId = Number.parseInt(eventoIdRaw, 10);
  const partidoId = Number.parseInt(partidoIdRaw, 10);
  const idsJugadores = normalizarIdsJugadores(jugadores);

  const resultado = new Map();
  idsJugadores.forEach((id) => {
    resultado.set(id, {
      suspendido: false,
      partidos_pendientes: 0,
      amarillas_acumuladas: 0,
      motivo: null,
    });
  });

  if (!Number.isFinite(equipoId) || equipoId <= 0) return resultado;
  if (!Number.isFinite(eventoId) || eventoId <= 0) return resultado;
  if (!idsJugadores.length) return resultado;

  const partidosEquipoQ = `
    SELECT p.id,
           p.jornada,
           p.fecha_partido,
           p.hora_partido,
           p.estado,
           COALESCE(c.tipo_futbol, '') AS tipo_futbol
    FROM partidos p
    LEFT JOIN campeonatos c ON c.id = p.campeonato_id
    WHERE p.evento_id = $1
      AND (p.equipo_local_id = $2 OR p.equipo_visitante_id = $2)
    ORDER BY p.jornada NULLS LAST, p.fecha_partido NULLS LAST, p.hora_partido NULLS LAST, p.id
  `;
  const partidosEquipoR = await pool.query(partidosEquipoQ, [eventoId, equipoId]);
  const partidosEquipo = partidosEquipoR.rows || [];
  if (!partidosEquipo.length) return resultado;

  let limitePartidos = partidosEquipo.length;
  if (Number.isFinite(partidoId) && partidoId > 0) {
    const indexPartidoActual = partidosEquipo.findIndex((item) => Number(item.id) === partidoId);
    if (indexPartidoActual < 0) return resultado;
    limitePartidos = indexPartidoActual;
  }

  const tipoFutbolNormalizado =
    String(tipoFutbol || "").trim() || String(partidosEquipo[0]?.tipo_futbol || "").trim();
  const umbralAmarillas = obtenerUmbralAmarillasSuspension(tipoFutbolNormalizado);
  const idsPartidos = partidosEquipo.map((item) => Number(item.id)).filter((id) => Number.isFinite(id));
  if (!idsPartidos.length) return resultado;

  const tarjetasQ = `
    SELECT partido_id, jugador_id, equipo_id, tipo_tarjeta, observacion
    FROM tarjetas
    WHERE partido_id = ANY($1::int[])
      AND equipo_id = $2
      AND jugador_id = ANY($3::int[])
  `;
  const tarjetasR = await pool.query(tarjetasQ, [idsPartidos, equipoId, idsJugadores]);
  const tarjetasPorJugadorPartido = new Map();
  for (const item of tarjetasR.rows) {
    const jugadorId = Number.parseInt(item.jugador_id, 10);
    const matchId = Number.parseInt(item.partido_id, 10);
    if (!Number.isFinite(jugadorId) || !Number.isFinite(matchId)) continue;
    const key = `${jugadorId}:${matchId}`;
    const bucket = tarjetasPorJugadorPartido.get(key) || [];
    bucket.push(item);
    tarjetasPorJugadorPartido.set(key, bucket);
  }

  for (const jugadorId of idsJugadores) {
    let partidosPendientes = 0;
    let amarillasAcumuladas = 0;
    let motivo = null;

    for (let i = 0; i < limitePartidos; i += 1) {
      const match = partidosEquipo[i];
      if (!partidoCuentaParaSuspension(match?.estado)) continue;

      if (partidosPendientes > 0) {
        partidosPendientes -= 1;
        if (partidosPendientes <= 0) motivo = null;
        continue;
      }

      const tarjetasJugador = tarjetasPorJugadorPartido.get(`${jugadorId}:${Number(match.id)}`) || [];
      if (!tarjetasJugador.length) continue;

      let amarillas = 0;
      let rojasDirectasMarcadas = 0;
      let rojasSinMarca = 0;
      let rojasDobleAmarilla = 0;

      tarjetasJugador.forEach((item) => {
        const tipo = String(item?.tipo_tarjeta || "").trim().toLowerCase();
        if (tipo === "amarilla") amarillas += 1;
        if (tipo === "roja") {
          if (tarjetaEsRojaPorDobleAmarilla(item)) rojasDobleAmarilla += 1;
          else if (tarjetaEsRojaDirectaMarcada(item)) rojasDirectasMarcadas += 1;
          else rojasSinMarca += 1;
        }
      });

      const resumenTarjetas = resolverTarjetasDisciplinariasPartido({
        amarillas,
        rojasDirectasMarcadas,
        rojasSinMarca,
        rojasDobleAmarilla,
      });

      if (umbralAmarillas > 0 && resumenTarjetas.amarillasAcumulables > 0) {
        amarillasAcumuladas += resumenTarjetas.amarillasAcumulables;
        while (amarillasAcumuladas >= umbralAmarillas) {
          amarillasAcumuladas -= umbralAmarillas;
          partidosPendientes += 1;
          motivo = `Suspensión por acumulación de ${umbralAmarillas} amarillas`;
        }
      }

      if (resumenTarjetas.suspensionesPorDobleAmarilla > 0) {
        partidosPendientes += resumenTarjetas.suspensionesPorDobleAmarilla;
        motivo = "Suspensión por doble amarilla";
      }

      if (resumenTarjetas.suspensionesPorRojaDirecta > 0) {
        partidosPendientes += resumenTarjetas.suspensionesPorRojaDirecta * 2;
        motivo = "Suspensión por roja directa";
      }
    }

    resultado.set(jugadorId, {
      suspendido: partidosPendientes > 0,
      partidos_pendientes: Math.max(partidosPendientes, 0),
      amarillas_acumuladas: amarillasAcumuladas,
      motivo: partidosPendientes > 0 ? motivo : null,
    });
  }

  return resultado;
}

// ===============================
// Round Robin
// ===============================
function generarRoundRobin(equipos) {
  const n = equipos.length;
  const fixture = [];

  const equiposConBye = n % 2 === 0 ? [...equipos] : [...equipos, null];
  const numEquipos = equiposConBye.length;

  for (let jornada = 0; jornada < numEquipos - 1; jornada++) {
    const partidosJornada = [];

    for (let i = 0; i < numEquipos / 2; i++) {
      const local = equiposConBye[i];
      const visitante = equiposConBye[numEquipos - 1 - i];

      if (local && visitante) {
        if (jornada % 2 === 0) partidosJornada.push([local, visitante]);
        else partidosJornada.push([visitante, local]);
      }
    }

    fixture.push(partidosJornada);

    const ultimo = equiposConBye.pop();
    equiposConBye.splice(1, 0, ultimo);
  }

  return fixture;
}

// ===============================
// Scheduler por modalidad + canchas
// ===============================
function buildWindowsFromEvento(evento) {
  // Defaults pedidos:
  // weekday: 19:00-22:00
  // sab: 13:00-18:00
  // dom: 08:00-17:00
  const weekdayStart = evento.horario_weekday_ini || "19:00:00";
  const weekdayEnd = evento.horario_weekday_fin || "22:00:00";
  const sabStart = evento.horario_sab_ini || "13:00:00";
  const sabEnd = evento.horario_sab_fin || "18:00:00";
  const domStart = evento.horario_dom_ini || "08:00:00";
  const domEnd = evento.horario_dom_fin || "17:00:00";

  const win = {
    weekday: { startMin: toMinutes(weekdayStart), endMin: toMinutes(weekdayEnd) },
    sab: { startMin: toMinutes(sabStart), endMin: toMinutes(sabEnd) },
    dom: { startMin: toMinutes(domStart), endMin: toMinutes(domEnd) },
  };

  return win;
}

function isWeekend(day) {
  return day === 0 || day === 6; // dom=0, sab=6
}

function isWeekday(day) {
  return day >= 1 && day <= 5;
}

function dayWindowByDate(evento, dateObj, windows) {
  const day = dateObj.getDay();
  const modalidad = (evento.modalidad || "weekend").toLowerCase();

  if (modalidad === "weekend") {
    if (day === 6) return windows.sab;
    if (day === 0) return windows.dom;
    return null;
  }

  if (modalidad === "weekday") {
    if (isWeekday(day)) return windows.weekday;
    return null;
  }

  // mixed
  if (day === 6) return windows.sab;
  if (day === 0) return windows.dom;
  if (isWeekday(day)) return windows.weekday;
  return null;
}

/**
 * Devuelve el siguiente "bloque horario" válido:
 * - En cada bloque (misma hora) caben N partidos en paralelo = N canchas.
 * - slot: { dateObj, timeMin }
 */
function nextBlockSlot(evento, windows, cursorDate, cursorTimeMin, slotMin) {
  let d = new Date(cursorDate);
  let t = cursorTimeMin ?? 0;

  const fin = evento.fecha_fin ? new Date(evento.fecha_fin) : null;

  while (true) {
    if (fin && d > fin) {
      throw new Error(`No hay fechas suficientes. Se excede la fecha_fin (${formatYMD(fin)}).`);
    }

    const w = dayWindowByDate(evento, d, windows);
    if (!w) {
      d.setDate(d.getDate() + 1);
      t = 0;
      continue;
    }

    // arrancar dentro del rango
    const cur = Math.max(t, w.startMin);

    // si ya no cabe ni un partido (por duración), pasar al siguiente día
    // (NOTA: aquí solo evaluamos la existencia del bloque, no la cantidad de canchas)
    if (cur + slotMin > w.endMin + 1) {
      d.setDate(d.getDate() + 1);
      t = 0;
      continue;
    }

    return { dateObj: d, timeMin: cur };
  }
}

class Partido {
  static _columnaTimestampActualizacion = undefined;
  static _esquemaPlanillaAsegurado = false;
  static _esquemaAuditoriaPlanillaAsegurado = false;
  static _esquemaSecuenciaAsegurado = false;
  static _esquemaEventoEquiposOrdenAsegurado = false;
  static _esquemaEventoEquiposEstadoAsegurado = false;
  static _columnasBloqueoMorosidad = null;

  static async asegurarEsquemaSecuencia() {
    if (this._esquemaSecuenciaAsegurado) return;

    await pool.query(`
      ALTER TABLE partidos
      ADD COLUMN IF NOT EXISTS numero_campeonato INTEGER
    `);
    await pool.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY campeonato_id
            ORDER BY id
          )::int AS rn
        FROM partidos
        WHERE campeonato_id IS NOT NULL
      )
      UPDATE partidos p
      SET numero_campeonato = ranked.rn
      FROM ranked
      WHERE p.id = ranked.id
        AND p.numero_campeonato IS NULL
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_partidos_numero_campeonato
      ON partidos(campeonato_id, numero_campeonato)
      WHERE numero_campeonato IS NOT NULL
    `);

    this._esquemaSecuenciaAsegurado = true;
  }

  static async asegurarEsquemaEventoEquiposOrden() {
    if (this._esquemaEventoEquiposOrdenAsegurado) return;
    await pool.query(`
      ALTER TABLE evento_equipos
      ADD COLUMN IF NOT EXISTS orden_sorteo INTEGER
    `);
    this._esquemaEventoEquiposOrdenAsegurado = true;
  }

  static async asegurarEsquemaEstadoEventoEquipos(client = pool) {
    if (this._esquemaEventoEquiposEstadoAsegurado) return;
    await client.query(`
      ALTER TABLE evento_equipos
      ADD COLUMN IF NOT EXISTS no_presentaciones INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS eliminado_automatico BOOLEAN NOT NULL DEFAULT FALSE
    `);
    this._esquemaEventoEquiposEstadoAsegurado = true;
  }

  static async obtenerEventoPorId(evento_id) {
    const q = `SELECT * FROM eventos WHERE id = $1`;
    const r = await pool.query(q, [evento_id]);
    return r.rows[0] || null;
  }

  static async contarGruposPorEvento(evento_id) {
    const q = `SELECT COUNT(*)::int AS total FROM grupos WHERE evento_id = $1`;
    const r = await pool.query(q, [evento_id]);
    return r.rows[0]?.total || 0;
  }

  // Compatibilidad de esquema:
  // algunas BD tienen "updated_at" y otras "update_at".
  static async obtenerColumnaTimestampActualizacion() {
    if (this._columnaTimestampActualizacion !== undefined) {
      return this._columnaTimestampActualizacion;
    }

    const q = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'partidos'
        AND column_name IN ('updated_at', 'update_at')
    `;
    const r = await pool.query(q);
    const cols = new Set(r.rows.map((x) => x.column_name));

    if (cols.has("updated_at")) this._columnaTimestampActualizacion = "updated_at";
    else if (cols.has("update_at")) this._columnaTimestampActualizacion = "update_at";
    else this._columnaTimestampActualizacion = null;

    return this._columnaTimestampActualizacion;
  }

  // Compatibilidad con controladores/rutas anteriores
  static async generarFixtureEvento({
    evento_id,
    ida_y_vuelta = false,
    duracion_min = 90,
    descanso_min = 10,
    reemplazar = true,
    programacion_manual = false,
    fecha_inicio = null,
    fecha_fin = null,
    modo = "auto",
  }) {
    const evento = await this.obtenerEventoPorId(evento_id);
    if (!evento) throw new Error("Evento no encontrado");

    const eventoNormalizado = {
      ...evento,
      fecha_inicio: fecha_inicio || evento.fecha_inicio,
      fecha_fin: fecha_fin || evento.fecha_fin,
      horario_weekday_ini: evento.horario_weekday_ini || evento.horario_weekday_inicio,
      horario_weekday_fin: evento.horario_weekday_fin || evento.horario_weekday_fin,
      horario_sab_ini: evento.horario_sab_ini || evento.horario_sab_inicio,
      horario_sab_fin: evento.horario_sab_fin || evento.horario_sab_fin,
      horario_dom_ini: evento.horario_dom_ini || evento.horario_dom_inicio,
      horario_dom_fin: evento.horario_dom_fin || evento.horario_dom_fin,
    };

    const totalGrupos = await this.contarGruposPorEvento(evento_id);
    const modoEfectivo = String(modo || "auto").toLowerCase();

    if (modoEfectivo === "todos") {
      return this.generarFixtureEventoTodosContraTodos({
        evento: eventoNormalizado,
        ida_y_vuelta,
        reemplazar,
        duracion_min,
        descanso_min,
        manual: programacion_manual,
      });
    }

    if (modoEfectivo === "grupos") {
      return this.generarFixtureEventoUnificado({
        evento: eventoNormalizado,
        ida_y_vuelta,
        reemplazar,
        duracion_min,
        descanso_min,
        manual: programacion_manual,
      });
    }

    if (totalGrupos > 0) {
      return this.generarFixtureEventoUnificado({
        evento: eventoNormalizado,
        ida_y_vuelta,
        reemplazar,
        duracion_min,
        descanso_min,
        manual: programacion_manual,
      });
    }

    return this.generarFixtureEventoTodosContraTodos({
      evento: eventoNormalizado,
      ida_y_vuelta,
      reemplazar,
      duracion_min,
      descanso_min,
      manual: programacion_manual,
    });
  }

  // CREATE - ahora soporta NULL en fecha/hora/cancha
  static async crear(
    campeonato_id,
    grupo_id,
    equipo_local_id,
    equipo_visitante_id,
    fecha_partido,
    hora_partido,
    cancha,
    jornada,
    evento_id
  ) {
    await this.asegurarEsquemaSecuencia();

    if (equipo_local_id === equipo_visitante_id) {
      throw new Error("Un equipo no puede jugar contra sí mismo");
    }

    // Si hay grupo_id, validamos que estén en el grupo
    if (grupo_id) {
      const validacionQuery = `
        SELECT COUNT(*) as count 
        FROM grupo_equipos 
        WHERE grupo_id = $1 AND equipo_id IN ($2, $3)
      `;
      const validacionResult = await pool.query(validacionQuery, [grupo_id, equipo_local_id, equipo_visitante_id]);
      if (parseInt(validacionResult.rows[0].count) !== 2) {
        throw new Error("Los equipos deben pertenecer al mismo grupo");
      }
    }

    const query = `
      WITH next_num AS (
        SELECT COALESCE(MAX(numero_campeonato), 0) + 1 AS next_num
        FROM partidos
        WHERE campeonato_id = $1
      )
      INSERT INTO partidos 
      (campeonato_id, evento_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, jornada, numero_campeonato) 
      SELECT
        $1,$2,$3,$4,$5,$6,$7,$8,$9,next_num.next_num
      FROM next_num
      RETURNING *
    `;
    const values = [
      campeonato_id ?? null,
      evento_id ?? null,
      grupo_id ?? null,
      equipo_local_id,
      equipo_visitante_id,
      fecha_partido ?? null,
      hora_partido ?? null,
      cancha ?? null,
      jornada ?? null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // ===============================
  // FIXTURE: EVENTO unificado por jornada (todos los grupos)
  // ===============================
  static async generarFixtureEventoUnificado({ evento, ida_y_vuelta, reemplazar, duracion_min, descanso_min, manual }) {
    const evento_id = evento.id;
    const campeonato_id = evento.campeonato_id;

    // Reemplazar si piden
    if (reemplazar) {
      await pool.query(`DELETE FROM partidos WHERE evento_id = $1`, [evento_id]);
    }

    // Traer grupos del evento:
    // Si sigues con grupo.evento_id, funciona.
    // Si vas full pivote, cambia aquí por join con evento_grupos (si lo creas luego).
    const gruposRes = await pool.query(
      `SELECT id, letra_grupo, nombre_grupo
       FROM grupos
       WHERE evento_id = $1
       ORDER BY letra_grupo`,
      [evento_id]
    );
    const grupos = gruposRes.rows;
    if (!grupos.length) throw new Error("Este evento no tiene grupos.");

    // Canchas del evento (por pivote evento_canchas)
    const canchasRes = await pool.query(
      `SELECT c.id, c.nombre
       FROM evento_canchas ec
       JOIN canchas c ON c.id = ec.cancha_id
       WHERE ec.evento_id = $1
       ORDER BY c.id`,
      [evento_id]
    );
    let canchas = canchasRes.rows.map((r) => r.nombre);

    // Si no hay canchas asignadas, por defecto 1 cancha
    if (!canchas.length) canchas = ["Cancha 1"];

    const dur = Math.max(1, parseInt(duracion_min || 90));
    const desc = Math.max(0, parseInt(descanso_min || 10));
    const slotMin = dur + desc;

    // Para cada grupo: obtener equipos (puede ser evento_equipos o equipos.evento_id)
    const jornadasPorGrupo = [];

    for (const g of grupos) {
      // Equipos del grupo (grupo_equipos)
      const eqRes = await pool.query(
        `SELECT equipo_id FROM grupo_equipos WHERE grupo_id=$1 ORDER BY equipo_id`,
        [g.id]
      );
      const equipos = eqRes.rows.map((r) => r.equipo_id);
      if (equipos.length < 2) throw new Error(`Grupo ${g.letra_grupo} necesita al menos 2 equipos.`);

      const ida = generarRoundRobin(equipos);
      const total = ida_y_vuelta
        ? [
            ...ida.map((j) => j.map(([a, b]) => [a, b])),
            ...ida.map((j) => j.map(([a, b]) => [b, a])),
          ]
        : ida;

      jornadasPorGrupo.push({
        grupo: g,
        jornadas: total.map((partidos, idx) => ({
          numero: idx + 1,
          partidos,
        })),
      });
    }

    const maxJornadas = Math.max(...jornadasPorGrupo.map((x) => x.jornadas.length));

    // Si manual => crear sin fecha/hora/cancha
    if (manual) {
      const creados = [];
      for (let j = 1; j <= maxJornadas; j++) {
        for (const item of jornadasPorGrupo) {
          const jData = item.jornadas.find((x) => x.numero === j);
          if (!jData) continue;
          for (const [local, visitante] of jData.partidos) {
            const p = await this.crear(
              campeonato_id,
              item.grupo.id,
              local,
              visitante,
              null,
              null,
              null,
              j,
              evento_id
            );
            creados.push(p);
          }
        }
      }
      return creados;
    }

    // Scheduler real
    const windows = buildWindowsFromEvento(evento);

    // arrancar desde fecha_inicio del evento (o hoy si está null)
    let cursorDate = evento.fecha_inicio ? new Date(evento.fecha_inicio) : new Date();
    let cursorTimeMin = 0;

    const creados = [];

    for (let j = 1; j <= maxJornadas; j++) {
      // Jornada unificada (todos los grupos)
      const partidosJornada = [];
      for (const item of jornadasPorGrupo) {
        const jData = item.jornadas.find((x) => x.numero === j);
        if (!jData) continue;
        for (const [local, visitante] of jData.partidos) {
          partidosJornada.push({
            grupo_id: item.grupo.id,
            grupo_letra: item.grupo.letra_grupo || "",
            local,
            visitante,
            jornada: j,
          });
        }
      }

      // Ordenar por grupo para que en la tarjeta salga A,B,C,D
      partidosJornada.sort((a, b) => String(a.grupo_letra).localeCompare(String(b.grupo_letra)));

      // Asignación por bloques: en cada bloque caben N partidos en paralelo
      let idx = 0;
      while (idx < partidosJornada.length) {
        const slot = nextBlockSlot(evento, windows, cursorDate, cursorTimeMin, slotMin);

        // En este bloque, asignar hasta N canchas
        for (let c = 0; c < canchas.length && idx < partidosJornada.length; c++) {
          const p = partidosJornada[idx++];
          const creado = await this.crear(
            campeonato_id,
            p.grupo_id,
            p.local,
            p.visitante,
            formatYMD(slot.dateObj),
            fromMinutesSQL(slot.timeMin),
            canchas[c], // cancha por paralelo
            p.jornada,
            evento_id
          );
          creados.push(creado);
        }

        // Próximo bloque = +slotMin
        cursorDate = new Date(slot.dateObj);
        cursorTimeMin = slot.timeMin + slotMin;
      }

      // Al finalizar la jornada, pasar al siguiente día (el scheduler cae al siguiente día válido según modalidad)
      cursorDate.setDate(cursorDate.getDate() + 1);
      cursorTimeMin = 0;
    }

    return creados;
  }

  // ===============================
  // FIXTURE: EVENTO todos contra todos (sin grupos)
  // ===============================
  static async generarFixtureEventoTodosContraTodos({ evento, ida_y_vuelta, reemplazar, duracion_min, descanso_min, manual }) {
    await this.asegurarEsquemaEventoEquiposOrden();
    const evento_id = evento.id;
    const campeonato_id = evento.campeonato_id;

    if (reemplazar) {
      await pool.query(`DELETE FROM partidos WHERE evento_id = $1`, [evento_id]);
    }

    // Equipos del evento:
    // 1) pivote evento_equipos
    const eqRes = await pool.query(
      `SELECT ee.equipo_id
       FROM evento_equipos ee
       WHERE ee.evento_id = $1
       ORDER BY COALESCE(ee.orden_sorteo, 2147483647), ee.equipo_id`,
      [evento_id]
    );
    const equipos = eqRes.rows.map((r) => r.equipo_id);
    if (equipos.length < 2) throw new Error("El evento debe tener al menos 2 equipos.");

    const ida = generarRoundRobin(equipos);
    const jornadas = ida_y_vuelta
      ? [
          ...ida.map((j) => j.map(([a, b]) => [a, b])),
          ...ida.map((j) => j.map(([a, b]) => [b, a])),
        ]
      : ida;

    // canchas
    const canchasRes = await pool.query(
      `SELECT c.id, c.nombre
       FROM evento_canchas ec
       JOIN canchas c ON c.id = ec.cancha_id
       WHERE ec.evento_id = $1
       ORDER BY c.id`,
      [evento_id]
    );
    let canchas = canchasRes.rows.map((r) => r.nombre);
    if (!canchas.length) canchas = ["Cancha 1"];

    const dur = Math.max(1, parseInt(duracion_min || 90));
    const desc = Math.max(0, parseInt(descanso_min || 10));
    const slotMin = dur + desc;

    if (manual) {
      const creados = [];
      let jornada = 1;
      for (const jf of jornadas) {
        for (const [local, visitante] of jf) {
          const p = await this.crear(campeonato_id, null, local, visitante, null, null, null, jornada, evento_id);
          creados.push(p);
        }
        jornada++;
      }
      return creados;
    }

    const windows = buildWindowsFromEvento(evento);
    let cursorDate = evento.fecha_inicio ? new Date(evento.fecha_inicio) : new Date();
    let cursorTimeMin = 0;

    const creados = [];
    let jornada = 1;

    for (const jf of jornadas) {
      let idx = 0;
      while (idx < jf.length) {
        const slot = nextBlockSlot(evento, windows, cursorDate, cursorTimeMin, slotMin);

        for (let c = 0; c < canchas.length && idx < jf.length; c++) {
          const [local, visitante] = jf[idx++];
          const creado = await this.crear(
            campeonato_id,
            null,
            local,
            visitante,
            formatYMD(slot.dateObj),
            fromMinutesSQL(slot.timeMin),
            canchas[c],
            jornada,
            evento_id
          );
          creados.push(creado);
        }

        cursorDate = new Date(slot.dateObj);
        cursorTimeMin = slot.timeMin + slotMin;
      }

      cursorDate.setDate(cursorDate.getDate() + 1);
      cursorTimeMin = 0;
      jornada++;
    }

    return creados;
  }

  // ===============================
  // READS
  // ===============================
  static async obtenerPorGrupo(grupo_id) {
    await this.asegurarEsquemaSecuencia();

    const q = `
      SELECT p.*,
             el.nombre AS equipo_local_nombre,
             ev.nombre AS equipo_visitante_nombre,
             el.logo_url AS equipo_local_logo_url,
             ev.logo_url AS equipo_visitante_logo_url,
             g.nombre_grupo,
             g.letra_grupo
      FROM partidos p
      JOIN equipos el ON p.equipo_local_id = el.id
      JOIN equipos ev ON p.equipo_visitante_id = ev.id
      LEFT JOIN grupos g ON p.grupo_id = g.id
      WHERE p.grupo_id = $1
      ORDER BY p.jornada, p.fecha_partido NULLS LAST, p.hora_partido NULLS LAST
    `;
    const r = await pool.query(q, [grupo_id]);
    return r.rows;
  }

  static async obtenerPorEvento(evento_id) {
    await this.asegurarEsquemaSecuencia();

    const q = `
      SELECT p.*,
             el.nombre AS equipo_local_nombre,
             ev.nombre AS equipo_visitante_nombre,
             el.logo_url AS equipo_local_logo_url,
             ev.logo_url AS equipo_visitante_logo_url,
             g.nombre_grupo,
             g.letra_grupo,
             (erp.id IS NOT NULL) AS es_reclasificacion_playoff,
             erp.id AS reclasificacion_playoff_id,
             erp.slot_posicion AS reclasificacion_slot_posicion,
             rg.letra_grupo AS reclasificacion_grupo_letra
      FROM partidos p
      JOIN equipos el ON p.equipo_local_id = el.id
      JOIN equipos ev ON p.equipo_visitante_id = ev.id
      LEFT JOIN grupos g ON p.grupo_id = g.id
      LEFT JOIN evento_reclasificaciones_playoff erp ON erp.partido_id = p.id
      LEFT JOIN grupos rg ON rg.id = erp.grupo_id
      WHERE p.evento_id = $1
      ORDER BY p.jornada, g.letra_grupo, p.fecha_partido NULLS LAST, p.hora_partido NULLS LAST, p.numero_campeonato NULLS LAST, p.id
    `;
    const r = await pool.query(q, [evento_id]);
    return r.rows;
  }

  static async obtenerPorEventoYJornada(evento_id, jornada) {
    await this.asegurarEsquemaSecuencia();

    const q = `
      SELECT p.*,
             el.nombre AS equipo_local_nombre,
             ev.nombre AS equipo_visitante_nombre,
             el.logo_url AS equipo_local_logo_url,
             ev.logo_url AS equipo_visitante_logo_url,
             g.nombre_grupo,
             g.letra_grupo,
             (erp.id IS NOT NULL) AS es_reclasificacion_playoff,
             erp.id AS reclasificacion_playoff_id,
             erp.slot_posicion AS reclasificacion_slot_posicion,
             rg.letra_grupo AS reclasificacion_grupo_letra
      FROM partidos p
      JOIN equipos el ON p.equipo_local_id = el.id
      JOIN equipos ev ON p.equipo_visitante_id = ev.id
      LEFT JOIN grupos g ON p.grupo_id = g.id
      LEFT JOIN evento_reclasificaciones_playoff erp ON erp.partido_id = p.id
      LEFT JOIN grupos rg ON rg.id = erp.grupo_id
      WHERE p.evento_id = $1 AND p.jornada = $2
      ORDER BY g.letra_grupo, p.fecha_partido NULLS LAST, p.hora_partido NULLS LAST, p.numero_campeonato NULLS LAST, p.id
    `;
    const r = await pool.query(q, [evento_id, jornada]);
    return r.rows;
  }

  static async obtenerPorCampeonato(campeonato_id) {
    await this.asegurarEsquemaSecuencia();

    const q = `
      SELECT p.*,
             el.nombre AS equipo_local_nombre,
             ev.nombre AS equipo_visitante_nombre,
             el.logo_url AS equipo_local_logo_url,
             ev.logo_url AS equipo_visitante_logo_url,
             g.nombre_grupo,
             g.letra_grupo,
             (erp.id IS NOT NULL) AS es_reclasificacion_playoff,
             erp.id AS reclasificacion_playoff_id,
             erp.slot_posicion AS reclasificacion_slot_posicion,
             rg.letra_grupo AS reclasificacion_grupo_letra
      FROM partidos p
      JOIN equipos el ON p.equipo_local_id = el.id
      JOIN equipos ev ON p.equipo_visitante_id = ev.id
      LEFT JOIN grupos g ON p.grupo_id = g.id
      LEFT JOIN evento_reclasificaciones_playoff erp ON erp.partido_id = p.id
      LEFT JOIN grupos rg ON rg.id = erp.grupo_id
      WHERE p.campeonato_id = $1
      ORDER BY p.jornada, g.letra_grupo, p.fecha_partido NULLS LAST, p.hora_partido NULLS LAST, p.numero_campeonato NULLS LAST, p.id
    `;
    const r = await pool.query(q, [campeonato_id]);
    return r.rows;
  }

  static async obtenerPorCampeonatoYJornada(campeonato_id, jornada) {
    await this.asegurarEsquemaSecuencia();

    const q = `
      SELECT p.*,
             el.nombre AS equipo_local_nombre,
             ev.nombre AS equipo_visitante_nombre,
             el.logo_url AS equipo_local_logo_url,
             ev.logo_url AS equipo_visitante_logo_url,
             g.nombre_grupo,
             g.letra_grupo,
             (erp.id IS NOT NULL) AS es_reclasificacion_playoff,
             erp.id AS reclasificacion_playoff_id,
             erp.slot_posicion AS reclasificacion_slot_posicion,
             rg.letra_grupo AS reclasificacion_grupo_letra
      FROM partidos p
      JOIN equipos el ON p.equipo_local_id = el.id
      JOIN equipos ev ON p.equipo_visitante_id = ev.id
      LEFT JOIN grupos g ON p.grupo_id = g.id
      LEFT JOIN evento_reclasificaciones_playoff erp ON erp.partido_id = p.id
      LEFT JOIN grupos rg ON rg.id = erp.grupo_id
      WHERE p.campeonato_id = $1 AND p.jornada = $2
      ORDER BY g.letra_grupo, p.fecha_partido NULLS LAST, p.hora_partido NULLS LAST, p.numero_campeonato NULLS LAST, p.id
    `;
    const r = await pool.query(q, [campeonato_id, jornada]);
    return r.rows;
  }

  static async obtenerPorId(id) {
    await this.asegurarEsquemaSecuencia();

    const q = `
      SELECT p.*,
             el.nombre as equipo_local_nombre,
             ev.nombre as equipo_visitante_nombre,
             (erp.id IS NOT NULL) AS es_reclasificacion_playoff,
             erp.id AS reclasificacion_playoff_id,
             erp.slot_posicion AS reclasificacion_slot_posicion,
             rg.letra_grupo AS reclasificacion_grupo_letra
      FROM partidos p
      JOIN equipos el ON p.equipo_local_id = el.id
      JOIN equipos ev ON p.equipo_visitante_id = ev.id
      LEFT JOIN evento_reclasificaciones_playoff erp ON erp.partido_id = p.id
      LEFT JOIN grupos rg ON rg.id = erp.grupo_id
      WHERE p.id = $1
    `;
    const r = await pool.query(q, [id]);
    return r.rows[0];
  }

  // ===============================
  // UPDATE / DELETE
  // ===============================
  static async actualizarResultado(id, resultado_local, resultado_visitante, estado = "finalizado") {
    const previo = await this.obtenerPorId(id);
    const columnaTs = await this.obtenerColumnaTimestampActualizacion();
    const setTs = columnaTs ? `,\n          ${columnaTs} = CURRENT_TIMESTAMP` : "";

    const q = `
      UPDATE partidos 
      SET resultado_local = $1,
          resultado_visitante = $2,
          estado = $3
          ${setTs}
      WHERE id = $4
      RETURNING *
    `;
    const r = await pool.query(q, [resultado_local, resultado_visitante, estado, id]);
    const actualizado = r.rows[0] || null;
    if (actualizado && resultadosImpactanTabla(previo, actualizado)) {
      await invalidarOverridesCompeticionPorResultado(actualizado, {
        motivo: `Invalidación automática por actualización de resultado en partido #${id}.`,
      });
    }
    return actualizado;
  }

  static async actualizarResultadoConShootouts(
    id,
    resultado_local,
    resultado_visitante,
    shootouts_local,
    shootouts_visitante,
    estado = "finalizado"
  ) {
    const previo = await this.obtenerPorId(id);
    const columnaTs = await this.obtenerColumnaTimestampActualizacion();
    const setTs = columnaTs ? `,\n          ${columnaTs} = CURRENT_TIMESTAMP` : "";

    const q = `
      UPDATE partidos
      SET resultado_local = $1,
          resultado_visitante = $2,
          resultado_local_shootouts = $3,
          resultado_visitante_shootouts = $4,
          shootouts = true,
          estado = $5
          ${setTs}
      WHERE id = $6
      RETURNING *
    `;
    const r = await pool.query(q, [
      resultado_local,
      resultado_visitante,
      shootouts_local,
      shootouts_visitante,
      estado,
      id,
    ]);
    const actualizado = r.rows[0] || null;
    if (actualizado && resultadosImpactanTabla(previo, actualizado)) {
      await invalidarOverridesCompeticionPorResultado(actualizado, {
        motivo: `Invalidación automática por actualización de resultado con shootouts en partido #${id}.`,
      });
    }
    return actualizado;
  }

  static async actualizar(id, datos) {
    const campos = [];
    const valores = [];
    let i = 1;

    for (const [k, v] of Object.entries(datos)) {
      if (v !== undefined) {
        campos.push(`${k} = $${i}`);
        valores.push(v);
        i++;
      }
    }

    if (!campos.length) throw new Error("No hay campos para actualizar");

    valores.push(id);
    const columnaTs = await this.obtenerColumnaTimestampActualizacion();
    const setTs = columnaTs ? `,\n          ${columnaTs} = CURRENT_TIMESTAMP` : "";

    const q = `
      UPDATE partidos
      SET ${campos.join(", ")}
          ${setTs}
      WHERE id = $${i}
      RETURNING *
    `;
    const r = await pool.query(q, valores);
    return r.rows[0];
  }

  static async eliminar(id) {
    const r = await pool.query("DELETE FROM partidos WHERE id = $1 RETURNING *", [id]);
    return r.rows[0];
  }

  // Calcular puntos por partido (tradicional 3-1-0 o shootouts)
  static calcularPuntos(sistema_puntuacion, resultado_local, resultado_visitante, resultado_local_shootouts, resultado_visitante_shootouts, shootouts) {
    const rL = parseInt(resultado_local, 10) || 0;
    const rV = parseInt(resultado_visitante, 10) || 0;
    if (sistema_puntuacion === "shootouts" && shootouts) {
      const sL = parseInt(resultado_local_shootouts, 10) || 0;
      const sV = parseInt(resultado_visitante_shootouts, 10) || 0;
      return { puntosLocal: sL > sV ? 2 : sL < sV ? 1 : 0, puntosVisitante: sV > sL ? 2 : sV < sL ? 1 : 0 };
    }
    if (rL > rV) return { puntosLocal: 3, puntosVisitante: 0 };
    if (rL < rV) return { puntosLocal: 0, puntosVisitante: 3 };
    return { puntosLocal: 1, puntosVisitante: 1 };
  }

  // Estadísticas avanzadas por grupo (para tabla de posiciones)
  static async obtenerEstadisticasEquipoAvanzado(equipo_id, grupo_id) {
    const q = `
      SELECT 
        COUNT(*) as partidos_jugados,
        COALESCE(SUM(CASE WHEN equipo_local_id = $1 AND (COALESCE(resultado_local,0) > COALESCE(resultado_visitante,0) OR (COALESCE(shootouts,false) AND COALESCE(resultado_local_shootouts,0) > COALESCE(resultado_visitante_shootouts,0))) THEN 1
                 WHEN equipo_visitante_id = $1 AND (COALESCE(resultado_visitante,0) > COALESCE(resultado_local,0) OR (COALESCE(shootouts,false) AND COALESCE(resultado_visitante_shootouts,0) > COALESCE(resultado_local_shootouts,0))) THEN 1 ELSE 0 END), 0)::int as victorias_tiempo,
        COALESCE(SUM(CASE WHEN COALESCE(shootouts,false) AND ((equipo_local_id = $1 AND COALESCE(resultado_local_shootouts,0) > COALESCE(resultado_visitante_shootouts,0)) OR (equipo_visitante_id = $1 AND COALESCE(resultado_visitante_shootouts,0) > COALESCE(resultado_local_shootouts,0))) THEN 1 ELSE 0 END), 0)::int as victorias_shootouts,
        COALESCE(SUM(CASE WHEN COALESCE(resultado_local,0) = COALESCE(resultado_visitante,0) AND estado = 'finalizado' AND (NOT COALESCE(shootouts,false)) THEN 1 ELSE 0 END), 0)::int as empates,
        COALESCE(SUM(CASE WHEN equipo_local_id = $1 AND (COALESCE(resultado_local,0) < COALESCE(resultado_visitante,0) OR (COALESCE(shootouts,false) AND COALESCE(resultado_local_shootouts,0) < COALESCE(resultado_visitante_shootouts,0))) THEN 1
                 WHEN equipo_visitante_id = $1 AND (COALESCE(resultado_visitante,0) < COALESCE(resultado_local,0) OR (COALESCE(shootouts,false) AND COALESCE(resultado_visitante_shootouts,0) < COALESCE(resultado_local_shootouts,0))) THEN 1 ELSE 0 END), 0)::int as derrotas_tiempo,
        COALESCE(SUM(CASE WHEN COALESCE(shootouts,false) AND ((equipo_local_id = $1 AND COALESCE(resultado_local_shootouts,0) < COALESCE(resultado_visitante_shootouts,0)) OR (equipo_visitante_id = $1 AND COALESCE(resultado_visitante_shootouts,0) < COALESCE(resultado_local_shootouts,0))) THEN 1 ELSE 0 END), 0)::int as derrotas_shootouts,
        COALESCE(SUM(CASE WHEN equipo_local_id = $1 THEN COALESCE(resultado_local,0) ELSE COALESCE(resultado_visitante,0) END), 0)::int as goles_favor,
        COALESCE(SUM(CASE WHEN equipo_local_id = $1 THEN COALESCE(resultado_visitante,0) ELSE COALESCE(resultado_local,0) END), 0)::int as goles_contra
      FROM partidos
      WHERE grupo_id = $2 AND (equipo_local_id = $1 OR equipo_visitante_id = $1) AND estado = 'finalizado'
    `;
    try {
      const r = await pool.query(q, [equipo_id, grupo_id]);
      return r.rows[0] || {};
    } catch (e) {
      return {};
    }
  }

  // ===============================
  // STATS por evento (simple)
  // ===============================
  static async obtenerEstadisticasEquipoPorEvento(equipo_id, evento_id) {
    const q = `
      SELECT 
        COUNT(CASE WHEN estado = 'finalizado' THEN 1 END) as partidos_jugados,
        COUNT(CASE WHEN estado = 'finalizado' THEN 1 END) as partidos_completados,
        SUM(CASE WHEN estado = 'finalizado' AND equipo_local_id = $1 THEN COALESCE(resultado_local,0) WHEN estado = 'finalizado' THEN COALESCE(resultado_visitante,0) ELSE 0 END) as goles_favor,
        SUM(CASE WHEN estado = 'finalizado' AND equipo_local_id = $1 THEN COALESCE(resultado_visitante,0) WHEN estado = 'finalizado' THEN COALESCE(resultado_local,0) ELSE 0 END) as goles_contra
      FROM partidos
      WHERE evento_id = $2 AND (equipo_local_id = $1 OR equipo_visitante_id = $1)
    `;
    const r = await pool.query(q, [equipo_id, evento_id]);
    return r.rows[0];
  }

  static async obtenerEstadisticasEquipo(equipo_id, campeonato_id) {
    const q = `
      SELECT
        COUNT(CASE WHEN estado = 'finalizado' THEN 1 END) as partidos_jugados,
        COUNT(CASE WHEN estado = 'finalizado' THEN 1 END) as partidos_completados,
        COALESCE(SUM(CASE WHEN estado = 'finalizado' AND equipo_local_id = $1 THEN COALESCE(resultado_local,0) WHEN estado = 'finalizado' THEN COALESCE(resultado_visitante,0) ELSE 0 END),0)::int as goles_favor,
        COALESCE(SUM(CASE WHEN estado = 'finalizado' AND equipo_local_id = $1 THEN COALESCE(resultado_visitante,0) WHEN estado = 'finalizado' THEN COALESCE(resultado_local,0) ELSE 0 END),0)::int as goles_contra
      FROM partidos
      WHERE campeonato_id = $2
        AND (equipo_local_id = $1 OR equipo_visitante_id = $1)
    `;
    const r = await pool.query(q, [equipo_id, campeonato_id]);
    return r.rows[0];
  }

  static async asegurarEsquemaPlanilla() {
    if (this._esquemaPlanillaAsegurado) return;

    await this.asegurarEsquemaEstadoEventoEquipos();

    await pool.query(`
      ALTER TABLE campeonatos
      ADD COLUMN IF NOT EXISTS requiere_cedula_jugador BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS requiere_foto_cedula BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS requiere_foto_carnet BOOLEAN DEFAULT FALSE
    `);

    await pool.query(`
      ALTER TABLE jugadores
      ADD COLUMN IF NOT EXISTS foto_cedula_url TEXT,
      ADD COLUMN IF NOT EXISTS foto_carnet_url TEXT
    `);

    await pool.query(`
      ALTER TABLE partidos
      ADD COLUMN IF NOT EXISTS arbitro TEXT,
      ADD COLUMN IF NOT EXISTS delegado_partido TEXT,
      ADD COLUMN IF NOT EXISTS ciudad TEXT
    `);
    await pool.query(`
      ALTER TABLE partidos
      ADD COLUMN IF NOT EXISTS faltas_local_total INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS faltas_visitante_total INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS faltas_local_1er INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS faltas_local_2do INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS faltas_visitante_1er INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS faltas_visitante_2do INTEGER DEFAULT 0
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS partido_planillas (
        id SERIAL PRIMARY KEY,
        partido_id INTEGER UNIQUE REFERENCES partidos(id) ON DELETE CASCADE,
        ambos_no_presentes BOOLEAN NOT NULL DEFAULT FALSE,
        inasistencia_equipo VARCHAR(20) NOT NULL DEFAULT 'ninguno',
        pago_ta NUMERIC(10,2) DEFAULT 0,
        pago_tr NUMERIC(10,2) DEFAULT 0,
        pago_ta_local NUMERIC(10,2) DEFAULT 0,
        pago_ta_visitante NUMERIC(10,2) DEFAULT 0,
        pago_tr_local NUMERIC(10,2) DEFAULT 0,
        pago_tr_visitante NUMERIC(10,2) DEFAULT 0,
        pago_arbitraje_local NUMERIC(10,2) DEFAULT 0,
        pago_arbitraje_visitante NUMERIC(10,2) DEFAULT 0,
        pago_arbitraje NUMERIC(10,2) DEFAULT 0,
        pago_local NUMERIC(10,2) DEFAULT 0,
        pago_visitante NUMERIC(10,2) DEFAULT 0,
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      ALTER TABLE partido_planillas
      ADD COLUMN IF NOT EXISTS ambos_no_presentes BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS inasistencia_equipo VARCHAR(20) NOT NULL DEFAULT 'ninguno',
      ADD COLUMN IF NOT EXISTS pago_ta NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pago_tr NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pago_ta_local NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pago_ta_visitante NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pago_tr_local NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pago_tr_visitante NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pago_arbitraje_local NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pago_arbitraje_visitante NUMERIC(10,2) DEFAULT 0
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS goleadores (
        id SERIAL PRIMARY KEY,
        partido_id INTEGER REFERENCES partidos(id) ON DELETE CASCADE,
        jugador_id INTEGER REFERENCES jugadores(id) ON DELETE SET NULL,
        goles INTEGER DEFAULT 1,
        tipo_gol VARCHAR(20) DEFAULT 'campo',
        minuto INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tarjetas (
        id SERIAL PRIMARY KEY,
        partido_id INTEGER REFERENCES partidos(id) ON DELETE CASCADE,
        jugador_id INTEGER REFERENCES jugadores(id) ON DELETE SET NULL,
        equipo_id INTEGER REFERENCES equipos(id) ON DELETE SET NULL,
        tipo_tarjeta VARCHAR(20) NOT NULL,
        minuto INTEGER,
        observacion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_goleadores_partido ON goleadores(partido_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tarjetas_partido ON tarjetas(partido_id)`);

    this._esquemaPlanillaAsegurado = true;
  }

  static async asegurarEsquemaAuditoriaPlanilla(client = pool) {
    if (this._esquemaAuditoriaPlanillaAsegurado) return;

    await client.query(`
      CREATE TABLE IF NOT EXISTS partido_planilla_ediciones (
        id SERIAL PRIMARY KEY,
        partido_id INTEGER NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        motivo TEXT NOT NULL,
        estado_anterior JSONB NOT NULL,
        estado_nuevo JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_partido_planilla_ediciones_partido
      ON partido_planilla_ediciones(partido_id, created_at DESC)
    `);

    this._esquemaAuditoriaPlanillaAsegurado = true;
  }

  static async construirSnapshotAuditoriaPlanilla(client, partidoId) {
    const partidoR = await client.query(
      `
        SELECT
          id,
          estado,
          resultado_local,
          resultado_visitante,
          arbitro,
          delegado_partido,
          ciudad,
          faltas_local_total,
          faltas_visitante_total,
          faltas_local_1er,
          faltas_local_2do,
          faltas_visitante_1er,
          faltas_visitante_2do
        FROM partidos
        WHERE id = $1
        LIMIT 1
      `,
      [partidoId]
    );
    const planillaR = await client.query(
      `
        SELECT
          ambos_no_presentes,
          inasistencia_equipo,
          pago_ta,
          pago_tr,
          pago_ta_local,
          pago_ta_visitante,
          pago_tr_local,
          pago_tr_visitante,
          pago_arbitraje_local,
          pago_arbitraje_visitante,
          pago_arbitraje,
          pago_local,
          pago_visitante,
          observaciones
        FROM partido_planillas
        WHERE partido_id = $1
        LIMIT 1
      `,
      [partidoId]
    );
    const goleadoresR = await client.query(
      `
        SELECT jugador_id, goles, tipo_gol, minuto
        FROM goleadores
        WHERE partido_id = $1
        ORDER BY id
      `,
      [partidoId]
    );
    const tarjetasR = await client.query(
      `
        SELECT jugador_id, equipo_id, tipo_tarjeta, minuto, observacion
        FROM tarjetas
        WHERE partido_id = $1
        ORDER BY id
      `,
      [partidoId]
    );

    return {
      partido: partidoR.rows[0] || null,
      planilla: planillaR.rows[0] || null,
      goleadores: goleadoresR.rows || [],
      tarjetas: tarjetasR.rows || [],
    };
  }

  static async registrarEdicionPlanillaAuditoria(
    client,
    { partidoId, usuarioId = null, motivo = "", estadoAnterior = null, estadoNuevo = null } = {}
  ) {
    const partidoIdNum = Number.parseInt(partidoId, 10);
    if (!Number.isFinite(partidoIdNum) || partidoIdNum <= 0) return;

    const motivoLimpio = String(motivo || "").trim();
    if (!motivoLimpio) return;

    const usuarioIdNum = Number.parseInt(usuarioId, 10);
    const usuarioIdSafe =
      Number.isFinite(usuarioIdNum) && usuarioIdNum > 0 ? usuarioIdNum : null;

    await client.query(
      `
        INSERT INTO partido_planilla_ediciones
          (partido_id, usuario_id, motivo, estado_anterior, estado_nuevo)
        VALUES
          ($1, $2, $3, $4::jsonb, $5::jsonb)
      `,
      [
        partidoIdNum,
        usuarioIdSafe,
        motivoLimpio,
        JSON.stringify(estadoAnterior || {}),
        JSON.stringify(estadoNuevo || {}),
      ]
    );
  }

  static async obtenerPlanilla(partido_id) {
    await this.asegurarEsquemaPlanilla();

    const partidoQ = `
      SELECT p.*,
             c.tipo_futbol,
             c.max_jugador,
             c.organizador AS campeonato_organizador,
             c.logo_url AS campeonato_logo_url,
             c.nombre AS campeonato_nombre,
             COALESCE(c.requiere_cedula_jugador, true) AS requiere_cedula_jugador,
             COALESCE(c.requiere_foto_cedula, false) AS requiere_foto_cedula,
             COALESCE(c.requiere_foto_carnet, false) AS requiere_foto_carnet,
             evt.nombre AS evento_nombre,
             g.letra_grupo,
             g.nombre_grupo,
             el.nombre AS equipo_local_nombre,
             ev.nombre AS equipo_visitante_nombre,
             el.director_tecnico AS equipo_local_director_tecnico,
             ev.director_tecnico AS equipo_visitante_director_tecnico,
             el.logo_url AS equipo_local_logo_url,
             ev.logo_url AS equipo_visitante_logo_url
      FROM partidos p
      LEFT JOIN campeonatos c ON c.id = p.campeonato_id
      LEFT JOIN eventos evt ON evt.id = p.evento_id
      LEFT JOIN grupos g ON g.id = p.grupo_id
      JOIN equipos el ON el.id = p.equipo_local_id
      JOIN equipos ev ON ev.id = p.equipo_visitante_id
      WHERE p.id = $1
      LIMIT 1
    `;
    const partidoR = await pool.query(partidoQ, [partido_id]);
    const partido = partidoR.rows[0] || null;
    if (!partido) return null;

    const planillaQ = `
      SELECT *
      FROM partido_planillas
      WHERE partido_id = $1
      LIMIT 1
    `;
    const planillaR = await pool.query(planillaQ, [partido_id]);
    const planilla = planillaR.rows[0] || null;

    const goleadoresQ = `
      SELECT g.*,
             TRIM(CONCAT(COALESCE(j.nombre, ''), ' ', COALESCE(j.apellido, ''))) AS jugador_nombre,
             j.equipo_id,
             e.nombre AS equipo_nombre
      FROM goleadores g
      LEFT JOIN jugadores j ON j.id = g.jugador_id
      LEFT JOIN equipos e ON e.id = j.equipo_id
      WHERE g.partido_id = $1
      ORDER BY g.id
    `;
    const goleadoresR = await pool.query(goleadoresQ, [partido_id]);

    const tarjetasQ = `
      SELECT t.*,
             TRIM(CONCAT(COALESCE(j.nombre, ''), ' ', COALESCE(j.apellido, ''))) AS jugador_nombre,
             e.nombre AS equipo_nombre
      FROM tarjetas t
      LEFT JOIN jugadores j ON j.id = t.jugador_id
      LEFT JOIN equipos e ON e.id = COALESCE(t.equipo_id, j.equipo_id)
      WHERE t.partido_id = $1
      ORDER BY t.id
    `;
    const tarjetasR = await pool.query(tarjetasQ, [partido_id]);

    const plantelLocalQ = `
      SELECT id, nombre, apellido, cedidentidad, numero_camiseta, posicion, equipo_id, foto_cedula_url, foto_carnet_url
      FROM jugadores
      WHERE equipo_id = $1
      ORDER BY numero_camiseta NULLS LAST, apellido, nombre
    `;
    const plantelVisitanteQ = `
      SELECT id, nombre, apellido, cedidentidad, numero_camiseta, posicion, equipo_id, foto_cedula_url, foto_carnet_url
      FROM jugadores
      WHERE equipo_id = $1
      ORDER BY numero_camiseta NULLS LAST, apellido, nombre
    `;
    const [localR, visitaR] = await Promise.all([
      pool.query(plantelLocalQ, [partido.equipo_local_id]),
      pool.query(plantelVisitanteQ, [partido.equipo_visitante_id]),
    ]);

    const [suspensionesLocal, suspensionesVisitante] = await Promise.all([
      this.calcularSuspensionesEquipoParaPartido(partido, localR.rows, partido.equipo_local_id),
      this.calcularSuspensionesEquipoParaPartido(partido, visitaR.rows, partido.equipo_visitante_id),
    ]);

    const plantelLocal = localR.rows.map((jugador) => ({
      ...jugador,
      suspension: suspensionesLocal.get(Number(jugador.id)) || null,
    }));
    const plantelVisitante = visitaR.rows.map((jugador) => ({
      ...jugador,
      suspension: suspensionesVisitante.get(Number(jugador.id)) || null,
    }));

    return {
      partido,
      documentos_requeridos: {
        cedula: partido.requiere_cedula_jugador === true,
        foto_cedula: partido.requiere_foto_cedula === true,
        foto_carnet: partido.requiere_foto_carnet === true,
      },
      planilla: {
        ambos_no_presentes: planilla?.ambos_no_presentes === true,
        inasistencia_equipo: normalizarInasistenciaEquipoPlanilla(
          planilla?.inasistencia_equipo || (planilla?.ambos_no_presentes === true ? "ambos" : "ninguno")
        ),
        pago_ta_local: Number(planilla?.pago_ta_local ?? planilla?.pago_ta ?? 0),
        pago_ta_visitante: Number(planilla?.pago_ta_visitante ?? planilla?.pago_ta ?? 0),
        pago_tr_local: Number(planilla?.pago_tr_local ?? planilla?.pago_tr ?? 0),
        pago_tr_visitante: Number(planilla?.pago_tr_visitante ?? planilla?.pago_tr ?? 0),
        pago_arbitraje_local: Number(planilla?.pago_arbitraje_local ?? planilla?.pago_arbitraje ?? 0),
        pago_arbitraje_visitante: Number(planilla?.pago_arbitraje_visitante ?? planilla?.pago_arbitraje ?? 0),
        pago_ta:
          Number(planilla?.pago_ta ?? 0) ||
          Number(planilla?.pago_ta_local ?? 0) + Number(planilla?.pago_ta_visitante ?? 0),
        pago_tr:
          Number(planilla?.pago_tr ?? 0) ||
          Number(planilla?.pago_tr_local ?? 0) + Number(planilla?.pago_tr_visitante ?? 0),
        pago_arbitraje:
          Number(planilla?.pago_arbitraje ?? 0) ||
          Number(planilla?.pago_arbitraje_local ?? 0) +
            Number(planilla?.pago_arbitraje_visitante ?? 0),
        pago_local: Number(planilla?.pago_local || 0),
        pago_visitante: Number(planilla?.pago_visitante || 0),
        observaciones: planilla?.observaciones || "",
      },
      faltas: {
        local_1er: Number(partido?.faltas_local_1er ?? 0),
        local_2do: Number(partido?.faltas_local_2do ?? 0),
        visitante_1er: Number(partido?.faltas_visitante_1er ?? 0),
        visitante_2do: Number(partido?.faltas_visitante_2do ?? 0),
        local_total: Number(partido?.faltas_local_total ?? 0),
        visitante_total: Number(partido?.faltas_visitante_total ?? 0),
      },
      goleadores: goleadoresR.rows,
      tarjetas: tarjetasR.rows,
      plantel_local: plantelLocal,
      plantel_visitante: plantelVisitante,
    };
  }

  static async calcularSuspensionesEquipoParaPartido(partido = {}, jugadores = [], equipoIdRaw = null) {
    return calcularEstadoDisciplinarioEquipo({
      eventoIdRaw: partido?.evento_id,
      equipoIdRaw: equipoIdRaw ?? partido?.equipo_local_id,
      jugadores,
      partidoIdRaw: partido?.id,
      tipoFutbol: partido?.tipo_futbol,
    });
  }

  static async obtenerEstadoDisciplinarioEquipoEnEvento(eventoId, equipoId, jugadores = [], tipoFutbol = "") {
    return calcularEstadoDisciplinarioEquipo({
      eventoIdRaw: eventoId,
      equipoIdRaw: equipoId,
      jugadores,
      tipoFutbol,
    });
  }

  static async detectarColumnasBloqueoMorosidad(client = pool) {
    if (this._columnasBloqueoMorosidad) return this._columnasBloqueoMorosidad;

    const r = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'campeonatos' AND column_name IN ('bloquear_morosos', 'bloqueo_morosidad_monto'))
          OR
          (table_name = 'eventos' AND column_name IN ('bloquear_morosos', 'bloqueo_morosidad_monto'))
        )
    `);

    const existe = new Set(r.rows.map((row) => `${row.table_name}.${row.column_name}`));
    this._columnasBloqueoMorosidad = {
      campBloquea: existe.has("campeonatos.bloquear_morosos"),
      campMonto: existe.has("campeonatos.bloqueo_morosidad_monto"),
      eventoBloquea: existe.has("eventos.bloquear_morosos"),
      eventoMonto: existe.has("eventos.bloqueo_morosidad_monto"),
    };
    return this._columnasBloqueoMorosidad;
  }

  static async obtenerPoliticaBloqueoMorosidad(client, campeonatoId, eventoId = null) {
    const cols = await this.detectarColumnasBloqueoMorosidad(client);
    if (!cols.campBloquea || !cols.campMonto) {
      return { activo: false, monto: 0, nivel: "ninguno" };
    }

    const campR = await client.query(
      `
        SELECT
          COALESCE(bloquear_morosos, FALSE) AS bloquear_morosos,
          COALESCE(bloqueo_morosidad_monto, 0)::numeric(12,2) AS bloqueo_morosidad_monto
        FROM campeonatos
        WHERE id = $1
        LIMIT 1
      `,
      [campeonatoId]
    );
    const camp = campR.rows[0] || {};
    const activoCamp = camp.bloquear_morosos === true;
    const montoCamp = Number.parseFloat(camp.bloqueo_morosidad_monto || 0);

    if (
      Number.isFinite(Number(eventoId)) &&
      Number(eventoId) > 0 &&
      cols.eventoBloquea &&
      cols.eventoMonto
    ) {
      const eventoR = await client.query(
        `
          SELECT bloquear_morosos, bloqueo_morosidad_monto
          FROM eventos
          WHERE id = $1
          LIMIT 1
        `,
        [eventoId]
      );
      const evento = eventoR.rows[0] || null;
      if (evento && evento.bloquear_morosos !== null && evento.bloquear_morosos !== undefined) {
        const activoEvento = evento.bloquear_morosos === true;
        const montoEvento = Number.parseFloat(evento.bloqueo_morosidad_monto);
        return {
          activo: activoEvento,
          monto:
            Number.isFinite(montoEvento) && montoEvento >= 0
              ? Number(montoEvento.toFixed(2))
              : Number(Math.max(montoCamp || 0, 0).toFixed(2)),
          nivel: "categoria",
        };
      }
    }

    return {
      activo: activoCamp,
      monto: Number.isFinite(montoCamp) && montoCamp >= 0 ? Number(montoCamp.toFixed(2)) : 0,
      nivel: "campeonato",
    };
  }

  static async obtenerSaldosMorosidadEquipos(client, campeonatoId, eventoId, equipoIds = []) {
    const ids = (Array.isArray(equipoIds) ? equipoIds : [])
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (!ids.length) return new Map();

    const hayEvento = Number.isFinite(Number(eventoId)) && Number(eventoId) > 0;
    const whereEvento = hayEvento ? "AND fm.evento_id = $3" : "";
    const values = hayEvento ? [campeonatoId, ids, Number(eventoId)] : [campeonatoId, ids];

    const q = `
      SELECT
        fm.equipo_id,
        COALESCE(SUM(CASE WHEN fm.tipo_movimiento = 'cargo' AND fm.estado <> 'anulado' THEN fm.monto ELSE 0 END), 0)::numeric(12,2) AS total_cargos,
        COALESCE(SUM(CASE WHEN fm.tipo_movimiento = 'abono' AND fm.estado <> 'anulado' THEN fm.monto ELSE 0 END), 0)::numeric(12,2) AS total_abonos
      FROM finanzas_movimientos fm
      WHERE fm.campeonato_id = $1
        AND fm.equipo_id = ANY($2::int[])
        ${whereEvento}
      GROUP BY fm.equipo_id
    `;

    const r = await client.query(q, values);
    const mapa = new Map();
    r.rows.forEach((row) => {
      const equipoId = Number.parseInt(row.equipo_id, 10);
      const cargos = Number.parseFloat(row.total_cargos || 0);
      const abonos = Number.parseFloat(row.total_abonos || 0);
      const saldo = Number(Math.max((cargos || 0) - (abonos || 0), 0).toFixed(2));
      mapa.set(equipoId, saldo);
    });
    ids.forEach((id) => {
      if (!mapa.has(id)) mapa.set(id, 0);
    });
    return mapa;
  }

  static async obtenerAvisoMorosidadPlanilla(client, partido) {
    try {
      const campeonatoId = Number.parseInt(partido?.campeonato_id, 10);
      if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) return null;

      const eventoId = Number.parseInt(partido?.evento_id, 10);
      const equipoLocalId = Number.parseInt(partido?.equipo_local_id, 10);
      const equipoVisitanteId = Number.parseInt(partido?.equipo_visitante_id, 10);
      const idsEquipos = [equipoLocalId, equipoVisitanteId].filter(
        (id) => Number.isFinite(id) && id > 0
      );
      if (!idsEquipos.length) return null;

      await Finanza.asegurarEsquema(client);
      await Finanza.sincronizarCargosInscripcion({ campeonato_id: campeonatoId }, client);

      const saldos = await this.obtenerSaldosMorosidadEquipos(
        client,
        campeonatoId,
        Number.isFinite(eventoId) && eventoId > 0 ? eventoId : null,
        idsEquipos
      );

      const nombresR = await client.query(
        `SELECT id, nombre FROM equipos WHERE id = ANY($1::int[])`,
        [idsEquipos]
      );
      const nombres = new Map(
        nombresR.rows.map((row) => [
          Number.parseInt(row.id, 10),
          String(row.nombre || `Equipo ${row.id}`),
        ])
      );

      const equiposConSaldo = idsEquipos
        .map((id) => ({
          equipo_id: id,
          nombre: nombres.get(id) || `Equipo ${id}`,
          saldo: Number(saldos.get(id) || 0),
        }))
        .filter((item) => item.saldo > 0);

      if (!equiposConSaldo.length) return null;

      const total = Number(
        equiposConSaldo.reduce((acc, item) => acc + Number(item.saldo || 0), 0).toFixed(2)
      );
      const detalle = equiposConSaldo
        .map((item) => `${item.nombre} ($${Number(item.saldo).toFixed(2)})`)
        .join(", ");

      return {
        total,
        equipos: equiposConSaldo,
        mensaje: `Aviso de deuda acumulada: ${detalle}.`,
      };
    } catch (error) {
      console.warn("No se pudo calcular aviso de morosidad para planilla:", error?.message || error);
      return null;
    }
  }

  static async guardarPlanilla(partido_id, datos = {}, opciones = {}) {
    await this.asegurarEsquemaPlanilla();

    const ambosNoPresentes =
      datos.ambos_no_presentes === true ||
      String(datos.ambos_no_presentes || "").trim().toLowerCase() === "true";
    const inasistenciaEquipo = ambosNoPresentes
      ? "ambos"
      : normalizarInasistenciaEquipoPlanilla(datos.inasistencia_equipo);
    const resultadoAutomatico = obtenerResultadoPorInasistenciaEquipo(inasistenciaEquipo);
    const hayInasistencia = inasistenciaEquipo !== "ninguno";
    const resultadoLocal = hayInasistencia
      ? resultadoAutomatico.resultadoLocal
      : Number.parseInt(datos.resultado_local, 10) || 0;
    const resultadoVisitante = hayInasistencia
      ? resultadoAutomatico.resultadoVisitante
      : Number.parseInt(datos.resultado_visitante, 10) || 0;
    const estado = hayInasistencia ? resultadoAutomatico.estado || "finalizado" : datos.estado || "finalizado";
    const arbitro = Object.prototype.hasOwnProperty.call(datos, "arbitro")
      ? (datos.arbitro ?? "").toString().trim()
      : null;
    const delegadoPartido = Object.prototype.hasOwnProperty.call(datos, "delegado_partido")
      ? (datos.delegado_partido ?? "").toString().trim()
      : null;
    const ciudad = Object.prototype.hasOwnProperty.call(datos, "ciudad")
      ? (datos.ciudad ?? "").toString().trim()
      : null;
    const pagos = datos.pagos || {};
    const observaciones = (datos.observaciones || "").toString().trim();
    const motivoEdicion = String(datos?.motivo_edicion || "").trim();
    const usuarioEdicionId =
      Number.isFinite(Number.parseInt(opciones?.usuario_id ?? datos?.usuario_edicion_id, 10)) &&
      Number.parseInt(opciones?.usuario_id ?? datos?.usuario_edicion_id, 10) > 0
        ? Number.parseInt(opciones?.usuario_id ?? datos?.usuario_edicion_id, 10)
        : null;
    let avisoMorosidad = null;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const partidoR = await client.query(
        `SELECT * FROM partidos WHERE id = $1 LIMIT 1`,
        [partido_id]
      );
      const partido = partidoR.rows[0];
      if (!partido) throw new Error("Partido no encontrado");

      const planillaActualR = await client.query(
        `SELECT * FROM partido_planillas WHERE partido_id = $1 LIMIT 1`,
        [partido_id]
      );
      const planillaActual = planillaActualR.rows[0] || null;
      const partidoEstabaFinalizado = partidoCuentaParaSuspension(partido?.estado);
      const requiereMotivoEdicion = partidoEstabaFinalizado && !!planillaActual;

      if (requiereMotivoEdicion && motivoEdicion.length < 8) {
        const error = new Error(
          "Esta planilla ya finalizada requiere motivo de edición (mínimo 8 caracteres)."
        );
        error.statusCode = 400;
        error.code = "PLANILLA_EDIT_REASON_REQUIRED";
        throw error;
      }

      let snapshotAuditoriaAntes = null;
      if (requiereMotivoEdicion) {
        await this.asegurarEsquemaAuditoriaPlanilla(client);
        snapshotAuditoriaAntes = await this.construirSnapshotAuditoriaPlanilla(client, partido_id);
      }

      const equipoLocalId = Number.parseInt(partido.equipo_local_id, 10);
      const equipoVisitanteId = Number.parseInt(partido.equipo_visitante_id, 10);
      const localBloqueado = inasistenciaEquipo === "local" || inasistenciaEquipo === "ambos";
      const visitanteBloqueado = inasistenciaEquipo === "visitante" || inasistenciaEquipo === "ambos";
      const equipoBloqueado = (equipoIdRaw) => {
        const equipoId = Number.parseInt(equipoIdRaw, 10);
        if (!Number.isFinite(equipoId)) return false;
        if (localBloqueado && equipoId === equipoLocalId) return true;
        if (visitanteBloqueado && equipoId === equipoVisitanteId) return true;
        return false;
      };

      const golesBase = Array.isArray(datos.goles) ? datos.goles : [];
      const tarjetasBase = normalizarTarjetasPlanilla(
        Array.isArray(datos.tarjetas) ? datos.tarjetas : []
      );
      const goles = golesBase.filter((item) => !equipoBloqueado(item?.equipo_id));
      const tarjetas = tarjetasBase.filter((item) => !equipoBloqueado(item?.equipo_id));

      const pagoTaLocal = localBloqueado
        ? 0
        : Number.parseFloat(pagos.pago_ta_local ?? pagos.pago_ta ?? 0) || 0;
      const pagoTaVisitante = visitanteBloqueado
        ? 0
        : Number.parseFloat(pagos.pago_ta_visitante ?? pagos.pago_ta ?? 0) || 0;
      const pagoTrLocal = localBloqueado
        ? 0
        : Number.parseFloat(pagos.pago_tr_local ?? pagos.pago_tr ?? 0) || 0;
      const pagoTrVisitante = visitanteBloqueado
        ? 0
        : Number.parseFloat(pagos.pago_tr_visitante ?? pagos.pago_tr ?? 0) || 0;
      const pagoArbitrajeLocal = localBloqueado
        ? 0
        : Number.parseFloat(pagos.pago_arbitraje_local ?? pagos.pago_arbitraje ?? 0) || 0;
      const pagoArbitrajeVisitante = visitanteBloqueado
        ? 0
        : Number.parseFloat(pagos.pago_arbitraje_visitante ?? pagos.pago_arbitraje ?? 0) || 0;
      const pagoLocal = localBloqueado ? 0 : Number.parseFloat(pagos.pago_local ?? 0) || 0;
      const pagoVisitante = visitanteBloqueado
        ? 0
        : Number.parseFloat(pagos.pago_visitante ?? 0) || 0;
      const pagoTa = pagoTaLocal + pagoTaVisitante;
      const pagoTr = pagoTrLocal + pagoTrVisitante;
      const pagoArbitraje = pagoArbitrajeLocal + pagoArbitrajeVisitante;

      const faltasNormalizadas = normalizarFaltasPlanillaPayload({
        ...(typeof datos.faltas === "object" && datos.faltas ? datos.faltas : {}),
        local_total: datos.faltas_local_total,
        visitante_total: datos.faltas_visitante_total,
      });
      if (localBloqueado) {
        faltasNormalizadas.local_1er = 0;
        faltasNormalizadas.local_2do = 0;
        faltasNormalizadas.local_total = 0;
      }
      if (visitanteBloqueado) {
        faltasNormalizadas.visitante_1er = 0;
        faltasNormalizadas.visitante_2do = 0;
        faltasNormalizadas.visitante_total = 0;
      }

      const columnaTs = await this.obtenerColumnaTimestampActualizacion();
      const setTs = columnaTs ? `, ${columnaTs} = CURRENT_TIMESTAMP` : "";

      await client.query(
        `
          UPDATE partidos
          SET resultado_local = $1,
              resultado_visitante = $2,
              estado = $3,
              arbitro = COALESCE($4, arbitro),
              delegado_partido = COALESCE($5, delegado_partido),
              ciudad = COALESCE($6, ciudad),
              faltas_local_total = $7,
              faltas_visitante_total = $8,
              faltas_local_1er = $9,
              faltas_local_2do = $10,
              faltas_visitante_1er = $11,
              faltas_visitante_2do = $12
              ${setTs}
          WHERE id = $13
        `,
        [
          resultadoLocal,
          resultadoVisitante,
          estado,
          arbitro,
          delegadoPartido,
          ciudad,
          faltasNormalizadas.local_total,
          faltasNormalizadas.visitante_total,
          faltasNormalizadas.local_1er,
          faltasNormalizadas.local_2do,
          faltasNormalizadas.visitante_1er,
          faltasNormalizadas.visitante_2do,
          partido_id,
        ]
      );

      await client.query(
        `
          INSERT INTO partido_planillas
            (
              partido_id,
              ambos_no_presentes,
              inasistencia_equipo,
              pago_ta, pago_tr,
              pago_ta_local, pago_ta_visitante,
              pago_tr_local, pago_tr_visitante,
              pago_arbitraje_local, pago_arbitraje_visitante,
              pago_arbitraje, pago_local, pago_visitante,
              observaciones, updated_at
            )
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
          ON CONFLICT (partido_id)
          DO UPDATE SET
            ambos_no_presentes = EXCLUDED.ambos_no_presentes,
            inasistencia_equipo = EXCLUDED.inasistencia_equipo,
            pago_ta = EXCLUDED.pago_ta,
            pago_tr = EXCLUDED.pago_tr,
            pago_ta_local = EXCLUDED.pago_ta_local,
            pago_ta_visitante = EXCLUDED.pago_ta_visitante,
            pago_tr_local = EXCLUDED.pago_tr_local,
            pago_tr_visitante = EXCLUDED.pago_tr_visitante,
            pago_arbitraje_local = EXCLUDED.pago_arbitraje_local,
            pago_arbitraje_visitante = EXCLUDED.pago_arbitraje_visitante,
            pago_arbitraje = EXCLUDED.pago_arbitraje,
            pago_local = EXCLUDED.pago_local,
            pago_visitante = EXCLUDED.pago_visitante,
            observaciones = EXCLUDED.observaciones,
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          partido_id,
          ambosNoPresentes,
          inasistenciaEquipo,
          pagoTa,
          pagoTr,
          pagoTaLocal,
          pagoTaVisitante,
          pagoTrLocal,
          pagoTrVisitante,
          pagoArbitrajeLocal,
          pagoArbitrajeVisitante,
          pagoArbitraje,
          pagoLocal,
          pagoVisitante,
          observaciones,
        ]
      );

      await client.query(`DELETE FROM goleadores WHERE partido_id = $1`, [partido_id]);
      for (const item of goles) {
        const jugadorId = Number.parseInt(item.jugador_id, 10);
        const golesJugador = Number.parseInt(item.goles, 10);
        if (!Number.isFinite(jugadorId) || !Number.isFinite(golesJugador) || golesJugador <= 0) continue;
        const tipoGol = (item.tipo_gol || "campo").toString().trim().toLowerCase();
        const minuto = Number.isFinite(Number.parseInt(item.minuto, 10))
          ? Number.parseInt(item.minuto, 10)
          : null;
        await client.query(
          `
            INSERT INTO goleadores
              (partido_id, jugador_id, goles, tipo_gol, minuto)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [partido_id, jugadorId, golesJugador, tipoGol, minuto]
        );
      }

      await client.query(`DELETE FROM tarjetas WHERE partido_id = $1`, [partido_id]);
      for (const item of tarjetas) {
        const tipo = (item.tipo_tarjeta || "").toString().trim().toLowerCase();
        if (!tipo) continue;
        const jugadorId = Number.isFinite(Number.parseInt(item.jugador_id, 10))
          ? Number.parseInt(item.jugador_id, 10)
          : null;
        const equipoId = Number.isFinite(Number.parseInt(item.equipo_id, 10))
          ? Number.parseInt(item.equipo_id, 10)
          : null;
        const minuto = Number.isFinite(Number.parseInt(item.minuto, 10))
          ? Number.parseInt(item.minuto, 10)
          : null;
        const observacion = (item.observacion || "").toString().trim() || null;
        await client.query(
          `
            INSERT INTO tarjetas
              (partido_id, jugador_id, equipo_id, tipo_tarjeta, minuto, observacion)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [partido_id, jugadorId, equipoId, tipo, minuto, observacion]
        );
      }

      await this.sincronizarFinanzasPlanilla(client, partido, {
        pagoLocal,
        pagoVisitante,
        pagoArbitrajeLocal,
        pagoArbitrajeVisitante,
        pagoTaLocal,
        pagoTaVisitante,
        pagoTrLocal,
        pagoTrVisitante,
      }, {
        ambosNoPresentes,
        inasistenciaEquipo,
      });
      await this.sincronizarEstadoNoPresentacionesEvento(client, partido);
      avisoMorosidad = await this.obtenerAvisoMorosidadPlanilla(client, partido);

      if (requiereMotivoEdicion) {
        const snapshotAuditoriaDespues = await this.construirSnapshotAuditoriaPlanilla(client, partido_id);
        await this.registrarEdicionPlanillaAuditoria(client, {
          partidoId: partido_id,
          usuarioId: usuarioEdicionId,
          motivo: motivoEdicion,
          estadoAnterior: snapshotAuditoriaAntes,
          estadoNuevo: snapshotAuditoriaDespues,
        });
      }

      const cambioDeportivo = resultadosImpactanTabla(partido, {
        ...partido,
        resultado_local: resultadoLocal,
        resultado_visitante: resultadoVisitante,
        estado,
      });
      if (cambioDeportivo) {
        await invalidarOverridesCompeticionPorResultado(
          { ...partido, resultado_local: resultadoLocal, resultado_visitante: resultadoVisitante, estado },
          {
            usuarioId: usuarioEdicionId,
            motivo: `Invalidación automática por actualización de planilla en partido #${partido_id}.`,
          },
          client
        );
      }

      await client.query("COMMIT");
      const planilla = await this.obtenerPlanilla(partido_id);
      if (avisoMorosidad) {
        planilla.aviso_morosidad = avisoMorosidad;
      }
      return planilla;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async sincronizarEstadoNoPresentacionesEvento(client, partido) {
    await this.asegurarEsquemaEstadoEventoEquipos(client);

    const eventoId = Number(partido?.evento_id);
    if (!Number.isFinite(eventoId) || eventoId <= 0) return;

    await client.query(
      `
        WITH conteos AS (
          SELECT
            ee.evento_id,
            ee.equipo_id,
            COALESCE(
              SUM(
                CASE
                  WHEN COALESCE(pp.inasistencia_equipo, 'ninguno') = 'ambos'
                    AND (p.equipo_local_id = ee.equipo_id OR p.equipo_visitante_id = ee.equipo_id)
                    THEN 1
                  WHEN COALESCE(pp.inasistencia_equipo, 'ninguno') = 'local'
                    AND p.equipo_local_id = ee.equipo_id
                    THEN 1
                  WHEN COALESCE(pp.inasistencia_equipo, 'ninguno') = 'visitante'
                    AND p.equipo_visitante_id = ee.equipo_id
                    THEN 1
                  ELSE 0
                END
              ),
              0
            )::int AS total_no_presentaciones
          FROM evento_equipos ee
          LEFT JOIN partidos p
            ON p.evento_id = ee.evento_id
           AND (p.equipo_local_id = ee.equipo_id OR p.equipo_visitante_id = ee.equipo_id)
          LEFT JOIN partido_planillas pp ON pp.partido_id = p.id
          WHERE ee.evento_id = $1
          GROUP BY ee.evento_id, ee.equipo_id
        )
        UPDATE evento_equipos ee
        SET
          no_presentaciones = conteos.total_no_presentaciones,
          eliminado_automatico = conteos.total_no_presentaciones >= 3
        FROM conteos
        WHERE ee.evento_id = conteos.evento_id
          AND ee.equipo_id = conteos.equipo_id
      `,
      [eventoId]
    );
  }

  static async sincronizarFinanzasPlanilla(client, partido, montos = {}, opciones = {}) {
    await Finanza.asegurarEsquema(client);

    const partidoId = Number(partido?.id);
    if (!Number.isFinite(partidoId) || partidoId <= 0) return;

    const campeonatoId = Number(partido?.campeonato_id);
    if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) return;
    const eventoIdRaw = Number(partido?.evento_id);
    const eventoId = Number.isFinite(eventoIdRaw) && eventoIdRaw > 0 ? eventoIdRaw : null;
    const equipoLocalId = Number(partido?.equipo_local_id);
    const equipoVisitanteId = Number(partido?.equipo_visitante_id);

    const keyPrefix = `planilla:${partidoId}:`;
    await client.query(
      `
        DELETE FROM finanzas_movimientos
        WHERE partido_id = $1
          AND origen = 'planilla'
          AND origen_clave LIKE $2
      `,
      [partidoId, `${keyPrefix}%`]
    );

    const valorPositivo = (v) => {
      const n = Number.parseFloat(v);
      if (!Number.isFinite(n) || n <= 0) return 0;
      return Number(n.toFixed(2));
    };

    const costosR = await client.query(
      `
        SELECT
          COALESCE(costo_arbitraje, 0)::numeric(12,2) AS costo_arbitraje,
          COALESCE(costo_tarjeta_amarilla, 0)::numeric(12,2) AS costo_tarjeta_amarilla,
          COALESCE(costo_tarjeta_roja, 0)::numeric(12,2) AS costo_tarjeta_roja
        FROM campeonatos
        WHERE id = $1
        LIMIT 1
      `,
      [campeonatoId]
    );
    const costos = costosR.rows[0] || {};
    const costoArbitraje = valorPositivo(costos.costo_arbitraje);
    const costoTarjetaAmarilla = valorPositivo(costos.costo_tarjeta_amarilla);
    const costoTarjetaRoja = valorPositivo(costos.costo_tarjeta_roja);
    const ambosNoPresentes = opciones?.ambosNoPresentes === true;
    const inasistenciaEquipo = ambosNoPresentes
      ? "ambos"
      : normalizarInasistenciaEquipoPlanilla(opciones?.inasistenciaEquipo);
    const hayInasistencia = inasistenciaEquipo !== "ninguno";

    const tarjetasR = await client.query(
      `
        SELECT
          equipo_id,
          COALESCE(SUM(CASE WHEN LOWER(tipo_tarjeta) = 'amarilla' THEN 1 ELSE 0 END), 0)::int AS amarillas,
          COALESCE(SUM(CASE WHEN LOWER(tipo_tarjeta) = 'roja' THEN 1 ELSE 0 END), 0)::int AS rojas
        FROM tarjetas
        WHERE partido_id = $1
        GROUP BY equipo_id
      `,
      [partidoId]
    );
    const tarjetasPorEquipo = new Map(
      tarjetasR.rows.map((row) => [
        Number.parseInt(row.equipo_id, 10),
        {
          amarillas: Number.parseInt(row.amarillas, 10) || 0,
          rojas: Number.parseInt(row.rojas, 10) || 0,
        },
      ])
    );

    const tarjetasLocal = tarjetasPorEquipo.get(equipoLocalId) || {
      amarillas: 0,
      rojas: 0,
    };
    const tarjetasVisitante = tarjetasPorEquipo.get(equipoVisitanteId) || {
      amarillas: 0,
      rojas: 0,
    };

    const cargoArbitrajeLocal = hayInasistencia ? 0 : valorPositivo(costoArbitraje);
    const cargoArbitrajeVisitante = hayInasistencia ? 0 : valorPositivo(costoArbitraje);
    const cargoTaLocal = valorPositivo(tarjetasLocal.amarillas * costoTarjetaAmarilla);
    const cargoTaVisitante = valorPositivo(
      tarjetasVisitante.amarillas * costoTarjetaAmarilla
    );
    const cargoTrLocal = valorPositivo(tarjetasLocal.rojas * costoTarjetaRoja);
    const cargoTrVisitante = valorPositivo(tarjetasVisitante.rojas * costoTarjetaRoja);

    const multaInasistenciaLocal =
      inasistenciaEquipo === "ambos" || inasistenciaEquipo === "local"
        ? valorPositivo(costoArbitraje)
        : 0;
    const multaInasistenciaVisitante =
      inasistenciaEquipo === "ambos" || inasistenciaEquipo === "visitante"
        ? valorPositivo(costoArbitraje)
        : 0;

    const descripcionInasistenciaLocal =
      inasistenciaEquipo === "ambos"
        ? "Multa por no presentación de ambos equipos"
        : "Multa por no presentación del equipo local";
    const descripcionInasistenciaVisitante =
      inasistenciaEquipo === "ambos"
        ? "Multa por no presentación de ambos equipos"
        : "Multa por no presentación del equipo visitante";

    const movimientos = [
      {
        tipo_movimiento: "cargo",
        estado: "pendiente",
        equipo_id: equipoLocalId,
        monto: hayInasistencia ? multaInasistenciaLocal : cargoArbitrajeLocal,
        concepto: hayInasistencia ? "multa" : "arbitraje",
        descripcion: hayInasistencia
          ? descripcionInasistenciaLocal
          : "Cargo arbitraje por partido",
        origen_clave: `${keyPrefix}cargo:${hayInasistencia ? `${inasistenciaEquipo}-inasistencia` : "arbitraje"}:local`,
      },
      {
        tipo_movimiento: "cargo",
        estado: "pendiente",
        equipo_id: equipoVisitanteId,
        monto: hayInasistencia ? multaInasistenciaVisitante : cargoArbitrajeVisitante,
        concepto: hayInasistencia ? "multa" : "arbitraje",
        descripcion: hayInasistencia
          ? descripcionInasistenciaVisitante
          : "Cargo arbitraje por partido",
        origen_clave: `${keyPrefix}cargo:${hayInasistencia ? `${inasistenciaEquipo}-inasistencia` : "arbitraje"}:visitante`,
      },
      {
        tipo_movimiento: "cargo",
        estado: "pendiente",
        equipo_id: equipoLocalId,
        monto: cargoTaLocal,
        concepto: "multa",
        descripcion: "Cargo por tarjetas amarillas",
        origen_clave: `${keyPrefix}cargo:ta:local`,
      },
      {
        tipo_movimiento: "cargo",
        estado: "pendiente",
        equipo_id: equipoVisitanteId,
        monto: cargoTaVisitante,
        concepto: "multa",
        descripcion: "Cargo por tarjetas amarillas",
        origen_clave: `${keyPrefix}cargo:ta:visitante`,
      },
      {
        tipo_movimiento: "cargo",
        estado: "pendiente",
        equipo_id: equipoLocalId,
        monto: cargoTrLocal,
        concepto: "multa",
        descripcion: "Cargo por tarjetas rojas",
        origen_clave: `${keyPrefix}cargo:tr:local`,
      },
      {
        tipo_movimiento: "cargo",
        estado: "pendiente",
        equipo_id: equipoVisitanteId,
        monto: cargoTrVisitante,
        concepto: "multa",
        descripcion: "Cargo por tarjetas rojas",
        origen_clave: `${keyPrefix}cargo:tr:visitante`,
      },
      {
        tipo_movimiento: "abono",
        estado: "pagado",
        equipo_id: equipoLocalId,
        monto: valorPositivo(montos.pagoLocal),
        concepto: "inscripcion",
        descripcion: "Pago inscripción (planilla de partido)",
        origen_clave: `${keyPrefix}abono:inscripcion:local`,
      },
      {
        tipo_movimiento: "abono",
        estado: "pagado",
        equipo_id: equipoVisitanteId,
        monto: valorPositivo(montos.pagoVisitante),
        concepto: "inscripcion",
        descripcion: "Pago inscripción (planilla de partido)",
        origen_clave: `${keyPrefix}abono:inscripcion:visitante`,
      },
      {
        tipo_movimiento: "abono",
        estado: "pagado",
        equipo_id: equipoLocalId,
        monto: valorPositivo(montos.pagoArbitrajeLocal),
        concepto: "arbitraje",
        descripcion: "Pago arbitraje (planilla de partido)",
        origen_clave: `${keyPrefix}abono:arbitraje:local`,
      },
      {
        tipo_movimiento: "abono",
        estado: "pagado",
        equipo_id: equipoVisitanteId,
        monto: valorPositivo(montos.pagoArbitrajeVisitante),
        concepto: "arbitraje",
        descripcion: "Pago arbitraje (planilla de partido)",
        origen_clave: `${keyPrefix}abono:arbitraje:visitante`,
      },
      {
        tipo_movimiento: "abono",
        estado: "pagado",
        equipo_id: equipoLocalId,
        monto: valorPositivo(montos.pagoTaLocal),
        concepto: "multa",
        descripcion: "Pago tarjetas amarillas (planilla de partido)",
        origen_clave: `${keyPrefix}abono:ta:local`,
      },
      {
        tipo_movimiento: "abono",
        estado: "pagado",
        equipo_id: equipoVisitanteId,
        monto: valorPositivo(montos.pagoTaVisitante),
        concepto: "multa",
        descripcion: "Pago tarjetas amarillas (planilla de partido)",
        origen_clave: `${keyPrefix}abono:ta:visitante`,
      },
      {
        tipo_movimiento: "abono",
        estado: "pagado",
        equipo_id: equipoLocalId,
        monto: valorPositivo(montos.pagoTrLocal),
        concepto: "multa",
        descripcion: "Pago tarjetas rojas (planilla de partido)",
        origen_clave: `${keyPrefix}abono:tr:local`,
      },
      {
        tipo_movimiento: "abono",
        estado: "pagado",
        equipo_id: equipoVisitanteId,
        monto: valorPositivo(montos.pagoTrVisitante),
        concepto: "multa",
        descripcion: "Pago tarjetas rojas (planilla de partido)",
        origen_clave: `${keyPrefix}abono:tr:visitante`,
      },
    ];

    for (const mov of movimientos) {
      if (!Number.isFinite(Number(mov.equipo_id)) || Number(mov.equipo_id) <= 0) continue;
      if (mov.monto <= 0) continue;

      await client.query(
        `
          INSERT INTO finanzas_movimientos (
            campeonato_id,
            evento_id,
            equipo_id,
            partido_id,
            tipo_movimiento,
            concepto,
            descripcion,
            monto,
            estado,
            fecha_movimiento,
            metodo_pago,
            referencia,
            origen,
            origen_clave
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE,
            'planilla', $10, 'planilla', $11
          )
          ON CONFLICT (origen_clave)
          DO UPDATE SET
            campeonato_id = EXCLUDED.campeonato_id,
            evento_id = EXCLUDED.evento_id,
            equipo_id = EXCLUDED.equipo_id,
            partido_id = EXCLUDED.partido_id,
            tipo_movimiento = EXCLUDED.tipo_movimiento,
            concepto = EXCLUDED.concepto,
            descripcion = EXCLUDED.descripcion,
            monto = EXCLUDED.monto,
            estado = EXCLUDED.estado,
            fecha_movimiento = EXCLUDED.fecha_movimiento,
            metodo_pago = EXCLUDED.metodo_pago,
            referencia = EXCLUDED.referencia,
            origen = EXCLUDED.origen,
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          campeonatoId,
          eventoId,
          mov.equipo_id,
          partidoId,
          mov.tipo_movimiento,
          mov.concepto,
          mov.descripcion,
          mov.monto,
          mov.estado,
          `PARTIDO-${partidoId}`,
          mov.origen_clave,
        ]
      );
    }
  }
}

module.exports = Partido;
