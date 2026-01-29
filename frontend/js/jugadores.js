// frontend/js/jugadores.js

let equipoId = null;
let campeonatoId = null;
let equipoActual = null;

// límites configurados en el campeonato
let minJugadoresPorEquipo = null;
let maxJugadoresPorEquipo = null;

// arreglo local con los jugadores del equipo
let jugadoresActuales = [];

// ======================
// Utilidad
// ======================
function obtenerParametroUrl(nombre) {
  const params = new URLSearchParams(window.location.search);
  return params.get(nombre);
}

// ======================
// Inicio de página
// ======================
document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("jugadores.html")) {
    return;
  }

  equipoId = obtenerParametroUrl("equipo");
  campeonatoId = obtenerParametroUrl("campeonato");

  if (!equipoId) {
    mostrarNotificacion("❌ Falta el ID del equipo", "error");
    window.location.href = "campeonatos.html";
    return;
  }

  await cargarInfoEquipo();
  await cargarJugadores();
  await cargarConfigCampeonato();
});

// ======================
// Datos del EQUIPO
// ======================
async function cargarInfoEquipo() {
  try {
    const data = await ApiClient.get(`/equipos/${equipoId}`);
    equipoActual = data.equipo || data;

    const cont = document.getElementById("info-equipo");
    if (!cont) return;

    // Tarjeta de resumen del equipo + línea para resumen de jugadores
    cont.innerHTML = `
      <div class="campeonato-resumen-card">
        <h3>${equipoActual.nombre}</h3>
        <p><strong>Director Técnico:</strong> ${
          equipoActual.director_tecnico || "Sin asignar"
        }</p>
        <p><strong>Asistente:</strong> ${
          equipoActual.asistente_tecnico || "-"
        }</p>
        <p><strong>Color:</strong> ${equipoActual.color_equipo || "-"}</p>
        <p><strong>Cabeza de serie:</strong> ${
          equipoActual.cabeza_serie ? "Sí" : "No"
        }</p>
        <p id="resumen-jugadores" class="jugadores-resumen-linea"></p>
      </div>
    `;

    // campo oculto del formulario
    document.getElementById("jugador-equipo-id").value = equipoActual.id;
  } catch (error) {
    console.error("Error cargando equipo:", error);
    mostrarNotificacion("Error cargando datos del equipo", "error");
  }
}

// Configuración de min / max del campeonato
async function cargarConfigCampeonato() {
  if (!campeonatoId) return;

  try {
    const resp = await CampeonatosAPI.obtenerPorId(campeonatoId);
    const camp = resp.campeonato;

    // Usa los nombres reales de tus columnas
    minJugadoresPorEquipo = camp.min_jugador || null;
    maxJugadoresPorEquipo = camp.max_jugador || null;

    actualizarResumenJugadores();
  } catch (error) {
    console.error("Error cargando configuración de campeonato:", error);
  }
}

function volverAEquipos() {
  if (campeonatoId) {
    window.location.href = `equipos.html?campeonato=${campeonatoId}`;
  } else {
    window.location.href = "campeonatos.html";
  }
}

// ======================
// JUGADORES
// ======================
async function cargarJugadores() {
  const cont = document.getElementById("lista-jugadores");
  if (!cont) return;

  cont.innerHTML = "<p>Cargando jugadores...</p>";

  try {
    const data = await ApiClient.get(`/jugadores/equipo/${equipoId}`);

    let jugadores = [];
    if (Array.isArray(data)) jugadores = data;
    else if (data.jugadores && Array.isArray(data.jugadores))
      jugadores = data.jugadores;
    else if (data.data && Array.isArray(data.data)) jugadores = data.data;

    jugadoresActuales = jugadores; // guardamos en el arreglo local

    if (jugadores.length === 0) {
      cont.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-user-slash"></i>
          <p>No hay jugadores registrados en este equipo.</p>
        </div>
      `;
      actualizarResumenJugadores();
      return;
    }

    cont.innerHTML = "";
    jugadores.forEach((jugador, index) => {
      const div = document.createElement("div");
      div.className = "equipo-card";

      div.innerHTML = `
        <h3>
          <span class="item-index">${index + 1}.</span>
          ${jugador.nombre} ${jugador.apellido || ""}
        </h3>
        <p><strong>Número:</strong> ${jugador.numero_camiseta || "-"}</p>
        <p><strong>Posición:</strong> ${jugador.posicion || "-"}</p>
        <p><strong>Cédula de Identidad:</strong> ${
          jugador.cedidentidad || "-"
        }</p>
        <p><strong>Fecha nac.:</strong> ${
          jugador.fecha_nacimiento
            ? new Date(jugador.fecha_nacimiento).toLocaleDateString("es-ES")
            : "-"
        }</p>
        <p><strong>Capitán:</strong> ${jugador.es_capitan ? "Sí" : "No"}</p>

        <div class="jugador-actions">
          <button class="btn btn-warning" onclick="editarJugador(${
            jugador.id
          })">
            <i class="fas fa-edit"></i> Editar
          </button>
          <button class="btn btn-danger" onclick="eliminarJugador(${
            jugador.id
          })">
            <i class="fas fa-trash"></i> Eliminar
          </button>
        </div>
      `;

      cont.appendChild(div);
    });

    actualizarResumenJugadores();
  } catch (error) {
    console.error("Error cargando jugadores:", error);
    mostrarNotificacion("Error cargando jugadores", "error");
    cont.innerHTML = "<p>Error cargando jugadores.</p>";
  }
}

// Línea de resumen "Jugadores: X / Y"
function actualizarResumenJugadores() {
  const resumenEl = document.getElementById("resumen-jugadores");
  if (!resumenEl) return;

  const total = jugadoresActuales.length;

  let texto = `Jugadores registrados: ${total}`;
  let color = "#2c3e50";

  if (maxJugadoresPorEquipo) {
    texto += ` / ${maxJugadoresPorEquipo}`;
  }

  if (minJugadoresPorEquipo && total < minJugadoresPorEquipo) {
    texto += ` — ⚠️ Debajo del mínimo ${minJugadoresPorEquipo})`;
    color = "#e67e22";
  }else if (
    maxJugadoresPorEquipo &&
    total > maxJugadoresPorEquipo
  ) {
    texto += ` — ❌ Excede el máximo permitido`;
    color = "#c0392b"; // rojo error
  }

  resumenEl.textContent = texto;
  resumenEl.style.color = color;
}

// ======================
// Modal Crear / Editar
// ======================
function mostrarModalCrearJugador() {
  // No dejar crear si ya estamos en el máximo
  if (
    maxJugadoresPorEquipo &&
    jugadoresActuales.length >= maxJugadoresPorEquipo
  ) {
    mostrarNotificacion(
      `Ya alcanzaste el máximo de ${maxJugadoresPorEquipo} jugadores para este equipo`,
      "warning"
    );
    return;
  }

  const titulo = document.getElementById("modal-jugador-titulo");
  const form = document.getElementById("form-jugador");

  if (titulo) titulo.textContent = "Nuevo Jugador";
  if (form) form.reset();

  document.getElementById("jugador-id").value = "";
  document.getElementById("jugador-equipo-id").value = equipoId;
  document.getElementById("jugador-capitan").checked = false;

  abrirModal("modal-jugador");
}

async function editarJugador(id) {
  try {
    const data = await ApiClient.get(`/jugadores/${id}`);
    const jugador = data.jugador || data;

    const titulo = document.getElementById("modal-jugador-titulo");
    if (titulo) titulo.textContent = "Editar Jugador";

    document.getElementById("jugador-id").value = jugador.id;
    document.getElementById("jugador-equipo-id").value = jugador.equipo_id;
    document.getElementById("jugador-nombre").value = jugador.nombre || "";
    document.getElementById("jugador-apellido").value = jugador.apellido || "";
    document.getElementById("jugador-ced").value = jugador.cedidentidad || "";
    document.getElementById("jugador-fecha").value =
      jugador.fecha_nacimiento || "";
    document.getElementById("jugador-posicion").value = jugador.posicion || "";
    document.getElementById("jugador-numero").value =
      jugador.numero_camiseta || "";
    document.getElementById("jugador-capitan").checked = !!jugador.es_capitan;

    abrirModal("modal-jugador");
  } catch (error) {
    console.error("Error cargando jugador:", error);
    mostrarNotificacion("Error cargando datos del jugador", "error");
  }
}

// ======================
// Guardar jugador
// ======================
document
  .getElementById("form-jugador")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("jugador-id").value;
    const body = {
      equipo_id: parseInt(document.getElementById("jugador-equipo-id").value),
      nombre: document.getElementById("jugador-nombre").value.trim(),
      apellido: document.getElementById("jugador-apellido").value.trim(),
      cedidentidad: document.getElementById("jugador-ced").value.trim(),
      fecha_nacimiento: document.getElementById("jugador-fecha").value || null,
      posicion: document.getElementById("jugador-posicion").value || null,
      numero_camiseta: document.getElementById("jugador-numero").value
        ? parseInt(document.getElementById("jugador-numero").value)
        : null,
      es_capitan: document.getElementById("jugador-capitan").checked,
    };

    if (!body.nombre) {
      mostrarNotificacion("El nombre del jugador es obligatorio", "error");
      return;
    }

    // Si estamos creando (no editando) y ya llegamos al máximo -> bloquear
    if (
      !id &&
      maxJugadoresPorEquipo &&
      jugadoresActuales.length >= maxJugadoresPorEquipo
    ) {
      mostrarNotificacion(
        `No puedes agregar más de ${maxJugadoresPorEquipo} jugadores en este equipo`,
        "warning"
      );
      return;
    }

    try {
      if (id) {
        await ApiClient.put(`/jugadores/${id}`, body);
        mostrarNotificacion("Jugador actualizado correctamente", "success");
      } else {
        await ApiClient.post("/jugadores", body);
        mostrarNotificacion("Jugador creado correctamente", "success");
      }

      cerrarModal("modal-jugador");
      await cargarJugadores(); // esto vuelve a llenar jugadoresActuales y actualiza el resumen
    } catch (error) {
      console.error("Error guardando jugador:", error);
      mostrarNotificacion("Error guardando el jugador", "error");
    }
  });

// ======================
// Eliminar jugador
// ======================
async function eliminarJugador(id) {
  if (!confirm("¿Seguro que deseas eliminar este jugador?")) return;

  try {
    await ApiClient.delete(`/jugadores/${id}`);
    mostrarNotificacion("Jugador eliminado", "success");
    await cargarJugadores();
  } catch (error) {
    console.error("Error eliminando jugador:", error);
    mostrarNotificacion("Error eliminando el jugador", "error");
  }
}
