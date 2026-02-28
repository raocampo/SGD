(function () {
  let cache = [];
  let editandoId = null;

  function esc(texto) {
    return String(texto ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function limpiar() {
    editandoId = null;
    document.getElementById("gal-titulo").value = "";
    document.getElementById("gal-imagen").value = "";
    document.getElementById("gal-orden").value = "0";
    document.getElementById("gal-activo").value = "true";
    document.getElementById("gal-descripcion").value = "";
    document.getElementById("galeria-form-title").textContent = "Nuevo item";
    document.getElementById("btn-galeria-cancelar").style.display = "none";
    document.getElementById("btn-galeria-guardar").innerHTML = '<i class="fas fa-save"></i> Guardar item';
  }

  function cargarForm(item) {
    editandoId = Number(item.id);
    document.getElementById("gal-titulo").value = item.titulo || "";
    document.getElementById("gal-imagen").value = item.imagen_url || "";
    document.getElementById("gal-orden").value = String(item.orden || 0);
    document.getElementById("gal-activo").value = String(item.activo === true);
    document.getElementById("gal-descripcion").value = item.descripcion || "";
    document.getElementById("galeria-form-title").textContent = "Editar item";
    document.getElementById("btn-galeria-cancelar").style.display = "inline-flex";
    document.getElementById("btn-galeria-guardar").innerHTML = '<i class="fas fa-save"></i> Guardar cambios';
  }

  function render() {
    const cont = document.getElementById("galeria-listado-wrap");
    if (!cont) return;
    if (!cache.length) {
      cont.innerHTML = "<p>No hay imágenes registradas.</p>";
      return;
    }
    const rows = cache
      .map(
        (item) => `
          <tr>
            <td>${Number(item.id || 0)}</td>
            <td><img src="${esc(item.imagen_url || "")}" alt="${esc(item.titulo || "")}" style="width:80px;height:56px;object-fit:cover;border-radius:8px;" onerror="this.style.display='none'" /></td>
            <td>${esc(item.titulo || "-")}</td>
            <td>${esc(item.descripcion || "-")}</td>
            <td>${Number(item.orden || 0)}</td>
            <td>${item.activo ? '<span class="badge status-finalizado">Activo</span>' : '<span class="badge status-pendiente">Inactivo</span>'}</td>
            <td class="list-table-actions">
              <button class="btn btn-warning" onclick="window.GaleriaAdminUI.editar(${Number(item.id)})"><i class="fas fa-edit"></i> Editar</button>
              <button class="btn btn-danger" onclick="window.GaleriaAdminUI.eliminar(${Number(item.id)})"><i class="fas fa-trash"></i> Eliminar</button>
            </td>
          </tr>
        `
      )
      .join("");
    cont.innerHTML = `
      <div class="list-table-wrap">
        <table class="list-table">
          <thead>
            <tr><th>ID</th><th>Vista</th><th>Título</th><th>Descripción</th><th>Orden</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  async function cargar() {
    const data = await window.GaleriaAPI.listar();
    cache = Array.isArray(data?.items) ? data.items : [];
    render();
  }

  async function guardar(e) {
    e.preventDefault();
    const payload = {
      titulo: String(document.getElementById("gal-titulo").value || "").trim(),
      imagen_url: String(document.getElementById("gal-imagen").value || "").trim(),
      descripcion: String(document.getElementById("gal-descripcion").value || "").trim(),
      orden: Number.parseInt(document.getElementById("gal-orden").value || "0", 10) || 0,
      activo: document.getElementById("gal-activo").value === "true",
    };
    try {
      if (editandoId) {
        await window.GaleriaAPI.actualizar(editandoId, payload);
        mostrarNotificacion("Item actualizado", "success");
      } else {
        await window.GaleriaAPI.crear(payload);
        mostrarNotificacion("Item creado", "success");
      }
      limpiar();
      await cargar();
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo guardar el item", "error");
    }
  }

  function editar(id) {
    const item = cache.find((x) => Number(x.id) === Number(id));
    if (item) cargarForm(item);
  }

  async function eliminar(id) {
    if (!window.confirm("¿Eliminar este item de galería?")) return;
    try {
      await window.GaleriaAPI.eliminar(id);
      if (Number(editandoId) === Number(id)) limpiar();
      await cargar();
      mostrarNotificacion("Item eliminado", "success");
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo eliminar el item", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.location.pathname.endsWith("galeria-admin.html")) return;
    document.getElementById("galeria-form")?.addEventListener("submit", guardar);
    document.getElementById("btn-galeria-cancelar")?.addEventListener("click", limpiar);
    document.getElementById("btn-galeria-recargar")?.addEventListener("click", async () => {
      limpiar();
      await cargar();
    });
    limpiar();
    await cargar();
  });

  window.GaleriaAdminUI = { editar, eliminar };
})();
