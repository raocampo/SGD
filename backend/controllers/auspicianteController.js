const fs = require("fs");
const pool = require("../config/database");
const Auspiciante = require("../models/Auspiciante");
const OrganizadorPortal = require("../models/OrganizadorPortal");
const { resolveUploadPath } = require("../config/uploads");

function safeUnlinkLogo(urlPath) {
  if (!urlPath) return;
  const filePath = resolveUploadPath(urlPath);
  fs.unlink(filePath, () => {});
}

function deduplicarAuspiciantes(items = []) {
  const vistos = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const nombre = String(item?.nombre || "")
      .trim()
      .toLowerCase();
    const logo = String(item?.logo_url || "")
      .trim()
      .toLowerCase();
    const clave = `${nombre}|${logo}`;
    if (!nombre && !logo) return false;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

async function obtenerAuspiciantesAcotados(campeonatoId, soloActivos = false) {
  let auspiciantes = await Auspiciante.listarPorCampeonato(campeonatoId, soloActivos);
  if (Array.isArray(auspiciantes) && auspiciantes.length) {
    return deduplicarAuspiciantes(auspiciantes);
  }

  const result = await pool.query(
    `SELECT creador_usuario_id FROM campeonatos WHERE id = $1 LIMIT 1`,
    [Number.parseInt(campeonatoId, 10)]
  );
  const organizadorId = Number.parseInt(result.rows?.[0]?.creador_usuario_id, 10);
  if (!Number.isFinite(organizadorId) || organizadorId <= 0) {
    return [];
  }

  return deduplicarAuspiciantes(
    await OrganizadorPortal.listarAuspiciantesConFallback(organizadorId)
  );
}

const auspicianteController = {
  async crear(req, res) {
    try {
      if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
      }

      const logo_url = req.file
        ? `/uploads/auspiciantes/${req.file.filename}`
        : null;

      const auspiciante = await Auspiciante.crear({
        ...req.body,
        logo_url,
      });

      return res.status(201).json({
        mensaje: "Auspiciante creado",
        auspiciante,
      });
    } catch (error) {
      console.error("Error crear auspiciante:", error);
      return res.status(400).json({ error: error.message || "No se pudo crear" });
    }
  },

  async listarPorCampeonato(req, res) {
    try {
      const { campeonato_id } = req.params;
      const soloActivos =
        req.query.activo === "1" ||
        req.query.activo === "true" ||
        req.query.activo === "si";

      const auspiciantes = await obtenerAuspiciantesAcotados(campeonato_id, soloActivos);

      return res.json({ auspiciantes });
    } catch (error) {
      console.error("Error listar auspiciantes:", error);
      return res.status(500).json({ error: "No se pudieron listar auspiciantes" });
    }
  },

  async actualizar(req, res) {
    try {
      const { id } = req.params;
      const previo = await Auspiciante.obtenerPorId(id);
      if (!previo) return res.status(404).json({ error: "Auspiciante no encontrado" });

      if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
      }

      const datos = { ...req.body };
      if (req.file) {
        datos.logo_url = `/uploads/auspiciantes/${req.file.filename}`;
      }

      const auspiciante = await Auspiciante.actualizar(id, datos);
      if (!auspiciante) return res.status(404).json({ error: "Auspiciante no encontrado" });

      if (req.file && previo.logo_url && previo.logo_url !== auspiciante.logo_url) {
        safeUnlinkLogo(previo.logo_url);
      }

      return res.json({ mensaje: "Auspiciante actualizado", auspiciante });
    } catch (error) {
      console.error("Error actualizar auspiciante:", error);
      return res.status(400).json({ error: error.message || "No se pudo actualizar" });
    }
  },

  async eliminar(req, res) {
    try {
      const { id } = req.params;
      const eliminado = await Auspiciante.eliminar(id);
      if (!eliminado) return res.status(404).json({ error: "Auspiciante no encontrado" });

      safeUnlinkLogo(eliminado.logo_url);
      return res.json({ mensaje: "Auspiciante eliminado", auspiciante: eliminado });
    } catch (error) {
      console.error("Error eliminar auspiciante:", error);
      return res.status(500).json({ error: "No se pudo eliminar auspiciante" });
    }
  },
};

module.exports = auspicianteController;
