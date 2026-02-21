const express = require("express");
const router = express.Router();
const upload = require("../config/multerConfig");
const auspicianteController = require("../controllers/auspicianteController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

function setAuspiciantesFolder(req, res, next) {
  req.uploadFolder = "auspiciantes";
  next();
}

router.get(
  "/campeonato/:campeonato_id",
  auspicianteController.listarPorCampeonato
);

router.post(
  "/",
  requireAuth,
  requireRoles("administrador", "organizador"),
  setAuspiciantesFolder,
  upload.single("logo"),
  auspicianteController.crear
);

router.put(
  "/:id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  setAuspiciantesFolder,
  upload.single("logo"),
  auspicianteController.actualizar
);

router.delete(
  "/:id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  auspicianteController.eliminar
);

module.exports = router;
