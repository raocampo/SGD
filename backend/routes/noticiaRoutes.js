const express = require("express");
const noticiaController = require("../controllers/noticiaController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", requireAuth, requireRoles("administrador", "operador"), noticiaController.listar);
router.get("/:id", requireAuth, requireRoles("administrador", "operador"), noticiaController.obtener);
router.post("/", requireAuth, requireRoles("administrador", "operador"), noticiaController.crear);
router.put("/:id", requireAuth, requireRoles("administrador", "operador"), noticiaController.actualizar);
router.delete("/:id", requireAuth, requireRoles("administrador", "operador"), noticiaController.eliminar);
router.post("/:id/publicar", requireAuth, requireRoles("administrador", "operador"), noticiaController.publicar);
router.post("/:id/despublicar", requireAuth, requireRoles("administrador", "operador"), noticiaController.despublicar);

module.exports = router;
