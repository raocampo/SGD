// frontend/js/core.js

(function () {
  function resolveApiBaseUrl() {
    const explicitBase = String(window.API_BASE_URL || "").trim();
    if (explicitBase) return explicitBase.replace(/\/$/, "");

    const openedFromFile = window.location.protocol === "file:";
    const usesStaticDevHost =
      /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname) &&
      window.location.port &&
      window.location.port !== "5000";

    if (openedFromFile || usesStaticDevHost) {
      return "http://localhost:5000/api";
    }

    return `${window.location.origin}/api`;
  }

  window.resolveApiBaseUrl = window.resolveApiBaseUrl || resolveApiBaseUrl;
  window.resolveBackendBaseUrl =
    window.resolveBackendBaseUrl ||
    (() => window.resolveApiBaseUrl().replace(/\/api\/?$/, ""));
  window.API_BASE_URL = window.resolveApiBaseUrl();

  const AUTH_TOKEN_KEY = "sgd_auth_token";
  const AUTH_REFRESH_TOKEN_KEY = "sgd_auth_refresh_token";
  const AUTH_USER_KEY = "sgd_auth_user";
  const AUTH_LAST_ACTIVITY_KEY = "sgd_auth_last_activity_at";
  const AUTH_LOGOUT_REASON_KEY = "sgd_auth_logout_reason";
  const AUTH_IDLE_TIMEOUT_MS = 60 * 60 * 1000;
  const AUTH_IDLE_WARNING_MS = 5 * 60 * 1000;
  const AUTH_ACTIVITY_DEBOUNCE_MS = 15000;
  const ROUTE_CONTEXT_PREFIX = "sgd_route_ctx:";
  const BRAND_FAVICON_SVG = "favicon.svg";
  const BRAND_FAVICON_FALLBACK = "assets/ltc/Logo.jpeg";
  const PUBLIC_PAGES = new Set(["index.html", "portal.html", "login.html", "register.html", "blog.html", "noticia.html"]);
  const CMS_PAGES = new Set([
    "portal-cms.html",
    "noticias.html",
    "galeria-admin.html",
    "contenido-portal.html",
    "contacto-admin.html",
  ]);
  const OPERADOR_ALLOWED_PAGES = new Set([
    "portal-cms.html",
    "noticias.html",
    "galeria-admin.html",
    "contenido-portal.html",
    "contacto-admin.html",
    "index.html",
    "blog.html",
    "noticia.html",
    "portal.html",
    "login.html",
  ]);
  const TECNICO_ALLOWED_PAGES = new Set([
    "portal-tecnico.html",
    "equipos.html",
    "jugadores.html",
    "tablas.html",
    "finanzas.html",
    "pases.html",
    "eliminatorias.html",
    "index.html",
    "portal.html",
    "login.html",
  ]);
  const JUGADOR_ALLOWED_PAGES = new Set([
    "portal-tecnico.html",
    "equipos.html",
    "jugadores.html",
    "tablas.html",
    "finanzas.html",
    "index.html",
    "portal.html",
    "login.html",
  ]);

  function getCurrentPage() {
    const path = window.location.pathname || "";
    const page = path.split("/").pop() || "index.html";
    return page.toLowerCase();
  }

  const CURRENT_PAGE = getCurrentPage();
  let authIdleTimer = null;
  let authIdleWarningTimer = null;
  let authIdleWarningCountdownTimer = null;
  let authActivityListenersBound = false;
  let authStorageListenerBound = false;
  let lastActivityWriteAt = 0;
  let authLogoutInProgress = false;
  let authIdleWarningVisible = false;

  function ensureAuthPendingStyle() {
    if (!document?.head || document.getElementById("sgd-auth-pending-style")) return;
    const style = document.createElement("style");
    style.id = "sgd-auth-pending-style";
    style.textContent = `
      html[data-auth-pending="true"] body {
        visibility: hidden;
      }
    `;
    document.head.appendChild(style);
  }

  function setAuthPendingState(enabled) {
    if (!document?.documentElement) return;
    if (enabled) {
      ensureAuthPendingStyle();
      document.documentElement.setAttribute("data-auth-pending", "true");
      return;
    }
    document.documentElement.removeAttribute("data-auth-pending");
  }

  setAuthPendingState(!PUBLIC_PAGES.has(CURRENT_PAGE));

  function asegurarLinkHead({ rel, href, type }) {
    if (!rel || !href) return;
    const selector = `link[rel="${rel}"]`;
    let link = document.head.querySelector(selector);
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", rel);
      document.head.appendChild(link);
    }
    link.setAttribute("href", href);
    if (type) link.setAttribute("type", type);
  }

  function aplicarIconoGlobal() {
    if (!document?.head) return;
    asegurarLinkHead({ rel: "icon", href: BRAND_FAVICON_SVG, type: "image/svg+xml" });
    asegurarLinkHead({ rel: "shortcut icon", href: BRAND_FAVICON_FALLBACK, type: "image/jpeg" });
    asegurarLinkHead({ rel: "apple-touch-icon", href: BRAND_FAVICON_FALLBACK, type: "image/jpeg" });
  }

  aplicarIconoGlobal();

  function esTecnicoOdirigente(user) {
    const rol = String(user?.rol || "").toLowerCase();
    return rol === "tecnico" || rol === "dirigente" || rol === "jugador";
  }

  function esUsuarioEquipoConAvisoDeuda(user) {
    const rol = String(user?.rol || "").toLowerCase();
    return rol === "tecnico" || rol === "dirigente" || rol === "jugador";
  }

  function esOperadorPortal(user) {
    return String(user?.rol || "").toLowerCase() === "operador";
  }

  function esJugador(user) {
    return String(user?.rol || "").toLowerCase() === "jugador";
  }

  function getDefaultPageByRole(user) {
    if (!user) return "login.html";
    const rol = String(user.rol || "").toLowerCase();
    if (rol === "operador") return "portal-cms.html";
    if (rol === "administrador" || rol === "organizador") return "portal-admin.html";
    if (rol === "tecnico" || rol === "dirigente" || rol === "jugador") return "portal-tecnico.html";
    return "login.html";
  }

  function canAccessPage(user, page) {
    if (PUBLIC_PAGES.has(page)) return true;
    if (!user) return false;
    if (CMS_PAGES.has(page)) {
      const rol = String(user?.rol || "").toLowerCase();
      return rol === "administrador" || rol === "operador";
    }
    if (esOperadorPortal(user)) return OPERADOR_ALLOWED_PAGES.has(page);
    if (esJugador(user)) return JUGADOR_ALLOWED_PAGES.has(page);
    if (esTecnicoOdirigente(user)) return TECNICO_ALLOWED_PAGES.has(page);
    return true;
  }

  function getStoredUser() {
    try {
      const raw = localStorage.getItem(AUTH_USER_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function setStoredUser(user) {
    if (!user) {
      localStorage.removeItem(AUTH_USER_KEY);
      return;
    }
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }

  function getStoredRefreshToken() {
    return localStorage.getItem(AUTH_REFRESH_TOKEN_KEY) || "";
  }

  function setStoredRefreshToken(token) {
    const safe = String(token || "").trim();
    if (!safe) {
      localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
      return;
    }
    localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, safe);
  }

  function getStoredLastActivity() {
    const raw = Number.parseInt(localStorage.getItem(AUTH_LAST_ACTIVITY_KEY) || "", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }

  function setStoredLastActivity(timestamp = Date.now()) {
    const safe = Number.isFinite(Number(timestamp)) ? Number(timestamp) : Date.now();
    lastActivityWriteAt = safe;
    localStorage.setItem(AUTH_LAST_ACTIVITY_KEY, String(safe));
  }

  function clearStoredLastActivity() {
    lastActivityWriteAt = 0;
    localStorage.removeItem(AUTH_LAST_ACTIVITY_KEY);
  }

  function rememberLogoutReason(reason = "") {
    const safe = String(reason || "").trim();
    if (!safe) {
      sessionStorage.removeItem(AUTH_LOGOUT_REASON_KEY);
      return;
    }
    sessionStorage.setItem(AUTH_LOGOUT_REASON_KEY, safe);
  }

  function consumeLogoutReason() {
    const reason = String(sessionStorage.getItem(AUTH_LOGOUT_REASON_KEY) || "").trim();
    if (reason) sessionStorage.removeItem(AUTH_LOGOUT_REASON_KEY);
    return reason;
  }

  function buildLoginUrl(reason = "") {
    const safeReason = String(reason || "").trim();
    if (!safeReason) return "login.html";
    return `login.html?reason=${encodeURIComponent(safeReason)}`;
  }

  function normalizeRoutePage(page = "") {
    const raw = String(page || "").trim();
    if (!raw) return "";
    return raw.split("?")[0].split("#")[0].split("/").pop().toLowerCase();
  }

  function getRouteContextKey(page = "") {
    const normalized = normalizeRoutePage(page);
    return normalized ? `${ROUTE_CONTEXT_PREFIX}${normalized}` : "";
  }

  function saveRouteContext(page = "", data = {}) {
    const key = getRouteContextKey(page);
    if (!key) return;
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({
          ...(typeof data === "object" && data ? data : {}),
          _saved_at: Date.now(),
        })
      );
    } catch (_) {
      // no-op
    }
  }

  function loadRouteContext(page = "") {
    const key = getRouteContextKey(page);
    if (!key) return null;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function clearRouteContext(page = "") {
    const key = getRouteContextKey(page);
    if (!key) return;
    try {
      sessionStorage.removeItem(key);
    } catch (_) {
      // no-op
    }
  }

  function cleanCurrentRouteQuery() {
    if (!window.location.search) return;
    try {
      const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash || ""}`;
      window.history.replaceState(window.history.state, document.title, cleanUrl);
    } catch (_) {
      // no-op
    }
  }

  function readRouteContext(page = "", paramNames = []) {
    const params = new URLSearchParams(window.location.search);
    const urlData = {};
    let hasUrlData = false;

    (Array.isArray(paramNames) ? paramNames : []).forEach((name) => {
      const value = params.get(name);
      if (value !== null && String(value).trim() !== "") {
        urlData[name] = value;
        hasUrlData = true;
      }
    });

    if (hasUrlData) {
      const merged = { ...(loadRouteContext(page) || {}), ...urlData };
      saveRouteContext(page, merged);
      cleanCurrentRouteQuery();
      return merged;
    }

    return loadRouteContext(page) || {};
  }

  function navigateWithRouteContext(page = "", data = {}) {
    const target = String(page || "").trim();
    if (!target) return;
    saveRouteContext(target, data);
    window.location.href = normalizeRoutePage(target) || target;
  }

  function cancelAuthIdleTimer() {
    if (authIdleTimer) {
      clearTimeout(authIdleTimer);
      authIdleTimer = null;
    }
  }

  function cancelAuthIdleWarningTimer() {
    if (authIdleWarningTimer) {
      clearTimeout(authIdleWarningTimer);
      authIdleWarningTimer = null;
    }
    if (authIdleWarningCountdownTimer) {
      clearInterval(authIdleWarningCountdownTimer);
      authIdleWarningCountdownTimer = null;
    }
  }

  function formatIdleRemaining(ms) {
    const totalSegundos = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
    const minutos = Math.floor(totalSegundos / 60);
    const segundos = totalSegundos % 60;
    return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
  }

  function closeIdleWarning() {
    const backdrop = document.getElementById("sgd-idle-warning-backdrop");
    if (backdrop) backdrop.remove();
    authIdleWarningVisible = false;
    cancelAuthIdleWarningTimer();
    sincronizarEstadoModalBody();
  }

  function showIdleWarning(restanteMs = AUTH_IDLE_WARNING_MS) {
    if (authIdleWarningVisible || PUBLIC_PAGES.has(getCurrentPage())) return;
    if (!(window.Auth?.isAuthenticated?.() || false)) return;

    authIdleWarningVisible = true;
    const root = document.body || document.documentElement;
    if (!root) return;

    const backdrop = document.createElement("div");
    backdrop.id = "sgd-idle-warning-backdrop";
    backdrop.className = "sgd-dialog-backdrop is-open";
    backdrop.innerHTML = `
      <div class="sgd-dialog sgd-dialog-sm" role="alertdialog" aria-modal="true" aria-labelledby="sgd-idle-warning-title">
        <div class="sgd-dialog-header is-warning">
          <span class="sgd-dialog-badge"><i class="fas fa-hourglass-half"></i></span>
          <div>
            <h3 id="sgd-idle-warning-title">Sesión por inactividad</h3>
            <p>Si no haces nada, el sistema cerrará tu sesión automáticamente.</p>
          </div>
        </div>
        <div class="sgd-dialog-body">
          <p>Tiempo restante estimado: <strong class="sgd-idle-warning-time">${formatIdleRemaining(restanteMs)}</strong></p>
        </div>
        <div class="sgd-dialog-actions">
          <button type="button" class="btn btn-outline sgd-idle-warning-logout">Cerrar sesión ahora</button>
          <button type="button" class="btn btn-primary sgd-idle-warning-continue">Seguir conectado</button>
        </div>
      </div>
    `;

    const continueButton = backdrop.querySelector(".sgd-idle-warning-continue");
    const logoutButton = backdrop.querySelector(".sgd-idle-warning-logout");
    const timeNode = backdrop.querySelector(".sgd-idle-warning-time");
    const updateTime = () => {
      const restante = AUTH_IDLE_TIMEOUT_MS - (Date.now() - (getStoredLastActivity() || Date.now()));
      if (timeNode) timeNode.textContent = formatIdleRemaining(restante);
      if (restante <= 0) {
        closeIdleWarning();
      }
    };

    continueButton?.addEventListener("click", () => {
      closeIdleWarning();
      touchAuthActivity(true);
      window.mostrarNotificacion("Sesión extendida correctamente.", "success", { duration: 2200 });
    });

    logoutButton?.addEventListener("click", async () => {
      closeIdleWarning();
      await window.Auth?.logout?.({ reason: "idle", revoke: true });
    });

    backdrop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
      }
    });

    root.appendChild(backdrop);
    sincronizarEstadoModalBody();
    continueButton?.focus();
    updateTime();
    authIdleWarningCountdownTimer = window.setInterval(updateTime, 1000);
  }

  function isIdleExpired() {
    const lastActivity = getStoredLastActivity();
    if (!lastActivity) return false;
    return Date.now() - lastActivity >= AUTH_IDLE_TIMEOUT_MS;
  }

  function scheduleAuthIdleTimer() {
    cancelAuthIdleTimer();
    cancelAuthIdleWarningTimer();
    if (PUBLIC_PAGES.has(getCurrentPage())) return;
    if (!(window.Auth?.isAuthenticated?.() || false)) {
      closeIdleWarning();
      return;
    }

    const lastActivity = getStoredLastActivity() || Date.now();
    const restante = AUTH_IDLE_TIMEOUT_MS - (Date.now() - lastActivity);
    if (restante <= 0) {
      closeIdleWarning();
      window.Auth?.logout?.({ reason: "idle" });
      return;
    }

    if (restante <= AUTH_IDLE_WARNING_MS) {
      showIdleWarning(restante);
    } else {
      authIdleWarningTimer = window.setTimeout(() => {
        showIdleWarning(AUTH_IDLE_WARNING_MS);
      }, Math.max(0, restante - AUTH_IDLE_WARNING_MS));
    }

    authIdleTimer = window.setTimeout(() => {
      closeIdleWarning();
      window.Auth?.logout?.({ reason: "idle" });
    }, restante + 250);
  }

  function touchAuthActivity(force = false) {
    if (!(window.Auth?.isAuthenticated?.() || false)) return;
    const now = Date.now();
    if (!force && lastActivityWriteAt && now - lastActivityWriteAt < AUTH_ACTIVITY_DEBOUNCE_MS) {
      return;
    }
    setStoredLastActivity(now);
    if (authIdleWarningVisible) {
      closeIdleWarning();
    }
    scheduleAuthIdleTimer();
  }

  function bindAuthActivityListeners() {
    if (authActivityListenersBound) return;
    authActivityListenersBound = true;

    const handler = () => touchAuthActivity(false);
    ["pointerdown", "keydown", "touchstart", "scroll", "focus"].forEach((eventName) => {
      window.addEventListener(eventName, handler, { passive: true });
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (isIdleExpired()) {
        window.Auth?.logout?.({ reason: "idle" });
        return;
      }
      touchAuthActivity(true);
    });
  }

  function bindAuthStorageSync() {
    if (authStorageListenerBound) return;
    authStorageListenerBound = true;

    window.addEventListener("storage", (event) => {
      if (event.key === AUTH_LAST_ACTIVITY_KEY) {
        if (window.Auth?.isAuthenticated?.()) {
          if (isIdleExpired()) {
            closeIdleWarning();
            window.Auth?.logout?.({ reason: "idle" });
            return;
          }
          if (authIdleWarningVisible) {
            closeIdleWarning();
          }
          scheduleAuthIdleTimer();
        }
        return;
      }

      if (event.key === AUTH_TOKEN_KEY && !event.newValue && !PUBLIC_PAGES.has(getCurrentPage())) {
        window.location.href = buildLoginUrl();
      }
    });
  }

  async function revokeRefreshTokenIfNeeded(refreshToken) {
    const token = String(refreshToken || "").trim();
    if (!token) return;
    try {
      await fetch(`${window.API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: token }),
        keepalive: true,
      });
    } catch (_) {
      // Evita bloquear el cierre de sesión si el backend no responde.
    }
  }

  async function validarSesionActual() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return null;

    try {
      const resp = await fetch(`${window.API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const user = data?.usuario || null;
      if (!user) return null;
      setStoredUser(user);
      return user;
    } catch (_) {
      return null;
    }
  }

  window.Auth = window.Auth || {
    getToken() {
      return localStorage.getItem(AUTH_TOKEN_KEY) || "";
    },
    getRefreshToken() {
      return getStoredRefreshToken();
    },
    getUser() {
      return getStoredUser();
    },
    setSession(token, user, refreshToken = "") {
      if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
      setStoredRefreshToken(refreshToken);
      setStoredUser(user || null);
      touchAuthActivity(true);
      bindAuthActivityListeners();
      bindAuthStorageSync();
    },
    updateUser(userPatch) {
      const current = this.getUser() || {};
      setStoredUser({ ...current, ...(userPatch || {}) });
    },
    clearSession() {
      cancelAuthIdleTimer();
      closeIdleWarning();
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      clearStoredLastActivity();
    },
    isAuthenticated() {
      return !!this.getToken();
    },
    isTecnico() {
      return esTecnicoOdirigente(this.getUser());
    },
    isAdminLike() {
      const rol = String(this.getUser()?.rol || "").toLowerCase();
      return rol === "administrador" || rol === "organizador";
    },
    isAdministrador() {
      const rol = String(this.getUser()?.rol || "").toLowerCase();
      return rol === "administrador";
    },
    isReadOnly() {
      return this.getUser()?.solo_lectura === true;
    },
    requiresPasswordChange() {
      return this.getUser()?.debe_cambiar_password === true;
    },
    hasIdleExpired() {
      return isIdleExpired();
    },
    touchSession(force = false) {
      touchAuthActivity(force);
    },
    getDefaultPage() {
      return getDefaultPageByRole(this.getUser());
    },
    async logout(options = {}) {
      if (authLogoutInProgress) return;
      authLogoutInProgress = true;
      const reason = String(options?.reason || "").trim();
      const redirect = options?.redirect !== false;
      const refreshToken = this.getRefreshToken();
      if (reason) rememberLogoutReason(reason);
      this.clearSession();
      if (options?.revoke !== false) {
        void revokeRefreshTokenIfNeeded(refreshToken);
      }
      authLogoutInProgress = false;
      if (redirect) {
        window.location.href = buildLoginUrl(reason);
      }
    },
    handleUnauthorized() {
      const page = getCurrentPage();
      this.clearSession();
      if (!PUBLIC_PAGES.has(page)) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `login.html?next=${next}`;
      }
    },
    consumeLogoutReason() {
      return consumeLogoutReason();
    },
    promptChangePassword(opciones = {}) {
      return solicitarCambioPassword(opciones);
    },
  };

  window.RouteContext = window.RouteContext || {
    save: saveRouteContext,
    load: loadRouteContext,
    clear: clearRouteContext,
    read: readRouteContext,
    navigate: navigateWithRouteContext,
    cleanUrl: cleanCurrentRouteQuery,
  };

  async function solicitarCambioPassword(opciones = {}) {
    const forced = opciones?.forced === true;
    const user = window.Auth?.getUser?.();
    if (!user) return false;

    while (true) {
      const values = await window.mostrarFormularioModal({
        titulo: forced ? "Cambio obligatorio de contraseña" : "Cambiar contraseña",
        mensaje: forced
          ? "Tu cuenta fue creada por un administrador u organizador. Debes definir una contraseña propia antes de continuar."
          : "Ingresa tu contraseña actual y define una nueva clave segura.",
        tipo: forced ? "warning" : "info",
        textoConfirmar: "Actualizar contraseña",
        textoCancelar: forced ? "Cerrar sesión" : "Cancelar",
        claseConfirmar: "btn-primary",
        ancho: "sm",
        campos: [
          {
            name: "current_password",
            label: "Contraseña actual",
            type: "password",
            required: true,
            autocomplete: "current-password",
          },
          {
            name: "new_password",
            label: "Nueva contraseña",
            type: "password",
            required: true,
            autocomplete: "new-password",
            hint: "Mínimo 6 caracteres.",
          },
          {
            name: "confirm_password",
            label: "Confirmar contraseña",
            type: "password",
            required: true,
            autocomplete: "new-password",
          },
        ],
      });

      if (!values) {
        if (forced) window.Auth.logout();
        return false;
      }

      const currentPassword = String(values.current_password || "");
      const newPassword = String(values.new_password || "");
      const confirmPassword = String(values.confirm_password || "");

      if (newPassword.length < 6) {
        window.mostrarNotificacion("La nueva contraseña debe tener al menos 6 caracteres", "warning");
        continue;
      }
      if (newPassword !== confirmPassword) {
        window.mostrarNotificacion("Las contraseñas nuevas no coinciden", "warning");
        continue;
      }
      if (newPassword === currentPassword) {
        window.mostrarNotificacion("La nueva contraseña debe ser distinta a la actual", "warning");
        continue;
      }

      try {
        const data = await window.AuthAPI.changePassword({
          current_password: currentPassword,
          new_password: newPassword,
        });
        const usuarioActualizado = {
          ...(window.Auth.getUser() || {}),
          ...(data?.usuario || {}),
          debe_cambiar_password: false,
        };
        window.Auth.updateUser(usuarioActualizado);
        inyectarUsuarioTopbar(usuarioActualizado);
        window.mostrarNotificacion("Contraseña actualizada correctamente", "success");
        return true;
      } catch (error) {
        console.error(error);
        window.mostrarNotificacion(
          error.message || "No se pudo actualizar la contraseña",
          "error"
        );
      }
    }
  }

  if (!window.__sgdFetchAuthPatched) {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = function patchedFetch(input, init = {}) {
      const requestUrl =
        typeof input === "string"
          ? input
          : input?.url || "";
      const apiBase = String(window.API_BASE_URL || "");
      const isApiCall =
        requestUrl.startsWith(apiBase) ||
        requestUrl.startsWith("/api/") ||
        requestUrl.includes("/api/");

      if (!isApiCall) return nativeFetch(input, init);

      const token = window.Auth?.getToken?.();
      if (!token) return nativeFetch(input, init);

      if (!String(requestUrl).includes("/auth/logout")) {
        window.Auth?.touchSession?.(false);
      }

      const headers = new Headers(init?.headers || (typeof input !== "string" ? input?.headers : undefined) || {});
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      return nativeFetch(input, { ...init, headers });
    };
    window.__sgdFetchAuthPatched = true;
  }

  function escapeFeedbackHtml(valor) {
    return String(valor ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function iconoFeedback(tipo = "info") {
    if (tipo === "success") return "fa-circle-check";
    if (tipo === "error") return "fa-circle-xmark";
    if (tipo === "warning") return "fa-triangle-exclamation";
    return "fa-circle-info";
  }

  function tituloFeedback(tipo = "info") {
    if (tipo === "success") return "Operación completada";
    if (tipo === "error") return "Se produjo un error";
    if (tipo === "warning") return "Atención";
    return "Información";
  }

  function asegurarInfraestructuraFeedback() {
    let stack = document.getElementById("sgd-toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "sgd-toast-stack";
      stack.className = "sgd-toast-stack";
      document.body.appendChild(stack);
    }

    let root = document.getElementById("sgd-dialog-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "sgd-dialog-root";
      document.body.appendChild(root);
    }

    return { stack, root };
  }

  function sincronizarEstadoModalBody() {
    const abierto = document.querySelector(".modal.open, .sgd-dialog-backdrop.is-open");
    document.body.classList.toggle("modal-open", Boolean(abierto));
  }

  function renderTextoFeedback(mensaje = "") {
    const texto = Array.isArray(mensaje) ? mensaje.join("\n") : String(mensaje ?? "");
    return texto
      .split(/\n+/)
      .filter(Boolean)
      .map((linea) => `<p>${escapeFeedbackHtml(linea)}</p>`)
      .join("");
  }

  function crearBotonDialogo(texto, clase = "btn btn-outline", type = "button") {
    const btn = document.createElement("button");
    btn.type = type;
    btn.className = `btn ${clase.replace(/\bbtn\b/g, "").trim()}`.trim();
    btn.textContent = texto;
    return btn;
  }

  window.mostrarNotificacion = function (mensaje, tipo = "info", opciones = {}) {
    console.log(`${String(tipo || "info").toUpperCase()}: ${mensaje}`);

    if (!document?.body) return;

    const { stack } = asegurarInfraestructuraFeedback();
    const toast = document.createElement("article");
    const duracion = Number(opciones?.duracion) > 0 ? Number(opciones.duracion) : tipo === "error" ? 5200 : 3600;
    toast.className = `sgd-toast sgd-toast-${tipo}`;
    toast.style.setProperty("--toast-duration", `${duracion}ms`);
    toast.innerHTML = `
      <div class="sgd-toast-icon" aria-hidden="true">
        <i class="fas ${iconoFeedback(tipo)}"></i>
      </div>
      <div class="sgd-toast-body">
        <strong>${escapeFeedbackHtml(opciones?.titulo || tituloFeedback(tipo))}</strong>
        <p>${escapeFeedbackHtml(mensaje || "")}</p>
      </div>
      <button type="button" class="sgd-toast-close" aria-label="Cerrar aviso">
        <i class="fas fa-xmark"></i>
      </button>
      <span class="sgd-toast-progress" aria-hidden="true"></span>
    `;

    const cerrar = () => {
      toast.classList.add("is-leaving");
      window.setTimeout(() => {
        toast.remove();
      }, 220);
    };

    toast.querySelector(".sgd-toast-close")?.addEventListener("click", cerrar);
    stack.prepend(toast);

    while (stack.children.length > 4) {
      stack.lastElementChild?.remove();
    }

    window.setTimeout(cerrar, duracion);
    return toast;
  };
  window.__sgdToast = window.mostrarNotificacion;

  window.mostrarAlerta = function (config, tipoPorDefecto = "info") {
    const opciones =
      typeof config === "object" && config !== null
        ? { ...config }
        : { mensaje: config, tipo: tipoPorDefecto };

    return new Promise((resolve) => {
      const { root } = asegurarInfraestructuraFeedback();
      const backdrop = document.createElement("div");
      backdrop.className = `sgd-dialog-backdrop is-open tipo-${opciones.tipo || tipoPorDefecto}`;
      backdrop.innerHTML = `
        <div class="sgd-dialog sgd-dialog-sm" role="alertdialog" aria-modal="true">
          <div class="sgd-dialog-header">
            <div class="sgd-dialog-badge">
              <i class="fas ${iconoFeedback(opciones.tipo || tipoPorDefecto)}"></i>
            </div>
            <div>
              <h3>${escapeFeedbackHtml(opciones.titulo || tituloFeedback(opciones.tipo || tipoPorDefecto))}</h3>
            </div>
          </div>
          <div class="sgd-dialog-body">
            <div class="sgd-dialog-message">${renderTextoFeedback(opciones.mensaje || "")}</div>
          </div>
          <div class="sgd-dialog-actions">
            <button type="button" class="btn btn-primary sgd-dialog-confirm">${escapeFeedbackHtml(
              opciones.textoBoton || "Entendido"
            )}</button>
          </div>
        </div>
      `;

      const cerrar = () => {
        backdrop.remove();
        sincronizarEstadoModalBody();
        resolve(true);
      };

      backdrop.querySelector(".sgd-dialog-confirm")?.addEventListener("click", cerrar);
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) cerrar();
      });
      backdrop.addEventListener("keydown", (event) => {
        if (event.key === "Escape" || event.key === "Enter") {
          event.preventDefault();
          cerrar();
        }
      });

      root.appendChild(backdrop);
      sincronizarEstadoModalBody();
      backdrop.querySelector(".sgd-dialog-confirm")?.focus();
    });
  };

  window.mostrarConfirmacion = function (config) {
    const opciones =
      typeof config === "object" && config !== null
        ? { ...config }
        : { mensaje: config };

    return new Promise((resolve) => {
      const { root } = asegurarInfraestructuraFeedback();
      const backdrop = document.createElement("div");
      backdrop.className = `sgd-dialog-backdrop is-open tipo-${opciones.tipo || "warning"}`;
      backdrop.innerHTML = `
        <div class="sgd-dialog sgd-dialog-sm" role="dialog" aria-modal="true">
          <div class="sgd-dialog-header">
            <div class="sgd-dialog-badge">
              <i class="fas ${iconoFeedback(opciones.tipo || "warning")}"></i>
            </div>
            <div>
              <h3>${escapeFeedbackHtml(opciones.titulo || "Confirmar acción")}</h3>
            </div>
          </div>
          <div class="sgd-dialog-body">
            <div class="sgd-dialog-message">${renderTextoFeedback(opciones.mensaje || "")}</div>
          </div>
          <div class="sgd-dialog-actions">
            <button type="button" class="btn btn-outline sgd-dialog-cancel">${escapeFeedbackHtml(
              opciones.textoCancelar || "Cancelar"
            )}</button>
            <button type="button" class="btn ${escapeFeedbackHtml(
              opciones.claseConfirmar || (opciones.peligro ? "btn-danger" : "btn-primary")
            )} sgd-dialog-confirm">${escapeFeedbackHtml(opciones.textoConfirmar || "Confirmar")}</button>
          </div>
        </div>
      `;

      const cerrar = (valor) => {
        backdrop.remove();
        sincronizarEstadoModalBody();
        resolve(Boolean(valor));
      };

      backdrop.querySelector(".sgd-dialog-cancel")?.addEventListener("click", () => cerrar(false));
      backdrop.querySelector(".sgd-dialog-confirm")?.addEventListener("click", () => cerrar(true));
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) cerrar(false);
      });
      backdrop.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cerrar(false);
        }
      });

      root.appendChild(backdrop);
      sincronizarEstadoModalBody();
      backdrop.querySelector(".sgd-dialog-confirm")?.focus();
    });
  };

  window.mostrarFormularioModal = function (config = {}) {
    const opciones = {
      titulo: "Editar datos",
      mensaje: "",
      tipo: "info",
      textoConfirmar: "Guardar",
      textoCancelar: "Cancelar",
      claseConfirmar: "btn-primary",
      campos: [],
      ...config,
    };

    return new Promise((resolve) => {
      const { root } = asegurarInfraestructuraFeedback();
      const backdrop = document.createElement("div");
      backdrop.className = `sgd-dialog-backdrop is-open tipo-${opciones.tipo}`;
      const anchoClase = opciones.ancho === "lg" ? "sgd-dialog-lg" : opciones.ancho === "sm" ? "sgd-dialog-sm" : "sgd-dialog-md";
      const bodyMensaje = opciones.mensaje
        ? `<div class="sgd-dialog-message">${renderTextoFeedback(opciones.mensaje)}</div>`
        : "";
      backdrop.innerHTML = `
        <div class="sgd-dialog ${anchoClase}" role="dialog" aria-modal="true">
          <div class="sgd-dialog-header">
            <div class="sgd-dialog-badge">
              <i class="fas ${iconoFeedback(opciones.tipo)}"></i>
            </div>
            <div>
              <h3>${escapeFeedbackHtml(opciones.titulo)}</h3>
            </div>
          </div>
          <form class="sgd-dialog-form">
            <div class="sgd-dialog-body">
              ${bodyMensaje}
              <div class="sgd-form-grid"></div>
              <div class="sgd-dialog-error" hidden></div>
            </div>
            <div class="sgd-dialog-actions">
              <button type="button" class="btn btn-outline sgd-dialog-cancel">${escapeFeedbackHtml(
                opciones.textoCancelar
              )}</button>
              <button type="submit" class="btn ${escapeFeedbackHtml(
                opciones.claseConfirmar
              )} sgd-dialog-confirm">${escapeFeedbackHtml(opciones.textoConfirmar)}</button>
            </div>
          </form>
        </div>
      `;

      const form = backdrop.querySelector(".sgd-dialog-form");
      const grid = backdrop.querySelector(".sgd-form-grid");
      const errorBox = backdrop.querySelector(".sgd-dialog-error");
      const controls = new Map();

      const cerrar = (valor) => {
        backdrop.remove();
        sincronizarEstadoModalBody();
        resolve(valor);
      };

      const setError = (mensaje) => {
        if (!errorBox) return;
        const limpio = String(mensaje || "").trim();
        errorBox.hidden = !limpio;
        errorBox.textContent = limpio;
      };

      (Array.isArray(opciones.campos) ? opciones.campos : []).forEach((campo) => {
        const field = document.createElement("label");
        field.className = `sgd-field ${campo.span === 2 ? "is-full" : ""}`;
        const label = document.createElement("span");
        label.className = "sgd-field-label";
        label.textContent = campo.label || campo.name || "Campo";
        field.appendChild(label);

        let control;
        if (campo.type === "textarea") {
          control = document.createElement("textarea");
          control.rows = Number(campo.rows) > 0 ? Number(campo.rows) : 3;
          control.value = campo.value ?? "";
        } else if (campo.type === "select") {
          control = document.createElement("select");
          const opcionesSelect = Array.isArray(campo.options) ? campo.options : [];
          opcionesSelect.forEach((opt) => {
            const option = document.createElement("option");
            option.value = String(opt?.value ?? "");
            option.textContent = String(opt?.label ?? opt?.text ?? opt?.value ?? "");
            if (String(campo.value ?? "") === option.value) option.selected = true;
            control.appendChild(option);
          });
        } else {
          control = document.createElement("input");
          control.type = campo.type || "text";
          control.value = campo.value ?? "";
        }

        control.name = campo.name || "";
        control.className = "sgd-field-control";
        if (campo.placeholder) control.placeholder = campo.placeholder;
        if (campo.required) control.required = true;
        if (campo.min !== undefined) control.min = String(campo.min);
        if (campo.max !== undefined) control.max = String(campo.max);
        if (campo.step !== undefined) control.step = String(campo.step);
        if (campo.pattern) control.pattern = campo.pattern;
        if (campo.inputMode) control.setAttribute("inputmode", campo.inputMode);
        if (campo.autocomplete) control.setAttribute("autocomplete", campo.autocomplete);

        controls.set(campo.name, { control, config: campo });
        field.appendChild(control);

        if (campo.hint) {
          const hint = document.createElement("small");
          hint.className = "sgd-field-hint";
          hint.textContent = campo.hint;
          field.appendChild(hint);
        }

        grid?.appendChild(field);
      });

      backdrop.querySelector(".sgd-dialog-cancel")?.addEventListener("click", () => cerrar(null));
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) cerrar(null);
      });
      backdrop.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cerrar(null);
        }
      });

      form?.addEventListener("submit", (event) => {
        event.preventDefault();
        setError("");

        const values = {};
        for (const [name, item] of controls.entries()) {
          const { control, config: campo } = item;
          const value = campo.type === "checkbox" ? Boolean(control.checked) : String(control.value ?? "");
          if (!control.checkValidity()) {
            setError(control.validationMessage || `Revisa el campo ${campo.label || name}`);
            control.focus();
            return;
          }
          if (typeof campo.validate === "function") {
            const resultado = campo.validate(value, values);
            if (typeof resultado === "string" && resultado.trim()) {
              setError(resultado);
              control.focus();
              return;
            }
          }
          values[name] = value;
        }

        cerrar(values);
      });

      root.appendChild(backdrop);
      sincronizarEstadoModalBody();
      const primerControl = backdrop.querySelector(".sgd-field-control");
      if (primerControl) primerControl.focus();
      else backdrop.querySelector(".sgd-dialog-confirm")?.focus();
    });
  };

  window.mostrarPrompt = function (config, valorInicial = "", opcionesExtra = {}) {
    const opciones =
      typeof config === "object" && config !== null
        ? { ...config }
        : {
            titulo: "Ingresar dato",
            mensaje: String(config || ""),
            value: valorInicial,
            ...opcionesExtra,
          };

    const campoNombre = opciones.name || "valor";
    return window
      .mostrarFormularioModal({
        titulo: opciones.titulo || "Ingresar dato",
        mensaje: opciones.mensaje || "",
        tipo: opciones.tipo || "info",
        textoConfirmar: opciones.textoConfirmar || "Aceptar",
        textoCancelar: opciones.textoCancelar || "Cancelar",
        claseConfirmar: opciones.claseConfirmar || "btn-primary",
        ancho: opciones.ancho || "sm",
        campos: [
          {
            name: campoNombre,
            label: opciones.label || "Valor",
            type: opciones.inputType || opciones.type || "text",
            value: opciones.value ?? valorInicial ?? "",
            placeholder: opciones.placeholder || "",
            required: opciones.required === true,
            min: opciones.min,
            max: opciones.max,
            step: opciones.step,
            pattern: opciones.pattern,
            rows: opciones.rows,
            options: opciones.options,
            hint: opciones.hint,
            validate: opciones.validate,
            span: 2,
          },
        ],
      })
      .then((result) => (result ? result[campoNombre] : null));
  };

  window.abrirModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.style.display = "flex";
    modal.classList.add("open");
    sincronizarEstadoModalBody();
  };

  window.cerrarModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.style.display = "none";
    modal.classList.remove("open");
    sincronizarEstadoModalBody();
  };

  function aplicarSidebarPorRol(user) {
    const sidebarNav = document.querySelector(".sidebar-nav");
    if (!sidebarNav) return;

    const linkEventos = sidebarNav.querySelector('a[href="eventos.html"]');
    if (linkEventos) linkEventos.innerHTML = '<i class="fas fa-calendar-alt"></i> Categorías';
    sidebarNav.querySelectorAll('a[href="eliminatorias.html"]').forEach((link) => link.remove());

    const ensureNavLink = (href, html, isActive) => {
      let link = sidebarNav.querySelector(`a[href="${href}"]`);
      if (!link) {
        link = document.createElement("a");
        link.className = `nav-btn${isActive ? " active" : ""}`;
        link.href = href;
        link.innerHTML = html;
        const portalLink = sidebarNav.querySelector('a[href="index.html"]');
        if (portalLink) sidebarNav.insertBefore(link, portalLink);
        else sidebarNav.appendChild(link);
        return;
      }
      link.innerHTML = html;
      link.classList.toggle("active", Boolean(isActive));
    };

    ensureNavLink(
      "finanzas.html",
      '<i class="fas fa-wallet"></i> Finanzas',
      window.location.pathname.endsWith("finanzas.html")
    );
    ensureNavLink(
      "pases.html",
      '<i class="fas fa-people-arrows"></i> Pases',
      window.location.pathname.endsWith("pases.html")
    );
    ensureNavLink(
      "organizador-portal.html",
      '<i class="fas fa-globe"></i> Mi Landing',
      window.location.pathname.endsWith("organizador-portal.html")
    );
    ensureNavLink(
      "usuarios.html",
      '<i class="fas fa-user-shield"></i> Usuarios',
      window.location.pathname.endsWith("usuarios.html")
    );
    ensureNavLink(
      "noticias.html",
      '<i class="fas fa-rss"></i> Noticias',
      window.location.pathname.endsWith("noticias.html")
    );
    ensureNavLink(
      "galeria-admin.html",
      '<i class="fas fa-images"></i> Galería',
      window.location.pathname.endsWith("galeria-admin.html")
    );
    ensureNavLink(
      "contenido-portal.html",
      '<i class="fas fa-id-card"></i> Contenido',
      window.location.pathname.endsWith("contenido-portal.html")
    );
    ensureNavLink(
      "contacto-admin.html",
      '<i class="fas fa-envelope-open-text"></i> Contacto',
      window.location.pathname.endsWith("contacto-admin.html")
    );

    const tecnicoRestricted = [
      "campeonatos.html",
      "eventos.html",
      "sorteo.html",
      "gruposgen.html",
      "partidos.html",
      "planilla.html",
      "auspiciantes.html",
      "portal-admin.html",
      "usuarios.html",
    ];

    if (esOperadorPortal(user)) {
      [
        "campeonatos.html",
        "eventos.html",
        "equipos.html",
        "jugadores.html",
        "sorteo.html",
        "gruposgen.html",
        "partidos.html",
        "planilla.html",
        "auspiciantes.html",
        "finanzas.html",
        "pases.html",
        "tablas.html",
        "usuarios.html",
        "portal-admin.html",
        "portal-tecnico.html",
      ].forEach((href) => {
        const link = sidebarNav.querySelector(`a[href="${href}"]`);
        if (link) link.remove();
      });
      ensureNavLink(
        "portal-cms.html",
        '<i class="fas fa-newspaper"></i> Portal CMS',
        window.location.pathname.endsWith("portal-cms.html")
      );
      ensureNavLink(
        "noticias.html",
        '<i class="fas fa-rss"></i> Noticias',
        window.location.pathname.endsWith("noticias.html")
      );
    } else if (esTecnicoOdirigente(user)) {
      tecnicoRestricted.forEach((href) => {
        const link = sidebarNav.querySelector(`a[href="${href}"]`);
        if (link) link.remove();
      });
      ensureNavLink(
        "portal-tecnico.html",
        '<i class="fas fa-user-shield"></i> Mi Portal',
        window.location.pathname.endsWith("portal-tecnico.html")
      );
      if (esJugador(user)) {
        document.querySelectorAll('a[href="pases.html"]').forEach((lnk) => lnk.remove());
      }
    } else {
      const rol = String(user?.rol || "").toLowerCase();
      if (rol !== "administrador" && rol !== "organizador") {
        document.querySelectorAll('a[href="usuarios.html"]').forEach((lnk) => lnk.remove());
      }
      if (rol !== "organizador") {
        document.querySelectorAll('a[href="organizador-portal.html"]').forEach((lnk) => lnk.remove());
      }
      if (rol !== "administrador") {
        document.querySelectorAll('a[href="noticias.html"]').forEach((lnk) => lnk.remove());
      }
      if (rol !== "administrador") {
        document.querySelectorAll('a[href="galeria-admin.html"]').forEach((lnk) => lnk.remove());
        document.querySelectorAll('a[href="contenido-portal.html"]').forEach((lnk) => lnk.remove());
        document.querySelectorAll('a[href="contacto-admin.html"]').forEach((lnk) => lnk.remove());
      }
      ensureNavLink(
        "portal-admin.html",
        '<i class="fas fa-user-cog"></i> Portal Deportivo',
        window.location.pathname.endsWith("portal-admin.html")
      );
      if (rol === "administrador") {
        ensureNavLink(
          "portal-cms.html",
          '<i class="fas fa-newspaper"></i> Portal CMS',
          window.location.pathname.endsWith("portal-cms.html")
        );
        ensureNavLink(
          "galeria-admin.html",
          '<i class="fas fa-images"></i> Galería',
          window.location.pathname.endsWith("galeria-admin.html")
        );
        ensureNavLink(
          "contenido-portal.html",
          '<i class="fas fa-id-card"></i> Contenido',
          window.location.pathname.endsWith("contenido-portal.html")
        );
        ensureNavLink(
          "contacto-admin.html",
          '<i class="fas fa-envelope-open-text"></i> Contacto',
          window.location.pathname.endsWith("contacto-admin.html")
        );
      }
    }

    let logout = sidebarNav.querySelector('a[data-action="logout"]');
    if (!logout) {
      logout = document.createElement("a");
      logout.href = "#";
      logout.className = "nav-btn";
      logout.dataset.action = "logout";
      logout.innerHTML = '<i class="fas fa-right-from-bracket"></i> Cerrar sesión';
      logout.addEventListener("click", (e) => {
        e.preventDefault();
        window.Auth.logout();
      });
      sidebarNav.appendChild(logout);
    }
  }

  function inyectarUsuarioTopbar(user) {
    const topBar = document.querySelector(".top-bar");
    if (!topBar || !user) return;

    let actions = topBar.querySelector(".top-user-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "top-user-actions";
      topBar.appendChild(actions);
    }

    let badge = actions.querySelector(".top-user-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "top-user-badge";
      badge.style.padding = "6px 10px";
      badge.style.borderRadius = "8px";
      badge.style.background = "rgba(15,23,42,.08)";
      badge.style.fontSize = "12px";
      badge.style.fontWeight = "700";
      actions.appendChild(badge);
    }
    const rol = String(user.rol || "").toUpperCase();
    const lectura = user?.solo_lectura === true ? " | SOLO LECTURA" : "";
    const passwordPendiente = user?.debe_cambiar_password === true ? " | CAMBIO CLAVE PENDIENTE" : "";
    badge.textContent = `${user.nombre || user.email || "Usuario"} (${rol}${lectura})`;
    badge.textContent += passwordPendiente;

    let btnPassword = actions.querySelector(".top-user-password-btn");
    if (!btnPassword) {
      btnPassword = document.createElement("button");
      btnPassword.type = "button";
      btnPassword.className = "btn btn-outline top-user-password-btn";
      btnPassword.innerHTML = '<i class="fas fa-key"></i> Cambiar clave';
      btnPassword.addEventListener("click", async () => {
        await window.Auth.promptChangePassword({ forced: false });
      });
      actions.appendChild(btnPassword);
    }

    let btnLogoutTop = actions.querySelector(".top-user-logout-btn");
    if (!btnLogoutTop) {
      btnLogoutTop = document.createElement("button");
      btnLogoutTop.type = "button";
      btnLogoutTop.className = "btn btn-danger top-user-logout-btn";
      btnLogoutTop.innerHTML = '<i class="fas fa-right-from-bracket"></i> Salir';
      btnLogoutTop.addEventListener("click", () => {
        window.Auth.logout();
      });
      actions.appendChild(btnLogoutTop);
    }
  }

  function obtenerEquipoIdsUsuario(user) {
    if (!Array.isArray(user?.equipo_ids)) return [];
    return user.equipo_ids
      .map((x) => Number.parseInt(x, 10))
      .filter((x) => Number.isFinite(x) && x > 0);
  }

  function formatearMoneda(valor) {
    const n = Number.parseFloat(valor);
    const monto = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(monto);
  }

  async function obtenerResumenDeudaEquipo(equipoId, token) {
    const resp = await fetch(`${window.API_BASE_URL}/finanzas/equipos/${equipoId}/estado-cuenta`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const saldo = Number.parseFloat(data?.resumen?.saldo || 0);
    if (!Number.isFinite(saldo) || saldo <= 0) return null;
    return {
      equipo_id: Number.parseInt(data?.equipo?.id || equipoId, 10) || equipoId,
      equipo_nombre: String(data?.equipo?.nombre || `Equipo ${equipoId}`),
      saldo: Number(saldo.toFixed(2)),
    };
  }

  async function mostrarAvisoDeudaEquiposUsuario(user) {
    if (!esUsuarioEquipoConAvisoDeuda(user)) return;
    const token = window.Auth?.getToken?.();
    if (!token) return;

    const equipoIds = obtenerEquipoIdsUsuario(user);
    if (!equipoIds.length) return;

    try {
      const resultados = await Promise.all(
        equipoIds.slice(0, 6).map((equipoId) => obtenerResumenDeudaEquipo(equipoId, token))
      );
      const deudas = resultados.filter((item) => item && item.saldo > 0);
      if (!deudas.length) return;

      const keyDetalle = deudas
        .map((item) => `${item.equipo_id}:${item.saldo.toFixed(2)}`)
        .sort()
        .join("|");
      const key = `sgd_deuda_notice_${user.id}_${keyDetalle}`;
      if (sessionStorage.getItem(key)) return;

      Object.keys(sessionStorage)
        .filter((k) => k.startsWith(`sgd_deuda_notice_${user.id}_`))
        .forEach((k) => sessionStorage.removeItem(k));
      sessionStorage.setItem(key, "1");

      const resumen = deudas
        .slice(0, 3)
        .map((item) => `${item.equipo_nombre}: ${formatearMoneda(item.saldo)}`)
        .join(" | ");
      const extra = deudas.length > 3 ? ` +${deudas.length - 3} equipo(s)` : "";
      const mensaje = `Adeudado hasta el momento: ${resumen}${extra}`;
      mostrarNotificacion(mensaje, "warning");

      const banner = document.getElementById("aviso-deuda-equipo");
      const detalle = document.getElementById("aviso-deuda-equipo-detalle");
      if (banner && detalle) {
        detalle.textContent = mensaje;
        banner.style.display = "block";
      }
    } catch (error) {
      console.warn("No se pudo obtener aviso de deuda del equipo:", error?.message || error);
    }
  }

  function initMenuMovil() {
    const toggle = document.getElementById("nav-toggle");
    const sidebar = document.getElementById("sidebar");
    const nav = document.getElementById("main-nav");
    let overlay = document.getElementById("nav-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "nav-overlay";
      overlay.className = "nav-overlay";
      document.body.appendChild(overlay);
    }

    const target = sidebar || nav;
    if (!target) return;

    const SIDEBAR_MOBILE_BREAKPOINT = sidebar ? 1200 : 768;
    function isMobile() {
      return window.innerWidth <= SIDEBAR_MOBILE_BREAKPOINT;
    }
    function setInitialState() {
      if (sidebar) {
        sidebar.classList.add("collapsed");
        sidebar.classList.remove("nav-open");
        overlay.classList.remove("active");
        return;
      }

      if (isMobile()) {
        target.classList.add("collapsed");
        target.classList.remove("nav-open");
        overlay.classList.remove("active");
      } else {
        target.classList.remove("collapsed");
        target.classList.remove("nav-open");
        overlay.classList.remove("active");
      }
    }

    setInitialState();
    window.addEventListener("resize", setInitialState);

    if (toggle && target) {
      toggle.addEventListener("click", () => {
        if (isMobile()) {
          target.classList.toggle("nav-open");
          overlay.classList.toggle("active");
        } else {
          target.classList.toggle("collapsed");
        }
      });
    }

    overlay.addEventListener("click", () => {
      if (sidebar) sidebar.classList.remove("nav-open");
      if (nav) nav.classList.remove("nav-open");
      overlay.classList.remove("active");
    });
  }

  async function validarAccesoPagina() {
    const page = CURRENT_PAGE;
    const token = window.Auth.getToken();

    if (!token) {
      if (!PUBLIC_PAGES.has(page)) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `login.html?next=${next}`;
        return false;
      }
      return true;
    }

    if (window.Auth.hasIdleExpired()) {
      await window.Auth.logout({
        reason: "idle",
        redirect: !PUBLIC_PAGES.has(page),
        revoke: true,
      });
      return PUBLIC_PAGES.has(page);
    }

    const user = (await validarSesionActual()) || null;
    if (!user) {
      window.Auth.clearSession();
      if (!PUBLIC_PAGES.has(page)) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `login.html?next=${next}`;
        return false;
      }
      return true;
    }

    if (page === "login.html" || page === "register.html") {
      window.location.href = getDefaultPageByRole(user);
      return false;
    }

    if (!canAccessPage(user, page)) {
      window.location.href = getDefaultPageByRole(user);
      return false;
    }

    return true;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const autorizado = await validarAccesoPagina();
    if (!autorizado) return;

    const user = window.Auth.getUser();
    if (window.Auth.isAuthenticated()) {
      window.Auth.touchSession(true);
    }
    aplicarSidebarPorRol(user);
    inyectarUsuarioTopbar(user);
    setAuthPendingState(false);
    if (window.Auth.requiresPasswordChange() && !PUBLIC_PAGES.has(getCurrentPage())) {
      const actualizada = await window.Auth.promptChangePassword({ forced: true });
      if (!actualizada) return;
    }
    initMenuMovil();
    mostrarAvisoDeudaEquiposUsuario(user);
  });

  window.getQueryParam = function (key) {
    const url = new URL(window.location.href);
    return url.searchParams.get(key);
  };
})();
