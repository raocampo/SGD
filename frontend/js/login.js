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

      const next = getNextPath();
      if (next && next !== "/login.html") {
        window.location.href = next;
        return;
      }
      window.location.href = window.Auth.getDefaultPage();
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo iniciar sesión", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.location.pathname.endsWith("login.html")) return;
    document.getElementById("login-form")?.addEventListener("submit", onSubmitLogin);
  });
})();
