const Pase = require("../models/Pase");
const {
  esTecnicoOdirigente,
  obtenerEquiposPermitidosTecnico,
  tecnicoPuedeAccederEquipo,
} = require("../services/roleScope");

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
      const filtros = { ...(req.query || {}) };
      if (esTecnicoOdirigente(req.user?.rol)) {
        const permitidos = await obtenerEquiposPermitidosTecnico(req);
        filtros.equipo_ids_alguno = permitidos || [];
        // No tiene sentido dejar que filtre por un equipo ajeno via query params.
        delete filtros.equipo_origen_id;
        delete filtros.equipo_destino_id;
      }
      const pases = await Pase.listar(filtros);
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
      const filtros = { ...(req.query || {}) };
      if (esTecnicoOdirigente(req.user?.rol)) {
        const permitidos = await obtenerEquiposPermitidosTecnico(req);
        // Este listado solo acepta un equipo_id -- se acota al primero
        // (caso tipico: dirigente/tecnico con un solo equipo).
        filtros.equipo_id = (permitidos && permitidos[0]) || 0;
      }
      const historial = await Pase.listarHistorialJugadores(filtros);
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

      if (esTecnicoOdirigente(req.user?.rol)) {
        const puede = await tecnicoPuedeAccederEquipo(req, resultado.jugador?.equipo_id);
        if (!puede) {
          return res.status(403).json({ error: "No autorizado para consultar este jugador" });
        }
      }

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
      const filtros = { ...(req.query || {}) };
      if (esTecnicoOdirigente(req.user?.rol)) {
        const permitidos = await obtenerEquiposPermitidosTecnico(req);
        filtros.equipo_ids = permitidos || [];
        delete filtros.equipo_id;
      }
      const historial = await Pase.listarHistorialEquipos(filtros);
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

      if (esTecnicoOdirigente(req.user?.rol)) {
        const puede = await tecnicoPuedeAccederEquipo(req, equipoId);
        if (!puede) {
          return res.status(403).json({ error: "No autorizado para consultar este equipo" });
        }
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

      if (esTecnicoOdirigente(req.user?.rol)) {
        const permitidos = await obtenerEquiposPermitidosTecnico(req);
        const set = new Set(permitidos || []);
        if (!set.has(Number(pase.equipo_origen_id)) && !set.has(Number(pase.equipo_destino_id))) {
          return res.status(403).json({ error: "No autorizado para consultar este pase" });
        }
      }

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
