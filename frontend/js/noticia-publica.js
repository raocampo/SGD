(function () {
  function esc(texto) {
    return String(texto ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatearFecha(fecha) {
    if (!fecha) return "Por definir";
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return String(fecha);
    return d.toLocaleString("es-EC", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getSlug() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get("slug") || "").trim();
  }

  function renderNoticia(item) {
    const titulo = esc(item.titulo || "Noticia LT&C");
    const resumen = item.resumen ? `<p style="color:#64748b; margin-top:12px;">${esc(item.resumen)}</p>` : "";
    const img = String(item.imagen_portada_url || "assets/ltc/bannerLTC.jpg").trim();
    const contenido = String(item.contenido || "")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br />");
    return `
      <div style="display:grid; gap:1rem;">
        <div>
          <h2 style="margin:0; color:#2c3e50;">${titulo}</h2>
          ${resumen}
          <p style="margin-top:10px; color:#64748b;">
            ${esc(formatearFecha(item.publicada_at || item.created_at))} • ${esc(item.autor_nombre || "LT&C")}
          </p>
        </div>
        <div>
          <img src="${img}" alt="${titulo}" style="width:100%; max-height:420px; object-fit:cover; border-radius:12px;" onerror="this.src='assets/ltc/bannerLTC.jpg'" />
        </div>
        <div style="font-size:1rem; line-height:1.8; color:#334155;">${contenido}</div>
      </div>
    `;
  }

  async function cargarNoticia() {
    const cont = document.getElementById("noticia-detalle");
    if (!cont) return;
    const slug = getSlug();
    if (!slug) {
      cont.innerHTML = "<p>Slug de noticia no proporcionado.</p>";
      return;
    }
    try {
      const data = await window.NoticiasAPI.obtenerPublica(slug);
      const item = data?.noticia || null;
      if (!item) {
        cont.innerHTML = "<p>Noticia no encontrada.</p>";
        return;
      }
      document.title = `LT&C | ${item.titulo || "Noticia"}`;
      cont.innerHTML = renderNoticia(item);
    } catch (error) {
      console.error(error);
      cont.innerHTML = `<p>${esc(error.message || "No se pudo cargar la noticia")}</p>`;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.location.pathname.endsWith("noticia.html")) return;
    cargarNoticia();
  });
})();
