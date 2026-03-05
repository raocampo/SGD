const GaleriaItem = require("../models/GaleriaItem");

function statusFor(error) {
  const msg = String(error?.message || "");
  if (msg.includes("obligatorios") || msg.includes("invalido") || msg.includes("invalida")) return 400;
  if (msg.includes("no encontrado")) return 404;
  return 500;
}

const galeriaController = {
  async listar(req, res) {
    try {
      const items = await GaleriaItem.listar();
      return res.json({ ok: true, items });
    } catch (error) {
      console.error("Error listar galeria:", error);
      return res.status(500).json({ error: "No se pudo listar la galeria" });
    }
  },

  async listarPublica(req, res) {
    try {
      const items = await GaleriaItem.listar({ onlyActive: true });
      return res.json({ ok: true, items });
    } catch (error) {
      console.error("Error listar galeria publica:", error);
      return res.status(500).json({ error: "No se pudo listar la galeria publica" });
    }
  },

  async obtener(req, res) {
    try {
      const item = await GaleriaItem.obtenerPorId(req.params.id);
      if (!item) return res.status(404).json({ error: "Item de galeria no encontrado" });
      return res.json({ ok: true, item });
    } catch (error) {
      console.error("Error obtener galeria:", error);
      return res.status(500).json({ error: "No se pudo obtener el item" });
    }
  },

  async crear(req, res) {
    try {
      const item = await GaleriaItem.crear(req.body || {});
      return res.status(201).json({ ok: true, item });
    } catch (error) {
      console.error("Error crear galeria:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo crear el item" });
    }
  },

  async actualizar(req, res) {
    try {
      const item = await GaleriaItem.actualizar(req.params.id, req.body || {});
      return res.json({ ok: true, item });
    } catch (error) {
      console.error("Error actualizar galeria:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo actualizar el item" });
    }
  },

  async eliminar(req, res) {
    try {
      const item = await GaleriaItem.eliminar(req.params.id);
      if (!item) return res.status(404).json({ error: "Item de galeria no encontrado" });
      return res.json({ ok: true, item });
    } catch (error) {
      console.error("Error eliminar galeria:", error);
      return res.status(500).json({ error: "No se pudo eliminar el item" });
    }
  },
};

module.exports = galeriaController;
