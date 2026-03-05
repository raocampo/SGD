/* eslint-disable no-console */
require("dotenv").config();

const DEFAULT_BASE_URL = "http://localhost:5000";
const baseUrl = String(process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");

const sharedPassword = String(process.env.SMOKE_PROVIDED_PASSWORD || "").trim();
const defaultSuffix = "qa";

const users = [
  {
    role: "administrador",
    email: process.env.SMOKE_ADMIN_EMAIL || "",
    password: process.env.SMOKE_ADMIN_PASSWORD || "",
  },
  {
    role: "operador",
    email: process.env.SMOKE_OPERADOR_EMAIL || "qa.operador@ltc.local",
    password: process.env.SMOKE_OPERADOR_PASSWORD || sharedPassword,
  },
  {
    role: "organizador",
    email: process.env.SMOKE_ORGANIZADOR_EMAIL || "qa.organizador@ltc.local",
    password: process.env.SMOKE_ORGANIZADOR_PASSWORD || sharedPassword,
  },
  {
    role: "tecnico",
    email: process.env.SMOKE_TECNICO_EMAIL || "qa.tecnico@ltc.local",
    password: process.env.SMOKE_TECNICO_PASSWORD || sharedPassword,
  },
  {
    role: "dirigente",
    email: process.env.SMOKE_DIRIGENTE_EMAIL || "qa.dirigente@ltc.local",
    password: process.env.SMOKE_DIRIGENTE_PASSWORD || sharedPassword,
  },
  {
    role: "jugador",
    email: process.env.SMOKE_JUGADOR_EMAIL || "qa.jugador@ltc.local",
    password: process.env.SMOKE_JUGADOR_PASSWORD || sharedPassword,
  },
].filter((item) => item.email && item.password);

function joinUrl(path) {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function minify(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function preview(value, max = 180) {
  const content = minify(value);
  return content.length > max ? `${content.slice(0, max)}...` : content;
}

async function request(path, { method = "GET", token, body } = {}) {
  const res = await fetch(joinUrl(path), {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = null;
  }

  return {
    status: res.status,
    json,
    text,
    preview: preview(json ? JSON.stringify(json) : text),
  };
}

function expectedMobileWriteStatus(role) {
  return role === "organizador" || role === "administrador" ? [400] : [403];
}

function expectedMobileUsersStatus(role) {
  return role === "organizador" || role === "administrador" ? [200] : [403];
}

function expectedCmsStatus(role) {
  return role === "operador" || role === "administrador" ? [200] : [403];
}

async function loginUser(account) {
  const res = await request("/api/auth/login", {
    method: "POST",
    body: {
      email: account.email,
      password: account.password,
      client_type: "mobile",
      source: `${defaultSuffix}-smoke`,
    },
  });

  if (res.status !== 200 || !res.json?.accessToken || !res.json?.refreshToken) {
    throw new Error(`login ${account.role} fallo: status=${res.status} body=${res.preview}`);
  }

  const role = String(res.json?.user?.role || "").toLowerCase();
  return {
    ...account,
    detectedRole: role,
    accessToken: res.json.accessToken,
    refreshToken: res.json.refreshToken,
  };
}

async function runChecksFor(account) {
  const checks = [];
  const push = (name, method, path, result, expectedStatuses, assert = null) => {
    const statusOk = expectedStatuses.includes(result.status);
    const bodyOk = typeof assert === "function" ? assert(result) : true;
    checks.push({
      role: account.role,
      name,
      method,
      path,
      status: result.status,
      expected: expectedStatuses.join("/"),
      ok: statusOk && bodyOk,
      preview: result.preview,
    });
  };

  const sessionRes = await request("/api/mobile/v1/session", { token: account.accessToken });
  push("mobile-session", "GET", "/api/mobile/v1/session", sessionRes, [200], (res) => {
    const role = String(res.json?.user?.role || "").toLowerCase();
    return role === account.role;
  });

  const refreshRes = await request("/api/auth/refresh", {
    method: "POST",
    body: {
      refreshToken: account.refreshToken,
      client_type: "mobile",
      source: `${defaultSuffix}-smoke`,
    },
  });
  push("auth-refresh", "POST", "/api/auth/refresh", refreshRes, [200], (res) =>
    Boolean(res.json?.accessToken)
  );

  const mobileUsersRes = await request("/api/mobile/v1/usuarios", {
    token: account.accessToken,
  });
  push(
    "mobile-usuarios",
    "GET",
    "/api/mobile/v1/usuarios",
    mobileUsersRes,
    expectedMobileUsersStatus(account.role)
  );

  const mobileCreateTournament = await request("/api/mobile/v1/campeonatos", {
    method: "POST",
    token: account.accessToken,
    body: {},
  });
  push(
    "mobile-write-campeonatos",
    "POST",
    "/api/mobile/v1/campeonatos",
    mobileCreateTournament,
    expectedMobileWriteStatus(account.role)
  );

  const mobileCreateFinance = await request("/api/mobile/v1/finanzas/movimientos", {
    method: "POST",
    token: account.accessToken,
    body: {},
  });
  push(
    "mobile-write-finanzas",
    "POST",
    "/api/mobile/v1/finanzas/movimientos",
    mobileCreateFinance,
    expectedMobileWriteStatus(account.role)
  );

  const cmsNoticias = await request("/api/noticias", { token: account.accessToken });
  push("cms-noticias", "GET", "/api/noticias", cmsNoticias, expectedCmsStatus(account.role));

  const cmsGaleria = await request("/api/galeria", { token: account.accessToken });
  push("cms-galeria", "GET", "/api/galeria", cmsGaleria, expectedCmsStatus(account.role));

  const cmsContenido = await request("/api/portal-contenido", { token: account.accessToken });
  push(
    "cms-portal-contenido",
    "GET",
    "/api/portal-contenido",
    cmsContenido,
    expectedCmsStatus(account.role)
  );

  const cmsContacto = await request("/api/contacto", { token: account.accessToken });
  push("cms-contacto", "GET", "/api/contacto", cmsContacto, expectedCmsStatus(account.role));

  return checks;
}

async function main() {
  if (!sharedPassword && !process.env.SMOKE_OPERADOR_PASSWORD && !process.env.SMOKE_ORGANIZADOR_PASSWORD) {
    throw new Error(
      "Falta password de pruebas. Define SMOKE_PROVIDED_PASSWORD o los SMOKE_*_PASSWORD por rol."
    );
  }
  console.log(`[provided-smoke] baseUrl=${baseUrl}`);
  console.log(`[provided-smoke] users=${users.map((u) => `${u.role}:${u.email}`).join(", ")}`);

  const sessions = [];
  for (const account of users) {
    const session = await loginUser(account);
    sessions.push(session);
    console.log(`[provided-smoke] login ok role=${account.role} email=${account.email}`);
  }

  const all = [];
  for (const session of sessions) {
    const roleChecks = await runChecksFor(session);
    all.push(...roleChecks);
  }

  all.forEach((check) => {
    console.log(
      `${check.ok ? "PASS" : "FAIL"} | ${check.role} | ${check.name} | ${check.method} ${check.path} | status=${check.status} expected=${check.expected} | ${check.preview}`
    );
  });

  const failed = all.filter((x) => !x.ok);
  console.log(`[provided-smoke] total=${all.length} passed=${all.length - failed.length} failed=${failed.length}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[provided-smoke] fatal ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
