// backend/controllers/eliminatoriaController.js
const Eliminatoria = require("../models/Eliminatoria");
const pool = require("../config/database");

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
      const payloadCantidad = Number.parseInt(req.body?.cantidad_equipos, 10);
      if (!Number.isFinite(evento_id)) {
        return res.status(400).json({ error: "evento_id inválido" });
      }

      const eventoR = await pool.query(
        `SELECT id, nombre, metodo_competencia, eliminatoria_equipos FROM eventos WHERE id = $1 LIMIT 1`,
        [evento_id]
      );
      const evento = eventoR.rows[0];
      if (!evento) {
        return res.status(404).json({ error: "Evento no encontrado" });
      }

      const cantidadEquipos = Number.isFinite(payloadCantidad)
        ? payloadCantidad
        : Number.parseInt(evento.eliminatoria_equipos, 10) || null;

      const origen = String(req.body?.origen || "evento").toLowerCase();
      let partidos = [];
      let meta = null;

      if (origen === "grupos") {
        const generado = await Eliminatoria.generarBracketDesdeGrupos(evento_id, {
          ...req.body,
          cantidad_equipos: cantidadEquipos,
        });
        partidos = Array.isArray(generado?.partidos) ? generado.partidos : [];
        meta = generado?.meta || null;
      } else {
        partidos = await Eliminatoria.generarBracket(evento_id, cantidadEquipos);
      }

      res.json({
        mensaje: "Bracket generado",
        evento_id,
        evento_nombre: evento.nombre,
        metodo_competencia: evento.metodo_competencia || "eliminatoria",
        origen_generacion: origen === "grupos" ? "grupos" : "evento",
        cantidad_equipos_objetivo: cantidadEquipos,
        total: partidos.length,
        meta,
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
