const path = require("path");
const fs = require("fs");
const Campeonato = require("../models/Campeonato");

const campeonatoController = {
  // Crear nuevo campeonato
  crearCampeonato: async (req, res) => {
    try {
      const {
        nombre,
        organizador,
        fecha_inicio,
        fecha_fin,
        tipo_futbol,
        sistema_puntuacion,
        max_equipos,
        min_jugador,
        max_jugador,
        color_primario,
        color_secundario,
        color_acento,
      } = req.body;

      // Validaciones básicas
      /*if (!nombre || !tipo_futbol) {
                return res.status(400).json({
                    error: 'Nombre y tipo de fútbol son obligatorios'
                });
            }*/
      if (!nombre || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({
          error: "nombre, fecha_inicio y fecha_fin son obligatorios",
        });
      }

      if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
      }

      const logo_url = req.file
        ? `/uploads/campeonatos/${req.file.filename}`
        : null;

      const nuevoCampeonato = await Campeonato.crear(
        nombre,
        organizador,
        fecha_inicio,
        fecha_fin,
        tipo_futbol,
        sistema_puntuacion,
        max_equipos,
        min_jugador,
        max_jugador,
        color_primario,
        color_secundario,
        color_acento,
        logo_url
      );

      res.status(201).json({
        mensaje: "🏆 Campeonato creado exitosamente",
        campeonato: nuevoCampeonato,
      });
    } catch (error) {
      console.error("Error creando campeonato:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // Obtener todos los campeonatos
  obtenerCampeonatos: async (req, res) => {
    try {
      const campeonatos = await Campeonato.obtenerTodos();

      res.json({
        mensaje: "📋 Lista de campeonatos",
        total: campeonatos.length,
        campeonatos: campeonatos,
      });
    } catch (error) {
      console.error("Error obteniendo campeonatos:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // Obtener campeonato por ID
  obtenerCampeonato: async (req, res) => {
    try {
      const { id } = req.params;
      const campeonato = await Campeonato.obtenerPorId(id);

      if (!campeonato) {
        return res.status(404).json({
          error: "Campeonato no encontrado",
        });
      }

      res.json({
        mensaje: "📖 Detalles del campeonato",
        campeonato: campeonato,
      });
    } catch (error) {
      console.error("Error obteniendo campeonato:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // Actualizar campeonato
  actualizarCampeonato: async (req, res) => {
    try {
      const { id } = req.params;
      const datos = req.body;

      if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
      }

      if (req.file) {
        datos.logo_url = `/uploads/campeonatos/${req.file.filename}`;
      }

      const campeonatoActualizado = await Campeonato.actualizar(id, datos);

      if (!campeonatoActualizado) {
        return res.status(404).json({
          error: "Campeonato no encontrado",
        });
      }

      res.json({
        mensaje: "✅ Campeonato actualizado exitosamente",
        campeonato: campeonatoActualizado,
      });
    } catch (error) {
      console.error("Error actualizando campeonato:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // Eliminar campeonato
  eliminarCampeonato: async (req, res) => {
    try {
      const { id } = req.params;
      const campeonatoEliminado = await Campeonato.eliminar(id);

      if (!campeonatoEliminado) {
        return res.status(404).json({
          error: "Campeonato no encontrado",
        });
      }

      if (camp.logo_url) {
        const filePath = path.join(
          __dirname,
          "..",
          camp.logo_url.replace(/^\//, "")
        );
        fs.unlink(filePath, (err) => {
          if (err) {
            console.warn(
              "No se pudo eliminar el logo del campeonato:",
              err.message
            );
          }
        });
      }

      res.json({
        mensaje: "🗑️ Campeonato eliminado exitosamente",
        campeonato: campeonatoEliminado,
      });
    } catch (error) {
      console.error("Error eliminando campeonato:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },
};

module.exports = campeonatoController;
