const express = require("express");
const router = express.Router();
const canchaController = require("../controllers/canchaController");

router.post("/", canchaController.crearCancha);
router.get("/", canchaController.listarCanchas);
router.get("/:id", canchaController.obtenerCancha);
router.put("/:id", canchaController.actualizarCancha);
router.delete("/:id", canchaController.eliminarCancha);

module.exports = router;