const express = require('express');
const router = express.Router();
const tablaController = require('../controllers/tablaController');

// 📊 Rutas para Tablas de Posición
router.get('/grupo/:grupo_id', tablaController.generarTablaGrupo);              // Tabla por grupo
router.get('/campeonato/:campeonato_id', tablaController.generarTablaCompleta); // Tablas completas del campeonato

module.exports = router;