const express = require("express");
const router = express.Router();
const partidoController = require("../controllers/partidoControlleraAnt");

// ===============================
// 🎯 FIXTURE / GENERACIÓN
// ===============================

router.post("/generar-fixture-evento", partidoController.generarFixtureEvento);
router.post("/generar-fixture-evento", partidoController.generarFixtureEventoCompleto);
router.post("/generar-fixture", partidoController.generarFixture);
router.post("/generar-fixture-completo", partidoController.generarFixtureCompleto);
router.post("/generar-fixture-todos", partidoController.generarFixtureTodosContraTodos);

// ===============================
// 📤 EXPORTACIÓN
// ===============================
router.get("/exportar/campeonato/:campeonato_id", partidoController.exportarFixtureCampeonatoCSV);
router.get("/exportar/grupo/:grupo_id", partidoController.exportarFixtureGrupoCSV);

// ===============================
// 📊 ESTADÍSTICAS / RESULTADOS
// ===============================
router.get(
  "/estadisticas/equipo/:equipo_id/campeonato/:campeonato_id",
  partidoController.obtenerEstadisticasEquipo
);

router.put("/:id/resultado", partidoController.registrarResultado);
router.put("/:id/resultado-shootouts", partidoController.registrarResultadoConShootouts);

// ===============================
// 📋 CONSULTAS (LECTURA)
// ===============================
// ✅ Jornada de TODO el campeonato (todos los grupos)

router.get("/evento/:evento_id", partidoController.obtenerPartidosPorEvento);
router.get("/evento/:evento_id/jornada/:jornada", partidoController.obtenerPartidosPorEventoYJornada);
router.get(
  "/campeonato/:campeonato_id/jornada/:jornada",
  partidoController.obtenerPartidosPorCampeonatoYJornada
);
router.get("/grupo/:grupo_id", partidoController.obtenerPartidosPorGrupo);
router.get("/campeonato/:campeonato_id", partidoController.obtenerPartidosPorCampeonato);

// ===============================
// 🔄 CRUD BÁSICO
// ===============================
router.post("/", partidoController.crearPartido);
router.put("/:id", partidoController.actualizarPartido);
router.delete("/:id", partidoController.eliminarPartido);

// ⚠️ ESTA SIEMPRE AL FINAL (porque captura todo)
router.get("/:id", partidoController.obtenerPartido);

module.exports = router;
