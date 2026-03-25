const jwt = require("jsonwebtoken");
const UsuarioAuth = require("../models/UsuarioAuth");
const { getJwtSecret } = require("../middleware/authMiddleware");

const ACCESS_TOKEN_TTL = process.env.JWT_EXPIRES_IN || "12h";
const REFRESH_TOKEN_TTL_DAYS = Number.parseInt(process.env.JWT_REFRESH_TTL_DAYS || "30", 10) || 30;

function normalizarRol(rol) {
  return String(rol || "").trim().toLowerCase();
}

function permisosPorRol(user) {
  const rol = normalizarRol(user?.rol);
  if (rol === "administrador") {
    return [
      "campeonatos:read",
      "campeonatos:write",
      "eventos:read",
      "eventos:write",
      "equipos:read",
      "equipos:write",
      "jugadores:read",
      "jugadores:write",
      "partidos:read",
      "partidos:write",
      "planilla:write",
      "finanzas:read",
      "finanzas:write",
      "usuarios:read",
      "usuarios:write",
      "portal:read",
      "portal:write",
      "cms:read",
      "cms:write",
      "noticias:read",
      "noticias:write",
      "galeria:read",
      "galeria:write",
      "contenido:read",
      "contenido:write",
      "contacto:read",
      "contacto:write",
    ];
  }

  if (rol === "operador") {
    // Operador CMS: gestiona contenido del sitio web (noticias, galería, portal)
    return [
      "portal:read",
      "portal:write",
      "cms:read",
      "cms:write",
      "noticias:read",
      "noticias:write",
      "galeria:read",
      "galeria:write",
      "contenido:read",
      "contenido:write",
      "contacto:read",
      "contacto:write",
    ];
  }

  if (rol === "operador_sistema") {
    // Operador Sistema: registra planillas de partido, consulta módulos deportivos
    return [
      "campeonatos:read",
      "eventos:read",
      "equipos:read",
      "jugadores:read",
      "partidos:read",
      "planilla:read",
      "planilla:write",
      "finanzas:read",
      "portal:read",
    ];
  }

  if (rol === "organizador") {
    return [
      "campeonatos:read",
      "campeonatos:write",
      "eventos:read",
      "eventos:write",
      "equipos:read",
      "equipos:write",
      "jugadores:read",
      "jugadores:write",
      "partidos:read",
      "partidos:write",
      "planilla:write",
      "finanzas:read",
      "finanzas:write",
    ];
  }

  if (rol === "tecnico") {
    return [
      "campeonatos:read",
      "eventos:read",
      "equipos:read",
      "jugadores:read",
      "jugadores:write",
      "partidos:read",
      "planilla:read",
      "finanzas:read",
    ];
  }

  if (rol === "dirigente") {
    return [
      "campeonatos:read",
      "eventos:read",
      "equipos:read",
      "jugadores:read",
      "jugadores:write",
      "partidos:read",
      "finanzas:read",
    ];
  }

  if (rol === "jugador") {
    return [
      "campeonatos:read",
      "eventos:read",
      "equipos:read",
      "jugadores:read",
      "partidos:read",
      "finanzas:read",
    ];
  }

  return [];
}

function signAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      rol: user.rol,
    },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

function buildSessionPayload(user, tokens = {}) {
  const accessToken = tokens.accessToken || null;
  const refreshToken = tokens.refreshToken || null;
  const permissions = permisosPorRol(user);

  return {
    ok: true,
    accessToken,
    refreshToken,
    token: accessToken,
    user,
    usuario: user,
    roles: [user?.rol].filter(Boolean),
    permissions,
    plan: {
      codigo: user?.plan_codigo || null,
      estado: user?.plan_estado || null,
    },
    solo_lectura: user?.solo_lectura === true,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt || null,
  };
}

async function crearSession(user, context = {}) {
  const accessToken = signAccessToken(user);
  const refreshData = await UsuarioAuth.crearRefreshToken(user.id, {
    ttl_days: context.ttl_days || REFRESH_TOKEN_TTL_DAYS,
    client_type: context.client_type || "web",
    user_agent: context.user_agent || null,
    ip_address: context.ip_address || null,
  });

  return buildSessionPayload(user, {
    accessToken,
    refreshToken: refreshData.token,
    refreshTokenExpiresAt: refreshData.expires_at,
  });
}

async function refrescarSession(refreshToken, context = {}) {
  const rotated = await UsuarioAuth.rotarRefreshToken(refreshToken, {
    ttl_days: context.ttl_days || REFRESH_TOKEN_TTL_DAYS,
    client_type: context.client_type || "web",
    user_agent: context.user_agent || null,
    ip_address: context.ip_address || null,
  });

  if (!rotated?.usuario) {
    throw new Error("No se pudo refrescar la sesión");
  }

  return buildSessionPayload(rotated.usuario, {
    accessToken: signAccessToken(rotated.usuario),
    refreshToken: rotated.refreshToken,
    refreshTokenExpiresAt: rotated.refreshTokenExpiresAt,
  });
}

async function cerrarSession(refreshToken) {
  if (!refreshToken) return false;
  return UsuarioAuth.revocarRefreshToken(refreshToken);
}

module.exports = {
  buildSessionPayload,
  crearSession,
  cerrarSession,
  permisosPorRol,
  refrescarSession,
  signAccessToken,
};
