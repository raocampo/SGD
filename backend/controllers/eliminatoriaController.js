// backend/controllers/eliminatoriaController.js
const Eliminatoria = require("../models/Eliminatoria");
const pool = require("../config/database");
const {
  isOrganizador,
  organizadorPuedeAccederCampeonato,
} = require("../services/organizadorScope");

async function validarAccesoEventoGestion(req, res, eventoId) {
  const r = await pool.query(
    `SELECT id, campeonato_id FROM eventos WHERE id = $1 LIMIT 1`,
    [eventoId]
  );
  const evento = r.rows[0] || null;
  if (!evento) {
    res.status(404).json({ error: "Evento no encontrado" });
    return null;
  }
  if (isOrganizador(req?.user)) {
    const puede = await organizadorPuedeAccederCampeonato(req.user, evento.campeonato_id);
    if (!puede) {
      res.status(403).json({ error: "No autorizado para esta categoría" });
      return null;
    }
  }
  return evento;
}

function obtenerMetodoCompetenciaVisibleEvento(evento = {}) {
  if (evento?.clasificacion_tabla_acumulada === true) return "tabla_acumulada";
  return String(evento?.metodo_competencia || "grupos").toLowerCase();
}

const eliminatoriaController = {
  obtenerConfiguracion: async (req, res) => {
    try {
      const evento_id = parseInt(req.params.evento_id, 10);
      if (!Number.isFinite(evento_id)) {
        return res.status(400).json({ error: "evento_id inválido" });
      }
      const evento = await validarAccesoEventoGestion(req, res, evento_id);
      if (!evento) return;
      const config = await Eliminatoria.obtenerConfiguracionPlayoff(evento_id);
      if (config?.evento) {
        config.evento.metodo_competencia = obtenerMetodoCompetenciaVisibleEvento(config.evento);
      }
      res.json({ ok: true, ...config });
    } catch (error) {
      console.error("Error obteniendo configuración playoff:", error);
      res.status(500).json({
        error: error.message || "No se pudo cargar la configuración playoff",
      });
    }
  },

  guardarConfiguracion: async (req, res) => {
    try {
      const evento_id = parseInt(req.params.evento_id, 10);
      if (!Number.isFinite(evento_id)) {
        return res.status(400).json({ error: "evento_id inválido" });
      }
      const evento = await validarAccesoEventoGestion(req, res, evento_id);
      if (!evento) return;
      const payload = { ...(req.body || {}) };
      const metodoVisible = String(payload.metodo_competencia || "").toLowerCase();
      if (metodoVisible === "tabla_acumulada") {
        payload.metodo_competencia = "mixto";
        payload.origen = "grupos";
        payload.metodo_clasificacion = "tabla_unica";
      }

      const config = await Eliminatoria.guardarConfiguracionPlayoff(
        evento_id,
        payload,
        req.user?.id || null
      );
      await pool.query(
        `UPDATE eventos
         SET clasificacion_tabla_acumulada = $2
         WHERE id = $1`,
        [evento_id, metodoVisible === "tabla_acumulada"]
      );
      if (config?.evento) {
        config.evento.clasificacion_tabla_acumulada = metodoVisible === "tabla_acumulada";
        config.evento.metodo_competencia = metodoVisible === "tabla_acumulada" ? "tabla_acumulada" : obtenerMetodoCompetenciaVisibleEvento(config.evento);
      }
      res.json({ ok: true, ...config });
    } catch (error) {
      console.error("Error guardando configuración playoff:", error);
      res.status(500).json({
        error: error.message || "No se pudo guardar la configuración playoff",
      });
    }
  },

  reiniciarConfiguracion: async (req, res) => {
    try {
      const evento_id = parseInt(req.params.evento_id, 10);
      if (!Number.isFinite(evento_id)) {
        return res.status(400).json({ error: "evento_id inválido" });
      }
      const evento = await validarAccesoEventoGestion(req, res, evento_id);
      if (!evento) return;
      const config = await Eliminatoria.reiniciarConfiguracionPlayoff(evento_id);
      res.json({ ok: true, ...config });
    } catch (error) {
      console.error("Error reiniciando configuración playoff:", error);
      res.status(500).json({
        error: error.message || "No se pudo reiniciar la configuración playoff",
      });
    }
  },

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

      const evento = await validarAccesoEventoGestion(req, res, evento_id);
      if (!evento) return;
      const eventoDetalleR = await pool.query(
        `SELECT id, nombre, metodo_competencia, eliminatoria_equipos, clasificacion_tabla_acumulada
         FROM eventos WHERE id = $1 LIMIT 1`,
        [evento_id]
      );
      const eventoDetalle = eventoDetalleR.rows[0];

      const cantidadEquipos = Number.isFinite(payloadCantidad)
        ? payloadCantidad
        : Number.parseInt(eventoDetalle?.eliminatoria_equipos, 10) || null;

      const origen = String(req.body?.origen || "evento").toLowerCase();
      let partidos = [];
      let meta = null;

      if (origen === "grupos") {
        const payload = {
          ...req.body,
          cantidad_equipos: cantidadEquipos,
        };
        if (eventoDetalle?.clasificacion_tabla_acumulada === true) {
          payload.metodo_clasificacion = "tabla_unica";
          payload.origen = "grupos";
        }
        const generado = await Eliminatoria.generarBracketDesdeGrupos(evento_id, {
          ...payload,
        });
        partidos = Array.isArray(generado?.partidos) ? generado.partidos : [];
        meta = generado?.meta || null;
      } else {
        partidos = await Eliminatoria.generarBracket(evento_id, cantidadEquipos);
      }

      res.json({
        mensaje: "Bracket generado",
        evento_id,
        evento_nombre: eventoDetalle?.nombre,
        metodo_competencia: obtenerMetodoCompetenciaVisibleEvento(eventoDetalle),
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

  obtenerResumenClasificacion: async (req, res) => {
    try {
      const evento_id = parseInt(req.params.evento_id, 10);
      if (!Number.isFinite(evento_id)) {
        return res.status(400).json({ error: "evento_id inválido" });
      }
      const evento = await validarAccesoEventoGestion(req, res, evento_id);
      if (!evento) return;

      const clasificadosPorGrupo = Number.parseInt(
        req.query?.clasificados_por_grupo || req.body?.clasificados_por_grupo || "",
        10
      );
      const resumen = await Eliminatoria.obtenerResumenClasificacionManual(
        evento_id,
        Number.isFinite(clasificadosPorGrupo) ? clasificadosPorGrupo : null
      );
      res.json({ ok: true, ...resumen });
    } catch (error) {
      console.error("Error obteniendo resumen de clasificación:", error);
      res.status(500).json({ error: error.message || "No se pudo cargar la clasificación" });
    }
  },

  guardarClasificacionManual: async (req, res) => {
    try {
      const evento_id = parseInt(req.params.evento_id, 10);
      if (!Number.isFinite(evento_id)) {
        return res.status(400).json({ error: "evento_id inválido" });
      }
      const evento = await validarAccesoEventoGestion(req, res, evento_id);
      if (!evento) return;

      const actualizado = await Eliminatoria.guardarClasificadosManuales(
        evento_id,
        req.body || {},
        req.user?.id || null
      );
      res.json({ ok: true, ...actualizado });
    } catch (error) {
      console.error("Error guardando clasificación manual:", error);
      res.status(500).json({
        error: error.message || "No se pudo guardar la clasificación manual",
      });
    }
  },

  programarSlot: async (req, res) => {
    try {
      const slotId = parseInt(req.params.id, 10);
      if (!Number.isFinite(slotId)) {
        return res.status(400).json({ error: "id inválido" });
      }
      const { fecha_partido, hora_partido, cancha } = req.body || {};
      const result = await Eliminatoria.programarSlot(slotId, { fecha_partido, hora_partido, cancha });
      res.json(result);
    } catch (error) {
      console.error("Error programando slot:", error);
      res.status(500).json({ error: error.message || "No se pudo programar el partido" });
    }
  },

  resolverReclasificacion: async (req, res) => {
    try {
      const evento_id = parseInt(req.params.evento_id, 10);
      const reclasificacion_id = parseInt(req.params.reclasificacion_id, 10);
      if (!Number.isFinite(evento_id) || !Number.isFinite(reclasificacion_id)) {
        return res.status(400).json({ error: "Identificadores inválidos" });
      }
      const evento = await validarAccesoEventoGestion(req, res, evento_id);
      if (!evento) return;

      const ganador_id = Number.parseInt(req.body?.ganador_id, 10);
      if (!Number.isFinite(ganador_id)) {
        return res.status(400).json({ error: "Debes seleccionar el ganador de la reclasificación." });
      }

      const actualizado = await Eliminatoria.resolverReclasificacion(
        evento_id,
        reclasificacion_id,
        ganador_id,
        req.body?.detalle || null,
        req.user?.id || null
      );
      res.json({ ok: true, ...actualizado });
    } catch (error) {
      console.error("Error resolviendo reclasificación:", error);
      res.status(500).json({
        error: error.message || "No se pudo resolver la reclasificación",
      });
    }
  },
};

module.exports = eliminatoriaController;
