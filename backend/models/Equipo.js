///models/Equipo.js
const pool = require("../config/database");
const { obtenerPlan } = require("../services/planLimits");

class Equipo {
  static _esquemaAsegurado = false;

  static parseCampeonatoId(valor) {
    const id = Number.parseInt(valor, 10);
    if (!Number.isFinite(id) || id <= 0) return null;
    return id;
  }

  static async conTransaccion(operacion) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const resultado = await operacion(client);
      await client.query("COMMIT");
      return resultado;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  static async bloquearCampeonatos(client, ids) {
    const validos = [...new Set(ids.map((id) => this.parseCampeonatoId(id)).filter(Boolean))].sort((a, b) => a - b);
    await client.query(
      "SELECT id FROM campeonatos WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE",
      [validos]
    );
  }

  static async reordenarNumeracionCampeonato(campeonato_id, client = pool) {
    const campId = this.parseCampeonatoId(campeonato_id);
    if (!campId) return;
    // Un client externo pertenece a la transacción de crear/editar/eliminar.
    if (client === pool) {
      return this.conTransaccion((tx) => this.reordenarNumeracionCampeonato(campId, tx));
    }
    await this.bloquearCampeonatos(client, [campId]);
    const { rows } = await client.query(
      `SELECT id, numero_campeonato FROM equipos WHERE campeonato_id = $1
       ORDER BY numero_campeonato NULLS LAST, id FOR UPDATE`,
      [campId]
    );
    const cambios = rows.map((equipo, index) => ({ id: equipo.id, anterior: equipo.numero_campeonato, numero: index + 1 }))
      .filter((equipo) => Number(equipo.anterior) !== equipo.numero);
    if (!cambios.length) return;
    const ids = cambios.map((equipo) => equipo.id);
    // El índice único es inmediato. Liberar los números de las filas que
    // cambian antes de asignar los definitivos evita colisiones por orden de
    // UPDATE. Los NULL solo existen dentro de esta transacción.
    await client.query("UPDATE equipos SET numero_campeonato = NULL WHERE id = ANY($1::int[])", [ids]);
    await client.query(
      `UPDATE equipos e SET numero_campeonato = n.numero
       FROM UNNEST($1::int[], $2::int[]) AS n(id, numero) WHERE e.id = n.id`,
      [ids, cambios.map((equipo) => equipo.numero)]
    );
  }

  static async asegurarEsquema() {
    if (this._esquemaAsegurado) return;

    await pool.query(`
      ALTER TABLE equipos
      ADD COLUMN IF NOT EXISTS numero_campeonato INTEGER
    `);
    await pool.query(`
      WITH maximos AS (
        SELECT campeonato_id, COALESCE(MAX(numero_campeonato), 0) AS ultimo
        FROM equipos GROUP BY campeonato_id
      ), ranked AS (
        SELECT
          e.id,
          (m.ultimo + ROW_NUMBER() OVER (
            PARTITION BY e.campeonato_id ORDER BY e.id
          ))::int AS rn
        FROM equipos e
        JOIN maximos m ON m.campeonato_id = e.campeonato_id
        WHERE e.numero_campeonato IS NULL
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
    const campId = this.parseCampeonatoId(campeonato_id);
    const nombreLimpio = String(nombre || "").trim();
    const emailLimpio = String(email || "").trim() || null;

    if (!campId) throw new Error("campeonato_id invalido");
    if (!nombreLimpio) throw new Error("nombre es obligatorio");

    return this.conTransaccion(async (client) => {
      await this.bloquearCampeonatos(client, [campId]);

      // Verificar límite de equipos en el campeonato
      const limiteQuery = `
        SELECT c.max_equipos, COALESCE(u.plan_codigo, 'premium') AS plan_codigo
        FROM campeonatos c
        LEFT JOIN usuarios u ON u.id = c.creador_usuario_id
        WHERE c.id = $1
        LIMIT 1
      `;
      const limiteResult = await client.query(limiteQuery, [campId]);

      if (limiteResult.rows.length === 0) {
        throw new Error("Campeonato no encontrado");
      }

      const maxEquiposRaw = limiteResult.rows[0].max_equipos;
      const plan = obtenerPlan(limiteResult.rows[0].plan_codigo);
      const maxEquiposPlan = plan?.max_equipos_por_campeonato;

      const limites = [];
      if (maxEquiposRaw !== null && maxEquiposRaw !== undefined) {
        const maxEquiposCampeonato = Number(maxEquiposRaw);
        if (!Number.isNaN(maxEquiposCampeonato)) {
          limites.push(maxEquiposCampeonato);
        }
      }
      if (maxEquiposPlan !== null && maxEquiposPlan !== undefined) {
        limites.push(Number(maxEquiposPlan));
      }

      if (limites.length) {
        const maxEquiposPermitido = Math.min(...limites.filter((n) => Number.isFinite(n) && n > 0));
        if (Number.isFinite(maxEquiposPermitido) && maxEquiposPermitido > 0) {
          const countQuery = "SELECT COUNT(*) FROM equipos WHERE campeonato_id = $1";
          const countResult = await client.query(countQuery, [campId]);
          const equiposActuales = parseInt(countResult.rows[0].count, 10);

          if (equiposActuales >= maxEquiposPermitido) {
            if (maxEquiposPlan !== null && maxEquiposPlan !== undefined && maxEquiposPermitido === Number(maxEquiposPlan)) {
              throw new Error(
                `Límite del plan ${plan?.nombre || "actual"}: máximo ${maxEquiposPermitido} equipos por campeonato`
              );
            }
            throw new Error(`Límite de ${maxEquiposPermitido} equipos alcanzado en este campeonato`);
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
        campId,
        nombreLimpio,
        director_tecnico,
        asistente_tecnico || null,
        medico || null,
        color_equipo || color_primario || null,
        color_primario || null,
        color_secundario || null,
        color_terciario || null,
        telefono,
        emailLimpio,
        logo_url,
        cabeza_serie === true || cabeza_serie === "true",
      ];

      const result = await client.query(insertQuery, values);
      const nuevoEquipo = result.rows[0] || null;
      if (!nuevoEquipo) return null;

      await this.reordenarNumeracionCampeonato(campId, client);
      const equipoFinal = await this.obtenerPorId(nuevoEquipo.id, client);
      return equipoFinal || nuevoEquipo;
    });
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
  static async obtenerPorId(id, client = pool) {
    await this.asegurarEsquema();

    const query = `
            SELECT e.*, c.nombre as nombre_campeonato 
            FROM equipos e 
            JOIN campeonatos c ON e.campeonato_id = c.id 
            WHERE e.id = $1
        `;
    const result = await client.query(query, [id]);
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
    return this.conTransaccion(async (client) => {
      const equipoAntes = await this.obtenerPorId(id, client);
      if (!equipoAntes) return null;
      const nombreDestino = datos.nombre !== undefined ? String(datos.nombre || "").trim() : String(equipoAntes.nombre || "").trim();
      if (!nombreDestino) {
        throw new Error("nombre es obligatorio");
      }
      const campeonatoAntes = this.parseCampeonatoId(equipoAntes?.campeonato_id);
      const campeonatoDestino = this.parseCampeonatoId(datos.campeonato_id ?? campeonatoAntes);
      await this.bloquearCampeonatos(client, [campeonatoAntes, campeonatoDestino]);
      const actual = await client.query("SELECT campeonato_id FROM equipos WHERE id = $1 FOR UPDATE", [id]);
      if (!actual.rows.length) return null;
      if (Number(actual.rows[0].campeonato_id) !== campeonatoAntes) {
        throw new Error("El equipo cambió de campeonato. Recarga los equipos antes de editarlo");
      }

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
        if (key === "email") {
          campos.push(`${key} = $${contador}`);
          valores.push(String(value || "").trim() || null);
          contador++;
          continue;
        }
        if (value !== undefined && value !== null && value !== "") {
          if (key === "nombre") {
            campos.push(`${key} = $${contador}`);
            valores.push(String(value).trim());
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

      const query = `
      UPDATE equipos
      SET ${campos.join(", ")}
      WHERE id = $${contador}
      RETURNING *;
    `;
      valores.push(id);

      if (campeonatoDestino && campeonatoDestino !== campeonatoAntes) {
        await client.query("UPDATE equipos SET numero_campeonato = NULL WHERE id = $1", [id]);
      }
      const result = await client.query(query, valores);
      const equipoActualizado = result.rows[0] || null;

      const campeonatoDespues = this.parseCampeonatoId(equipoActualizado?.campeonato_id);

      if (campeonatoAntes) await this.reordenarNumeracionCampeonato(campeonatoAntes, client);
      if (campeonatoDespues && campeonatoDespues !== campeonatoAntes) {
        await this.reordenarNumeracionCampeonato(campeonatoDespues, client);
      }

      return equipoActualizado ? await this.obtenerPorId(id, client) : null;
    });
  }

  // DELETE - Eliminar equipo
  static async eliminar(id) {
    await this.asegurarEsquema();
    return this.conTransaccion(async (client) => {
      const anterior = await this.obtenerPorId(id, client);
      if (!anterior) return null;
      await this.bloquearCampeonatos(client, [anterior.campeonato_id]);
      const actual = await client.query("SELECT campeonato_id FROM equipos WHERE id = $1 FOR UPDATE", [id]);
      if (!actual.rows.length) return null;
      if (Number(actual.rows[0].campeonato_id) !== Number(anterior.campeonato_id)) {
        throw new Error("El equipo cambió de campeonato. Recarga los equipos antes de eliminarlo");
      }
      const query = "DELETE FROM equipos WHERE id = $1 RETURNING *";
      const result = await client.query(query, [id]);
      const equipoEliminado = result.rows[0] || null;
      if (equipoEliminado?.campeonato_id) {
        await this.reordenarNumeracionCampeonato(equipoEliminado.campeonato_id, client);
      }
      return equipoEliminado;
    });
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
