const express = require('express');
const router = express.Router();
const upload = require("../config/multerConfig");
const jugadorController = require('../controllers/jugadorController');
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

function setJugadoresFolder(req, res, next) {
  req.uploadFolderByField = {
    foto_cedula: "jugadores/cedulas",
    foto_carnet: "jugadores/fotos",
    foto_carnet_recorte: "jugadores/fotos",
  };
  next();
}

// 🔄 CRUD Completo para Jugadores
router.get(
  '/',
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente", "jugador"),
  jugadorController.obtenerTodosLosJugadores
);              // READ todos
router.post(
  '/',
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente"),
  setJugadoresFolder,
  upload.fields([
    { name: "foto_cedula", maxCount: 1 },
    { name: "foto_carnet", maxCount: 1 },
    { name: "foto_carnet_recorte", maxCount: 1 },
  ]),
  jugadorController.crearJugador
);                         // CREATE
router.post(
  '/importar-masivo',
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente"),
  jugadorController.importarJugadoresMasivo
); // CREATE masivo (xlsx/csv procesado en frontend)
router.get(
  '/equipo/:equipo_id',
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente", "jugador"),
  jugadorController.obtenerJugadoresPorEquipo
); // READ por equipo
router.get(
  '/buscar-cedula/:cedula',
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente"),
  jugadorController.buscarJugadorPorCedula
); // READ perfil por cédula
router.get(
  '/:id',
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente", "jugador"),
  jugadorController.obtenerJugador
);                     // READ uno
router.put(
  '/:id',
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente"),
  setJugadoresFolder,
  upload.fields([
    { name: "foto_cedula", maxCount: 1 },
    { name: "foto_carnet", maxCount: 1 },
    { name: "foto_carnet_recorte", maxCount: 1 },
  ]),
  jugadorController.actualizarJugador
);                  // UPDATE
router.delete(
  '/:id',
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente"),
  jugadorController.eliminarJugador
);                 // DELETE

// 🔧 Rutas especiales
router.post(
  '/designar-capitan',
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente"),
  jugadorController.designarCapitan
);      // Designar capitán

module.exports = router;
