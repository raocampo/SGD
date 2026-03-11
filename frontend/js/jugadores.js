// frontend/js/jugadores.js

let equipoId = null;
let campeonatoId = null;
let eventoId = null;
let eventoNombreActual = "";
let equipoActual = null;
let jugadorActualEnEdicion = null;
let modoDirecto = false;

let minJugadoresPorEquipo = null;
let maxJugadoresPorEquipo = null;

let reglasDocumentos = {
  requiere_cedula_jugador: false,
  requiere_foto_cedula: false,
  requiere_foto_carnet: false,
};

let campeonatoMeta = {
  id: null,
  nombre: "",
  organizador: "",
  logo_url: "",
  carnet_fondo_url: "",
  color_primario: "#FACC15",
  color_secundario: "#111827",
  color_acento: "#22C55E",
  requiere_cedula_jugador: false,
  genera_carnets: false,
};

let jugadoresActuales = [];
let vistaJugadores = localStorage.getItem("sgd_vista_jugadores") || "cards";
vistaJugadores = vistaJugadores === "table" ? "table" : "cards";

const BACKEND_BASE = (
  window.resolveApiBaseUrl
    ? window.resolveApiBaseUrl()
    : window.API_BASE_URL || `${window.location.origin}/api`
).replace(/\/api\/?$/, "");

function rolUsuarioActual() {
  return String(window.Auth?.getUser?.()?.rol || "").toLowerCase();
}

function usuarioSoloGestionJugadores() {
  const rol = rolUsuarioActual();
  return rol === "tecnico" || rol === "dirigente" || rol === "jugador";
}

function usuarioSoloLecturaJugadores() {
  return rolUsuarioActual() === "jugador" || window.Auth?.isReadOnly?.() === true;
}

function tienePermisoReportesJugadores() {
  return !usuarioSoloGestionJugadores();
}

function validarPermisoReportesJugadores() {
  if (tienePermisoReportesJugadores()) return true;
  mostrarNotificacion("Tu rol no tiene permisos para generar o visualizar reportes", "warning");
  return false;
}

function obtenerParametroUrl(nombre) {
  const params = new URLSearchParams(window.location.search);
  return params.get(nombre);
}

function normalizarArchivoUrl(valor) {
  if (!valor) return "";
  const s = String(valor).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return `${BACKEND_BASE}${s}`;
  return `${BACKEND_BASE}/${s}`;
}

function normalizarColorHex(valor, fallback) {
  const raw = String(valor || "").trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
    if (raw.length === 4) {
      return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toUpperCase();
    }
    return raw.toUpperCase();
  }
  return fallback;
}

function hexToRgbTriplet(hex) {
  const safeHex = normalizarColorHex(hex, "#000000").slice(1);
  const intVal = Number.parseInt(safeHex, 16);
  const r = (intVal >> 16) & 255;
  const g = (intVal >> 8) & 255;
  const b = intVal & 255;
  return `${r}, ${g}, ${b}`;
}

function escapeCssUrl(url) {
  return String(url || "")
    .replace(/"/g, "%22")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\s/g, "%20");
}

function construirEstiloCarnet(meta = {}) {
  const primario = normalizarColorHex(meta.color_primario, "#FACC15");
  const secundario = normalizarColorHex(meta.color_secundario, "#111827");
  const acento = normalizarColorHex(meta.color_acento, "#22C55E");
  const fondo = normalizarArchivoUrl(meta.carnet_fondo_url);
  const variables = [
    `--carnet-primary:${primario}`,
    `--carnet-secondary:${secundario}`,
    `--carnet-accent:${acento}`,
    `--carnet-primary-rgb:${hexToRgbTriplet(primario)}`,
    `--carnet-secondary-rgb:${hexToRgbTriplet(secundario)}`,
    `--carnet-accent-rgb:${hexToRgbTriplet(acento)}`,
    `--carnet-watermark:${fondo ? `url("${escapeCssUrl(fondo)}")` : "none"}`,
  ];
  return variables.join("; ");
}

function renderLinkDocumento(url, texto) {
  if (!url) return "No cargado";
  const href = normalizarArchivoUrl(url);
  if (!href) return "No cargado";
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${texto}</a>`;
}

function renderEstadoDocumento(url, etiqueta) {
  return url
    ? `<span class="badge-estado estado-en_curso">${etiqueta}: cargado</span>`
    : `<span class="badge-estado estado-borrador">${etiqueta}: pendiente</span>`;
}

function obtenerEstadoDisciplinarioJugador(jugador = {}) {
  const suspension = jugador?.suspension || null;
  if (!suspension) {
    return {
      css: "estado-borrador",
      texto: eventoId ? "Habilitado" : "Sin evaluar",
      titulo: eventoId ? "Jugador habilitado para la categoría actual" : "Selecciona una categoría para evaluar sanciones",
    };
  }

  if (suspension.suspendido) {
    const pendientes = Number(suspension.partidos_pendientes || 0);
    return {
      css: "estado-suspendido-alerta",
      texto: `Suspendido ${pendientes} partido${pendientes === 1 ? "" : "s"}`,
      titulo: suspension.motivo || "Jugador suspendido",
    };
  }

  const amarillas = Number(suspension.amarillas_acumuladas || 0);
  if (amarillas > 0) {
    return {
      css: "estado-disciplina-alerta",
      texto: `Acumula ${amarillas} TA`,
      titulo: "Tarjetas amarillas acumuladas en la categoría actual",
    };
  }

  return {
    css: "estado-en_curso",
    texto: "Habilitado",
    titulo: "Jugador habilitado para la categoría actual",
  };
}

function renderEstadoDisciplinarioJugador(jugador = {}) {
  const estado = obtenerEstadoDisciplinarioJugador(jugador);
  return `<span class="badge-estado ${estado.css}" title="${escapeHtml(estado.titulo)}">${escapeHtml(
    estado.texto
  )}</span>`;
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function descomponerFechaTexto(value) {
  if (!value) return null;
  const texto = String(value).trim();
  if (!texto) return null;

  let match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return {
      year: match[1],
      month: match[2],
      day: match[3],
    };
  }

  match = texto.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (match) {
    return {
      year: match[3],
      month: match[2],
      day: match[1],
    };
  }

  const parsed = new Date(texto);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: String(parsed.getUTCFullYear()),
    month: String(parsed.getUTCMonth() + 1).padStart(2, "0"),
    day: String(parsed.getUTCDate()).padStart(2, "0"),
  };
}

function formatearFecha(value) {
  const partes = descomponerFechaTexto(value);
  if (!partes) return value ? String(value).slice(0, 10) : "—";
  return `${partes.day}/${partes.month}/${partes.year}`;
}

function obtenerFechaInput(value) {
  const partes = descomponerFechaTexto(value);
  if (!partes) return "";
  return `${partes.year}-${partes.month}-${partes.day}`;
}

function fotoCarnetMarcadaParaEliminar() {
  return document.getElementById("jugador-eliminar-foto-carnet")?.value === "true";
}

function marcarEliminacionFotoCarnet(flag = true) {
  const input = document.getElementById("jugador-eliminar-foto-carnet");
  if (!input) return;
  input.value = flag ? "true" : "false";
  actualizarEstadoRequisitosEnModal(jugadorActualEnEdicion);
}

function normalizarCedulaValor(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function eventoRequeridoParaReportes() {
  const selectEvento = document.getElementById("select-evento-jugador");
  if (!selectEvento) return false;
  const categoriasDisponibles = Array.from(selectEvento.options || []).filter((o) => o.value);
  return categoriasDisponibles.length > 0;
}

function reporteJugadoresRequiereEquipo(tipo = obtenerTipoReporteJugadores()) {
  return tipo !== "sanciones_categoria";
}

function contextoListoParaImportaciones() {
  if (usuarioSoloLecturaJugadores()) return false;
  if (!equipoId || !campeonatoId) return false;
  if (modoDirecto && eventoRequeridoParaReportes() && !eventoId) return false;
  return true;
}

function contextoListoParaReportes(tipo = obtenerTipoReporteJugadores()) {
  if (!campeonatoId) return false;
  if (modoDirecto && eventoRequeridoParaReportes() && !eventoId) return false;
  if (reporteJugadoresRequiereEquipo(tipo) && !equipoId) return false;
  return true;
}

function actualizarEstadoPanelReportes() {
  const bloque = document.getElementById("bloque-reportes-jugadores");
  const hint = document.getElementById("reportes-jugadores-hint");
  if (!bloque) return;

  const tipoReporte = obtenerTipoReporteJugadores();
  const habilitadoImportaciones = contextoListoParaImportaciones();
  const habilitadoContextoReporte = contextoListoParaReportes(tipoReporte);
  const habilitadoReportes = habilitadoContextoReporte && tienePermisoReportesJugadores();
  bloque.classList.toggle("reportes-jugadores-disabled", !habilitadoImportaciones && !habilitadoContextoReporte);

  [
    "btn-descargar-plantilla-jugadores",
    "btn-importar-jugadores-file",
    "btn-importar-docs-zip",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !habilitadoImportaciones;
  });

  [
    "btn-ver-reporte-jugadores",
    "btn-imprimir-reporte-jugadores",
    "btn-pdf-reporte-jugadores",
    "reporte-jugadores-tipo",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !habilitadoReportes;
  });

  if (hint) {
    if (!habilitadoContextoReporte) {
      hint.textContent = reporteJugadoresRequiereEquipo(tipoReporte)
        ? "Selecciona campeonato, categoría y equipo para habilitar los reportes."
        : "Selecciona campeonato y categoría para habilitar el consolidado disciplinario.";
    } else if (!tienePermisoReportesJugadores()) {
      hint.textContent = "Tu rol puede gestionar jugadores, pero no generar reportes.";
    } else {
      hint.textContent = "Selecciona el tipo de reporte y ejecuta la acción.";
    }
  }
}

function actualizarBotonesVistaJugadores() {
  const btnCards = document.getElementById("btn-vista-jugadores-cards");
  const btnTable = document.getElementById("btn-vista-jugadores-table");
  if (btnCards) btnCards.classList.toggle("active", vistaJugadores === "cards");
  if (btnTable) btnTable.classList.toggle("active", vistaJugadores === "table");
}

function cambiarVistaJugadores(vista = "cards") {
  vistaJugadores = vista === "table" ? "table" : "cards";
  localStorage.setItem("sgd_vista_jugadores", vistaJugadores);
  actualizarBotonesVistaJugadores();
  renderListadoJugadores();
}

function cambiarPestanaJugadores(tabId = "tab-jugadores-gestion") {
  if (tabId === "tab-jugadores-reportes" && !tienePermisoReportesJugadores()) {
    mostrarNotificacion("Tu rol no tiene acceso a reportes", "warning");
    tabId = "tab-jugadores-gestion";
  }

  const tabs = [
    { buttonId: "btn-tab-jugadores-gestion", panelId: "tab-jugadores-gestion" },
    { buttonId: "btn-tab-jugadores-reportes", panelId: "tab-jugadores-reportes" },
  ];

  tabs.forEach((item) => {
    const btn = document.getElementById(item.buttonId);
    const panel = document.getElementById(item.panelId);
    const activo = item.panelId === tabId;

    if (btn) btn.classList.toggle("active", activo);
    if (panel) panel.classList.toggle("active", activo);
  });
}

function aplicarRestriccionesRolEnJugadores() {
  if (!usuarioSoloGestionJugadores()) return;

  const btnReportes = document.getElementById("btn-tab-jugadores-reportes");
  const panelReportes = document.getElementById("tab-jugadores-reportes");
  const bloqueNomina = document.getElementById("bloque-nomina-jugadores");
  const bloqueSanciones = document.getElementById("bloque-sanciones-jugadores");
  const bloqueSancionesCategoria = document.getElementById("bloque-sanciones-categoria-jugadores");
  const bloqueCarnets = document.getElementById("bloque-carnets-jugadores");
  if (btnReportes) btnReportes.style.display = "none";
  if (panelReportes) panelReportes.style.display = "none";
  if (bloqueNomina) bloqueNomina.style.display = "none";
  if (bloqueSanciones) bloqueSanciones.style.display = "none";
  if (bloqueSancionesCategoria) bloqueSancionesCategoria.style.display = "none";
  if (bloqueCarnets) bloqueCarnets.style.display = "none";

  if (usuarioSoloLecturaJugadores()) {
    const btnNuevo = document.getElementById("btn-nuevo-jugador");
    if (btnNuevo) btnNuevo.style.display = "none";
    mostrarNotificacion("Rol jugador en modo solo lectura: puedes visualizar, no modificar.", "info");
  }
}

function actualizarResumenReglasDocumentos() {
  const el = document.getElementById("resumen-docs-jugador");
  if (!el) return;

  const reqIdentidad = esCedulaObligatoriaEnCampeonato();
  const reqCedula = reglasDocumentos.requiere_foto_cedula;
  const reqCarnet = reglasDocumentos.requiere_foto_carnet;

  if (!reqIdentidad && !reqCedula && !reqCarnet) {
    el.innerHTML = "<strong>Documentos jugador:</strong> cédula y fotos opcionales.";
    return;
  }

  const partes = [];
  partes.push(reqIdentidad ? "cédula obligatoria" : "cédula opcional");
  partes.push(reqCedula ? "foto de cédula requerida" : "foto de cédula opcional");
  partes.push(reqCarnet ? "foto carné requerida" : "foto carné opcional");
  el.innerHTML = `<strong>Documentos jugador:</strong> ${partes.join(" • ")}`;
}

function actualizarResumenCarnets() {
  const el = document.getElementById("resumen-carnets-jugador");
  if (!el) return;

  if (campeonatoMeta.genera_carnets) {
    el.innerHTML = "<strong>Carnés:</strong> habilitado para este campeonato.";
    el.style.color = "#166534";
    return;
  }

  el.innerHTML = "<strong>Carnés:</strong> no habilitado para este campeonato.";
  el.style.color = "#6b7280";
}

function esCedulaObligatoriaEnCampeonato() {
  return reglasDocumentos.requiere_cedula_jugador === true;
}

function actualizarEstadoRequisitosEnModal(jugador = null) {
  const reqIdentidad = esCedulaObligatoriaEnCampeonato();
  const reqCedula = reglasDocumentos.requiere_foto_cedula;
  const reqCarnet = reglasDocumentos.requiere_foto_carnet;
  const eliminarCarnet = fotoCarnetMarcadaParaEliminar();

  const inputIdentidad = document.getElementById("jugador-ced");
  const inputCedula = document.getElementById("jugador-foto-cedula");
  const inputCarnet = document.getElementById("jugador-foto-carnet");
  const hintIdentidad = document.getElementById("hint-cedidentidad");
  const hintCedula = document.getElementById("hint-foto-cedula");
  const hintCarnet = document.getElementById("hint-foto-carnet");
  const prevCedula = document.getElementById("preview-foto-cedula-actual");
  const prevCarnet = document.getElementById("preview-foto-carnet-actual");

  if (!inputIdentidad || !inputCedula || !inputCarnet || !hintCedula || !hintCarnet) return;

  inputIdentidad.required = reqIdentidad;
  inputCedula.required = reqCedula && !jugador?.foto_cedula_url;
  inputCarnet.required = reqCarnet && (!jugador?.foto_carnet_url || eliminarCarnet);

  if (hintIdentidad) {
    hintIdentidad.textContent = reqIdentidad
      ? "Requerida para este campeonato."
      : "Opcional para este campeonato.";
  }
  hintCedula.textContent = reqCedula
    ? "Requerido para este campeonato."
    : "Opcional para este campeonato.";
  hintCarnet.textContent = reqCarnet
    ? "Requerido para este campeonato."
    : "Opcional para este campeonato.";

  if (prevCedula) {
    prevCedula.innerHTML = jugador?.foto_cedula_url
      ? `Documento actual: ${renderLinkDocumento(jugador.foto_cedula_url, "Ver foto de cédula")}`
      : "";
  }
  if (prevCarnet) {
    if (jugador?.foto_carnet_url && !eliminarCarnet) {
      prevCarnet.innerHTML = `
        Documento actual: ${renderLinkDocumento(jugador.foto_carnet_url, "Ver foto carné")}
        <button type="button" class="btn btn-danger btn-inline-action" onclick="marcarEliminacionFotoCarnet(true)">
          Eliminar foto carné
        </button>
      `;
    } else if (jugador?.foto_carnet_url && eliminarCarnet) {
      prevCarnet.innerHTML = `
        <span class="form-hint is-warning">La foto carné actual se eliminará al guardar.</span>
        <button type="button" class="btn btn-secondary btn-inline-action" onclick="marcarEliminacionFotoCarnet(false)">
          Deshacer
        </button>
      `;
    } else {
      prevCarnet.innerHTML = "";
    }
  }
}

function limpiarVistaSinEquipo() {
  const info = document.getElementById("info-equipo");
  const lista = document.getElementById("lista-jugadores");
  const bloqueNomina = document.getElementById("bloque-nomina-jugadores");
  const bloqueCarnets = document.getElementById("bloque-carnets-jugadores");
  jugadoresActuales = [];
  if (info) info.style.display = "none";
  if (bloqueNomina) bloqueNomina.style.display = "none";
  if (bloqueCarnets) bloqueCarnets.style.display = "none";
  actualizarEstadoPanelReportes();
  if (lista) {
    lista.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-user-friends"></i>
        <p>Selecciona campeonato, categoría y equipo para gestionar jugadores.</p>
      </div>
    `;
  }
}

async function inicializarModoDirecto() {
  const bloque = document.getElementById("bloque-contexto-jugadores");
  const btnVolver = document.getElementById("btn-volver-equipos");
  if (bloque) bloque.style.display = "block";
  if (btnVolver) btnVolver.style.display = "none";

  await cargarCampeonatosSelectDirecto();
  if (campeonatoId) {
    await cargarConfigCampeonato();
  }
  limpiarVistaSinEquipo();
  actualizarEstadoPanelReportes();
}

async function cargarCampeonatosSelectDirecto() {
  const select = document.getElementById("select-campeonato-jugador");
  if (!select) return;

  select.innerHTML = '<option value="">— Selecciona un campeonato —</option>';

  try {
    const data = await (window.CampeonatosAPI?.obtenerTodos?.() || window.ApiClient?.get?.("/campeonatos"));
    const lista = Array.isArray(data) ? data : (data.campeonatos || data.data || []);

    lista.forEach((c) => {
      select.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });

    if (campeonatoId) {
      select.value = String(campeonatoId);
      await cargarEventosSelectDirecto(campeonatoId);
      await cargarEquiposSelectDirecto(campeonatoId, eventoId);
      await cargarConfigCampeonato();
    }

    select.onchange = async () => {
      campeonatoId = select.value ? Number.parseInt(select.value, 10) : null;
      eventoId = null;
      equipoId = null;
      campeonatoMeta = null;
      await cargarEventosSelectDirecto(campeonatoId);
      await cargarEquiposSelectDirecto(campeonatoId, null);
      await cargarConfigCampeonato();
      limpiarVistaSinEquipo();
      actualizarEstadoPanelReportes();
    };
  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error cargando campeonatos", "error");
  }
}

async function cargarEventosSelectDirecto(campId) {
  const select = document.getElementById("select-evento-jugador");
  if (!select) return;

  select.innerHTML = '<option value="">— Todas las categorías —</option>';
  if (!campId) return;

  try {
    const data = await (window.EventosAPI?.obtenerPorCampeonato?.(campId) || window.ApiClient?.get?.(`/eventos/campeonato/${campId}`));
    const lista = Array.isArray(data) ? data : (data.eventos || data.data || []);

    lista.forEach((e) => {
      select.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
    });

    if (eventoId) {
      select.value = String(eventoId);
      const optSel = select.options[select.selectedIndex];
      if (optSel?.textContent && String(optSel.value || "").trim()) {
        eventoNombreActual = optSel.textContent.trim();
      }
    }

    select.onchange = async () => {
      eventoId = select.value ? Number.parseInt(select.value, 10) : null;
      const optSel = select.options[select.selectedIndex];
      eventoNombreActual =
        eventoId && optSel?.textContent ? optSel.textContent.trim() : "";
      equipoId = null;
      await cargarEquiposSelectDirecto(campId, eventoId);
      limpiarVistaSinEquipo();
      actualizarEstadoPanelReportes();
    };
  } catch (error) {
    console.error(error);
  }
}

async function cargarEquiposSelectDirecto(campId, evtId = null) {
  const select = document.getElementById("select-equipo-jugador");
  if (!select) return;

  select.innerHTML = '<option value="">— Selecciona un equipo —</option>';
  if (!campId) return;

  try {
    const data = await window.ApiClient.get(`/equipos/campeonato/${campId}`);
    let equipos = Array.isArray(data) ? data : (data.equipos || data.data || []);

    if (evtId) {
      try {
        const dataEvento = await window.ApiClient.get(`/eventos/${evtId}/equipos`);
        const idsEvento = new Set((dataEvento.equipos || []).map((e) => e.id));
        equipos = equipos.filter((e) => idsEvento.has(e.id));
      } catch (errorEvento) {
        console.warn("No se pudo filtrar equipos por evento:", errorEvento);
      }
    }

    equipos.forEach((e) => {
      select.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
    });

    if (equipoId) {
      select.value = String(equipoId);
    }

    select.onchange = () => {
      equipoId = select.value ? Number.parseInt(select.value, 10) : null;
      actualizarEstadoPanelReportes();
    };
  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error cargando equipos", "error");
  }
}

async function cargarJugadoresDesdeSeleccion() {
  if (!campeonatoId) {
    mostrarNotificacion("Selecciona un campeonato", "warning");
    return;
  }
  if (!equipoId) {
    mostrarNotificacion("Selecciona un equipo", "warning");
    return;
  }

  const params = new URLSearchParams();
  params.set("campeonato", String(campeonatoId));
  params.set("equipo", String(equipoId));
  if (eventoId) params.set("evento", String(eventoId));
  history.replaceState({}, "", `jugadores.html?${params.toString()}`);

  await cargarContextoEquipo();
}

async function cargarNombreEventoActual() {
  if (!eventoId) {
    eventoNombreActual = "";
    return;
  }
  try {
    const data = await window.ApiClient.get(`/eventos/${eventoId}`);
    const evento = data?.evento || data;
    eventoNombreActual = (evento?.nombre || "").toString().trim();
  } catch (_) {
    eventoNombreActual = "";
  }
}

async function cargarContextoEquipo() {
  if (!equipoId) {
    limpiarVistaSinEquipo();
    return;
  }

  await cargarInfoEquipo();
  await cargarConfigCampeonato();
  await cargarJugadores();
  actualizarEstadoRequisitosEnModal(null);
  actualizarEstadoPanelReportes();
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("jugadores.html")) return;

  inicializarImportadorJugadores();
  inicializarImportadorDocsZip();

  equipoId = obtenerParametroUrl("equipo") ? Number.parseInt(obtenerParametroUrl("equipo"), 10) : null;
  campeonatoId = obtenerParametroUrl("campeonato") ? Number.parseInt(obtenerParametroUrl("campeonato"), 10) : null;
  eventoId = obtenerParametroUrl("evento") ? Number.parseInt(obtenerParametroUrl("evento"), 10) : null;

  modoDirecto = !equipoId;
  actualizarBotonesVistaJugadores();
  aplicarRestriccionesRolEnJugadores();
  cambiarPestanaJugadores("tab-jugadores-gestion");
  actualizarEstadoPanelReportes();
  document.getElementById("reporte-jugadores-tipo")?.addEventListener("change", () => {
    actualizarEstadoPanelReportes();
  });
  document
    .getElementById("carnet-foto-anverso")
    ?.addEventListener("change", () => {
      if (document.getElementById("bloque-carnets-jugadores")?.style.display === "block") {
        renderPlantillaCarnets();
      }
    });

  if (modoDirecto) {
    await inicializarModoDirecto();
    return;
  }

  await cargarNombreEventoActual();
  await cargarContextoEquipo();
  actualizarEstadoPanelReportes();
});

async function cargarInfoEquipo() {
  try {
    const data = await ApiClient.get(`/equipos/${equipoId}`);
    equipoActual = data.equipo || data;

    const cont = document.getElementById("info-equipo");
    if (!cont) return;

    cont.style.display = "block";
    cont.innerHTML = `
      <div class="campeonato-resumen-card">
        <h3>${equipoActual.nombre}</h3>
        <p><strong>Director Técnico:</strong> ${equipoActual.director_tecnico || "Sin asignar"}</p>
        <p><strong>Asistente:</strong> ${equipoActual.asistente_tecnico || "-"}</p>
        <p><strong>Color:</strong> ${equipoActual.color_equipo || "-"}</p>
        <p><strong>Cabeza de serie:</strong> ${equipoActual.cabeza_serie ? "Sí" : "No"}</p>
        <p id="resumen-jugadores" class="jugadores-resumen-linea"></p>
        <p id="resumen-docs-jugador" class="jugadores-resumen-linea"></p>
        <p id="resumen-carnets-jugador" class="jugadores-resumen-linea"></p>
      </div>
    `;

    document.getElementById("jugador-equipo-id").value = equipoActual.id;
  } catch (error) {
    console.error("Error cargando equipo:", error);
    mostrarNotificacion("Error cargando datos del equipo", "error");
  }
}

async function cargarConfigCampeonato() {
  if (!campeonatoId && equipoActual?.campeonato_id) {
    campeonatoId = Number.parseInt(equipoActual.campeonato_id, 10);
  }
  if (!campeonatoId) {
    campeonatoMeta = {
      id: null,
      nombre: "",
      organizador: "",
      logo_url: "",
      carnet_fondo_url: "",
      color_primario: "#FACC15",
      color_secundario: "#111827",
      color_acento: "#22C55E",
      requiere_cedula_jugador: false,
      genera_carnets: false,
    };
    minJugadoresPorEquipo = null;
    maxJugadoresPorEquipo = null;
    reglasDocumentos = {
      requiere_cedula_jugador: false,
      requiere_foto_cedula: false,
      requiere_foto_carnet: false,
    };
    return;
  }

  try {
    const resp = await CampeonatosAPI.obtenerPorId(campeonatoId);
    const camp = resp.campeonato || resp;

    campeonatoMeta = {
      id: camp.id || campeonatoId,
      nombre: camp.nombre || "",
      organizador: camp.organizador || "",
      logo_url: camp.logo_url || "",
      carnet_fondo_url: camp.carnet_fondo_url || "",
      color_primario: camp.color_primario || "#FACC15",
      color_secundario: camp.color_secundario || "#111827",
      color_acento: camp.color_acento || "#22C55E",
      requiere_cedula_jugador:
        camp.requiere_cedula_jugador === true ||
        camp.requiere_cedula_jugador === "true" ||
        camp.requiere_cedula_jugador === 1 ||
        camp.requiere_cedula_jugador === "1",
      genera_carnets: camp.genera_carnets === true || camp.genera_carnets === "true",
    };

    minJugadoresPorEquipo = camp.min_jugador || null;
    maxJugadoresPorEquipo = camp.max_jugador || null;

    reglasDocumentos = {
      requiere_cedula_jugador:
        camp.requiere_cedula_jugador === true ||
        camp.requiere_cedula_jugador === "true" ||
        camp.requiere_cedula_jugador === 1 ||
        camp.requiere_cedula_jugador === "1",
      requiere_foto_cedula: camp.requiere_foto_cedula === true || camp.requiere_foto_cedula === "true",
      requiere_foto_carnet: camp.requiere_foto_carnet === true || camp.requiere_foto_carnet === "true",
    };

    actualizarResumenJugadores();
    actualizarResumenReglasDocumentos();
    actualizarResumenCarnets();
  } catch (error) {
    console.error("Error cargando configuración de campeonato:", error);
  }
}

function volverAEquipos() {
  if (!campeonatoId) {
    window.location.href = "campeonatos.html";
    return;
  }

  const params = new URLSearchParams();
  params.set("campeonato", String(campeonatoId));
  if (eventoId) params.set("evento", String(eventoId));
  window.location.href = `equipos.html?${params.toString()}`;
}

async function cargarJugadores() {
  const cont = document.getElementById("lista-jugadores");
  if (!cont || !equipoId) return;

  cont.innerHTML = "<p>Cargando jugadores...</p>";

  try {
    const queryEvento =
      Number.isFinite(Number(eventoId)) && Number(eventoId) > 0 ? `?evento_id=${Number(eventoId)}` : "";
    const data = await ApiClient.get(`/jugadores/equipo/${equipoId}${queryEvento}`);

    let jugadores = [];
    if (Array.isArray(data)) jugadores = data;
    else if (data.jugadores && Array.isArray(data.jugadores)) jugadores = data.jugadores;
    else if (data.data && Array.isArray(data.data)) jugadores = data.data;

    jugadoresActuales = jugadores;

    if (jugadores.length === 0) {
      renderListadoJugadores();
      actualizarResumenJugadores();
      renderPlantillaNominaJugadores();
      renderReporteSancionesJugadores();
      renderPlantillaCarnets();
      return;
    }

    renderListadoJugadores();

    actualizarResumenJugadores();
    renderPlantillaNominaJugadores();
    renderReporteSancionesJugadores();
    renderPlantillaCarnets();
  } catch (error) {
    console.error("Error cargando jugadores:", error);
    mostrarNotificacion("Error cargando jugadores", "error");
    cont.innerHTML = "<p>Error cargando jugadores.</p>";
    renderPlantillaNominaJugadores();
    renderReporteSancionesJugadores();
    renderPlantillaCarnets();
  }
}

function renderTarjetasJugadores(jugadores) {
  const soloLectura = usuarioSoloLecturaJugadores();
  return jugadores
    .map((jugador, index) => {
      return `
        <div class="equipo-card">
          <h3>
            <span class="item-index">${index + 1}.</span>
            ${escapeHtml(jugador.nombre || "")} ${escapeHtml(jugador.apellido || "")}
          </h3>
          <p><strong>Número:</strong> ${escapeHtml(jugador.numero_camiseta || "-")}</p>
          <p><strong>Posición:</strong> ${escapeHtml(jugador.posicion || "-")}</p>
          <p><strong>Cédula de Identidad:</strong> ${escapeHtml(jugador.cedidentidad || "-")}</p>
          <p><strong>Fecha nac.:</strong> ${escapeHtml(formatearFecha(jugador.fecha_nacimiento))}</p>
          <p><strong>Capitán:</strong> ${jugador.es_capitan ? "Sí" : "No"}</p>
          <p><strong>Disciplina:</strong> ${renderEstadoDisciplinarioJugador(jugador)}</p>
          <p><strong>Documentos:</strong> ${renderEstadoDocumento(jugador.foto_cedula_url, "Cédula")} ${renderEstadoDocumento(jugador.foto_carnet_url, "Carné")}</p>
          ${
            soloLectura
              ? ""
              : `<div class="jugador-actions">
            <button class="btn btn-warning" onclick="editarJugador(${jugador.id})">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn btn-danger" onclick="eliminarJugador(${jugador.id})">
              <i class="fas fa-trash"></i> Eliminar
            </button>
          </div>`
          }
        </div>
      `;
    })
    .join("");
}

function renderTablaJugadores(jugadores) {
  const soloLectura = usuarioSoloLecturaJugadores();
  const filas = jugadores
    .map((jugador, index) => {
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(`${jugador.nombre || ""} ${jugador.apellido || ""}`.trim() || "—")}</td>
          <td>${escapeHtml(jugador.cedidentidad || "-")}</td>
          <td>${escapeHtml(formatearFecha(jugador.fecha_nacimiento))}</td>
          <td>${escapeHtml(jugador.posicion || "-")}</td>
          <td>${escapeHtml(jugador.numero_camiseta || "-")}</td>
          <td>${jugador.es_capitan ? "Sí" : "No"}</td>
          <td>${renderEstadoDisciplinarioJugador(jugador)}</td>
          <td>${renderEstadoDocumento(jugador.foto_cedula_url, "Cédula")} ${renderEstadoDocumento(jugador.foto_carnet_url, "Carné")}</td>
          ${
            soloLectura
              ? ""
              : `<td class="list-table-actions">
            <button class="btn btn-warning" onclick="editarJugador(${jugador.id})">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn btn-danger" onclick="eliminarJugador(${jugador.id})">
              <i class="fas fa-trash"></i> Eliminar
            </button>
          </td>`
          }
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
            <th>Jugador</th>
            <th>Cédula</th>
            <th>F. Nac.</th>
            <th>Posición</th>
            <th>N°</th>
            <th>Capitán</th>
            <th>Disciplina</th>
            <th>Documentos</th>
            ${soloLectura ? "" : "<th>Acciones</th>"}
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
}

function renderListadoJugadores() {
  const cont = document.getElementById("lista-jugadores");
  if (!cont) return;

  if (!jugadoresActuales.length) {
    cont.classList.remove("list-mode-table");
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-user-slash"></i>
        <p>No hay jugadores registrados en este equipo.</p>
      </div>
    `;
    return;
  }

  if (vistaJugadores === "table") {
    cont.classList.add("list-mode-table");
    cont.innerHTML = renderTablaJugadores(jugadoresActuales);
    return;
  }

  cont.classList.remove("list-mode-table");
  cont.innerHTML = renderTarjetasJugadores(jugadoresActuales);
}

function obtenerNombreEventoActual() {
  const selectEvento = document.getElementById("select-evento-jugador");
  if (selectEvento) {
    const opt = selectEvento.options[selectEvento.selectedIndex];
    if (opt && String(opt.value || "").trim()) return (opt.textContent || "").trim();
    if (eventoId) {
      const porValor = Array.from(selectEvento.options || []).find(
        (x) => Number.parseInt(x.value, 10) === Number(eventoId)
      );
      if (porValor?.textContent) return porValor.textContent.trim();
    }
  }
  if (eventoNombreActual) return eventoNombreActual;
  return eventoId ? "Categoría seleccionada" : "Todas las categorías";
}

function obtenerModoFotoAnversoCarnet() {
  const select = document.getElementById("carnet-foto-anverso");
  const valor = String(select?.value || "auto").trim().toLowerCase();
  if (valor === "cedula" || valor === "carnet") return valor;
  return "auto";
}

function obtenerFotoAnversoCarnet(jugador) {
  const modo = obtenerModoFotoAnversoCarnet();
  const fotoCarnet = normalizarArchivoUrl(jugador?.foto_carnet_url);
  const fotoCedula = normalizarArchivoUrl(jugador?.foto_cedula_url);

  if (modo === "carnet") return fotoCarnet || fotoCedula;
  if (modo === "cedula") return fotoCedula || fotoCarnet;
  return fotoCarnet || fotoCedula;
}

function construirUrlPortalParticipacion() {
  const params = new URLSearchParams();
  if (campeonatoId) params.set("campeonato", String(campeonatoId));
  if (eventoId) params.set("evento", String(eventoId));

  const base = `${window.location.origin}${window.location.pathname.replace(/[^/]+$/, "index.html")}`;
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function construirQrUrlParticipacion() {
  const urlDestino = construirUrlPortalParticipacion();
  return `https://api.qrserver.com/v1/create-qr-code/?size=108x108&margin=0&data=${encodeURIComponent(urlDestino)}`;
}

function renderPlantillaNominaJugadores() {
  const zona = document.getElementById("nomina-jugadores-export");
  if (!zona) return;

  if (!equipoActual || !jugadoresActuales.length) {
    zona.innerHTML = '<p class="empty-state">No hay jugadores para generar la nómina.</p>';
    return;
  }

  const logoCampeonato = normalizarArchivoUrl(campeonatoMeta.logo_url);
  const filas = jugadoresActuales
    .map((j, idx) => {
      const estadoCed = j.foto_cedula_url ? "Cargada" : "Pendiente";
      const estadoCarn = j.foto_carnet_url ? "Cargada" : "Pendiente";
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(`${j.nombre || ""} ${j.apellido || ""}`.trim())}</td>
          <td>${escapeHtml(j.cedidentidad || "—")}</td>
          <td>${escapeHtml(formatearFecha(j.fecha_nacimiento))}</td>
          <td>${escapeHtml(j.posicion || "—")}</td>
          <td>${escapeHtml(j.numero_camiseta || "—")}</td>
          <td>${j.es_capitan ? "Sí" : "No"}</td>
          <td>${estadoCed}</td>
          <td>${estadoCarn}</td>
          <td>&nbsp;</td>
        </tr>
      `;
    })
    .join("");

  zona.innerHTML = `
    <div class="nomina-sheet">
      <div class="nomina-head">
        <div class="nomina-head-logo">
          ${logoCampeonato ? `<img src="${logoCampeonato}" alt="Logo campeonato" />` : "<div class='logo-fallback'>LT&C</div>"}
        </div>
        <div class="nomina-head-main">
          <h3>Nómina Oficial de Jugadores</h3>
          <p><strong>Campeonato:</strong> ${escapeHtml(campeonatoMeta.nombre || "—")}</p>
          <p><strong>Organizador:</strong> ${escapeHtml(campeonatoMeta.organizador || "—")}</p>
          <p><strong>Categoría:</strong> ${escapeHtml(obtenerNombreEventoActual())}</p>
          <p><strong>Equipo:</strong> ${escapeHtml(equipoActual.nombre || "—")}</p>
        </div>
        <div class="nomina-head-meta">
          <p><strong>Fecha:</strong> ${escapeHtml(new Date().toLocaleDateString("es-EC"))}</p>
          <p><strong>Total:</strong> ${jugadoresActuales.length}</p>
        </div>
      </div>

      <div class="nomina-table-wrap">
        <table class="nomina-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Jugador</th>
              <th>Cédula</th>
              <th>F. Nac.</th>
              <th>Posición</th>
              <th>N°</th>
              <th>Cap.</th>
              <th>Foto Céd.</th>
              <th>Foto Carné</th>
              <th>Firma</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    </div>
  `;
}

function obtenerResumenDisciplinaJugadores(jugadores = []) {
  return (Array.isArray(jugadores) ? jugadores : []).reduce(
    (acc, jugador) => {
      const suspension = jugador?.suspension || null;
      if (suspension?.suspendido) acc.suspendidos += 1;
      else if (Number(suspension?.amarillas_acumuladas || 0) > 0) acc.alertaAmarillas += 1;
      else acc.habilitados += 1;
      return acc;
    },
    {
      total: (Array.isArray(jugadores) ? jugadores : []).length,
      suspendidos: 0,
      alertaAmarillas: 0,
      habilitados: 0,
    }
  );
}

function renderReporteSancionesJugadores() {
  const zona = document.getElementById("sanciones-jugadores-export");
  if (!zona) return;

  if (!equipoActual || !jugadoresActuales.length) {
    zona.innerHTML = '<p class="empty-state">No hay jugadores para generar el reporte disciplinario.</p>';
    return;
  }

  const logoCampeonato = normalizarArchivoUrl(campeonatoMeta.logo_url);
  const resumen = obtenerResumenDisciplinaJugadores(jugadoresActuales);
  const jugadoresOrdenados = [...jugadoresActuales].sort((a, b) => {
    const aSusp = a?.suspension?.suspendido ? 1 : 0;
    const bSusp = b?.suspension?.suspendido ? 1 : 0;
    if (aSusp !== bSusp) return bSusp - aSusp;
    const aTa = Number(a?.suspension?.amarillas_acumuladas || 0);
    const bTa = Number(b?.suspension?.amarillas_acumuladas || 0);
    if (aTa !== bTa) return bTa - aTa;
    return String(`${a?.apellido || ""} ${a?.nombre || ""}`).localeCompare(
      String(`${b?.apellido || ""} ${b?.nombre || ""}`),
      "es",
      { sensitivity: "base" }
    );
  });

  const filas = jugadoresOrdenados
    .map((jugador, idx) => {
      const suspension = jugador?.suspension || {};
      const amarillas = Number(suspension?.amarillas_acumuladas || 0);
      const pendientes = Number(suspension?.partidos_pendientes || 0);
      const motivo = suspension?.motivo || (amarillas > 0 ? "Seguimiento por acumulación de amarillas" : "Sin novedad");
      const filaCss = suspension?.suspendido
        ? "sancion-row-danger"
        : amarillas > 0
          ? "sancion-row-alert"
          : "";

      return `
        <tr class="${filaCss}">
          <td>${idx + 1}</td>
          <td>${escapeHtml(`${jugador.nombre || ""} ${jugador.apellido || ""}`.trim())}</td>
          <td>${escapeHtml(jugador.numero_camiseta || "—")}</td>
          <td>${escapeHtml(jugador.posicion || "—")}</td>
          <td>${renderEstadoDisciplinarioJugador(jugador)}</td>
          <td>${amarillas}</td>
          <td>${pendientes}</td>
          <td title="${escapeHtml(motivo)}">${escapeHtml(motivo)}</td>
        </tr>
      `;
    })
    .join("");

  zona.innerHTML = `
    <div class="nomina-sheet sanciones-sheet">
      <div class="nomina-head">
        <div class="nomina-head-logo">
          ${logoCampeonato ? `<img src="${logoCampeonato}" alt="Logo campeonato" />` : "<div class='logo-fallback'>LT&C</div>"}
        </div>
        <div class="nomina-head-main">
          <h3>Reporte Disciplinario del Equipo</h3>
          <p><strong>Campeonato:</strong> ${escapeHtml(campeonatoMeta.nombre || "—")}</p>
          <p><strong>Organizador:</strong> ${escapeHtml(campeonatoMeta.organizador || "—")}</p>
          <p><strong>Categoría:</strong> ${escapeHtml(obtenerNombreEventoActual())}</p>
          <p><strong>Equipo:</strong> ${escapeHtml(equipoActual.nombre || "—")}</p>
        </div>
        <div class="nomina-head-meta">
          <p><strong>Fecha:</strong> ${escapeHtml(new Date().toLocaleDateString("es-EC"))}</p>
          <p><strong>Total jugadores:</strong> ${resumen.total}</p>
        </div>
      </div>

      <div class="sanciones-resumen-grid">
        <div class="sanciones-resumen-card">
          <span class="sanciones-resumen-label">Suspendidos</span>
          <strong>${resumen.suspendidos}</strong>
        </div>
        <div class="sanciones-resumen-card">
          <span class="sanciones-resumen-label">Con amarillas acumuladas</span>
          <strong>${resumen.alertaAmarillas}</strong>
        </div>
        <div class="sanciones-resumen-card">
          <span class="sanciones-resumen-label">Habilitados</span>
          <strong>${resumen.habilitados}</strong>
        </div>
      </div>

      <div class="nomina-table-wrap">
        <table class="nomina-table sanciones-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Jugador</th>
              <th>N°</th>
              <th>Posición</th>
              <th>Estado</th>
              <th>TA acum.</th>
              <th>Partidos pendientes</th>
              <th>Motivo / observación</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    </div>
  `;
}

async function obtenerDatosSancionesCategoria() {
  const eventoActual = Number.parseInt(eventoId, 10);
  if (!Number.isFinite(eventoActual) || eventoActual <= 0) {
    throw new Error("Selecciona una categoría para generar el consolidado disciplinario");
  }

  const respEquipos = await window.ApiClient.get(`/eventos/${eventoActual}/equipos`);
  const equipos = Array.isArray(respEquipos) ? respEquipos : respEquipos?.equipos || [];
  if (!equipos.length) return [];

  const resultados = await Promise.allSettled(
    equipos.map(async (equipo) => {
      const data = await window.ApiClient.get(`/jugadores/equipo/${equipo.id}?evento_id=${eventoActual}`);
      const jugadores = Array.isArray(data) ? data : data?.jugadores || data?.data || [];
      return jugadores.map((jugador) => ({
        ...jugador,
        equipo_id: equipo.id,
        equipo_nombre: equipo.nombre || `Equipo ${equipo.id}`,
      }));
    })
  );

  const registros = [];
  const errores = [];
  resultados.forEach((resultado, index) => {
    if (resultado.status === "fulfilled") {
      registros.push(...resultado.value);
      return;
    }
    errores.push(equipos[index]?.nombre || `Equipo ${equipos[index]?.id || index + 1}`);
  });

  if (errores.length) {
    console.warn("No se pudo cargar disciplina para algunos equipos:", errores);
  }

  return registros;
}

function obtenerResumenDisciplinaGlobal(registros = []) {
  const resumenBase = obtenerResumenDisciplinaJugadores(registros);
  const equipos = new Set(
    (Array.isArray(registros) ? registros : [])
      .map((item) => Number.parseInt(item?.equipo_id, 10))
      .filter((id) => Number.isFinite(id) && id > 0)
  );
  return {
    ...resumenBase,
    equipos: equipos.size,
  };
}

async function renderReporteSancionesCategoriaJugadores() {
  const zona = document.getElementById("sanciones-categoria-jugadores-export");
  if (!zona) return;

  if (!campeonatoId || !eventoId) {
    zona.innerHTML =
      '<p class="empty-state">Selecciona campeonato y categoría para generar el consolidado disciplinario.</p>';
    return;
  }

  zona.innerHTML = '<p class="empty-state">Cargando consolidado disciplinario de la categoría...</p>';

  const registros = await obtenerDatosSancionesCategoria();
  if (!registros.length) {
    zona.innerHTML = '<p class="empty-state">No hay jugadores registrados en los equipos de esta categoría.</p>';
    return;
  }

  const logoCampeonato = normalizarArchivoUrl(campeonatoMeta.logo_url);
  const resumen = obtenerResumenDisciplinaGlobal(registros);
  const filas = [...registros]
    .sort((a, b) => {
      const equipoCmp = String(a?.equipo_nombre || "").localeCompare(String(b?.equipo_nombre || ""), "es", {
        sensitivity: "base",
      });
      if (equipoCmp !== 0) return equipoCmp;
      const aSusp = a?.suspension?.suspendido ? 1 : 0;
      const bSusp = b?.suspension?.suspendido ? 1 : 0;
      if (aSusp !== bSusp) return bSusp - aSusp;
      const aTa = Number(a?.suspension?.amarillas_acumuladas || 0);
      const bTa = Number(b?.suspension?.amarillas_acumuladas || 0);
      if (aTa !== bTa) return bTa - aTa;
      return String(`${a?.apellido || ""} ${a?.nombre || ""}`).localeCompare(
        String(`${b?.apellido || ""} ${b?.nombre || ""}`),
        "es",
        { sensitivity: "base" }
      );
    })
    .map((jugador, idx) => {
      const suspension = jugador?.suspension || {};
      const amarillas = Number(suspension?.amarillas_acumuladas || 0);
      const pendientes = Number(suspension?.partidos_pendientes || 0);
      const motivo = suspension?.motivo || (amarillas > 0 ? "Seguimiento por acumulación de amarillas" : "Sin novedad");
      const filaCss = suspension?.suspendido
        ? "sancion-row-danger"
        : amarillas > 0
          ? "sancion-row-alert"
          : "";

      return `
        <tr class="${filaCss}">
          <td>${idx + 1}</td>
          <td>${escapeHtml(jugador.equipo_nombre || "—")}</td>
          <td>${escapeHtml(`${jugador.nombre || ""} ${jugador.apellido || ""}`.trim())}</td>
          <td>${escapeHtml(jugador.numero_camiseta || "—")}</td>
          <td>${escapeHtml(jugador.posicion || "—")}</td>
          <td>${renderEstadoDisciplinarioJugador(jugador)}</td>
          <td>${amarillas}</td>
          <td>${pendientes}</td>
          <td title="${escapeHtml(motivo)}">${escapeHtml(motivo)}</td>
        </tr>
      `;
    })
    .join("");

  zona.innerHTML = `
    <div class="nomina-sheet sanciones-sheet">
      <div class="nomina-head">
        <div class="nomina-head-logo">
          ${logoCampeonato ? `<img src="${logoCampeonato}" alt="Logo campeonato" />` : "<div class='logo-fallback'>LT&C</div>"}
        </div>
        <div class="nomina-head-main">
          <h3>Consolidado Disciplinario por Categoría</h3>
          <p><strong>Campeonato:</strong> ${escapeHtml(campeonatoMeta.nombre || "—")}</p>
          <p><strong>Organizador:</strong> ${escapeHtml(campeonatoMeta.organizador || "—")}</p>
          <p><strong>Categoría:</strong> ${escapeHtml(obtenerNombreEventoActual())}</p>
        </div>
        <div class="nomina-head-meta">
          <p><strong>Fecha:</strong> ${escapeHtml(new Date().toLocaleDateString("es-EC"))}</p>
          <p><strong>Equipos:</strong> ${resumen.equipos}</p>
        </div>
      </div>

      <div class="sanciones-resumen-grid">
        <div class="sanciones-resumen-card">
          <span class="sanciones-resumen-label">Suspendidos</span>
          <strong>${resumen.suspendidos}</strong>
        </div>
        <div class="sanciones-resumen-card">
          <span class="sanciones-resumen-label">Con amarillas acumuladas</span>
          <strong>${resumen.alertaAmarillas}</strong>
        </div>
        <div class="sanciones-resumen-card">
          <span class="sanciones-resumen-label">Jugadores evaluados</span>
          <strong>${resumen.total}</strong>
        </div>
      </div>

      <div class="nomina-table-wrap">
        <table class="nomina-table sanciones-table sanciones-categoria-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Equipo</th>
              <th>Jugador</th>
              <th>N°</th>
              <th>Posición</th>
              <th>Estado</th>
              <th>TA acum.</th>
              <th>Partidos pendientes</th>
              <th>Motivo / observación</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderPlantillaCarnets() {
  const zona = document.getElementById("carnets-jugadores-export");
  if (!zona) return;

  if (!campeonatoMeta.genera_carnets) {
    zona.innerHTML = "<p class='empty-state'>Este campeonato no tiene habilitada la emisión de carnés.</p>";
    return;
  }

  if (!equipoActual || !jugadoresActuales.length) {
    zona.innerHTML = "<p class='empty-state'>No hay jugadores para generar carnés.</p>";
    return;
  }

  const logoCampeonato = normalizarArchivoUrl(campeonatoMeta.logo_url);
  const categoriaActual = obtenerNombreEventoActual();
  const urlPortalParticipacion = construirUrlPortalParticipacion();
  const qrUrlParticipacion = construirQrUrlParticipacion();
  const cards = jugadoresActuales
    .map((j) => {
      const foto = obtenerFotoAnversoCarnet(j);
      const estiloCarnet = construirEstiloCarnet(campeonatoMeta);
      return `
        <article class="carnet-card" style="${escapeHtml(estiloCarnet)}">
          <div class="carnet-backdrop" aria-hidden="true"></div>
          <header class="carnet-header">
            <div class="carnet-org">${escapeHtml(campeonatoMeta.organizador || "Organizador")}</div>
            <div class="carnet-title">CARNÉ DE JUGADOR</div>
          </header>
          <div class="carnet-body">
            <div class="carnet-foto-wrap">
              ${
                foto
                  ? `<img src="${foto}" alt="Foto jugador" class="carnet-foto" />`
                  : `<div class="carnet-foto carnet-foto-empty"><i class="fas fa-user"></i></div>`
              }
            </div>
            <div class="carnet-data">
              <p><strong>Nombre:</strong> ${escapeHtml(`${j.nombre || ""} ${j.apellido || ""}`.trim())}</p>
              <p><strong>Cédula:</strong> ${escapeHtml(j.cedidentidad || "—")}</p>
              <p><strong>Categoría:</strong> ${escapeHtml(categoriaActual || "—")}</p>
              <p><strong>Equipo:</strong> ${escapeHtml(equipoActual.nombre || "—")}</p>
              <p><strong>N°:</strong> ${escapeHtml(j.numero_camiseta || "—")}</p>
            </div>
          </div>
          <footer class="carnet-footer">
            <div class="carnet-footer-main">
              <div class="carnet-campeonato">${escapeHtml(campeonatoMeta.nombre || "Campeonato")}</div>
              <div class="carnet-categoria">${escapeHtml(categoriaActual || "Categoría")}</div>
            </div>
            <div class="carnet-footer-media">
              ${
                logoCampeonato
                  ? `<img src="${logoCampeonato}" alt="Logo campeonato" class="carnet-logo" />`
                  : "<span class='carnet-logo-fallback'>LT&C</span>"
              }
              <a href="${escapeHtml(urlPortalParticipacion)}" target="_blank" rel="noopener noreferrer" class="carnet-qr-link" title="Abrir página del torneo">
                <img src="${escapeHtml(qrUrlParticipacion)}" alt="QR torneo" class="carnet-qr" />
              </a>
            </div>
          </footer>
        </article>
      `;
    })
    .join("");

  zona.innerHTML = `<div class="carnets-grid">${cards}</div>`;
}

function mostrarPlantillaNominaJugadores() {
  if (!validarPermisoReportesJugadores()) return;
  if (!contextoListoParaReportes()) {
    mostrarNotificacion("Selecciona campeonato, categoría y equipo para ver reportes", "warning");
    return;
  }
  cambiarPestanaJugadores("tab-jugadores-reportes");
  renderPlantillaNominaJugadores();
  const bloque = document.getElementById("bloque-nomina-jugadores");
  const bloqueSanciones = document.getElementById("bloque-sanciones-jugadores");
  const bloqueSancionesCategoria = document.getElementById("bloque-sanciones-categoria-jugadores");
  const bloqueCarnets = document.getElementById("bloque-carnets-jugadores");
  if (bloque) bloque.style.display = "block";
  if (bloqueSanciones) bloqueSanciones.style.display = "none";
  if (bloqueSancionesCategoria) bloqueSancionesCategoria.style.display = "none";
  if (bloqueCarnets) bloqueCarnets.style.display = "none";
  bloque?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function mostrarReporteSancionesJugadores() {
  if (!validarPermisoReportesJugadores()) return;
  if (!contextoListoParaReportes()) {
    mostrarNotificacion("Selecciona campeonato, categoría y equipo para ver reportes", "warning");
    return;
  }
  cambiarPestanaJugadores("tab-jugadores-reportes");
  renderReporteSancionesJugadores();
  const bloque = document.getElementById("bloque-sanciones-jugadores");
  const bloqueNomina = document.getElementById("bloque-nomina-jugadores");
  const bloqueSancionesCategoria = document.getElementById("bloque-sanciones-categoria-jugadores");
  const bloqueCarnets = document.getElementById("bloque-carnets-jugadores");
  if (bloque) bloque.style.display = "block";
  if (bloqueNomina) bloqueNomina.style.display = "none";
  if (bloqueSancionesCategoria) bloqueSancionesCategoria.style.display = "none";
  if (bloqueCarnets) bloqueCarnets.style.display = "none";
  bloque?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function mostrarReporteSancionesCategoriaJugadores() {
  if (!validarPermisoReportesJugadores()) return;
  if (!contextoListoParaReportes("sanciones_categoria")) {
    mostrarNotificacion("Selecciona campeonato y categoría para ver el consolidado disciplinario", "warning");
    return;
  }
  cambiarPestanaJugadores("tab-jugadores-reportes");
  await renderReporteSancionesCategoriaJugadores();
  const bloque = document.getElementById("bloque-sanciones-categoria-jugadores");
  const bloqueNomina = document.getElementById("bloque-nomina-jugadores");
  const bloqueSanciones = document.getElementById("bloque-sanciones-jugadores");
  const bloqueCarnets = document.getElementById("bloque-carnets-jugadores");
  if (bloque) bloque.style.display = "block";
  if (bloqueNomina) bloqueNomina.style.display = "none";
  if (bloqueSanciones) bloqueSanciones.style.display = "none";
  if (bloqueCarnets) bloqueCarnets.style.display = "none";
  bloque?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function mostrarPlantillaCarnets() {
  if (!validarPermisoReportesJugadores()) return;
  if (!contextoListoParaReportes()) {
    mostrarNotificacion("Selecciona campeonato, categoría y equipo para ver reportes", "warning");
    return;
  }
  if (!campeonatoMeta.genera_carnets) {
    mostrarNotificacion("Este campeonato no tiene habilitada la generación de carnés", "warning");
    return;
  }
  cambiarPestanaJugadores("tab-jugadores-reportes");
  renderPlantillaCarnets();
  const bloque = document.getElementById("bloque-carnets-jugadores");
  const bloqueNomina = document.getElementById("bloque-nomina-jugadores");
  const bloqueSanciones = document.getElementById("bloque-sanciones-jugadores");
  const bloqueSancionesCategoria = document.getElementById("bloque-sanciones-categoria-jugadores");
  if (bloque) bloque.style.display = "block";
  if (bloqueNomina) bloqueNomina.style.display = "none";
  if (bloqueSanciones) bloqueSanciones.style.display = "none";
  if (bloqueSancionesCategoria) bloqueSancionesCategoria.style.display = "none";
  bloque?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function activarLayoutCarnetsA4(activar) {
  const zona = document.getElementById("carnets-jugadores-export");
  if (!zona) return;
  zona.classList.toggle("carnets-a4-layout", Boolean(activar));
}

function imprimirNodoEnVentana(node, titulo = "Impresión") {
  if (!node) return;
  const hrefBase = window.location.href;
  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <base href="${escapeHtml(hrefBase)}" />
        <title>${escapeHtml(titulo)}</title>
        <link rel="stylesheet" href="css/style.css" />
      </head>
      <body class="print-solo">
        ${node.outerHTML}
      </body>
    </html>
  `;
  const w = window.open("", "_blank", "width=1280,height=900");
  if (!w) {
    mostrarNotificacion("No se pudo abrir la ventana de impresión", "error");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 350);
}

async function exportarNodoPDF(node, nombreArchivo) {
  if (!node || !window.html2canvas || !window.jspdf?.jsPDF) {
    throw new Error("No se pudo preparar la exportación PDF");
  }

  const canvas = await window.html2canvas(node, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    windowWidth: Math.max(node.scrollWidth, node.clientWidth),
    windowHeight: Math.max(node.scrollHeight, node.clientHeight),
  });

  const imgData = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(nombreArchivo);
}

function obtenerHostsPermitidosImagenesPDF() {
  const hosts = new Set([String(window.location.host || "").toLowerCase(), "api.qrserver.com"]);
  try {
    const hostBackend = new URL(BACKEND_BASE).host;
    if (hostBackend) hosts.add(String(hostBackend).toLowerCase());
  } catch (_) {
    // ignore
  }
  return hosts;
}

function esImagenPermitidaParaPDF(src, hostsPermitidos) {
  if (!src) return false;
  try {
    const url = new URL(src, window.location.href);
    if (url.protocol === "data:" || url.protocol === "blob:") return true;
    if (!/^https?:$/i.test(url.protocol)) return false;
    const host = String(url.host || "").toLowerCase();
    if (!host) return true;
    if (host === "tu-dominio.com" || host.endsWith(".tu-dominio.com")) return false;
    return hostsPermitidos.has(host);
  } catch (_) {
    return false;
  }
}

async function esperarImagenesEnNodo(node, timeoutMs = 1400) {
  if (!node) return;
  const imagenes = Array.from(node.querySelectorAll("img"));
  if (!imagenes.length) return;

  await Promise.all(
    imagenes.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) return resolve();
          let timeoutId = null;
          const onDone = () => {
            if (timeoutId) window.clearTimeout(timeoutId);
            img.removeEventListener("load", onDone);
            img.removeEventListener("error", onDone);
            resolve();
          };
          timeoutId = window.setTimeout(onDone, timeoutMs);
          img.addEventListener("load", onDone, { once: true });
          img.addEventListener("error", onDone, { once: true });
        })
    )
  );
}

async function exportarCarnetsEnPDFA4(node, nombreArchivo) {
  if (!node || !window.html2canvas || !window.jspdf?.jsPDF) {
    throw new Error("No se pudo preparar la exportación PDF");
  }

  const cards = Array.from(node.querySelectorAll(".carnet-card"));
  if (!cards.length) {
    throw new Error("No hay carnés para exportar");
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const columnas = 2;
  const anchoCarnetMm = 85;
  const altoCarnetMm = 55;
  const margenHorizontalMm = 12;
  const margenSuperiorMm = 10;
  const espacioHorizontalMm = Math.max(
    8,
    pageWidth - (margenHorizontalMm * 2 + anchoCarnetMm * columnas)
  );
  const espacioVerticalMm = 6;

  const filasPorPagina = Math.max(
    1,
    Math.floor((pageHeight - margenSuperiorMm * 2 + espacioVerticalMm) / (altoCarnetMm + espacioVerticalMm))
  );
  const carnetsPorPagina = filasPorPagina * columnas;

  const restaurar = cards.map((card) => ({
    card,
    minHeight: card.style.minHeight,
    maxHeight: card.style.maxHeight,
    height: card.style.height,
    overflow: card.style.overflow,
  }));
  const pixelVacio = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  const hostsPermitidos = obtenerHostsPermitidosImagenesPDF();
  const restaurarImagenes = [];
  const imagenes = Array.from(node.querySelectorAll("img"));

  for (const item of restaurar) {
    item.card.style.minHeight = "auto";
    item.card.style.maxHeight = "none";
    item.card.style.height = "auto";
    item.card.style.overflow = "visible";
  }
  for (const img of imagenes) {
    const srcAttr = img.getAttribute("src") || "";
    const srcReal = img.currentSrc || srcAttr;
    if (!esImagenPermitidaParaPDF(srcReal, hostsPermitidos)) {
      restaurarImagenes.push({ img, src: srcAttr });
      img.setAttribute("src", pixelVacio);
    } else {
      img.setAttribute("crossorigin", "anonymous");
      img.setAttribute("referrerpolicy", "no-referrer");
    }
  }

  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  await esperarImagenesEnNodo(node, 1200);

  try {
    for (let i = 0; i < cards.length; i += 1) {
      if (i > 0 && i % carnetsPorPagina === 0) {
        pdf.addPage();
      }

      const pos = i % carnetsPorPagina;
      const fila = Math.floor(pos / columnas);
      const columna = pos % columnas;

      const x = margenHorizontalMm + columna * (anchoCarnetMm + espacioHorizontalMm);
      const y = margenSuperiorMm + fila * (altoCarnetMm + espacioVerticalMm);

      const canvas = await window.html2canvas(cards[i], {
        backgroundColor: "#ffffff",
        scale: 1.25,
        useCORS: true,
        logging: false,
        imageTimeout: 1200,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.88);
      pdf.addImage(imgData, "JPEG", x, y, anchoCarnetMm, altoCarnetMm, undefined, "FAST");
    }
  } finally {
    for (const item of restaurar) {
      item.card.style.minHeight = item.minHeight;
      item.card.style.maxHeight = item.maxHeight;
      item.card.style.height = item.height;
      item.card.style.overflow = item.overflow;
    }
    for (const item of restaurarImagenes) {
      item.img.setAttribute("src", item.src);
    }
  }

  pdf.save(nombreArchivo);
}

function imprimirNominaJugadores() {
  if (!validarPermisoReportesJugadores()) return;
  if (!contextoListoParaReportes()) {
    mostrarNotificacion("Selecciona campeonato, categoría y equipo para imprimir", "warning");
    return;
  }
  if (!jugadoresActuales.length) {
    mostrarNotificacion("No hay jugadores para imprimir", "warning");
    return;
  }
  renderPlantillaNominaJugadores();
  const zona = document.getElementById("nomina-jugadores-export");
  imprimirNodoEnVentana(zona, "Nómina de Jugadores");
}

function imprimirReporteSancionesJugadores() {
  if (!validarPermisoReportesJugadores()) return;
  if (!contextoListoParaReportes()) {
    mostrarNotificacion("Selecciona campeonato, categoría y equipo para imprimir", "warning");
    return;
  }
  if (!jugadoresActuales.length) {
    mostrarNotificacion("No hay jugadores para imprimir el reporte disciplinario", "warning");
    return;
  }
  renderReporteSancionesJugadores();
  const zona = document.getElementById("sanciones-jugadores-export");
  imprimirNodoEnVentana(zona, "Reporte Disciplinario");
}

async function imprimirReporteSancionesCategoriaJugadores() {
  if (!validarPermisoReportesJugadores()) return;
  if (!contextoListoParaReportes("sanciones_categoria")) {
    mostrarNotificacion("Selecciona campeonato y categoría para imprimir el consolidado disciplinario", "warning");
    return;
  }
  await renderReporteSancionesCategoriaJugadores();
  const zona = document.getElementById("sanciones-categoria-jugadores-export");
  imprimirNodoEnVentana(zona, "Consolidado Disciplinario");
}

async function exportarNominaJugadoresPDF() {
  if (!validarPermisoReportesJugadores()) return;
  if (!contextoListoParaReportes()) {
    mostrarNotificacion("Selecciona campeonato, categoría y equipo para exportar", "warning");
    return;
  }
  if (!jugadoresActuales.length) {
    mostrarNotificacion("No hay jugadores para exportar", "warning");
    return;
  }
  try {
    renderPlantillaNominaJugadores();
    const zona = document.getElementById("nomina-jugadores-export");
    const slugEquipo = valorTextoImportacion(equipoActual?.nombre || "equipo")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    await exportarNodoPDF(zona, `nomina_jugadores_${slugEquipo || "equipo"}.pdf`);
    mostrarNotificacion("Nómina exportada en PDF", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo exportar la nómina", "error");
  }
}

async function exportarReporteSancionesJugadoresPDF() {
  if (!validarPermisoReportesJugadores()) return;
  if (!contextoListoParaReportes()) {
    mostrarNotificacion("Selecciona campeonato, categoría y equipo para exportar", "warning");
    return;
  }
  if (!jugadoresActuales.length) {
    mostrarNotificacion("No hay jugadores para exportar el reporte disciplinario", "warning");
    return;
  }
  try {
    renderReporteSancionesJugadores();
    const zona = document.getElementById("sanciones-jugadores-export");
    const slugEquipo = valorTextoImportacion(equipoActual?.nombre || "equipo")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    await exportarNodoPDF(zona, `reporte_sanciones_${slugEquipo || "equipo"}.pdf`);
    mostrarNotificacion("Reporte disciplinario exportado en PDF", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo exportar el reporte disciplinario", "error");
  }
}

async function exportarReporteSancionesCategoriaJugadoresPDF() {
  if (!validarPermisoReportesJugadores()) return;
  if (!contextoListoParaReportes("sanciones_categoria")) {
    mostrarNotificacion("Selecciona campeonato y categoría para exportar el consolidado disciplinario", "warning");
    return;
  }
  try {
    await renderReporteSancionesCategoriaJugadores();
    const zona = document.getElementById("sanciones-categoria-jugadores-export");
    const slugCategoria = valorTextoImportacion(obtenerNombreEventoActual() || "categoria")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    await exportarNodoPDF(zona, `consolidado_sanciones_${slugCategoria || "categoria"}.pdf`);
    mostrarNotificacion("Consolidado disciplinario exportado en PDF", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo exportar el consolidado disciplinario", "error");
  }
}

function imprimirCarnetsJugadores() {
  if (!validarPermisoReportesJugadores()) return;
  if (!contextoListoParaReportes()) {
    mostrarNotificacion("Selecciona campeonato, categoría y equipo para imprimir", "warning");
    return;
  }
  if (!campeonatoMeta.genera_carnets) {
    mostrarNotificacion("Este campeonato no tiene habilitada la generación de carnés", "warning");
    return;
  }
  if (!jugadoresActuales.length) {
    mostrarNotificacion("No hay jugadores para imprimir carnés", "warning");
    return;
  }
  renderPlantillaCarnets();
  activarLayoutCarnetsA4(true);
  const zona = document.getElementById("carnets-jugadores-export");
  imprimirNodoEnVentana(zona, "Carnés de Jugadores");
  setTimeout(() => activarLayoutCarnetsA4(false), 450);
}

async function exportarCarnetsPDF() {
  if (!validarPermisoReportesJugadores()) return;
  if (!contextoListoParaReportes()) {
    mostrarNotificacion("Selecciona campeonato, categoría y equipo para exportar", "warning");
    return;
  }
  if (!campeonatoMeta.genera_carnets) {
    mostrarNotificacion("Este campeonato no tiene habilitada la generación de carnés", "warning");
    return;
  }
  if (!jugadoresActuales.length) {
    mostrarNotificacion("No hay jugadores para exportar carnés", "warning");
    return;
  }
  const bloqueCarnets = document.getElementById("bloque-carnets-jugadores");
  const bloqueNomina = document.getElementById("bloque-nomina-jugadores");
  const displayCarnetsPrev = bloqueCarnets ? bloqueCarnets.style.display : null;
  const displayNominaPrev = bloqueNomina ? bloqueNomina.style.display : null;
  try {
    renderPlantillaCarnets();
    if (bloqueCarnets) bloqueCarnets.style.display = "block";
    if (bloqueNomina) bloqueNomina.style.display = "none";
    activarLayoutCarnetsA4(true);
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    const zona = document.getElementById("carnets-jugadores-export");
    if (!zona || zona.clientWidth < 50 || zona.clientHeight < 50) {
      throw new Error("No se pudo preparar la vista de carnés para exportar");
    }
    const slugEquipo = valorTextoImportacion(equipoActual?.nombre || "equipo")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    await exportarCarnetsEnPDFA4(zona, `carnets_jugadores_${slugEquipo || "equipo"}.pdf`);
    mostrarNotificacion("Carnés exportados en PDF", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo exportar carnés", "error");
  } finally {
    activarLayoutCarnetsA4(false);
    if (bloqueCarnets && displayCarnetsPrev !== null) bloqueCarnets.style.display = displayCarnetsPrev;
    if (bloqueNomina && displayNominaPrev !== null) bloqueNomina.style.display = displayNominaPrev;
  }
}

function obtenerTipoReporteJugadores() {
  const select = document.getElementById("reporte-jugadores-tipo");
  return select?.value || "nomina";
}

async function verReporteJugadores() {
  if (!validarPermisoReportesJugadores()) return;
  const tipo = obtenerTipoReporteJugadores();
  if (tipo === "carnets") {
    mostrarPlantillaCarnets();
    return;
  }
  if (tipo === "sanciones_categoria") {
    await mostrarReporteSancionesCategoriaJugadores();
    return;
  }
  if (tipo === "sanciones") {
    mostrarReporteSancionesJugadores();
    return;
  }
  mostrarPlantillaNominaJugadores();
}

async function imprimirReporteJugadores() {
  if (!validarPermisoReportesJugadores()) return;
  const tipo = obtenerTipoReporteJugadores();
  if (tipo === "carnets") {
    imprimirCarnetsJugadores();
    return;
  }
  if (tipo === "sanciones_categoria") {
    await imprimirReporteSancionesCategoriaJugadores();
    return;
  }
  if (tipo === "sanciones") {
    imprimirReporteSancionesJugadores();
    return;
  }
  imprimirNominaJugadores();
}

async function exportarReporteJugadoresPDF() {
  if (!validarPermisoReportesJugadores()) return;
  const tipo = obtenerTipoReporteJugadores();
  if (tipo === "carnets") {
    await exportarCarnetsPDF();
    return;
  }
  if (tipo === "sanciones_categoria") {
    await exportarReporteSancionesCategoriaJugadoresPDF();
    return;
  }
  if (tipo === "sanciones") {
    await exportarReporteSancionesJugadoresPDF();
    return;
  }
  await exportarNominaJugadoresPDF();
}

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
    texto += ` - Debajo del minimo (${minJugadoresPorEquipo})`;
    color = "#e67e22";
  } else if (maxJugadoresPorEquipo && total > maxJugadoresPorEquipo) {
    texto += " - Excede el maximo permitido";
    color = "#c0392b";
  }

  resumenEl.textContent = texto;
  resumenEl.style.color = color;
}

function mostrarModalCrearJugador() {
  if (usuarioSoloLecturaJugadores()) {
    mostrarNotificacion("Tu perfil es solo lectura en jugadores", "warning");
    return;
  }
  if (!equipoId) {
    mostrarNotificacion("Selecciona un equipo primero", "warning");
    return;
  }

  if (maxJugadoresPorEquipo && jugadoresActuales.length >= maxJugadoresPorEquipo) {
    mostrarNotificacion(`Ya alcanzaste el maximo de ${maxJugadoresPorEquipo} jugadores para este equipo`, "warning");
    return;
  }

  const titulo = document.getElementById("modal-jugador-titulo");
  const form = document.getElementById("form-jugador");

  jugadorActualEnEdicion = null;
  if (titulo) titulo.textContent = "Nuevo Jugador";
  if (form) form.reset();

  document.getElementById("jugador-id").value = "";
  document.getElementById("jugador-equipo-id").value = equipoId;
  document.getElementById("jugador-capitan").checked = false;
  document.getElementById("jugador-foto-cedula").value = "";
  document.getElementById("jugador-foto-carnet").value = "";
  document.getElementById("jugador-eliminar-foto-carnet").value = "false";

  actualizarEstadoRequisitosEnModal(null);
  abrirModal("modal-jugador");
}

async function editarJugador(id) {
  if (usuarioSoloLecturaJugadores()) {
    mostrarNotificacion("Tu perfil es solo lectura en jugadores", "warning");
    return;
  }
  try {
    const data = await ApiClient.get(`/jugadores/${id}`);
    const jugador = data.jugador || data;
    jugadorActualEnEdicion = jugador;

    const titulo = document.getElementById("modal-jugador-titulo");
    if (titulo) titulo.textContent = "Editar Jugador";

    document.getElementById("jugador-id").value = jugador.id;
    document.getElementById("jugador-equipo-id").value = jugador.equipo_id;
    document.getElementById("jugador-nombre").value = jugador.nombre || "";
    document.getElementById("jugador-apellido").value = jugador.apellido || "";
    document.getElementById("jugador-ced").value = jugador.cedidentidad || "";
    document.getElementById("jugador-fecha").value = obtenerFechaInput(jugador.fecha_nacimiento);
    document.getElementById("jugador-posicion").value = jugador.posicion || "";
    document.getElementById("jugador-numero").value = jugador.numero_camiseta || "";
    document.getElementById("jugador-capitan").checked = !!jugador.es_capitan;
    document.getElementById("jugador-foto-cedula").value = "";
    document.getElementById("jugador-foto-carnet").value = "";
    document.getElementById("jugador-eliminar-foto-carnet").value = "false";

    actualizarEstadoRequisitosEnModal(jugador);
    abrirModal("modal-jugador");
  } catch (error) {
    console.error("Error cargando jugador:", error);
    mostrarNotificacion("Error cargando datos del jugador", "error");
  }
}

async function guardarJugadorConFormData({ id, fd }) {
  const url = id ? `${window.API_BASE_URL}/jugadores/${id}` : `${window.API_BASE_URL}/jugadores`;

  const resp = await fetch(url, {
    method: id ? "PUT" : "POST",
    body: fd,
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error || data.detalle || "Error guardando jugador");
  }

  return data;
}

document.getElementById("form-jugador").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (usuarioSoloLecturaJugadores()) {
    mostrarNotificacion("Tu perfil es solo lectura en jugadores", "warning");
    return;
  }

  if (!equipoId) {
    mostrarNotificacion("Selecciona un equipo primero", "warning");
    return;
  }

  const id = document.getElementById("jugador-id").value;
  const equipoJugador = Number.parseInt(document.getElementById("jugador-equipo-id").value, 10);
  const nombre = document.getElementById("jugador-nombre").value.trim();
  const apellido = document.getElementById("jugador-apellido").value.trim();
  const cedidentidad = document.getElementById("jugador-ced").value.trim();

  const fechaNacimiento = document.getElementById("jugador-fecha").value || "";
  const posicion = document.getElementById("jugador-posicion").value || "";
  const numeroRaw = document.getElementById("jugador-numero").value;
  const esCapitan = document.getElementById("jugador-capitan").checked;
  const fotoCedulaFile = document.getElementById("jugador-foto-cedula").files?.[0] || null;
  const fotoCarnetFile = document.getElementById("jugador-foto-carnet").files?.[0] || null;
  const eliminarFotoCarnet = fotoCarnetMarcadaParaEliminar();

  if (!nombre || !apellido) {
    mostrarNotificacion(
      "Nombre y apellido son obligatorios",
      "error"
    );
    return;
  }

  if (!id && maxJugadoresPorEquipo && jugadoresActuales.length >= maxJugadoresPorEquipo) {
    mostrarNotificacion(`No puedes agregar mas de ${maxJugadoresPorEquipo} jugadores en este equipo`, "warning");
    return;
  }

  const tieneCedulaActual = Boolean(jugadorActualEnEdicion?.foto_cedula_url);
  const tieneCarnetActual = Boolean(jugadorActualEnEdicion?.foto_carnet_url) && !eliminarFotoCarnet;

  if (reglasDocumentos.requiere_foto_cedula && !fotoCedulaFile && !(id && tieneCedulaActual)) {
    mostrarNotificacion("Este campeonato exige foto de cédula", "warning");
    return;
  }

  if (reglasDocumentos.requiere_foto_carnet && !fotoCarnetFile && !(id && tieneCarnetActual)) {
    mostrarNotificacion("Este campeonato exige foto carné", "warning");
    return;
  }

  const fd = new FormData();
  fd.append("equipo_id", String(equipoJugador));
  fd.append("nombre", nombre);
  fd.append("apellido", apellido);
  if (cedidentidad) {
    fd.append("cedidentidad", cedidentidad);
  }
  if (fechaNacimiento) fd.append("fecha_nacimiento", fechaNacimiento);
  if (posicion) fd.append("posicion", posicion);
  if (numeroRaw) fd.append("numero_camiseta", String(Number.parseInt(numeroRaw, 10)));
  fd.append("es_capitan", esCapitan ? "true" : "false");

  if (fotoCedulaFile) fd.append("foto_cedula", fotoCedulaFile);
  if (fotoCarnetFile) fd.append("foto_carnet", fotoCarnetFile);
  if (eliminarFotoCarnet) fd.append("eliminar_foto_carnet", "true");

  try {
    await guardarJugadorConFormData({ id, fd });
    mostrarNotificacion(id ? "Jugador actualizado correctamente" : "Jugador creado correctamente", "success");
    cerrarModal("modal-jugador");
    await cargarJugadores();
  } catch (error) {
    console.error("Error guardando jugador:", error);
    mostrarNotificacion(error.message || "Error guardando el jugador", "error");
  }
});

document.getElementById("jugador-foto-carnet")?.addEventListener("change", () => {
  const input = document.getElementById("jugador-foto-carnet");
  if (input?.files?.length) {
    marcarEliminacionFotoCarnet(false);
  } else {
    actualizarEstadoRequisitosEnModal(jugadorActualEnEdicion);
  }
});

async function eliminarJugador(id) {
  if (usuarioSoloLecturaJugadores()) {
    mostrarNotificacion("Tu perfil es solo lectura en jugadores", "warning");
    return;
  }
  const ok = await window.mostrarConfirmacion({
    titulo: "Eliminar jugador",
    mensaje: "¿Seguro que deseas eliminar este jugador?",
    tipo: "warning",
    textoConfirmar: "Eliminar",
    claseConfirmar: "btn-danger",
  });
  if (!ok) return;

  try {
    await ApiClient.delete(`/jugadores/${id}`);
    mostrarNotificacion("Jugador eliminado", "success");
    await cargarJugadores();
  } catch (error) {
    console.error("Error eliminando jugador:", error);
    mostrarNotificacion("Error eliminando el jugador", "error");
  }
}

const CAMPOS_IMPORTACION_JUGADORES = [
  "nombre",
  "apellido",
  "cedidentidad",
  "fecha_nacimiento",
  "posicion",
  "numero_camiseta",
  "es_capitan",
  "foto_cedula_url",
  "foto_carnet_url",
];

const ALIAS_CAMPOS_IMPORTACION = {
  nombre: ["nombre", "nombres", "nombre_jugador", "jugador_nombre", "nombres_jugador"],
  apellido: ["apellido", "apellidos", "apellido_jugador", "jugador_apellido", "apellidos_jugador"],
  nombre_completo: [
    "nombre_completo",
    "nombres_apellidos",
    "apellidos_nombres",
    "jugador",
    "nombre_y_apellido",
  ],
  cedidentidad: [
    "cedidentidad",
    "cedula",
    "cedula_identidad",
    "cedula_de_identidad",
    "dni",
    "documento",
    "identificacion",
  ],
  fecha_nacimiento: ["fecha_nacimiento", "nacimiento", "fecha_de_nacimiento", "fecha_nac"],
  posicion: ["posicion", "pos", "puesto"],
  numero_camiseta: ["numero_camiseta", "numero", "camiseta", "dorsal", "num_camiseta", "nro_camiseta"],
  es_capitan: ["es_capitan", "capitan", "capitan_si_no", "es_capitan_si_no"],
  foto_cedula_url: ["foto_cedula_url", "foto_cedula", "url_foto_cedula", "cedula_foto_url"],
  foto_carnet_url: ["foto_carnet_url", "foto_carnet", "url_foto_carnet", "carnet_foto_url"],
};

function normalizarClaveImportacion(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function valorTextoImportacion(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim();
}

function valorBooleanoImportacion(valor) {
  const normalizado = normalizarClaveImportacion(valor);
  return ["si", "s", "true", "1", "x", "yes"].includes(normalizado);
}

function valorNumeroImportacion(valor) {
  const texto = valorTextoImportacion(valor).replace(/[^\d-]/g, "");
  if (!texto) return null;
  const numero = Number.parseInt(texto, 10);
  return Number.isFinite(numero) ? numero : null;
}

function valorFechaImportacion(valor) {
  if (!valor && valor !== 0) return null;

  if (typeof valor === "number" && window.XLSX?.SSF?.parse_date_code) {
    const dateCode = window.XLSX.SSF.parse_date_code(valor);
    if (dateCode?.y && dateCode?.m && dateCode?.d) {
      const yyyy = String(dateCode.y).padStart(4, "0");
      const mm = String(dateCode.m).padStart(2, "0");
      const dd = String(dateCode.d).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const yyyy = String(valor.getFullYear()).padStart(4, "0");
    const mm = String(valor.getMonth() + 1).padStart(2, "0");
    const dd = String(valor.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const texto = valorTextoImportacion(valor);
  if (!texto) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);

  const m = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const dd = String(m[1]).padStart(2, "0");
    const mm = String(m[2]).padStart(2, "0");
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(texto);
  if (!Number.isNaN(parsed.getTime())) {
    const yyyy = String(parsed.getFullYear()).padStart(4, "0");
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

function obtenerValorAliasFila(mapaNormalizado, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(mapaNormalizado, alias)) {
      const valor = mapaNormalizado[alias];
      if (valor !== null && valor !== undefined && String(valor).trim() !== "") {
        return valor;
      }
    }
  }
  return null;
}

function normalizarFilaImportacionJugador(fila) {
  const mapaNormalizado = {};
  Object.entries(fila || {}).forEach(([key, val]) => {
    const nk = normalizarClaveImportacion(key);
    if (!nk) return;
    mapaNormalizado[nk] = val;
  });

  const nombre = valorTextoImportacion(
    obtenerValorAliasFila(mapaNormalizado, ALIAS_CAMPOS_IMPORTACION.nombre)
  );
  let apellido = valorTextoImportacion(
    obtenerValorAliasFila(mapaNormalizado, ALIAS_CAMPOS_IMPORTACION.apellido)
  );
  let nombreFinal = nombre;
  const nombreCompleto = valorTextoImportacion(
    obtenerValorAliasFila(mapaNormalizado, ALIAS_CAMPOS_IMPORTACION.nombre_completo)
  );
  if ((!nombreFinal || !apellido) && nombreCompleto) {
    const partes = nombreCompleto.split(/\s+/).filter(Boolean);
    if (partes.length >= 2) {
      if (!nombreFinal) nombreFinal = partes.slice(0, partes.length - 1).join(" ");
      if (!apellido) apellido = partes[partes.length - 1];
    } else if (!nombreFinal) {
      nombreFinal = nombreCompleto;
    }
  }
  const cedidentidad = valorTextoImportacion(
    obtenerValorAliasFila(mapaNormalizado, ALIAS_CAMPOS_IMPORTACION.cedidentidad)
  );
  const fecha_nacimiento = valorFechaImportacion(
    obtenerValorAliasFila(mapaNormalizado, ALIAS_CAMPOS_IMPORTACION.fecha_nacimiento)
  );
  const posicion = valorTextoImportacion(
    obtenerValorAliasFila(mapaNormalizado, ALIAS_CAMPOS_IMPORTACION.posicion)
  );
  const numero_camiseta = valorNumeroImportacion(
    obtenerValorAliasFila(mapaNormalizado, ALIAS_CAMPOS_IMPORTACION.numero_camiseta)
  );
  const es_capitan = valorBooleanoImportacion(
    obtenerValorAliasFila(mapaNormalizado, ALIAS_CAMPOS_IMPORTACION.es_capitan)
  );
  const foto_cedula_url = valorTextoImportacion(
    obtenerValorAliasFila(mapaNormalizado, ALIAS_CAMPOS_IMPORTACION.foto_cedula_url)
  );
  const foto_carnet_url = valorTextoImportacion(
    obtenerValorAliasFila(mapaNormalizado, ALIAS_CAMPOS_IMPORTACION.foto_carnet_url)
  );

  const filaVacia =
    !nombre &&
    !apellido &&
    !cedidentidad &&
    !fecha_nacimiento &&
    !posicion &&
    numero_camiseta === null &&
    !foto_cedula_url &&
    !foto_carnet_url;
  const filaVaciaConNombre =
    !nombreFinal &&
    !apellido &&
    !cedidentidad &&
    !fecha_nacimiento &&
    !posicion &&
    numero_camiseta === null &&
    !foto_cedula_url &&
    !foto_carnet_url;
  if (filaVacia || filaVaciaConNombre) return null;

  return {
    nombre: nombreFinal,
    apellido,
    cedidentidad,
    fecha_nacimiento,
    posicion,
    numero_camiseta,
    es_capitan,
    foto_cedula_url,
    foto_carnet_url,
  };
}

function leerArchivoComoArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo seleccionado"));
    reader.readAsArrayBuffer(file);
  });
}

async function procesarArchivoImportacionJugadores(file) {
  if (!window.XLSX) {
    throw new Error("No se cargo la libreria XLSX para importar");
  }

  const arrayBuffer = await leerArchivoComoArrayBuffer(file);
  const wb = window.XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error("El archivo no contiene hojas válidas");

  const filasRaw = window.XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: true,
  });

  if (!filasRaw.length) {
    throw new Error("El archivo no tiene filas para importar");
  }

  const jugadores = [];
  const erroresLocales = [];

  filasRaw.forEach((fila, idx) => {
    const nroFila = idx + 2;
    const normalizada = normalizarFilaImportacionJugador(fila);
    if (!normalizada) return;

    const cedulaObligatoria = esCedulaObligatoriaEnCampeonato();
    if (
      !normalizada.nombre ||
      !normalizada.apellido ||
      (cedulaObligatoria && !normalizada.cedidentidad)
    ) {
      erroresLocales.push(
        `Fila ${nroFila}: ${
          cedulaObligatoria
            ? "nombre, apellido y cedidentidad son obligatorios"
            : "nombre y apellido son obligatorios"
        }`
      );
      return;
    }

    jugadores.push(normalizada);
  });

  if (!jugadores.length) {
    const msgError = erroresLocales.length
      ? `No hay filas validas para importar.\n${erroresLocales.slice(0, 8).join("\n")}`
      : "No hay filas validas para importar.";
    throw new Error(msgError);
  }

  return { jugadores, erroresLocales, totalLeidas: filasRaw.length };
}

function inicializarImportadorJugadores() {
  const input = document.getElementById("import-jugadores-file");
  if (!input || input.dataset.inicializado === "1") return;
  input.dataset.inicializado = "1";

  input.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    input.value = "";
    if (!file) return;

    if (!contextoListoParaImportaciones()) {
      mostrarNotificacion("Selecciona campeonato, categoría y equipo antes de importar jugadores", "warning");
      return;
    }

    try {
      mostrarNotificacion("Procesando archivo de jugadores...", "info");
      const { jugadores, erroresLocales, totalLeidas } = await procesarArchivoImportacionJugadores(file);

      const resultado = await ApiClient.post("/jugadores/importar-masivo", {
        equipo_id: equipoId,
        jugadores,
      });

      const totalErroresBackend = Number(resultado?.total_errores || 0);
      const totalCreado = Number(resultado?.total_creados || 0);

      await cargarJugadores();

      const resumen = [
        `Importacion completada para el equipo ${equipoActual?.nombre || equipoId}.`,
        `Filas leidas: ${totalLeidas}`,
        `Filas enviadas: ${jugadores.length}`,
        `Jugadores creados: ${totalCreado}`,
        `Errores en backend: ${totalErroresBackend}`,
      ];

      if (erroresLocales.length) {
        resumen.push(`Filas omitidas localmente: ${erroresLocales.length}`);
      }
      if (Array.isArray(resultado?.errores) && resultado.errores.length) {
        const preview = resultado.errores
          .slice(0, 5)
          .map((x) => `Fila ${x.fila}: ${x.error}`)
          .join("\n");
        resumen.push(`Primeros errores backend:\n${preview}`);
      }

      await window.mostrarAlerta({
        titulo: "Resumen de importación",
        mensaje: resumen.join("\n"),
        tipo: totalErroresBackend ? "warning" : "success",
        textoBoton: "Cerrar resumen",
      });
      mostrarNotificacion("Importacion finalizada", totalErroresBackend ? "warning" : "success");
    } catch (error) {
      console.error("Error importando jugadores:", error);
      mostrarNotificacion(error.message || "No se pudo importar el archivo", "error");
    }
  });
}

function abrirImportadorJugadores() {
  if (!contextoListoParaImportaciones()) {
    mostrarNotificacion("Selecciona campeonato, categoría y equipo para importar jugadores", "warning");
    return;
  }

  const input = document.getElementById("import-jugadores-file");
  if (!input) {
    mostrarNotificacion("No se encontro el control para importar archivo", "error");
    return;
  }
  input.click();
}

function detectarTipoDocumentoDesdeNombre(filename) {
  const name = String(filename || "").toLowerCase();
  if (/(carnet|carne|idcard|id_card|credencial)/.test(name)) return "carnet";
  if (/(cedula|c[eé]dula|dni|documento|identidad|ci)/.test(name)) return "cedula";
  return "";
}

function extraerCedulaDesdeNombre(filename) {
  const base = String(filename || "")
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.[^.]+$/, "") || "";
  const match = base.match(/\d{8,15}/);
  return match ? normalizarCedulaValor(match[0]) : "";
}

function mimePorExtension(nombre) {
  const n = String(nombre || "").toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".bmp")) return "image/bmp";
  return "application/octet-stream";
}

function inicializarImportadorDocsZip() {
  const input = document.getElementById("import-docs-zip-file");
  if (!input || input.dataset.inicializado === "1") return;
  input.dataset.inicializado = "1";

  input.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    input.value = "";
    if (!file) return;

    if (!contextoListoParaImportaciones()) {
      mostrarNotificacion("Selecciona campeonato, categoría y equipo para importar documentos", "warning");
      return;
    }
    if (!jugadoresActuales.length) {
      mostrarNotificacion("No hay jugadores cargados en el equipo seleccionado", "warning");
      return;
    }
    if (!window.JSZip) {
      mostrarNotificacion("No se pudo cargar JSZip para leer el archivo .zip", "error");
      return;
    }

    try {
      mostrarNotificacion("Procesando ZIP de documentos...", "info");
      const zip = await window.JSZip.loadAsync(file);
      const entries = Object.values(zip.files || {}).filter((f) => !f.dir);

      const mapDocs = new Map();
      for (const entry of entries) {
        const ced = extraerCedulaDesdeNombre(entry.name);
        const tipo = detectarTipoDocumentoDesdeNombre(entry.name);
        if (!ced || !tipo) continue;
        if (!mapDocs.has(ced)) mapDocs.set(ced, {});
        mapDocs.get(ced)[tipo] = entry;
      }

      let actualizados = 0;
      let sinMatch = 0;
      const errores = [];

      for (const jugador of jugadoresActuales) {
        const ced = normalizarCedulaValor(jugador.cedidentidad);
        if (!ced) continue;
        const docs = mapDocs.get(ced);
        if (!docs?.cedula && !docs?.carnet) {
          sinMatch += 1;
          continue;
        }

        const fd = new FormData();
        if (docs.cedula) {
          const blobCed = await docs.cedula.async("blob");
          const nameCed = docs.cedula.name.split(/[\\/]/).pop() || `cedula_${ced}.jpg`;
          fd.append("foto_cedula", new File([blobCed], nameCed, { type: mimePorExtension(nameCed) }));
        }
        if (docs.carnet) {
          const blobCar = await docs.carnet.async("blob");
          const nameCar = docs.carnet.name.split(/[\\/]/).pop() || `carnet_${ced}.jpg`;
          fd.append("foto_carnet", new File([blobCar], nameCar, { type: mimePorExtension(nameCar) }));
        }

        if (![...fd.keys()].length) continue;

        try {
          const resp = await fetch(`${window.API_BASE_URL}/jugadores/${jugador.id}`, {
            method: "PUT",
            body: fd,
          });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            throw new Error(data.error || data.detalle || `Error HTTP ${resp.status}`);
          }
          actualizados += 1;
        } catch (errorJugador) {
          errores.push(`Cédula ${jugador.cedidentidad}: ${errorJugador.message}`);
        }
      }

      await cargarJugadores();

      const resumen = [
        `ZIP procesado: ${file.name}`,
        `Jugadores actualizados: ${actualizados}`,
        `Jugadores sin coincidencia por cédula: ${sinMatch}`,
        `Errores: ${errores.length}`,
      ];
      if (errores.length) {
        resumen.push(`Detalle:\n${errores.slice(0, 8).join("\n")}`);
      }
      await window.mostrarAlerta({
        titulo: "Resumen de importación ZIP",
        mensaje: resumen.join("\n"),
        tipo: errores.length ? "warning" : "success",
        textoBoton: "Cerrar resumen",
      });
      mostrarNotificacion("Importación ZIP finalizada", errores.length ? "warning" : "success");
    } catch (error) {
      console.error("Error importando ZIP de documentos:", error);
      mostrarNotificacion(error.message || "No se pudo procesar el ZIP", "error");
    }
  });
}

function abrirImportadorDocsZip() {
  if (!contextoListoParaImportaciones()) {
    mostrarNotificacion("Selecciona campeonato, categoría y equipo para importar documentos", "warning");
    return;
  }
  const input = document.getElementById("import-docs-zip-file");
  if (!input) {
    mostrarNotificacion("No se encontró el control para importar ZIP", "error");
    return;
  }
  input.click();
}

function descargarPlantillaJugadores() {
  if (!contextoListoParaImportaciones()) {
    mostrarNotificacion("Selecciona campeonato, categoría y equipo para descargar plantilla", "warning");
    return;
  }
  if (!window.XLSX) {
    mostrarNotificacion("No se cargo la libreria XLSX para exportar plantilla", "error");
    return;
  }

  const filasPlantilla = [
    CAMPOS_IMPORTACION_JUGADORES,
    [
      "Juan",
      "Perez",
      "0102030405",
      "2001-05-20",
      "Volante",
      "10",
      "No",
      "https://tu-dominio.com/documentos/cedula_juan_perez.jpg",
      "https://tu-dominio.com/documentos/carnet_juan_perez.jpg",
    ],
  ];

  const wsDatos = window.XLSX.utils.aoa_to_sheet(filasPlantilla);
  wsDatos["!cols"] = [
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 38 },
    { wch: 38 },
  ];

  const instrucciones = [
    ["INSTRUCCIONES PARA IMPORTAR JUGADORES"],
    ["1) No cambies los nombres de las columnas de la hoja Datos."],
    [
      `2) Campos obligatorios: nombre, apellido${
        esCedulaObligatoriaEnCampeonato() ? ", cedidentidad" : ""
      }.`,
    ],
    ["3) fecha_nacimiento en formato YYYY-MM-DD o DD/MM/YYYY."],
    ["4) es_capitan: Si/No (tambien acepta True/False, 1/0)."],
    ["5) numero_camiseta solo numeros enteros."],
    ["6) foto_cedula_url y foto_carnet_url son opcionales: usa URL publica o ruta ya servida por backend."],
    ["7) Importa por equipo: selecciona campeonato/categoria/equipo antes de subir archivo."],
  ];
  const wsInstrucciones = window.XLSX.utils.aoa_to_sheet(instrucciones);
  wsInstrucciones["!cols"] = [{ wch: 95 }];

  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, wsDatos, "Datos");
  window.XLSX.utils.book_append_sheet(wb, wsInstrucciones, "Instrucciones");

  const slugEquipo = valorTextoImportacion(equipoActual?.nombre || "general")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const filename = `plantilla_jugadores_${slugEquipo || "general"}.xlsx`;
  window.XLSX.writeFile(wb, filename);
}

window.cargarJugadoresDesdeSeleccion = cargarJugadoresDesdeSeleccion;
window.cambiarPestanaJugadores = cambiarPestanaJugadores;
window.cambiarVistaJugadores = cambiarVistaJugadores;
window.mostrarModalCrearJugador = mostrarModalCrearJugador;
window.editarJugador = editarJugador;
window.eliminarJugador = eliminarJugador;
window.volverAEquipos = volverAEquipos;
window.abrirImportadorJugadores = abrirImportadorJugadores;
window.abrirImportadorDocsZip = abrirImportadorDocsZip;
window.descargarPlantillaJugadores = descargarPlantillaJugadores;
window.verReporteJugadores = verReporteJugadores;
window.imprimirReporteJugadores = imprimirReporteJugadores;
window.exportarReporteJugadoresPDF = exportarReporteJugadoresPDF;
window.mostrarPlantillaNominaJugadores = mostrarPlantillaNominaJugadores;
window.mostrarReporteSancionesJugadores = mostrarReporteSancionesJugadores;
window.mostrarReporteSancionesCategoriaJugadores = mostrarReporteSancionesCategoriaJugadores;
window.imprimirNominaJugadores = imprimirNominaJugadores;
window.exportarNominaJugadoresPDF = exportarNominaJugadoresPDF;
window.imprimirReporteSancionesJugadores = imprimirReporteSancionesJugadores;
window.exportarReporteSancionesJugadoresPDF = exportarReporteSancionesJugadoresPDF;
window.imprimirReporteSancionesCategoriaJugadores = imprimirReporteSancionesCategoriaJugadores;
window.exportarReporteSancionesCategoriaJugadoresPDF = exportarReporteSancionesCategoriaJugadoresPDF;
window.mostrarPlantillaCarnets = mostrarPlantillaCarnets;
window.imprimirCarnetsJugadores = imprimirCarnetsJugadores;
window.exportarCarnetsPDF = exportarCarnetsPDF;
