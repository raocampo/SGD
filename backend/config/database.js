const { Pool } = require("pg");
const path = require("path");
const dotenv = require("dotenv");

// 1) Carga preferente desde backend/.env
dotenv.config({ path: path.resolve(__dirname, "../.env") });
// 2) Carga opcional desde .env del cwd (sin sobreescribir lo ya cargado)
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const dbUser = String(process.env.DB_USER || "postgres").trim();
const dbHost = String(process.env.DB_HOST || "localhost").trim();
const dbName = String(process.env.DB_NAME || "gestionDeportiva").trim();
const dbPasswordRaw = process.env.DB_PASSWORD;
const dbPortRaw = Number.parseInt(process.env.DB_PORT || "5432", 10);
const dbPort = Number.isFinite(dbPortRaw) ? dbPortRaw : 5432;
const databaseSslMode = String(
  process.env.DATABASE_SSL || process.env.PGSSLMODE || ""
)
  .trim()
  .toLowerCase();
const databaseUrlRequiresSsl = /sslmode=require|ssl=true/i.test(databaseUrl);
const useSsl =
  ["1", "true", "require", "verify-ca", "verify-full"].includes(
    databaseSslMode
  ) || databaseUrlRequiresSsl;
const sslConfig = useSsl ? { rejectUnauthorized: false } : undefined;

if (
  !databaseUrl &&
  (dbPasswordRaw === undefined ||
    dbPasswordRaw === null ||
    String(dbPasswordRaw).trim() === "")
) {
  console.warn(
    "⚠️ DB_PASSWORD no definido en .env. Configura backend/.env para evitar errores SCRAM."
  );
}

const poolConfig = databaseUrl
  ? {
      connectionString: databaseUrl,
      ...(sslConfig ? { ssl: sslConfig } : {}),
    }
  : {
      user: dbUser,
      host: dbHost,
      database: dbName,
      // Debe llegar como string para SCRAM-SHA-256.
      password:
        dbPasswordRaw === undefined || dbPasswordRaw === null
          ? undefined
          : String(dbPasswordRaw),
      port: dbPort,
      ...(sslConfig ? { ssl: sslConfig } : {}),
    };

const pool = new Pool(poolConfig);

/*pool.connect((err, client, release) => {
  if(err){
    console.error('Error conectando a PostgreSql', err.message);
  }else{
    console.log('Conectado a PostgreSQL correctamente');
    console.log('Base de datos: gestionDeportiva');
    release();
  }
});*/

pool.on("error", (err) => {
  console.error("❌ Error inesperado en la base de datos:", err);
});

console.log(
  `📊 Configuración de base de datos cargada (${databaseUrl ? "DATABASE_URL" : "DB_*"})`
);

module.exports = pool;
