const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const foulService = require("../services/mobilePlanillaFouls");
const detailService = require("../services/mobilePlanillaDetails");

const stored = { local_1er: 3, local_2do: 2, visitante_1er: 1, visitante_2do: 6, local_total: 5, visitante_total: 7 };
const periods = { homeFirstHalfFouls: 3, homeSecondHalfFouls: 2, awayFirstHalfFouls: 1, awaySecondHalfFouls: 6 };

function harness({ denyAccess = false, footballType = "futbol_7" } = {}) {
  let writes = 0;
  let reads = 0;
  let saved;
  const data = {
    partido: { id: 7, campeonato_id: 1, equipo_local_id: 10, equipo_visitante_id: 20, estado: "en_curso", tipo_futbol: footballType },
    faltas: { ...stored }, plantel_local: [], plantel_visitante: [], tarjetas: [], goleadores: [],
  };
  const Partido = {
    obtenerPorId: async () => data.partido,
    obtenerPlanilla: async () => { reads++; return data; },
    guardarPlanilla: async (id, payload) => {
      writes++; saved = payload; data.faltas = { ...payload.faltas };
      for (const key of ["arbitro", "arbitro_linea_1", "arbitro_linea_2", "arbitro_suplente", "delegado_partido", "ciudad", "numero_campeonato"]) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) data.partido[key] = payload[key];
      }
      return {};
    },
  };
  const dependencies = {
    "../config/database": { query: async () => ({ rows: [{ football_type: footballType }] }) },
    "../models/Partido": Partido,
    "./mobilePlanillaFouls": foulService,
    "./mobilePlanillaDetails": detailService,
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

for (const [type, accumulatedFouls, layout] of [
  ["futbol_11", false, "eleven"], ["futbol_9", false, "optional_second"], ["futbol_8", false, "optional_second"],
  ["indor", false, "optional_second"], ["futbol_7", true, "optional_second"], ["futbol_6", true, "optional_second"],
  ["futbol_5", true, "futsal"], ["futsala", true, "futsal"],
]) {
  test(`${type}: correct foul policy and referee layout returned by GET`, async () => {
    const service = harness({ footballType: type });
    const result = await service.api.obtenerPlanillaPartido(user, 7);
    assert.equal(result.rules.accumulatedFouls, accumulatedFouls);
    assert.equal(result.rules.refereeLayout, layout);
  });
}

test("futbol 6 estilo sala keeps the optional second referee; aliases and unknown sports are safe", () => {
  assert.deepEqual(detailService.getPlanillaRules("Fútbol 6 estilo sala"), { format: "futbol_6", accumulatedFouls: true, refereeLayout: "optional_second" });
  assert.equal(detailService.getPlanillaRules("Fútbol sala").refereeLayout, "futsal");
  assert.equal(detailService.getPlanillaRules("baloncesto 5x5").accumulatedFouls, false);
  assert.equal(detailService.getPlanillaRules("").accumulatedFouls, false);
});

test("all four officials and match header are saved and returned on reload in futbol 11", async () => {
  const service = harness({ footballType: "futbol_11" });
  const details = { referee: " Central ", assistantReferee1: "Asistente 1", assistantReferee2: "Asistente 2", reserveReferee: "Suplente", delegate: "Delegado", city: "Loja", matchNumber: "12" };
  const result = await service.api.guardarPlanillaPartido(user, 7, { matchDetails: details });
  assert.deepEqual({ ...result.matchDetails }, { ...details, referee: "Central", matchNumber: 12 });
  assert.equal(service.saved().arbitro_suplente, "Suplente");
  const reloaded = await service.api.obtenerPlanillaPartido(user, 7);
  assert.deepEqual({ ...reloaded.matchDetails }, { ...result.matchDetails });
});

test("futsal saves two on-court officials plus reserve and does not overwrite a hidden assistant", async () => {
  const service = harness({ footballType: "futsala" });
  service.data.partido.arbitro_linea_2 = "Historico";
  const result = await service.api.guardarPlanillaPartido(user, 7, { matchDetails: { referee: "Uno", assistantReferee1: "Dos", assistantReferee2: "No corresponde", reserveReferee: "Suplente" }, fouls: periods });
  assert.equal(result.matchDetails.assistantReferee1, "Dos");
  assert.equal(result.matchDetails.reserveReferee, "Suplente");
  assert.equal(result.matchDetails.assistantReferee2, "Historico");
  assert.ok(!Object.hasOwn(service.saved(), "arbitro_linea_2"));
});

test("non-accumulating formats ignore submitted fouls and preserve stored data", async () => {
  for (const footballType of ["futbol_11", "futbol_9", "futbol_8", "indor"]) {
    const service = harness({ footballType });
    await service.api.guardarPlanillaPartido(user, 7, { fouls: Object.fromEntries(Object.keys(periods).map(key => [key, 0])), rules: { accumulatedFouls: true } });
    assert.deepEqual({ ...service.saved().faltas }, stored);
  }
});

test("older and partial clients preserve officials; explicit blank clears only that official", async () => {
  const service = harness({ footballType: "futbol_11" });
  Object.assign(service.data.partido, { arbitro: "Central", arbitro_suplente: "Reserva", ciudad: "Loja" });
  await service.api.guardarPlanillaPartido(user, 7, {});
  assert.ok(!Object.hasOwn(service.saved(), "arbitro_suplente"));
  const result = await service.api.guardarPlanillaPartido(user, 7, { matchDetails: { reserveReferee: "" } });
  assert.equal(result.matchDetails.reserveReferee, "");
  assert.equal(result.matchDetails.referee, "Central");
  assert.equal(result.matchDetails.city, "Loja");
});

test("invalid match numbers fail before a write; blank retains the saved number", async () => {
  const service = harness();
  service.data.partido.numero_campeonato = 4;
  for (const value of [0, -1, "2.5", "12abc", 2147483648]) {
    await assert.rejects(service.api.guardarPlanillaPartido(user, 7, { matchDetails: { matchNumber: value } }), /entero mayor a 0/);
  }
  assert.equal(service.writes(), 0);
  const result = await service.api.guardarPlanillaPartido(user, 7, { matchDetails: { matchNumber: "" } });
  assert.equal(result.matchDetails.matchNumber, 4);
});
