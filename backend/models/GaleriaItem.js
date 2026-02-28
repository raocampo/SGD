const pool = require("../config/database");

class GaleriaItem {
  static _schemaReady = false;

  static async asegurarEsquema(client = pool) {
    if (this._schemaReady && client === pool) return;

    await client.query(`
      CREATE TABLE IF NOT EXISTS galeria_items (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(180) NOT NULL,
        descripcion TEXT,
        imagen_url TEXT NOT NULL,
        orden INTEGER NOT NULL DEFAULT 0,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_galeria_items_activo ON galeria_items(activo)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_galeria_items_orden ON galeria_items(orden, id)`);

    if (client === pool) this._schemaReady = true;
  }

  static async listar({ onlyActive = false } = {}, client = pool) {
    await this.asegurarEsquema(client);
    const r = await client.query(
      `
        SELECT *
        FROM galeria_items
        ${onlyActive ? "WHERE activo = TRUE" : ""}
        ORDER BY orden ASC, id DESC
      `
    );
    return r.rows;
  }

  static async obtenerPorId(id, client = pool) {
    await this.asegurarEsquema(client);
    const itemId = Number.parseInt(id, 10);
    if (!Number.isFinite(itemId) || itemId <= 0) return null;
    const r = await client.query(`SELECT * FROM galeria_items WHERE id = $1 LIMIT 1`, [itemId]);
    return r.rows[0] || null;
  }

  static async crear(data = {}, client = pool) {
    await this.asegurarEsquema(client);
    const titulo = String(data.titulo || "").trim();
    const descripcion = String(data.descripcion || "").trim() || null;
    const imagenUrl = String(data.imagen_url || "").trim();
    const orden = Number.parseInt(data.orden, 10);
    const activo = data.activo === undefined ? true : data.activo === true || String(data.activo).toLowerCase() === "true";

    if (!titulo || !imagenUrl) {
      throw new Error("titulo e imagen_url son obligatorios");
    }

    const r = await client.query(
      `
        INSERT INTO galeria_items (titulo, descripcion, imagen_url, orden, activo)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [titulo, descripcion, imagenUrl, Number.isFinite(orden) ? orden : 0, activo]
    );
    return r.rows[0] || null;
  }

  static async actualizar(id, data = {}, client = pool) {
    await this.asegurarEsquema(client);
    const actual = await this.obtenerPorId(id, client);
    if (!actual) throw new Error("Item de galeria no encontrado");

    const titulo = data.titulo !== undefined ? String(data.titulo || "").trim() : actual.titulo;
    const imagenUrl = data.imagen_url !== undefined ? String(data.imagen_url || "").trim() : actual.imagen_url;
    if (!titulo || !imagenUrl) throw new Error("titulo e imagen_url son obligatorios");

    const descripcion = data.descripcion !== undefined ? String(data.descripcion || "").trim() || null : actual.descripcion;
    const orden = data.orden !== undefined ? Number.parseInt(data.orden, 10) : actual.orden;
    const activo =
      data.activo !== undefined
        ? data.activo === true || String(data.activo).toLowerCase() === "true"
        : actual.activo === true;

    const r = await client.query(
      `
        UPDATE galeria_items
        SET titulo = $1,
            descripcion = $2,
            imagen_url = $3,
            orden = $4,
            activo = $5,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING *
      `,
      [titulo, descripcion, imagenUrl, Number.isFinite(orden) ? orden : 0, activo, Number.parseInt(id, 10)]
    );
    return r.rows[0] || null;
  }

  static async eliminar(id, client = pool) {
    await this.asegurarEsquema(client);
    const r = await client.query(`DELETE FROM galeria_items WHERE id = $1 RETURNING *`, [
      Number.parseInt(id, 10),
    ]);
    return r.rows[0] || null;
  }
}

module.exports = GaleriaItem;
