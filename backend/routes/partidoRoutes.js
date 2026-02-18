const express = require("express");
const router = express.Router();
const partidoController = require("../controllers/partidoController");

// ===============================
// 🎯 FIXTURE POR EVENTO
// ===============================
router.post(
  "/evento/:evento_id/generar-fixture",
  partidoController.generarFixtureEvento
);
// Compatibilidad con frontend anterior (evento_id en body)
router.post("/evento/generar-fixture", partidoController.generarFixtureEvento);
router.post(
  "/evento/generar-fixture-todos",
  partidoController.generarFixtureEventoTodos
);

// ===============================
// 📋 CONSULTAS (LECTURA)
// ===============================
router.get("/evento/:evento_id", partidoController.obtenerPartidosPorEvento);
router.get("/grupo/:grupo_id", partidoController.obtenerPartidosPorGrupo);
router.get(
  "/campeonato/:campeonato_id/jornada/:jornada",
  partidoController.obtenerPartidosPorCampeonatoYJornada
);
router.get(
  "/campeonato/:campeonato_id",
  partidoController.obtenerPartidosPorCampeonato
);

// ===============================
// 🔄 CRUD
// ===============================
router.post("/", partidoController.crearPartido);
router.get("/:id/planilla", partidoController.obtenerPlanillaPartido);
router.put("/:id/planilla", partidoController.guardarPlanillaPartido);
router.put("/:id", partidoController.actualizarPartido);
router.put("/:id/resultado", partidoController.registrarResultado);
router.put("/:id/resultado-shootouts", partidoController.registrarResultadoConShootouts);
router.delete("/:id", partidoController.eliminarPartido);
router.get("/:id", partidoController.obtenerPartido);

module.exports = router;
