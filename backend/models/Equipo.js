///models/Equipo.js
const pool = require("../config/database");

class Equipo {
  static _esquemaAsegurado = false;

  static parseCampeonatoId(valor) {
    const id = Number.parseInt(valor, 10);
    if (!Number.isFinite(id) || id <= 0) return null;
    return id;
  }

  static async reordenarNumeracionCampeonato(campeonato_id, client = pool) {
    const campId = this.parseCampeonatoId(campeonato_id);
    if (!campId) return;

    await client.query(
      `
        WITH ordenados AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              ORDER BY numero_campeonato NULLS LAST, id
            )::int AS nuevo_numero
          FROM equipos
          WHERE campeonato_id = $1
        )
        UPDATE equipos e
        SET numero_campeonato = o.nuevo_numero
        FROM ordenados o
        WHERE e.id = o.id
          AND e.numero_campeonato IS DISTINCT FROM o.nuevo_numero
      `,
      [campId]
    );
  }

  static async asegurarEsquema() {
    if (this._esquemaAsegurado) return;

    await pool.query(`
      ALTER TABLE equipos
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
        FROM equipos
        WHERE campeonato_id IS NOT NULL
      )
      UPDATE equipos e
      SET numero_campeonato = ranked.rn
      FROM ranked
      WHERE e.id = ranked.id
        AND e.numero_campeonato IS NULL
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_equipos_numero_campeonato
      ON equipos(campeonato_id, numero_campeonato)
      WHERE numero_campeonato IS NOT NULL
    `);

    this._esquemaAsegurado = true;
  }

  // CREATE - Crear nuevo equipo
  static async crear(
    campeonato_id,
    nombre,
    director_tecnico,
    asistente_tecnico,
    medico,
    color_equipo,
    color_primario,
    color_secundario,
    color_terciario,
    telefono,
    email,
    logo_url,
    cabeza_serie
  ) {
    await this.asegurarEsquema();

    // Verificar límite de equipos en el campeonato
    const limiteQuery = "SELECT max_equipos FROM campeonatos WHERE id = $1";
    const limiteResult = await pool.query(limiteQuery, [campeonato_id]);

    if (limiteResult.rows.length === 0) {
      throw new Error("Campeonato no encontrado");
    }

    const maxEquiposRaw = limiteResult.rows[0].max_equipos;

    if (maxEquiposRaw !== null && maxEquiposRaw !== undefined) {
      const maxEquipos = Number(maxEquiposRaw);

      if (!Number.isNaN(maxEquipos)) {
        // Contar equipos actuales
        const countQuery =
          "SELECT COUNT(*) FROM equipos WHERE campeonato_id = $1";
        const countResult = await pool.query(countQuery, [campeonato_id]);
        const equiposActuales = parseInt(countResult.rows[0].count);

        if (equiposActuales >= maxEquipos) {
          throw new Error(
            `Límite de ${maxEquipos} equipos alcanzado en este campeonato`
          );
        }
      }
    }

    // Crear equipo
    const insertQuery = `
            WITH next_num AS (
              SELECT COALESCE(MAX(numero_campeonato), 0) + 1 AS next_num
              FROM equipos
              WHERE campeonato_id = $1
            )
            INSERT INTO equipos 
            (campeonato_id, nombre, director_tecnico, asistente_tecnico, medico, color_equipo, color_primario, color_secundario, color_terciario, telefono, email, logo_url, cabeza_serie, numero_campeonato) 
            SELECT
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, next_num.next_num
            FROM next_num
            RETURNING *
        `;
    const values = [
      campeonato_id,
      nombre,
      director_tecnico,
      asistente_tecnico || null,
      medico || null,
      color_equipo || color_primario || null,
      color_primario || null,
      color_secundario || null,
      color_terciario || null,
      telefono,
      email,
      logo_url,
      cabeza_serie === true || cabeza_serie === "true",
    ];

    const result = await pool.query(insertQuery, values);
    const nuevoEquipo = result.rows[0] || null;
    if (!nuevoEquipo) return null;

    await this.reordenarNumeracionCampeonato(campeonato_id);
    const equipoFinal = await this.obtenerPorId(nuevoEquipo.id);
    return equipoFinal || nuevoEquipo;
  }

  // READ - Obtener TODOS los equipos (con información del campeonato)
  static async obtenerTodos() {
    await this.asegurarEsquema();

    const query = `
        SELECT e.*, c.nombre as nombre_campeonato 
        FROM equipos e 
        JOIN campeonatos c ON e.campeonato_id = c.id 
        ORDER BY c.nombre, e.numero_campeonato NULLS LAST, e.nombre
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  // READ - Obtener todos los equipos de un campeonato
  static async obtenerPorCampeonato(campeonato_id) {
    await this.asegurarEsquema();
    await this.reordenarNumeracionCampeonato(campeonato_id);

    const query = `
            SELECT e.*, c.nombre as nombre_campeonato 
            FROM equipos e 
            JOIN campeonatos c ON e.campeonato_id = c.id 
            WHERE e.campeonato_id = $1 
            ORDER BY e.numero_campeonato NULLS LAST, e.nombre
        `;
    const result = await pool.query(query, [campeonato_id]);
    return result.rows;
  }

  // READ - Obtener equipo por ID
  static async obtenerPorId(id) {
    await this.asegurarEsquema();

    const query = `
            SELECT e.*, c.nombre as nombre_campeonato 
            FROM equipos e 
            JOIN campeonatos c ON e.campeonato_id = c.id 
            WHERE e.id = $1
        `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // UPDATE - Actualizar equipo
  /*static async actualizar(id, datos = {}) {
    if (!datos || typeof datos !== "object") {
      throw new Error("Datos de actualización inválidos");
    }

    const allowed = new Set([
      "nombre",
      "director_tecnico",
      "color_equipo",
      "telefono",
      "email",
      "logo_url",
      "campeonato_id",
    ]);

    const campos = [];
    const valores = [];
    let contador = 1;

    for (const [key, value] of Object.entries(datos)) {
      if (value !== undefined && allowed.has(key)) {
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
    UPDATE equipos
    SET ${campos.join(", ")}, update_at = CURRENT_TIMESTAMP
    WHERE id = $${contador}
    RETURNING *
  `;

    const result = await pool.query(query, valores);
    return result.rows[0];
  }*/
  static async actualizar(id, datos) {
    await this.asegurarEsquema();

    datos = datos || {}; // ✅ evita undefined/null
    const equipoAntes = await this.obtenerPorId(id);

    const campos = [];
    const valores = [];
    let contador = 1;

    // (recomendado) whitelist para que no actualicen columnas raras
    const allowed = new Set([
      "campeonato_id",
      "nombre",
      "director_tecnico",
      "asistente_tecnico",
      "medico",
      "color_equipo",
      "color_primario",
      "color_secundario",
      "color_terciario",
      "telefono",
      "email",
      "cabeza_serie",
      "logo_url",
    ]);

    for (const [key, value] of Object.entries(datos)) {
      if (!allowed.has(key)) continue;
      if (value !== undefined && value !== null && value !== "") {
        campos.push(`${key} = $${contador}`);
        valores.push(value);
        contador++;
      }
    }

    if (campos.length === 0) {
      throw new Error("No hay campos para actualizar");
    }

    const query = `
    UPDATE equipos
    SET ${campos.join(", ")}
    WHERE id = $${contador}
    RETURNING *;
  `;
    valores.push(id);

    const result = await pool.query(query, valores);
    const equipoActualizado = result.rows[0] || null;

    const campeonatoAntes = this.parseCampeonatoId(equipoAntes?.campeonato_id);
    const campeonatoDespues = this.parseCampeonatoId(equipoActualizado?.campeonato_id);

    if (campeonatoAntes) await this.reordenarNumeracionCampeonato(campeonatoAntes);
    if (campeonatoDespues && campeonatoDespues !== campeonatoAntes) {
      await this.reordenarNumeracionCampeonato(campeonatoDespues);
    }

    return equipoActualizado;
  }

  // DELETE - Eliminar equipo
  static async eliminar(id) {
    await this.asegurarEsquema();

    const query = "DELETE FROM equipos WHERE id = $1 RETURNING *";
    const result = await pool.query(query, [id]);
    const equipoEliminado = result.rows[0] || null;
    if (equipoEliminado?.campeonato_id) {
      await this.reordenarNumeracionCampeonato(equipoEliminado.campeonato_id);
    }
    return equipoEliminado;
  }

  // DESIGNAR como cabeza de serie
  static async designarCabezaSerie(equipo_id, es_cabeza_serie = true) {
    await this.asegurarEsquema();

    const query =
      "UPDATE equipos SET cabeza_serie = $1 WHERE id = $2 RETURNING *";
    const result = await pool.query(query, [es_cabeza_serie, equipo_id]);
    return result.rows[0];
  }

  // OBTENER cabezas de serie por campeonato
  static async obtenerCabezasDeSerie(campeonato_id) {
    await this.asegurarEsquema();

    const query = `
        SELECT e.*, c.nombre as nombre_campeonato 
        FROM equipos e 
        JOIN campeonatos c ON e.campeonato_id = c.id 
        WHERE e.campeonato_id = $1 AND e.cabeza_serie = true 
        ORDER BY e.numero_campeonato NULLS LAST, e.nombre
    `;
    const result = await pool.query(query, [campeonato_id]);
    return result.rows;
  }

  // OBTENER equipos NO cabeza de serie por campeonato
  static async obtenerNoCabezasDeSerie(campeonato_id) {
    await this.asegurarEsquema();

    const query = `
        SELECT e.*, c.nombre as nombre_campeonato 
        FROM equipos e 
        JOIN campeonatos c ON e.campeonato_id = c.id 
        WHERE e.campeonato_id = $1 AND e.cabeza_serie = false 
        ORDER BY e.numero_campeonato NULLS LAST, e.nombre
    `;
    const result = await pool.query(query, [campeonato_id]);
    return result.rows;
  }
}

module.exports = Equipo;
