const express = require('express');
const router = express.Router();
const upload = require("../config/multerConfig");
const campeonatoController = require('../controllers/campeonatoController');
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

// ===============================
// CREAR CAMPEONATO (con logo)
// ===============================
router.post(
  '/',
  requireAuth,
  requireRoles("administrador", "organizador"),
  (req, res, next) => {
    req.uploadFolderByField = {
      logo: "campeonatos",
      carnet_fondo: "campeonatos/carnets",
    };
    next();
  },
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "carnet_fondo", maxCount: 1 },
  ]),
  campeonatoController.crearCampeonato
);

// ===============================
// OBTENER CAMPEONATOS (panel interno autenticado)
// ===============================
router.get(
  '/',
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente", "jugador"),
  campeonatoController.obtenerCampeonatos
); // READ ALL
router.get(
  '/:id',
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente", "jugador"),
  campeonatoController.obtenerCampeonato
); // READ ONE

// ===============================
// CAMBIAR ESTADO
// ===============================
router.put(
  "/:id/estado",
  requireAuth,
  requireRoles("administrador", "organizador"),
  campeonatoController.cambiarEstado
);

// ===============================
// ACTUALIZAR CAMPEONATO (con logo)
// ===============================
router.put(
  '/:id',
  requireAuth,
  requireRoles("administrador", "organizador"),
  (req, res, next) => {
    req.uploadFolderByField = {
      logo: "campeonatos",
      carnet_fondo: "campeonatos/carnets",
    };
    next();
  },
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "carnet_fondo", maxCount: 1 },
  ]),
  campeonatoController.actualizarCampeonato
);

// ===============================
// ELIMINAR CAMPEONATO
// ===============================
router.delete(
  '/:id',
  requireAuth,
  requireRoles("administrador", "organizador"),
  campeonatoController.eliminarCampeonato
);  // DELETE

module.exports = router;
