const express = require("express");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");
const upload = require("../config/multerComprobantes");
const {
  subirComprobante,
  listarComprobantes,
  activarCuenta,
  rechazarComprobante,
} = require("../controllers/comprobanteController");

const router = express.Router();

// Usuario sube su comprobante (debe estar autenticado aunque plan_estado = pendiente_pago)
// NOTA: requireAuth bloquea sin token, pero el usuario con pendiente_pago SÍ tiene token
// si se registró en plan free/demo primero. Para cuentas pendiente_pago sin sesión
// el flujo es: login → 402 → modal con botón subir (sin sesión, se usa identificador + email).
// Por simplicidad inicial: el usuario se loguea con una ruta especial o usa su token si lo tiene.
// Ruta pública (con token opcional) — validamos en el controller:
router.post(
  "/",
  requireAuth,
  upload.single("comprobante"),
  subirComprobante
);

// Admin: listar comprobantes pendientes/aprobados/rechazados
router.get(
  "/admin",
  requireAuth,
  requireRoles("administrador"),
  listarComprobantes
);

// Admin: activar cuenta
router.put(
  "/admin/:id/activar",
  requireAuth,
  requireRoles("administrador"),
  activarCuenta
);

// Admin: rechazar comprobante
router.put(
  "/admin/:id/rechazar",
  requireAuth,
  requireRoles("administrador"),
  rechazarComprobante
);

module.exports = router;
