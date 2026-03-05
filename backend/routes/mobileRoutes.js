const express = require("express");
const mobileController = require("../controllers/mobileController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/session", requireAuth, mobileController.session);
router.get("/dashboard", requireAuth, mobileController.dashboard);

router.get("/campeonatos", requireAuth, mobileController.listCampeonatos);
router.get("/eventos", requireAuth, mobileController.listEventos);
router.post(
  "/eventos",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.postEvento
);
router.post(
  "/campeonatos",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.createCampeonato
);
router.get("/campeonatos/:id", requireAuth, mobileController.getCampeonato);
router.get("/campeonatos/:id/eventos", requireAuth, mobileController.listEventosCampeonato);
router.get("/campeonatos/:id/finanzas", requireAuth, mobileController.getFinanzasCampeonato);

router.get("/eventos/:id", requireAuth, mobileController.getEvento);
router.get("/eventos/:id/equipos", requireAuth, mobileController.listEquiposEvento);
router.get("/eventos/:id/competencia", requireAuth, mobileController.getCompetenciaEvento);
router.get("/eventos/:id/fair-play", requireAuth, mobileController.getFairPlayEvento);
router.get("/eventos/:id/partidos", requireAuth, mobileController.listPartidosEvento);
router.get("/eventos/:id/sorteo", requireAuth, mobileController.getSorteoEvento);
router.post(
  "/eventos/:id/sorteo/grupos",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.postCrearGruposEvento
);
router.post(
  "/eventos/:id/sorteo/automatico",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.postSorteoAutomatico
);
router.post(
  "/eventos/:id/sorteo/reiniciar",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.postReiniciarSorteo
);
router.post(
  "/eventos/:id/fixture",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.postGenerarFixture
);
router.get("/eventos/:id/eliminatorias", requireAuth, mobileController.getEliminatoriasEvento);
router.post(
  "/eventos/:id/eliminatorias",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.postGenerarEliminatorias
);

router.post(
  "/grupos/:id/equipos",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.postAsignarEquipoGrupo
);
router.delete(
  "/grupos/:id/equipos/:teamId",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.deleteEquipoGrupo
);

router.get("/equipos", requireAuth, mobileController.listEquipos);
router.post(
  "/equipos",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.postEquipo
);
router.get("/equipos/:id", requireAuth, mobileController.getEquipo);
router.get("/equipos/:id/jugadores", requireAuth, mobileController.listJugadoresEquipo);
router.get("/equipos/:id/estado-cuenta", requireAuth, mobileController.getEstadoCuentaEquipo);
router.get("/jugadores", requireAuth, mobileController.listJugadores);
router.post(
  "/jugadores",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.postJugador
);
router.delete(
  "/jugadores/:id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.deleteJugador
);
router.get("/pases", requireAuth, mobileController.listPases);
router.get(
  "/usuarios",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.listUsuarios
);

router.post(
  "/partidos/:id/resultado",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.postResultadoPartido
);
router.get(
  "/partidos/:id/planilla",
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente", "jugador"),
  mobileController.getPlanillaPartido
);
router.put(
  "/partidos/:id/planilla",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.putPlanillaPartido
);
router.put(
  "/eliminatorias/:id/resultado",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.putResultadoEliminatoria
);
router.put(
  "/pases/:id/estado",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.putEstadoPase
);

router.put(
  "/finanzas/movimientos/:id/pagar",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.payMovimiento
);
router.post(
  "/finanzas/movimientos",
  requireAuth,
  requireRoles("administrador", "organizador"),
  mobileController.postMovimientoFinanciero
);

module.exports = router;
