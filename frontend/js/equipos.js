// frontend/js/equipos.js

let campeonatoId = null;
let campeonatoActual = null;
let eventoIdSeleccionado = null;
let totalEquiposInscritos = 0;
let totalEquiposCampeonato = 0;
let equiposCache = [];
let equipoEditandoId = null;
let vistaEquipos = localStorage.getItem("sgd_vista_equipos") || "cards";
vistaEquipos = vistaEquipos === "table" ? "table" : "cards";

function usuarioEsTecnico() {
  return !!window.Auth?.isTecnico?.();
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function obtenerNumeroEquipoVisible(equipo, fallback = null) {
  if (Number.isFinite(Number(eventoIdSeleccionado)) && Number(eventoIdSeleccionado) > 0) {
    if (Number.isFinite(Number(fallback)) && Number(fallback) > 0) return Number(fallback);
    return null;
  }

  const n = Number.parseInt(equipo?.numero_campeonato, 10);
  if (Number.isFinite(n) && n > 0) return n;
  if (Number.isFinite(Number(fallback)) && Number(fallback) > 0) return Number(fallback);
  return null;
}

function actualizarBotonesVistaEquipos() {
  const btnCards = document.getElementById("btn-vista-equipos-cards");
  const btnTable = document.getElementById("btn-vista-equipos-table");
  if (btnCards) btnCards.classList.toggle("active", vistaEquipos === "cards");
  if (btnTable) btnTable.classList.toggle("active", vistaEquipos === "table");
}

function cambiarVistaEquipos(vista = "cards") {
  vistaEquipos = vista === "table" ? "table" : "cards";
  localStorage.setItem("sgd_vista_equipos", vistaEquipos);
  actualizarBotonesVistaEquipos();
  renderListadoEquipos();
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("equipos.html")) return;
  aplicarPermisosEquiposUI();
  actualizarBotonesVistaEquipos();

  // Parámetros URL (si viene desde Categorías)
  const params = new URLSearchParams(window.location.search);
  eventoIdSeleccionado = params.get("evento") ? parseInt(params.get("evento"), 10) : null;
  campeonatoId = params.get("campeonato") ? parseInt(params.get("campeonato"), 10) : null;

  // Cargar selects de campeonato y evento
  await cargarCampeonatosSelect();

  if (campeonatoId) {
    document.getElementById("select-campeonato").value = String(campeonatoId);
    await cargarEventosSelect();
  }
  if (eventoIdSeleccionado) {
    document.getElementById("select-evento").value = String(eventoIdSeleccionado);
  }

  // Si hay contexto, cargar equipos
  if (campeonatoId) {
    await cargarInfoContexto();
    await cargarEquipos();
  }
});

function aplicarPermisosEquiposUI() {
  if (!usuarioEsTecnico()) return;

  const btnNuevo = document.querySelector('button[onclick="mostrarModalCrearEquipo()"]');
  if (btnNuevo) btnNuevo.style.display = "none";

  const btnSorteo = document.querySelector('button[onclick="irASorteo()"]');
  if (btnSorteo) btnSorteo.style.display = "none";

  const btnVolverCategorias = document.querySelector('button[onclick="window.location.href=\'eventos.html\'"]');
  if (btnVolverCategorias) {
    btnVolverCategorias.innerHTML = '<i class="fas fa-arrow-left"></i> Volver a Mi Portal';
    btnVolverCategorias.onclick = () => {
      window.location.href = "portal-tecnico.html";
    };
  }
}

// ======================
// Cargar campeonatos en el select
// ======================
async function cargarCampeonatosSelect() {
  const select = document.getElementById("select-campeonato");
  if (!select) return;
  select.innerHTML = '<option value="">— Selecciona un campeonato —</option>';

  try {
    const data = await (window.CampeonatosAPI?.obtenerTodos?.() || window.ApiClient?.get?.("/campeonatos"));
    const lista = Array.isArray(data) ? data : (data.campeonatos || data.data || []);
    lista.forEach((c) => {
      select.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });

    select.onchange = async () => {
      campeonatoId = select.value ? parseInt(select.value, 10) : null;
      eventoIdSeleccionado = null;
      document.getElementById("select-evento").innerHTML = '<option value="">— Selecciona una categoría —</option>';
      document.getElementById("lista-equipos").innerHTML = "";
      document.getElementById("info-contexto").style.display = "none";
      if (campeonatoId) {
        await cargarEventosSelect();
      }
    };
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error cargando campeonatos", "error");
  }
}

// ======================
// Cargar Categorías en el select
// ======================
async function cargarEventosSelect() {
  const select = document.getElementById("select-evento");
  if (!select || !campeonatoId) return;
  select.innerHTML = '<option value="">— Selecciona una categoría (opcional) —</option>';

  try {
    const data = await (window.EventosAPI?.obtenerPorCampeonato?.(campeonatoId) || window.ApiClient?.get?.(`/eventos/campeonato/${campeonatoId}`));
    const lista = Array.isArray(data) ? data : (data.eventos || data.data || []);
    lista.forEach((e) => {
      select.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
    });
    select.onchange = () => {
      eventoIdSeleccionado = select.value ? parseInt(select.value, 10) : null;
      cargarEquipos();
    };
  } catch (err) {
    console.error(err);
  }
}

// ======================
// Info del contexto
// ======================
async function cargarInfoContexto() {
  const cont = document.getElementById("info-contexto");
  if (!cont) return;
  try {
    const data = await (window.CampeonatosAPI?.obtenerPorId?.(campeonatoId) || window.ApiClient?.get?.(`/campeonatos/${campeonatoId}`));
    campeonatoActual = data.campeonato || data;
    const selectEvento = document.getElementById("select-evento");
    const eventoLabel =
      eventoIdSeleccionado && selectEvento
        ? selectEvento.options[selectEvento.selectedIndex]?.textContent || "No seleccionada"
        : "No seleccionada";
    const resumenEquipos = eventoIdSeleccionado
      ? `
        <p><strong>Equipos activos en categoría:</strong> ${totalEquiposInscritos}</p>
        <p><strong>Equipos creados en campeonato:</strong> ${totalEquiposCampeonato}</p>
      `
      : `<p><strong>Equipos creados en campeonato:</strong> ${totalEquiposCampeonato}</p>`;

    cont.style.display = "block";
    cont.innerHTML = `
      <h3>${campeonatoActual.nombre || "Campeonato"}</h3>
      <p><strong>Categoría:</strong> ${eventoLabel}</p>
      <p><strong>Fútbol:</strong> ${(campeonatoActual.tipo_futbol || "N/A").replace("_", " ")}</p>
      <p><strong>Sistema:</strong> ${campeonatoActual.sistema_puntuacion || "N/A"}</p>
      <p><strong>Jugadores por equipo:</strong> ${campeonatoActual.min_jugador || "?"} - ${campeonatoActual.max_jugador || "?"}</p>
      ${resumenEquipos}
      <p><strong>Estado:</strong> ${campeonatoActual.estado || "planificación"}</p>
    `;
  } catch (err) {
    console.error(err);
  }
}

// ======================
// Cargar equipos
// ======================
async function cargarEquipos() {
  const cont = document.getElementById("lista-equipos");
  const selectCamp = document.getElementById("select-campeonato");
  campeonatoId = selectCamp?.value ? parseInt(selectCamp.value, 10) : null;

  if (!campeonatoId) {
    mostrarNotificacion("Selecciona un campeonato", "warning");
    totalEquiposCampeonato = 0;
    totalEquiposInscritos = 0;
    equiposCache = [];
    return;
  }

  if (!cont) return;
  cont.innerHTML = "<p>Cargando equipos...</p>";

  try {
    const data = await window.ApiClient.get(`/equipos/campeonato/${campeonatoId}`);
    const equiposCampeonato = Array.isArray(data) ? data : (data.equipos || data.data || []);
    totalEquiposCampeonato = equiposCampeonato.length;
    let equipos = [...equiposCampeonato];

    if (eventoIdSeleccionado) {
      try {
        const dataEvento = await window.ApiClient.get(`/eventos/${eventoIdSeleccionado}/equipos`);
        const idsEvento = new Set((dataEvento.equipos || []).map((e) => e.id));
        equipos = equipos.filter((e) => idsEvento.has(e.id));
      } catch (errorcategoría) {
        console.warn("No se pudo filtrar equipos por categoría:", errorcategoría);
        mostrarNotificacion("No se pudo cargar equipos activos de la categoría", "warning");
        equipos = [];
      }
    }

    totalEquiposInscritos = equipos.length;

    await cargarInfoContexto();
    equiposCache = equipos;
    renderListadoEquipos();
  } catch (error) {
    console.error("Error cargando equipos:", error);
    mostrarNotificacion("Error cargando equipos", "error");
    totalEquiposCampeonato = 0;
    totalEquiposInscritos = 0;
    equiposCache = [];
    cont.innerHTML = "<p>Error cargando equipos.</p>";
  }
}

function renderListadoEquipos() {
  const cont = document.getElementById("lista-equipos");
  if (!cont) return;

  if (!equiposCache.length) {
    cont.classList.remove("list-mode-table");
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users-slash"></i>
        <p>No hay equipos registrados en este campeonato.</p>
        <p><small>Haz clic en "Nuevo Equipo" para crear uno.</small></p>
      </div>
    `;
    return;
  }

  if (vistaEquipos === "table") {
    cont.classList.add("list-mode-table");
    cont.innerHTML = renderTablaEquipos(equiposCache);
    return;
  }

  cont.classList.remove("list-mode-table");
  cont.innerHTML = equiposCache.map((equipo, index) => renderEquipoCard(equipo, index)).join("");
}

function renderEquipoCard(equipo, index = 0) {
  const baseUrl = (window.API_BASE_URL || "").replace(/\/api\/?$/, "") || window.location.origin;
  const logoUrl = equipo.logo_url ? (equipo.logo_url.startsWith("http") ? equipo.logo_url : `${baseUrl}${equipo.logo_url}`) : "";
  const numero = obtenerNumeroEquipoVisible(equipo, index + 1);
  const accionesAdmin = usuarioEsTecnico()
    ? ""
    : `
        <button class="btn btn-warning" onclick="editarEquipo(${equipo.id})">
          <i class="fas fa-edit"></i> Editar
        </button>
        <button class="btn btn-danger" onclick="eliminarEquipo(${equipo.id})">
          <i class="fas fa-trash"></i> Eliminar
        </button>
      `;

  return `
    <div class="equipo-card campeonato-card">
      <div class="equipo-header campeonato-header">
        <span class="item-index">${numero || index + 1}.</span>
        ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="equipo-logo">` : ""}
        <h4>${equipo.nombre}</h4>
      </div>
      <div class="equipo-body campeonato-info">
        <p><strong>Director:</strong> ${equipo.director_tecnico || "-"}</p>
        <p><strong>Teléfono:</strong> ${equipo.telefono || "-"}</p>
        <p><strong>Email:</strong> ${equipo.email || "-"}</p>
      </div>
      <div class="equipo-actions campeonato-actions">
        <button class="btn btn-primary" onclick="irAJugadores(${equipo.id})">
          <i class="fas fa-user-friends"></i> Jugadores
        </button>
        ${accionesAdmin}
      </div>
    </div>
  `;
}

function renderTablaEquipos(equipos) {
  const baseUrl = (window.API_BASE_URL || "").replace(/\/api\/?$/, "") || window.location.origin;
  const filas = equipos
    .map((equipo, index) => {
      const numero = obtenerNumeroEquipoVisible(equipo, index + 1);
      const logoUrl = equipo.logo_url
        ? (equipo.logo_url.startsWith("http") ? equipo.logo_url : `${baseUrl}${equipo.logo_url}`)
        : "";
      const logo = logoUrl
        ? `<img src="${logoUrl}" alt="Logo ${escapeHtml(equipo.nombre || "")}" class="list-table-logo" />`
        : "<span>—</span>";
      const accionesAdmin = usuarioEsTecnico()
        ? ""
        : `
            <button class="btn btn-warning" onclick="editarEquipo(${equipo.id})">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn btn-danger" onclick="eliminarEquipo(${equipo.id})">
              <i class="fas fa-trash"></i> Eliminar
            </button>
          `;

      return `
        <tr>
          <td>${numero}</td>
          <td>${logo}</td>
          <td>${escapeHtml(equipo.nombre || "—")}</td>
          <td>${escapeHtml(equipo.director_tecnico || "-")}</td>
          <td>${escapeHtml(equipo.telefono || "-")}</td>
          <td>${escapeHtml(equipo.email || "-")}</td>
          <td class="list-table-actions">
            <button class="btn btn-primary" onclick="irAJugadores(${equipo.id})">
              <i class="fas fa-user-friends"></i> Jugadores
            </button>
            ${accionesAdmin}
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
            <th>Logo</th>
            <th>Equipo</th>
            <th>Director</th>
            <th>Teléfono</th>
            <th>Email</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
}

// ======================
// Modal crear / editar
// ======================
function mostrarModalCrearEquipo() {
  if (usuarioEsTecnico()) {
    mostrarNotificacion("No autorizado para crear equipos", "warning");
    return;
  }
  const selectCamp = document.getElementById("select-campeonato");
  campeonatoId = selectCamp?.value ? parseInt(selectCamp.value, 10) : null;
  if (!campeonatoId) {
    mostrarNotificacion("Primero selecciona un campeonato", "warning");
    return;
  }
  document.getElementById("modal-titulo").textContent = "Agregar Equipo";
  equipoEditandoId = null;
  activarTabEquipo("nuevo");
  const tabExistente = document.querySelector('.modal-tab[data-tab="existente"]');
  if (tabExistente) tabExistente.disabled = false;
  document.getElementById("equipo-nombre").value = "";
  document.getElementById("equipo-dt").value = "";
  document.getElementById("equipo-at").value = "";
  document.getElementById("equipo-medico").value = "";
  document.getElementById("equipo-telefono").value = "";
  document.getElementById("equipo-email").value = "";
  document.getElementById("equipo-color-primario").value = "#e53935";
  document.getElementById("equipo-color-secundario").value = "#1e88e5";
  document.getElementById("equipo-color-terciario").value = "#43a047";
  document.getElementById("equipo-cabeza-serie").checked = false;
  const logoInput = document.getElementById("equipo-logo");
  if (logoInput) logoInput.value = "";
  cargarEquiposExistentesEnSelect();
  abrirModal("modal-equipo");
}

function activarTabEquipo(tab) {
  document.querySelectorAll(".modal-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  document.getElementById("panel-nuevo").classList.toggle("active", tab === "nuevo");
  document.getElementById("panel-nuevo").style.display = tab === "nuevo" ? "block" : "none";
  document.getElementById("panel-existente").classList.toggle("active", tab === "existente");
  document.getElementById("panel-existente").style.display = tab === "existente" ? "block" : "none";
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".modal-tab").forEach((btn) => {
    btn.addEventListener("click", () => activarTabEquipo(btn.dataset.tab));
  });
});

function cerrarModalEquipo() {
  cerrarModal("modal-equipo");
}

async function cargarEquiposExistentesEnSelect() {
  const select = document.getElementById("select-equipo-existente");
  select.innerHTML = '<option value="">— Selecciona un equipo —</option>';
  if (!campeonatoId) return;
  try {
    const data = await window.ApiClient.get(`/equipos/campeonato/${campeonatoId}`);
    const equipos = Array.isArray(data) ? data : (data.equipos || data.data || []);
    equipos.forEach((e) => {
      select.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
    });
  } catch (_) {}
}


// ======================
// Guardar equipo (crear nuevo o asignar existente a categoría)
// ======================
async function guardarEquipo() {
  if (usuarioEsTecnico()) {
    mostrarNotificacion("No autorizado para registrar o editar equipos", "warning");
    return;
  }
  const tabActivo = document.querySelector(".modal-tab.active")?.dataset?.tab;
  const usarExistente = tabActivo === "existente";
  const selectEvento = document.getElementById("select-evento");
  eventoIdSeleccionado = selectEvento?.value ? parseInt(selectEvento.value, 10) : null;
  const estaEditando = Number.isFinite(Number(equipoEditandoId)) && Number(equipoEditandoId) > 0;

  if (usarExistente && !estaEditando) {
    const equipoId = document.getElementById("select-equipo-existente").value;
    if (!equipoId) {
      mostrarNotificacion("Selecciona un equipo existente", "warning");
      return;
    }
    if (!eventoIdSeleccionado) {
      mostrarNotificacion("Para asignar equipo a categoría, Selecciona una categoría primero", "warning");
      return;
    }
    try {
      await window.ApiClient.post(`/eventos/${eventoIdSeleccionado}/equipos`, { equipo_id: parseInt(equipoId, 10) });
      mostrarNotificacion("Equipo asignado a la categoría", "success");
      cerrarModal("modal-equipo");
      cargarEquipos();
    } catch (err) {
      mostrarNotificacion(err.message || "Error asignando equipo", "error");
    }
    return;
  }

  const nombre = document.getElementById("equipo-nombre").value.trim();
  const dt = document.getElementById("equipo-dt").value.trim();
  const email = document.getElementById("equipo-email").value.trim();
  const telefono = document.getElementById("equipo-telefono").value.trim();

  if (!nombre) {
    mostrarNotificacion("El nombre del equipo es obligatorio", "warning");
    return;
  }
  if (!dt) {
    mostrarNotificacion("El técnico o dueño es obligatorio", "warning");
    return;
  }
  if (!email) {
    mostrarNotificacion("El correo electrónico es obligatorio", "warning");
    return;
  }
  if (!telefono) {
    mostrarNotificacion("El número de celular es obligatorio", "warning");
    return;
  }

  const fd = new FormData();
  fd.append("campeonato_id", campeonatoId);
  fd.append("nombre", nombre);
  fd.append("director_tecnico", dt);
  fd.append("asistente_tecnico", document.getElementById("equipo-at").value.trim());
  fd.append("medico", document.getElementById("equipo-medico").value.trim());
  const c1 = document.getElementById("equipo-color-primario")?.value?.trim() || "";
  const c2 = document.getElementById("equipo-color-secundario")?.value?.trim() || "";
  const c3 = document.getElementById("equipo-color-terciario")?.value?.trim() || "";
  fd.append("color_primario", c1);
  fd.append("color_secundario", c2);
  fd.append("color_terciario", c3);
  fd.append("color_equipo", c1 || c2 || c3 || "");
  fd.append("telefono", telefono);
  fd.append("email", email);
  fd.append("cabeza_serie", document.getElementById("equipo-cabeza-serie").checked);

  const logoInput = document.getElementById("equipo-logo");
  if (logoInput?.files?.[0]) {
    fd.append("logo", logoInput.files[0]);
  }

  try {
    const baseUrl = (window.API_BASE_URL || "http://localhost:5000/api").replace(/\/?$/, "");
    const url = estaEditando ? `${baseUrl}/equipos/${equipoEditandoId}` : `${baseUrl}/equipos`;
    const resp = await fetch(url, {
      method: estaEditando ? "PUT" : "POST",
      body: fd,
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || (estaEditando ? "Error actualizando equipo" : "Error creando equipo"));

    let mensaje = estaEditando ? "Equipo actualizado correctamente" : "Equipo creado correctamente";
    if (!estaEditando && eventoIdSeleccionado && data.equipo) {
      try {
        await window.ApiClient.post(`/eventos/${eventoIdSeleccionado}/equipos`, { equipo_id: data.equipo.id });
        mensaje = "Equipo creado y asignado a la categoría";
      } catch (_) {}
    }
    equipoEditandoId = null;
    mostrarNotificacion(mensaje, "success");
    cerrarModal("modal-equipo");
    cargarEquipos();
  } catch (err) {
    mostrarNotificacion(err.message || (estaEditando ? "Error actualizando equipo" : "Error creando equipo"), "error");
  }
}

// ======================
// Editar / Eliminar
// ======================
async function editarEquipo(id) {
  if (usuarioEsTecnico()) {
    mostrarNotificacion("No autorizado para editar equipos", "warning");
    return;
  }
  if (!id) {
    mostrarNotificacion("No se pudo identificar el equipo a editar", "warning");
    return;
  }

  try {
    const data = await window.ApiClient.get(`/equipos/${id}`);
    const equipo = data?.equipo || data;
    if (!equipo?.id) {
      mostrarNotificacion("No se encontró el equipo", "warning");
      return;
    }

    equipoEditandoId = Number(equipo.id);
    document.getElementById("modal-titulo").textContent = "Editar Equipo";
    activarTabEquipo("nuevo");

    const tabExistente = document.querySelector('.modal-tab[data-tab="existente"]');
    if (tabExistente) tabExistente.disabled = true;

    document.getElementById("equipo-nombre").value = equipo.nombre || "";
    document.getElementById("equipo-dt").value = equipo.director_tecnico || "";
    document.getElementById("equipo-at").value = equipo.asistente_tecnico || "";
    document.getElementById("equipo-medico").value = equipo.medico || "";
    document.getElementById("equipo-telefono").value = equipo.telefono || "";
    document.getElementById("equipo-email").value = equipo.email || "";

    const c1 = equipo.color_primario || equipo.color_equipo || "#e53935";
    const c2 = equipo.color_secundario || "#1e88e5";
    const c3 = equipo.color_terciario || "#43a047";
    document.getElementById("equipo-color-primario").value = c1;
    document.getElementById("equipo-color-secundario").value = c2;
    document.getElementById("equipo-color-terciario").value = c3;

    document.getElementById("equipo-cabeza-serie").checked =
      equipo.cabeza_serie === true || equipo.cabeza_serie === "true";

    const logoInput = document.getElementById("equipo-logo");
    if (logoInput) logoInput.value = "";

    abrirModal("modal-equipo");
  } catch (error) {
    console.error("Error cargando equipo para edición:", error);
    mostrarNotificacion(error.message || "Error cargando equipo para edición", "error");
  }
}

async function eliminarEquipo(id) {
  if (usuarioEsTecnico()) {
    mostrarNotificacion("No autorizado para eliminar equipos", "warning");
    return;
  }
  if (!confirm("¿Seguro que quieres eliminar este equipo?")) return;
  try {
    await window.ApiClient.delete(`/equipos/${id}`);
    mostrarNotificacion("Equipo eliminado.", "success");
    cargarEquipos();
  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error al eliminar el equipo.", "error");
  }
}

function irAJugadores(equipoId) {
  if (!campeonatoId) {
    mostrarNotificacion("Selecciona un campeonato primero", "warning");
    return;
  }

  const params = new URLSearchParams();
  params.set("campeonato", String(campeonatoId));
  params.set("equipo", String(equipoId));
  if (eventoIdSeleccionado) {
    params.set("evento", String(eventoIdSeleccionado));
  }

  window.location.href = `jugadores.html?${params.toString()}`;
}

function irASorteo() {
  if (usuarioEsTecnico()) {
    mostrarNotificacion("No autorizado para gestionar sorteo", "warning");
    return;
  }
  const selectCamp = document.getElementById("select-campeonato");
  const selectEvento = document.getElementById("select-evento");

  const campId = selectCamp?.value ? parseInt(selectCamp.value, 10) : null;
  const evtId = selectEvento?.value ? parseInt(selectEvento.value, 10) : null;

  if (!campId) {
    mostrarNotificacion("Selecciona un campeonato", "warning");
    return;
  }

  if (!evtId) {
    mostrarNotificacion("Selecciona una categoría para enviar a sorteo", "warning");
    return;
  }

  window.location.href = `sorteo.html?campeonato=${campId}&evento=${evtId}`;
}

// Exponer para onclick del HTML
window.cargarEquipos = cargarEquipos;
window.mostrarModalCrearEquipo = mostrarModalCrearEquipo;
window.cerrarModalEquipo = cerrarModalEquipo;
window.guardarEquipo = guardarEquipo;
window.editarEquipo = editarEquipo;
window.eliminarEquipo = eliminarEquipo;
window.irASorteo = irASorteo;
window.irAJugadores = irAJugadores;
window.cambiarVistaEquipos = cambiarVistaEquipos;


