const express = require("express");
const router = express.Router();
const finanzaController = require("../controllers/finanzaController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

router.get(
  "/movimientos",
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente"),
  finanzaController.listarMovimientos
);
router.post(
  "/movimientos",
  requireAuth,
  requireRoles("administrador", "organizador"),
  finanzaController.crearMovimiento
);
router.get(
  "/equipo/:equipo_id/estado-cuenta",
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente"),
  finanzaController.obtenerEstadoCuentaEquipo
);
router.get(
  "/morosidad",
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente"),
  finanzaController.obtenerMorosidad
);

module.exports = router;
