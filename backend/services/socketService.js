"use strict";

/**
 * socketService.js
 * Inicializa Socket.io y gestiona las salas de overlay en vivo.
 *
 * Sala por transmisión: `overlay:{transmision_id}`
 *  - Director y overlay OBS se unen a la misma sala.
 *  - El director emite "overlay:update" → el servidor hace broadcast
 *    a los demás clientes de la sala.
 */

const { Server } = require("socket.io");

let io = null;

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
    // El cliente envía { transmision_id } para unirse a la sala
    socket.on("join:overlay", ({ transmision_id }) => {
      if (!transmision_id) return;
      const room = `overlay:${transmision_id}`;
      socket.join(room);
    });

    // El director envía el estado completo; se rebroadcast a la sala
    socket.on("overlay:update", ({ transmision_id, state }) => {
      if (!transmision_id || !state) return;
      const room = `overlay:${transmision_id}`;
      // Emitir a todos los demás en la sala (incluido overlay OBS)
      socket.to(room).emit("overlay:state", state);
    });

    socket.on("disconnect", () => {
      // Socket.io limpia las salas automáticamente
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
