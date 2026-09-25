const fs = require("fs");
const Facturacion = require("../models/Facturacion");
const { isOrganizador, obtenerCampeonatoIdsOrganizador } = require("../services/organizadorScope");
const { resolveUploadPath } = require("../config/uploads");

function safeUnlinkImagen(urlPath) {
  if (!urlPath) return;
  const filePath = resolveUploadPath(urlPath);
  fs.unlink(filePath, () => {});
}

function statusParaError(err) {
  const msg = String(err?.message || "").toLowerCase();
  if (
    msg.includes("inválido") ||
    msg.includes("obligatorio") ||
    msg.includes("debe") ||
    msg.includes("no encontrado") ||
    msg.includes("no existe") ||
    msg.includes("inválido") ||
    msg.includes("invalido") ||
    msg.includes("al menos") ||
    msg.includes("documentado") ||
    msg.includes("pertenecen") ||
    msg.includes("selecciona")
  ) return 400;
  if (msg.includes("no autorizado")) return 403;
  return 500;
}

function resolverOrganizadorId(req) {
  // Administrador puede pasar organizador_id en body/query; organizador usa el suyo
  if (req.user?.rol === "administrador") {
    return req.body?.organizador_id || req.query?.organizador_id || req.user.id;
  }
  return req.user.id;
}

const facturacionController = {

  // ─── CONFIG ──────────────────────────────────────────────────────────────

  async obtenerConfig(req, res) {
    try {
      const orgId = resolverOrganizadorId(req);
      const config = await Facturacion.obtenerConfig(orgId);
      res.json(config || {});
    } catch (err) {
      res.status(statusParaError(err)).json({ error: err.message });
    }
  },

  async guardarConfig(req, res) {
    try {
      const orgId = resolverOrganizadorId(req);
      const config = await Facturacion.guardarConfig(orgId, req.body || {});
      res.json(config);
    } catch (err) {
      res.status(statusParaError(err)).json({ error: err.message });
    }
  },

  async subirSello(req, res) {
    try {
      if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
      }
      if (!req.file) {
        return res.status(400).json({ error: "Selecciona una imagen para el sello" });
      }
      const orgId = resolverOrganizadorId(req);
      const previo = await Facturacion.obtenerConfig(orgId);
      const sello_url = `/uploads/facturacion/sellos/${req.file.filename}`;
      const config = await Facturacion.actualizarImagenConfig(orgId, "sello_url", sello_url);
      if (previo?.sello_url && previo.sello_url !== sello_url) {
        safeUnlinkImagen(previo.sello_url);
      }
      res.json(config);
    } catch (err) {
      res.status(statusParaError(err)).json({ error: err.message });
    }
  },

  async eliminarSello(req, res) {
    try {
      const orgId = resolverOrganizadorId(req);
      const previo = await Facturacion.obtenerConfig(orgId);
      const config = await Facturacion.actualizarImagenConfig(orgId, "sello_url", null);
      if (previo?.sello_url) safeUnlinkImagen(previo.sello_url);
      res.json(config);
    } catch (err) {
      res.status(statusParaError(err)).json({ error: err.message });
    }
  },

  async subirFirma(req, res) {
    try {
      if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
      }
      if (!req.file) {
        return res.status(400).json({ error: "Selecciona una imagen para la firma" });
      }
      const orgId = resolverOrganizadorId(req);
      const previo = await Facturacion.obtenerConfig(orgId);
      const firma_url = `/uploads/facturacion/firmas/${req.file.filename}`;
      const config = await Facturacion.actualizarImagenConfig(orgId, "firma_url", firma_url);
      if (previo?.firma_url && previo.firma_url !== firma_url) {
        safeUnlinkImagen(previo.firma_url);
      }
      res.json(config);
    } catch (err) {
      res.status(statusParaError(err)).json({ error: err.message });
    }
  },

  async eliminarFirma(req, res) {
    try {
      const orgId = resolverOrganizadorId(req);
      const previo = await Facturacion.obtenerConfig(orgId);
      const config = await Facturacion.actualizarImagenConfig(orgId, "firma_url", null);
      if (previo?.firma_url) safeUnlinkImagen(previo.firma_url);
      res.json(config);
    } catch (err) {
      res.status(statusParaError(err)).json({ error: err.message });
    }
  },

  // ─── DOCUMENTOS ──────────────────────────────────────────────────────────

  async listar(req, res) {
    try {
      const filtros = { ...req.query };

      if (isOrganizador(req.user)) {
        filtros.organizador_id = req.user.id;
      } else if (!filtros.organizador_id) {
        // Administrador sin filtro: devuelve todos (limitado por paginación)
        filtros.organizador_id = undefined;
      }

      const docs = await Facturacion.listarDocumentos(filtros);
      res.json(docs);
    } catch (err) {
      res.status(statusParaError(err)).json({ error: err.message });
    }
  },

  async obtener(req, res) {
    try {
      const orgId = isOrganizador(req.user) ? req.user.id : null;
      const doc = await Facturacion.obtenerDocumento(req.params.id, orgId);
      res.json(doc);
    } catch (err) {
      res.status(statusParaError(err)).json({ error: err.message });
    }
  },

  async crear(req, res) {
    try {
      const orgId = resolverOrganizadorId(req);
      const { items, movimiento_ids, ...datos } = req.body || {};

      if (isOrganizador(req.user) && datos.campeonato_id) {
        const permitidos = await obtenerCampeonatoIdsOrganizador(req.user);
        if (!permitidos.includes(Number(datos.campeonato_id))) {
          return res.status(403).json({ error: "No autorizado para ese campeonato" });
        }
      }

      const doc = await Facturacion.crearDocumento(orgId, datos, items || [], movimiento_ids);
      res.status(201).json(doc);
    } catch (err) {
      res.status(statusParaError(err)).json({ error: err.message });
    }
  },

  async actualizar(req, res) {
    try {
      const orgId = resolverOrganizadorId(req);
      const { items, movimiento_ids, ...datos } = req.body || {};
      const doc = await Facturacion.actualizarDocumento(req.params.id, orgId, datos, items, movimiento_ids);
      res.json(doc);
    } catch (err) {
      res.status(statusParaError(err)).json({ error: err.message });
    }
  },

  async emitir(req, res) {
    try {
      const orgId = resolverOrganizadorId(req);
      const doc = await Facturacion.cambiarEstado(req.params.id, orgId, "emitido");
      res.json(doc);
    } catch (err) {
      res.status(statusParaError(err)).json({ error: err.message });
    }
  },

  async anular(req, res) {
    try {
      const orgId = resolverOrganizadorId(req);
      const doc = await Facturacion.cambiarEstado(req.params.id, orgId, "anulado");
      res.json(doc);
    } catch (err) {
      res.status(statusParaError(err)).json({ error: err.message });
    }
  },
};

module.exports = facturacionController;
