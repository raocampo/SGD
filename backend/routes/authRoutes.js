const express = require("express");
const authController = require("../controllers/authController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", authController.login);
router.get("/me", requireAuth, authController.me);

router.get(
  "/usuarios",
  requireAuth,
  requireRoles("administrador", "organizador"),
  authController.listarUsuarios
);
router.post(
  "/usuarios",
  requireAuth,
  requireRoles("administrador", "organizador"),
  authController.crearUsuario
);
router.post(
  "/usuarios/:id/equipos",
  requireAuth,
  requireRoles("administrador", "organizador"),
  authController.asignarEquipo
);
router.delete(
  "/usuarios/:id/equipos/:equipo_id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  authController.quitarEquipo
);

module.exports = router;
