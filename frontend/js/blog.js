(function () {
  function esc(texto) {
    return String(texto ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resumenPlano(texto = "", max = 180) {
    const clean = String(texto || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max - 1).trim()}...`;
  }

  function formatearFecha(fecha) {
    if (!fecha) return "Por definir";
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return String(fecha);
    return d.toLocaleDateString("es-EC", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  function renderCard(item) {
    const titulo = esc(item.titulo || "Noticia LT&C");
    const resumen = esc(resumenPlano(item.resumen || item.contenido || ""));
    const fecha = esc(formatearFecha(item.publicada_at || item.created_at));
    const autor = esc(item.autor_nombre || "LT&C");
    const img = String(item.imagen_portada_url || "assets/ltc/bannerLTC.jpg").trim();
    const link = `noticia.html?slug=${encodeURIComponent(item.slug || "")}`;

    return `
      <article class="portal-campeonato-card portal-card-upcoming">
        <div class="portal-card-media">
          <img src="${img}" alt="${titulo}" onerror="this.src='assets/ltc/bannerLTC.jpg'" />
        </div>
        <div class="portal-card-body">
          <span class="badge-estado estado-en_curso">Publicada</span>
          <h3>${titulo}</h3>
          <p class="portal-card-date">${fecha} • ${autor}</p>
          <p>${resumen}</p>
          <a class="portal-card-btn" href="${link}">Leer noticia</a>
        </div>
      </article>
    `;
  }

  async function cargarBlog() {
    const cont = document.getElementById("blog-listado");
    if (!cont) return;
    try {
      const data = await window.NoticiasAPI.listarPublicas();
      const items = Array.isArray(data?.noticias) ? data.noticias : [];
      if (!items.length) {
        cont.innerHTML = '<p class="empty-msg">No hay noticias publicadas.</p>';
        return;
      }
      cont.innerHTML = items.map(renderCard).join("");
    } catch (error) {
      console.error(error);
      cont.innerHTML = `<p class="empty-msg">${esc(error.message || "No se pudo cargar el blog")}</p>`;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.location.pathname.endsWith("blog.html")) return;
    cargarBlog();
  });
})();
