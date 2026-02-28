const express = require("express");
const galeriaController = require("../controllers/galeriaController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", requireAuth, requireRoles("administrador", "operador"), galeriaController.listar);
router.get("/:id", requireAuth, requireRoles("administrador", "operador"), galeriaController.obtener);
router.post("/", requireAuth, requireRoles("administrador", "operador"), galeriaController.crear);
router.put("/:id", requireAuth, requireRoles("administrador", "operador"), galeriaController.actualizar);
router.delete("/:id", requireAuth, requireRoles("administrador", "operador"), galeriaController.eliminar);

module.exports = router;
