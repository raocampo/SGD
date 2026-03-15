// backend/models/Eliminatoria.js
const pool = require("../config/database");
const Partido = require("./Partido");
const {
  asegurarEsquemaEstadoCompeticion,
  obtenerEstadosEquiposEvento,
  obtenerClasificadosManualesEvento,
  estaEliminadoCompetencia,
  construirClaveManual,
} = require("../services/competitionStatusService");
const { _internals: tablaInternals = {} } = require("../controllers/tablaController");

const REGLAS_DEFAULT = ["puntos", "diferencia_goles", "goles_favor"];
const RONDAS_ORDEN = ["64vos", "32vos", "16vos", "8vos", "4tos", "semifinal", "final"];
const RONDAS_POR_EQUIPOS = {
  2: ["final"],
  4: ["semifinal", "final"],
  8: ["4tos", "semifinal", "final"],
  16: ["8vos", "4tos", "semifinal", "final"],
  32: ["16vos", "8vos", "4tos", "semifinal", "final"],
};
const obtenerFairPlayEventoInterno = tablaInternals?.obtenerFairPlayEventoInterno;

class Eliminatoria {
  static _schemaAsegurado = false;

  static async asegurarEsquema(db = pool) {
    if (this._schemaAsegurado && db === pool) return;

    await db.query(`
      CREATE TABLE IF NOT EXISTS partidos_eliminatoria (
          id SERIAL PRIMARY KEY,
          evento_id INTEGER REFERENCES eventos(id) ON DELETE CASCADE,
          ronda VARCHAR(30) NOT NULL,
          partido_numero INTEGER NOT NULL,
          equipo_local_id INTEGER REFERENCES equipos(id),
          equipo_visitante_id INTEGER REFERENCES equipos(id),
          ganador_id INTEGER REFERENCES equipos(id),
          resultado_local INTEGER DEFAULT 0,
          resultado_visitante INTEGER DEFAULT 0,
          partido_id INTEGER REFERENCES partidos(id),
          slot_local_id INTEGER REFERENCES partidos_eliminatoria(id),
          slot_visitante_id INTEGER REFERENCES partidos_eliminatoria(id),
          seed_local_ref VARCHAR(20),
          seed_visitante_ref VARCHAR(20),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(evento_id, ronda, partido_numero)
      )
    `);

    await db.query(`
      ALTER TABLE partidos_eliminatoria
      ADD COLUMN IF NOT EXISTS seed_local_ref VARCHAR(20),
      ADD COLUMN IF NOT EXISTS seed_visitante_ref VARCHAR(20)
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS evento_playoff_config (
          evento_id INTEGER PRIMARY KEY REFERENCES eventos(id) ON DELETE CASCADE,
          origen VARCHAR(20) NOT NULL DEFAULT 'grupos',
          metodo_clasificacion VARCHAR(30) NOT NULL DEFAULT 'cruces_grupos',
          cruces_grupos JSONB,
          guardado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_eliminatoria_evento ON partidos_eliminatoria(evento_id)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_eliminatoria_ronda ON partidos_eliminatoria(evento_id, ronda)
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS evento_reclasificaciones_playoff (
        id SERIAL PRIMARY KEY,
        evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
        grupo_id INTEGER NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
        slot_posicion INTEGER NOT NULL,
        equipo_a_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
        equipo_b_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
        ganador_id INTEGER REFERENCES equipos(id) ON DELETE SET NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        detalle TEXT,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_evento_reclasificaciones_playoff_slot
      ON evento_reclasificaciones_playoff(evento_id, grupo_id, slot_posicion)
    `);

    await db.query(`
      ALTER TABLE evento_equipos
      ADD COLUMN IF NOT EXISTS orden_sorteo INTEGER
    `);
    await asegurarEsquemaEstadoCompeticion(db);

    if (db === pool) this._schemaAsegurado = true;
  }

  static parsearReglas(raw) {
    try {
      const parsed = JSON.parse(raw || "[]");
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (_) {}
    return [...REGLAS_DEFAULT];
  }

  static getPuntosMaximosPorPartido(sistemaPuntuacion) {
    try {
      const test = Partido.calcularPuntos(sistemaPuntuacion || "tradicional", 1, 0, null, null, false);
      const n = Number.parseInt(test?.puntosLocal, 10);
      if (Number.isFinite(n) && n > 0) return n;
    } catch (_) {}
    return 3;
  }

  static async obtenerMapaFairPlayEvento(evento_id) {
    if (typeof obtenerFairPlayEventoInterno !== "function") return new Map();
    try {
      const data = await obtenerFairPlayEventoInterno(evento_id, {});
      const fairPlay = Array.isArray(data?.fair_play) ? data.fair_play : [];
      return new Map(
        fairPlay.map((row) => [
          Number(row.equipo_id),
          {
            posicion: Number.parseInt(row?.posicion, 10) || null,
            puntaje_fair_play: Number.parseFloat(row?.puntaje_fair_play) || 0,
            amarillas: Number.parseInt(row?.amarillas, 10) || 0,
            rojas: Number.parseInt(row?.rojas, 10) || 0,
            faltas: Number.parseInt(row?.faltas, 10) || 0,
          },
        ])
      );
    } catch (_) {
      return new Map();
    }
  }

  static construirClaveEnfrentamiento(grupoId, equipoAId, equipoBId) {
    const grupo = Number.parseInt(grupoId, 10);
    const ids = [Number.parseInt(equipoAId, 10), Number.parseInt(equipoBId, 10)]
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    if (!Number.isFinite(grupo) || ids.length !== 2 || ids[0] === ids[1]) return null;
    return `${grupo}:${ids[0]}-${ids[1]}`;
  }

  static async obtenerMapaEnfrentamientosDirectosEvento(
    evento_id,
    sistemaPuntuacion = "tradicional",
    db = pool
  ) {
    const q = `
      SELECT
        id,
        grupo_id,
        equipo_local_id,
        equipo_visitante_id,
        resultado_local,
        resultado_visitante,
        resultado_local_shootouts,
        resultado_visitante_shootouts,
        shootouts
      FROM partidos
      WHERE evento_id = $1
        AND grupo_id IS NOT NULL
        AND estado = 'finalizado'
        AND equipo_local_id IS NOT NULL
        AND equipo_visitante_id IS NOT NULL
      ORDER BY grupo_id ASC, id ASC
    `;
    const r = await db.query(q, [evento_id]);
    const mapa = new Map();

    for (const partido of r.rows) {
      const grupoId = Number.parseInt(partido.grupo_id, 10);
      const localId = Number.parseInt(partido.equipo_local_id, 10);
      const visitanteId = Number.parseInt(partido.equipo_visitante_id, 10);
      const clave = this.construirClaveEnfrentamiento(grupoId, localId, visitanteId);
      if (!clave) continue;

      const [equipoAId, equipoBId] = [localId, visitanteId].sort((a, b) => a - b);
      const esLocalA = equipoAId === localId;
      const esLocalB = equipoBId === localId;
      const puntos = Partido.calcularPuntos(
        sistemaPuntuacion || "tradicional",
        partido.resultado_local,
        partido.resultado_visitante,
        partido.resultado_local_shootouts,
        partido.resultado_visitante_shootouts,
        partido.shootouts
      );
      const resultadoLocal = Number.parseInt(partido.resultado_local, 10) || 0;
      const resultadoVisitante = Number.parseInt(partido.resultado_visitante, 10) || 0;
      const golesA = esLocalA ? resultadoLocal : resultadoVisitante;
      const golesB = esLocalB ? resultadoLocal : resultadoVisitante;
      const puntosA = esLocalA
        ? Number.parseInt(puntos?.puntosLocal, 10) || 0
        : Number.parseInt(puntos?.puntosVisitante, 10) || 0;
      const puntosB = esLocalB
        ? Number.parseInt(puntos?.puntosLocal, 10) || 0
        : Number.parseInt(puntos?.puntosVisitante, 10) || 0;

      if (!mapa.has(clave)) {
        mapa.set(clave, {
          grupo_id: grupoId,
          equipo_a_id: equipoAId,
          equipo_b_id: equipoBId,
          partidos_jugados: 0,
          puntos_a: 0,
          puntos_b: 0,
          victorias_a: 0,
          victorias_b: 0,
          goles_a: 0,
          goles_b: 0,
        });
      }

      const resumen = mapa.get(clave);
      resumen.partidos_jugados += 1;
      resumen.puntos_a += puntosA;
      resumen.puntos_b += puntosB;
      resumen.goles_a += golesA;
      resumen.goles_b += golesB;
      if (golesA > golesB) resumen.victorias_a += 1;
      if (golesB > golesA) resumen.victorias_b += 1;
    }

    return mapa;
  }

  static obtenerComparacionEnfrentamientoDirecto(
    a = {},
    b = {},
    enfrentamientosDirectos = new Map()
  ) {
    const grupoA = Number.parseInt(a?.grupo_origen_id ?? a?.grupo_id, 10);
    const grupoB = Number.parseInt(b?.grupo_origen_id ?? b?.grupo_id, 10);
    const equipoAId = Number.parseInt(a?.equipo_id, 10);
    const equipoBId = Number.parseInt(b?.equipo_id, 10);
    if (
      !Number.isFinite(grupoA) ||
      !Number.isFinite(grupoB) ||
      grupoA !== grupoB ||
      !Number.isFinite(equipoAId) ||
      !Number.isFinite(equipoBId)
    ) {
      return 0;
    }

    const clave = this.construirClaveEnfrentamiento(grupoA, equipoAId, equipoBId);
    if (!clave || !enfrentamientosDirectos.has(clave)) return 0;

    const resumen = enfrentamientosDirectos.get(clave);
    const equipoAEsLadoA = Number(resumen?.equipo_a_id) === equipoAId;
    const puntosA = equipoAEsLadoA ? Number(resumen?.puntos_a || 0) : Number(resumen?.puntos_b || 0);
    const puntosB = equipoAEsLadoA ? Number(resumen?.puntos_b || 0) : Number(resumen?.puntos_a || 0);
    if (puntosA !== puntosB) return puntosB - puntosA;

    const victoriasA = equipoAEsLadoA
      ? Number(resumen?.victorias_a || 0)
      : Number(resumen?.victorias_b || 0);
    const victoriasB = equipoAEsLadoA
      ? Number(resumen?.victorias_b || 0)
      : Number(resumen?.victorias_a || 0);
    if (victoriasA !== victoriasB) return victoriasB - victoriasA;

    const golesA = equipoAEsLadoA ? Number(resumen?.goles_a || 0) : Number(resumen?.goles_b || 0);
    const golesB = equipoAEsLadoA ? Number(resumen?.goles_b || 0) : Number(resumen?.goles_a || 0);
    if (golesA !== golesB) return golesB - golesA;

    return 0;
  }

  static compararTablaAcumulada(
    a = {},
    b = {},
    { enfrentamientosDirectos = new Map() } = {}
  ) {
    if (Number(b?.porcentaje_rendimiento || 0) !== Number(a?.porcentaje_rendimiento || 0)) {
      return Number(b?.porcentaje_rendimiento || 0) - Number(a?.porcentaje_rendimiento || 0);
    }
    if (Number(b?.diferencia_goles || 0) !== Number(a?.diferencia_goles || 0)) {
      return Number(b?.diferencia_goles || 0) - Number(a?.diferencia_goles || 0);
    }
    if (Number(b?.goles_favor || 0) !== Number(a?.goles_favor || 0)) {
      return Number(b?.goles_favor || 0) - Number(a?.goles_favor || 0);
    }

    const comparacionDirecta = this.obtenerComparacionEnfrentamientoDirecto(
      a,
      b,
      enfrentamientosDirectos
    );
    if (comparacionDirecta !== 0) return comparacionDirecta;

    if (Number(b?.puntaje_fair_play || 0) !== Number(a?.puntaje_fair_play || 0)) {
      return Number(b?.puntaje_fair_play || 0) - Number(a?.puntaje_fair_play || 0);
    }
    if (Number(a?.tarjetas_rojas || 0) !== Number(b?.tarjetas_rojas || 0)) {
      return Number(a?.tarjetas_rojas || 0) - Number(b?.tarjetas_rojas || 0);
    }
    if (Number(a?.tarjetas_amarillas || 0) !== Number(b?.tarjetas_amarillas || 0)) {
      return Number(a?.tarjetas_amarillas || 0) - Number(b?.tarjetas_amarillas || 0);
    }
    if (Number(a?.faltas_fair_play || 0) !== Number(b?.faltas_fair_play || 0)) {
      return Number(a?.faltas_fair_play || 0) - Number(b?.faltas_fair_play || 0);
    }
    if (
      Number(a?.posicion_deportiva || a?.posicion || 9999) !==
      Number(b?.posicion_deportiva || b?.posicion || 9999)
    ) {
      return (
        Number(a?.posicion_deportiva || a?.posicion || 9999) -
        Number(b?.posicion_deportiva || b?.posicion || 9999)
      );
    }
    return String(a?.equipo_nombre || "").localeCompare(String(b?.equipo_nombre || ""));
  }

  static compararCandidatoClasificacion(a = {}, b = {}) {
    if (Number(b?.puntos || 0) !== Number(a?.puntos || 0)) {
      return Number(b?.puntos || 0) - Number(a?.puntos || 0);
    }
    if (Number(b?.diferencia_goles || 0) !== Number(a?.diferencia_goles || 0)) {
      return Number(b?.diferencia_goles || 0) - Number(a?.diferencia_goles || 0);
    }
    if (Number(b?.goles_favor || 0) !== Number(a?.goles_favor || 0)) {
      return Number(b?.goles_favor || 0) - Number(a?.goles_favor || 0);
    }
    if (Number(b?.puntaje_fair_play || 0) !== Number(a?.puntaje_fair_play || 0)) {
      return Number(b?.puntaje_fair_play || 0) - Number(a?.puntaje_fair_play || 0);
    }
    if (Number(a?.tarjetas_rojas || 0) !== Number(b?.tarjetas_rojas || 0)) {
      return Number(a?.tarjetas_rojas || 0) - Number(b?.tarjetas_rojas || 0);
    }
    if (Number(a?.tarjetas_amarillas || 0) !== Number(b?.tarjetas_amarillas || 0)) {
      return Number(a?.tarjetas_amarillas || 0) - Number(b?.tarjetas_amarillas || 0);
    }
    if (Number(a?.faltas_fair_play || 0) !== Number(b?.faltas_fair_play || 0)) {
      return Number(a?.faltas_fair_play || 0) - Number(b?.faltas_fair_play || 0);
    }
    if (Number(a?.posicion || 9999) !== Number(b?.posicion || 9999)) {
      return Number(a?.posicion || 9999) - Number(b?.posicion || 9999);
    }
    return String(a?.equipo_nombre || "").localeCompare(String(b?.equipo_nombre || ""));
  }

  static describirMotivoSalidaCompetencia(row = {}) {
    if (row?.eliminado_automatico === true) {
      return "fue eliminado automáticamente por 3 no presentaciones";
    }
    if (row?.eliminado_manual === true) {
      const motivo = String(row?.motivo_eliminacion_label || "decisión del organizador").trim();
      return `fue eliminado por ${motivo.toLowerCase()}`;
    }
    return "salió de la zona de clasificación";
  }

  static construirNotaSugerenciaClasificacion({
    slot = 0,
    esperadoTabla = null,
    sugerido = null,
  } = {}) {
    if (!sugerido) {
      return `No existe un equipo elegible para completar el cupo ${slot}.`;
    }

    const criterios = [
      `Pts ${Number(sugerido?.puntos || 0)}`,
      `DG ${Number(sugerido?.diferencia_goles || 0)}`,
      `GF ${Number(sugerido?.goles_favor || 0)}`,
      `Fair Play ${Number(sugerido?.puntaje_fair_play || 0).toFixed(2)}`,
    ].join(" | ");

    if (!esperadoTabla) {
      return `${sugerido.equipo_nombre} ocupa el cupo ${slot} como mejor equipo elegible restante. Criterio: ${criterios}.`;
    }

    if (Number(esperadoTabla?.equipo_id) === Number(sugerido?.equipo_id)) {
      return null;
    }

    if (estaEliminadoCompetencia(esperadoTabla)) {
      return `${sugerido.equipo_nombre} reemplaza a ${esperadoTabla.equipo_nombre} porque ${this.describirMotivoSalidaCompetencia(
        esperadoTabla
      )}. Criterio aplicado: ${criterios}.`;
    }

    return `${sugerido.equipo_nombre} ocupa el cupo ${slot} como mejor equipo elegible restante. Criterio aplicado: ${criterios}.`;
  }

  static ordenarTablaPorReglas(tabla, reglas) {
    tabla.sort((a, b) => {
      for (const r of reglas) {
        if (r === "puntos" && b.puntos !== a.puntos) return b.puntos - a.puntos;
        if (r === "diferencia_goles" && b.diferencia_goles !== a.diferencia_goles) {
          return b.diferencia_goles - a.diferencia_goles;
        }
        if (r === "goles_favor" && b.goles_favor !== a.goles_favor) return b.goles_favor - a.goles_favor;
        if (r === "goles_contra" && a.goles_contra !== b.goles_contra) return a.goles_contra - b.goles_contra;
        if (r === "menos_perdidos" && a.partidos_perdidos !== b.partidos_perdidos) {
          return a.partidos_perdidos - b.partidos_perdidos;
        }
      }
      return String(a.equipo_nombre || "").localeCompare(String(b.equipo_nombre || ""));
    });

    tabla.forEach((item, idx) => {
      item.posicion = idx + 1;
    });
  }

  static mezclarArray(arr = []) {
    const copia = [...arr];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }

  static calcularTamanoBracket(cantidadSolicitada = null, cantidadEquiposEvento = 0) {
    const solicitado = Number.parseInt(cantidadSolicitada, 10);
    const base = Math.max(
      2,
      Number.isFinite(cantidadEquiposEvento) ? cantidadEquiposEvento : 0,
      Number.isFinite(solicitado) ? solicitado : 0
    );

    let n = 1;
    while (n < base) n *= 2;

    if (n > 32) {
      throw new Error("Máximo soportado para eliminatoria: 32 equipos");
    }
    return n;
  }

  static async obtenerEventoConfig(evento_id, db = pool) {
    const q = `
      SELECT
        e.id, e.nombre, e.campeonato_id, e.metodo_competencia, e.eliminatoria_equipos,
        e.clasificados_por_grupo,
        c.sistema_puntuacion,
        COALESCE(c.reglas_desempate::text, '["puntos","diferencia_goles","goles_favor"]') AS reglas_desempate
      FROM eventos e
      JOIN campeonatos c ON c.id = e.campeonato_id
      WHERE e.id = $1
      LIMIT 1
    `;
    const r = await db.query(q, [evento_id]);
    return r.rows[0] || null;
  }

  static async obtenerEquiposEvento(evento_id, db = pool) {
    const q = `
      SELECT ee.equipo_id AS id
      FROM evento_equipos ee
      JOIN equipos e ON e.id = ee.equipo_id
      WHERE ee.evento_id = $1
        AND COALESCE(ee.eliminado_automatico, FALSE) = FALSE
        AND COALESCE(ee.eliminado_manual, FALSE) = FALSE
      ORDER BY COALESCE(ee.orden_sorteo, 2147483647), e.id ASC
    `;
    const r = await db.query(q, [evento_id]);
    return r.rows.map((x) => Number(x.id)).filter((x) => Number.isFinite(x));
  }

  static async obtenerMapaClasificadosManuales(evento_id, db = pool) {
    const rows = await obtenerClasificadosManualesEvento(evento_id, db);
    const map = new Map();
    rows.forEach((row) => {
      map.set(construirClaveManual(row.grupo_id, row.slot_posicion), row);
    });
    return map;
  }

  static async obtenerReclasificacionesEvento(evento_id, db = pool) {
    await this.asegurarEsquema(db);
    const r = await db.query(
      `
        SELECT
          erp.*,
          ga.nombre AS equipo_a_nombre,
          ga.logo_url AS equipo_a_logo_url,
          gb.nombre AS equipo_b_nombre,
          gb.logo_url AS equipo_b_logo_url,
          gw.nombre AS ganador_nombre,
          g.letra_grupo
        FROM evento_reclasificaciones_playoff erp
        JOIN grupos g ON g.id = erp.grupo_id
        JOIN equipos ga ON ga.id = erp.equipo_a_id
        JOIN equipos gb ON gb.id = erp.equipo_b_id
        LEFT JOIN equipos gw ON gw.id = erp.ganador_id
        WHERE erp.evento_id = $1
        ORDER BY g.letra_grupo ASC, erp.slot_posicion ASC, erp.id ASC
      `,
      [evento_id]
    );
    return r.rows.map((row) => ({
      id: Number(row.id),
      evento_id: Number(row.evento_id),
      grupo_id: Number(row.grupo_id),
      grupo_letra: String(row.letra_grupo || "").toUpperCase(),
      slot_posicion: Number(row.slot_posicion),
      equipo_a_id: Number(row.equipo_a_id),
      equipo_a_nombre: row.equipo_a_nombre || "",
      equipo_a_logo_url: row.equipo_a_logo_url || null,
      equipo_b_id: Number(row.equipo_b_id),
      equipo_b_nombre: row.equipo_b_nombre || "",
      equipo_b_logo_url: row.equipo_b_logo_url || null,
      ganador_id: Number(row.ganador_id || 0) || null,
      ganador_nombre: row.ganador_nombre || null,
      estado: String(row.estado || "pendiente").toLowerCase(),
      detalle: row.detalle || null,
      usuario_id: Number(row.usuario_id || 0) || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    }));
  }

  static async obtenerMapaReclasificacionesEvento(evento_id, db = pool) {
    const rows = await this.obtenerReclasificacionesEvento(evento_id, db);
    const map = new Map();
    rows.forEach((row) => {
      map.set(construirClaveManual(row.grupo_id, row.slot_posicion), row);
    });
    return map;
  }

  static async obtenerGruposEvento(evento_id, db = pool) {
    const q = `
      SELECT id, nombre_grupo, letra_grupo
      FROM grupos
      WHERE evento_id = $1
      ORDER BY letra_grupo ASC, id ASC
    `;
    const r = await db.query(q, [evento_id]);
    return r.rows;
  }

  static async obtenerEquiposGrupo(grupo_id, db = pool) {
    const q = `
      SELECT
        e.id AS equipo_id,
        e.nombre AS equipo_nombre
      FROM grupo_equipos ge
      JOIN equipos e ON e.id = ge.equipo_id
      WHERE ge.grupo_id = $1
      ORDER BY ge.orden_sorteo NULLS LAST, e.nombre
    `;
    const r = await db.query(q, [grupo_id]);
    return r.rows;
  }

  static async calcularResumenEquipoGrupo(equipo_id, grupo_id, sistemaPuntuacion, db = pool) {
    const q = `
      SELECT *
      FROM partidos
      WHERE grupo_id = $1
        AND (equipo_local_id = $2 OR equipo_visitante_id = $2)
        AND estado = 'finalizado'
      ORDER BY id ASC
    `;
    const r = await db.query(q, [grupo_id, equipo_id]);

    const resumen = {
      partidos_jugados: 0,
      partidos_ganados: 0,
      partidos_empatados: 0,
      partidos_perdidos: 0,
      goles_favor: 0,
      goles_contra: 0,
      diferencia_goles: 0,
      puntos: 0,
      porcentaje_rendimiento: 0,
    };

    const puntosMaximosPorPartido = this.getPuntosMaximosPorPartido(sistemaPuntuacion);

    for (const p of r.rows) {
      const esLocal = Number(p.equipo_local_id) === Number(equipo_id);
      const rLocal = Number.parseInt(p.resultado_local, 10) || 0;
      const rVisit = Number.parseInt(p.resultado_visitante, 10) || 0;
      const gf = esLocal ? rLocal : rVisit;
      const gc = esLocal ? rVisit : rLocal;

      resumen.partidos_jugados += 1;
      resumen.goles_favor += gf;
      resumen.goles_contra += gc;

      const puntos = Partido.calcularPuntos(
        sistemaPuntuacion || "tradicional",
        p.resultado_local,
        p.resultado_visitante,
        p.resultado_local_shootouts,
        p.resultado_visitante_shootouts,
        p.shootouts
      );

      resumen.puntos += esLocal
        ? Number.parseInt(puntos?.puntosLocal, 10) || 0
        : Number.parseInt(puntos?.puntosVisitante, 10) || 0;

      if (gf > gc) resumen.partidos_ganados += 1;
      else if (gf < gc) resumen.partidos_perdidos += 1;
      else resumen.partidos_empatados += 1;
    }

    resumen.diferencia_goles = resumen.goles_favor - resumen.goles_contra;
    if (resumen.partidos_jugados > 0) {
      const maximo = resumen.partidos_jugados * puntosMaximosPorPartido;
      resumen.porcentaje_rendimiento = maximo > 0 ? Number(((resumen.puntos / maximo) * 100).toFixed(2)) : 0;
    }
    return resumen;
  }

  static normalizarCrucesGruposInput(crucesRaw, letrasGrupos = []) {
    const disponibles = new Set((letrasGrupos || []).map((x) => String(x || "").toUpperCase()).filter(Boolean));

    const salida = [];
    const pushPar = (a, b) => {
      const A = String(a || "").toUpperCase().trim();
      const B = String(b || "").toUpperCase().trim();
      if (!A || !B || A === B) return;
      if (!disponibles.has(A) || !disponibles.has(B)) return;
      salida.push([A, B]);
    };

    if (Array.isArray(crucesRaw)) {
      for (const it of crucesRaw) {
        if (Array.isArray(it) && it.length >= 2) {
          pushPar(it[0], it[1]);
          continue;
        }
        if (typeof it === "object" && it) {
          pushPar(it.grupo_a || it.a || it.grupoA, it.grupo_b || it.b || it.grupoB);
          continue;
        }
        if (typeof it === "string") {
          const parts = it.split(/[-:,/|]/).map((x) => x.trim()).filter(Boolean);
          if (parts.length >= 2) pushPar(parts[0], parts[1]);
        }
      }
    } else if (typeof crucesRaw === "string") {
      const bloques = crucesRaw.split(";").map((x) => x.trim()).filter(Boolean);
      for (const b of bloques) {
        const parts = b.split(/[-:,/|]/).map((x) => x.trim()).filter(Boolean);
        if (parts.length >= 2) pushPar(parts[0], parts[1]);
      }
    }

    // Depura duplicados y grupos repetidos.
    const usados = new Set();
    const unicos = [];
    for (const [a, b] of salida) {
      if (usados.has(a) || usados.has(b)) continue;
      usados.add(a);
      usados.add(b);
      unicos.push([a, b]);
    }

    if (unicos.length) return unicos;

    // Default: primero con último, segundo con penúltimo...
    const letras = [...disponibles].sort((x, y) => String(x).localeCompare(String(y)));
    const pares = [];
    for (let i = 0; i < Math.floor(letras.length / 2); i++) {
      pares.push([letras[i], letras[letras.length - 1 - i]]);
    }
    return pares;
  }

  static normalizarMetodoCompetenciaInput(value, fallback = "grupos") {
    const metodo = String(value || fallback || "grupos").toLowerCase().trim();
    return ["grupos", "liga", "eliminatoria", "mixto"].includes(metodo) ? metodo : fallback;
  }

  static normalizarOrigenPlayoffInput(value, fallback = "grupos") {
    const origen = String(value || fallback || "grupos").toLowerCase().trim();
    return ["evento", "grupos"].includes(origen) ? origen : fallback;
  }

  static normalizarMetodoPlayoffInput(value, fallback = "cruces_grupos") {
    const metodo = String(value || fallback || "cruces_grupos").toLowerCase().trim();
    return ["cruces_grupos", "tabla_unica"].includes(metodo) ? metodo : fallback;
  }

  static async obtenerConfiguracionPlayoff(evento_id, db = pool) {
    await this.asegurarEsquema(db);
    const evento = await this.obtenerEventoConfig(evento_id, db);
    if (!evento) throw new Error("Evento no encontrado");

    const grupos = await this.obtenerGruposEvento(evento_id, db);
    const letras = grupos
      .map((grupo) => String(grupo?.letra_grupo || "").toUpperCase().trim())
      .filter(Boolean);

    const configR = await db.query(
      `
        SELECT
          evento_id,
          origen,
          metodo_clasificacion,
          cruces_grupos,
          guardado_por_usuario_id,
          created_at,
          updated_at
        FROM evento_playoff_config
        WHERE evento_id = $1
        LIMIT 1
      `,
      [evento_id]
    );
    const config = configR.rows[0] || null;
    const metodoCompetencia = this.normalizarMetodoCompetenciaInput(
      evento?.metodo_competencia,
      "grupos"
    );
    const clasificadosPorGrupo =
      ["grupos", "mixto", "liga"].includes(metodoCompetencia)
        ? Math.max(1, Number.parseInt(evento?.clasificados_por_grupo, 10) || 2)
        : null;
    const origenDefault = metodoCompetencia === "eliminatoria" ? "evento" : "grupos";
    const origen = this.normalizarOrigenPlayoffInput(config?.origen, origenDefault);
    const metodoClasificacion = this.normalizarMetodoPlayoffInput(
      config?.metodo_clasificacion,
      origen === "grupos" ? "cruces_grupos" : "tabla_unica"
    );
    const crucesGrupos =
      origen === "grupos" && metodoClasificacion === "cruces_grupos"
        ? this.normalizarCrucesGruposInput(config?.cruces_grupos, letras)
        : [];

    return {
      evento: {
        id: Number(evento.id),
        nombre: evento.nombre,
        campeonato_id: Number(evento.campeonato_id),
        metodo_competencia: metodoCompetencia,
        clasificados_por_grupo: clasificadosPorGrupo,
        eliminatoria_equipos: Number.parseInt(evento?.eliminatoria_equipos, 10) || null,
      },
      configuracion: {
        guardada: !!config,
        origen,
        metodo_clasificacion: metodoClasificacion,
        cruces_grupos: crucesGrupos,
        grupos: grupos.map((grupo) => ({
          id: Number(grupo.id),
          letra_grupo: String(grupo?.letra_grupo || "").toUpperCase().trim(),
          nombre_grupo: grupo?.nombre_grupo || null,
        })),
        guardado_por_usuario_id: Number.parseInt(config?.guardado_por_usuario_id, 10) || null,
        guardado_en: config?.updated_at || config?.created_at || null,
      },
    };
  }

  static async guardarConfiguracionPlayoff(evento_id, payload = {}, userId = null) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await this.asegurarEsquema(client);

      const actual = await this.obtenerEventoConfig(evento_id, client);
      if (!actual) throw new Error("Evento no encontrado");

      const metodoCompetencia = this.normalizarMetodoCompetenciaInput(
        payload?.metodo_competencia ?? actual?.metodo_competencia,
        "grupos"
      );
      const clasificadosPorGrupo =
        ["grupos", "mixto", "liga"].includes(metodoCompetencia)
          ? Math.max(1, Number.parseInt(payload?.clasificados_por_grupo, 10) || 2)
          : null;
      const origenDefault = metodoCompetencia === "eliminatoria" ? "evento" : "grupos";
      const origen = this.normalizarOrigenPlayoffInput(payload?.origen, origenDefault);
      const metodoClasificacion = this.normalizarMetodoPlayoffInput(
        payload?.metodo_clasificacion,
        origen === "grupos" ? "cruces_grupos" : "tabla_unica"
      );
      const grupos = await this.obtenerGruposEvento(evento_id, client);
      const letras = grupos
        .map((grupo) => String(grupo?.letra_grupo || "").toUpperCase().trim())
        .filter(Boolean);
      const crucesGrupos =
        origen === "grupos" && metodoClasificacion === "cruces_grupos"
          ? this.normalizarCrucesGruposInput(payload?.cruces_grupos, letras)
          : [];

      await client.query(
        `
          UPDATE eventos
          SET metodo_competencia = $2,
              clasificados_por_grupo = $3
          WHERE id = $1
        `,
        [evento_id, metodoCompetencia, clasificadosPorGrupo]
      );

      await client.query(
        `
          INSERT INTO evento_playoff_config (
            evento_id,
            origen,
            metodo_clasificacion,
            cruces_grupos,
            guardado_por_usuario_id,
            updated_at
          )
          VALUES ($1, $2, $3, $4::jsonb, $5, CURRENT_TIMESTAMP)
          ON CONFLICT (evento_id)
          DO UPDATE SET
            origen = EXCLUDED.origen,
            metodo_clasificacion = EXCLUDED.metodo_clasificacion,
            cruces_grupos = EXCLUDED.cruces_grupos,
            guardado_por_usuario_id = EXCLUDED.guardado_por_usuario_id,
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          evento_id,
          origen,
          metodoClasificacion,
          JSON.stringify(crucesGrupos || []),
          Number.isFinite(Number.parseInt(userId, 10)) ? Number.parseInt(userId, 10) : null,
        ]
      );

      await client.query("COMMIT");
      return this.obtenerConfiguracionPlayoff(evento_id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async reiniciarConfiguracionPlayoff(evento_id) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await this.asegurarEsquema(client);
      await client.query(`DELETE FROM evento_playoff_config WHERE evento_id = $1`, [evento_id]);
      await client.query(`DELETE FROM evento_clasificados_manuales WHERE evento_id = $1`, [evento_id]);
      await client.query(`DELETE FROM evento_reclasificaciones_playoff WHERE evento_id = $1`, [evento_id]);
      await client.query("COMMIT");
      return this.obtenerConfiguracionPlayoff(evento_id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async obtenerClasificadosPorGrupo(
    evento_id,
    clasificados_por_grupo = 2,
    db = pool
  ) {
    const evento = await this.obtenerEventoConfig(evento_id, db);
    if (!evento) throw new Error("Evento no encontrado");

    const reglas = this.parsearReglas(evento.reglas_desempate);
    const grupos = await this.obtenerGruposEvento(evento_id, db);
    if (!grupos.length) throw new Error("El evento no tiene grupos");

    const nClasificados = Math.max(1, Number.parseInt(clasificados_por_grupo, 10) || 1);
    const estadosEquipos = await obtenerEstadosEquiposEvento(evento_id, db);
    const manualMap = await this.obtenerMapaClasificadosManuales(evento_id, db);
    const fairPlayMap = await this.obtenerMapaFairPlayEvento(evento_id);
    const reclasificacionMap = await this.obtenerMapaReclasificacionesEvento(evento_id, db);
    const tablasEvento =
      typeof tablaInternals?.generarTablasEventoInterna === "function"
        ? await tablaInternals.generarTablasEventoInterna(evento_id)
        : null;
    const tablasGrupoMap = new Map(
      (Array.isArray(tablasEvento?.grupos) ? tablasEvento.grupos : []).map((item) => [
        Number(item?.grupo?.id),
        item,
      ])
    );
    const baseGrupos = [];

    for (const g of grupos) {
      const grupoId = Number(g.id);
      const grupoLetra = String(g.letra_grupo || "").toUpperCase();
      const tablaCompartida = tablasGrupoMap.get(grupoId);
      let tablaDeportiva = [];
      let tablaVisual = [];

      if (tablaCompartida?.tabla?.length) {
        const rowsCompartidos = tablaCompartida.tabla;
        const mapearFila = (row, idx) => {
          const estadoRow = {
            ...(estadosEquipos.get(Number(row?.equipo?.id)) || {}),
            no_presentaciones: Number(row?.no_presentaciones || 0),
            eliminado_automatico: row?.eliminado_automatico === true,
            eliminado_manual: row?.eliminado_manual === true,
            motivo_eliminacion: row?.motivo_eliminacion || null,
            motivo_eliminacion_label: row?.motivo_eliminacion_label || null,
            detalle_eliminacion: row?.detalle_eliminacion || null,
          };
          const est = row?.estadisticas || {};
          const puntosMaximos = this.getPuntosMaximosPorPartido(evento.sistema_puntuacion || "tradicional");
          const pj = Number(est.partidos_jugados || 0);
          return {
            equipo_id: Number(row?.equipo?.id || 0),
            equipo_nombre: row?.equipo?.nombre || "-",
            grupo_id: grupoId,
            grupo_letra: grupoLetra,
            grupo_origen_id: grupoId,
            grupo_origen_letra: grupoLetra,
            puntos: Number(row?.puntos || 0),
            diferencia_goles: Number(row?.diferencia_goles ?? est?.diferencia_goles ?? 0),
            goles_favor: Number(est?.goles_favor || 0),
            goles_contra: Number(est?.goles_contra || 0),
            partidos_jugados: pj,
            partidos_perdidos: Number(est?.partidos_perdidos || 0),
            porcentaje_rendimiento:
              pj > 0 ? Number(((Number(row?.puntos || 0) / (pj * puntosMaximos)) * 100).toFixed(2)) : 0,
            posicion: Number(row?.posicion || idx + 1),
            posicion_deportiva: Number(row?.posicion_deportiva || row?.posicion_competitiva || row?.posicion || idx + 1),
            puntaje_fair_play:
              Number(fairPlayMap.get(Number(row?.equipo?.id))?.puntaje_fair_play || 0),
            fair_play_posicion:
              Number.parseInt(fairPlayMap.get(Number(row?.equipo?.id))?.posicion, 10) || null,
            tarjetas_amarillas:
              Number.parseInt(fairPlayMap.get(Number(row?.equipo?.id))?.amarillas, 10) || 0,
            tarjetas_rojas:
              Number.parseInt(fairPlayMap.get(Number(row?.equipo?.id))?.rojas, 10) || 0,
            faltas_fair_play:
              Number.parseInt(fairPlayMap.get(Number(row?.equipo?.id))?.faltas, 10) || 0,
            ...estadoRow,
          };
        };

        tablaVisual = rowsCompartidos.map(mapearFila);
        tablaDeportiva = [...tablaVisual].sort((a, b) => {
          const posA = Number(a?.posicion_deportiva || 9999);
          const posB = Number(b?.posicion_deportiva || 9999);
          if (posA !== posB) return posA - posB;
          return String(a?.equipo_nombre || "").localeCompare(String(b?.equipo_nombre || ""));
        });
      } else {
        const equipos = await this.obtenerEquiposGrupo(grupoId, db);
        const tabla = [];
        for (const e of equipos) {
          const resumen = await this.calcularResumenEquipoGrupo(
            e.equipo_id,
            grupoId,
            evento.sistema_puntuacion || "tradicional",
            db
          );
          tabla.push({
            equipo_id: Number(e.equipo_id),
            equipo_nombre: e.equipo_nombre,
            grupo_id: grupoId,
            grupo_letra: grupoLetra,
            grupo_origen_id: grupoId,
            grupo_origen_letra: grupoLetra,
            puntos: resumen.puntos,
            diferencia_goles: resumen.diferencia_goles,
            goles_favor: resumen.goles_favor,
            goles_contra: resumen.goles_contra,
            partidos_jugados: resumen.partidos_jugados,
            partidos_perdidos: resumen.partidos_perdidos,
            porcentaje_rendimiento: resumen.porcentaje_rendimiento,
            posicion: 0,
            puntaje_fair_play:
              Number(fairPlayMap.get(Number(e.equipo_id))?.puntaje_fair_play || 0),
            fair_play_posicion:
              Number.parseInt(fairPlayMap.get(Number(e.equipo_id))?.posicion, 10) || null,
            tarjetas_amarillas:
              Number.parseInt(fairPlayMap.get(Number(e.equipo_id))?.amarillas, 10) || 0,
            tarjetas_rojas:
              Number.parseInt(fairPlayMap.get(Number(e.equipo_id))?.rojas, 10) || 0,
            faltas_fair_play:
              Number.parseInt(fairPlayMap.get(Number(e.equipo_id))?.faltas, 10) || 0,
            ...(estadosEquipos.get(Number(e.equipo_id)) || {
              no_presentaciones: 0,
              eliminado_automatico: false,
              eliminado_manual: false,
              motivo_eliminacion: null,
              motivo_eliminacion_label: null,
              detalle_eliminacion: null,
            }),
          });
        }

        this.ordenarTablaPorReglas(tabla, reglas);
        tabla.forEach((row, idx) => {
          row.posicion_deportiva = idx + 1;
        });
        tablaDeportiva = [...tabla];
        tablaVisual = [...tabla].sort((a, b) => {
          const aEliminado = estaEliminadoCompetencia(a);
          const bEliminado = estaEliminadoCompetencia(b);
          if (aEliminado !== bEliminado) return aEliminado ? 1 : -1;
          return Number(a.posicion_deportiva || 9999) - Number(b.posicion_deportiva || 9999);
        });
        tablaVisual.forEach((row, idx) => {
          row.posicion = idx + 1;
        });
      }

      const elegiblesRanking = [...tablaDeportiva.filter((row) => !estaEliminadoCompetencia(row))].sort(
        (a, b) => Number(a?.posicion_deportiva || 9999) - Number(b?.posicion_deportiva || 9999)
      );
      const sugeridosLocales = [];
      const clasifLocales = [];
      const usadosLocales = new Set();
      for (let slot = 1; slot <= nClasificados; slot += 1) {
        let sugerido = elegiblesRanking[slot - 1] || null;
        if (sugerido && usadosLocales.has(Number(sugerido.equipo_id))) {
          sugerido = elegiblesRanking.find((row) => !usadosLocales.has(Number(row.equipo_id))) || null;
        }
        if (!sugerido) continue;
        usadosLocales.add(Number(sugerido.equipo_id));
        sugeridosLocales.push({
          slot_posicion: slot,
          equipo_id: Number(sugerido.equipo_id),
          equipo_nombre: sugerido.equipo_nombre,
        });
        clasifLocales.push({
          ...sugerido,
          slot_posicion: slot,
        });
      }
      const candidatosLocales = elegiblesRanking
        .filter(
          (row) =>
            !clasifLocales.some((clasif) => Number(clasif.equipo_id) === Number(row.equipo_id))
        )
        .map((row) => ({
          ...row,
          grupo_origen_id: grupoId,
          grupo_origen_letra: grupoLetra,
        }));

      baseGrupos.push({
        grupo_id: grupoId,
        grupo_letra: grupoLetra,
        tabla: tablaVisual,
        tabla_deportiva: tablaDeportiva,
        elegibles_ranking: elegiblesRanking,
        sugeridos_locales: sugeridosLocales,
        candidatos_locales: candidatosLocales,
      });
    }

    const candidatosGlobales = baseGrupos
      .flatMap((grupo) => grupo.candidatos_locales)
      .sort((a, b) => this.compararCandidatoClasificacion(a, b));

    const clasificados = [];
    const detalleGrupos = [];
    const usadosExternosEvento = new Set();

    for (const grupo of baseGrupos) {
      const manualesGrupo = [];
      const reclasificacionesGrupo = [];
      const sugeridosGrupo = [];
      const clasifGrupo = [];
      const usadosGrupo = new Set();
      const candidatosAdicionales = candidatosGlobales.filter(
        (row) => Number(row.grupo_origen_id) !== Number(grupo.grupo_id)
      );

      for (let slot = 1; slot <= nClasificados; slot += 1) {
        const esperadoTabla = grupo.tabla_deportiva[slot - 1] || null;
        const sugeridoLocal =
          grupo.sugeridos_locales.find((row) => Number(row.slot_posicion) === slot) || null;
        const sugeridoLocalRow = sugeridoLocal
          ? grupo.elegibles_ranking.find(
              (row) => Number(row.equipo_id) === Number(sugeridoLocal.equipo_id)
            ) || null
          : null;
        const sugeridoExterno = !sugeridoLocalRow
          ? candidatosAdicionales.find(
              (row) =>
                !usadosGrupo.has(Number(row.equipo_id)) &&
                !usadosExternosEvento.has(Number(row.equipo_id))
            ) || null
          : null;
        const sugeridoBase = sugeridoLocalRow || sugeridoExterno || null;
        const manual = manualMap.get(construirClaveManual(grupo.grupo_id, slot)) || null;
        const reclasificacion =
          reclasificacionMap.get(construirClaveManual(grupo.grupo_id, slot)) || null;
        const manualCandidato = manual
          ? grupo.elegibles_ranking.find(
              (row) => Number(row.equipo_id) === Number(manual.equipo_id)
            ) ||
            candidatosAdicionales.find((row) => Number(row.equipo_id) === Number(manual.equipo_id)) ||
            null
          : null;
        const ganadorReclasificacion =
          reclasificacion && Number(reclasificacion.ganador_id || 0) > 0
            ? grupo.elegibles_ranking.find(
                (row) => Number(row.equipo_id) === Number(reclasificacion.ganador_id)
              ) ||
              candidatosAdicionales.find(
                (row) => Number(row.equipo_id) === Number(reclasificacion.ganador_id)
              ) ||
              null
            : null;

        let elegido = null;
        let seleccionManual = false;

        if (reclasificacion) {
          reclasificacionesGrupo.push(reclasificacion);
        }

        if (
          ganadorReclasificacion &&
          !estaEliminadoCompetencia(ganadorReclasificacion) &&
          !usadosGrupo.has(Number(ganadorReclasificacion.equipo_id)) &&
          !usadosExternosEvento.has(Number(ganadorReclasificacion.equipo_id))
        ) {
          elegido = ganadorReclasificacion;
          seleccionManual = true;
        } else if (reclasificacion && String(reclasificacion.estado || "pendiente") !== "resuelto") {
          elegido = null;
        } else if (
          manualCandidato &&
          !usadosGrupo.has(Number(manualCandidato.equipo_id)) &&
          (!manualCandidato.grupo_origen_id ||
            Number(manualCandidato.grupo_origen_id) === Number(grupo.grupo_id) ||
            !usadosExternosEvento.has(Number(manualCandidato.equipo_id)))
        ) {
          elegido = manualCandidato;
          seleccionManual = true;
        } else if (
          sugeridoBase &&
          !usadosGrupo.has(Number(sugeridoBase.equipo_id)) &&
          (!sugeridoBase.grupo_origen_id ||
            Number(sugeridoBase.grupo_origen_id) === Number(grupo.grupo_id) ||
            !usadosExternosEvento.has(Number(sugeridoBase.equipo_id)))
        ) {
          elegido = sugeridoBase;
        } else {
          elegido =
            grupo.elegibles_ranking.find((row) => !usadosGrupo.has(Number(row.equipo_id))) ||
            candidatosAdicionales.find(
              (row) =>
                !usadosGrupo.has(Number(row.equipo_id)) &&
                !usadosExternosEvento.has(Number(row.equipo_id))
            ) ||
            null;
        }

        let notaSugerencia = this.construirNotaSugerenciaClasificacion({
          slot,
          esperadoTabla,
          sugerido: sugeridoLocalRow,
        });
        let notaClasificacionFinal = this.construirNotaSugerenciaClasificacion({
          slot,
          esperadoTabla,
          sugerido: elegido,
        });

        if (sugeridoExterno) {
          notaSugerencia = `${sugeridoExterno.equipo_nombre} aparece como mejor no clasificado disponible del evento para cubrir el cupo ${slot} del Grupo ${grupo.grupo_letra}. Criterio: Pts ${Number(
            sugeridoExterno.puntos || 0
          )} | DG ${Number(sugeridoExterno.diferencia_goles || 0)} | GF ${Number(
            sugeridoExterno.goles_favor || 0
          )} | Fair Play ${Number(sugeridoExterno.puntaje_fair_play || 0).toFixed(2)}.`;
        }
        if (
          elegido &&
          Number(elegido.grupo_origen_id || grupo.grupo_id) !== Number(grupo.grupo_id)
        ) {
          notaClasificacionFinal = `${elegido.equipo_nombre} ocupa el cupo ${slot} del Grupo ${grupo.grupo_letra} como mejor no clasificado disponible del evento. Proviene del Grupo ${elegido.grupo_origen_letra}. Criterio: Pts ${Number(
            elegido.puntos || 0
          )} | DG ${Number(elegido.diferencia_goles || 0)} | GF ${Number(
            elegido.goles_favor || 0
          )} | Fair Play ${Number(elegido.puntaje_fair_play || 0).toFixed(2)}.`;
        }

        if (sugeridoBase) {
          sugeridosGrupo.push({
            slot_posicion: slot,
            equipo_id: Number(sugeridoBase.equipo_id),
            equipo_nombre: sugeridoBase.equipo_nombre,
            posicion_tabla: Number(sugeridoBase.posicion || slot),
            nota: notaSugerencia,
            es_candidato_externo:
              Number(sugeridoBase.grupo_origen_id || grupo.grupo_id) !== Number(grupo.grupo_id),
            grupo_origen_letra:
              sugeridoBase.grupo_origen_letra || sugeridoBase.grupo_letra || grupo.grupo_letra,
            reemplaza_equipo_id:
              Number(esperadoTabla?.equipo_id || 0) > 0 &&
              Number(esperadoTabla?.equipo_id || 0) !== Number(sugeridoBase.equipo_id || 0)
                ? Number(esperadoTabla.equipo_id)
                : null,
            reemplaza_equipo_nombre:
              Number(esperadoTabla?.equipo_id || 0) > 0 &&
              Number(esperadoTabla?.equipo_id || 0) !== Number(sugeridoBase.equipo_id || 0)
                ? esperadoTabla.equipo_nombre || null
                : null,
          });
        }

        if (manual) {
          manualesGrupo.push({
            ...manual,
            valido: !!manualCandidato && !estaEliminadoCompetencia(manualCandidato),
            es_candidato_externo:
              Number(manualCandidato?.grupo_origen_id || grupo.grupo_id) !== Number(grupo.grupo_id),
          });
        }

        if (!elegido) continue;
        usadosGrupo.add(Number(elegido.equipo_id));
        if (Number(elegido.grupo_origen_id || grupo.grupo_id) !== Number(grupo.grupo_id)) {
          usadosExternosEvento.add(Number(elegido.equipo_id));
        }
        clasifGrupo.push({
          ...elegido,
          grupo_id: Number(grupo.grupo_id),
          grupo_letra: grupo.grupo_letra,
          slot_posicion: slot,
          seed_ref: `${slot}${grupo.grupo_letra}`,
          seleccion_manual: seleccionManual,
          seleccion_externa:
            Number(elegido.grupo_origen_id || grupo.grupo_id) !== Number(grupo.grupo_id),
          sugerido_equipo_id: sugeridoBase ? Number(sugeridoBase.equipo_id) : null,
          sugerido_equipo_nombre: sugeridoBase?.equipo_nombre || null,
          nota_clasificacion: notaClasificacionFinal,
          reemplaza_equipo_id:
            Number(esperadoTabla?.equipo_id || 0) > 0 &&
            Number(esperadoTabla?.equipo_id || 0) !== Number(elegido.equipo_id || 0)
              ? Number(esperadoTabla.equipo_id)
              : null,
          reemplaza_equipo_nombre:
            Number(esperadoTabla?.equipo_id || 0) > 0 &&
            Number(esperadoTabla?.equipo_id || 0) !== Number(elegido.equipo_id || 0)
              ? esperadoTabla.equipo_nombre || null
              : null,
        });
      }

      clasificados.push(...clasifGrupo);
      detalleGrupos.push({
        grupo_id: Number(grupo.grupo_id),
        grupo_letra: grupo.grupo_letra,
        cupos: nClasificados,
        clasificados: clasifGrupo,
        clasificados_sugeridos: sugeridosGrupo,
        clasificados_manuales: manualesGrupo,
        reclasificaciones: reclasificacionesGrupo,
        candidatos_adicionales: candidatosAdicionales,
        incompleto: clasifGrupo.length < nClasificados,
        tabla: grupo.tabla,
      });
    }

    return {
      evento,
      reglas_desempate: reglas,
      clasificados_por_grupo: nClasificados,
      clasificados_manuales: await obtenerClasificadosManualesEvento(evento_id, db),
      reclasificaciones: await this.obtenerReclasificacionesEvento(evento_id, db),
      grupos: detalleGrupos,
      clasificados,
    };
  }

  static async obtenerResumenClasificacionManual(
    evento_id,
    clasificados_por_grupo = null,
    db = pool
  ) {
    await this.asegurarEsquema(db);
    const evento = await this.obtenerEventoConfig(evento_id, db);
    if (!evento) throw new Error("Evento no encontrado");
    const cupos =
      Math.max(
        1,
        Number.parseInt(
          clasificados_por_grupo ?? evento.clasificados_por_grupo ?? 2,
          10
        ) || 1
      );
    const data = await this.obtenerClasificadosPorGrupo(evento_id, cupos, db);
    return {
      evento: {
        id: Number(evento.id),
        nombre: evento.nombre,
        campeonato_id: Number(evento.campeonato_id),
      },
      clasificados_por_grupo: cupos,
      grupos: data.grupos.map((grupo) => ({
        grupo_id: Number(grupo.grupo_id),
        grupo_letra: grupo.grupo_letra,
        cupos: Number(grupo.cupos || cupos),
        incompleto: grupo.incompleto === true,
        tabla: grupo.tabla,
        sugeridos: grupo.clasificados_sugeridos || [],
        manuales: grupo.clasificados_manuales || [],
        reclasificaciones: grupo.reclasificaciones || [],
        clasificados_finales: grupo.clasificados || [],
        candidatos_adicionales: grupo.candidatos_adicionales || [],
      })),
      reclasificaciones: data.reclasificaciones || [],
    };
  }

  static async guardarClasificadosManuales(evento_id, payload = {}, userId = null) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await this.asegurarEsquema(client);

      const resumen = await this.obtenerResumenClasificacionManual(
        evento_id,
        payload?.clasificados_por_grupo,
        client
      );
      const cupos = Number.parseInt(resumen?.clasificados_por_grupo, 10) || 1;
      const gruposPayload = Array.isArray(payload?.grupos) ? payload.grupos : [];
      const usadosEvento = new Map();
      const reservadosEvento = new Set();
      const reclasificacionesPrevias = await this.obtenerMapaReclasificacionesEvento(evento_id, client);

      await client.query(`DELETE FROM evento_clasificados_manuales WHERE evento_id = $1`, [
        evento_id,
      ]);
      await client.query(`DELETE FROM evento_reclasificaciones_playoff WHERE evento_id = $1`, [
        evento_id,
      ]);

      for (const grupoResumen of resumen.grupos) {
        const grupoPayload =
          gruposPayload.find((item) => Number(item?.grupo_id) === Number(grupoResumen.grupo_id)) ||
          null;
        const selecciones = Array.isArray(grupoPayload?.selecciones)
          ? grupoPayload.selecciones
          : [];
        const elegibles = (grupoResumen.tabla || []).filter(
          (row) => !estaEliminadoCompetencia(row)
        );
        const candidatosAdicionales = Array.isArray(grupoResumen.candidatos_adicionales)
          ? grupoResumen.candidatos_adicionales
          : [];
        const candidatosElegibles = new Map();
        [...elegibles, ...candidatosAdicionales].forEach((row) => {
          const equipoId = Number.parseInt(row?.equipo_id, 10);
          if (Number.isFinite(equipoId) && equipoId > 0) {
            candidatosElegibles.set(equipoId, row);
          }
        });
        const sugeridosPorSlot = new Map(
          (Array.isArray(grupoResumen.sugeridos) ? grupoResumen.sugeridos : []).map((item) => [
            Number(item.slot_posicion),
            item,
          ])
        );
        const elegiblesLocales = (Array.isArray(grupoResumen.tabla) ? grupoResumen.tabla : []).filter(
          (row) => !estaEliminadoCompetencia(row)
        );
        const usados = new Set();
        const slotsInsert = [];

        for (let slot = 1; slot <= cupos; slot += 1) {
          const seleccion =
            selecciones.find((item) => Number(item?.slot_posicion) === Number(slot)) || null;
          const criterio =
            String(seleccion?.criterio || "decision_organizador").trim() || "decision_organizador";
          const detalle = String(seleccion?.detalle || "").trim() || null;
          const sugeridoBase = sugeridosPorSlot.get(slot) || elegibles[slot - 1] || null;
          const equipoId = Number.parseInt(seleccion?.equipo_id, 10);
          const cupoVacanteExterno = slot > elegiblesLocales.length;
          const claveSlot = construirClaveManual(grupoResumen.grupo_id, slot);
          const candidatosReclasificacion = candidatosAdicionales.filter((row) => {
            const candidatoId = Number(row?.equipo_id || 0);
            return (
              candidatoId > 0 &&
              !usados.has(candidatoId) &&
              !usadosEvento.has(candidatoId) &&
              !reservadosEvento.has(candidatoId)
            );
          });

          if (
            criterio === "partido_extra_reclasificacion" &&
            cupoVacanteExterno &&
            candidatosReclasificacion.length >= 2
          ) {
            const [equipoA, equipoB] = candidatosReclasificacion;
            const previa = reclasificacionesPrevias.get(claveSlot) || null;
            const ganadorPrevio = Number.parseInt(previa?.ganador_id, 10);
            const candidatosIds = new Set([
              Number(equipoA.equipo_id),
              Number(equipoB.equipo_id),
            ]);
            const ganadorValido = candidatosIds.has(ganadorPrevio) ? ganadorPrevio : null;

            await client.query(
              `
                INSERT INTO evento_reclasificaciones_playoff (
                  evento_id,
                  grupo_id,
                  slot_posicion,
                  equipo_a_id,
                  equipo_b_id,
                  ganador_id,
                  estado,
                  detalle,
                  usuario_id,
                  updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
              `,
              [
                evento_id,
                grupoResumen.grupo_id,
                slot,
                Number(equipoA.equipo_id),
                Number(equipoB.equipo_id),
                ganadorValido,
                ganadorValido ? "resuelto" : "pendiente",
                detalle,
                Number.isFinite(Number(userId)) ? Number(userId) : null,
              ]
            );

            reservadosEvento.add(Number(equipoA.equipo_id));
            reservadosEvento.add(Number(equipoB.equipo_id));
            if (ganadorValido) {
              usados.add(ganadorValido);
              usadosEvento.set(ganadorValido, {
                grupo_id: Number(grupoResumen.grupo_id),
                grupo_letra: grupoResumen.grupo_letra,
                slot,
              });
            }
            continue;
          }

          if (Number.isFinite(equipoId) && equipoId > 0) {
            const candidato = candidatosElegibles.get(equipoId) || null;
            if (!candidato) {
              throw new Error(
                `El equipo seleccionado para Grupo ${grupoResumen.grupo_letra} / cupo ${slot} no es elegible.`
              );
            }
            if (usados.has(equipoId)) {
              throw new Error(
                `El equipo ${candidato.equipo_nombre} está repetido en la selección final del Grupo ${grupoResumen.grupo_letra}.`
              );
            }
            if (usadosEvento.has(equipoId)) {
              const previo = usadosEvento.get(equipoId);
              throw new Error(
                `El equipo ${candidato.equipo_nombre} ya fue seleccionado manualmente para el Grupo ${previo.grupo_letra} / cupo ${previo.slot}.`
              );
            }
            usados.add(equipoId);
            usadosEvento.set(equipoId, {
              grupo_id: Number(grupoResumen.grupo_id),
              grupo_letra: grupoResumen.grupo_letra,
              slot,
            });
            slotsInsert.push({
              slot,
              equipo_id: equipoId,
              criterio,
              detalle,
            });
            continue;
          }

          const sugeridoId = Number(sugeridoBase?.equipo_id || 0);
          if (Number.isFinite(sugeridoId) && sugeridoId > 0 && !usados.has(sugeridoId)) {
            usados.add(sugeridoId);
            continue;
          }

          const fallback =
            elegibles.find((row) => !usados.has(Number(row.equipo_id))) ||
            candidatosAdicionales.find((row) => !usados.has(Number(row.equipo_id))) ||
            null;
          if (fallback) {
            usados.add(Number(fallback.equipo_id));
          }
        }

        for (const slotManual of slotsInsert) {
          await client.query(
            `
              INSERT INTO evento_clasificados_manuales (
                evento_id,
                grupo_id,
                slot_posicion,
                equipo_id,
                criterio,
                detalle,
                usuario_id,
                updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            `,
            [
              evento_id,
              grupoResumen.grupo_id,
              slotManual.slot,
              slotManual.equipo_id,
              slotManual.criterio,
              slotManual.detalle,
              Number.isFinite(Number(userId)) ? Number(userId) : null,
            ]
          );
        }
      }

      const actualizado = await this.obtenerResumenClasificacionManual(
        evento_id,
        cupos,
        client
      );

      await client.query("COMMIT");
      return actualizado;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static construirSembradoCrucesGrupos(clasificadosData, crucesGrupos = []) {
    const mapGrupo = new Map();
    for (const g of clasificadosData.grupos) {
      mapGrupo.set(String(g.grupo_letra || "").toUpperCase(), g.clasificados || []);
    }

    const sembrados = [];
    for (const [ga, gb] of crucesGrupos) {
      const A = mapGrupo.get(String(ga).toUpperCase()) || [];
      const B = mapGrupo.get(String(gb).toUpperCase()) || [];
      const n = Math.max(A.length, B.length);
      for (let i = 0; i < n; i++) {
        const local = A[i] || null;
        const visita = B[n - 1 - i] || null;
        sembrados.push({
          equipo_id: local ? Number(local.equipo_id) : null,
          seed_ref: local?.seed_ref || null,
        });
        sembrados.push({
          equipo_id: visita ? Number(visita.equipo_id) : null,
          seed_ref: visita?.seed_ref || null,
        });
      }
    }
    return sembrados;
  }

  static seleccionarClasificadosTablaAcumulada(
    clasificadosData,
    cantidadObjetivo = null,
    contextoComparacion = {}
  ) {
    const base = [];
    const usados = new Set();

    for (const row of clasificadosData?.clasificados || []) {
      const equipoId = Number.parseInt(row?.equipo_id, 10);
      if (!Number.isFinite(equipoId) || usados.has(equipoId)) continue;
      usados.add(equipoId);
      base.push({
        ...row,
        clasificacion_extra: false,
      });
    }

    const objetivo = Number.parseInt(cantidadObjetivo, 10);
    if (!Number.isFinite(objetivo) || objetivo <= base.length) {
      return {
        clasificados: base,
        adicionales: [],
        objetivo: Number.isFinite(objetivo) ? objetivo : null,
        faltantes_para_objetivo: 0,
      };
    }

    const candidatos = [];
    for (const grupo of clasificadosData?.grupos || []) {
      for (const row of grupo?.tabla || []) {
        const equipoId = Number.parseInt(row?.equipo_id, 10);
        if (!Number.isFinite(equipoId) || usados.has(equipoId) || estaEliminadoCompetencia(row)) continue;
        candidatos.push({
          ...row,
          grupo_id: Number.parseInt(row?.grupo_id ?? grupo?.grupo_id, 10) || null,
          grupo_letra: row?.grupo_letra || grupo?.grupo_letra || null,
          grupo_origen_id: Number.parseInt(row?.grupo_origen_id ?? row?.grupo_id ?? grupo?.grupo_id, 10) || null,
          grupo_origen_letra:
            row?.grupo_origen_letra || row?.grupo_letra || grupo?.grupo_letra || null,
          slot_posicion: null,
          seed_ref: null,
          clasificacion_extra: true,
        });
      }
    }

    candidatos.sort((a, b) => this.compararTablaAcumulada(a, b, contextoComparacion));

    const adicionales = [];
    const faltantes = objetivo - base.length;
    for (const candidato of candidatos) {
      const equipoId = Number.parseInt(candidato?.equipo_id, 10);
      if (!Number.isFinite(equipoId) || usados.has(equipoId)) continue;
      usados.add(equipoId);
      adicionales.push(candidato);
      if (adicionales.length >= faltantes) break;
    }

    return {
      clasificados: [...base, ...adicionales],
      adicionales,
      objetivo,
      faltantes_para_objetivo: Math.max(0, objetivo - (base.length + adicionales.length)),
    };
  }

  static construirSembradoTablaUnica(clasificadosData, opciones = {}) {
    const seleccion = this.seleccionarClasificadosTablaAcumulada(
      clasificadosData,
      opciones?.cantidad_objetivo,
      opciones
    );
    const ranking = [...(seleccion.clasificados || [])].sort((a, b) =>
      this.compararTablaAcumulada(a, b, opciones)
    );

    ranking.forEach((r, idx) => {
      r.posicion_general = idx + 1;
      r.seed_ref = `G${idx + 1}`;
    });

    const sembrados = [];
    let i = 0;
    let j = ranking.length - 1;
    while (i <= j) {
      const high = ranking[i] || null;
      const low = i === j ? null : ranking[j] || null;
      sembrados.push({
        equipo_id: high ? Number(high.equipo_id) : null,
        seed_ref: high?.seed_ref || null,
      });
      sembrados.push({
        equipo_id: low ? Number(low.equipo_id) : null,
        seed_ref: low?.seed_ref || null,
      });
      i += 1;
      j -= 1;
    }

    return {
      ranking,
      sembrados,
      adicionales: seleccion.adicionales || [],
      objetivo: seleccion.objetivo,
      faltantes_para_objetivo: seleccion.faltantes_para_objetivo || 0,
    };
  }

  static agruparPartidosPorRonda(partidos = []) {
    const rondasMap = new Map();
    for (const partido of Array.isArray(partidos) ? partidos : []) {
      const ronda = String(partido?.ronda || "sin_ronda");
      if (!rondasMap.has(ronda)) {
        rondasMap.set(ronda, { ronda, partidos: [] });
      }
      rondasMap.get(ronda).partidos.push(partido);
    }
    return Array.from(rondasMap.values());
  }

  static obtenerPrimeraRondaPartidos(partidos = []) {
    const rows = Array.isArray(partidos) ? partidos : [];
    if (!rows.length) return [];
    const rondaActual =
      RONDAS_ORDEN.find((ronda) => rows.some((partido) => String(partido?.ronda || "") === ronda)) ||
      String(rows[0]?.ronda || "sin_ronda");
    return rows
      .filter((partido) => String(partido?.ronda || "sin_ronda") === rondaActual)
      .sort((a, b) => Number(a?.partido_numero || 0) - Number(b?.partido_numero || 0));
  }

  static normalizarEntradasSembrado(entradas = []) {
    return (Array.isArray(entradas) ? entradas : []).map((entry) => ({
      equipo_id: Number.isFinite(Number(entry?.equipo_id)) ? Number(entry.equipo_id) : null,
      seed_ref: entry?.seed_ref || null,
    }));
  }

  static construirDiagnosticoInconsistenciaBracket({
    partidos = [],
    esperado = [],
    config = null,
    mensajeBase = "La llave publicada ya no coincide con la clasificación vigente.",
  } = {}) {
    const primeraRonda = this.obtenerPrimeraRondaPartidos(partidos);
    const actuales = primeraRonda.flatMap((partido) => [
      {
        equipo_id: Number.isFinite(Number(partido?.equipo_local_id)) ? Number(partido.equipo_local_id) : null,
        equipo_nombre: partido?.equipo_local_nombre || "Por definir",
        seed_ref: partido?.seed_local_ref || null,
      },
      {
        equipo_id: Number.isFinite(Number(partido?.equipo_visitante_id)) ? Number(partido.equipo_visitante_id) : null,
        equipo_nombre: partido?.equipo_visitante_nombre || "Por definir",
        seed_ref: partido?.seed_visitante_ref || null,
      },
    ]);
    const esperados = this.normalizarEntradasSembrado(esperado);
    const actualesIds = actuales
      .map((row) => (Number.isFinite(row?.equipo_id) ? Number(row.equipo_id) : null))
      .filter((id) => Number.isFinite(id));
    const esperadosIds = esperados
      .map((row) => (Number.isFinite(row?.equipo_id) ? Number(row.equipo_id) : null))
      .filter((id) => Number.isFinite(id));

    const fueraDeClasificacion = actuales
      .filter((row) => Number.isFinite(row?.equipo_id) && !esperadosIds.includes(Number(row.equipo_id)))
      .map((row) => row?.equipo_nombre || `Equipo ${row?.equipo_id}`);
    const faltantes = esperados
      .filter((row) => Number.isFinite(row?.equipo_id) && !actualesIds.includes(Number(row.equipo_id)))
      .map((row) => row?.equipo_id);

    const ordenActual = actuales.map((row) => row?.equipo_id ?? null);
    const ordenEsperado = esperados.slice(0, ordenActual.length).map((row) => row?.equipo_id ?? null);
    const ordenDistinto =
      ordenActual.length !== ordenEsperado.length ||
      ordenActual.some((value, index) => Number(value ?? -1) !== Number(ordenEsperado[index] ?? -1));

    const inconsistente = fueraDeClasificacion.length > 0 || faltantes.length > 0 || ordenDistinto;
    if (!inconsistente) {
      return {
        consistente: true,
        codigo: "ok",
        mensaje: null,
        detalle: null,
      };
    }

    let detalle = "Regenera el playoff para reflejar la clasificación vigente.";
    if (fueraDeClasificacion.length) {
      detalle = `Equipos fuera de clasificación detectados: ${fueraDeClasificacion.join(", ")}. Regenera el playoff.`;
    } else if (faltantes.length) {
      detalle = "La llave publicada no incluye todos los clasificados vigentes. Regenera el playoff.";
    } else if (ordenDistinto) {
      detalle = "La llave publicada ya no respeta el orden de clasificación vigente. Regenera el playoff.";
    }

    return {
      consistente: false,
      codigo: "bracket_desactualizado",
      mensaje: mensajeBase,
      detalle,
      fuera_de_clasificacion: fueraDeClasificacion,
      faltantes,
      configuracion: config?.configuracion || null,
    };
  }

  static async obtenerDiagnosticoBracketActual(evento_id, db = pool) {
    await this.asegurarEsquema(db);
    const partidos = await this.obtenerPorEvento(evento_id, db);
    if (!partidos.length) {
      return {
        consistente: true,
        codigo: "sin_llave",
        mensaje: null,
        detalle: null,
        partidos: [],
        rondas: [],
      };
    }

    const config = await this.obtenerConfiguracionPlayoff(evento_id, db);
    const origen = String(config?.configuracion?.origen || "evento").toLowerCase();
    if (origen !== "grupos") {
      return {
        consistente: true,
        codigo: "origen_evento",
        mensaje: null,
        detalle: null,
        partidos,
        rondas: this.agruparPartidosPorRonda(partidos),
        configuracion: config?.configuracion || null,
      };
    }

    const clasificadosPorGrupo = Math.max(
      1,
      Number.parseInt(config?.evento?.clasificados_por_grupo, 10) || 1
    );
    const clasificadosData = await this.obtenerClasificadosPorGrupo(evento_id, clasificadosPorGrupo, db);
    const reclasPendientes = Array.isArray(clasificadosData?.reclasificaciones)
      ? clasificadosData.reclasificaciones.filter(
          (row) => String(row?.estado || "pendiente").toLowerCase() !== "resuelto"
        )
      : [];

    if (reclasPendientes.length) {
      return {
        consistente: false,
        codigo: "reclasificacion_pendiente",
        mensaje: "Hay cupos playoff pendientes de reclasificación.",
        detalle:
          "Resuelve la reclasificación entre los mejores equipos aún en competencia antes de publicar la llave.",
        partidos,
        rondas: [],
        configuracion: config?.configuracion || null,
        reclasificaciones: reclasPendientes,
      };
    }

    const metodo = String(config?.configuracion?.metodo_clasificacion || "cruces_grupos").toLowerCase();
    const primeraRonda = this.obtenerPrimeraRondaPartidos(partidos);
    const capacidadPrimeraRonda = primeraRonda.length > 0 ? primeraRonda.length * 2 : null;
    const cantidadObjetivo =
      Number.parseInt(config?.evento?.eliminatoria_equipos, 10) || capacidadPrimeraRonda || null;

    let esperado = [];
    if (metodo === "tabla_unica") {
      const enfrentamientosDirectos = await this.obtenerMapaEnfrentamientosDirectosEvento(
        evento_id,
        config?.evento?.sistema_puntuacion || "tradicional",
        db
      );
      const tabla = this.construirSembradoTablaUnica(clasificadosData, {
        cantidad_objetivo: cantidadObjetivo,
        enfrentamientosDirectos,
      });
      if (Number(tabla?.faltantes_para_objetivo || 0) > 0) {
        return {
          consistente: false,
          codigo: "cupos_incompletos",
          mensaje: "La clasificación vigente todavía no completa todos los cupos playoff.",
          detalle:
            "Debes completar la vacante con reclasificación o ajustar la llave antes de publicarla.",
          partidos,
          rondas: [],
          configuracion: config?.configuracion || null,
        };
      }
      esperado = tabla.sembrados || [];
    } else {
      esperado = this.construirSembradoCrucesGrupos(
        clasificadosData,
        config?.configuracion?.cruces_grupos || []
      );
    }

    const esperadosNormalizados = this.normalizarEntradasSembrado(esperado).slice(
      0,
      capacidadPrimeraRonda || undefined
    );
    const hayVacantesVigentes =
      esperadosNormalizados.length > 0 &&
      esperadosNormalizados.some((entry) => !Number.isFinite(Number(entry?.equipo_id)));
    if (hayVacantesVigentes) {
      return {
        consistente: false,
        codigo: "cupos_incompletos",
        mensaje: "La clasificación vigente todavía no completa todos los cupos playoff.",
        detalle:
          "Hay una vacante playoff pendiente. Completa la reclasificación o ajusta la clasificación antes de publicar la llave.",
        partidos,
        rondas: [],
        configuracion: config?.configuracion || null,
      };
    }

    const diagnostico = this.construirDiagnosticoInconsistenciaBracket({
      partidos,
      esperado: esperadosNormalizados,
      config,
    });
    return {
      ...diagnostico,
      partidos,
      rondas: diagnostico?.consistente ? this.agruparPartidosPorRonda(partidos) : [],
    };
  }

  static async crearSlot(
    evento_id,
    ronda,
    partido_numero,
    equipo_local_id,
    equipo_visitante_id,
    slot_local_id,
    slot_visitante_id,
    db = pool
  ) {
    const q = `
      INSERT INTO partidos_eliminatoria
        (evento_id, ronda, partido_numero, equipo_local_id, equipo_visitante_id, slot_local_id, slot_visitante_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const r = await db.query(q, [
      evento_id,
      ronda,
      partido_numero,
      equipo_local_id ?? null,
      equipo_visitante_id ?? null,
      slot_local_id ?? null,
      slot_visitante_id ?? null,
    ]);
    return r.rows[0];
  }

  static async obtenerSlotPorId(id, db = pool) {
    await this.asegurarEsquema(db);
    const r = await db.query(`SELECT * FROM partidos_eliminatoria WHERE id = $1 LIMIT 1`, [id]);
    return r.rows[0] || null;
  }

  static async obtenerPorEvento(evento_id, db = pool) {
    await this.asegurarEsquema(db);
    const q = `
      SELECT pe.*,
             el.nombre AS equipo_local_nombre, ev.nombre AS equipo_visitante_nombre,
             g.nombre AS ganador_nombre,
             el.logo_url AS equipo_local_logo, ev.logo_url AS equipo_visitante_logo
      FROM partidos_eliminatoria pe
      LEFT JOIN equipos el ON pe.equipo_local_id = el.id
      LEFT JOIN equipos ev ON pe.equipo_visitante_id = ev.id
      LEFT JOIN equipos g ON pe.ganador_id = g.id
      WHERE pe.evento_id = $1
      ORDER BY
        array_position($2::varchar[], pe.ronda),
        pe.partido_numero
    `;
    const r = await db.query(q, [evento_id, RONDAS_ORDEN]);
    return r.rows;
  }

  static async obtenerPorRonda(evento_id, ronda, db = pool) {
    await this.asegurarEsquema(db);
    const q = `
      SELECT pe.*,
             el.nombre AS equipo_local_nombre, ev.nombre AS equipo_visitante_nombre,
             g.nombre AS ganador_nombre
      FROM partidos_eliminatoria pe
      LEFT JOIN equipos el ON pe.equipo_local_id = el.id
      LEFT JOIN equipos ev ON pe.equipo_visitante_id = ev.id
      LEFT JOIN equipos g ON pe.ganador_id = g.id
      WHERE pe.evento_id = $1 AND pe.ronda = $2
      ORDER BY pe.partido_numero
    `;
    const r = await db.query(q, [evento_id, ronda]);
    return r.rows;
  }

  static async propagarGanador(slotId, ganadorId, db = pool) {
    if (!Number.isFinite(Number(slotId)) || !Number.isFinite(Number(ganadorId))) return;

    const siguienteR = await db.query(
      `
      SELECT *
      FROM partidos_eliminatoria
      WHERE slot_local_id = $1 OR slot_visitante_id = $1
      ORDER BY id ASC
      LIMIT 1
    `,
      [slotId]
    );
    const siguiente = siguienteR.rows[0];
    if (!siguiente) return;

    if (Number(siguiente.slot_local_id) === Number(slotId)) {
      await db.query(
        `
        UPDATE partidos_eliminatoria
        SET equipo_local_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `,
        [ganadorId, siguiente.id]
      );
    } else if (Number(siguiente.slot_visitante_id) === Number(slotId)) {
      await db.query(
        `
        UPDATE partidos_eliminatoria
        SET equipo_visitante_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `,
        [ganadorId, siguiente.id]
      );
    }

    await this.intentarResolverByeEnSlot(siguiente.id, db);
  }

  static async intentarResolverByeEnSlot(slotId, db = pool) {
    const slot = await this.obtenerSlotPorId(slotId, db);
    if (!slot || slot.ganador_id) return;

    const localId = Number.parseInt(slot.equipo_local_id, 10);
    const visitanteId = Number.parseInt(slot.equipo_visitante_id, 10);
    const tieneLocal = Number.isFinite(localId);
    const tieneVisitante = Number.isFinite(visitanteId);

    if (!tieneLocal && !tieneVisitante) return;
    if (tieneLocal && tieneVisitante) return;

    const ladoVacio = tieneLocal ? "visitante" : "local";
    const slotPrevioId =
      ladoVacio === "local"
        ? Number.parseInt(slot.slot_local_id, 10)
        : Number.parseInt(slot.slot_visitante_id, 10);

    if (Number.isFinite(slotPrevioId)) {
      const slotPrevio = await this.obtenerSlotPorId(slotPrevioId, db);
      if (slotPrevio && !slotPrevio.ganador_id) return;
    }

    const ganadorId = tieneLocal ? localId : visitanteId;
    const resultadoLocal = tieneLocal ? 1 : 0;
    const resultadoVisitante = tieneLocal ? 0 : 1;

    await db.query(
      `
      UPDATE partidos_eliminatoria
      SET ganador_id = $1,
          resultado_local = $2,
          resultado_visitante = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `,
      [ganadorId, resultadoLocal, resultadoVisitante, slot.id]
    );

    await this.propagarGanador(slot.id, ganadorId, db);
  }

  static async actualizarResultado(id, resultado_local, resultado_visitante, ganador_id) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await this.asegurarEsquema(client);

      const slotActual = await this.obtenerSlotPorId(id, client);
      if (!slotActual) {
        await client.query("ROLLBACK");
        return null;
      }

      const rl = Number.parseInt(resultado_local, 10);
      const rv = Number.parseInt(resultado_visitante, 10);
      if (!Number.isFinite(rl) || !Number.isFinite(rv) || rl < 0 || rv < 0) {
        throw new Error("resultado_local y resultado_visitante deben ser enteros >= 0");
      }

      let ganador = Number.parseInt(ganador_id, 10);
      if (!Number.isFinite(ganador)) {
        if (rl > rv) ganador = Number(slotActual.equipo_local_id) || null;
        else if (rv > rl) ganador = Number(slotActual.equipo_visitante_id) || null;
      }

      if (!Number.isFinite(ganador)) {
        throw new Error("No se pudo determinar ganador. En eliminatoria no se permite empate.");
      }

      const q = `
        UPDATE partidos_eliminatoria
        SET resultado_local = $1,
            resultado_visitante = $2,
            ganador_id = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `;
      const r = await client.query(q, [rl, rv, ganador, id]);
      const actualizado = r.rows[0] || null;

      if (actualizado) {
        await this.propagarGanador(actualizado.id, ganador, client);
      }

      await client.query("COMMIT");
      return actualizado;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async asignarEquipos(id, equipo_local_id, equipo_visitante_id) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await this.asegurarEsquema(client);
      const q = `
        UPDATE partidos_eliminatoria
        SET equipo_local_id = $1,
            equipo_visitante_id = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;
      const r = await client.query(q, [
        equipo_local_id ? Number(equipo_local_id) : null,
        equipo_visitante_id ? Number(equipo_visitante_id) : null,
        id,
      ]);
      const slot = r.rows[0] || null;
      if (slot) {
        await this.intentarResolverByeEnSlot(slot.id, client);
      }
      await client.query("COMMIT");
      return slot;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async resolverReclasificacion(evento_id, reclasificacionId, ganador_id, detalle = null, userId = null) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await this.asegurarEsquema(client);

      const r = await client.query(
        `
          SELECT *
          FROM evento_reclasificaciones_playoff
          WHERE id = $1 AND evento_id = $2
          LIMIT 1
        `,
        [reclasificacionId, evento_id]
      );
      const actual = r.rows[0] || null;
      if (!actual) throw new Error("Reclasificación no encontrada.");

      const ganadorId = Number.parseInt(ganador_id, 10);
      const equipoA = Number.parseInt(actual.equipo_a_id, 10);
      const equipoB = Number.parseInt(actual.equipo_b_id, 10);
      if (![equipoA, equipoB].includes(ganadorId)) {
        throw new Error("El ganador debe ser uno de los equipos del partido extra.");
      }

      await client.query(
        `
          UPDATE evento_reclasificaciones_playoff
          SET ganador_id = $1,
              estado = 'resuelto',
              detalle = $2,
              usuario_id = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `,
        [
          ganadorId,
          String(detalle || "").trim() || actual.detalle || null,
          Number.isFinite(Number(userId)) ? Number(userId) : null,
          reclasificacionId,
        ]
      );

      await client.query("COMMIT");
      return this.obtenerResumenClasificacionManual(evento_id, null, pool);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async generarBracketConSembrado(
    evento_id,
    entradasSembrado = [],
    opciones = {},
    db = pool
  ) {
    await this.asegurarEsquema(db);
    const cantidadSolicitada = opciones?.cantidad_equipos ?? null;
    const mezclar = opciones?.mezclar === true;

    let sembrados = Array.isArray(entradasSembrado) ? [...entradasSembrado] : [];
    if (!sembrados.length) {
      throw new Error("No hay equipos para generar la llave");
    }

    if (mezclar) sembrados = this.mezclarArray(sembrados);

    const equiposValidos = sembrados.filter((x) => Number.isFinite(Number(x?.equipo_id)));
    if (equiposValidos.length < 2) {
      throw new Error("Se necesitan al menos 2 equipos para generar eliminatoria");
    }

    const totalEquiposBracket = this.calcularTamanoBracket(cantidadSolicitada, equiposValidos.length);
    const rondas = RONDAS_POR_EQUIPOS[totalEquiposBracket];
    if (!rondas?.length) {
      throw new Error("No se pudo determinar rondas para el bracket");
    }

    await db.query("DELETE FROM partidos_eliminatoria WHERE evento_id = $1", [evento_id]);

    let slotsAnteriores = [];
    const slotsPrimeraRonda = [];

    for (let r = 0; r < rondas.length; r++) {
      const ronda = rondas[r];
      const partidosEnRonda = totalEquiposBracket / Math.pow(2, r + 1);
      const slotsRonda = [];

      for (let p = 0; p < partidosEnRonda; p++) {
        let slotLocal = null;
        let slotVisit = null;
        if (r > 0 && slotsAnteriores.length >= p * 2 + 2) {
          slotLocal = slotsAnteriores[p * 2].id;
          slotVisit = slotsAnteriores[p * 2 + 1].id;
        }

        const slot = await this.crearSlot(
          evento_id,
          ronda,
          p + 1,
          null,
          null,
          slotLocal,
          slotVisit,
          db
        );

        slotsRonda.push(slot);
        if (r === 0) slotsPrimeraRonda.push(slot);
      }

      slotsAnteriores = slotsRonda;
    }

    while (sembrados.length < totalEquiposBracket) {
      sembrados.push({ equipo_id: null, seed_ref: null });
    }
    if (sembrados.length > totalEquiposBracket) {
      sembrados = sembrados.slice(0, totalEquiposBracket);
    }

    for (let i = 0; i < slotsPrimeraRonda.length; i++) {
      const local = sembrados[i * 2] || { equipo_id: null, seed_ref: null };
      const visitante = sembrados[i * 2 + 1] || { equipo_id: null, seed_ref: null };

      await db.query(
        `
          UPDATE partidos_eliminatoria
          SET equipo_local_id = $1,
              equipo_visitante_id = $2,
              seed_local_ref = $3,
              seed_visitante_ref = $4,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
        `,
        [
          local.equipo_id ? Number(local.equipo_id) : null,
          visitante.equipo_id ? Number(visitante.equipo_id) : null,
          local.seed_ref || null,
          visitante.seed_ref || null,
          slotsPrimeraRonda[i].id,
        ]
      );

      await this.intentarResolverByeEnSlot(slotsPrimeraRonda[i].id, db);
    }

    return this.obtenerPorEvento(evento_id, db);
  }

  /**
   * Genera estructura eliminatoria con equipos inscritos al evento.
   * Modo directo: aleatorio.
   */
  static async generarBracket(evento_id, cantidad_equipos = null) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await this.asegurarEsquema(client);

      const equiposEvento = await this.obtenerEquiposEvento(evento_id, client);
      if (equiposEvento.length < 2) {
        throw new Error("Se necesitan al menos 2 equipos inscritos en la categoría");
      }

      const entradas = equiposEvento.map((id) => ({ equipo_id: Number(id), seed_ref: null }));
      const bracket = await this.generarBracketConSembrado(
        evento_id,
        entradas,
        { cantidad_equipos, mezclar: true },
        client
      );

      await client.query("COMMIT");
      return bracket;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Genera playoff desde fase de grupos.
   * opciones:
   * - clasificados_por_grupo
   * - metodo_clasificacion: "cruces_grupos" | "tabla_unica"
   * - cruces_grupos: [["A","C"],["B","D"]]
   */
  static async generarBracketDesdeGrupos(evento_id, opciones = {}) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await this.asegurarEsquema(client);

      const evento = await this.obtenerEventoConfig(evento_id, client);
      if (!evento) throw new Error("Evento no encontrado");

      const clasificadosPorGrupo = Math.max(
        1,
        Number.parseInt(opciones.clasificados_por_grupo, 10) || 1
      );
      const metodo = String(opciones.metodo_clasificacion || "cruces_grupos").toLowerCase();

      const clasificadosData = await this.obtenerClasificadosPorGrupo(
        evento_id,
        clasificadosPorGrupo,
        client
      );
      const reclasPendientes = Array.isArray(clasificadosData?.reclasificaciones)
        ? clasificadosData.reclasificaciones.filter(
            (row) => String(row?.estado || "pendiente").toLowerCase() !== "resuelto"
          )
        : [];
      if (reclasPendientes.length) {
        throw new Error(
          `Existe ${reclasPendientes.length === 1 ? "una reclasificación pendiente" : `${reclasPendientes.length} reclasificaciones pendientes`} para completar los cupos playoff. Registra el ganador antes de generar la llave.`
        );
      }
      const enfrentamientosDirectos = await this.obtenerMapaEnfrentamientosDirectosEvento(
        evento_id,
        evento.sistema_puntuacion || "tradicional",
        client
      );

      const gruposLetras = clasificadosData.grupos.map((g) => String(g.grupo_letra || "").toUpperCase());

      let entradas = [];
      let meta = {
        origen: "grupos",
        metodo_clasificacion: metodo,
        clasificados_por_grupo: clasificadosPorGrupo,
      };

      if (metodo === "tabla_unica") {
        const cantidadObjetivo = Number.parseInt(opciones.cantidad_equipos, 10);
        const tabla = this.construirSembradoTablaUnica(clasificadosData, {
          cantidad_objetivo: Number.isFinite(cantidadObjetivo) ? cantidadObjetivo : null,
          enfrentamientosDirectos,
        });
        entradas = tabla.sembrados;
        meta.ranking_tabla_unica = tabla.ranking;
        meta.objetivo_tabla_unica = tabla.objetivo || null;
        meta.clasificados_adicionales_tabla_unica = tabla.adicionales || [];
        meta.faltantes_tabla_unica = Number(tabla.faltantes_para_objetivo || 0);
      } else {
        const cruces = this.normalizarCrucesGruposInput(opciones.cruces_grupos, gruposLetras);
        if (!cruces.length) {
          throw new Error("No se pudieron definir cruces de grupos válidos");
        }
        entradas = this.construirSembradoCrucesGrupos(clasificadosData, cruces);
        meta.cruces_grupos = cruces;
      }

      const entradasValidas = entradas.filter((x) => Number.isFinite(Number(x?.equipo_id)));
      if (entradasValidas.length < 2) {
        throw new Error("No hay suficientes equipos clasificados para generar playoff");
      }

      const cantidadBody = Number.parseInt(opciones.cantidad_equipos, 10);
      const cantidadSolicitada = Number.isFinite(cantidadBody) ? cantidadBody : null;

      const bracket = await this.generarBracketConSembrado(
        evento_id,
        entradas,
        { cantidad_equipos: cantidadSolicitada, mezclar: false },
        client
      );

      await client.query("COMMIT");
      return {
        partidos: bracket,
        meta: {
          ...meta,
          total_clasificados: entradasValidas.length,
          grupos: clasificadosData.grupos,
        },
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Eliminatoria;
