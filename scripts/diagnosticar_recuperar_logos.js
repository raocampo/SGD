#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const dotenv = require(path.resolve(__dirname, "..", "backend", "node_modules", "dotenv"));
const { Pool } = require(path.resolve(__dirname, "..", "backend", "node_modules", "pg"));

const root = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(root, "backend", ".env") });

function parseArgs(argv) {
  const args = { fix: false, sources: [], report: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--fix") args.fix = true;
    else if (a === "--source" && argv[i + 1]) args.sources.push(argv[++i]);
    else if (a === "--report" && argv[i + 1]) args.report = argv[++i];
  }
  return args;
}

function normalizeLogoPath(logoUrl) {
  if (!logoUrl) return null;
  const raw = String(logoUrl).trim().replaceAll("\\", "/");
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return null;
  const rel = raw.startsWith("/") ? raw.slice(1) : raw;
  if (!rel.startsWith("uploads/")) return null;
  return rel;
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

function indexByName(files) {
  const map = new Map();
  for (const file of files) {
    const key = path.basename(file).toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(file);
  }
  return map;
}

async function loadDbRows(pool) {
  const camp = await pool.query("SELECT id, nombre, logo_url FROM campeonatos ORDER BY id");
  const equipos = await pool.query("SELECT id, nombre, logo_url FROM equipos ORDER BY id");

  return [
    ...camp.rows.map((r) => ({ tipo: "campeonato", id: r.id, nombre: r.nombre, logo_url: r.logo_url })),
    ...equipos.rows.map((r) => ({ tipo: "equipo", id: r.id, nombre: r.nombre, logo_url: r.logo_url })),
  ];
}

function makeTimestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const defaultSources = [
    path.join(root, "backend", "uploads_backup"),
    path.join(root, "uploads_backup"),
    path.join(root, "docs", "capturaImg"),
  ];
  const sourceDirs = (args.sources.length ? args.sources : defaultSources).map((s) => path.resolve(root, s));
  const reportPath =
    args.report ||
    path.join(root, "docs", "reportes", `logos_auditoria_${makeTimestamp()}.json`);

  const backendUploads = path.join(root, "backend", "uploads");
  fs.mkdirSync(path.join(backendUploads, "campeonatos"), { recursive: true });
  fs.mkdirSync(path.join(backendUploads, "equipos"), { recursive: true });

  const sourceFiles = [];
  for (const dir of sourceDirs) {
    walkFiles(dir, sourceFiles);
  }
  const sourceIndex = indexByName(sourceFiles);

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  const report = {
    timestamp: new Date().toISOString(),
    fix_mode: args.fix,
    sources: sourceDirs,
    total_registros: 0,
    sin_logo_url: 0,
    ruta_no_valida: 0,
    presentes: 0,
    recuperados: 0,
    faltantes: 0,
    detalle: [],
  };

  try {
    const rows = await loadDbRows(pool);
    report.total_registros = rows.length;

    for (const row of rows) {
      const rel = normalizeLogoPath(row.logo_url);
      if (!row.logo_url) {
        report.sin_logo_url += 1;
        report.detalle.push({ ...row, estado: "sin_logo_url" });
        continue;
      }
      if (!rel) {
        report.ruta_no_valida += 1;
        report.detalle.push({ ...row, estado: "ruta_no_valida" });
        continue;
      }

      const target = path.join(root, "backend", rel);
      if (fs.existsSync(target)) {
        report.presentes += 1;
        report.detalle.push({ ...row, estado: "ok", archivo: target });
        continue;
      }

      const nameKey = path.basename(target).toLowerCase();
      const candidates = sourceIndex.get(nameKey) || [];
      if (args.fix && candidates.length) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(candidates[0], target);
        report.recuperados += 1;
        report.detalle.push({
          ...row,
          estado: "recuperado",
          destino: target,
          origen: candidates[0],
        });
      } else {
        report.faltantes += 1;
        report.detalle.push({
          ...row,
          estado: "faltante",
          esperado: target,
          candidatos: candidates.slice(0, 5),
        });
      }
    }
  } finally {
    await pool.end();
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`Reporte: ${reportPath}`);
  console.log(
    [
      `total=${report.total_registros}`,
      `ok=${report.presentes}`,
      `recuperados=${report.recuperados}`,
      `faltantes=${report.faltantes}`,
      `sin_logo_url=${report.sin_logo_url}`,
      `ruta_no_valida=${report.ruta_no_valida}`,
    ].join(" | ")
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

