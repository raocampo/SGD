const pool = require("../config/database");

// Estados del torneo según propuesta SGD
const ESTADOS_TORNEO = ["borrador", "inscripcion", "en_curso", "finalizado", "archivado"];

class Campeonato {
  static _columnasDocumentosAseguradas = false;

  static async asegurarColumnasDocumentos() {
    if (this._columnasDocumentosAseguradas) return;
    await pool.query(`
      ALTER TABLE campeonatos
      ADD COLUMN IF NOT EXISTS requiere_foto_cedula BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS requiere_foto_carnet BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS genera_carnets BOOLEAN DEFAULT FALSE
    `);
    this._columnasDocumentosAseguradas = true;
  }

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
    logo_url,
    requiere_foto_cedula = false,
    requiere_foto_carnet = false,
    genera_carnets = false
  ) {
    await this.asegurarColumnasDocumentos();

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
        requiere_foto_cedula,
        requiere_foto_carnet,
        genera_carnets,
        estado
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'borrador'
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
      requiere_foto_cedula === true || requiere_foto_cedula === "true",
      requiere_foto_carnet === true || requiere_foto_carnet === "true",
      genera_carnets === true || genera_carnets === "true",
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // READ - Obtener todos los campeonatos
  static async obtenerTodos() {
    await this.asegurarColumnasDocumentos();
    const query = "SELECT * FROM campeonatos ORDER BY created_at DESC";
    const result = await pool.query(query);
    return result.rows;
  }

  // READ - Obtener campeonato por ID
  static async obtenerPorId(id) {
    await this.asegurarColumnasDocumentos();
    const query = "SELECT * FROM campeonatos WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // UPDATE - Actualizar campeonato
  static async actualizar(id, datos) {
    await this.asegurarColumnasDocumentos();
    const campos = [];
    const valores = [];
    let contador = 1;
    const allowed = new Set([
      "nombre", "organizador", "fecha_inicio", "fecha_fin", "tipo_futbol",
      "sistema_puntuacion", "max_equipos", "min_jugador", "max_jugador",
      "color_primario", "color_secundario", "color_acento", "logo_url", "estado",
      "reglas_desempate", "requiere_foto_cedula", "requiere_foto_carnet", "genera_carnets"
    ]);

    for (const [key, value] of Object.entries(datos)) {
      if (value !== undefined && allowed.has(key)) {
        if (key === "estado" && !ESTADOS_TORNEO.includes(value)) {
          throw new Error(`Estado inválido. Valores permitidos: ${ESTADOS_TORNEO.join(", ")}`);
        }
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

  // Cambiar estado del torneo
  static async cambiarEstado(id, estado) {
    if (!ESTADOS_TORNEO.includes(estado)) {
      throw new Error(`Estado inválido. Valores permitidos: ${ESTADOS_TORNEO.join(", ")}`);
    }
    const query = `
      UPDATE campeonatos
      SET estado = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [estado, id]);
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
