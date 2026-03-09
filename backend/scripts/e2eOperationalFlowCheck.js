/* eslint-disable no-console */
require("dotenv").config();

const baseUrl = String(process.env.E2E_OPS_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
const adminEmail = String(process.env.E2E_OPS_ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.E2E_OPS_ADMIN_PASSWORD || "").trim();

const requestedTournamentId = String(process.env.E2E_OPS_CAMPEONATO_ID || "").trim();
const requestedEventId = String(process.env.E2E_OPS_EVENTO_ID || "").trim();
const requestedMatchId = String(process.env.E2E_OPS_PARTIDO_ID || "").trim();
const requestedTeamId = String(process.env.E2E_OPS_TEAM_ID || "").trim();

function compact(text, max = 220) {
  const value = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function url(path) {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function request(path, { method = "GET", token, body } = {}) {
  const response = await fetch(url(path), {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch (_) {
    json = null;
  }

  return {
    status: response.status,
    raw,
    json,
  };
}

async function expectJson(path, options, expectedStatus, label, validate) {
  const result = await request(path, options);
  if (result.status !== expectedStatus) {
    throw new Error(
      `${label}: status=${result.status} esperado=${expectedStatus} body=${compact(
        result.json ? JSON.stringify(result.json) : result.raw
      )}`
    );
  }
  if (typeof validate === "function") {
    validate(result.json);
  }
  console.log(`PASS | ${label} | ${options?.method || "GET"} ${path} | status=${result.status}`);
  return result.json;
}

function normalizeList(payload, key = null) {
  if (Array.isArray(payload)) return payload;
  if (key && Array.isArray(payload?.[key])) return payload[key];
  return [];
}

function chooseByIdOrFirst(list, requestedId, label) {
  assert(Array.isArray(list) && list.length > 0, `${label}: lista vacia`);
  if (requestedId) {
    const found = list.find((item) => String(item?.id || "") === String(requestedId));
    assert(found, `${label}: no existe id=${requestedId} en el dataset actual`);
    return found;
  }
  return list[0];
}

async function main() {
  if (!adminEmail || !adminPassword) {
    throw new Error("Define E2E_OPS_ADMIN_EMAIL y E2E_OPS_ADMIN_PASSWORD antes de ejecutar.");
  }

  console.log(`[e2e-ops] baseUrl=${baseUrl}`);
  console.log("[e2e-ops] Modo: solo lectura (sin escrituras).");

  const login = await expectJson(
    "/api/auth/login",
    {
      method: "POST",
      body: {
        email: adminEmail,
        password: adminPassword,
        client_type: "mobile",
      },
    },
    200,
    "auth-login-admin",
    (json) => {
      assert(Boolean(json?.accessToken), "login sin accessToken");
    }
  );
  const token = String(login.accessToken);

  const campeonatosResp = await expectJson("/api/campeonatos", { token }, 200, "campeonatos-listar");
  const campeonatos = normalizeList(campeonatosResp, "campeonatos");
  const campeonato = chooseByIdOrFirst(campeonatos, requestedTournamentId, "campeonatos");
  const campeonatoId = String(campeonato.id);

  const eventosResp = await expectJson(
    `/api/eventos/campeonato/${campeonatoId}`,
    { token },
    200,
    "eventos-por-campeonato"
  );
  const eventos = normalizeList(eventosResp, "eventos");
  const evento = chooseByIdOrFirst(eventos, requestedEventId, "eventos");
  const eventoId = String(evento.id);

  await expectJson(
    `/api/eventos/${eventoId}`,
    { token },
    200,
    "evento-detalle",
    (json) => {
      assert(String(json?.evento?.id || "") === eventoId, "detalle de evento no coincide");
    }
  );

  const equiposResp = await expectJson(
    `/api/eventos/${eventoId}/equipos`,
    { token },
    200,
    "equipos-por-evento"
  );
  const equipos = normalizeList(equiposResp, "equipos");
  const equipo = chooseByIdOrFirst(equipos, requestedTeamId, "equipos-evento");
  const equipoId = String(equipo.id);

  await expectJson(`/api/grupos/evento/${eventoId}`, { token }, 200, "grupos-por-evento", (json) => {
    const grupos = normalizeList(json, "grupos");
    assert(grupos.length > 0, "evento sin grupos; revisa sorteo");
  });

  const partidosResp = await expectJson(
    `/api/partidos/evento/${eventoId}`,
    { token },
    200,
    "partidos-por-evento"
  );
  const partidos = normalizeList(partidosResp, "partidos");
  assert(partidos.length > 0, "evento sin partidos; revisa fixture");
  const partido = chooseByIdOrFirst(partidos, requestedMatchId, "partidos-evento");
  const partidoId = String(partido.id);

  await expectJson(
    `/api/partidos/${partidoId}/planilla`,
    { token },
    200,
    "planilla-partido",
    (json) => {
      assert(String(json?.partido?.id || json?.id || "") === partidoId, "planilla no corresponde al partido");
    }
  );

  await expectJson(`/api/tablas/evento/${eventoId}/posiciones`, { token }, 200, "tablas-posiciones");
  await expectJson(`/api/tablas/evento/${eventoId}/goleadores`, { token }, 200, "tablas-goleadores");
  await expectJson(`/api/tablas/evento/${eventoId}/tarjetas`, { token }, 200, "tablas-tarjetas");
  await expectJson(`/api/tablas/evento/${eventoId}/fair-play`, { token }, 200, "tablas-fairplay");

  await expectJson(
    `/api/finanzas/movimientos?campeonato_id=${campeonatoId}&evento_id=${eventoId}`,
    { token },
    200,
    "finanzas-movimientos"
  );
  await expectJson(
    `/api/finanzas/equipo/${equipoId}/estado-cuenta?campeonato_id=${campeonatoId}&evento_id=${eventoId}`,
    { token },
    200,
    "finanzas-estado-cuenta-equipo"
  );
  await expectJson(
    `/api/finanzas/morosidad?campeonato_id=${campeonatoId}&evento_id=${eventoId}`,
    { token },
    200,
    "finanzas-morosidad"
  );

  await expectJson(`/api/public/campeonatos/${campeonatoId}`, {}, 200, "public-campeonato");
  await expectJson(`/api/public/campeonatos/${campeonatoId}/eventos`, {}, 200, "public-eventos-campeonato");
  await expectJson(`/api/public/eventos/${eventoId}/partidos`, {}, 200, "public-partidos-evento");
  await expectJson(`/api/public/eventos/${eventoId}/tablas`, {}, 200, "public-tablas-evento");

  console.log(
    `[e2e-ops] OK dataset campeonato=${campeonatoId} evento=${eventoId} partido=${partidoId} equipo=${equipoId}`
  );
}

main().catch((error) => {
  console.error(`[e2e-ops] FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

