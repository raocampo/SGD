const express = require("express");
const router = express.Router();
const finanzaController = require("../controllers/finanzaController");

router.get("/movimientos", finanzaController.listarMovimientos);
router.post("/movimientos", finanzaController.crearMovimiento);
router.get("/equipo/:equipo_id/estado-cuenta", finanzaController.obtenerEstadoCuentaEquipo);
router.get("/morosidad", finanzaController.obtenerMorosidad);

module.exports = router;
