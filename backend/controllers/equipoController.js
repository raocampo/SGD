//controller/equipo.Controller.js
const Equipo = require("../models/Equipo");
const path = require("path");
const fs = require("fs");

const equipoController = {
  // CREAR - Nuevo equipo
  crearEquipo: async (req, res) => {
    try {
      const {
        campeonato_id,
        nombre,
        director_tecnico,
        color_equipo,
        telefono,
        email,
      } = req.body;

      // Validaciones básicas
      if (!campeonato_id || !nombre) {
        return res.status(400).json({
          error: "campeonato_id y nombre son obligatorios",
        });
      }

      const logo_url = req.file
        ? `/uploads/equipos/${req.file.filename}`
        : null;

      const nuevoEquipo = await Equipo.crear(
        campeonato_id,
        nombre,
        director_tecnico,
        color_equipo,
        telefono,
        email,
        logo_url
      );

      res.status(201).json({
        mensaje: "⚽ Equipo creado exitosamente",
        equipo: nuevoEquipo,
      });
    } catch (error) {
      console.error("Error creando equipo:", error);

      if (
        error.message.includes("Límite") ||
        error.message.includes("Campeonato no encontrado")
      ) {
        return res.status(400).json({
          error: error.message,
        });
      }

      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // LEER - Obtener TODOS los equipos
  obtenerTodosLosEquipos: async (req, res) => {
    try {
      const equipos = await Equipo.obtenerTodos();

      res.json({
        mensaje: "📋 Todos los equipos del sistema",
        total: equipos.length,
        equipos: equipos,
      });
    } catch (error) {
      console.error("Error obteniendo equipos:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // LEER - Obtener equipos por campeonato
  obtenerEquiposPorCampeonato: async (req, res) => {
    try {
      const { campeonato_id } = req.params;

      const equipos = await Equipo.obtenerPorCampeonato(campeonato_id);

      res.json({
        mensaje: `📋 Equipos del campeonato ${campeonato_id}`,
        total: equipos.length,
        equipos: equipos,
      });
    } catch (error) {
      console.error("Error obteniendo equipos:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // LEER - Obtener equipo específico
  obtenerEquipo: async (req, res) => {
    try {
      const { id } = req.params;
      const equipo = await Equipo.obtenerPorId(id);

      if (!equipo) {
        return res.status(404).json({
          error: "Equipo no encontrado",
        });
      }

      res.json({
        mensaje: "📖 Detalles del equipo",
        equipo: equipo,
      });
    } catch (error) {
      console.error("Error obteniendo equipo:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // ACTUALIZAR - Modificar equipo
  /*actualizarEquipo: async (req, res) => {
    try {
      const { id } = req.params;
      const datos = req.body;

      const equipoActualizado = await Equipo.actualizar(id, datos);

      if (!equipoActualizado) {
        return res.status(404).json({
          error: "Equipo no encontrado",
        });
      }

      res.json({
        mensaje: "✅ Equipo actualizado exitosamente",
        equipo: equipoActualizado,
      });
    } catch (error) {
      console.error("Error actualizando equipo:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },*/
  // ACTUALIZAR - Modificar equipo
  // controllers/equipoController.js
  /*actualizarEquipo: async (req, res) => {
    try {
      const { id } = req.params;

      // Si viene multipart/form-data, req.body existe pero todo es string
      const datos = req.body ? { ...req.body } : {};

      if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
      }

      // Normalizar boolean (viene "true"/"false" cuando es FormData)
      if (typeof datos.cabeza_serie === "string") {
        datos.cabeza_serie = datos.cabeza_serie === "true";
      }

      // Si subieron un logo nuevo, setear logo_url
      if (req.file) {
        datos.logo_url = `/uploads/equipos/${req.file.filename}`;

        // (Opcional pero recomendado) borrar logo anterior
        const equipoAntes = await Equipo.obtenerPorId(id);
        if (equipoAntes?.logo_url) {
          const path = require("path");
          const fs = require("fs");

          const filePath = path.join(
            __dirname,
            "..",
            equipoAntes.logo_url.replace(/^\//, "")
          );

          fs.unlink(filePath, (err) => {
            if (err)
              console.warn("No se pudo eliminar logo anterior:", err.message);
          });
        }
      }

      // ✅ si no mandó nada para actualizar
      if (!datos || Object.keys(datos).length === 0) {
        return res.status(400).json({ error: "No hay campos para actualizar" });
      }

      const equipoActualizado = await Equipo.actualizar(id, datos);

      if (!equipoActualizado) {
        return res.status(404).json({ error: "Equipo no encontrado" });
      }

      res.json({
        mensaje: "✅ Equipo actualizado exitosamente",
        equipo: equipoActualizado,
      });
    } catch (error) {
      console.error("Error actualizando equipo:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },*/
  actualizarEquipo: async (req, res) => {
    try {
      const { id } = req.params;
      const datos = req.body || {};

      // ✅ si subieron archivo, seteamos logo_url
      if (req.file) {
        datos.logo_url = `/uploads/equipos/${req.file.filename}`;
      }

      const equipoActualizado = await Equipo.actualizar(id, datos);

      if (!equipoActualizado) {
        return res.status(404).json({ error: "Equipo no encontrado" });
      }

      res.json({
        mensaje: "✅ Equipo actualizado exitosamente",
        equipo: equipoActualizado,
      });
    } catch (error) {
      console.error("Error actualizando equipo:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },
  // ELIMINAR - Borrar equipo
  /*eliminarEquipo: async (req, res) => {
    try {
      const { id } = req.params;
      const equipoEliminado = await Equipo.eliminar(id);

      if (!equipoEliminado) {
        return res.status(404).json({
          error: "Equipo no encontrado",
        });
      }

      res.json({
        mensaje: "🗑️ Equipo eliminado exitosamente",
        equipo: equipoEliminado,
      });
    } catch (error) {
      console.error("Error eliminando equipo:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },*/
  eliminarEquipo: async (req, res) => {
    try {
      const { id } = req.params;
      const equipoEliminado = await Equipo.eliminar(id);

      if (!equipoEliminado) {
        return res.status(404).json({
          error: "Equipo no encontrado",
        });
      }

      // 👉 Si tenía logo, intentamos borrarlo del disco
      if (equipoEliminado.logo_url) {
        const filePath = path.join(
          __dirname,
          "..",
          equipoEliminado.logo_url.replace(/^\//, "") // quitar "/" inicial
        );

        fs.unlink(filePath, (err) => {
          if (err) {
            console.warn(
              "No se pudo eliminar el logo del equipo:",
              err.message
            );
          }
        });
      }

      res.json({
        mensaje: "🗑️ Equipo eliminado exitosamente",
        equipo: equipoEliminado,
      });
    } catch (error) {
      console.error("Error eliminando equipo:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // Designar/Remover cabeza de serie
  designarCabezaSerie: async (req, res) => {
    try {
      const { id } = req.params;
      const { cabeza_serie } = req.body;

      const equipoActualizado = await Equipo.designarCabezaSerie(
        id,
        cabeza_serie
      );

      if (!equipoActualizado) {
        return res.status(404).json({
          error: "Equipo no encontrado",
        });
      }

      const accion = cabeza_serie ? "designado" : "removido";
      res.json({
        mensaje: `👑 Equipo ${accion} como cabeza de serie exitosamente`,
        equipo: equipoActualizado,
      });
    } catch (error) {
      console.error("Error designando cabeza de serie:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // Obtener cabezas de serie por campeonato
  obtenerCabezasDeSerie: async (req, res) => {
    try {
      const { campeonato_id } = req.params;

      const cabezasDeSerie = await Equipo.obtenerCabezasDeSerie(campeonato_id);

      res.json({
        mensaje: `👑 Cabezas de serie del campeonato`,
        total: cabezasDeSerie.length,
        cabezas_serie: cabezasDeSerie,
      });
    } catch (error) {
      console.error("Error obteniendo cabezas de serie:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },
};

module.exports = equipoController;
