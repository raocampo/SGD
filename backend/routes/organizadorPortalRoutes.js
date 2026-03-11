const express = require("express");
const upload = require("../config/multerConfig");
const organizadorPortalController = require("../controllers/organizadorPortalController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

const router = express.Router();

function setPortalConfigFolders(req, res, next) {
  req.uploadFolderByField = {
    logo: "portal/organizadores/logos",
    hero_image: "portal/organizadores/heroes",
  };
  next();
}

function setPortalAuspiciantesFolder(req, res, next) {
  req.uploadFolder = "portal/organizadores/auspiciantes";
  next();
}

function setPortalMediaFolder(req, res, next) {
  req.uploadFolder = "portal/organizadores/media";
  next();
}

router.get(
  "/contexto",
  requireAuth,
  requireRoles("administrador", "organizador"),
  organizadorPortalController.obtenerContexto
);

router.put(
  "/config",
  requireAuth,
  requireRoles("administrador", "organizador"),
  setPortalConfigFolders,
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "hero_image", maxCount: 1 },
  ]),
  organizadorPortalController.guardarConfig
);

router.get(
  "/auspiciantes",
  requireAuth,
  requireRoles("administrador", "organizador"),
  organizadorPortalController.listarAuspiciantes
);
router.post(
  "/auspiciantes",
  requireAuth,
  requireRoles("administrador", "organizador"),
  setPortalAuspiciantesFolder,
  upload.single("logo"),
  organizadorPortalController.crearAuspiciante
);
router.put(
  "/auspiciantes/:id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  setPortalAuspiciantesFolder,
  upload.single("logo"),
  organizadorPortalController.actualizarAuspiciante
);
router.delete(
  "/auspiciantes/:id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  organizadorPortalController.eliminarAuspiciante
);

router.get(
  "/media",
  requireAuth,
  requireRoles("administrador", "organizador"),
  organizadorPortalController.listarMedia
);
router.post(
  "/media",
  requireAuth,
  requireRoles("administrador", "organizador"),
  setPortalMediaFolder,
  upload.single("imagen"),
  organizadorPortalController.crearMedia
);
router.put(
  "/media/:id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  setPortalMediaFolder,
  upload.single("imagen"),
  organizadorPortalController.actualizarMedia
);
router.delete(
  "/media/:id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  organizadorPortalController.eliminarMedia
);

module.exports = router;
