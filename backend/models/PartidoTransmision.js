const pool = require("../config/database");

const CAMPOS_EDITABLES = [
  "titulo",
  "descripcion",
  "plataforma",
  "url_publica",
  "embed_url",
  "estado",
  "fecha_inicio_programada",
  "thumbnail_url",
  "campeonato_id",
  "evento_id",
  "enlaces",
];

// Transmisión simultánea: varios enlaces del mismo directo (YouTube, Facebook,
// TikTok...). plataforma/url_publica quedan como el enlace principal (el
// primero) para el código que solo conoce un enlace.
const ENLACES_MAX = 8;
const URL_HTTP_RE = /^https?:\/\/[^\s<>"']+$/i;

class PartidoTransmision {
  static _tablaAsegurada = false;
  static _initTablaPromise = null;

  static async asegurarTabla(dbPool) {
    if (!dbPool && this._tablaAsegurada) return;

    const db = dbPool || pool;
    const init = async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS partido_transmisiones (
          id SERIAL PRIMARY KEY,
          partido_id INTEGER NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
          campeonato_id INTEGER REFERENCES campeonatos(id) ON DELETE SET NULL,
          evento_id INTEGER REFERENCES eventos(id) ON DELETE SET NULL,
          titulo VARCHAR(200),
          descripcion TEXT,
          plataforma VARCHAR(60),
          url_publica TEXT,
          embed_url TEXT,
          estado VARCHAR(30) NOT NULL DEFAULT 'programada',
          fecha_inicio_programada TIMESTAMPTZ,
          fecha_inicio_real TIMESTAMPTZ,
          fecha_fin_real TIMESTAMPTZ,
          thumbnail_url TEXT,
          destacado BOOLEAN NOT NULL DEFAULT FALSE,
          creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      // Migración: agregar destacado si ya existe la tabla sin esa columna.
      await db.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'partido_transmisiones' AND column_name = 'destacado'
          ) THEN
            ALTER TABLE partido_transmisiones ADD COLUMN destacado BOOLEAN NOT NULL DEFAULT FALSE;
          END IF;
        END $$;
      `);
      // Migración: overlay_token + director_token (tokens para Socket.io overlay).
      await db.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'partido_transmisiones' AND column_name = 'overlay_token'
          ) THEN
            ALTER TABLE partido_transmisiones ADD COLUMN overlay_token UUID DEFAULT gen_random_uuid() UNIQUE;
          END IF;
        END $$;
      `);
      await db.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'partido_transmisiones' AND column_name = 'director_token'
          ) THEN
            ALTER TABLE partido_transmisiones ADD COLUMN director_token UUID DEFAULT gen_random_uuid() UNIQUE;
          END IF;
        END $$;
      `);
      await db.query(`
        UPDATE partido_transmisiones
        SET overlay_token = gen_random_uuid()
        WHERE overlay_token IS NULL
      `);
      // Migración 079: enlaces por plataforma (transmisión simultánea).
      await db.query(`
        ALTER TABLE partido_transmisiones
        ADD COLUMN IF NOT EXISTS enlaces JSONB NOT NULL DEFAULT '[]'::jsonb
      `);
      await db.query(`
        UPDATE partido_transmisiones
        SET enlaces = jsonb_build_array(
          jsonb_build_object('plataforma', COALESCE(plataforma, ''), 'url', url_publica)
        )
        WHERE COALESCE(TRIM(url_publica), '') <> ''
          AND enlaces = '[]'::jsonb
      `);
      await db.query(`
        UPDATE partido_transmisiones
        SET director_token = gen_random_uuid()
        WHERE director_token IS NULL
      `);
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_transmisiones_partido ON partido_transmisiones(partido_id)
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_transmisiones_estado ON partido_transmisiones(estado)
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_transmisiones_campeonato ON partido_transmisiones(campeonato_id)
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_transmisiones_overlay_token ON partido_transmisiones(overlay_token)
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_transmisiones_director_token ON partido_transmisiones(director_token)
      `);
    };

    if (dbPool) {
      await init();
      return;
    }

    if (!this._initTablaPromise) {
      this._initTablaPromise = init()
        .then(() => {
          this._tablaAsegurada = true;
        })
        .finally(() => {
          this._initTablaPromise = null;
        });
    }

    await this._initTablaPromise;
  }

  // Normaliza la lista de enlaces: solo URLs http(s), sin repetidos, máx. 8.
  static normalizarEnlaces(lista) {
    let items = lista;
    if (typeof items === "string") {
      try { items = JSON.parse(items); } catch (_) { items = []; }
    }
    if (!Array.isArray(items)) return [];
    const vistos = new Set();
    const salida = [];
    for (const item of items) {
      const url = String(item?.url || "").trim();
      if (!url) continue;
      if (!URL_HTTP_RE.test(url)) {
        throw new Error(`URL inválida: ${url.slice(0, 80)}. Usa un enlace que empiece con http:// o https://`);
      }
      if (vistos.has(url)) continue;
      vistos.add(url);
      salida.push({ plataforma: String(item?.plataforma || "").trim().slice(0, 60), url });
      if (salida.length >= ENLACES_MAX) break;
    }
    return salida;
  }

  // Sincroniza enlaces con plataforma/url_publica antes de guardar.
  // Con enlaces: el primero pasa a ser el principal. Sin enlaces (clientes
  // anteriores): la url_publica recibida se convierte en la lista.
  static prepararEnlaces(data) {
    const out = { ...data };
    if (out.enlaces !== undefined) {
      const lista = PartidoTransmision.normalizarEnlaces(out.enlaces);
      out.enlaces = JSON.stringify(lista);
      out.url_publica = lista[0]?.url || null;
      out.plataforma = lista[0]?.plataforma || null;
    } else if (out.url_publica !== undefined) {
      const lista = PartidoTransmision.normalizarEnlaces(
        out.url_publica ? [{ plataforma: out.plataforma, url: out.url_publica }] : []
      );
      out.enlaces = JSON.stringify(lista);
      out.url_publica = lista[0]?.url || null;
    }
    return out;
  }

  static enlacesDeFila(row) {
    let lista = row?.enlaces;
    if (typeof lista === "string") {
      try { lista = JSON.parse(lista); } catch (_) { lista = []; }
    }
    if (Array.isArray(lista) && lista.length) return lista;
    return row?.url_publica ? [{ plataforma: row.plataforma || "", url: row.url_publica }] : [];
  }

  static limpiar(row) {
    if (!row) return null;
    return {
      id: row.id,
      partido_id: row.partido_id,
      campeonato_id: row.campeonato_id,
      evento_id: row.evento_id,
      titulo: row.titulo,
      descripcion: row.descripcion,
      plataforma: row.plataforma,
      url_publica: row.url_publica,
      enlaces: PartidoTransmision.enlacesDeFila(row),
      embed_url: row.embed_url,
      estado: row.estado,
      fecha_inicio_programada: row.fecha_inicio_programada,
      fecha_inicio_real: row.fecha_inicio_real,
      fecha_fin_real: row.fecha_fin_real,
      thumbnail_url: row.thumbnail_url,
      destacado: row.destacado === true || row.destacado === 'true',
      overlay_token: row.overlay_token,
      director_token: row.director_token,
      creado_por: row.creado_por,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  static async obtenerPorPartido(partidoId) {
    await this.asegurarTabla();

    const result = await pool.query(
      "SELECT * FROM partido_transmisiones WHERE partido_id = $1 LIMIT 1",
      [partidoId]
    );
    return result.rows.length ? PartidoTransmision.limpiar(result.rows[0]) : null;
  }

  static async crear(datos) {
    await this.asegurarTabla();

    const data = PartidoTransmision.prepararEnlaces(datos);
    const {
      partido_id,
      campeonato_id = null,
      evento_id = null,
      titulo = null,
      descripcion = null,
      plataforma = null,
      url_publica = null,
      embed_url = null,
      estado = 'programada',
      fecha_inicio_programada = null,
      thumbnail_url = null,
      creado_por = null,
      enlaces = "[]",
    } = data;

    const result = await pool.query(
      `INSERT INTO partido_transmisiones
        (partido_id, campeonato_id, evento_id, titulo, descripcion, plataforma,
         url_publica, embed_url, estado, fecha_inicio_programada, thumbnail_url, creado_por,
         enlaces)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
       RETURNING *`,
      [
        partido_id, campeonato_id, evento_id, titulo, descripcion, plataforma,
        url_publica, embed_url, estado, fecha_inicio_programada, thumbnail_url, creado_por,
        enlaces || "[]",
      ]
    );
    return PartidoTransmision.limpiar(result.rows[0]);
  }

  static async actualizar(id, datos) {
    await this.asegurarTabla();

    const data = PartidoTransmision.prepararEnlaces(datos);
    const sets = [];
    const values = [];
    let idx = 1;

    for (const campo of CAMPOS_EDITABLES) {
      if (Object.prototype.hasOwnProperty.call(data, campo) && data[campo] !== undefined) {
        sets.push(campo === "enlaces" ? `enlaces = $${idx++}::jsonb` : `${campo} = $${idx++}`);
        values.push(data[campo]);
      }
    }

    if (!sets.length) {
      const current = await pool.query(
        "SELECT * FROM partido_transmisiones WHERE id = $1",
        [id]
      );
      return current.rows.length ? PartidoTransmision.limpiar(current.rows[0]) : null;
    }

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE partido_transmisiones SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows.length ? PartidoTransmision.limpiar(result.rows[0]) : null;
  }

  static async iniciar(id) {
    await this.asegurarTabla();

    const result = await pool.query(
      `UPDATE partido_transmisiones
       SET estado = 'en_vivo', fecha_inicio_real = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows.length ? PartidoTransmision.limpiar(result.rows[0]) : null;
  }

  static async finalizar(id) {
    await this.asegurarTabla();

    const result = await pool.query(
      `UPDATE partido_transmisiones
       SET estado = 'finalizada', fecha_fin_real = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows.length ? PartidoTransmision.limpiar(result.rows[0]) : null;
  }

  static async cancelar(id) {
    await this.asegurarTabla();

    const result = await pool.query(
      `UPDATE partido_transmisiones
       SET estado = 'cancelada', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows.length ? PartidoTransmision.limpiar(result.rows[0]) : null;
  }

  // Vuelve a «programada» una transmisión finalizada o cancelada (pruebas,
  // partido reprogramado o finalizada por error). Conserva enlaces y overlay.
  static async reabrir(id) {
    await this.asegurarTabla();

    const result = await pool.query(
      `UPDATE partido_transmisiones
       SET estado = 'programada', fecha_fin_real = NULL, updated_at = NOW()
       WHERE id = $1 AND estado IN ('finalizada', 'cancelada') RETURNING *`,
      [id]
    );
    return result.rows.length ? PartidoTransmision.limpiar(result.rows[0]) : null;
  }

  static async listarActivas() {
    await this.asegurarTabla();

    const result = await pool.query(
      `SELECT * FROM partido_transmisiones WHERE estado = 'en_vivo' ORDER BY fecha_inicio_real DESC`
    );
    return result.rows.map(PartidoTransmision.limpiar);
  }

  static async listarActivasPorCampeonato(campeonatoId) {
    await this.asegurarTabla();

    const result = await pool.query(
      `SELECT * FROM partido_transmisiones
       WHERE estado = 'en_vivo' AND campeonato_id = $1
       ORDER BY fecha_inicio_real DESC`,
      [campeonatoId]
    );
    return result.rows.map(PartidoTransmision.limpiar);
  }

  static async listarPorCampeonato(campeonatoId) {
    await this.asegurarTabla();

    const result = await pool.query(
      `SELECT t.*,
        p.jornada, p.fecha_partido, p.estado AS partido_estado,
        p.equipo_local_id, p.equipo_visitante_id,
        el.nombre AS equipo_local_nombre,
        ev2.nombre AS equipo_visitante_nombre
       FROM partido_transmisiones t
       LEFT JOIN partidos p ON p.id = t.partido_id
       LEFT JOIN equipos el ON el.id = p.equipo_local_id
       LEFT JOIN equipos ev2 ON ev2.id = p.equipo_visitante_id
       WHERE t.campeonato_id = $1
       ORDER BY t.created_at DESC`,
      [campeonatoId]
    );
    return result.rows.map((row) => ({
      ...PartidoTransmision.limpiar(row),
      jornada: row.jornada,
      fecha_partido: row.fecha_partido,
      partido_estado: row.partido_estado,
      equipo_local_id: row.equipo_local_id,
      equipo_visitante_id: row.equipo_visitante_id,
      equipo_local_nombre: row.equipo_local_nombre,
      equipo_visitante_nombre: row.equipo_visitante_nombre,
    }));
  }

  static async toggleDestacado(id) {
    await this.asegurarTabla();

    const result = await pool.query(
      `UPDATE partido_transmisiones
       SET destacado = NOT destacado, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows.length ? PartidoTransmision.limpiar(result.rows[0]) : null;
  }

  // Portada y landing del organizador: partidos en vivo y próximos
  // programados (con enlace) de campeonatos públicos. Las transmisiones en
  // borrador no se muestran. organizadorId filtra por dueño del campeonato.
  static async listarPublicasEnVivo({ organizadorId = null, limite = 12 } = {}) {
    await this.asegurarTabla();
    const orgId = Number.parseInt(organizadorId, 10);
    const tope = Math.min(Math.max(Number.parseInt(limite, 10) || 12, 1), 30);
    const result = await pool.query(
      `
        SELECT t.*,
               COALESCE(t.campeonato_id, p.campeonato_id) AS campeonato_id,
               p.evento_id AS partido_evento_id,
               p.fecha_partido, p.hora_partido, p.cancha, p.jornada,
               el.nombre AS equipo_local_nombre, el.logo_url AS equipo_local_logo,
               ev2.nombre AS equipo_visitante_nombre, ev2.logo_url AS equipo_visitante_logo,
               c.nombre AS campeonato_nombre, c.logo_url AS campeonato_logo,
               evt.nombre AS evento_nombre
        FROM partido_transmisiones t
        JOIN partidos p ON p.id = t.partido_id
        JOIN campeonatos c ON c.id = p.campeonato_id
        LEFT JOIN eventos evt ON evt.id = p.evento_id
        LEFT JOIN equipos el ON el.id = p.equipo_local_id
        LEFT JOIN equipos ev2 ON ev2.id = p.equipo_visitante_id
        WHERE LOWER(COALESCE(c.estado, '')) IN ('inscripcion', 'en_curso', 'finalizado')
          AND ($1::int IS NULL OR c.creador_usuario_id = $1::int)
          AND (
            t.estado = 'en_vivo'
            OR (
              t.estado = 'programada'
              AND (t.url_publica IS NOT NULL OR jsonb_array_length(COALESCE(t.enlaces, '[]'::jsonb)) > 0)
              AND (
                t.fecha_inicio_programada BETWEEN NOW() - INTERVAL '3 hours' AND NOW() + INTERVAL '7 days'
                OR (
                  t.fecha_inicio_programada IS NULL
                  AND p.fecha_partido BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
                )
              )
            )
          )
        ORDER BY (t.estado = 'en_vivo') DESC,
                 COALESCE(t.fecha_inicio_programada, (p.fecha_partido + COALESCE(p.hora_partido, '00:00'::time))::timestamptz) ASC NULLS LAST,
                 t.id
        LIMIT $2
      `,
      [Number.isFinite(orgId) && orgId > 0 ? orgId : null, tope]
    );
    return result.rows.map((row) => ({
      id: row.id,
      partido_id: row.partido_id,
      campeonato_id: Number(row.campeonato_id) || null,
      evento_id: Number(row.partido_evento_id) || null,
      titulo: row.titulo,
      plataforma: row.plataforma,
      url_publica: row.url_publica,
      enlaces: PartidoTransmision.enlacesDeFila(row),
      estado: row.estado,
      fecha_inicio_programada: row.fecha_inicio_programada,
      fecha_inicio_real: row.fecha_inicio_real,
      fecha_partido: row.fecha_partido,
      hora_partido: row.hora_partido,
      cancha: row.cancha,
      jornada: row.jornada,
      equipo_local_nombre: row.equipo_local_nombre,
      equipo_local_logo: row.equipo_local_logo,
      equipo_visitante_nombre: row.equipo_visitante_nombre,
      equipo_visitante_logo: row.equipo_visitante_logo,
      campeonato_nombre: row.campeonato_nombre,
      campeonato_logo: row.campeonato_logo,
      evento_nombre: row.evento_nombre,
    }));
  }

  static async listarDestacadas() {
    await this.asegurarTabla();

    const result = await pool.query(
      `SELECT * FROM partido_transmisiones
       WHERE destacado = TRUE AND estado IN ('en_vivo', 'programada')
       ORDER BY fecha_inicio_programada ASC NULLS LAST`
    );
    return result.rows.map(PartidoTransmision.limpiar);
  }
}

module.exports = PartidoTransmision;
