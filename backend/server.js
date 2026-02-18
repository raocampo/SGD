const express = require("express");
const cors = require("cors");
const path = require("path");
const pool = require("./config/database");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// =====================
// Middlewares base
// =====================
app.use(cors());
app.use(express.json()); // ✅ IMPORTANTE: para /api/sorteo y /api/grupos (JSON)
app.use(express.urlencoded({ extended: true })); // ✅ por compatibilidad

// =====================
// Static: UPLOADS (logos)
// =====================
const uploadsPath = path.join(__dirname, "uploads");

app.use(
  "/uploads",
  express.static(uploadsPath, {
    setHeaders: (res) => {
      // ✅ Permitir que html2canvas pueda leer imágenes y exportarlas
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      // (opcional) cache
      // res.setHeader("Cache-Control", "public, max-age=86400");
    },
  })
);

// =====================
// Rutas API
// =====================
const campeonatoRoutes = require("./routes/campeonatoRoutes");
const equipoRoutes = require("./routes/equipoRoutes");
const jugadorRoutes = require("./routes/jugadorRoutes");
const grupoRoutes = require("./routes/grupoRoutes");
const sorteoRoutes = require("./routes/sorteoRoutes");
const partidoRoutes = require("./routes/partidoRoutes");
const tablaRoutes = require("./routes/tablaRoutes");
const eventoRoutes = require("./routes/eventoRoutes");
const canchaRoutes = require("./routes/canchaRoutes");
const eliminatoriaRoutes = require("./routes/eliminatoriaRoutes");

app.use("/api/campeonatos", campeonatoRoutes);
app.use("/api/equipos", equipoRoutes);
app.use("/api/jugadores", jugadorRoutes);
app.use("/api/grupos", grupoRoutes);
app.use("/api/sorteo", sorteoRoutes);
app.use("/api/partidos", partidoRoutes);
app.use("/api/tablas", tablaRoutes);
app.use("/api/eventos", eventoRoutes);
app.use("/api/canchas", canchaRoutes);
app.use("/api/eliminatorias", eliminatoriaRoutes);

// =====================
// Frontend (opcional)
// Si abres el frontend desde el mismo backend: http://localhost:5000/
// =====================
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));

// ✅ Fallback SPA: cualquier ruta que NO sea /api ni /uploads, manda index.html
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
  return res.sendFile(path.join(frontendPath, "index.html"));
});

// =====================
// Rutas utilitarias
// =====================
app.get("/", (req, res) => {
  res.json({
    mensaje: "🚀 Servidor de Gestión Deportiva funcionando!",
    version: "1.0.0",
    endpoints: [
      "/salud",
      "/testDb",
      "/tablas",
      "/api/eventos",
      "/api/campeonatos",
      "/api/canchas",
      "/api/equipos",
      "/api/jugadores",
      "/api/grupos",
      "/api/sorteo",
      "/api/partidos",
      "/api/tablas",
      "/api/eliminatorias",
      "/uploads",
    ],
  });
});

app.get("/salud", (req, res) => {
  res.json({
    mensaje: "¡El servidor está vivo y funcionando!",
    timestamp: new Date().toISOString(),
  });
});

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

// =====================
// Iniciar servidor
// =====================
app.listen(PORT, () => {
  console.log(`⚽ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🔗 Endpoints disponibles:`);
  console.log(`   http://localhost:${PORT}/`);
  console.log(`   http://localhost:${PORT}/api/eventos`);
  console.log(`   http://localhost:${PORT}/api/campeonatos`);
  console.log(`   http://localhost:${PORT}/api/canchas`);
  console.log(`   http://localhost:${PORT}/api/equipos`);
  console.log(`   http://localhost:${PORT}/api/jugadores`);
  console.log(`   http://localhost:${PORT}/api/grupos`);
  console.log(`   http://localhost:${PORT}/api/sorteo`);
  console.log(`   http://localhost:${PORT}/api/partidos`);
  console.log(`   http://localhost:${PORT}/api/tablas`);
  console.log(`   http://localhost:${PORT}/tablas`);
  console.log(`📂 Uploads: http://localhost:${PORT}/uploads`);
});
