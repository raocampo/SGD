/* eslint-disable no-console */
require("dotenv").config();

const baseUrl = String(process.env.QA_UI_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
const adminEmail = String(process.env.QA_UI_ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.QA_UI_ADMIN_PASSWORD || "").trim();

const requestedTournamentId = String(process.env.QA_UI_CAMPEONATO_ID || "").trim();
const requestedEventId = String(process.env.QA_UI_EVENTO_ID || "").trim();
const requestedMatchId = String(process.env.QA_UI_PARTIDO_ID || "").trim();
const requestedTeamId = String(process.env.QA_UI_TEAM_ID || "").trim();

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
      Accept: "*/*",
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

async function expectHtml(path, label, marker) {
  const result = await request(path);
  if (result.status !== 200) {
    throw new Error(`${label}: status=${result.status} esperado=200 body=${compact(result.raw)}`);
  }
  if (!String(result.raw || "").includes(marker)) {
    throw new Error(`${label}: no contiene marcador esperado "${marker}"`);
  }
  console.log(`PASS | ${label} | GET ${path} | status=200 marker="${marker}"`);
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

async function findPublicCampeonato(token) {
  const campeonatos = await expectJson("/api/campeonatos", { token }, 200, "admin-campeonatos-listar");
  const list = normalizeList(campeonatos, "campeonatos");
  const candidatos = requestedTournamentId
    ? list.filter((item) => String(item?.id || "") === requestedTournamentId)
    : list;

  assert(candidatos.length > 0, "campeonatos: no hay candidatos para QA UI");

  for (const campeonato of candidatos) {
    const campeonatoId = String(campeonato?.id || "");
    const publico = await request(`/api/public/campeonatos/${campeonatoId}`);
    if (publico.status === 200) return campeonato;
  }

  throw new Error(
    requestedTournamentId
      ? `campeonato ${requestedTournamentId} no es visible en portal publico`
      : "no se encontro un campeonato visible en portal publico para QA UI"
  );
}

async function findOperationalDataset(token, tournamentId) {
  const eventosResp = await expectJson(
    `/api/mobile/v1/campeonatos/${tournamentId}/eventos`,
    { token },
    200,
    "mobile-campeonato-eventos"
  );
  const eventos = normalizeList(eventosResp, "eventos");
  const candidatosEvento = requestedEventId
    ? eventos.filter((item) => String(item?.id || "") === requestedEventId)
    : eventos;

  assert(candidatosEvento.length > 0, "eventos: no hay candidatos para QA UI");

  for (const evento of candidatosEvento) {
    const eventId = String(evento?.id || "");
    const publicDetail = await request(`/api/public/campeonatos/${tournamentId}/eventos`);
    const publicPartidos = await request(`/api/public/eventos/${eventId}/partidos`);
    const publicTablas = await request(`/api/public/eventos/${eventId}/tablas`);
    if (publicDetail.status !== 200 || publicPartidos.status !== 200 || publicTablas.status !== 200) continue;

    const partidosResp = await expectJson(
      `/api/mobile/v1/eventos/${eventId}/partidos`,
      { token },
      200,
      "mobile-evento-partidos"
    );
    const partidos = normalizeList(partidosResp, "matches");

    const equiposResp = await expectJson(
      `/api/eventos/${eventId}/equipos`,
      { token },
      200,
      "equipos-por-evento"
    );
    const equipos = normalizeList(equiposResp, "equipos");

    if (partidos.length === 0 || equipos.length === 0) continue;

    const match = chooseByIdOrFirst(partidos, requestedMatchId, "partidos-evento");
    const team = chooseByIdOrFirst(equipos, requestedTeamId, "equipos-evento");
    return { evento, match, team };
  }

  throw new Error(
    requestedEventId
      ? `evento ${requestedEventId} no tiene dataset operativo/publico valido`
      : `campeonato ${tournamentId} no tiene un evento operativo visible en portal publico`
  );
}

async function main() {
  if (!adminEmail || !adminPassword) {
    throw new Error("Define QA_UI_ADMIN_EMAIL y QA_UI_ADMIN_PASSWORD antes de ejecutar.");
  }

  console.log(`[qa-ui] baseUrl=${baseUrl}`);

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

  const campeonato = await findPublicCampeonato(token);
  const tournamentId = String(campeonato?.id || "");
  const { evento, match, team } = await findOperationalDataset(token, tournamentId);
  const eventId = String(evento?.id || "");
  const matchId = String(match?.id || "");
  const teamId = String(team?.id || "");

  console.log(
    `[qa-ui] dataset campeonato=${tournamentId} evento=${eventId} partido=${matchId} equipo=${teamId}`
  );

  await expectJson(
    `/api/mobile/v1/campeonatos/${tournamentId}`,
    { token },
    200,
    "mobile-campeonato-detail",
    (json) => {
      assert(String(json?.campeonato?.id || "") === tournamentId, "campeonato distinto al esperado");
    }
  );

  await expectJson(`/api/mobile/v1/campeonatos/${tournamentId}/eventos`, { token }, 200, "mobile-campeonato-eventos");

  await expectJson(
    `/api/mobile/v1/eventos/${eventId}`,
    { token },
    200,
    "mobile-evento-detail",
    (json) => {
      assert(String(json?.evento?.id || "") === eventId, "detalle de evento no coincide");
    }
  );

  await expectJson(
    `/api/mobile/v1/eventos/${eventId}/sorteo`,
    { token },
    200,
    "mobile-sorteo-state",
    (json) => {
      const groups = Array.isArray(json?.groups) ? json.groups : [];
      assert(groups.length > 0, "sorteo sin grupos");
    }
  );

  await expectJson(`/api/mobile/v1/eventos/${eventId}/partidos`, { token }, 200, "mobile-evento-partidos");

  await expectJson(
    `/api/mobile/v1/partidos/${matchId}/planilla`,
    { token },
    200,
    "mobile-planilla-detail",
    (json) => {
      assert(String(json?.match?.id || "") === matchId, "planilla no corresponde al partido");
    }
  );

  await expectJson(
    `/api/mobile/v1/eventos/${eventId}/competencia`,
    { token },
    200,
    "mobile-competencia-evento",
    (json) => {
      const fixture = Array.isArray(json?.fixture) ? json.fixture : [];
      assert(fixture.length > 0, "competencia sin fixture");
    }
  );

  await expectJson(
    `/api/mobile/v1/eventos/${eventId}/fair-play`,
    { token },
    200,
    "mobile-fairplay-evento",
    (json) => {
      const rows = Array.isArray(json?.rows)
        ? json.rows
        : Array.isArray(json?.fair_play)
          ? json.fair_play
          : [];
      assert(rows.length > 0, "fair play sin filas");
    }
  );

  await expectJson(
    `/api/mobile/v1/equipos/${teamId}/estado-cuenta?campeonato_id=${tournamentId}&evento_id=${eventId}`,
    { token },
    200,
    "mobile-finanzas-equipo",
    (json) => {
      assert(String(json?.team?.id || "") === teamId, "estado de cuenta de equipo no coincide");
    }
  );

  await expectJson(
    `/api/mobile/v1/campeonatos/${tournamentId}/finanzas?eventId=${eventId}`,
    { token },
    200,
    "mobile-finanzas-campeonato"
  );

  await expectJson(
    `/api/public/campeonatos/${tournamentId}`,
    {},
    200,
    "public-campeonato-detail"
  );

  await expectJson(
    `/api/public/campeonatos/${tournamentId}/eventos`,
    {},
    200,
    "public-campeonato-eventos",
    (json) => {
      const eventos = Array.isArray(json?.eventos) ? json.eventos : [];
      assert(eventos.some((item) => String(item?.id || "") === eventId), "evento no visible en portal publico");
    }
  );

  await expectJson(
    `/api/public/eventos/${eventId}/partidos`,
    {},
    200,
    "public-evento-partidos"
  );
  await expectJson(`/api/public/eventos/${eventId}/tablas`, {}, 200, "public-evento-tablas");
  await expectJson(`/api/public/eventos/${eventId}/goleadores`, {}, 200, "public-evento-goleadores");
  await expectJson(`/api/public/eventos/${eventId}/tarjetas`, {}, 200, "public-evento-tarjetas");
  await expectJson(`/api/public/eventos/${eventId}/fair-play`, {}, 200, "public-evento-fairplay");

  await expectHtml("/campeonatos.html", "web-campeonatos-page", "Gestión de Campeonatos");
  await expectHtml("/sorteo.html", "web-sorteo-page", "Sorteo de Grupos");
  await expectHtml("/partidos.html", "web-partidos-page", "Gestión de Partidos");
  await expectHtml("/planilla.html", "web-planilla-page", "Planilla de Juego");
  await expectHtml("/finanzas.html", "web-finanzas-page", "Modulo Financiero");
  await expectHtml("/portal-admin.html", "web-portal-admin-page", "Portal Deportivo");

  console.log("[qa-ui] Verificacion de dataset y pantallas web completada.");
}

main().catch((error) => {
  console.error(`[qa-ui] FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
