const express = require("express");
const cors = require("cors");
const pool = require("./config/database");
const sorteoRoutes = require("./routes/sorteoRoutes");
const partidoRoutes = require("./routes/partidoRoutes");
const tablaRoutes = require("./routes/tablaRoutes");
const path = require("path");
const uploadsPath = path.join(__dirname, "uploads");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(
  "/uploads",
  express.static(uploadsPath, {
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

// ✅ Servir uploads con headers para que html2canvas pueda exportar (PNG/PDF) sin bloquearse
/*app.use(
  "/uploads",
  (req, res, next) => {
    // Permite que el frontend (127.0.0.1:5500) lea las imágenes
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Evita bloqueo por políticas de recursos cross-origin en algunos navegadores
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    next();
  },
  express.static(uploadsPath)
);*/

// opcional: ruta de inicio
app.get("/gruposgen", (req, res) => {
  res.sendFile(path.join(frontendPath, "gruposgen.html"));
});
// Importar rutas
const campeonatoRoutes = require("./routes/campeonatoRoutes");
const equipoRoutes = require("./routes/equipoRoutes");
const jugadorRoutes = require("./routes/jugadorRoutes");
const grupoRoutes = require("./routes/grupoRoutes");

// Usar rutas
app.use("/api/campeonatos", campeonatoRoutes);
app.use("/api/equipos", equipoRoutes);
app.use("/api/jugadores", jugadorRoutes);
app.use("/api/grupos", grupoRoutes);
app.use("/api/sorteo", sorteoRoutes);
app.use("/api/partidos", partidoRoutes);
app.use("/api/tablas", tablaRoutes);

const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));

app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads"))
    return next();
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.get("/gruposgen", (req, res) => {
  res.sendFile(path.join(frontendPath, "gruposgen.html"));
});

// Ruta de prueba
app.get("/", (req, res) => {
  res.json({
    mensaje: "🚀 Servidor de Gestión Deportiva funcionando!",
    version: "1.0.0",
    estado: "Servidor y base de datos conectados",
    endpoints: [
      "/salud",
      "/testDb",
      "/tablas",
      "/api/campeonatos",
      "/api/equipos",
      "/api/jugadores",
      "/api/grupos",
      "/api/sorteo",
      "/api/partidos",
      "/api/tablas",
    ],
  });
});

// Ruta de salud
app.get("/salud", (req, res) => {
  res.json({
    mensaje: "¡El servidor está vivo y funcionando!",
    timestamp: new Date().toISOString(),
  });
});

// Ruta para probar la base de datos
app.get("/testDb", async (req, res) => {
  try {
    const result = await pool.query("SELECT version()");
    res.json({
      mensaje: "✅ Conexión a PostgreSQL exitosa",
      base_datos: "gestionDeportiva",
      version: result.rows[0].version,
      estado: "Conectado",
    });
  } catch (error) {
    res.status(500).json({
      error: "❌ Error en la base de datos",
      detalle: error.message,
    });
  }
});

// Ruta para ver tablas
app.get("/tablas", async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

    res.json({
      mensaje: "📊 Tablas en la base de datos",
      total_tablas: result.rows.length,
      tablas: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      error: "❌ Error obteniendo tablas",
      detalle: error.message,
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`⚽ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 Base de datos: PostgreSQL`);
  console.log(`🔗 Endpoints disponibles:`);
  console.log(`   http://localhost:${PORT}/`);
  console.log(`   http://localhost:${PORT}/api/campeonatos`);
  console.log(`   http://localhost:${PORT}/api/equipos`);
  console.log(`   http://localhost:${PORT}/api/jugadores`);
  console.log(`   http://localhost:${PORT}/api/grupos`);
  console.log(`   http://localhost:${PORT}/api/sorteo`);
  console.log(`   http://localhost:${PORT}/api/partidos`);
  console.log(`   http://localhost:${PORT}/api/tablas`);
  console.log(`   http://localhost:${PORT}/tablas`);
});
