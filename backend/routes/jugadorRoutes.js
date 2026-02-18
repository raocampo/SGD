const express = require('express');
const router = express.Router();
const upload = require("../config/multerConfig");
const jugadorController = require('../controllers/jugadorController');

function setJugadoresFolder(req, res, next) {
  req.uploadFolder = "jugadores";
  next();
}

// 🔄 CRUD Completo para Jugadores
router.get('/', jugadorController.obtenerTodosLosJugadores);              // READ todos
router.post(
  '/',
  setJugadoresFolder,
  upload.fields([
    { name: "foto_cedula", maxCount: 1 },
    { name: "foto_carnet", maxCount: 1 },
  ]),
  jugadorController.crearJugador
);                         // CREATE
router.post('/importar-masivo', jugadorController.importarJugadoresMasivo); // CREATE masivo (xlsx/csv procesado en frontend)
router.get('/equipo/:equipo_id', jugadorController.obtenerJugadoresPorEquipo); // READ por equipo
router.get('/:id', jugadorController.obtenerJugador);                     // READ uno
router.put(
  '/:id',
  setJugadoresFolder,
  upload.fields([
    { name: "foto_cedula", maxCount: 1 },
    { name: "foto_carnet", maxCount: 1 },
  ]),
  jugadorController.actualizarJugador
);                  // UPDATE
router.delete('/:id', jugadorController.eliminarJugador);                 // DELETE

// 🔧 Rutas especiales
router.post('/designar-capitan', jugadorController.designarCapitan);      // Designar capitán

module.exports = router;
