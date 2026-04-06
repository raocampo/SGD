const express = require("express");
const noticiaController = require("../controllers/noticiaController");
const galeriaController = require("../controllers/galeriaController");
const portalContenidoController = require("../controllers/portalContenidoController");
const contactoController = require("../controllers/contactoController");
const publicPortalController = require("../controllers/publicPortalController");
const transmisionController = require("../controllers/transmisionController");

const router = express.Router();

router.get("/campeonatos", publicPortalController.listarCampeonatos);
router.get("/campeonatos/:campeonato_id", publicPortalController.obtenerCampeonato);
router.get("/campeonatos/:campeonato_id/eventos", publicPortalController.listarEventosPorCampeonato);
router.get(
  "/campeonatos/:campeonato_id/auspiciantes",
  publicPortalController.listarAuspiciantesPorCampeonato
);
router.get(
  "/campeonatos/:campeonato_id/media",
  publicPortalController.listarMediaPorCampeonato
);
router.get("/eventos/:evento_id/partidos", publicPortalController.obtenerPartidosPorEvento);
router.get("/eventos/:evento_id/tablas", publicPortalController.obtenerTablasPorEvento);
router.get("/eventos/:evento_id/eliminatorias", publicPortalController.obtenerEliminatoriasPorEvento);
router.get("/eventos/:evento_id/goleadores", publicPortalController.obtenerGoleadoresPorEvento);
router.get("/eventos/:evento_id/tarjetas", publicPortalController.obtenerTarjetasPorEvento);
router.get("/eventos/:evento_id/fair-play", publicPortalController.obtenerFairPlayPorEvento);
router.get("/noticias", noticiaController.listarPublicas);
router.get("/noticias/:slug", noticiaController.obtenerPublicaPorSlug);
router.get("/galeria", galeriaController.listarPublica);
router.get("/portal-contenido", portalContenidoController.obtener);
router.post("/contacto", contactoController.enviar);

// 📡 Transmisiones públicas
router.get("/partidos/:id/transmision", transmisionController.obtenerTransmisionPublica);
router.get("/campeonatos/:id/transmisiones-activas", transmisionController.listarTransmisionesActivasPorCampeonato);
router.get("/transmisiones/destacadas", transmisionController.listarDestacadasPublicas);

module.exports = router;
