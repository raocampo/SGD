const express = require("express");
const router = express.Router();
const finanzaController = require("../controllers/finanzaController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

router.get(
  "/movimientos",
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente", "jugador"),
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
  requireRoles("administrador", "organizador", "tecnico", "dirigente", "jugador"),
  finanzaController.obtenerEstadoCuentaEquipo
);
router.get(
  "/morosidad",
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente", "jugador"),
  finanzaController.obtenerMorosidad
);
router.get(
  "/dashboard",
  requireAuth,
  requireRoles("administrador", "organizador"),
  finanzaController.dashboardOrganizador
);

// Gastos operativos — IMPORTANTE: ruta estática /gastos/resumen/:id antes de /:id
router.get(
  "/gastos/resumen/:campeonato_id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  finanzaController.resumenGastos
);
router.get(
  "/gastos",
  requireAuth,
  requireRoles("administrador", "organizador"),
  finanzaController.listarGastos
);
router.post(
  "/gastos",
  requireAuth,
  requireRoles("administrador", "organizador"),
  finanzaController.crearGasto
);
router.put(
  "/gastos/:id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  finanzaController.actualizarGasto
);
router.delete(
  "/gastos/:id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  finanzaController.eliminarGasto
);

module.exports = router;
