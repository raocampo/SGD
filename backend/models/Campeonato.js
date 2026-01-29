const pool = require("../config/database");

class Campeonato {
  // CREATE - Crear nuevo campeonato (con organizador, sistema, colores y logo)
  static async crear(
    nombre,
    organizador,
    fecha_inicio,
    fecha_fin,
    tipo_futbol,
    sistema_puntuacion,
    max_equipos,
    min_jugador,
    max_jugador,
    color_primario,
    color_secundario,
    color_acento,
    logo_url
  ) {
    const query = `
      INSERT INTO campeonatos
      (
        nombre,
        organizador,
        fecha_inicio,
        fecha_fin,
        tipo_futbol,
        sistema_puntuacion,
        max_equipos,
        min_jugador,
        max_jugador,
        color_primario,
        color_secundario,
        color_acento,
        logo_url,
        estado
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'planificacion'
      )
      RETURNING *
    `;

    const values = [
      nombre,
      organizador || null,
      fecha_inicio,
      fecha_fin,
      tipo_futbol,
      sistema_puntuacion || "tradicional",
      max_equipos || null,
      min_jugador || null,
      max_jugador || null,
      color_primario || null,
      color_secundario || null,
      color_acento || null,
      logo_url || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // READ - Obtener todos los campeonatos
  static async obtenerTodos() {
    const query = "SELECT * FROM campeonatos ORDER BY created_at DESC";
    const result = await pool.query(query);
    return result.rows;
  }

  // READ - Obtener campeonato por ID
  static async obtenerPorId(id) {
    const query = "SELECT * FROM campeonatos WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // UPDATE - Actualizar campeonato
  static async actualizar(id, datos) {
    const campos = [];
    const valores = [];
    let contador = 1;

    for (const [key, value] of Object.entries(datos)) {
      if (value !== undefined) {
        campos.push(`${key} = $${contador}`);
        valores.push(value);
        contador++;
      }
    }

    if (campos.length === 0) {
      throw new Error("No hay campos para actualizar");
    }

    valores.push(id);

    const query = `
      UPDATE campeonatos
      SET ${campos.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${contador}
      RETURNING *
    `;

    const result = await pool.query(query, valores);
    return result.rows[0];
  }

  // DELETE - Eliminar campeonato
  static async eliminar(id) {
    const query = "DELETE FROM campeonatos WHERE id = $1 RETURNING *";
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = Campeonato;
