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

  function redirigirPostLogin(forzarPaginaProtegida = false) {
    if (forzarPaginaProtegida) {
      window.location.href = window.Auth.getDefaultPage();
      return;
    }
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

  function mostrarAvisoSalidaSesion() {
    const params = getParams();
    const reasonParam = String(params.get("reason") || "").trim().toLowerCase();
    const reasonStored = String(window.Auth?.consumeLogoutReason?.() || "").trim().toLowerCase();
    const reason = reasonStored || reasonParam;
    if (!reason) return;

    if (reason === "idle") {
      mostrarNotificacion("La sesión se cerró por inactividad después de 1 hora.", "warning");
    }
  }

  async function onSubmitLogin(e) {
    e.preventDefault();

    const identificador = String(document.getElementById("login-email")?.value || "").trim();
    const password = String(document.getElementById("login-password")?.value || "");
    const btn = document.getElementById("login-submit");

    if (!identificador || !password) {
      mostrarNotificacion("Correo o usuario y contraseña son obligatorios", "warning");
      return;
    }

    try {
      if (btn) btn.disabled = true;
      const data = await AuthAPI.login({ identificador, password });
      const token = data?.token || "";
      const usuario = data?.usuario || null;
      if (!token || !usuario) throw new Error("Respuesta de login inválida");

      window.Auth.setSession(token, usuario, data?.refreshToken || "");
      if (usuario?.debe_cambiar_password === true) {
        mostrarNotificacion(
          "Debes cambiar tu contraseña antes de continuar.",
          "warning"
        );
        redirigirPostLogin(true);
      } else {
        mostrarNotificacion("Sesión iniciada", "success");
        redirigirPostLogin();
      }
    } catch (error) {
      console.error(error);
      // Cuenta con pago pendiente → modal específico
      if (error?.data?.codigo === "pendiente_pago" || error?.codigo === "pendiente_pago") {
        const planNombre = error?.data?.plan_nombre || error?.plan_nombre || "Plan de pago";
        mostrarModalPendientePago(planNombre);
      } else {
        mostrarNotificacion(error.message || "No se pudo iniciar sesión", "error");
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function mostrarModalPendientePago(planNombre) {
    const modal = document.getElementById("ltc-pendiente-modal");
    const planTxt = document.getElementById("ltc-pendiente-plan-txt");
    const wspBtn = document.getElementById("ltc-pendiente-wsp-btn");
    const cerrarBtn = document.getElementById("ltc-pendiente-cerrar-btn");
    if (!modal) return;

    if (planTxt) planTxt.textContent = planNombre;

    // Cargar número de WhatsApp desde formas de pago
    fetch(`${window.ApiClient?.baseUrl || "/api"}/auth/formas-pago`)
      .then((r) => r.json())
      .then((data) => {
        const wsp = data?.datos?.whatsapp_numero || "";
        const msg = encodeURIComponent(`Hola LT&C, me registré con ${planNombre} y necesito confirmar mi pago para activar mi cuenta.`);
        if (wspBtn && wsp) {
          wspBtn.href = `https://wa.me/${wsp.replace(/\D/g, "")}?text=${msg}`;
        } else if (wspBtn) {
          // Sin número configurado: mostrar igual con wa.me vacío o cambiar a contacto genérico
          wspBtn.href = `https://wa.me/?text=${msg}`;
        }
      })
      .catch(() => {});

    modal.style.display = "flex";

    if (cerrarBtn) {
      cerrarBtn.onclick = () => { modal.style.display = "none"; };
    }
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    }, { once: true });
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

      window.Auth.setSession(token, usuario, data?.refreshToken || "");
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

  function mostrarModalSiPendientePago() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pendiente_pago") !== "1") return;
    const planNombre = decodeURIComponent(params.get("plan") || "Plan de pago");
    // Limpiar params de la URL sin recargar
    const url = new URL(window.location.href);
    url.searchParams.delete("pendiente_pago");
    url.searchParams.delete("plan");
    window.history.replaceState({}, "", url.toString());
    mostrarModalPendientePago(planNombre);
  }

  // ── Subir comprobante desde modal pago pendiente ────────────────────────────
  function initSubirComprobanteLogin() {
    const btn   = document.getElementById("ltc-pendiente-subir-btn");
    const input = document.getElementById("ltc-pendiente-archivo");
    const msg   = document.getElementById("ltc-pendiente-upload-msg");
    if (!btn || !input) return;

    btn.addEventListener("click", async () => {
      const file = input.files?.[0];
      if (!file) { msg.style.color = "#dc2626"; msg.textContent = "Selecciona un archivo."; return; }

      const token = window.Auth?.getToken?.();
      if (!token) { msg.style.color = "#dc2626"; msg.textContent = "Inicia sesión primero para subir el comprobante."; return; }

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
    if (!window.location.pathname.endsWith("login.html")) return;
    document.getElementById("login-form")?.addEventListener("submit", onSubmitLogin);
    document.getElementById("forgot-form")?.addEventListener("submit", onSubmitForgot);
    document.getElementById("reset-form")?.addEventListener("submit", onSubmitReset);
    document.getElementById("bootstrap-form")?.addEventListener("submit", onSubmitBootstrap);
    document.getElementById("btn-toggle-forgot")?.addEventListener("click", toggleForgot);

    mostrarResetSiExisteToken();
    mostrarAvisoSalidaSesion();
    mostrarModalSiPendientePago();
    initSubirComprobanteLogin();
    await verificarRegistroInicial();
  });
})();
