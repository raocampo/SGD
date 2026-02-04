/* controllers/partidoController.js */
const pool = require("../config/database");
const Partido = require("../models/Partido");

const partidoController = {
  // =========================
  // LISTAR
  // =========================
  obtenerPorEvento: async (req, res) => {
    try {
      const { evento_id } = req.params;
      const partidos = await Partido.obtenerPorEvento(parseInt(evento_id));
      res.json({ partidos });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Error obteniendo partidos", detalle: e.message });
    }
  },

  obtenerPorEventoYJornada: async (req, res) => {
    try {
      const { evento_id, jornada } = req.params;
      const partidos = await Partido.obtenerPorEventoYJornada(parseInt(evento_id), parseInt(jornada));
      res.json({ partidos });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Error obteniendo partidos por jornada", detalle: e.message });
    }
  },

  obtenerPartido: async (req, res) => {
    try {
      const { id } = req.params;
      const partido = await Partido.obtenerPorId(parseInt(id));
      if (!partido) return res.status(404).json({ error: "Partido no encontrado" });
      res.json({ partido });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Error obteniendo partido", detalle: e.message });
    }
  },

  // =========================
  // CRUD
  // =========================
  actualizarPartido: async (req, res) => {
    try {
      const { id } = req.params;
      const actualizado = await Partido.actualizar(parseInt(id), req.body);
      res.json({ mensaje: "Partido actualizado", partido: actualizado });
    } catch (e) {
      console.error("Error actualizando partido:", e);
      res.status(500).json({ error: "Error actualizando partido", detalle: e.message });
    }
  },

  eliminarPartido: async (req, res) => {
    try {
      const { id } = req.params;
      const eliminado = await Partido.eliminar(parseInt(id));
      res.json({ mensaje: "Partido eliminado", partido: eliminado });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Error eliminando partido", detalle: e.message });
    }
  },

  // =========================
  // FIXTURE POR EVENTO (COMPLETO)
  // =========================
  generarFixtureEventoCompleto: async (req, res) => {
    try {
      const {
        evento_id,
        reemplazar,
        ida_y_vuelta,
        modalidad, // weekend | weekday | mixed
        hora_inicio_weekday,
        hora_fin_weekday,
        duracion_min,
        descanso_min,
        programacion_manual,
      } = req.body;

      if (!evento_id) return res.status(400).json({ error: "evento_id es obligatorio" });

      // Si no quieren reemplazar y ya hay partidos, prevenimos
      const countRes = await pool.query(
        "SELECT COUNT(*)::int AS count FROM partidos WHERE evento_id=$1",
        [parseInt(evento_id)]
      );
      const yaHay = countRes.rows[0].count > 0;
      if (yaHay && !reemplazar) {
        return res.status(409).json({
          codigo: "YA_EXISTEN_PARTIDOS_EVENTO",
          mensaje: "Ya existen partidos para este evento. Usa reemplazar=true si deseas regenerar.",
        });
      }

      const partidos = await Partido.generarFixtureEventoCompleto({
        evento_id: parseInt(evento_id),
        reemplazar: reemplazar === true,
        ida_y_vuelta: ida_y_vuelta === true,
        modalidad: modalidad || "weekend",
        hora_inicio_weekday: hora_inicio_weekday || "18:00",
        hora_fin_weekday: hora_fin_weekday || "22:00",
        duracion_min: duracion_min ? parseInt(duracion_min) : 90,
        descanso_min: descanso_min ? parseInt(descanso_min) : 10,
        programacion_manual: programacion_manual === true,
      });

      res.status(201).json({
        mensaje: "Fixture generado por EVENTO (completo por jornadas)",
        evento_id: parseInt(evento_id),
        total_partidos: partidos.length,
        partidos,
      });
    } catch (e) {
      console.error("Error generando fixture evento:", e);
      res.status(500).json({ error: "Error generando fixture evento", detalle: e.message });
    }
  },
};

module.exports = partidoController;
