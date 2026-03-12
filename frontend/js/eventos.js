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

function normalizarClasificadosPorGrupo(valor, fallback = null) {
  if (valor === null || valor === undefined || valor === "") return fallback;
  const n = Number.parseInt(valor, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function normalizarColorHexEvento(valor, fallback = "") {
  const raw = String(valor || "").trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
    if (raw.length === 4) {
      return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toUpperCase();
    }
    return raw.toUpperCase();
  }
  return fallback;
}

function obtenerColoresCarnetCampeonatoSeleccionado() {
  const camp = campeonatosEventosCache.find((item) => Number(item.id) === Number(campeonatoSeleccionado));
  return {
    primario: normalizarColorHexEvento(camp?.color_primario, "#FACC15"),
    secundario: normalizarColorHexEvento(camp?.color_secundario, "#111827"),
    acento: normalizarColorHexEvento(camp?.color_acento, "#22C55E"),
  };
}

function formatearCarnetEstilo(valor) {
  const key = String(valor || "").toLowerCase();
  if (key === "franja") return "Franja diagonal";
  if (key === "marco") return "Marco deportivo";
  if (key === "minimal") return "Minimal";
  if (key === "clasico") return "Clásico";
  return "Hereda campeonato";
}

function formatearClasificadosPorGrupo(evento = {}) {
  const metodo = normalizarMetodoCompetencia(evento?.metodo_competencia) || "grupos";
  if (!["grupos", "mixto"].includes(metodo)) return "No aplica";
  const n = normalizarClasificadosPorGrupo(evento?.clasificados_por_grupo, 2);
  return `${n || 2}`;
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
  const wrapClasificados = document.getElementById("evt-wrap-clasificados-por-grupo");
  if (!wrap) return;
  wrap.style.display = ["eliminatoria", "mixto"].includes(metodo) ? "" : "none";
  if (wrapClasificados) {
    wrapClasificados.style.display = ["grupos", "mixto"].includes(metodo) ? "" : "none";
  }
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
  const colores = obtenerColoresCarnetCampeonatoSeleccionado();
  const colorPrimario = document.getElementById("evt-carnet-color-primario");
  const colorSecundario = document.getElementById("evt-carnet-color-secundario");
  const colorAcento = document.getElementById("evt-carnet-color-acento");
  if (colorPrimario) colorPrimario.value = colores.primario;
  if (colorSecundario) colorSecundario.value = colores.secundario;
  if (colorAcento) colorAcento.value = colores.acento;
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
        <p><strong>Clasifican/grupo:</strong> ${escapeHtml(formatearClasificadosPorGrupo(e))}</p>
        <p><strong>Llave elim.:</strong> ${escapeHtml(e.eliminatoria_equipos || "Automática")}</p>
        <p><strong>Costo inscripción:</strong> ${escapeHtml(formatearCostoInscripcion(e.costo_inscripcion))}</p>
        <p><strong>Bloqueo morosos:</strong> ${escapeHtml(formatearBloqueoMorososEvento(e))}</p>
        <p><strong>Diseño carné:</strong> ${escapeHtml(formatearCarnetEstilo(e.carnet_estilo))}</p>
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
          <td>${escapeHtml(formatearClasificadosPorGrupo(e))}</td>
          <td>${escapeHtml(e.eliminatoria_equipos || "Auto")}</td>
          <td>${escapeHtml(formatearCostoInscripcion(e.costo_inscripcion))}</td>
          <td>${escapeHtml(formatearBloqueoMorososEvento(e))}</td>
          <td>${escapeHtml(formatearCarnetEstilo(e.carnet_estilo))}</td>
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
            <th>Clasif./grupo</th>
            <th>Llave elim.</th>
            <th>Costo inscripción</th>
            <th>Bloqueo morosos</th>
            <th>Diseño carné</th>
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
  const clasificadosRaw = document.getElementById("evt-clasificados-por-grupo")?.value || "";
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
  const carnet_estilo = String(document.getElementById("evt-carnet-estilo")?.value || "").trim() || null;
  const carnet_color_primario = normalizarColorHexEvento(
    document.getElementById("evt-carnet-color-primario")?.value,
    ""
  ) || null;
  const carnet_color_secundario = normalizarColorHexEvento(
    document.getElementById("evt-carnet-color-secundario")?.value,
    ""
  ) || null;
  const carnet_color_acento = normalizarColorHexEvento(
    document.getElementById("evt-carnet-color-acento")?.value,
    ""
  ) || null;
  const coloresCamp = obtenerColoresCarnetCampeonatoSeleccionado();
  const personalizaCarnetCategoria =
    Boolean(carnet_estilo) ||
    carnet_color_primario !== coloresCamp.primario ||
    carnet_color_secundario !== coloresCamp.secundario ||
    carnet_color_acento !== coloresCamp.acento;
  const metodo_competencia = normalizarMetodoCompetencia(metodoCompetencia);
  if (!metodo_competencia) {
    mostrarNotificacion("Método de competencia inválido.", "warning");
    return;
  }
  const clasificados_por_grupo = ["grupos", "mixto"].includes(metodo_competencia)
    ? normalizarClasificadosPorGrupo(clasificadosRaw, 2)
    : null;
  if (["grupos", "mixto"].includes(metodo_competencia) && !clasificados_por_grupo) {
    mostrarNotificacion("Clasificados por grupo inválido.", "warning");
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
      clasificados_por_grupo,
      eliminatoria_equipos,
      fecha_inicio,
      fecha_fin,
      costo_inscripcion,
      bloquear_morosos: bloqueoMorosos,
      bloqueo_morosidad_monto: bloqueoMorosidadMonto,
      carnet_estilo: personalizaCarnetCategoria ? carnet_estilo : null,
      carnet_color_primario: personalizaCarnetCategoria ? carnet_color_primario : null,
      carnet_color_secundario: personalizaCarnetCategoria ? carnet_color_secundario : null,
      carnet_color_acento: personalizaCarnetCategoria ? carnet_color_acento : null,
    });
    mostrarNotificacion("Categoría creada", "success");
    document.getElementById("evt-nombre").value = "";
    document.getElementById("evt-costo-inscripcion").value = "";
    const inputClasificados = document.getElementById("evt-clasificados-por-grupo");
    const selectMetodo = document.getElementById("evt-metodo-competencia");
    const selectElim = document.getElementById("evt-eliminatoria-equipos");
    if (inputClasificados) inputClasificados.value = "2";
    if (selectMetodo) selectMetodo.value = "grupos";
    if (selectElim) selectElim.value = "";
    const selectBloqMorosos = document.getElementById("evt-bloquear-morosos");
    const inputBloqMonto = document.getElementById("evt-bloqueo-morosidad-monto");
    if (selectBloqMorosos) selectBloqMorosos.value = "";
    if (inputBloqMonto) inputBloqMonto.value = "";
    const selectCarnetEstilo = document.getElementById("evt-carnet-estilo");
    const colorPrimario = document.getElementById("evt-carnet-color-primario");
    const colorSecundario = document.getElementById("evt-carnet-color-secundario");
    const colorAcento = document.getElementById("evt-carnet-color-acento");
    const coloresCamp = obtenerColoresCarnetCampeonatoSeleccionado();
    if (selectCarnetEstilo) selectCarnetEstilo.value = "";
    if (colorPrimario) colorPrimario.value = coloresCamp.primario;
    if (colorSecundario) colorSecundario.value = coloresCamp.secundario;
    if (colorAcento) colorAcento.value = coloresCamp.acento;
    actualizarVisibilidadConfigEliminatoria();
    toggleFormularioCategoria(false);
    await cargarEventos();
  } catch (err) {
    console.error(err);
    mostrarNotificacion(err.message || "Error creando categoría", "error");
  }
}

async function eliminarEvento(id) {
  const ok = await window.mostrarConfirmacion({
    titulo: "Eliminar categoría",
    mensaje: "¿Eliminar esta categoría del campeonato actual?",
    tipo: "warning",
    textoConfirmar: "Eliminar",
    claseConfirmar: "btn-danger",
  });
  if (!ok) return;

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
  if (!evento) {
    mostrarNotificacion("No se encontró la categoría seleccionada.", "warning");
    return;
  }
  const costoActual = normalizarCostoInscripcion(evento?.costo_inscripcion, 0);
  const metodoActual = normalizarMetodoCompetencia(evento?.metodo_competencia) || "grupos";
  const bloqueoActual =
    evento?.bloquear_morosos === null || evento?.bloquear_morosos === undefined || evento?.bloquear_morosos === ""
      ? "heredar"
      : (evento?.bloquear_morosos === true || String(evento?.bloquear_morosos).toLowerCase() === "true")
        ? "activar"
        : "desactivar";
  const montoBloqueoActual = normalizarCostoInscripcion(evento?.bloqueo_morosidad_monto, null);
  const coloresCamp = obtenerColoresCarnetCampeonatoSeleccionado();
  const form = await window.mostrarFormularioModal({
    titulo: "Editar categoría",
    mensaje: "Actualiza la configuración deportiva y financiera de la categoría.",
    tipo: "info",
    textoConfirmar: "Guardar cambios",
    ancho: "lg",
    campos: [
      {
        name: "nombre",
        label: "Nombre de la categoría",
        type: "text",
        value: evento?.nombre || "",
        required: true,
      },
      {
        name: "costo_inscripcion",
        label: "Costo de inscripción",
        type: "number",
        value: String(costoActual ?? 0),
        min: 0,
        step: "0.01",
      },
      {
        name: "metodo_competencia",
        label: "Método de competencia",
        type: "select",
        value: metodoActual,
        required: true,
        options: [
          { value: "grupos", label: "Grupos" },
          { value: "liga", label: "Liga" },
          { value: "eliminatoria", label: "Eliminatoria" },
          { value: "mixto", label: "Mixto" },
        ],
      },
      {
        name: "clasificados_por_grupo",
        label: "Clasifican por grupo",
        type: "number",
        value: evento?.clasificados_por_grupo ? String(evento.clasificados_por_grupo) : "2",
        min: 1,
        step: 1,
        validate: (value, values) => {
          if (!["grupos", "mixto"].includes(values.metodo_competencia)) return "";
          return normalizarClasificadosPorGrupo(value, null)
            ? ""
            : "Clasificados por grupo inválido. Usa un entero mayor a 0.";
        },
      },
      {
        name: "eliminatoria_equipos",
        label: "Tamaño de llave eliminatoria",
        type: "select",
        value: evento?.eliminatoria_equipos ? String(evento.eliminatoria_equipos) : "",
        options: [
          { value: "", label: "Automática" },
          { value: "4", label: "4 equipos" },
          { value: "8", label: "8 equipos" },
          { value: "16", label: "16 equipos" },
          { value: "32", label: "32 equipos" },
        ],
        validate: (value, values) => {
          if (!["eliminatoria", "mixto"].includes(values.metodo_competencia)) return "";
          return value && !["4", "8", "16", "32"].includes(value)
            ? "Llave inválida. Usa 4, 8, 16, 32 o vacía."
            : "";
        },
      },
      {
        name: "bloquear_morosos",
        label: "Bloqueo morosos",
        type: "select",
        value: bloqueoActual,
        options: [
          { value: "heredar", label: "Heredar" },
          { value: "activar", label: "Activar" },
          { value: "desactivar", label: "Desactivar" },
        ],
      },
      {
        name: "bloqueo_morosidad_monto",
        label: "Monto de bloqueo",
        type: "number",
        value: montoBloqueoActual === null ? "" : String(montoBloqueoActual),
        min: 0,
        step: "0.01",
        validate: (value) => {
          if (String(value || "").trim() === "") return "";
          return normalizarCostoInscripcion(value, null) === null
            ? "Monto de bloqueo inválido. Usa solo números >= 0."
            : "";
        },
      },
      {
        name: "carnet_estilo",
        label: "Diseño de carné",
        type: "select",
        value: String(evento?.carnet_estilo || "").trim(),
        options: [
          { value: "", label: "Heredar campeonato" },
          { value: "clasico", label: "Clásico" },
          { value: "franja", label: "Franja diagonal" },
          { value: "marco", label: "Marco deportivo" },
          { value: "minimal", label: "Minimal" },
        ],
      },
      {
        name: "carnet_color_primario",
        label: "Color primario carné",
        type: "color",
        value: normalizarColorHexEvento(evento?.carnet_color_primario, coloresCamp.primario),
      },
      {
        name: "carnet_color_secundario",
        label: "Color secundario carné",
        type: "color",
        value: normalizarColorHexEvento(evento?.carnet_color_secundario, coloresCamp.secundario),
      },
      {
        name: "carnet_color_acento",
        label: "Color acento carné",
        type: "color",
        value: normalizarColorHexEvento(evento?.carnet_color_acento, coloresCamp.acento),
      },
    ],
  });
  if (!form) return;

  const nuevoNombre = String(form.nombre || "").trim();
  const nuevoMetodo = normalizarMetodoCompetencia(form.metodo_competencia);
  const clasificadosPrompt = ["grupos", "mixto"].includes(nuevoMetodo)
    ? String(form.clasificados_por_grupo || "").trim()
    : "";
  const nuevaLlave = ["eliminatoria", "mixto"].includes(nuevoMetodo)
    ? String(form.eliminatoria_equipos || "").trim()
    : "";
  const costo_inscripcion = normalizarCostoInscripcion(form.costo_inscripcion, null);
  const nuevoBloqueo = String(form.bloquear_morosos || bloqueoActual).trim().toLowerCase();
  const nuevoMontoBloqueoRaw = String(form.bloqueo_morosidad_monto || "").trim();
  const nuevoMontoBloqueo = normalizarCostoInscripcion(nuevoMontoBloqueoRaw, null);

  if (!nuevoNombre) return;
  if (!nuevoMetodo) {
    mostrarNotificacion("Método inválido. Usa: grupos, liga, eliminatoria o mixto.", "warning");
    return;
  }
  if (["grupos", "mixto"].includes(nuevoMetodo) && !normalizarClasificadosPorGrupo(clasificadosPrompt, null)) {
    mostrarNotificacion("Clasificados por grupo inválido. Usa un entero mayor a 0.", "warning");
    return;
  }
  if (nuevaLlave && !["4", "8", "16", "32"].includes(nuevaLlave)) {
    mostrarNotificacion("Llave inválida. Usa 4, 8, 16, 32 o vacío.", "warning");
    return;
  }
  if (String(form.costo_inscripcion || "").trim() !== "" && costo_inscripcion === null) {
    mostrarNotificacion("Costo inválido. Usa solo números.", "warning");
    return;
  }
  if (!["heredar", "activar", "desactivar"].includes(nuevoBloqueo)) {
    mostrarNotificacion("Valor inválido para bloqueo. Usa: heredar, activar, desactivar.", "warning");
    return;
  }
  if (nuevoMontoBloqueoRaw && nuevoMontoBloqueo === null) {
    mostrarNotificacion("Monto de bloqueo inválido. Usa solo números >= 0.", "warning");
    return;
  }

  try {
    const payload = { nombre: nuevoNombre, metodo_competencia: nuevoMetodo };
    payload.clasificados_por_grupo =
      nuevoMetodo === "grupos" || nuevoMetodo === "mixto"
        ? normalizarClasificadosPorGrupo(clasificadosPrompt, 2)
        : null;
    payload.eliminatoria_equipos = nuevaLlave ? Number(nuevaLlave) : null;
    if (costo_inscripcion !== null) payload.costo_inscripcion = costo_inscripcion;
    payload.bloquear_morosos =
      nuevoBloqueo === "heredar" ? null : nuevoBloqueo === "activar";
    payload.bloqueo_morosidad_monto =
      String(nuevoMontoBloqueoRaw || "").trim() === "" ? null : nuevoMontoBloqueo;
    const nuevoEstiloCarnet = String(form.carnet_estilo || "").trim() || null;
    const nuevoColorPrimarioCarnet = normalizarColorHexEvento(form.carnet_color_primario, "") || null;
    const nuevoColorSecundarioCarnet = normalizarColorHexEvento(form.carnet_color_secundario, "") || null;
    const nuevoColorAcentoCarnet = normalizarColorHexEvento(form.carnet_color_acento, "") || null;
    const personalizaCarnet =
      Boolean(nuevoEstiloCarnet) ||
      nuevoColorPrimarioCarnet !== coloresCamp.primario ||
      nuevoColorSecundarioCarnet !== coloresCamp.secundario ||
      nuevoColorAcentoCarnet !== coloresCamp.acento;
    payload.carnet_estilo = personalizaCarnet ? nuevoEstiloCarnet : null;
    payload.carnet_color_primario = personalizaCarnet ? nuevoColorPrimarioCarnet : null;
    payload.carnet_color_secundario = personalizaCarnet ? nuevoColorSecundarioCarnet : null;
    payload.carnet_color_acento = personalizaCarnet ? nuevoColorAcentoCarnet : null;
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
