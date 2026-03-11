// models/Grupo.js
const pool = require("../config/database");

class Grupo {
  static async assertSorteoEditable(evento_id, client = pool) {
    const partidosR = await client.query(
      `SELECT COUNT(*)::int AS total FROM partidos WHERE evento_id = $1`,
      [evento_id]
    );
    const totalPartidos = Number(partidosR.rows[0]?.total || 0);
    if (totalPartidos > 0) {
      throw new Error(
        "No se puede reiniciar el sorteo porque la categoría ya tiene partidos programados"
      );
    }

    const existeEliminatoriaR = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'partidos_eliminatoria'
      ) AS existe
    `);
    const existeTablaEliminatoria = existeEliminatoriaR.rows[0]?.existe === true;
    if (!existeTablaEliminatoria) return;

    const eliminatoriaR = await client.query(
      `SELECT COUNT(*)::int AS total FROM partidos_eliminatoria WHERE evento_id = $1`,
      [evento_id]
    );
    const totalEliminatoria = Number(eliminatoriaR.rows[0]?.total || 0);
    if (totalEliminatoria > 0) {
      throw new Error(
        "No se puede reiniciar el sorteo porque la categoría ya tiene eliminatorias generadas"
      );
    }
  }

  // ===========================
  // CREATE - Crear grupos por EVENTO
  // ===========================
  static async crearGruposPorEvento(evento_id, cantidad_grupos, nombres_grupos = null) {
    // Verificar que el evento exista
    const ev = await pool.query("SELECT id FROM eventos WHERE id=$1", [evento_id]);
    if (ev.rows.length === 0) throw new Error("Evento no encontrado");

    const letras = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    if (cantidad_grupos > letras.length) {
      throw new Error(`Máximo ${letras.length} grupos soportados (A..J).`);
    }

    const creados = [];
    for (let i = 0; i < cantidad_grupos; i++) {
      const letra_grupo = letras[i];
      const nombre_grupo = nombres_grupos?.[i] || `Grupo ${letra_grupo}`;

      const r = await pool.query(
        `INSERT INTO grupos (evento_id, nombre_grupo, letra_grupo)
         VALUES ($1,$2,$3) RETURNING *`,
        [evento_id, nombre_grupo, letra_grupo]
      );
      creados.push(r.rows[0]);
    }
    return creados;
  }

  // ===========================
  // READ - Obtener grupos por EVENTO
  // ===========================
  static async obtenerPorEvento(evento_id) {
    const q = `
      SELECT g.*,
             COUNT(ge.equipo_id) AS cantidad_equipos
      FROM grupos g
      LEFT JOIN grupo_equipos ge ON ge.grupo_id = g.id
      WHERE g.evento_id = $1
      GROUP BY g.id
      ORDER BY g.letra_grupo
    `;
    const r = await pool.query(q, [evento_id]);
    return r.rows;
  }

  // READ - Grupo por ID (incluye conteo)
  static async obtenerPorId(id) {
    const q = `
      SELECT g.*,
             COUNT(ge.equipo_id) AS cantidad_equipos
      FROM grupos g
      LEFT JOIN grupo_equipos ge ON ge.grupo_id = g.id
      WHERE g.id = $1
      GROUP BY g.id
    `;
    const r = await pool.query(q, [id]);
    return r.rows[0];
  }

  // READ - Equipos de un grupo
  static async obtenerEquiposDelGrupo(grupo_id) {
    const q = `
      SELECT e.*, ge.orden_sorteo, ge.fecha_sorteo
      FROM equipos e
      JOIN grupo_equipos ge ON ge.equipo_id = e.id
      WHERE ge.grupo_id = $1
      ORDER BY ge.orden_sorteo NULLS LAST, e.nombre
    `;
    const r = await pool.query(q, [grupo_id]);
    return r.rows;
  }

  // ===========================
  // UPDATE - Actualizar grupo
  // ===========================
  static async actualizar(id, datos) {
    const campos = [];
    const valores = [];
    let i = 1;

    for (const [k, v] of Object.entries(datos)) {
      if (v !== undefined) {
        campos.push(`${k} = $${i++}`);
        valores.push(v);
      }
    }
    if (campos.length === 0) throw new Error("No hay campos para actualizar");

    valores.push(id);
    const q = `
      UPDATE grupos
      SET ${campos.join(", ")}
      WHERE id = $${i}
      RETURNING *
    `;
    const r = await pool.query(q, valores);
    return r.rows[0];
  }

  // ===========================
  // DELETE - Eliminar grupo y asignaciones
  // ===========================
  static async eliminar(id) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const grupoR = await client.query("SELECT id, evento_id FROM grupos WHERE id = $1", [id]);
      const grupo = grupoR.rows[0];
      if (!grupo) {
        await client.query("ROLLBACK");
        return null;
      }

      await this.assertSorteoEditable(grupo.evento_id, client);
      await client.query("DELETE FROM grupo_equipos WHERE grupo_id = $1", [id]);
      const r = await client.query("DELETE FROM grupos WHERE id = $1 RETURNING *", [id]);
      await client.query("COMMIT");
      return r.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // ===========================
  // ASIGNAR equipo a grupo (validando EVENTO)
  // ===========================
  static async asignarEquipo(grupo_id, equipo_id, orden_sorteo = null) {
    // 1) grupo -> evento
    const g = await pool.query("SELECT evento_id FROM grupos WHERE id=$1", [grupo_id]);
    if (g.rows.length === 0) throw new Error("Grupo no encontrado");
    const evento_id = g.rows[0].evento_id;

    // 2) validar que el equipo este asignado al evento via tabla pivote evento_equipos
    const e = await pool.query(
      `SELECT 1
       FROM evento_equipos
       WHERE evento_id = $1 AND equipo_id = $2
       LIMIT 1`,
      [evento_id, equipo_id]
    );
    if (e.rows.length === 0) {
      throw new Error("El equipo no pertenece a la categoria/evento seleccionado.");
    }

    // 3) evitar que el equipo esté en otro grupo del mismo evento
    const ver = await pool.query(
      `SELECT g2.id, g2.nombre_grupo
         FROM grupo_equipos ge
         JOIN grupos g2 ON g2.id = ge.grupo_id
        WHERE ge.equipo_id = $1 AND g2.evento_id = $2`,
      [equipo_id, evento_id]
    );
    if (ver.rows.length > 0) {
      throw new Error(`El equipo ya está asignado a ${ver.rows[0].nombre_grupo}`);
    }

    const r = await pool.query(
      `INSERT INTO grupo_equipos (grupo_id, equipo_id, orden_sorteo)
       VALUES ($1,$2,$3) RETURNING *`,
      [grupo_id, equipo_id, orden_sorteo]
    );
    return r.rows[0];
  }

  static async removerEquipo(grupo_id, equipo_id) {
    const r = await pool.query(
      "DELETE FROM grupo_equipos WHERE grupo_id=$1 AND equipo_id=$2 RETURNING *",
      [grupo_id, equipo_id]
    );
    return r.rows[0];
  }

  // ===========================
  // Grupos con equipos (para sorteo) por EVENTO
  // ===========================
  static async obtenerConEquiposPorEvento(evento_id) {
    const q = `
      SELECT g.*,
             COALESCE(
               JSON_AGG(
                 JSON_BUILD_OBJECT(
                   'id', e.id,
                   'nombre', e.nombre,
                   'logo_url', e.logo_url,
                   'cabeza_serie', e.cabeza_serie,
                   'orden_sorteo', ge.orden_sorteo
                 )
                 ORDER BY ge.orden_sorteo NULLS LAST
               ) FILTER (WHERE e.id IS NOT NULL),
               '[]'::json
             ) AS equipos
      FROM grupos g
      LEFT JOIN grupo_equipos ge ON ge.grupo_id = g.id
      LEFT JOIN equipos e ON e.id = ge.equipo_id
      WHERE g.evento_id = $1
      GROUP BY g.id
      ORDER BY g.letra_grupo
    `;
    const r = await pool.query(q, [evento_id]);
    return r.rows;
  }

  // ============================================================
  // (Compatibilidad) métodos por campeonato (si aún los usas)
  // ============================================================
  static async obtenerPorCampeonato(campeonato_id) {
    const q = `
      SELECT g.*, COUNT(ge.equipo_id) as cantidad_equipos
      FROM grupos g
      JOIN eventos ev ON ev.id = g.evento_id
      LEFT JOIN grupo_equipos ge ON g.id = ge.grupo_id
      WHERE ev.campeonato_id = $1
      GROUP BY g.id
      ORDER BY g.letra_grupo
    `;
    const r = await pool.query(q, [campeonato_id]);
    return r.rows;
  }

  static async obtenerConEquiposPorCampeonato(campeonato_id) {
    const q = `
      SELECT g.*,
             COALESCE(
               JSON_AGG(
                 JSON_BUILD_OBJECT(
                   'id', e.id,
                   'nombre', e.nombre,
                   'logo_url', e.logo_url,
                   'cabeza_serie', e.cabeza_serie,
                   'orden_sorteo', ge.orden_sorteo
                 )
                 ORDER BY ge.orden_sorteo NULLS LAST
               ) FILTER (WHERE e.id IS NOT NULL),
               '[]'::json
             ) AS equipos
      FROM grupos g
      JOIN eventos ev ON ev.id = g.evento_id
      LEFT JOIN grupo_equipos ge ON ge.grupo_id = g.id
      LEFT JOIN equipos e ON e.id = ge.equipo_id
      WHERE ev.campeonato_id = $1
      GROUP BY g.id
      ORDER BY g.letra_grupo
    `;
    const r = await pool.query(q, [campeonato_id]);
    return r.rows;
  }
}

module.exports = Grupo;
