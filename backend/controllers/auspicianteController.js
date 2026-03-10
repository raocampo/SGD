const fs = require("fs");
const path = require("path");
const Auspiciante = require("../models/Auspiciante");
const { resolveUploadPath } = require("../config/uploads");

function safeUnlinkLogo(urlPath) {
  if (!urlPath) return;
  const filePath = resolveUploadPath(urlPath);
  fs.unlink(filePath, () => {});
}

function extraerNombreDesdeArchivo(filename = "", idx = 0) {
  const base = String(filename || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/^\d+-\d+-?/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!base) return `Auspiciante ${idx + 1}`;
  return base
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

function obtenerFallbackAuspiciantesDesdeArchivos(campeonatoId) {
  const carpeta = resolveUploadPath("/uploads/auspiciantes");
  if (!fs.existsSync(carpeta)) return [];

  const validExt = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
  const archivos = fs
    .readdirSync(carpeta, { withFileTypes: true })
    .filter((ent) => ent.isFile())
    .map((ent) => ent.name)
    .filter((name) => validExt.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  return archivos.map((name, idx) => ({
    id: `fs-${idx + 1}`,
    campeonato_id: Number.parseInt(campeonatoId, 10) || null,
    nombre: extraerNombreDesdeArchivo(name, idx),
    logo_url: `/uploads/auspiciantes/${name}`,
    orden: idx + 1,
    activo: true,
    origen: "filesystem",
  }));
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

      let auspiciantes = await Auspiciante.listarPorCampeonato(
        campeonato_id,
        soloActivos
      );

      // Fallback: si no hay registros en BD pero sí existen logos cargados en /uploads/auspiciantes
      // devolvemos esa lista para mantener la plantilla operativa.
      if (!Array.isArray(auspiciantes) || !auspiciantes.length) {
        auspiciantes = obtenerFallbackAuspiciantesDesdeArchivos(campeonato_id);
      }

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
