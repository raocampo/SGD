const express = require("express");
const authController = require("../controllers/authController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/bootstrap/status", authController.bootstrapStatus);
router.post("/bootstrap/register", authController.bootstrapRegister);
router.post("/register-public", authController.registerPublic);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.post("/password/forgot", authController.solicitarRecuperacionPassword);
router.post("/password/reset", authController.resetearPassword);
router.get("/organizadores/:id/landing", authController.landingOrganizadorPublica);
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
router.put(
  "/usuarios/:id",
  requireAuth,
  requireRoles("administrador"),
  authController.actualizarUsuario
);
router.delete(
  "/usuarios/:id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  authController.eliminarUsuario
);
router.post(
  "/usuarios/:id/equipos",
  requireAuth,
  requireRoles("administrador"),
  authController.asignarEquipo
);
router.delete(
  "/usuarios/:id/equipos/:equipo_id",
  requireAuth,
  requireRoles("administrador"),
  authController.quitarEquipo
);

module.exports = router;
