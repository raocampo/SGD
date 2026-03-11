const pool = require("../config/database");

class OrganizadorPortal {
  static _schemaReady = false;

  static async asegurarEsquema(client = pool) {
    if (this._schemaReady && client === pool) return;

    await client.query(`
      CREATE TABLE IF NOT EXISTS organizador_portal_config (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
        organizacion_nombre VARCHAR(180),
        logo_url TEXT,
        lema VARCHAR(220),
        hero_title VARCHAR(220),
        hero_description TEXT,
        hero_chip VARCHAR(120),
        hero_cta_label VARCHAR(120),
        hero_image_url TEXT,
        about_title VARCHAR(180),
        about_text_1 TEXT,
        about_text_2 TEXT,
        contact_email VARCHAR(180),
        contact_phone VARCHAR(40),
        facebook_url TEXT,
        instagram_url TEXT,
        whatsapp_url TEXT,
        color_primario VARCHAR(20),
        color_secundario VARCHAR(20),
        color_acento VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_organizador_portal_config_usuario
      ON organizador_portal_config(usuario_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS organizador_portal_media (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        campeonato_id INTEGER REFERENCES campeonatos(id) ON DELETE CASCADE,
        tipo VARCHAR(40) NOT NULL CHECK (tipo IN (
          'landing_hero',
          'landing_gallery',
          'campeonato_card',
          'campeonato_gallery'
        )),
        titulo VARCHAR(180),
        descripcion TEXT,
        imagen_url TEXT NOT NULL,
        orden INTEGER NOT NULL DEFAULT 1,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_organizador_portal_media_usuario
      ON organizador_portal_media(usuario_id, tipo, activo, orden, id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_organizador_portal_media_campeonato
      ON organizador_portal_media(campeonato_id, tipo, activo, orden, id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS organizador_portal_auspiciantes (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        nombre VARCHAR(180) NOT NULL,
        logo_url TEXT NOT NULL,
        enlace_url TEXT,
        orden INTEGER NOT NULL DEFAULT 1,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_organizador_portal_auspiciantes_usuario
      ON organizador_portal_auspiciantes(usuario_id, activo, orden, id)
    `);

    await client.query(`
      INSERT INTO organizador_portal_config (
        usuario_id,
        organizacion_nombre,
        contact_email
      )
      SELECT
        u.id,
        NULLIF(TRIM(COALESCE(u.organizacion_nombre, u.nombre, '')), ''),
        NULLIF(TRIM(COALESCE(u.email, '')), '')
      FROM usuarios u
      WHERE LOWER(COALESCE(u.rol, '')) = 'organizador'
        AND NOT EXISTS (
          SELECT 1
          FROM organizador_portal_config opc
          WHERE opc.usuario_id = u.id
        )
    `);

    if (client === pool) this._schemaReady = true;
  }

  static normalizarId(value) {
    const id = Number.parseInt(value, 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  static limpiarConfig(row) {
    if (!row) return null;
    return {
      id: Number(row.id),
      usuario_id: Number(row.usuario_id),
      organizacion_nombre: row.organizacion_nombre || "",
      logo_url: row.logo_url || "",
      lema: row.lema || "",
      hero_title: row.hero_title || "",
      hero_description: row.hero_description || "",
      hero_chip: row.hero_chip || "",
      hero_cta_label: row.hero_cta_label || "",
      hero_image_url: row.hero_image_url || "",
      about_title: row.about_title || "",
      about_text_1: row.about_text_1 || "",
      about_text_2: row.about_text_2 || "",
      contact_email: row.contact_email || "",
      contact_phone: row.contact_phone || "",
      facebook_url: row.facebook_url || "",
      instagram_url: row.instagram_url || "",
      whatsapp_url: row.whatsapp_url || "",
      color_primario: row.color_primario || "",
      color_secundario: row.color_secundario || "",
      color_acento: row.color_acento || "",
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    };
  }

  static limpiarMedia(row) {
    if (!row) return null;
    return {
      id: Number(row.id),
      usuario_id: Number(row.usuario_id),
      campeonato_id: this.normalizarId(row.campeonato_id),
      tipo: row.tipo,
      titulo: row.titulo || "",
      descripcion: row.descripcion || "",
      imagen_url: row.imagen_url || "",
      orden: Number(row.orden || 1),
      activo: row.activo === true,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    };
  }

  static limpiarAuspiciante(row) {
    if (!row) return null;
    return {
      id: Number(row.id),
      usuario_id: Number(row.usuario_id),
      nombre: row.nombre,
      logo_url: row.logo_url || "",
      enlace_url: row.enlace_url || "",
      orden: Number(row.orden || 1),
      activo: row.activo === true,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    };
  }

  static async obtenerConfig(usuarioId, client = pool) {
    await this.asegurarEsquema(client);
    const uId = this.normalizarId(usuarioId);
    if (!uId) return null;
    const result = await client.query(
      `SELECT * FROM organizador_portal_config WHERE usuario_id = $1 LIMIT 1`,
      [uId]
    );
    return this.limpiarConfig(result.rows[0] || null);
  }

  static async guardarConfig(usuarioId, data = {}, client = pool) {
    await this.asegurarEsquema(client);
    const uId = this.normalizarId(usuarioId);
    if (!uId) throw new Error("usuario_id invalido");

    const actual = (await this.obtenerConfig(uId, client)) || {
      organizacion_nombre: "",
      logo_url: "",
      lema: "",
      hero_title: "",
      hero_description: "",
      hero_chip: "",
      hero_cta_label: "",
      hero_image_url: "",
      about_title: "",
      about_text_1: "",
      about_text_2: "",
      contact_email: "",
      contact_phone: "",
      facebook_url: "",
      instagram_url: "",
      whatsapp_url: "",
      color_primario: "",
      color_secundario: "",
      color_acento: "",
    };

    const payload = {
      organizacion_nombre: String(data.organizacion_nombre ?? actual.organizacion_nombre ?? "").trim() || null,
      logo_url: String(data.logo_url ?? actual.logo_url ?? "").trim() || null,
      lema: String(data.lema ?? actual.lema ?? "").trim() || null,
      hero_title: String(data.hero_title ?? actual.hero_title ?? "").trim() || null,
      hero_description: String(data.hero_description ?? actual.hero_description ?? "").trim() || null,
      hero_chip: String(data.hero_chip ?? actual.hero_chip ?? "").trim() || null,
      hero_cta_label: String(data.hero_cta_label ?? actual.hero_cta_label ?? "").trim() || null,
      hero_image_url: String(data.hero_image_url ?? actual.hero_image_url ?? "").trim() || null,
      about_title: String(data.about_title ?? actual.about_title ?? "").trim() || null,
      about_text_1: String(data.about_text_1 ?? actual.about_text_1 ?? "").trim() || null,
      about_text_2: String(data.about_text_2 ?? actual.about_text_2 ?? "").trim() || null,
      contact_email: String(data.contact_email ?? actual.contact_email ?? "").trim() || null,
      contact_phone: String(data.contact_phone ?? actual.contact_phone ?? "").trim() || null,
      facebook_url: String(data.facebook_url ?? actual.facebook_url ?? "").trim() || null,
      instagram_url: String(data.instagram_url ?? actual.instagram_url ?? "").trim() || null,
      whatsapp_url: String(data.whatsapp_url ?? actual.whatsapp_url ?? "").trim() || null,
      color_primario: String(data.color_primario ?? actual.color_primario ?? "").trim() || null,
      color_secundario: String(data.color_secundario ?? actual.color_secundario ?? "").trim() || null,
      color_acento: String(data.color_acento ?? actual.color_acento ?? "").trim() || null,
    };

    const result = await client.query(
      `
        INSERT INTO organizador_portal_config (
          usuario_id,
          organizacion_nombre,
          logo_url,
          lema,
          hero_title,
          hero_description,
          hero_chip,
          hero_cta_label,
          hero_image_url,
          about_title,
          about_text_1,
          about_text_2,
          contact_email,
          contact_phone,
          facebook_url,
          instagram_url,
          whatsapp_url,
          color_primario,
          color_secundario,
          color_acento
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        )
        ON CONFLICT (usuario_id) DO UPDATE
        SET
          organizacion_nombre = EXCLUDED.organizacion_nombre,
          logo_url = EXCLUDED.logo_url,
          lema = EXCLUDED.lema,
          hero_title = EXCLUDED.hero_title,
          hero_description = EXCLUDED.hero_description,
          hero_chip = EXCLUDED.hero_chip,
          hero_cta_label = EXCLUDED.hero_cta_label,
          hero_image_url = EXCLUDED.hero_image_url,
          about_title = EXCLUDED.about_title,
          about_text_1 = EXCLUDED.about_text_1,
          about_text_2 = EXCLUDED.about_text_2,
          contact_email = EXCLUDED.contact_email,
          contact_phone = EXCLUDED.contact_phone,
          facebook_url = EXCLUDED.facebook_url,
          instagram_url = EXCLUDED.instagram_url,
          whatsapp_url = EXCLUDED.whatsapp_url,
          color_primario = EXCLUDED.color_primario,
          color_secundario = EXCLUDED.color_secundario,
          color_acento = EXCLUDED.color_acento,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `,
      [
        uId,
        payload.organizacion_nombre,
        payload.logo_url,
        payload.lema,
        payload.hero_title,
        payload.hero_description,
        payload.hero_chip,
        payload.hero_cta_label,
        payload.hero_image_url,
        payload.about_title,
        payload.about_text_1,
        payload.about_text_2,
        payload.contact_email,
        payload.contact_phone,
        payload.facebook_url,
        payload.instagram_url,
        payload.whatsapp_url,
        payload.color_primario,
        payload.color_secundario,
        payload.color_acento,
      ]
    );

    return this.limpiarConfig(result.rows[0] || null);
  }

  static async listarAuspiciantes(usuarioId, soloActivos = false, client = pool) {
    await this.asegurarEsquema(client);
    const uId = this.normalizarId(usuarioId);
    if (!uId) return [];
    const where = ["usuario_id = $1"];
    const params = [uId];
    if (soloActivos) where.push("activo = TRUE");
    const result = await client.query(
      `
        SELECT *
        FROM organizador_portal_auspiciantes
        WHERE ${where.join(" AND ")}
        ORDER BY orden ASC, id ASC
      `,
      params
    );
    return result.rows.map((row) => this.limpiarAuspiciante(row));
  }

  static async obtenerAuspiciantePorId(id, client = pool) {
    await this.asegurarEsquema(client);
    const aId = this.normalizarId(id);
    if (!aId) return null;
    const result = await client.query(
      `SELECT * FROM organizador_portal_auspiciantes WHERE id = $1 LIMIT 1`,
      [aId]
    );
    return this.limpiarAuspiciante(result.rows[0] || null);
  }

  static async crearAuspiciante(usuarioId, data = {}, client = pool) {
    await this.asegurarEsquema(client);
    const uId = this.normalizarId(usuarioId);
    if (!uId) throw new Error("usuario_id invalido");

    const nombre = String(data.nombre || "").trim();
    if (!nombre) throw new Error("nombre es obligatorio");
    const logoUrl = String(data.logo_url || "").trim();
    if (!logoUrl) throw new Error("logo_url es obligatorio");
    const orden = Number.parseInt(data.orden, 10);
    const activo =
      data.activo === undefined
        ? true
        : data.activo === true || String(data.activo).toLowerCase() === "true";

    const result = await client.query(
      `
        INSERT INTO organizador_portal_auspiciantes (
          usuario_id, nombre, logo_url, enlace_url, orden, activo
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        uId,
        nombre,
        logoUrl,
        String(data.enlace_url || "").trim() || null,
        Number.isFinite(orden) ? orden : 1,
        activo,
      ]
    );
    return this.limpiarAuspiciante(result.rows[0] || null);
  }

  static async actualizarAuspiciante(id, data = {}, client = pool) {
    await this.asegurarEsquema(client);
    const aId = this.normalizarId(id);
    if (!aId) throw new Error("id invalido");

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
      const logoUrl = String(data.logo_url || "").trim();
      if (!logoUrl) throw new Error("logo_url es obligatorio");
      campos.push(`logo_url = $${idx++}`);
      valores.push(logoUrl);
    }
    if (data.enlace_url !== undefined) {
      campos.push(`enlace_url = $${idx++}`);
      valores.push(String(data.enlace_url || "").trim() || null);
    }
    if (data.orden !== undefined) {
      const orden = Number.parseInt(data.orden, 10);
      campos.push(`orden = $${idx++}`);
      valores.push(Number.isFinite(orden) ? orden : 1);
    }
    if (data.activo !== undefined) {
      const activo = data.activo === true || String(data.activo).toLowerCase() === "true";
      campos.push(`activo = $${idx++}`);
      valores.push(activo);
    }

    if (!campos.length) throw new Error("No hay campos para actualizar");

    valores.push(aId);
    const result = await client.query(
      `
        UPDATE organizador_portal_auspiciantes
        SET ${campos.join(", ")}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${idx}
        RETURNING *
      `,
      valores
    );
    return this.limpiarAuspiciante(result.rows[0] || null);
  }

  static async eliminarAuspiciante(id, client = pool) {
    await this.asegurarEsquema(client);
    const aId = this.normalizarId(id);
    if (!aId) return null;
    const result = await client.query(
      `DELETE FROM organizador_portal_auspiciantes WHERE id = $1 RETURNING *`,
      [aId]
    );
    return this.limpiarAuspiciante(result.rows[0] || null);
  }

  static async listarAuspiciantesConFallback(usuarioId, client = pool) {
    const propios = await this.listarAuspiciantes(usuarioId, true, client);
    if (propios.length) return propios;

    const uId = this.normalizarId(usuarioId);
    if (!uId) return [];
    const result = await client.query(
      `
        SELECT DISTINCT ON (LOWER(TRIM(COALESCE(ca.nombre, ''))))
          ca.id,
          $1::int AS usuario_id,
          ca.nombre,
          ca.logo_url,
          NULL::text AS enlace_url,
          ca.orden,
          ca.activo,
          ca.created_at,
          ca.updated_at
        FROM campeonato_auspiciantes ca
        INNER JOIN campeonatos c ON c.id = ca.campeonato_id
        WHERE c.creador_usuario_id = $1
          AND ca.activo = TRUE
          AND NULLIF(TRIM(COALESCE(ca.logo_url, '')), '') IS NOT NULL
        ORDER BY LOWER(TRIM(COALESCE(ca.nombre, ''))), ca.orden ASC, ca.id ASC
      `,
      [uId]
    );
    return result.rows.map((row) => this.limpiarAuspiciante(row));
  }

  static async obtenerMediaCardCampeonato(usuarioId, campeonatoId, client = pool) {
    await this.asegurarEsquema(client);
    const uId = this.normalizarId(usuarioId);
    const cId = this.normalizarId(campeonatoId);
    if (!uId || !cId) return null;
    const result = await client.query(
      `
        SELECT *
        FROM organizador_portal_media
        WHERE usuario_id = $1
          AND campeonato_id = $2
          AND tipo = 'campeonato_card'
          AND activo = TRUE
        ORDER BY orden ASC, id ASC
        LIMIT 1
      `,
      [uId, cId]
    );
    return this.limpiarMedia(result.rows[0] || null);
  }

  static async listarMedia(usuarioId, filters = {}, client = pool) {
    await this.asegurarEsquema(client);
    const uId = this.normalizarId(usuarioId);
    if (!uId) return [];
    const where = ["usuario_id = $1"];
    const params = [uId];
    let idx = 2;

    if (filters.tipo !== undefined) {
      where.push(`tipo = $${idx++}`);
      params.push(String(filters.tipo || "").trim());
    }
    if (filters.campeonato_id !== undefined) {
      const campeonatoId = this.normalizarId(filters.campeonato_id);
      if (campeonatoId) {
        where.push(`campeonato_id = $${idx++}`);
        params.push(campeonatoId);
      } else {
        where.push(`campeonato_id IS NULL`);
      }
    }
    if (filters.activo !== undefined) {
      const activo = filters.activo === true || String(filters.activo).toLowerCase() === "true";
      where.push(`activo = $${idx++}`);
      params.push(activo);
    }

    const result = await client.query(
      `
        SELECT *
        FROM organizador_portal_media
        WHERE ${where.join(" AND ")}
        ORDER BY tipo ASC, orden ASC, id ASC
      `,
      params
    );
    return result.rows.map((row) => this.limpiarMedia(row));
  }

  static async obtenerMediaPorId(id, client = pool) {
    await this.asegurarEsquema(client);
    const mediaId = this.normalizarId(id);
    if (!mediaId) return null;
    const result = await client.query(
      `SELECT * FROM organizador_portal_media WHERE id = $1 LIMIT 1`,
      [mediaId]
    );
    return this.limpiarMedia(result.rows[0] || null);
  }

  static async crearMedia(usuarioId, data = {}, client = pool) {
    await this.asegurarEsquema(client);
    const uId = this.normalizarId(usuarioId);
    if (!uId) throw new Error("usuario_id invalido");

    const tipo = String(data.tipo || "").trim();
    if (!tipo) throw new Error("tipo es obligatorio");
    const imagenUrl = String(data.imagen_url || "").trim();
    if (!imagenUrl) throw new Error("imagen_url es obligatorio");

    const campeonatoId = this.normalizarId(data.campeonato_id);
    const orden = Number.parseInt(data.orden, 10);
    const activo =
      data.activo === undefined
        ? true
        : data.activo === true || String(data.activo).toLowerCase() === "true";

    const result = await client.query(
      `
        INSERT INTO organizador_portal_media (
          usuario_id, campeonato_id, tipo, titulo, descripcion, imagen_url, orden, activo
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        uId,
        campeonatoId,
        tipo,
        String(data.titulo || "").trim() || null,
        String(data.descripcion || "").trim() || null,
        imagenUrl,
        Number.isFinite(orden) ? orden : 1,
        activo,
      ]
    );
    return this.limpiarMedia(result.rows[0] || null);
  }

  static async actualizarMedia(id, data = {}, client = pool) {
    await this.asegurarEsquema(client);
    const mediaId = this.normalizarId(id);
    if (!mediaId) throw new Error("id invalido");

    const campos = [];
    const valores = [];
    let idx = 1;

    if (data.campeonato_id !== undefined) {
      const campeonatoId = this.normalizarId(data.campeonato_id);
      campos.push(`campeonato_id = $${idx++}`);
      valores.push(campeonatoId);
    }
    if (data.tipo !== undefined) {
      const tipo = String(data.tipo || "").trim();
      if (!tipo) throw new Error("tipo es obligatorio");
      campos.push(`tipo = $${idx++}`);
      valores.push(tipo);
    }
    if (data.titulo !== undefined) {
      campos.push(`titulo = $${idx++}`);
      valores.push(String(data.titulo || "").trim() || null);
    }
    if (data.descripcion !== undefined) {
      campos.push(`descripcion = $${idx++}`);
      valores.push(String(data.descripcion || "").trim() || null);
    }
    if (data.imagen_url !== undefined) {
      const imagenUrl = String(data.imagen_url || "").trim();
      if (!imagenUrl) throw new Error("imagen_url es obligatorio");
      campos.push(`imagen_url = $${idx++}`);
      valores.push(imagenUrl);
    }
    if (data.orden !== undefined) {
      const orden = Number.parseInt(data.orden, 10);
      campos.push(`orden = $${idx++}`);
      valores.push(Number.isFinite(orden) ? orden : 1);
    }
    if (data.activo !== undefined) {
      const activo = data.activo === true || String(data.activo).toLowerCase() === "true";
      campos.push(`activo = $${idx++}`);
      valores.push(activo);
    }

    if (!campos.length) throw new Error("No hay campos para actualizar");

    valores.push(mediaId);
    const result = await client.query(
      `
        UPDATE organizador_portal_media
        SET ${campos.join(", ")}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${idx}
        RETURNING *
      `,
      valores
    );
    return this.limpiarMedia(result.rows[0] || null);
  }

  static async eliminarMedia(id, client = pool) {
    await this.asegurarEsquema(client);
    const mediaId = this.normalizarId(id);
    if (!mediaId) return null;
    const result = await client.query(
      `DELETE FROM organizador_portal_media WHERE id = $1 RETURNING *`,
      [mediaId]
    );
    return this.limpiarMedia(result.rows[0] || null);
  }
}

module.exports = OrganizadorPortal;
