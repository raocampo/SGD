const ContactoMensaje = require("../models/ContactoMensaje");

function statusFor(error) {
  const msg = String(error?.message || "");
  if (msg.includes("obligatorios") || msg.includes("invalido")) return 400;
  if (msg.includes("no encontrado")) return 404;
  return 500;
}

const contactoController = {
  async enviar(req, res) {
    try {
      const mensaje = await ContactoMensaje.crear({
        ...(req.body || {}),
        origen: "portal_publico",
      });
      return res.status(201).json({
        ok: true,
        mensaje: "Mensaje enviado correctamente",
        contacto: mensaje,
      });
    } catch (error) {
      console.error("Error enviar contacto:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo enviar el mensaje" });
    }
  },

  async listar(req, res) {
    try {
      const mensajes = await ContactoMensaje.listar(req.query || {});
      return res.json({ ok: true, mensajes });
    } catch (error) {
      console.error("Error listar contactos:", error);
      return res.status(500).json({ error: "No se pudieron listar los mensajes" });
    }
  },

  async obtener(req, res) {
    try {
      const mensaje = await ContactoMensaje.obtenerPorId(req.params.id);
      if (!mensaje) return res.status(404).json({ error: "Mensaje no encontrado" });
      return res.json({ ok: true, mensaje });
    } catch (error) {
      console.error("Error obtener contacto:", error);
      return res.status(500).json({ error: "No se pudo obtener el mensaje" });
    }
  },

  async actualizarEstado(req, res) {
    try {
      const mensaje = await ContactoMensaje.actualizarEstado(req.params.id, req.body?.estado);
      if (!mensaje) return res.status(404).json({ error: "Mensaje no encontrado" });
      return res.json({ ok: true, mensaje });
    } catch (error) {
      console.error("Error actualizar estado contacto:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo actualizar el mensaje" });
    }
  },
};

module.exports = contactoController;
