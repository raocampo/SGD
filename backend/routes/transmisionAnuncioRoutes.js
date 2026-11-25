const express = require("express");
const router = express.Router();
const controller = require("../controllers/transmisionAnuncioController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");
const { subirArchivoAnuncio } = require("../config/multerMedia");

// Anuncios pagados de las transmisiones (imágenes y videos/reels).
const ROLES = ["administrador", "organizador"];

router.get("/", requireAuth, requireRoles(...ROLES), controller.listar);
router.post("/", requireAuth, requireRoles(...ROLES), subirArchivoAnuncio, controller.crear);
router.put("/:id", requireAuth, requireRoles(...ROLES), subirArchivoAnuncio, controller.actualizar);
router.delete("/:id", requireAuth, requireRoles(...ROLES), controller.eliminar);

module.exports = router;
