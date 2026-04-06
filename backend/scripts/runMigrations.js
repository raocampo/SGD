/**
 * Runner de migraciones SQL automático.
 *
 * - Crea la tabla `schema_migrations` si no existe.
 * - Si la tabla se crea por primera vez en una BD que ya tiene datos
 *   (bootstrap), marca todas las migraciones existentes como aplicadas
 *   sin volver a ejecutarlas, para no romper datos actuales.
 * - En ejecuciones posteriores, aplica solo migraciones nuevas en orden.
 * - Cada migración se ejecuta dentro de una transacción; si falla se
 *   detiene el proceso para evitar estados inconsistentes.
 *
 * Se invoca como `prestart` en package.json, por lo que corre en cada
 * deploy de Render antes de arrancar el servidor.
 */

"use strict";

const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

// Cargar variables de entorno desde backend/.env
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({
  path: path.resolve(process.cwd(), ".env"),
  override: false,
});

const MIGRATIONS_DIR = path.resolve(
  __dirname,
  "../../database/migrations"
);

// Pool de conexión (igual lógica que config/database.js)
const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const useSsl =
  /sslmode=require|ssl=true/i.test(databaseUrl) ||
  ["1", "true", "require"].includes(
    String(process.env.DATABASE_SSL || "").toLowerCase()
  );

const pool = new Pool(
  databaseUrl
    ? {
        connectionString: databaseUrl,
        ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
      }
    : {
        user: process.env.DB_USER || "postgres",
        host: process.env.DB_HOST || "localhost",
        database: process.env.DB_NAME || "gestionDeportiva",
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || "5432", 10),
      }
);

// Detecta si la BD ya tiene datos (tabla `usuarios` existe)
async function dbIsExisting(client) {
  const { rows } = await client.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'usuarios'
    LIMIT 1
  `);
  return rows.length > 0;
}

async function run() {
  const client = await pool.connect();
  try {
    // Verificar si schema_migrations ya existía antes
    const { rows: preCheck } = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'schema_migrations'
      LIMIT 1
    `);
    const tableExisted = preCheck.length > 0;

    // Crear tabla de tracking si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename  TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Leer archivos .sql ordenados
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    // Bootstrap: si la tabla no existía y la BD ya tiene datos,
    // marcar todas las migraciones como aplicadas sin ejecutarlas.
    if (!tableExisted && (await dbIsExisting(client))) {
      console.log(
        "⚡ Bootstrap: BD existente detectada. Registrando migraciones actuales sin re-ejecutarlas..."
      );
      for (const file of files) {
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING",
          [file]
        );
      }
      console.log(
        `✔  ${files.length} migración(es) registradas. Migraciones futuras se aplicarán automáticamente.`
      );
      return;
    }

    // Obtener migraciones ya aplicadas
    const { rows } = await client.query(
      "SELECT filename FROM schema_migrations"
    );
    const applied = new Set(rows.map((r) => r.filename));

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`▶  Aplicando migración: ${file}`);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        console.log(`✅ ${file} aplicada.`);
        count++;
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`❌ Error en migración ${file}: ${err.message}`);
        process.exit(1);
      }
    }

    if (count === 0) {
      console.log("✔  Base de datos al día. Sin migraciones pendientes.");
    } else {
      console.log(`✔  ${count} migración(es) aplicada(s).`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Error fatal en runMigrations:", err.message);
  process.exit(1);
});
