/* eslint-disable no-console */
require("dotenv").config();

const jwt = require("jsonwebtoken");
const { Client } = require("pg");

const baseUrl = String(process.env.QA_FACT_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
const jwtSecret = process.env.JWT_SECRET || "sgd-dev-secret-change-me";
const keepDocument = String(process.env.QA_FACT_KEEP_DOCUMENT || "").trim() === "1";

function compact(value, max = 240) {
  const text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function toNumber(value, fallback = 0) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function url(path) {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function requestJson(path, { method = "GET", token, body } = {}) {
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

  return { status: response.status, json, raw };
}

async function getClient() {
  const client = new Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number.parseInt(String(process.env.DB_PORT || 5432), 10),
  });
  await client.connect();
  return client;
}

async function getAdminAndMovement(client) {
  const adminR = await client.query(`
    SELECT id, email, rol
    FROM usuarios
    WHERE activo = true AND LOWER(rol) = 'administrador'
    ORDER BY id ASC
    LIMIT 1
  `);
  const admin = adminR.rows[0] || null;
  assert(admin, "No hay usuario administrador activo para ejecutar QA facturación");

  const movementR = await client.query(`
    SELECT fm.id,
           fm.campeonato_id,
           c.nombre AS campeonato_nombre,
           fm.equipo_id,
           e.nombre AS equipo_nombre,
           fm.tipo_movimiento,
           fm.concepto,
           fm.descripcion,
           fm.monto
    FROM finanzas_movimientos fm
    JOIN campeonatos c ON c.id = fm.campeonato_id
    JOIN equipos e ON e.id = fm.equipo_id
    LEFT JOIN documentos_pagos dp ON dp.movimiento_id = fm.id
    WHERE fm.campeonato_id IS NOT NULL
      AND fm.equipo_id IS NOT NULL
      AND COALESCE(fm.monto, 0) > 0
      AND dp.documento_id IS NULL
    ORDER BY fm.id DESC
    LIMIT 1
  `);
  const movement = movementR.rows[0] || null;
  assert(movement, "No hay movimientos financieros libres para documentar en QA");

  return { admin, movement };
}

function buildToken(user) {
  return jwt.sign(
    {
      id: Number(user.id),
      email: String(user.email || ""),
      rol: String(user.rol || "").toLowerCase(),
    },
    jwtSecret,
    { expiresIn: "20m" }
  );
}

async function snapshotConfig(client, organizadorId) {
  const { rows } = await client.query(
    "SELECT * FROM facturacion_config WHERE organizador_id = $1",
    [organizadorId]
  );
  return rows[0] || null;
}

async function restoreConfig(client, organizadorId, snapshot) {
  if (!snapshot) {
    await client.query("DELETE FROM facturacion_config WHERE organizador_id = $1", [organizadorId]);
    return;
  }

  await client.query(
    `
      UPDATE facturacion_config
      SET tipo_contribuyente = $2,
          ruc_ci = $3,
          razon_social = $4,
          nombre_comercial = $5,
          direccion_matriz = $6,
          codigo_establecimiento = $7,
          punto_emision = $8,
          iva_porcentaje = $9,
          secuencial_factura = $10,
          secuencial_nota_venta = $11,
          secuencial_recibo = $12,
          updated_at = $13
      WHERE organizador_id = $1
    `,
    [
      organizadorId,
      snapshot.tipo_contribuyente,
      snapshot.ruc_ci,
      snapshot.razon_social,
      snapshot.nombre_comercial,
      snapshot.direccion_matriz,
      snapshot.codigo_establecimiento,
      snapshot.punto_emision,
      snapshot.iva_porcentaje,
      snapshot.secuencial_factura,
      snapshot.secuencial_nota_venta,
      snapshot.secuencial_recibo,
      snapshot.updated_at,
    ]
  );
}

async function cleanupQaArtifacts(client, { docId, movementId, organizadorId, configSnapshot }) {
  if (docId && !keepDocument) {
    await client.query("DELETE FROM documentos_facturacion WHERE id = $1", [docId]);
  }

  if (!keepDocument) {
    await restoreConfig(client, organizadorId, configSnapshot);
  }

  const checks = await client.query(
    `
      SELECT
        EXISTS (SELECT 1 FROM documentos_facturacion WHERE id = $1) AS doc_existe,
        EXISTS (SELECT 1 FROM documentos_pagos WHERE movimiento_id = $2) AS movimiento_documentado
    `,
    [docId || 0, movementId]
  );
  return checks.rows[0] || {};
}

async function main() {
  console.log(`[qa-facturacion] baseUrl=${baseUrl}`);
  console.log(`[qa-facturacion] cleanup=${keepDocument ? "omitido por QA_FACT_KEEP_DOCUMENT=1" : "activo"}`);

  const client = await getClient();
  let createdDocId = null;
  let context = null;

  try {
    context = await getAdminAndMovement(client);
    const organizadorId = Number(context.admin.id);
    const movement = context.movement;
    const configSnapshot = await snapshotConfig(client, organizadorId);
    const token = buildToken(context.admin);
    const amount = toNumber(movement.monto, 0);
    const itemDescription = `QA facturacion movimiento ${movement.id} - ${movement.concepto || "movimiento"}`;

    const payload = {
      organizador_id: organizadorId,
      campeonato_id: Number(movement.campeonato_id),
      equipo_id: Number(movement.equipo_id),
      tipo: "recibo",
      receptor_nombre: `QA Facturacion ${new Date().toISOString().slice(0, 10)}`,
      receptor_ruc_ci: "9999999999",
      receptor_email: "qa.facturacion@ltc.local",
      receptor_direccion: "QA local",
      observaciones: "Documento temporal generado por qa:facturacion.",
      items: [
        {
          descripcion: itemDescription,
          cantidad: 1,
          precio_unitario: amount,
          descuento: 0,
        },
      ],
      movimiento_ids: [Number(movement.id)],
    };

    const createRes = await requestJson("/api/facturacion", {
      method: "POST",
      token,
      body: payload,
    });
    assert(
      createRes.status === 201,
      `crear documento: status=${createRes.status} body=${compact(createRes.json ? JSON.stringify(createRes.json) : createRes.raw)}`
    );
    createdDocId = Number(createRes.json?.id);
    assert(createdDocId > 0, "crear documento: respuesta sin id");
    assert(Array.isArray(createRes.json?.movimientos) && createRes.json.movimientos.length === 1, "crear documento: movimiento no vinculado");
    console.log(`PASS | crear-documento | id=${createdDocId} movimiento=${movement.id}`);

    const detailRes = await requestJson(`/api/facturacion/${createdDocId}`, { token });
    assert(detailRes.status === 200, `detalle documento: status=${detailRes.status}`);
    assert(Array.isArray(detailRes.json?.items) && detailRes.json.items.length === 1, "detalle documento: items inválidos");
    assert(Array.isArray(detailRes.json?.movimientos) && detailRes.json.movimientos.length === 1, "detalle documento: movimientos inválidos");
    assert(String(detailRes.json?.numero_completo || "").trim(), "detalle documento: sin numero_completo");
    console.log(`PASS | detalle-documento | numero=${detailRes.json.numero_completo}`);

    const duplicateRes = await requestJson("/api/facturacion", {
      method: "POST",
      token,
      body: {
        ...payload,
        receptor_nombre: "QA Facturacion duplicado esperado",
      },
    });
    assert(duplicateRes.status === 400, `duplicado movimiento: status=${duplicateRes.status} esperado=400`);
    assert(/documentado/i.test(String(duplicateRes.json?.error || duplicateRes.raw || "")), "duplicado movimiento: mensaje no menciona documentado");
    console.log("PASS | bloqueo-doble-documentacion | status=400");

    const emitRes = await requestJson(`/api/facturacion/${createdDocId}/emitir`, {
      method: "POST",
      token,
    });
    assert(emitRes.status === 200, `emitir documento: status=${emitRes.status}`);
    assert(String(emitRes.json?.estado || "").toLowerCase() === "emitido", "emitir documento: estado final no es emitido");
    console.log("PASS | emitir-documento | estado=emitido");

    const listRes = await requestJson(`/api/facturacion?estado=emitido&organizador_id=${organizadorId}`, { token });
    assert(listRes.status === 200 && Array.isArray(listRes.json), `listar documentos: status=${listRes.status}`);
    assert(listRes.json.some((doc) => Number(doc.id) === createdDocId), "listar documentos: documento emitido no aparece");
    console.log("PASS | listar-documento-emitido");

    const cleanup = await cleanupQaArtifacts(client, {
      docId: createdDocId,
      movementId: Number(movement.id),
      organizadorId,
      configSnapshot,
    });
    assert(keepDocument || cleanup.doc_existe === false, "cleanup: documento QA no fue eliminado");
    assert(keepDocument || cleanup.movimiento_documentado === false, "cleanup: movimiento quedó documentado");
    console.log("PASS | cleanup-qa");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`[qa-facturacion] FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
