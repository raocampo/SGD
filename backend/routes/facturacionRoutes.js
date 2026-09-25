const express = require("express");
const router = express.Router();
const upload = require("../config/multerConfig");
const facturacionController = require("../controllers/facturacionController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

const ROLES = ["administrador", "organizador"];

function setSelloFolder(req, res, next) {
  req.uploadFolder = "facturacion/sellos";
  next();
}
function setFirmaFolder(req, res, next) {
  req.uploadFolder = "facturacion/firmas";
  next();
}

// Configuración del emisor
router.get("/config", requireAuth, requireRoles(...ROLES), facturacionController.obtenerConfig);
router.put("/config", requireAuth, requireRoles(...ROLES), facturacionController.guardarConfig);
router.post(
  "/config/sello",
  requireAuth,
  requireRoles(...ROLES),
  setSelloFolder,
  upload.single("sello"),
  facturacionController.subirSello
);
router.delete("/config/sello", requireAuth, requireRoles(...ROLES), facturacionController.eliminarSello);
router.post(
  "/config/firma",
  requireAuth,
  requireRoles(...ROLES),
  setFirmaFolder,
  upload.single("firma"),
  facturacionController.subirFirma
);
router.delete("/config/firma", requireAuth, requireRoles(...ROLES), facturacionController.eliminarFirma);

// Documentos — estáticos antes de /:id
router.get("/", requireAuth, requireRoles(...ROLES), facturacionController.listar);
router.post("/", requireAuth, requireRoles(...ROLES), facturacionController.crear);
router.get("/:id", requireAuth, requireRoles(...ROLES), facturacionController.obtener);
router.put("/:id", requireAuth, requireRoles(...ROLES), facturacionController.actualizar);
router.post("/:id/emitir", requireAuth, requireRoles(...ROLES), facturacionController.emitir);
router.post("/:id/anular", requireAuth, requireRoles(...ROLES), facturacionController.anular);

module.exports = router;
