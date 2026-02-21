const jwt = require("jsonwebtoken");
const UsuarioAuth = require("../models/UsuarioAuth");

function getJwtSecret() {
  return process.env.JWT_SECRET || "sgd-dev-secret-change-me";
}

function parseBearerToken(req) {
  const auth = String(req.headers.authorization || "");
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim();
}

async function requireAuth(req, res, next) {
  try {
    const token = parseBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "No autenticado. Token requerido." });
    }

    const payload = jwt.verify(token, getJwtSecret());
    const user = await UsuarioAuth.obtenerPorId(payload?.id);
    if (!user || !user.activo) {
      return res.status(401).json({ error: "Usuario inválido o inactivo." });
    }

    req.user = UsuarioAuth.limpiarUsuario(user);
    const metodo = String(req.method || "").toUpperCase();
    const esLectura = metodo === "GET" || metodo === "HEAD" || metodo === "OPTIONS";
    if (req.user?.solo_lectura === true && !esLectura) {
      return res.status(403).json({
        error: "Tu cuenta está en modo solo lectura. No tienes permisos de modificación.",
      });
    }
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido o expirado." });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const token = parseBearerToken(req);
    if (!token) return next();

    const payload = jwt.verify(token, getJwtSecret());
    const user = await UsuarioAuth.obtenerPorId(payload?.id);
    if (!user || !user.activo) return next();

    req.user = UsuarioAuth.limpiarUsuario(user);
    return next();
  } catch (_) {
    return next();
  }
}

function requireRoles(...roles) {
  const permitidos = new Set(roles.map((r) => String(r || "").toLowerCase()));
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "No autenticado." });
    const rol = String(req.user.rol || "").toLowerCase();
    if (!permitidos.has(rol)) {
      return res.status(403).json({ error: "No autorizado para esta acción." });
    }
    return next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRoles,
  getJwtSecret,
};
