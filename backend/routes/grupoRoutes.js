const express = require('express');
const router = express.Router();
const grupoController = require('../controllers/grupoController');

// 🔄 CRUD Completo para Grupos
router.post('/', grupoController.crearGrupos);                              // CREATE grupos
router.get('/campeonato/:campeonato_id', grupoController.obtenerGruposPorCampeonato); // READ por campeonato
router.get('/:id', grupoController.obtenerGrupo);                           // READ uno con detalles
router.get('/campeonato/:campeonato_id/completo', grupoController.obtenerGruposConEquipos); // READ con equipos
router.put('/:id', grupoController.actualizarGrupo);                        // UPDATE
router.delete('/:id', grupoController.eliminarGrupo);                       // DELETE

// 🔧 Rutas para asignación de equipos
router.post('/asignar-equipo', grupoController.asignarEquipoAGrupo);        // Asignar equipo
router.post('/remover-equipo', grupoController.removerEquipoDeGrupo);       // Remover equipo

module.exports = router;