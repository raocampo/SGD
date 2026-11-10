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
