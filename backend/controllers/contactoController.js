const ContactoMensaje = require("../models/ContactoMensaje");

const CONTACTO_RATE_WINDOW_MS = 10 * 60 * 1000;
const CONTACTO_RATE_MAX = 3;
const contactoRateMap = new Map();

function statusFor(error) {
  const msg = String(error?.message || "");
  if (msg.includes("obligatorios") || msg.includes("invalido") || msg.includes("corto")) return 400;
  if (msg.includes("demasiadas solicitudes")) return 429;
  if (msg.includes("no encontrado")) return 404;
  return 500;
}

function getRequestIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (forwarded) return forwarded;
  return String(req.ip || req.connection?.remoteAddress || "unknown").trim();
}

function rateKey(req) {
  const ip = getRequestIp(req);
  const email = String(req.body?.email || "").trim().toLowerCase();
  return `${ip}|${email || "sin-email"}`;
}

function validarRateContacto(req) {
  const key = rateKey(req);
  const now = Date.now();
  const bucket = contactoRateMap.get(key) || [];
  const recientes = bucket.filter((ts) => now - ts < CONTACTO_RATE_WINDOW_MS);
  if (recientes.length >= CONTACTO_RATE_MAX) {
    throw new Error("demasiadas solicitudes de contacto. Intenta nuevamente en unos minutos");
  }
  recientes.push(now);
  contactoRateMap.set(key, recientes);
}

const contactoController = {
  async enviar(req, res) {
    try {
      const honeypot = String(req.body?.website || "").trim();
      if (honeypot) {
        return res.status(201).json({
          ok: true,
          mensaje: "Mensaje enviado correctamente",
        });
      }

      validarRateContacto(req);

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
