const express = require("express");
const router = express.Router();
const canchaController = require("../controllers/canchaController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

router.post("/", requireAuth, requireRoles("administrador", "organizador"), canchaController.crearCancha);
router.get("/", canchaController.listarCanchas);
router.get("/:id", canchaController.obtenerCancha);
router.put("/:id", requireAuth, requireRoles("administrador", "organizador"), canchaController.actualizarCancha);
router.delete("/:id", requireAuth, requireRoles("administrador", "organizador"), canchaController.eliminarCancha);

module.exports = router;
