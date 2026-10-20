function getPlanillaRules(value = "") {
  const raw = String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  let format = "unknown";
  if (raw.includes("indor")) format = "indor";
  else if (!/basquet|basket|balonc/.test(raw)) {
    const number = raw.match(/(?:^|[^0-9])(11|9|8|7|6|5)(?:[^0-9]|$)/)?.[1];
    if (number) format = `futbol_${number}`;
    else if (/futsal|sala/.test(raw)) format = "futbol_sala";
  }
  return {
    format,
    accumulatedFouls: ["futbol_7", "futbol_6", "futbol_5", "futbol_sala"].includes(format),
    refereeLayout: format === "futbol_11" ? "eleven"
      : ["futbol_5", "futbol_sala"].includes(format) ? "futsal"
        : ["futbol_9", "futbol_8", "futbol_7", "futbol_6", "indor"].includes(format) ? "optional_second" : "single",
  };
}

function mapMatchDetails(partido = {}) {
  return {
    referee: String(partido.arbitro || ""),
    assistantReferee1: String(partido.arbitro_linea_1 || ""),
    assistantReferee2: String(partido.arbitro_linea_2 || ""),
    reserveReferee: String(partido.arbitro_suplente || ""),
    delegate: String(partido.delegado_partido || ""),
    city: String(partido.ciudad || ""),
    matchNumber: partido.numero_campeonato == null ? null : Number(partido.numero_campeonato),
  };
}

function buildMatchDetails(body = {}, rules = getPlanillaRules()) {
  const input = body.matchDetails;
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const fields = { referee: "arbitro", delegate: "delegado_partido", city: "ciudad" };
  if (rules.refereeLayout !== "single") fields.assistantReferee1 = "arbitro_linea_1";
  if (rules.refereeLayout === "eleven") fields.assistantReferee2 = "arbitro_linea_2";
  if (["eleven", "futsal"].includes(rules.refereeLayout)) fields.reserveReferee = "arbitro_suplente";
  const result = {};
  for (const [key, column] of Object.entries(fields)) {
    // Omitted fields remain omitted so the model preserves data from web/older APKs.
    if (Object.prototype.hasOwnProperty.call(input, key)) result[column] = String(input[key] ?? "").trim();
  }
  if (input.matchNumber != null && String(input.matchNumber).trim() !== "") {
    const raw = String(input.matchNumber).trim();
    const number = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(number) || number < 1 || number > 2147483647) {
      const error = new Error("El número de partido debe ser un entero mayor a 0.");
      error.statusCode = 400;
      throw error;
    }
    result.numero_campeonato = number;
  }
  return result;
}

module.exports = { getPlanillaRules, mapMatchDetails, buildMatchDetails };
