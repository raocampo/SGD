"use strict";

// Propiedad de transmisiones: un organizador solo puede ver y operar las
// transmisiones (y su overlay) de los partidos de sus propios campeonatos.
// El administrador y los demás roles permitidos por la ruta no se restringen
// aquí (mismo criterio que organizadorPuedeAccederCampeonato).

const pool = require("../config/database");
const PartidoTransmision = require("../models/PartidoTransmision");
const { organizadorPuedeAccederCampeonato } = require("./organizadorScope");

async function campeonatoDePartido(partidoId) {
  const r = await pool.query(`SELECT campeonato_id FROM partidos WHERE id = $1`, [partidoId]);
  if (!r.rows.length) return { existe: false, campeonatoId: null };
  return { existe: true, campeonatoId: Number.parseInt(r.rows[0].campeonato_id, 10) || null };
}

async function campeonatoDeTransmision(transmisionId) {
  await PartidoTransmision.asegurarTabla();
  const r = await pool.query(
    `
      SELECT COALESCE(p.campeonato_id, t.campeonato_id) AS campeonato_id
      FROM partido_transmisiones t
      LEFT JOIN partidos p ON p.id = t.partido_id
      WHERE t.id = $1
    `,
    [transmisionId]
  );
  if (!r.rows.length) return { existe: false, campeonatoId: null };
  return { existe: true, campeonatoId: Number.parseInt(r.rows[0].campeonato_id, 10) || null };
}

// Para el socket (sin req/res): ¿este usuario puede operar la transmisión?
async function usuarioPuedeOperarTransmision(user, transmisionId) {
  const rol = String(user?.rol || "").toLowerCase();
  if (rol !== "administrador" && rol !== "organizador") return false;
  const { existe, campeonatoId } = await campeonatoDeTransmision(transmisionId);
  if (!existe) return false;
  return organizadorPuedeAccederCampeonato(user, campeonatoId);
}

async function responderSegunAcceso(req, res, { existe, campeonatoId }, noEncontrado) {
  if (!existe) {
    res.status(404).json({ error: noEncontrado });
    return false;
  }
  if (!(await organizadorPuedeAccederCampeonato(req.user, campeonatoId))) {
    res.status(403).json({ error: "No autorizado para esta transmisión." });
    return false;
  }
  return true;
}

// Devuelve true si puede continuar; si no, ya respondió 404/403.
async function verificarAccesoTransmision(req, res, transmisionId) {
  return responderSegunAcceso(
    req,
    res,
    await campeonatoDeTransmision(transmisionId),
    "Transmisión no encontrada."
  );
}

async function verificarAccesoPartido(req, res, partidoId) {
  return responderSegunAcceso(req, res, await campeonatoDePartido(partidoId), "Partido no encontrado.");
}

async function verificarAccesoCampeonato(req, res, campeonatoId) {
  if (!(await organizadorPuedeAccederCampeonato(req.user, campeonatoId))) {
    res.status(403).json({ error: "No autorizado para este campeonato." });
    return false;
  }
  return true;
}

module.exports = {
  campeonatoDePartido,
  usuarioPuedeOperarTransmision,
  verificarAccesoTransmision,
  verificarAccesoPartido,
  verificarAccesoCampeonato,
};
