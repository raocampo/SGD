// frontend/js/equipos.js

let campeonatoSeleccionado = null;
let eventoSeleccionado = null;

let cacheEquiposEvento = [];     // equipos ya asignados al evento
let cacheEquiposCampeonato = []; // equipos del campeonato (catálogo)

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("equipos.html")) return;

  await cargarCampeonatos();

  const params = new URLSearchParams(window.location.search);
  const cId = params.get("campeonato");
  const eId = params.get("evento");

  if (cId) {
    campeonatoSeleccionado = parseInt(cId, 10);
    document.getElementById("select-campeonato").value = String(campeonatoSeleccionado);
    await cargarEventosDeCampeonato(campeonatoSeleccionado);

    if (eId) {
      eventoSeleccionado = parseInt(eId, 10);
      document.getElementById("select-evento").value = String(eventoSeleccionado);
      await cargarEquipos();
    }
  }

  document.getElementById("btn-cargar-equipos").onclick = cargarEquipos;

  // Modal: alternar modo
  const chk = document.getElementById("chk-usar-existente");
  chk.addEventListener("change", () => {
    const usar = chk.checked;
    document.getElementById("bloque-existente").style.display = usar ? "block" : "none";
    document.getElementById("bloque-nuevo").style.display = usar ? "none" : "block";
  });
});

// ===============================
// Cargar Campeonatos
// ===============================
async function cargarCampeonatos() {
  const select = document.getElementById("select-campeonato");
  select.innerHTML = `<option value="">— Selecciona un campeonato —</option>`;

  try {
    const data = await CampeonatosAPI.obtenerTodos();
    const lista = data.campeonatos || [];

    lista.forEach((c) => {
      select.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });

    select.onchange = async () => {
      campeonatoSeleccionado = select.value ? parseInt(select.value, 10) : null;
      eventoSeleccionado = null;

      document.getElementById("select-evento").innerHTML =
        `<option value="">— Selecciona un evento —</option>`;
      document.getElementById("select-evento").disabled = true;

      document.getElementById("lista-equipos").innerHTML = "";
      document.getElementById("info-contexto").style.display = "none";

      if (campeonatoSeleccionado) {
        await cargarEventosDeCampeonato(campeonatoSeleccionado);
      }
    };
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error cargando campeonatos", "error");
  }
}

// ===============================
// Cargar Eventos por Campeonato
// ===============================
async function cargarEventosDeCampeonato(campeonatoId) {
  const select = document.getElementById("select-evento");
  select.innerHTML = `<option value="">— Selecciona un evento —</option>`;

  try {
    const resp = await ApiClient.get(`/eventos/campeonato/${campeonatoId}`);
    const eventos = resp.eventos || resp || [];

    eventos.forEach((e) => {
      select.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
    });

    select.disabled = false;
    select.onchange = () => {
      eventoSeleccionado = select.value ? parseInt(select.value, 10) : null;
      document.getElementById("lista-equipos").innerHTML = "";
    };
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error cargando eventos del campeonato", "error");
  }
}

// ===============================
// Cargar Equipos por Evento
// ===============================
async function cargarEquipos() {
  const cont = document.getElementById("lista-equipos");
  cont.innerHTML = "<p>Cargando equipos...</p>";

  if (!campeonatoSeleccionado) {
    mostrarNotificacion("Selecciona un campeonato", "warning");
    cont.innerHTML = "";
    return;
  }
  if (!eventoSeleccionado) {
    mostrarNotificacion("Selecciona un evento/categoría", "warning");
    cont.innerHTML = "";
    return;
  }

  try {
    // 1) equipos del evento (pivote)
    const respEvento = await ApiClient.get(`/eventos/${eventoSeleccionado}/equipos`);
    cacheEquiposEvento = respEvento.equipos || [];

    // 2) equipos del campeonato (catálogo)
    const respCamp = await EquiposAPI.obtenerPorCampeonato(campeonatoSeleccionado);
    cacheEquiposCampeonato = respCamp.equipos || respCamp || [];

    // Info cabecera
    const info = document.getElementById("info-contexto");
    info.style.display = "block";
    info.innerHTML = `
      <h3 style="margin-top:0;">Contexto</h3>
      <p><strong>Campeonato ID:</strong> ${campeonatoSeleccionado}</p>
      <p><strong>Evento ID:</strong> ${eventoSeleccionado}</p>
      <p><strong>Equipos en este evento:</strong> ${cacheEquiposEvento.length}</p>
    `;

    if (cacheEquiposEvento.length === 0) {
      cont.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-users"></i>
          <p>No hay equipos asignados a este evento.</p>
        </div>`;
      return;
    }

    cont.innerHTML = cacheEquiposEvento.map(renderEquipoCard).join("");
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error cargando equipos del evento", "error");
    cont.innerHTML = "";
  }
}

// ===============================
// Card Equipo
// ===============================
function renderEquipoCard(e) {
  return `
    <div class="campeonato-card">
      <div class="campeonato-header">
        <h3>${e.nombre}</h3>
      </div>
      <div class="campeonato-info">
        <p><strong>DT:</strong> ${e.director_tecnico || "-"}</p>
        <p><strong>Teléfono:</strong> ${e.telefono || "-"}</p>
        <p><strong>Email:</strong> ${e.email || "-"}</p>
      </div>
      <div class="campeonato-actions">
        <button class="btn btn-warning" onclick="editarEquipo(${e.id})">
          <i class="fas fa-edit"></i> Editar
        </button>
        <button class="btn btn-danger" onclick="quitarEquipoDelEvento(${e.id})">
          <i class="fas fa-times"></i> Quitar del evento
        </button>
      </div>
    </div>
  `;
}

// ===============================
// Modal
// ===============================
function mostrarModalCrearEquipo() {
  if (!campeonatoSeleccionado || !eventoSeleccionado) {
    mostrarNotificacion("Selecciona campeonato y evento antes de crear equipos", "warning");
    return;
  }

  // reset form
  document.getElementById("chk-usar-existente").checked = false;
  document.getElementById("bloque-existente").style.display = "none";
  document.getElementById("bloque-nuevo").style.display = "block";

  document.getElementById("equipo-nombre").value = "";
  document.getElementById("equipo-dt").value = "";
  document.getElementById("equipo-at").value = "";
  document.getElementById("equipo-telefono").value = "";
  document.getElementById("equipo-email").value = "";
  document.getElementById("equipo-color").value = "";

  // cargar select de existentes (del campeonato que NO estén en el evento)
  const select = document.getElementById("select-equipo-existente");
  select.innerHTML = `<option value="">— Selecciona un equipo —</option>`;

  const idsEnEvento = new Set(cacheEquiposEvento.map((x) => x.id));
  const disponibles = (cacheEquiposCampeonato || []).filter((x) => !idsEnEvento.has(x.id));

  disponibles.forEach((x) => {
    select.innerHTML += `<option value="${x.id}">${x.nombre}</option>`;
  });

  abrirModal("modal-equipo");
}

async function guardarEquipo() {
  const usarExistente = document.getElementById("chk-usar-existente").checked;

  try {
    if (usarExistente) {
      const equipoId = parseInt(document.getElementById("select-equipo-existente").value, 10);
      if (!Number.isFinite(equipoId)) {
        mostrarNotificacion("Selecciona un equipo existente", "warning");
        return;
      }

      await ApiClient.post(`/eventos/${eventoSeleccionado}/equipos`, { equipo_id: equipoId });
      cerrarModal("modal-equipo");
      mostrarNotificacion("Equipo asignado al evento", "success");
      await cargarEquipos();
      return;
    }

    // crear nuevo equipo (en catálogo del campeonato)
    const nombre = document.getElementById("equipo-nombre").value.trim();
    if (!nombre) {
      mostrarNotificacion("El nombre del equipo es obligatorio", "warning");
      return;
    }

    const payload = {
      campeonato_id: campeonatoSeleccionado,
      nombre,
      director_tecnico: document.getElementById("equipo-dt").value.trim() || null,
      asistente_tecnico: document.getElementById("equipo-at").value.trim() || null,
      telefono: document.getElementById("equipo-telefono").value.trim() || null,
      email: document.getElementById("equipo-email").value.trim() || null,
      color_equipo: document.getElementById("equipo-color").value.trim() || null,
    };

    const creado = await EquiposAPI.crear(payload);
    const equipoCreado = creado.equipo || creado;

    // vincular al evento
    await ApiClient.post(`/eventos/${eventoSeleccionado}/equipos`, { equipo_id: equipoCreado.id });

    cerrarModal("modal-equipo");
    mostrarNotificacion("Equipo creado y asignado al evento", "success");
    await cargarEquipos();
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error guardando equipo", "error");
  }
}

// ===============================
// Editar (simple)
// ===============================
async function editarEquipo(id) {
  const nuevoNombre = prompt("Nuevo nombre del equipo:", "");
  if (!nuevoNombre) return;

  try {
    await EquiposAPI.actualizar(id, { nombre: nuevoNombre });
    mostrarNotificacion("Equipo actualizado", "success");
    await cargarEquipos();
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error actualizando equipo", "error");
  }
}

// ===============================
// Quitar del evento (NO elimina el equipo del catálogo)
// ===============================
async function quitarEquipoDelEvento(equipoId) {
  if (!confirm("¿Quitar este equipo del evento? (No se elimina del campeonato)")) return;

  try {
    await ApiClient.delete(`/eventos/${eventoSeleccionado}/equipos/${equipoId}`);
    mostrarNotificacion("Equipo quitado del evento", "success");
    await cargarEquipos();
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error quitando equipo del evento", "error");
  }
}
