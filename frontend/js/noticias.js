(function () {
  let noticiasCache = [];
  let noticiaEditandoId = null;

  function esc(texto) {
    return String(texto ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resumenPlano(texto = "", max = 140) {
    const clean = String(texto || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max - 1).trim()}...`;
  }

  function formatearFecha(fecha) {
    if (!fecha) return "—";
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

  function limpiarFormulario() {
    noticiaEditandoId = null;
    document.getElementById("not-titulo").value = "";
    document.getElementById("not-slug").value = "";
    document.getElementById("not-estado").value = "borrador";
    document.getElementById("not-imagen").value = "";
    document.getElementById("not-resumen").value = "";
    document.getElementById("not-contenido").value = "";
    const title = document.getElementById("noticias-form-title");
    const cancelar = document.getElementById("btn-noticias-cancelar");
    const guardar = document.getElementById("btn-noticias-guardar");
    if (title) title.textContent = "Nueva noticia";
    if (cancelar) cancelar.style.display = "none";
    if (guardar) guardar.innerHTML = '<i class="fas fa-save"></i> Guardar noticia';
  }

  function cargarFormulario(item) {
    noticiaEditandoId = Number(item.id);
    document.getElementById("not-titulo").value = item.titulo || "";
    document.getElementById("not-slug").value = item.slug || "";
    document.getElementById("not-estado").value = item.estado || "borrador";
    document.getElementById("not-imagen").value = item.imagen_portada_url || "";
    document.getElementById("not-resumen").value = item.resumen || "";
    document.getElementById("not-contenido").value = item.contenido || "";
    const title = document.getElementById("noticias-form-title");
    const cancelar = document.getElementById("btn-noticias-cancelar");
    const guardar = document.getElementById("btn-noticias-guardar");
    if (title) title.textContent = "Editar noticia";
    if (cancelar) cancelar.style.display = "inline-flex";
    if (guardar) guardar.innerHTML = '<i class="fas fa-save"></i> Guardar cambios';
    document.getElementById("noticias-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderListado() {
    const cont = document.getElementById("noticias-listado-wrap");
    if (!cont) return;
    if (!noticiasCache.length) {
      cont.innerHTML = "<p>No hay noticias registradas.</p>";
      return;
    }

    const rows = noticiasCache
      .map((item) => {
        const badge =
          item.estado === "publicada"
            ? '<span class="badge status-finalizado">Publicada</span>'
            : '<span class="badge status-pendiente">Borrador</span>';
        const accionEstado =
          item.estado === "publicada"
            ? `<button class="btn btn-secondary" onclick="window.NoticiasUI.despublicar(${Number(item.id)})"><i class="fas fa-eye-slash"></i> Despublicar</button>`
            : `<button class="btn btn-success" onclick="window.NoticiasUI.publicar(${Number(item.id)})"><i class="fas fa-upload"></i> Publicar</button>`;
        const publicUrl = item.slug ? `noticia.html?slug=${encodeURIComponent(item.slug)}` : "#";
        return `
          <tr>
            <td>${Number(item.id || 0)}</td>
            <td>
              <strong>${esc(item.titulo || "-")}</strong><br />
              <small style="color:#64748b;">/${esc(item.slug || "-")}</small>
            </td>
            <td>${esc(resumenPlano(item.resumen || item.contenido || ""))}</td>
            <td>${badge}</td>
            <td>${esc(item.autor_nombre || "-")}</td>
            <td>${esc(formatearFecha(item.publicada_at || item.created_at))}</td>
            <td class="list-table-actions">
              <a class="btn btn-primary" href="${publicUrl}" target="_blank" rel="noopener noreferrer">
                <i class="fas fa-up-right-from-square"></i> Ver
              </a>
              <button class="btn btn-warning" onclick="window.NoticiasUI.editar(${Number(item.id)})">
                <i class="fas fa-edit"></i> Editar
              </button>
              ${accionEstado}
              <button class="btn btn-danger" onclick="window.NoticiasUI.eliminar(${Number(item.id)})">
                <i class="fas fa-trash"></i> Eliminar
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    cont.innerHTML = `
      <div class="list-table-wrap">
        <table class="list-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Resumen</th>
              <th>Estado</th>
              <th>Autor</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  async function cargarNoticias() {
    const cont = document.getElementById("noticias-listado-wrap");
    if (cont) cont.innerHTML = "<p>Cargando noticias...</p>";
    try {
      const data = await window.NoticiasAPI.listar();
      noticiasCache = Array.isArray(data?.noticias) ? data.noticias : [];
      renderListado();
    } catch (error) {
      console.error(error);
      if (cont) cont.innerHTML = `<p>${esc(error.message || "No se pudieron cargar noticias")}</p>`;
    }
  }

  async function guardarNoticia(e) {
    e.preventDefault();
    const payload = {
      titulo: String(document.getElementById("not-titulo")?.value || "").trim(),
      slug: String(document.getElementById("not-slug")?.value || "").trim(),
      estado: String(document.getElementById("not-estado")?.value || "borrador").trim(),
      imagen_portada_url: String(document.getElementById("not-imagen")?.value || "").trim() || null,
      resumen: String(document.getElementById("not-resumen")?.value || "").trim() || null,
      contenido: String(document.getElementById("not-contenido")?.value || "").trim(),
    };

    if (!payload.titulo || !payload.contenido) {
      mostrarNotificacion("Título y contenido son obligatorios", "warning");
      return;
    }

    try {
      if (noticiaEditandoId) {
        await window.NoticiasAPI.actualizar(noticiaEditandoId, payload);
        if (payload.estado === "publicada") {
          await window.NoticiasAPI.publicar(noticiaEditandoId);
        } else {
          await window.NoticiasAPI.despublicar(noticiaEditandoId);
        }
        mostrarNotificacion("Noticia actualizada", "success");
      } else {
        const data = await window.NoticiasAPI.crear(payload);
        const creadaId = Number(data?.noticia?.id || 0);
        if (creadaId > 0 && payload.estado === "publicada") {
          await window.NoticiasAPI.publicar(creadaId);
        }
        mostrarNotificacion("Noticia creada", "success");
      }
      limpiarFormulario();
      await cargarNoticias();
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo guardar la noticia", "error");
    }
  }

  async function publicar(id) {
    try {
      await window.NoticiasAPI.publicar(id);
      await cargarNoticias();
      mostrarNotificacion("Noticia publicada", "success");
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo publicar", "error");
    }
  }

  async function despublicar(id) {
    try {
      await window.NoticiasAPI.despublicar(id);
      await cargarNoticias();
      mostrarNotificacion("Noticia despublicada", "success");
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo despublicar", "error");
    }
  }

  async function eliminar(id) {
    if (!window.confirm("¿Eliminar esta noticia?")) return;
    try {
      await window.NoticiasAPI.eliminar(id);
      if (Number(noticiaEditandoId) === Number(id)) limpiarFormulario();
      await cargarNoticias();
      mostrarNotificacion("Noticia eliminada", "success");
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo eliminar", "error");
    }
  }

  function editar(id) {
    const item = noticiasCache.find((n) => Number(n.id) === Number(id));
    if (!item) {
      mostrarNotificacion("No se encontró la noticia", "warning");
      return;
    }
    cargarFormulario(item);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.location.pathname.endsWith("noticias.html")) return;
    document.getElementById("noticias-form")?.addEventListener("submit", guardarNoticia);
    document.getElementById("btn-noticias-cancelar")?.addEventListener("click", limpiarFormulario);
    document.getElementById("btn-noticias-recargar")?.addEventListener("click", async () => {
      limpiarFormulario();
      await cargarNoticias();
    });
    limpiarFormulario();
    await cargarNoticias();
  });

  window.NoticiasUI = {
    editar,
    eliminar,
    publicar,
    despublicar,
  };
})();
