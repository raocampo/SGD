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
