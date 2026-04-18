"use strict";

const pool = require("../config/database");

const ESTADO_INICIAL = {
  goles_local: 0,
  goles_visitante: 0,
  minuto: 0,
  periodo: "1T",
  estado: "esperando",
  texto_evento: null,
  mostrar_marcador: true,
  mostrar_cronometro: true,
  mostrar_texto_evento: false,
};

class TransmisionOverlay {
  static limpiar(row) {
    if (!row) return null;
    return {
      id: row.id,
      transmision_id: row.transmision_id,
      goles_local: row.goles_local,
      goles_visitante: row.goles_visitante,
      minuto: row.minuto,
      periodo: row.periodo,
      estado: row.estado,
      texto_evento: row.texto_evento,
      mostrar_marcador: row.mostrar_marcador,
      mostrar_cronometro: row.mostrar_cronometro,
      mostrar_texto_evento: row.mostrar_texto_evento,
      updated_at: row.updated_at,
    };
  }

  /**
   * Obtener estado actual. Si no existe, crea el registro con valores por defecto.
   */
  static async obtenerOCrear(transmisionId) {
    const existing = await pool.query(
      "SELECT * FROM transmision_overlay_state WHERE transmision_id = $1",
      [transmisionId]
    );
    if (existing.rows.length) {
      return TransmisionOverlay.limpiar(existing.rows[0]);
    }
    // Crear estado inicial
    const result = await pool.query(
      `INSERT INTO transmision_overlay_state
         (transmision_id, goles_local, goles_visitante, minuto, periodo, estado,
          texto_evento, mostrar_marcador, mostrar_cronometro, mostrar_texto_evento)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (transmision_id) DO UPDATE
         SET updated_at = NOW()
       RETURNING *`,
      [
        transmisionId,
        ESTADO_INICIAL.goles_local,
        ESTADO_INICIAL.goles_visitante,
        ESTADO_INICIAL.minuto,
        ESTADO_INICIAL.periodo,
        ESTADO_INICIAL.estado,
        ESTADO_INICIAL.texto_evento,
        ESTADO_INICIAL.mostrar_marcador,
        ESTADO_INICIAL.mostrar_cronometro,
        ESTADO_INICIAL.mostrar_texto_evento,
      ]
    );
    return TransmisionOverlay.limpiar(result.rows[0]);
  }

  /**
   * Actualizar campos del estado del overlay.
   */
  static async actualizar(transmisionId, data) {
    const CAMPOS = [
      "goles_local",
      "goles_visitante",
      "minuto",
      "periodo",
      "estado",
      "texto_evento",
      "mostrar_marcador",
      "mostrar_cronometro",
      "mostrar_texto_evento",
    ];

    const sets = [];
    const values = [];
    let idx = 1;

    for (const campo of CAMPOS) {
      if (Object.prototype.hasOwnProperty.call(data, campo)) {
        sets.push(`${campo} = $${idx++}`);
        values.push(data[campo]);
      }
    }

    if (!sets.length) {
      return TransmisionOverlay.obtenerOCrear(transmisionId);
    }

    sets.push(`updated_at = NOW()`);
    values.push(transmisionId);

    const result = await pool.query(
      `UPDATE transmision_overlay_state
       SET ${sets.join(", ")}
       WHERE transmision_id = $${idx}
       RETURNING *`,
      values
    );

    if (!result.rows.length) {
      // No existía: crear primero, luego actualizar
      await TransmisionOverlay.obtenerOCrear(transmisionId);
      return TransmisionOverlay.actualizar(transmisionId, data);
    }

    return TransmisionOverlay.limpiar(result.rows[0]);
  }

  /**
   * Resetear el estado a cero.
   */
  static async reset(transmisionId) {
    const result = await pool.query(
      `UPDATE transmision_overlay_state
       SET goles_local = 0, goles_visitante = 0, minuto = 0,
           periodo = '1T', estado = 'esperando', texto_evento = NULL,
           mostrar_marcador = TRUE, mostrar_cronometro = TRUE,
           mostrar_texto_evento = FALSE, updated_at = NOW()
       WHERE transmision_id = $1
       RETURNING *`,
      [transmisionId]
    );
    if (!result.rows.length) {
      return TransmisionOverlay.obtenerOCrear(transmisionId);
    }
    return TransmisionOverlay.limpiar(result.rows[0]);
  }
}

module.exports = TransmisionOverlay;
