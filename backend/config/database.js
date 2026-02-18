const { Pool } = require("pg");

require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "gestionDeportiva",
  password: process.env.DB_PASSWORD || "",
  port: parseInt(process.env.DB_PORT || "5432", 10),
});

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

console.log("📊 Configuración de base de datos cargada");

module.exports = pool;
