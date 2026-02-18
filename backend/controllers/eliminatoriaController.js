// backend/controllers/eliminatoriaController.js
const Eliminatoria = require("../models/Eliminatoria");

const eliminatoriaController = {
  obtenerPorEvento: async (req, res) => {
    try {
      const evento_id = parseInt(req.params.evento_id, 10);
      if (!Number.isFinite(evento_id)) {
        return res.status(400).json({ error: "evento_id inválido" });
      }
      const partidos = await Eliminatoria.obtenerPorEvento(evento_id);
      res.json({
        mensaje: "Llave eliminatoria",
        evento_id,
        partidos,
      });
    } catch (error) {
      console.error("Error obteniendo eliminatoria:", error);
      res.status(500).json({
        error: "Error obteniendo llave eliminatoria",
        detalle: error.message,
      });
    }
  },

  generarBracket: async (req, res) => {
    try {
      const evento_id = parseInt(req.params.evento_id, 10);
      const { cantidad_equipos = 8 } = req.body || {};
      if (!Number.isFinite(evento_id)) {
        return res.status(400).json({ error: "evento_id inválido" });
      }
      const partidos = await Eliminatoria.generarBracket(evento_id, parseInt(cantidad_equipos, 10) || 8);
      res.json({
        mensaje: "Bracket generado",
        evento_id,
        total: partidos.length,
        partidos,
      });
    } catch (error) {
      console.error("Error generando bracket:", error);
      res.status(500).json({
        error: "Error generando bracket",
        detalle: error.message,
      });
    }
  },

  actualizarResultado: async (req, res) => {
    try {
      const { id } = req.params;
      const { resultado_local, resultado_visitante, ganador_id } = req.body;
      const slot = await Eliminatoria.actualizarResultado(
        parseInt(id, 10),
        resultado_local,
        resultado_visitante,
        ganador_id
      );
      if (!slot) {
        return res.status(404).json({ error: "Partido no encontrado" });
      }
      res.json({ mensaje: "Resultado actualizado", partido: slot });
    } catch (error) {
      console.error("Error actualizando resultado:", error);
      res.status(500).json({ error: error.message });
    }
  },

  asignarEquipos: async (req, res) => {
    try {
      const { id } = req.params;
      const { equipo_local_id, equipo_visitante_id } = req.body;
      const slot = await Eliminatoria.asignarEquipos(
        parseInt(id, 10),
        equipo_local_id,
        equipo_visitante_id
      );
      if (!slot) {
        return res.status(404).json({ error: "Slot no encontrado" });
      }
      res.json({ mensaje: "Equipos asignados", partido: slot });
    } catch (error) {
      console.error("Error asignando equipos:", error);
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = eliminatoriaController;
