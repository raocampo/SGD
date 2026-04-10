// frontend/js/partidos.js

const BACKEND_BASE = (window.resolveBackendBaseUrl
  ? window.resolveBackendBaseUrl()
  : `${window.location.origin}`).replace(/\/$/, "");

let eventoSeleccionado = null;
let campeonatoSeleccionado = null;
let grupoSeleccionado = null;
let jornadaSeleccionada = null;
let fechaSeleccionada = null;
let vistaFixture = "todos";
let partidosActuales = [];
let eliminatoriasActuales = [];
let eventosCache = [];
let metodoCompetenciaActivo = "grupos";
let reporteSancionesPartidosCache = null;
let alertasOperativasPartidos = new Map();
let cargandoAlertasOperativasPartidos = false;
let tokenAlertasOperativasPartidos = 0;
let vistaPartidos = localStorage.getItem("sgd_vista_partidos") || "cards";
vistaPartidos = vistaPartidos === "table" ? "table" : "cards";

let fixtureContexto = {
  campeonatoId: null,
  campeonatoNombre: "",
  organizador: "",
  tipoFutbol: "",
  fechaInicio: "",
  fechaFin: "",
  eventoNombre: "",
  logoUrl: null,
  auspiciantes: [],
};

function leerModoProgramacionFixture() {
  const automatica = document.getElementById("chk-programacion-automatica")?.checked === true;
  const manual = document.getElementById("chk-programacion-manual")?.checked === true;

  if (automatica && manual) {
    return {
      valida: false,
      automatica,
      manual,
      mensaje: "Selecciona solo una forma de programación: automática o manual.",
    };
  }

  if (!automatica && !manual) {
    return {
      valida: false,
      automatica,
      manual,
      mensaje: "No se puede generar el fixture ya que no tiene seleccionada una opción de programación.",
    };
  }

  return { valida: true, automatica, manual };
}

async function validarModoProgramacionFixture() {
  const modo = leerModoProgramacionFixture();
  if (modo.valida) return modo;

  await window.mostrarAlerta({
    titulo: "Selecciona una opción de fixture",
    mensaje: modo.mensaje,
    tipo: "warning",
    textoBoton: "Entendido",
  });
  return null;
}

function inicializarControlesModoFixture() {
  const auto = document.getElementById("chk-programacion-automatica");
  const manual = document.getElementById("chk-programacion-manual");
  if (!auto || !manual || auto.dataset.bound === "true") return;

  auto.addEventListener("change", () => {
    if (auto.checked) manual.checked = false;
  });
  manual.addEventListener("change", () => {
    if (manual.checked) auto.checked = false;
  });
  auto.dataset.bound = "true";
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function obtenerNombreEventoPartidos() {
  const evento = obtenerEventoSeleccionadoObj();
  return String(evento?.nombre || fixtureContexto.eventoNombre || "Categoría").trim();
}

function obtenerEstadoDisciplinarioPartidos(jugador = {}) {
  const suspension = jugador?.suspension || null;
  if (!suspension) {
    return {
      css: "estado-borrador",
      texto: "Sin evaluar",
      titulo: "Selecciona una categoría para evaluar sanciones",
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

function renderEstadoDisciplinarioPartidos(jugador = {}) {
  const estado = obtenerEstadoDisciplinarioPartidos(jugador);
  return `<span class="badge-estado ${estado.css}" title="${escapeHtml(estado.titulo)}">${escapeHtml(
    estado.texto
  )}</span>`;
}

function limpiarReporteSancionesPartidos(
  mensaje = "Selecciona campeonato y categoría para generar el reporte disciplinario operativo."
) {
  reporteSancionesPartidosCache = null;
  const zona = document.getElementById("partidos-sanciones-export");
  if (zona) {
    zona.innerHTML = `<p class="empty-state">${escapeHtml(mensaje)}</p>`;
  }
}

function obtenerResumenDisciplinaPartidos(registros = []) {
  const base = (Array.isArray(registros) ? registros : []).reduce(
    (acc, jugador) => {
      const suspension = jugador?.suspension || null;
      if (suspension?.suspendido) acc.suspendidos += 1;
      else if (Number(suspension?.amarillas_acumuladas || 0) > 0) acc.alertaAmarillas += 1;
      return acc;
    },
    {
      totalNovedades: 0,
      suspendidos: 0,
      alertaAmarillas: 0,
    }
  );

  const equipos = new Set(
    (Array.isArray(registros) ? registros : [])
      .map((item) => Number.parseInt(item?.equipo_id, 10))
      .filter((id) => Number.isFinite(id) && id > 0)
  );

  return {
    ...base,
    totalNovedades: (Array.isArray(registros) ? registros : []).length,
    equipos: equipos.size,
  };
}

function imprimirNodoEnVentanaPartidos(node, titulo = "Impresión") {
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

async function exportarNodoPDFPartidos(node, nombreArchivo) {
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

function obtenerNumeroPartidoVisible(partido, fallback = null) {
  const n = Number.parseInt(partido?.numero_campeonato, 10);
  if (Number.isFinite(n) && n > 0) return n;
  if (Number.isFinite(Number(fallback)) && Number(fallback) > 0) return Number(fallback);
  return null;
}

function obtenerSiguienteNumeroVisiblePartido() {
  const maxActual = partidosActuales.reduce((maximo, partido) => {
    const numero = Number.parseInt(partido?.numero_campeonato, 10);
    return Number.isFinite(numero) && numero > maximo ? numero : maximo;
  }, 0);
  return maxActual + 1;
}

function formatoMonedaPartidos(valor) {
  const n = Number(valor || 0);
  if (!Number.isFinite(n)) return "$0.00";
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function obtenerAlertaOperativaPartidos(equipoId) {
  const id = Number.parseInt(equipoId, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return alertasOperativasPartidos.get(id) || null;
}

function resumirDisciplinaEquipoPartidos(jugadores = []) {
  return (Array.isArray(jugadores) ? jugadores : []).reduce(
    (acc, jugador) => {
      const suspension = jugador?.suspension || null;
      if (suspension?.suspendido) acc.suspendidos += 1;
      else if (Number(suspension?.amarillas_acumuladas || 0) > 0) acc.alerta_amarillas += 1;
      return acc;
    },
    { suspendidos: 0, alerta_amarillas: 0 }
  );
}

function renderChipsAlertaEquipoPartido(alerta) {
  if (!alerta && cargandoAlertasOperativasPartidos) {
    return `
      <div class="partido-alertas-chips">
        <span class="equipo-alerta-chip equipo-alerta-cargando">
          <i class="fas fa-spinner fa-spin"></i> Actualizando
        </span>
      </div>
    `;
  }

  const saldo = Number(alerta?.saldo || 0);
  const suspendidos = Number(alerta?.suspendidos || 0);
  const amarillas = Number(alerta?.alerta_amarillas || 0);
  const chips = [];

  if (saldo > 0) {
    chips.push(`
      <span class="equipo-alerta-chip equipo-alerta-deuda">
        <i class="fas fa-wallet"></i> ${formatoMonedaPartidos(saldo)}
      </span>
    `);
  }
  if (suspendidos > 0) {
    chips.push(`
      <span class="equipo-alerta-chip equipo-alerta-disciplina">
        <i class="fas fa-ban"></i> ${suspendidos} suspendido${suspendidos === 1 ? "" : "s"}
      </span>
    `);
  }
  if (amarillas > 0) {
    chips.push(`
      <span class="equipo-alerta-chip equipo-alerta-seguimiento">
        <i class="fas fa-square"></i> ${amarillas} seguimiento
      </span>
    `);
  }
  if (!chips.length) {
    chips.push(`
      <span class="equipo-alerta-chip equipo-alerta-ok">
        <i class="fas fa-circle-check"></i> Sin alertas
      </span>
    `);
  }

  return `<div class="partido-alertas-chips">${chips.join("")}</div>`;
}

function renderBloqueAlertasPartido(equipoId, nombre, lado) {
  const alerta = obtenerAlertaOperativaPartidos(equipoId);
  return `
    <div class="partido-alerta-equipo partido-alerta-equipo-${lado}">
      <div class="partido-alerta-nombre">${escapeHtml(nombre || "Equipo")}</div>
      ${renderChipsAlertaEquipoPartido(alerta)}
    </div>
  `;
}

function renderResumenAlertasOperativasPartidos() {
  const cont = document.getElementById("partidos-alertas-operativas");
  if (!cont) return;

  if (!eventoSeleccionado || metodoCompetenciaActivo === "eliminatoria") {
    cont.style.display = "none";
    cont.innerHTML = "";
    return;
  }

  const partidos = getPartidosFiltrados();
  if (!partidos.length && !cargandoAlertasOperativasPartidos) {
    cont.style.display = "none";
    cont.innerHTML = "";
    return;
  }

  if (cargandoAlertasOperativasPartidos) {
    cont.style.display = "block";
    cont.innerHTML = `
      <h3>Alertas Operativas de los Partidos Mostrados</h3>
      <div class="empty-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Actualizando deuda y disciplina de los equipos del listado...</p>
      </div>
    `;
    return;
  }

  const equiposIds = new Set();
  partidos.forEach((p) => {
    const localId = Number.parseInt(p?.equipo_local_id, 10);
    const visitaId = Number.parseInt(p?.equipo_visitante_id, 10);
    if (Number.isFinite(localId) && localId > 0) equiposIds.add(localId);
    if (Number.isFinite(visitaId) && visitaId > 0) equiposIds.add(visitaId);
  });

  let conDeuda = 0;
  let conSuspendidos = 0;
  let enSeguimiento = 0;
  let saldoTotal = 0;

  equiposIds.forEach((equipoId) => {
    const alerta = obtenerAlertaOperativaPartidos(equipoId);
    if (!alerta) return;
    const saldo = Number(alerta.saldo || 0);
    const suspendidos = Number(alerta.suspendidos || 0);
    const amarillas = Number(alerta.alerta_amarillas || 0);
    if (saldo > 0) {
      conDeuda += 1;
      saldoTotal += saldo;
    }
    if (suspendidos > 0) conSuspendidos += 1;
    if (amarillas > 0) enSeguimiento += 1;
  });

  cont.style.display = "block";
  cont.innerHTML = `
    <h3>Alertas Operativas de los Partidos Mostrados</h3>
    <div class="alertas-operativas-grid">
      <div class="alerta-operativa-card ${conDeuda > 0 ? "alerta-operativa-card-deuda" : ""}">
        <span class="alerta-operativa-label">Equipos con deuda</span>
        <strong>${conDeuda}</strong>
      </div>
      <div class="alerta-operativa-card ${saldoTotal > 0 ? "alerta-operativa-card-deuda" : ""}">
        <span class="alerta-operativa-label">Saldo pendiente total</span>
        <strong>${formatoMonedaPartidos(saldoTotal)}</strong>
      </div>
      <div class="alerta-operativa-card">
        <span class="alerta-operativa-label">Equipos con suspendidos</span>
        <strong>${conSuspendidos}</strong>
      </div>
      <div class="alerta-operativa-card">
        <span class="alerta-operativa-label">Equipos en seguimiento TA</span>
        <strong>${enSeguimiento}</strong>
      </div>
    </div>
  `;
}

function actualizarBotonesVistaPartidos() {
  const btnCards = document.getElementById("btn-vista-partidos-cards");
  const btnTable = document.getElementById("btn-vista-partidos-table");
  if (btnCards) btnCards.classList.toggle("active", vistaPartidos === "cards");
  if (btnTable) btnTable.classList.toggle("active", vistaPartidos === "table");
}

function cambiarVistaPartidos(vista = "cards") {
  vistaPartidos = vista === "table" ? "table" : "cards";
  localStorage.setItem("sgd_vista_partidos", vistaPartidos);
  actualizarBotonesVistaPartidos();
  if (metodoCompetenciaActivo === "eliminatoria") {
    aplicarRenderEliminatorias();
  } else {
    aplicarRenderPartidos();
  }
}

function normalizarMetodoCompetencia(value) {
  const raw = String(value || "grupos").toLowerCase();
  if (["grupos", "liga", "eliminatoria", "mixto"].includes(raw)) return raw;
  return "grupos";
}

function obtenerEventoSeleccionadoObj() {
  return eventosCache.find((e) => Number(e.id) === Number(eventoSeleccionado)) || null;
}

function actualizarUIPorMetodoCompetencia() {
  const titulo = document.querySelector(".config-card h4");
  const opciones = document.querySelector(".fixture-generation-options");
  const btn = document.querySelector(".fixture-generation-actions .btn");
  const selectGrupo = document.getElementById("select-grupo");
  const selectJornada = document.getElementById("select-jornada");
  const inputFecha = document.getElementById("input-fecha");

  if (metodoCompetenciaActivo === "eliminatoria") {
    grupoSeleccionado = null;
    jornadaSeleccionada = null;
    fechaSeleccionada = null;
    if (titulo) titulo.textContent = "Generación de Eliminatoria";
    if (opciones) opciones.style.display = "none";
    if (btn) btn.innerHTML = '<i class="fas fa-sitemap"></i> Generar Eliminatoria (categoría)';
    if (selectGrupo) {
      selectGrupo.value = "";
      selectGrupo.disabled = true;
    }
    if (selectJornada) {
      selectJornada.value = "";
      selectJornada.disabled = true;
    }
    if (inputFecha) {
      inputFecha.value = "";
      inputFecha.disabled = true;
    }
    return;
  }

  if (metodoCompetenciaActivo === "mixto") {
    if (titulo) titulo.textContent = "Generación de Fixture (Fase de Grupos)";
  } else if (metodoCompetenciaActivo === "liga") {
    grupoSeleccionado = null;
    if (titulo) titulo.textContent = "Generación de Fixture (Liga)";
    if (selectGrupo) {
      selectGrupo.value = "";
      selectGrupo.disabled = true;
    }
  } else {
    if (titulo) titulo.textContent = "Generación de Fixture";
  }

  if (opciones) opciones.style.display = "";
  if (btn) btn.innerHTML = '<i class="fas fa-calendar-plus"></i> Generar Fixture (categoría)';
  if (selectGrupo && metodoCompetenciaActivo !== "liga") selectGrupo.disabled = false;
  if (selectJornada) selectJornada.disabled = false;
  if (inputFecha) inputFecha.disabled = false;
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("partidos.html")) return;
  actualizarBotonesVistaPartidos();
  inicializarControlesModoFixture();

  const selectJornada = document.getElementById("select-jornada");
  if (selectJornada) {
    selectJornada.addEventListener("change", () => {
      jornadaSeleccionada = selectJornada.value || null;
      if (metodoCompetenciaActivo === "eliminatoria") aplicarRenderEliminatorias();
      else aplicarRenderPartidos();
      actualizarCabeceraFixture();
    });
  }

  const inputFecha = document.getElementById("input-fecha");
  if (inputFecha) {
    inputFecha.addEventListener("change", () => {
      fechaSeleccionada = inputFecha.value || null;
      if (metodoCompetenciaActivo === "eliminatoria") aplicarRenderEliminatorias();
      else aplicarRenderPartidos();
      actualizarCabeceraFixture();
    });
  }

  await cargarCampeonatos();
  await aplicarEventoInicialDesdeURL();
  actualizarUIPorMetodoCompetencia();
  actualizarCabeceraFixture();
  actualizarTabsVistaFixture();
  actualizarPestanasPartidos("tab-filtrar");
  limpiarReporteSancionesPartidos();
  renderResumenAlertasOperativasPartidos();
});

function limpiarFiltrosPartidosPorCambioContexto() {
  eventoSeleccionado = null;
  grupoSeleccionado = null;
  jornadaSeleccionada = null;
  fechaSeleccionada = null;
  eliminatoriasActuales = [];
  metodoCompetenciaActivo = "grupos";
  alertasOperativasPartidos = new Map();
  cargandoAlertasOperativasPartidos = false;
  tokenAlertasOperativasPartidos += 1;
  limpiarReporteSancionesPartidos();
  renderResumenAlertasOperativasPartidos();
  limpiarJornadas();
  const inputFecha = document.getElementById("input-fecha");
  if (inputFecha) inputFecha.value = "";
}

function limpiarSelectEventos() {
  const select = document.getElementById("select-evento");
  if (!select) return;
  select.innerHTML = '<option value="">- Selecciona una categoría -</option>';
  select.disabled = true;
}

async function cargarCampeonatos() {
  const selectCamp = document.getElementById("select-campeonato");
  if (!selectCamp) {
    await cargarEventos();
    return;
  }

  selectCamp.innerHTML = '<option value="">- Selecciona un campeonato -</option>';
  try {
    const data = await ApiClient.get("/campeonatos");
    const lista = data?.campeonatos || data || [];

    lista.forEach((c) => {
      selectCamp.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });

    const routeContext = window.RouteContext?.read?.("partidos.html", ["campeonato", "evento"]) || {};
    const campURL = Number.parseInt(routeContext.campeonato || "", 10);
    const campCache = Number.parseInt(localStorage.getItem("sgd_partidos_camp") || "", 10);
    const idsDisponibles = new Set(lista.map((c) => Number(c.id)));

    let inicial = null;
    if (Number.isFinite(campURL) && idsDisponibles.has(campURL)) inicial = campURL;
    else if (Number.isFinite(campCache) && idsDisponibles.has(campCache)) inicial = campCache;
    else if (lista.length) {
      const ultimo = [...lista].sort((a, b) => Number(b.id) - Number(a.id))[0];
      inicial = Number(ultimo?.id) || null;
    }

    if (inicial) {
      selectCamp.value = String(inicial);
      campeonatoSeleccionado = inicial;
      localStorage.setItem("sgd_partidos_camp", String(inicial));
      window.RouteContext?.save?.("partidos.html", {
        campeonato: campeonatoSeleccionado,
        evento: eventoSeleccionado,
      });
      await cargarEventos(campeonatoSeleccionado);
    } else {
      limpiarSelectEventos();
    }

    selectCamp.onchange = async () => {
      campeonatoSeleccionado = selectCamp.value ? Number(selectCamp.value) : null;
      if (campeonatoSeleccionado) {
        localStorage.setItem("sgd_partidos_camp", String(campeonatoSeleccionado));
      } else {
        localStorage.removeItem("sgd_partidos_camp");
      }
      window.RouteContext?.save?.("partidos.html", {
        campeonato: campeonatoSeleccionado,
        evento: null,
      });

      limpiarFiltrosPartidosPorCambioContexto();
      await cargarGruposPorEvento(null);
      await cargarContextoFixture(null);
      limpiarPartidosUI();
      limpiarReporteSancionesPartidos();
      actualizarCabeceraFixture();
      actualizarUIPorMetodoCompetencia();

      if (!campeonatoSeleccionado) {
        limpiarSelectEventos();
        return;
      }

      await cargarEventos(campeonatoSeleccionado);
    };
  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error cargando campeonatos", "error");
    limpiarSelectEventos();
  }
}

async function cargarEventos(campeonatoId = campeonatoSeleccionado) {
  try {
    const select = document.getElementById("select-evento");
    if (!select) return;

    select.innerHTML = '<option value="">- Selecciona una categoría -</option>';

    if (!campeonatoId) {
      eventosCache = [];
      select.disabled = true;
      return;
    }

    const resp = await ApiClient.get(`/eventos/campeonato/${campeonatoId}`);
    const lista = resp.eventos || resp || [];
    eventosCache = lista;

    select.disabled = false;

    lista.forEach((e) => {
      const nombre = String(e?.nombre || `Categoría ${e?.id || ""}`).trim();
      select.innerHTML += `<option value="${e.id}">${escapeHtml(nombre)}</option>`;
    });

    select.onchange = async () => {
      eventoSeleccionado = select.value ? Number(select.value) : null;
      window.RouteContext?.save?.("partidos.html", {
        campeonato: campeonatoSeleccionado,
        evento: eventoSeleccionado,
      });
      const evento = obtenerEventoSeleccionadoObj();
      metodoCompetenciaActivo = normalizarMetodoCompetencia(evento?.metodo_competencia);
      actualizarUIPorMetodoCompetencia();
      grupoSeleccionado = null;
      jornadaSeleccionada = null;
      fechaSeleccionada = null;
      eliminatoriasActuales = [];
      const inputFecha = document.getElementById("input-fecha");
      if (inputFecha) inputFecha.value = "";
      limpiarJornadas();
      await cargarGruposPorEvento(eventoSeleccionado);
      await cargarContextoFixture(eventoSeleccionado);
      limpiarPartidosUI();
      limpiarReporteSancionesPartidos();
      actualizarCabeceraFixture();
    };
  } catch (error) {
    mostrarNotificacion("Error cargando categorías", "error");
    console.error(error);
  }
}

async function cargarGruposPorEvento(eventoId) {
  const select = document.getElementById("select-grupo");
  select.innerHTML = '<option value="">- Todos -</option>';
  grupoSeleccionado = null;

  if (!eventoId) return;

  try {
    const resp = await ApiClient.get(`/grupos/evento/${eventoId}`);
    const grupos = resp.grupos || resp || [];

    grupos.forEach((g) => {
      const nombreRaw = String(g?.nombre_grupo || g?.nombre || "").trim();
      const letra = String(g?.letra_grupo || g?.letra || "").trim();
      const nombre = nombreRaw || (letra ? `Grupo ${letra}` : "Grupo");
      select.innerHTML += `<option value="${g.id}">${escapeHtml(nombre)}</option>`;
    });

    select.onchange = () => {
      grupoSeleccionado = select.value ? Number(select.value) : null;
      cargarPartidos();
      actualizarCabeceraFixture();
    };

    if (metodoCompetenciaActivo === "liga") {
      select.value = "";
      select.disabled = true;
    } else {
      select.value = "";
      select.disabled = false;
    }
  } catch (error) {
    mostrarNotificacion("Error cargando grupos", "error");
    console.error(error);
  }
}

async function cargarContextoFixture(eventoId) {
  if (!eventoId) {
    fixtureContexto = {
      campeonatoId: null,
      campeonatoNombre: "",
      organizador: "",
      tipoFutbol: "",
      fechaInicio: "",
      fechaFin: "",
      eventoNombre: "",
      logoUrl: null,
      auspiciantes: [],
    };
    return;
  }

  try {
    let evento = eventosCache.find((e) => Number(e.id) === Number(eventoId)) || null;

    if (!evento || !evento.campeonato_id) {
      const respEvento = await ApiClient.get(`/eventos/${eventoId}`);
      evento = respEvento.evento || respEvento || null;
    }

    const campeonatoId = Number.parseInt(evento?.campeonato_id, 10);
    const eventoNombre = evento?.nombre || "Categoría";

    if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
      fixtureContexto.eventoNombre = eventoNombre;
      fixtureContexto.campeonatoNombre = "FIXTURE";
      fixtureContexto.organizador = "No registrado";
      fixtureContexto.logoUrl = null;
      fixtureContexto.auspiciantes = [];
      renderAuspiciantesFixture([]);
      return;
    }

    const respCamp = await ApiClient.get(`/campeonatos/${campeonatoId}`);
    const camp = respCamp.campeonato || respCamp || {};

    fixtureContexto = {
      campeonatoId,
      campeonatoNombre: camp.nombre || "Campeonato",
      organizador: camp.organizador || "No registrado",
      tipoFutbol: (camp.tipo_futbol || "").replaceAll("_", " ").toUpperCase(),
      fechaInicio: formatearFecha(camp.fecha_inicio),
      fechaFin: formatearFecha(camp.fecha_fin),
      eventoNombre,
      logoUrl: normalizarLogoUrl(camp.logo_url || null),
      auspiciantes: await cargarAuspiciantesFixture(campeonatoId),
    };
    renderAuspiciantesFixture(fixtureContexto.auspiciantes);
  } catch (error) {
    console.warn("No se pudo cargar contexto del fixture:", error);
    fixtureContexto.auspiciantes = [];
    renderAuspiciantesFixture([]);
  }
}

async function cargarPartidos() {
  const cont = document.getElementById("lista-partidos");
  cont.innerHTML = "<p>Cargando partidos...</p>";
  alertasOperativasPartidos = new Map();
  cargandoAlertasOperativasPartidos = false;
  renderResumenAlertasOperativasPartidos();

  if (!eventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría", "warning");
    limpiarPartidosUI();
    return;
  }

  try {
    if (metodoCompetenciaActivo === "eliminatoria") {
      const data = await ApiClient.get(`/eliminatorias/evento/${eventoSeleccionado}`);
      const cruces = Array.isArray(data?.partidos) ? data.partidos : [];
      eliminatoriasActuales = cruces;
      partidosActuales = [];
      alertasOperativasPartidos = new Map();
      limpiarJornadas();
      aplicarRenderEliminatorias();
      renderFixtureTemplate([]);
      renderResumenAlertasOperativasPartidos();
      return;
    }

    const url = metodoCompetenciaActivo === "liga" || !grupoSeleccionado
      ? `/partidos/evento/${eventoSeleccionado}`
      : `/partidos/grupo/${grupoSeleccionado}`;

    const data = await ApiClient.get(url);

    let partidos = [];
    if (Array.isArray(data)) partidos = data;
    else if (data.partidos) partidos = data.partidos;

    partidosActuales = partidos;
    poblarJornadasDesdePartidos(partidosActuales);
    aplicarRenderPartidos();
    actualizarCabeceraFixture();
    await cargarAlertasOperativasPartidos(partidosActuales);
  } catch (error) {
    mostrarNotificacion("Error cargando partidos", "error");
    console.error(error);
    limpiarPartidosUI();
  }
}

async function aplicarEventoInicialDesdeURL() {
  const routeContext = window.RouteContext?.read?.("partidos.html", ["campeonato", "evento"]) || {};
  const queryCamp = routeContext.campeonato;
  const campId = Number.parseInt(queryCamp || "", 10);
  if (Number.isFinite(campId)) {
    const selectCamp = document.getElementById("select-campeonato");
    if (selectCamp && [...selectCamp.options].some((x) => Number(x.value) === campId)) {
      selectCamp.value = String(campId);
      campeonatoSeleccionado = campId;
      localStorage.setItem("sgd_partidos_camp", String(campId));
      await cargarEventos(campeonatoSeleccionado);
    }
  }

  const queryEvento = routeContext.evento;
  const id = Number.parseInt(queryEvento || "", 10);
  if (!Number.isFinite(id)) return;

  const select = document.getElementById("select-evento");
  if (!select) return;
  if (![...select.options].some((x) => Number(x.value) === id)) return;

  select.value = String(id);
  await select.onchange?.();
}

async function cargarAlertasOperativasPartidos(partidos = partidosActuales) {
  const lista = Array.isArray(partidos) ? partidos : [];
  const tokenActual = ++tokenAlertasOperativasPartidos;
  alertasOperativasPartidos = new Map();

  if (!eventoSeleccionado || !lista.length || metodoCompetenciaActivo === "eliminatoria") {
    cargandoAlertasOperativasPartidos = false;
    renderResumenAlertasOperativasPartidos();
    aplicarRenderPartidos();
    return;
  }

  cargandoAlertasOperativasPartidos = true;
  renderResumenAlertasOperativasPartidos();
  aplicarRenderPartidos();

  const equiposMapa = new Map();
  lista.forEach((p) => {
    const localId = Number.parseInt(p?.equipo_local_id, 10);
    const visitaId = Number.parseInt(p?.equipo_visitante_id, 10);
    if (Number.isFinite(localId) && localId > 0) {
      equiposMapa.set(localId, p?.equipo_local_nombre || `Equipo ${localId}`);
    }
    if (Number.isFinite(visitaId) && visitaId > 0) {
      equiposMapa.set(visitaId, p?.equipo_visitante_nombre || `Equipo ${visitaId}`);
    }
  });

  try {
    const paramsMorosidad = { campeonato_id: campeonatoSeleccionado || fixtureContexto.campeonatoId || "" };
    if (eventoSeleccionado) paramsMorosidad.evento_id = eventoSeleccionado;

    const morosidadResp = await window.FinanzasAPI.morosidad(paramsMorosidad);
    const morosidad = Array.isArray(morosidadResp?.equipos) ? morosidadResp.equipos : [];
    const mapaMorosidad = new Map(
      morosidad.map((item) => [Number(item.equipo_id), item])
    );

    if (tokenActual !== tokenAlertasOperativasPartidos) return;

    equiposMapa.forEach((_, equipoId) => {
      const item = mapaMorosidad.get(Number(equipoId));
      alertasOperativasPartidos.set(Number(equipoId), {
        saldo: Number(item?.saldo || 0),
        saldo_vencido: Number(item?.saldo_vencido || 0),
        suspendidos: 0,
        alerta_amarillas: 0,
      });
    });

    const resultados = await Promise.allSettled(
      Array.from(equiposMapa.keys()).map(async (equipoId) => {
        const data = await ApiClient.get(`/jugadores/equipo/${equipoId}?evento_id=${eventoSeleccionado}`);
        const jugadores = Array.isArray(data) ? data : data?.jugadores || data?.data || [];
        return {
          equipoId: Number(equipoId),
          resumen: resumirDisciplinaEquipoPartidos(jugadores),
        };
      })
    );

    if (tokenActual !== tokenAlertasOperativasPartidos) return;

    resultados.forEach((resultado) => {
      if (resultado.status !== "fulfilled") return;
      const equipoId = Number(resultado.value.equipoId);
      const base = alertasOperativasPartidos.get(equipoId) || {
        saldo: 0,
        saldo_vencido: 0,
        suspendidos: 0,
        alerta_amarillas: 0,
      };
      alertasOperativasPartidos.set(equipoId, {
        ...base,
        suspendidos: Number(resultado.value.resumen?.suspendidos || 0),
        alerta_amarillas: Number(resultado.value.resumen?.alerta_amarillas || 0),
      });
    });
  } catch (error) {
    console.warn("No se pudieron cargar alertas operativas de partidos:", error);
  } finally {
    if (tokenActual !== tokenAlertasOperativasPartidos) return;
    cargandoAlertasOperativasPartidos = false;
    renderResumenAlertasOperativasPartidos();
    aplicarRenderPartidos();
  }
}

function aplicarRenderEliminatorias() {
  const cont = document.getElementById("lista-partidos");
  if (!cont) return;

  if (!eliminatoriasActuales.length) {
    cont.classList.remove("list-mode-table");
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-sitemap"></i>
        <p>No hay cruces eliminatorios generados para esta categoría.</p>
      </div>`;
    return;
  }

  if (vistaPartidos === "table") {
    cont.classList.add("list-mode-table");
    cont.innerHTML = renderTablaEliminatoria(eliminatoriasActuales);
    return;
  }

  cont.classList.remove("list-mode-table");
  cont.innerHTML = eliminatoriasActuales.map((item) => renderCruceEliminatoriaCard(item)).join("");
}

function renderCruceEliminatoriaCard(item) {
  const local = item.equipo_local_nombre || "Por definir";
  const visita = item.equipo_visitante_nombre || "Por definir";
  const rl = Number.isFinite(Number(item.resultado_local)) ? item.resultado_local : "-";
  const rv = Number.isFinite(Number(item.resultado_visitante)) ? item.resultado_visitante : "-";
  const ganador = item.ganador_nombre || "Pendiente";

  return `
    <div class="campeonato-card">
      <div class="campeonato-header">
        <h3>${escapeHtml(String(item.ronda || "Ronda").toUpperCase())} - Partido ${escapeHtml(item.partido_numero || "-")}</h3>
      </div>
      <div class="campeonato-info">
        <p><strong>Cruce:</strong> ${escapeHtml(local)} vs ${escapeHtml(visita)}</p>
        <p><strong>Marcador:</strong> ${escapeHtml(rl)} - ${escapeHtml(rv)}</p>
        <p><strong>Ganador:</strong> ${escapeHtml(ganador)}</p>
      </div>
      <div class="campeonato-actions">
        <button class="btn btn-warning" onclick="editarResultadoEliminatoria(${item.id})">
          <i class="fas fa-edit"></i> Registrar resultado
        </button>
      </div>
    </div>
  `;
}

function renderTablaEliminatoria(cruces) {
  const filas = cruces
    .map((item) => {
      const local = escapeHtml(item.equipo_local_nombre || "Por definir");
      const visita = escapeHtml(item.equipo_visitante_nombre || "Por definir");
      const rl = Number.isFinite(Number(item.resultado_local)) ? item.resultado_local : "-";
      const rv = Number.isFinite(Number(item.resultado_visitante)) ? item.resultado_visitante : "-";
      const ganador = escapeHtml(item.ganador_nombre || "Pendiente");
      return `
        <tr>
          <td>${escapeHtml(String(item.ronda || "-").toUpperCase())}</td>
          <td>${escapeHtml(item.partido_numero || "-")}</td>
          <td>${local}</td>
          <td>${visita}</td>
          <td>${escapeHtml(rl)} - ${escapeHtml(rv)}</td>
          <td>${ganador}</td>
          <td class="list-table-actions">
            <button class="btn btn-warning" onclick="editarResultadoEliminatoria(${item.id})">
              <i class="fas fa-edit"></i> Registrar resultado
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
            <th>Ronda</th>
            <th>Partido</th>
            <th>Local</th>
            <th>Visitante</th>
            <th>Marcador</th>
            <th>Ganador</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
}

function poblarJornadasDesdePartidos(partidos) {
  const select = document.getElementById("select-jornada");
  if (!select) return;

  const prev = jornadaSeleccionada;
  const jornadas = Array.from(
    new Set(partidos.map((p) => p.jornada).filter((j) => Number.isFinite(Number(j))))
  )
    .map((j) => Number(j))
    .sort((a, b) => a - b);

  select.innerHTML = '<option value="">- Todas -</option>';
  jornadas.forEach((j) => {
    select.innerHTML += `<option value="${j}">Jornada ${j}</option>`;
  });

  if (prev && jornadas.includes(Number(prev))) {
    select.value = String(prev);
    jornadaSeleccionada = String(prev);
  } else {
    jornadaSeleccionada = null;
  }
}

function limpiarJornadas() {
  const select = document.getElementById("select-jornada");
  if (!select) return;
  select.innerHTML = '<option value="">- Todas -</option>';
}

function getPartidosFiltrados() {
  let partidos = [...partidosActuales];

  if (jornadaSeleccionada) {
    partidos = partidos.filter(
      (p) => String(p.jornada || "") === String(jornadaSeleccionada)
    );
  }
  if (fechaSeleccionada) {
    partidos = partidos.filter(
      (p) => normalizarFechaISO(p.fecha_partido) === String(fechaSeleccionada)
    );
  }

  return partidos;
}

function aplicarRenderPartidos() {
  const cont = document.getElementById("lista-partidos");
  const partidos = getPartidosFiltrados();
  renderResumenAlertasOperativasPartidos();

  if (!partidos.length) {
    cont.classList.remove("list-mode-table");
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-futbol"></i>
        <p>No hay partidos registrados para el filtro actual.</p>
      </div>`;
    renderFixtureTemplate(partidos);
    return;
  }

  if (vistaPartidos === "table") {
    cont.classList.add("list-mode-table");
    cont.innerHTML = renderTablaPartidos(partidos);
  } else {
    cont.classList.remove("list-mode-table");
    // Agrupar por jornada y mostrar byes si los hay
    const byesPorJornada = calcularByesPorJornada(partidosActuales);
    const jornadasGrupo = agruparPartidosPorJornada(partidos);
    if (jornadasGrupo.length > 1 || byesPorJornada.size > 0) {
      cont.innerHTML = jornadasGrupo.map(({ jornada, items }) => {
        const byes = byesPorJornada.get(jornada) || [];
        const byeHtml = byes.length
          ? `<div class="fixture-bye-notice"><i class="fas fa-moon"></i> <strong>Descansa:</strong> ${byes.map(e => escapeHtml(e.nombre)).join(", ")}</div>`
          : "";
        return `<div class="fixture-jornada-bloque">
          <div class="fixture-jornada-titulo">Jornada ${jornada}${byeHtml}</div>
          <div class="campeonato-grid">${items.map((p) => renderPartidoCard(p)).join("")}</div>
        </div>`;
      }).join("");
    } else {
      cont.innerHTML = partidos.map((p) => renderPartidoCard(p)).join("");
    }
  }

  renderFixtureTemplate(partidos);
}

function cambiarVistaFixture(vista) {
  if (!["todos", "grupo", "jornada"].includes(vista)) return;
  vistaFixture = vista;
  actualizarTabsVistaFixture();
  renderFixtureTemplate(getPartidosFiltrados());
}

async function cambiarPestanaPartidos(tabId) {
  actualizarPestanasPartidos(tabId);
  if (tabId === "tab-sanciones") {
    try {
      await renderReporteSancionesPartidos(true);
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo generar el reporte disciplinario", "error");
    }
  }
}

function actualizarPestanasPartidos(tabId) {
  const objetivo = tabId || "tab-filtrar";

  document.querySelectorAll(".partidos-main-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-tab-target") === objetivo);
  });

  document.querySelectorAll(".partidos-tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === objetivo);
  });
}

async function obtenerDatosSancionesCategoriaPartidos() {
  const eventoActual = Number.parseInt(eventoSeleccionado, 10);
  if (!Number.isFinite(eventoActual) || eventoActual <= 0) {
    throw new Error("Selecciona una categoría para generar el reporte disciplinario");
  }

  const respEquipos = await ApiClient.get(`/eventos/${eventoActual}/equipos`);
  const equipos = Array.isArray(respEquipos) ? respEquipos : respEquipos?.equipos || [];
  if (!equipos.length) return [];

  const resultados = await Promise.allSettled(
    equipos.map(async (equipo) => {
      const data = await ApiClient.get(`/jugadores/equipo/${equipo.id}?evento_id=${eventoActual}`);
      const jugadores = Array.isArray(data) ? data : data?.jugadores || data?.data || [];
      return jugadores
        .map((jugador) => ({
          ...jugador,
          equipo_id: equipo.id,
          equipo_nombre: equipo.nombre || `Equipo ${equipo.id}`,
        }))
        .filter((jugador) => {
          const suspension = jugador?.suspension || {};
          return suspension?.suspendido || Number(suspension?.amarillas_acumuladas || 0) > 0;
        });
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

async function renderReporteSancionesPartidos(forceReload = false) {
  const zona = document.getElementById("partidos-sanciones-export");
  if (!zona) return;

  if (!campeonatoSeleccionado || !eventoSeleccionado) {
    limpiarReporteSancionesPartidos(
      "Selecciona campeonato y categoría para generar el reporte disciplinario operativo."
    );
    return;
  }

  if (!forceReload && Array.isArray(reporteSancionesPartidosCache)) {
    // reuse cache
  } else {
    zona.innerHTML = '<p class="empty-state">Cargando reporte disciplinario operativo...</p>';
    try {
      reporteSancionesPartidosCache = await obtenerDatosSancionesCategoriaPartidos();
    } catch (error) {
      console.error(error);
      zona.innerHTML = '<p class="empty-state">No se pudo cargar el reporte disciplinario operativo.</p>';
      mostrarNotificacion(error.message || "No se pudo generar el reporte disciplinario", "error");
      return;
    }
  }

  const registros = Array.isArray(reporteSancionesPartidosCache) ? reporteSancionesPartidosCache : [];
  if (!registros.length) {
    zona.innerHTML =
      '<p class="empty-state">No existen jugadores suspendidos ni con amarillas acumuladas en esta categoría.</p>';
    return;
  }

  const resumen = obtenerResumenDisciplinaPartidos(registros);
  const filas = [...registros]
    .sort((a, b) => {
      const aSusp = a?.suspension?.suspendido ? 1 : 0;
      const bSusp = b?.suspension?.suspendido ? 1 : 0;
      if (aSusp !== bSusp) return bSusp - aSusp;
      const equipoCmp = String(a?.equipo_nombre || "").localeCompare(String(b?.equipo_nombre || ""), "es", {
        sensitivity: "base",
      });
      if (equipoCmp !== 0) return equipoCmp;
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
      const motivo = suspension?.motivo || "Seguimiento disciplinario";
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
          <td>${renderEstadoDisciplinarioPartidos(jugador)}</td>
          <td>${amarillas}</td>
          <td>${pendientes}</td>
          <td title="${escapeHtml(motivo)}">${escapeHtml(motivo)}</td>
        </tr>
      `;
    })
    .join("");

  const fechaEmision = new Date().toLocaleDateString("es-EC");
  const logoCampeonato = fixtureContexto.logoUrl;
  zona.innerHTML = `
    <div class="nomina-sheet sanciones-sheet">
      <div class="nomina-head">
        <div class="nomina-head-logo">
          ${logoCampeonato ? `<img src="${logoCampeonato}" alt="Logo campeonato" />` : "<div class='logo-fallback'>LT&C</div>"}
        </div>
        <div class="nomina-head-main">
          <h3>Control Operativo de Sanciones</h3>
          <p><strong>Campeonato:</strong> ${escapeHtml(fixtureContexto.campeonatoNombre || "—")}</p>
          <p><strong>Organizador:</strong> ${escapeHtml(fixtureContexto.organizador || "—")}</p>
          <p><strong>Categoría:</strong> ${escapeHtml(obtenerNombreEventoPartidos())}</p>
        </div>
        <div class="nomina-head-meta">
          <p><strong>Fecha:</strong> ${escapeHtml(fechaEmision)}</p>
          <p><strong>Novedades:</strong> ${resumen.totalNovedades}</p>
        </div>
      </div>

      <div class="sanciones-resumen-grid">
        <div class="sanciones-resumen-card">
          <span class="sanciones-resumen-label">Suspendidos</span>
          <strong>${resumen.suspendidos}</strong>
        </div>
        <div class="sanciones-resumen-card">
          <span class="sanciones-resumen-label">Seguimiento TA</span>
          <strong>${resumen.alertaAmarillas}</strong>
        </div>
        <div class="sanciones-resumen-card">
          <span class="sanciones-resumen-label">Equipos con novedades</span>
          <strong>${resumen.equipos}</strong>
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

function imprimirReporteSancionesPartidos() {
  if (!campeonatoSeleccionado || !eventoSeleccionado) {
    mostrarNotificacion("Selecciona campeonato y categoría para imprimir el reporte disciplinario", "warning");
    return;
  }
  const zona = document.getElementById("partidos-sanciones-export");
  if (!zona || !zona.querySelector(".nomina-sheet")) {
    mostrarNotificacion("Genera primero el reporte disciplinario operativo", "warning");
    return;
  }
  imprimirNodoEnVentanaPartidos(zona, "Control Operativo de Sanciones");
}

async function exportarReporteSancionesPartidosPDF() {
  if (!campeonatoSeleccionado || !eventoSeleccionado) {
    mostrarNotificacion("Selecciona campeonato y categoría para exportar el reporte disciplinario", "warning");
    return;
  }
  const zona = document.getElementById("partidos-sanciones-export");
  if (!zona || !zona.querySelector(".nomina-sheet")) {
    mostrarNotificacion("Genera primero el reporte disciplinario operativo", "warning");
    return;
  }

  try {
    const slugCategoria = String(obtenerNombreEventoPartidos() || "categoria")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    await exportarNodoPDFPartidos(zona, `control_sanciones_${slugCategoria || "categoria"}.pdf`);
    mostrarNotificacion("Reporte disciplinario operativo exportado en PDF", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo exportar el reporte disciplinario", "error");
  }
}

function actualizarTabsVistaFixture() {
  const tabs = document.querySelectorAll("#fixture-view-tabs .fixture-view-btn");
  tabs.forEach((btn) => {
    const key = btn.getAttribute("data-fixture-view");
    btn.classList.toggle("active", key === vistaFixture);
  });
}

function obtenerEtiquetaCompetitivaPartido(p = {}) {
  if (p?.es_reclasificacion_playoff === true) {
    const grupo = p?.reclasificacion_grupo_letra
      ? `Grupo ${p.reclasificacion_grupo_letra}`
      : "Evento";
    const cupo = Number.parseInt(p?.reclasificacion_slot_posicion, 10);
    return {
      titulo: "Partido extra playoff",
      detalle: `${grupo}${Number.isFinite(cupo) && cupo > 0 ? ` • Cupo ${cupo}` : ""}`,
      badge: `<span class="badge-estado estado-borrador">Partido extra playoff</span>`,
    };
  }
  return { titulo: null, detalle: null, badge: "" };
}

function renderEstadoPartidoBadge(estado) {
  const cfg = {
    finalizado:          { css: "badge-partido-finalizado", texto: "Finalizado" },
    no_presentaron_ambos:{ css: "badge-partido-np",         texto: "No presentaron" },
    programado:          { css: "badge-partido-programado", texto: "Programado" },
    en_curso:            { css: "badge-partido-en-curso",   texto: "En curso" },
    suspendido:          { css: "badge-partido-suspendido", texto: "Suspendido" },
    aplazado:            { css: "badge-partido-aplazado",   texto: "Aplazado" },
    pendiente:           { css: "badge-partido-pendiente",  texto: "Pendiente" },
  }[estado] || { css: "badge-partido-pendiente", texto: "Pendiente" };
  return `<span class="badge-estado-partido ${cfg.css}">${cfg.texto}</span>`;
}

function renderPartidoCard(p) {
  const numero = obtenerNumeroPartidoVisible(p);
  const competitivo = obtenerEtiquetaCompetitivaPartido(p);
  return `
    <div class="campeonato-card">
      <div class="campeonato-header">
        <h3>${escapeHtml(p.equipo_local_nombre || "Equipo local")} vs ${escapeHtml(p.equipo_visitante_nombre || "Equipo visitante")}</h3>
        ${competitivo.badge}
      </div>

      <div class="campeonato-info">
        <p><strong>N° Partido:</strong> ${escapeHtml(numero || "-")}</p>
        <p><strong>Grupo:</strong> ${escapeHtml(p.letra_grupo ? `Grupo ${p.letra_grupo}` : "-")}</p>
        ${
          competitivo.titulo
            ? `<p><strong>${escapeHtml(competitivo.titulo)}:</strong> ${escapeHtml(competitivo.detalle || "-")}</p>`
            : ""
        }
        <p><strong>Jornada:</strong> ${escapeHtml(p.jornada || "-")}</p>
        <p><strong>Estado:</strong> ${renderEstadoPartidoBadge(p.estado)}</p>
        <p><strong>Fecha:</strong> ${escapeHtml(formatearFechaPartido(p.fecha_partido))}</p>
        <p><strong>Hora:</strong> ${escapeHtml((p.hora_partido || "--:--").toString().substring(0, 5))}</p>
        <p><strong>Cancha:</strong> ${escapeHtml(p.cancha || "Por definir")}</p>
        <div class="partido-alertas-bloque">
          ${renderBloqueAlertasPartido(p.equipo_local_id, p.equipo_local_nombre || "Equipo local", "local")}
          ${renderBloqueAlertasPartido(p.equipo_visitante_id, p.equipo_visitante_nombre || "Equipo visitante", "visitante")}
        </div>
      </div>

      <div class="campeonato-actions">
        <button class="btn btn-primary" onclick="abrirPlanillaPartido(${p.id})">
          <i class="fas fa-clipboard-list"></i> Planilla
        </button>
        <button class="btn btn-warning" onclick="editarPartido(${p.id})">
          <i class="fas fa-edit"></i> Editar
        </button>
        <button class="btn btn-secondary" onclick="abrirModalTransmision(${p.id})" title="Gestionar transmisión en vivo">
          <i class="fas fa-broadcast-tower"></i> Transmitir
        </button>
        <button class="btn btn-danger" onclick="eliminarPartido(${p.id})">
          <i class="fas fa-trash"></i> Eliminar
        </button>
      </div>
    </div>
  `;
}

function renderTablaPartidos(partidos) {
  const filas = partidos
    .map((p) => {
      const numero = obtenerNumeroPartidoVisible(p);
      const local = escapeHtml(p.equipo_local_nombre || "Local");
      const visita = escapeHtml(p.equipo_visitante_nombre || "Visitante");
      const grupo = escapeHtml(p.letra_grupo ? `Grupo ${p.letra_grupo}` : "-");
      const competitivo = obtenerEtiquetaCompetitivaPartido(p);
      const jornada = escapeHtml(p.jornada || "-");
      const fecha = escapeHtml(formatearFechaPartido(p.fecha_partido));
      const hora = escapeHtml((p.hora_partido || "--:--").toString().substring(0, 5));
      const cancha = escapeHtml(p.cancha || "Por definir");
      const alertas = `
        <div class="partido-alertas-tabla">
          ${renderBloqueAlertasPartido(p.equipo_local_id, p.equipo_local_nombre || "Equipo local", "local")}
          ${renderBloqueAlertasPartido(p.equipo_visitante_id, p.equipo_visitante_nombre || "Equipo visitante", "visitante")}
        </div>
      `;

      return `
        <tr>
          <td>${numero}</td>
          <td>
            <div>${local} vs ${visita}</div>
            ${competitivo.badge}
            ${
              competitivo.titulo
                ? `<div class="form-hint">${escapeHtml(competitivo.detalle || "")}</div>`
                : ""
            }
          </td>
          <td>${grupo}</td>
          <td>${jornada}</td>
          <td>${fecha}</td>
          <td>${hora}</td>
          <td>${cancha}</td>
          <td>${alertas}</td>
          <td class="list-table-actions">
            <button class="btn btn-primary" onclick="abrirPlanillaPartido(${p.id})">
              <i class="fas fa-clipboard-list"></i> Planilla
            </button>
            <button class="btn btn-warning" onclick="editarPartido(${p.id})">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn btn-secondary" onclick="abrirModalTransmision(${p.id})" title="Gestionar transmisión">
              <i class="fas fa-broadcast-tower"></i> Transmitir
            </button>
            <button class="btn btn-danger" onclick="eliminarPartido(${p.id})">
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
            <th>Partido</th>
            <th>Grupo</th>
            <th>Jornada</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Cancha</th>
            <th>Alertas</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
}

function abrirPlanillaPartido(partidoId) {
  if (window.RouteContext?.navigate) {
    window.RouteContext.navigate("planilla.html", {
      partido: Number(partidoId) || null,
      evento: Number(eventoSeleccionado) || null,
      campeonato: Number(campeonatoSeleccionado) || null,
    });
    return;
  }
  const params = new URLSearchParams();
  params.set("partido", String(partidoId));
  if (eventoSeleccionado) params.set("evento", String(eventoSeleccionado));
  window.location.href = `planilla.html?${params.toString()}`;
}

function agruparPartidosPorJornadaYGrupo(partidos) {
  const map = new Map();

  for (const p of partidos) {
    const j = Number(p.jornada) || 0;
    const g = p.letra_grupo || "-";
    if (!map.has(j)) map.set(j, new Map());
    const porGrupo = map.get(j);
    if (!porGrupo.has(g)) porGrupo.set(g, []);
    porGrupo.get(g).push(p);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([jornada, grupos]) => ({
      jornada,
      grupos: Array.from(grupos.entries())
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        .map(([grupo, items]) => ({ grupo, items })),
    }));
}

function agruparPartidosPorGrupoYJornada(partidos) {
  const map = new Map();

  for (const p of partidos) {
    const grupo = p.letra_grupo || "-";
    const jornada = Number(p.jornada) || 0;

    if (!map.has(grupo)) map.set(grupo, new Map());
    const porJornada = map.get(grupo);
    if (!porJornada.has(jornada)) porJornada.set(jornada, []);
    porJornada.get(jornada).push(p);
  }

  return Array.from(map.entries())
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([grupo, jornadas]) => ({
      grupo,
      jornadas: Array.from(jornadas.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([jornada, items]) => ({ jornada, items })),
    }));
}

function agruparPartidosPorJornada(partidos) {
  const map = new Map();

  for (const p of partidos) {
    const jornada = Number(p.jornada) || 0;
    if (!map.has(jornada)) map.set(jornada, []);
    map.get(jornada).push(p);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([jornada, items]) => ({ jornada, items }));
}

/**
 * Calcula qué equipos descansan (bye) en cada jornada.
 * Un equipo descansa si aparece en otras jornadas pero no en ésta.
 * @param {Array} todosPartidos - todos los partidos del evento (sin filtrar)
 * @returns {Map<number, Array<{id,nombre}>>} jornada -> equipos que descansan
 */
function calcularByesPorJornada(todosPartidos) {
  // Construir mapa: equipo_id -> nombre
  const equiposMap = new Map();
  for (const p of todosPartidos) {
    if (p.equipo_local_id)     equiposMap.set(p.equipo_local_id,     p.equipo_local_nombre || String(p.equipo_local_id));
    if (p.equipo_visitante_id) equiposMap.set(p.equipo_visitante_id, p.equipo_visitante_nombre || String(p.equipo_visitante_id));
  }
  const todosEquipos = new Set(equiposMap.keys());

  // Equipos por jornada
  const equiposPorJornada = new Map();
  for (const p of todosPartidos) {
    const j = Number(p.jornada) || 0;
    if (!equiposPorJornada.has(j)) equiposPorJornada.set(j, new Set());
    if (p.equipo_local_id)     equiposPorJornada.get(j).add(p.equipo_local_id);
    if (p.equipo_visitante_id) equiposPorJornada.get(j).add(p.equipo_visitante_id);
  }

  const byesPorJornada = new Map();
  for (const [jornada, enJornada] of equiposPorJornada.entries()) {
    const descansam = [];
    for (const eqId of todosEquipos) {
      if (!enJornada.has(eqId)) {
        descansam.push({ id: eqId, nombre: equiposMap.get(eqId) || String(eqId) });
      }
    }
    if (descansam.length) byesPorJornada.set(jornada, descansam);
  }
  return byesPorJornada;
}

function renderLineaPartido(p, mostrarGrupo = false) {
  const numero = obtenerNumeroPartidoVisible(p);
  const fecha = formatearFechaPartido(p.fecha_partido);
  const hora = (p.hora_partido || "--:--").toString().substring(0, 5);
  const cancha = p.cancha || "Cancha por definir";
  const grupo = p.letra_grupo ? `Grupo ${p.letra_grupo}` : "Sin grupo";
  const metaBase = `${fecha} • ${hora} • ${cancha}`;
  const metaNumero = numero ? `Partido #${numero} • ` : "";
  const meta = mostrarGrupo ? `${metaNumero}${grupo} • ${metaBase}` : `${metaNumero}${metaBase}`;

  return `
    <div class="fixture-match-row">
      <span>${p.equipo_local_nombre}</span>
      <strong>vs</strong>
      <span>${p.equipo_visitante_nombre}</span>
    </div>
    <div class="fixture-meta-row">${meta}</div>
  `;
}

function aplicarLayoutPorCantidadColumnas(cant) {
  const cont = document.getElementById("fixture-grupos");
  if (!cont) return;

  cont.classList.remove("cols-2", "cols-3", "cols-4");
  if (cant <= 2) cont.classList.add("cols-2");
  else if (cant === 3) cont.classList.add("cols-3");
  else if (cant === 4) cont.classList.add("cols-4");
  else cont.classList.add("cols-3");
}

function renderFixtureTemplate(partidos) {
  const cont = document.getElementById("fixture-grupos");
  if (!cont) return;

  if (!partidos.length) {
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-futbol"></i>
        <p>No hay partidos para generar plantilla.</p>
      </div>`;
    return;
  }

  let bloques = [];
  let html = "";

  if (vistaFixture === "grupo") {
    bloques = agruparPartidosPorGrupoYJornada(partidos);
    html = bloques
      .map(
        (b) => `
        <div class="poster-col fixture-poster-col">
          <div class="col-header">${b.grupo === "-" ? "SIN GRUPO" : `GRUPO ${b.grupo}`}</div>
          <div class="col-body">
            ${b.jornadas
              .map(
                (j) => `
                <div class="fixture-group-title">Jornada ${j.jornada || "-"}</div>
                ${j.items.map((p) => renderLineaPartido(p)).join("")}
              `
              )
              .join("")}
          </div>
        </div>
      `
      )
      .join("");
  } else if (vistaFixture === "jornada") {
    bloques = agruparPartidosPorJornada(partidos);
    const byesJ = calcularByesPorJornada(partidosActuales);
    html = bloques
      .map((b) => {
        const byes = byesJ.get(b.jornada) || [];
        const byeLinea = byes.length
          ? `<div class="fixture-bye-linea">&#9790; DESCANSA: ${byes.map(e => e.nombre).join(", ")}</div>`
          : "";
        return `
        <div class="poster-col fixture-poster-col">
          <div class="col-header">JORNADA ${b.jornada || "-"}</div>
          <div class="col-body">
            ${b.items.map((p) => renderLineaPartido(p, true)).join("")}
            ${byeLinea}
          </div>
        </div>
      `;
      })
      .join("");
  } else {
    bloques = agruparPartidosPorJornadaYGrupo(partidos);
    const byesT = calcularByesPorJornada(partidosActuales);
    html = bloques
      .map((b) => {
        const byes = byesT.get(b.jornada) || [];
        const byeLinea = byes.length
          ? `<div class="fixture-bye-linea">&#9790; DESCANSA: ${byes.map(e => e.nombre).join(", ")}</div>`
          : "";
        return `
        <div class="poster-col fixture-poster-col">
          <div class="col-header">JORNADA ${b.jornada || "-"}</div>
          <div class="col-body">
            ${b.grupos
              .map(
                (g) => `
                <div class="fixture-group-title">${g.grupo === "-" ? "Sin grupo" : `Grupo ${g.grupo}`}</div>
                ${g.items.map((p) => renderLineaPartido(p)).join("")}
              `
              )
              .join("")}
            ${byeLinea}
          </div>
        </div>
      `;
      })
      .join("");
  }

  aplicarLayoutPorCantidadColumnas(bloques.length);
  cont.innerHTML = html;
}

function actualizarCabeceraFixture() {
  const organizadorEl = document.getElementById("fixture-organizador");
  const tituloEl = document.getElementById("fixture-titulo");
  const detalleEl = document.getElementById("fixture-detalle");
  const filtrosEl = document.getElementById("fixture-filtros");
  const logoEl = document.getElementById("fixture-org-logo");

  if (!organizadorEl || !tituloEl || !detalleEl || !filtrosEl || !logoEl) return;

  organizadorEl.textContent = `ORGANIZA: ${fixtureContexto.organizador || "No registrado"}`;
  tituloEl.textContent = `${(fixtureContexto.campeonatoNombre || "FIXTURE").toUpperCase()} - FIXTURE`;

  const tipo = fixtureContexto.tipoFutbol || "";
  const rangoFechas = fixtureContexto.fechaInicio || fixtureContexto.fechaFin
    ? `${fixtureContexto.fechaInicio}${fixtureContexto.fechaFin ? " - " + fixtureContexto.fechaFin : ""}`
    : "";
  const categoria = fixtureContexto.eventoNombre
    ? `CATEGORIA: ${String(fixtureContexto.eventoNombre).toUpperCase()}`
    : "CATEGORIA: -";

  const detalle = [tipo, rangoFechas, categoria].filter(Boolean).join(" • ");
  detalleEl.textContent = detalle || "-";

  const grupoLabel = grupoSeleccionado
    ? `GRUPO: ${document.getElementById("select-grupo")?.selectedOptions?.[0]?.textContent || "seleccionado"}`
    : "GRUPO: TODOS";
  const jornadaLabel = jornadaSeleccionada ? `JORNADA: ${jornadaSeleccionada}` : "JORNADA: TODAS";
  const fechaLabel = fechaSeleccionada ? `FECHA: ${fechaSeleccionada}` : "FECHA: TODAS";
  const vistaLabel =
    vistaFixture === "grupo"
      ? "VISTA: POR GRUPO"
      : vistaFixture === "jornada"
        ? "VISTA: POR JORNADA"
        : "VISTA: TODOS";
  filtrosEl.textContent = `${grupoLabel} • ${jornadaLabel} • ${fechaLabel} • ${vistaLabel}`;

  if (fixtureContexto.logoUrl) {
    logoEl.src = fixtureContexto.logoUrl;
    logoEl.style.display = "block";
  } else {
    logoEl.removeAttribute("src");
    logoEl.style.display = "none";
  }

  renderAuspiciantesFixture(fixtureContexto.auspiciantes || []);
}

async function eliminarPartido(id) {
  const ok = await window.mostrarConfirmacion({
    titulo: "Eliminar partido",
    mensaje: "¿Seguro que quieres eliminar este partido?",
    tipo: "warning",
    textoConfirmar: "Eliminar",
    claseConfirmar: "btn-danger",
  });
  if (!ok) return;

  try {
    await ApiClient.delete(`/partidos/${id}`);
    mostrarNotificacion("Partido eliminado.", "success");
    cargarPartidos();
  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error al eliminar el partido.", "error");
  }
}

async function editarPartido(id) {
  try {
    const resp = await ApiClient.get(`/partidos/${id}`);
    const p = resp.partido || resp;

    if (!p) {
      mostrarNotificacion("No se pudo cargar el partido.", "error");
      return;
    }

    // Verificar si el usuario actual es administrador (puede editar equipos)
    const esAdmin = String(window.Auth?.getUser?.()?.rol || "").toLowerCase() === "administrador";

    const horaActual = (p.hora_partido || "00:00:00").toString().substring(0, 5);

    // Para admin: cargar equipos del evento para permitir cambio de equipos
    let opcionesEquipos = [];
    if (esAdmin && eventoSeleccionado) {
      try {
        const eqResp = await ApiClient.get(`/eventos/${eventoSeleccionado}/equipos`);
        const eqList = Array.isArray(eqResp) ? eqResp : (eqResp.equipos || eqResp.data || []);
        opcionesEquipos = eqList.map((eq) => ({ value: String(eq.id), label: eq.nombre || String(eq.id) }));
      } catch (_) { /* si falla, no mostramos los dropdowns */ }
    }

    const camposEquipos = esAdmin && opcionesEquipos.length >= 2 ? [
      {
        name: "equipo_local_id",
        label: "Equipo Local",
        type: "select",
        value: String(p.equipo_local_id || ""),
        options: opcionesEquipos,
        required: true,
        span: 2,
        validate: (v) => (!v ? "Selecciona el equipo local." : ""),
      },
      {
        name: "equipo_visitante_id",
        label: "Equipo Visitante",
        type: "select",
        value: String(p.equipo_visitante_id || ""),
        options: opcionesEquipos,
        required: true,
        span: 2,
        validate: (v, all) => {
          if (!v) return "Selecciona el equipo visitante.";
          if (v === all.equipo_local_id) return "El equipo visitante debe ser diferente al local.";
          return "";
        },
      },
    ] : [];

    const form = await window.mostrarFormularioModal({
      titulo: esAdmin ? "Editar partido (Administrador)" : "Editar partido",
      mensaje: esAdmin
        ? "Puedes cambiar equipos, programación y estado del partido."
        : "Actualiza la programación del partido.",
      tipo: "info",
      textoConfirmar: "Guardar cambios",
      ancho: "md",
      campos: [
        ...camposEquipos,
        {
          name: "numero_campeonato",
          label: "N° visible del partido",
          type: "number",
          value: p.numero_campeonato ? String(p.numero_campeonato) : "",
          min: 1,
          step: 1,
          placeholder: "Ej. 12",
          helpText: "Este es el número que verá el organizador en fixture, planilla y publicaciones. El ID interno no cambia.",
          validate: (value) => {
            const raw = String(value ?? "").trim();
            if (!raw) return "";
            const numero = Number.parseInt(raw, 10);
            if (!Number.isFinite(numero) || numero <= 0) {
              return "El número visible debe ser un entero mayor a 0.";
            }
            return "";
          },
        },
        {
          name: "fecha",
          label: "Fecha",
          type: "date",
          value: normalizarFechaISO(p.fecha_partido) || "",
        },
        {
          name: "hora",
          label: "Hora",
          type: "time",
          value: horaActual || "",
        },
        {
          name: "cancha",
          label: "Cancha",
          type: "text",
          value: p.cancha || "",
          placeholder: "Vacío para sin cancha",
          span: 2,
        },
        {
          name: "jornada",
          label: "Jornada",
          type: "number",
          value: String(p.jornada || 1),
          min: 1,
          step: 1,
          required: true,
          validate: (value) => {
            const n = Number.parseInt(value, 10);
            if (!Number.isFinite(n) || n <= 0) return "La jornada debe ser un entero mayor a 0.";
            return "";
          },
        },
        {
          name: "estado",
          label: "Estado",
          type: "select",
          value: p.estado || "pendiente",
          options: [
            { value: "pendiente",   label: "Pendiente" },
            { value: "programado",  label: "Programado" },
            { value: "suspendido",  label: "Suspendido" },
            { value: "aplazado",    label: "Aplazado" },
            { value: "en_curso",    label: "En curso" },
          ],
          span: 2,
        },
      ],
    });
    if (!form) return;

    const nuevaFecha = String(form.fecha || "").trim();
    const nuevaHora = String(form.hora || "").trim();
    const nuevaCancha = String(form.cancha || "").trim();
    const nuevaJornada = String(form.jornada || "").trim();
    const nuevoEstado = String(form.estado || "").trim();
    const nuevoNumeroVisible = String(form.numero_campeonato || "").trim();

    const payload = {
      numero_campeonato: nuevoNumeroVisible ? Number(nuevoNumeroVisible) : null,
      fecha_partido: nuevaFecha || null,
      hora_partido: nuevaHora
        ? nuevaHora.length === 5
          ? `${nuevaHora}:00`
          : nuevaHora
        : null,
      cancha: nuevaCancha || null,
      jornada: nuevaJornada ? Number(nuevaJornada) : p.jornada,
      estado: nuevoEstado || undefined,
    };

    // Solo admin puede cambiar equipos
    if (esAdmin && form.equipo_local_id) payload.equipo_local_id = Number(form.equipo_local_id);
    if (esAdmin && form.equipo_visitante_id) payload.equipo_visitante_id = Number(form.equipo_visitante_id);

    await ApiClient.put(`/partidos/${id}`, payload);

    mostrarNotificacion("Partido actualizado.", "success");
    cargarPartidos();
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error?.message || "Error al editar el partido.", "error");
  }
}

async function generarFixtureEvento() {
  if (!eventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría primero.", "warning");
    return;
  }

  const idaYVuelta = document.getElementById("chk-ida-vuelta")?.checked === true;
  const modoProgramacion = await validarModoProgramacionFixture();
  if (!modoProgramacion) return;
  const evento = obtenerEventoSeleccionadoObj();
  const esEliminatoria = metodoCompetenciaActivo === "eliminatoria";
  const cantidadEquiposObjetivo = Number.parseInt(evento?.eliminatoria_equipos, 10) || null;

  const mensaje = esEliminatoria
    ? "Se generará la llave eliminatoria de la categoría seleccionada. Si ya existe, se reemplazará. ¿Continuar?"
    : modoProgramacion.automatica
      ? "Se generará el fixture con programación automática. Los partidos que entren en el rango se programarán con fecha, hora y cancha; los que no alcancen quedarán sin programación para que puedas ajustarlos manualmente. Si ya existen partidos del evento, se reemplazarán. ¿Continuar?"
      : "Se generará el fixture en modo manual, dejando todos los partidos sin fecha, hora ni cancha. Si ya existen partidos del evento, se reemplazarán. ¿Continuar?";

  const ok = await window.mostrarConfirmacion({
    titulo: esEliminatoria ? "Generar llave eliminatoria" : "Generar fixture",
    mensaje,
    tipo: "warning",
    textoConfirmar: esEliminatoria ? "Generar llave" : "Generar fixture",
    claseConfirmar: "btn-primary",
  });
  if (!ok) {
    return;
  }

  try {
    const resp = await ApiClient.post(`/partidos/evento/${eventoSeleccionado}/generar-fixture`, {
      ida_y_vuelta: idaYVuelta,
      reemplazar: true,
      programacion_automatica: modoProgramacion.automatica,
      programacion_manual: modoProgramacion.manual,
      modo: "auto",
      cantidad_equipos: cantidadEquiposObjetivo,
    });

    mostrarNotificacion(
      esEliminatoria ? "Llave eliminatoria generada correctamente" : "Fixture generado correctamente",
      "success"
    );
    if (!esEliminatoria && resp?.capacidad_insuficiente) {
      await window.mostrarAlerta({
        titulo: "Fixture generado con programación parcial",
        mensaje:
          `Se programaron ${Number(resp.programados || 0)} partido(s) y ${Number(resp.sin_programar || 0)} quedaron sin fecha/hora/cancha para que puedas completarlos manualmente.` +
          (resp?.mensaje_capacidad ? `\n\n${resp.mensaje_capacidad}` : ""),
        tipo: "warning",
        textoBoton: "Entendido",
      });
    }
    await cargarPartidos();
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "Error al generar el fixture.", "error");
  }
}

async function editarResultadoEliminatoria(id) {
  const cruce = eliminatoriasActuales.find((x) => Number(x.id) === Number(id));
  if (!cruce) {
    mostrarNotificacion("Cruce no encontrado.", "warning");
    return;
  }

  const rlActual = Number.isFinite(Number(cruce.resultado_local)) ? Number(cruce.resultado_local) : 0;
  const rvActual = Number.isFinite(Number(cruce.resultado_visitante)) ? Number(cruce.resultado_visitante) : 0;

  const form = await window.mostrarFormularioModal({
    titulo: "Resultado eliminatoria",
    mensaje: "Registra el marcador final del cruce.",
    tipo: "info",
    textoConfirmar: "Guardar resultado",
    ancho: "sm",
    campos: [
      {
        name: "resultado_local",
        label: cruce.equipo_local_nombre || "Equipo local",
        type: "number",
        value: String(rlActual),
        min: 0,
        step: 1,
        required: true,
      },
      {
        name: "resultado_visitante",
        label: cruce.equipo_visitante_nombre || "Equipo visitante",
        type: "number",
        value: String(rvActual),
        min: 0,
        step: 1,
        required: true,
      },
    ],
  });
  if (!form) return;

  const rlStr = String(form.resultado_local || "").trim();
  const rvStr = String(form.resultado_visitante || "").trim();

  const rl = Number.parseInt(rlStr, 10);
  const rv = Number.parseInt(rvStr, 10);
  if (!Number.isFinite(rl) || !Number.isFinite(rv) || rl < 0 || rv < 0) {
    mostrarNotificacion("Marcador inválido.", "warning");
    return;
  }
  if (rl === rv) {
    mostrarNotificacion("En eliminatoria no se permite empate. Registra ganador final.", "warning");
    return;
  }

  const ganadorId = rl > rv ? cruce.equipo_local_id : cruce.equipo_visitante_id;
  if (!ganadorId) {
    mostrarNotificacion("No se puede determinar ganador sin equipos asignados.", "warning");
    return;
  }

  try {
    await ApiClient.put(`/eliminatorias/${id}/resultado`, {
      resultado_local: rl,
      resultado_visitante: rv,
      ganador_id: ganadorId,
    });
    mostrarNotificacion("Resultado de eliminatoria actualizado.", "success");
    await cargarPartidos();
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo registrar resultado.", "error");
  }
}

async function exportarFixturePNG() {
  const zona = document.getElementById("fixture-export");
  if (!zona) return;

  const canvas = await html2canvas(zona, {
    scale: 2,
    backgroundColor: "#071924",
    useCors: true,
  });

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `fixture_evento_${eventoSeleccionado || "sin_id"}.png`;
  a.click();
}

async function exportarFixturePDF() {
  const zona = document.getElementById("fixture-export");
  if (!zona) return;

  const canvas = await html2canvas(zona, {
    scale: 2,
    backgroundColor: "#071924",
    useCors: true,
  });

  const imgData = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const imgProps = pdf.getImageProperties(imgData);
  const imgWidth = pageWidth;
  const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

  pdf.addImage(imgData, "PNG", 0, 10, imgWidth, Math.min(imgHeight, 275));
  pdf.save(`fixture_evento_${eventoSeleccionado || "sin_id"}.pdf`);
}

function abrirPlantillaFixturePantallaCompleta() {
  if (!eventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría primero.", "warning");
    return;
  }

  const params = new URLSearchParams();
  params.set("evento", String(eventoSeleccionado));
  params.set("vista", vistaFixture);
  if (grupoSeleccionado) params.set("grupo", String(grupoSeleccionado));
  if (jornadaSeleccionada) params.set("jornada", String(jornadaSeleccionada));
  if (fechaSeleccionada) params.set("fecha", String(fechaSeleccionada));

  if (window.RouteContext?.navigate) {
    window.RouteContext.navigate("fixtureplantilla.html", {
      evento: Number(eventoSeleccionado) || null,
      grupo: Number(grupoSeleccionado) || null,
      jornada: jornadaSeleccionada || "",
      fecha: fechaSeleccionada || "",
      vista: vistaFixture || "todos",
    });
    return;
  }
  window.location.href = `fixtureplantilla.html?${params.toString()}`;
}

function abrirPlantillaJornada() {
  if (!eventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría primero.", "warning");
    return;
  }
  if (metodoCompetenciaActivo === "eliminatoria") {
    abrirPlantillaPlayoff();
    return;
  }
  if (window.RouteContext?.navigate) {
    window.RouteContext.navigate("jornadasplantilla.html", {
      evento: Number(eventoSeleccionado) || null,
      modo: "regular",
      jornada: jornadaSeleccionada || "",
    });
    return;
  }
  const params = new URLSearchParams();
  params.set("evento", String(eventoSeleccionado));
  params.set("modo", "regular");
  if (jornadaSeleccionada) params.set("jornada", String(jornadaSeleccionada));
  window.location.href = `jornadasplantilla.html?${params.toString()}`;
}

function obtenerRondaPreferidaPlantillaPlayoff() {
  if (!Array.isArray(eliminatoriasActuales) || !eliminatoriasActuales.length) return "";
  const orden = ["32vos", "16vos", "12vos", "8vos", "4tos", "semifinal", "final", "tercer_puesto"];
  const agrupado = new Map();
  eliminatoriasActuales.forEach((cruce) => {
    const ronda = String(cruce?.ronda || "").toLowerCase();
    if (!ronda) return;
    if (!agrupado.has(ronda)) agrupado.set(ronda, []);
    agrupado.get(ronda).push(cruce);
  });
  const rondas = [...orden.filter((r) => agrupado.has(r)), ...Array.from(agrupado.keys()).filter((r) => !orden.includes(r))];
  const conProgramados = rondas.find((ronda) =>
    (agrupado.get(ronda) || []).some(
      (cruce) =>
        cruce?.fecha_partido ||
        cruce?.hora_partido ||
        cruce?.cancha ||
        ["programado", "en_curso", "finalizado", "no_presentaron_ambos"].includes(String(cruce?.estado || "").toLowerCase())
    )
  );
  return conProgramados || rondas[0] || "";
}

function abrirPlantillaPlayoff() {
  if (!eventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría primero.", "warning");
    return;
  }

  const ronda = obtenerRondaPreferidaPlantillaPlayoff();
  if (window.RouteContext?.navigate) {
    window.RouteContext.navigate("jornadasplantilla.html", {
      evento: Number(eventoSeleccionado) || null,
      modo: "playoff",
      ronda: ronda || "",
    });
    return;
  }

  const params = new URLSearchParams();
  params.set("evento", String(eventoSeleccionado));
  params.set("modo", "playoff");
  if (ronda) params.set("ronda", String(ronda));
  window.location.href = `jornadasplantilla.html?${params.toString()}`;
}

function abrirVistaEliminatoria() {
  if (!eventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría primero.", "warning");
    return;
  }
  if (window.RouteContext?.navigate) {
    window.RouteContext.navigate("eliminatorias.html", { evento: Number(eventoSeleccionado) || null });
    return;
  }
  window.location.href = `eliminatorias.html?evento=${encodeURIComponent(eventoSeleccionado)}`;
}

function limpiarPartidosUI() {
  partidosActuales = [];
  alertasOperativasPartidos = new Map();
  cargandoAlertasOperativasPartidos = false;
  const cont = document.getElementById("lista-partidos");
  if (cont) {
    cont.classList.remove("list-mode-table");
    cont.innerHTML = "";
  }
  renderFixtureTemplate([]);
  reporteSancionesPartidosCache = null;
  renderResumenAlertasOperativasPartidos();
}

function normalizarLogoUrl(logoUrl) {
  if (!logoUrl) return null;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  if (logoUrl.startsWith("/")) return `${BACKEND_BASE}${logoUrl}`;
  return `${BACKEND_BASE}/${logoUrl}`;
}

async function cargarAuspiciantesFixture(campeonatoId) {
  const id = Number.parseInt(campeonatoId, 10);
  if (!Number.isFinite(id) || id <= 0) return [];
  try {
    const data = await ApiClient.get(`/auspiciantes/campeonato/${id}?activo=1`);
    return Array.isArray(data?.auspiciantes) ? data.auspiciantes : [];
  } catch (error) {
    console.warn("No se pudieron cargar auspiciantes para fixture:", error);
    return [];
  }
}

function renderAuspiciantesFixture(lista = []) {
  const wrap = document.getElementById("fixture-sponsors");
  const grid = document.getElementById("fixture-sponsors-grid");
  if (!wrap || !grid) return;

  if (!Array.isArray(lista) || !lista.length) {
    wrap.style.display = "none";
    grid.innerHTML = "";
    return;
  }

  grid.innerHTML = lista
    .map((a) => {
      const nombre = escapeHtml(a?.nombre || "Auspiciante");
      const logo = normalizarLogoUrl(a?.logo_url || "");
      return `
        <div class="sponsor-item">
          ${
            logo
              ? `<img src="${logo}" alt="${nombre}" crossorigin="anonymous" referrerpolicy="no-referrer" />`
              : `<div class="sponsor-name">${nombre}</div>`
          }
        </div>
      `;
    })
    .join("");
  wrap.style.display = "block";
}

function normalizarFechaISO(valor) {
  if (!valor) return "";
  const str = String(valor);
  if (str.includes("T")) return str.split("T")[0];
  return str.slice(0, 10);
}

function formatearFechaPartido(valor) {
  const fecha = normalizarFechaISO(valor);
  return fecha || "Por definir";
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return "";
  const d = new Date(fechaISO);
  if (Number.isNaN(d.getTime())) return String(fechaISO);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// =============================================
// CREAR PARTIDO MANUAL
// =============================================
async function crearPartidoManual() {
  if (!eventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría primero.", "warning");
    return;
  }

  // Cargar equipos del evento
  let equipos = [];
  try {
    const resp = await ApiClient.get(`/eventos/${eventoSeleccionado}/equipos`);
    equipos = Array.isArray(resp) ? resp : (resp.equipos || resp.data || []);
  } catch (e) {
    mostrarNotificacion("No se pudieron cargar los equipos del evento.", "error");
    return;
  }
  if (equipos.length < 2) {
    mostrarNotificacion("Se necesitan al menos 2 equipos en la categoría.", "warning");
    return;
  }

  const opcionesEquipos = equipos.map((eq) => ({
    value: String(eq.id),
    label: eq.nombre || String(eq.id),
  }));

  // Calcular siguiente jornada sugerida
  const maxJ = partidosActuales.length
    ? Math.max(...partidosActuales.map((p) => Number(p.jornada) || 0))
    : 1;

  const form = await window.mostrarFormularioModal({
    titulo: "Crear Partido Manual",
    mensaje: "Elige los equipos y programa el partido.",
    tipo: "info",
    textoConfirmar: "Crear Partido",
    ancho: "md",
    campos: [
      {
        name: "equipo_local_id",
        label: "Equipo Local",
        type: "select",
        value: "",
        options: [{ value: "", label: "— Selecciona —" }, ...opcionesEquipos],
        required: true,
        span: 2,
        validate: (v) => (!v ? "Selecciona el equipo local." : ""),
      },
      {
        name: "equipo_visitante_id",
        label: "Equipo Visitante",
        type: "select",
        value: "",
        options: [{ value: "", label: "— Selecciona —" }, ...opcionesEquipos],
        required: true,
        span: 2,
        validate: (v, all) => {
          if (!v) return "Selecciona el equipo visitante.";
          if (v === all.equipo_local_id) return "El equipo visitante debe ser diferente al local.";
          return "";
        },
      },
      {
        name: "numero_campeonato",
        label: "N° visible del partido",
        type: "number",
        value: String(obtenerSiguienteNumeroVisiblePartido()),
        min: 1,
        step: 1,
        placeholder: "Ej. 12",
        helpText: "Número visible para el fixture. Si lo cambias, el ID interno del partido no se modifica.",
        validate: (v) => {
          const raw = String(v ?? "").trim();
          if (!raw) return "";
          const numero = Number.parseInt(raw, 10);
          if (!Number.isFinite(numero) || numero <= 0) return "El número visible debe ser un entero mayor a 0.";
          return "";
        },
      },
      {
        name: "jornada",
        label: "Jornada",
        type: "number",
        value: String(maxJ),
        min: 1,
        step: 1,
        required: true,
        validate: (v) => {
          const n = Number.parseInt(v, 10);
          if (!Number.isFinite(n) || n <= 0) return "Jornada debe ser entero mayor a 0.";
          return "";
        },
      },
      {
        name: "fecha",
        label: "Fecha",
        type: "date",
        value: "",
      },
      {
        name: "hora",
        label: "Hora",
        type: "time",
        value: "",
      },
      {
        name: "cancha",
        label: "Cancha",
        type: "text",
        value: "",
        placeholder: "Vacío para sin cancha",
        span: 2,
      },
    ],
  });
  if (!form) return;

  const localId  = Number(form.equipo_local_id);
  const visitId  = Number(form.equipo_visitante_id);
  const jornada  = Number(form.jornada);
  const numeroVisible = Number.parseInt(String(form.numero_campeonato || "").trim(), 10);
  const fecha    = String(form.fecha || "").trim() || null;
  const hora     = String(form.hora  || "").trim();
  const cancha   = String(form.cancha || "").trim() || null;

  const evento = obtenerEventoSeleccionadoObj();
  const campeonato_id = evento?.campeonato_id || null;

  try {
    await ApiClient.post("/partidos/", {
      campeonato_id,
      evento_id: eventoSeleccionado,
      equipo_local_id: localId,
      equipo_visitante_id: visitId,
      numero_campeonato: Number.isFinite(numeroVisible) && numeroVisible > 0 ? numeroVisible : null,
      jornada,
      fecha_partido: fecha,
      hora_partido: hora ? (hora.length === 5 ? `${hora}:00` : hora) : null,
      cancha,
    });
    mostrarNotificacion("Partido creado correctamente.", "success");
    cargarPartidos();
  } catch (err) {
    console.error(err);
    mostrarNotificacion(err?.message || "Error al crear el partido.", "error");
  }
}

async function eliminarFixtureEvento() {
  if (!eventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría primero.", "warning");
    return;
  }

  // Primera confirmación
  const ok = await window.mostrarConfirmacion({
    titulo: "Eliminar fixture",
    mensaje: "Se eliminarán TODOS los partidos de la categoría seleccionada. Esta acción no se puede deshacer. ¿Continuar?",
    tipo: "danger",
    textoConfirmar: "Eliminar fixture",
    claseConfirmar: "btn-danger",
  });
  if (!ok) return;

  try {
    await ApiClient.delete(`/partidos/evento/${eventoSeleccionado}/fixture`);
    mostrarNotificacion("Fixture eliminado correctamente.", "success");
    await cargarPartidos();
  } catch (error) {
    // Si hay partidos jugados, preguntar si forzar
    if (error?.message && error.message.includes("jugado")) {
      const match = error.message.match(/Hay (\d+)/);
      const jugados = match ? match[1] : "algunos";
      const forzar = await window.mostrarConfirmacion({
        titulo: "Hay partidos ya jugados",
        mensaje: `Hay ${jugados} partido(s) con resultado registrado. ¿Deseas eliminar el fixture completo incluyendo esos resultados?`,
        tipo: "danger",
        textoConfirmar: "Sí, eliminar todo",
        claseConfirmar: "btn-danger",
      });
      if (!forzar) return;
      try {
        await ApiClient.delete(`/partidos/evento/${eventoSeleccionado}/fixture?force=true`);
        mostrarNotificacion("Fixture eliminado (incluyendo resultados).", "success");
        await cargarPartidos();
      } catch (err2) {
        mostrarNotificacion(err2.message || "Error al eliminar el fixture.", "error");
      }
    } else {
      mostrarNotificacion(error.message || "Error al eliminar el fixture.", "error");
    }
  }
}

async function regenerarFixturePreservando() {
  if (!eventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría primero.", "warning");
    return;
  }

  const idaYVuelta = document.getElementById("chk-ida-vuelta")?.checked === true;
  const modoProgramacion = await validarModoProgramacionFixture();
  if (!modoProgramacion) return;

  const ok = await window.mostrarConfirmacion({
    titulo: "Regenerar fixture (preservar jugados)",
    mensaje: modoProgramacion.automatica
      ? "Se eliminarán los partidos pendientes y se regenerarán los enfrentamientos faltantes para todos los equipos actuales (incluyendo nuevos). Los partidos ya jugados se conservan y, si no alcanzan las fechas, el resto quedará sin programación para edición manual. ¿Continuar?"
      : "Se eliminarán los partidos pendientes y se regenerarán los enfrentamientos faltantes para todos los equipos actuales (incluyendo nuevos). Los partidos ya jugados se conservan y los nuevos cruces quedarán sin fecha/hora/cancha. ¿Continuar?",
    tipo: "warning",
    textoConfirmar: "Regenerar",
    claseConfirmar: "btn-warning",
  });
  if (!ok) return;

  try {
    const resp = await ApiClient.post(`/partidos/evento/${eventoSeleccionado}/regenerar-preservando`, {
      ida_y_vuelta: idaYVuelta,
      programacion_automatica: modoProgramacion.automatica,
      programacion_manual: modoProgramacion.manual,
    });
    mostrarNotificacion(resp?.mensaje || "Fixture regenerado correctamente.", "success");
    if (resp?.capacidad_insuficiente) {
      await window.mostrarAlerta({
        titulo: "Regeneración completada con partidos pendientes",
        mensaje:
          `Se programaron ${Number(resp.programados || 0)} partido(s) y ${Number(resp.sin_programar || 0)} quedaron sin fecha/hora/cancha para que puedas completarlos manualmente.` +
          (resp?.mensaje_capacidad ? `\n\n${resp.mensaje_capacidad}` : ""),
        tipo: "warning",
        textoBoton: "Entendido",
      });
    }
    await cargarPartidos();
  } catch (error) {
    mostrarNotificacion(error.message || "Error al regenerar el fixture.", "error");
  }
}

window.cargarPartidos = cargarPartidos;
window.cambiarPestanaPartidos = cambiarPestanaPartidos;
window.cambiarVistaFixture = cambiarVistaFixture;
window.generarFixtureEvento = generarFixtureEvento;
window.exportarFixturePNG = exportarFixturePNG;
window.exportarFixturePDF = exportarFixturePDF;
window.renderReporteSancionesPartidos = renderReporteSancionesPartidos;
window.imprimirReporteSancionesPartidos = imprimirReporteSancionesPartidos;
window.exportarReporteSancionesPartidosPDF = exportarReporteSancionesPartidosPDF;
window.abrirPlantillaFixturePantallaCompleta = abrirPlantillaFixturePantallaCompleta;
window.abrirPlantillaJornada = abrirPlantillaJornada;
window.editarPartido = editarPartido;
window.eliminarPartido = eliminarPartido;
window.abrirPlanillaPartido = abrirPlanillaPartido;
window.cambiarVistaPartidos = cambiarVistaPartidos;
window.editarResultadoEliminatoria = editarResultadoEliminatoria;
window.abrirVistaEliminatoria = abrirVistaEliminatoria;
window.eliminarFixtureEvento = eliminarFixtureEvento;
window.regenerarFixturePreservando = regenerarFixturePreservando;
