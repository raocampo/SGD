const Finanza = require("../models/Finanza");
const {
  esTecnicoOdirigente,
  obtenerEquiposPermitidosTecnico,
  tecnicoPuedeAccederEquipo,
} = require("../services/roleScope");

function statusParaError(error) {
  const msg = String(error?.message || "").toLowerCase();
  if (
    msg.includes("invalido") ||
    msg.includes("obligatorio") ||
    msg.includes("formato") ||
    msg.includes("debe") ||
    msg.includes("no pertenece") ||
    msg.includes("no encontrado")
  ) {
    return 400;
  }
  if (msg.includes("duplicate key")) return 409;
  return 500;
}

const finanzaController = {
  async crearMovimiento(req, res) {
    try {
      if (esTecnicoOdirigente(req.user?.rol)) {
        return res.status(403).json({ error: "No autorizado para registrar movimientos" });
      }
      const movimiento = await Finanza.crearMovimiento(req.body || {});
      return res.status(201).json({
        ok: true,
        mensaje: "Movimiento financiero creado",
        movimiento,
      });
    } catch (error) {
      console.error("Error creando movimiento financiero:", error);
      return res.status(statusParaError(error)).json({ error: error.message });
    }
  },

  async listarMovimientos(req, res) {
    try {
      const filtros = { ...(req.query || {}) };
      if (esTecnicoOdirigente(req.user?.rol)) {
        const equiposPermitidos = await obtenerEquiposPermitidosTecnico(req);
        if (!equiposPermitidos || !equiposPermitidos.length) {
          return res.json({ ok: true, total: 0, movimientos: [] });
        }

        if (filtros.equipo_id) {
          const autorizado = await tecnicoPuedeAccederEquipo(req, filtros.equipo_id);
          if (!autorizado) {
            return res.status(403).json({ error: "No autorizado para consultar este equipo" });
          }
        } else if (equiposPermitidos.length === 1) {
          filtros.equipo_id = equiposPermitidos[0];
        } else {
          filtros.equipo_ids = equiposPermitidos;
        }
      }

      const movimientos = await Finanza.listarMovimientos(filtros);
      return res.json({
        ok: true,
        total: movimientos.length,
        movimientos,
      });
    } catch (error) {
      console.error("Error listando movimientos financieros:", error);
      return res.status(statusParaError(error)).json({ error: error.message });
    }
  },

  async obtenerEstadoCuentaEquipo(req, res) {
    try {
      const equipo_id = Number.parseInt(req.params.equipo_id, 10);
      if (esTecnicoOdirigente(req.user?.rol)) {
        const autorizado = await tecnicoPuedeAccederEquipo(req, equipo_id);
        if (!autorizado) {
          return res.status(403).json({ error: "No autorizado para consultar este equipo" });
        }
      }
      const estadoCuenta = await Finanza.obtenerEstadoCuentaEquipo(
        equipo_id,
        req.query || {}
      );
      return res.json({
        ok: true,
        ...estadoCuenta,
      });
    } catch (error) {
      console.error("Error obteniendo estado de cuenta:", error);
      return res.status(statusParaError(error)).json({ error: error.message });
    }
  },

  async obtenerMorosidad(req, res) {
    try {
      const filtros = { ...(req.query || {}) };
      if (esTecnicoOdirigente(req.user?.rol)) {
        const equiposPermitidos = await obtenerEquiposPermitidosTecnico(req);
        if (!equiposPermitidos || !equiposPermitidos.length) {
          return res.json({ ok: true, total: 0, equipos: [] });
        }

        if (filtros.equipo_id) {
          const autorizado = await tecnicoPuedeAccederEquipo(req, filtros.equipo_id);
          if (!autorizado) {
            return res.status(403).json({ error: "No autorizado para consultar este equipo" });
          }
        } else if (equiposPermitidos.length === 1) {
          filtros.equipo_id = equiposPermitidos[0];
        } else {
          filtros.equipo_ids = equiposPermitidos;
        }
      }

      const equipos = await Finanza.obtenerMorosidad(filtros);
      return res.json({
        ok: true,
        total: equipos.length,
        equipos,
      });
    } catch (error) {
      console.error("Error obteniendo morosidad:", error);
      return res.status(statusParaError(error)).json({ error: error.message });
    }
  },
};

module.exports = finanzaController;
