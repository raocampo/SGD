const express = require('express');
const router = express.Router();
const tablaController = require('../controllers/tablaController');

// Compatibilidad legacy
router.get('/grupo/:grupo_id', tablaController.generarTablaGrupo);
router.get('/campeonato/:campeonato_id', tablaController.generarTablaCompleta);

// Flujo actual por evento
router.get('/evento/:evento_id/posiciones', tablaController.generarTablasEvento);
router.get('/evento/:evento_id/goleadores', tablaController.obtenerGoleadoresEvento);
router.get('/evento/:evento_id/tarjetas', tablaController.obtenerTarjetasEvento);
router.get('/evento/:evento_id/fair-play', tablaController.obtenerFairPlayEvento);

module.exports = router;
