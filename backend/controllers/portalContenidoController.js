const PortalContenido = require("../models/PortalContenido");

function statusFor(error) {
  const msg = String(error?.message || "");
  if (msg.includes("obligatorio") || msg.includes("invalido") || msg.includes("invalida")) return 400;
  return 500;
}

const portalContenidoController = {
  async obtener(req, res) {
    try {
      const contenido = await PortalContenido.obtener();
      return res.json({ ok: true, contenido });
    } catch (error) {
      console.error("Error obtener contenido portal:", error);
      return res.status(500).json({ error: "No se pudo cargar el contenido del portal" });
    }
  },

  async actualizar(req, res) {
    try {
      const contenido = await PortalContenido.actualizar(req.body || {});
      return res.json({ ok: true, contenido });
    } catch (error) {
      console.error("Error actualizar contenido portal:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo actualizar el contenido del portal" });
    }
  },
};

module.exports = portalContenidoController;
