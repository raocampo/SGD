const express = require("express");
const router = express.Router();
const partidoController = require("../controllers/partidoController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

// ===============================
// 🎯 FIXTURE POR EVENTO
// ===============================
router.post(
  "/evento/:evento_id/generar-fixture",
  requireAuth,
  requireRoles("administrador", "organizador"),
  partidoController.generarFixtureEvento
);
// Compatibilidad con frontend anterior (evento_id en body)
router.post(
  "/evento/generar-fixture",
  requireAuth,
  requireRoles("administrador", "organizador"),
  partidoController.generarFixtureEvento
);
router.post(
  "/evento/generar-fixture-todos",
  requireAuth,
  requireRoles("administrador", "organizador"),
  partidoController.generarFixtureEventoTodos
);

// Eliminar fixture completo de un evento
router.delete(
  "/evento/:evento_id/fixture",
  requireAuth,
  requireRoles("administrador", "organizador"),
  partidoController.eliminarFixtureEvento
);

// Regenerar fixture preservando partidos ya jugados
router.post(
  "/evento/:evento_id/regenerar-preservando",
  requireAuth,
  requireRoles("administrador", "organizador"),
  partidoController.regenerarFixturePreservando
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
router.post("/", requireAuth, requireRoles("administrador", "organizador"), partidoController.crearPartido);
router.get(
  "/:id/planilla",
  requireAuth,
  requireRoles("administrador", "organizador", "tecnico", "dirigente", "jugador"),
  partidoController.obtenerPlanillaPartido
);
router.put(
  "/:id/planilla",
  requireAuth,
  requireRoles("administrador", "organizador"),
  partidoController.guardarPlanillaPartido
);
router.put("/:id", requireAuth, requireRoles("administrador", "organizador"), partidoController.actualizarPartido);
router.put(
  "/:id/resultado",
  requireAuth,
  requireRoles("administrador", "organizador"),
  partidoController.registrarResultado
);
router.put(
  "/:id/resultado-shootouts",
  requireAuth,
  requireRoles("administrador", "organizador"),
  partidoController.registrarResultadoConShootouts
);
router.delete("/:id", requireAuth, requireRoles("administrador", "organizador"), partidoController.eliminarPartido);
router.get("/:id", partidoController.obtenerPartido);

module.exports = router;
