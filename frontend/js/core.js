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

    function isMobile() {
      return window.innerWidth <= 768;
    }
    function setInitialState() {
      if (isMobile()) {
        target.classList.add("collapsed");
        target.classList.remove("nav-open");
      } else {
        target.classList.remove("collapsed");
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
