// Cuenta real detrás de la sesión, disponible durante toda la petición.
// Un co-organizador opera con la identidad del titular (req.user.id es el
// titular; ver UsuarioAuth.resolverIdentidadEfectiva), pero la auditoría
// debe registrar qué cuenta hizo cada acción sin cambiar cada llamada.
const { AsyncLocalStorage } = require("async_hooks");

const almacen = new AsyncLocalStorage();

function ejecutarConCuenta(user, fn) {
  const cuentaUsuarioId = Number(user?.cuenta_usuario_id) || null;
  if (!cuentaUsuarioId) return fn();
  return almacen.run({ cuentaUsuarioId, titularId: Number(user.id) || null }, fn);
}

function cuentaActual() {
  return almacen.getStore() || null;
}

module.exports = { ejecutarConCuenta, cuentaActual };
