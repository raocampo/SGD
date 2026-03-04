const express = require("express");
const router = express.Router();
const eventoController = require("../controllers/eventoController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

// CRUD
router.post(
  "/",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eventoController.crearEvento
);
router.get("/", eventoController.listarEventos);
router.get("/campeonato/:campeonato_id", eventoController.listarEventosPorCampeonato);
router.get("/:id", eventoController.obtenerEvento);
router.put(
  "/:id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eventoController.actualizarEvento
);
router.delete(
  "/:id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eventoController.eliminarEvento
);

// Canchas del evento (evento_canchas)
router.post(
  "/:evento_id/canchas",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eventoController.asignarCanchasAEvento
);
router.get("/:evento_id/canchas", eventoController.listarCanchasDeEvento);

// Equipos del evento (evento_equipos)
router.post(
  "/:evento_id/equipos",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eventoController.asignarEquipoAEvento
);
router.get(
  "/:evento_id/equipos",
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente", "jugador"),
  eventoController.listarEquiposDeEvento
);
router.delete(
  "/:evento_id/equipos/:equipo_id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eventoController.quitarEquipoDeEvento
);


module.exports = router;
