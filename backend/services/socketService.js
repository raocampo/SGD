"use strict";

/**
 * socketService.js
 * Inicializa Socket.io:
 *  - Salas overlay: `overlay:{id}` — director OBS
 *  - Salas WebRTC:  `broadcast:{id}` — broadcaster → viewers
 */

const { Server } = require("socket.io");

let io = null;

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

    socket.on("overlay:update", ({ transmision_id, state }) => {
      if (!transmision_id || !state) return;
      socket.to(`overlay:${transmision_id}`).emit("overlay:state", state);
    });

    // ── WebRTC Broadcaster ─────────────────────────────────────────
    socket.on("webrtc:broadcaster-join", ({ transmision_id }) => {
      if (!transmision_id) return;
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
