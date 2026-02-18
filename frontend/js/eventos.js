// frontend/js/eventos.js  ✅ (EVENTOS/CATEGORÍAS)

let campeonatoSeleccionado = null;
let eventosCache = [];
let vistaEventos = localStorage.getItem("sgd_vista_eventos") || "cards";
vistaEventos = vistaEventos === "table" ? "table" : "cards";

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function actualizarBotonesVistaEventos() {
  const btnCards = document.getElementById("btn-vista-eventos-cards");
  const btnTable = document.getElementById("btn-vista-eventos-table");
  if (btnCards) btnCards.classList.toggle("active", vistaEventos === "cards");
  if (btnTable) btnTable.classList.toggle("active", vistaEventos === "table");
}

function cambiarVistaEventos(vista = "cards") {
  vistaEventos = vista === "table" ? "table" : "cards";
  localStorage.setItem("sgd_vista_eventos", vistaEventos);
  actualizarBotonesVistaEventos();
  renderListadoEventos();
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("eventos.html")) return;
  actualizarBotonesVistaEventos();

  await cargarCampeonatosSelect();

  // si vienes desde campeonatos.html?campeonato=1
  const params = new URLSearchParams(window.location.search);
  const cId = params.get("campeonato");
  if (cId) {
    campeonatoSeleccionado = parseInt(cId, 10);
    const sel = document.getElementById("select-campeonato");
    sel.value = String(campeonatoSeleccionado);
    await cargarEventos();
  }
});

async function cargarCampeonatosSelect() {
  const select = document.getElementById("select-campeonato");
  select.innerHTML = `<option value="">— Selecciona un campeonato —</option>`;

  try {
    const data = await CampeonatosAPI.obtenerTodos();
    const lista = Array.isArray(data) ? data : (data.campeonatos || data.data || []);

    lista.forEach((c) => {
      select.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });

    select.onchange = async () => {
      campeonatoSeleccionado = select.value ? parseInt(select.value, 10) : null;
      eventosCache = [];
      document.getElementById("lista-eventos").innerHTML = "";
    };
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error cargando campeonatos", "error");
  }
}

// botón "Cargar Eventos"
async function cargarEventos() {
  const cont = document.getElementById("lista-eventos");
  cont.innerHTML = "<p>Cargando eventos...</p>";

  const select = document.getElementById("select-campeonato");
  campeonatoSeleccionado = select.value ? parseInt(select.value, 10) : null;

  if (!campeonatoSeleccionado) {
    eventosCache = [];
    cont.innerHTML = "";
    mostrarNotificacion("Selecciona un campeonato", "warning");
    return;
  }

  try {
    const resp = await EventosAPI.obtenerPorCampeonato(campeonatoSeleccionado);
    const eventos = Array.isArray(resp) ? resp : (resp.eventos || resp.data || []);
    eventosCache = eventos;
    renderListadoEventos();
  } catch (err) {
    console.error(err);
    eventosCache = [];
    cont.innerHTML = "";
    mostrarNotificacion("Error cargando eventos", "error");
  }
}

function renderListadoEventos() {
  const cont = document.getElementById("lista-eventos");
  if (!cont) return;

  if (!eventosCache.length) {
    cont.classList.remove("list-mode-table");
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-layer-group"></i>
        <p>No hay eventos/categorías creadas en este campeonato.</p>
      </div>`;
    return;
  }

  if (vistaEventos === "table") {
    cont.classList.add("list-mode-table");
    cont.innerHTML = renderTablaEventos(eventosCache);
    return;
  }

  cont.classList.remove("list-mode-table");
  cont.innerHTML = eventosCache.map(renderEventoCard).join("");
}

function renderEventoCard(e) {
  return `
    <div class="campeonato-card">
      <div class="campeonato-header">
        <h3>${escapeHtml(e.nombre || "Evento")}</h3>
      </div>
      <div class="campeonato-info">
        <p><strong>Modalidad:</strong> ${escapeHtml(e.modalidad || "-")}</p>
        <p><strong>Fechas:</strong> ${escapeHtml(e.fecha_inicio || "-")} - ${escapeHtml(e.fecha_fin || "-")}</p>
      </div>
      <div class="campeonato-actions">
        <button class="btn btn-primary" onclick="irAElegirEquipos(${e.id})">
          <i class="fas fa-users"></i> Equipos
        </button>
        <button class="btn btn-warning" onclick="editarEvento(${e.id})">
          <i class="fas fa-edit"></i> Editar
        </button>
        <button class="btn btn-danger" onclick="eliminarEvento(${e.id})">
          <i class="fas fa-trash"></i> Eliminar
        </button>
      </div>
    </div>
  `;
}

function renderTablaEventos(eventos) {
  const filas = eventos
    .map((e, index) => {
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(e.nombre || "—")}</td>
          <td>${escapeHtml(e.modalidad || "-")}</td>
          <td>${escapeHtml(e.fecha_inicio || "-")}</td>
          <td>${escapeHtml(e.fecha_fin || "-")}</td>
          <td class="list-table-actions">
            <button class="btn btn-primary" onclick="irAElegirEquipos(${e.id})">
              <i class="fas fa-users"></i> Equipos
            </button>
            <button class="btn btn-warning" onclick="editarEvento(${e.id})">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn btn-danger" onclick="eliminarEvento(${e.id})">
              <i class="fas fa-trash"></i> Eliminar
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="list-table-wrap">
      <table class="list-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Evento / Categoría</th>
            <th>Modalidad</th>
            <th>Fecha inicio</th>
            <th>Fecha fin</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
}

function irAElegirEquipos(eventoId) {
  // aquí enlazamos a una pantalla de equipos por evento
  // (puede ser equipos.html si lo adaptas, o una nueva equipos_evento.html)
  window.location.href = `equipos.html?campeonato=${campeonatoSeleccionado}&evento=${eventoId}`;
}

async function crearEvento() {
  if (!campeonatoSeleccionado) {
    mostrarNotificacion("Selecciona un campeonato", "warning");
    return;
  }

  const nombre = document.getElementById("evt-nombre").value.trim();
  const modalidad = document.getElementById("evt-modalidad").value;
  const fecha_inicio = document.getElementById("evt-fecha-inicio").value;
  const fecha_fin = document.getElementById("evt-fecha-fin").value;

  if (!nombre || !fecha_inicio || !fecha_fin) {
    mostrarNotificacion("Completa nombre + fechas", "warning");
    return;
  }

  try {
    await EventosAPI.crear({ campeonato_id: campeonatoSeleccionado, nombre, modalidad, fecha_inicio, fecha_fin });
    mostrarNotificacion("Evento creado", "success");
    document.getElementById("evt-nombre").value = "";
    await cargarEventos();
  } catch (err) {
    console.error(err);
    mostrarNotificacion(err.message || "Error creando evento", "error");
  }
}

async function eliminarEvento(id) {
  if (!confirm("¿Eliminar este evento/categoría?")) return;

  try {
    await EventosAPI.eliminar(id);
    mostrarNotificacion("Evento eliminado", "success");
    await cargarEventos();
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error eliminando evento", "error");
  }
}

// (opcional) editar rápido por prompt
async function editarEvento(id) {
  const nuevoNombre = prompt("Nuevo nombre del evento:", "");
  if (!nuevoNombre) return;

  try {
    await EventosAPI.actualizar(id, { nombre: nuevoNombre });
    mostrarNotificacion("Evento actualizado", "success");
    await cargarEventos();
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error actualizando evento", "error");
  }
}

window.cambiarVistaEventos = cambiarVistaEventos;
