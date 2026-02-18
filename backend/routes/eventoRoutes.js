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

// Equipos del evento (evento_equipos)
router.post("/:evento_id/equipos", eventoController.asignarEquipoAEvento);
router.get("/:evento_id/equipos", eventoController.listarEquiposDeEvento);
router.delete("/:evento_id/equipos/:equipo_id", eventoController.quitarEquipoDeEvento);


module.exports = router;