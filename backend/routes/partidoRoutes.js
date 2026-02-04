const express = require("express");
const router = express.Router();
const partidoController = require("../controllers/partidoController");

// FIXTURE por EVENTO
router.post("/generar-fixture-evento", partidoController.generarFixtureEventoCompleto);

// CONSULTAS
router.get("/evento/:evento_id", partidoController.obtenerPorEvento);
router.get("/evento/:evento_id/jornada/:jornada", partidoController.obtenerPorEventoYJornada);

// CRUD
router.put("/:id", partidoController.actualizarPartido);
router.delete("/:id", partidoController.eliminarPartido);
router.get("/:id", partidoController.obtenerPartido);

module.exports = router;
