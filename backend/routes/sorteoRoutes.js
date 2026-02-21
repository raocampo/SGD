const express = require('express');
const router = express.Router();
const sorteoController = require('../controllers/sorteoController');
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

// 🎲 Rutas de Sorteo
router.post(
  '/aleatorio',
  requireAuth,
  requireRoles("administrador", "organizador"),
  sorteoController.sorteoAleatorio
);                // Sorteo aleatorio puro
router.post(
  '/cabeza-serie',
  requireAuth,
  requireRoles("administrador", "organizador"),
  sorteoController.sorteoConCabezaDeSerie
);      // Sorteo con cabeza de serie
router.get(
  '/ruleta/:campeonato_id',
  requireAuth,
  requireRoles("administrador", "organizador"),
  sorteoController.prepararRuleta
);      // Preparar datos para ruleta

module.exports = router;
