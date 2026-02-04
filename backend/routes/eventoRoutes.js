const express = require("express");
const router = express.Router();
const eventoController = require("../controllers/eventoController");

// CRUD
router.post("/", eventoController.crearEvento);
router.get("/", eventoController.listarEventos);
router.get("/campeonato/:campeonato_id", eventoController.listarEventosPorCampeonato);
router.get("/:id", eventoController.obtenerEvento);
router.put("/:id", eventoController.actualizarEvento);
router.delete("/:id", eventoController.eliminarEvento);

// Canchas del evento (evento_canchas)
router.post("/:evento_id/canchas", eventoController.asignarCanchasAEvento);
router.get("/:evento_id/canchas", eventoController.listarCanchasDeEvento);

module.exports = router;