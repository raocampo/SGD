// frontend/js/equipos.js

let campeonatoId = null;
let campeonatoActual = null;
let eventoIdSeleccionado = null;
let totalEquiposInscritos = 0;
let totalEquiposCampeonato = 0;
let equiposCache = [];
let equipoEditandoId = null;
let alertasOperativasEquipos = new Map();
let cargandoAlertasOperativas = false;
let tokenAlertasOperativas = 0;
let vistaEquipos = localStorage.getItem("sgd_vista_equipos") || "cards";
vistaEquipos = vistaEquipos === "table" ? "table" : "cards";
const CAMPOS_IMPORTACION_EQUIPOS = [
  "nombre",
  "director_tecnico",
  "asistente_tecnico",
  "medico",
  "telefono",
  "email",
  "color_primario",
  "color_secundario",
  "color_terciario",
  "cabeza_serie",
  "logo_url",
];
const ALIAS_CAMPOS_IMPORTACION_EQUIPOS = {
  nombre: ["nombre", "equipo", "nombre_equipo"],
  director_tecnico: ["director_tecnico", "director", "dt", "tecnico", "tecnico_o_dueno"],
  asistente_tecnico: ["asistente_tecnico", "asistente", "at"],
  medico: ["medico", "doctor"],
  telefono: ["telefono", "celular", "movil", "whatsapp"],
  email: ["email", "correo", "correo_electronico"],
  color_primario: ["color_primario", "primario", "color1"],
  color_secundario: ["color_secundario", "secundario", "color2"],
  color_terciario: ["color_terciario", "terciario", "color3"],
  cabeza_serie: ["cabeza_serie", "cabeza", "seed", "es_cabeza_serie"],
  logo_url: ["logo_url", "logo", "url_logo"],
};

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

function formatoMonedaEquipo(valor) {
  const n = Number(valor || 0);
  if (!Number.isFinite(n)) return "$0.00";
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function obtenerAlertaOperativaEquipo(equipoId) {
  const id = Number.parseInt(equipoId, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return alertasOperativasEquipos.get(id) || null;
}

function resumirDisciplinaEquipo(jugadores = []) {
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

function construirChipsAlertaEquipo(alerta, { compacta = false } = {}) {
  if (!alerta && cargandoAlertasOperativas) {
    return `
      <div class="equipo-alertas">
        <span class="equipo-alerta-chip equipo-alerta-cargando">
          <i class="fas fa-spinner fa-spin"></i> Actualizando
        </span>
      </div>
    `;
  }

  const chips = [];
  const saldo = Number(alerta?.saldo || 0);
  const suspendidos = Number(alerta?.suspendidos || 0);
  const amarillas = Number(alerta?.alerta_amarillas || 0);
  const noPresentaciones = Number(alerta?.no_presentaciones || 0);
  const eliminadoAutomatico = alerta?.eliminado_automatico === true;
  const eliminadoManual = alerta?.eliminado_manual === true;
  const motivoEliminacion = alerta?.motivo_eliminacion_label || "Eliminado manualmente";

  if (eliminadoAutomatico) {
    chips.push(`
      <span class="equipo-alerta-chip equipo-alerta-deuda" title="Equipo eliminado automáticamente por 3 no presentaciones">
        <i class="fas fa-user-slash"></i> ${compacta ? "Eliminado" : "Eliminado por no presentación"}
      </span>
    `);
  }

  if (eliminadoManual) {
    chips.push(`
      <span class="equipo-alerta-chip equipo-alerta-deuda" title="${escapeHtml(motivoEliminacion)}">
        <i class="fas fa-ban"></i> ${compacta ? "Eliminado" : escapeHtml(motivoEliminacion)}
      </span>
    `);
  }

  if (noPresentaciones > 0) {
    chips.push(`
      <span class="equipo-alerta-chip equipo-alerta-seguimiento" title="No presentaciones registradas en la categoría">
        <i class="fas fa-triangle-exclamation"></i> ${compacta ? `NP ${noPresentaciones}` : `${noPresentaciones} no presentación${noPresentaciones === 1 ? "" : "es"}`}
      </span>
    `);
  }

  if (saldo > 0) {
    chips.push(`
      <span class="equipo-alerta-chip equipo-alerta-deuda" title="Saldo pendiente del equipo">
        <i class="fas fa-wallet"></i> ${compacta ? formatoMonedaEquipo(saldo) : `Deuda ${formatoMonedaEquipo(saldo)}`}
      </span>
    `);
  }

  if (suspendidos > 0) {
    chips.push(`
      <span class="equipo-alerta-chip equipo-alerta-disciplina" title="Jugadores suspendidos para esta categoría">
        <i class="fas fa-ban"></i> ${suspendidos} suspendido${suspendidos === 1 ? "" : "s"}
      </span>
    `);
  }

  if (amarillas > 0) {
    chips.push(`
      <span class="equipo-alerta-chip equipo-alerta-seguimiento" title="Jugadores en seguimiento por amarillas acumuladas">
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

  return `<div class="equipo-alertas">${chips.join("")}</div>`;
}

function renderResumenAlertasOperativas() {
  const cont = document.getElementById("equipos-alertas-operativas");
  if (!cont) return;

  if (!campeonatoId || !equiposCache.length) {
    cont.style.display = "none";
    cont.innerHTML = "";
    return;
  }

  if (cargandoAlertasOperativas) {
    cont.style.display = "block";
    cont.innerHTML = `
      <h3>Alertas Operativas</h3>
      <div class="empty-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Actualizando disciplina y morosidad de los equipos...</p>
      </div>
    `;
    return;
  }

  let equiposConDeuda = 0;
  let equiposConSuspendidos = 0;
  let equiposEnSeguimiento = 0;
  let saldoTotal = 0;

  equiposCache.forEach((equipo) => {
    const alerta = obtenerAlertaOperativaEquipo(equipo.id);
    if (!alerta) return;
    const saldo = Number(alerta.saldo || 0);
    const suspendidos = Number(alerta.suspendidos || 0);
    const amarillas = Number(alerta.alerta_amarillas || 0);
    if (saldo > 0) {
      equiposConDeuda += 1;
      saldoTotal += saldo;
    }
    if (suspendidos > 0) equiposConSuspendidos += 1;
    if (amarillas > 0) equiposEnSeguimiento += 1;
  });

  const detalleDisciplina = eventoIdSeleccionado
    ? `<div class="alerta-operativa-card">
         <span class="alerta-operativa-label">Equipos con suspendidos</span>
         <strong>${equiposConSuspendidos}</strong>
       </div>
       <div class="alerta-operativa-card">
         <span class="alerta-operativa-label">Equipos en seguimiento TA</span>
         <strong>${equiposEnSeguimiento}</strong>
       </div>`
    : `<div class="alerta-operativa-card alerta-operativa-card-info">
         <span class="alerta-operativa-label">Disciplina por categoría</span>
         <strong>Selecciona una categoría para ver suspendidos y TA</strong>
       </div>`;

  cont.style.display = "block";
  cont.innerHTML = `
    <h3>Alertas Operativas</h3>
    <div class="alertas-operativas-grid">
      <div class="alerta-operativa-card ${equiposConDeuda > 0 ? "alerta-operativa-card-deuda" : ""}">
        <span class="alerta-operativa-label">Equipos con deuda</span>
        <strong>${equiposConDeuda}</strong>
      </div>
      <div class="alerta-operativa-card ${saldoTotal > 0 ? "alerta-operativa-card-deuda" : ""}">
        <span class="alerta-operativa-label">Saldo pendiente total</span>
        <strong>${formatoMonedaEquipo(saldoTotal)}</strong>
      </div>
      ${detalleDisciplina}
    </div>
  `;
}

function obtenerEventoSeleccionadoDesdeUI() {
  const selectEvento = document.getElementById("select-evento");
  if (!selectEvento) return null;
  const value = String(selectEvento.value || "").trim();
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
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

function normalizarClaveImportacionEquipo(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function valorTextoImportacionEquipo(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim();
}

function normalizarTelefonoImportacionEquipo(valor) {
  const txt = valorTextoImportacionEquipo(valor);
  if (!txt) return "";
  const soloDigitos = txt.replace(/\D/g, "");
  if (!soloDigitos) return txt;
  if (soloDigitos.length === 9) return `0${soloDigitos}`;
  return soloDigitos;
}

function valorBooleanoImportacionEquipo(valor) {
  const key = normalizarClaveImportacionEquipo(valor);
  return ["1", "true", "si", "s", "x", "yes"].includes(key);
}

function valorColorImportacionEquipo(valor) {
  const txt = valorTextoImportacionEquipo(valor);
  if (!txt) return "";
  if (/^#[0-9a-f]{6}$/i.test(txt)) return txt.toUpperCase();
  return "";
}

function obtenerValorAliasImportacionEquipo(mapa, aliases = []) {
  for (const alias of aliases) {
    if (!Object.prototype.hasOwnProperty.call(mapa, alias)) continue;
    const val = mapa[alias];
    if (val !== null && val !== undefined && String(val).trim() !== "") return val;
  }
  return null;
}

function normalizarFilaImportacionEquipo(fila) {
  const mapa = {};
  Object.entries(fila || {}).forEach(([key, val]) => {
    const nk = normalizarClaveImportacionEquipo(key);
    if (!nk) return;
    mapa[nk] = val;
  });

  const nombre = valorTextoImportacionEquipo(
    obtenerValorAliasImportacionEquipo(mapa, ALIAS_CAMPOS_IMPORTACION_EQUIPOS.nombre)
  );
  const director_tecnico = valorTextoImportacionEquipo(
    obtenerValorAliasImportacionEquipo(mapa, ALIAS_CAMPOS_IMPORTACION_EQUIPOS.director_tecnico)
  );
  const asistente_tecnico = valorTextoImportacionEquipo(
    obtenerValorAliasImportacionEquipo(mapa, ALIAS_CAMPOS_IMPORTACION_EQUIPOS.asistente_tecnico)
  );
  const medico = valorTextoImportacionEquipo(
    obtenerValorAliasImportacionEquipo(mapa, ALIAS_CAMPOS_IMPORTACION_EQUIPOS.medico)
  );
  const telefono = valorTextoImportacionEquipo(
    normalizarTelefonoImportacionEquipo(
      obtenerValorAliasImportacionEquipo(mapa, ALIAS_CAMPOS_IMPORTACION_EQUIPOS.telefono)
    )
  );
  const email = valorTextoImportacionEquipo(
    obtenerValorAliasImportacionEquipo(mapa, ALIAS_CAMPOS_IMPORTACION_EQUIPOS.email)
  );
  const color_primario = valorColorImportacionEquipo(
    obtenerValorAliasImportacionEquipo(mapa, ALIAS_CAMPOS_IMPORTACION_EQUIPOS.color_primario)
  );
  const color_secundario = valorColorImportacionEquipo(
    obtenerValorAliasImportacionEquipo(mapa, ALIAS_CAMPOS_IMPORTACION_EQUIPOS.color_secundario)
  );
  const color_terciario = valorColorImportacionEquipo(
    obtenerValorAliasImportacionEquipo(mapa, ALIAS_CAMPOS_IMPORTACION_EQUIPOS.color_terciario)
  );
  const cabeza_serie = valorBooleanoImportacionEquipo(
    obtenerValorAliasImportacionEquipo(mapa, ALIAS_CAMPOS_IMPORTACION_EQUIPOS.cabeza_serie)
  );
  const logo_url = valorTextoImportacionEquipo(
    obtenerValorAliasImportacionEquipo(mapa, ALIAS_CAMPOS_IMPORTACION_EQUIPOS.logo_url)
  );

  if (
    !nombre &&
    !director_tecnico &&
    !asistente_tecnico &&
    !medico &&
    !telefono &&
    !email &&
    !color_primario &&
    !color_secundario &&
    !color_terciario &&
    !logo_url
  ) {
    return null;
  }

  return {
    nombre,
    director_tecnico,
    asistente_tecnico,
    medico,
    telefono,
    email,
    color_primario,
    color_secundario,
    color_terciario,
    cabeza_serie,
    logo_url,
  };
}

function leerArchivoComoArrayBufferEquipos(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo seleccionado"));
    reader.readAsArrayBuffer(file);
  });
}

async function procesarArchivoImportacionEquipos(file) {
  if (!window.XLSX) throw new Error("No se cargó la librería XLSX para importar");

  const arrayBuffer = await leerArchivoComoArrayBufferEquipos(file);
  const wb = window.XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error("El archivo no contiene hojas válidas");

  const filasRaw = window.XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  if (!filasRaw.length) throw new Error("El archivo no tiene filas para importar");

  const equipos = [];
  const erroresLocales = [];

  filasRaw.forEach((fila, idx) => {
    const nroFila = idx + 2;
    const normalizada = normalizarFilaImportacionEquipo(fila);
    if (!normalizada) return;
    if (!normalizada.nombre || !normalizada.director_tecnico) {
      erroresLocales.push(`Fila ${nroFila}: nombre y director_tecnico son obligatorios`);
      return;
    }
    equipos.push(normalizada);
  });

  if (!equipos.length) {
    const msg = erroresLocales.length
      ? `No hay filas válidas para importar.\n${erroresLocales.slice(0, 8).join("\n")}`
      : "No hay filas válidas para importar.";
    throw new Error(msg);
  }

  return { equipos, erroresLocales, totalLeidas: filasRaw.length };
}

function inicializarImportadorEquipos() {
  const input = document.getElementById("import-equipos-file");
  if (!input || input.dataset.inicializado === "1") return;
  input.dataset.inicializado = "1";

  input.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    input.value = "";
    if (!file) return;

    const campId = Number.parseInt(document.getElementById("select-campeonato")?.value || "", 10);
    const eventoSeleccionado = obtenerEventoSeleccionadoDesdeUI();
    if (!Number.isFinite(campId) || campId <= 0) {
      mostrarNotificacion("Selecciona un campeonato antes de importar equipos", "warning");
      return;
    }

    try {
      mostrarNotificacion("Procesando archivo de equipos...", "info");
      const { equipos, erroresLocales, totalLeidas } = await procesarArchivoImportacionEquipos(file);
      const resultado = await window.ApiClient.post("/equipos/importar-masivo", {
        campeonato_id: campId,
        evento_id: eventoSeleccionado || null,
        equipos,
      });

      await cargarEventosSelect(eventoSeleccionado);
      await cargarEquipos();

      const totalErroresBackend = Number(resultado?.total_errores || 0);
      const totalCreado = Number(resultado?.total_creados || 0);
      const resumen = [
        "Importación de equipos completada.",
        `Filas leídas: ${totalLeidas}`,
        `Filas enviadas: ${equipos.length}`,
        `Equipos creados: ${totalCreado}`,
        `Errores backend: ${totalErroresBackend}`,
      ];
      if (erroresLocales.length) resumen.push(`Filas omitidas localmente: ${erroresLocales.length}`);
      if (Array.isArray(resultado?.errores) && resultado.errores.length) {
        const preview = resultado.errores
          .slice(0, 5)
          .map((x) => `Fila ${x.fila}: ${x.error}`)
          .join("\n");
        resumen.push(`Primeros errores:\n${preview}`);
      }

      await window.mostrarAlerta({
        titulo: "Resumen de importación",
        mensaje: resumen.join("\n"),
        tipo: totalErroresBackend ? "warning" : "success",
        textoBoton: "Cerrar resumen",
      });
      mostrarNotificacion(
        `Importación finalizada. Creados: ${totalCreado}, errores: ${totalErroresBackend}`,
        totalErroresBackend ? "warning" : "success"
      );
    } catch (error) {
      console.error("Error importando equipos:", error);
      mostrarNotificacion(error.message || "No se pudo importar el archivo", "error");
    }
  });
}

function abrirImportadorEquipos() {
  if (usuarioEsTecnico()) {
    mostrarNotificacion("No autorizado para importar equipos", "warning");
    return;
  }
  const campId = Number.parseInt(document.getElementById("select-campeonato")?.value || "", 10);
  if (!Number.isFinite(campId) || campId <= 0) {
    mostrarNotificacion("Selecciona un campeonato antes de importar equipos", "warning");
    return;
  }
  const input = document.getElementById("import-equipos-file");
  if (!input) {
    mostrarNotificacion("No se encontró el control para importar archivo", "error");
    return;
  }
  input.click();
}

function descargarPlantillaEquipos() {
  if (!window.XLSX) {
    mostrarNotificacion("No se cargó la librería XLSX para descargar plantilla", "error");
    return;
  }

  const filasPlantilla = [
    CAMPOS_IMPORTACION_EQUIPOS,
    [
      "80 FC",
      "Gonzalo González",
      "Luis Iñaguazo",
      "Carlos Medina",
      "0999999999",
      "",
      "#F50505",
      "#1E40AF",
      "#16A34A",
      "No",
      "https://tu-dominio.com/logos/80fc.png",
    ],
  ];

  const wsDatos = window.XLSX.utils.aoa_to_sheet(filasPlantilla);
  wsDatos["!cols"] = [
    { wch: 28 },
    { wch: 28 },
    { wch: 24 },
    { wch: 24 },
    { wch: 18 },
    { wch: 26 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 42 },
  ];

  const instrucciones = [
    ["INSTRUCCIONES PARA IMPORTAR EQUIPOS"],
    ["1) No cambies los nombres de columnas de la hoja Datos."],
    ["2) Campos obligatorios: nombre y director_tecnico."],
    ["3) El campo email es opcional."],
    ["4) Colores deben ir en formato hexadecimal: #RRGGBB (opcional)."],
    ["5) cabeza_serie acepta Si/No, True/False, 1/0."],
    ["6) logo_url es opcional y debe ser una URL pública si se usa."],
    ["7) Antes de importar, selecciona campeonato y (opcionalmente) categoría."],
  ];
  const wsInstrucciones = window.XLSX.utils.aoa_to_sheet(instrucciones);
  wsInstrucciones["!cols"] = [{ wch: 95 }];

  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, wsDatos, "Datos");
  window.XLSX.utils.book_append_sheet(wb, wsInstrucciones, "Instrucciones");
  window.XLSX.writeFile(wb, "plantilla_equipos.xlsx");
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
  inicializarImportadorEquipos();

  // Parámetros URL (si viene desde Categorías)
  const params = new URLSearchParams(window.location.search);
  eventoIdSeleccionado = params.get("evento") ? parseInt(params.get("evento"), 10) : null;
  campeonatoId = params.get("campeonato") ? parseInt(params.get("campeonato"), 10) : null;

  // Cargar selects de campeonato y evento
  await cargarCampeonatosSelect();

  if (campeonatoId) {
    document.getElementById("select-campeonato").value = String(campeonatoId);
    await cargarEventosSelect(eventoIdSeleccionado);
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
      alertasOperativasEquipos = new Map();
      cargandoAlertasOperativas = false;
      tokenAlertasOperativas += 1;
      document.getElementById("select-evento").innerHTML = '<option value="">— Selecciona una categoría —</option>';
      document.getElementById("lista-equipos").innerHTML = "";
      document.getElementById("info-contexto").style.display = "none";
      renderResumenAlertasOperativas();
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
async function cargarEventosSelect(eventoPreservado = null) {
  const select = document.getElementById("select-evento");
  if (!select || !campeonatoId) return;
  select.innerHTML = '<option value="">— Selecciona una categoría (opcional) —</option>';
  const destinoEvento = Number.isFinite(Number(eventoPreservado))
    ? Number(eventoPreservado)
    : Number(eventoIdSeleccionado || 0);

  try {
    const data = await (window.EventosAPI?.obtenerPorCampeonato?.(campeonatoId) || window.ApiClient?.get?.(`/eventos/campeonato/${campeonatoId}`));
    const lista = Array.isArray(data) ? data : (data.eventos || data.data || []);
    lista.forEach((e) => {
      select.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
    });

    if (destinoEvento > 0 && lista.some((e) => Number(e.id) === destinoEvento)) {
      select.value = String(destinoEvento);
      eventoIdSeleccionado = destinoEvento;
    } else {
      eventoIdSeleccionado = obtenerEventoSeleccionadoDesdeUI();
    }

    select.onchange = () => {
      eventoIdSeleccionado = select.value ? parseInt(select.value, 10) : null;
      alertasOperativasEquipos = new Map();
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
    renderInfoContexto();
  } catch (err) {
    console.error(err);
  }
}

function renderInfoContexto() {
  const cont = document.getElementById("info-contexto");
  if (!cont || !campeonatoActual) return;

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
}

async function cargarAlertasOperativasEquipos(equipos = []) {
  const equiposLista = Array.isArray(equipos) ? equipos : [];
  const tokenActual = ++tokenAlertasOperativas;
  alertasOperativasEquipos = new Map();

  if (!campeonatoId || !equiposLista.length) {
    cargandoAlertasOperativas = false;
    renderResumenAlertasOperativas();
    renderListadoEquipos();
    return;
  }

  cargandoAlertasOperativas = true;
  renderResumenAlertasOperativas();
  renderListadoEquipos();

  try {
    const paramsMorosidad = { campeonato_id: campeonatoId };
    if (eventoIdSeleccionado) paramsMorosidad.evento_id = eventoIdSeleccionado;

    const morosidadResp = await window.FinanzasAPI.morosidad(paramsMorosidad);
    const morosidad = Array.isArray(morosidadResp?.equipos) ? morosidadResp.equipos : [];
    const mapaMorosidad = new Map(
      morosidad.map((item) => [Number(item.equipo_id), item])
    );

    if (tokenActual !== tokenAlertasOperativas) return;

    equiposLista.forEach((equipo) => {
      const item = mapaMorosidad.get(Number(equipo.id));
      alertasOperativasEquipos.set(Number(equipo.id), {
        saldo: Number(item?.saldo || 0),
        saldo_vencido: Number(item?.saldo_vencido || 0),
        suspendidos: 0,
        alerta_amarillas: 0,
      });
    });

    if (eventoIdSeleccionado) {
      const resultados = await Promise.allSettled(
        equiposLista.map(async (equipo) => {
          const data = await window.ApiClient.get(`/jugadores/equipo/${equipo.id}?evento_id=${eventoIdSeleccionado}`);
          const jugadores = Array.isArray(data) ? data : data?.jugadores || data?.data || [];
          return {
            equipoId: Number(equipo.id),
            resumen: resumirDisciplinaEquipo(jugadores),
          };
        })
      );

      if (tokenActual !== tokenAlertasOperativas) return;

      resultados.forEach((resultado) => {
        if (resultado.status !== "fulfilled") return;
        const equipoId = Number(resultado.value.equipoId);
        const actual = alertasOperativasEquipos.get(equipoId) || {
          saldo: 0,
          saldo_vencido: 0,
          suspendidos: 0,
          alerta_amarillas: 0,
        };
        alertasOperativasEquipos.set(equipoId, {
          ...actual,
          suspendidos: Number(resultado.value.resumen?.suspendidos || 0),
          alerta_amarillas: Number(resultado.value.resumen?.alerta_amarillas || 0),
        });
      });
    }
  } catch (error) {
    console.error("No se pudieron cargar alertas operativas de equipos:", error);
  } finally {
    if (tokenActual !== tokenAlertasOperativas) return;
    cargandoAlertasOperativas = false;
    renderResumenAlertasOperativas();
    renderListadoEquipos();
  }
}

// ======================
// Cargar equipos
// ======================
async function cargarEquipos() {
  const cont = document.getElementById("lista-equipos");
  const selectCamp = document.getElementById("select-campeonato");
  const campDesdeUI = selectCamp?.value ? parseInt(selectCamp.value, 10) : null;
  if (!campDesdeUI && Number.isFinite(Number(campeonatoId)) && Number(campeonatoId) > 0 && selectCamp) {
    if ([...selectCamp.options].some((opt) => Number(opt.value) === Number(campeonatoId))) {
      selectCamp.value = String(campeonatoId);
    }
  }
  campeonatoId = selectCamp?.value
    ? parseInt(selectCamp.value, 10)
    : (Number.isFinite(Number(campeonatoId)) && Number(campeonatoId) > 0 ? Number(campeonatoId) : null);

  const eventoDesdeUI = obtenerEventoSeleccionadoDesdeUI();
  if (!eventoDesdeUI && Number.isFinite(Number(eventoIdSeleccionado)) && Number(eventoIdSeleccionado) > 0) {
    const selectEvento = document.getElementById("select-evento");
    if (selectEvento && [...selectEvento.options].some((opt) => Number(opt.value) === Number(eventoIdSeleccionado))) {
      selectEvento.value = String(eventoIdSeleccionado);
    }
  }
  eventoIdSeleccionado = obtenerEventoSeleccionadoDesdeUI()
    || (Number.isFinite(Number(eventoIdSeleccionado)) && Number(eventoIdSeleccionado) > 0 ? Number(eventoIdSeleccionado) : null);

  if (!campeonatoId) {
    mostrarNotificacion("Selecciona un campeonato", "warning");
    totalEquiposCampeonato = 0;
    totalEquiposInscritos = 0;
    equiposCache = [];
    alertasOperativasEquipos = new Map();
    cargandoAlertasOperativas = false;
    renderResumenAlertasOperativas();
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
        equipos = Array.isArray(dataEvento?.equipos) ? dataEvento.equipos : [];
      } catch (errorcategoría) {
        console.warn("No se pudo filtrar equipos por categoría:", errorcategoría);
        mostrarNotificacion("No se pudo cargar equipos activos de la categoría", "warning");
        equipos = [];
      }
    }

    totalEquiposInscritos = equipos.length;

    await cargarInfoContexto();
    equiposCache = equipos;
    alertasOperativasEquipos = new Map();
    renderListadoEquipos();
    renderResumenAlertasOperativas();
    await cargarAlertasOperativasEquipos(equipos);
  } catch (error) {
    console.error("Error cargando equipos:", error);
    mostrarNotificacion("Error cargando equipos", "error");
    totalEquiposCampeonato = 0;
    totalEquiposInscritos = 0;
    equiposCache = [];
    alertasOperativasEquipos = new Map();
    cargandoAlertasOperativas = false;
    renderResumenAlertasOperativas();
    cont.innerHTML = "<p>Error cargando equipos.</p>";
  }
}

function renderListadoEquipos() {
  const cont = document.getElementById("lista-equipos");
  if (!cont) return;

  if (!equiposCache.length) {
    cont.classList.remove("list-mode-table");
    const mensaje = eventoIdSeleccionado
      ? "No hay equipos activos en esta categoría."
      : "No hay equipos registrados en este campeonato.";
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users-slash"></i>
        <p>${mensaje}</p>
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
  const alerta = {
    ...(obtenerAlertaOperativaEquipo(equipo.id) || {}),
    no_presentaciones: Number(equipo.no_presentaciones || 0),
    eliminado_automatico: equipo.eliminado_automatico === true,
    eliminado_manual: equipo.eliminado_manual === true,
    motivo_eliminacion_label: equipo.motivo_eliminacion_label || null,
  };
  const accionesAdmin = usuarioEsTecnico()
    ? ""
    : `
        ${
          eventoIdSeleccionado
            ? `<button class="btn btn-secondary" onclick="moverEquipoCategoria(${equipo.id})">
                <i class="fas fa-right-left"></i> Cambiar categoría
              </button>`
            : ""
        }
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
        ${construirChipsAlertaEquipo(alerta)}
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
      const alerta = {
        ...(obtenerAlertaOperativaEquipo(equipo.id) || {}),
        no_presentaciones: Number(equipo.no_presentaciones || 0),
        eliminado_automatico: equipo.eliminado_automatico === true,
        eliminado_manual: equipo.eliminado_manual === true,
        motivo_eliminacion_label: equipo.motivo_eliminacion_label || null,
      };
      const logoUrl = equipo.logo_url
        ? (equipo.logo_url.startsWith("http") ? equipo.logo_url : `${baseUrl}${equipo.logo_url}`)
        : "";
      const logo = logoUrl
        ? `<img src="${logoUrl}" alt="Logo ${escapeHtml(equipo.nombre || "")}" class="list-table-logo" />`
        : "<span>—</span>";
      const accionesAdmin = usuarioEsTecnico()
        ? ""
        : `
            ${
              eventoIdSeleccionado
                ? `<button class="btn btn-secondary" onclick="moverEquipoCategoria(${equipo.id})">
                    <i class="fas fa-right-left"></i> Cambiar categoría
                  </button>`
                : ""
            }
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
          <td>${construirChipsAlertaEquipo(alerta, { compacta: true })}</td>
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
            <th>Alertas</th>
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
  const selectCampeonato = document.getElementById("select-campeonato");
  const campeonatoPrevio = selectCampeonato?.value
    ? parseInt(selectCampeonato.value, 10)
    : (Number.isFinite(Number(campeonatoId)) ? Number(campeonatoId) : null);
  const tabActivo = document.querySelector(".modal-tab.active")?.dataset?.tab;
  const usarExistente = tabActivo === "existente";
  const selectEvento = document.getElementById("select-evento");
  eventoIdSeleccionado = selectEvento?.value ? parseInt(selectEvento.value, 10) : null;
  const eventoPrevio = Number.isFinite(Number(eventoIdSeleccionado))
    ? Number(eventoIdSeleccionado)
    : null;
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
  const nombreLower = nombre.toLowerCase();

  if (!nombre) {
    mostrarNotificacion("El nombre del equipo es obligatorio", "warning");
    return;
  }
  if (!dt) {
    mostrarNotificacion("El técnico o dueño es obligatorio", "warning");
    return;
  }
  if (!telefono) {
    mostrarNotificacion("El número de celular es obligatorio", "warning");
    return;
  }
  if (eventoIdSeleccionado) {
    const repetidoEnCategoria = equiposCache.some((e) => {
      const mismoNombre = String(e?.nombre || "").trim().toLowerCase() === nombreLower;
      if (!mismoNombre) return false;
      if (estaEditando && Number(e?.id) === Number(equipoEditandoId)) return false;
      return true;
    });
    if (repetidoEnCategoria) {
      mostrarNotificacion("Ya existe un equipo con ese nombre en la categoría seleccionada", "warning");
      return;
    }
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
  fd.append("email", email || "");
  fd.append("cabeza_serie", document.getElementById("equipo-cabeza-serie").checked);
  if (eventoIdSeleccionado) {
    fd.append("evento_id", String(eventoIdSeleccionado));
  }

  const logoInput = document.getElementById("equipo-logo");
  if (logoInput?.files?.[0]) {
    fd.append("logo", logoInput.files[0]);
  }

  try {
    const baseUrl = (
      window.resolveApiBaseUrl
        ? window.resolveApiBaseUrl()
        : window.API_BASE_URL || `${window.location.origin}/api`
    ).replace(/\/?$/, "");
    const url = estaEditando ? `${baseUrl}/equipos/${equipoEditandoId}` : `${baseUrl}/equipos`;
    const resp = await fetch(url, {
      method: estaEditando ? "PUT" : "POST",
      body: fd,
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || (estaEditando ? "Error actualizando equipo" : "Error creando equipo"));

    const mensaje = estaEditando
      ? "Equipo actualizado correctamente"
      : (eventoIdSeleccionado ? "Equipo creado y asignado a la categoría" : "Equipo creado correctamente");
    equipoEditandoId = null;
    mostrarNotificacion(mensaje, "success");
    cerrarModal("modal-equipo");

    if (Number.isFinite(Number(campeonatoPrevio)) && campeonatoPrevio > 0) {
      campeonatoId = campeonatoPrevio;
      const selectCampActual = document.getElementById("select-campeonato");
      if (selectCampActual && String(selectCampActual.value || "") !== String(campeonatoPrevio)) {
        selectCampActual.value = String(campeonatoPrevio);
      }
    }
    if (eventoPrevio) {
      eventoIdSeleccionado = eventoPrevio;
      const selectEventoActual = document.getElementById("select-evento");
      if (selectEventoActual && String(selectEventoActual.value || "") !== String(eventoPrevio)) {
        selectEventoActual.value = String(eventoPrevio);
      }
    }
    await cargarEquipos();
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
  const ok = await window.mostrarConfirmacion({
    titulo: "Eliminar equipo",
    mensaje: "¿Seguro que quieres eliminar este equipo?",
    tipo: "warning",
    textoConfirmar: "Eliminar",
    claseConfirmar: "btn-danger",
  });
  if (!ok) return;
  try {
    await window.ApiClient.delete(`/equipos/${id}`);
    mostrarNotificacion("Equipo eliminado.", "success");
    cargarEquipos();
  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error al eliminar el equipo.", "error");
  }
}

async function moverEquipoCategoria(equipoId) {
  if (usuarioEsTecnico()) {
    mostrarNotificacion("No autorizado para cambiar categoría", "warning");
    return;
  }
  if (!campeonatoId || !eventoIdSeleccionado) {
    mostrarNotificacion("Selecciona una categoría origen para mover el equipo", "warning");
    return;
  }

  try {
    const resp = await (window.EventosAPI?.obtenerPorCampeonato?.(campeonatoId) || window.ApiClient?.get?.(`/eventos/campeonato/${campeonatoId}`));
    const eventos = Array.isArray(resp) ? resp : (resp.eventos || resp.data || []);
    const opciones = eventos.filter((e) => Number(e.id) !== Number(eventoIdSeleccionado));
    if (!opciones.length) {
      mostrarNotificacion("No existen otras categorías disponibles para mover el equipo", "warning");
      return;
    }

    const seleccion = await window.mostrarFormularioModal({
      titulo: "Cambiar equipo de categoría",
      mensaje: "Selecciona la categoría destino dentro del campeonato actual.",
      tipo: "info",
      textoConfirmar: "Mover equipo",
      ancho: "sm",
      campos: [
        {
          name: "destino",
          label: "Categoría destino",
          type: "select",
          value: String(opciones[0].id),
          required: true,
          options: opciones.map((e) => ({
            value: String(e.id),
            label: e.nombre || `Categoría ${e.id}`,
          })),
          span: 2,
        },
      ],
    });
    if (!seleccion) return;

    const destinoId = Number.parseInt(String(seleccion.destino || "").trim(), 10);
    if (!Number.isFinite(destinoId) || destinoId <= 0) {
      mostrarNotificacion("Categoría destino inválida", "warning");
      return;
    }
    if (!opciones.some((e) => Number(e.id) === destinoId)) {
      mostrarNotificacion("La categoría destino no pertenece al campeonato seleccionado", "warning");
      return;
    }

    await window.ApiClient.delete(`/eventos/${eventoIdSeleccionado}/equipos/${equipoId}`);
    await window.ApiClient.post(`/eventos/${destinoId}/equipos`, { equipo_id: Number(equipoId) });
    mostrarNotificacion("Equipo movido de categoría correctamente", "success");
    await cargarEquipos();
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo mover el equipo de categoría", "error");
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
window.moverEquipoCategoria = moverEquipoCategoria;
window.irASorteo = irASorteo;
window.irAJugadores = irAJugadores;
window.cambiarVistaEquipos = cambiarVistaEquipos;
window.abrirImportadorEquipos = abrirImportadorEquipos;
window.descargarPlantillaEquipos = descargarPlantillaEquipos;


