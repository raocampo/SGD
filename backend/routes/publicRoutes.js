const express = require("express");
const noticiaController = require("../controllers/noticiaController");
const galeriaController = require("../controllers/galeriaController");
const portalContenidoController = require("../controllers/portalContenidoController");
const contactoController = require("../controllers/contactoController");
const tablaController = require("../controllers/tablaController");
const publicPortalController = require("../controllers/publicPortalController");

const router = express.Router();

router.get("/campeonatos", publicPortalController.listarCampeonatos);
router.get("/campeonatos/:campeonato_id", publicPortalController.obtenerCampeonato);
router.get("/campeonatos/:campeonato_id/eventos", publicPortalController.listarEventosPorCampeonato);
router.get("/eventos/:evento_id/partidos", publicPortalController.obtenerPartidosPorEvento);
router.get("/eventos/:evento_id/tablas", publicPortalController.obtenerTablasPorEvento);
router.get("/eventos/:evento_id/eliminatorias", publicPortalController.obtenerEliminatoriasPorEvento);
router.get("/eventos/:evento_id/goleadores", tablaController.obtenerGoleadoresEvento);
router.get("/eventos/:evento_id/tarjetas", tablaController.obtenerTarjetasEvento);
router.get("/eventos/:evento_id/fair-play", tablaController.obtenerFairPlayEvento);
router.get("/noticias", noticiaController.listarPublicas);
router.get("/noticias/:slug", noticiaController.obtenerPublicaPorSlug);
router.get("/galeria", galeriaController.listarPublica);
router.get("/portal-contenido", portalContenidoController.obtener);
router.post("/contacto", contactoController.enviar);

module.exports = router;
