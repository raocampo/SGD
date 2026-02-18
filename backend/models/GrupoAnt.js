// models/Grupo.js
const pool = require("../config/database");

class Grupo {
  // ============================================================
  // CREATE
  // ============================================================

  /**
   * ✅ NUEVO: Crear grupos para un EVENTO (categoría)
   */
  static async crearGruposPorEvento(evento_id, cantidad_grupos, nombres_grupos = null) {
    // Verificar que el evento existe
    const eventoQuery = "SELECT * FROM eventos WHERE id = $1";
    const eventoResult = await pool.query(eventoQuery, [evento_id]);

    if (eventoResult.rows.length === 0) {
      throw new Error("Evento no encontrado");
    }

    const gruposCreados = [];
    const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

    for (let i = 0; i < cantidad_grupos; i++) {
      const letra_grupo = letras[i];
      if (!letra_grupo) throw new Error("Cantidad de grupos excede el máximo soportado (A-Z)");

      const nombre_grupo = Array.isArray(nombres_grupos) && nombres_grupos[i]
        ? nombres_grupos[i]
        : `Grupo ${letra_grupo}`;

      const query = `
        INSERT INTO grupos (evento_id, nombre_grupo, letra_grupo)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const values = [evento_id, nombre_grupo, letra_grupo];

      const result = await pool.query(query, values);
      gruposCreados.push(result.rows[0]);
    }

    return gruposCreados;
  }

  /**
   * ✅ COMPAT: tu método anterior (por campeonato)
   * Úsalo solo si aún manejas grupos por campeonato.
   */
  static async crearGrupos(campeonato_id, cantidad_grupos, nombres_grupos = null) {
    const campeonatoQuery = "SELECT * FROM campeonatos WHERE id = $1";
    const campeonatoResult = await pool.query(campeonatoQuery, [campeonato_id]);

    if (campeonatoResult.rows.length === 0) {
      throw new Error("Campeonato no encontrado");
    }

    const gruposCreados = [];
    const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

    for (let i = 0; i < cantidad_grupos; i++) {
      const letra_grupo = letras[i];
      if (!letra_grupo) throw new Error("Cantidad de grupos excede el máximo soportado (A-Z)");

      const nombre_grupo = Array.isArray(nombres_grupos) && nombres_grupos[i]
        ? nombres_grupos[i]
        : `Grupo ${letra_grupo}`;

      const query = `
        INSERT INTO grupos (campeonato_id, nombre_grupo, letra_grupo)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const values = [campeonato_id, nombre_grupo, letra_grupo];

      const result = await pool.query(query, values);
      gruposCreados.push(result.rows[0]);
    }

    return gruposCreados;
  }

  // ============================================================
  // READ
  // ============================================================

  /**
   * ✅ NUEVO: Obtener grupos por EVENTO
   */
  static async obtenerPorEvento(evento_id) {
    const query = `
      SELECT 
        g.*,
        e.nombre AS nombre_evento,
        e.organizador,
        e.fecha_inicio AS evento_fecha_inicio,
        e.fecha_fin AS evento_fecha_fin,
        c.id AS campeonato_id,
        c.nombre AS nombre_campeonato,
        COUNT(ge.equipo_id) as cantidad_equipos
      FROM grupos g
      JOIN eventos e ON g.evento_id = e.id
      LEFT JOIN campeonatos c ON e.campeonato_id = c.id
      LEFT JOIN grupo_equipos ge ON g.id = ge.grupo_id
      WHERE g.evento_id = $1
      GROUP BY g.id, e.id, c.id
      ORDER BY g.letra_grupo
    `;
    const result = await pool.query(query, [evento_id]);
    return result.rows;
  }

  /**
   * ✅ COMPAT: Obtener grupos por campeonato (lo que ya tenías)
   */
  static async obtenerPorCampeonato(campeonato_id) {
    const query = `
      SELECT 
        g.*,
        c.nombre as nombre_campeonato,
        COUNT(ge.equipo_id) as cantidad_equipos
      FROM grupos g
      JOIN campeonatos c ON g.campeonato_id = c.id
      LEFT JOIN grupo_equipos ge ON g.id = ge.grupo_id
      WHERE g.campeonato_id = $1
      GROUP BY g.id, c.nombre
      ORDER BY g.letra_grupo
    `;
    const result = await pool.query(query, [campeonato_id]);
    return result.rows;
  }

  /**
   * Obtener grupo por ID con detalle (incluye evento si existe)
   */
  static async obtenerPorId(id) {
    const query = `
      SELECT 
        g.*,
        c.nombre as nombre_campeonato,
        e.nombre as nombre_evento,
        COUNT(ge.equipo_id) as cantidad_equipos
      FROM grupos g
      LEFT JOIN campeonatos c ON g.campeonato_id = c.id
      LEFT JOIN eventos e ON g.evento_id = e.id
      LEFT JOIN grupo_equipos ge ON g.id = ge.grupo_id
      WHERE g.id = $1
      GROUP BY g.id, c.nombre, e.nombre
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Equipos de un grupo
  static async obtenerEquiposDelGrupo(grupo_id) {
    const query = `
      SELECT e.*, ge.orden_sorteo, ge.fecha_sorteo
      FROM equipos e
      JOIN grupo_equipos ge ON e.id = ge.equipo_id
      WHERE ge.grupo_id = $1
      ORDER BY ge.orden_sorteo NULLS LAST, e.nombre
    `;
    const result = await pool.query(query, [grupo_id]);
    return result.rows;
  }

  // ============================================================
  // UPDATE / DELETE
  // ============================================================

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
      UPDATE grupos
      SET ${campos.join(", ")}
      WHERE id = $${contador}
      RETURNING *
    `;

    const result = await pool.query(query, valores);
    return result.rows[0];
  }

  static async eliminar(id) {
    await pool.query("DELETE FROM grupo_equipos WHERE grupo_id = $1", [id]);

    const query = "DELETE FROM grupos WHERE id = $1 RETURNING *";
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // ============================================================
  // ASIGNACIONES (grupo_equipos)
  // ============================================================

  /**
   * ✅ Ajustado: valida que un equipo no esté en OTRO grupo del MISMO EVENTO.
   * - Si el grupo no tiene evento_id, cae a validación por campeonato (compat).
   */
  static async asignarEquipo(grupo_id, equipo_id, orden_sorteo = null) {
    // 1) averiguar contexto del grupo (evento_id o campeonato_id)
    const ctxRes = await pool.query(
      `SELECT id, evento_id, campeonato_id FROM grupos WHERE id = $1`,
      [grupo_id]
    );
    if (ctxRes.rows.length === 0) throw new Error("Grupo no encontrado");

    const { evento_id, campeonato_id } = ctxRes.rows[0];

    // 2) Validación: no repetir en otro grupo del mismo contexto
    let verificarQuery = "";
    let verificarValues = [];

    if (evento_id) {
      verificarQuery = `
        SELECT ge.grupo_id, g.nombre_grupo, g.letra_grupo
        FROM grupo_equipos ge
        JOIN grupos g ON ge.grupo_id = g.id
        WHERE ge.equipo_id = $1
          AND g.evento_id = $2
          AND ge.grupo_id <> $3
        LIMIT 1
      `;
      verificarValues = [equipo_id, evento_id, grupo_id];
    } else {
      // compat: por campeonato
      verificarQuery = `
        SELECT ge.grupo_id, g.nombre_grupo, g.letra_grupo
        FROM grupo_equipos ge
        JOIN grupos g ON ge.grupo_id = g.id
        WHERE ge.equipo_id = $1
          AND g.campeonato_id = $2
          AND ge.grupo_id <> $3
        LIMIT 1
      `;
      verificarValues = [equipo_id, campeonato_id, grupo_id];
    }

    const verificarResult = await pool.query(verificarQuery, verificarValues);
    if (verificarResult.rows.length > 0) {
      const g = verificarResult.rows[0];
      throw new Error(`El equipo ya está asignado al ${g.nombre_grupo} ${g.letra_grupo || ""}`.trim());
    }

    // 3) Insert
    const query = `
      INSERT INTO grupo_equipos (grupo_id, equipo_id, orden_sorteo)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const values = [grupo_id, equipo_id, orden_sorteo];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async removerEquipo(grupo_id, equipo_id) {
    const query = `
      DELETE FROM grupo_equipos
      WHERE grupo_id = $1 AND equipo_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [grupo_id, equipo_id]);
    return result.rows[0];
  }

  // ============================================================
  // GRUPOS + EQUIPOS (para sorteo/visualización)
  // ============================================================

  /**
   * ✅ NUEVO: Obtener grupos con equipos por EVENTO (ideal para sorteo por categoría)
   */
  static async obtenerConEquiposPorEvento(evento_id) {
    const query = `
      SELECT g.*,
             JSON_AGG(
               JSON_BUILD_OBJECT(
                 'id', e.id,
                 'nombre', e.nombre,
                 'logo_url', e.logo_url,
                 'cabeza_serie', e.cabeza_serie,
                 'orden_sorteo', ge.orden_sorteo
               )
               ORDER BY ge.orden_sorteo NULLS LAST, e.nombre
             ) FILTER (WHERE e.id IS NOT NULL) AS equipos
      FROM grupos g
      LEFT JOIN grupo_equipos ge ON g.id = ge.grupo_id
      LEFT JOIN equipos e ON ge.equipo_id = e.id
      WHERE g.evento_id = $1
      GROUP BY g.id
      ORDER BY g.letra_grupo
    `;
    const result = await pool.query(query, [evento_id]);
    return result.rows;
  }

  /**
   * ✅ COMPAT: tu versión por campeonato
   */
  static async obtenerConEquipos(campeonato_id) {
    const query = `
      SELECT g.*,
             JSON_AGG(
               JSON_BUILD_OBJECT(
                 'id', e.id,
                 'nombre', e.nombre,
                 'logo_url', e.logo_url,
                 'cabeza_serie', e.cabeza_serie,
                 'orden_sorteo', ge.orden_sorteo
               )
               ORDER BY ge.orden_sorteo NULLS LAST, e.nombre
             ) FILTER (WHERE e.id IS NOT NULL) AS equipos
      FROM grupos g
      LEFT JOIN grupo_equipos ge ON g.id = ge.grupo_id
      LEFT JOIN equipos e ON ge.equipo_id = e.id
      WHERE g.campeonato_id = $1
      GROUP BY g.id
      ORDER BY g.letra_grupo
    `;
    const result = await pool.query(query, [campeonato_id]);
    return result.rows;
  }
}

module.exports = Grupo;