(function () {
  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function getNextPath() {
    const params = getParams();
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
    if (next && next !== "/login.html") {
      window.location.href = next;
      return;
    }
    window.location.href = window.Auth.getDefaultPage();
  }

  function toggleForgot() {
    const wrap = document.getElementById("forgot-wrap");
    if (!wrap) return;
    wrap.style.display = wrap.style.display === "none" ? "block" : "none";
  }

  function mostrarResetSiExisteToken() {
    const params = getParams();
    const token = String(params.get("reset_token") || "").trim();
    const email = String(params.get("email") || "").trim();
    if (!token && !email) return;

    const wrap = document.getElementById("reset-wrap");
    const inputToken = document.getElementById("reset-token");
    const inputEmail = document.getElementById("reset-email");
    if (!wrap || !inputToken || !inputEmail) return;

    if (token) inputToken.value = token;
    if (email) inputEmail.value = email;
    wrap.style.display = "block";
  }

  async function onSubmitLogin(e) {
    e.preventDefault();

    const email = String(document.getElementById("login-email")?.value || "").trim();
    const password = String(document.getElementById("login-password")?.value || "");
    const btn = document.getElementById("login-submit");

    if (!email || !password) {
      mostrarNotificacion("Correo y contraseña son obligatorios", "warning");
      return;
    }

    try {
      if (btn) btn.disabled = true;
      const data = await AuthAPI.login({ email, password });
      const token = data?.token || "";
      const usuario = data?.usuario || null;
      if (!token || !usuario) throw new Error("Respuesta de login inválida");

      window.Auth.setSession(token, usuario);
      mostrarNotificacion("Sesión iniciada", "success");
      redirigirPostLogin();
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo iniciar sesión", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function onSubmitForgot(e) {
    e.preventDefault();
    const email = String(document.getElementById("forgot-email")?.value || "").trim();
    const btn = document.getElementById("forgot-submit");
    if (!email) {
      mostrarNotificacion("Ingresa el correo registrado", "warning");
      return;
    }

    try {
      if (btn) btn.disabled = true;
      await AuthAPI.forgotPassword({ email });
      mostrarNotificacion(
        "Si el correo existe, se envio un enlace para restablecer la contraseña.",
        "success"
      );
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo solicitar recuperación", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function onSubmitReset(e) {
    e.preventDefault();
    const email = String(document.getElementById("reset-email")?.value || "").trim();
    const token = String(document.getElementById("reset-token")?.value || "").trim();
    const password = String(document.getElementById("reset-password")?.value || "");
    const confirm = String(document.getElementById("reset-password-confirm")?.value || "");
    const btn = document.getElementById("reset-submit");

    if (!email || !token || !password) {
      mostrarNotificacion("Correo, token y contraseña son obligatorios", "warning");
      return;
    }
    if (password.length < 6) {
      mostrarNotificacion("La contraseña debe tener al menos 6 caracteres", "warning");
      return;
    }
    if (password !== confirm) {
      mostrarNotificacion("Las contraseñas no coinciden", "warning");
      return;
    }

    try {
      if (btn) btn.disabled = true;
      await AuthAPI.resetPassword({ email, token, password });
      mostrarNotificacion("Contraseña restablecida. Inicia sesión con la nueva clave.", "success");
      const resetWrap = document.getElementById("reset-wrap");
      if (resetWrap) resetWrap.style.display = "none";
      document.getElementById("login-email").value = email;
      document.getElementById("login-password").value = "";
      const url = new URL(window.location.href);
      url.searchParams.delete("reset_token");
      url.searchParams.delete("email");
      window.history.replaceState({}, "", url.toString());
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo restablecer la contraseña", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function onSubmitBootstrap(e) {
    e.preventDefault();

    const nombre = String(document.getElementById("bootstrap-nombre")?.value || "").trim();
    const email = String(document.getElementById("bootstrap-email")?.value || "").trim();
    const password = String(document.getElementById("bootstrap-password")?.value || "");
    const confirm = String(document.getElementById("bootstrap-password-confirm")?.value || "");
    const btn = document.getElementById("bootstrap-submit");

    if (!nombre || !email || !password) {
      mostrarNotificacion("Nombre, correo y contraseña son obligatorios", "warning");
      return;
    }
    if (password.length < 6) {
      mostrarNotificacion("La contraseña debe tener al menos 6 caracteres", "warning");
      return;
    }
    if (password !== confirm) {
      mostrarNotificacion("Las contraseñas no coinciden", "warning");
      return;
    }

    try {
      if (btn) btn.disabled = true;
      const data = await AuthAPI.bootstrapRegister({ nombre, email, password });
      const token = data?.token || "";
      const usuario = data?.usuario || null;
      if (!token || !usuario) throw new Error("No se pudo crear el usuario inicial");

      window.Auth.setSession(token, usuario);
      mostrarNotificacion("Administrador inicial creado", "success");
      redirigirPostLogin();
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo completar el registro inicial", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function verificarRegistroInicial() {
    const wrap = document.getElementById("bootstrap-wrap");
    if (!wrap) return;

    try {
      const data = await AuthAPI.bootstrapStatus();
      const requiere = data?.requiere_registro_inicial === true;
      wrap.style.display = requiere ? "block" : "none";
    } catch (error) {
      console.error(error);
      wrap.style.display = "none";
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.location.pathname.endsWith("login.html")) return;
    document.getElementById("login-form")?.addEventListener("submit", onSubmitLogin);
    document.getElementById("forgot-form")?.addEventListener("submit", onSubmitForgot);
    document.getElementById("reset-form")?.addEventListener("submit", onSubmitReset);
    document.getElementById("bootstrap-form")?.addEventListener("submit", onSubmitBootstrap);
    document.getElementById("btn-toggle-forgot")?.addEventListener("click", toggleForgot);

    mostrarResetSiExisteToken();
    await verificarRegistroInicial();
  });
})();

