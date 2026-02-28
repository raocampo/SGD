(function () {
  let cache = [];

  function esc(texto) {
    return String(texto ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function render() {
    const cont = document.getElementById("contacto-listado-wrap");
    if (!cont) return;
    if (!cache.length) {
      cont.innerHTML = "<p>No hay mensajes registrados.</p>";
      return;
    }
    const rows = cache
      .map(
        (item) => `
          <tr>
            <td>${Number(item.id || 0)}</td>
            <td>${esc(item.nombre || "-")}</td>
            <td>${esc(item.email || "-")}<br /><small>${esc(item.telefono || "")}</small></td>
            <td>${esc(item.mensaje || "-")}</td>
            <td>${esc(formatearFecha(item.created_at))}</td>
            <td>
              <select onchange="window.ContactoAdminUI.cambiarEstado(${Number(item.id)}, this.value)">
                <option value="nuevo" ${item.estado === "nuevo" ? "selected" : ""}>Nuevo</option>
                <option value="leido" ${item.estado === "leido" ? "selected" : ""}>Leído</option>
                <option value="respondido" ${item.estado === "respondido" ? "selected" : ""}>Respondido</option>
                <option value="archivado" ${item.estado === "archivado" ? "selected" : ""}>Archivado</option>
              </select>
            </td>
          </tr>
        `
      )
      .join("");
    cont.innerHTML = `
      <div class="list-table-wrap">
        <table class="list-table">
          <thead>
            <tr><th>ID</th><th>Nombre</th><th>Contacto</th><th>Mensaje</th><th>Fecha</th><th>Estado</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  async function cargar() {
    const estado = String(document.getElementById("contacto-filtro-estado")?.value || "").trim();
    const data = await window.ContactoAPI.listar({ estado });
    cache = Array.isArray(data?.mensajes) ? data.mensajes : [];
    render();
  }

  async function cambiarEstado(id, estado) {
    try {
      await window.ContactoAPI.actualizarEstado(id, estado);
      await cargar();
      mostrarNotificacion("Estado actualizado", "success");
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo actualizar el estado", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.location.pathname.endsWith("contacto-admin.html")) return;
    document.getElementById("btn-contacto-filtrar")?.addEventListener("click", cargar);
    document.getElementById("btn-contacto-recargar")?.addEventListener("click", cargar);
    await cargar();
  });

  window.ContactoAdminUI = { cambiarEstado };
})();
