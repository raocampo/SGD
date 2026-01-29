// routes/equipoRoutes.js
const express = require("express");
const router = express.Router();
const upload = require("../config/multerConfig"); // (usa tu misma ruta actual)
const equipoController = require("../controllers/equipoController");

// Middleware para indicar carpeta de subida
function setEquiposFolder(req, res, next) {
  req.uploadFolder = "equipos";
  next();
}

// CREATE con logo
router.post(
  "/",
  setEquiposFolder,
  upload.single("logo"),
  equipoController.crearEquipo
);



// READ
router.get("/", equipoController.obtenerTodosLosEquipos);
router.get("/campeonato/:campeonato_id", equipoController.obtenerEquiposPorCampeonato);
router.get("/:id", equipoController.obtenerEquipo);

// UPDATE con logo ✅ (aquí estaba el problema)
router.put(
  "/:id",
  setEquiposFolder,
  upload.single("logo"),
  equipoController.actualizarEquipo
);

// DELETE
router.delete("/:id", equipoController.eliminarEquipo);

// Cabeza de serie
router.put("/:id/cabeza-serie", equipoController.designarCabezaSerie);
router.get("/campeonato/:campeonato_id/cabeza-serie", equipoController.obtenerCabezasDeSerie);

module.exports = router;
