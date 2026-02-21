(function () {
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

  function validarFormularioRegistro() {
    const email = String(document.getElementById("register-email")?.value || "").trim();
    const nombres = String(document.getElementById("register-nombres")?.value || "").trim();
    const apellidos = String(document.getElementById("register-apellidos")?.value || "").trim();
    const password = String(document.getElementById("register-password")?.value || "");
    const confirm = String(document.getElementById("register-password-confirm")?.value || "");
    const terms = document.getElementById("register-terms")?.checked === true;
    const rol = obtenerRolSeleccionado();

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

    const submit = document.getElementById("register-submit");
    if (submit) submit.disabled = !ok;

    return {
      ok,
      payload: {
        nombre: `${nombres} ${apellidos}`.trim(),
        email,
        rol,
        password,
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
      const token = data?.token || "";
      const usuario = data?.usuario || null;
      if (!token || !usuario) throw new Error("No se pudo crear la cuenta");

      window.Auth.setSession(token, usuario);
      mostrarNotificacion("Cuenta creada en modo solo lectura", "success");
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
      "register-terms",
    ];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", validarFormularioRegistro);
      el.addEventListener("change", validarFormularioRegistro);
    });

    document.querySelectorAll('input[name="register-rol"]').forEach((r) => {
      r.addEventListener("change", validarFormularioRegistro);
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.location.pathname.endsWith("register.html")) return;
    document.getElementById("register-form")?.addEventListener("submit", onSubmitRegister);
    enlazarValidadores();
    validarFormularioRegistro();
  });
})();

