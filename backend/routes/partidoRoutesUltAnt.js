const express = require("express");
const router = express.Router();
const partidoController = require("../controllers/partidoController");

// ===============================
// 🎯 FIXTURE / GENERACIÓN
// ===============================
router.post("/generar-fixture-evento", partidoController.generarFixtureEvento);

// (si luego quieres “completo” lo defines con otro path)
//router.post("/generar-fixture-evento-completo", partidoController.generarFixtureEventoCompleto);

router.post("/generar-fixture", partidoController.generarFixture);
router.post("/generar-fixture-completo", partidoController.generarFixtureCompleto);
router.post("/generar-fixture-todos", partidoController.generarFixtureTodosContraTodos);

// ===============================
// 📋 CONSULTAS (LECTURA)
// ===============================
router.get("/evento/:evento_id", partidoController.obtenerPartidosPorEvento);
router.get("/evento/:evento_id/jornada/:jornada", partidoController.obtenerPartidosPorEventoYJornada);

router.get("/campeonato/:campeonato_id/jornada/:jornada", partidoController.obtenerPartidosPorCampeonatoYJornada);
router.get("/grupo/:grupo_id", partidoController.obtenerPartidosPorGrupo);
router.get("/campeonato/:campeonato_id", partidoController.obtenerPartidosPorCampeonato);

// ===============================
// 🔄 CRUD
// ===============================
router.post("/", partidoController.crearPartido);
router.put("/:id", partidoController.actualizarPartido);
router.delete("/:id", partidoController.eliminarPartido);

// SIEMPRE AL FINAL
router.get("/:id", partidoController.obtenerPartido);

module.exports = router;
