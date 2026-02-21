// routes/equipoRoutes.js
const express = require("express");
const router = express.Router();
const upload = require("../config/multerConfig"); // (usa tu misma ruta actual)
const equipoController = require("../controllers/equipoController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

// Middleware para indicar carpeta de subida
function setEquiposFolder(req, res, next) {
  req.uploadFolder = "equipos";
  next();
}

// CREATE con logo
router.post(
  "/",
  requireAuth,
  requireRoles("administrador", "organizador"),
  setEquiposFolder,
  upload.single("logo"),
  equipoController.crearEquipo
);



// READ
router.get("/", requireAuth, equipoController.obtenerTodosLosEquipos);
router.get(
  "/campeonato/:campeonato_id",
  requireAuth,
  equipoController.obtenerEquiposPorCampeonato
);
router.get("/:id", requireAuth, equipoController.obtenerEquipo);

// UPDATE con logo ✅ (aquí estaba el problema)
router.put(
  "/:id",
  requireAuth,
  requireRoles("administrador", "organizador"),
  setEquiposFolder,
  upload.single("logo"),
  equipoController.actualizarEquipo
);

// DELETE
router.delete("/:id", requireAuth, requireRoles("administrador", "organizador"), equipoController.eliminarEquipo);

// Cabeza de serie
router.put(
  "/:id/cabeza-serie",
  requireAuth,
  requireRoles("administrador", "organizador"),
  equipoController.designarCabezaSerie
);
router.get(
  "/campeonato/:campeonato_id/cabeza-serie",
  requireAuth,
  equipoController.obtenerCabezasDeSerie
);

module.exports = router;
