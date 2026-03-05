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

  static limpiarTexto(value, maxLen = 0) {
    const texto = String(value || "").trim();
    if (!maxLen || texto.length <= maxLen) return texto;
    return texto.slice(0, maxLen).trim();
  }

  static normalizarUrl(value, { allowRelative = true } = {}) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    if (raw.length > 2048) throw new Error("URL invalida o demasiado larga");
    if (/^https?:\/\//i.test(raw)) return raw;
    if (allowRelative && (raw.startsWith("/") || raw.startsWith("assets/") || raw.startsWith("uploads/"))) {
      return raw;
    }
    throw new Error("URL invalida. Use http/https o ruta relativa valida");
  }

  static validarEmail(email) {
    const val = String(email || "").trim().toLowerCase();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    if (!ok) throw new Error("contact_email invalido");
    return val;
  }

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
        titulo: this.limpiarTexto(item?.titulo || DEFAULT_CARDS[idx]?.titulo || "", 120),
        descripcion: this.limpiarTexto(item?.descripcion || DEFAULT_CARDS[idx]?.descripcion || "", 320),
        icono: /^fa-[a-z0-9-]+$/i.test(String(item?.icono || "").trim())
          ? String(item?.icono || "").trim()
          : String(DEFAULT_CARDS[idx]?.icono || "fa-star"),
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
        data.hero_title !== undefined ? this.limpiarTexto(data.hero_title, 180) : actual.hero_title,
      hero_description:
        data.hero_description !== undefined
          ? this.limpiarTexto(data.hero_description, 1200)
          : actual.hero_description,
      hero_chip:
        data.hero_chip !== undefined ? this.limpiarTexto(data.hero_chip, 120) : actual.hero_chip,
      hero_cta_label:
        data.hero_cta_label !== undefined
          ? this.limpiarTexto(data.hero_cta_label, 120)
          : actual.hero_cta_label,
      about_title:
        data.about_title !== undefined ? this.limpiarTexto(data.about_title, 180) : actual.about_title,
      about_text_1:
        data.about_text_1 !== undefined
          ? this.limpiarTexto(data.about_text_1, 1400)
          : actual.about_text_1,
      about_text_2:
        data.about_text_2 !== undefined
          ? this.limpiarTexto(data.about_text_2, 1400)
          : actual.about_text_2,
      about_image_url:
        data.about_image_url !== undefined
          ? this.normalizarUrl(data.about_image_url, { allowRelative: true })
          : actual.about_image_url,
      contact_title:
        data.contact_title !== undefined
          ? this.limpiarTexto(data.contact_title, 180)
          : actual.contact_title,
      contact_description:
        data.contact_description !== undefined
          ? this.limpiarTexto(data.contact_description, 1400)
          : actual.contact_description,
      contact_email:
        data.contact_email !== undefined
          ? this.validarEmail(data.contact_email)
          : actual.contact_email,
      contact_phone:
        data.contact_phone !== undefined
          ? this.limpiarTexto(data.contact_phone, 40) || null
          : actual.contact_phone,
      facebook_url:
        data.facebook_url !== undefined
          ? this.normalizarUrl(data.facebook_url, { allowRelative: false })
          : actual.facebook_url,
      instagram_url:
        data.instagram_url !== undefined
          ? this.normalizarUrl(data.instagram_url, { allowRelative: false })
          : actual.instagram_url,
      whatsapp_url:
        data.whatsapp_url !== undefined
          ? this.normalizarUrl(data.whatsapp_url, { allowRelative: false })
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
