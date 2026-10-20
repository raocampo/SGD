const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const foulService = require("../services/mobilePlanillaFouls");

const stored = { local_1er: 3, local_2do: 2, visitante_1er: 1, visitante_2do: 6, local_total: 5, visitante_total: 7 };
const periods = { homeFirstHalfFouls: 3, homeSecondHalfFouls: 2, awayFirstHalfFouls: 1, awaySecondHalfFouls: 6 };

function harness({ denyAccess = false } = {}) {
  let writes = 0;
  let reads = 0;
  let saved;
  const data = {
    partido: { id: 7, campeonato_id: 1, equipo_local_id: 10, equipo_visitante_id: 20, estado: "en_curso" },
    faltas: { ...stored }, plantel_local: [], plantel_visitante: [], tarjetas: [], goleadores: [],
  };
  const Partido = {
    obtenerPorId: async () => data.partido,
    obtenerPlanilla: async () => { reads++; return data; },
    guardarPlanilla: async (id, payload) => { writes++; saved = payload; data.faltas = { ...payload.faltas }; return {}; },
  };
  const dependencies = {
    "../models/Partido": Partido,
    "./mobilePlanillaFouls": foulService,
    "./mobileAccessService": {
      assertCampeonatoAccess: async () => { if (denyAccess) throw new Error("No autorizado"); },
      toId: (value) => String(value ?? ""),
      toInteger: (value, fallback) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback,
      toNumber: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    },
  };
  const exported = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../services/mobileOperationsService.js"), "utf8"), {
    module: exported, exports: exported.exports,
    require: (name) => dependencies[name] || {},
  }, { filename: "mobileOperationsService.js" });
  return { api: exported.exports, data, saved: () => saved, writes: () => writes, reads: () => reads };
}
const user = { id: 1, rol: "organizador" };

test("GET exposes the web's four periods and their derived totals", async () => {
  const service = harness();
  const planilla = await service.api.obtenerPlanillaPartido(user, 7);
  assert.deepEqual({ ...planilla.fouls }, { ...periods, homeTeamFouls: 5, awayTeamFouls: 7 });
});

test("PUT carries each half to the real model payload and returns it on reload", async () => {
  const service = harness();
  const input = { homeFirstHalfFouls: 4, homeSecondHalfFouls: 1, awayFirstHalfFouls: 2, awaySecondHalfFouls: 3 };
  const result = await service.api.guardarPlanillaPartido(user, 7, { homeScore: 3, awayScore: 1, fouls: input });
  assert.deepEqual({ ...service.saved().faltas }, { local_1er: 4, local_2do: 1, visitante_1er: 2, visitante_2do: 3, local_total: 5, visitante_total: 5 });
  assert.equal(service.saved().resultado_local, 3);
  assert.equal(service.saved().faltas_local_total, 5);
  assert.deepEqual({ ...result.fouls }, { ...input, homeTeamFouls: 5, awayTeamFouls: 5 });
  const reopened = await service.api.obtenerPlanillaPartido(user, 7);
  assert.deepEqual({ ...reopened.fouls }, { ...result.fouls });
});

test("old APKs sending totals only cannot erase existing web period counts", async () => {
  const service = harness();
  await service.api.guardarPlanillaPartido(user, 7, { homeScore: 2, homeTeamFouls: 99, awayTeamFouls: 0 });
  assert.deepEqual({ ...service.saved().faltas }, stored);
  assert.equal(service.reads(), 2);
});

test("partial period updates preserve omitted periods and accept explicit zero", async () => {
  const service = harness();
  await service.api.guardarPlanillaPartido(user, 7, { fouls: { homeFirstHalfFouls: 0 } });
  assert.deepEqual({ ...service.saved().faltas }, { ...stored, local_1er: 0, local_total: 2 });
});

test("complete zeros clear all periods, independent of forged totals, without a preservation read", async () => {
  const service = harness();
  const zeros = Object.fromEntries(Object.keys(periods).map((key) => [key, 0]));
  const result = await service.api.guardarPlanillaPartido(user, 7, { fouls: { ...zeros, homeTeamFouls: 100 } });
  assert.equal(service.reads(), 1);
  assert.equal(result.fouls.homeTeamFouls, 0);
  assert.equal(result.fouls.awayTeamFouls, 0);
});

test("invalid counts are bounded to the same six-number range as the web", () => {
  const result = foulService.buildPlanillaFouls({ fouls: { homeFirstHalfFouls: -1, homeSecondHalfFouls: 10, awayFirstHalfFouls: "bad", awaySecondHalfFouls: "3" } });
  assert.deepEqual(result, { local_1er: 0, local_2do: 6, visitante_1er: 0, visitante_2do: 3, local_total: 6, visitante_total: 3 });
});

test("read-only roles cannot write a planilla", async () => {
  const service = harness();
  await assert.rejects(service.api.guardarPlanillaPartido({ id: 2, rol: "tecnico" }, 7, { fouls: periods }), /No autorizado/);
  assert.equal(service.writes(), 0);
});

test("tournament access remains enforced before reading or writing", async () => {
  const service = harness({ denyAccess: true });
  await assert.rejects(service.api.obtenerPlanillaPartido(user, 7), /No autorizado/);
  await assert.rejects(service.api.guardarPlanillaPartido(user, 7, { fouls: periods }), /No autorizado/);
  assert.equal(service.writes(), 0);
  assert.equal(service.reads(), 0);
});
