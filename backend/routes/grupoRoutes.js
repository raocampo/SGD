// routes/grupoRoutes.js
const express = require("express");
const router = express.Router();
const grupoController = require("../controllers/grupoController");

// ===============================
// EVENTO (NUEVO)
// ===============================
router.post("/evento/crear", grupoController.crearGruposPorEvento);
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
router.post("/:grupo_id/equipos", grupoController.asignarEquipo);
router.delete("/:grupo_id/equipos/:equipo_id", grupoController.removerEquipo);

// ===============================
// CRUD GRUPO
// ===============================
router.put("/:id", grupoController.actualizarGrupo);
router.delete("/:id", grupoController.eliminarGrupo);

module.exports = router;
