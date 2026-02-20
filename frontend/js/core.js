// frontend/js/core.js

(function () {
  // ✅ Centraliza config aquí (y api.js usa window.API_BASE_URL)
  window.API_BASE_URL = window.API_BASE_URL || "http://localhost:5000/api";

  // =========================
  // Notificaciones
  // =========================
  window.mostrarNotificacion = function (mensaje, tipo = "info") {
    // Si ya tienes un sistema de toast, aquí puedes integrar.
    console.log(`${tipo.toUpperCase()}: ${mensaje}`);

    const existing = document.querySelector(".toast-notificacion");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "toast-notificacion";
    toast.textContent = mensaje;

    // estilos mínimos (si ya tienes CSS, puedes borrar esto)
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

    setTimeout(() => {
      toast.remove();
    }, 3000);
  };

  // =========================
  // Modal helpers
  // =========================
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

  // No cerramos modal por clic fuera.
  // Se cierra solo por accion explicita: boton "X", "Cancelar" o cerrarModal(...).

  // =========================
  // Menú hamburguesa / Sidebar
  // =========================
  document.addEventListener("DOMContentLoaded", () => {
    const sidebarNav = document.querySelector(".sidebar-nav");
    if (sidebarNav) {
      const linkEventos = sidebarNav.querySelector('a[href="eventos.html"]');
      if (linkEventos) linkEventos.innerHTML = '<i class="fas fa-calendar-alt"></i> Categorías';

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
    }

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

    const SIDEBAR_MOBILE_BREAKPOINT = 1200;
    function isMobile() {
      return window.innerWidth <= SIDEBAR_MOBILE_BREAKPOINT;
    }
    function setInitialState() {
      if (sidebar) {
        // Sidebar cerrado por defecto en todo el sistema.
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
  });

  // =========================
  // Querystring helper
  // =========================
  window.getQueryParam = function (key) {
    const url = new URL(window.location.href);
    return url.searchParams.get(key);
  };
})();
