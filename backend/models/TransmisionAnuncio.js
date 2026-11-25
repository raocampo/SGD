"use strict";

// Publicidad pagada de las transmisiones: imágenes o videos cortos/reels que
// rotan en el overlay de OBS, además de los auspiciantes del campeonato.
// Alcance: todo el campeonato (transmision_id NULL) o una transmisión.

const pool = require("../config/database");
const PartidoTransmision = require("./PartidoTransmision");

const TIPOS = new Set(["imagen", "video"]);
const UBICACIONES = new Set(["esquina", "entretiempo", "ambos"]);
const DURACION_MIN = 3;
const DURACION_MAX = 120;

function aEntero(valor, porDefecto = null) {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? n : porDefecto;
}

function aBooleano(valor, porDefecto = false) {
  if (valor === undefined || valor === null || valor === "") return porDefecto;
  return valor === true || ["true", "1", "si", "sí", "on"].includes(String(valor).toLowerCase());
}

function aFecha(valor) {
  const texto = String(valor || "").trim();
  if (!texto) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw new Error("Fecha inválida (usa AAAA-MM-DD)");
  return texto;
}

class TransmisionAnuncio {
  static _tablaAsegurada = false;

  static async asegurarTabla() {
    if (this._tablaAsegurada) return;
    await PartidoTransmision.asegurarTabla();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transmision_anuncios (
        id SERIAL PRIMARY KEY,
        campeonato_id INTEGER NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
        transmision_id INTEGER REFERENCES partido_transmisiones(id) ON DELETE CASCADE,
        anunciante VARCHAR(120) NOT NULL,
        tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('imagen', 'video')),
        archivo_url TEXT NOT NULL,
        ubicacion VARCHAR(15) NOT NULL DEFAULT 'ambos' CHECK (ubicacion IN ('esquina', 'entretiempo', 'ambos')),
        duracion_segundos INTEGER NOT NULL DEFAULT 10,
        con_sonido BOOLEAN NOT NULL DEFAULT FALSE,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        orden INTEGER NOT NULL DEFAULT 0,
        fecha_desde DATE,
        fecha_hasta DATE,
        creado_por INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_transmision_anuncios_campeonato ON transmision_anuncios(campeonato_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_transmision_anuncios_transmision ON transmision_anuncios(transmision_id)`);
    this._tablaAsegurada = true;
  }

  static limpiar(row) {
    if (!row) return null;
    const fecha = (v) => (v instanceof Date
      ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`
      : v ? String(v).slice(0, 10) : null);
    return {
      id: row.id,
      campeonato_id: row.campeonato_id,
      transmision_id: row.transmision_id,
      anunciante: row.anunciante,
      tipo: row.tipo,
      archivo_url: row.archivo_url,
      ubicacion: row.ubicacion,
      duracion_segundos: row.duracion_segundos,
      con_sonido: row.con_sonido === true,
      activo: row.activo !== false,
      orden: row.orden,
      fecha_desde: fecha(row.fecha_desde),
      fecha_hasta: fecha(row.fecha_hasta),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  static normalizar(data = {}, actual = null) {
    const salida = {};
    if (data.anunciante !== undefined || !actual) {
      const anunciante = String(data.anunciante || "").trim().slice(0, 120);
      if (!anunciante) throw new Error("El nombre del anunciante es obligatorio");
      salida.anunciante = anunciante;
    }
    if (data.ubicacion !== undefined || !actual) {
      const ubicacion = String(data.ubicacion || "ambos").toLowerCase();
      if (!UBICACIONES.has(ubicacion)) throw new Error("Ubicación inválida");
      salida.ubicacion = ubicacion;
    }
    if (data.duracion_segundos !== undefined || !actual) {
      const d = aEntero(data.duracion_segundos, 10);
      salida.duracion_segundos = Math.min(Math.max(d, DURACION_MIN), DURACION_MAX);
    }
    if (data.con_sonido !== undefined || !actual) salida.con_sonido = aBooleano(data.con_sonido, false);
    if (data.activo !== undefined || !actual) salida.activo = aBooleano(data.activo, true);
    if (data.orden !== undefined || !actual) salida.orden = aEntero(data.orden, 0);
    if (data.fecha_desde !== undefined || !actual) salida.fecha_desde = aFecha(data.fecha_desde);
    if (data.fecha_hasta !== undefined || !actual) salida.fecha_hasta = aFecha(data.fecha_hasta);
    const desde = salida.fecha_desde !== undefined ? salida.fecha_desde : actual?.fecha_desde;
    const hasta = salida.fecha_hasta !== undefined ? salida.fecha_hasta : actual?.fecha_hasta;
    if (desde && hasta && String(desde).slice(0, 10) > String(hasta).slice(0, 10)) {
      throw new Error("La fecha «hasta» debe ser posterior a «desde»");
    }
    if (data.tipo !== undefined) {
      if (!TIPOS.has(data.tipo)) throw new Error("Tipo de anuncio inválido");
      salida.tipo = data.tipo;
    }
    if (data.archivo_url !== undefined) salida.archivo_url = data.archivo_url;
    return salida;
  }

  static async listar({ campeonatoId, transmisionId = null }) {
    await this.asegurarTabla();
    const values = [campeonatoId];
    let filtro = "";
    if (transmisionId) {
      values.push(transmisionId);
      filtro = "AND (a.transmision_id IS NULL OR a.transmision_id = $2)";
    }
    const r = await pool.query(
      `SELECT a.* FROM transmision_anuncios a
       WHERE a.campeonato_id = $1 ${filtro}
       ORDER BY a.orden ASC, a.id ASC`,
      values
    );
    return r.rows.map(TransmisionAnuncio.limpiar);
  }

  // Anuncios que debe reproducir el overlay de una transmisión: activos y
  // vigentes hoy (hora de Ecuador).
  static async listarVigentesParaTransmision(transmisionId, campeonatoId) {
    await this.asegurarTabla();
    const r = await pool.query(
      `SELECT a.* FROM transmision_anuncios a
       WHERE a.campeonato_id = $2
         AND a.activo = TRUE
         AND (a.transmision_id IS NULL OR a.transmision_id = $1)
         AND (a.fecha_desde IS NULL OR a.fecha_desde <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guayaquil')::date)
         AND (a.fecha_hasta IS NULL OR a.fecha_hasta >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guayaquil')::date)
       ORDER BY a.orden ASC, a.id ASC`,
      [transmisionId, campeonatoId]
    );
    return r.rows.map(TransmisionAnuncio.limpiar);
  }

  static async obtenerPorId(id) {
    await this.asegurarTabla();
    const r = await pool.query(`SELECT * FROM transmision_anuncios WHERE id = $1`, [id]);
    return TransmisionAnuncio.limpiar(r.rows[0]);
  }

  static async crear({ campeonatoId, transmisionId = null, tipo, archivoUrl, creadoPor = null, ...data }) {
    await this.asegurarTabla();
    if (!TIPOS.has(tipo)) throw new Error("Sube una imagen o un video");
    if (!archivoUrl) throw new Error("El archivo del anuncio es obligatorio");
    const d = this.normalizar(data);
    const r = await pool.query(
      `INSERT INTO transmision_anuncios
         (campeonato_id, transmision_id, anunciante, tipo, archivo_url, ubicacion,
          duracion_segundos, con_sonido, activo, orden, fecha_desde, fecha_hasta, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [campeonatoId, transmisionId, d.anunciante, tipo, archivoUrl, d.ubicacion,
        d.duracion_segundos, d.con_sonido, d.activo, d.orden, d.fecha_desde, d.fecha_hasta, creadoPor]
    );
    return TransmisionAnuncio.limpiar(r.rows[0]);
  }

  static async actualizar(id, data = {}) {
    await this.asegurarTabla();
    const actual = await this.obtenerPorId(id);
    if (!actual) return null;
    const d = this.normalizar(data, actual);
    if (data.transmision_id !== undefined) {
      d.transmision_id = data.transmision_id ? aEntero(data.transmision_id, null) : null;
    }
    const campos = Object.keys(d);
    if (!campos.length) return actual;
    const sets = campos.map((c, i) => `${c} = $${i + 1}`);
    const values = campos.map((c) => d[c]);
    values.push(id);
    const r = await pool.query(
      `UPDATE transmision_anuncios SET ${sets.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length} RETURNING *`,
      values
    );
    return TransmisionAnuncio.limpiar(r.rows[0]);
  }

  static async eliminar(id) {
    await this.asegurarTabla();
    const r = await pool.query(`DELETE FROM transmision_anuncios WHERE id = $1 RETURNING *`, [id]);
    return TransmisionAnuncio.limpiar(r.rows[0]);
  }

  // Transmisiones a avisar cuando cambian los anuncios del campeonato.
  static async idsTransmisionesCampeonato(campeonatoId) {
    const r = await pool.query(
      `SELECT t.id FROM partido_transmisiones t
       LEFT JOIN partidos p ON p.id = t.partido_id
       WHERE COALESCE(p.campeonato_id, t.campeonato_id) = $1`,
      [campeonatoId]
    );
    return r.rows.map((row) => Number(row.id));
  }
}

module.exports = TransmisionAnuncio;
