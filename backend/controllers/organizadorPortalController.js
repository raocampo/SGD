const fs = require("fs");
const pool = require("../config/database");
const OrganizadorPortal = require("../models/OrganizadorPortal");
const UsuarioAuth = require("../models/UsuarioAuth");
const { resolveUploadPath } = require("../config/uploads");

function safeUnlink(urlPath) {
  if (!urlPath) return;
  const filePath = resolveUploadPath(urlPath);
  fs.unlink(filePath, () => {});
}

function normalizarId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function obtenerOrganizadorObjetivo(req) {
  const rol = String(req.user?.rol || "").toLowerCase();
  if (rol === "organizador") {
    return req.user;
  }
  if (rol !== "administrador") {
    const error = new Error("No autorizado");
    error.status = 403;
    throw error;
  }

  const organizadorId =
    normalizarId(req.query?.organizador_id) ||
    normalizarId(req.body?.organizador_id) ||
    normalizarId(req.params?.organizador_id);
  if (!organizadorId) {
    const error = new Error("organizador_id es obligatorio para administrador");
    error.status = 400;
    throw error;
  }

  const user = await UsuarioAuth.obtenerPorId(organizadorId);
  const limpio = UsuarioAuth.limpiarUsuario(user);
  if (!limpio || String(limpio.rol || "").toLowerCase() !== "organizador") {
    const error = new Error("Organizador no encontrado");
    error.status = 404;
    throw error;
  }

  return limpio;
}

async function validarCampeonatoOrganizador(organizadorId, campeonatoId) {
  const cId = normalizarId(campeonatoId);
  if (!cId) return null;
  const result = await pool.query(
    `
      SELECT id, nombre
      FROM campeonatos
      WHERE id = $1
        AND creador_usuario_id = $2
      LIMIT 1
    `,
    [cId, organizadorId]
  );
  return result.rows[0] || null;
}

async function listarCampeonatosOrganizador(organizadorId) {
  const result = await pool.query(
    `
      SELECT id, nombre, estado, fecha_inicio, fecha_fin, logo_url
      FROM campeonatos
      WHERE creador_usuario_id = $1
      ORDER BY fecha_inicio DESC NULLS LAST, id DESC
    `,
    [organizadorId]
  );
  return result.rows;
}

const organizadorPortalController = {
  async obtenerContexto(req, res) {
    try {
      const organizador = await obtenerOrganizadorObjetivo(req);
      const [config, auspiciantes, media, campeonatos] = await Promise.all([
        OrganizadorPortal.obtenerConfig(organizador.id),
        OrganizadorPortal.listarAuspiciantes(organizador.id, false),
        OrganizadorPortal.listarMedia(organizador.id, {}),
        listarCampeonatosOrganizador(organizador.id),
      ]);

      return res.json({
        ok: true,
        organizador: {
          id: organizador.id,
          nombre: organizador.nombre,
          email: organizador.email || "",
          organizacion_nombre: organizador.organizacion_nombre || "",
          plan_codigo: organizador.plan_codigo || "",
          plan_estado: organizador.plan_estado || "activo",
        },
        config,
        auspiciantes,
        media,
        campeonatos,
      });
    } catch (error) {
      console.error("Error obtenerContexto organizador portal:", error);
      return res.status(error.status || 500).json({
        error: error.message || "No se pudo cargar el contexto del portal del organizador",
      });
    }
  },

  async guardarConfig(req, res) {
    try {
      const organizador = await obtenerOrganizadorObjetivo(req);
      if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
      }

      const actual = await OrganizadorPortal.obtenerConfig(organizador.id);
      const data = { ...(req.body || {}) };
      const logoFile = req.files?.logo?.[0] || null;
      const heroFile = req.files?.hero_image?.[0] || null;

      if (logoFile) {
        data.logo_url = `/uploads/portal/organizadores/logos/${logoFile.filename}`;
      }
      if (heroFile) {
        data.hero_image_url = `/uploads/portal/organizadores/heroes/${heroFile.filename}`;
      }

      const config = await OrganizadorPortal.guardarConfig(organizador.id, data);
      if (logoFile && actual?.logo_url && actual.logo_url !== config.logo_url) {
        safeUnlink(actual.logo_url);
      }
      if (heroFile && actual?.hero_image_url && actual.hero_image_url !== config.hero_image_url) {
        safeUnlink(actual.hero_image_url);
      }

      return res.json({ ok: true, mensaje: "Configuración del portal actualizada", config });
    } catch (error) {
      console.error("Error guardarConfig organizador portal:", error);
      return res.status(error.status || 500).json({
        error: error.message || "No se pudo guardar la configuración del portal",
      });
    }
  },

  async listarAuspiciantes(req, res) {
    try {
      const organizador = await obtenerOrganizadorObjetivo(req);
      const auspiciantes = await OrganizadorPortal.listarAuspiciantes(organizador.id, false);
      return res.json({ ok: true, total: auspiciantes.length, auspiciantes });
    } catch (error) {
      console.error("Error listarAuspiciantes organizador portal:", error);
      return res.status(error.status || 500).json({
        error: error.message || "No se pudieron listar los auspiciantes",
      });
    }
  },

  async crearAuspiciante(req, res) {
    try {
      const organizador = await obtenerOrganizadorObjetivo(req);
      if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
      }

      const data = { ...(req.body || {}) };
      if (req.file) {
        data.logo_url = `/uploads/portal/organizadores/auspiciantes/${req.file.filename}`;
      }

      const auspiciante = await OrganizadorPortal.crearAuspiciante(organizador.id, data);
      return res.status(201).json({
        ok: true,
        mensaje: "Auspiciante del organizador creado",
        auspiciante,
      });
    } catch (error) {
      console.error("Error crearAuspiciante organizador portal:", error);
      return res.status(error.status || 500).json({
        error: error.message || "No se pudo crear el auspiciante",
      });
    }
  },

  async actualizarAuspiciante(req, res) {
    try {
      const organizador = await obtenerOrganizadorObjetivo(req);
      if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
      }

      const actual = await OrganizadorPortal.obtenerAuspiciantePorId(req.params.id);
      if (!actual || Number(actual.usuario_id) !== Number(organizador.id)) {
        return res.status(404).json({ error: "Auspiciante no encontrado" });
      }

      const data = { ...(req.body || {}) };
      if (req.file) {
        data.logo_url = `/uploads/portal/organizadores/auspiciantes/${req.file.filename}`;
      }

      const auspiciante = await OrganizadorPortal.actualizarAuspiciante(req.params.id, data);
      if (req.file && actual.logo_url && actual.logo_url !== auspiciante.logo_url) {
        safeUnlink(actual.logo_url);
      }

      return res.json({
        ok: true,
        mensaje: "Auspiciante del organizador actualizado",
        auspiciante,
      });
    } catch (error) {
      console.error("Error actualizarAuspiciante organizador portal:", error);
      return res.status(error.status || 500).json({
        error: error.message || "No se pudo actualizar el auspiciante",
      });
    }
  },

  async eliminarAuspiciante(req, res) {
    try {
      const organizador = await obtenerOrganizadorObjetivo(req);
      const actual = await OrganizadorPortal.obtenerAuspiciantePorId(req.params.id);
      if (!actual || Number(actual.usuario_id) !== Number(organizador.id)) {
        return res.status(404).json({ error: "Auspiciante no encontrado" });
      }

      const eliminado = await OrganizadorPortal.eliminarAuspiciante(req.params.id);
      safeUnlink(eliminado?.logo_url);
      return res.json({
        ok: true,
        mensaje: "Auspiciante del organizador eliminado",
        auspiciante: eliminado,
      });
    } catch (error) {
      console.error("Error eliminarAuspiciante organizador portal:", error);
      return res.status(error.status || 500).json({
        error: error.message || "No se pudo eliminar el auspiciante",
      });
    }
  },

  async listarMedia(req, res) {
    try {
      const organizador = await obtenerOrganizadorObjetivo(req);
      const media = await OrganizadorPortal.listarMedia(organizador.id, req.query || {});
      return res.json({ ok: true, total: media.length, media });
    } catch (error) {
      console.error("Error listarMedia organizador portal:", error);
      return res.status(error.status || 500).json({
        error: error.message || "No se pudo listar la media pública",
      });
    }
  },

  async crearMedia(req, res) {
    try {
      const organizador = await obtenerOrganizadorObjetivo(req);
      if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
      }

      const data = { ...(req.body || {}) };
      if (req.file) {
        data.imagen_url = `/uploads/portal/organizadores/media/${req.file.filename}`;
      }

      const tipo = String(data.tipo || "").trim();
      if (tipo === "campeonato_card" || tipo === "campeonato_gallery") {
        const campeonato = await validarCampeonatoOrganizador(organizador.id, data.campeonato_id);
        if (!campeonato) {
          return res.status(400).json({ error: "campeonato_id inválido para este organizador" });
        }
      } else {
        data.campeonato_id = null;
      }

      const media = await OrganizadorPortal.crearMedia(organizador.id, data);
      return res.status(201).json({
        ok: true,
        mensaje: "Media pública creada",
        media,
      });
    } catch (error) {
      console.error("Error crearMedia organizador portal:", error);
      return res.status(error.status || 500).json({
        error: error.message || "No se pudo crear la media pública",
      });
    }
  },

  async actualizarMedia(req, res) {
    try {
      const organizador = await obtenerOrganizadorObjetivo(req);
      if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
      }

      const actual = await OrganizadorPortal.obtenerMediaPorId(req.params.id);
      if (!actual || Number(actual.usuario_id) !== Number(organizador.id)) {
        return res.status(404).json({ error: "Media no encontrada" });
      }

      const data = { ...(req.body || {}) };
      if (req.file) {
        data.imagen_url = `/uploads/portal/organizadores/media/${req.file.filename}`;
      }

      const tipo = String(data.tipo || actual.tipo || "").trim();
      const campeonatoId = data.campeonato_id !== undefined ? data.campeonato_id : actual.campeonato_id;
      if (tipo === "campeonato_card" || tipo === "campeonato_gallery") {
        const campeonato = await validarCampeonatoOrganizador(organizador.id, campeonatoId);
        if (!campeonato) {
          return res.status(400).json({ error: "campeonato_id inválido para este organizador" });
        }
      } else {
        data.campeonato_id = null;
      }

      const media = await OrganizadorPortal.actualizarMedia(req.params.id, data);
      if (req.file && actual.imagen_url && actual.imagen_url !== media.imagen_url) {
        safeUnlink(actual.imagen_url);
      }
      return res.json({ ok: true, mensaje: "Media pública actualizada", media });
    } catch (error) {
      console.error("Error actualizarMedia organizador portal:", error);
      return res.status(error.status || 500).json({
        error: error.message || "No se pudo actualizar la media pública",
      });
    }
  },

  async eliminarMedia(req, res) {
    try {
      const organizador = await obtenerOrganizadorObjetivo(req);
      const actual = await OrganizadorPortal.obtenerMediaPorId(req.params.id);
      if (!actual || Number(actual.usuario_id) !== Number(organizador.id)) {
        return res.status(404).json({ error: "Media no encontrada" });
      }

      const media = await OrganizadorPortal.eliminarMedia(req.params.id);
      safeUnlink(media?.imagen_url);
      return res.json({ ok: true, mensaje: "Media pública eliminada", media });
    } catch (error) {
      console.error("Error eliminarMedia organizador portal:", error);
      return res.status(error.status || 500).json({
        error: error.message || "No se pudo eliminar la media pública",
      });
    }
  },
};

module.exports = organizadorPortalController;
