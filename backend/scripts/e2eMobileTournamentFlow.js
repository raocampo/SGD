/* eslint-disable no-console */
require("dotenv").config();

const baseUrl = String(process.env.E2E_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
const adminEmail = String(process.env.E2E_ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.E2E_ADMIN_PASSWORD || "").trim();

function nowStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

function dateOnlyOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function compact(text, max = 200) {
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

async function api(path, options = {}) {
  const { method = "GET", token, body } = options;
  const res = await fetch(url(path), {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await res.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch (_) {
    json = null;
  }

  return {
    status: res.status,
    raw,
    json,
  };
}

async function expect(path, options, expectedStatuses, label) {
  const result = await api(path, options);
  const allowed = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
  if (!allowed.includes(result.status)) {
    throw new Error(
      `${label} fallo: status=${result.status}, esperado=${allowed.join("/")}, body=${compact(
        result.json ? JSON.stringify(result.json) : result.raw
      )}`
    );
  }
  console.log(
    `PASS | ${label} | ${options?.method || "GET"} ${path} | status=${result.status}`
  );
  return result.json;
}

function pickFirst(arr = []) {
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

async function main() {
  if (!adminEmail || !adminPassword) {
    throw new Error("Define E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD para ejecutar la prueba E2E.");
  }

  const stamp = nowStamp();
  const tournamentName = `QA E2E Mobile ${stamp}`;
  const eventName = `Categoria QA ${stamp}`;
  const startDate = dateOnlyOffset(1);
  const endDate = dateOnlyOffset(30);
  const eventStart = dateOnlyOffset(2);
  const eventEnd = dateOnlyOffset(22);

  console.log(`[e2e] baseUrl=${baseUrl}`);
  console.log(`[e2e] admin=${adminEmail}`);

  const login = await expect(
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
    "login-admin"
  );

  const token = String(login?.accessToken || "");
  assert(token, "No se obtuvo accessToken en login");

  const createdTournament = await expect(
    "/api/mobile/v1/campeonatos",
    {
      method: "POST",
      token,
      body: {
        name: tournamentName,
        organizer: "QA Automatizado",
        startDate,
        endDate,
        footballType: "futbol_7",
        scoringSystem: "tradicional",
        requireNationalId: false,
        requireNationalIdPhoto: false,
        requirePlayerCardPhoto: false,
        generatePlayerCards: false,
        refereeFeePerTeam: 15,
        yellowCardFee: 1,
        redCardFee: 2,
        playerCardFee: 0,
        status: "DRAFT",
      },
    },
    201,
    "create-tournament"
  );

  const tournamentId = String(createdTournament?.campeonato?.id || "");
  assert(tournamentId, "No se obtuvo tournamentId");

  const createdEvent = await expect(
    "/api/mobile/v1/eventos",
    {
      method: "POST",
      token,
      body: {
        tournamentId,
        name: eventName,
        startDate: eventStart,
        endDate: eventEnd,
        format: "GRUPOS",
        modality: "weekend",
        registrationFee: 20,
      },
    },
    201,
    "create-event"
  );

  const eventId = String(createdEvent?.evento?.id || "");
  assert(eventId, "No se obtuvo eventId");

  const createdTeams = [];
  for (let i = 1; i <= 4; i += 1) {
    const team = await expect(
      "/api/mobile/v1/equipos",
      {
        method: "POST",
        token,
        body: {
          tournamentId,
          eventId,
          name: `Equipo QA ${i} ${stamp}`,
          coachName: `DT QA ${i}`,
          phone: `09900000${i}`,
          email: `qa.e2e.team${i}.${stamp}@ltc.local`,
          seeded: i <= 2,
        },
      },
      201,
      `create-team-${i}`
    );
    createdTeams.push(team?.equipo);
  }

  assert(createdTeams.length === 4, "No se crearon los 4 equipos esperados");

  const playersByTeam = new Map();
  let nationalIdCounter = Number.parseInt(String(Date.now()).slice(-9), 10);
  if (!Number.isFinite(nationalIdCounter) || nationalIdCounter < 100000000) {
    nationalIdCounter = 100000000;
  }
  for (const team of createdTeams) {
    const teamId = String(team?.id || "");
    assert(teamId, "Team sin id");
    const teamPlayers = [];
    for (let j = 1; j <= 2; j += 1) {
      nationalIdCounter += 1;
      const createdPlayer = await expect(
        "/api/mobile/v1/jugadores",
        {
          method: "POST",
          token,
          body: {
            teamId,
            tournamentId,
            eventId,
            firstName: `Jugador${j}`,
            lastName: `QA${teamId}`,
            nationalId: String(nationalIdCounter),
            shirtNumber: j,
            position: j === 1 ? "delantero" : "defensa",
          },
        },
        201,
        `create-player-${teamId}-${j}`
      );
      teamPlayers.push(createdPlayer?.jugador);
    }
    playersByTeam.set(teamId, teamPlayers);
  }

  await expect(
    `/api/mobile/v1/eventos/${eventId}/sorteo/automatico`,
    {
      method: "POST",
      token,
      body: {
        groupsCount: 2,
        overwrite: true,
        useSeededTeams: true,
      },
    },
    200,
    "draw-auto-groups"
  );

  const drawState = await expect(
    `/api/mobile/v1/eventos/${eventId}/sorteo`,
    { token },
    200,
    "draw-state-after-auto"
  );
  assert(Number(drawState?.stats?.assignedTeams || 0) === 4, "El sorteo no asigno todos los equipos");
  assert(Number(drawState?.groups?.length || 0) === 2, "No se generaron 2 grupos");

  const fixture = await expect(
    `/api/mobile/v1/eventos/${eventId}/fixture`,
    {
      method: "POST",
      token,
      body: {
        overwrite: true,
        homeAndAway: false,
        startDate: eventStart,
        endDate: eventEnd,
        durationMinutes: 50,
        breakMinutes: 10,
      },
    },
    200,
    "generate-fixture"
  );
  assert(Number(fixture?.total || 0) > 0, "No se genero fixture");

  const matchesData = await expect(
    `/api/mobile/v1/eventos/${eventId}/partidos`,
    { token },
    200,
    "list-matches"
  );
  const firstMatch = pickFirst(matchesData?.matches || []);
  assert(firstMatch?.id, "No hay partidos para planilla");

  const planilla = await expect(
    `/api/mobile/v1/partidos/${firstMatch.id}/planilla`,
    { token },
    200,
    "get-planilla"
  );

  const homePlayer = pickFirst(planilla?.homeSquad || []);
  const awayPlayer = pickFirst(planilla?.awaySquad || []);
  assert(homePlayer?.id && awayPlayer?.id, "No hay jugadores para registrar goles/tarjetas");

  await expect(
    `/api/mobile/v1/partidos/${firstMatch.id}/planilla`,
    {
      method: "PUT",
      token,
      body: {
        homeScore: 2,
        awayScore: 1,
        homeTeamFouls: 3,
        awayTeamFouls: 2,
        goals: [
          { playerId: homePlayer.id, goals: 2, goalType: "campo", minute: 15 },
          { playerId: awayPlayer.id, goals: 1, goalType: "campo", minute: 32 },
        ],
        cards: [
          { playerId: homePlayer.id, teamId: planilla.match.homeTeam.id, cardType: "AMARILLA", minute: 40 },
          { playerId: awayPlayer.id, teamId: planilla.match.awayTeam.id, cardType: "ROJA", minute: 55 },
        ],
        homeRegistrationPayment: 10,
        awayRegistrationPayment: 10,
        homeRefereePayment: 15,
        awayRefereePayment: 15,
        homeYellowPayment: 1,
        awayYellowPayment: 0,
        homeRedPayment: 0,
        awayRedPayment: 2,
        observations: "QA E2E planilla automatizada",
      },
    },
    200,
    "save-planilla"
  );

  const competition = await expect(
    `/api/mobile/v1/eventos/${eventId}/competencia`,
    { token },
    200,
    "competition-after-planilla"
  );
  const allMatches = (competition?.fixture || []).flatMap((round) => round.matches || []);
  const playedCount = allMatches.filter((m) => m?.status === "JUGADO").length;
  assert(playedCount >= 1, "No hay partidos jugados tras guardar planilla");

  await expect(
    `/api/mobile/v1/eventos/${eventId}/fair-play`,
    { token },
    200,
    "fair-play"
  );

  const firstTeam = pickFirst(createdTeams);
  assert(firstTeam?.id, "No hay primer equipo para prueba financiera");

  await expect(
    "/api/mobile/v1/finanzas/movimientos",
    {
      method: "POST",
      token,
      body: {
        tournamentId,
        eventId,
        teamId: firstTeam.id,
        type: "abono",
        concept: "pago",
        amount: 25,
        description: "QA E2E abono manual",
        paymentMethod: "efectivo",
      },
    },
    201,
    "finance-create-movement"
  );

  await expect(
    `/api/mobile/v1/equipos/${firstTeam.id}/estado-cuenta?campeonato_id=${tournamentId}&evento_id=${eventId}`,
    { token },
    200,
    "finance-team-account"
  );

  await expect(
    `/api/mobile/v1/campeonatos/${tournamentId}/finanzas?eventId=${eventId}`,
    { token },
    200,
    "finance-tournament-summary"
  );

  console.log("[e2e] Flujo E2E mobile completado correctamente.");
  console.log(
    `[e2e] data: tournamentId=${tournamentId}, eventId=${eventId}, firstMatchId=${firstMatch.id}, firstTeamId=${firstTeam.id}`
  );
}

main().catch((error) => {
  console.error(`[e2e] FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
