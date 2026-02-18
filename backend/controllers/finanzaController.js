const Finanza = require("../models/Finanza");

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
      const movimientos = await Finanza.listarMovimientos(req.query || {});
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
      const equipos = await Finanza.obtenerMorosidad(req.query || {});
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
