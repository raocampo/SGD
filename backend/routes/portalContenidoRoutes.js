const express = require("express");
const portalContenidoController = require("../controllers/portalContenidoController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", requireAuth, requireRoles("administrador", "operador"), portalContenidoController.obtener);
router.put("/", requireAuth, requireRoles("administrador", "operador"), portalContenidoController.actualizar);

module.exports = router;
