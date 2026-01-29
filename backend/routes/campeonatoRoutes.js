const express = require('express');
const router = express.Router();
const upload = require("../config/multerConfig");
const campeonatoController = require('../controllers/campeonatoController');

// ===============================
// CREAR CAMPEONATO (con logo)
// ===============================
router.post(
  '/',
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
router.get('/', campeonatoController.obtenerCampeonatos);        // READ ALL
router.get('/:id', campeonatoController.obtenerCampeonato);      // READ ONE

// ===============================
// ACTUALIZAR CAMPEONATO (con logo)
// ===============================
router.put(
  '/:id',
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
router.delete('/:id', campeonatoController.eliminarCampeonato);  // DELETE

module.exports = router;
