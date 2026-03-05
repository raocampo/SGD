/* eslint-disable no-console */
require("dotenv").config();

const DEFAULT_BASE_URL = "http://localhost:5000";
const baseUrl = String(process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");

function joinUrl(path) {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function compact(text) {
  return String(text == null ? "" : text).replace(/\s+/g, " ").trim();
}

function short(text, max = 180) {
  const value = compact(text);
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

async function requestJson(path, { method = "GET", token, body } = {}) {
  const response = await fetch(joinUrl(path), {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = null;
  }

  return {
    status: response.status,
    json,
    text,
    preview: short(json ? JSON.stringify(json) : text),
  };
}

function createQaUsers() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return [
    {
      role: "organizador",
      name: "QA Organizador",
      email: `qa.organizador.${stamp}@ltc.local`,
      password: "Qa123456!",
      organizationName: "QA LT&C",
    },
    {
      role: "tecnico",
      name: "QA Tecnico",
      email: `qa.tecnico.${stamp}@ltc.local`,
      password: "Qa123456!",
    },
    {
      role: "dirigente",
      name: "QA Dirigente",
      email: `qa.dirigente.${stamp}@ltc.local`,
      password: "Qa123456!",
    },
  ];
}

async function ensureRoleSession(user) {
  const registerPayload = {
    nombre: user.name,
    email: user.email,
    password: user.password,
    rol: user.role,
    organizacion_nombre: user.organizationName || undefined,
  };

  const registerRes = await requestJson("/api/auth/register-public", {
    method: "POST",
    body: registerPayload,
  });

  if (registerRes.status === 201 && registerRes.json?.accessToken && registerRes.json?.refreshToken) {
    return {
      mode: "register",
      accessToken: registerRes.json.accessToken,
      refreshToken: registerRes.json.refreshToken,
      role: String(registerRes.json?.user?.role || user.role).toLowerCase(),
    };
  }

  const alreadyExists = /ya existe|existe un usuario|email/i.test(
    String(registerRes.json?.error || registerRes.text || "")
  );

  if (!alreadyExists) {
    throw new Error(`No se pudo registrar ${user.role}: ${registerRes.status} ${registerRes.preview}`);
  }

  const loginRes = await requestJson("/api/auth/login", {
    method: "POST",
    body: {
      email: user.email,
      password: user.password,
      client_type: "mobile",
    },
  });

  if (loginRes.status !== 200 || !loginRes.json?.accessToken || !loginRes.json?.refreshToken) {
    throw new Error(`No se pudo iniciar sesion ${user.role}: ${loginRes.status} ${loginRes.preview}`);
  }

  return {
    mode: "login",
    accessToken: loginRes.json.accessToken,
    refreshToken: loginRes.json.refreshToken,
    role: String(loginRes.json?.user?.role || user.role).toLowerCase(),
  };
}

function expectedWriteStatus(role) {
  if (role === "organizador") return [400];
  return [403];
}

function expectedUsersStatus(role) {
  if (role === "organizador") return [200];
  return [403];
}

async function runRoleChecks(role, session) {
  const checks = [];

  const pushResult = (name, method, path, result, expectedStatuses, bodyAssert = null) => {
    const statusOk = expectedStatuses.includes(result.status);
    const bodyOk = typeof bodyAssert === "function" ? bodyAssert(result) : true;
    checks.push({
      role,
      name,
      method,
      path,
      status: result.status,
      expected: expectedStatuses.join("/"),
      ok: statusOk && bodyOk,
      preview: result.preview,
    });
  };

  const meRes = await requestJson("/api/mobile/v1/session", {
    token: session.accessToken,
  });
  pushResult(
    "session",
    "GET",
    "/api/mobile/v1/session",
    meRes,
    [200],
    (res) => String(res.json?.user?.role || "").toLowerCase() === role
  );

  const refreshRes = await requestJson("/api/auth/refresh", {
    method: "POST",
    body: { refreshToken: session.refreshToken, client_type: "mobile" },
  });
  pushResult(
    "refresh",
    "POST",
    "/api/auth/refresh",
    refreshRes,
    [200],
    (res) => Boolean(res.json?.accessToken)
  );

  const listUsersRes = await requestJson("/api/mobile/v1/usuarios", {
    token: session.accessToken,
  });
  pushResult(
    "usuarios-scope",
    "GET",
    "/api/mobile/v1/usuarios",
    listUsersRes,
    expectedUsersStatus(role)
  );

  const createTournamentRes = await requestJson("/api/mobile/v1/campeonatos", {
    method: "POST",
    token: session.accessToken,
    body: {},
  });
  pushResult(
    "campeonatos-write-guard",
    "POST",
    "/api/mobile/v1/campeonatos",
    createTournamentRes,
    expectedWriteStatus(role)
  );

  const createEventRes = await requestJson("/api/mobile/v1/eventos", {
    method: "POST",
    token: session.accessToken,
    body: {},
  });
  pushResult(
    "eventos-write-guard",
    "POST",
    "/api/mobile/v1/eventos",
    createEventRes,
    expectedWriteStatus(role)
  );

  const createFinanceRes = await requestJson("/api/mobile/v1/finanzas/movimientos", {
    method: "POST",
    token: session.accessToken,
    body: {},
  });
  pushResult(
    "finanzas-write-guard",
    "POST",
    "/api/mobile/v1/finanzas/movimientos",
    createFinanceRes,
    expectedWriteStatus(role)
  );

  return checks;
}

async function main() {
  console.log(`[roles-smoke] baseUrl=${baseUrl}`);

  const users = createQaUsers();
  const sessions = [];

  for (const user of users) {
    const session = await ensureRoleSession(user);
    sessions.push({
      role: user.role,
      ...session,
    });
    console.log(
      `[roles-smoke] ${user.role}: session via ${session.mode} (${user.email})`
    );
  }

  const allResults = [];
  for (const session of sessions) {
    const roleResults = await runRoleChecks(session.role, session);
    allResults.push(...roleResults);
  }

  allResults.forEach((result) => {
    console.log(
      `${result.ok ? "PASS" : "FAIL"} | ${result.role} | ${result.name} | ${result.method} ${result.path} | status=${result.status} expected=${result.expected} | ${result.preview}`
    );
  });

  const total = allResults.length;
  const failed = allResults.filter((item) => !item.ok);
  console.log(`[roles-smoke] total=${total} passed=${total - failed.length} failed=${failed.length}`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[roles-smoke] fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
