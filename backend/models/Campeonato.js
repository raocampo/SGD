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
      ADD COLUMN IF NOT EXISTS genera_carnets BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS numero_organizador INTEGER,
      ADD COLUMN IF NOT EXISTS costo_arbitraje NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS costo_tarjeta_amarilla NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS costo_tarjeta_roja NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS costo_carnet NUMERIC(12,2) DEFAULT 0
    `);
    await pool.query(`
      UPDATE campeonatos
      SET
        costo_arbitraje = COALESCE(costo_arbitraje, 0),
        costo_tarjeta_amarilla = COALESCE(costo_tarjeta_amarilla, 0),
        costo_tarjeta_roja = COALESCE(costo_tarjeta_roja, 0),
        costo_carnet = COALESCE(costo_carnet, 0)
    `);
    await pool.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(COALESCE(TRIM(organizador), 'sin_organizador'))
            ORDER BY id
          )::int AS rn
        FROM campeonatos
      )
      UPDATE campeonatos c
      SET numero_organizador = ranked.rn
      FROM ranked
      WHERE c.id = ranked.id
        AND c.numero_organizador IS NULL
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_campeonatos_org_numero
      ON campeonatos ((LOWER(COALESCE(TRIM(organizador), 'sin_organizador'))), numero_organizador)
      WHERE numero_organizador IS NOT NULL
    `);
    this._columnasDocumentosAseguradas = true;
  }

  static parseDecimalNoNegativo(valor, fallback = 0) {
    if (valor === undefined || valor === null || valor === "") return fallback;
    const n = Number.parseFloat(String(valor).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Number(n.toFixed(2));
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
    genera_carnets = false,
    costo_arbitraje = 0,
    costo_tarjeta_amarilla = 0,
    costo_tarjeta_roja = 0,
    costo_carnet = 0
  ) {
    await this.asegurarColumnasDocumentos();

    const query = `
      WITH next_num AS (
        SELECT COALESCE(MAX(numero_organizador), 0) + 1 AS next_num
        FROM campeonatos
        WHERE LOWER(COALESCE(TRIM(organizador), 'sin_organizador')) =
          LOWER(COALESCE(TRIM($2), 'sin_organizador'))
      )
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
        costo_arbitraje,
        costo_tarjeta_amarilla,
        costo_tarjeta_roja,
        costo_carnet,
        estado,
        numero_organizador
      )
      SELECT
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'borrador',
        next_num.next_num
      FROM next_num
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
      this.parseDecimalNoNegativo(costo_arbitraje, 0),
      this.parseDecimalNoNegativo(costo_tarjeta_amarilla, 0),
      this.parseDecimalNoNegativo(costo_tarjeta_roja, 0),
      this.parseDecimalNoNegativo(costo_carnet, 0),
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
      "reglas_desempate", "requiere_foto_cedula", "requiere_foto_carnet", "genera_carnets",
      "costo_arbitraje", "costo_tarjeta_amarilla", "costo_tarjeta_roja", "costo_carnet"
    ]);

    for (const [key, value] of Object.entries(datos)) {
      if (value !== undefined && allowed.has(key)) {
        if (key === "estado" && !ESTADOS_TORNEO.includes(value)) {
          throw new Error(`Estado inválido. Valores permitidos: ${ESTADOS_TORNEO.join(", ")}`);
        }
        if (
          key === "costo_arbitraje" ||
          key === "costo_tarjeta_amarilla" ||
          key === "costo_tarjeta_roja" ||
          key === "costo_carnet"
        ) {
          campos.push(`${key} = $${contador}`);
          valores.push(this.parseDecimalNoNegativo(value, 0));
          contador++;
          continue;
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
