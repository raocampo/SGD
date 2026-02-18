// backend/routes/partidoRoutes.js
const express = require("express");
const router = express.Router();
const partidoController = require("../controllers/partidoController");

// ===============================
// 🎯 FIXTURE / GENERACIÓN
// ===============================
// Fixture por EVENTO (unificado por jornadas, todos los grupos)
router.post("/generar-fixture-evento", partidoController.generarFixturePorEvento);

// Fixture "todos contra todos" por EVENTO (si algún evento no tiene grupos)
router.post("/generar-fixture-evento-todos", partidoController.generarFixtureTodosPorEvento);

// ===============================
// 📤 EXPORTACIÓN
// ===============================
router.get("/exportar/evento/:evento_id", partidoController.exportarFixtureEventoCSV);

// ===============================
// 📊 ESTADÍSTICAS / RESULTADOS
// ===============================
router.get(
  "/estadisticas/equipo/:equipo_id/evento/:evento_id",
  partidoController.obtenerEstadisticasEquipoPorEvento
);

router.put("/:id/resultado", partidoController.registrarResultado);
router.put("/:id/resultado-shootouts", partidoController.registrarResultadoConShootouts);

// ===============================
// 📋 CONSULTAS (LECTURA)
// ===============================
// Jornadas (todos los grupos) por evento
router.get(
  "/evento/:evento_id/jornada/:jornada",
  partidoController.obtenerPartidosPorEventoYJornada
);

router.get("/evento/:evento_id", partidoController.obtenerPartidosPorEvento);
router.get("/grupo/:grupo_id", partidoController.obtenerPartidosPorGrupo);

// ===============================
// 🔄 CRUD BÁSICO
// ===============================
router.post("/", partidoController.crearPartido);
router.put("/:id", partidoController.actualizarPartido);
router.delete("/:id", partidoController.eliminarPartido);

// ⚠️ SIEMPRE AL FINAL
router.get("/:id", partidoController.obtenerPartido);

module.exports = router;