const Partido = require("../models/Partido");
const pool = require("../config/database");
const {
  obtenerEstadosEquiposEvento,
  estaEliminadoCompetencia,
} = require("../services/competitionStatusService");

const REGLAS_DEFAULT = ["puntos", "diferencia_goles", "goles_favor"];
const PESOS_FAIR_PLAY_DEFAULT = {
  amarilla: 1,
  roja: 3,
  falta: 0.25,
  uniformidad: 2,
  comportamiento: 2,
  puntualidad: 1,
  base: 100,
};

const schemaCache = {
  tablas: new Map(),
  columnas: new Map(),
};
let tablasManualesSchemaAsegurado = false;

function aEntero(valor, fallback = 0) {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? n : fallback;
}

function aNumero(valor, fallback = 0) {
  const n = Number.parseFloat(valor);
  return Number.isFinite(n) ? n : fallback;
}

function redondear2(valor) {
  return Math.round((aNumero(valor, 0) + Number.EPSILON) * 100) / 100;
}

function modalidadUsaFaltasFairPlay(tipoFutbol) {
  const tipo = String(tipoFutbol || "").trim().toLowerCase();
  return (
    tipo.includes("futbol_7") ||
    tipo.includes("futbol_6") ||
    tipo.includes("futbol_5") ||
    tipo.includes("futbol5") ||
    tipo.includes("futbol6") ||
    tipo.includes("futbol7") ||
    tipo.includes("sala") ||
    tipo.includes("futsal")
  );
}

function parsearReglas(raw) {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch (_) {}
  return [...REGLAS_DEFAULT];
}

async function existeTabla(nombreTabla) {
  if (schemaCache.tablas.has(nombreTabla)) return schemaCache.tablas.get(nombreTabla);
  const q = `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = $1
    LIMIT 1
  `;
  const r = await pool.query(q, [nombreTabla]);
  const existe = r.rows.length > 0;
  schemaCache.tablas.set(nombreTabla, existe);
  return existe;
}

async function obtenerColumnasTabla(nombreTabla) {
  if (schemaCache.columnas.has(nombreTabla)) return schemaCache.columnas.get(nombreTabla);
  const q = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
  `;
  const r = await pool.query(q, [nombreTabla]);
  const cols = new Set(r.rows.map((x) => x.column_name));
  schemaCache.columnas.set(nombreTabla, cols);
  return cols;
}

function primeraColumnaDisponible(cols, candidatas) {
  for (const c of candidatas) {
    if (cols.has(c)) return c;
  }
  return null;
}

async function obtenerEventoConCampeonato(eventoId) {
  const q = `
    SELECT e.*,
           c.id AS campeonato_id,
           c.nombre AS campeonato_nombre,
           c.tipo_futbol,
           c.sistema_puntuacion,
           COALESCE(c.reglas_desempate::text, '["puntos","diferencia_goles","goles_favor"]') AS reglas_desempate
    FROM eventos e
    JOIN campeonatos c ON c.id = e.campeonato_id
    WHERE e.id = $1
  `;
  const r = await pool.query(q, [eventoId]);
  return r.rows[0] || null;
}

async function obtenerGruposPorEvento(eventoId) {
  const q = `
    SELECT g.*, COUNT(ge.equipo_id)::int AS cantidad_equipos
    FROM grupos g
    LEFT JOIN grupo_equipos ge ON ge.grupo_id = g.id
    WHERE g.evento_id = $1
    GROUP BY g.id
    ORDER BY g.letra_grupo, g.id
  `;
  const r = await pool.query(q, [eventoId]);
  return r.rows;
}

async function obtenerEquiposGrupo(grupoId) {
  const q = `
    SELECT e.id, e.nombre, e.logo_url, e.director_tecnico
    FROM grupo_equipos ge
    JOIN equipos e ON e.id = ge.equipo_id
    WHERE ge.grupo_id = $1
    ORDER BY ge.orden_sorteo NULLS LAST, e.nombre
  `;
  const r = await pool.query(q, [grupoId]);
  return r.rows;
}

async function obtenerEquiposEvento(eventoId) {
  const q = `
    WITH base AS (
      SELECT ee.equipo_id
      FROM evento_equipos ee
      WHERE ee.evento_id = $1
      UNION
      SELECT ge.equipo_id
      FROM grupos g
      JOIN grupo_equipos ge ON ge.grupo_id = g.id
      WHERE g.evento_id = $1
    )
    SELECT e.id, e.nombre, e.logo_url, e.director_tecnico
    FROM base b
    JOIN equipos e ON e.id = b.equipo_id
    ORDER BY e.nombre
  `;
  const r = await pool.query(q, [eventoId]);
  return r.rows;
}

function claveTablaManual(grupoId = null) {
  const grupo = aEntero(grupoId, 0);
  return grupo > 0 ? `grupo:${grupo}` : "grupo:0";
}

async function asegurarEsquemaTablasManuales(db = pool) {
  if (tablasManualesSchemaAsegurado) return;

  try {
    const schemaR = await db.query(`
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'tabla_posiciones_manuales'
        ) AS tiene_tabla_manual,
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'tabla_posiciones_auditoria'
        ) AS tiene_tabla_auditoria
    `);
    const schema = schemaR.rows[0] || {};
    if (schema.tiene_tabla_manual === true && schema.tiene_tabla_auditoria === true) {
      tablasManualesSchemaAsegurado = true;
      return;
    }
  } catch (_) {}

  await db.query(`
    CREATE TABLE IF NOT EXISTS tabla_posiciones_manuales (
      id SERIAL PRIMARY KEY,
      evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
      grupo_id INTEGER REFERENCES grupos(id) ON DELETE CASCADE,
      payload JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_by_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_tabla_posiciones_manuales_scope
    ON tabla_posiciones_manuales(evento_id, COALESCE(grupo_id, 0))
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS tabla_posiciones_auditoria (
      id SERIAL PRIMARY KEY,
      evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
      grupo_id INTEGER REFERENCES grupos(id) ON DELETE CASCADE,
      comentario TEXT NOT NULL,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      snapshot_anterior JSONB,
      snapshot_nuevo JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tabla_posiciones_auditoria_evento
    ON tabla_posiciones_auditoria(evento_id, created_at DESC)
  `);

  tablasManualesSchemaAsegurado = true;
}

function serializarTablaManual(tabla = []) {
  return (Array.isArray(tabla) ? tabla : []).map((row, idx) => {
    const equipoId = aEntero(row?.equipo?.id ?? row?.equipo_id, 0);
    const est = row?.estadisticas || {};
    const golesFavor = aEntero(est.goles_favor ?? row?.goles_favor, 0);
    const golesContra = aEntero(est.goles_contra ?? row?.goles_contra, 0);
    return {
      equipo_id: equipoId,
      posicion_deportiva: aEntero(
        row?.posicion_deportiva ?? row?.posicion_competitiva ?? row?.posicion ?? idx + 1,
        idx + 1
      ),
      partidos_jugados: aEntero(est.partidos_jugados, 0),
      partidos_ganados: aEntero(est.partidos_ganados, 0),
      partidos_empatados: aEntero(est.partidos_empatados, 0),
      partidos_perdidos: aEntero(est.partidos_perdidos, 0),
      goles_favor: golesFavor,
      goles_contra: golesContra,
      puntos: aEntero(row?.puntos, 0),
    };
  });
}

function normalizarSistemaPuntuacion(sistema = "tradicional") {
  return String(sistema || "tradicional").trim().toLowerCase() === "shootouts"
    ? "shootouts"
    : "tradicional";
}

function calcularPuntosTablaManual(stats = {}, baseStats = {}, sistema = "tradicional") {
  const partidosGanados = aEntero(stats?.partidos_ganados, 0);
  const partidosEmpatados = aEntero(stats?.partidos_empatados, 0);
  const partidosPerdidos = aEntero(stats?.partidos_perdidos, 0);

  if (normalizarSistemaPuntuacion(sistema) !== "shootouts") {
    return partidosGanados * 3 + partidosEmpatados;
  }

  const victoriasShootoutsBase = aEntero(baseStats?.victorias_shootouts, 0);
  const derrotasShootoutsBase = aEntero(baseStats?.derrotas_shootouts, 0);
  const victoriasShootouts = Math.min(victoriasShootoutsBase, partidosGanados);
  const derrotasShootouts = Math.min(derrotasShootoutsBase, partidosPerdidos);
  const victoriasTiempo = Math.max(partidosGanados - victoriasShootouts, 0);

  return victoriasTiempo * 3 + victoriasShootouts * 2 + derrotasShootouts + partidosEmpatados;
}

function construirFilaTablaDesdePayload(baseRow = {}, payloadRow = {}, fallbackPos = 1, sistema = "tradicional") {
  const baseStats = baseRow?.estadisticas || {};
  const golesFavor = aEntero(payloadRow?.goles_favor, aEntero(baseStats.goles_favor, 0));
  const golesContra = aEntero(payloadRow?.goles_contra, aEntero(baseStats.goles_contra, 0));
  const posicionDeportiva = aEntero(payloadRow?.posicion_deportiva, fallbackPos);
  const partidosGanados = aEntero(payloadRow?.partidos_ganados, aEntero(baseStats.partidos_ganados, 0));
  const partidosEmpatados = aEntero(payloadRow?.partidos_empatados, aEntero(baseStats.partidos_empatados, 0));
  const partidosPerdidos = aEntero(payloadRow?.partidos_perdidos, aEntero(baseStats.partidos_perdidos, 0));
  const partidosJugados = partidosGanados + partidosEmpatados + partidosPerdidos;
  const puntosCalculados = calcularPuntosTablaManual(
    {
      partidos_ganados: partidosGanados,
      partidos_empatados: partidosEmpatados,
      partidos_perdidos: partidosPerdidos,
    },
    baseStats,
    sistema
  );
  const merged = {
    ...baseRow,
    posicion_deportiva: posicionDeportiva,
    equipo: { ...(baseRow?.equipo || {}) },
    estadisticas: {
      ...baseStats,
      partidos_jugados: partidosJugados,
      partidos_ganados: partidosGanados,
      partidos_empatados: partidosEmpatados,
      partidos_perdidos: partidosPerdidos,
      goles_favor: golesFavor,
      goles_contra: golesContra,
      diferencia_goles: golesFavor - golesContra,
    },
    puntos: puntosCalculados,
    diferencia_goles: golesFavor - golesContra,
  };
  return merged;
}

function compararFilasPorReglas(a = {}, b = {}, reglas = REGLAS_DEFAULT, opciones = {}) {
  const reglasAplicadas = Array.isArray(reglas) && reglas.length ? reglas : [...REGLAS_DEFAULT];
  for (const r of reglasAplicadas) {
    if (r === "puntos" && b.puntos !== a.puntos) return b.puntos - a.puntos;
    if (r === "diferencia_goles" && b.diferencia_goles !== a.diferencia_goles) {
      return b.diferencia_goles - a.diferencia_goles;
    }
    if (r === "goles_favor" && (b.estadisticas?.goles_favor || 0) !== (a.estadisticas?.goles_favor || 0)) {
      return (b.estadisticas?.goles_favor || 0) - (a.estadisticas?.goles_favor || 0);
    }
    if (r === "goles_contra" && (a.estadisticas?.goles_contra || 0) !== (b.estadisticas?.goles_contra || 0)) {
      return (a.estadisticas?.goles_contra || 0) - (b.estadisticas?.goles_contra || 0);
    }
    if (r === "menos_perdidos" && (a.estadisticas?.partidos_perdidos || 0) !== (b.estadisticas?.partidos_perdidos || 0)) {
      return (a.estadisticas?.partidos_perdidos || 0) - (b.estadisticas?.partidos_perdidos || 0);
    }
  }

  if (opciones.usarPosicionDeportivaComoDesempate) {
    const posA = aEntero(a?.posicion_deportiva, 9999);
    const posB = aEntero(b?.posicion_deportiva, 9999);
    if (posA !== posB) return posA - posB;
  }

  return String(a?.equipo?.nombre || "").localeCompare(String(b?.equipo?.nombre || ""));
}

function aplicarTablaManual(
  tablaBase = [],
  manualRow = null,
  clasificadosPorGrupo = null,
  reglas = REGLAS_DEFAULT,
  sistema = "tradicional"
) {
  if (!manualRow || !Array.isArray(manualRow?.payload) || !manualRow.payload.length) {
    return {
      tabla: tablaBase,
      manual_activa: false,
      manual_meta: null,
    };
  }

  const baseMap = new Map(
    (Array.isArray(tablaBase) ? tablaBase : []).map((row) => [aEntero(row?.equipo?.id, 0), row])
  );
  const usadas = new Set();
  const tabla = [];

  for (const payloadRow of manualRow.payload) {
    const equipoId = aEntero(payloadRow?.equipo_id, 0);
    if (!equipoId || usadas.has(equipoId) || !baseMap.has(equipoId)) continue;
    usadas.add(equipoId);
    tabla.push(
      construirFilaTablaDesdePayload(baseMap.get(equipoId), payloadRow, tabla.length + 1, sistema)
    );
  }

  for (const row of tablaBase) {
    const equipoId = aEntero(row?.equipo?.id, 0);
    if (!equipoId || usadas.has(equipoId)) continue;
    usadas.add(equipoId);
    tabla.push(
      construirFilaTablaDesdePayload(
        row,
        {
          equipo_id: equipoId,
          posicion_deportiva: tabla.length + 1,
        },
        tabla.length + 1,
        sistema
      )
    );
  }

  tabla.sort((a, b) =>
    compararFilasPorReglas(a, b, reglas, {
      usarPosicionDeportivaComoDesempate: true,
    })
  );

  tabla.forEach((row, idx) => {
    row.posicion_deportiva = idx + 1;
  });
  aplicarEstadoClasificacionTabla(tabla, clasificadosPorGrupo);

  return {
    tabla,
    manual_activa: true,
    manual_meta: {
      updated_at: manualRow.updated_at || null,
      updated_by_usuario_id: aEntero(manualRow.updated_by_usuario_id, 0) || null,
    },
  };
}

async function obtenerMapTablasManualesEvento(eventoId, db = pool) {
  await asegurarEsquemaTablasManuales(db);
  const r = await db.query(
    `
      SELECT id, evento_id, grupo_id, payload, updated_by_usuario_id, updated_at
      FROM tabla_posiciones_manuales
      WHERE evento_id = $1
    `,
    [eventoId]
  );
  const map = new Map();
  for (const row of r.rows) {
    map.set(claveTablaManual(row.grupo_id), {
      ...row,
      payload: Array.isArray(row.payload) ? row.payload : [],
    });
  }
  return map;
}

async function obtenerTablaManualScope(eventoId, grupoId = null, db = pool) {
  await asegurarEsquemaTablasManuales(db);
  const r = await db.query(
    `
      SELECT id, evento_id, grupo_id, payload, updated_by_usuario_id, updated_at
      FROM tabla_posiciones_manuales
      WHERE evento_id = $1
        AND (
          ($2::int IS NULL AND grupo_id IS NULL)
          OR grupo_id = $2
        )
      LIMIT 1
    `,
    [eventoId, Number.isFinite(Number(grupoId)) ? Number(grupoId) : null]
  );
  const row = r.rows[0] || null;
  if (!row) return null;
  return {
    ...row,
    payload: Array.isArray(row.payload) ? row.payload : [],
  };
}

async function invalidarPlayoffPorCambioTabla(eventoId, db = pool) {
  const eventoIdNumerico = aEntero(eventoId, NaN);
  if (!Number.isFinite(eventoIdNumerico)) return;

  const Eliminatoria = require("../models/Eliminatoria");
  await Eliminatoria.asegurarEsquema(db);

  if (typeof Eliminatoria.eliminarPartidosReclasificacionEvento === "function") {
    await Eliminatoria.eliminarPartidosReclasificacionEvento(eventoIdNumerico, db);
  }

  await db.query(`DELETE FROM evento_reclasificaciones_playoff WHERE evento_id = $1`, [
    eventoIdNumerico,
  ]);
  await db.query(`DELETE FROM evento_clasificados_manuales WHERE evento_id = $1`, [
    eventoIdNumerico,
  ]);
  await db.query(`DELETE FROM partidos_eliminatoria WHERE evento_id = $1`, [eventoIdNumerico]);
}

function normalizarPayloadTablaManual(
  filas = [],
  tablaBase = [],
  reglas = REGLAS_DEFAULT,
  sistema = "tradicional"
) {
  const baseMap = new Map(
    (Array.isArray(tablaBase) ? tablaBase : []).map((row, idx) => {
      const equipoId = aEntero(row?.equipo?.id, 0);
      return [equipoId, { row, idx }];
    })
  );
  const usadas = new Set();
  const normalizadas = [];

  for (const item of Array.isArray(filas) ? filas : []) {
    const equipoId = aEntero(item?.equipo_id, 0);
    if (!equipoId || usadas.has(equipoId) || !baseMap.has(equipoId)) continue;
    usadas.add(equipoId);
    const { row, idx } = baseMap.get(equipoId);
    const basePayload = serializarTablaManual([row])[0] || {};
    normalizadas.push({
      ...basePayload,
      equipo_id: equipoId,
      posicion_deportiva: aEntero(item?.posicion_deportiva ?? item?.posicion, idx + 1),
      partidos_ganados: aEntero(item?.partidos_ganados, basePayload.partidos_ganados),
      partidos_empatados: aEntero(item?.partidos_empatados, basePayload.partidos_empatados),
      partidos_perdidos: aEntero(item?.partidos_perdidos, basePayload.partidos_perdidos),
      goles_favor: aEntero(item?.goles_favor, basePayload.goles_favor),
      goles_contra: aEntero(item?.goles_contra, basePayload.goles_contra),
    });
  }

  for (const row of tablaBase) {
    const equipoId = aEntero(row?.equipo?.id, 0);
    if (!equipoId || usadas.has(equipoId)) continue;
    usadas.add(equipoId);
    normalizadas.push(serializarTablaManual([row])[0]);
  }

  const comparables = normalizadas.map((row, idx) =>
    construirFilaTablaDesdePayload(
      baseMap.get(aEntero(row?.equipo_id, 0))?.row || {},
      row,
      idx + 1,
      sistema
    )
  );

  comparables.sort((a, b) =>
    compararFilasPorReglas(a, b, reglas, {
      usarPosicionDeportivaComoDesempate: true,
    })
  );

  return comparables.map((row, idx) => ({
    equipo_id: aEntero(row?.equipo?.id, 0),
    posicion_deportiva: idx + 1,
    partidos_jugados: aEntero(row?.estadisticas?.partidos_jugados, 0),
    partidos_ganados: aEntero(row?.estadisticas?.partidos_ganados, 0),
    partidos_empatados: aEntero(row?.estadisticas?.partidos_empatados, 0),
    partidos_perdidos: aEntero(row?.estadisticas?.partidos_perdidos, 0),
    goles_favor: aEntero(row?.estadisticas?.goles_favor, 0),
    goles_contra: aEntero(row?.estadisticas?.goles_contra, 0),
    puntos: aEntero(row?.puntos, 0),
  }));
}

function aplicarEstadoClasificacionTabla(tabla, clasificadosPorGrupo = null) {
  const cupos = aEntero(clasificadosPorGrupo, 0);
  tabla.forEach((item, idx) => {
    item.posicion_deportiva = aEntero(
      item.posicion_deportiva ?? item.posicion ?? idx + 1,
      idx + 1
    );
  });

  const elegibles = tabla
    .filter((item) => !estaEliminadoCompetencia(item))
    .sort(
      (a, b) =>
        aEntero(a.posicion_deportiva, 9999) - aEntero(b.posicion_deportiva, 9999)
    );
  const eliminados = tabla
    .filter((item) => estaEliminadoCompetencia(item))
    .sort(
      (a, b) =>
        aEntero(a.posicion_deportiva, 9999) - aEntero(b.posicion_deportiva, 9999)
    );

  tabla.splice(0, tabla.length, ...elegibles, ...eliminados);

  let posicionClasificacion = 0;
  tabla.forEach((item, idx) => {
    const posicion = idx + 1;
    const eliminado = estaEliminadoCompetencia(item);
    if (!eliminado) posicionClasificacion += 1;
    const clasifica = cupos > 0 ? !eliminado && posicionClasificacion <= cupos : !eliminado;
    item.posicion = posicion;
    item.posicion_competitiva = posicion;
    item.posicion_clasificacion = eliminado ? null : posicionClasificacion;
    item.clasifica = clasifica;
    item.eliminado_competencia = eliminado;
    item.fuera_clasificacion = cupos > 0 ? eliminado || !clasifica : eliminado;
  });
}

async function calcularPuntosEquipoEnGrupo(equipoId, grupoId, sistema) {
  try {
    const q = `
      SELECT *
      FROM partidos
      WHERE grupo_id = $1
        AND (equipo_local_id = $2 OR equipo_visitante_id = $2)
        AND estado = 'finalizado'
    `;
    const r = await pool.query(q, [grupoId, equipoId]);
    let puntos = 0;
    for (const p of r.rows) {
      const esLocal = Number(p.equipo_local_id) === Number(equipoId);
      const { puntosLocal, puntosVisitante } = Partido.calcularPuntos(
        sistema,
        p.resultado_local,
        p.resultado_visitante,
        p.resultado_local_shootouts,
        p.resultado_visitante_shootouts,
        p.shootouts
      );
      puntos += esLocal ? puntosLocal : puntosVisitante;
    }
    return puntos;
  } catch (_) {
    const qLegacy = `
      SELECT *
      FROM partidos
      WHERE grupo_id = $1
        AND (equipo_local_id = $2 OR equipo_visitante_id = $2)
        AND estado = 'finalizado'
    `;
    const r = await pool.query(qLegacy, [grupoId, equipoId]);
    let puntos = 0;
    for (const p of r.rows) {
      const esLocal = Number(p.equipo_local_id) === Number(equipoId);
      const rL = aEntero(p.resultado_local, 0);
      const rV = aEntero(p.resultado_visitante, 0);
      if (rL === rV) puntos += 1;
      else if ((esLocal && rL > rV) || (!esLocal && rV > rL)) puntos += 3;
    }
    return puntos;
  }
}

async function calcularResumenEvento(equipoId, eventoId, sistema) {
  const q = `
    SELECT *
    FROM partidos
    WHERE evento_id = $1
      AND (equipo_local_id = $2 OR equipo_visitante_id = $2)
      AND estado = 'finalizado'
  `;
  const r = await pool.query(q, [eventoId, equipoId]);

  const resumen = {
    partidos_jugados: 0,
    partidos_ganados: 0,
    partidos_empatados: 0,
    partidos_perdidos: 0,
    goles_favor: 0,
    goles_contra: 0,
    victorias_tiempo: 0,
    victorias_shootouts: 0,
    derrotas_tiempo: 0,
    derrotas_shootouts: 0,
    puntos: 0,
  };

  for (const p of r.rows) {
    const esLocal = Number(p.equipo_local_id) === Number(equipoId);
    const gf = esLocal ? aEntero(p.resultado_local, 0) : aEntero(p.resultado_visitante, 0);
    const gc = esLocal ? aEntero(p.resultado_visitante, 0) : aEntero(p.resultado_local, 0);

    resumen.partidos_jugados += 1;
    resumen.goles_favor += gf;
    resumen.goles_contra += gc;

    const { puntosLocal, puntosVisitante } = Partido.calcularPuntos(
      sistema,
      p.resultado_local,
      p.resultado_visitante,
      p.resultado_local_shootouts,
      p.resultado_visitante_shootouts,
      p.shootouts
    );
    resumen.puntos += esLocal ? puntosLocal : puntosVisitante;

    const rL = aEntero(p.resultado_local, 0);
    const rV = aEntero(p.resultado_visitante, 0);
    const sL = aEntero(p.resultado_local_shootouts, 0);
    const sV = aEntero(p.resultado_visitante_shootouts, 0);
    const fueShootouts = Boolean(p.shootouts);

    if (!fueShootouts) {
      if ((esLocal && rL > rV) || (!esLocal && rV > rL)) {
        resumen.partidos_ganados += 1;
        resumen.victorias_tiempo += 1;
      } else if ((esLocal && rL < rV) || (!esLocal && rV < rL)) {
        resumen.partidos_perdidos += 1;
        resumen.derrotas_tiempo += 1;
      } else {
        resumen.partidos_empatados += 1;
      }
      continue;
    }

    if ((esLocal && sL > sV) || (!esLocal && sV > sL)) {
      resumen.partidos_ganados += 1;
      resumen.victorias_shootouts += 1;
    } else if ((esLocal && sL < sV) || (!esLocal && sV < sL)) {
      resumen.partidos_perdidos += 1;
      resumen.derrotas_shootouts += 1;
    } else {
      resumen.partidos_empatados += 1;
    }
  }

  return resumen;
}

function ordenarTablaPorReglas(tabla, reglas) {
  tabla.sort((a, b) => compararFilasPorReglas(a, b, reglas));

  tabla.forEach((item, idx) => {
    item.posicion = idx + 1;
  });
}

async function generarTablaGrupoInterna(grupoId, options = {}) {
  const qGrupo = `
    SELECT g.id, g.nombre_grupo, g.letra_grupo, g.evento_id,
           e.nombre AS evento_nombre,
           COALESCE(
             e.clasificados_por_grupo,
             CASE WHEN LOWER(COALESCE(e.metodo_competencia, 'grupos')) IN ('grupos', 'mixto') THEN 2 ELSE NULL END
           ) AS clasificados_por_grupo,
           c.id AS campeonato_id,
           c.nombre AS campeonato_nombre,
           c.tipo_futbol,
           c.sistema_puntuacion,
           COALESCE(c.reglas_desempate::text, '["puntos","diferencia_goles","goles_favor"]') AS reglas_desempate
    FROM grupos g
    LEFT JOIN eventos e ON e.id = g.evento_id
    LEFT JOIN campeonatos c ON c.id = e.campeonato_id
    WHERE g.id = $1
  `;
  const grupoR = await pool.query(qGrupo, [grupoId]);
  if (!grupoR.rows.length) throw new Error("Grupo no encontrado");

  const grupo = grupoR.rows[0];
  const sistema = grupo.sistema_puntuacion || "tradicional";
  const reglas = parsearReglas(grupo.reglas_desempate);
  const equipos = await obtenerEquiposGrupo(grupo.id);
  const estadosEquipos = await obtenerEstadosEquiposEvento(grupo.evento_id);
  const tabla = [];

  for (const equipo of equipos) {
    const est = await Partido.obtenerEstadisticasEquipoAvanzado(equipo.id, grupo.id);
    const puntos = await calcularPuntosEquipoEnGrupo(equipo.id, grupo.id, sistema);

    const victoriasTiempo = aEntero(est.victorias_tiempo, 0);
    const victoriasShootouts = aEntero(est.victorias_shootouts, 0);
    const derrotasTiempo = aEntero(est.derrotas_tiempo, 0);
    const derrotasShootouts = aEntero(est.derrotas_shootouts, 0);
    const empates = Math.max(aEntero(est.empates, 0) - victoriasShootouts - derrotasShootouts, 0);
    const gf = aEntero(est.goles_favor, 0);
    const gc = aEntero(est.goles_contra, 0);
    const estadoEquipo = estadosEquipos.get(Number(equipo.id)) || {
      no_presentaciones: 0,
      eliminado_automatico: false,
      eliminado_manual: false,
      motivo_eliminacion: null,
      motivo_eliminacion_label: null,
      detalle_eliminacion: null,
    };

    tabla.push({
      posicion: 0,
      equipo: {
        id: equipo.id,
        nombre: equipo.nombre,
        logo_url: equipo.logo_url || null,
        director_tecnico: equipo.director_tecnico || null,
      },
      estadisticas: {
        partidos_jugados: aEntero(est.partidos_jugados, 0),
        partidos_ganados: victoriasTiempo + victoriasShootouts,
        partidos_empatados: empates,
        partidos_perdidos: derrotasTiempo + derrotasShootouts,
        goles_favor: gf,
        goles_contra: gc,
        diferencia_goles: gf - gc,
        victorias_tiempo: victoriasTiempo,
        victorias_shootouts: victoriasShootouts,
        derrotas_tiempo: derrotasTiempo,
        derrotas_shootouts: derrotasShootouts,
      },
      puntos,
      diferencia_goles: gf - gc,
      no_presentaciones: estadoEquipo.no_presentaciones,
      eliminado_automatico: estadoEquipo.eliminado_automatico,
      eliminado_manual: estadoEquipo.eliminado_manual,
      motivo_eliminacion: estadoEquipo.motivo_eliminacion,
      motivo_eliminacion_label: estadoEquipo.motivo_eliminacion_label,
      detalle_eliminacion: estadoEquipo.detalle_eliminacion,
    });
  }

  ordenarTablaPorReglas(tabla, reglas);
  aplicarEstadoClasificacionTabla(tabla, grupo.clasificados_por_grupo);
  const manualMap = options.ignoreManual
    ? new Map()
    : options.tablasManualesMap || (await obtenerMapTablasManualesEvento(grupo.evento_id));
  const manualAplicada = aplicarTablaManual(
    tabla,
    manualMap.get(claveTablaManual(grupo.id)) || null,
    grupo.clasificados_por_grupo,
    reglas,
    sistema
  );

  return {
    grupo: {
      id: grupo.id,
      nombre_grupo: grupo.nombre_grupo,
      letra_grupo: grupo.letra_grupo,
      evento_id: grupo.evento_id,
      evento_nombre: grupo.evento_nombre,
      clasificados_por_grupo: aEntero(grupo.clasificados_por_grupo, 0) || null,
      campeonato_id: grupo.campeonato_id,
      campeonato_nombre: grupo.campeonato_nombre,
      edicion_manual_activa: manualAplicada.manual_activa === true,
      edicion_manual_meta: manualAplicada.manual_meta,
    },
    sistema_puntuacion: sistema,
    tipo_futbol: grupo.tipo_futbol || null,
    reglas_desempate: reglas,
    tabla: manualAplicada.tabla,
  };
}

async function generarTablaEventoSinGrupos(evento, options = {}) {
  const equipos = await obtenerEquiposEvento(evento.id);
  const sistema = evento.sistema_puntuacion || "tradicional";
  const reglas = parsearReglas(evento.reglas_desempate);
  const estadosEquipos = await obtenerEstadosEquiposEvento(evento.id);
  const tabla = [];

  for (const equipo of equipos) {
    const est = await calcularResumenEvento(equipo.id, evento.id, sistema);
    const gf = aEntero(est.goles_favor, 0);
    const gc = aEntero(est.goles_contra, 0);
    const estadoEquipo = estadosEquipos.get(Number(equipo.id)) || {
      no_presentaciones: 0,
      eliminado_automatico: false,
      eliminado_manual: false,
      motivo_eliminacion: null,
      motivo_eliminacion_label: null,
      detalle_eliminacion: null,
    };

    tabla.push({
      posicion: 0,
      equipo: {
        id: equipo.id,
        nombre: equipo.nombre,
        logo_url: equipo.logo_url || null,
        director_tecnico: equipo.director_tecnico || null,
      },
      estadisticas: {
        partidos_jugados: est.partidos_jugados,
        partidos_ganados: est.partidos_ganados,
        partidos_empatados: est.partidos_empatados,
        partidos_perdidos: est.partidos_perdidos,
        goles_favor: gf,
        goles_contra: gc,
        diferencia_goles: gf - gc,
        victorias_tiempo: est.victorias_tiempo,
        victorias_shootouts: est.victorias_shootouts,
        derrotas_tiempo: est.derrotas_tiempo,
        derrotas_shootouts: est.derrotas_shootouts,
      },
      puntos: est.puntos,
      diferencia_goles: gf - gc,
      no_presentaciones: estadoEquipo.no_presentaciones,
      eliminado_automatico: estadoEquipo.eliminado_automatico,
      eliminado_manual: estadoEquipo.eliminado_manual,
      motivo_eliminacion: estadoEquipo.motivo_eliminacion,
      motivo_eliminacion_label: estadoEquipo.motivo_eliminacion_label,
      detalle_eliminacion: estadoEquipo.detalle_eliminacion,
    });
  }

  ordenarTablaPorReglas(tabla, reglas);
  aplicarEstadoClasificacionTabla(tabla, evento.clasificados_por_grupo);
  const manualMap = options.ignoreManual
    ? new Map()
    : options.tablasManualesMap || (await obtenerMapTablasManualesEvento(evento.id));
  const manualAplicada = aplicarTablaManual(
    tabla,
    manualMap.get(claveTablaManual(null)) || null,
    evento.clasificados_por_grupo,
    reglas,
    sistema
  );

  return {
    grupo: {
      id: null,
      nombre_grupo: "Tabla General",
      letra_grupo: "-",
      evento_id: evento.id,
      evento_nombre: evento.nombre,
      clasificados_por_grupo: aEntero(evento.clasificados_por_grupo, 0) || null,
      campeonato_id: evento.campeonato_id,
      campeonato_nombre: evento.campeonato_nombre,
      edicion_manual_activa: manualAplicada.manual_activa === true,
      edicion_manual_meta: manualAplicada.manual_meta,
    },
    sistema_puntuacion: sistema,
    tipo_futbol: evento.tipo_futbol || null,
    reglas_desempate: reglas,
    tabla: manualAplicada.tabla,
  };
}

async function generarTablasEventoInterna(eventoId, options = {}) {
  const evento = await obtenerEventoConCampeonato(eventoId);
  if (!evento) throw new Error("Evento no encontrado");
  const sistema = evento.sistema_puntuacion || "tradicional";

  const grupos = await obtenerGruposPorEvento(eventoId);
  const tablas = [];
  const tablasManualesMap = options.ignoreManual
    ? new Map()
    : await obtenerMapTablasManualesEvento(eventoId);

  if (!grupos.length) {
    tablas.push(await generarTablaEventoSinGrupos(evento, { ...options, tablasManualesMap }));
  } else {
    for (const g of grupos) {
      tablas.push(await generarTablaGrupoInterna(g.id, { ...options, tablasManualesMap }));
    }
  }

  const totalEquipos = tablas.reduce((acc, t) => acc + (Array.isArray(t.tabla) ? t.tabla.length : 0), 0);

  return {
    evento: {
      id: evento.id,
      nombre: evento.nombre,
      clasificados_por_grupo: aEntero(evento.clasificados_por_grupo, 0) || null,
      campeonato_id: evento.campeonato_id,
      campeonato_nombre: evento.campeonato_nombre,
      sistema_puntuacion: sistema,
    },
    total_grupos: tablas.length,
    total_equipos: totalEquipos,
    grupos: tablas,
  };
}

async function obtenerGoleadoresEventoInterno(eventoId) {
  const tablaGoleadoresExiste = await existeTabla("goleadores");
  if (!tablaGoleadoresExiste) {
    return {
      fuente: "sin_datos",
      mensaje: "No existe la tabla goleadores en la base de datos.",
      goleadores: [],
    };
  }

  const cols = await obtenerColumnasTabla("goleadores");
  const partidoCol = primeraColumnaDisponible(cols, ["partido_id"]);
  const jugadorCol = primeraColumnaDisponible(cols, ["jugador_id"]);
  const golesCol = primeraColumnaDisponible(cols, ["goles"]);

  if (!partidoCol || !jugadorCol) {
    return {
      fuente: "sin_datos",
      mensaje: "La tabla goleadores no tiene las columnas minimas esperadas.",
      goleadores: [],
    };
  }

  const golesExpr = golesCol ? `COALESCE(g.${golesCol}, 1)` : "1";
  const q = `
    SELECT
      j.id AS jugador_id,
      TRIM(CONCAT(COALESCE(j.nombre, ''), ' ', COALESCE(j.apellido, ''))) AS jugador_nombre,
      j.numero_camiseta,
      e.id AS equipo_id,
      e.nombre AS equipo_nombre,
      SUM(${golesExpr})::int AS goles,
      COUNT(DISTINCT g.${partidoCol})::int AS partidos_con_gol
    FROM goleadores g
    JOIN partidos p ON p.id = g.${partidoCol}
    JOIN jugadores j ON j.id = g.${jugadorCol}
    LEFT JOIN equipos e ON e.id = j.equipo_id
    WHERE p.evento_id = $1
    GROUP BY j.id, j.nombre, j.apellido, j.numero_camiseta, e.id, e.nombre
    ORDER BY goles DESC, jugador_nombre ASC
  `;
  const r = await pool.query(q, [eventoId]);
  return { fuente: "goleadores", mensaje: null, goleadores: r.rows };
}

async function obtenerTarjetasEventoInterno(eventoId) {
  const equiposEvento = await obtenerEquiposEvento(eventoId);
  const mapa = new Map();

  for (const e of equiposEvento) {
    mapa.set(Number(e.id), {
      equipo_id: Number(e.id),
      equipo_nombre: e.nombre,
      amarillas: 0,
      rojas: 0,
    });
  }

  let fuente = "sin_datos";
  let mensaje = "No hay una fuente configurada para tarjetas.";

  const existeTarjetas = await existeTabla("tarjetas");
  if (existeTarjetas) {
    const cols = await obtenerColumnasTabla("tarjetas");
    const partidoCol = primeraColumnaDisponible(cols, ["partido_id"]);
    const tipoCol = primeraColumnaDisponible(cols, ["tipo_tarjeta", "tipo", "tarjeta", "color"]);
    const jugadorCol = primeraColumnaDisponible(cols, ["jugador_id"]);
    const equipoCol = primeraColumnaDisponible(cols, ["equipo_id"]);

    if (partidoCol && tipoCol && (jugadorCol || equipoCol)) {
      const joinJugador = jugadorCol ? `LEFT JOIN jugadores j ON j.id = t.${jugadorCol}` : "";
      const equipoExpr = equipoCol && jugadorCol
        ? `COALESCE(t.${equipoCol}, j.equipo_id)`
        : equipoCol
          ? `t.${equipoCol}`
          : "j.equipo_id";

      const q = `
        SELECT
          e.id AS equipo_id,
          e.nombre AS equipo_nombre,
          SUM(
            CASE
              WHEN LOWER(COALESCE(t.${tipoCol}::text, '')) LIKE 'amar%'
                OR LOWER(COALESCE(t.${tipoCol}::text, '')) IN ('yellow', 'y')
              THEN 1 ELSE 0
            END
          )::int AS amarillas,
          SUM(
            CASE
              WHEN LOWER(COALESCE(t.${tipoCol}::text, '')) LIKE 'roj%'
                OR LOWER(COALESCE(t.${tipoCol}::text, '')) IN ('red', 'r')
              THEN 1 ELSE 0
            END
          )::int AS rojas
        FROM tarjetas t
        JOIN partidos p ON p.id = t.${partidoCol}
        ${joinJugador}
        JOIN equipos e ON e.id = ${equipoExpr}
        WHERE p.evento_id = $1
        GROUP BY e.id, e.nombre
      `;
      const r = await pool.query(q, [eventoId]);
      for (const row of r.rows) {
        const id = Number(row.equipo_id);
        const actual = mapa.get(id) || {
          equipo_id: id,
          equipo_nombre: row.equipo_nombre || `Equipo ${id}`,
          amarillas: 0,
          rojas: 0,
        };
        actual.amarillas = aEntero(row.amarillas, 0);
        actual.rojas = aEntero(row.rojas, 0);
        mapa.set(id, actual);
      }
      fuente = "tarjetas";
      mensaje = null;
    }
  }

  if (fuente === "sin_datos") {
    const colsPartidos = await obtenerColumnasTabla("partidos");
    const amarillasLocal = primeraColumnaDisponible(colsPartidos, [
      "tarjetas_amarillas_local",
      "amarillas_local",
      "amarillas_equipo_local",
      "amarillas_locales",
    ]);
    const amarillasVisit = primeraColumnaDisponible(colsPartidos, [
      "tarjetas_amarillas_visitante",
      "amarillas_visitante",
      "amarillas_equipo_visitante",
      "amarillas_visitantes",
    ]);
    const rojasLocal = primeraColumnaDisponible(colsPartidos, [
      "tarjetas_rojas_local",
      "rojas_local",
      "rojas_equipo_local",
      "rojas_locales",
    ]);
    const rojasVisit = primeraColumnaDisponible(colsPartidos, [
      "tarjetas_rojas_visitante",
      "rojas_visitante",
      "rojas_equipo_visitante",
      "rojas_visitantes",
    ]);

    if (amarillasLocal && amarillasVisit && rojasLocal && rojasVisit) {
      const q = `
        SELECT
          t.equipo_id,
          t.equipo_nombre,
          SUM(t.amarillas)::int AS amarillas,
          SUM(t.rojas)::int AS rojas
        FROM (
          SELECT
            el.id AS equipo_id,
            el.nombre AS equipo_nombre,
            COALESCE(p.${amarillasLocal}, 0)::int AS amarillas,
            COALESCE(p.${rojasLocal}, 0)::int AS rojas
          FROM partidos p
          JOIN equipos el ON el.id = p.equipo_local_id
          WHERE p.evento_id = $1
          UNION ALL
          SELECT
            ev.id AS equipo_id,
            ev.nombre AS equipo_nombre,
            COALESCE(p.${amarillasVisit}, 0)::int AS amarillas,
            COALESCE(p.${rojasVisit}, 0)::int AS rojas
          FROM partidos p
          JOIN equipos ev ON ev.id = p.equipo_visitante_id
          WHERE p.evento_id = $1
        ) t
        GROUP BY t.equipo_id, t.equipo_nombre
      `;
      const r = await pool.query(q, [eventoId]);
      for (const row of r.rows) {
        const id = Number(row.equipo_id);
        const actual = mapa.get(id) || {
          equipo_id: id,
          equipo_nombre: row.equipo_nombre || `Equipo ${id}`,
          amarillas: 0,
          rojas: 0,
        };
        actual.amarillas = aEntero(row.amarillas, 0);
        actual.rojas = aEntero(row.rojas, 0);
        mapa.set(id, actual);
      }
      fuente = "partidos";
      mensaje = null;
    } else {
      mensaje = "No se encontraron columnas de tarjetas en tablas conocidas.";
    }
  }

  const tarjetas = Array.from(mapa.values()).sort((a, b) => {
    if (b.rojas !== a.rojas) return b.rojas - a.rojas;
    if (b.amarillas !== a.amarillas) return b.amarillas - a.amarillas;
    return String(a.equipo_nombre).localeCompare(String(b.equipo_nombre));
  });

  return { fuente, mensaje, tarjetas };
}

async function obtenerFaltasEventoInterno(eventoId) {
  const mapa = new Map();
  const equiposEvento = await obtenerEquiposEvento(eventoId);
  for (const e of equiposEvento) {
    mapa.set(Number(e.id), {
      equipo_id: Number(e.id),
      equipo_nombre: e.nombre,
      faltas: 0,
    });
  }

  const colsPartidos = await obtenerColumnasTabla("partidos");
  const faltasLocalTotal = primeraColumnaDisponible(colsPartidos, [
    "faltas_local_total",
    "faltas_local",
    "total_faltas_local",
  ]);
  const faltasVisitanteTotal = primeraColumnaDisponible(colsPartidos, [
    "faltas_visitante_total",
    "faltas_visitante",
    "total_faltas_visitante",
  ]);

  const faltasLocal1 = primeraColumnaDisponible(colsPartidos, [
    "faltas_local_1er",
    "faltas_local_1",
    "faltas_local_t1",
    "faltas_local_primer_tiempo",
  ]);
  const faltasLocal2 = primeraColumnaDisponible(colsPartidos, [
    "faltas_local_2do",
    "faltas_local_2",
    "faltas_local_t2",
    "faltas_local_segundo_tiempo",
  ]);
  const faltasVisit1 = primeraColumnaDisponible(colsPartidos, [
    "faltas_visitante_1er",
    "faltas_visitante_1",
    "faltas_visitante_t1",
    "faltas_visitante_primer_tiempo",
  ]);
  const faltasVisit2 = primeraColumnaDisponible(colsPartidos, [
    "faltas_visitante_2do",
    "faltas_visitante_2",
    "faltas_visitante_t2",
    "faltas_visitante_segundo_tiempo",
  ]);

  const localExpr = faltasLocalTotal
    ? `COALESCE(p.${faltasLocalTotal}, 0)::int`
    : `(COALESCE(${faltasLocal1 ? `p.${faltasLocal1}` : "0"}, 0)::int + COALESCE(${faltasLocal2 ? `p.${faltasLocal2}` : "0"}, 0)::int)`;
  const visitExpr = faltasVisitanteTotal
    ? `COALESCE(p.${faltasVisitanteTotal}, 0)::int`
    : `(COALESCE(${faltasVisit1 ? `p.${faltasVisit1}` : "0"}, 0)::int + COALESCE(${faltasVisit2 ? `p.${faltasVisit2}` : "0"}, 0)::int)`;

  const tieneFuente = Boolean(
    faltasLocalTotal ||
      faltasVisitanteTotal ||
      faltasLocal1 ||
      faltasLocal2 ||
      faltasVisit1 ||
      faltasVisit2
  );

  if (!tieneFuente) {
    return {
      fuente: "sin_datos",
      mensaje: "No se encontraron columnas de faltas en tabla partidos.",
      faltas: Array.from(mapa.values()),
    };
  }

  const q = `
    SELECT
      t.equipo_id,
      t.equipo_nombre,
      SUM(t.faltas)::int AS faltas
    FROM (
      SELECT
        el.id AS equipo_id,
        el.nombre AS equipo_nombre,
        ${localExpr} AS faltas
      FROM partidos p
      JOIN equipos el ON el.id = p.equipo_local_id
      WHERE p.evento_id = $1
      UNION ALL
      SELECT
        ev.id AS equipo_id,
        ev.nombre AS equipo_nombre,
        ${visitExpr} AS faltas
      FROM partidos p
      JOIN equipos ev ON ev.id = p.equipo_visitante_id
      WHERE p.evento_id = $1
    ) t
    GROUP BY t.equipo_id, t.equipo_nombre
  `;
  const r = await pool.query(q, [eventoId]);

  for (const row of r.rows) {
    const id = Number(row.equipo_id);
    const actual = mapa.get(id) || {
      equipo_id: id,
      equipo_nombre: row.equipo_nombre || `Equipo ${id}`,
      faltas: 0,
    };
    actual.faltas = aEntero(row.faltas, 0);
    mapa.set(id, actual);
  }

  return {
    fuente: "partidos",
    mensaje: null,
    faltas: Array.from(mapa.values()),
  };
}

async function obtenerEvaluacionesFairPlay(eventoId) {
  const tablasCandidatas = ["fair_play_evaluaciones", "fairplay_evaluaciones"];

  for (const tabla of tablasCandidatas) {
    if (!(await existeTabla(tabla))) continue;

    const cols = await obtenerColumnasTabla(tabla);
    const eventoCol = primeraColumnaDisponible(cols, ["evento_id", "event_id"]);
    const equipoCol = primeraColumnaDisponible(cols, ["equipo_id"]);
    const uniformeCol = primeraColumnaDisponible(cols, ["uniformidad", "uniforme"]);
    const comportamientoCol = primeraColumnaDisponible(cols, ["comportamiento", "conducta"]);
    const puntualidadCol = primeraColumnaDisponible(cols, ["puntualidad"]);

    if (!eventoCol || !equipoCol) continue;

    const uniformeExpr = uniformeCol ? `AVG(COALESCE(${uniformeCol}, 0))::numeric(10,2)` : "0::numeric(10,2)";
    const comportamientoExpr = comportamientoCol ? `AVG(COALESCE(${comportamientoCol}, 0))::numeric(10,2)` : "0::numeric(10,2)";
    const puntualidadExpr = puntualidadCol ? `AVG(COALESCE(${puntualidadCol}, 0))::numeric(10,2)` : "0::numeric(10,2)";

    const q = `
      SELECT
        ${equipoCol} AS equipo_id,
        ${uniformeExpr} AS uniformidad,
        ${comportamientoExpr} AS comportamiento,
        ${puntualidadExpr} AS puntualidad
      FROM ${tabla}
      WHERE ${eventoCol} = $1
      GROUP BY ${equipoCol}
    `;
    const r = await pool.query(q, [eventoId]);
    const mapa = new Map();
    for (const row of r.rows) {
      mapa.set(Number(row.equipo_id), {
        uniformidad: aNumero(row.uniformidad, 0),
        comportamiento: aNumero(row.comportamiento, 0),
        puntualidad: aNumero(row.puntualidad, 0),
      });
    }
    return { fuente: tabla, evaluaciones: mapa };
  }

  return { fuente: "sin_datos", evaluaciones: new Map() };
}

async function obtenerFairPlayEventoInterno(eventoId, query = {}) {
  const eventoIdNumerico = aEntero(eventoId, NaN);
  if (!Number.isFinite(eventoIdNumerico)) {
    throw new Error("evento_id invalido");
  }

  const evento = await obtenerEventoConCampeonato(eventoIdNumerico);
  const usaFaltas = modalidadUsaFaltasFairPlay(evento?.tipo_futbol);

  const pesos = {
    amarilla: aNumero(query.peso_amarilla, PESOS_FAIR_PLAY_DEFAULT.amarilla),
    roja: aNumero(query.peso_roja, PESOS_FAIR_PLAY_DEFAULT.roja),
    falta: usaFaltas ? aNumero(query.peso_falta, PESOS_FAIR_PLAY_DEFAULT.falta) : 0,
    uniformidad: aNumero(query.peso_uniformidad, PESOS_FAIR_PLAY_DEFAULT.uniformidad),
    comportamiento: aNumero(query.peso_comportamiento, PESOS_FAIR_PLAY_DEFAULT.comportamiento),
    puntualidad: aNumero(query.peso_puntualidad, PESOS_FAIR_PLAY_DEFAULT.puntualidad),
    base: aNumero(query.base, PESOS_FAIR_PLAY_DEFAULT.base),
  };

  const equipos = await obtenerEquiposEvento(eventoIdNumerico);
  const estadosEquipos = await obtenerEstadosEquiposEvento(eventoIdNumerico);
  const tarjetasData = await obtenerTarjetasEventoInterno(eventoIdNumerico);
  const faltasData = usaFaltas
    ? await obtenerFaltasEventoInterno(eventoIdNumerico)
    : { fuente: "no_aplica", faltas: [] };
  const evaluaciones = await obtenerEvaluacionesFairPlay(eventoIdNumerico);

  const mapaEquipos = new Map();
  for (const e of equipos) {
    const estadoEquipo = estadosEquipos.get(Number(e.id));
    if (estaEliminadoCompetencia(estadoEquipo || {})) continue;
    mapaEquipos.set(Number(e.id), {
      equipo_id: Number(e.id),
      equipo_nombre: e.nombre,
    });
  }
  for (const t of tarjetasData.tarjetas) {
    const estadoEquipo = estadosEquipos.get(Number(t.equipo_id));
    if (estaEliminadoCompetencia(estadoEquipo || {})) continue;
    if (!mapaEquipos.has(Number(t.equipo_id))) {
      mapaEquipos.set(Number(t.equipo_id), {
        equipo_id: Number(t.equipo_id),
        equipo_nombre: t.equipo_nombre || `Equipo ${t.equipo_id}`,
      });
    }
  }

  const tarjetasMap = new Map(tarjetasData.tarjetas.map((t) => [Number(t.equipo_id), t]));
  const faltasMap = new Map(faltasData.faltas.map((f) => [Number(f.equipo_id), f]));
  const fairPlay = Array.from(mapaEquipos.values()).map((eq) => {
    const t = tarjetasMap.get(eq.equipo_id) || { amarillas: 0, rojas: 0 };
    const f = faltasMap.get(eq.equipo_id) || { faltas: 0 };
    const ev = evaluaciones.evaluaciones.get(eq.equipo_id) || {
      uniformidad: 0,
      comportamiento: 0,
      puntualidad: 0,
    };

    const faltas = usaFaltas ? aEntero(f.faltas, 0) : 0;
    const penalizacion = t.amarillas * pesos.amarilla + t.rojas * pesos.roja + faltas * pesos.falta;
    const bonificacion =
      ev.uniformidad * pesos.uniformidad +
      ev.comportamiento * pesos.comportamiento +
      ev.puntualidad * pesos.puntualidad;
    const puntaje = Math.max(0, redondear2(pesos.base + bonificacion - penalizacion));

    return {
      equipo_id: eq.equipo_id,
      equipo_nombre: eq.equipo_nombre,
      amarillas: aEntero(t.amarillas, 0),
      rojas: aEntero(t.rojas, 0),
      faltas,
      uniformidad: redondear2(ev.uniformidad),
      comportamiento: redondear2(ev.comportamiento),
      puntualidad: redondear2(ev.puntualidad),
      penalizacion: redondear2(penalizacion),
      bonificacion: redondear2(bonificacion),
      puntaje_fair_play: puntaje,
    };
  });

  fairPlay.sort((a, b) => {
    if (b.puntaje_fair_play !== a.puntaje_fair_play) return b.puntaje_fair_play - a.puntaje_fair_play;
    if (a.rojas !== b.rojas) return a.rojas - b.rojas;
    if (a.amarillas !== b.amarillas) return a.amarillas - b.amarillas;
    if (a.faltas !== b.faltas) return a.faltas - b.faltas;
    return String(a.equipo_nombre).localeCompare(String(b.equipo_nombre));
  });

  fairPlay.forEach((row, idx) => {
    row.posicion = idx + 1;
  });

  return {
    ok: true,
    evento_id: eventoIdNumerico,
    total: fairPlay.length,
    pesos,
    fuentes: {
      tarjetas: tarjetasData.fuente,
      faltas: faltasData.fuente,
      evaluaciones: evaluaciones.fuente,
    },
    incluye_faltas: usaFaltas,
    fair_play: fairPlay,
  };
}

const tablaController = {
  async guardarTablaManual(req, res) {
    const client = await pool.connect();
    try {
      const eventoId = aEntero(req.params.evento_id, NaN);
      if (!Number.isFinite(eventoId)) {
        return res.status(400).json({ error: "evento_id invalido" });
      }
      const comentario = String(req.body?.comentario || "").trim();
      if (comentario.length < 5) {
        return res.status(400).json({
          error: "Debes registrar un comentario de auditoría (mínimo 5 caracteres).",
        });
      }

      const tablasBase = await generarTablasEventoInterna(eventoId, { ignoreManual: true });
      const grupoId = Number.isFinite(Number(req.body?.grupo_id)) ? Number(req.body.grupo_id) : null;
      const objetivo =
        grupoId !== null
          ? tablasBase.grupos.find((item) => Number(item?.grupo?.id) === Number(grupoId))
          : tablasBase.grupos.length === 1
            ? tablasBase.grupos[0]
            : null;

      if (!objetivo) {
        return res.status(404).json({
          error: "No se encontró la tabla objetivo para guardar la edición manual.",
        });
      }

      const filas = Array.isArray(req.body?.filas) ? req.body.filas : [];
      if (!filas.length) {
        return res.status(400).json({ error: "No se recibieron filas para guardar la tabla." });
      }

      const payloadNormalizado = normalizarPayloadTablaManual(
        filas,
        objetivo.tabla || [],
        Array.isArray(objetivo?.reglas_desempate) ? objetivo.reglas_desempate : REGLAS_DEFAULT,
        objetivo?.sistema_puntuacion || tablasBase?.evento?.sistema_puntuacion || "tradicional"
      );
      const snapshotBase = serializarTablaManual(objetivo.tabla || []);

      await client.query("BEGIN");
      await asegurarEsquemaTablasManuales(client);

      const anterior = await obtenerTablaManualScope(eventoId, grupoId, client);
      const snapshotAnterior =
        Array.isArray(anterior?.payload) && anterior.payload.length ? anterior.payload : snapshotBase;

      await client.query(
        `
          DELETE FROM tabla_posiciones_manuales
          WHERE evento_id = $1
            AND (($2::int IS NULL AND grupo_id IS NULL) OR grupo_id = $2)
        `,
        [eventoId, grupoId]
      );

      await client.query(
        `
          INSERT INTO tabla_posiciones_manuales (
            evento_id,
            grupo_id,
            payload,
            updated_by_usuario_id,
            updated_at
          )
          VALUES ($1, $2, $3::jsonb, $4, CURRENT_TIMESTAMP)
        `,
        [
          eventoId,
          grupoId,
          JSON.stringify(payloadNormalizado),
          aEntero(req.user?.id, 0) || null,
        ]
      );

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
          grupoId,
          comentario,
          aEntero(req.user?.id, 0) || null,
          JSON.stringify(snapshotAnterior),
          JSON.stringify(payloadNormalizado),
        ]
      );

      await invalidarPlayoffPorCambioTabla(eventoId, client);

      await client.query("COMMIT");
      const data = await generarTablasEventoInterna(eventoId);
      return res.json({
        ok: true,
        mensaje:
          "Tabla manual guardada con auditoría. El playoff anterior fue invalidado y debe regenerarse con la nueva clasificación.",
        playoff_requiere_regeneracion: true,
        ...data,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error guardando tabla manual:", error);
      return res.status(500).json({
        error: "No se pudo guardar la edición manual de la tabla.",
        detalle: error.message,
      });
    } finally {
      client.release();
    }
  },

  async resetearTablaManual(req, res) {
    const client = await pool.connect();
    try {
      const eventoId = aEntero(req.params.evento_id, NaN);
      if (!Number.isFinite(eventoId)) {
        return res.status(400).json({ error: "evento_id invalido" });
      }
      const comentario = String(req.body?.comentario || "").trim();
      if (comentario.length < 5) {
        return res.status(400).json({
          error: "Debes registrar un comentario de auditoría (mínimo 5 caracteres).",
        });
      }
      const grupoId = Number.isFinite(Number(req.body?.grupo_id)) ? Number(req.body.grupo_id) : null;

      await client.query("BEGIN");
      await asegurarEsquemaTablasManuales(client);

      const anterior = await obtenerTablaManualScope(eventoId, grupoId, client);
      if (!anterior) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "No existe edición manual para restablecer." });
      }

      await client.query(
        `
          DELETE FROM tabla_posiciones_manuales
          WHERE evento_id = $1
            AND (($2::int IS NULL AND grupo_id IS NULL) OR grupo_id = $2)
        `,
        [eventoId, grupoId]
      );

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
          grupoId,
          comentario,
          aEntero(req.user?.id, 0) || null,
          JSON.stringify(anterior.payload || []),
          JSON.stringify([]),
        ]
      );

      await invalidarPlayoffPorCambioTabla(eventoId, client);

      await client.query("COMMIT");
      const data = await generarTablasEventoInterna(eventoId);
      return res.json({
        ok: true,
        mensaje:
          "Edición manual restablecida. El playoff anterior fue invalidado y debe regenerarse con la clasificación actual.",
        playoff_requiere_regeneracion: true,
        ...data,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error restableciendo tabla manual:", error);
      return res.status(500).json({
        error: "No se pudo restablecer la edición manual de la tabla.",
        detalle: error.message,
      });
    } finally {
      client.release();
    }
  },

  async generarTablaGrupo(req, res) {
    try {
      const grupoId = aEntero(req.params.grupo_id, NaN);
      if (!Number.isFinite(grupoId)) {
        return res.status(400).json({ error: "grupo_id invalido" });
      }

      const data = await generarTablaGrupoInterna(grupoId);
      return res.json({
        mensaje: `Tabla de posicion - ${data.grupo.nombre_grupo || "Grupo"}`,
        grupo: data.grupo,
        sistema_puntuacion: data.sistema_puntuacion,
        tipo_futbol: data.tipo_futbol,
        reglas_desempate: data.reglas_desempate,
        total_equipos: data.tabla.length,
        tabla: data.tabla,
      });
    } catch (error) {
      console.error("Error generando tabla por grupo:", error);
      return res.status(500).json({
        error: "Error generando tabla de posicion",
        detalle: error.message,
      });
    }
  },

  async generarTablaCompleta(req, res) {
    try {
      const campeonatoId = aEntero(req.params.campeonato_id, NaN);
      if (!Number.isFinite(campeonatoId)) {
        return res.status(400).json({ error: "campeonato_id invalido" });
      }

      const q = `
        SELECT g.id
        FROM grupos g
        JOIN eventos e ON e.id = g.evento_id
        WHERE e.campeonato_id = $1
        ORDER BY g.letra_grupo, g.id
      `;
      const gruposR = await pool.query(q, [campeonatoId]);
      if (!gruposR.rows.length) {
        return res.status(404).json({ error: "No hay grupos asociados a este campeonato" });
      }

      const grupos = [];
      for (const g of gruposR.rows) {
        grupos.push(await generarTablaGrupoInterna(g.id));
      }

      return res.json({
        mensaje: "Tablas completas del campeonato",
        total_grupos: grupos.length,
        grupos,
      });
    } catch (error) {
      console.error("Error generando tablas por campeonato:", error);
      return res.status(500).json({
        error: "Error generando tablas por campeonato",
        detalle: error.message,
      });
    }
  },

  async generarTablasEvento(req, res) {
    try {
      const eventoId = aEntero(req.params.evento_id, NaN);
      if (!Number.isFinite(eventoId)) {
        return res.status(400).json({ error: "evento_id invalido" });
      }
      const data = await generarTablasEventoInterna(eventoId);
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error generando tablas por evento:", error);
      return res.status(500).json({
        error: "Error generando tablas por evento",
        detalle: error.message,
      });
    }
  },

  async obtenerGoleadoresEvento(req, res) {
    try {
      const eventoId = aEntero(req.params.evento_id, NaN);
      if (!Number.isFinite(eventoId)) {
        return res.status(400).json({ error: "evento_id invalido" });
      }
      const data = await obtenerGoleadoresEventoInterno(eventoId);
      return res.json({
        ok: true,
        evento_id: eventoId,
        fuente: data.fuente,
        mensaje: data.mensaje,
        total: data.goleadores.length,
        goleadores: data.goleadores,
      });
    } catch (error) {
      console.error("Error obteniendo goleadores:", error);
      return res.status(500).json({
        error: "Error obteniendo goleadores",
        detalle: error.message,
      });
    }
  },

  async obtenerTarjetasEvento(req, res) {
    try {
      const eventoId = aEntero(req.params.evento_id, NaN);
      if (!Number.isFinite(eventoId)) {
        return res.status(400).json({ error: "evento_id invalido" });
      }
      const data = await obtenerTarjetasEventoInterno(eventoId);
      return res.json({
        ok: true,
        evento_id: eventoId,
        fuente: data.fuente,
        mensaje: data.mensaje,
        total: data.tarjetas.length,
        tarjetas: data.tarjetas,
      });
    } catch (error) {
      console.error("Error obteniendo tarjetas:", error);
      return res.status(500).json({
        error: "Error obteniendo tarjetas",
        detalle: error.message,
      });
    }
  },

  async obtenerFairPlayEvento(req, res) {
    try {
      const eventoId = aEntero(req.params.evento_id, NaN);
      if (!Number.isFinite(eventoId)) {
        return res.status(400).json({ error: "evento_id invalido" });
      }
      const data = await obtenerFairPlayEventoInterno(eventoId, req.query || {});
      return res.json(data);
    } catch (error) {
      console.error("Error obteniendo fair play:", error);
      return res.status(500).json({
        error: "Error obteniendo tabla fair play",
        detalle: error.message,
      });
    }
  },
};

module.exports = tablaController;
module.exports._internals = {
  generarTablasEventoInterna,
  obtenerGoleadoresEventoInterno,
  obtenerTarjetasEventoInterno,
  obtenerFairPlayEventoInterno,
};
