const express = require("express");
const router = express.Router();
const transmisionController = require("../controllers/transmisionController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

// ===============================
// 🔒 RUTAS AUTENTICADAS
// ===============================

router.get(
  "/",
  requireAuth,
  requireRoles("administrador", "organizador"),
  transmisionController.listarTransmisionesPorCampeonato
);

// GET /api/transmisiones/:id — obtener una transmisión por su ID (para director panel)
router.get(
  "/:id",
  requireAuth,
  requireRoles("administrador", "organizador", "operador"),
  transmisionController.obtenerTransmisionPorId
);

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

router.post(
  "/:id/destacar",
  requireAuth,
  requireRoles("administrador", "organizador"),
  transmisionController.toggleDestacado
);

module.exports = router;
