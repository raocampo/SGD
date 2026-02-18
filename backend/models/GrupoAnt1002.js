// models/Grupo.js
const pool = require("../config/database");

class Grupo {
  // ===============================
  // ✅ EVENTO (nuevo)
  // ===============================
  static async obtenerPorEvento(evento_id) {
    const q = `
      SELECT *
      FROM grupos
      WHERE evento_id = $1
      ORDER BY letra_grupo, id
    `;
    const r = await pool.query(q, [evento_id]);
    return r.rows;
  }

  static async obtenerPorEventoConEquipos(evento_id) {
    // devuelve grupos + equipos (si lo necesitas para vista)
    const q = `
      SELECT
        g.id AS grupo_id,
        g.nombre_grupo,
        g.letra_grupo,
        ge.equipo_id,
        e.nombre AS equipo_nombre,
        e.logo_url AS equipo_logo_url
      FROM grupos g
      LEFT JOIN grupo_equipos ge ON ge.grupo_id = g.id
      LEFT JOIN equipos e ON e.id = ge.equipo_id
      WHERE g.evento_id = $1
      ORDER BY g.letra_grupo, g.id, e.nombre
    `;
    const r = await pool.query(q, [evento_id]);

    // agrupar
    const map = new Map();
    for (const row of r.rows) {
      if (!map.has(row.grupo_id)) {
        map.set(row.grupo_id, {
          id: row.grupo_id,
          nombre_grupo: row.nombre_grupo,
          letra_grupo: row.letra_grupo,
          equipos: [],
        });
      }
      if (row.equipo_id) {
        map.get(row.grupo_id).equipos.push({
          id: row.equipo_id,
          nombre: row.equipo_nombre,
          logo_url: row.equipo_logo_url,
        });
      }
    }
    return Array.from(map.values());
  }

  static async generarParaEvento({ evento_id, cantidad_grupos }) {
    const n = Math.max(1, Number(cantidad_grupos || 1));

    // (opcional) borrar grupos previos del evento antes de regenerar
    await pool.query(`DELETE FROM grupos WHERE evento_id=$1`, [evento_id]);

    const creados = [];
    for (let i = 0; i < n; i++) {
      const letra = String.fromCharCode(65 + i); // A,B,C...
      const nombre = `Grupo ${letra}`;

      const q = `
        INSERT INTO grupos (evento_id, nombre_grupo, letra_grupo)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const r = await pool.query(q, [evento_id, nombre, letra]);
      creados.push(r.rows[0]);
    }
    return creados;
  }

  // ===============================
  // ⚠️ CAMPEONATO (compatibilidad)
  // ===============================
  static async obtenerPorCampeonato(campeonato_id) {
    const q = `
      SELECT *
      FROM grupos
      WHERE campeonato_id = $1
      ORDER BY letra_grupo, id
    `;
    const r = await pool.query(q, [campeonato_id]);
    return r.rows;
  }

  static async generarPorCampeonato({ campeonato_id, cantidad_grupos }) {
    const n = Math.max(1, Number(cantidad_grupos || 1));
    await pool.query(`DELETE FROM grupos WHERE campeonato_id=$1`, [campeonato_id]);

    const creados = [];
    for (let i = 0; i < n; i++) {
      const letra = String.fromCharCode(65 + i);
      const nombre = `Grupo ${letra}`;

      const q = `
        INSERT INTO grupos (campeonato_id, nombre_grupo, letra_grupo)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const r = await pool.query(q, [campeonato_id, nombre, letra]);
      creados.push(r.rows[0]);
    }
    return creados;
  }

  // ===============================
  // CRUD (si lo ocupas)
  // ===============================
  static async crear(data) {
    const { evento_id = null, campeonato_id = null, nombre_grupo, letra_grupo } = data;

    const q = `
      INSERT INTO grupos (evento_id, campeonato_id, nombre_grupo, letra_grupo)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const r = await pool.query(q, [evento_id, campeonato_id, nombre_grupo, letra_grupo]);
    return r.rows[0];
  }

  static async actualizar(id, data) {
    const campos = [];
    const valores = [];
    let c = 1;

    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) {
        campos.push(`${k}=$${c}`);
        valores.push(v);
        c++;
      }
    }

    if (!campos.length) throw new Error("No hay campos para actualizar");

    valores.push(id);
    const q = `UPDATE grupos SET ${campos.join(", ")} WHERE id=$${c} RETURNING *`;
    const r = await pool.query(q, valores);
    return r.rows[0];
  }

  static async eliminar(id) {
    const r = await pool.query(`DELETE FROM grupos WHERE id=$1 RETURNING *`, [id]);
    return r.rows[0];
  }

  static async obtenerPorId(id) {
    const r = await pool.query(`SELECT * FROM grupos WHERE id=$1`, [id]);
    return r.rows[0];
  }
}

module.exports = Grupo;
