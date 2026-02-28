const pool = require("../config/database");

const DEFAULT_CARDS = [
  {
    titulo: "Gestión clara",
    descripcion: "Organiza torneos, equipos y cronogramas con una operación centralizada.",
    icono: "fa-layer-group",
  },
  {
    titulo: "Control deportivo",
    descripcion: "Administra planillas, estadísticas, reportes y seguimiento competitivo.",
    icono: "fa-clipboard-list",
  },
  {
    titulo: "Portal institucional",
    descripcion: "Publica novedades, galería y contacto oficial de LT&C desde el CMS.",
    icono: "fa-globe",
  },
];

class PortalContenido {
  static _schemaReady = false;

  static async asegurarEsquema(client = pool) {
    if (this._schemaReady && client === pool) return;

    await client.query(`
      CREATE TABLE IF NOT EXISTS portal_contenido (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        hero_title TEXT NOT NULL DEFAULT 'Organiza tus torneos de forma rápida',
        hero_description TEXT NOT NULL DEFAULT 'Gestiona campeonatos, categorías y equipos en una plataforma clara, moderna y enfocada en el rendimiento deportivo.',
        hero_chip VARCHAR(120) NOT NULL DEFAULT 'EMPIEZA UNA DEMO',
        hero_cta_label VARCHAR(120) NOT NULL DEFAULT 'Entra',
        about_title VARCHAR(180) NOT NULL DEFAULT 'Loja Torneos & Competencias',
        about_text_1 TEXT NOT NULL DEFAULT 'LT&C impulsa campeonatos de futbol con una gestion ordenada de equipos, jugadores, calendarios, reportes y control administrativo.',
        about_text_2 TEXT NOT NULL DEFAULT 'Nuestro objetivo es brindar una experiencia clara tanto para organizadores como para dirigentes y aficionados.',
        about_image_url TEXT,
        contact_title VARCHAR(180) NOT NULL DEFAULT 'Escríbenos',
        contact_description TEXT NOT NULL DEFAULT 'Si quieres organizar tu campeonato con LT&C, contáctanos y te ayudamos a implementar todo el flujo deportivo.',
        contact_email VARCHAR(180) NOT NULL DEFAULT 'lojatorneosycompetencia@gmail.com',
        contact_phone VARCHAR(40),
        facebook_url TEXT,
        instagram_url TEXT,
        whatsapp_url TEXT,
        cards_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const existing = await client.query(`SELECT id FROM portal_contenido WHERE id = 1 LIMIT 1`);
    if (!existing.rows.length) {
      await client.query(
        `
          INSERT INTO portal_contenido (
            id,
            facebook_url,
            instagram_url,
            whatsapp_url,
            cards_json
          )
          VALUES (
            1,
            $1,
            $2,
            $3,
            $4::jsonb
          )
        `,
        [
          "https://www.facebook.com/LojaTorneosCompetencia",
          "https://www.instagram.com/lojatorneoycompetencia",
          "https://wa.me/593982413081",
          JSON.stringify(DEFAULT_CARDS),
        ]
      );
    }

    if (client === pool) this._schemaReady = true;
  }

  static normalizarCards(cards) {
    if (!Array.isArray(cards)) return DEFAULT_CARDS;
    const clean = cards
      .slice(0, 3)
      .map((item, idx) => ({
        titulo: String(item?.titulo || DEFAULT_CARDS[idx]?.titulo || "").trim(),
        descripcion: String(item?.descripcion || DEFAULT_CARDS[idx]?.descripcion || "").trim(),
        icono: String(item?.icono || DEFAULT_CARDS[idx]?.icono || "fa-star").trim(),
      }))
      .filter((item) => item.titulo && item.descripcion);
    return clean.length ? clean : DEFAULT_CARDS;
  }

  static async obtener(client = pool) {
    await this.asegurarEsquema(client);
    const r = await client.query(`SELECT * FROM portal_contenido WHERE id = 1 LIMIT 1`);
    const row = r.rows[0] || null;
    if (!row) return null;
    return {
      ...row,
      cards_json: this.normalizarCards(row.cards_json),
    };
  }

  static async actualizar(data = {}, client = pool) {
    await this.asegurarEsquema(client);
    const actual = await this.obtener(client);
    if (!actual) throw new Error("Contenido de portal no disponible");

    const payload = {
      hero_title:
        data.hero_title !== undefined ? String(data.hero_title || "").trim() : actual.hero_title,
      hero_description:
        data.hero_description !== undefined
          ? String(data.hero_description || "").trim()
          : actual.hero_description,
      hero_chip:
        data.hero_chip !== undefined ? String(data.hero_chip || "").trim() : actual.hero_chip,
      hero_cta_label:
        data.hero_cta_label !== undefined
          ? String(data.hero_cta_label || "").trim()
          : actual.hero_cta_label,
      about_title:
        data.about_title !== undefined ? String(data.about_title || "").trim() : actual.about_title,
      about_text_1:
        data.about_text_1 !== undefined
          ? String(data.about_text_1 || "").trim()
          : actual.about_text_1,
      about_text_2:
        data.about_text_2 !== undefined
          ? String(data.about_text_2 || "").trim()
          : actual.about_text_2,
      about_image_url:
        data.about_image_url !== undefined
          ? String(data.about_image_url || "").trim() || null
          : actual.about_image_url,
      contact_title:
        data.contact_title !== undefined
          ? String(data.contact_title || "").trim()
          : actual.contact_title,
      contact_description:
        data.contact_description !== undefined
          ? String(data.contact_description || "").trim()
          : actual.contact_description,
      contact_email:
        data.contact_email !== undefined
          ? String(data.contact_email || "").trim()
          : actual.contact_email,
      contact_phone:
        data.contact_phone !== undefined
          ? String(data.contact_phone || "").trim() || null
          : actual.contact_phone,
      facebook_url:
        data.facebook_url !== undefined
          ? String(data.facebook_url || "").trim() || null
          : actual.facebook_url,
      instagram_url:
        data.instagram_url !== undefined
          ? String(data.instagram_url || "").trim() || null
          : actual.instagram_url,
      whatsapp_url:
        data.whatsapp_url !== undefined
          ? String(data.whatsapp_url || "").trim() || null
          : actual.whatsapp_url,
      cards_json:
        data.cards_json !== undefined ? this.normalizarCards(data.cards_json) : actual.cards_json,
    };

    if (!payload.hero_title || !payload.hero_description || !payload.about_title || !payload.contact_title) {
      throw new Error("hero_title, hero_description, about_title y contact_title son obligatorios");
    }
    if (!payload.contact_email) {
      throw new Error("contact_email es obligatorio");
    }

    const r = await client.query(
      `
        UPDATE portal_contenido
        SET hero_title = $1,
            hero_description = $2,
            hero_chip = $3,
            hero_cta_label = $4,
            about_title = $5,
            about_text_1 = $6,
            about_text_2 = $7,
            about_image_url = $8,
            contact_title = $9,
            contact_description = $10,
            contact_email = $11,
            contact_phone = $12,
            facebook_url = $13,
            instagram_url = $14,
            whatsapp_url = $15,
            cards_json = $16::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
        RETURNING *
      `,
      [
        payload.hero_title,
        payload.hero_description,
        payload.hero_chip,
        payload.hero_cta_label,
        payload.about_title,
        payload.about_text_1,
        payload.about_text_2,
        payload.about_image_url,
        payload.contact_title,
        payload.contact_description,
        payload.contact_email,
        payload.contact_phone,
        payload.facebook_url,
        payload.instagram_url,
        payload.whatsapp_url,
        JSON.stringify(payload.cards_json),
      ]
    );

    return {
      ...(r.rows[0] || null),
      cards_json: payload.cards_json,
    };
  }
}

module.exports = PortalContenido;
