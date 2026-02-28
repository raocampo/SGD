// frontend/js/core.js

(function () {
  window.API_BASE_URL = window.API_BASE_URL || "http://localhost:5000/api";

  const AUTH_TOKEN_KEY = "sgd_auth_token";
  const AUTH_USER_KEY = "sgd_auth_user";
  const BRAND_FAVICON_SVG = "assets/ltc/favicon.svg";
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

  function getCurrentPage() {
    const path = window.location.pathname || "";
    const page = path.split("/").pop() || "index.html";
    return page.toLowerCase();
  }

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
    return rol === "tecnico" || rol === "dirigente";
  }

  function esOperadorPortal(user) {
    return String(user?.rol || "").toLowerCase() === "operador";
  }

  function getDefaultPageByRole(user) {
    if (!user) return "login.html";
    const rol = String(user.rol || "").toLowerCase();
    if (rol === "operador") return "portal-cms.html";
    if (rol === "administrador" || rol === "organizador") return "portal-admin.html";
    if (rol === "tecnico" || rol === "dirigente") return "portal-tecnico.html";
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
    getUser() {
      return getStoredUser();
    },
    setSession(token, user) {
      if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
      setStoredUser(user || null);
    },
    clearSession() {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
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
    getDefaultPage() {
      return getDefaultPageByRole(this.getUser());
    },
    logout() {
      this.clearSession();
      window.location.href = "login.html";
    },
    handleUnauthorized() {
      const page = getCurrentPage();
      this.clearSession();
      if (!PUBLIC_PAGES.has(page)) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `login.html?next=${next}`;
      }
    },
  };

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

      const headers = new Headers(init?.headers || (typeof input !== "string" ? input?.headers : undefined) || {});
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      return nativeFetch(input, { ...init, headers });
    };
    window.__sgdFetchAuthPatched = true;
  }

  window.mostrarNotificacion = function (mensaje, tipo = "info") {
    console.log(`${tipo.toUpperCase()}: ${mensaje}`);

    const existing = document.querySelector(".toast-notificacion");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "toast-notificacion";
    toast.textContent = mensaje;
    toast.style.position = "fixed";
    toast.style.top = "20px";
    toast.style.right = "20px";
    toast.style.zIndex = 9999;
    toast.style.padding = "12px 16px";
    toast.style.borderRadius = "10px";
    toast.style.color = "#fff";
    toast.style.fontWeight = "600";
    toast.style.boxShadow = "0 10px 25px rgba(0,0,0,.2)";
    toast.style.background =
      tipo === "success"
        ? "#16a34a"
        : tipo === "error"
        ? "#ef4444"
        : tipo === "warning"
        ? "#f59e0b"
        : "#3b82f6";

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  window.abrirModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.style.display = "flex";
    modal.classList.add("open");
    document.body.classList.add("modal-open");
  };

  window.cerrarModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.style.display = "none";
    modal.classList.remove("open");
    if (!document.querySelector(".modal.open")) {
      document.body.classList.remove("modal-open");
    }
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
    } else {
      const rol = String(user?.rol || "").toLowerCase();
      if (rol !== "administrador" && rol !== "organizador") {
        document.querySelectorAll('a[href="usuarios.html"]').forEach((lnk) => lnk.remove());
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

    let badge = topBar.querySelector(".top-user-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "top-user-badge";
      badge.style.marginLeft = "auto";
      badge.style.padding = "6px 10px";
      badge.style.borderRadius = "8px";
      badge.style.background = "rgba(15,23,42,.08)";
      badge.style.fontSize = "12px";
      badge.style.fontWeight = "700";
      topBar.appendChild(badge);
    }
    const rol = String(user.rol || "").toUpperCase();
    const lectura = user?.solo_lectura === true ? " | SOLO LECTURA" : "";
    badge.textContent = `${user.nombre || user.email || "Usuario"} (${rol}${lectura})`;
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
    const page = getCurrentPage();
    const token = window.Auth.getToken();

    if (!token) {
      if (!PUBLIC_PAGES.has(page)) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `login.html?next=${next}`;
        return false;
      }
      return true;
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
    aplicarSidebarPorRol(user);
    inyectarUsuarioTopbar(user);
    initMenuMovil();
  });

  window.getQueryParam = function (key) {
    const url = new URL(window.location.href);
    return url.searchParams.get(key);
  };
})();

