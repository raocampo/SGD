const express = require("express");
const router = express.Router();
const paseController = require("../controllers/paseController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

router.get(
  "/",
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente"),
  paseController.listarPases
);

router.get(
  "/historial/jugadores",
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente"),
  paseController.listarHistorialJugadores
);

router.get(
  "/historial/jugadores/:jugadorId",
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente"),
  paseController.obtenerHistorialJugador
);

router.get(
  "/historial/equipos",
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente"),
  paseController.listarHistorialEquipos
);

router.get(
  "/historial/equipos/:equipoId",
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente"),
  paseController.obtenerHistorialEquipo
);

router.get(
  "/:id",
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente"),
  paseController.obtenerPase
);

router.post(
  "/",
  requireAuth,
  requireRoles("administrador", "organizador"),
  paseController.crearPase
);

router.put(
  "/:id/estado",
  requireAuth,
  requireRoles("administrador", "organizador"),
  paseController.actualizarEstado
);

module.exports = router;
