const { createServer } = require("http");
const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const pool = require("./config/database");
const { uploadsDir, ensureUploadsRoot } = require("./config/uploads");
const { initSocket } = require("./services/socketService");

require("dotenv").config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;
const corsOrigins = String(process.env.CORS_ORIGINS || "*")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

// =====================
// Middlewares base
// =====================
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes("*") || corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origen no permitido por CORS"));
    },
  })
);
app.use(express.json()); // ✅ IMPORTANTE: para /api/sorteo y /api/grupos (JSON)
app.use(express.urlencoded({ extended: true })); // ✅ por compatibilidad

// =====================
// Static: UPLOADS (logos)
// =====================
ensureUploadsRoot();

app.use(
  "/uploads",
  express.static(uploadsDir, {
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
const finanzaRoutes = require("./routes/finanzaRoutes");
const auspicianteRoutes = require("./routes/auspicianteRoutes");
const paseRoutes = require("./routes/paseRoutes");
const authRoutes = require("./routes/authRoutes");
const mobileRoutes = require("./routes/mobileRoutes");
const noticiaRoutes = require("./routes/noticiaRoutes");
const galeriaRoutes = require("./routes/galeriaRoutes");
const portalContenidoRoutes = require("./routes/portalContenidoRoutes");
const organizadorPortalRoutes = require("./routes/organizadorPortalRoutes");
const contactoRoutes = require("./routes/contactoRoutes");
const publicRoutes = require("./routes/publicRoutes");
const comprobanteRoutes = require("./routes/comprobanteRoutes");
const transmisionRoutes = require("./routes/transmisionRoutes");
const overlayRoutes = require("./routes/overlayRoutes");

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
app.use("/api/finanzas", finanzaRoutes);
app.use("/api/auspiciantes", auspicianteRoutes);
app.use("/api/pases", paseRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/mobile/v1", mobileRoutes);
app.use("/api/noticias", noticiaRoutes);
app.use("/api/galeria", galeriaRoutes);
app.use("/api/portal-contenido", portalContenidoRoutes);
app.use("/api/organizador-portal", organizadorPortalRoutes);
app.use("/api/contacto", contactoRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/comprobantes", comprobanteRoutes);
app.use("/api/transmisiones", transmisionRoutes);
app.use("/api/transmisiones/:id/overlay", overlayRoutes);

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "La imagen excede el tamaño permitido de 8MB.",
      });
    }
    return res.status(400).json({
      error: error.message || "Error validando archivo adjunto.",
    });
  }

  return next(error);
});

// =====================
// Frontend (opcional)
// Si abres el frontend desde el mismo backend: http://localhost:5000/
// =====================
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));

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
      "/api/finanzas",
      "/api/auspiciantes",
      "/api/pases",
      "/api/auth/login",
      "/api/mobile/v1/session",
      "/api/noticias",
      "/api/galeria",
      "/api/portal-contenido",
      "/api/organizador-portal",
      "/api/contacto",
      "/api/public/campeonatos",
      "/api/public/campeonatos/:id",
      "/api/public/campeonatos/:id/eventos",
      "/api/public/eventos/:id/partidos",
      "/api/public/eventos/:id/tablas",
      "/api/public/eventos/:id/eliminatorias",
      "/api/public/noticias",
      "/api/public/galeria",
      "/api/public/portal-contenido",
      "/api/public/contacto",
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

// ✅ Fallback SPA: cualquier ruta que NO sea /api ni /uploads, manda index.html
// Se declara al final para no interceptar rutas utilitarias como /salud y /testDb.
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
  return res.sendFile(path.join(frontendPath, "index.html"));
});

// =====================
// Iniciar servidor
// =====================
initSocket(httpServer);

httpServer.listen(PORT, () => {
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
  console.log(`   http://localhost:${PORT}/api/finanzas`);
  console.log(`   http://localhost:${PORT}/api/auspiciantes`);
  console.log(`   http://localhost:${PORT}/api/pases`);
  console.log(`   http://localhost:${PORT}/api/auth/login`);
  console.log(`   http://localhost:${PORT}/tablas`);
  console.log(`📂 Uploads: http://localhost:${PORT}/uploads`);
  console.log(`📁 Directorio de uploads: ${uploadsDir}`);
});
