const Pase = require("../models/Pase");

const paseController = {
  async crearPase(req, res) {
    try {
      const pase = await Pase.crear(req.body || {});
      return res.status(201).json({
        ok: true,
        mensaje: "Pase registrado",
        pase,
      });
    } catch (error) {
      console.error("Error crearPase:", error);
      return res.status(400).json({ error: error.message || "No se pudo registrar el pase" });
    }
  },

  async listarPases(req, res) {
    try {
      const pases = await Pase.listar(req.query || {});
      return res.json({
        ok: true,
        total: pases.length,
        pases,
      });
    } catch (error) {
      console.error("Error listarPases:", error);
      return res.status(500).json({ error: "Error listando pases" });
    }
  },

  async listarHistorialJugadores(req, res) {
    try {
      const historial = await Pase.listarHistorialJugadores(req.query || {});
      return res.json({
        ok: true,
        total: historial.length,
        historial,
      });
    } catch (error) {
      console.error("Error listarHistorialJugadores:", error);
      return res.status(500).json({ error: "Error listando historial por jugador" });
    }
  },

  async obtenerHistorialJugador(req, res) {
    try {
      const jugadorId = Number.parseInt(req.params.jugadorId, 10);
      if (!Number.isFinite(jugadorId) || jugadorId <= 0) {
        return res.status(400).json({ error: "jugadorId inválido" });
      }

      const resultado = await Pase.obtenerHistorialJugador(jugadorId, req.query || {});
      if (!resultado) return res.status(404).json({ error: "Jugador no encontrado" });

      return res.json({
        ok: true,
        jugador: resultado.jugador,
        resumen: resultado.resumen,
        total: resultado.historial.length,
        historial: resultado.historial,
      });
    } catch (error) {
      console.error("Error obtenerHistorialJugador:", error);
      return res.status(500).json({ error: error.message || "Error obteniendo historial del jugador" });
    }
  },

  async listarHistorialEquipos(req, res) {
    try {
      const historial = await Pase.listarHistorialEquipos(req.query || {});
      return res.json({
        ok: true,
        total: historial.length,
        historial,
      });
    } catch (error) {
      console.error("Error listarHistorialEquipos:", error);
      return res.status(500).json({ error: "Error listando historial por equipo" });
    }
  },

  async obtenerHistorialEquipo(req, res) {
    try {
      const equipoId = Number.parseInt(req.params.equipoId, 10);
      if (!Number.isFinite(equipoId) || equipoId <= 0) {
        return res.status(400).json({ error: "equipoId inválido" });
      }

      const resultado = await Pase.obtenerHistorialEquipo(equipoId, req.query || {});
      if (!resultado) return res.status(404).json({ error: "Equipo no encontrado" });

      return res.json({
        ok: true,
        equipo: resultado.equipo,
        resumen: resultado.resumen,
        total: resultado.historial.length,
        historial: resultado.historial,
      });
    } catch (error) {
      console.error("Error obtenerHistorialEquipo:", error);
      return res.status(500).json({ error: error.message || "Error obteniendo historial del equipo" });
    }
  },

  async obtenerPase(req, res) {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "id inválido" });
      }
      const pase = await Pase.obtenerPorId(id);
      if (!pase) return res.status(404).json({ error: "Pase no encontrado" });
      return res.json({ ok: true, pase });
    } catch (error) {
      console.error("Error obtenerPase:", error);
      return res.status(500).json({ error: "Error obteniendo pase" });
    }
  },

  async actualizarEstado(req, res) {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "id inválido" });
      }
      const pase = await Pase.actualizarEstado(id, req.body || {});
      if (!pase) return res.status(404).json({ error: "Pase no encontrado" });
      return res.json({
        ok: true,
        mensaje: "Estado de pase actualizado",
        pase,
      });
    } catch (error) {
      console.error("Error actualizarEstadoPase:", error);
      return res.status(400).json({ error: error.message || "No se pudo actualizar el pase" });
    }
  },
};

module.exports = paseController;
