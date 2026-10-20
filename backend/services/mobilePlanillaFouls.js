const PERIOD_FIELDS = {
  homeFirstHalfFouls: "local_1er",
  homeSecondHalfFouls: "local_2do",
  awayFirstHalfFouls: "visitante_1er",
  awaySecondHalfFouls: "visitante_2do",
};

function count(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(6, Math.max(0, parsed)) : 0;
}

function periodValue(body, key) {
  return body[key] ?? body.fouls?.[key];
}

function hasCompleteFoulPeriods(body = {}) {
  return Object.keys(PERIOD_FIELDS).every((key) => periodValue(body, key) != null);
}

function mapPlanillaFouls(stored = {}) {
  const periods = Object.fromEntries(Object.entries(PERIOD_FIELDS).map(([key, column]) => [key, count(stored[column])]));
  return {
    ...periods,
    homeTeamFouls: periods.homeFirstHalfFouls + periods.homeSecondHalfFouls,
    awayTeamFouls: periods.awayFirstHalfFouls + periods.awaySecondHalfFouls,
  };
}

function buildPlanillaFouls(body = {}, stored = {}) {
  // Older APKs submit totals only. Preserve the existing period detail when it is omitted.
  const periods = Object.fromEntries(Object.entries(PERIOD_FIELDS).map(([key, column]) => [column, count(periodValue(body, key) ?? stored[column])]));
  return {
    ...periods,
    local_total: periods.local_1er + periods.local_2do,
    visitante_total: periods.visitante_1er + periods.visitante_2do,
  };
}

module.exports = { hasCompleteFoulPeriods, mapPlanillaFouls, buildPlanillaFouls };
