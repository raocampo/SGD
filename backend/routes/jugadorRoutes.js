const express = require('express');
const router = express.Router();
const jugadorController = require('../controllers/jugadorController');

// 🔄 CRUD Completo para Jugadores
router.get('/', jugadorController.obtenerTodosLosJugadores);              // READ todos
router.post('/', jugadorController.crearJugador);                         // CREATE
router.get('/equipo/:equipo_id', jugadorController.obtenerJugadoresPorEquipo); // READ por equipo
router.get('/:id', jugadorController.obtenerJugador);                     // READ uno
router.put('/:id', jugadorController.actualizarJugador);                  // UPDATE
router.delete('/:id', jugadorController.eliminarJugador);                 // DELETE

// 🔧 Rutas especiales
router.post('/designar-capitan', jugadorController.designarCapitan);      // Designar capitán

module.exports = router;