// backend/models/Eliminatoria.js
const pool = require("../config/database");
const Partido = require("./Partido");

const REGLAS_DEFAULT = ["puntos", "diferencia_goles", "goles_favor"];
const RONDAS_ORDEN = ["64vos", "32vos", "16vos", "8vos", "4tos", "semifinal", "final"];
const RONDAS_POR_EQUIPOS = {
  2: ["final"],
  4: ["semifinal", "final"],
  8: ["4tos", "semifinal", "final"],
  16: ["8vos", "4tos", "semifinal", "final"],
  32: ["16vos", "8vos", "4tos", "semifinal", "final"],
};

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
      CREATE INDEX IF NOT EXISTS idx_eliminatoria_evento ON partidos_eliminatoria(evento_id)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_eliminatoria_ronda ON partidos_eliminatoria(evento_id, ronda)
    `);

    await db.query(`
      ALTER TABLE evento_equipos
      ADD COLUMN IF NOT EXISTS orden_sorteo INTEGER
    `);

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
      ORDER BY COALESCE(ee.orden_sorteo, 2147483647), e.id ASC
    `;
    const r = await db.query(q, [evento_id]);
    return r.rows.map((x) => Number(x.id)).filter((x) => Number.isFinite(x));
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
    const clasificados = [];
    const detalleGrupos = [];

    for (const g of grupos) {
      const equipos = await this.obtenerEquiposGrupo(g.id, db);
      const tabla = [];
      for (const e of equipos) {
        const resumen = await this.calcularResumenEquipoGrupo(
          e.equipo_id,
          g.id,
          evento.sistema_puntuacion || "tradicional",
          db
        );
        tabla.push({
          equipo_id: Number(e.equipo_id),
          equipo_nombre: e.equipo_nombre,
          grupo_id: Number(g.id),
          grupo_letra: String(g.letra_grupo || "").toUpperCase(),
          puntos: resumen.puntos,
          diferencia_goles: resumen.diferencia_goles,
          goles_favor: resumen.goles_favor,
          goles_contra: resumen.goles_contra,
          partidos_jugados: resumen.partidos_jugados,
          partidos_perdidos: resumen.partidos_perdidos,
          porcentaje_rendimiento: resumen.porcentaje_rendimiento,
          posicion: 0,
        });
      }

      this.ordenarTablaPorReglas(tabla, reglas);

      const clasifGrupo = tabla.slice(0, nClasificados).map((row) => ({
        ...row,
        seed_ref: `${row.posicion}${row.grupo_letra}`,
      }));

      clasificados.push(...clasifGrupo);
      detalleGrupos.push({
        grupo_id: Number(g.id),
        grupo_letra: String(g.letra_grupo || "").toUpperCase(),
        clasificados: clasifGrupo,
        tabla,
      });
    }

    return {
      evento,
      reglas_desempate: reglas,
      clasificados_por_grupo: nClasificados,
      grupos: detalleGrupos,
      clasificados,
    };
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

  static construirSembradoTablaUnica(clasificadosData) {
    const ranking = [...(clasificadosData.clasificados || [])].sort((a, b) => {
      if (b.porcentaje_rendimiento !== a.porcentaje_rendimiento) {
        return b.porcentaje_rendimiento - a.porcentaje_rendimiento;
      }
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      if (b.diferencia_goles !== a.diferencia_goles) return b.diferencia_goles - a.diferencia_goles;
      if (b.goles_favor !== a.goles_favor) return b.goles_favor - a.goles_favor;
      return String(a.equipo_nombre || "").localeCompare(String(b.equipo_nombre || ""));
    });

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
    return { ranking, sembrados };
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

      const gruposLetras = clasificadosData.grupos.map((g) => String(g.grupo_letra || "").toUpperCase());

      let entradas = [];
      let meta = {
        origen: "grupos",
        metodo_clasificacion: metodo,
        clasificados_por_grupo: clasificadosPorGrupo,
      };

      if (metodo === "tabla_unica") {
        const tabla = this.construirSembradoTablaUnica(clasificadosData);
        entradas = tabla.sembrados;
        meta.ranking_tabla_unica = tabla.ranking;
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
