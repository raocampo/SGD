// frontend/js/eventos.js

let campeonatoSeleccionado = null;
let eventosCache = [];
let campeonatosEventosCache = [];
let vistaEventos = localStorage.getItem("sgd_vista_eventos") || "cards";
vistaEventos = vistaEventos === "table" ? "table" : "cards";
const formatoMoneda = new Intl.NumberFormat("es-EC", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizarCostoInscripcion(valor, fallback = null) {
  if (valor === null || valor === undefined || valor === "") return fallback;
  const numero = Number.parseFloat(String(valor).replace(",", "."));
  if (!Number.isFinite(numero) || numero < 0) return fallback;
  return Number(numero.toFixed(2));
}

function formatearCostoInscripcion(valor) {
  const numero = Number.parseFloat(valor);
  if (!Number.isFinite(numero)) return "$0.00";
  return `$${formatoMoneda.format(numero)}`;
}

function formatearFechaSolo(valor) {
  if (!valor) return "-";
  const texto = String(valor).trim();
  if (!texto) return "-";
  if (texto.includes("T")) return texto.split("T")[0];
  return texto.slice(0, 10);
}

function formatearMetodoCompetencia(valor) {
  const key = String(valor || "grupos").toLowerCase();
  if (key === "liga") return "Liga";
  if (key === "eliminatoria") return "Eliminatoria";
  if (key === "mixto") return "Mixto";
  return "Grupos";
}

function formatearBloqueoMorososEvento(evento = {}) {
  const valor = evento?.bloquear_morosos;
  if (valor === null || valor === undefined || valor === "") return "Hereda";
  const activo = valor === true || String(valor).toLowerCase() === "true";
  const monto = normalizarCostoInscripcion(evento?.bloqueo_morosidad_monto, null);
  if (!activo) return "Desactivado";
  if (monto === null) return "Activo";
  return `Activo (> ${formatearCostoInscripcion(monto)})`;
}

function normalizarMetodoCompetencia(valor) {
  const key = String(valor || "").toLowerCase();
  if (["grupos", "liga", "eliminatoria", "mixto"].includes(key)) return key;
  return null;
}

function actualizarVisibilidadConfigEliminatoria() {
  const metodo = document.getElementById("evt-metodo-competencia")?.value || "grupos";
  const wrap = document.getElementById("evt-wrap-eliminatoria-equipos");
  if (!wrap) return;
  wrap.style.display = ["eliminatoria", "mixto"].includes(metodo) ? "" : "none";
}

function toggleFormularioCategoria(forzarEstado) {
  const bloque = document.getElementById("bloque-crear-evento");
  if (!bloque) return;
  const visibleActual = bloque.style.display !== "none";
  const mostrar = typeof forzarEstado === "boolean" ? forzarEstado : !visibleActual;
  bloque.style.display = mostrar ? "" : "none";
}

function obtenerNumeroEventoVisible(evento, fallback = null) {
  const n = Number.parseInt(evento?.numero_campeonato, 10);
  if (Number.isFinite(n) && n > 0) return n;
  if (Number.isFinite(Number(fallback)) && Number(fallback) > 0) return Number(fallback);
  return null;
}

function aplicarFechasDesdeCampeonato() {
  const inicio = document.getElementById("evt-fecha-inicio");
  const fin = document.getElementById("evt-fecha-fin");
  if (!inicio || !fin) return;

  const camp = campeonatosEventosCache.find(
    (x) => Number(x.id) === Number(campeonatoSeleccionado)
  );
  if (!camp) {
    inicio.value = "";
    fin.value = "";
    return;
  }

  const fechaInicio = formatearFechaSolo(camp.fecha_inicio);
  const fechaFin = formatearFechaSolo(camp.fecha_fin);
  inicio.value = fechaInicio === "-" ? "" : fechaInicio;
  fin.value = fechaFin === "-" ? "" : fechaFin;
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
  actualizarVisibilidadConfigEliminatoria();
  toggleFormularioCategoria(false);

  const selectMetodo = document.getElementById("evt-metodo-competencia");
  if (selectMetodo) {
    selectMetodo.addEventListener("change", actualizarVisibilidadConfigEliminatoria);
  }

  await cargarCampeonatosSelect();

  // si vienes desde campeonatos.html?campeonato=1
  const params = new URLSearchParams(window.location.search);
  const cId = params.get("campeonato");
  if (cId) {
    campeonatoSeleccionado = parseInt(cId, 10);
    const sel = document.getElementById("select-campeonato");
    sel.value = String(campeonatoSeleccionado);
    aplicarFechasDesdeCampeonato();
    await cargarEventos();
    return;
  }

  if (campeonatoSeleccionado) {
    aplicarFechasDesdeCampeonato();
    await cargarEventos();
  }
});

async function cargarCampeonatosSelect() {
  const select = document.getElementById("select-campeonato");
  select.innerHTML = `<option value="">— Selecciona un campeonato —</option>`;

  try {
    const data = await CampeonatosAPI.obtenerTodos();
    const lista = Array.isArray(data) ? data : (data.campeonatos || data.data || []);
    campeonatosEventosCache = lista;

    lista.forEach((c) => {
      select.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });

    if (!campeonatoSeleccionado && lista.length) {
      const ultimo = [...lista]
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))[0];
      if (ultimo?.id) {
        campeonatoSeleccionado = Number.parseInt(ultimo.id, 10);
        select.value = String(campeonatoSeleccionado);
      }
    }

    select.onchange = async () => {
      campeonatoSeleccionado = select.value ? parseInt(select.value, 10) : null;
      aplicarFechasDesdeCampeonato();
      eventosCache = [];
      document.getElementById("lista-eventos").innerHTML = "";
      if (campeonatoSeleccionado) {
        await cargarEventos();
      }
    };
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error cargando campeonatos", "error");
  }
}

// botón "Cargar categorías" (también usado al cambiar campeonato)
async function cargarEventos() {
  const cont = document.getElementById("lista-eventos");
  cont.innerHTML = "<p>Cargando categorías...</p>";

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
    mostrarNotificacion("Error cargando categorías", "error");
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
        <p>No hay categorías creadas en este campeonato.</p>
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
  const numero = obtenerNumeroEventoVisible(e);
  return `
    <div class="campeonato-card">
      <div class="campeonato-header">
        <h3>${numero ? `${numero} - ` : ""}${escapeHtml(e.nombre || "Categoría")}</h3>
      </div>
      <div class="campeonato-info">
        <p><strong>Modalidad:</strong> ${escapeHtml(e.modalidad || "-")}</p>
        <p><strong>Método:</strong> ${escapeHtml(formatearMetodoCompetencia(e.metodo_competencia))}</p>
        <p><strong>Llave elim.:</strong> ${escapeHtml(e.eliminatoria_equipos || "Automática")}</p>
        <p><strong>Costo inscripción:</strong> ${escapeHtml(formatearCostoInscripcion(e.costo_inscripcion))}</p>
        <p><strong>Bloqueo morosos:</strong> ${escapeHtml(formatearBloqueoMorososEvento(e))}</p>
        <p><strong>Fechas:</strong> ${escapeHtml(formatearFechaSolo(e.fecha_inicio))} - ${escapeHtml(formatearFechaSolo(e.fecha_fin))}</p>
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
      const numero = obtenerNumeroEventoVisible(e, index + 1);
      return `
        <tr>
          <td>${numero}</td>
          <td>${escapeHtml(e.nombre || "—")}</td>
          <td>${escapeHtml(e.modalidad || "-")}</td>
          <td>${escapeHtml(formatearMetodoCompetencia(e.metodo_competencia))}</td>
          <td>${escapeHtml(e.eliminatoria_equipos || "Auto")}</td>
          <td>${escapeHtml(formatearCostoInscripcion(e.costo_inscripcion))}</td>
          <td>${escapeHtml(formatearBloqueoMorososEvento(e))}</td>
          <td>${escapeHtml(formatearFechaSolo(e.fecha_inicio))}</td>
          <td>${escapeHtml(formatearFechaSolo(e.fecha_fin))}</td>
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
            <th>Categoría</th>
            <th>Modalidad</th>
            <th>Método</th>
            <th>Llave elim.</th>
            <th>Costo inscripción</th>
            <th>Bloqueo morosos</th>
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
  const metodoCompetencia = document.getElementById("evt-metodo-competencia")?.value || "grupos";
  const eliminatoriaEquiposRaw = document.getElementById("evt-eliminatoria-equipos")?.value || "";
  const fecha_inicio = document.getElementById("evt-fecha-inicio").value;
  const fecha_fin = document.getElementById("evt-fecha-fin").value;
  const costo_inscripcion = normalizarCostoInscripcion(
    document.getElementById("evt-costo-inscripcion").value,
    0
  );
  const bloqueoMorososRaw = document.getElementById("evt-bloquear-morosos")?.value ?? "";
  const bloqueoMorosos =
    bloqueoMorososRaw === "" ? null : bloqueoMorososRaw === "true";
  const bloqueoMorosidadMonto = normalizarCostoInscripcion(
    document.getElementById("evt-bloqueo-morosidad-monto")?.value,
    null
  );
  const metodo_competencia = normalizarMetodoCompetencia(metodoCompetencia);
  if (!metodo_competencia) {
    mostrarNotificacion("Método de competencia inválido.", "warning");
    return;
  }
  const eliminatoria_equipos = eliminatoriaEquiposRaw ? Number(eliminatoriaEquiposRaw) : null;

  if (!nombre || !fecha_inicio || !fecha_fin) {
    mostrarNotificacion("Completa nombre + fechas", "warning");
    return;
  }

  try {
    await EventosAPI.crear({
      campeonato_id: campeonatoSeleccionado,
      nombre,
      modalidad,
      metodo_competencia,
      eliminatoria_equipos,
      fecha_inicio,
      fecha_fin,
      costo_inscripcion,
      bloquear_morosos: bloqueoMorosos,
      bloqueo_morosidad_monto: bloqueoMorosidadMonto,
    });
    mostrarNotificacion("Categoría creada", "success");
    document.getElementById("evt-nombre").value = "";
    document.getElementById("evt-costo-inscripcion").value = "";
    const selectMetodo = document.getElementById("evt-metodo-competencia");
    const selectElim = document.getElementById("evt-eliminatoria-equipos");
    if (selectMetodo) selectMetodo.value = "grupos";
    if (selectElim) selectElim.value = "";
    const selectBloqMorosos = document.getElementById("evt-bloquear-morosos");
    const inputBloqMonto = document.getElementById("evt-bloqueo-morosidad-monto");
    if (selectBloqMorosos) selectBloqMorosos.value = "";
    if (inputBloqMonto) inputBloqMonto.value = "";
    actualizarVisibilidadConfigEliminatoria();
    toggleFormularioCategoria(false);
    await cargarEventos();
  } catch (err) {
    console.error(err);
    mostrarNotificacion(err.message || "Error creando categoría", "error");
  }
}

async function eliminarEvento(id) {
  if (!confirm("¿Eliminar esta categoría?")) return;

  try {
    await EventosAPI.eliminar(id);
    mostrarNotificacion("Categoría eliminada", "success");
    await cargarEventos();
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error eliminando categoría", "error");
  }
}

// (opcional) editar rápido por prompt
async function editarEvento(id) {
  const evento = eventosCache.find((item) => Number(item.id) === Number(id));
  const nuevoNombre = prompt(
    "Nuevo nombre de la categoría:",
    evento?.nombre || ""
  );
  if (!nuevoNombre) return;
  const costoActual = normalizarCostoInscripcion(evento?.costo_inscripcion, 0);
  const nuevoCosto = prompt(
    "Costo de inscripción (ej: 35.00):",
    String(costoActual ?? 0)
  );
  const metodoActual = normalizarMetodoCompetencia(evento?.metodo_competencia) || "grupos";
  const nuevoMetodoRaw = prompt(
    "Método (grupos, liga, eliminatoria, mixto):",
    metodoActual
  );
  if (nuevoMetodoRaw === null) return;
  const nuevoMetodo = normalizarMetodoCompetencia(nuevoMetodoRaw);
  if (!nuevoMetodo) {
    mostrarNotificacion("Método inválido. Usa: grupos, liga, eliminatoria o mixto.", "warning");
    return;
  }

  let nuevaLlave = evento?.eliminatoria_equipos ? String(evento.eliminatoria_equipos) : "";
  if (nuevoMetodo === "eliminatoria" || nuevoMetodo === "mixto") {
    const llavePrompt = prompt(
      "Tamaño de llave eliminatoria (vacío=auto, 4, 8, 16, 32):",
      nuevaLlave
    );
    if (llavePrompt === null) return;
    nuevaLlave = String(llavePrompt || "").trim();
    if (nuevaLlave && !["4", "8", "16", "32"].includes(nuevaLlave)) {
      mostrarNotificacion("Llave inválida. Usa 4, 8, 16, 32 o vacío.", "warning");
      return;
    }
  } else {
    nuevaLlave = "";
  }

  const costo_inscripcion = normalizarCostoInscripcion(nuevoCosto, null);
  if (nuevoCosto !== null && costo_inscripcion === null) {
    mostrarNotificacion("Costo inválido. Usa solo números.", "warning");
    return;
  }

  const bloqueoActual =
    evento?.bloquear_morosos === null || evento?.bloquear_morosos === undefined || evento?.bloquear_morosos === ""
      ? "heredar"
      : (evento?.bloquear_morosos === true || String(evento?.bloquear_morosos).toLowerCase() === "true")
        ? "activar"
        : "desactivar";
  const nuevoBloqueoRaw = prompt(
    "Bloqueo morosos (heredar, activar, desactivar):",
    bloqueoActual
  );
  if (nuevoBloqueoRaw === null) return;
  const nuevoBloqueo = String(nuevoBloqueoRaw || "").trim().toLowerCase();
  if (!["heredar", "activar", "desactivar"].includes(nuevoBloqueo)) {
    mostrarNotificacion("Valor inválido para bloqueo. Usa: heredar, activar, desactivar.", "warning");
    return;
  }

  const montoBloqueoActual = normalizarCostoInscripcion(evento?.bloqueo_morosidad_monto, null);
  const nuevoMontoBloqueoRaw = prompt(
    "Monto de bloqueo (vacío = heredar):",
    montoBloqueoActual === null ? "" : String(montoBloqueoActual)
  );
  if (nuevoMontoBloqueoRaw === null) return;
  const nuevoMontoBloqueo = normalizarCostoInscripcion(nuevoMontoBloqueoRaw, null);
  if (String(nuevoMontoBloqueoRaw || "").trim() !== "" && nuevoMontoBloqueo === null) {
    mostrarNotificacion("Monto de bloqueo inválido. Usa solo números >= 0.", "warning");
    return;
  }

  try {
    const payload = { nombre: nuevoNombre, metodo_competencia: nuevoMetodo };
    payload.eliminatoria_equipos = nuevaLlave ? Number(nuevaLlave) : null;
    if (costo_inscripcion !== null) payload.costo_inscripcion = costo_inscripcion;
    payload.bloquear_morosos =
      nuevoBloqueo === "heredar" ? null : nuevoBloqueo === "activar";
    payload.bloqueo_morosidad_monto =
      String(nuevoMontoBloqueoRaw || "").trim() === "" ? null : nuevoMontoBloqueo;
    await EventosAPI.actualizar(id, payload);
    mostrarNotificacion("Categoría actualizada", "success");
    await cargarEventos();
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error actualizando categoría", "error");
  }
}

window.cambiarVistaEventos = cambiarVistaEventos;
window.toggleFormularioCategoria = toggleFormularioCategoria;



