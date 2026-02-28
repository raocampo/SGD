const express = require("express");
const contactoController = require("../controllers/contactoController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", requireAuth, requireRoles("administrador", "operador"), contactoController.listar);
router.get("/:id", requireAuth, requireRoles("administrador", "operador"), contactoController.obtener);
router.put("/:id", requireAuth, requireRoles("administrador", "operador"), contactoController.actualizarEstado);

module.exports = router;
