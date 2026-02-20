const express = require("express");
const router = express.Router();
const upload = require("../config/multerConfig");
const auspicianteController = require("../controllers/auspicianteController");

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
  setAuspiciantesFolder,
  upload.single("logo"),
  auspicianteController.crear
);

router.put(
  "/:id",
  setAuspiciantesFolder,
  upload.single("logo"),
  auspicianteController.actualizar
);

router.delete("/:id", auspicianteController.eliminar);

module.exports = router;
