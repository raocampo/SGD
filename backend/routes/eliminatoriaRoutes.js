// backend/routes/eliminatoriaRoutes.js
const express = require("express");
const router = express.Router();
const eliminatoriaController = require("../controllers/eliminatoriaController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

// La llave publica del portal sale por /api/public/eventos/:id/eliminatorias;
// esta ruta interna exige sesion y scoping por campeonato.
router.get(
  "/evento/:evento_id",
  requireAuth,
  requireRoles("administrador", "organizador", "operador_sistema", "tecnico", "dirigente", "jugador"),
  eliminatoriaController.obtenerPorEvento
);
router.get(
  "/evento/:evento_id/configuracion",
  requireAuth,
  eliminatoriaController.obtenerConfiguracion
);
router.get(
  "/evento/:evento_id/clasificacion",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eliminatoriaController.obtenerResumenClasificacion
);
router.post(
  "/evento/:evento_id/generar",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eliminatoriaController.generarBracket
);
router.post(
  "/evento/:evento_id/recomponer",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eliminatoriaController.recomponerBracket
);
router.put(
  "/evento/:evento_id/configuracion",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eliminatoriaController.guardarConfiguracion
);
router.delete(
  "/evento/:evento_id/configuracion",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eliminatoriaController.reiniciarConfiguracion
);
router.put(
  "/evento/:evento_id/clasificacion-manual",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eliminatoriaController.guardarClasificacionManual
);
router.put(
  "/evento/:evento_id/reclasificaciones/:reclasificacion_id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eliminatoriaController.resolverReclasificacion
);
router.put(
  "/:id/resultado",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eliminatoriaController.actualizarResultado
);
router.put(
  "/:id/equipos",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eliminatoriaController.asignarEquipos
);
router.put(
  "/:id/programar",
  requireAuth,
  requireRoles("administrador", "organizador"),
  eliminatoriaController.programarSlot
);

module.exports = router;
