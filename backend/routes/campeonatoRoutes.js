const express = require('express');
const router = express.Router();
const upload = require("../config/multerConfig");
const campeonatoController = require('../controllers/campeonatoController');
const { requireAuth, optionalAuth, requireRoles } = require("../middleware/authMiddleware");

// ===============================
// CREAR CAMPEONATO (con logo)
// ===============================
router.post(
  '/',
  requireAuth,
  requireRoles("administrador", "organizador"),
  (req, res, next) => {
    // carpeta donde se guardarán los logos de campeonatos
    req.uploadFolder = "campeonatos";
    next();
  },
  upload.single("logo"),             // el campo del form se debe llamar "logo"
  campeonatoController.crearCampeonato
);

// ===============================
// OBTENER CAMPEONATOS
// ===============================
router.get('/', optionalAuth, campeonatoController.obtenerCampeonatos);        // READ ALL
router.get('/:id', optionalAuth, campeonatoController.obtenerCampeonato);      // READ ONE

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
    req.uploadFolder = "campeonatos";
    next();
  },
  upload.single("logo"),
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
