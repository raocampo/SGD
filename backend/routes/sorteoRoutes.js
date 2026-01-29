const express = require('express');
const router = express.Router();
const sorteoController = require('../controllers/sorteoController');

// 🎲 Rutas de Sorteo
router.post('/aleatorio', sorteoController.sorteoAleatorio);                // Sorteo aleatorio puro
router.post('/cabeza-serie', sorteoController.sorteoConCabezaDeSerie);      // Sorteo con cabeza de serie
router.get('/ruleta/:campeonato_id', sorteoController.prepararRuleta);      // Preparar datos para ruleta

module.exports = router;