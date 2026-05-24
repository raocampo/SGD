/* eslint-disable no-console */
"use strict";

require("dotenv").config();

const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const { getJwtSecret } = require("../middleware/authMiddleware");
const PartidoTransmision = require("../models/PartidoTransmision");
const TransmisionOverlay = require("../models/TransmisionOverlay");

const DEFAULT_BASE_URL = "http://localhost:5000";
const baseUrl = String(process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");

function joinUrl(path) {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(path, options = {}) {
  const response = await fetch(joinUrl(path), {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
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
  };
}

async function obtenerAdmin() {
  const result = await pool.query(
    `SELECT id, email, rol
     FROM usuarios
     WHERE activo = TRUE AND LOWER(rol) = 'administrador'
     ORDER BY id
     LIMIT 1`
  );
  return result.rows[0] || null;
}

async function obtenerPartidoLibre() {
  await PartidoTransmision.asegurarTabla();
  await TransmisionOverlay.asegurarTabla();

  const result = await pool.query(
    `SELECT p.id, p.campeonato_id, p.evento_id
     FROM partidos p
     LEFT JOIN partido_transmisiones t ON t.partido_id = p.id
     WHERE t.id IS NULL AND p.campeonato_id IS NOT NULL
     ORDER BY p.id
     LIMIT 1`
  );
  return result.rows[0] || null;
}

async function cleanup(transmisionId) {
  if (!transmisionId) return;
  await pool.query("DELETE FROM partido_transmisiones WHERE id = $1", [transmisionId]);
  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM partido_transmisiones WHERE id = $1) AS transmisiones,
       (SELECT COUNT(*)::int FROM transmision_overlay_state WHERE transmision_id = $1) AS overlays`,
    [transmisionId]
  );
  assert(result.rows[0].transmisiones === 0, "La transmision QA no fue eliminada");
  assert(result.rows[0].overlays === 0, "El overlay QA no fue eliminado por cascada");
  console.log(`PASS | cleanup-transmision | id=${transmisionId}`);
}

async function main() {
  let transmisionId = null;

  try {
    const admin = await obtenerAdmin();
    assert(admin, "No existe un administrador activo para firmar token QA");

    const partido = await obtenerPartidoLibre();
    assert(partido, "No hay partido disponible sin transmision para QA");

    const token = jwt.sign(
      { id: admin.id, rol: admin.rol },
      getJwtSecret(),
      { expiresIn: "10m" }
    );

    const create = await requestJson(`/api/partidos/${partido.id}/transmision`, {
      method: "POST",
      token,
      body: {
        campeonato_id: partido.campeonato_id,
        evento_id: partido.evento_id,
        titulo: "QA transmision temporal",
        plataforma: "webrtc",
        estado: "programada",
      },
    });
    assert(create.status === 201, `crear-transmision status=${create.status} body=${create.text}`);

    const transmision = create.json?.transmision;
    transmisionId = transmision?.id || null;
    const overlayToken = transmision?.overlay_token || "";
    assert(transmisionId && overlayToken, "Transmision creada sin id u overlay_token");
    console.log(`PASS | crear-transmision | id=${transmisionId} partido=${partido.id}`);

    const list = await requestJson(`/api/transmisiones?campeonato_id=${partido.campeonato_id}`, { token });
    assert(
      list.status === 200 && Array.isArray(list.json?.transmisiones) &&
        list.json.transmisiones.some((item) => item.id === transmisionId),
      `listar-transmisiones status=${list.status}`
    );
    console.log("PASS | listar-transmisiones");

    const start = await requestJson(`/api/transmisiones/${transmisionId}/iniciar`, {
      method: "POST",
      token,
      body: {},
    });
    assert(
      start.status === 200 && start.json?.transmision?.estado === "en_vivo",
      `iniciar-transmision status=${start.status}`
    );
    console.log("PASS | iniciar-transmision");

    const live = await requestJson(`/api/public/campeonatos/${partido.campeonato_id}/transmisiones-activas`);
    assert(
      live.status === 200 && Array.isArray(live.json?.transmisiones) &&
        live.json.transmisiones.some((item) => item.id === transmisionId),
      `public-activas status=${live.status}`
    );
    console.log("PASS | public-activas");

    const viewer = await requestJson(`/api/public/transmisiones/${transmisionId}`);
    assert(
      viewer.status === 200 && viewer.json?.transmision?.id === transmisionId,
      `viewer-publico status=${viewer.status}`
    );
    console.log("PASS | viewer-publico");

    const overlay = await requestJson(`/api/public/overlay/${overlayToken}`);
    assert(
      overlay.status === 200 && overlay.json?.transmision_id === transmisionId && overlay.json?.overlay,
      `overlay-publico status=${overlay.status}`
    );
    console.log("PASS | overlay-publico");

    const updateOverlay = await requestJson(`/api/transmisiones/${transmisionId}/overlay`, {
      method: "PUT",
      token,
      body: { goles_local: 1, minuto: 12, estado: "en_curso" },
    });
    assert(
      updateOverlay.status === 200 && updateOverlay.json?.goles_local === 1,
      `overlay-auth-update status=${updateOverlay.status}`
    );
    console.log("PASS | overlay-auth-update");

    const invalidOverlay = await requestJson("/api/public/overlay/no-es-uuid");
    assert(invalidOverlay.status === 400, `overlay-token-invalido status=${invalidOverlay.status}`);
    console.log("PASS | overlay-token-invalido");
  } finally {
    await cleanup(transmisionId);
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`FAIL | ${error.message}`);
  process.exitCode = 1;
});
