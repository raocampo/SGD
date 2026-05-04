const express = require("express");
const router = express.Router();
const facturacionController = require("../controllers/facturacionController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

const ROLES = ["administrador", "organizador"];

// Configuración del emisor
router.get("/config", requireAuth, requireRoles(...ROLES), facturacionController.obtenerConfig);
router.put("/config", requireAuth, requireRoles(...ROLES), facturacionController.guardarConfig);

// Documentos — estáticos antes de /:id
router.get("/", requireAuth, requireRoles(...ROLES), facturacionController.listar);
router.post("/", requireAuth, requireRoles(...ROLES), facturacionController.crear);
router.get("/:id", requireAuth, requireRoles(...ROLES), facturacionController.obtener);
router.put("/:id", requireAuth, requireRoles(...ROLES), facturacionController.actualizar);
router.post("/:id/emitir", requireAuth, requireRoles(...ROLES), facturacionController.emitir);
router.post("/:id/anular", requireAuth, requireRoles(...ROLES), facturacionController.anular);

module.exports = router;
