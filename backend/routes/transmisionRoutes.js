const express = require("express");
const router = express.Router();
const transmisionController = require("../controllers/transmisionController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

// ===============================
// 🔒 RUTAS AUTENTICADAS
// ===============================
router.put(
  "/:id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  transmisionController.actualizarTransmision
);

router.post(
  "/:id/iniciar",
  requireAuth,
  requireRoles("administrador", "organizador"),
  transmisionController.iniciarTransmision
);

router.post(
  "/:id/finalizar",
  requireAuth,
  requireRoles("administrador", "organizador"),
  transmisionController.finalizarTransmision
);

router.post(
  "/:id/cancelar",
  requireAuth,
  requireRoles("administrador", "organizador"),
  transmisionController.cancelarTransmision
);

module.exports = router;
