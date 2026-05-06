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
  // ─── EQUIPOS Y JUGADORES PÚBLICOS ──────────────────────────────────────────

  async listarEquiposPorEvento(req, res) {
    try {
      const eventoId = Number.parseInt(req.params.evento_id, 10);
      if (!Number.isFinite(eventoId)) return res.status(400).json({ error: "evento_id invalido" });
      const payload = await publicPortalService.listarEquiposPublicosPorEvento(eventoId);
      if (!payload) return res.status(404).json({ error: "Evento no encontrado" });
      return res.json({ ok: true, ...payload });
    } catch (error) {
      console.error("Error listando equipos públicos:", error);
      return res.status(500).json({ error: error.message });
    }
  },

  async obtenerEquipo(req, res) {
    try {
      const equipoId = Number.parseInt(req.params.equipo_id, 10);
      if (!Number.isFinite(equipoId)) return res.status(400).json({ error: "equipo_id invalido" });
      const payload = await publicPortalService.obtenerEquipoPublico(equipoId);
      if (!payload) return res.status(404).json({ error: "Equipo no encontrado" });
      return res.json({ ok: true, equipo: payload });
    } catch (error) {
      console.error("Error obteniendo equipo público:", error);
      return res.status(500).json({ error: error.message });
    }
  },

  async listarJugadoresPorEquipo(req, res) {
    try {
      const equipoId = Number.parseInt(req.params.equipo_id, 10);
      if (!Number.isFinite(equipoId)) return res.status(400).json({ error: "equipo_id invalido" });
      const eventoId = req.query.evento_id ? Number.parseInt(req.query.evento_id, 10) : null;
      const payload = await publicPortalService.listarJugadoresPublicosPorEquipo(equipoId, eventoId || null);
      if (!payload) return res.status(404).json({ error: "Equipo no encontrado" });
      return res.json({ ok: true, ...payload });
    } catch (error) {
      console.error("Error listando jugadores públicos:", error);
      return res.status(500).json({ error: error.message });
    }
  },

  async listarPartidosPorEquipo(req, res) {
    try {
      const equipoId = Number.parseInt(req.params.equipo_id, 10);
      if (!Number.isFinite(equipoId)) return res.status(400).json({ error: "equipo_id invalido" });
      const eventoId = req.query.evento_id ? Number.parseInt(req.query.evento_id, 10) : null;
      const payload = await publicPortalService.listarPartidosPublicosPorEquipo(equipoId, eventoId || null);
      if (!payload) return res.status(404).json({ error: "Equipo no encontrado" });
      return res.json({ ok: true, ...payload });
    } catch (error) {
      console.error("Error listando partidos del equipo:", error);
      return res.status(500).json({ error: error.message });
    }
  },

  async obtenerJugador(req, res) {
    try {
      const jugadorId = Number.parseInt(req.params.jugador_id, 10);
      if (!Number.isFinite(jugadorId)) return res.status(400).json({ error: "jugador_id invalido" });
      const payload = await publicPortalService.obtenerJugadorPublico(jugadorId);
      if (!payload) return res.status(404).json({ error: "Jugador no encontrado" });
      return res.json({ ok: true, jugador: payload });
    } catch (error) {
      console.error("Error obteniendo jugador público:", error);
      return res.status(500).json({ error: error.message });
    }
  },

  async listarParticipacionesJugador(req, res) {
    try {
      const jugadorId = Number.parseInt(req.params.jugador_id, 10);
      if (!Number.isFinite(jugadorId)) return res.status(400).json({ error: "jugador_id invalido" });
      const payload = await publicPortalService.listarParticipacionesPublicasJugador(jugadorId);
      if (!payload) return res.status(404).json({ error: "Jugador no encontrado" });
      return res.json({ ok: true, ...payload });
    } catch (error) {
      console.error("Error listando participaciones del jugador:", error);
      return res.status(500).json({ error: error.message });
    }
  },
};

module.exports = publicPortalController;
