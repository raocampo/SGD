"use strict";

// Anuncios pagados de las transmisiones (imágenes y videos/reels).
const fs = require("fs");
const path = require("path");
const pool = require("../config/database");
const TransmisionAnuncio = require("../models/TransmisionAnuncio");
const { tipoDeArchivo } = require("../config/multerMedia");
const { getUploadsSubdir } = require("../config/uploads");
const { verificarAccesoCampeonato } = require("../services/transmisionAcceso");
const { emitOverlayEvento } = require("../services/socketService");

function borrarArchivoSubido(file) {
  if (file?.path) fs.unlink(file.path, () => {});
}

function borrarArchivoAnuncio(archivoUrl) {
  const nombre = path.basename(String(archivoUrl || ""));
  if (!nombre || !String(archivoUrl).includes("/uploads/anuncios/")) return;
  fs.unlink(path.join(getUploadsSubdir("anuncios"), nombre), () => {});
}

// La transmisión elegida como alcance debe ser del mismo campeonato.
async function transmisionDelCampeonato(transmisionId, campeonatoId) {
  if (!transmisionId) return true;
  const r = await pool.query(
    `SELECT 1 FROM partido_transmisiones t LEFT JOIN partidos p ON p.id = t.partido_id
     WHERE t.id = $1 AND COALESCE(p.campeonato_id, t.campeonato_id) = $2`,
    [transmisionId, campeonatoId]
  );
  return r.rows.length > 0;
}

// Avisar a los overlays del campeonato para que recarguen la publicidad.
async function avisarOverlays(campeonatoId) {
  try {
    const ids = await TransmisionAnuncio.idsTransmisionesCampeonato(campeonatoId);
    ids.forEach((id) => emitOverlayEvento(id, "overlay:publicidad", { at: Date.now() }));
  } catch (_) { /* el overlay también recarga cada 5 min */ }
}

function estadoError(err) {
  return /obligatori|inválid|posterior|sube|formato/i.test(String(err?.message || "")) ? 400 : 500;
}

async function listar(req, res) {
  try {
    const campeonatoId = Number.parseInt(req.query.campeonato_id, 10);
    const transmisionId = Number.parseInt(req.query.transmision_id, 10) || null;
    if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
      return res.status(400).json({ error: "campeonato_id inválido" });
    }
    if (!(await verificarAccesoCampeonato(req, res, campeonatoId))) return;
    if (!(await transmisionDelCampeonato(transmisionId, campeonatoId))) {
      return res.status(400).json({ error: "La transmisión no pertenece al campeonato" });
    }
    const anuncios = await TransmisionAnuncio.listar({ campeonatoId, transmisionId });
    return res.json({ anuncios });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function crear(req, res) {
  try {
    const campeonatoId = Number.parseInt(req.body?.campeonato_id, 10);
    const transmisionId = Number.parseInt(req.body?.transmision_id, 10) || null;
    if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
      borrarArchivoSubido(req.file);
      return res.status(400).json({ error: "campeonato_id inválido" });
    }
    if (!(await verificarAccesoCampeonato(req, res, campeonatoId))) {
      borrarArchivoSubido(req.file);
      return;
    }
    if (!(await transmisionDelCampeonato(transmisionId, campeonatoId))) {
      borrarArchivoSubido(req.file);
      return res.status(400).json({ error: "La transmisión no pertenece al campeonato" });
    }
    const tipo = tipoDeArchivo(req.file);
    if (!req.file || !tipo) {
      borrarArchivoSubido(req.file);
      return res.status(400).json({ error: "Sube una imagen o un video para el anuncio" });
    }
    const anuncio = await TransmisionAnuncio.crear({
      ...req.body,
      campeonatoId,
      transmisionId,
      tipo,
      archivoUrl: `/uploads/anuncios/${req.file.filename}`,
      creadoPor: req.user?.id || null,
    });
    avisarOverlays(campeonatoId);
    return res.status(201).json({ anuncio });
  } catch (err) {
    borrarArchivoSubido(req.file);
    return res.status(estadoError(err)).json({ error: err.message });
  }
}

async function actualizar(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const actual = Number.isFinite(id) ? await TransmisionAnuncio.obtenerPorId(id) : null;
    if (!actual) {
      borrarArchivoSubido(req.file);
      return res.status(404).json({ error: "Anuncio no encontrado" });
    }
    if (!(await verificarAccesoCampeonato(req, res, actual.campeonato_id))) {
      borrarArchivoSubido(req.file);
      return;
    }
    const datos = { ...req.body };
    if (datos.transmision_id !== undefined) {
      const tx = Number.parseInt(datos.transmision_id, 10) || null;
      if (!(await transmisionDelCampeonato(tx, actual.campeonato_id))) {
        borrarArchivoSubido(req.file);
        return res.status(400).json({ error: "La transmisión no pertenece al campeonato" });
      }
      datos.transmision_id = tx;
    }
    if (req.file) {
      const tipo = tipoDeArchivo(req.file);
      if (!tipo) {
        borrarArchivoSubido(req.file);
        return res.status(400).json({ error: "Sube una imagen o un video" });
      }
      datos.tipo = tipo;
      datos.archivo_url = `/uploads/anuncios/${req.file.filename}`;
    }
    delete datos.campeonato_id;
    const anuncio = await TransmisionAnuncio.actualizar(id, datos);
    if (req.file) borrarArchivoAnuncio(actual.archivo_url);
    avisarOverlays(actual.campeonato_id);
    return res.json({ anuncio });
  } catch (err) {
    borrarArchivoSubido(req.file);
    return res.status(estadoError(err)).json({ error: err.message });
  }
}

async function eliminar(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const actual = Number.isFinite(id) ? await TransmisionAnuncio.obtenerPorId(id) : null;
    if (!actual) return res.status(404).json({ error: "Anuncio no encontrado" });
    if (!(await verificarAccesoCampeonato(req, res, actual.campeonato_id))) return;
    await TransmisionAnuncio.eliminar(id);
    borrarArchivoAnuncio(actual.archivo_url);
    avisarOverlays(actual.campeonato_id);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { listar, crear, actualizar, eliminar };
