// core.js
// ======================
// Estado global base
// ======================
window.AppState = window.AppState || {
  campeonatos: [],
  equipos: [],
  grupos: [],
  sorteo: {
    campeonatoSeleccionado: null,
    equiposPendientes: [],
    gruposCreados: []
  }
};

// ======================
// Notificaciones
// ======================
function mostrarNotificacion(mensaje, tipo = "info") {
  console.log(`${tipo.toUpperCase()}: ${mensaje}`);

  const existing = document.querySelectorAll(".notification");
  if (existing.length > 5) {
    existing[0].remove();
  }

  const noti = document.createElement("div");
  noti.className = `notification ${tipo}`;
  noti.textContent = mensaje;

  document.body.appendChild(noti);

  setTimeout(() => {
    if (noti.parentNode) {
      noti.remove();
    }
  }, 3000);
}

// ======================
// Overlay de "cargando"
// ======================
let overlayCargando = null;

function mostrarCargando(texto = "Cargando...") {
  if (!document.body) return;

  if (!overlayCargando) {
    overlayCargando = document.createElement("div");
    overlayCargando.style.position = "fixed";
    overlayCargando.style.inset = "0";
    overlayCargando.style.background = "rgba(0,0,0,0.35)";
    overlayCargando.style.display = "flex";
    overlayCargando.style.alignItems = "center";
    overlayCargando.style.justifyContent = "center";
    overlayCargando.style.zIndex = "9999";
    overlayCargando.innerHTML = `
      <div style="
        background: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        font-size: 0.95rem;
        display: flex;
        align-items: center;
        gap: .6rem;
      ">
        <span class="spinner" style="
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid #3498db;
          border-top-color: transparent;
          animation: spin 0.7s linear infinite;
        "></span>
        <span id="texto-cargando">${texto}</span>
      </div>
    `;
    document.body.appendChild(overlayCargando);
  } else {
    const textoEl = overlayCargando.querySelector("#texto-cargando");
    if (textoEl) textoEl.textContent = texto;
    overlayCargando.style.display = "flex";
  }
}

function ocultarCargando() {
  if (overlayCargando) {
    overlayCargando.style.display = "none";
  }
}

// ======================
// Modales
// ======================
function abrirModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = "flex";  /*block*/
  }
}

function cerrarModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = "none";
  }
}

// 🔁 Compatibilidad con código antiguo (mostrarModal / ocultarModal)
function mostrarModal(id) {
  console.warn("mostrarModal está deprecado, usa abrirModal(id)");
  abrirModal(id);
}

function ocultarModal(id) {
  console.warn("ocultarModal está deprecado, usa cerrarModal(id)");
  cerrarModal(id);
}

// ======================
// Menú hamburguesa
// ======================
function inicializarMenuHamburguesa() {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("main-nav");

  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    nav.classList.toggle("nav-open");
  });

  nav.querySelectorAll("a.nav-btn").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("nav-open");
    });
  });
}

// ======================
// Bootstrap global
// ======================
document.addEventListener("DOMContentLoaded", () => {
  inicializarMenuHamburguesa();
});
