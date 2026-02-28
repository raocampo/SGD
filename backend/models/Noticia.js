const pool = require("../config/database");

class Noticia {
  static _schemaReady = false;

  static slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
  }

  static async asegurarEsquema(client = pool) {
    if (this._schemaReady && client === pool) return;

    await client.query(`
      CREATE TABLE IF NOT EXISTS noticias (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(180) NOT NULL,
        slug VARCHAR(160) NOT NULL UNIQUE,
        resumen TEXT,
        contenido TEXT NOT NULL,
        imagen_portada_url TEXT,
        estado VARCHAR(20) NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicada')),
        fuente_sistema VARCHAR(40) NOT NULL DEFAULT 'LOJA_ADMIN_WEB',
        autor_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        publicada_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    if (client === pool) this._schemaReady = true;
  }

  static async uniqueSlug(baseSlug, excludeId = null, client = pool) {
    const base = this.slugify(baseSlug) || `noticia-${Date.now()}`;
    let slug = base;
    let index = 2;

    while (true) {
      const params = excludeId ? [slug, excludeId] : [slug];
      const sql = excludeId
        ? `SELECT 1 FROM noticias WHERE slug = $1 AND id <> $2 LIMIT 1`
        : `SELECT 1 FROM noticias WHERE slug = $1 LIMIT 1`;
      const r = await client.query(sql, params);
      if (!r.rows.length) return slug;
      slug = `${base}-${index}`;
      index += 1;
    }
  }

  static async crear(data = {}, client = pool) {
    await this.asegurarEsquema(client);

    const titulo = String(data.titulo || "").trim();
    const contenido = String(data.contenido || "").trim();
    if (!titulo || !contenido) {
      throw new Error("titulo y contenido son obligatorios");
    }

    const slug = await this.uniqueSlug(data.slug || titulo, null, client);
    const resumen = String(data.resumen || "").trim() || null;
    const imagenPortadaUrl = String(data.imagen_portada_url || "").trim() || null;
    const estado = String(data.estado || "borrador").trim().toLowerCase() === "publicada" ? "publicada" : "borrador";
    const publicadaAt = estado === "publicada" ? "CURRENT_TIMESTAMP" : "NULL";

    const r = await client.query(
      `
        INSERT INTO noticias (
          titulo, slug, resumen, contenido, imagen_portada_url,
          estado, fuente_sistema, autor_usuario_id, publicada_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${publicadaAt})
        RETURNING *
      `,
      [
        titulo,
        slug,
        resumen,
        contenido,
        imagenPortadaUrl,
        estado,
        String(data.fuente_sistema || "LOJA_ADMIN_WEB").trim() || "LOJA_ADMIN_WEB",
        data.autor_usuario_id ? Number.parseInt(data.autor_usuario_id, 10) : null,
      ]
    );

    return r.rows[0] || null;
  }

  static async listar({ onlyPublished = false } = {}, client = pool) {
    await this.asegurarEsquema(client);
    const r = await client.query(
      `
        SELECT
          n.*,
          u.nombre AS autor_nombre
        FROM noticias n
        LEFT JOIN usuarios u ON u.id = n.autor_usuario_id
        ${onlyPublished ? "WHERE estado = 'publicada'" : ""}
        ORDER BY COALESCE(n.publicada_at, n.created_at) DESC, n.id DESC
      `
    );
    return r.rows;
  }

  static async obtenerPorId(id, client = pool) {
    await this.asegurarEsquema(client);
    const r = await client.query(
      `
        SELECT
          n.*,
          u.nombre AS autor_nombre
        FROM noticias n
        LEFT JOIN usuarios u ON u.id = n.autor_usuario_id
        WHERE n.id = $1
        LIMIT 1
      `,
      [
      Number.parseInt(id, 10),
      ]
    );
    return r.rows[0] || null;
  }

  static async obtenerPorSlug(slug, client = pool) {
    await this.asegurarEsquema(client);
    const r = await client.query(
      `
        SELECT
          n.*,
          u.nombre AS autor_nombre
        FROM noticias n
        LEFT JOIN usuarios u ON u.id = n.autor_usuario_id
        WHERE n.slug = $1
        LIMIT 1
      `,
      [String(slug || "").trim()]
    );
    return r.rows[0] || null;
  }

  static async actualizar(id, data = {}, client = pool) {
    await this.asegurarEsquema(client);
    const actual = await this.obtenerPorId(id, client);
    if (!actual) throw new Error("Noticia no encontrada");

    const titulo = data.titulo !== undefined ? String(data.titulo || "").trim() : actual.titulo;
    const contenido = data.contenido !== undefined ? String(data.contenido || "").trim() : actual.contenido;
    if (!titulo || !contenido) throw new Error("titulo y contenido son obligatorios");

    const slug =
      data.slug !== undefined || data.titulo !== undefined
        ? await this.uniqueSlug(data.slug || titulo, Number.parseInt(id, 10), client)
        : actual.slug;

    const r = await client.query(
      `
        UPDATE noticias
        SET titulo = $1,
            slug = $2,
            resumen = $3,
            contenido = $4,
            imagen_portada_url = $5,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING *
      `,
      [
        titulo,
        slug,
        data.resumen !== undefined ? String(data.resumen || "").trim() || null : actual.resumen,
        contenido,
        data.imagen_portada_url !== undefined
          ? String(data.imagen_portada_url || "").trim() || null
          : actual.imagen_portada_url,
        Number.parseInt(id, 10),
      ]
    );

    return r.rows[0] || null;
  }

  static async eliminar(id, client = pool) {
    await this.asegurarEsquema(client);
    const r = await client.query(`DELETE FROM noticias WHERE id = $1 RETURNING *`, [
      Number.parseInt(id, 10),
    ]);
    return r.rows[0] || null;
  }

  static async cambiarEstado(id, estado, client = pool) {
    await this.asegurarEsquema(client);
    const status = String(estado || "").trim().toLowerCase() === "publicada" ? "publicada" : "borrador";
    const r = await client.query(
      `
        UPDATE noticias
        SET estado = $1,
            publicada_at = CASE WHEN $1 = 'publicada' THEN COALESCE(publicada_at, CURRENT_TIMESTAMP) ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `,
      [status, Number.parseInt(id, 10)]
    );
    return r.rows[0] || null;
  }
}

module.exports = Noticia;
