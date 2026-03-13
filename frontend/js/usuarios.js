(function () {
  let equiposCache = [];
  let usuariosCache = [];
  let usuarioEditandoId = null;
  const organizadorPortalCache = new Map();
  const PLANES_PAGADOS = new Set(["base", "competencia", "premium"]);

  function esc(texto) {
    return String(texto ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizarUsername(username) {
    return String(username || "").trim().toLowerCase();
  }

  function validarEmailOpcional(email) {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
  }

  function validarUsernameOpcional(username) {
    if (!username) return true;
    return /^[a-z0-9._-]{3,40}$/i.test(String(username));
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
    return r === "tecnico" || r === "dirigente" || r === "jugador";
  }

  function usuarioActualId() {
    return Number(window.Auth?.getUser?.()?.id || 0);
  }

  function esPlanPagado(plan) {
    return PLANES_PAGADOS.has(String(plan || "").trim().toLowerCase());
  }

  function obtenerLandingUrl(usuarioId) {
    const base = new URL("index.html", window.location.href);
    base.searchParams.set("organizador", String(usuarioId));
    return base.toString();
  }

  function backendBase() {
    return window.resolveBackendBaseUrl ? window.resolveBackendBaseUrl() : window.location.origin;
  }

  function normalizarMedia(url) {
    const value = String(url || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/")) return `${backendBase()}${value}`;
    if (value.startsWith("uploads/")) return `${backendBase()}/${value}`;
    return `${backendBase()}/${value}`;
  }

  function formatearPlan(plan) {
    const code = String(plan || "").trim().toLowerCase();
    if (!code) return "—";
    return code.charAt(0).toUpperCase() + code.slice(1);
  }

  function idsCamposOrganizador() {
    return [
      "usr-organizacion-group",
      "usr-lema-group",
      "usr-contact-email-group",
      "usr-contact-phone-group",
      "usr-organizacion-logo-group",
    ];
  }

  function renderLogoOrganizacion(url) {
    const wrap = document.getElementById("usr-organizacion-logo-preview-wrap");
    const img = document.getElementById("usr-organizacion-logo-preview");
    const link = document.getElementById("usr-organizacion-logo-link");
    const src = normalizarMedia(url);
    if (!wrap || !img || !link) return;

    if (!src) {
      wrap.style.display = "none";
      img.removeAttribute("src");
      link.href = "#";
      return;
    }

    wrap.style.display = "flex";
    img.src = src;
    link.href = src;
  }

  function limpiarPerfilOrganizador() {
    const lema = document.getElementById("usr-lema");
    const contactEmail = document.getElementById("usr-contact-email");
    const contactPhone = document.getElementById("usr-contact-phone");
    const logoInput = document.getElementById("usr-organizacion-logo");
    if (lema) lema.value = "";
    if (contactEmail) contactEmail.value = "";
    if (contactPhone) contactPhone.value = "";
    if (logoInput) logoInput.value = "";
    renderLogoOrganizacion("");
  }

  async function obtenerContextoOrganizador(usuarioId, force = false) {
    const id = Number.parseInt(usuarioId, 10);
    if (!Number.isFinite(id) || id <= 0) return null;
    if (!force && organizadorPortalCache.has(id)) return organizadorPortalCache.get(id);
    const contexto = await window.OrganizadorPortalAPI.obtenerContexto({ organizador_id: id });
    organizadorPortalCache.set(id, contexto);
    return contexto;
  }

  function poblarPerfilOrganizador(contexto = {}, usuario = null) {
    const config = contexto?.config || {};
    const organizador = contexto?.organizador || usuario || {};
    const orgInput = document.getElementById("usr-organizacion");
    const lema = document.getElementById("usr-lema");
    const contactEmail = document.getElementById("usr-contact-email");
    const contactPhone = document.getElementById("usr-contact-phone");
    if (orgInput) orgInput.value = config.organizacion_nombre || organizador.organizacion_nombre || "";
    if (lema) lema.value = config.lema || "";
    if (contactEmail) contactEmail.value = config.contact_email || organizador.email || "";
    if (contactPhone) contactPhone.value = config.contact_phone || "";
    renderLogoOrganizacion(config.logo_url || "");
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
      const planGroup = document.getElementById("usr-plan-group");
      const planEstadoGroup = document.getElementById("usr-plan-estado-group");
      if (planGroup) planGroup.style.display = "none";
      if (planEstadoGroup) planEstadoGroup.style.display = "none";
      idsCamposOrganizador().forEach((id) => {
        const group = document.getElementById(id);
        if (group) group.style.display = "none";
      });
      return;
    }

    rolSelect.disabled = false;
    rolSelect.innerHTML = `
      <option value="administrador">Administrador</option>
      <option value="operador">Operador portal</option>
      <option value="organizador">Organizador</option>
      <option value="tecnico">Técnico</option>
      <option value="dirigente">Dirigente</option>
      <option value="jugador">Jugador</option>
    `;
    if (descripcion) {
      descripcion.textContent =
        "Como administrador puedes visualizar, crear, editar y eliminar usuarios, incluido el operador del portal.";
    }
    const planGroup = document.getElementById("usr-plan-group");
    const planEstadoGroup = document.getElementById("usr-plan-estado-group");
    if (planGroup) planGroup.style.display = "";
    if (planEstadoGroup) planEstadoGroup.style.display = "";
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
      if (btnGuardar) btnGuardar.style.display = "inline-flex";
      if (btnGuardar) btnGuardar.disabled = false;
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
      btnGuardar.style.display = "inline-flex";
      btnGuardar.disabled = false;
    }
    if (btnCancelar) btnCancelar.style.display = "none";
    if (passInput) passInput.required = true;
  }

  function actualizarCamposPlan() {
    const planSelect = document.getElementById("usr-plan");
    const planEstado = document.getElementById("usr-plan-estado");
    const rolSel = document.getElementById("usr-rol");
    const equipoSel = document.getElementById("usr-equipo");
    const planGroup = document.getElementById("usr-plan-group");
    const planEstadoGroup = document.getElementById("usr-plan-estado-group");
    const organizacionGroup = document.getElementById("usr-organizacion-group");
    const organizacionInput = document.getElementById("usr-organizacion");
    const lemaInput = document.getElementById("usr-lema");
    const contactEmailInput = document.getElementById("usr-contact-email");
    const contactPhoneInput = document.getElementById("usr-contact-phone");
    const logoInput = document.getElementById("usr-organizacion-logo");
    const esAdmin = esAdminActual();
    const rol = String(rolSel?.value || "").toLowerCase();
    const habilitar = esAdmin && rol === "organizador";
    const usaEquipo = esRolConEquipo(rol);

    if (planGroup) {
      planGroup.style.opacity = habilitar ? "1" : "0.6";
    }
    if (planEstadoGroup) {
      planEstadoGroup.style.opacity = habilitar ? "1" : "0.6";
    }
    if (planSelect) {
      planSelect.disabled = !habilitar;
      if (habilitar && !usuarioEditandoId && (!planSelect.value || planSelect.value === "premium")) {
        planSelect.value = "free";
      }
      if (!habilitar && !usuarioEditandoId) planSelect.value = "premium";
    }
    if (planEstado) {
      planEstado.disabled = !habilitar;
      if (!habilitar && !usuarioEditandoId) planEstado.value = "activo";
    }
    if (organizacionGroup) {
      organizacionGroup.style.opacity = habilitar ? "1" : "0.6";
      organizacionGroup.style.display = habilitar ? "" : "none";
    }
    if (organizacionInput) {
      organizacionInput.disabled = !habilitar;
      organizacionInput.required = habilitar;
      if (!habilitar && !usuarioEditandoId) organizacionInput.value = "";
    }
    idsCamposOrganizador()
      .filter((id) => id !== "usr-organizacion-group")
      .forEach((id) => {
        const group = document.getElementById(id);
        if (group) group.style.display = habilitar ? "" : "none";
      });
    if (lemaInput) lemaInput.disabled = !habilitar;
    if (contactEmailInput) contactEmailInput.disabled = !habilitar;
    if (contactPhoneInput) contactPhoneInput.disabled = !habilitar;
    if (logoInput) logoInput.disabled = !habilitar;
    if (!habilitar && !usuarioEditandoId) {
      limpiarPerfilOrganizador();
    }
    if (equipoSel) {
      equipoSel.disabled = !usaEquipo;
      if (!usaEquipo) equipoSel.value = "";
    }
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
        const esOrganizador = String(u.rol || "").toLowerCase() === "organizador";
        const landing =
          esOrganizador && esPlanPagado(u.plan_codigo)
            ? `<a href="${esc(obtenerLandingUrl(u.id))}" target="_blank" rel="noopener noreferrer">Abrir</a>`
            : "—";
        return `
          <tr>
            <td>${Number(u.id || 0)}</td>
            <td>${esc(u.nombre || "-")}</td>
            <td>${esc(u.username || "-")}</td>
            <td>${esc(u.email || "-")}</td>
            <td>${esc((u.rol || "-").toUpperCase())}</td>
            <td>${esc(u.organizacion_nombre || "-")}</td>
            <td>${esc(formatearPlan(u.plan_codigo))}</td>
            <td>${esc(String(u.plan_estado || "activo"))}</td>
            <td>${equipoIds}</td>
            <td>${u.activo ? '<span class="badge status-finalizado">Activo</span>' : '<span class="badge status-pendiente">Inactivo</span>'}</td>
            <td>${
              u.debe_cambiar_password === true
                ? '<span class="badge status-pendiente">Pendiente</span>'
                : '<span class="badge status-finalizado">OK</span>'
            }</td>
            <td>${landing}</td>
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
      <div class="list-table-wrap usuarios-table-wrap">
        <table class="list-table usuarios-list-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Organización</th>
              <th>Plan</th>
              <th>Estado plan</th>
              <th>Equipos</th>
              <th>Estado</th>
              <th>Cambio clave</th>
              <th>Landing</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
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
    document.getElementById("usr-username").value = "";
    document.getElementById("usr-password").value = "";
    document.getElementById("usr-equipo").value = "";
    document.getElementById("usr-activo").value = "true";
    const planSel = document.getElementById("usr-plan");
    const planEstadoSel = document.getElementById("usr-plan-estado");
    const orgInput = document.getElementById("usr-organizacion");
    if (planSel) planSel.value = "free";
    if (planEstadoSel) planEstadoSel.value = "activo";
    if (orgInput) orgInput.value = "";
    limpiarPerfilOrganizador();

    const selRol = document.getElementById("usr-rol");
    if (selRol) {
      selRol.value = esOrganizadorActual() ? "dirigente" : "administrador";
    }
    actualizarTituloFormulario();
    actualizarCamposPlan();
  }

  function cargarFormularioDesdeUsuario(u) {
    if (!esAdminActual()) return;
    usuarioEditandoId = Number(u.id);
    document.getElementById("usr-nombre").value = u.nombre || "";
    document.getElementById("usr-email").value = u.email || "";
    document.getElementById("usr-username").value = u.username || "";
    document.getElementById("usr-password").value = "";
    document.getElementById("usr-rol").value = u.rol || "tecnico";
    document.getElementById("usr-activo").value = String(u.activo === true);
    const planSel = document.getElementById("usr-plan");
    const planEstadoSel = document.getElementById("usr-plan-estado");
    const orgInput = document.getElementById("usr-organizacion");
    if (planSel) planSel.value = String(u.plan_codigo || "free").toLowerCase();
    if (planEstadoSel) planEstadoSel.value = String(u.plan_estado || "activo").toLowerCase();
    if (orgInput) orgInput.value = u.organizacion_nombre || "";

    const equipo = Array.isArray(u.equipo_ids) && u.equipo_ids.length ? Number(u.equipo_ids[0]) : "";
    document.getElementById("usr-equipo").value = equipo ? String(equipo) : "";
    actualizarTituloFormulario();
    actualizarCamposPlan();
    if (String(u.rol || "").toLowerCase() !== "organizador") {
      limpiarPerfilOrganizador();
    }
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

  async function sincronizarConfigOrganizador(usuarioId, payload = {}, logoFile = null) {
    const id = Number.parseInt(usuarioId, 10);
    if (!Number.isFinite(id) || id <= 0) return;

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) formData.append(key, String(value));
    });
    if (logoFile) formData.append("logo", logoFile);
    await window.OrganizadorPortalAPI.actualizarConfig(formData, { organizador_id: id });
    organizadorPortalCache.delete(id);
  }

  async function guardarUsuario(e) {
    e.preventDefault();

    if (esOrganizadorActual() && usuarioEditandoId) {
      mostrarNotificacion("El organizador no puede editar usuarios", "warning");
      return;
    }

    const nombre = String(document.getElementById("usr-nombre")?.value || "").trim();
    const email = String(document.getElementById("usr-email")?.value || "").trim();
    const username = normalizarUsername(document.getElementById("usr-username")?.value || "");
    const password = String(document.getElementById("usr-password")?.value || "");
    const rolCampo = String(document.getElementById("usr-rol")?.value || "tecnico").trim();
    const rol = esOrganizadorActual() ? "dirigente" : rolCampo;
    const equipo = document.getElementById("usr-equipo")?.value || "";
    const activo = String(document.getElementById("usr-activo")?.value || "true") === "true";
    const planCodigo = String(document.getElementById("usr-plan")?.value || "free")
      .trim()
      .toLowerCase();
    const planEstado = String(document.getElementById("usr-plan-estado")?.value || "activo")
      .trim()
      .toLowerCase();
    const organizacionNombre = String(document.getElementById("usr-organizacion")?.value || "").trim();
    const lema = String(document.getElementById("usr-lema")?.value || "").trim();
    const contactEmailPublico = String(document.getElementById("usr-contact-email")?.value || "").trim();
    const contactPhone = String(document.getElementById("usr-contact-phone")?.value || "").trim();
    const logoFile = document.getElementById("usr-organizacion-logo")?.files?.[0] || null;

    if (!nombre || (!email && !username)) {
      mostrarNotificacion("Nombre y al menos un correo o usuario son obligatorios", "warning");
      return;
    }
    if (!validarEmailOpcional(email)) {
      mostrarNotificacion("El correo no tiene un formato válido", "warning");
      return;
    }
    if (!validarUsernameOpcional(username)) {
      mostrarNotificacion(
        "El usuario debe tener entre 3 y 40 caracteres y usar solo letras, números, punto, guion o guion bajo",
        "warning"
      );
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
    if (esAdminActual() && rol === "organizador" && organizacionNombre.length < 3) {
      mostrarNotificacion("La organización del organizador es obligatoria (mínimo 3 caracteres)", "warning");
      return;
    }
    if (contactEmailPublico && !validarEmailOpcional(contactEmailPublico)) {
      mostrarNotificacion("El correo de contacto público no tiene un formato válido", "warning");
      return;
    }
    if (
      esAdminActual() &&
      rol === "organizador" &&
      !email &&
      !contactEmailPublico &&
      !contactPhone
    ) {
      mostrarNotificacion(
        "Para un organizador debes dejar al menos un contacto público: correo o teléfono/WhatsApp",
        "warning"
      );
      return;
    }

    try {
      if (!usuarioEditandoId) {
        const payload = { nombre, email: email || null, username: username || null, password, rol, activo };
        if (esAdminActual() && rol === "organizador") {
          payload.plan_codigo = planCodigo;
          payload.plan_estado = planEstado;
          payload.organizacion_nombre = organizacionNombre;
          payload.lema = lema || null;
          payload.contact_email_publico = contactEmailPublico || null;
          payload.contact_phone = contactPhone || null;
        }
        if (esRolConEquipo(rol) && equipo) payload.equipo_id = Number.parseInt(equipo, 10);
        const respuesta = await AuthAPI.crearUsuario(payload);
        if (esAdminActual() && rol === "organizador" && logoFile && respuesta?.usuario?.id) {
          try {
            await sincronizarConfigOrganizador(
              respuesta.usuario.id,
              {
                organizacion_nombre: organizacionNombre,
                lema,
                contact_email: contactEmailPublico || email || "",
                contact_phone: contactPhone,
              },
              logoFile
            );
          } catch (logoError) {
            console.error(logoError);
            mostrarNotificacion(
              "El usuario se creó, pero no se pudo sincronizar el logo con Mi Landing.",
              "warning"
            );
          }
        }
        const pendiente = respuesta?.usuario?.debe_cambiar_password === true;
        mostrarNotificacion(
          pendiente
            ? "Usuario creado. Debe cambiar su contraseña al primer ingreso."
            : "Usuario creado",
          "success"
        );
      } else {
        const antes = usuariosCache.find((u) => Number(u.id) === Number(usuarioEditandoId));
        const payload = { nombre, email: email || null, username: username || null, rol, activo };
        if (esAdminActual() && rol === "organizador") {
          payload.plan_codigo = planCodigo;
          payload.plan_estado = planEstado;
          payload.organizacion_nombre = organizacionNombre;
          payload.lema = lema || null;
          payload.contact_email_publico = contactEmailPublico || null;
          payload.contact_phone = contactPhone || null;
        } else if (esAdminActual()) {
          payload.organizacion_nombre = null;
        }
        if (password) payload.password = password;
        const respuesta = await AuthAPI.actualizarUsuario(usuarioEditandoId, payload);
        if (antes) await sincronizarEquipoTecnico(antes, rol, equipo);
        if (esAdminActual() && rol === "organizador" && logoFile && respuesta?.usuario?.id) {
          try {
            await sincronizarConfigOrganizador(
              respuesta.usuario.id,
              {
                organizacion_nombre: organizacionNombre,
                lema,
                contact_email: contactEmailPublico || email || "",
                contact_phone: contactPhone,
              },
              logoFile
            );
          } catch (logoError) {
            console.error(logoError);
            mostrarNotificacion(
              "El usuario se actualizó, pero no se pudo sincronizar el logo con Mi Landing.",
              "warning"
            );
          }
        }
        mostrarNotificacion(
          password
            ? "Usuario actualizado. Debe cambiar su contraseña al volver a ingresar."
            : "Usuario actualizado",
          "success"
        );
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
    if (String(user.rol || "").toLowerCase() === "organizador") {
      try {
        const contexto = await obtenerContextoOrganizador(user.id, true);
        poblarPerfilOrganizador(contexto, user);
      } catch (error) {
        console.error(error);
        mostrarNotificacion(
          "No se pudo cargar el branding del organizador. Puedes continuar editando los datos base.",
          "warning"
        );
      }
    }
    const form = document.getElementById("usuarios-form");
    form?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("usr-nombre")?.focus();
    mostrarNotificacion("Modo edición activo. Usa el botón 'Guardar cambios'.", "info");
  }

  async function eliminarUsuario(id) {
    if (Number(id) === usuarioActualId()) {
      mostrarNotificacion("No puedes eliminar tu propio usuario", "warning");
      return;
    }
    const ok = await window.mostrarConfirmacion({
      titulo: "Eliminar usuario",
      mensaje: "¿Deseas eliminar este usuario? Esta acción no se puede deshacer.",
      tipo: "warning",
      textoConfirmar: "Eliminar",
      claseConfirmar: "btn-danger",
    });
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
    document.getElementById("usr-rol")?.addEventListener("change", actualizarCamposPlan);
    document.getElementById("btn-usuarios-cancelar")?.addEventListener("click", limpiarFormulario);
    document.getElementById("btn-usuarios-recargar")?.addEventListener("click", async () => {
      organizadorPortalCache.clear();
      await Promise.all([cargarEquipos(), cargarUsuarios()]);
      mostrarNotificacion("Datos actualizados", "success");
    });

    await Promise.all([cargarEquipos(), cargarUsuarios()]);
    actualizarCamposPlan();
  });

  window.UsuariosUI = {
    editar: editarUsuario,
    eliminar: eliminarUsuario,
  };
})();
