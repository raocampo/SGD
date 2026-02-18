const express = require("express");
const router = express.Router();
const grupoController = require("../controllers/grupoController");

// ===============================
// 🎯 EVENTO (NUEVO)
// ===============================
// Crear grupos para un EVENTO
router.post("/evento/", grupoController.crearGruposPorEvento);

//generar grupos
router.post("/evento/:evneto_id/generar", grupoController.generarGruposParaEvento);

// Obtener grupos por EVENTO
router.get("/evento/:evento_id", grupoController.obtenerGruposPorEvento);

// (Opcional) obtener grupos con equipos del evento (si lo necesitas luego)
router.get("/evento/:evento_id/con-equipos", grupoController.obtenerGruposPorEventoConEquipos);


// Obtener grupos + equipos por EVENTO
router.get("/evento/:evento_id/completo", grupoController.obtenerGruposConEquiposPorEvento);

// ===============================
// 🏆 CAMPEONATO (LEGACY / COMPATIBILIDAD)
// ===============================
// CREATE grupos por campeonato
router.post("/", grupoController.crearGrupos);

// READ por campeonato
router.get("/campeonato/:campeonato_id", grupoController.obtenerGruposPorCampeonato);

// READ con equipos por campeonato
router.get("/campeonato/:campeonato_id/completo", grupoController.obtenerGruposConEquipos);

// ===============================
// 🔧 ASIGNACIÓN DE EQUIPOS A GRUPO
// ===============================
router.post("/asignar-equipo", grupoController.asignarEquipoAGrupo);
router.post("/remover-equipo", grupoController.removerEquipoDeGrupo);

// ===============================
// 🔄 CRUD BÁSICO
// ===============================
router.post("/", grupoController.crearGrupo);
router.put("/:id", grupoController.actualizarGrupo);
router.delete("/:id", grupoController.eliminarGrupo);
router.get("/:id", grupoController.obtenerGrupoPorId);

// ⚠️ SIEMPRE AL FINAL
router.get("/:id", grupoController.obtenerGrupo);

module.exports = router;
