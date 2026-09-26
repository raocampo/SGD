// routes/grupoRoutes.js
const express = require("express");
const router = express.Router();
const grupoController = require("../controllers/grupoController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

// ===============================
// EVENTO (NUEVO)
// ===============================
router.post(
  "/evento/crear",
  requireAuth,
  requireRoles("administrador", "organizador"),
  grupoController.crearGruposPorEvento
);
// Agrega UN grupo más a un evento que ya tiene grupos (post-sorteo), sin
// tocar los existentes -- distinto de /evento/crear que crea el set inicial.
router.post(
  "/evento/:evento_id/agregar",
  requireAuth,
  requireRoles("administrador", "organizador"),
  grupoController.agregarGrupoAEvento
);
router.get("/evento/:evento_id", grupoController.obtenerGruposPorEvento);
router.get("/evento/:evento_id/completo", grupoController.obtenerGruposPorEventoCompleto);
// Compatibilidad con frontend que consulta por campeonato
router.get("/campeonato/:campeonato_id", grupoController.obtenerGruposPorCampeonato);
router.get(
  "/campeonato/:campeonato_id/completo",
  grupoController.obtenerGruposPorCampeonatoCompleto
);

// ===============================
// GRUPO / EQUIPOS
// ===============================
router.get("/:id", grupoController.obtenerGrupo);
router.get("/:grupo_id/equipos", grupoController.obtenerEquiposDelGrupo);
router.post(
  "/:grupo_id/equipos",
  requireAuth,
  requireRoles("administrador", "organizador"),
  grupoController.asignarEquipo
);
router.delete(
  "/:grupo_id/equipos/:equipo_id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  grupoController.removerEquipo
);
// Mueve un equipo directamente a este grupo (venga de otro grupo del mismo
// evento, o esté pendiente) en un solo paso -- edición post-sorteo.
router.post(
  "/:grupo_id/mover-equipo",
  requireAuth,
  requireRoles("administrador", "organizador"),
  grupoController.moverEquipoAGrupo
);

// ===============================
// CRUD GRUPO
// ===============================
router.put("/:id", requireAuth, requireRoles("administrador", "organizador"), grupoController.actualizarGrupo);
router.delete("/:id", requireAuth, requireRoles("administrador", "organizador"), grupoController.eliminarGrupo);

module.exports = router;
