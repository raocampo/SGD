(function () {
  const PLANES_VALIDOS = new Set(["demo", "free", "base", "competencia", "premium"]);
  const PLANES_LABEL = {
    demo: "Demo",
    free: "Free",
    base: "Base",
    competencia: "Competencia",
    premium: "Premium",
  };

  let planSeleccionado = "demo";

  function obtenerPlanDesdeUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw = String(params.get("plan") || "").trim().toLowerCase();
    return PLANES_VALIDOS.has(raw) ? raw : "demo";
  }

  function renderPlanSeleccionado() {
    const el = document.getElementById("register-plan-info");
    if (!el) return;
    el.textContent = `Plan seleccionado: ${PLANES_LABEL[planSeleccionado] || "Demo"}`;
  }

  function getNextPath() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("next");
    if (!raw) return "";
    try {
      const decoded = decodeURIComponent(raw);
      if (decoded.startsWith("/") && !decoded.startsWith("//")) return decoded;
      return "";
    } catch (_) {
      return "";
    }
  }

  function redirigirPostLogin() {
    const next = getNextPath();
    if (next && next !== "/register.html") {
      window.location.href = next;
      return;
    }
    window.location.href = window.Auth.getDefaultPage();
  }

  function mostrarMensaje(id, mensaje = "") {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = mensaje;
    el.style.display = mensaje ? "block" : "none";
  }

  function obtenerRolSeleccionado() {
    const check = document.querySelector('input[name="register-rol"]:checked');
    return String(check?.value || "").trim().toLowerCase();
  }

  function actualizarVisibilidadOrganizacion() {
    const rol = obtenerRolSeleccionado();
    const group = document.getElementById("register-organizacion-group");
    const input = document.getElementById("register-organizacion");
    if (!group || !input) return;

    const mostrar = rol === "organizador";
    group.style.display = mostrar ? "block" : "none";
    input.required = mostrar;
    if (!mostrar) {
      input.value = "";
      mostrarMensaje("register-organizacion-msg", "");
    }
  }

  function validarFormularioRegistro() {
    const email = String(document.getElementById("register-email")?.value || "").trim();
    const nombres = String(document.getElementById("register-nombres")?.value || "").trim();
    const apellidos = String(document.getElementById("register-apellidos")?.value || "").trim();
    const password = String(document.getElementById("register-password")?.value || "");
    const confirm = String(document.getElementById("register-password-confirm")?.value || "");
    const terms = document.getElementById("register-terms")?.checked === true;
    const rol = obtenerRolSeleccionado();
    const organizacion = String(document.getElementById("register-organizacion")?.value || "").trim();

    let ok = true;

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) ok = false;
    mostrarMensaje("register-email-msg", emailOk ? "" : "Ingresa un e-mail válido.");

    const nomOk = nombres.length >= 3;
    if (!nomOk) ok = false;
    mostrarMensaje("register-nombres-msg", nomOk ? "" : "El nombre debe tener mínimo 3 caracteres.");

    const apeOk = apellidos.length >= 3;
    if (!apeOk) ok = false;
    mostrarMensaje("register-apellidos-msg", apeOk ? "" : "El apellido debe tener mínimo 3 caracteres.");

    const passOk = password.length >= 6;
    if (!passOk) ok = false;
    mostrarMensaje("register-password-msg", passOk ? "" : "Contraseña muy corta (mínimo 6).");

    const confirmOk = passOk && password === confirm;
    if (!confirmOk) ok = false;
    mostrarMensaje(
      "register-password-confirm-msg",
      confirm ? (confirmOk ? "" : "Las contraseñas no coinciden.") : "Confirma tu contraseña."
    );

    if (!terms) ok = false;
    if (!rol) ok = false;

    if (rol === "organizador") {
      const orgOk = organizacion.length >= 3;
      if (!orgOk) ok = false;
      mostrarMensaje(
        "register-organizacion-msg",
        orgOk ? "" : "Ingresa el nombre de la organización (mínimo 3 caracteres)."
      );
    } else {
      mostrarMensaje("register-organizacion-msg", "");
    }

    const submit = document.getElementById("register-submit");
    if (submit) submit.disabled = !ok;

    return {
      ok,
      payload: {
        nombre: `${nombres} ${apellidos}`.trim(),
        email,
        rol,
        password,
        plan_codigo: planSeleccionado,
        organizacion_nombre: rol === "organizador" ? organizacion : null,
      },
    };
  }

  async function onSubmitRegister(e) {
    e.preventDefault();
    const validacion = validarFormularioRegistro();
    if (!validacion.ok) {
      mostrarNotificacion("Revisa los campos y acepta los términos para continuar", "warning");
      return;
    }

    const btn = document.getElementById("register-submit");
    try {
      if (btn) btn.disabled = true;
      const data = await AuthAPI.registerPublic(validacion.payload);

      // Plan pagado: cuenta creada pero sin sesión hasta confirmar pago
      if (data?.pendiente_pago) {
        const planNombre = data.plan_nombre || PLANES_LABEL[planSeleccionado] || planSeleccionado;
        mostrarModalPendienteRegistro(planNombre);
        return;
      }

      const token = data?.token || "";
      const usuario = data?.usuario || null;
      if (!token || !usuario) throw new Error("No se pudo crear la cuenta");

      window.Auth.setSession(token, usuario, data?.refreshToken || "");
      mostrarNotificacion(`Cuenta creada en plan ${PLANES_LABEL[planSeleccionado] || "Demo"}`, "success");
      redirigirPostLogin();
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo completar el registro", "error");
    } finally {
      validarFormularioRegistro();
    }
  }

  function enlazarValidadores() {
    const ids = [
      "register-email",
      "register-nombres",
      "register-apellidos",
      "register-password",
      "register-password-confirm",
      "register-organizacion",
      "register-terms",
    ];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", validarFormularioRegistro);
      el.addEventListener("change", validarFormularioRegistro);
    });

    document.querySelectorAll('input[name="register-rol"]').forEach((r) => {
      r.addEventListener("change", () => {
        actualizarVisibilidadOrganizacion();
        validarFormularioRegistro();
      });
    });
  }

  function mostrarModalPendienteRegistro(planNombre) {
    const modal = document.getElementById("reg-pendiente-modal");
    if (!modal) return;

    const planEl = document.getElementById("reg-pendiente-plan");
    if (planEl) planEl.textContent = planNombre;

    // Cargar número WhatsApp desde la API
    const wspBtn = document.getElementById("reg-pendiente-wsp");
    fetch(`${window.ApiClient?.baseUrl || "/api"}/auth/formas-pago`)
      .then((r) => r.json())
      .then((data) => {
        const wsp = data?.datos?.whatsapp_numero || "";
        const msg = encodeURIComponent(`Hola LT&C, me registré con ${planNombre} y necesito confirmar mi pago para activar mi cuenta.`);
        if (wspBtn && wsp) {
          wspBtn.href = `https://wa.me/${wsp.replace(/\D/g, "")}?text=${msg}`;
        } else if (wspBtn) {
          wspBtn.href = `https://wa.me/?text=${msg}`;
        }
      })
      .catch(() => {});

    modal.style.display = "flex";

    document.getElementById("reg-pendiente-login")?.addEventListener("click", () => {
      window.location.href = `login.html?pendiente_pago=1&plan=${encodeURIComponent(planNombre)}`;
    });
  }

  // ── Subir comprobante desde modal de registro ───────────────────────────────
  function initSubirComprobanteRegister() {
    const btn   = document.getElementById("reg-pendiente-subir-btn");
    const input = document.getElementById("reg-pendiente-archivo");
    const msg   = document.getElementById("reg-pendiente-upload-msg");
    if (!btn || !input) return;

    btn.addEventListener("click", async () => {
      const file = input.files?.[0];
      if (!file) { msg.style.color = "#dc2626"; msg.textContent = "Selecciona un archivo."; return; }

      const token = window.Auth?.getToken?.();
      if (!token) { msg.style.color = "#dc2626"; msg.textContent = "Primero inicia sesión para subir el comprobante."; return; }

      btn.disabled = true;
      msg.style.color = "#475569"; msg.textContent = "Subiendo...";

      try {
        const fd = new FormData();
        fd.append("comprobante", file);
        const resp = await fetch(`${window.API_BASE_URL}/comprobantes`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
        });
        const data = await resp.json();
        if (resp.ok) {
          msg.style.color = "#166534";
          msg.textContent = "✅ Comprobante enviado. Te avisaremos cuando sea revisado.";
          btn.innerHTML = '<i class="fas fa-check"></i> Enviado';
          input.disabled = true;
        } else {
          msg.style.color = "#dc2626"; msg.textContent = data.error || "No se pudo enviar.";
          btn.disabled = false;
        }
      } catch { msg.style.color = "#dc2626"; msg.textContent = "Error de conexión."; btn.disabled = false; }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.location.pathname.endsWith("register.html")) return;
    planSeleccionado = obtenerPlanDesdeUrl();
    renderPlanSeleccionado();
    document.getElementById("register-form")?.addEventListener("submit", onSubmitRegister);
    enlazarValidadores();
    actualizarVisibilidadOrganizacion();
    validarFormularioRegistro();
    initSubirComprobanteRegister();
  });
})();

