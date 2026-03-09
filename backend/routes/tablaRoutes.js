const express = require('express');
const router = express.Router();
const tablaController = require('../controllers/tablaController');
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

// Compatibilidad legacy
router.get(
  '/grupo/:grupo_id',
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente", "jugador"),
  tablaController.generarTablaGrupo
);
router.get(
  '/campeonato/:campeonato_id',
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente", "jugador"),
  tablaController.generarTablaCompleta
);

// Flujo actual por evento
router.get(
  '/evento/:evento_id/posiciones',
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente", "jugador"),
  tablaController.generarTablasEvento
);
router.get(
  '/evento/:evento_id/goleadores',
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente", "jugador"),
  tablaController.obtenerGoleadoresEvento
);
router.get(
  '/evento/:evento_id/tarjetas',
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente", "jugador"),
  tablaController.obtenerTarjetasEvento
);
router.get(
  '/evento/:evento_id/fair-play',
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente", "jugador"),
  tablaController.obtenerFairPlayEvento
);

module.exports = router;
