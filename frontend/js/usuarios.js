(function () {
  let equiposCache = [];
  let usuariosCache = [];
  let usuarioEditandoId = null;

  function esc(texto) {
    return String(texto ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function rolActual() {
    return String(window.Auth?.getUser?.()?.rol || "").toLowerCase();
  }

  function esAdminActual() {
    return rolActual() === "administrador";
  }

  function esOrganizadorActual() {
    return rolActual() === "organizador";
  }

  function esRolConEquipo(rol) {
    const r = String(rol || "").toLowerCase();
    return r === "tecnico" || r === "dirigente";
  }

  function usuarioActualId() {
    return Number(window.Auth?.getUser?.()?.id || 0);
  }

  function configurarUIporRol() {
    const rolSelect = document.getElementById("usr-rol");
    const descripcion = document.getElementById("usuarios-desc-rol");
    const btnCancelar = document.getElementById("btn-usuarios-cancelar");
    if (!rolSelect) return;

    if (esOrganizadorActual()) {
      rolSelect.innerHTML = '<option value="dirigente">Dirigente</option>';
      rolSelect.value = "dirigente";
      rolSelect.disabled = true;
      if (btnCancelar) btnCancelar.style.display = "none";
      if (descripcion) {
        descripcion.textContent =
          "Como organizador puedes crear y eliminar usuarios dirigentes de tus campeonatos. No puedes editar usuarios.";
      }
      return;
    }

    rolSelect.disabled = false;
    rolSelect.innerHTML = `
      <option value="administrador">Administrador</option>
      <option value="organizador">Organizador</option>
      <option value="tecnico">Técnico</option>
      <option value="dirigente">Dirigente</option>
    `;
    if (descripcion) {
      descripcion.textContent =
        "Como administrador puedes visualizar, crear, editar y eliminar usuarios.";
    }
  }

  function actualizarTituloFormulario() {
    const title = document.getElementById("usuarios-form-title");
    const btnGuardar = document.getElementById("btn-usuarios-guardar");
    const btnCancelar = document.getElementById("btn-usuarios-cancelar");
    const passInput = document.getElementById("usr-password");
    const organizador = esOrganizadorActual();

    if (!organizador && usuarioEditandoId) {
      if (title) title.textContent = "Editar usuario";
      if (btnGuardar) btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar cambios';
      if (btnCancelar) btnCancelar.style.display = "";
      if (passInput) passInput.required = false;
      return;
    }

    if (title) {
      title.textContent = organizador ? "Nuevo dirigente" : "Nuevo usuario";
    }
    if (btnGuardar) {
      btnGuardar.innerHTML = organizador
        ? '<i class="fas fa-plus"></i> Crear dirigente'
        : '<i class="fas fa-plus"></i> Crear usuario';
    }
    if (btnCancelar) btnCancelar.style.display = "none";
    if (passInput) passInput.required = true;
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

    const meId = usuarioActualId();
    const rows = usuariosCache
      .map((u) => {
        const equipoIds = Array.isArray(u.equipo_ids) && u.equipo_ids.length
          ? u.equipo_ids.join(", ")
          : "-";
        const disabledDelete = Number(u.id) === meId;
        const showEdit = esAdminActual();
        return `
          <tr>
            <td>${Number(u.id || 0)}</td>
            <td>${esc(u.nombre || "-")}</td>
            <td>${esc(u.email || "-")}</td>
            <td>${esc((u.rol || "-").toUpperCase())}</td>
            <td>${equipoIds}</td>
            <td>${u.activo ? '<span class="badge status-finalizado">Activo</span>' : '<span class="badge status-pendiente">Inactivo</span>'}</td>
            <td>
              ${
                showEdit
                  ? `<button class="btn btn-warning" onclick="window.UsuariosUI.editar(${Number(u.id)})">
                  <i class="fas fa-edit"></i> Editar
                </button>`
                  : ""
              }
              <button class="btn btn-danger" ${disabledDelete ? "disabled" : ""} onclick="window.UsuariosUI.eliminar(${Number(u.id)})">
                <i class="fas fa-trash"></i> Eliminar
              </button>
            </td>
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
            <th>Acciones</th>
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
    usuarioEditandoId = null;
    document.getElementById("usr-nombre").value = "";
    document.getElementById("usr-email").value = "";
    document.getElementById("usr-password").value = "";
    document.getElementById("usr-equipo").value = "";
    document.getElementById("usr-activo").value = "true";

    const selRol = document.getElementById("usr-rol");
    if (selRol) {
      selRol.value = esOrganizadorActual() ? "dirigente" : "administrador";
    }
    actualizarTituloFormulario();
  }

  function cargarFormularioDesdeUsuario(u) {
    if (!esAdminActual()) return;
    usuarioEditandoId = Number(u.id);
    document.getElementById("usr-nombre").value = u.nombre || "";
    document.getElementById("usr-email").value = u.email || "";
    document.getElementById("usr-password").value = "";
    document.getElementById("usr-rol").value = u.rol || "tecnico";
    document.getElementById("usr-activo").value = String(u.activo === true);

    const equipo = Array.isArray(u.equipo_ids) && u.equipo_ids.length ? Number(u.equipo_ids[0]) : "";
    document.getElementById("usr-equipo").value = equipo ? String(equipo) : "";
    actualizarTituloFormulario();
  }

  async function sincronizarEquipoTecnico(usuarioAntes, rolDestino, equipoDestino) {
    const esDestinoConEquipo = esRolConEquipo(rolDestino);
    const anteriores = Array.isArray(usuarioAntes?.equipo_ids) ? usuarioAntes.equipo_ids : [];

    for (const eq of anteriores) {
      await AuthAPI.quitarEquipo(usuarioAntes.id, eq);
    }

    if (esDestinoConEquipo && equipoDestino) {
      await AuthAPI.asignarEquipo(usuarioAntes.id, Number.parseInt(equipoDestino, 10));
    }
  }

  async function guardarUsuario(e) {
    e.preventDefault();

    if (esOrganizadorActual() && usuarioEditandoId) {
      mostrarNotificacion("El organizador no puede editar usuarios", "warning");
      return;
    }

    const nombre = String(document.getElementById("usr-nombre")?.value || "").trim();
    const email = String(document.getElementById("usr-email")?.value || "").trim();
    const password = String(document.getElementById("usr-password")?.value || "");
    const rolCampo = String(document.getElementById("usr-rol")?.value || "tecnico").trim();
    const rol = esOrganizadorActual() ? "dirigente" : rolCampo;
    const equipo = document.getElementById("usr-equipo")?.value || "";
    const activo = String(document.getElementById("usr-activo")?.value || "true") === "true";

    if (!nombre || !email) {
      mostrarNotificacion("Nombre y correo son obligatorios", "warning");
      return;
    }
    if (!usuarioEditandoId && !password) {
      mostrarNotificacion("La contraseña es obligatoria para crear usuario", "warning");
      return;
    }
    if (password && password.length < 6) {
      mostrarNotificacion("La contraseña debe tener al menos 6 caracteres", "warning");
      return;
    }
    if (esOrganizadorActual() && !equipo) {
      mostrarNotificacion("Debes seleccionar un equipo para el dirigente", "warning");
      return;
    }

    try {
      if (!usuarioEditandoId) {
        const payload = { nombre, email, password, rol, activo };
        if (esRolConEquipo(rol) && equipo) payload.equipo_id = Number.parseInt(equipo, 10);
        await AuthAPI.crearUsuario(payload);
        mostrarNotificacion("Usuario creado", "success");
      } else {
        const antes = usuariosCache.find((u) => Number(u.id) === Number(usuarioEditandoId));
        const payload = { nombre, email, rol, activo };
        if (password) payload.password = password;
        await AuthAPI.actualizarUsuario(usuarioEditandoId, payload);
        if (antes) await sincronizarEquipoTecnico(antes, rol, equipo);
        mostrarNotificacion("Usuario actualizado", "success");
      }

      limpiarFormulario();
      await cargarUsuarios();
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo guardar usuario", "error");
    }
  }

  async function editarUsuario(id) {
    if (!esAdminActual()) {
      mostrarNotificacion("Solo administrador puede editar usuarios", "warning");
      return;
    }
    const user = usuariosCache.find((u) => Number(u.id) === Number(id));
    if (!user) {
      mostrarNotificacion("Usuario no encontrado", "warning");
      return;
    }
    cargarFormularioDesdeUsuario(user);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminarUsuario(id) {
    if (Number(id) === usuarioActualId()) {
      mostrarNotificacion("No puedes eliminar tu propio usuario", "warning");
      return;
    }
    const ok = window.confirm("¿Deseas eliminar este usuario?");
    if (!ok) return;
    try {
      await AuthAPI.eliminarUsuario(id);
      if (Number(usuarioEditandoId) === Number(id)) limpiarFormulario();
      mostrarNotificacion("Usuario eliminado", "success");
      await cargarUsuarios();
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo eliminar usuario", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.location.pathname.endsWith("usuarios.html")) return;

    if (!window.Auth?.isAdminLike?.()) {
      mostrarNotificacion("No autorizado", "error");
      window.location.href = window.Auth?.getDefaultPage?.() || "login.html";
      return;
    }

    configurarUIporRol();
    actualizarTituloFormulario();

    document.getElementById("usuarios-form")?.addEventListener("submit", guardarUsuario);
    document.getElementById("btn-usuarios-cancelar")?.addEventListener("click", limpiarFormulario);
    document.getElementById("btn-usuarios-recargar")?.addEventListener("click", async () => {
      await Promise.all([cargarEquipos(), cargarUsuarios()]);
      mostrarNotificacion("Datos actualizados", "success");
    });

    await Promise.all([cargarEquipos(), cargarUsuarios()]);
  });

  window.UsuariosUI = {
    editar: editarUsuario,
    eliminar: eliminarUsuario,
  };
})();

