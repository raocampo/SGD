// backend/routes/eliminatoriaRoutes.js
const express = require("express");
const router = express.Router();
const eliminatoriaController = require("../controllers/eliminatoriaController");

router.get("/evento/:evento_id", eliminatoriaController.obtenerPorEvento);
router.post("/evento/:evento_id/generar", eliminatoriaController.generarBracket);
router.put("/:id/resultado", eliminatoriaController.actualizarResultado);
router.put("/:id/equipos", eliminatoriaController.asignarEquipos);

module.exports = router;
