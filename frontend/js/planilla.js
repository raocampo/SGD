// frontend/js/planilla.js

let partidoId = null;
let eventoId = null;
let campeonatoIdContexto = null;
let dataPlanilla = null;
let equiposPartido = {
  local: { id: null, nombre: "Local" },
  visitante: { id: null, nombre: "Visitante" },
};
let documentosRequeridos = {
  cedula: true,
  foto_cedula: false,
  foto_carnet: false,
};
let eventosPlanillaCache = [];
let partidosSelectorCache = [];
let partidosSelectorRegularCache = [];
let partidosSelectorPlayoffCache = [];
let grupoSelectorActual = "";
let jornadaSelectorActual = "";
let faseSelectorActual = "regular";
let rondaSelectorActual = "";
let modoVistaPreviaPlanilla = "oficial";
let contextoRetornoPlanilla = {
  pagina: null,
  evento: null,
  fuente: null,
};
const IDS_PAGOS_PLANILLA = [
  "pago-local",
  "pago-visitante",
  "pago-arbitraje-local",
  "pago-arbitraje-visitante",
  "pago-ta-local",
  "pago-ta-visitante",
  "pago-tr-local",
  "pago-tr-visitante",
];
const IDS_PAGOS_PLANILLA_LOCAL = [
  "pago-local",
  "pago-arbitraje-local",
  "pago-ta-local",
  "pago-tr-local",
];
const IDS_PAGOS_PLANILLA_VISITANTE = [
  "pago-visitante",
  "pago-arbitraje-visitante",
  "pago-ta-visitante",
  "pago-tr-visitante",
];
const INASISTENCIAS_PLANILLA_VALIDAS = new Set(["ninguno", "local", "visitante", "ambos"]);
const ESTADOS_PLANILLA_CERRADOS = new Set(["finalizado", "no_presentaron_ambos"]);
const GOLES_WALKOVER = 3;
const MAX_FALTAS_PLANILLA = 6;
const RONDAS_PLAYOFF_PLANILLA = [
  "reclasificacion",
  "32vos",
  "16vos",
  "12vos",
  "8vos",
  "4tos",
  "semifinal",
  "final",
  "tercer_puesto",
  "tercer_y_cuarto",
];
const PLANILLA_LABELS_DEFAULT = {
  hintResultado: "El resultado se calcula automaticamente desde la tabla de jugadores y se refleja en la cabecera.",
  resumenTa: "Tarjetas amarillas",
  resumenTr: "Tarjetas rojas",
  pagoTa: "Tarjetas amarillas (pago)",
  pagoTr: "Tarjetas rojas (pago)",
};

function normalizarRondaPlayoffPlanilla(ronda = "") {
  const raw = String(ronda || "")
    .trim()
    .toLowerCase();
  if (raw === "tercer_puesto") return "tercer_y_cuarto";
  return raw;
}

function qp(nombre) {
  const params = new URLSearchParams(window.location.search);
  return params.get(nombre);
}

function guardarContextoRutaPlanilla() {
  window.RouteContext?.save?.("planilla.html", {
    campeonato: Number.isFinite(Number(campeonatoIdContexto)) ? Number(campeonatoIdContexto) : null,
    evento: Number.isFinite(Number(eventoId)) ? Number(eventoId) : null,
    partido: Number.isFinite(Number(partidoId)) ? Number(partidoId) : null,
    fase: String(faseSelectorActual || "regular"),
    ronda: String(rondaSelectorActual || "").trim() || null,
    regreso_pagina: contextoRetornoPlanilla.pagina || null,
    regreso_evento: Number.isFinite(Number(contextoRetornoPlanilla.evento))
      ? Number(contextoRetornoPlanilla.evento)
      : null,
    regreso_fuente: contextoRetornoPlanilla.fuente || null,
  });
}

function leerContextoRetornoPlanilla() {
  const routeContext =
    window.RouteContext?.read?.("planilla.html", [
      "partido",
      "evento",
      "campeonato",
      "fase",
      "ronda",
      "regreso_pagina",
      "regreso_evento",
      "regreso_fuente",
    ]) || {};
  contextoRetornoPlanilla = {
    pagina: String(routeContext.regreso_pagina || "").trim() || null,
    evento: aEntero(routeContext.regreso_evento, NaN),
    fuente: String(routeContext.regreso_fuente || "").trim() || null,
  };
  if (!Number.isFinite(Number(contextoRetornoPlanilla.evento))) {
    contextoRetornoPlanilla.evento = null;
  }
  const fase = String(routeContext.fase || "").trim().toLowerCase();
  if (fase === "playoff" || fase === "regular") {
    faseSelectorActual = fase;
  }
  rondaSelectorActual = normalizarRondaPlayoffPlanilla(routeContext.ronda || "");
  return routeContext;
}

function debeRegresarAPlayoffTrasGuardar() {
  return (
    String(contextoRetornoPlanilla.pagina || "").toLowerCase() === "eliminatorias.html" &&
    String(contextoRetornoPlanilla.fuente || "").toLowerCase() === "reclasificacion_playoff"
  );
}

function regresarAContextoPlanilla() {
  if (debeRegresarAPlayoffTrasGuardar()) {
    const data = {
      evento: Number.isFinite(Number(contextoRetornoPlanilla.evento))
        ? Number(contextoRetornoPlanilla.evento)
        : Number.isFinite(Number(eventoId))
          ? Number(eventoId)
          : null,
    };
    if (window.RouteContext?.navigate) {
      window.RouteContext.navigate("eliminatorias.html", data);
      return;
    }
    const params = new URLSearchParams();
    if (Number.isFinite(Number(data.evento)) && Number(data.evento) > 0) {
      params.set("evento", String(data.evento));
    }
    window.location.href = params.toString()
      ? `eliminatorias.html?${params.toString()}`
      : "eliminatorias.html";
    return;
  }
  volverAPartidos();
}

function aEntero(valor, fallback = 0) {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? n : fallback;
}

function aDecimal(valor, fallback = 0) {
  const n = Number.parseFloat(valor);
  return Number.isFinite(n) ? n : fallback;
}

function normalizarNumeroCamisetaPlanilla(valor, { permitirVacio = true } = {}) {
  const limpio = String(valor ?? "")
    .replace(/\D+/g, "")
    .slice(0, 3);
  if (!limpio) return permitirVacio ? "" : null;
  const numero = Number.parseInt(limpio, 10);
  if (!Number.isFinite(numero) || numero <= 0) {
    return permitirVacio ? "" : null;
  }
  return String(numero);
}

function normalizarCedulaPlanilla(valor, { permitirVacio = true } = {}) {
  const limpio = String(valor ?? "")
    .replace(/\D+/g, "")
    .slice(0, 10);
  if (!limpio) return permitirVacio ? "" : null;
  return limpio;
}

function normalizarNumeroPartidoPlanilla(valor, { permitirVacio = true } = {}) {
  if (valor === undefined) return undefined;
  const limpio = String(valor ?? "")
    .replace(/\D+/g, "")
    .slice(0, 6);
  if (!limpio) return permitirVacio ? null : undefined;
  const numero = Number.parseInt(limpio, 10);
  if (!Number.isFinite(numero) || numero <= 0) {
    return permitirVacio ? null : undefined;
  }
  return numero;
}

function esPosicionArqueroPlanilla(posicion) {
  const raw = String(posicion || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (!raw) return false;
  return ["arquero", "portero", "guardameta", "golero", "goalkeeper", "gk"].includes(raw);
}
function actualizarNumeroJugadorEnDataPlanilla(jugadorIdRaw, numeroCamisetaRaw) {
  const jugadorId = Number.parseInt(jugadorIdRaw, 10);
  if (!Number.isFinite(jugadorId) || jugadorId <= 0 || !dataPlanilla) return;

  const numeroCamiseta = normalizarNumeroCamisetaPlanilla(numeroCamisetaRaw);
  ["plantel_local", "plantel_visitante"].forEach((key) => {
    const lista = Array.isArray(dataPlanilla?.[key]) ? dataPlanilla[key] : [];
    const jugador = lista.find((item) => Number.parseInt(item?.id, 10) === jugadorId);
    if (jugador) {
      jugador.numero_camiseta = numeroCamiseta || null;
      const registroActual = jugador.planilla_registro && typeof jugador.planilla_registro === "object"
        ? jugador.planilla_registro
        : {};
      jugador.planilla_registro = {
        numero_camiseta: numeroCamiseta || null,
        convocatoria:
          normalizarConvocatoriaPlanilla(registroActual.convocatoria || "", { permitirVacio: true }) || null,
        entra: registroActual.entra === true,
        sale: registroActual.sale === true,
      };
    }
  });
}

function normalizarConvocatoriaPlanilla(valor, { permitirVacio = true } = {}) {
  const raw = String(valor ?? "")
    .trim()
    .toUpperCase();
  if (!raw) return permitirVacio ? "" : null;
  const normalizada = raw === "PRINCIPAL" ? "P" : raw === "SUPLENTE" ? "S" : raw;
  if (!["P", "S"].includes(normalizada)) {
    return permitirVacio ? "" : null;
  }
  return normalizada;
}

function obtenerTipoDeportePlanillaNormalizado(partido = dataPlanilla?.partido || {}) {
  const tipoFutbol = String(partido?.tipo_futbol || "")
    .trim()
    .toLowerCase();
  const tipoDeporte = String(partido?.tipo_deporte || "")
    .trim()
    .toLowerCase();
  const raw = tipoFutbol || tipoDeporte;

  if (!raw) return "futbol_7";
  if (
    raw.includes("basquet") ||
    raw.includes("basket") ||
    raw.includes("balonc")
  ) {
    if (raw.includes("3x3")) return "basquetbol_3x3";
    if (raw.includes("mini")) return "basquetbol_minibasket";
    if (raw.includes("callej")) return "basquetbol_callejero";
    return "basquetbol";
  }
  if (raw.includes("indor")) return "indor";
  if (raw.includes("futsal") || raw.includes("sala")) return "futbol_sala";
  if (raw.includes("11")) return "futbol_11";
  if (raw.includes("9")) return "futbol_9";
  if (raw.includes("8")) return "futbol_8";
  if (raw.includes("7")) return "futbol_7";
  if (raw.includes("6")) return "futbol_6";
  if (raw.includes("5")) return "futbol_5";
  if (raw.includes("futbol")) return "futbol_7";
  return raw.replace(/\s+/g, "_");
}

function usaConvocatoriaPlanilla(partido = dataPlanilla?.partido || {}) {
  return new Set(["futbol_9", "futbol_8", "futbol_7", "futbol_6", "futbol_5", "futbol_sala"]).has(
    obtenerTipoDeportePlanillaNormalizado(partido)
  );
}

function leerConvocatoriaControlPlanilla(control, { permitirVacio = true } = {}) {
  if (control instanceof HTMLSelectElement) {
    return normalizarConvocatoriaPlanilla(control.value, { permitirVacio }) || "";
  }
  if (control instanceof HTMLInputElement && control.type === "checkbox") {
    if (control.indeterminate) {
      return permitirVacio ? "" : null;
    }
    return control.checked ? "P" : "S";
  }
  return permitirVacio ? "" : null;
}

function aplicarConvocatoriaControlPlanilla(control, valor) {
  const convocatoria = normalizarConvocatoriaPlanilla(valor, { permitirVacio: true }) || "";
  if (control instanceof HTMLSelectElement) {
    control.value = convocatoria;
    return convocatoria;
  }
  if (control instanceof HTMLInputElement && control.type === "checkbox") {
    control.checked = convocatoria === "P";
    control.indeterminate = convocatoria === "";
    control.dataset.convocatoria = convocatoria;
    return convocatoria;
  }
  return convocatoria;
}

function obtenerConvocatoriaFilaPlanilla(row, { permitirVacio = true } = {}) {
  if (!(row instanceof HTMLElement) || !usaConvocatoriaPlanilla()) {
    return permitirVacio ? "" : null;
  }
  return leerConvocatoriaControlPlanilla(row.querySelector(".cap-convocatoria"), { permitirVacio }) || "";
}

function leerBooleanoRegistroPlanilla(valor) {
  if (typeof valor === "boolean") return valor;
  const raw = String(valor ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return false;
  return ["1", "true", "si", "sí", "yes", "y", "x", "on"].includes(raw);
}

function obtenerRegistroPlanillaJugador(jugador = {}) {
  const registro = jugador?.planilla_registro && typeof jugador.planilla_registro === "object"
    ? jugador.planilla_registro
    : {};
  return {
    numero_camiseta:
      normalizarNumeroCamisetaPlanilla(
        registro.numero_camiseta ?? jugador?.numero_camiseta ?? "",
        { permitirVacio: true }
      ) || "",
    convocatoria:
      normalizarConvocatoriaPlanilla(
        registro.convocatoria ?? registro.lineupRole ?? "",
        { permitirVacio: true }
      ) || "",
    entra: esPlanillaFutbol11() ? leerBooleanoRegistroPlanilla(registro.entra ?? registro.enters) : false,
    sale: esPlanillaFutbol11() ? leerBooleanoRegistroPlanilla(registro.sale ?? registro.exits) : false,
  };
}

function actualizarRegistroJugadorEnDataPlanilla(jugadorIdRaw, equipoIdRaw, cambios = {}) {
  const jugadorId = Number.parseInt(jugadorIdRaw, 10);
  const equipoId = Number.parseInt(equipoIdRaw, 10);
  if (!Number.isFinite(jugadorId) || jugadorId <= 0 || !dataPlanilla) return;

  ["plantel_local", "plantel_visitante"].forEach((key) => {
    const lista = Array.isArray(dataPlanilla?.[key]) ? dataPlanilla[key] : [];
    const jugador = lista.find((item) => Number.parseInt(item?.id, 10) === jugadorId);
    if (!jugador) return;
    const jugadorEquipoId = Number.parseInt(jugador?.equipo_id, 10);
    if (Number.isFinite(equipoId) && equipoId > 0 && jugadorEquipoId !== equipoId) return;

    const actual = obtenerRegistroPlanillaJugador(jugador);
    const siguienteNumero = Object.prototype.hasOwnProperty.call(cambios, "numero_camiseta")
      ? normalizarNumeroCamisetaPlanilla(cambios.numero_camiseta, { permitirVacio: true }) || ""
      : actual.numero_camiseta;
    const siguienteConvocatoria = Object.prototype.hasOwnProperty.call(cambios, "convocatoria")
      ? normalizarConvocatoriaPlanilla(cambios.convocatoria, { permitirVacio: true }) || ""
      : actual.convocatoria;
    const siguienteEntra = Object.prototype.hasOwnProperty.call(cambios, "entra")
      ? leerBooleanoRegistroPlanilla(cambios.entra)
      : actual.entra;
    const siguienteSale = Object.prototype.hasOwnProperty.call(cambios, "sale")
      ? leerBooleanoRegistroPlanilla(cambios.sale)
      : actual.sale;

    jugador.numero_camiseta = siguienteNumero || null;
    jugador.planilla_registro = {
      numero_camiseta: siguienteNumero || null,
      convocatoria: siguienteConvocatoria || null,
      entra: esPlanillaFutbol11() ? siguienteEntra : false,
      sale: esPlanillaFutbol11() ? siguienteSale : false,
    };
  });
}

function aplicarRegistroPlanillaAPlanteles() {
  if (!dataPlanilla) return;
  const registroLocal = Array.isArray(dataPlanilla?.planilla?.registro_jugadores_local)
    ? dataPlanilla.planilla.registro_jugadores_local
    : [];
  const registroVisitante = Array.isArray(dataPlanilla?.planilla?.registro_jugadores_visitante)
    ? dataPlanilla.planilla.registro_jugadores_visitante
    : [];
  const mapaLocal = new Map(registroLocal.map((item) => [Number.parseInt(item?.jugador_id, 10), item]));
  const mapaVisitante = new Map(registroVisitante.map((item) => [Number.parseInt(item?.jugador_id, 10), item]));

  const aplicar = (key, mapa) => {
    const lista = Array.isArray(dataPlanilla?.[key]) ? dataPlanilla[key] : [];
    dataPlanilla[key] = lista.map((jugador) => {
      const item = mapa.get(Number.parseInt(jugador?.id, 10)) || jugador?.planilla_registro || {};
      const numero = normalizarNumeroCamisetaPlanilla(
        item?.numero_camiseta ?? jugador?.numero_camiseta ?? "",
        { permitirVacio: true }
      );
      return {
        ...jugador,
        numero_camiseta: numero || null,
        planilla_registro: {
          numero_camiseta: numero || null,
          convocatoria: normalizarConvocatoriaPlanilla(item?.convocatoria, { permitirVacio: true }) || null,
          entra: esPlanillaFutbol11() ? leerBooleanoRegistroPlanilla(item?.entra) : false,
          sale: esPlanillaFutbol11() ? leerBooleanoRegistroPlanilla(item?.sale) : false,
        },
      };
    });
  };

  aplicar("plantel_local", mapaLocal);
  aplicar("plantel_visitante", mapaVisitante);
}

function normalizarFechaISO(valor) {
  if (!valor) return "";
  const str = String(valor);
  if (str.includes("T")) return str.split("T")[0];
  return str.slice(0, 10);
}

function formatearFecha(valor) {
  const iso = normalizarFechaISO(valor);
  if (!iso) return "Por definir";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function obtenerNumeroPartidoVisible(partido) {
  const n = Number.parseInt(partido?.numero_campeonato, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return null;
}

function esPartidoPlayoffPlanilla(partido = {}) {
  return (
    String(partido?.origen_fase || "").trim().toLowerCase() === "playoff" ||
    normalizarRondaPlayoffPlanilla(partido?.playoff_ronda || "") !== "" ||
    normalizarRondaPlayoffPlanilla(partido?.ronda || "") !== "" ||
    Number.parseInt(partido?.reclasificacion_playoff_id, 10) > 0
  );
}

function formatearRondaPlayoffPlanilla(ronda = "") {
  const raw = normalizarRondaPlayoffPlanilla(ronda);
  if (!raw) return "Playoff";

  const mapa = {
    reclasificacion: "Reclasificación",
    "32vos": "32vos",
    "16vos": "16vos",
    "12vos": "12vos",
    "8vos": "Octavos",
    "4tos": "Cuartos",
    semifinal: "Semifinal",
    final: "Final",
    tercer_y_cuarto: "Tercer y cuarto",
  };
  return mapa[raw] || raw.replaceAll("_", " ");
}

function obtenerEtiquetaCrucePlayoffPlanilla(partido = {}) {
  if (Number.parseInt(partido?.reclasificacion_playoff_id, 10) > 0) {
    const grupo = String(partido?.reclasificacion_grupo_letra || "").trim().toUpperCase();
    const cupo = Number.parseInt(partido?.reclasificacion_slot_posicion, 10);
    const partes = ["Reclasificación"];
    if (Number.isFinite(cupo) && cupo > 0) partes.push(`Cupo ${cupo}`);
    if (grupo) partes.push(`Grupo ${grupo}`);
    return partes.join(" · ");
  }

  const ronda = normalizarRondaPlayoffPlanilla(partido?.playoff_ronda || partido?.ronda || "");
  const numero = Number.parseInt(partido?.partido_numero ?? partido?.playoff_partido_numero, 10);
  if (ronda === "final") return "Final";
  if (ronda === "tercer_y_cuarto") return "Tercer y cuarto";
  if (!Number.isFinite(numero) || numero <= 0) return formatearRondaPlayoffPlanilla(ronda);

  const prefijos = {
    "32vos": "32VO",
    "16vos": "16VO",
    "12vos": "12VO",
    "8vos": "8VO",
    "4tos": "4TO",
    semifinal: "SEM",
  };
  return `${prefijos[ronda] || formatearRondaPlayoffPlanilla(ronda).toUpperCase()} P${numero}`;
}

function obtenerPartidosActivosSelectorPlanilla() {
  return faseSelectorActual === "playoff" ? partidosSelectorPlayoffCache : partidosSelectorRegularCache;
}

function sincronizarCacheActivoSelectorPlanilla() {
  partidosSelectorCache = [...obtenerPartidosActivosSelectorPlanilla()];
}

function filtrarPartidosSelectorPorRonda(partidos = []) {
  if (!rondaSelectorActual) return [...partidos];
  return partidos.filter(
    (p) =>
      normalizarRondaPlayoffPlanilla(p?.playoff_ronda || p?.ronda || "") ===
      normalizarRondaPlayoffPlanilla(rondaSelectorActual)
  );
}

function estadoPlanillaEsCerrado(estado = "") {
  const raw = String(estado || "").trim().toLowerCase();
  return ESTADOS_PLANILLA_CERRADOS.has(raw);
}

function formatearMoneda(valor) {
  const n = aDecimal(valor, 0);
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatearAvisoMorosidadPlanilla(aviso = null) {
  if (!aviso || typeof aviso !== "object") return "";
  const equipos = Array.isArray(aviso.equipos)
    ? aviso.equipos
        .map((item) => {
          const nombre = String(item?.nombre || "").trim() || "Equipo";
          const saldo = aDecimal(item?.saldo, 0);
          return `${nombre}: ${formatearMoneda(saldo)}`;
        })
        .filter(Boolean)
    : [];
  if (!equipos.length) return "";
  return `Saldo pendiente hasta el momento: ${equipos.join(" | ")}`;
}

function aDecimalOpcional(valor) {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).trim();
  if (!s) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function leerPagoInput(id) {
  const n = aDecimalOpcional(document.getElementById(id)?.value);
  return n === null ? 0 : n;
}

function normalizarInasistenciaPlanilla(valor) {
  const raw = String(valor || "ninguno").trim().toLowerCase();
  return INASISTENCIAS_PLANILLA_VALIDAS.has(raw) ? raw : "ninguno";
}

function obtenerInasistenciaPlanilla() {
  const select = document.getElementById("inasistencia-planilla");
  if (select instanceof HTMLSelectElement) {
    return normalizarInasistenciaPlanilla(select.value);
  }
  return "ninguno";
}

function obtenerLadosBloqueadosPlanilla(tipo = obtenerInasistenciaPlanilla()) {
  const normalizado = normalizarInasistenciaPlanilla(tipo);
  const observacionesLocal = obtenerObservacionesLocalPlanilla();
  const observacionesVisitante = obtenerObservacionesVisitantePlanilla();

  return {
    local: normalizado === "local" || normalizado === "ambos",
    visitante: normalizado === "visitante" || normalizado === "ambos",
  };
}

function obtenerLadoEquipoPlanilla(equipoIdRaw) {
  const equipoId = Number(equipoIdRaw);
  if (equipoId === Number(equiposPartido.local.id)) return "local";
  if (equipoId === Number(equiposPartido.visitante.id)) return "visitante";
  return "";
}

function estaEquipoBloqueadoPlanilla(equipoIdRaw, tipo = obtenerInasistenciaPlanilla()) {
  const lado = obtenerLadoEquipoPlanilla(equipoIdRaw);
  if (!lado) return false;
  const bloqueados = obtenerLadosBloqueadosPlanilla(tipo);
  return bloqueados[lado] === true;
}

function normalizarConteoFaltasPlanilla(valor, fallback = 0) {
  const n = aEntero(valor, fallback);
  return Math.min(Math.max(n, 0), MAX_FALTAS_PLANILLA);
}

function normalizarEstadoFaltasPlanilla(faltas = {}) {
  const local1 = normalizarConteoFaltasPlanilla(
    faltas?.local_1er ?? faltas?.local_1 ?? faltas?.local_primer_tiempo ?? faltas?.faltas_local_1er
  );
  const local2 = normalizarConteoFaltasPlanilla(
    faltas?.local_2do ?? faltas?.local_2 ?? faltas?.local_segundo_tiempo ?? faltas?.faltas_local_2do
  );
  const visitante1 = normalizarConteoFaltasPlanilla(
    faltas?.visitante_1er ??
      faltas?.visitante_1 ??
      faltas?.visitante_primer_tiempo ??
      faltas?.faltas_visitante_1er
  );
  const visitante2 = normalizarConteoFaltasPlanilla(
    faltas?.visitante_2do ??
      faltas?.visitante_2 ??
      faltas?.visitante_segundo_tiempo ??
      faltas?.faltas_visitante_2do
  );

  return {
    local_1er: local1,
    local_2do: local2,
    visitante_1er: visitante1,
    visitante_2do: visitante2,
    local_total: local1 + local2,
    visitante_total: visitante1 + visitante2,
  };
}

function obtenerEstadoFaltasPlanilla() {
  dataPlanilla = dataPlanilla || {};
  dataPlanilla.faltas = normalizarEstadoFaltasPlanilla(dataPlanilla.faltas || {});
  return dataPlanilla.faltas;
}

function actualizarEstadoFaltasPlanilla(lado, tiempo, valor) {
  const faltas = obtenerEstadoFaltasPlanilla();
  const claveMap = { 1: "1er", 2: "2do", 3: "3er", 4: "4to" };
  const clave = `${lado}_${claveMap[tiempo] || "1er"}`;
  const siguienteValor = normalizarConteoFaltasPlanilla(valor, 0);
  faltas[clave] = faltas[clave] === siguienteValor ? 0 : siguienteValor;
  faltas.local_total = (faltas.local_1er || 0) + (faltas.local_2do || 0) + (faltas.local_3er || 0) + (faltas.local_4to || 0);
  faltas.visitante_total = (faltas.visitante_1er || 0) + (faltas.visitante_2do || 0) + (faltas.visitante_3er || 0) + (faltas.visitante_4to || 0);
  dataPlanilla.faltas = faltas;
}

function estaMarcadoAmbosNoPresentes() {
  return obtenerInasistenciaPlanilla() === "ambos";
}

function hayInasistenciaPlanilla() {
  return obtenerInasistenciaPlanilla() !== "ninguno";
}

function obtenerResultadoPorInasistencia(tipo = "ninguno") {
  switch (normalizarInasistenciaPlanilla(tipo)) {
    case "local":
      return { local: 0, visitante: GOLES_WALKOVER, estado: "finalizado" };
    case "visitante":
      return { local: GOLES_WALKOVER, visitante: 0, estado: "finalizado" };
    case "ambos":
      return { local: null, visitante: null, estado: "no_presentaron_ambos" };
    default:
      return { local: null, visitante: null, estado: null };
  }
}

function formatearMarcadorPlanilla(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return "";
  return String(aEntero(valor, 0));
}

function normalizarMarcadorPenalesPlanilla(valor, { permitirVacio = true } = {}) {
  if (valor === undefined || valor === null || String(valor).trim() === "") {
    return permitirVacio ? null : 0;
  }
  const limpio = String(valor).replace(/\D+/g, "").slice(0, 2);
  if (!limpio) return permitirVacio ? null : 0;
  const numero = Number.parseInt(limpio, 10);
  if (!Number.isFinite(numero) || numero < 0) {
    return permitirVacio ? null : 0;
  }
  return numero;
}

function obtenerDatosPenalesPlanilla(payload = {}, partido = dataPlanilla?.partido || {}) {
  const resultadoLocal = aEntero(
    payload?.resultado_local ?? document.getElementById("resultado-local")?.value ?? partido?.resultado_local,
    0
  );
  const resultadoVisitante = aEntero(
    payload?.resultado_visitante ?? document.getElementById("resultado-visitante")?.value ?? partido?.resultado_visitante,
    0
  );
  const shootoutsLocal = normalizarMarcadorPenalesPlanilla(
    payload?.resultado_local_shootouts ??
      payload?.shootouts_local ??
      document.getElementById("resultado-local-penales")?.value ??
      partido?.resultado_local_shootouts,
    { permitirVacio: true }
  );
  const shootoutsVisitante = normalizarMarcadorPenalesPlanilla(
    payload?.resultado_visitante_shootouts ??
      payload?.shootouts_visitante ??
      document.getElementById("resultado-visitante-penales")?.value ??
      partido?.resultado_visitante_shootouts,
    { permitirVacio: true }
  );
  const tieneCarga = Number.isFinite(shootoutsLocal) || Number.isFinite(shootoutsVisitante);
  const empate = resultadoLocal === resultadoVisitante;
  const esPlayoff = esPartidoPlayoffPlanilla(partido);
  const ganadorLocal =
    Number.isFinite(shootoutsLocal) &&
    Number.isFinite(shootoutsVisitante) &&
    shootoutsLocal > shootoutsVisitante;
  const ganadorId =
    Number.isFinite(shootoutsLocal) && Number.isFinite(shootoutsVisitante) && shootoutsLocal !== shootoutsVisitante
      ? ganadorLocal
        ? Number(partido?.equipo_local_id)
        : Number(partido?.equipo_visitante_id)
      : null;
  const ganadorNombre =
    ganadorId === Number(partido?.equipo_local_id)
      ? partido?.equipo_local_nombre || equiposPartido.local.nombre
      : ganadorId === Number(partido?.equipo_visitante_id)
        ? partido?.equipo_visitante_nombre || equiposPartido.visitante.nombre
        : "";

  return {
    esPlayoff,
    resultadoLocal,
    resultadoVisitante,
    shootoutsLocal,
    shootoutsVisitante,
    empate,
    tieneCarga,
    aplica:
      esPlayoff &&
      empate &&
      Number.isFinite(shootoutsLocal) &&
      Number.isFinite(shootoutsVisitante) &&
      shootoutsLocal !== shootoutsVisitante,
    ganadorId,
    ganadorNombre,
  };
}

function obtenerResumenPenalesPlanilla(payload = {}, partido = dataPlanilla?.partido || {}) {
  const datos = obtenerDatosPenalesPlanilla(payload, partido);
  if (!datos.aplica) {
    return { aplica: false, texto: "", clasificaTexto: "", ganadorId: null, ganadorNombre: "" };
  }
  return {
    aplica: true,
    texto: `Penales: ${datos.shootoutsLocal} - ${datos.shootoutsVisitante}`,
    clasificaTexto: `Clasifica ${datos.ganadorNombre} por penales`,
    ganadorId: datos.ganadorId,
    ganadorNombre: datos.ganadorNombre,
  };
}

function actualizarVisibilidadPenalesPlanilla() {
  const grupo = document.getElementById("grupo-penales-planilla");
  if (!(grupo instanceof HTMLElement)) return;

  const esPlayoff = esPartidoPlayoffPlanilla(dataPlanilla?.partido || {});
  grupo.hidden = !esPlayoff;
  if (!esPlayoff) return;

  const inputLocal = document.getElementById("resultado-local-penales");
  const inputVisitante = document.getElementById("resultado-visitante-penales");
  const bloqueado = hayInasistenciaPlanilla();
  if (inputLocal instanceof HTMLInputElement) inputLocal.disabled = bloqueado;
  if (inputVisitante instanceof HTMLInputElement) inputVisitante.disabled = bloqueado;

  const hint = grupo.querySelector(".planilla-penales-hint");
  if (!(hint instanceof HTMLElement)) return;

  const datos = obtenerDatosPenalesPlanilla();
  if (bloqueado) {
    hint.textContent = "La definición por penales no aplica cuando hay inasistencia o walkover.";
    return;
  }
  if (datos.empate) {
    hint.textContent = "Empate detectado. Registra la tanda de penales para definir al clasificado.";
    return;
  }
  hint.textContent = "Solo para playoff: si el partido termina empatado, registra aquí la definición por penales.";
}

function actualizarVisibilidadOvertimePlanilla() {
  const grupo = document.getElementById("grupo-overtime-planilla");
  if (!(grupo instanceof HTMLElement)) return;
  if (!esPlanillaBasquetbol()) {
    grupo.hidden = true;
    grupo.style.display = "none";
    const overtimeLocal = document.getElementById("resultado-overtime-local");
    const overtimeVisitante = document.getElementById("resultado-overtime-visitante");
    if (overtimeLocal instanceof HTMLInputElement) overtimeLocal.value = "";
    if (overtimeVisitante instanceof HTMLInputElement) overtimeVisitante.value = "";
    return;
  }
  const local = aEntero(document.getElementById("resultado-local")?.value, 0);
  const visitante = aEntero(document.getElementById("resultado-visitante")?.value, 0);
  const empate = local === visitante;
  grupo.hidden = !empate;
  grupo.style.display = empate ? "grid" : "none";
  const hint = grupo.querySelector(".planilla-overtime-hint");
  if (hint instanceof HTMLElement) {
    hint.textContent = empate
      ? "Empate detectado. Registra los puntos del tiempo extra si aplica."
      : "Baloncesto: si el partido termina empatado, registra los puntos del tiempo extra (overtime).";
  }
}

function actualizarEtiquetasPlanillaPorDeporte() {
  const hintResultado = document.querySelector("#planilla-form .form-hint");
  const labelsTa = document.querySelectorAll("label[for='resumen-ta-local'], label[for='resumen-ta-visitante']");
  const labelsTr = document.querySelectorAll("label[for='resumen-tr-local'], label[for='resumen-tr-visitante']");
  const labelsPagoTa = document.querySelectorAll("label[for='pago-ta-local'], label[for='pago-ta-visitante']");
  const labelsPagoTr = document.querySelectorAll("label[for='pago-tr-local'], label[for='pago-tr-visitante']");
  labelsTa.forEach((el) => {
    el.textContent = PLANILLA_LABELS_DEFAULT.resumenTa;
  });
  labelsTr.forEach((el) => {
    el.textContent = PLANILLA_LABELS_DEFAULT.resumenTr;
  });
  labelsPagoTa.forEach((el) => {
    el.textContent = PLANILLA_LABELS_DEFAULT.pagoTa;
  });
  labelsPagoTr.forEach((el) => {
    el.textContent = PLANILLA_LABELS_DEFAULT.pagoTr;
  });
  if (hintResultado instanceof HTMLElement) {
    hintResultado.textContent = PLANILLA_LABELS_DEFAULT.hintResultado;
  }

  if (!esPlanillaBasquetbol()) return;

  labelsTa.forEach((el) => {
    el.textContent = "Faltas personales";
  });
  labelsTr.forEach((el) => {
    el.textContent = "Faltas técnicas";
  });
  labelsPagoTa.forEach((el) => {
    el.textContent = "Faltas (pago)";
  });
  labelsPagoTr.forEach((el) => {
    el.textContent = "Faltas técnicas (pago)";
  });
  if (hintResultado instanceof HTMLElement) {
    hintResultado.textContent = "El puntaje se calcula automáticamente desde la tabla de jugadores y se refleja en la cabecera.";
  }
}

function actualizarHeaderPenales(payload = null) {
  const head = document.getElementById("head-penales");
  if (!(head instanceof HTMLElement)) return;
  const resumen = obtenerResumenPenalesPlanilla(payload || {}, dataPlanilla?.partido || {});
  if (!resumen.aplica) {
    head.textContent = "";
    head.classList.add("is-hidden");
    return;
  }
  head.textContent = `${resumen.texto} • ${resumen.clasificaTexto}`;
  head.classList.remove("is-hidden");
}

function validarPenalesPlanilla(payload = {}, partido = dataPlanilla?.partido || {}) {
  const datos = obtenerDatosPenalesPlanilla(payload, partido);
  const estado = String(payload?.estado ?? partido?.estado ?? "").trim().toLowerCase();
  const inasistencia = normalizarInasistenciaPlanilla(payload?.inasistencia_equipo);
  if (!datos.esPlayoff || inasistencia !== "ninguno" || payload?.ambos_no_presentes === true) return null;
  if (estado !== "finalizado" || !datos.empate) return null;
  if (!Number.isFinite(datos.shootoutsLocal) || !Number.isFinite(datos.shootoutsVisitante)) {
    return "En playoff, si el partido termina empatado debes registrar penales para definir al clasificado.";
  }
  if (datos.shootoutsLocal === datos.shootoutsVisitante) {
    return "En playoff, los penales no pueden terminar empatados.";
  }
  return null;
}

function obtenerMensajeInasistencia(tipo = "ninguno") {
  switch (normalizarInasistenciaPlanilla(tipo)) {
    case "local":
      return `Se registra walkover: gana ${equiposPartido.visitante.nombre || "Visitante"} ${GOLES_WALKOVER}-0. El equipo local recibe multa equivalente al arbitraje.`;
    case "visitante":
      return `Se registra walkover: gana ${equiposPartido.local.nombre || "Local"} ${GOLES_WALKOVER}-0. El equipo visitante recibe multa equivalente al arbitraje.`;
    case "ambos":
      return "Se registrará una multa equivalente al arbitraje para ambos equipos. El partido no sumará puntos ni goles.";
    default:
      return "Si hay inasistencia, el sistema bloqueará el registro por jugador, aplicará el resultado automático y generará la multa por arbitraje.";
  }
}

function tienePagosRegistrados(pagos = {}) {
  return (
    aDecimal(pagos.pago_local, 0) > 0 ||
    aDecimal(pagos.pago_visitante, 0) > 0 ||
    aDecimal(pagos.pago_arbitraje_local, 0) > 0 ||
    aDecimal(pagos.pago_arbitraje_visitante, 0) > 0 ||
    aDecimal(pagos.pago_ta_local, 0) > 0 ||
    aDecimal(pagos.pago_ta_visitante, 0) > 0 ||
    aDecimal(pagos.pago_tr_local, 0) > 0 ||
    aDecimal(pagos.pago_tr_visitante, 0) > 0
  );
}

function planillaSinDatosDeJuego(payload = {}) {
  if (normalizarInasistenciaPlanilla(payload.inasistencia_equipo) !== "ninguno") return false;
  if (payload.ambos_no_presentes === true) return false;
  const goles = Array.isArray(payload.goles) ? payload.goles : [];
  const tarjetas = Array.isArray(payload.tarjetas) ? payload.tarjetas : [];
  const penales = obtenerDatosPenalesPlanilla(payload);
  return (
    goles.length === 0 &&
    tarjetas.length === 0 &&
    !tienePagosRegistrados(payload.pagos || {}) &&
    !penales.tieneCarga
  );
}

function formatearMonedaPlanilla(valor, mostrarEnBlanco = false) {
  const n = aDecimal(valor, 0);
  if (mostrarEnBlanco && n <= 0) return "";
  return formatearMoneda(n);
}

function formatearConteoPlanilla(valor, mostrarEnBlanco = false) {
  const n = aEntero(valor, 0);
  if (mostrarEnBlanco && n <= 0) return "";
  return String(n);
}

function hayDatosEnFormularioPlanilla() {
  if (hayInasistenciaPlanilla()) return true;
  const tot = calcularTotalesCaptura();
  const hayCaptura =
    tot.local.goles > 0 ||
    tot.visitante.goles > 0 ||
    tot.local.ta > 0 ||
    tot.local.tr > 0 ||
    tot.visitante.ta > 0 ||
    tot.visitante.tr > 0;
  const hayPagos = tienePagosRegistrados({
    pago_local: leerPagoInput("pago-local"),
    pago_visitante: leerPagoInput("pago-visitante"),
    pago_arbitraje_local: leerPagoInput("pago-arbitraje-local"),
    pago_arbitraje_visitante: leerPagoInput("pago-arbitraje-visitante"),
    pago_ta_local: leerPagoInput("pago-ta-local"),
    pago_ta_visitante: leerPagoInput("pago-ta-visitante"),
    pago_tr_local: leerPagoInput("pago-tr-local"),
    pago_tr_visitante: leerPagoInput("pago-tr-visitante"),
  });
  const penales = obtenerDatosPenalesPlanilla();
  const hayPenales = penales.tieneCarga;
  return hayCaptura || hayPagos || hayPenales;
}

function limpiarCapturaPlanilla() {
  document.querySelectorAll(".planilla-player-row input").forEach((input) => {
    if (input instanceof HTMLInputElement) input.value = "";
  });
  recalcularTotalesCapturaEquipo("captura-local");
  recalcularTotalesCapturaEquipo("captura-visitante");
  actualizarResumenFooterDesdeCaptura();
}

function limpiarCapturaPlanillaPorLado(lado) {
  const contenedorId = lado === "local" ? "captura-local" : "captura-visitante";
  document.querySelectorAll(`#${contenedorId} .planilla-player-row input`).forEach((input) => {
    if (input instanceof HTMLInputElement) input.value = "";
  });
  recalcularTotalesCapturaEquipo(contenedorId);
  actualizarResumenFooterDesdeCaptura();
}

function limpiarPagosPlanilla() {
  IDS_PAGOS_PLANILLA.forEach((id) => {
    const input = document.getElementById(id);
    if (input instanceof HTMLInputElement) input.value = "";
  });
}

function limpiarPagosPlanillaPorLado(lado) {
  const ids = lado === "local" ? IDS_PAGOS_PLANILLA_LOCAL : IDS_PAGOS_PLANILLA_VISITANTE;
  ids.forEach((id) => {
    const input = document.getElementById(id);
    if (input instanceof HTMLInputElement) input.value = "";
  });
}

function aplicarEstadoInasistenciaPlanilla(forzarLimpieza = false) {
  const tipo = obtenerInasistenciaPlanilla();
  const bloqueados = obtenerLadosBloqueadosPlanilla(tipo);
  const especial = bloqueados.local || bloqueados.visitante;
  const selectEstado = document.getElementById("estado-partido");
  const hint = document.getElementById("inasistencia-planilla-hint");
  const resultadoAutomatico = obtenerResultadoPorInasistencia(tipo);

  if (selectEstado) {
    if (especial) {
      selectEstado.value = resultadoAutomatico.estado || "finalizado";
      selectEstado.disabled = true;
    } else {
      if (selectEstado.value === "no_presentaron_ambos") {
        selectEstado.value = "finalizado";
      }
      selectEstado.disabled = false;
    }
  }

  [
    { lado: "local", contenedorId: "captura-local" },
    { lado: "visitante", contenedorId: "captura-visitante" },
  ].forEach(({ lado, contenedorId }) => {
    const cont = document.getElementById(contenedorId);
    if (!(cont instanceof HTMLElement)) return;
    const bloqueado = bloqueados[lado] === true;
    cont.classList.toggle("planilla-bloqueado", bloqueado);
    cont.querySelectorAll(".planilla-player-row input").forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      const filaSuspendida = input.closest(".planilla-player-row.is-suspended");
      input.disabled = bloqueado || !!filaSuspendida;
    });
    cont.querySelectorAll(".btn-inscribir-planilla").forEach((btn) => {
      if (btn instanceof HTMLButtonElement) btn.disabled = bloqueado;
    });
  });

  IDS_PAGOS_PLANILLA_LOCAL.forEach((id) => {
    const input = document.getElementById(id);
    if (input instanceof HTMLInputElement) input.disabled = bloqueados.local === true;
  });
  IDS_PAGOS_PLANILLA_VISITANTE.forEach((id) => {
    const input = document.getElementById(id);
    if (input instanceof HTMLInputElement) input.disabled = bloqueados.visitante === true;
  });

  if (especial) {
    if (forzarLimpieza) {
      if (bloqueados.local) {
        limpiarCapturaPlanillaPorLado("local");
        limpiarPagosPlanillaPorLado("local");
      }
      if (bloqueados.visitante) {
        limpiarCapturaPlanillaPorLado("visitante");
        limpiarPagosPlanillaPorLado("visitante");
      }
    }
    const inputLocal = document.getElementById("resultado-local");
    const inputVisitante = document.getElementById("resultado-visitante");
    if (inputLocal) inputLocal.value = resultadoAutomatico.local == null ? "" : String(resultadoAutomatico.local);
    if (inputVisitante) inputVisitante.value = resultadoAutomatico.visitante == null ? "" : String(resultadoAutomatico.visitante);
    actualizarHeaderResultado(resultadoAutomatico.local, resultadoAutomatico.visitante);
    if (hint) {
      hint.textContent = obtenerMensajeInasistencia(tipo);
      hint.classList.add("is-warning");
    }
    renderFaltasVisual();
    actualizarResumenFooterDesdeCaptura();
    return;
  }

  if (hint) {
    hint.textContent = obtenerMensajeInasistencia("ninguno");
    hint.classList.remove("is-warning");
  }
  renderFaltasVisual();
  actualizarResumenFooterDesdeCaptura();
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function puedeInscribirJugadoresEnPlanilla() {
  const rol = String(window.Auth?.getUser?.()?.rol || "").trim().toLowerCase();
  if (window.Auth?.isReadOnly?.()) return false;
  return ["administrador", "organizador", "operador_sistema", "tecnico", "dirigente"].includes(rol);
}

function normalizarArchivoUrl(url) {
  if (!url) return "";
  const raw = String(url).trim();
  if (!raw) return "";
  const normal = raw.replaceAll("\\", "/");
  if (/^https?:\/\//i.test(normal)) return normal;

  const apiBase = String(
    window.resolveApiBaseUrl
      ? window.resolveApiBaseUrl()
      : window.API_BASE_URL || `${window.location.origin}/api`
  );
  const backendBase = apiBase.replace(/\/api\/?$/i, "");
  if (normal.startsWith(`${backendBase}/`)) return normal;
  if (normal.startsWith("/")) return `${backendBase}${normal}`;
  return `${backendBase}/${normal}`;
}

async function cargarAuspiciantesActivosPlanilla(campeonatoId) {
  const id = Number(campeonatoId);
  if (!Number.isFinite(id) || id <= 0 || !window.AuspiciantesAPI?.listarPorCampeonato) return [];
  try {
    const dataActivos = await window.AuspiciantesAPI.listarPorCampeonato(id, true);
    const activos = Array.isArray(dataActivos?.auspiciantes) ? dataActivos.auspiciantes : [];
    if (activos.length) return activos;

    const dataTodos = await window.AuspiciantesAPI.listarPorCampeonato(id, false);
    return Array.isArray(dataTodos?.auspiciantes) ? dataTodos.auspiciantes : [];
  } catch (error) {
    console.warn("No se pudieron cargar auspiciantes para planilla:", error);
    return [];
  }
}

function obtenerAuspiciantesVisiblesPlanilla() {
  return (Array.isArray(dataPlanilla?.auspiciantes) ? dataPlanilla.auspiciantes : [])
    .map((item) => ({
      nombre: String(item?.nombre || item?.titulo || "").trim(),
      logo_url: normalizarArchivoUrl(item?.logo_url || item?.imagen_url || ""),
    }))
    .filter((item) => item.logo_url || item.nombre)
    .slice(0, 4);
}

function renderLogoEquipoPlanilla(src, alt, clase = "planilla-head-team-logo") {
  if (src) {
    return `<img src="${src}" alt="${escapeHtml(alt)}" class="${clase}" />`;
  }
  return `<span class="${clase} logo-fallback" aria-hidden="true">LT&C</span>`;
}

function renderAuspiciantesHeaderPlanilla(claseBase = "planilla-head") {
  const auspiciantes = obtenerAuspiciantesVisiblesPlanilla();
  if (!auspiciantes.length) return "";

  return auspiciantes
    .map((item) =>
      item.logo_url
        ? `<img src="${item.logo_url}" alt="${escapeHtml(item.nombre || "Auspiciante")}" class="${claseBase}-sponsor-logo" />`
        : `<span class="${claseBase}-sponsor-fallback">${escapeHtml(item.nombre || "Auspiciante")}</span>`
    )
    .join("");
}

function etiquetaGrupoPartido(p = {}) {
  if (p.letra_grupo) return `Grupo ${p.letra_grupo}`;
  if (p.nombre_grupo) return p.nombre_grupo;
  if (Number.isFinite(Number(p.grupo_id)) && Number(p.grupo_id) > 0) return `Grupo ${p.grupo_id}`;
  return "Sin grupo";
}

function obtenerContextoCompetenciaPlanilla(p = {}) {
  if (Number.parseInt(p?.reclasificacion_playoff_id, 10) > 0) {
    return {
      etiqueta: "Llave",
      valor: obtenerEtiquetaCrucePlayoffPlanilla(p),
      resumen: obtenerEtiquetaCrucePlayoffPlanilla(p),
    };
  }

  if (esPartidoPlayoffPlanilla(p)) {
    const rondaTxt = formatearRondaPlayoffPlanilla(p.playoff_ronda || p.ronda);
    const cruceTxt = obtenerEtiquetaCrucePlayoffPlanilla(p);
    return {
      etiqueta: "Llave",
      valor: rondaTxt,
      resumen: cruceTxt === rondaTxt ? rondaTxt : `${rondaTxt} · ${cruceTxt}`,
    };
  }

  const metodo = String(p?.metodo_competencia || "").trim().toLowerCase();
  if (metodo === "liga") {
    return {
      etiqueta: "Liga",
      valor: "Liga",
      resumen: "Liga",
    };
  }

  const grupo = etiquetaGrupoPartido(p);
  return {
    etiqueta: "Grupo",
    valor: grupo,
    resumen: grupo,
  };
}

function obtenerEtiquetaJornadaPlanilla(p = {}) {
  if (esPartidoPlayoffPlanilla(p)) return "";
  return Number.isFinite(Number(p.jornada)) ? `Jornada ${p.jornada}` : "Jornada -";
}

function obtenerResumenCompetenciaPlanilla(p = {}) {
  const contexto = obtenerContextoCompetenciaPlanilla(p);
  const jornada = obtenerEtiquetaJornadaPlanilla(p);
  return {
    contexto,
    jornada,
    linea: jornada ? `${jornada} • ${contexto.resumen}` : contexto.resumen,
  };
}

function obtenerClaveGrupoPartido(p = {}) {
  const grupoId = Number.parseInt(p?.grupo_id, 10);
  if (Number.isFinite(grupoId) && grupoId > 0) return `id:${grupoId}`;

  const letraGrupo = String(p?.letra_grupo || "")
    .trim()
    .toUpperCase();
  if (letraGrupo) return `letra:${letraGrupo}`;

  const nombreGrupo = String(p?.nombre_grupo || "").trim();
  if (nombreGrupo) return `nombre:${nombreGrupo.toLowerCase()}`;

  return "sin_grupo";
}

function filtrarPartidosSelectorPorGrupo(partidos = []) {
  if (faseSelectorActual === "playoff") return [...partidos];
  if (!grupoSelectorActual) return [...partidos];
  return partidos.filter((p) => obtenerClaveGrupoPartido(p) === grupoSelectorActual);
}

function formatearTipoFutbolTexto(tipo) {
  const txt = String(tipo || "")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!txt) return "FUTBOL";
  return txt.toUpperCase();
}

function obtenerTipoFutbolPlanilla() {
  return obtenerTipoDeportePlanillaNormalizado();
}

function esPlanillaFutbol11(partido = dataPlanilla?.partido || {}) {
  return obtenerTipoDeportePlanillaNormalizado(partido) === "futbol_11";
}

function esPlanillaBasquetbol(partido = dataPlanilla?.partido || {}) {
  return obtenerTipoDeportePlanillaNormalizado(partido).startsWith("basquetbol");
}

function obtenerDatosArbitrajePlanilla(partido = dataPlanilla?.partido || {}) {
  return {
    esFutbol11: esPlanillaFutbol11(partido),
    central: String(document.getElementById("arbitro-planilla")?.value || partido?.arbitro || "").trim(),
    linea1: String(
      document.getElementById("arbitro-linea-1-planilla")?.value || partido?.arbitro_linea_1 || ""
    ).trim(),
    linea2: String(
      document.getElementById("arbitro-linea-2-planilla")?.value || partido?.arbitro_linea_2 || ""
    ).trim(),
  };
}

function obtenerObservacionesArbitroPlanilla(payload = null) {
  const raw =
    payload && Object.prototype.hasOwnProperty.call(payload, "observaciones_arbitro")
      ? payload.observaciones_arbitro
      : dataPlanilla?.planilla?.observaciones_arbitro;
  return String(
    document.getElementById("observaciones-arbitro-planilla")?.value ?? raw ?? ""
  ).trim();
}

function obtenerObservacionesLocalPlanilla(payload = null) {
  const raw =
    payload && Object.prototype.hasOwnProperty.call(payload, "observaciones_local")
      ? payload.observaciones_local
      : dataPlanilla?.planilla?.observaciones_local ?? dataPlanilla?.planilla?.observaciones;
  return String(document.getElementById("observaciones-planilla")?.value ?? raw ?? "").trim();
}

function obtenerObservacionesVisitantePlanilla(payload = null) {
  const raw =
    payload && Object.prototype.hasOwnProperty.call(payload, "observaciones_visitante")
      ? payload.observaciones_visitante
      : dataPlanilla?.planilla?.observaciones_visitante;
  return String(
    document.getElementById("observaciones-visitante-planilla")?.value ?? raw ?? ""
  ).trim();
}

function actualizarVisibilidadArbitrajePlanilla() {
  const esF11 = esPlanillaFutbol11();
  document.querySelectorAll(".planilla-arbitraje-f11-only").forEach((item) => {
    if (item instanceof HTMLElement) item.hidden = !esF11;
  });
}

function combinarObservacionesPlanilla(
  observacionesLocal = "",
  observacionesVisitante = "",
  observacionesArbitro = ""
) {
  const partes = [];
  const localTxt = String(observacionesLocal || "").trim();
  const visitanteTxt = String(observacionesVisitante || "").trim();
  const arbitroTxt = String(observacionesArbitro || "").trim();
  if (localTxt) partes.push(`OBSERVACION LOCAL: ${localTxt}`);
  if (visitanteTxt) partes.push(`OBSERVACION VISITANTE: ${visitanteTxt}`);
  if (arbitroTxt) partes.push(`OBSERVACIONES DEL ARBITRO: ${arbitroTxt}`);
  return partes.join("\n\n");
}

function obtenerConfigExportacionPlanilla(tipoFutbol) {
  const tipo = String(tipoFutbol || "").trim().toLowerCase();
  const usaPlantillaF11 = ["futbol_11", "futbol_9", "futbol_8", "indor"].includes(tipo);

  if (usaPlantillaF11) {
    return {
      sheetName: "PLANILLAJUEGO FUTBOL 11",
      jugadores: { inicio: 16, fin: 41 },
      meta: {
        fecha: "D6",
        cancha: "N7",
        ciudad: "E8",
        equipoLocal: "E14",
        equipoVisitante: "N14",
        resultadoLocal: "G7",
        resultadoVisitante: "P7",
      },
      tarjetasResumen: {
        amarillasRow: 47,
        rojasRow: 48,
        colLocal: "G",
        colVisitante: "P",
      },
      observaciones: {
        rowInicio: 51,
        colLocal: "B",
        colVisitante: "K",
      },
      pagos: {
        arbitrajeRow: 57,
        tarjetasRojasRow: 58,
        tarjetasAmarillasRow: 59,
        inscripcionRow: 60,
        colLocal: "E",
        colVisitante: "N",
      },
    };
  }

  return {
    sheetName: "PLANILLAJUEGO FUTBOL 7, 5, SALA",
    jugadores: { inicio: 16, fin: 30 },
    meta: {
      fecha: "D6",
      cancha: "N7",
      ciudad: "E8",
      equipoLocal: "E14",
      equipoVisitante: "N14",
      resultadoLocal: "G7",
      resultadoVisitante: "P7",
    },
    tarjetasResumen: {
      amarillasRow: 36,
      rojasRow: 37,
      colLocal: "G",
      colVisitante: "P",
    },
    observaciones: {
      rowInicio: 40,
      colLocal: "B",
      colVisitante: "K",
    },
    pagos: {
      arbitrajeRow: 46,
      tarjetasRojasRow: 47,
      tarjetasAmarillasRow: 48,
      inscripcionRow: 49,
      colLocal: "E",
      colVisitante: "N",
    },
  };
}

function setCellValue(sheet, cellRef, value) {
  if (!sheet || !cellRef) return;
  const cell = sheet[cellRef] || {};

  if (value === null || value === undefined || value === "") {
    cell.t = "s";
    cell.v = "";
    cell.w = undefined;
    sheet[cellRef] = cell;
    return;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    cell.t = "n";
    cell.v = value;
  } else {
    cell.t = "s";
    cell.v = String(value);
  }

  cell.w = undefined;
  sheet[cellRef] = cell;
}

function limpiarRangoFilas(sheet, filaInicio, filaFin, columnas) {
  for (let fila = filaInicio; fila <= filaFin; fila += 1) {
    columnas.forEach((col) => setCellValue(sheet, `${col}${fila}`, ""));
  }
}

function sumarEnMapa(map, key, value = 1) {
  const actual = map.get(key) || 0;
  map.set(key, actual + value);
}

function tarjetaEsRojaPorDobleAmarilla(item = {}) {
  const tipo = String(item?.tipo_tarjeta || "").trim().toLowerCase();
  if (tipo !== "roja") return false;
  const observacion = String(item?.observacion || "").trim().toLowerCase();
  return observacion.includes("doble amarilla");
}

function normalizarConteoTarjetas(amarillas = 0, rojas = 0) {
  const ta = valorNoNegativoEntero(amarillas, 0, 99);
  const tr = valorNoNegativoEntero(rojas, 0, 99);
  const rojasPorDobleAmarilla = Math.floor(ta / 2);
  return {
    amarillas: ta % 2,
    rojas: tr + rojasPorDobleAmarilla,
    rojasDirectas: tr,
    rojasPorDobleAmarilla,
  };
}

function normalizarTarjetasPayload(tarjetas = []) {
  const grupos = new Map();
  const tarjetasDirectas = [];

  (Array.isArray(tarjetas) ? tarjetas : []).forEach((item) => {
    const tipo = String(item?.tipo_tarjeta || "").trim().toLowerCase();
    if (tipo !== "amarilla" && tipo !== "roja") return;

    const jugadorId = Number.parseInt(item?.jugador_id, 10);
    const equipoId = Number.parseInt(item?.equipo_id, 10);
    if (!Number.isFinite(jugadorId) || jugadorId <= 0 || !Number.isFinite(equipoId) || equipoId <= 0) {
      tarjetasDirectas.push({
        ...item,
        tipo_tarjeta: tipo,
      });
      return;
    }

    const key = `${equipoId}:${jugadorId}`;
    const bucket = grupos.get(key) || {
      equipo_id: equipoId,
      jugador_id: jugadorId,
      amarillas: 0,
      rojasDirectas: 0,
      rojasDobleAmarilla: 0,
      minuto: item?.minuto ?? null,
      observacionAmarilla: item?.observacion ?? null,
      observacionRojaDirecta: item?.observacion ?? null,
      observacionRojaDoble: "Expulsión por doble amarilla",
    };
    if (tipo === "amarilla") bucket.amarillas += 1;
    if (tipo === "amarilla" && item?.observacion) {
      bucket.observacionAmarilla = item.observacion;
    }
    if (tipo === "roja") {
      if (tarjetaEsRojaPorDobleAmarilla(item)) {
        bucket.rojasDobleAmarilla += 1;
        bucket.observacionRojaDoble = item.observacion || bucket.observacionRojaDoble;
      } else {
        bucket.rojasDirectas += 1;
        if (item?.observacion) bucket.observacionRojaDirecta = item.observacion;
      }
    }
    grupos.set(key, bucket);
  });

  const normalizadas = [...tarjetasDirectas];
  grupos.forEach((bucket) => {
    const conteo = normalizarConteoTarjetas(bucket.amarillas, bucket.rojasDirectas);
    const rojasDobleAmarilla = bucket.rojasDobleAmarilla + conteo.rojasPorDobleAmarilla;
    for (let i = 0; i < conteo.amarillas; i += 1) {
      normalizadas.push({
        equipo_id: bucket.equipo_id,
        jugador_id: bucket.jugador_id,
        tipo_tarjeta: "amarilla",
        minuto: bucket.minuto,
        observacion: bucket.observacionAmarilla,
      });
    }
    for (let i = 0; i < conteo.rojasDirectas; i += 1) {
      normalizadas.push({
        equipo_id: bucket.equipo_id,
        jugador_id: bucket.jugador_id,
        tipo_tarjeta: "roja",
        minuto: bucket.minuto,
        observacion: bucket.observacionRojaDirecta,
      });
    }
    for (let i = 0; i < rojasDobleAmarilla; i += 1) {
      normalizadas.push({
        equipo_id: bucket.equipo_id,
        jugador_id: bucket.jugador_id,
        tipo_tarjeta: "roja",
        minuto: bucket.minuto,
        observacion: bucket.observacionRojaDoble || "Expulsión por doble amarilla",
      });
    }
  });

  return normalizadas;
}

function normalizarTarjetasFilaCaptura(row) {
  if (!(row instanceof HTMLElement)) {
    return { amarillas: 0, rojas: 0, rojasDirectas: 0, rojasPorDobleAmarilla: 0 };
  }
  const inputTa = row.querySelector(".cap-ta");
  const inputTr = row.querySelector(".cap-tr");
  const presetActivo = row.dataset.tarjetasPreset === "1";

  if (presetActivo) {
    const amarillas = valorNoNegativoEntero(inputTa?.value, 0, 99);
    const rojas = valorNoNegativoEntero(inputTr?.value, 0, 99);
    const rojasPorDobleAmarilla = Math.min(
      valorNoNegativoEntero(row.dataset.rojasDobles, 0, 99),
      rojas
    );
    const conteoPreset = {
      amarillas,
      rojas,
      rojasDirectas: Math.max(rojas - rojasPorDobleAmarilla, 0),
      rojasPorDobleAmarilla,
    };
    row.dataset.rojasDobles = String(rojasPorDobleAmarilla);
    row.dataset.tarjetasPreset = rojasPorDobleAmarilla > 0 ? "1" : "";
    return conteoPreset;
  }

  const conteo = normalizarConteoTarjetas(inputTa?.value, inputTr?.value);

  if (inputTa instanceof HTMLInputElement) {
    inputTa.value = conteo.amarillas > 0 ? String(conteo.amarillas) : "";
  }
  if (inputTr instanceof HTMLInputElement) {
    inputTr.value = conteo.rojas > 0 ? String(conteo.rojas) : "";
  }
  row.dataset.rojasDobles = String(conteo.rojasPorDobleAmarilla || 0);
  row.dataset.tarjetasPreset = conteo.rojasPorDobleAmarilla > 0 ? "1" : "";

  return conteo;
}

function construirIndicesEventos(payload) {
  const tarjetasNormalizadas = normalizarTarjetasPayload(payload.tarjetas || []);
  const golesPorJugador = new Map();
  const amarillasPorJugador = new Map();
  const rojasPorJugador = new Map();
  const rojasDoblesPorJugador = new Map();

  let totalAmarillasLocal = 0;
  let totalRojasLocal = 0;
  let totalAmarillasVisitante = 0;
  let totalRojasVisitante = 0;

  const jugadoresPorId = new Map();
  [...(dataPlanilla?.plantel_local || []), ...(dataPlanilla?.plantel_visitante || [])].forEach((j) => {
    jugadoresPorId.set(Number(j.id), j);
  });

  (payload.goles || []).forEach((g) => {
    const jugadorId = Number(g.jugador_id);
    if (!Number.isFinite(jugadorId)) return;
    const goles = aEntero(g.goles, 0);
    if (goles <= 0) return;
    sumarEnMapa(golesPorJugador, jugadorId, goles);
  });

  tarjetasNormalizadas.forEach((t) => {
    const jugadorId = Number(t.jugador_id);
    const jugador = jugadoresPorId.get(jugadorId);
    const equipoId = Number(t.equipo_id) || Number(jugador?.equipo_id);
    const tipo = String(t.tipo_tarjeta || "").toLowerCase();

    if (tipo === "amarilla") {
      if (Number.isFinite(jugadorId)) sumarEnMapa(amarillasPorJugador, jugadorId, 1);
      if (equipoId === Number(equiposPartido.local.id)) totalAmarillasLocal += 1;
      if (equipoId === Number(equiposPartido.visitante.id)) totalAmarillasVisitante += 1;
    } else if (tipo === "roja") {
      if (Number.isFinite(jugadorId)) sumarEnMapa(rojasPorJugador, jugadorId, 1);
      if (Number.isFinite(jugadorId) && tarjetaEsRojaPorDobleAmarilla(t)) {
        sumarEnMapa(rojasDoblesPorJugador, jugadorId, 1);
      }
      if (equipoId === Number(equiposPartido.local.id)) totalRojasLocal += 1;
      if (equipoId === Number(equiposPartido.visitante.id)) totalRojasVisitante += 1;
    }
  });

  return {
    golesPorJugador,
    amarillasPorJugador,
    rojasPorJugador,
    rojasDoblesPorJugador,
    totalAmarillasLocal,
    totalRojasLocal,
    totalAmarillasVisitante,
    totalRojasVisitante,
  };
}

function llenarPlantelExcel(sheet, cfg, jugadores, stats) {
  const maxFilas = cfg.jugadores.fin - cfg.jugadores.inicio + 1;
  const lista = (jugadores || []).slice(0, maxFilas);

  limpiarRangoFilas(sheet, cfg.jugadores.inicio, cfg.jugadores.fin, [
    cfg.colNumero,
    cfg.colNombre,
    cfg.colGol,
    cfg.colAmarilla,
    cfg.colRoja,
  ]);

  lista.forEach((j, index) => {
    const fila = cfg.jugadores.inicio + index;
    const jugadorId = Number(j.id);

    const numero = j.numero_camiseta || "";
    const nombre = `${j.apellido || ""} ${j.nombre || ""}`.trim();
    const goles = stats.golesPorJugador.get(jugadorId) || "";
    const amarillas = stats.amarillasPorJugador.get(jugadorId) || "";
    const rojas = stats.rojasPorJugador.get(jugadorId) || "";

    setCellValue(sheet, `${cfg.colNumero}${fila}`, numero);
    setCellValue(sheet, `${cfg.colNombre}${fila}`, nombre);
    setCellValue(sheet, `${cfg.colGol}${fila}`, goles);
    setCellValue(sheet, `${cfg.colAmarilla}${fila}`, amarillas);
    setCellValue(sheet, `${cfg.colRoja}${fila}`, rojas);
  });
}

function llenarHojaListaJugadores(wb, partido, plantelLocal = []) {
  const sheet = wb.Sheets["LISTAJUGADORES"];
  if (!sheet) return;

  const categoria = partido.evento_nombre || partido.campeonato_nombre || "Sin categoria";
  const directorTecnico = partido.equipo_local_director_tecnico || "";

  setCellValue(sheet, "E6", partido.equipo_local_nombre || "");
  setCellValue(sheet, "E7", categoria);
  setCellValue(sheet, "F36", directorTecnico);

  for (let fila = 10; fila <= 29; fila += 1) {
    setCellValue(sheet, `C${fila}`, "");
    setCellValue(sheet, `D${fila}`, "");
    setCellValue(sheet, `F${fila}`, "");
    setCellValue(sheet, `G${fila}`, "");
  }

  plantelLocal.slice(0, 20).forEach((j, index) => {
    const fila = 10 + index;
    setCellValue(sheet, `C${fila}`, j.numero_camiseta || "");
    setCellValue(sheet, `D${fila}`, j.apellido || "");
    setCellValue(sheet, `F${fila}`, j.nombre || "");
    setCellValue(sheet, `G${fila}`, j.cedidentidad || "");
  });
}

function nombreJugador(j) {
  return `${j?.nombre || ""} ${j?.apellido || ""}`.trim();
}

function obtenerJugadoresEquipo(equipoId) {
  if (!dataPlanilla) return [];
  if (Number(equipoId) === Number(equiposPartido.local.id)) {
    return dataPlanilla.plantel_local || [];
  }
  if (Number(equipoId) === Number(equiposPartido.visitante.id)) {
    return dataPlanilla.plantel_visitante || [];
  }
  return [];
}

function buscarJugadorPorId(jugadorId) {
  const todos = [
    ...(dataPlanilla?.plantel_local || []),
    ...(dataPlanilla?.plantel_visitante || []),
  ];
  return todos.find((j) => Number(j.id) === Number(jugadorId)) || null;
}

function renderEncabezado() {
  const cont = document.getElementById("planilla-encabezado");
  if (!cont || !dataPlanilla?.partido) return;

  const p = dataPlanilla.partido;
  const { linea: resumenCompetencia } = obtenerResumenCompetenciaPlanilla(p);
  const fecha = formatearFecha(p.fecha_partido);
  const hora = (p.hora_partido || "--:--").toString().substring(0, 5);
  const tipoTxt = formatearTipoFutbolTexto(p.tipo_futbol || p.tipo_deporte);
  const orgTxt = p.campeonato_organizador || p.campeonato_nombre || "Organizador";
  const logoCampeonato = normalizarArchivoUrl(p.campeonato_logo_url);
  const logoLocal = normalizarArchivoUrl(p.equipo_local_logo_url);
  const logoVisit = normalizarArchivoUrl(p.equipo_visitante_logo_url);
  const logosDerecha = renderAuspiciantesHeaderPlanilla("planilla-head");
  const rawResultadoLocal = document.getElementById("resultado-local")?.value;
  const rawResultadoVisit = document.getElementById("resultado-visitante")?.value;
  const resultadoLocal =
    rawResultadoLocal !== undefined && String(rawResultadoLocal).trim() !== ""
      ? aEntero(rawResultadoLocal, 0)
      : p.resultado_local;
  const resultadoVisit =
    rawResultadoVisit !== undefined && String(rawResultadoVisit).trim() !== ""
      ? aEntero(rawResultadoVisit, 0)
      : p.resultado_visitante;
  const marcadorVacio =
    !hayDatosEnFormularioPlanilla() &&
    formatearMarcadorPlanilla(resultadoLocal) === "" &&
    formatearMarcadorPlanilla(resultadoVisit) === "";
  const resumenPenales = obtenerResumenPenalesPlanilla(
    {
      resultado_local: resultadoLocal,
      resultado_visitante: resultadoVisit,
      resultado_local_shootouts:
        document.getElementById("resultado-local-penales")?.value ?? p.resultado_local_shootouts,
      resultado_visitante_shootouts:
        document.getElementById("resultado-visitante-penales")?.value ?? p.resultado_visitante_shootouts,
      estado: document.getElementById("estado-partido")?.value || p.estado,
      inasistencia_equipo:
        document.getElementById("inasistencia-planilla")?.value || dataPlanilla?.planilla?.inasistencia_equipo || "ninguno",
      ambos_no_presentes:
        String(document.getElementById("inasistencia-planilla")?.value || "") === "ambos" ||
        dataPlanilla?.planilla?.ambos_no_presentes === true,
    },
    p
  );

  const reqCed = documentosRequeridos.cedula ? "Cédula: requerida" : "Cédula: opcional";
  const reqFotoCed = documentosRequeridos.foto_cedula
    ? "Foto cédula: requerida"
    : "Foto cédula: opcional";
  const reqCar = documentosRequeridos.foto_carnet
    ? "Foto carné: requerida"
    : "Foto carné: opcional";

  cont.innerHTML = `
    <div class="planilla-head-sheet${logosDerecha ? "" : " no-right-logos"}">
      <div class="planilla-head-logo-slot">
        ${
          logoCampeonato
            ? `<img src="${logoCampeonato}" alt="Logo campeonato" class="planilla-head-logo-img" />`
            : "<div class='planilla-head-logo-fallback'>LT&C</div>"
        }
      </div>
      <div class="planilla-head-title-slot">
        <p class="planilla-head-org">${escapeHtml(orgTxt)}</p>
        <h3>PLANILLA DE JUEGO</h3>
        <p class="planilla-head-type">${escapeHtml(tipoTxt)}</p>
      </div>
      <div class="planilla-head-logo-stack" ${logosDerecha ? "" : "aria-hidden='true'"}>
        ${logosDerecha}
      </div>
    </div>
    <div class="planilla-head-score-strip">
      <div class="planilla-head-score-team is-local">
        ${renderLogoEquipoPlanilla(logoLocal, p.equipo_local_nombre || "Local")}
        <span class="planilla-head-score-name">${escapeHtml(p.equipo_local_nombre || "Local")}</span>
        <span id="head-resultado-local" class="planilla-head-score-box">${marcadorVacio ? "" : formatearMarcadorPlanilla(resultadoLocal)}</span>
      </div>
      <div class="planilla-head-score-sep">:</div>
      <div class="planilla-head-score-team is-visitante">
        <span id="head-resultado-visitante" class="planilla-head-score-box">${marcadorVacio ? "" : formatearMarcadorPlanilla(resultadoVisit)}</span>
        ${renderLogoEquipoPlanilla(logoVisit, p.equipo_visitante_nombre || "Visitante")}
        <span class="planilla-head-score-name">${escapeHtml(p.equipo_visitante_nombre || "Visitante")}</span>
      </div>
    </div>
    <div id="head-penales" class="planilla-head-penales${resumenPenales.aplica ? "" : " is-hidden"}">${
      resumenPenales.aplica ? escapeHtml(`${resumenPenales.texto} • ${resumenPenales.clasificaTexto}`) : ""
    }</div>
    <div class="planilla-head-meta-grid">
      <div><strong>Partido:</strong> <span id="head-numero-partido">#${obtenerNumeroPartidoVisible(p) || "-"}</span></div>
      <div><strong>${escapeHtml(resumenCompetencia)}</strong></div>
      <div><strong>Fecha:</strong> <span id="head-fecha">${fecha}</span></div>
      <div><strong>Hora:</strong> <span id="head-hora">${escapeHtml(hora)}</span></div>
      <div><strong>Cancha:</strong> <span id="head-cancha">${escapeHtml(p.cancha || "Por definir")}</span></div>
      <div><strong>Ciudad:</strong> <span id="head-ciudad">${escapeHtml(p.ciudad || "Por definir")}</span></div>
    </div>
    <p class="planilla-head-docs"><strong>Requisitos documentos:</strong> ${reqCed} • ${reqFotoCed} • ${reqCar}</p>
  `;

  const ttlCapLocal = document.getElementById("captura-titulo-local");
  const ttlCapVisit = document.getElementById("captura-titulo-visitante");
  const ttlFootLocal = document.getElementById("footer-equipo-local");
  const ttlFootVisit = document.getElementById("footer-equipo-visitante");
  const ttlPagoLocal = document.getElementById("pago-equipo-local");
  const ttlPagoVisit = document.getElementById("pago-equipo-visitante");
  const dtLocal = document.getElementById("footer-dt-local");
  const dtVisit = document.getElementById("footer-dt-visitante");
  if (ttlCapLocal) ttlCapLocal.textContent = p.equipo_local_nombre || "Local";
  if (ttlCapVisit) ttlCapVisit.textContent = p.equipo_visitante_nombre || "Visitante";
  if (ttlFootLocal) ttlFootLocal.textContent = p.equipo_local_nombre || "Local";
  if (ttlFootVisit) ttlFootVisit.textContent = p.equipo_visitante_nombre || "Visitante";
  if (ttlPagoLocal) ttlPagoLocal.textContent = p.equipo_local_nombre || "Local";
  if (ttlPagoVisit) ttlPagoVisit.textContent = p.equipo_visitante_nombre || "Visitante";
  if (dtLocal) dtLocal.textContent = p.equipo_local_director_tecnico || "-";
  if (dtVisit) dtVisit.textContent = p.equipo_visitante_director_tecnico || "-";

  renderFaltasVisual();
}

function renderBotonesFaltasPlanilla(lado, tiempo, valorActual) {
  const bloqueado = obtenerLadosBloqueadosPlanilla()[lado] === true;
  return Array.from({ length: MAX_FALTAS_PLANILLA }, (_, idx) => idx + 1)
    .map((valor) => {
      const clases = [
        "planilla-faltas-btn",
        valor === MAX_FALTAS_PLANILLA ? "is-last" : "",
        valor <= valorActual ? "is-active" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <button
          type="button"
          class="${clases}"
          data-lado="${lado}"
          data-tiempo="${tiempo}"
          data-valor="${valor}"
          ${bloqueado ? "disabled" : ""}
        >
          ${valor}
        </button>
      `;
    })
    .join("");
}

function conectarEventosFaltasPlanilla() {
  document.querySelectorAll(".planilla-faltas-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lado = String(btn.dataset.lado || "").trim();
      const tiempo = Number.parseInt(btn.dataset.tiempo, 10);
      const valor = Number.parseInt(btn.dataset.valor, 10);
      if (!["local", "visitante"].includes(lado) || ![1, 2, 3, 4].includes(tiempo) || !Number.isFinite(valor)) {
        return;
      }
      actualizarEstadoFaltasPlanilla(lado, tiempo, valor);
      renderFaltasVisual();
      actualizarVistaPreviaPlanilla(true);
    });
  });
}

function renderFaltasVisual() {
  const cont = document.getElementById("planilla-faltas-visual");
  if (!cont || !dataPlanilla?.partido) return;

  const esBasquet = esPlanillaBasquetbol();
  const modelo = obtenerModeloPlanillaOficial();
  if (modelo !== "futbol_7_5_sala" && !esBasquet) {
    cont.innerHTML = "";
    cont.style.display = "none";
    return;
  }

  const faltas = obtenerEstadoFaltasPlanilla();
  const local = escapeHtml(dataPlanilla.partido.equipo_local_nombre || "Local");
  const visit = escapeHtml(dataPlanilla.partido.equipo_visitante_nombre || "Visitante");

  cont.style.display = "grid";
  if (esBasquet) {
    cont.innerHTML = `
      <div class="planilla-faltas-team">
        <p>${local}</p>
        <div class="planilla-faltas-cols">
          <div><strong>FALTAS 1ER C</strong><div class="planilla-faltas-numbers">${renderBotonesFaltasPlanilla("local", 1, faltas.local_1er)}</div></div>
          <div><strong>FALTAS 2DO C</strong><div class="planilla-faltas-numbers">${renderBotonesFaltasPlanilla("local", 2, faltas.local_2do)}</div></div>
          <div><strong>FALTAS 3ER C</strong><div class="planilla-faltas-numbers">${renderBotonesFaltasPlanilla("local", 3, faltas.local_3er || 0)}</div></div>
          <div><strong>FALTAS 4TO C</strong><div class="planilla-faltas-numbers">${renderBotonesFaltasPlanilla("local", 4, faltas.local_4to || 0)}</div></div>
        </div>
      </div>
      <div class="planilla-faltas-team">
        <p>${visit}</p>
        <div class="planilla-faltas-cols">
          <div><strong>FALTAS 1ER C</strong><div class="planilla-faltas-numbers">${renderBotonesFaltasPlanilla("visitante", 1, faltas.visitante_1er)}</div></div>
          <div><strong>FALTAS 2DO C</strong><div class="planilla-faltas-numbers">${renderBotonesFaltasPlanilla("visitante", 2, faltas.visitante_2do)}</div></div>
          <div><strong>FALTAS 3ER C</strong><div class="planilla-faltas-numbers">${renderBotonesFaltasPlanilla("visitante", 3, faltas.visitante_3er || 0)}</div></div>
          <div><strong>FALTAS 4TO C</strong><div class="planilla-faltas-numbers">${renderBotonesFaltasPlanilla("visitante", 4, faltas.visitante_4to || 0)}</div></div>
        </div>
      </div>
    `;
  } else {
    cont.innerHTML = `
      <div class="planilla-faltas-team">
        <p>${local}</p>
        <div class="planilla-faltas-cols">
          <div><strong>FALTAS 1ER</strong><div class="planilla-faltas-numbers">${renderBotonesFaltasPlanilla("local", 1, faltas.local_1er)}</div></div>
          <div><strong>FALTAS 2DO</strong><div class="planilla-faltas-numbers">${renderBotonesFaltasPlanilla("local", 2, faltas.local_2do)}</div></div>
        </div>
      </div>
      <div class="planilla-faltas-team">
        <p>${visit}</p>
        <div class="planilla-faltas-cols">
          <div><strong>FALTAS 1ER</strong><div class="planilla-faltas-numbers">${renderBotonesFaltasPlanilla("visitante", 1, faltas.visitante_1er)}</div></div>
          <div><strong>FALTAS 2DO</strong><div class="planilla-faltas-numbers">${renderBotonesFaltasPlanilla("visitante", 2, faltas.visitante_2do)}</div></div>
        </div>
      </div>
    `;
  }
  conectarEventosFaltasPlanilla();
}

function actualizarHeaderMetaEditable() {
  const cancha = String(dataPlanilla?.partido?.cancha || "Por definir");
  const ciudadVal = String(document.getElementById("ciudad-planilla")?.value || dataPlanilla?.partido?.ciudad || "Por definir");
  const numeroPartido = normalizarNumeroPartidoPlanilla(
    document.getElementById("numero-partido-planilla")?.value,
    { permitirVacio: true }
  );
  const canchaEl = document.getElementById("head-cancha");
  const ciudadEl = document.getElementById("head-ciudad");
  const numeroEl = document.getElementById("head-numero-partido");
  if (canchaEl) canchaEl.textContent = cancha;
  if (ciudadEl) ciudadEl.textContent = ciudadVal;
  if (numeroEl) numeroEl.textContent = `#${numeroPartido || obtenerNumeroPartidoVisible(dataPlanilla?.partido) || "-"}`;
  if (dataPlanilla?.partido) {
    dataPlanilla.partido.numero_campeonato = numeroPartido || null;
    dataPlanilla.partido.ciudad = ciudadVal;
  }
}

function actualizarHeaderResultado(local, visitante) {
  const localEl = document.getElementById("head-resultado-local");
  const visitEl = document.getElementById("head-resultado-visitante");
  const marcadorLocal = formatearMarcadorPlanilla(local);
  const marcadorVisitante = formatearMarcadorPlanilla(visitante);
  const marcadorVacio =
    !hayDatosEnFormularioPlanilla() &&
    marcadorLocal === "" &&
    marcadorVisitante === "";
  if (localEl) localEl.textContent = marcadorVacio ? "" : marcadorLocal;
  if (visitEl) visitEl.textContent = marcadorVacio ? "" : marcadorVisitante;
  actualizarHeaderPenales();
}

function capturarEstadoFormularioPlanilla() {
  return {
    numero_partido: document.getElementById("numero-partido-planilla")?.value || "",
    arbitro: document.getElementById("arbitro-planilla")?.value || "",
    arbitro_linea_1: document.getElementById("arbitro-linea-1-planilla")?.value || "",
    arbitro_linea_2: document.getElementById("arbitro-linea-2-planilla")?.value || "",
    delegado: document.getElementById("delegado-planilla")?.value || "",
    ciudad: document.getElementById("ciudad-planilla")?.value || "",
    observaciones: document.getElementById("observaciones-planilla")?.value || "",
    observaciones_local: document.getElementById("observaciones-planilla")?.value || "",
    observaciones_visitante:
      document.getElementById("observaciones-visitante-planilla")?.value || "",
    observaciones_arbitro:
      document.getElementById("observaciones-arbitro-planilla")?.value || "",
    estado: document.getElementById("estado-partido")?.value || "finalizado",
    inasistencia: document.getElementById("inasistencia-planilla")?.value || "ninguno",
    penales_local: document.getElementById("resultado-local-penales")?.value || "",
    penales_visitante: document.getElementById("resultado-visitante-penales")?.value || "",
    pagos: IDS_PAGOS_PLANILLA.reduce((acc, id) => {
      acc[id] = document.getElementById(id)?.value || "";
      return acc;
    }, {}),
    faltas: { ...obtenerEstadoFaltasPlanilla() },
    filas: Array.from(document.querySelectorAll(".planilla-player-row")).map((row) => ({
      key: `${row.dataset.equipoId || ""}:${row.dataset.jugadorId || ""}`,
      numero: row.querySelector(".cap-numero")?.value || "",
      convocatoria: obtenerConvocatoriaFilaPlanilla(row, { permitirVacio: true }) || "",
      entra: row.querySelector(".cap-entra")?.checked ? "1" : "",
      sale: row.querySelector(".cap-sale")?.checked ? "1" : "",
      goles: row.querySelector(".cap-goles")?.value || "",
      amarillas: row.querySelector(".cap-ta")?.value || "",
      rojas: row.querySelector(".cap-tr")?.value || "",
      rojasDobles: row.dataset.rojasDobles || "0",
      tarjetasPreset:
        valorNoNegativoEntero(row.dataset.rojasDobles, 0, 99) > 0
          ? "1"
          : row.dataset.tarjetasPreset || "",
    })),
  };
}

function restaurarEstadoFormularioPlanilla(snapshot = null) {
  if (!snapshot || typeof snapshot !== "object") return;

  const mapRows = new Map(
    Array.from(document.querySelectorAll(".planilla-player-row")).map((row) => [
      `${row.dataset.equipoId || ""}:${row.dataset.jugadorId || ""}`,
      row,
    ])
  );

  const arbitro = document.getElementById("arbitro-planilla");
  const arbitroLinea1 = document.getElementById("arbitro-linea-1-planilla");
  const arbitroLinea2 = document.getElementById("arbitro-linea-2-planilla");
  const delegado = document.getElementById("delegado-planilla");
  const ciudad = document.getElementById("ciudad-planilla");
  const numeroPartido = document.getElementById("numero-partido-planilla");
  const observaciones = document.getElementById("observaciones-planilla");
  const observacionesVisitante = document.getElementById("observaciones-visitante-planilla");
  const observacionesArbitro = document.getElementById("observaciones-arbitro-planilla");
  const estado = document.getElementById("estado-partido");
  const inasistencia = document.getElementById("inasistencia-planilla");
  const penalesLocal = document.getElementById("resultado-local-penales");
  const penalesVisitante = document.getElementById("resultado-visitante-penales");

  if (numeroPartido) numeroPartido.value = snapshot.numero_partido || "";
  if (arbitro) arbitro.value = snapshot.arbitro || "";
  if (arbitroLinea1) arbitroLinea1.value = snapshot.arbitro_linea_1 || "";
  if (arbitroLinea2) arbitroLinea2.value = snapshot.arbitro_linea_2 || "";
  if (delegado) delegado.value = snapshot.delegado || "";
  if (ciudad) ciudad.value = snapshot.ciudad || "";
  if (observaciones) {
    observaciones.value = snapshot.observaciones_local || snapshot.observaciones || "";
  }
  if (observacionesVisitante) {
    observacionesVisitante.value = snapshot.observaciones_visitante || "";
  }
  if (observacionesArbitro) observacionesArbitro.value = snapshot.observaciones_arbitro || "";
  if (estado) estado.value = snapshot.estado || "finalizado";
  if (inasistencia) inasistencia.value = snapshot.inasistencia || "ninguno";
  if (penalesLocal instanceof HTMLInputElement) {
    penalesLocal.value =
      normalizarMarcadorPenalesPlanilla(snapshot.penales_local, { permitirVacio: true }) ?? "";
  }
  if (penalesVisitante instanceof HTMLInputElement) {
    penalesVisitante.value =
      normalizarMarcadorPenalesPlanilla(snapshot.penales_visitante, { permitirVacio: true }) ?? "";
  }

  IDS_PAGOS_PLANILLA.forEach((id) => {
    const input = document.getElementById(id);
    if (input instanceof HTMLInputElement) {
      input.value = snapshot.pagos?.[id] || "";
    }
  });

  dataPlanilla.faltas = normalizarEstadoFaltasPlanilla(snapshot.faltas || dataPlanilla?.faltas || {});
  renderFaltasVisual();

  (Array.isArray(snapshot.filas) ? snapshot.filas : []).forEach((item) => {
    const row = mapRows.get(item.key);
    if (!(row instanceof HTMLElement)) return;
    const inputNumero = row.querySelector(".cap-numero");
    const inputConvocatoria = row.querySelector(".cap-convocatoria");
    const inputEntra = row.querySelector(".cap-entra");
    const inputSale = row.querySelector(".cap-sale");
    const inputGoles = row.querySelector(".cap-goles");
    const inputTa = row.querySelector(".cap-ta");
    const inputTr = row.querySelector(".cap-tr");
    const numeroNormalizado = normalizarNumeroCamisetaPlanilla(item.numero || "");
    const convocatoriaNormalizada =
      normalizarConvocatoriaPlanilla(item.convocatoria, { permitirVacio: true }) || "";
    const entra = leerBooleanoRegistroPlanilla(item.entra);
    const sale = leerBooleanoRegistroPlanilla(item.sale);
    if (inputNumero instanceof HTMLInputElement) {
      inputNumero.value = numeroNormalizado;
    }
    if (inputConvocatoria instanceof HTMLElement) {
      aplicarConvocatoriaControlPlanilla(inputConvocatoria, convocatoriaNormalizada);
    }
    if (inputEntra instanceof HTMLInputElement) inputEntra.checked = entra;
    if (inputSale instanceof HTMLInputElement) inputSale.checked = sale;
    actualizarRegistroJugadorEnDataPlanilla(row.dataset.jugadorId, row.dataset.equipoId, {
      numero_camiseta: numeroNormalizado,
      convocatoria: convocatoriaNormalizada,
      entra,
      sale,
    });
    if (inputGoles instanceof HTMLInputElement) inputGoles.value = item.goles || "";
    if (inputTa instanceof HTMLInputElement) inputTa.value = item.amarillas || "";
    if (inputTr instanceof HTMLInputElement) inputTr.value = item.rojas || "";
    row.dataset.rojasDobles = item.rojasDobles || "0";
    row.dataset.tarjetasPreset = item.tarjetasPreset || "";
  });

  actualizarHeaderMetaEditable();
  aplicarEstadoInasistenciaPlanilla(false);
  recalcularTotalesCapturaEquipo("captura-local");
  recalcularTotalesCapturaEquipo("captura-visitante");
  recalcularResultadoDesdeCaptura(false);
  actualizarVisibilidadPenalesPlanilla();
  actualizarVisibilidadOvertimePlanilla();
  actualizarHeaderPenales();
  actualizarEtiquetasPlanillaPorDeporte();
  actualizarVistaPreviaPlanilla(true);
}

async function refrescarPlanillaPreservandoFormulario() {
  if (!Number.isFinite(Number(partidoId)) || Number(partidoId) <= 0) return;
  const snapshot = capturarEstadoFormularioPlanilla();
  const resp = await ApiClient.get(`/partidos/${partidoId}/planilla`);
  dataPlanilla = resp;
  aplicarRegistroPlanillaAPlanteles();
  dataPlanilla.auspiciantes = await cargarAuspiciantesActivosPlanilla(dataPlanilla?.partido?.campeonato_id);

  const p = dataPlanilla.partido || {};
  equiposPartido = {
    local: { id: p.equipo_local_id, nombre: p.equipo_local_nombre || "Local" },
    visitante: { id: p.equipo_visitante_id, nombre: p.equipo_visitante_nombre || "Visitante" },
  };
  documentosRequeridos = {
    cedula: dataPlanilla.documentos_requeridos?.cedula !== false,
    foto_cedula: dataPlanilla.documentos_requeridos?.foto_cedula === true,
    foto_carnet: dataPlanilla.documentos_requeridos?.foto_carnet === true,
  };

  renderEncabezado();
  cargarCamposBase();
  renderCapturaOficialPorJugador();
  actualizarVisibilidadContenidoPlanilla(true);
  await sincronizarSelectoresDesdePlanillaActual();
  restaurarEstadoFormularioPlanilla(snapshot);
}

function calcularTotalesCaptura() {
  const out = {
    local: { goles: 0, ta: 0, tr: 0 },
    visitante: { goles: 0, ta: 0, tr: 0 },
  };

  document.querySelectorAll(".planilla-player-row").forEach((row) => {
    const equipoId = Number(row.dataset.equipoId);
    if (estaEquipoBloqueadoPlanilla(equipoId)) return;
    const goles = valorNoNegativoEntero(row.querySelector(".cap-goles")?.value, 0, 99);
    const tarjetas = normalizarTarjetasFilaCaptura(row);

    if (equipoId === Number(equiposPartido.local.id)) {
      out.local.goles += goles;
      out.local.ta += tarjetas.amarillas;
      out.local.tr += tarjetas.rojas;
    } else if (equipoId === Number(equiposPartido.visitante.id)) {
      out.visitante.goles += goles;
      out.visitante.ta += tarjetas.amarillas;
      out.visitante.tr += tarjetas.rojas;
    }
  });

  return out;
}

function actualizarResumenFooterDesdeCaptura() {
  const tot = calcularTotalesCaptura();
  const taLocal = document.getElementById("resumen-ta-local");
  const trLocal = document.getElementById("resumen-tr-local");
  const taVisit = document.getElementById("resumen-ta-visitante");
  const trVisit = document.getElementById("resumen-tr-visitante");

  if (taLocal) taLocal.value = String(tot.local.ta);
  if (trLocal) trLocal.value = String(tot.local.tr);
  if (taVisit) taVisit.value = String(tot.visitante.ta);
  if (trVisit) trVisit.value = String(tot.visitante.tr);
}

function renderPlantel(idContenedor, jugadores) {
  const cont = document.getElementById(idContenedor);
  if (!cont) return;

  if (!jugadores?.length) {
    cont.innerHTML = "<p class='form-hint'>No hay jugadores registrados en este equipo.</p>";
    return;
  }

  cont.innerHTML = jugadores
    .map((j) => {
      const suspension = j?.suspension || null;
      const suspendido = suspension?.suspendido === true;
      const esArquero = esPosicionArqueroPlanilla(j?.posicion);
      const docs = [];
      if (documentosRequeridos.foto_cedula) {
        docs.push(j.foto_cedula_url ? "Cédula OK" : "Cédula pendiente");
      }
      if (documentosRequeridos.foto_carnet) {
        docs.push(j.foto_carnet_url ? "Carné OK" : "Carné pendiente");
      }
      const docsTxt = docs.length ? ` • ${docs.join(" • ")}` : "";
      const suspensionTxt = suspendido
        ? ` • Suspendido (${Number(suspension?.partidos_pendientes || 0)} partido${Number(suspension?.partidos_pendientes || 0) === 1 ? "" : "s"} pendiente${Number(suspension?.partidos_pendientes || 0) === 1 ? "" : "s"})`
        : "";

      return `
        <div class="planilla-plantel-item ${suspendido ? "is-suspended" : ""} ${esArquero ? "is-goalkeeper" : ""}">
          <strong>#${j.numero_camiseta || "-"}</strong>
          <span>${nombreJugador(j)}</span>
          <small>${j.posicion || "-"}${docsTxt}${suspensionTxt}</small>
        </div>
      `;
    })
    .join("");
}

function valorNoNegativoEntero(valor, fallback = 0, max = 99) {
  const n = aEntero(valor, fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 0), max);
}

function construirStatsInicialesPlanilla() {
  return construirIndicesEventos({
    goles: Array.isArray(dataPlanilla?.goleadores) ? dataPlanilla.goleadores : [],
    tarjetas: Array.isArray(dataPlanilla?.tarjetas) ? dataPlanilla.tarjetas : [],
  });
}

function renderTablaCapturaEquipo(idContenedor, jugadores, equipoId, equipoNombre, statsIniciales) {
  const cont = document.getElementById(idContenedor);
  if (!cont) return;

  const acciones = puedeInscribirJugadoresEnPlanilla()
    ? `
      <div class="planilla-captura-actions">
        <button
          type="button"
          class="btn btn-primary btn-xs btn-inscribir-planilla"
          data-equipo-id="${equipoId}"
          data-equipo-nombre="${escapeHtml(equipoNombre || "Equipo")}"
        >
          <i class="fas fa-user-plus"></i> Inscribir jugador
        </button>
      </div>
    `
    : "";

  if (!Array.isArray(jugadores) || !jugadores.length) {
    cont.innerHTML = `${acciones}<p class='form-hint'>No hay jugadores registrados en este equipo.</p>`;
    return;
  }

  const esFutbol11 = esPlanillaFutbol11();
  const esBasquetbol = esPlanillaBasquetbol();
  const usaConvocatoria = usaConvocatoriaPlanilla();
  const filas = jugadores
    .map((j, idx) => {
      const suspension = j?.suspension || null;
      const suspendido = suspension?.suspendido === true;
      const esArquero = esPosicionArqueroPlanilla(j?.posicion);
      const jugadorId = Number(j.id);
      const goles = suspendido ? "" : statsIniciales.golesPorJugador.get(jugadorId) || "";
      const amarillas = suspendido ? "" : statsIniciales.amarillasPorJugador.get(jugadorId) || "";
      const rojas = suspendido ? "" : statsIniciales.rojasPorJugador.get(jugadorId) || "";
      const rojasDobles = suspendido ? 0 : statsIniciales.rojasDoblesPorJugador.get(jugadorId) || 0;
      const item = idx + 1;
      const registro = obtenerRegistroPlanillaJugador(j);
      const numero = normalizarNumeroCamisetaPlanilla(registro.numero_camiseta || j.numero_camiseta || "");
      const nombre = nombreJugador(j) || `Jugador ${idx + 1}`;
      const convocatoria = normalizarConvocatoriaPlanilla(registro.convocatoria || "", { permitirVacio: true }) || "";
      const docs = [];
      if (documentosRequeridos.foto_cedula) docs.push(j.foto_cedula_url ? "Cedula OK" : "Cedula pendiente");
      if (documentosRequeridos.foto_carnet) docs.push(j.foto_carnet_url ? "Carné OK" : "Carné pendiente");
      const docsHtml = docs.length ? `<small>${docs.join(" • ")}</small>` : "";
      const suspensionHtml = suspendido
        ? `<small class="planilla-player-suspension">${escapeHtml(
            suspension?.motivo || "Suspendido"
          )} • ${Number(suspension?.partidos_pendientes || 0)} partido${
            Number(suspension?.partidos_pendientes || 0) === 1 ? "" : "s"
          } pendiente${Number(suspension?.partidos_pendientes || 0) === 1 ? "" : "s"}</small>`
        : "";
      const disabledAttr = suspendido ? "disabled" : "";

      return `
        <tr
          class="planilla-player-row ${suspendido ? "is-suspended" : ""} ${esArquero ? "is-goalkeeper" : ""}"
          data-equipo-id="${equipoId}"
          data-jugador-id="${j.id}"
          data-rojas-dobles="${rojasDobles}"
          data-tarjetas-preset="${rojasDobles > 0 ? "1" : ""}"
        >
          <td class="planilla-col-item">${item}</td>
          <td class="planilla-col-numero">
            <input
              class="cap-numero"
              type="text"
              inputmode="numeric"
              maxlength="3"
              pattern="[0-9]*"
              value="${numero}"
              aria-label="Número de camiseta de ${escapeHtml(nombre)}"
            />
          </td>
          ${
            usaConvocatoria
              ? `<td class="planilla-col-convocatoria">
                  <input
                    class="cap-convocatoria cap-convocatoria-checkbox"
                    type="checkbox"
                    aria-label="Principal de ${escapeHtml(nombre)}"
                    title="Marcado = principal, desmarcado = suplente"
                    ${convocatoria === "P" ? "checked" : ""}
                    ${convocatoria === "" ? 'data-indeterminate="true"' : ""}
                    ${disabledAttr}
                  />
                </td>`
              : ""
          }
          ${
            esFutbol11
              ? `<td class="planilla-col-entra"><input class="cap-entra" type="checkbox" aria-label="Entra de ${escapeHtml(
                  nombre
                )}" ${registro.entra ? "checked" : ""} ${disabledAttr} /></td>
                 <td class="planilla-col-sale"><input class="cap-sale" type="checkbox" aria-label="Sale de ${escapeHtml(
                   nombre
                 )}" ${registro.sale ? "checked" : ""} ${disabledAttr} /></td>`
              : ""
          }
          <td class="planilla-col-jugador">
            <strong>${escapeHtml(nombre)}</strong>
            ${docsHtml}
            ${suspensionHtml}
          </td>
          <td class="planilla-col-goles">${esBasquetbol ? `
            <div class="cap-goles-basquet">
              <select class="cap-tipo-punto" aria-label="Tipo de punto de ${escapeHtml(nombre)}" ${disabledAttr}>
                <option value="canasta">2pts</option>
                <option value="triple">3pts</option>
                <option value="libre">1pt</option>
              </select>
              <input class="cap-goles" type="text" inputmode="numeric" maxlength="2" pattern="[0-9]*" value="${goles}" ${disabledAttr} aria-label="Puntos de ${escapeHtml(nombre)}" />
            </div>` : `<input class="cap-goles" type="text" inputmode="numeric" maxlength="2" pattern="[0-9]*" value="${goles}" ${disabledAttr} />`}</td>
          <td class="planilla-col-ta"><input class="cap-ta" type="text" inputmode="numeric" maxlength="2" pattern="[0-9]*" value="${amarillas}" ${disabledAttr} /></td>
          <td class="planilla-col-tr"><input class="cap-tr" type="text" inputmode="numeric" maxlength="2" pattern="[0-9]*" value="${rojas}" ${disabledAttr} /></td>
        </tr>
      `;
    })
    .join("");

  cont.innerHTML = `
    ${acciones}
    <div class="planilla-captura-table-wrap">
      <table class="planilla-captura-table">
        <thead>
          ${renderCabeceraTablaPlanillaHtml({ modo: "captura" })}
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;

  cont.querySelectorAll(".cap-convocatoria-checkbox[data-indeterminate='true']").forEach((input) => {
    if (input instanceof HTMLInputElement) {
      input.indeterminate = true;
    }
  });
}

function recalcularTotalesCapturaEquipo(idContenedor) {
  const cont = document.getElementById(idContenedor);
  if (!cont) return;

  let totalGoles = 0;
  let totalTa = 0;
  let totalTr = 0;

  cont.querySelectorAll(".planilla-player-row").forEach((row) => {
    totalGoles += valorNoNegativoEntero(row.querySelector(".cap-goles")?.value, 0, 99);
    const tarjetas = normalizarTarjetasFilaCaptura(row);
    totalTa += tarjetas.amarillas;
    totalTr += tarjetas.rojas;
  });

  const golesCell = cont.querySelector(".cap-total-goles");
  const taCell = cont.querySelector(".cap-total-ta");
  const trCell = cont.querySelector(".cap-total-tr");

  if (golesCell) golesCell.textContent = String(totalGoles);
  if (taCell) taCell.textContent = String(totalTa);
  if (trCell) trCell.textContent = String(totalTr);
}

function recalcularResultadoDesdeCaptura(preservarSiSinDatos = false) {
  const inasistencia = obtenerInasistenciaPlanilla();
  if (inasistencia !== "ninguno") {
    const resultadoAutomatico = obtenerResultadoPorInasistencia(inasistencia);
    const inputLocal = document.getElementById("resultado-local");
    const inputVisitante = document.getElementById("resultado-visitante");
    if (inputLocal) inputLocal.value = resultadoAutomatico.local == null ? "" : String(resultadoAutomatico.local);
    if (inputVisitante) {
      inputVisitante.value = resultadoAutomatico.visitante == null ? "" : String(resultadoAutomatico.visitante);
    }
    actualizarHeaderResultado(resultadoAutomatico.local, resultadoAutomatico.visitante);
    actualizarResumenFooterDesdeCaptura();
    return;
  }

  const tot = calcularTotalesCaptura();
  const golesLocal = tot.local.goles;
  const golesVisitante = tot.visitante.goles;
  const hayDatos =
    golesLocal > 0 ||
    golesVisitante > 0 ||
    tot.local.ta > 0 ||
    tot.local.tr > 0 ||
    tot.visitante.ta > 0 ||
    tot.visitante.tr > 0;

  if (preservarSiSinDatos && !hayDatos) return;

  const inputLocal = document.getElementById("resultado-local");
  const inputVisitante = document.getElementById("resultado-visitante");
  if (inputLocal) inputLocal.value = String(golesLocal);
  if (inputVisitante) inputVisitante.value = String(golesVisitante);
  actualizarHeaderResultado(golesLocal, golesVisitante);
  actualizarVisibilidadPenalesPlanilla();
  actualizarVisibilidadOvertimePlanilla();
  actualizarResumenFooterDesdeCaptura();
}

function conectarEventosCaptura() {
  const controles = document.querySelectorAll(
    "#captura-local input, #captura-local select, #captura-visitante input, #captura-visitante select"
  );

  const manejarCambio = (target) => {
    if (!(target instanceof HTMLElement)) return;
    const row = target.closest(".planilla-player-row");
    if (!(row instanceof HTMLElement)) return;

    if (target.classList.contains("cap-numero") && target instanceof HTMLInputElement) {
      const valor = normalizarNumeroCamisetaPlanilla(target.value);
      target.value = valor;
      actualizarNumeroJugadorEnDataPlanilla(row.dataset.jugadorId, valor);
      actualizarVistaPreviaPlanilla(true);
      return;
    }

    if (
      target.classList.contains("cap-convocatoria") &&
      (target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && target.type === "checkbox"))
    ) {
      const convocatoria = leerConvocatoriaControlPlanilla(target, { permitirVacio: true }) || "";
      if (target instanceof HTMLSelectElement) {
        target.value = convocatoria;
      }
      if (target instanceof HTMLInputElement && target.type === "checkbox") {
        target.indeterminate = false;
        target.dataset.convocatoria = convocatoria;
      }
      actualizarRegistroJugadorEnDataPlanilla(row.dataset.jugadorId, row.dataset.equipoId, {
        convocatoria,
      });
      actualizarVistaPreviaPlanilla(true);
      return;
    }

    if (target.classList.contains("cap-entra") || target.classList.contains("cap-sale")) {
      actualizarRegistroJugadorEnDataPlanilla(row.dataset.jugadorId, row.dataset.equipoId, {
        entra: row.querySelector(".cap-entra")?.checked === true,
        sale: row.querySelector(".cap-sale")?.checked === true,
      });
      actualizarVistaPreviaPlanilla(true);
      return;
    }

    if (
      (target.classList.contains("cap-ta") || target.classList.contains("cap-tr")) &&
      row instanceof HTMLElement
    ) {
      row.dataset.tarjetasPreset = "";
    }

    if (target instanceof HTMLInputElement) {
      const limpio = String(target.value || "").replace(/\D+/g, "").slice(0, 2);
      const valor = valorNoNegativoEntero(limpio, 0, 99);
      target.value = valor ? String(valor) : "";
    }
    recalcularTotalesCapturaEquipo("captura-local");
    recalcularTotalesCapturaEquipo("captura-visitante");
    recalcularResultadoDesdeCaptura(false);
    actualizarVistaPreviaPlanilla(true);
  };

  controles.forEach((control) => {
    const evento =
      control.classList.contains("cap-convocatoria") ||
      control.classList.contains("cap-entra") ||
      control.classList.contains("cap-sale")
        ? "change"
        : "input";
    control.addEventListener(evento, (e) => manejarCambio(e.target));
  });
}

function conectarAccionesCapturaPlanilla() {
  document.querySelectorAll(".btn-inscribir-planilla").forEach((btn) => {
    btn.addEventListener("click", () => {
      abrirModalInscripcionPlanilla(btn.dataset.equipoId, btn.dataset.equipoNombre || "Equipo");
    });
  });
}

function renderCapturaOficialPorJugador() {
  const statsIniciales = construirStatsInicialesPlanilla();

  renderTablaCapturaEquipo(
    "captura-local",
    dataPlanilla?.plantel_local || [],
    equiposPartido.local.id,
    equiposPartido.local.nombre,
    statsIniciales
  );
  renderTablaCapturaEquipo(
    "captura-visitante",
    dataPlanilla?.plantel_visitante || [],
    equiposPartido.visitante.id,
    equiposPartido.visitante.nombre,
    statsIniciales
  );

  recalcularTotalesCapturaEquipo("captura-local");
  recalcularTotalesCapturaEquipo("captura-visitante");
  actualizarResumenFooterDesdeCaptura();
  recalcularResultadoDesdeCaptura(true);
  conectarEventosCaptura();
  conectarAccionesCapturaPlanilla();
  aplicarEstadoInasistenciaPlanilla(false);
}

function limpiarFormularioJugadorPlanilla() {
  const form = document.getElementById("form-planilla-jugador");
  form?.reset();
  const hiddenEquipo = document.getElementById("planilla-jugador-equipo-id");
  if (hiddenEquipo instanceof HTMLInputElement) hiddenEquipo.value = "";
  const nombreEquipo = document.getElementById("planilla-jugador-equipo-nombre");
  if (nombreEquipo) nombreEquipo.textContent = "Equipo";
}

function actualizarHintsDocumentosPlanillaJugador() {
  const labelCedula = document.getElementById("planilla-label-jugador-cedula");
  const hintCedula = document.getElementById("planilla-hint-jugador-cedula");
  const inputCedula = document.getElementById("planilla-jugador-ced");
  const labelFotoCedula = document.getElementById("planilla-label-jugador-foto-cedula");
  const hintFotoCedula = document.getElementById("planilla-hint-foto-cedula");
  const inputFotoCedula = document.getElementById("planilla-jugador-foto-cedula");
  const labelFotoCarnet = document.getElementById("planilla-label-jugador-foto-carnet");
  const hintFotoCarnet = document.getElementById("planilla-hint-foto-carnet");
  const inputFotoCarnet = document.getElementById("planilla-jugador-foto-carnet");

  if (labelCedula) {
    labelCedula.textContent = documentosRequeridos.cedula ? "Cédula" : "Cédula (opcional)";
  }
  if (hintCedula) {
    hintCedula.textContent = documentosRequeridos.cedula
      ? "Este campeonato exige registrar la cédula del jugador."
      : "Puedes dejar la cédula vacía si el campeonato no la exige.";
  }
  if (inputCedula instanceof HTMLInputElement) {
    inputCedula.required = documentosRequeridos.cedula === true;
  }

  if (labelFotoCedula) {
    labelFotoCedula.textContent = documentosRequeridos.foto_cedula
      ? "Foto de cédula"
      : "Foto de cédula (opcional)";
  }
  if (hintFotoCedula) {
    hintFotoCedula.textContent = documentosRequeridos.foto_cedula
      ? "Este campeonato exige foto de cédula."
      : "Solo adjúntala si deseas dejar el documento cargado desde la planilla.";
  }
  if (inputFotoCedula instanceof HTMLInputElement) {
    inputFotoCedula.required = documentosRequeridos.foto_cedula === true;
  }

  if (labelFotoCarnet) {
    labelFotoCarnet.textContent = documentosRequeridos.foto_carnet
      ? "Foto carné"
      : "Foto carné (opcional)";
  }
  if (hintFotoCarnet) {
    hintFotoCarnet.textContent = documentosRequeridos.foto_carnet
      ? "Este campeonato exige foto carné."
      : "Puedes adjuntarla ahora o dejarla para después.";
  }
  if (inputFotoCarnet instanceof HTMLInputElement) {
    inputFotoCarnet.required = documentosRequeridos.foto_carnet === true;
  }
}

function abrirModalInscripcionPlanilla(equipoIdRaw, equipoNombre = "Equipo") {
  if (!puedeInscribirJugadoresEnPlanilla()) {
    mostrarNotificacion("Tu rol no puede inscribir jugadores desde la planilla", "warning");
    return;
  }
  const equipoId = Number.parseInt(equipoIdRaw, 10);
  if (!Number.isFinite(equipoId) || equipoId <= 0) {
    mostrarNotificacion("No se pudo determinar el equipo para inscribir al jugador", "warning");
    return;
  }

  limpiarFormularioJugadorPlanilla();
  actualizarHintsDocumentosPlanillaJugador();

  const modal = document.getElementById("modal-planilla-jugador");
  const hiddenEquipo = document.getElementById("planilla-jugador-equipo-id");
  const nombreEquipoEl = document.getElementById("planilla-jugador-equipo-nombre");
  if (hiddenEquipo instanceof HTMLInputElement) hiddenEquipo.value = String(equipoId);
  if (nombreEquipoEl) nombreEquipoEl.textContent = equipoNombre || "Equipo";
  modal?.classList.add("open");
  document.body.classList.add("modal-open");
}

function cerrarModalInscripcionPlanilla() {
  const modal = document.getElementById("modal-planilla-jugador");
  modal?.classList.remove("open");
  document.body.classList.remove("modal-open");
}

async function guardarJugadorDesdePlanilla(event) {
  event.preventDefault();

  const equipoId = Number.parseInt(
    document.getElementById("planilla-jugador-equipo-id")?.value || "",
    10
  );
  if (!Number.isFinite(equipoId) || equipoId <= 0) {
    mostrarNotificacion("Selecciona un equipo válido para registrar al jugador", "warning");
    return;
  }

  const fechaNacimiento = document.getElementById("planilla-jugador-fecha")?.value?.trim() || "";
  const numeroCamiseta = document.getElementById("planilla-jugador-numero")?.value?.trim() || "";
  const inputCedula = document.getElementById("planilla-jugador-ced");
  const cedula = normalizarCedulaPlanilla(inputCedula?.value || "");
  const submitBtn = document.querySelector("#form-planilla-jugador button[type='submit']");
  if (inputCedula instanceof HTMLInputElement) inputCedula.value = cedula;

  const formData = new FormData();
  formData.append("equipo_id", String(equipoId));
  if (Number.isFinite(Number(eventoId)) && Number(eventoId) > 0) {
    formData.append("evento_id", String(Number(eventoId)));
  }
  formData.append("nombre", document.getElementById("planilla-jugador-nombre")?.value?.trim() || "");
  formData.append("apellido", document.getElementById("planilla-jugador-apellido")?.value?.trim() || "");
  formData.append("cedidentidad", cedula || "");
  if (cedula && cedula.length !== 10) {
    mostrarNotificacion("La cédula debe tener exactamente 10 dígitos", "warning");
    if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;
    return;
  }
  if (fechaNacimiento) formData.append("fecha_nacimiento", fechaNacimiento);
  formData.append("posicion", document.getElementById("planilla-jugador-posicion")?.value?.trim() || "");
  if (numeroCamiseta) formData.append("numero_camiseta", numeroCamiseta);
  formData.append(
    "es_capitan",
    document.getElementById("planilla-jugador-capitan")?.checked ? "true" : "false"
  );

  const fotoCedula = document.getElementById("planilla-jugador-foto-cedula")?.files?.[0];
  const fotoCarnet = document.getElementById("planilla-jugador-foto-carnet")?.files?.[0];
  if (fotoCedula) formData.append("foto_cedula", fotoCedula);
  if (fotoCarnet) formData.append("foto_carnet", fotoCarnet);

  if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = true;

  try {
    await ApiClient.requestForm("POST", "/jugadores", formData);
    mostrarNotificacion("Jugador inscrito correctamente desde la planilla", "success");
    await refrescarPlanillaPreservandoFormulario();
    cerrarModalInscripcionPlanilla();
  } catch (error) {
    console.error("Error inscribiendo jugador desde la planilla:", error);
    mostrarNotificacion(error.message || "No se pudo registrar el jugador", "error");
  } finally {
    if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;
  }
}

function cargarCamposBase() {
  if (!dataPlanilla?.partido) return;

  const p = dataPlanilla.partido;
  const plan = dataPlanilla.planilla || {};

  const inputResultadoLocal = document.getElementById("resultado-local");
  const inputResultadoVisit = document.getElementById("resultado-visitante");
  const inputEstado = document.getElementById("estado-partido");
  const inputPagoTaLocal = document.getElementById("pago-ta-local");
  const inputPagoTrLocal = document.getElementById("pago-tr-local");
  const inputPagoTaVisitante = document.getElementById("pago-ta-visitante");
  const inputPagoTrVisitante = document.getElementById("pago-tr-visitante");
  const inputPagoArbitrajeLocal = document.getElementById("pago-arbitraje-local");
  const inputPagoArbitrajeVisitante = document.getElementById("pago-arbitraje-visitante");
  const inputPagoLocal = document.getElementById("pago-local");
  const inputPagoVisitante = document.getElementById("pago-visitante");
  const inputObserv = document.getElementById("observaciones-planilla");
  const inputObservVisitante = document.getElementById("observaciones-visitante-planilla");
  const inputObservArbitro = document.getElementById("observaciones-arbitro-planilla");
  const inputPenalesLocal = document.getElementById("resultado-local-penales");
  const inputPenalesVisit = document.getElementById("resultado-visitante-penales");
  const inputArbitro = document.getElementById("arbitro-planilla");
  const inputArbitroLinea1 = document.getElementById("arbitro-linea-1-planilla");
  const inputArbitroLinea2 = document.getElementById("arbitro-linea-2-planilla");
  const inputNumeroPartido = document.getElementById("numero-partido-planilla");
  const inputDelegado = document.getElementById("delegado-planilla");
  const inputCiudad = document.getElementById("ciudad-planilla");
  const inputInasistencia = document.getElementById("inasistencia-planilla");

  if (inputResultadoLocal) {
    inputResultadoLocal.value = p.resultado_local == null ? "" : String(aEntero(p.resultado_local, 0));
  }
  if (inputResultadoVisit) {
    inputResultadoVisit.value = p.resultado_visitante == null ? "" : String(aEntero(p.resultado_visitante, 0));
  }
  if (inputPenalesLocal instanceof HTMLInputElement) {
    const valorPenalesLocal = normalizarMarcadorPenalesPlanilla(p.resultado_local_shootouts, { permitirVacio: true });
    inputPenalesLocal.value = valorPenalesLocal == null ? "" : String(valorPenalesLocal);
  }
  if (inputPenalesVisit instanceof HTMLInputElement) {
    const valorPenalesVisit = normalizarMarcadorPenalesPlanilla(p.resultado_visitante_shootouts, { permitirVacio: true });
    inputPenalesVisit.value = valorPenalesVisit == null ? "" : String(valorPenalesVisit);
  }
  if (inputEstado) inputEstado.value = p.estado || "finalizado";

  const planillaSinDatos =
    (dataPlanilla?.goleadores || []).length === 0 &&
    (dataPlanilla?.tarjetas || []).length === 0 &&
    aDecimal(plan.pago_local, 0) <= 0 &&
    aDecimal(plan.pago_visitante, 0) <= 0 &&
    aDecimal(plan.pago_arbitraje_local ?? plan.pago_arbitraje, 0) <= 0 &&
    aDecimal(plan.pago_arbitraje_visitante ?? plan.pago_arbitraje, 0) <= 0 &&
    aDecimal(plan.pago_ta_local, 0) <= 0 &&
    aDecimal(plan.pago_ta_visitante, 0) <= 0 &&
    aDecimal(plan.pago_tr_local, 0) <= 0 &&
    aDecimal(plan.pago_tr_visitante, 0) <= 0;

  if (inputPagoTaLocal) inputPagoTaLocal.value = planillaSinDatos ? "" : String(aDecimal(plan.pago_ta_local, aDecimal(plan.pago_ta, 0)));
  if (inputPagoTrLocal) inputPagoTrLocal.value = planillaSinDatos ? "" : String(aDecimal(plan.pago_tr_local, aDecimal(plan.pago_tr, 0)));
  if (inputPagoTaVisitante) {
    inputPagoTaVisitante.value = planillaSinDatos
      ? ""
      : String(aDecimal(plan.pago_ta_visitante, aDecimal(plan.pago_ta, 0)));
  }
  if (inputPagoTrVisitante) {
    inputPagoTrVisitante.value = planillaSinDatos
      ? ""
      : String(aDecimal(plan.pago_tr_visitante, aDecimal(plan.pago_tr, 0)));
  }
  if (inputPagoArbitrajeLocal) {
    inputPagoArbitrajeLocal.value = planillaSinDatos
      ? ""
      : String(aDecimal(plan.pago_arbitraje_local, aDecimal(plan.pago_arbitraje, 0)));
  }
  if (inputPagoArbitrajeVisitante) {
    inputPagoArbitrajeVisitante.value = planillaSinDatos
      ? ""
      : String(aDecimal(plan.pago_arbitraje_visitante, aDecimal(plan.pago_arbitraje, 0)));
  }
  if (inputPagoLocal) inputPagoLocal.value = planillaSinDatos ? "" : String(aDecimal(plan.pago_local, 0));
  if (inputPagoVisitante) inputPagoVisitante.value = planillaSinDatos ? "" : String(aDecimal(plan.pago_visitante, 0));
  if (inputObserv) inputObserv.value = plan.observaciones_local || plan.observaciones || "";
  if (inputObservVisitante) inputObservVisitante.value = plan.observaciones_visitante || "";
  if (inputObservArbitro) inputObservArbitro.value = plan.observaciones_arbitro || "";
  if (inputArbitro) inputArbitro.value = p.arbitro || "";
  if (inputArbitroLinea1) inputArbitroLinea1.value = p.arbitro_linea_1 || "";
  if (inputArbitroLinea2) inputArbitroLinea2.value = p.arbitro_linea_2 || "";
  if (inputNumeroPartido) {
    inputNumeroPartido.value = obtenerNumeroPartidoVisible(p) || "";
  }
  if (inputDelegado) inputDelegado.value = p.delegado_partido || "";
  if (inputCiudad) inputCiudad.value = p.ciudad || "";
  if (inputInasistencia instanceof HTMLSelectElement) {
    const inasistenciaInicial =
      normalizarInasistenciaPlanilla(plan.inasistencia_equipo) !== "ninguno"
        ? normalizarInasistenciaPlanilla(plan.inasistencia_equipo)
        : plan.ambos_no_presentes === true ||
            String(p.estado || "").trim().toLowerCase() === "no_presentaron_ambos"
          ? "ambos"
          : "ninguno";
    inputInasistencia.value = inasistenciaInicial;
  }

  dataPlanilla.faltas = normalizarEstadoFaltasPlanilla(dataPlanilla?.faltas || {});
  actualizarVisibilidadArbitrajePlanilla();
  actualizarEtiquetasPlanillaPorDeporte();

  actualizarHeaderMetaEditable();
  actualizarHeaderResultado(
    document.getElementById("resultado-local")?.value ?? "",
    document.getElementById("resultado-visitante")?.value ?? ""
  );
  actualizarVisibilidadPenalesPlanilla();
  actualizarVisibilidadOvertimePlanilla();
  aplicarEstadoInasistenciaPlanilla(false);
}

function opcionesEquiposHtml(selectedEquipoId) {
  const localSelected = Number(selectedEquipoId) === Number(equiposPartido.local.id) ? "selected" : "";
  const visitSelected = Number(selectedEquipoId) === Number(equiposPartido.visitante.id) ? "selected" : "";

  return `
    <option value="${equiposPartido.local.id}" ${localSelected}>${equiposPartido.local.nombre}</option>
    <option value="${equiposPartido.visitante.id}" ${visitSelected}>${equiposPartido.visitante.nombre}</option>
  `;
}

function poblarSelectJugadores(selectJugador, equipoId, selectedJugadorId = null) {
  const jugadores = obtenerJugadoresEquipo(equipoId);
  selectJugador.innerHTML = '<option value="">- Selecciona jugador -</option>';

  jugadores.forEach((j) => {
    const selected = Number(selectedJugadorId) === Number(j.id) ? "selected" : "";
    const label = `#${j.numero_camiseta || "-"} ${nombreJugador(j)}`;
    selectJugador.innerHTML += `<option value="${j.id}" ${selected}>${label}</option>`;
  });
}

function agregarFilaGol(item = null) {
  const lista = document.getElementById("lista-goles");
  if (!lista) return;

  const equipoId = Number(item?.equipo_id || item?.equipoId || equiposPartido.local.id);
  const jugadorId = Number(item?.jugador_id || "") || null;

  const row = document.createElement("div");
  row.className = "planilla-row planilla-row-gol";

  row.innerHTML = `
    <div class="form-group">
      <label>Equipo</label>
      <select class="row-equipo">${opcionesEquiposHtml(equipoId)}</select>
    </div>
    <div class="form-group">
      <label>Jugador</label>
      <select class="row-jugador"></select>
    </div>
    <div class="form-group">
      <label>Goles</label>
      <input class="row-goles" type="number" min="1" value="${aEntero(item?.goles, 1)}" />
    </div>
    <div class="form-group">
      <label>Tipo</label>
      <select class="row-tipo-gol">
        <option value="campo" ${String(item?.tipo_gol || "campo") === "campo" ? "selected" : ""}>Campo</option>
        <option value="penal" ${String(item?.tipo_gol || "") === "penal" ? "selected" : ""}>Penal</option>
        <option value="autogol" ${String(item?.tipo_gol || "") === "autogol" ? "selected" : ""}>Autogol</option>
      </select>
    </div>
    <div class="form-group">
      <label>Minuto</label>
      <input class="row-minuto" type="number" min="1" max="200" value="${item?.minuto || ""}" />
    </div>
    <div class="planilla-row-actions">
      <button type="button" class="btn btn-danger btn-xs row-remove"><i class="fas fa-trash"></i></button>
    </div>
  `;

  const selectEquipo = row.querySelector(".row-equipo");
  const selectJugador = row.querySelector(".row-jugador");

  function syncPlayers() {
    poblarSelectJugadores(selectJugador, Number(selectEquipo.value), jugadorId);
  }

  selectEquipo.addEventListener("change", () => {
    poblarSelectJugadores(selectJugador, Number(selectEquipo.value));
    actualizarVistaPreviaPlanilla(true);
  });

  row.querySelector(".row-remove").addEventListener("click", () => {
    row.remove();
    actualizarVistaPreviaPlanilla(true);
  });

  syncPlayers();
  lista.appendChild(row);
  actualizarVistaPreviaPlanilla(true);
}

function agregarFilaTarjeta(item = null) {
  const lista = document.getElementById("lista-tarjetas");
  if (!lista) return;

  const equipoId = Number(item?.equipo_id || item?.equipoId || equiposPartido.local.id);
  const jugadorId = Number(item?.jugador_id || "") || null;
  const tipo = String(item?.tipo_tarjeta || "amarilla").toLowerCase();

  const row = document.createElement("div");
  row.className = "planilla-row planilla-row-tarjeta";

  row.innerHTML = `
    <div class="form-group">
      <label>Equipo</label>
      <select class="row-equipo">${opcionesEquiposHtml(equipoId)}</select>
    </div>
    <div class="form-group">
      <label>Jugador</label>
      <select class="row-jugador"></select>
    </div>
    <div class="form-group">
      <label>Tarjeta</label>
      <select class="row-tipo-tarjeta">
        <option value="amarilla" ${tipo === "amarilla" ? "selected" : ""}>Amarilla</option>
        <option value="roja" ${tipo === "roja" ? "selected" : ""}>Roja</option>
      </select>
    </div>
    <div class="form-group">
      <label>Minuto</label>
      <input class="row-minuto" type="number" min="1" max="200" value="${item?.minuto || ""}" />
    </div>
    <div class="form-group">
      <label>Observación</label>
      <input class="row-observacion" type="text" value="${item?.observacion || ""}" />
    </div>
    <div class="planilla-row-actions">
      <button type="button" class="btn btn-danger btn-xs row-remove"><i class="fas fa-trash"></i></button>
    </div>
  `;

  const selectEquipo = row.querySelector(".row-equipo");
  const selectJugador = row.querySelector(".row-jugador");

  function syncPlayers() {
    poblarSelectJugadores(selectJugador, Number(selectEquipo.value), jugadorId);
  }

  selectEquipo.addEventListener("change", () => {
    poblarSelectJugadores(selectJugador, Number(selectEquipo.value));
    actualizarVistaPreviaPlanilla(true);
  });

  row.querySelector(".row-remove").addEventListener("click", () => {
    row.remove();
    actualizarVistaPreviaPlanilla(true);
  });

  syncPlayers();
  lista.appendChild(row);
  actualizarVistaPreviaPlanilla(true);
}

function renderFilasEventos() {
  const listaGoles = document.getElementById("lista-goles");
  const listaTarjetas = document.getElementById("lista-tarjetas");
  if (!listaGoles || !listaTarjetas) return;

  listaGoles.innerHTML = "";
  listaTarjetas.innerHTML = "";

  const goles = Array.isArray(dataPlanilla?.goleadores) ? dataPlanilla.goleadores : [];
  const tarjetas = Array.isArray(dataPlanilla?.tarjetas) ? dataPlanilla.tarjetas : [];

  if (!goles.length) agregarFilaGol();
  else {
    goles.forEach((g) => {
      const jugador = buscarJugadorPorId(g.jugador_id);
      agregarFilaGol({
        equipo_id: g.equipo_id || jugador?.equipo_id || equiposPartido.local.id,
        jugador_id: g.jugador_id,
        goles: g.goles,
        tipo_gol: g.tipo_gol,
        minuto: g.minuto,
      });
    });
  }

  if (!tarjetas.length) agregarFilaTarjeta();
  else {
    tarjetas.forEach((t) => {
      const jugador = buscarJugadorPorId(t.jugador_id);
      agregarFilaTarjeta({
        equipo_id: t.equipo_id || jugador?.equipo_id || equiposPartido.local.id,
        jugador_id: t.jugador_id,
        tipo_tarjeta: t.tipo_tarjeta,
        minuto: t.minuto,
        observacion: t.observacion,
      });
    });
  }

  actualizarVistaPreviaPlanilla(true);
}

function actualizarVisibilidadContenidoPlanilla(mostrar) {
  const encabezado = document.getElementById("planilla-encabezado");
  const form = document.getElementById("form-planilla");
  const preview = document.getElementById("planilla-preview-card");

  if (encabezado) encabezado.style.display = mostrar ? "block" : "none";
  if (form) form.style.display = mostrar ? "block" : "none";

  if (!mostrar && preview) {
    preview.style.display = "none";
    preview.dataset.visible = "false";
  }
}

function actualizarVisibilidadFiltrosPlanilla() {
  const grupoFase = document.getElementById("grupo-fase-planilla");
  const grupoGrupo = document.getElementById("grupo-filtro-grupo-planilla");
  const grupoJornada = document.getElementById("grupo-filtro-jornada-planilla");
  const grupoRonda = document.getElementById("grupo-filtro-ronda-planilla");

  if (grupoFase instanceof HTMLElement) {
    grupoFase.hidden = !partidosSelectorPlayoffCache.length;
  }
  if (grupoGrupo instanceof HTMLElement) {
    grupoGrupo.hidden = faseSelectorActual === "playoff";
  }
  if (grupoJornada instanceof HTMLElement) {
    grupoJornada.hidden = faseSelectorActual === "playoff";
  }
  if (grupoRonda instanceof HTMLElement) {
    grupoRonda.hidden = faseSelectorActual !== "playoff";
  }
}

function poblarFaseSelectorPlanilla() {
  const selectFase = document.getElementById("select-fase-planilla");
  if (!(selectFase instanceof HTMLSelectElement)) return;

  const tieneRegular = partidosSelectorRegularCache.length > 0;
  const tienePlayoff = partidosSelectorPlayoffCache.length > 0;
  const opciones = [];
  if (tieneRegular || !tienePlayoff) {
    opciones.push({ valor: "regular", etiqueta: "Fase regular" });
  }
  if (tienePlayoff) {
    opciones.push({ valor: "playoff", etiqueta: "Playoff" });
  }

  selectFase.innerHTML = opciones
    .map((item) => `<option value="${item.valor}">${escapeHtml(item.etiqueta)}</option>`)
    .join("");

  if (!opciones.some((item) => item.valor === faseSelectorActual)) {
    faseSelectorActual = tienePlayoff && !tieneRegular ? "playoff" : "regular";
  }
  selectFase.value = faseSelectorActual;
  actualizarVisibilidadFiltrosPlanilla();
}

function poblarRondasSelectorPlanilla() {
  const selectRonda = document.getElementById("select-ronda-planilla");
  if (!(selectRonda instanceof HTMLSelectElement)) return;

  const rondas = Array.from(
    new Set(
      partidosSelectorPlayoffCache
        .map((p) => normalizarRondaPlayoffPlanilla(p?.playoff_ronda || p?.ronda || ""))
        .filter(Boolean)
    )
  ).sort((a, b) => {
    const idxA = RONDAS_PLAYOFF_PLANILLA.indexOf(String(a).toLowerCase());
    const idxB = RONDAS_PLAYOFF_PLANILLA.indexOf(String(b).toLowerCase());
    const ordenA = idxA >= 0 ? idxA : 999;
    const ordenB = idxB >= 0 ? idxB : 999;
    return ordenA - ordenB || String(a).localeCompare(String(b), "es", { sensitivity: "base" });
  });

  selectRonda.innerHTML = '<option value="">- Todas -</option>';
  rondas.forEach((ronda) => {
    selectRonda.innerHTML += `<option value="${escapeHtml(ronda)}">${escapeHtml(
      formatearRondaPlayoffPlanilla(ronda)
    )}</option>`;
  });

  if (rondaSelectorActual && rondas.includes(rondaSelectorActual)) {
    selectRonda.value = rondaSelectorActual;
  } else {
    rondaSelectorActual = "";
  }
}
function normalizarPartidoRegularSelectorPlanilla(partido = {}) {
  const id = Number.parseInt(partido?.id, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    ...partido,
    id,
    origen_fase: "regular",
  };
}

function normalizarPartidoReclasificacionSelectorPlanilla(partido = {}) {
  const id = Number.parseInt(partido?.id, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    ...partido,
    id,
    origen_fase: "playoff",
    playoff_ronda: "reclasificacion",
    ronda: "reclasificacion",
  };
}

function normalizarPartidoPlayoffSelectorPlanilla(slot = {}) {
  const partidoBaseId = Number.parseInt(slot?.partido_id, 10);
  if (!Number.isFinite(partidoBaseId) || partidoBaseId <= 0) return null;
  return {
    ...slot,
    id: partidoBaseId,
    partido_id: partidoBaseId,
    numero_campeonato:
      Number.parseInt(slot?.numero_campeonato, 10)
      || Number.parseInt(slot?.partido_numero, 10)
      || null,
    playoff_ronda: normalizarRondaPlayoffPlanilla(slot?.ronda || ""),
    ronda: normalizarRondaPlayoffPlanilla(slot?.ronda || ""),
    origen_fase: "playoff",
    grupo_id: null,
    letra_grupo: null,
    nombre_grupo: null,
  };
}

function normalizarPartidoPlayoffDesdePartidosSelectorPlanilla(partido = {}) {
  const base = normalizarPartidoRegularSelectorPlanilla(partido);
  if (!base) return null;
  return {
    ...base,
    origen_fase: "playoff",
    playoff_ronda: normalizarRondaPlayoffPlanilla(partido?.playoff_ronda || partido?.ronda || ""),
    ronda: normalizarRondaPlayoffPlanilla(partido?.playoff_ronda || partido?.ronda || ""),
    partido_numero:
      Number.parseInt(partido?.playoff_partido_numero, 10)
      || Number.parseInt(partido?.partido_numero, 10)
      || null,
    grupo_id: null,
    letra_grupo: null,
    nombre_grupo: null,
  };
}

function poblarGruposSelectorPlanilla() {
  const selectGrupo = document.getElementById("select-grupo-planilla");
  if (!selectGrupo) return;

  const grupos = Array.from(
    obtenerPartidosActivosSelectorPlanilla().reduce((map, partido) => {
      const clave = obtenerClaveGrupoPartido(partido);
      if (!map.has(clave)) {
        map.set(clave, etiquetaGrupoPartido(partido));
      }
      return map;
    }, new Map()).entries()
  ).sort((a, b) => a[1].localeCompare(b[1], "es", { sensitivity: "base", numeric: true }));

  selectGrupo.innerHTML = '<option value="">- Todos -</option>';
  grupos.forEach(([clave, etiqueta]) => {
    selectGrupo.innerHTML += `<option value="${escapeHtml(clave)}">${escapeHtml(etiqueta)}</option>`;
  });

  if (grupoSelectorActual && grupos.some(([clave]) => clave === grupoSelectorActual)) {
    selectGrupo.value = grupoSelectorActual;
  } else {
    grupoSelectorActual = "";
  }
}

function poblarJornadasSelectorPlanilla() {
  const selectJornada = document.getElementById("select-jornada-planilla");
  if (!selectJornada) return;

  const jornadas = Array.from(
    new Set(
      filtrarPartidosSelectorPorGrupo(obtenerPartidosActivosSelectorPlanilla())
        .map((p) => Number(p.jornada))
        .filter((j) => Number.isFinite(j))
    )
  ).sort((a, b) => a - b);

  selectJornada.innerHTML = '<option value="">- Todas -</option>';
  jornadas.forEach((j) => {
    selectJornada.innerHTML += `<option value="${j}">Jornada ${j}</option>`;
  });

  if (jornadaSelectorActual && jornadas.includes(Number(jornadaSelectorActual))) {
    selectJornada.value = String(jornadaSelectorActual);
  } else {
    jornadaSelectorActual = "";
  }
}

function actualizarResaltadoSelectorPartidoFinalizado() {
  const selectPartido = document.getElementById("select-partido-planilla");
  if (!(selectPartido instanceof HTMLSelectElement)) return;

  const partidoSel = Number.parseInt(selectPartido.value, 10);
  const partidoActual = (Array.isArray(partidosSelectorCache) ? partidosSelectorCache : []).find(
    (p) => Number.parseInt(p?.id, 10) === partidoSel
  );
  const cerrado = estadoPlanillaEsCerrado(partidoActual?.estado);
  selectPartido.classList.toggle("planilla-select-finalizado", cerrado);
}

function poblarPartidosSelectorPlanilla() {
  const selectPartido = document.getElementById("select-partido-planilla");
  if (!selectPartido) return;

  let partidos =
    faseSelectorActual === "playoff"
      ? filtrarPartidosSelectorPorRonda(obtenerPartidosActivosSelectorPlanilla())
      : filtrarPartidosSelectorPorGrupo(obtenerPartidosActivosSelectorPlanilla());

  if (faseSelectorActual !== "playoff" && jornadaSelectorActual) {
    partidos = partidos.filter((p) => String(p.jornada || "") === String(jornadaSelectorActual));
  }

  partidos.sort((a, b) => {
    if (faseSelectorActual === "playoff") {
      const rondaA = normalizarRondaPlayoffPlanilla(a?.playoff_ronda || a?.ronda || "");
      const rondaB = normalizarRondaPlayoffPlanilla(b?.playoff_ronda || b?.ronda || "");
      const idxA = RONDAS_PLAYOFF_PLANILLA.indexOf(rondaA);
      const idxB = RONDAS_PLAYOFF_PLANILLA.indexOf(rondaB);
      const ordenA = idxA >= 0 ? idxA : 999;
      const ordenB = idxB >= 0 ? idxB : 999;
      if (ordenA !== ordenB) return ordenA - ordenB;
      return (
        Number(a.partido_numero ?? a.playoff_partido_numero) || 0
      ) - (Number(b.partido_numero ?? b.playoff_partido_numero) || 0);
    }

    const ja = Number(a.jornada) || 0;
    const jb = Number(b.jornada) || 0;
    if (ja !== jb) return ja - jb;
    return String(a.fecha_partido || "").localeCompare(String(b.fecha_partido || ""));
  });

  selectPartido.innerHTML = '<option value="">- Selecciona un partido -</option>';
  partidos.forEach((p) => {
    const hora = (p.hora_partido || "--:--").toString().substring(0, 5);
    const estadoRaw = String(p?.estado || "").trim().toLowerCase();
    const estadoTxt = estadoRaw ? estadoRaw.replaceAll("_", " ").toUpperCase() : "PENDIENTE";
    const esFinalizado = estadoPlanillaEsCerrado(estadoRaw);
    const label =
      faseSelectorActual === "playoff"
        ? `${formatearRondaPlayoffPlanilla(p.playoff_ronda || p.ronda)} • ${obtenerEtiquetaCrucePlayoffPlanilla(p)} • ${p.equipo_local_nombre} vs ${p.equipo_visitante_nombre} • ${formatearFecha(p.fecha_partido)} ${hora} • ${estadoTxt}`
        : `P${obtenerNumeroPartidoVisible(p) || "-"} • ${etiquetaGrupoPartido(p)} • J${p.jornada || "-"} • ${p.equipo_local_nombre} vs ${p.equipo_visitante_nombre} • ${formatearFecha(p.fecha_partido)} ${hora} • ${estadoTxt}`;
    const estiloFinalizado = esFinalizado
      ? ' style="background:#fff3cd;color:#7c5a00;font-weight:700;"'
      : "";
    selectPartido.innerHTML += `<option value="${p.id}" data-estado="${escapeHtml(estadoRaw)}"${estiloFinalizado}>${escapeHtml(label)}</option>`;
  });

  if (Number.isFinite(Number(partidoId))) {
    const existe = partidos.some((p) => Number(p.id) === Number(partidoId));
    if (existe) selectPartido.value = String(partidoId);
  }

  actualizarResaltadoSelectorPartidoFinalizado();
}

function obtenerUltimaJornadaDisponible(partidos = []) {
  const jornadas = Array.from(
    new Set(partidos.map((p) => Number(p.jornada)).filter((j) => Number.isFinite(j)))
  ).sort((a, b) => a - b);

  if (!jornadas.length) return "";
  return String(jornadas[jornadas.length - 1]);
}

async function cargarPartidosSelectorPorEvento(eventoSeleccionado) {
  const eventoNum = Number(eventoSeleccionado);
  const selectGrupo = document.getElementById("select-grupo-planilla");
  const selectPartido = document.getElementById("select-partido-planilla");
  const selectRonda = document.getElementById("select-ronda-planilla");
  if (!Number.isFinite(eventoNum) || eventoNum <= 0) {
    partidosSelectorRegularCache = [];
    partidosSelectorPlayoffCache = [];
    partidosSelectorCache = [];
    grupoSelectorActual = "";
    jornadaSelectorActual = "";
    rondaSelectorActual = "";
    faseSelectorActual = "regular";
    poblarFaseSelectorPlanilla();
    poblarGruposSelectorPlanilla();
    poblarJornadasSelectorPlanilla();
    poblarRondasSelectorPlanilla();
    if (selectGrupo) selectGrupo.innerHTML = '<option value="">- Todos -</option>';
    if (selectRonda) selectRonda.innerHTML = '<option value="">- Todas -</option>';
    if (selectPartido) selectPartido.innerHTML = '<option value="">- Selecciona un partido -</option>';
    return;
  }

  try {
    const [respPartidos, respEliminatoria] = await Promise.all([
      ApiClient.get(`/partidos/evento/${eventoNum}`),
      ApiClient.get(`/eliminatorias/evento/${eventoNum}`).catch(() => ({ partidos: [] })),
    ]);

    const partidosCrudos = Array.isArray(respPartidos) ? respPartidos : (respPartidos?.partidos || []);
    const crucesCrudos = Array.isArray(respEliminatoria) ? respEliminatoria : (respEliminatoria?.partidos || []);

    const reclasificaciones = partidosCrudos
      .filter((p) => Boolean(p?.es_reclasificacion_playoff))
      .map((p) => normalizarPartidoReclasificacionSelectorPlanilla(p))
      .filter(Boolean);

    const playoffDesdePartidos = partidosCrudos
      .filter((p) => !p?.es_reclasificacion_playoff && esPartidoPlayoffPlanilla(p))
      .map((p) => normalizarPartidoPlayoffDesdePartidosSelectorPlanilla(p))
      .filter(Boolean);

    const crucesPlayoff = crucesCrudos
      .map((slot) => normalizarPartidoPlayoffSelectorPlanilla(slot))
      .filter(Boolean);

    const mapaPlayoff = new Map();
    [...playoffDesdePartidos, ...reclasificaciones, ...crucesPlayoff].forEach((item) => {
      const id = Number(item?.id);
      if (!Number.isFinite(id) || id <= 0) return;
      mapaPlayoff.set(id, item);
    });

    const idsPlayoff = new Set(mapaPlayoff.keys());

    partidosSelectorRegularCache = partidosCrudos
      .map((p) => normalizarPartidoRegularSelectorPlanilla(p))
      .filter((p) => p && !idsPlayoff.has(Number(p.id)) && !p.es_reclasificacion_playoff);

    partidosSelectorPlayoffCache = [...mapaPlayoff.values()];

    let partidoMatch = null;
    if (Number.isFinite(Number(partidoId))) {
      partidoMatch =
        partidosSelectorPlayoffCache.find((p) => Number(p.id) === Number(partidoId)) ||
        partidosSelectorRegularCache.find((p) => Number(p.id) === Number(partidoId)) ||
        null;
    }

    if (partidoMatch) {
      faseSelectorActual = esPartidoPlayoffPlanilla(partidoMatch) ? "playoff" : "regular";
      grupoSelectorActual = faseSelectorActual === "playoff" ? "" : obtenerClaveGrupoPartido(partidoMatch);
      jornadaSelectorActual =
        faseSelectorActual === "playoff" || !Number.isFinite(Number(partidoMatch.jornada))
          ? ""
          : String(partidoMatch.jornada);
      rondaSelectorActual =
        faseSelectorActual === "playoff"
          ? normalizarRondaPlayoffPlanilla(partidoMatch.playoff_ronda || partidoMatch.ronda || "")
          : "";
    } else {
      if (faseSelectorActual === "playoff" && !partidosSelectorPlayoffCache.length) {
        faseSelectorActual = partidosSelectorRegularCache.length ? "regular" : "playoff";
      }
      if (faseSelectorActual !== "playoff" && !partidosSelectorRegularCache.length && partidosSelectorPlayoffCache.length) {
        faseSelectorActual = "playoff";
      }
      if (!jornadaSelectorActual && faseSelectorActual !== "playoff") {
        jornadaSelectorActual = obtenerUltimaJornadaDisponible(
          filtrarPartidosSelectorPorGrupo(partidosSelectorRegularCache)
        );
      }
      if (faseSelectorActual !== "playoff") {
        rondaSelectorActual = "";
      }
    }

    sincronizarCacheActivoSelectorPlanilla();
    poblarFaseSelectorPlanilla();
    poblarGruposSelectorPlanilla();
    poblarJornadasSelectorPlanilla();
    poblarRondasSelectorPlanilla();
    poblarPartidosSelectorPlanilla();
  } catch (error) {
    console.error("Error cargando partidos para planillaje directo:", error);
    mostrarNotificacion("Error cargando partidos del evento", "error");
    partidosSelectorRegularCache = [];
    partidosSelectorPlayoffCache = [];
    partidosSelectorCache = [];
    grupoSelectorActual = "";
    jornadaSelectorActual = "";
    rondaSelectorActual = "";
    faseSelectorActual = "regular";
    poblarFaseSelectorPlanilla();
    poblarGruposSelectorPlanilla();
    poblarJornadasSelectorPlanilla();
    poblarRondasSelectorPlanilla();
    if (selectGrupo) selectGrupo.innerHTML = '<option value="">- Todos -</option>';
    if (selectRonda) selectRonda.innerHTML = '<option value="">- Todas -</option>';
    if (selectPartido) selectPartido.innerHTML = '<option value="">- Selecciona un partido -</option>';
  }
}

async function cargarEventosSelectorPlanilla() {
  const selectCampeonato = document.getElementById("select-campeonato-planilla");
  const selectEvento = document.getElementById("select-evento-planilla");
  const selectFase = document.getElementById("select-fase-planilla");
  const selectGrupo = document.getElementById("select-grupo-planilla");
  const selectJornada = document.getElementById("select-jornada-planilla");
  const selectRonda = document.getElementById("select-ronda-planilla");
  const selectPartido = document.getElementById("select-partido-planilla");
  if (!selectEvento || !selectGrupo || !selectJornada || !selectRonda || !selectPartido) return;
  selectEvento.innerHTML = '<option value="">- Selecciona una categorÃ­a -</option>';
  selectGrupo.innerHTML = '<option value="">- Todos -</option>';
  selectJornada.innerHTML = '<option value="">- Todas -</option>';
  selectRonda.innerHTML = '<option value="">- Todas -</option>';
  selectEvento.disabled = true;
  if (selectPartido) {
    selectPartido.innerHTML = '<option value="">- Selecciona un partido -</option>';
  }

  try {
    if (selectCampeonato?.value) {
      const campSel = Number.parseInt(selectCampeonato.value, 10);
      if (Number.isFinite(campSel) && campSel > 0) {
        campeonatoIdContexto = campSel;
      }
    }

    const campId = Number.parseInt(campeonatoIdContexto, 10);
    if (!Number.isFinite(campId) || campId <= 0) {
      eventosPlanillaCache = [];
      return;
    }

    const endpoint = `/eventos/campeonato/${campId}`;
    const resp = await ApiClient.get(endpoint);
    eventosPlanillaCache = Array.isArray(resp) ? resp : (resp.eventos || []);
    selectEvento.disabled = false;

    eventosPlanillaCache.forEach((e) => {
      const nombre = String(e?.nombre || `CategorÃ­a ${e?.id || ""}`).trim();
      selectEvento.innerHTML += `<option value="${e.id}">${escapeHtml(nombre)}</option>`;
    });

    selectEvento.onchange = async () => {
      eventoId = selectEvento.value ? Number(selectEvento.value) : null;
      grupoSelectorActual = "";
      jornadaSelectorActual = "";
      rondaSelectorActual = "";
      faseSelectorActual = "regular";
      partidoId = NaN;
      guardarContextoRutaPlanilla();
      await cargarPartidosSelectorPorEvento(eventoId);
      actualizarVisibilidadContenidoPlanilla(false);
    };

    if (selectFase instanceof HTMLSelectElement) {
      selectFase.onchange = () => {
        faseSelectorActual = String(selectFase.value || "regular").trim().toLowerCase() === "playoff" ? "playoff" : "regular";
        grupoSelectorActual = "";
        jornadaSelectorActual = "";
        rondaSelectorActual = "";
        sincronizarCacheActivoSelectorPlanilla();
        actualizarVisibilidadFiltrosPlanilla();
        poblarGruposSelectorPlanilla();
        poblarJornadasSelectorPlanilla();
        poblarRondasSelectorPlanilla();
        poblarPartidosSelectorPlanilla();
        guardarContextoRutaPlanilla();
      };
    }

    selectGrupo.onchange = () => {
      grupoSelectorActual = selectGrupo.value || "";
      const jornadasDisponibles = filtrarPartidosSelectorPorGrupo(obtenerPartidosActivosSelectorPlanilla())
        .map((p) => Number(p.jornada))
        .filter((j) => Number.isFinite(j));

      if (!jornadasDisponibles.includes(Number(jornadaSelectorActual))) {
        jornadaSelectorActual = obtenerUltimaJornadaDisponible(
          filtrarPartidosSelectorPorGrupo(obtenerPartidosActivosSelectorPlanilla())
        );
      }

      poblarGruposSelectorPlanilla();
      poblarJornadasSelectorPlanilla();
      poblarPartidosSelectorPlanilla();
      guardarContextoRutaPlanilla();
    };

    selectJornada.onchange = () => {
      jornadaSelectorActual = selectJornada.value || "";
      poblarPartidosSelectorPlanilla();
      guardarContextoRutaPlanilla();
    };

    selectRonda.onchange = () => {
      rondaSelectorActual = selectRonda.value || "";
      poblarPartidosSelectorPlanilla();
      guardarContextoRutaPlanilla();
    };

    selectPartido.onchange = () => {
      const idSel = Number(selectPartido.value);
      partidoId = Number.isFinite(idSel) ? idSel : NaN;
      guardarContextoRutaPlanilla();
      actualizarResaltadoSelectorPartidoFinalizado();
    };

    if (Number.isFinite(Number(eventoId))) {
      selectEvento.value = String(eventoId);
      await cargarPartidosSelectorPorEvento(eventoId);
    }
  } catch (error) {
    console.error("Error cargando CategorÃ­as para planillaje directo:", error);
    mostrarNotificacion("Error cargando CategorÃ­as", "error");
  }
}

async function cargarCampeonatosSelectorPlanilla() {
  const selectCampeonato = document.getElementById("select-campeonato-planilla");
  if (!selectCampeonato) {
    await cargarEventosSelectorPlanilla();
    return;
  }

  selectCampeonato.innerHTML = '<option value="">- Selecciona un campeonato -</option>';
  try {
    const respCamp = await ApiClient.get("/campeonatos");
    const lista = Array.isArray(respCamp) ? respCamp : (respCamp?.campeonatos || []);

    lista.forEach((camp) => {
      selectCampeonato.innerHTML += `<option value="${camp.id}">${escapeHtml(camp.nombre || `Campeonato ${camp.id}`)}</option>`;
    });

    if (Number.isFinite(Number(campeonatoIdContexto)) && campeonatoIdContexto > 0) {
      const existe = lista.some((c) => Number(c.id) === Number(campeonatoIdContexto));
      if (existe) {
        selectCampeonato.value = String(campeonatoIdContexto);
      }
    }

    if (!selectCampeonato.value && lista.length) {
      const ultimo = [...lista].sort((a, b) => Number(b.id) - Number(a.id))[0];
      const campDefault = Number.parseInt(ultimo?.id, 10);
      if (Number.isFinite(campDefault) && campDefault > 0) {
        campeonatoIdContexto = campDefault;
        localStorage.setItem("sgd_planilla_camp", String(campDefault));
        selectCampeonato.value = String(campDefault);
      }
    }

    selectCampeonato.onchange = async () => {
      const campId = Number.parseInt(selectCampeonato.value || "", 10);
      campeonatoIdContexto = Number.isFinite(campId) && campId > 0 ? campId : null;
      if (Number.isFinite(Number(campeonatoIdContexto))) {
        localStorage.setItem("sgd_planilla_camp", String(campeonatoIdContexto));
      }

      eventoId = null;
      partidoId = NaN;
      grupoSelectorActual = "";
      jornadaSelectorActual = "";
      guardarContextoRutaPlanilla();
      actualizarVisibilidadContenidoPlanilla(false);
      await cargarEventosSelectorPlanilla();
    };
  } catch (error) {
    console.error("Error cargando campeonatos en planilla:", error);
    mostrarNotificacion("Error cargando campeonatos", "error");
  }

  await cargarEventosSelectorPlanilla();
}

async function resolverCampeonatoContextoPlanilla() {
  const routeContext = window.RouteContext?.read?.("planilla.html", ["campeonato", "evento", "partido", "fase", "ronda"]) || {};

  const campFromRoute = aEntero(routeContext.campeonato, NaN);
  if (Number.isFinite(campFromRoute) && campFromRoute > 0) {
    campeonatoIdContexto = campFromRoute;
    localStorage.setItem("sgd_planilla_camp", String(campFromRoute));
    return;
  }

  const campCachePlanilla = aEntero(localStorage.getItem("sgd_planilla_camp"), NaN);
  if (Number.isFinite(campCachePlanilla) && campCachePlanilla > 0) {
    campeonatoIdContexto = campCachePlanilla;
  }

  const campCachePartidos = aEntero(localStorage.getItem("sgd_partidos_camp"), NaN);
  if (!Number.isFinite(Number(campeonatoIdContexto)) && Number.isFinite(campCachePartidos) && campCachePartidos > 0) {
    campeonatoIdContexto = campCachePartidos;
  }

  const faseRuta = String(routeContext.fase || "").trim().toLowerCase();
  if (faseRuta === "playoff" || faseRuta === "regular") {
    faseSelectorActual = faseRuta;
  }
  rondaSelectorActual = normalizarRondaPlayoffPlanilla(routeContext.ronda || "");

  const eventoFromRoute = aEntero(routeContext.evento, NaN);
  if (Number.isFinite(eventoFromRoute) && eventoFromRoute > 0) {
    try {
      const respEvento = await ApiClient.get(`/eventos/${eventoFromRoute}`);
      const evento = respEvento?.evento || respEvento || {};
      const campEvt = Number.parseInt(evento?.campeonato_id, 10);
      if (Number.isFinite(campEvt) && campEvt > 0) {
        campeonatoIdContexto = campEvt;
        localStorage.setItem("sgd_planilla_camp", String(campEvt));
      }
    } catch (error) {
      console.warn("No se pudo resolver campeonato de la categorÃ­a para planilla:", error);
    }
  }
}

async function sincronizarSelectoresDesdePlanillaActual() {
  const selectEvento = document.getElementById("select-evento-planilla");
  const selectFase = document.getElementById("select-fase-planilla");
  const selectGrupo = document.getElementById("select-grupo-planilla");
  const selectJornada = document.getElementById("select-jornada-planilla");
  const selectRonda = document.getElementById("select-ronda-planilla");
  const selectPartido = document.getElementById("select-partido-planilla");
  const p = dataPlanilla?.partido;
  if (!selectEvento || !selectGrupo || !selectJornada || !selectRonda || !selectPartido || !p) return;

  const eventoActual = Number(p.evento_id || eventoId);
  if (Number.isFinite(eventoActual) && eventoActual > 0) {
    eventoId = eventoActual;
    if (String(selectEvento.value) !== String(eventoActual)) {
      selectEvento.value = String(eventoActual);
      await cargarPartidosSelectorPorEvento(eventoActual);
    } else if (!partidosSelectorRegularCache.length && !partidosSelectorPlayoffCache.length) {
      await cargarPartidosSelectorPorEvento(eventoActual);
    }
  }

  const partidoMatchPlayoff = partidosSelectorPlayoffCache.find((item) => Number(item.id) === Number(partidoId)) || null;
  const partidoMatchRegular = partidosSelectorRegularCache.find((item) => Number(item.id) === Number(partidoId)) || null;

  if (partidoMatchPlayoff || esPartidoPlayoffPlanilla(p)) {
    faseSelectorActual = "playoff";
    rondaSelectorActual = normalizarRondaPlayoffPlanilla(
      partidoMatchPlayoff?.playoff_ronda || partidoMatchPlayoff?.ronda || p?.playoff_ronda || p?.ronda || ""
    );
    grupoSelectorActual = "";
    jornadaSelectorActual = "";
  } else {
    faseSelectorActual = "regular";
    grupoSelectorActual = obtenerClaveGrupoPartido(partidoMatchRegular || p);
    if (Number.isFinite(Number((partidoMatchRegular || p)?.jornada))) {
      jornadaSelectorActual = String((partidoMatchRegular || p).jornada);
    }
    rondaSelectorActual = "";
  }

  sincronizarCacheActivoSelectorPlanilla();
  poblarFaseSelectorPlanilla();
  if (selectFase instanceof HTMLSelectElement) {
    selectFase.value = faseSelectorActual;
  }
  poblarGruposSelectorPlanilla();
  poblarJornadasSelectorPlanilla();
  poblarRondasSelectorPlanilla();

  if (faseSelectorActual === "playoff") {
    selectRonda.value = rondaSelectorActual;
  } else {
    selectGrupo.value = grupoSelectorActual;
    if (jornadaSelectorActual) {
      selectJornada.value = jornadaSelectorActual;
    }
  }

  poblarPartidosSelectorPlanilla();
  if (Number.isFinite(Number(partidoId))) {
    selectPartido.value = String(partidoId);
  }
}

async function cargarPlanillaDesdeSelector() {
  const selectEvento = document.getElementById("select-evento-planilla");
  const selectPartido = document.getElementById("select-partido-planilla");

  const idPartido = Number(selectPartido?.value);
  const idEvento = Number(selectEvento?.value);

  if (!Number.isFinite(idPartido) || idPartido <= 0) {
    mostrarNotificacion("Selecciona un partido para cargar su planilla", "warning");
    return;
  }

  partidoId = idPartido;
  eventoId = Number.isFinite(idEvento) ? idEvento : null;
  guardarContextoRutaPlanilla();
  window.RouteContext?.cleanUrl?.();

  await cargarPlanilla();
}

async function cargarPlanilla() {
  if (!Number.isFinite(Number(partidoId)) || Number(partidoId) <= 0) return;

  try {
    const resp = await ApiClient.get(`/partidos/${partidoId}/planilla`);
    dataPlanilla = resp;
  aplicarRegistroPlanillaAPlanteles();
    dataPlanilla.auspiciantes = await cargarAuspiciantesActivosPlanilla(dataPlanilla?.partido?.campeonato_id);

    const p = dataPlanilla.partido || {};
    equiposPartido = {
      local: { id: p.equipo_local_id, nombre: p.equipo_local_nombre || "Local" },
      visitante: { id: p.equipo_visitante_id, nombre: p.equipo_visitante_nombre || "Visitante" },
    };

    documentosRequeridos = {
      cedula: dataPlanilla.documentos_requeridos?.cedula !== false,
      foto_cedula: dataPlanilla.documentos_requeridos?.foto_cedula === true,
      foto_carnet: dataPlanilla.documentos_requeridos?.foto_carnet === true,
    };

    renderEncabezado();
    cargarCamposBase();
    renderCapturaOficialPorJugador();
    actualizarVisibilidadContenidoPlanilla(true);
    await sincronizarSelectoresDesdePlanillaActual();
    actualizarVistaPreviaPlanilla(true);
  } catch (error) {
    console.error("Error cargando planilla:", error);
    mostrarNotificacion(error.message || "Error cargando planilla", "error");
  }
}

function recolectarPayloadPlanilla() {
  const inasistenciaEquipo = obtenerInasistenciaPlanilla();
  const ambosNoPresentes = inasistenciaEquipo === "ambos";
  const bloqueados = obtenerLadosBloqueadosPlanilla(inasistenciaEquipo);
  const hayInasistencia = bloqueados.local || bloqueados.visitante;
  const resultadoAutomatico = obtenerResultadoPorInasistencia(inasistenciaEquipo);
  const observacionesLocal = obtenerObservacionesLocalPlanilla();
  const observacionesVisitante = obtenerObservacionesVisitantePlanilla();
  const goles = [];
  const tarjetas = [];
  const numerosJugadores = [];
  const registroJugadoresLocal = [];
  const registroJugadoresVisitante = [];
  const filasCaptura = Array.from(document.querySelectorAll(".planilla-player-row"));
  const faltas = normalizarEstadoFaltasPlanilla(obtenerEstadoFaltasPlanilla());
  if (bloqueados.local) {
    faltas.local_1er = 0;
    faltas.local_2do = 0;
    faltas.local_total = 0;
  }
  if (bloqueados.visitante) {
    faltas.visitante_1er = 0;
    faltas.visitante_2do = 0;
    faltas.visitante_total = 0;
  }

  if (filasCaptura.length) {
    filasCaptura.forEach((row) => {
      const equipoId = Number(row.dataset.equipoId);
      const jugadorId = Number(row.dataset.jugadorId);
      if (!Number.isFinite(equipoId) || !Number.isFinite(jugadorId) || estaEquipoBloqueadoPlanilla(equipoId, inasistenciaEquipo)) {
        return;
      }

      const numeroCamiseta = normalizarNumeroCamisetaPlanilla(row.querySelector(".cap-numero")?.value, {
        permitirVacio: true,
      });
      const convocatoria = obtenerConvocatoriaFilaPlanilla(row, {
        permitirVacio: true,
      }) || null;
      const entra = esPlanillaFutbol11() ? row.querySelector(".cap-entra")?.checked === true : false;
      const sale = esPlanillaFutbol11() ? row.querySelector(".cap-sale")?.checked === true : false;
      actualizarRegistroJugadorEnDataPlanilla(jugadorId, equipoId, {
        numero_camiseta: numeroCamiseta,
        convocatoria,
        entra,
        sale,
      });
      numerosJugadores.push({
        equipo_id: equipoId,
        jugador_id: jugadorId,
        numero_camiseta: numeroCamiseta || null,
      });
      const registroJugador = {
        equipo_id: equipoId,
        jugador_id: jugadorId,
        numero_camiseta: numeroCamiseta || null,
        convocatoria,
        entra,
        sale,
      };
      if (equipoId === Number(equiposPartido.local.id)) {
        registroJugadoresLocal.push(registroJugador);
      } else if (equipoId === Number(equiposPartido.visitante.id)) {
        registroJugadoresVisitante.push(registroJugador);
      }

      const golesNum = valorNoNegativoEntero(row.querySelector(".cap-goles")?.value, 0, 99);
      const tipoPuntoBasquet = esPlanillaBasquetbol()
        ? String(row.querySelector(".cap-tipo-punto")?.value || "canasta").trim()
        : null;
      const tarjetasNormalizadas = normalizarTarjetasFilaCaptura(row);
      const amarillasNum = tarjetasNormalizadas.amarillas;
      const rojasDirectasNum = tarjetasNormalizadas.rojasDirectas;
      const rojasDobleAmarillaNum = tarjetasNormalizadas.rojasPorDobleAmarilla;

      if (golesNum > 0) {
        goles.push({
          equipo_id: equipoId,
          jugador_id: jugadorId,
          goles: golesNum,
          tipo_gol: tipoPuntoBasquet || "campo",
          tipo_punto: tipoPuntoBasquet || null,
          minuto: null,
        });
      }

      for (let i = 0; i < amarillasNum; i += 1) {
        tarjetas.push({
          equipo_id: equipoId,
          jugador_id: jugadorId,
          tipo_tarjeta: "amarilla",
          minuto: null,
          observacion: null,
        });
      }

      for (let i = 0; i < rojasDirectasNum; i += 1) {
        tarjetas.push({
          equipo_id: equipoId,
          jugador_id: jugadorId,
          tipo_tarjeta: "roja",
          minuto: null,
          observacion: "Roja directa",
        });
      }
      for (let i = 0; i < rojasDobleAmarillaNum; i += 1) {
        tarjetas.push({
          equipo_id: equipoId,
          jugador_id: jugadorId,
          tipo_tarjeta: "roja",
          minuto: null,
          observacion: "Expulsión por doble amarilla",
        });
      }
    });
  } else if (!hayInasistencia) {
    // Respaldo del flujo anterior por filas manuales.
    document.querySelectorAll(".planilla-row-gol").forEach((row) => {
      const equipoId = aEntero(row.querySelector(".row-equipo")?.value, NaN);
      const jugadorId = aEntero(row.querySelector(".row-jugador")?.value, NaN);
      const golesNum = aEntero(row.querySelector(".row-goles")?.value, 0);
      const tipoGol = String(row.querySelector(".row-tipo-gol")?.value || "campo").trim().toLowerCase();
      const minutoRaw = row.querySelector(".row-minuto")?.value;
      const minuto = minutoRaw ? aEntero(minutoRaw, null) : null;

      if (!Number.isFinite(equipoId) || !Number.isFinite(jugadorId) || golesNum <= 0) return;
      if (estaEquipoBloqueadoPlanilla(equipoId, inasistenciaEquipo)) return;

      goles.push({
        equipo_id: equipoId,
        jugador_id: jugadorId,
        goles: golesNum,
        tipo_gol: tipoGol || "campo",
        minuto,
      });
    });

    document.querySelectorAll(".planilla-row-tarjeta").forEach((row) => {
      const equipoId = aEntero(row.querySelector(".row-equipo")?.value, NaN);
      const jugadorId = aEntero(row.querySelector(".row-jugador")?.value, NaN);
      const tipoTarjeta = String(row.querySelector(".row-tipo-tarjeta")?.value || "").trim().toLowerCase();
      const minutoRaw = row.querySelector(".row-minuto")?.value;
      const observacion = String(row.querySelector(".row-observacion")?.value || "").trim();

      if (!Number.isFinite(equipoId) || !Number.isFinite(jugadorId) || !tipoTarjeta) return;
      if (estaEquipoBloqueadoPlanilla(equipoId, inasistenciaEquipo)) return;

      tarjetas.push({
        equipo_id: equipoId,
        jugador_id: jugadorId,
        tipo_tarjeta: tipoTarjeta,
        minuto: minutoRaw ? aEntero(minutoRaw, null) : null,
        observacion: observacion || null,
      });
    });
    tarjetas.splice(0, tarjetas.length, ...normalizarTarjetasPayload(tarjetas));
  }

  const resultadoLocalShootouts = hayInasistencia
    ? null
    : normalizarMarcadorPenalesPlanilla(document.getElementById("resultado-local-penales")?.value, {
        permitirVacio: true,
      });
  const resultadoVisitanteShootouts = hayInasistencia
    ? null
    : normalizarMarcadorPenalesPlanilla(document.getElementById("resultado-visitante-penales")?.value, {
        permitirVacio: true,
      });

  return {
    numero_campeonato: normalizarNumeroPartidoPlanilla(
      document.getElementById("numero-partido-planilla")?.value,
      { permitirVacio: true }
    ),
    resultado_local: hayInasistencia
      ? resultadoAutomatico.local
      : aEntero(document.getElementById("resultado-local")?.value, 0),
    resultado_visitante: hayInasistencia
      ? resultadoAutomatico.visitante
      : aEntero(document.getElementById("resultado-visitante")?.value, 0),
    estado: hayInasistencia
      ? resultadoAutomatico.estado || "finalizado"
      : String(document.getElementById("estado-partido")?.value || "finalizado"),
    ambos_no_presentes: ambosNoPresentes,
    inasistencia_equipo: inasistenciaEquipo,
    resultado_local_shootouts: resultadoLocalShootouts,
    resultado_visitante_shootouts: resultadoVisitanteShootouts,
    shootouts:
      Number.isFinite(resultadoLocalShootouts) && Number.isFinite(resultadoVisitanteShootouts),
    arbitro: String(document.getElementById("arbitro-planilla")?.value || "").trim(),
    arbitro_linea_1: String(document.getElementById("arbitro-linea-1-planilla")?.value || "").trim(),
    arbitro_linea_2: String(document.getElementById("arbitro-linea-2-planilla")?.value || "").trim(),
    delegado_partido: String(document.getElementById("delegado-planilla")?.value || "").trim(),
    ciudad: String(document.getElementById("ciudad-planilla")?.value || "").trim(),
    observaciones: observacionesLocal,
    observaciones_local: observacionesLocal,
    observaciones_visitante: observacionesVisitante,
    observaciones_arbitro: obtenerObservacionesArbitroPlanilla(),
    pagos: {
      pago_ta_local: bloqueados.local ? 0 : leerPagoInput("pago-ta-local"),
      pago_ta_visitante: bloqueados.visitante ? 0 : leerPagoInput("pago-ta-visitante"),
      pago_tr_local: bloqueados.local ? 0 : leerPagoInput("pago-tr-local"),
      pago_tr_visitante: bloqueados.visitante ? 0 : leerPagoInput("pago-tr-visitante"),
      pago_arbitraje_local: bloqueados.local ? 0 : leerPagoInput("pago-arbitraje-local"),
      pago_arbitraje_visitante: bloqueados.visitante ? 0 : leerPagoInput("pago-arbitraje-visitante"),
      // Compatibilidad con campos globales anteriores
      pago_ta:
        (bloqueados.local ? 0 : leerPagoInput("pago-ta-local")) +
        (bloqueados.visitante ? 0 : leerPagoInput("pago-ta-visitante")),
      pago_tr:
        (bloqueados.local ? 0 : leerPagoInput("pago-tr-local")) +
        (bloqueados.visitante ? 0 : leerPagoInput("pago-tr-visitante")),
      pago_arbitraje:
        (bloqueados.local ? 0 : leerPagoInput("pago-arbitraje-local")) +
        (bloqueados.visitante ? 0 : leerPagoInput("pago-arbitraje-visitante")),
      pago_local: bloqueados.local ? 0 : leerPagoInput("pago-local"),
      pago_visitante: bloqueados.visitante ? 0 : leerPagoInput("pago-visitante"),
    },
    faltas,
    faltas_local_total: faltas.local_total,
    faltas_visitante_total: faltas.visitante_total,
    overtime_utilizado: esPlanillaBasquetbol()
      ? !!(document.getElementById("resultado-overtime-local")?.value || document.getElementById("resultado-overtime-visitante")?.value)
      : false,
    overtime_puntos_local: esPlanillaBasquetbol()
      ? (aEntero(document.getElementById("resultado-overtime-local")?.value, null) ?? null)
      : null,
    overtime_puntos_visitante: esPlanillaBasquetbol()
      ? (aEntero(document.getElementById("resultado-overtime-visitante")?.value, null) ?? null)
      : null,
    numeros_jugadores: numerosJugadores,
    registro_jugadores_local: registroJugadoresLocal,
    registro_jugadores_visitante: registroJugadoresVisitante,
    goles,
    tarjetas,
  };
}

function obtenerRegistroBasePlanilla() {
  return {
    numero_camiseta: "",
    convocatoria: "",
    entra: false,
    sale: false,
  };
}

function obtenerColumnasRegistroPlanilla({ encabezadoCompleto = false, modo = "resumen" } = {}) {
  const esCaptura = modo === "captura";
  const usaConvocatoria = usaConvocatoriaPlanilla();
  const columnas = [
    {
      key: "item",
      label: encabezadoCompleto ? "#" : "Item",
      headerClass: "planilla-col-item",
      cellClass: "planilla-col-item",
      pdfWidth: 12,
    },
    {
      key: "numero",
      label: "N",
      headerClass: "planilla-col-numero",
      cellClass: "planilla-col-numero",
      pdfWidth: 12,
    },
  ];
  if (usaConvocatoria) {
    if (esCaptura) {
      columnas.push({
        key: "convocatoria",
        label: "P/S",
        headerClass: "planilla-col-convocatoria",
        cellClass: "planilla-col-convocatoria",
        pdfWidth: 10,
      });
    } else {
      columnas.push(
        {
          key: "convocatoria_principal",
          label: "P",
          headerClass: "planilla-col-convocatoria-p",
          cellClass: "planilla-col-convocatoria-p",
          pdfWidth: 8,
        },
        {
          key: "convocatoria_suplente",
          label: "S",
          headerClass: "planilla-col-convocatoria-s",
          cellClass: "planilla-col-convocatoria-s",
          pdfWidth: 8,
        }
      );
    }
  }
  if (esPlanillaFutbol11()) {
    columnas.push(
      {
        key: "entra",
        label: encabezadoCompleto || esCaptura ? "E" : "Entra",
        headerClass: "planilla-col-entra",
        cellClass: "planilla-col-entra",
        pdfWidth: 9,
      },
      {
        key: "sale",
        label: encabezadoCompleto || esCaptura ? "S" : "Sale",
        headerClass: "planilla-col-sale",
        cellClass: "planilla-col-sale",
        pdfWidth: 9,
      }
    );
  }
  columnas.push(
    {
      key: "nombre",
      label: "Jugador",
      headerClass: "planilla-col-jugador",
      cellClass: "planilla-col-jugador",
      pdfWidth: "*",
    },
    {
      key: "goles",
      label: esPlanillaBasquetbol() ? (encabezadoCompleto ? "Pts" : "P") : (encabezadoCompleto ? "Gol" : "G"),
      headerClass: "planilla-col-goles",
      cellClass: "planilla-col-goles",
      pdfWidth: esPlanillaBasquetbol() ? 28 : 12,
    },
    {
      key: "amarillas",
      label: esPlanillaBasquetbol() ? "Falt" : "TA",
      headerClass: "planilla-col-ta",
      cellClass: "planilla-col-ta",
      pdfWidth: 12,
    },
    {
      key: "rojas",
      label: esPlanillaBasquetbol() ? "F.Téc" : "TR",
      headerClass: "planilla-col-tr",
      cellClass: "planilla-col-tr",
      pdfWidth: 12,
    }
  );
  return columnas;
}

function renderCabeceraTablaPlanillaHtml({ encabezadoCompleto = false, modo = "resumen" } = {}) {
  return `<tr>${obtenerColumnasRegistroPlanilla({ encabezadoCompleto, modo })
    .map((col) => `<th class="${col.headerClass}">${col.label}</th>`)
    .join("")}</tr>`;
}

function obtenerColumnasPdfPlanilla() {
  return obtenerColumnasRegistroPlanilla({ encabezadoCompleto: true, modo: "pdf" }).map((col) => col.pdfWidth);
}

function obtenerJugadoresImpresionPlanilla(jugadores, maxFilas) {
  const lista = Array.isArray(jugadores) ? jugadores : [];
  const tope = Number.isFinite(Number(maxFilas)) && Number(maxFilas) > 0 ? Number(maxFilas) : lista.length;
  return lista
    .filter((jugador) => jugador && (Number.isFinite(Number(jugador.id)) || Boolean(nombreJugador(jugador))))
    .slice(0, tope);
}

function renderFilasVistaPreviaEquipo(jugadores, stats, maxFilas) {
  const filas = [];
  for (let i = 0; i < maxFilas; i += 1) {
    const j = jugadores[i] || null;
    const esArquero = esPosicionArqueroPlanilla(j?.posicion);
    const jugadorId = Number(j?.id);
    const registro = j ? obtenerRegistroPlanillaJugador(j) : obtenerRegistroBasePlanilla();
    const item = i + 1;
    const numero = j ? registro.numero_camiseta || j.numero_camiseta || "" : "";
    const nombre = j ? `${j.apellido || ""} ${j.nombre || ""}`.trim() : "";
    const convocatoria = j ? normalizarConvocatoriaPlanilla(registro.convocatoria || "") : "";
    const entra = j && registro.entra ? "X" : "";
    const sale = j && registro.sale ? "X" : "";
    const goles = j ? stats.golesPorJugador.get(jugadorId) || "" : "";
    const amarillas = j ? stats.amarillasPorJugador.get(jugadorId) || "" : "";
    const rojas = j ? stats.rojasPorJugador.get(jugadorId) || "" : "";
    const columnas = obtenerColumnasRegistroPlanilla({ modo: "resumen" });

    const cells = columnas.map((col) => {
      switch (col.key) {
        case "item":
          return `<td class="${col.cellClass}">${item}</td>`;
        case "numero":
          return `<td class="${col.cellClass}">${escapeHtml(String(numero))}</td>`;
        case "convocatoria":
          return `<td class="${col.cellClass}">${escapeHtml(convocatoria)}</td>`;
        case "convocatoria_principal":
          return `<td class="${col.cellClass}">${convocatoria === "P" ? "X" : ""}</td>`;
        case "convocatoria_suplente":
          return `<td class="${col.cellClass}">${convocatoria === "S" ? "X" : ""}</td>`;
        case "entra":
          return `<td class="${col.cellClass}">${escapeHtml(entra)}</td>`;
        case "sale":
          return `<td class="${col.cellClass}">${escapeHtml(sale)}</td>`;
        case "nombre":
          return `<td class="${col.cellClass}">${escapeHtml(nombre)}</td>`;
        case "goles":
          return `<td class="${col.cellClass}">${goles}</td>`;
        case "amarillas":
          return `<td class="${col.cellClass}">${amarillas}</td>`;
        case "rojas":
          return `<td class="${col.cellClass}">${rojas}</td>`;
        default:
          return `<td class="${col.cellClass}"></td>`;
      }
    });

    filas.push(`
      <tr class="${esArquero ? "is-goalkeeper" : ""}">
        ${cells.join("")}
      </tr>
    `);
  }
  return filas.join("");
}

function renderListaEventosVistaPrevia(payload) {
  const jugadoresMap = new Map();
  [...(dataPlanilla?.plantel_local || []), ...(dataPlanilla?.plantel_visitante || [])].forEach((j) => {
    jugadoresMap.set(Number(j.id), nombreJugador(j));
  });

  const golesItems = (payload.goles || []).map((g) => {
    const nombre = jugadoresMap.get(Number(g.jugador_id)) || `Jugador ${g.jugador_id}`;
    const equipoTxt =
      Number(g.equipo_id) === Number(equiposPartido.local.id)
        ? equiposPartido.local.nombre
        : equiposPartido.visitante.nombre;
    const minuto = g.minuto ? `min ${g.minuto}` : "min -";
    return `<li><strong>${escapeHtml(equipoTxt)}</strong>: ${escapeHtml(nombre)} (${g.goles}) - ${escapeHtml(minuto)}</li>`;
  });

  const tarjetasItems = (payload.tarjetas || []).map((t) => {
    const nombre = jugadoresMap.get(Number(t.jugador_id)) || `Jugador ${t.jugador_id}`;
    const equipoTxt =
      Number(t.equipo_id) === Number(equiposPartido.local.id)
        ? equiposPartido.local.nombre
        : equiposPartido.visitante.nombre;
    const minuto = t.minuto ? `min ${t.minuto}` : "min -";
    const tipo = String(t.tipo_tarjeta || "").toUpperCase();
    return `<li><strong>${escapeHtml(equipoTxt)}</strong>: ${escapeHtml(nombre)} - ${escapeHtml(tipo)} (${escapeHtml(minuto)})</li>`;
  });

  return {
    golesHtml: golesItems.length ? golesItems.join("") : "<li>Sin goles registrados.</li>",
    tarjetasHtml: tarjetasItems.length ? tarjetasItems.join("") : "<li>Sin tarjetas registradas.</li>",
  };
}

function obtenerModeloPlanillaOficial() {
  const tipo = obtenerTipoDeportePlanillaNormalizado();
  if (tipo.startsWith("basquetbol")) return "futbol_7_5_sala";
  if (["futbol_11", "futbol_9", "futbol_8", "indor"].includes(tipo)) return "futbol_11_indor";
  return "futbol_7_5_sala";
}

function obtenerMaxFilasVistaPreviaPlanilla() {
  const maxConfigurado = obtenerMaxJugadoresConfiguradoPlanilla();
  const localCount = Array.isArray(dataPlanilla?.plantel_local)
    ? dataPlanilla.plantel_local.length
    : 0;
  const visitanteCount = Array.isArray(dataPlanilla?.plantel_visitante)
    ? dataPlanilla.plantel_visitante.length
    : 0;
  return Math.max(localCount, visitanteCount, maxConfigurado, 8);
}

function obtenerMaxJugadoresConfiguradoPlanilla(partido = dataPlanilla?.partido || {}) {
  const maxConfigurado = Number(partido?.max_jugador);
  if (Number.isFinite(maxConfigurado) && maxConfigurado > 0) return maxConfigurado;

  const tipo = obtenerTipoDeportePlanillaNormalizado(partido);
  if (tipo === "futbol_11") return 25;

  const modelo = ["futbol_11", "futbol_9", "futbol_8", "indor"].includes(tipo)
    ? "futbol_11_indor"
    : "futbol_7_5_sala";
  return modelo === "futbol_7_5_sala" ? 20 : 18;
}

function renderFilasVistaPreviaOficialEquipo(jugadores, stats, maxFilas) {
  const filas = [];
  const jugadoresImpresion = obtenerJugadoresImpresionPlanilla(jugadores, maxFilas);
  for (let i = 0; i < jugadoresImpresion.length; i += 1) {
    const j = jugadoresImpresion[i] || null;
    const jugadorId = Number(j?.id);
    const item = i + 1;
    const registro = j ? obtenerRegistroPlanillaJugador(j) : obtenerRegistroBasePlanilla();
    const numero = j ? registro.numero_camiseta || j.numero_camiseta || "" : "";
    const nombre = j ? `${j.apellido || ""} ${j.nombre || ""}`.trim() : "";
    const goles = j ? stats.golesPorJugador.get(jugadorId) || "" : "";
    const amarillas = j ? stats.amarillasPorJugador.get(jugadorId) || "" : "";
    const rojas = j ? stats.rojasPorJugador.get(jugadorId) || "" : "";
    const columnas = obtenerColumnasRegistroPlanilla({ encabezadoCompleto: true, modo: "oficial" });
    const cells = columnas.map((col) => {
      switch (col.key) {
        case "item":
          return `<td class="${col.cellClass}">${item}</td>`;
        case "numero":
          return `<td class="${col.cellClass}">${escapeHtml(String(numero))}</td>`;
        case "convocatoria":
        case "convocatoria_principal":
        case "convocatoria_suplente":
          return `<td class="${col.cellClass}"><span class="planilla-cell-box is-mini" aria-hidden="true"></span></td>`;
        case "entra":
        case "sale":
          return `<td class="${col.cellClass}"><span class="planilla-cell-box is-mini" aria-hidden="true"></span></td>`;
        case "nombre":
          return `<td class="${col.cellClass}">${escapeHtml(nombre)}</td>`;
        case "goles":
          return `<td class="${col.cellClass}">${goles}</td>`;
        case "amarillas":
          return `<td class="${col.cellClass}">${amarillas}</td>`;
        case "rojas":
          return `<td class="${col.cellClass}">${rojas}</td>`;
        default:
          return `<td class="${col.cellClass}"></td>`;
      }
    });

    filas.push(`
      <tr>
        ${cells.join("")}
      </tr>
    `);
  }
  return filas.join("");
}

function renderCuadrosFaltasPreview(valorActual = 0) {
  return Array.from({ length: MAX_FALTAS_PLANILLA }, (_, idx) => idx + 1)
    .map((n) => {
      const clases = [
        n === MAX_FALTAS_PLANILLA ? "is-last" : "",
        n <= normalizarConteoFaltasPlanilla(valorActual, 0) ? "is-active" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<span class="${clases}">${n}</span>`;
    })
    .join("");
}

function renderBloqueFaltasEquipo(label, faltasPrimerTiempo = 0, faltasSegundoTiempo = 0) {
  const itemsPrimerTiempo = renderCuadrosFaltasPreview(faltasPrimerTiempo);
  const itemsSegundoTiempo = renderCuadrosFaltasPreview(faltasSegundoTiempo);

  return `
    <div class="planilla-oficial-faltas-team">
      <p>${escapeHtml(label)}</p>
      <div class="planilla-oficial-faltas-col">
        <strong>FALTAS 1ER</strong>
        <div class="planilla-oficial-faltas-grid">${itemsPrimerTiempo}</div>
      </div>
      <div class="planilla-oficial-faltas-col">
        <strong>FALTAS 2DO</strong>
        <div class="planilla-oficial-faltas-grid">${itemsSegundoTiempo}</div>
      </div>
    </div>
  `;
}

function renderVistaPreviaOficial(p, payload, stats, maxFilas, fecha, hora) {
  const cont = document.getElementById("planilla-preview-content");
  if (!cont) return;

  const modelo = obtenerModeloPlanillaOficial();
  const { linea: resumenCompetencia } = obtenerResumenCompetenciaPlanilla(p);
  const arbitraje = obtenerDatosArbitrajePlanilla(p);
  const delegado = String(document.getElementById("delegado-planilla")?.value || p.delegado_partido || "");
  const ciudad = String(document.getElementById("ciudad-planilla")?.value || p.ciudad || "");
  const observacionesLocal = obtenerObservacionesLocalPlanilla(payload);
  const observacionesVisitante = obtenerObservacionesVisitantePlanilla(payload);
  const observacionesArbitro = obtenerObservacionesArbitroPlanilla(payload);
  const logoOrg = normalizarArchivoUrl(p.campeonato_logo_url);
  const logoLocal = normalizarArchivoUrl(p.equipo_local_logo_url);
  const logoVisitante = normalizarArchivoUrl(p.equipo_visitante_logo_url);
  const logosAuspiciantes = renderAuspiciantesHeaderPlanilla("planilla-oficial-head");
  const faltasPayload = normalizarEstadoFaltasPlanilla(payload.faltas || dataPlanilla?.faltas || {});

  const plantelLocalImpresion = obtenerJugadoresImpresionPlanilla(dataPlanilla.plantel_local || [], maxFilas);
  const plantelVisitanteImpresion = obtenerJugadoresImpresionPlanilla(dataPlanilla.plantel_visitante || [], maxFilas);
  const totalFilasImpresion = Math.max(plantelLocalImpresion.length, plantelVisitanteImpresion.length, 0);
  const clasesCompactacion = [
    totalFilasImpresion >= 24 ? "is-compact" : "",
    totalFilasImpresion >= 30 ? "is-ultra-compact" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const filasLocal = renderFilasVistaPreviaOficialEquipo(plantelLocalImpresion, stats, maxFilas);
  const filasVisit = renderFilasVistaPreviaOficialEquipo(plantelVisitanteImpresion, stats, maxFilas);
  const mostrarEnBlanco = planillaSinDatosDeJuego(payload);
  const marcadorLocal = mostrarEnBlanco ? "" : formatearMarcadorPlanilla(payload.resultado_local);
  const marcadorVisit = mostrarEnBlanco ? "" : formatearMarcadorPlanilla(payload.resultado_visitante);
  const resumenPenales = obtenerResumenPenalesPlanilla(payload, p);

  cont.innerHTML = `
    <div class="planilla-oficial-sheet ${modelo} ${clasesCompactacion}">
      <header class="planilla-oficial-head">
        <div class="planilla-oficial-head-text">
          <p class="planilla-oficial-org">${escapeHtml(p.campeonato_organizador || p.campeonato_nombre || "LT&C")}</p>
          <h4>PLANILLA DE JUEGO</h4>
        </div>
        ${
          logoOrg || logosAuspiciantes
            ? `
              <div class="planilla-oficial-head-logo-box ${logosAuspiciantes ? "is-sponsors" : ""}">
                ${
                  logoOrg
                    ? `<img src="${logoOrg}" alt="Logo organizador" class="planilla-oficial-org-logo" />`
                    : ""
                }
                ${logosAuspiciantes}
              </div>
            `
            : ""
        }
      </header>

      <div class="planilla-oficial-meta">
        <div><strong>Fecha:</strong> ${fecha}</div>
        <div><strong>Hora:</strong> ${escapeHtml(hora)}</div>
        <div><strong>Cancha:</strong> ${escapeHtml(p.cancha || "Por definir")}</div>
        <div><strong>Ciudad:</strong> ${escapeHtml(ciudad || "Por definir")}</div>
        <div><strong>${arbitraje.esFutbol11 ? "Arbitro central" : "Arbitro"}:</strong> ${escapeHtml(arbitraje.central || "________________")}</div>
        ${
          arbitraje.esFutbol11
            ? `<div><strong>Linea 1:</strong> ${escapeHtml(arbitraje.linea1 || "________________")}</div>
               <div><strong>Linea 2:</strong> ${escapeHtml(arbitraje.linea2 || "________________")}</div>`
            : ""
        }
        <div><strong>Delegado:</strong> ${escapeHtml(delegado || "________________")}</div>
        <div><strong>Partido:</strong> #${obtenerNumeroPartidoVisible(p) || "-"}</div>
        <div><strong>${escapeHtml(resumenCompetencia)}</strong></div>
      </div>

      <div class="planilla-oficial-score">
        <div class="team is-local">
          ${renderLogoEquipoPlanilla(logoLocal, p.equipo_local_nombre || equiposPartido.local.nombre, "planilla-oficial-team-logo")}
          <span>${escapeHtml(p.equipo_local_nombre || equiposPartido.local.nombre)}</span>
        </div>
        <div class="result">${marcadorLocal}</div>
        <div class="sep">:</div>
        <div class="result">${marcadorVisit}</div>
        <div class="team is-visitante">
          ${renderLogoEquipoPlanilla(logoVisitante, p.equipo_visitante_nombre || equiposPartido.visitante.nombre, "planilla-oficial-team-logo")}
          <span>${escapeHtml(p.equipo_visitante_nombre || equiposPartido.visitante.nombre)}</span>
        </div>
      </div>
      ${
        resumenPenales.aplica
          ? `<div class="planilla-oficial-penales">${escapeHtml(`${resumenPenales.texto} • ${resumenPenales.clasificaTexto}`)}</div>`
          : ""
      }

      ${
        modelo === "futbol_7_5_sala"
          ? `<div class="planilla-oficial-faltas">${renderBloqueFaltasEquipo(
              p.equipo_local_nombre || equiposPartido.local.nombre,
              faltasPayload.local_1er,
              faltasPayload.local_2do
            )}${renderBloqueFaltasEquipo(
              p.equipo_visitante_nombre || equiposPartido.visitante.nombre,
              faltasPayload.visitante_1er,
              faltasPayload.visitante_2do
            )}</div>`
          : ""
      }

      <div class="planilla-oficial-teams">
        <article class="planilla-oficial-team">
          <div class="planilla-oficial-team-title">EQUIPO: ${escapeHtml(p.equipo_local_nombre || equiposPartido.local.nombre)}</div>
          <table class="planilla-oficial-table">
            <thead>
              ${renderCabeceraTablaPlanillaHtml({ encabezadoCompleto: true, modo: "oficial" })}
            </thead>
            <tbody>${filasLocal}</tbody>
          </table>
          <div class="planilla-oficial-team-notes">
            <p><strong>Dirigente / Director tecnico:</strong> ${escapeHtml(p.equipo_local_director_tecnico || "________________")}</p>
            <div class="planilla-oficial-signature-row"><strong>Firma tecnico:</strong><span class="planilla-oficial-signature-line" aria-hidden="true"></span></div>
            <p><strong>TA:</strong> ${formatearConteoPlanilla(stats.totalAmarillasLocal, mostrarEnBlanco)} <strong>TR:</strong> ${formatearConteoPlanilla(stats.totalRojasLocal, mostrarEnBlanco)}</p>
          </div>
        </article>

        <article class="planilla-oficial-team">
          <div class="planilla-oficial-team-title">EQUIPO: ${escapeHtml(p.equipo_visitante_nombre || equiposPartido.visitante.nombre)}</div>
          <table class="planilla-oficial-table">
            <thead>
              ${renderCabeceraTablaPlanillaHtml({ encabezadoCompleto: true, modo: "oficial" })}
            </thead>
            <tbody>${filasVisit}</tbody>
          </table>
          <div class="planilla-oficial-team-notes">
            <p><strong>Dirigente / Director tecnico:</strong> ${escapeHtml(p.equipo_visitante_director_tecnico || "________________")}</p>
            <div class="planilla-oficial-signature-row"><strong>Firma tecnico:</strong><span class="planilla-oficial-signature-line" aria-hidden="true"></span></div>
            <p><strong>TA:</strong> ${formatearConteoPlanilla(stats.totalAmarillasVisitante, mostrarEnBlanco)} <strong>TR:</strong> ${formatearConteoPlanilla(stats.totalRojasVisitante, mostrarEnBlanco)}</p>
          </div>
        </article>
      </div>

      <div class="planilla-oficial-footer">
        <strong>PAGOS</strong>
        <div class="planilla-footer-grid">
          <article class="planilla-footer-team">
            <h5>${escapeHtml(p.equipo_local_nombre || equiposPartido.local.nombre)}</h5>
            <div class="planilla-footer-row">
              <label>Inscripción</label>
              <input type="text" value="${formatearMonedaPlanilla(payload.pagos.pago_local, mostrarEnBlanco)}" readonly />
            </div>
            <div class="planilla-footer-row">
              <label>Arbitraje</label>
              <input type="text" value="${formatearMonedaPlanilla(payload.pagos.pago_arbitraje_local, mostrarEnBlanco)}" readonly />
            </div>
            <div class="planilla-footer-row">
              <label>Tarjetas amarillas</label>
              <input type="text" value="${formatearMonedaPlanilla(payload.pagos.pago_ta_local, mostrarEnBlanco)}" readonly />
            </div>
            <div class="planilla-footer-row">
              <label>Tarjetas rojas</label>
              <input type="text" value="${formatearMonedaPlanilla(payload.pagos.pago_tr_local, mostrarEnBlanco)}" readonly />
            </div>
          </article>
          <article class="planilla-footer-team">
            <h5>${escapeHtml(p.equipo_visitante_nombre || equiposPartido.visitante.nombre)}</h5>
            <div class="planilla-footer-row">
              <label>Inscripción</label>
              <input type="text" value="${formatearMonedaPlanilla(payload.pagos.pago_visitante, mostrarEnBlanco)}" readonly />
            </div>
            <div class="planilla-footer-row">
              <label>Arbitraje</label>
              <input type="text" value="${formatearMonedaPlanilla(payload.pagos.pago_arbitraje_visitante, mostrarEnBlanco)}" readonly />
            </div>
            <div class="planilla-footer-row">
              <label>Tarjetas amarillas</label>
              <input type="text" value="${formatearMonedaPlanilla(payload.pagos.pago_ta_visitante, mostrarEnBlanco)}" readonly />
            </div>
            <div class="planilla-footer-row">
              <label>Tarjetas rojas</label>
              <input type="text" value="${formatearMonedaPlanilla(payload.pagos.pago_tr_visitante, mostrarEnBlanco)}" readonly />
            </div>
          </article>
        </div>
      </div>
      ${
        esPlanillaFutbol11(p)
          ? renderBloqueObservacionesCompactoHtml(
              observacionesLocal,
              observacionesVisitante,
              observacionesArbitro
            )
          : ""
      }
    </div>
    ${
      !esPlanillaFutbol11(p)
        ? `
          <div class="planilla-oficial-sheet ${modelo} planilla-oficial-sheet--page2">
            <div class="planilla-oficial-observ-page">
              <h5 class="planilla-oficial-observ-page-title">OBSERVACIONES</h5>
              <div class="planilla-oficial-observ-grid is-stacked">
                <div class="planilla-oficial-observ">
                  <strong>OBSERVACION LOCAL</strong>
                  <p>${escapeHtml(observacionesLocal || "")}</p>
                </div>
                <div class="planilla-oficial-observ">
                  <strong>OBSERVACION VISITANTE</strong>
                  <p>${escapeHtml(observacionesVisitante || "")}</p>
                </div>
                <div class="planilla-oficial-observ">
                  <strong>OBSERVACIONES DEL ARBITRO</strong>
                  <p>${escapeHtml(observacionesArbitro || "")}</p>
                </div>
              </div>
            </div>
          </div>
        `
        : ""
    }
  `;
}

function renderVistaPreviaResumen(p, payload, stats, maxFilas, fecha, hora) {
  const cont = document.getElementById("planilla-preview-content");
  if (!cont) return;

  const categoria = p.evento_nombre || "Sin categoria";
  const tipoFutbol = formatearTipoFutbolTexto(p.tipo_futbol || p.tipo_deporte);
  const contextoCompetencia = obtenerContextoCompetenciaPlanilla(p);
  const arbitraje = obtenerDatosArbitrajePlanilla(p);
  const delegado = String(document.getElementById("delegado-planilla")?.value || p.delegado_partido || "");
  const ciudad = String(document.getElementById("ciudad-planilla")?.value || p.ciudad || "");
  const filasLocal = renderFilasVistaPreviaEquipo(dataPlanilla.plantel_local || [], stats, maxFilas);
  const filasVisit = renderFilasVistaPreviaEquipo(dataPlanilla.plantel_visitante || [], stats, maxFilas);
  const eventosVistaPrevia = renderListaEventosVistaPrevia(payload);
  const observacionesLocal = obtenerObservacionesLocalPlanilla(payload);
  const observacionesVisitante = obtenerObservacionesVisitantePlanilla(payload);
  const observacionesArbitro = obtenerObservacionesArbitroPlanilla(payload);

  const mostrarEnBlanco = planillaSinDatosDeJuego(payload);
  const scoreLocal = mostrarEnBlanco ? "" : formatearMarcadorPlanilla(payload.resultado_local);
  const scoreVisit = mostrarEnBlanco ? "" : formatearMarcadorPlanilla(payload.resultado_visitante);
  const resumenPenales = obtenerResumenPenalesPlanilla(payload, p);

  cont.innerHTML = `
    <div class="planilla-preview-sheet">
      <div class="planilla-preview-head">
        <h4 class="preview-title">${escapeHtml(p.campeonato_nombre || "Planilla de Juego")}</h4>
        <p class="preview-subtitle">${escapeHtml(categoria)} • ${escapeHtml(tipoFutbol)} • ${escapeHtml(contextoCompetencia.resumen)}</p>
      </div>

      <div class="planilla-preview-meta">
        <div class="meta-item"><strong>Partido</strong>#${obtenerNumeroPartidoVisible(p) || "-"}</div>
        <div class="meta-item"><strong>Fecha</strong>${fecha}</div>
        <div class="meta-item"><strong>Hora</strong>${hora}</div>
        <div class="meta-item"><strong>Cancha</strong>${escapeHtml(p.cancha || "Por definir")}</div>
        <div class="meta-item"><strong>Ciudad</strong>${escapeHtml(ciudad || "Por definir")}</div>
        <div class="meta-item"><strong>${arbitraje.esFutbol11 ? "Arbitro central" : "Arbitro"}</strong>${escapeHtml(arbitraje.central || "________________")}</div>
        ${
          arbitraje.esFutbol11
            ? `<div class="meta-item"><strong>Linea 1</strong>${escapeHtml(arbitraje.linea1 || "________________")}</div>
               <div class="meta-item"><strong>Linea 2</strong>${escapeHtml(arbitraje.linea2 || "________________")}</div>`
            : ""
        }
        <div class="meta-item"><strong>Delegado</strong>${escapeHtml(delegado || "________________")}</div>
      </div>

      <div class="planilla-preview-score">
        <div class="team-name">${escapeHtml(p.equipo_local_nombre || equiposPartido.local.nombre)}</div>
        <div class="score-box">${scoreLocal}${scoreLocal !== "" || scoreVisit !== "" ? " - " : ""}${scoreVisit}</div>
        <div class="team-name">${escapeHtml(p.equipo_visitante_nombre || equiposPartido.visitante.nombre)}</div>
      </div>
      ${
        resumenPenales.aplica
          ? `<div class="planilla-preview-penales">${escapeHtml(`${resumenPenales.texto} • ${resumenPenales.clasificaTexto}`)}</div>`
          : ""
      }

      <div class="planilla-preview-columns">
        <article class="planilla-preview-team">
          <h4>Plantel Local</h4>
          <table class="planilla-preview-table">
            <thead>
              ${renderCabeceraTablaPlanillaHtml({ modo: "resumen" })}
            </thead>
            <tbody>${filasLocal}</tbody>
          </table>
        </article>
        <article class="planilla-preview-team">
          <h4>Plantel Visitante</h4>
          <table class="planilla-preview-table">
            <thead>
              ${renderCabeceraTablaPlanillaHtml({ modo: "resumen" })}
            </thead>
            <tbody>${filasVisit}</tbody>
          </table>
        </article>
      </div>

      <div class="planilla-preview-foot">
        <div class="planilla-preview-box">
          <h5>Goleadores</h5>
          <ul class="planilla-preview-list">${eventosVistaPrevia.golesHtml}</ul>
          <h5 style="margin-top:0.8rem;">Tarjetas</h5>
          <ul class="planilla-preview-list">${eventosVistaPrevia.tarjetasHtml}</ul>
          <h5 style="margin-top:0.8rem;">Observacion local</h5>
          <div class="planilla-preview-observ">${escapeHtml(observacionesLocal || "")}</div>
          <h5 style="margin-top:0.8rem;">Observacion visitante</h5>
          <div class="planilla-preview-observ">${escapeHtml(observacionesVisitante || "")}</div>
          <h5 style="margin-top:0.8rem;">Observaciones del arbitro</h5>
          <div class="planilla-preview-observ">${escapeHtml(observacionesArbitro || "")}</div>
        </div>
        <div class="planilla-preview-box">
          <h5>Pagos</h5>
          <div class="planilla-preview-payments">
            <div class="row"><span>Total TA</span><strong>${formatearConteoPlanilla(Number(stats.totalAmarillasLocal || 0) + Number(stats.totalAmarillasVisitante || 0), mostrarEnBlanco)}</strong></div>
            <div class="row"><span>Total TR</span><strong>${formatearConteoPlanilla(Number(stats.totalRojasLocal || 0) + Number(stats.totalRojasVisitante || 0), mostrarEnBlanco)}</strong></div>
            <div class="row"><span>Inscripción Local</span><strong>${formatearMonedaPlanilla(payload.pagos.pago_local, mostrarEnBlanco)}</strong></div>
            <div class="row"><span>Inscripción Visitante</span><strong>${formatearMonedaPlanilla(payload.pagos.pago_visitante, mostrarEnBlanco)}</strong></div>
            <div class="row"><span>Arbitraje Local</span><strong>${formatearMonedaPlanilla(payload.pagos.pago_arbitraje_local, mostrarEnBlanco)}</strong></div>
            <div class="row"><span>Arbitraje Visitante</span><strong>${formatearMonedaPlanilla(payload.pagos.pago_arbitraje_visitante, mostrarEnBlanco)}</strong></div>
            <div class="row"><span>Pago TA Local</span><strong>${formatearMonedaPlanilla(payload.pagos.pago_ta_local, mostrarEnBlanco)}</strong></div>
            <div class="row"><span>Pago TA Visitante</span><strong>${formatearMonedaPlanilla(payload.pagos.pago_ta_visitante, mostrarEnBlanco)}</strong></div>
            <div class="row"><span>Pago TR Local</span><strong>${formatearMonedaPlanilla(payload.pagos.pago_tr_local, mostrarEnBlanco)}</strong></div>
            <div class="row"><span>Pago TR Visitante</span><strong>${formatearMonedaPlanilla(payload.pagos.pago_tr_visitante, mostrarEnBlanco)}</strong></div>
            <div class="row"><span>Estado</span><strong>${payload.estado || "-"}</strong></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function actualizarVistaPreviaPlanilla(soloSiVisible = true) {
  const card = document.getElementById("planilla-preview-card");
  if (!card || !dataPlanilla?.partido) return;
  if (soloSiVisible && card.dataset.visible !== "true") return;

  const p = dataPlanilla.partido;
  const payload = recolectarPayloadPlanilla();
  const stats = construirIndicesEventos(payload);
  const maxFilas = obtenerMaxFilasVistaPreviaPlanilla();
  const fecha = formatearFecha(p.fecha_partido);
  const hora = (p.hora_partido || "--:--").toString().substring(0, 5);

  if (modoVistaPreviaPlanilla === "resumen") {
    renderVistaPreviaResumen(p, payload, stats, maxFilas, fecha, hora);
    return;
  }

  renderVistaPreviaOficial(p, payload, stats, maxFilas, fecha, hora);
}

function inicializarModoVistaPreviaPlanilla() {
  const wrap = document.getElementById("planilla-preview-mode-switch");
  if (!wrap) return;

  const botones = Array.from(wrap.querySelectorAll("button[data-planilla-vista]"));
  if (!botones.length) return;

  const syncBotones = () => {
    botones.forEach((btn) => {
      const activo = btn.dataset.planillaVista === modoVistaPreviaPlanilla;
      btn.classList.toggle("active", activo);
    });
  };

  botones.forEach((btn) => {
    btn.addEventListener("click", () => {
      const modo = btn.dataset.planillaVista === "resumen" ? "resumen" : "oficial";
      if (modoVistaPreviaPlanilla === modo) return;
      modoVistaPreviaPlanilla = modo;
      syncBotones();
      actualizarVistaPreviaPlanilla(true);
    });
  });

  syncBotones();
}

function toggleVistaPreviaPlanilla() {
  const card = document.getElementById("planilla-preview-card");
  if (!card) return;

  const visible = card.dataset.visible === "true";
  if (visible) {
    card.style.display = "none";
    card.dataset.visible = "false";
    return;
  }

  card.style.display = "block";
  card.dataset.visible = "true";
  actualizarVistaPreviaPlanilla(false);
  card.scrollIntoView({ behavior: "smooth", block: "start" });
}

function activarModoVistaOficial() {
  modoVistaPreviaPlanilla = "oficial";
  document
    .querySelectorAll("#planilla-preview-mode-switch button[data-planilla-vista]")
    .forEach((btn) => {
      const activo = btn.dataset.planillaVista === "oficial";
      btn.classList.toggle("active", activo);
    });
}

function prepararVistaPreviaOficialParaPDF() {
  const card = document.getElementById("planilla-preview-card");
  if (!card) return null;

  activarModoVistaOficial();
  if (card.dataset.visible !== "true") {
    card.style.display = "block";
    card.dataset.visible = "true";
  }
  actualizarVistaPreviaPlanilla(false);
  return card.querySelector(".planilla-oficial-sheet");
}

async function cargarImagenComoDataUrl(url, timeoutMs = 700) {
  const normalizada = normalizarArchivoUrl(url);
  if (!normalizada) return null;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(normalizada, { cache: "force-cache", signal: controller.signal });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("No se pudo leer imagen"));
      reader.readAsDataURL(blob);
    });
  } catch (_error) {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function construirBloqueAuspiciantesPdf() {
  const auspiciantes = obtenerAuspiciantesVisiblesPlanilla();
  if (!auspiciantes.length) return null;

  const items = await Promise.all(
    auspiciantes.slice(0, 4).map(async (item) => ({
      nombre: item.nombre || "Auspiciante",
      imagen: item.logo_url ? await cargarImagenComoDataUrl(item.logo_url, 1200) : null,
    }))
  );

  const celdas = items.map((item) => ({
    stack: item.imagen
      ? [{ image: item.imagen, fit: [54, 22], alignment: "center", margin: [0, 3, 0, 3] }]
      : [{ text: item.nombre, alignment: "center", fontSize: 6.8, margin: [2, 8, 2, 8] }],
    margin: [0, 0, 0, 0],
    fillColor: "#ffffff",
  }));

  while (celdas.length < 4) {
    celdas.push({ text: "", fillColor: "#ffffff" });
  }

  return {
    width: 118,
    table: {
      widths: [56, 56],
      body: [
        [celdas[0], celdas[1]],
        [celdas[2], celdas[3]],
      ],
    },
    layout: {
      hLineWidth: () => 0.4,
      vLineWidth: () => 0.4,
      hLineColor: () => "#cbd5e1",
      vLineColor: () => "#cbd5e1",
      paddingLeft: () => 1,
      paddingRight: () => 1,
      paddingTop: () => 1,
      paddingBottom: () => 1,
    },
  };
}

function construirCeldaMarcadorEquipoPdf(nombre, logoDataUrl, { compacto = false, ultra = false } = {}) {
  const fitLogo = ultra ? [9, 9] : compacto ? [11, 11] : [14, 14];
  const fontSize = ultra ? 7 : compacto ? 7.8 : 9.2;
  const body = [[]];

  if (logoDataUrl) {
    body[0].push({
      image: logoDataUrl,
      fit: fitLogo,
      margin: [0, 0, 3, 0],
      border: [false, false, false, false],
    });
  }

  body[0].push({
    text: nombre || "Por definir",
    alignment: "center",
    bold: true,
    fontSize,
    border: [false, false, false, false],
  });

  return {
    table: {
      widths: logoDataUrl ? ["auto", "*"] : ["*"],
      body,
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    alignment: "center",
  };
}

function construirFilasPlantelPdf(jugadores, stats, maxFilas) {
  const columnas = obtenerColumnasRegistroPlanilla({ encabezadoCompleto: true, modo: "pdf" });
  const body = [[
    ...columnas.map((col) => ({
      text: col.label,
      style:
        col.key === "nombre"
          ? "thLeft"
      : "thCenter",
    })),
  ]];

  const jugadoresImpresion = obtenerJugadoresImpresionPlanilla(jugadores, maxFilas);

  for (let i = 0; i < jugadoresImpresion.length; i += 1) {
    const j = jugadoresImpresion[i] || null;
    const jugadorId = Number(j?.id);
    const registro = j ? obtenerRegistroPlanillaJugador(j) : obtenerRegistroBasePlanilla();
    const item = i + 1;
    const nombre = j ? `${j.apellido || ""} ${j.nombre || ""}`.trim() : "";
    const numero = j ? String(registro.numero_camiseta || j.numero_camiseta || "") : "";
    const goles = j ? String(stats.golesPorJugador.get(jugadorId) || "") : "";
    const ta = j ? String(stats.amarillasPorJugador.get(jugadorId) || "") : "";
    const tr = j ? String(stats.rojasPorJugador.get(jugadorId) || "") : "";

    body.push(
      columnas.map((col) => {
        switch (col.key) {
          case "item":
            return { text: String(item), style: "tdCenter" };
          case "numero":
            return { text: numero, style: "tdCenter" };
          case "convocatoria":
          case "convocatoria_principal":
          case "convocatoria_suplente":
            return { text: "", style: "tdCenter" };
          case "entra":
          case "sale":
            return { text: "", style: "tdCenter" };
          case "nombre":
            return { text: nombre, style: "tdLeft" };
          case "goles":
            return { text: goles, style: "tdCenter" };
          case "amarillas":
            return { text: ta, style: "tdCenter" };
          case "rojas":
            return { text: tr, style: "tdCenter" };
          default:
            return { text: "", style: "tdCenter" };
        }
      })
    );
  }

  return body;
}

function construirBloqueTarjetasEquipoPdf(totalTa, totalTr, mostrarEnBlanco = false) {
  return {
    table: {
      widths: ["*", 26],
      body: [
        [
          { text: "Tarjetas amarillas", style: "footLabel" },
          { text: formatearConteoPlanilla(totalTa, mostrarEnBlanco), style: "footValueCenter" },
        ],
        [
          { text: "Tarjetas rojas", style: "footLabel" },
          { text: formatearConteoPlanilla(totalTr, mostrarEnBlanco), style: "footValueCenter" },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.6,
      vLineWidth: () => 0.6,
      hLineColor: () => "#9ca3af",
      vLineColor: () => "#9ca3af",
      paddingLeft: () => 3,
      paddingRight: () => 3,
      paddingTop: () => 2,
      paddingBottom: () => 2,
    },
  };
}

function construirBloquePagosPdf(localNombre, visitNombre, pagos = {}, mostrarEnBlanco = false) {
  const layoutTabla = {
    hLineWidth: () => 0.6,
    vLineWidth: () => 0.6,
    hLineColor: () => "#9ca3af",
    vLineColor: () => "#9ca3af",
    paddingLeft: () => 3.5,
    paddingRight: () => 3.5,
    paddingTop: () => 3,
    paddingBottom: () => 3,
  };

  const filasPago = (inscripcion, arbitraje, pagoTa, pagoTr) => [
    [
      { text: "Inscripción", style: "footLabel" },
      { text: formatearMonedaPlanilla(inscripcion, mostrarEnBlanco), style: "footValue" },
    ],
    [
      { text: "Arbitraje", style: "footLabel" },
      { text: formatearMonedaPlanilla(arbitraje, mostrarEnBlanco), style: "footValue" },
    ],
    [
      { text: "Tarjetas amarillas", style: "footLabel" },
      { text: formatearMonedaPlanilla(pagoTa, mostrarEnBlanco), style: "footValue" },
    ],
    [
      { text: "Tarjetas rojas", style: "footLabel" },
      { text: formatearMonedaPlanilla(pagoTr, mostrarEnBlanco), style: "footValue" },
    ],
  ];

  return {
    table: {
      widths: ["*", 6, "*"],
      body: [[
        {
          stack: [
            {
              table: { widths: ["*"], body: [[{ text: localNombre, style: "footTeamTitle" }]] },
              layout: {
                hLineWidth: () => 0.6,
                vLineWidth: () => 0.6,
                hLineColor: () => "#9ca3af",
                vLineColor: () => "#9ca3af",
                paddingLeft: () => 3,
                paddingRight: () => 3,
                paddingTop: () => 2,
                paddingBottom: () => 2,
              },
              margin: [0, 0, 0, 2],
            },
            {
              table: {
                widths: ["*", 58],
                body: filasPago(
                  pagos.pago_local,
                  pagos.pago_arbitraje_local,
                  pagos.pago_ta_local,
                  pagos.pago_tr_local
                ),
              },
              layout: layoutTabla,
            },
          ],
        },
        { text: "", border: [false, false, false, false] },
        {
          stack: [
            {
              table: { widths: ["*"], body: [[{ text: visitNombre, style: "footTeamTitle" }]] },
              layout: {
                hLineWidth: () => 0.6,
                vLineWidth: () => 0.6,
                hLineColor: () => "#9ca3af",
                vLineColor: () => "#9ca3af",
                paddingLeft: () => 3,
                paddingRight: () => 3,
                paddingTop: () => 2,
                paddingBottom: () => 2,
              },
              margin: [0, 0, 0, 2],
            },
            {
              table: {
                widths: ["*", 58],
                body: filasPago(
                  pagos.pago_visitante,
                  pagos.pago_arbitraje_visitante,
                  pagos.pago_ta_visitante,
                  pagos.pago_tr_visitante
                ),
              },
              layout: layoutTabla,
            },
          ],
        },
      ]],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  };
}

function construirBloqueFaltasPdf() {
  const filaNumeros = () =>
    [1, 2, 3, 4, 5, 6].map((n) => ({
      text: String(n),
      alignment: "center",
      bold: true,
      color: n === 6 ? "#ffffff" : "#334155",
      fillColor: n === 6 ? "#dc2626" : "#ffffff",
      border: [true, true, true, true],
    }));

  return {
    table: {
      widths: ["*", 11, 11, 11, 11, 11, 11],
      body: [
        [{ text: "FALTAS 1ER", bold: true, fontSize: 7.6 }, ...filaNumeros()],
        [{ text: "FALTAS 2DO", bold: true, fontSize: 7.6 }, ...filaNumeros()],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#cbd5e1",
      vLineColor: () => "#cbd5e1",
      paddingLeft: () => 2,
      paddingRight: () => 2,
      paddingTop: () => 1,
      paddingBottom: () => 1,
    },
  };
}

function renderBloqueObservacionesCompactoHtml(
  observacionesLocal = "",
  observacionesVisitante = "",
  observacionesArbitro = ""
) {
  return `
    <div class="planilla-oficial-observ-compact">
      <strong class="planilla-oficial-observ-compact-title">OBSERVACIONES</strong>
      <div class="planilla-oficial-observ-grid">
        <div class="planilla-oficial-observ is-compact">
          <strong>OBSERVACION LOCAL</strong>
          <p>${escapeHtml(observacionesLocal || "")}</p>
        </div>
        <div class="planilla-oficial-observ is-compact">
          <strong>OBSERVACION VISITANTE</strong>
          <p>${escapeHtml(observacionesVisitante || "")}</p>
        </div>
        <div class="planilla-oficial-observ is-compact">
          <strong>OBSERVACIONES DEL ARBITRO</strong>
          <p>${escapeHtml(observacionesArbitro || "")}</p>
        </div>
      </div>
    </div>
  `;
}

function construirCajaObservacionPdf(texto = "", modoCompactoPdf = false, modoUltraCompactoPdf = false) {
  return {
    table: {
      widths: ["*"],
      body: [[{ text: texto || "" }], [{ text: " " }], [{ text: " " }]],
      heights: () => (modoUltraCompactoPdf ? 6.2 : modoCompactoPdf ? 7 : 8),
    },
    layout: {
      hLineWidth: () => 0.6,
      vLineWidth: () => 0.6,
      hLineColor: () => "#cbd5e1",
      vLineColor: () => "#cbd5e1",
      paddingLeft: () => (modoCompactoPdf ? 3 : 4),
      paddingRight: () => (modoCompactoPdf ? 3 : 4),
      paddingTop: () => (modoCompactoPdf ? 1.5 : 2),
      paddingBottom: () => (modoCompactoPdf ? 1.5 : 2),
    },
    margin: [0, 0, 0, 0],
  };
}

function construirBloqueObservacionesCompactoPdf(
  observacionesLocal = "",
  observacionesVisitante = "",
  observacionesArbitro = "",
  modoCompactoPdf = false,
  modoUltraCompactoPdf = false
) {
  const gap = modoCompactoPdf ? 6 : 8;
  return {
    stack: [
      {
        text: "OBSERVACIONES",
        style: "sectionTitle",
        margin: [0, 0, 0, modoCompactoPdf ? 2 : 3],
      },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "OBSERVACION LOCAL", style: "sectionTitle", margin: [0, 0, 0, 2] },
              construirCajaObservacionPdf(observacionesLocal, modoCompactoPdf, modoUltraCompactoPdf),
            ],
          },
          { width: gap, text: "" },
          {
            width: "*",
            stack: [
              { text: "OBSERVACION VISITANTE", style: "sectionTitle", margin: [0, 0, 0, 2] },
              construirCajaObservacionPdf(observacionesVisitante, modoCompactoPdf, modoUltraCompactoPdf),
            ],
          },
          { width: gap, text: "" },
          {
            width: "*",
            stack: [
              { text: "OBSERVACIONES DEL ARBITRO", style: "sectionTitle", margin: [0, 0, 0, 2] },
              construirCajaObservacionPdf(observacionesArbitro, modoCompactoPdf, modoUltraCompactoPdf),
            ],
          },
        ],
      },
    ],
    margin: [0, 0, 0, modoCompactoPdf ? 0 : 2],
  };
}
async function imprimirPDFPlanilla() {
  if (!dataPlanilla?.partido) {
    mostrarNotificacion("Carga primero una planilla para exportar PDF", "warning");
    return;
  }

  if (!window.pdfMake || typeof window.pdfMake.createPdf !== "function") {
    mostrarNotificacion("No se pudo cargar el generador de PDF", "error");
    return;
  }

  const pdfTab = window.open("", "_blank");
  if (!pdfTab) {
    mostrarNotificacion("El navegador bloqueó la nueva pestaña del PDF", "warning");
    return;
  }

  const numeroPartidoTitulo =
    normalizarNumeroPartidoPlanilla(document.getElementById("numero-partido-planilla")?.value, {
      permitirVacio: true,
    }) ||
    obtenerNumeroPartidoVisible(dataPlanilla.partido) ||
    dataPlanilla.partido.id;
  pdfTab.document.title = `Planilla Partido ${numeroPartidoTitulo}`;
  pdfTab.document.body.innerHTML = "<p style='font-family:Arial,sans-serif;padding:12px;'>Generando PDF...</p>";

  try {
    const p = dataPlanilla.partido;
    const payload = recolectarPayloadPlanilla();
    const stats = construirIndicesEventos(payload);
    const fecha = formatearFecha(p.fecha_partido);
    const hora = (p.hora_partido || "--:--").toString().substring(0, 5);
    const { contexto: contextoCompetencia, jornada } = obtenerResumenCompetenciaPlanilla(p);
    const arbitraje = obtenerDatosArbitrajePlanilla(p);
    const delegado = String(document.getElementById("delegado-planilla")?.value || p.delegado_partido || "");
    const ciudad = String(document.getElementById("ciudad-planilla")?.value || p.ciudad || "");
    const observacionesLocal = obtenerObservacionesLocalPlanilla(payload);
    const observacionesVisitante = obtenerObservacionesVisitantePlanilla(payload);
    const observacionesArbitro = obtenerObservacionesArbitroPlanilla(payload);
    const modelo = obtenerModeloPlanillaOficial();
    const localNombre = p.equipo_local_nombre || equiposPartido.local.nombre;
    const visitNombre = p.equipo_visitante_nombre || equiposPartido.visitante.nombre;
    const localDt = p.equipo_local_director_tecnico || "-";
    const visitDt = p.equipo_visitante_director_tecnico || "-";
    const maxFilas = obtenerMaxJugadoresConfiguradoPlanilla(p);
    const plantelLocalImpresion = obtenerJugadoresImpresionPlanilla(dataPlanilla.plantel_local || [], maxFilas);
    const plantelVisitanteImpresion = obtenerJugadoresImpresionPlanilla(
      dataPlanilla.plantel_visitante || [],
      maxFilas
    );
    const totalFilasImpresion = Math.max(plantelLocalImpresion.length, plantelVisitanteImpresion.length, 0);
    const modoCompactoPdf = totalFilasImpresion >= 24;
    const modoUltraCompactoPdf = totalFilasImpresion >= 30;
    const alturaFilaPlantel = modoUltraCompactoPdf
      ? 4.7
      : modoCompactoPdf
        ? 5.3
        : modelo === "futbol_7_5_sala"
          ? 8.4
          : 7.8;
    const alturaCabeceraPlantel = modoUltraCompactoPdf ? 5.2 : modoCompactoPdf ? 6 : 8;
    const bodyLocal = construirFilasPlantelPdf(plantelLocalImpresion, stats, maxFilas);
    const bodyVisit = construirFilasPlantelPdf(plantelVisitanteImpresion, stats, maxFilas);
    const logoOrg = await cargarImagenComoDataUrl(p.campeonato_logo_url);
    const logoLocalPdf = await cargarImagenComoDataUrl(p.equipo_local_logo_url);
    const logoVisitantePdf = await cargarImagenComoDataUrl(p.equipo_visitante_logo_url);
    const bloqueAuspiciantesPdf = await construirBloqueAuspiciantesPdf();
    const numeroPartidoVisible =
      normalizarNumeroPartidoPlanilla(document.getElementById("numero-partido-planilla")?.value, {
        permitirVacio: true,
      }) ||
      obtenerNumeroPartidoVisible(p) ||
      "-";
    const mostrarEnBlanco = planillaSinDatosDeJuego(payload);
    const marcadorLocal = mostrarEnBlanco ? "" : formatearMarcadorPlanilla(payload.resultado_local);
    const marcadorVisit = mostrarEnBlanco ? "" : formatearMarcadorPlanilla(payload.resultado_visitante);
    const resumenPenales = obtenerResumenPenalesPlanilla(payload, p);

    const docDefinition = {
      pageSize: "A4",
      pageMargins: modoUltraCompactoPdf ? [5, 4, 5, 4] : modoCompactoPdf ? [6, 5, 6, 5] : [8, 6, 8, 6],
      defaultStyle: { fontSize: modoUltraCompactoPdf ? 6.9 : modoCompactoPdf ? 7.5 : 8.1, color: "#111827" },
      content: [
        {
          columns: [
            logoOrg
              ? {
                  width: modoCompactoPdf ? 48 : 54,
                  image: logoOrg,
                  fit: modoCompactoPdf ? [42, 42] : [50, 50],
                  alignment: "left",
                  margin: [0, 1, 0, 0],
                }
              : { width: modoCompactoPdf ? 48 : 54, text: "" },
            {
              width: "*",
              stack: [
                {
                  text: p.campeonato_organizador || p.campeonato_nombre || "LT&C",
                  alignment: "center",
                  bold: true,
                  fontSize: modoUltraCompactoPdf ? 8.3 : modoCompactoPdf ? 8.9 : 10,
                },
                {
                  text: "PLANILLA DE JUEGO",
                  alignment: "center",
                  bold: true,
                  fontSize: modoUltraCompactoPdf ? 12.8 : modoCompactoPdf ? 13.8 : 16,
                  margin: [0, 0, 0, 0],
                },
              ],
              margin: [0, modoCompactoPdf ? 0 : 2, 0, 0],
            },
            bloqueAuspiciantesPdf || { width: 118, text: "" },
          ],
          margin: [0, 0, 0, modoUltraCompactoPdf ? 4 : modoCompactoPdf ? 7 : 12],
        },
        {
          table: {
            widths: ["*", "*", "*", "*"],
            body: [
              [
                { text: [{ text: "Fecha: ", bold: true }, fecha] },
                { text: [{ text: "Hora: ", bold: true }, hora] },
                { text: [{ text: "Cancha: ", bold: true }, p.cancha || "Por definir"] },
                { text: [{ text: "Ciudad: ", bold: true }, ciudad || "Por definir"] },
              ],
              [
                {
                  text: [
                    {
                      text: `${arbitraje.esFutbol11 ? "Arbitro central" : "Arbitro"}: `,
                      bold: true,
                    },
                    arbitraje.central || "________________",
                  ],
                },
                {
                  text: [
                    { text: `${arbitraje.esFutbol11 ? "Linea 1" : "Delegado"}: `, bold: true },
                    arbitraje.esFutbol11
                      ? arbitraje.linea1 || "________________"
                      : delegado || "________________",
                  ],
                },
                {
                  text: [
                    { text: `${arbitraje.esFutbol11 ? "Linea 2" : "Partido"}: `, bold: true },
                    arbitraje.esFutbol11
                      ? arbitraje.linea2 || "________________"
                      : `#${numeroPartidoVisible}`,
                  ],
                },
                {
                  text: [
                    { text: `${arbitraje.esFutbol11 ? "Delegado" : "Jornada"}: `, bold: true },
                    arbitraje.esFutbol11 ? delegado || "________________" : jornada,
                  ],
                },
              ],
              [
                { text: [{ text: "Partido: ", bold: true }, `#${numeroPartidoVisible}`] },
                { text: "" },
                jornada ? { text: [{ text: "Jornada: ", bold: true }, jornada] } : { text: "" },
                {
                  text: [
                    { text: `${contextoCompetencia.etiqueta}: `, bold: true },
                    contextoCompetencia.valor,
                  ],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.6,
            vLineWidth: () => 0.6,
            hLineColor: () => "#cbd5e1",
            vLineColor: () => "#cbd5e1",
            paddingLeft: () => (modoCompactoPdf ? 2 : 3),
            paddingRight: () => (modoCompactoPdf ? 2 : 3),
            paddingTop: () => (modoCompactoPdf ? 1.4 : 2.2),
            paddingBottom: () => (modoCompactoPdf ? 1.4 : 2.2),
          },
          margin: [0, 0, 0, modoCompactoPdf ? 3 : 5],
        },
        {
          table: {
            widths: [
              "*",
              modoUltraCompactoPdf ? 16 : modoCompactoPdf ? 18 : 22,
              modoUltraCompactoPdf ? 6 : modoCompactoPdf ? 7 : 8,
              modoUltraCompactoPdf ? 16 : modoCompactoPdf ? 18 : 22,
              "*",
            ],
            body: [[
              construirCeldaMarcadorEquipoPdf(localNombre, logoLocalPdf, {
                compacto: modoCompactoPdf,
                ultra: modoUltraCompactoPdf,
              }),
              {
                text: marcadorLocal,
                alignment: "center",
                bold: true,
                fontSize: modoUltraCompactoPdf ? 10.2 : modoCompactoPdf ? 11.1 : 13.8,
                margin: [0, modoCompactoPdf ? 4 : 6, 0, 0],
              },
              {
                text: ":",
                alignment: "center",
                bold: true,
                fontSize: modoUltraCompactoPdf ? 10.6 : modoCompactoPdf ? 11.6 : 14.4,
                border: [false, false, false, false],
                margin: [0, modoCompactoPdf ? 4 : 6, 0, 0],
              },
              {
                text: marcadorVisit,
                alignment: "center",
                bold: true,
                fontSize: modoUltraCompactoPdf ? 10.2 : modoCompactoPdf ? 11.1 : 13.8,
                margin: [0, modoCompactoPdf ? 4 : 6, 0, 0],
              },
              construirCeldaMarcadorEquipoPdf(visitNombre, logoVisitantePdf, {
                compacto: modoCompactoPdf,
                ultra: modoUltraCompactoPdf,
              }),
            ]],
            heights: () => (modoUltraCompactoPdf ? 24 : modoCompactoPdf ? 28 : 34),
          },
          layout: {
            hLineWidth: (i) => (i === 0 || i === 1 ? 0 : 0),
            vLineWidth: (i) => (i === 1 || i === 2 || i === 3 || i === 4 ? 0.6 : 0),
            hLineColor: () => "#94a3b8",
            vLineColor: () => "#94a3b8",
            paddingTop: () => (modoCompactoPdf ? 2 : 4),
            paddingBottom: () => (modoCompactoPdf ? 2 : 4),
          },
          margin: [0, 0, 0, modoCompactoPdf ? 3 : 5],
        },
        ...(resumenPenales.aplica
          ? [
              {
                text: `${resumenPenales.texto} • ${resumenPenales.clasificaTexto}`,
                alignment: "center",
                bold: true,
                color: "#1d4f8c",
                fontSize: modoCompactoPdf ? 7.8 : 8.6,
                margin: [0, -2, 0, modoCompactoPdf ? 4 : 6],
              },
            ]
          : []),
        ...(modelo === "futbol_7_5_sala"
          ? [
              {
                columns: [
                  construirBloqueFaltasPdf(),
                  { width: 6, text: "" },
                  construirBloqueFaltasPdf(),
                ],
                margin: [0, 0, 0, 4],
              },
            ]
          : []),
        {
          columns: [
            {
              width: "*",
              stack: [
                { text: `EQUIPO: ${localNombre}`, style: "teamHead", margin: [0, 0, 0, modoCompactoPdf ? 1 : 2] },
                {
                  table: {
                    headerRows: 1,
                    widths: obtenerColumnasPdfPlanilla(),
                    body: bodyLocal,
                    heights: (row) => (row === 0 ? alturaCabeceraPlantel : alturaFilaPlantel),
                  },
                  layout: {
                    hLineWidth: () => 0.5,
                    vLineWidth: () => 0.5,
                    hLineColor: () => "#cbd5e1",
                    vLineColor: () => "#cbd5e1",
                    paddingLeft: () => (modoCompactoPdf ? 1.4 : 2),
                    paddingRight: () => (modoCompactoPdf ? 1.4 : 2),
                    paddingTop: () => (modoCompactoPdf ? 1 : 2),
                    paddingBottom: () => (modoCompactoPdf ? 1 : 2),
                  },
                },
                {
                  text: [{ text: "Dirigente / Director tecnico: ", bold: true }, localDt],
                  margin: [0, modoCompactoPdf ? 1 : 3, 0, 0],
                  fontSize: modoUltraCompactoPdf ? 6.2 : modoCompactoPdf ? 6.8 : 7.8,
                },
                {
                  table: {
                    widths: [modoCompactoPdf ? 38 : 44, "*"],
                    body: [
                      [
                        {
                          text: "Firma tecnico:",
                          bold: true,
                          border: [false, false, false, false],
                          fontSize: modoUltraCompactoPdf ? 6 : modoCompactoPdf ? 6.6 : 7.6,
                        },
                        { text: "", border: [false, false, false, true] },
                      ],
                    ],
                    heights: () => (modoUltraCompactoPdf ? 7 : modoCompactoPdf ? 8 : 10),
                  },
                  layout: {
                    hLineWidth: () => 0,
                    vLineWidth: () => 0,
                    paddingLeft: () => 0,
                    paddingRight: () => 0,
                    paddingTop: () => 0,
                    paddingBottom: () => 0,
                  },
                  margin: [0, 0, 0, 0],
                },
                {
                  ...construirBloqueTarjetasEquipoPdf(
                    Number(stats.totalAmarillasLocal || 0),
                    Number(stats.totalRojasLocal || 0),
                    mostrarEnBlanco
                  ),
                  margin: [0, modoCompactoPdf ? 2 : 3, 0, 0],
                },
              ],
            },
            {
              width: 6,
              text: "",
            },
            {
              width: "*",
              stack: [
                { text: `EQUIPO: ${visitNombre}`, style: "teamHead", margin: [0, 0, 0, modoCompactoPdf ? 1 : 2] },
                {
                  table: {
                    headerRows: 1,
                    widths: obtenerColumnasPdfPlanilla(),
                    body: bodyVisit,
                    heights: (row) => (row === 0 ? alturaCabeceraPlantel : alturaFilaPlantel),
                  },
                  layout: {
                    hLineWidth: () => 0.5,
                    vLineWidth: () => 0.5,
                    hLineColor: () => "#cbd5e1",
                    vLineColor: () => "#cbd5e1",
                    paddingLeft: () => (modoCompactoPdf ? 1.4 : 2),
                    paddingRight: () => (modoCompactoPdf ? 1.4 : 2),
                    paddingTop: () => (modoCompactoPdf ? 1 : 2),
                    paddingBottom: () => (modoCompactoPdf ? 1 : 2),
                  },
                },
                {
                  text: [{ text: "Dirigente / Director tecnico: ", bold: true }, visitDt],
                  margin: [0, modoCompactoPdf ? 1 : 3, 0, 0],
                  fontSize: modoUltraCompactoPdf ? 6.2 : modoCompactoPdf ? 6.8 : 7.8,
                },
                {
                  table: {
                    widths: [modoCompactoPdf ? 38 : 44, "*"],
                    body: [
                      [
                        {
                          text: "Firma tecnico:",
                          bold: true,
                          border: [false, false, false, false],
                          fontSize: modoUltraCompactoPdf ? 6 : modoCompactoPdf ? 6.6 : 7.6,
                        },
                        { text: "", border: [false, false, false, true] },
                      ],
                    ],
                    heights: () => (modoUltraCompactoPdf ? 7 : modoCompactoPdf ? 8 : 10),
                  },
                  layout: {
                    hLineWidth: () => 0,
                    vLineWidth: () => 0,
                    paddingLeft: () => 0,
                    paddingRight: () => 0,
                    paddingTop: () => 0,
                    paddingBottom: () => 0,
                  },
                  margin: [0, 0, 0, 0],
                },
                {
                  ...construirBloqueTarjetasEquipoPdf(
                    Number(stats.totalAmarillasVisitante || 0),
                    Number(stats.totalRojasVisitante || 0),
                    mostrarEnBlanco
                  ),
                  margin: [0, modoCompactoPdf ? 2 : 3, 0, 0],
                },
              ],
            },
          ],
          margin: [0, 0, 0, modoCompactoPdf ? 4 : 6],
        },
        {
          text: "PAGOS",
          style: "sectionTitle",
          margin: [0, 0, 0, modoCompactoPdf ? 2 : 3],
        },
        {
          ...construirBloquePagosPdf(localNombre, visitNombre, payload.pagos, mostrarEnBlanco),
          margin: [0, 0, 0, esPlanillaFutbol11(p) ? 2 : 4],
        },
        ...(esPlanillaFutbol11(p)
          ? [
              construirBloqueObservacionesCompactoPdf(
                observacionesLocal,
                observacionesVisitante,
                observacionesArbitro,
                modoCompactoPdf,
                modoUltraCompactoPdf
              ),
            ]
          : [
              {
                text: "OBSERVACIONES",
                style: "sectionTitle",
                pageBreak: "before",
                margin: [0, 2, 0, 6],
              },
              {
                stack: [
                  {
                    text: "OBSERVACION LOCAL",
                    style: "sectionTitle",
                    margin: [0, 1, 0, 2],
                  },
                  {
                    table: {
                      widths: ["*"],
                      body: [
                        [{ text: observacionesLocal || "" }],
                        [{ text: " " }],
                        [{ text: " " }],
                        [{ text: " " }],
                        [{ text: " " }],
                      ],
                      heights: () => 9,
                    },
                    layout: {
                      hLineWidth: () => 0.6,
                      vLineWidth: () => 0.6,
                      hLineColor: () => "#cbd5e1",
                      vLineColor: () => "#cbd5e1",
                      paddingLeft: () => 4,
                      paddingRight: () => 4,
                      paddingTop: () => 2,
                      paddingBottom: () => 2,
                    },
                    margin: [0, 0, 0, 8],
                  },
                  {
                    text: "OBSERVACION VISITANTE",
                    style: "sectionTitle",
                    margin: [0, 1, 0, 2],
                  },
                  {
                    table: {
                      widths: ["*"],
                      body: [
                        [{ text: observacionesVisitante || "" }],
                        [{ text: " " }],
                        [{ text: " " }],
                        [{ text: " " }],
                        [{ text: " " }],
                      ],
                      heights: () => 9,
                    },
                    layout: {
                      hLineWidth: () => 0.6,
                      vLineWidth: () => 0.6,
                      hLineColor: () => "#cbd5e1",
                      vLineColor: () => "#cbd5e1",
                      paddingLeft: () => 4,
                      paddingRight: () => 4,
                      paddingTop: () => 2,
                      paddingBottom: () => 2,
                    },
                    margin: [0, 0, 0, 8],
                  },
                  {
                    text: "OBSERVACIONES DEL ARBITRO",
                    style: "sectionTitle",
                    margin: [0, 1, 0, 2],
                  },
                  {
                    table: {
                      widths: ["*"],
                      body: [
                        [{ text: observacionesArbitro || "" }],
                        [{ text: " " }],
                        [{ text: " " }],
                        [{ text: " " }],
                        [{ text: " " }],
                      ],
                      heights: () => 9,
                    },
                    layout: {
                      hLineWidth: () => 0.6,
                      vLineWidth: () => 0.6,
                      hLineColor: () => "#cbd5e1",
                      vLineColor: () => "#cbd5e1",
                      paddingLeft: () => 4,
                      paddingRight: () => 4,
                      paddingTop: () => 2,
                      paddingBottom: () => 2,
                    },
                  },
                ],
              },
            ]),
      ],
      styles: {
        sectionTitle: {
          bold: true,
          fontSize: modoUltraCompactoPdf ? 7.1 : modoCompactoPdf ? 7.6 : 8.6,
          color: "#0f172a",
        },
        teamHead: {
          bold: true,
          fontSize: modoUltraCompactoPdf ? 6.7 : modoCompactoPdf ? 7.2 : 8.3,
          margin: [0, 0, 0, modoCompactoPdf ? 1 : 2],
        },
        thCenter: {
          bold: true,
          alignment: "center",
          fillColor: "#eef4fb",
          fontSize: modoUltraCompactoPdf ? 6.1 : modoCompactoPdf ? 6.6 : 7.6,
        },
        thLeft: {
          bold: true,
          alignment: "left",
          fillColor: "#eef4fb",
          fontSize: modoUltraCompactoPdf ? 6.1 : modoCompactoPdf ? 6.6 : 7.6,
        },
        tdCenter: { alignment: "center", fontSize: modoUltraCompactoPdf ? 5.9 : modoCompactoPdf ? 6.4 : 7.3 },
        tdLeft: { alignment: "left", fontSize: modoUltraCompactoPdf ? 5.9 : modoCompactoPdf ? 6.4 : 7.3 },
        footTeamTitle: {
          bold: true,
          fillColor: "#f3f4f6",
          fontSize: modoUltraCompactoPdf ? 7.1 : modoCompactoPdf ? 7.6 : 8.3,
        },
        footLabel: { bold: true, fontSize: modoUltraCompactoPdf ? 6.3 : modoCompactoPdf ? 6.8 : 7.4 },
        footValue: { fontSize: modoUltraCompactoPdf ? 6.3 : modoCompactoPdf ? 6.8 : 7.4, alignment: "right" },
        footValueCenter: {
          fontSize: modoUltraCompactoPdf ? 6.6 : modoCompactoPdf ? 7.2 : 7.8,
          alignment: "center",
          bold: true,
        },
      },
    };

    const pdfBlob = await new Promise((resolve, reject) => {
      window.pdfMake.createPdf(docDefinition).getBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("No se pudo generar el PDF"));
      });
    });

    if (!(pdfBlob instanceof Blob)) {
      throw new Error("No se recibio un Blob valido del PDF");
    }
    const blobUrl = URL.createObjectURL(pdfBlob);
    pdfTab.location.href = blobUrl;
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
    mostrarNotificacion("PDF generado. Desde esa pestaña puedes imprimir o descargar.", "success");
  } catch (error) {
    console.error("Error generando PDF:", error);
    try {
      pdfTab.close();
    } catch (_e) {
      // sin accion
    }
    mostrarNotificacion("No se pudo generar el PDF", "error");
  }
}

async function exportarPlanillaPDF() {
  await imprimirPDFPlanilla();
}

function imprimirVistaPrevia() {
  imprimirPDFPlanilla();
}

async function guardarPlanilla(e) {
  e.preventDefault();

  if (!partidoId) {
    mostrarNotificacion("No se encontró el ID del partido", "error");
    return;
  }

  const payload = recolectarPayloadPlanilla();
  const validacionPenales = validarPenalesPlanilla(payload, dataPlanilla?.partido || {});
  if (validacionPenales) {
    mostrarNotificacion(validacionPenales, "warning");
    return;
  }
  const partidoYaFinalizado = estadoPlanillaEsCerrado(dataPlanilla?.partido?.estado);
  if (partidoYaFinalizado) {
    const motivo = await window.mostrarPrompt({
      titulo: "Editar planilla finalizada",
      mensaje: "Esta planilla ya está finalizada. Ingresa el motivo de edición (mínimo 8 caracteres).",
      label: "Motivo de edición",
      inputType: "textarea",
      rows: 4,
      required: true,
      textoConfirmar: "Guardar edición",
      tipo: "warning",
      claseConfirmar: "btn-warning",
    });
    const motivoLimpio = String(motivo || "").trim();
    if (motivoLimpio.length < 8) {
      mostrarNotificacion(
        "Debes ingresar un motivo de edición válido para modificar una planilla finalizada.",
        "warning"
      );
      return;
    }
    payload.motivo_edicion = motivoLimpio;
  }

  try {
    const resp = await ApiClient.put(`/partidos/${partidoId}/planilla`, payload);
    mostrarNotificacion("Planilla guardada correctamente", "success");
    const aviso = formatearAvisoMorosidadPlanilla(resp?.aviso_morosidad);
    if (aviso) {
      mostrarNotificacion(aviso, "warning");
    }
    await cargarPlanilla();
    if (debeRegresarAPlayoffTrasGuardar()) {
      setTimeout(() => {
        regresarAContextoPlanilla();
      }, 350);
    }
  } catch (error) {
    console.error("Error guardando planilla:", error);
    mostrarNotificacion(error.message || "Error guardando planilla", "error");
  }
}

async function exportarPlanillaXLSX() {
  if (!window.XLSX || !dataPlanilla?.partido) {
    mostrarNotificacion("No se pudo preparar la exportacion", "warning");
    return;
  }

  const p = dataPlanilla.partido;
  const payload = recolectarPayloadPlanilla();
  const tipoFutbol = obtenerTipoFutbolPlanilla();
  const cfg = obtenerConfigExportacionPlanilla(tipoFutbol);
  const mostrarEnBlanco = planillaSinDatosDeJuego(payload);

  try {
    const templateResp = await fetch("templates/PlanillaJuego.xlsx", { cache: "no-store" });
    if (!templateResp.ok) {
      throw new Error("No se pudo cargar la plantilla base de planilla");
    }

    const buffer = await templateResp.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellStyles: true });
    const sheet = wb.Sheets[cfg.sheetName];

    if (!sheet) {
      throw new Error(`No existe la hoja "${cfg.sheetName}" en la plantilla`);
    }

    const stats = construirIndicesEventos(payload);

    setCellValue(sheet, cfg.meta.fecha, formatearFecha(p.fecha_partido));
    setCellValue(sheet, cfg.meta.cancha, p.cancha || "");
    const ciudadPlanilla = String(document.getElementById("ciudad-planilla")?.value || p.ciudad || "");
    if (ciudadPlanilla) setCellValue(sheet, cfg.meta.ciudad, ciudadPlanilla);
    setCellValue(sheet, cfg.meta.equipoLocal, p.equipo_local_nombre || equiposPartido.local.nombre);
    setCellValue(sheet, cfg.meta.equipoVisitante, p.equipo_visitante_nombre || equiposPartido.visitante.nombre);
    setCellValue(
      sheet,
      cfg.meta.resultadoLocal,
      mostrarEnBlanco ? "" : formatearMarcadorPlanilla(payload.resultado_local)
    );
    setCellValue(
      sheet,
      cfg.meta.resultadoVisitante,
      mostrarEnBlanco ? "" : formatearMarcadorPlanilla(payload.resultado_visitante)
    );

    llenarPlantelExcel(
      sheet,
      {
        jugadores: cfg.jugadores,
        colNumero: "B",
        colNombre: "C",
        colGol: "G",
        colAmarilla: "H",
        colRoja: "I",
      },
      dataPlanilla.plantel_local || [],
      stats
    );

    llenarPlantelExcel(
      sheet,
      {
        jugadores: cfg.jugadores,
        colNumero: "K",
        colNombre: "L",
        colGol: "P",
        colAmarilla: "Q",
        colRoja: "R",
      },
      dataPlanilla.plantel_visitante || [],
      stats
    );

    setCellValue(
      sheet,
      `${cfg.tarjetasResumen.colLocal}${cfg.tarjetasResumen.amarillasRow}`,
      mostrarEnBlanco ? "" : stats.totalAmarillasLocal || ""
    );
    setCellValue(
      sheet,
      `${cfg.tarjetasResumen.colLocal}${cfg.tarjetasResumen.rojasRow}`,
      mostrarEnBlanco ? "" : stats.totalRojasLocal || ""
    );
    setCellValue(
      sheet,
      `${cfg.tarjetasResumen.colVisitante}${cfg.tarjetasResumen.amarillasRow}`,
      mostrarEnBlanco ? "" : stats.totalAmarillasVisitante || ""
    );
    setCellValue(
      sheet,
      `${cfg.tarjetasResumen.colVisitante}${cfg.tarjetasResumen.rojasRow}`,
      mostrarEnBlanco ? "" : stats.totalRojasVisitante || ""
    );

    const pagoArbitrajeLocal = aDecimal(payload.pagos.pago_arbitraje_local, 0);
    const pagoArbitrajeVisitante = aDecimal(payload.pagos.pago_arbitraje_visitante, 0);
    const pagoLocal = aDecimal(payload.pagos.pago_local, 0);
    const pagoVisitante = aDecimal(payload.pagos.pago_visitante, 0);

    setCellValue(
      sheet,
      `${cfg.pagos.colLocal}${cfg.pagos.arbitrajeRow}`,
      mostrarEnBlanco ? "" : pagoArbitrajeLocal || ""
    );
    setCellValue(
      sheet,
      `${cfg.pagos.colVisitante}${cfg.pagos.arbitrajeRow}`,
      mostrarEnBlanco ? "" : pagoArbitrajeVisitante || ""
    );
    setCellValue(
      sheet,
      `${cfg.pagos.colLocal}${cfg.pagos.tarjetasRojasRow}`,
      mostrarEnBlanco ? "" : `ROJAS: ${stats.totalRojasLocal || 0}`
    );
    setCellValue(
      sheet,
      `${cfg.pagos.colLocal}${cfg.pagos.tarjetasAmarillasRow}`,
      mostrarEnBlanco ? "" : `AMARILLAS: ${stats.totalAmarillasLocal || 0}`
    );
    setCellValue(
      sheet,
      `${cfg.pagos.colVisitante}${cfg.pagos.tarjetasRojasRow}`,
      mostrarEnBlanco ? "" : `ROJAS: ${stats.totalRojasVisitante || 0}`
    );
    setCellValue(
      sheet,
      `${cfg.pagos.colVisitante}${cfg.pagos.tarjetasAmarillasRow}`,
      mostrarEnBlanco ? "" : `AMARILLAS: ${stats.totalAmarillasVisitante || 0}`
    );
    setCellValue(
      sheet,
      `${cfg.pagos.colLocal}${cfg.pagos.inscripcionRow}`,
      mostrarEnBlanco ? "" : pagoLocal || ""
    );
    setCellValue(
      sheet,
      `${cfg.pagos.colVisitante}${cfg.pagos.inscripcionRow}`,
      mostrarEnBlanco ? "" : pagoVisitante || ""
    );

    const observaciones = combinarObservacionesPlanilla(
      obtenerObservacionesLocalPlanilla(payload),
      obtenerObservacionesVisitantePlanilla(payload),
      obtenerObservacionesArbitroPlanilla(payload)
    );
    setCellValue(sheet, `${cfg.observaciones.colLocal}${cfg.observaciones.rowInicio}`, observaciones);
    setCellValue(sheet, `${cfg.observaciones.colVisitante}${cfg.observaciones.rowInicio}`, observaciones);

    llenarHojaListaJugadores(wb, p, dataPlanilla.plantel_local || []);

    const slugTipo = tipoFutbol.replace("futbol_", "f");
    XLSX.writeFile(wb, `planilla_partido_${p.id}_${slugTipo}.xlsx`);
    mostrarNotificacion("Planilla exportada con formato oficial", "success");
  } catch (error) {
    console.error("Error exportando planilla:", error);
    mostrarNotificacion(error.message || "Error exportando planilla", "error");
  }
}

function volverAPartidos() {
  if (debeRegresarAPlayoffTrasGuardar()) {
    regresarAContextoPlanilla();
    return;
  }
  if (window.RouteContext?.navigate) {
    window.RouteContext.navigate("partidos.html", {
      campeonato: Number.isFinite(Number(campeonatoIdContexto)) ? Number(campeonatoIdContexto) : null,
      evento: Number.isFinite(Number(eventoId)) ? Number(eventoId) : null,
    });
    return;
  }
  const params = new URLSearchParams();
  if (Number.isFinite(Number(campeonatoIdContexto)) && Number(campeonatoIdContexto) > 0) {
    params.set("campeonato", String(campeonatoIdContexto));
  }
  if (eventoId) {
    params.set("evento", String(eventoId));
  }
  window.location.href = params.toString() ? `partidos.html?${params.toString()}` : "partidos.html";
}

function recargarPlanilla() {
  if (!Number.isFinite(Number(partidoId)) || Number(partidoId) <= 0) {
    mostrarNotificacion("Selecciona primero un partido", "warning");
    return;
  }
  cargarPlanilla();
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("planilla.html")) return;

  const routeContext = leerContextoRetornoPlanilla();
  partidoId = aEntero(routeContext.partido, NaN);
  eventoId = aEntero(routeContext.evento, NaN);
  if (!Number.isFinite(Number(eventoId))) eventoId = null;
  await resolverCampeonatoContextoPlanilla();
  guardarContextoRutaPlanilla();

  const formPlanilla = document.getElementById("form-planilla");
  const formJugadorPlanilla = document.getElementById("form-planilla-jugador");
  const modalJugadorPlanilla = document.getElementById("modal-planilla-jugador");
  formPlanilla?.addEventListener("submit", guardarPlanilla);
  formPlanilla?.addEventListener("input", () => {
    actualizarVisibilidadPenalesPlanilla();
    actualizarVisibilidadOvertimePlanilla();
    actualizarHeaderPenales();
    actualizarVistaPreviaPlanilla(true);
  });
  formPlanilla?.addEventListener("change", () => {
    actualizarVisibilidadPenalesPlanilla();
    actualizarVisibilidadOvertimePlanilla();
    actualizarHeaderPenales();
    actualizarVistaPreviaPlanilla(true);
  });
  formJugadorPlanilla?.addEventListener("submit", guardarJugadorDesdePlanilla);
  modalJugadorPlanilla?.addEventListener("click", (event) => {
    if (event.target === modalJugadorPlanilla) {
      cerrarModalInscripcionPlanilla();
    }
  });
  inicializarModoVistaPreviaPlanilla();

document.getElementById("ciudad-planilla")?.addEventListener("input", () => {
  actualizarHeaderMetaEditable();
});
document.getElementById("resultado-local-penales")?.addEventListener("input", (event) => {
  const input = event?.target;
  if (input instanceof HTMLInputElement) {
    const numero = normalizarMarcadorPenalesPlanilla(input.value, { permitirVacio: true });
    input.value = numero == null ? "" : String(numero);
  }
  actualizarVisibilidadPenalesPlanilla();
  actualizarHeaderPenales();
  actualizarVistaPreviaPlanilla(true);
});
document.getElementById("resultado-visitante-penales")?.addEventListener("input", (event) => {
  const input = event?.target;
  if (input instanceof HTMLInputElement) {
    const numero = normalizarMarcadorPenalesPlanilla(input.value, { permitirVacio: true });
    input.value = numero == null ? "" : String(numero);
  }
  actualizarVisibilidadPenalesPlanilla();
  actualizarHeaderPenales();
  actualizarVistaPreviaPlanilla(true);
});
document.getElementById("numero-partido-planilla")?.addEventListener("input", (event) => {
  const input = event?.target;
  if (input instanceof HTMLInputElement) {
    const numero = normalizarNumeroPartidoPlanilla(input.value, { permitirVacio: true });
    input.value = numero == null ? "" : String(numero);
  }
  actualizarHeaderMetaEditable();
});
document.getElementById("planilla-jugador-ced")?.addEventListener("input", (event) => {
  const input = event?.target;
  if (input instanceof HTMLInputElement) {
    input.value = normalizarCedulaPlanilla(input.value);
  }
});
  actualizarVisibilidadArbitrajePlanilla();
  document.getElementById("inasistencia-planilla")?.addEventListener("change", () => {
    aplicarEstadoInasistenciaPlanilla(true);
  });
  document.getElementById("estado-partido")?.addEventListener("change", (event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const selectInasistencia = document.getElementById("inasistencia-planilla");
    if (!(selectInasistencia instanceof HTMLSelectElement)) return;

    if (select.value === "no_presentaron_ambos" && selectInasistencia.value !== "ambos") {
      selectInasistencia.value = "ambos";
      aplicarEstadoInasistenciaPlanilla(true);
      return;
    }

    if (selectInasistencia.value === "ambos" && select.value !== "no_presentaron_ambos") {
      selectInasistencia.value = "ninguno";
      aplicarEstadoInasistenciaPlanilla(false);
    }
  });

  await cargarCampeonatosSelectorPlanilla();

  if (Number.isFinite(Number(partidoId)) && Number(partidoId) > 0) {
    await cargarPlanilla();
  } else {
    actualizarVisibilidadContenidoPlanilla(false);
  }
});

window.agregarFilaGol = agregarFilaGol;
window.agregarFilaTarjeta = agregarFilaTarjeta;
window.cargarPlanillaDesdeSelector = cargarPlanillaDesdeSelector;
window.exportarPlanillaXLSX = exportarPlanillaXLSX;
window.exportarPlanillaPDF = exportarPlanillaPDF;
window.imprimirVistaPrevia = imprimirVistaPrevia;
window.imprimirPDFPlanilla = imprimirPDFPlanilla;
window.toggleVistaPreviaPlanilla = toggleVistaPreviaPlanilla;
window.volverAPartidos = volverAPartidos;
window.recargarPlanilla = recargarPlanilla;
window.abrirModalInscripcionPlanilla = abrirModalInscripcionPlanilla;
window.cerrarModalInscripcionPlanilla = cerrarModalInscripcionPlanilla;

