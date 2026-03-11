const publicPortalService = require("../services/publicPortalService");

const publicPortalController = {
  async listarCampeonatos(req, res) {
    try {
      const campeonatos = await publicPortalService.listarCampeonatosPublicos();
      return res.json({
        ok: true,
        total: campeonatos.length,
        campeonatos,
      });
    } catch (error) {
      console.error("Error listando campeonatos publicos:", error);
      return res.status(500).json({
        error: "Error listando campeonatos publicos",
        detalle: error.message,
      });
    }
  },

  async obtenerCampeonato(req, res) {
    try {
      const campeonatoId = Number.parseInt(req.params.campeonato_id, 10);
      if (!Number.isFinite(campeonatoId)) {
        return res.status(400).json({ error: "campeonato_id invalido" });
      }

      const campeonato = await publicPortalService.obtenerCampeonatoPublico(campeonatoId);
      if (!campeonato) {
        return res.status(404).json({ error: "Campeonato publico no encontrado" });
      }

      return res.json({ ok: true, campeonato });
    } catch (error) {
      console.error("Error obteniendo campeonato publico:", error);
      return res.status(500).json({
        error: "Error obteniendo campeonato publico",
        detalle: error.message,
      });
    }
  },

  async listarEventosPorCampeonato(req, res) {
    try {
      const campeonatoId = Number.parseInt(req.params.campeonato_id, 10);
      if (!Number.isFinite(campeonatoId)) {
        return res.status(400).json({ error: "campeonato_id invalido" });
      }

      const payload = await publicPortalService.listarEventosPublicosPorCampeonato(campeonatoId);
      if (!payload) {
        return res.status(404).json({ error: "Campeonato publico no encontrado" });
      }

      return res.json({
        ok: true,
        campeonato: payload.campeonato,
        total: payload.eventos.length,
        eventos: payload.eventos,
      });
    } catch (error) {
      console.error("Error listando eventos publicos:", error);
      return res.status(500).json({
        error: "Error listando eventos publicos",
        detalle: error.message,
      });
    }
  },

  async listarAuspiciantesPorCampeonato(req, res) {
    try {
      const campeonatoId = Number.parseInt(req.params.campeonato_id, 10);
      if (!Number.isFinite(campeonatoId)) {
        return res.status(400).json({ error: "campeonato_id invalido" });
      }

      const payload = await publicPortalService.listarAuspiciantesPublicosPorCampeonato(campeonatoId);
      if (!payload) {
        return res.status(404).json({ error: "Campeonato publico no encontrado" });
      }

      return res.json(payload);
    } catch (error) {
      console.error("Error listando auspiciantes publicos:", error);
      return res.status(500).json({
        error: "Error listando auspiciantes publicos",
        detalle: error.message,
      });
    }
  },

  async listarMediaPorCampeonato(req, res) {
    try {
      const campeonatoId = Number.parseInt(req.params.campeonato_id, 10);
      if (!Number.isFinite(campeonatoId)) {
        return res.status(400).json({ error: "campeonato_id invalido" });
      }

      const payload = await publicPortalService.listarMediaPublicaPorCampeonato(campeonatoId);
      if (!payload) {
        return res.status(404).json({ error: "Campeonato publico no encontrado" });
      }

      return res.json(payload);
    } catch (error) {
      console.error("Error listando media publica por campeonato:", error);
      return res.status(500).json({
        error: "Error listando media publica por campeonato",
        detalle: error.message,
      });
    }
  },

  async obtenerPartidosPorEvento(req, res) {
    try {
      const eventoId = Number.parseInt(req.params.evento_id, 10);
      if (!Number.isFinite(eventoId)) {
        return res.status(400).json({ error: "evento_id invalido" });
      }

      const payload = await publicPortalService.obtenerPartidosPublicosPorEvento(eventoId);
      if (!payload) {
        return res.status(404).json({ error: "Evento publico no encontrado" });
      }

      return res.json({ ok: true, ...payload });
    } catch (error) {
      console.error("Error obteniendo partidos publicos:", error);
      return res.status(500).json({
        error: "Error obteniendo partidos publicos",
        detalle: error.message,
      });
    }
  },

  async obtenerTablasPorEvento(req, res) {
    try {
      const eventoId = Number.parseInt(req.params.evento_id, 10);
      if (!Number.isFinite(eventoId)) {
        return res.status(400).json({ error: "evento_id invalido" });
      }

      const payload = await publicPortalService.obtenerTablasPublicasPorEvento(eventoId);
      if (!payload) {
        return res.status(404).json({ error: "Evento publico no encontrado" });
      }

      return res.json(payload);
    } catch (error) {
      console.error("Error obteniendo tablas publicas:", error);
      return res.status(500).json({
        error: "Error obteniendo tablas publicas",
        detalle: error.message,
      });
    }
  },

  async obtenerEliminatoriasPorEvento(req, res) {
    try {
      const eventoId = Number.parseInt(req.params.evento_id, 10);
      if (!Number.isFinite(eventoId)) {
        return res.status(400).json({ error: "evento_id invalido" });
      }

      const payload = await publicPortalService.obtenerEliminatoriasPublicasPorEvento(eventoId);
      if (!payload) {
        return res.status(404).json({ error: "Evento publico no encontrado" });
      }

      return res.json(payload);
    } catch (error) {
      console.error("Error obteniendo eliminatorias publicas:", error);
      return res.status(500).json({
        error: "Error obteniendo eliminatorias publicas",
        detalle: error.message,
      });
    }
  },

  async obtenerGoleadoresPorEvento(req, res) {
    try {
      const eventoId = Number.parseInt(req.params.evento_id, 10);
      if (!Number.isFinite(eventoId)) {
        return res.status(400).json({ error: "evento_id invalido" });
      }

      const payload = await publicPortalService.obtenerGoleadoresPublicosPorEvento(eventoId);
      if (!payload) {
        return res.status(404).json({ error: "Evento publico no encontrado" });
      }

      return res.json(payload);
    } catch (error) {
      console.error("Error obteniendo goleadores publicos:", error);
      return res.status(500).json({
        error: "Error obteniendo goleadores publicos",
        detalle: error.message,
      });
    }
  },

  async obtenerTarjetasPorEvento(req, res) {
    try {
      const eventoId = Number.parseInt(req.params.evento_id, 10);
      if (!Number.isFinite(eventoId)) {
        return res.status(400).json({ error: "evento_id invalido" });
      }

      const payload = await publicPortalService.obtenerTarjetasPublicasPorEvento(eventoId);
      if (!payload) {
        return res.status(404).json({ error: "Evento publico no encontrado" });
      }

      return res.json(payload);
    } catch (error) {
      console.error("Error obteniendo tarjetas publicas:", error);
      return res.status(500).json({
        error: "Error obteniendo tarjetas publicas",
        detalle: error.message,
      });
    }
  },

  async obtenerFairPlayPorEvento(req, res) {
    try {
      const eventoId = Number.parseInt(req.params.evento_id, 10);
      if (!Number.isFinite(eventoId)) {
        return res.status(400).json({ error: "evento_id invalido" });
      }

      const payload = await publicPortalService.obtenerFairPlayPublicoPorEvento(
        eventoId,
        req.query || {}
      );
      if (!payload) {
        return res.status(404).json({ error: "Evento publico no encontrado" });
      }

      return res.json(payload);
    } catch (error) {
      console.error("Error obteniendo fair play publico:", error);
      return res.status(500).json({
        error: "Error obteniendo fair play publico",
        detalle: error.message,
      });
    }
  },
};

module.exports = publicPortalController;
