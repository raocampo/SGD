"use strict";

/**
 * socketService.js
 * Inicializa Socket.io:
 *  - Salas overlay: `overlay:{id}` — director OBS
 *  - Salas WebRTC:  `broadcast:{id}` — broadcaster → viewers
 */

const { Server } = require("socket.io");

let io = null;

// Usuario de un token de sesión, con la misma resolución que requireAuth
// (incluida la identidad efectiva del co-organizador). null si no es válido.
async function usuarioDesdeToken(token) {
  try {
    if (!token) return null;
    const jwt = require("jsonwebtoken");
    const UsuarioAuth = require("../models/UsuarioAuth");
    const payload = jwt.verify(String(token), process.env.JWT_SECRET || "sgd-dev-secret-change-me");
    const user = await UsuarioAuth.obtenerPorId(payload?.id);
    if (!user || !user.activo) return null;
    return UsuarioAuth.resolverIdentidadEfectiva(UsuarioAuth.limpiarUsuario(user));
  } catch (_) {
    return null;
  }
}

// Mapa broadcaster activo por transmisión: transmision_id → socket.id
const webrtcBroadcasters = new Map();

function actualizarConteoViewers(transmision_id) {
  if (!io) return;
  const room = `broadcast:${transmision_id}`;
  const roomSet = io.sockets.adapter.rooms.get(room);
  const total = roomSet ? roomSet.size : 0;
  const bId = webrtcBroadcasters.get(String(transmision_id));
  const viewers = (bId && roomSet && roomSet.has(bId)) ? Math.max(0, total - 1) : total;
  io.to(room).emit("webrtc:viewer-count", { count: viewers });
}

/**
 * Inicializar Socket.io sobre el httpServer de Express.
 * @param {import('http').Server} httpServer
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    // ── Overlay OBS ────────────────────────────────────────────────
    socket.on("join:overlay", ({ transmision_id }) => {
      if (!transmision_id) return;
      socket.join(`overlay:${transmision_id}`);
    });

    // El estado del overlay solo se cambia por PUT /api/transmisiones/:id/overlay
    // (autenticado y con propiedad verificada), que lo emite con emitOverlayState.
    // Antes existía un reenvío "overlay:update" sin autenticación: cualquiera que
    // conociera el id de una transmisión podía cambiar marcador, texto o publicidad.

    // ── WebRTC Broadcaster ─────────────────────────────────────────
    // Solo el organizador dueño (o el administrador) puede transmitir: antes
    // cualquiera con el id podía reemplazar al broadcaster y emitir su video.
    socket.on("webrtc:broadcaster-join", async ({ transmision_id, token } = {}) => {
      if (!transmision_id) return;
      const { usuarioPuedeOperarTransmision } = require("./transmisionAcceso");
      const user = await usuarioDesdeToken(token);
      if (!user || !(await usuarioPuedeOperarTransmision(user, transmision_id))) {
        socket.emit("webrtc:broadcaster-denied", { error: "No autorizado para transmitir en esta transmisión." });
        return;
      }
      const room = `broadcast:${transmision_id}`;
      socket.join(room);
      webrtcBroadcasters.set(String(transmision_id), socket.id);
      // Avisar a viewers que ya estaban esperando
      socket.to(room).emit("webrtc:broadcaster-ready", { broadcaster_id: socket.id });
      actualizarConteoViewers(transmision_id);
    });

    // ── WebRTC Viewer ──────────────────────────────────────────────
    socket.on("webrtc:viewer-join", ({ transmision_id }) => {
      if (!transmision_id) return;
      const room = `broadcast:${transmision_id}`;
      socket.join(room);
      const bId = webrtcBroadcasters.get(String(transmision_id));
      if (bId) {
        // Pedir al broadcaster que cree una oferta para este viewer
        io.to(bId).emit("webrtc:viewer-request", { viewer_id: socket.id });
        // Confirmar al viewer que hay broadcaster
        socket.emit("webrtc:broadcaster-ready", { broadcaster_id: bId });
      }
      actualizarConteoViewers(transmision_id);
    });

    // ── WebRTC Señalización (relay genérico) ───────────────────────
    socket.on("webrtc:offer",  ({ to, offer })     => { if (to) io.to(to).emit("webrtc:offer",  { offer,     from: socket.id }); });
    socket.on("webrtc:answer", ({ to, answer })    => { if (to) io.to(to).emit("webrtc:answer", { answer,    from: socket.id }); });
    socket.on("webrtc:ice",    ({ to, candidate }) => { if (to) io.to(to).emit("webrtc:ice",    { candidate, from: socket.id }); });

    // ── Desconexión ────────────────────────────────────────────────
    socket.on("disconnect", () => {
      webrtcBroadcasters.forEach((socketId, txId) => {
        if (socketId === socket.id) {
          webrtcBroadcasters.delete(txId);
          io.to(`broadcast:${txId}`).emit("webrtc:broadcaster-left");
        }
      });
    });
  });

  console.log("🔌 Socket.io inicializado");
  return io;
}

/**
 * Emitir estado de overlay desde el controlador REST.
 * Útil para persistir y sincronizar cuando el director usa HTTP.
 * @param {number} transmisionId
 * @param {object} state
 */
function emitOverlayState(transmisionId, state) {
  if (!io) return;
  io.to(`overlay:${transmisionId}`).emit("overlay:state", state);
}

module.exports = { initSocket, emitOverlayState };
