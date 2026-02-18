// backend/models/Eliminatoria.js
const pool = require("../config/database");

const RONDAS_ORDEN = ["32vos", "16vos", "8vos", "4tos", "semifinal", "final"];

class Eliminatoria {
  static async crearSlot(evento_id, ronda, partido_numero, equipo_local_id, equipo_visitante_id, slot_local_id, slot_visitante_id) {
    const q = `
      INSERT INTO partidos_eliminatoria
        (evento_id, ronda, partido_numero, equipo_local_id, equipo_visitante_id, slot_local_id, slot_visitante_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const r = await pool.query(q, [
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

  static async obtenerPorEvento(evento_id) {
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
        array_position(ARRAY['32vos','16vos','8vos','4tos','semifinal','final']::varchar[], pe.ronda),
        pe.partido_numero
    `;
    const r = await pool.query(q, [evento_id]);
    return r.rows;
  }

  static async obtenerPorRonda(evento_id, ronda) {
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
    const r = await pool.query(q, [evento_id, ronda]);
    return r.rows;
  }

  static async actualizarResultado(id, resultado_local, resultado_visitante, ganador_id) {
    const q = `
      UPDATE partidos_eliminatoria
      SET resultado_local = $1, resultado_visitante = $2, ganador_id = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    const r = await pool.query(q, [resultado_local, resultado_visitante, ganador_id, id]);
    return r.rows[0];
  }

  static async asignarEquipos(id, equipo_local_id, equipo_visitante_id) {
    const q = `
      UPDATE partidos_eliminatoria
      SET equipo_local_id = $1, equipo_visitante_id = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
    const r = await pool.query(q, [equipo_local_id, equipo_visitante_id, id]);
    return r.rows[0];
  }

  /**
   * Genera estructura vacía del bracket para N equipos (4, 8, 16, 32)
   * Primera ronda: 4, 8, 16 o 32 partidos según cantidad
   */
  static async generarBracket(evento_id, cantidad_equipos = 8) {
    const num = Math.pow(2, Math.ceil(Math.log2(Math.max(4, cantidad_equipos))));
    const numPartidosPrimeraRonda = num / 2;
    const nombresRondas = {
      2: ["semifinal", "final"],
      4: ["4tos", "semifinal", "final"],
      8: ["8vos", "4tos", "semifinal", "final"],
      16: ["16vos", "8vos", "4tos", "semifinal", "final"],
      32: ["32vos", "16vos", "8vos", "4tos", "semifinal", "final"],
    };
    const rondas = nombresRondas[num] || ["4tos", "semifinal", "final"];

    await pool.query("DELETE FROM partidos_eliminatoria WHERE evento_id = $1", [evento_id]);

    const creados = [];
    let slotsAnteriores = [];

    for (let r = 0; r < rondas.length; r++) {
      const ronda = rondas[r];
      const partidosEnRonda = numPartidosPrimeraRonda / Math.pow(2, r);
      const slotsRonda = [];

      for (let p = 0; p < partidosEnRonda; p++) {
        let slotLocal = null;
        let slotVisit = null;
        if (r > 0 && slotsAnteriores.length >= (p * 2 + 2)) {
          slotLocal = slotsAnteriores[p * 2].id;
          slotVisit = slotsAnteriores[p * 2 + 1].id;
        }
        const slot = await this.crearSlot(evento_id, ronda, p + 1, null, null, slotLocal, slotVisit);
        creados.push(slot);
        slotsRonda.push(slot);
      }
      slotsAnteriores = slotsRonda;
    }

    return creados;
  }
}

module.exports = Eliminatoria;
