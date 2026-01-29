// frontend/js/campeonatos.js

// ======================
// Carga inicial
// ======================
document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("campeonatos.html")) return;

  await cargarCampeonatos();

  // Toggle menú responsive
  const navToggle = document.getElementById("nav-toggle");
  const mainNav = document.getElementById("main-nav");
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", () => {
      // 👇 coincide con .nav.nav-open del CSS
      mainNav.classList.toggle("nav-open");
    });
  }
});

// ======================
// Cargar campeonatos
// ======================
async function cargarCampeonatos() {
  const cont = document.getElementById("lista-campeonatos");
  if (!cont) return;

  cont.innerHTML = "<p>Cargando campeonatos...</p>";

  try {
    const data = await ApiClient.get("/campeonatos");

    let campeonatos = [];
    if (Array.isArray(data)) campeonatos = data;
    else if (data.campeonatos && Array.isArray(data.campeonatos))
      campeonatos = data.campeonatos;
    else if (data.data && Array.isArray(data.data)) campeonatos = data.data;

    if (campeonatos.length === 0) {
      cont.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-trophy"></i>
          <p>No hay campeonatos registrados.</p>
        </div>`;
      return;
    }

    cont.innerHTML = "";
    campeonatos.forEach((camp) => {
      const card = document.createElement("div");
      card.className = "campeonato-card";

      const tipoFutbol =
        camp.tipo_futbol === "futbol_11"
          ? "Fútbol 11"
          : camp.tipo_futbol === "futbol_7"
          ? "Fútbol 7"
          : camp.tipo_futbol === "futbol_5"
          ? "Fútbol 5"
          : camp.tipo_futbol || "N/A";

      const sistema =
        camp.sistema_puntuacion === "shootouts"
          ? "Con Shootouts"
          : "Tradicional";

      const fechaInicio = camp.fecha_inicio || "-";
      const fechaFin = camp.fecha_fin || "-";

      // ==========================
      //  LOGO DEL CAMPEONATO
      // ==========================
      let logoSrc = null;

      if (camp.logo_url) {
        // si logo_url ya viene con / al inicio, lo dejamos; si no, se lo ponemos
        const relativePath = camp.logo_url.startsWith("/")
          ? camp.logo_url
          : `/${camp.logo_url}`;

        // 👇 IMPORTANTE: usamos BACKEND_ORIGIN, NO API_BASE_URL
        // Resultado: http://localhost:5000/uploads/campeonatos/xxxxx.jpg
        logoSrc = `${BACKEND_ORIGIN}${relativePath}`;
      }

      const logoHtml = logoSrc
        ? `<img src="${logoSrc}" alt="logo campeonato" class="campeonato-logo">`
        : `<div class="campeonato-logo placeholder"><i class="fas fa-trophy"></i></div>`;

      card.innerHTML = `
        <div class="campeonato-header">
          ${logoHtml}
          <div>
            <h3>${camp.nombre}</h3>
            <p class="camp-organizador">
              <strong>Organiza:</strong> ${camp.organizador || "No registrado"}
            </p>
          </div>
        </div>

        <div class="campeonato-info">
          <p><strong>Tipo:</strong> ${tipoFutbol}</p>
          <p><strong>Sistema:</strong> ${sistema}</p>
          <p><strong>Fechas:</strong> ${fechaInicio} - ${fechaFin}</p>
          <p><strong>Jugadores:</strong> 
            ${camp.min_jugador || "Mín"} - ${camp.max_jugador || "Máx"}</p>
        </div>

        <div class="campeonato-actions">
          <button class="btn btn-primary" onclick="irAGestionEquipos(${camp.id})">
            <i class="fas fa-users"></i> Equipos
          </button>
          <button class="btn btn-secondary" onclick="irASorteo(${camp.id})">
            <i class="fas fa-random"></i> Sorteo
          </button>
          <button class="btn btn-warning" onclick="editarCampeonato(${camp.id})">
            <i class="fas fa-edit"></i> Editar
          </button>
          <button class="btn btn-danger" onclick="eliminarCampeonato(${camp.id})">
            <i class="fas fa-trash"></i> Eliminar
          </button>
        </div>
      `;
      cont.appendChild(card);
    });
  } catch (error) {
    console.error("Error cargando campeonatos:", error);
    mostrarNotificacion("Error cargando campeonatos", "error");
    cont.innerHTML = "<p>Error cargando campeonatos.</p>";
  }
}

// ======================
// Navegación a otras pantallas
// ======================
function irAGestionEquipos(campeonatoId) {
  window.location.href = `equipos.html?campeonato=${campeonatoId}`;
}

function irASorteo(campeonatoId) {
  window.location.href = `sorteo.html?campeonato=${campeonatoId}`;
}

// ======================
// Modal Crear / Editar
// ======================
function mostrarModalCrearCampeonato() {
  const titulo = document.getElementById("modal-campeonato-titulo");
  const form = document.getElementById("form-campeonato");

  if (titulo) titulo.textContent = "Nuevo Campeonato";
  if (form) form.reset();

  document.getElementById("campeonato-id").value = "";

  // Valores por defecto de colores
  const colorPrimario = document.getElementById("campeonato-color-primario");
  const colorSecundario = document.getElementById("campeonato-color-secundario");
  const colorAcento = document.getElementById("campeonato-color-acento");
  if (colorPrimario) colorPrimario.value = "#FACC15";
  if (colorSecundario) colorSecundario.value = "#111827";
  if (colorAcento) colorAcento.value = "#22C55E";

  abrirModal("modal-campeonato");
}

async function editarCampeonato(id) {
  try {
    const data = await ApiClient.get(`/campeonatos/${id}`);
    const camp = data.campeonato || data;

    const titulo = document.getElementById("modal-campeonato-titulo");
    if (titulo) titulo.textContent = "Editar Campeonato";

    document.getElementById("campeonato-id").value = camp.id;
    document.getElementById("campeonato-nombre").value = camp.nombre || "";
    document.getElementById("campeonato-organizador").value =
      camp.organizador || "";

    document.getElementById("campeonato-tipo").value =
      camp.tipo_futbol || "futbol_11";

    document.getElementById("campeonato-sistema").value =
      camp.sistema_puntuacion || "tradicional";

    document.getElementById("campeonato-fecha-inicio").value =
      camp.fecha_inicio || "";
    document.getElementById("campeonato-fecha-fin").value =
      camp.fecha_fin || "";

    document.getElementById("campeonato-min-jugadores").value =
      camp.min_jugador || "";
    document.getElementById("campeonato-max-jugadores").value =
      camp.max_jugador || "";

    if (camp.color_primario) {
      document.getElementById("campeonato-color-primario").value =
        camp.color_primario;
    }
    if (camp.color_secundario) {
      document.getElementById("campeonato-color-secundario").value =
        camp.color_secundario;
    }
    if (camp.color_acento) {
      document.getElementById("campeonato-color-acento").value =
        camp.color_acento;
    }

    abrirModal("modal-campeonato");
  } catch (error) {
    console.error("Error cargando campeonato:", error);
    mostrarNotificacion("Error cargando datos del campeonato", "error");
  }
}

// ======================
// Guardar campeonato (crear / editar)
// ======================
document
  .getElementById("form-campeonato")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("campeonato-id").value;

    const nombre = document.getElementById("campeonato-nombre").value.trim();
    const organizador = document
      .getElementById("campeonato-organizador")
      .value.trim();
    const tipo = document.getElementById("campeonato-tipo").value;
    const sistema = document.getElementById("campeonato-sistema").value;
    const fechaInicio = document.getElementById("campeonato-fecha-inicio").value;
    const fechaFin = document.getElementById("campeonato-fecha-fin").value;
    const minJug = document.getElementById("campeonato-min-jugadores").value;
    const maxJug = document.getElementById("campeonato-max-jugadores").value;
    const colorPrimario =
      document.getElementById("campeonato-color-primario").value;
    const colorSecundario =
      document.getElementById("campeonato-color-secundario").value;
    const colorAcento =
      document.getElementById("campeonato-color-acento").value;

    const fileInput = document.getElementById("campeonato-logo");
    const file = fileInput.files[0];

    if (!nombre) {
      mostrarNotificacion("El nombre del campeonato es obligatorio", "error");
      return;
    }

    if (!fechaInicio || !fechaFin) {
      mostrarNotificacion(
        "Las fechas de inicio y fin son obligatorias",
        "error"
      );
      return;
    }

    if (file && file.size > 2 * 1024 * 1024) {
      mostrarNotificacion("El logo no debe superar los 2MB", "error");
      return;
    }

    const fd = new FormData();
    fd.append("nombre", nombre);
    fd.append("organizador", organizador);
    fd.append("tipo_futbol", tipo);
    fd.append("sistema_puntuacion", sistema);
    fd.append("fecha_inicio", fechaInicio);
    fd.append("fecha_fin", fechaFin);
    fd.append("min_jugador", minJug);
    fd.append("max_jugador", maxJug);
    fd.append("color_primario", colorPrimario);
    fd.append("color_secundario", colorSecundario);
    fd.append("color_acento", colorAcento);

    if (file) {
      fd.append("logo", file);
    }

    try {
      if (id) {
        // EDITAR
        const resp = await fetch(`${API_BASE_URL}/campeonatos/${id}`, {
          method: "PUT",
          body: fd,
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || "Error actualizando campeonato");
        }
        mostrarNotificacion("Campeonato actualizado correctamente", "success");
      } else {
        // CREAR
        const resp = await fetch(`${API_BASE_URL}/campeonatos`, {
          method: "POST",
          body: fd,
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || "Error creando campeonato");
        }
        mostrarNotificacion("Campeonato creado correctamente", "success");
      }

      cerrarModal("modal-campeonato");
      await cargarCampeonatos();
    } catch (error) {
      console.error("Error guardando campeonato:", error);
      mostrarNotificacion(
        error.message || "Error guardando el campeonato",
        "error"
      );
    }
  });

// ======================
// Eliminar campeonato
// ======================
async function eliminarCampeonato(id) {
  if (
    !confirm(
      "¿Seguro que deseas eliminar este campeonato? Se eliminarán también sus equipos, grupos y partidos relacionados (si así está implementado en el backend)."
    )
  ) {
    return;
  }

  try {
    await ApiClient.delete(`/campeonatos/${id}`);
    mostrarNotificacion("Campeonato eliminado", "success");
    await cargarCampeonatos();
  } catch (error) {
    console.error("Error eliminando campeonato:", error);
    mostrarNotificacion("Error eliminando el campeonato", "error");
  }
}
