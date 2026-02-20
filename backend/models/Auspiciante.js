const pool = require("../config/database");

class Auspiciante {
  static _tablaAsegurada = false;
  static _initTablaPromise = null;

  static async asegurarTabla() {
    if (this._tablaAsegurada) return;

    if (!this._initTablaPromise) {
      this._initTablaPromise = (async () => {
        const q = `
          CREATE TABLE IF NOT EXISTS campeonato_auspiciantes (
            id SERIAL PRIMARY KEY,
            campeonato_id INTEGER NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
            nombre VARCHAR(160) NOT NULL,
            logo_url TEXT,
            orden INTEGER NOT NULL DEFAULT 1,
            activo BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_auspiciantes_campeonato
            ON campeonato_auspiciantes (campeonato_id);

          CREATE INDEX IF NOT EXISTS idx_auspiciantes_activo
            ON campeonato_auspiciantes (campeonato_id, activo, orden, id);
        `;

        await pool.query(q);
        this._tablaAsegurada = true;
      })().finally(() => {
        this._initTablaPromise = null;
      });
    }

    await this._initTablaPromise;
  }

  static async crear(data = {}) {
    await this.asegurarTabla();

    const campeonatoId = Number.parseInt(data.campeonato_id, 10);
    if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
      throw new Error("campeonato_id inválido");
    }

    const nombre = String(data.nombre || "").trim();
    if (!nombre) throw new Error("nombre es obligatorio");

    const orden = Number.parseInt(data.orden, 10);
    const activo =
      data.activo === undefined
        ? true
        : data.activo === true || String(data.activo).toLowerCase() === "true";

    const q = `
      INSERT INTO campeonato_auspiciantes
      (campeonato_id, nombre, logo_url, orden, activo)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const r = await pool.query(q, [
      campeonatoId,
      nombre,
      data.logo_url || null,
      Number.isFinite(orden) ? orden : 1,
      activo,
    ]);
    return r.rows[0];
  }

  static async listarPorCampeonato(campeonatoId, soloActivos = false) {
    await this.asegurarTabla();

    const id = Number.parseInt(campeonatoId, 10);
    if (!Number.isFinite(id) || id <= 0) return [];

    const where = soloActivos
      ? "WHERE campeonato_id = $1 AND activo = TRUE"
      : "WHERE campeonato_id = $1";
    const q = `
      SELECT *
      FROM campeonato_auspiciantes
      ${where}
      ORDER BY orden ASC, id ASC
    `;
    const r = await pool.query(q, [id]);
    return r.rows;
  }

  static async obtenerPorId(id) {
    await this.asegurarTabla();

    const q = "SELECT * FROM campeonato_auspiciantes WHERE id = $1";
    const r = await pool.query(q, [id]);
    return r.rows[0] || null;
  }

  static async actualizar(id, data = {}) {
    await this.asegurarTabla();

    const campos = [];
    const valores = [];
    let idx = 1;

    if (data.nombre !== undefined) {
      const nombre = String(data.nombre || "").trim();
      if (!nombre) throw new Error("nombre es obligatorio");
      campos.push(`nombre = $${idx++}`);
      valores.push(nombre);
    }

    if (data.logo_url !== undefined) {
      campos.push(`logo_url = $${idx++}`);
      valores.push(data.logo_url || null);
    }

    if (data.orden !== undefined) {
      const orden = Number.parseInt(data.orden, 10);
      campos.push(`orden = $${idx++}`);
      valores.push(Number.isFinite(orden) ? orden : 1);
    }

    if (data.activo !== undefined) {
      const activo =
        data.activo === true || String(data.activo).toLowerCase() === "true";
      campos.push(`activo = $${idx++}`);
      valores.push(activo);
    }

    if (!campos.length) {
      throw new Error("No hay campos para actualizar");
    }

    valores.push(id);
    const q = `
      UPDATE campeonato_auspiciantes
      SET ${campos.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${idx}
      RETURNING *
    `;
    const r = await pool.query(q, valores);
    return r.rows[0] || null;
  }

  static async eliminar(id) {
    await this.asegurarTabla();

    const q = "DELETE FROM campeonato_auspiciantes WHERE id = $1 RETURNING *";
    const r = await pool.query(q, [id]);
    return r.rows[0] || null;
  }
}

module.exports = Auspiciante;
