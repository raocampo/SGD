(function () {
  let equiposCache = [];
  let usuariosCache = [];

  function esc(texto) {
    return String(texto ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function cargarEquipos() {
    try {
      const data = await ApiClient.get("/equipos");
      equiposCache = data?.equipos || [];
      const sel = document.getElementById("usr-equipo");
      if (!sel) return;
      sel.innerHTML = '<option value="">Sin asignar</option>';
      equiposCache.forEach((e) => {
        sel.innerHTML += `<option value="${Number(e.id)}">${esc(e.nombre || `Equipo ${e.id}`)}</option>`;
      });
    } catch (error) {
      console.error(error);
      mostrarNotificacion("No se pudieron cargar equipos", "warning");
    }
  }

  function renderUsuarios() {
    const cont = document.getElementById("usuarios-tabla-wrap");
    if (!cont) return;

    if (!usuariosCache.length) {
      cont.innerHTML = "<p>No hay usuarios registrados.</p>";
      return;
    }

    const rows = usuariosCache
      .map((u) => {
        const equipoIds = Array.isArray(u.equipo_ids) && u.equipo_ids.length
          ? u.equipo_ids.join(", ")
          : "-";
        return `
          <tr>
            <td>${Number(u.id || 0)}</td>
            <td>${esc(u.nombre || "-")}</td>
            <td>${esc(u.email || "-")}</td>
            <td>${esc((u.rol || "-").toUpperCase())}</td>
            <td>${equipoIds}</td>
            <td>${u.activo ? '<span class="badge status-finalizado">Activo</span>' : '<span class="badge status-pendiente">Inactivo</span>'}</td>
          </tr>
        `;
      })
      .join("");

    cont.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Rol</th>
            <th>Equipos</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  async function cargarUsuarios() {
    const cont = document.getElementById("usuarios-tabla-wrap");
    if (cont) cont.innerHTML = "<p>Cargando usuarios...</p>";
    try {
      const data = await AuthAPI.listarUsuarios();
      usuariosCache = data?.usuarios || [];
      renderUsuarios();
    } catch (error) {
      console.error(error);
      if (cont) cont.innerHTML = `<p>${esc(error.message || "No se pudieron cargar usuarios")}</p>`;
    }
  }

  function limpiarFormulario() {
    document.getElementById("usr-nombre").value = "";
    document.getElementById("usr-email").value = "";
    document.getElementById("usr-password").value = "";
    document.getElementById("usr-rol").value = "administrador";
    document.getElementById("usr-equipo").value = "";
    document.getElementById("usr-activo").value = "true";
  }

  async function crearUsuario(e) {
    e.preventDefault();

    const nombre = String(document.getElementById("usr-nombre")?.value || "").trim();
    const email = String(document.getElementById("usr-email")?.value || "").trim();
    const password = String(document.getElementById("usr-password")?.value || "");
    const rol = String(document.getElementById("usr-rol")?.value || "tecnico").trim();
    const equipo = document.getElementById("usr-equipo")?.value || "";
    const activo = String(document.getElementById("usr-activo")?.value || "true") === "true";

    if (!nombre || !email || !password) {
      mostrarNotificacion("Nombre, correo y contraseña son obligatorios", "warning");
      return;
    }

    const payload = { nombre, email, password, rol, activo };
    if ((rol === "tecnico" || rol === "dirigente") && equipo) {
      payload.equipo_id = Number.parseInt(equipo, 10);
    }

    try {
      await AuthAPI.crearUsuario(payload);
      mostrarNotificacion("Usuario creado", "success");
      limpiarFormulario();
      await cargarUsuarios();
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo crear usuario", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.location.pathname.endsWith("usuarios.html")) return;

    if (!window.Auth?.isAdminLike?.()) {
      mostrarNotificacion("No autorizado", "error");
      window.location.href = window.Auth?.getDefaultPage?.() || "login.html";
      return;
    }

    document.getElementById("usuarios-form")?.addEventListener("submit", crearUsuario);
    document.getElementById("btn-usuarios-recargar")?.addEventListener("click", async () => {
      await Promise.all([cargarEquipos(), cargarUsuarios()]);
      mostrarNotificacion("Datos actualizados", "success");
    });

    await Promise.all([cargarEquipos(), cargarUsuarios()]);
  });
})();
