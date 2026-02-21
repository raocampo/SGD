// backend/routes/eliminatoriaRoutes.js
const express = require("express");
const router = express.Router();
const eliminatoriaController = require("../controllers/eliminatoriaController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

router.get("/evento/:evento_id", eliminatoriaController.obtenerPorEvento);
router.post(
  "/evento/:evento_id/generar",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eliminatoriaController.generarBracket
);
router.put(
  "/:id/resultado",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eliminatoriaController.actualizarResultado
);
router.put(
  "/:id/equipos",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eliminatoriaController.asignarEquipos
);

module.exports = router;
