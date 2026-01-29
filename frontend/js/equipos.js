// frontend/js/equipos.js
const API_BASE = "http://localhost:5000/api";  // Asegúrate que este sea el backend correcto
const BACKEND_BASE = "http://localhost:5000"; // Para la URL de los logos

// Función para normalizar la URL del logo
function normalizarLogoUrl(logoUrl) {
  if (!logoUrl) return null;
  // Si ya viene como http(s), devolvemos la URL tal cual
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  // Si el logo es relativo (ejemplo: /uploads/...), añadimos el backend
  if (logoUrl.startsWith("/")) return `${BACKEND_BASE}${logoUrl}`;
  // Si no, agregamos el backend
  return `${BACKEND_BASE}/${logoUrl}`;
}

let campeonatoId = null;
let campeonatoActual = null;

// ======================
// Utilidades URL
// ======================
function obtenerParametroUrl(nombre) {
  const params = new URLSearchParams(window.location.search);
  return params.get(nombre);
}

// ======================
// Carga inicial
// ======================
document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("equipos.html")) {
    return;
  }
  campeonatoId = obtenerParametroUrl("campeonato");

  if (!campeonatoId) {
    mostrarNotificacion("❌ Falta el ID del campeonato", "error");
    //window.location.href = "campeonatos.html";
    return;
  }

  await cargarInfoCampeonato();
  await cargarEquipos();
});

// ======================
// Campeonato
// ======================
async function cargarInfoCampeonato() {
  try {
    const data = await ApiClient.get(`/campeonatos/${campeonatoId}`);
    campeonatoActual = data.campeonato || data; // según cómo responda tu API

    const cont = document.getElementById("info-campeonato");
    if (!cont) return;

    cont.innerHTML = `
      <h3>${campeonatoActual.nombre}</h3>
      <p><strong>Fútbol:</strong> ${campeonatoActual.tipo_futbol || "N/A"}</p>
      <p><strong>Sistema:</strong> ${
        campeonatoActual.sistema_puntuacion || "N/A"
      }</p>
      <p><strong>Jugadores:</strong> 
      ${campeonatoActual.min_jugador || "Mínimo Jugadores"} -
        ${campeonatoActual.max_jugador || "Máximo Jugadores"}
      </p>
      <p><strong>Fechas:</strong> 
        ${campeonatoActual.fecha_inicio || "?"} - 
        ${campeonatoActual.fecha_fin || "?"}
      </p>
      <p><strong>Estado:</strong> ${
        campeonatoActual.estado || "planificación"
      }</p>
    `;
  } catch (error) {
    console.error("Error cargando campeonato:", error);
    mostrarNotificacion("Error cargando datos del campeonato", "error");
  }
}

// ======================
// Equipos
// ======================
async function cargarEquipos() {
  const cont = document.getElementById("lista-equipos");
  if (!cont) return;

  cont.innerHTML = "<p>Cargando equipos...</p>";

  try {
    const data = await ApiClient.get(`/equipos/campeonato/${campeonatoId}`);

    let equipos = [];
    if (Array.isArray(data)) equipos = data;
    else if (data.equipos && Array.isArray(data.equipos))
      equipos = data.equipos;
    else if (data.data && Array.isArray(data.data)) equipos = data.data;

    if (equipos.length === 0) {
      cont.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-users-slash"></i>
          <p>No hay equipos registrados en este campeonato.</p>
        </div>
      `;
      return;
    }

    cont.innerHTML = "";
    equipos.forEach((equipo, index) => {
      const div = document.createElement("div");
      div.className = "equipo-card";

      // Normaliza la URL del logo
      const logo = normalizarLogoUrl(equipo.logo_url);

      // Si no tiene logo, muestra un placeholder
      const logoHTML = logo
        ? `<img class="equipo-logo" src="${logo}" alt="Logo de ${equipo.nombre}" />`
        : `<div class="equipo-logo fas fa-trophy placeholder"></div>`;

      div.innerHTML = `
        <h3>
        <span class="item-index">${index + 1}.</span> 
        ${equipo.nombre}</h3>
        <p><strong>DT:</strong> ${equipo.director_tecnico || "Sin asignar"}</p>
        <p><strong>Asistente:</strong> ${equipo.asistente_tecnico || "-"}</p>
        <p><strong>Color:</strong> ${equipo.color_equipo || "-"}</p>
        <p><strong>Teléfono:</strong> ${equipo.telefono || "-"}</p>
        <p><strong>Email:</strong> ${equipo.email || "-"}</p>
        <p>
          <strong>Cabeza de serie:</strong> 
          ${equipo.cabeza_serie ? "Sí" : "No"}
        </p>
        <div class="equipo-actions">
          <button class="btn btn-primary" onclick="irAGestionJugadores(${
            equipo.id
          })">
            <i class="fas fa-user-friends"></i> Jugadores
          </button>
          <button class="btn btn-warning" onclick="editarEquipo(${equipo.id})">
            <i class="fas fa-edit"></i> Editar
          </button>
          <button class="btn btn-danger" onclick="eliminarEquipo(${equipo.id})">
            <i class="fas fa-trash"></i> Eliminar
          </button>
        </div>
      `;
      cont.appendChild(div);
    });
  } catch (error) {
    console.error("Error cargando equipos:", error);
    mostrarNotificacion("Error cargando equipos", "error");
    cont.innerHTML = "<p>Error cargando equipos.</p>";
  }
}

// ======================
// Navegación jugadores
// ======================
function irAGestionJugadores(equipoId) {
  window.location.href = `jugadores.html?equipo=${equipoId}&campeonato=${campeonatoId}`;
}

// ======================
// Modal Crear / Editar
// ======================
function mostrarModalCrearEquipo() {
  const titulo = document.getElementById("modal-equipo-titulo");
  const form = document.getElementById("form-equipo");

  if (titulo) titulo.textContent = "Nuevo Equipo";
  if (form) form.reset();

  document.getElementById("equipo-id").value = "";
  document.getElementById("equipo-campeonato-id").value = campeonatoId;
  document.getElementById("equipo-cabeza-serie").checked = false;

  abrirModal("modal-equipo");
}

async function editarEquipo(id) {
  try {
    const data = await ApiClient.get(`/equipos/${id}`);
    const equipo = data.equipo || data;

    const titulo = document.getElementById("modal-equipo-titulo");
    if (titulo) titulo.textContent = "Editar Equipo";

    document.getElementById("equipo-id").value = equipo.id;
    document.getElementById("equipo-campeonato-id").value =
      equipo.campeonato_id;
    document.getElementById("equipo-nombre").value = equipo.nombre || "";
    document.getElementById("equipo-director").value =
      equipo.director_tecnico || "";
    document.getElementById("equipo-asistente").value =
      equipo.asistente_tecnico || "";
    document.getElementById("equipo-color").value = equipo.color_equipo || "";
    document.getElementById("equipo-telefono").value = equipo.telefono || "";
    document.getElementById("equipo-email").value = equipo.email || "";
    document.getElementById("equipo-cabeza-serie").checked =
      !!equipo.cabeza_serie;

    abrirModal("modal-equipo");
  } catch (error) {
    console.error("Error cargando equipo:", error);
    mostrarNotificacion("Error cargando datos del equipo", "error");
  }
}

// ======================
// Guardar equipo
// ======================
/*document.getElementById("form-equipo").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("equipo-id").value;
  const body = {
    campeonato_id: parseInt(
      document.getElementById("equipo-campeonato-id").value
    ),
    nombre: document.getElementById("equipo-nombre").value.trim(),
    director_tecnico: document.getElementById("equipo-director").value.trim(),
    asistente_tecnico: document.getElementById("equipo-asistente").value.trim(),
    color_equipo: document.getElementById("equipo-color").value.trim(),
    telefono: document.getElementById("equipo-telefono").value.trim(),
    email: document.getElementById("equipo-email").value.trim(),
    cabeza_serie: document.getElementById("equipo-cabeza-serie").checked,
  };

  try {
    if (!body.nombre) {
      mostrarNotificacion("El nombre del equipo es obligatorio", "error");
      return;
    }

    if (id) {
      await ApiClient.put(`/equipos/${id}`, body);
      mostrarNotificacion("Equipo actualizado correctamente", "success");
    } else {
      await ApiClient.post("/equipos", body);
      mostrarNotificacion("Equipo creado correctamente", "success");
    }

    cerrarModal("modal-equipo");
    await cargarEquipos();
  } catch (error) {
    console.error("Error guardando equipo:", error);
    mostrarNotificacion("Error guardando el equipo", "error");
  }
});*/
document.getElementById("form-equipo").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("equipo-id").value;

  // --- USAMOS FORMDATA ----
  const formData = new FormData();

  formData.append(
    "campeonato_id",
    document.getElementById("equipo-campeonato-id").value
  );
  formData.append(
    "nombre",
    document.getElementById("equipo-nombre").value.trim()
  );
  formData.append(
    "director_tecnico",
    document.getElementById("equipo-director").value.trim()
  );
  formData.append(
    "asistente_tecnico",
    document.getElementById("equipo-asistente").value.trim()
  );
  formData.append(
    "color_equipo",
    document.getElementById("equipo-color").value.trim()
  );
  formData.append(
    "telefono",
    document.getElementById("equipo-telefono").value.trim()
  );
  formData.append(
    "email",
    document.getElementById("equipo-email").value.trim()
  );
  formData.append(
    "cabeza_serie",
    document.getElementById("equipo-cabeza-serie").checked
  );

  // Archivo logo si se subió
  const file = document.getElementById("equipo-logo").files[0];
  if (file) {
    formData.append("logo", file);
  }

  try {
    if (!formData.get("nombre")) {
      mostrarNotificacion("El nombre del equipo es obligatorio", "error");
      return;
    }

    if (id) {
      // PUT con FormData debe usarse fetch directamente
      const resp = await fetch(`${API_BASE_URL}/equipos/${id}`, {
        method: "PUT",
        body: formData,
      });
      await resp.json();
      mostrarNotificacion("Equipo actualizado correctamente", "success");
    } else {
      // Crear equipo (POST)
      const resp = await fetch(`${API_BASE_URL}/equipos`, {
        method: "POST",
        body: formData,
      });
      await resp.json();
      mostrarNotificacion("Equipo creado correctamente", "success");
    }

    cerrarModal("modal-equipo");
    await cargarEquipos();
  } catch (error) {
    console.error("Error guardando equipo:", error);
    mostrarNotificacion("Error guardando el equipo", "error");
  }
});

// ======================
// Eliminar equipo
// ======================
async function eliminarEquipo(id) {
  if (
    !confirm(
      "¿Seguro que deseas eliminar este equipo? También se eliminarán sus jugadores."
    )
  )
    return;

  try {
    await ApiClient.delete(`/equipos/${id}`);
    mostrarNotificacion("Equipo eliminado", "success");
    await cargarEquipos();
  } catch (error) {
    console.error("Error eliminando equipo:", error);
    mostrarNotificacion("Error eliminando el equipo", "error");
  }
}