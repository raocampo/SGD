const Noticia = require("../models/Noticia");

function statusFor(error) {
  const msg = String(error?.message || "");
  if (msg.includes("obligatorios")) return 400;
  if (msg.includes("encontrada")) return 404;
  return 500;
}

const noticiaController = {
  async listar(req, res) {
    try {
      const noticias = await Noticia.listar();
      return res.json({ ok: true, noticias });
    } catch (error) {
      console.error("Error listar noticias:", error);
      return res.status(500).json({ error: "No se pudo listar noticias" });
    }
  },

  async listarPublicas(req, res) {
    try {
      const noticias = await Noticia.listar({ onlyPublished: true });
      return res.json({ ok: true, noticias });
    } catch (error) {
      console.error("Error listar noticias publicas:", error);
      return res.status(500).json({ error: "No se pudo listar noticias publicas" });
    }
  },

  async obtener(req, res) {
    try {
      const noticia = await Noticia.obtenerPorId(req.params.id);
      if (!noticia) return res.status(404).json({ error: "Noticia no encontrada" });
      return res.json({ ok: true, noticia });
    } catch (error) {
      console.error("Error obtener noticia:", error);
      return res.status(500).json({ error: "No se pudo obtener noticia" });
    }
  },

  async obtenerPublicaPorSlug(req, res) {
    try {
      const noticia = await Noticia.obtenerPorSlug(req.params.slug);
      if (!noticia || noticia.estado !== "publicada") {
        return res.status(404).json({ error: "Noticia no encontrada" });
      }
      return res.json({ ok: true, noticia });
    } catch (error) {
      console.error("Error obtener noticia publica:", error);
      return res.status(500).json({ error: "No se pudo obtener noticia publica" });
    }
  },

  async crear(req, res) {
    try {
      const noticia = await Noticia.crear({
        ...req.body,
        autor_usuario_id: req.user?.id || null,
        fuente_sistema: "LOJA_ADMIN_WEB",
      });
      return res.status(201).json({ ok: true, noticia });
    } catch (error) {
      console.error("Error crear noticia:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo crear noticia" });
    }
  },

  async actualizar(req, res) {
    try {
      const noticia = await Noticia.actualizar(req.params.id, req.body || {});
      return res.json({ ok: true, noticia });
    } catch (error) {
      console.error("Error actualizar noticia:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo actualizar noticia" });
    }
  },

  async eliminar(req, res) {
    try {
      const noticia = await Noticia.eliminar(req.params.id);
      if (!noticia) return res.status(404).json({ error: "Noticia no encontrada" });
      return res.json({ ok: true, noticia });
    } catch (error) {
      console.error("Error eliminar noticia:", error);
      return res.status(500).json({ error: "No se pudo eliminar noticia" });
    }
  },

  async publicar(req, res) {
    try {
      const noticia = await Noticia.cambiarEstado(req.params.id, "publicada");
      if (!noticia) return res.status(404).json({ error: "Noticia no encontrada" });
      return res.json({ ok: true, noticia });
    } catch (error) {
      console.error("Error publicar noticia:", error);
      return res.status(500).json({ error: "No se pudo publicar noticia" });
    }
  },

  async despublicar(req, res) {
    try {
      const noticia = await Noticia.cambiarEstado(req.params.id, "borrador");
      if (!noticia) return res.status(404).json({ error: "Noticia no encontrada" });
      return res.json({ ok: true, noticia });
    } catch (error) {
      console.error("Error despublicar noticia:", error);
      return res.status(500).json({ error: "No se pudo despublicar noticia" });
    }
  },
};

module.exports = noticiaController;
