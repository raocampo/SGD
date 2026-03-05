/* eslint-disable no-console */
require("dotenv").config();

const DEFAULT_BASE_URL = "http://localhost:5000";
const baseUrl = String(process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
const token = String(process.env.SMOKE_TOKEN || "").trim();
const DEFAULT_TIMEOUT_MS = 12000;
const timeoutMsValue = Number.parseInt(String(process.env.SMOKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS), 10);
const timeoutMs = Number.isFinite(timeoutMsValue) && timeoutMsValue > 0 ? timeoutMsValue : DEFAULT_TIMEOUT_MS;

function joinUrl(path) {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function truncate(text, size = 180) {
  const raw = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
  if (raw.length <= size) return raw;
  return `${raw.slice(0, size)}...`;
}

async function runCheck(check) {
  const headers = {
    Accept: "application/json",
    ...(check.body ? { "Content-Type": "application/json" } : {}),
    ...(check.auth ? { Authorization: `Bearer ${token}` } : {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(joinUrl(check.path), {
      method: check.method || "GET",
      headers,
      body: check.body ? JSON.stringify(check.body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = null;
  }

  const statusOk = Array.isArray(check.expectedStatus)
    ? check.expectedStatus.includes(response.status)
    : response.status === check.expectedStatus;

  const bodyOk = typeof check.assertBody === "function" ? check.assertBody(json, text) : true;
  const ok = statusOk && bodyOk;

  return {
    name: check.name,
    method: check.method || "GET",
    url: joinUrl(check.path),
    status: response.status,
    ok,
    preview: truncate(json ? JSON.stringify(json) : text),
  };
}

async function main() {
  const checks = [
    {
      name: "salud",
      path: "/salud",
      expectedStatus: 200,
      assertBody: (json) => Boolean(json && json.mensaje),
    },
    {
      name: "testDb",
      path: "/testDb",
      expectedStatus: 200,
      assertBody: (json) => Boolean(json && (json.estado || json.mensaje)),
    },
    {
      name: "public-campeonatos",
      path: "/api/public/campeonatos",
      expectedStatus: 200,
      assertBody: (json) => Boolean(json && json.ok === true),
    },
    {
      name: "public-noticias",
      path: "/api/public/noticias",
      expectedStatus: 200,
      assertBody: (json) => Boolean(json && json.ok === true),
    },
    {
      name: "cms-noticias-sin-token",
      path: "/api/noticias",
      expectedStatus: 401,
      assertBody: (_, text) => /token|autorizad|unauthorized/i.test(String(text)),
    },
    {
      name: "deportivo-campeonatos-sin-token",
      path: "/api/campeonatos",
      expectedStatus: 401,
      assertBody: (_, text) => /token|autorizad|unauthorized/i.test(String(text)),
    },
    {
      name: "mobile-session-sin-token",
      path: "/api/mobile/v1/session",
      expectedStatus: 401,
      assertBody: (_, text) => /token|autorizad|unauthorized/i.test(String(text)),
    },
    {
      name: "mobile-sorteo-sin-token",
      path: "/api/mobile/v1/eventos/1/sorteo",
      expectedStatus: 401,
      assertBody: (_, text) => /token|autorizad|unauthorized/i.test(String(text)),
    },
    {
      name: "mobile-finanzas-sin-token",
      path: "/api/mobile/v1/finanzas/movimientos",
      method: "POST",
      body: {},
      expectedStatus: 401,
      assertBody: (_, text) => /token|autorizad|unauthorized/i.test(String(text)),
    },
  ];

  if (token) {
    checks.push(
      {
        name: "mobile-session-con-token",
        path: "/api/mobile/v1/session",
        auth: true,
        expectedStatus: 200,
        assertBody: (json) => Boolean(json && json.user && json.user.id),
      },
      {
        name: "mobile-campeonatos-con-token",
        path: "/api/mobile/v1/campeonatos",
        auth: true,
        expectedStatus: 200,
        assertBody: (json) => Boolean(json && json.ok === true),
      }
    );
  }

  console.log(`[smoke] baseUrl=${baseUrl}`);
  console.log(`[smoke] token=${token ? "provided" : "not provided"}`);
  console.log(`[smoke] timeoutMs=${timeoutMs}`);

  const results = [];
  for (const check of checks) {
    try {
      const result = await runCheck(check);
      results.push(result);
      console.log(
        `${result.ok ? "PASS" : "FAIL"} | ${result.name} | ${result.method} ${result.url} | status=${result.status} | ${result.preview}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        name: check.name,
        method: check.method || "GET",
        url: joinUrl(check.path),
        status: null,
        ok: false,
        preview: truncate(message),
      });
      console.log(`FAIL | ${check.name} | ${check.method || "GET"} ${joinUrl(check.path)} | ${truncate(message)}`);
    }
  }

  const total = results.length;
  const passed = results.filter((item) => item.ok).length;
  const failed = total - passed;

  console.log(`[smoke] total=${total} passed=${passed} failed=${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
