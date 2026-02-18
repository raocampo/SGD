// frontend/js/equipos.js

let campeonatoId = null;
let campeonatoActual = null;
let eventoIdSeleccionado = null;
let totalEquiposInscritos = 0;
let equiposCache = [];
let vistaEquipos = localStorage.getItem("sgd_vista_equipos") || "cards";
vistaEquipos = vistaEquipos === "table" ? "table" : "cards";

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  actualizarBotonesVistaEquipos();

  // Parámetros URL (si viene desde eventos)
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
      document.getElementById("select-evento").innerHTML = '<option value="">— Selecciona un evento —</option>';
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
// Cargar eventos (categorías) en el select
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
    cont.style.display = "block";
    cont.innerHTML = `
      <h3>${campeonatoActual.nombre || "Campeonato"}</h3>
      <p><strong>Categoría:</strong> ${eventoLabel}</p>
      <p><strong>Fútbol:</strong> ${(campeonatoActual.tipo_futbol || "N/A").replace("_", " ")}</p>
      <p><strong>Sistema:</strong> ${campeonatoActual.sistema_puntuacion || "N/A"}</p>
      <p><strong>Jugadores por equipo:</strong> ${campeonatoActual.min_jugador || "?"} - ${campeonatoActual.max_jugador || "?"}</p>
      <p><strong>Equipos inscritos:</strong> ${totalEquiposInscritos}</p>
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
    equiposCache = [];
    return;
  }

  if (!cont) return;
  cont.innerHTML = "<p>Cargando equipos...</p>";

  try {
    const data = await window.ApiClient.get(`/equipos/campeonato/${campeonatoId}`);
    let equipos = Array.isArray(data) ? data : (data.equipos || data.data || []);

    if (eventoIdSeleccionado) {
      try {
        const dataEvento = await window.ApiClient.get(`/eventos/${eventoIdSeleccionado}/equipos`);
        const idsEvento = new Set((dataEvento.equipos || []).map((e) => e.id));
        equipos = equipos.filter((e) => idsEvento.has(e.id));
      } catch (errorEvento) {
        console.warn("No se pudo filtrar equipos por categoría:", errorEvento);
      }
    }

    totalEquiposInscritos = equipos.length;

    await cargarInfoContexto();
    equiposCache = equipos;
    renderListadoEquipos();
  } catch (error) {
    console.error("Error cargando equipos:", error);
    mostrarNotificacion("Error cargando equipos", "error");
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

  return `
    <div class="equipo-card campeonato-card">
      <div class="equipo-header campeonato-header">
        <span class="item-index">${index + 1}.</span>
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
        <button class="btn btn-warning" onclick="editarEquipo(${equipo.id})">
          <i class="fas fa-edit"></i> Editar
        </button>
        <button class="btn btn-danger" onclick="eliminarEquipo(${equipo.id})">
          <i class="fas fa-trash"></i> Eliminar
        </button>
      </div>
    </div>
  `;
}

function renderTablaEquipos(equipos) {
  const baseUrl = (window.API_BASE_URL || "").replace(/\/api\/?$/, "") || window.location.origin;
  const filas = equipos
    .map((equipo, index) => {
      const logoUrl = equipo.logo_url
        ? (equipo.logo_url.startsWith("http") ? equipo.logo_url : `${baseUrl}${equipo.logo_url}`)
        : "";
      const logo = logoUrl
        ? `<img src="${logoUrl}" alt="Logo ${escapeHtml(equipo.nombre || "")}" class="list-table-logo" />`
        : "<span>—</span>";

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${logo}</td>
          <td>${escapeHtml(equipo.nombre || "—")}</td>
          <td>${escapeHtml(equipo.director_tecnico || "-")}</td>
          <td>${escapeHtml(equipo.telefono || "-")}</td>
          <td>${escapeHtml(equipo.email || "-")}</td>
          <td class="list-table-actions">
            <button class="btn btn-primary" onclick="irAJugadores(${equipo.id})">
              <i class="fas fa-user-friends"></i> Jugadores
            </button>
            <button class="btn btn-warning" onclick="editarEquipo(${equipo.id})">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn btn-danger" onclick="eliminarEquipo(${equipo.id})">
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
const COLORES_PALETA = [
  "#e53935","#d81b60","#8e24aa","#5e35b1","#3949ab","#1e88e5","#039be5","#00acc1","#00897b",
  "#43a047","#7cb342","#c0ca33","#fdd835","#ffb300","#fb8c00","#f4511e","#6d4c41","#757575","#212121"
];

function mostrarModalCrearEquipo() {
  const selectCamp = document.getElementById("select-campeonato");
  campeonatoId = selectCamp?.value ? parseInt(selectCamp.value, 10) : null;
  if (!campeonatoId) {
    mostrarNotificacion("Primero selecciona un campeonato", "warning");
    return;
  }
  document.getElementById("modal-titulo").textContent = "Agregar Equipo";
  activarTabEquipo("nuevo");
  document.getElementById("equipo-nombre").value = "";
  document.getElementById("equipo-dt").value = "";
  document.getElementById("equipo-at").value = "";
  document.getElementById("equipo-medico").value = "";
  document.getElementById("equipo-telefono").value = "";
  document.getElementById("equipo-email").value = "";
  document.getElementById("equipo-color-primario").value = "";
  document.getElementById("equipo-color-secundario").value = "";
  document.getElementById("equipo-color-terciario").value = "";
  document.getElementById("equipo-cabeza-serie").checked = false;
  document.getElementById("preview-primario").style.background = "#e53935";
  document.getElementById("preview-secundario").style.background = "#1e88e5";
  document.getElementById("preview-terciario").style.background = "#43a047";
  const logoInput = document.getElementById("equipo-logo");
  if (logoInput) logoInput.value = "";
  document.querySelectorAll(".color-dropdown").forEach((d) => d.classList.remove("open"));
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

  function initColorPicker(previewId, inputId, dropdownId, defaultColor) {
    const preview = document.getElementById(previewId);
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    const palette = dropdown?.querySelector(".color-palette");
    const hexInput = dropdown?.querySelector(".color-hex-input");

    if (!palette || palette.dataset.inited) return;
    palette.dataset.inited = "1";

    COLORES_PALETA.forEach((c) => {
      const sw = document.createElement("button");
      sw.type = "button";
      sw.className = "color-swatch";
      sw.style.background = c;
      sw.dataset.color = c;
      sw.addEventListener("click", () => {
        input.value = c;
        preview.style.background = c;
        if (hexInput) hexInput.value = c;
        dropdown?.classList.remove("open");
      });
      palette.appendChild(sw);
    });

    function setColor(val) {
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        input.value = val;
        preview.style.background = val;
      }
    }

    preview?.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".color-dropdown.open").forEach((d) => d.classList.remove("open"));
      dropdown?.classList.toggle("open");
      if (hexInput) hexInput.value = input.value || defaultColor;
    });

    input?.addEventListener("input", () => setColor(input.value));
    input?.addEventListener("change", () => setColor(input.value));

    if (hexInput) {
      hexInput.addEventListener("input", () => setColor(hexInput.value));
      hexInput.addEventListener("change", () => {
        setColor(hexInput.value);
        dropdown?.classList.remove("open");
      });
    }
  }

  initColorPicker("preview-primario", "equipo-color-primario", "dropdown-primario", "#e53935");
  initColorPicker("preview-secundario", "equipo-color-secundario", "dropdown-secundario", "#1e88e5");
  initColorPicker("preview-terciario", "equipo-color-terciario", "dropdown-terciario", "#43a047");

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".color-dropdown") && !e.target.closest(".color-preview")) {
      document.querySelectorAll(".color-dropdown.open").forEach((d) => d.classList.remove("open"));
    }
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
// Guardar equipo (crear nuevo o asignar existente a evento)
// ======================
async function guardarEquipo() {
  const tabActivo = document.querySelector(".modal-tab.active")?.dataset?.tab;
  const usarExistente = tabActivo === "existente";
  const selectEvento = document.getElementById("select-evento");
  eventoIdSeleccionado = selectEvento?.value ? parseInt(selectEvento.value, 10) : null;

  if (usarExistente) {
    const equipoId = document.getElementById("select-equipo-existente").value;
    if (!equipoId) {
      mostrarNotificacion("Selecciona un equipo existente", "warning");
      return;
    }
    if (!eventoIdSeleccionado) {
      mostrarNotificacion("Para asignar equipo a categoría, selecciona un evento primero", "warning");
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
    const url = (window.API_BASE_URL || "http://localhost:5000/api").replace(/\/?$/, "") + "/equipos";
    const resp = await fetch(url, {
      method: "POST",
      body: fd,
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Error creando equipo");

    let mensaje = "Equipo creado correctamente";
    if (eventoIdSeleccionado && data.equipo) {
      try {
        await window.ApiClient.post(`/eventos/${eventoIdSeleccionado}/equipos`, { equipo_id: data.equipo.id });
        mensaje = "Equipo creado y asignado a la categoría";
      } catch (_) {}
    }
    mostrarNotificacion(mensaje, "success");
    cerrarModal("modal-equipo");
    cargarEquipos();
  } catch (err) {
    mostrarNotificacion(err.message || "Error creando equipo", "error");
  }
}

// ======================
// Editar / Eliminar
// ======================
async function editarEquipo(id) {
  mostrarNotificacion("Editar equipo (próximamente)", "info");
}

async function eliminarEquipo(id) {
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
