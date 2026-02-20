// frontend/js/planilla.js

let partidoId = null;
let eventoId = null;
let dataPlanilla = null;
let equiposPartido = {
  local: { id: null, nombre: "Local" },
  visitante: { id: null, nombre: "Visitante" },
};
let documentosRequeridos = {
  foto_cedula: false,
  foto_carnet: false,
};
let eventosPlanillaCache = [];
let partidosSelectorCache = [];
let jornadaSelectorActual = "";
let modoVistaPreviaPlanilla = "oficial";

function qp(nombre) {
  const params = new URLSearchParams(window.location.search);
  return params.get(nombre);
}

function aEntero(valor, fallback = 0) {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? n : fallback;
}

function aDecimal(valor, fallback = 0) {
  const n = Number.parseFloat(valor);
  return Number.isFinite(n) ? n : fallback;
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
  const fallback = Number.parseInt(partido?.id, 10);
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return null;
}

function formatearMoneda(valor) {
  const n = aDecimal(valor, 0);
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
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
  const goles = Array.isArray(payload.goles) ? payload.goles : [];
  const tarjetas = Array.isArray(payload.tarjetas) ? payload.tarjetas : [];
  return goles.length === 0 && tarjetas.length === 0 && !tienePagosRegistrados(payload.pagos || {});
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
  return hayCaptura || hayPagos;
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizarArchivoUrl(url) {
  if (!url) return "";
  const raw = String(url).trim();
  if (!raw) return "";
  const normal = raw.replaceAll("\\", "/");
  if (/^https?:\/\//i.test(normal)) return normal;

  const apiBase = String(window.API_BASE_URL || "http://localhost:5000/api");
  const backendBase = apiBase.replace(/\/api\/?$/i, "");
  if (normal.startsWith(`${backendBase}/`)) return normal;
  if (normal.startsWith("/")) return `${backendBase}${normal}`;
  return `${backendBase}/${normal}`;
}

function etiquetaGrupoPartido(p = {}) {
  if (p.letra_grupo) return `Grupo ${p.letra_grupo}`;
  if (p.nombre_grupo) return p.nombre_grupo;
  if (Number.isFinite(Number(p.grupo_id)) && Number(p.grupo_id) > 0) return `Grupo ${p.grupo_id}`;
  return "Sin grupo";
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
  const tipo = String(dataPlanilla?.partido?.tipo_futbol || "").toLowerCase();
  if (tipo.includes("11")) return "futbol_11";
  if (tipo.includes("indor")) return "futbol_11";
  if (tipo.includes("sala")) return "futbol_sala";
  if (tipo.includes("5")) return "futbol_5";
  if (tipo.includes("7")) return "futbol_7";
  return "futbol_7";
}

function obtenerConfigExportacionPlanilla(tipoFutbol) {
  const esFutbol11 = String(tipoFutbol || "").includes("11");

  if (esFutbol11) {
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

function construirIndicesEventos(payload) {
  const golesPorJugador = new Map();
  const amarillasPorJugador = new Map();
  const rojasPorJugador = new Map();

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

  (payload.tarjetas || []).forEach((t) => {
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
      if (equipoId === Number(equiposPartido.local.id)) totalRojasLocal += 1;
      if (equipoId === Number(equiposPartido.visitante.id)) totalRojasVisitante += 1;
    }
  });

  return {
    golesPorJugador,
    amarillasPorJugador,
    rojasPorJugador,
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
  const fecha = formatearFecha(p.fecha_partido);
  const hora = (p.hora_partido || "--:--").toString().substring(0, 5);
  const grupo = etiquetaGrupoPartido(p);
  const jornada = Number.isFinite(Number(p.jornada)) ? `Jornada ${p.jornada}` : "Jornada -";
  const tipoTxt = formatearTipoFutbolTexto(p.tipo_futbol);
  const orgTxt = p.campeonato_organizador || p.campeonato_nombre || "Organizador";
  const logoCampeonato = normalizarArchivoUrl(p.campeonato_logo_url);
  const logoLocal = normalizarArchivoUrl(p.equipo_local_logo_url);
  const logoVisit = normalizarArchivoUrl(p.equipo_visitante_logo_url);
  const logosDerecha = [logoLocal, logoVisit].filter(Boolean);
  const resultadoLocal = aEntero(document.getElementById("resultado-local")?.value, aEntero(p.resultado_local, 0));
  const resultadoVisit = aEntero(
    document.getElementById("resultado-visitante")?.value,
    aEntero(p.resultado_visitante, 0)
  );
  const marcadorVacio = !hayDatosEnFormularioPlanilla() && resultadoLocal === 0 && resultadoVisit === 0;

  const reqCed = documentosRequeridos.foto_cedula ? "Cédula: requerida" : "Cédula: opcional";
  const reqCar = documentosRequeridos.foto_carnet ? "Carnet: requerido" : "Carnet: opcional";

  cont.innerHTML = `
    <div class="planilla-head-sheet${logosDerecha.length ? "" : " no-right-logos"}">
      <div class="planilla-head-logo-slot">
        ${
          logoCampeonato
            ? `<img src="${logoCampeonato}" alt="Logo campeonato" class="planilla-head-logo-img" />`
            : "<div class='planilla-head-logo-fallback'>SGD</div>"
        }
      </div>
      <div class="planilla-head-title-slot">
        <p class="planilla-head-org">${escapeHtml(orgTxt)}</p>
        <h3>PLANILLA DE JUEGO</h3>
        <p class="planilla-head-type">${escapeHtml(tipoTxt)}</p>
      </div>
      <div class="planilla-head-logo-stack" ${logosDerecha.length ? "" : "aria-hidden='true'"}>
        ${logosDerecha
          .map(
            (src, idx) =>
              `<img src="${src}" alt="Logo ${idx === 0 ? "local" : "visitante"}" class="planilla-head-logo-mini" />`
          )
          .join("")}
      </div>
    </div>
    <div class="planilla-head-score-strip">
      <div class="planilla-head-score-team">
        <span id="head-resultado-local" class="planilla-head-score-box">${marcadorVacio ? "" : resultadoLocal}</span>
        <span class="planilla-head-score-name">${escapeHtml(p.equipo_local_nombre || "Local")}</span>
      </div>
      <div class="planilla-head-score-sep">:</div>
      <div class="planilla-head-score-team">
        <span id="head-resultado-visitante" class="planilla-head-score-box">${marcadorVacio ? "" : resultadoVisit}</span>
        <span class="planilla-head-score-name">${escapeHtml(p.equipo_visitante_nombre || "Visitante")}</span>
      </div>
    </div>
    <div class="planilla-head-meta-grid">
      <div><strong>Partido:</strong> #${obtenerNumeroPartidoVisible(p) || "-"}</div>
      <div><strong>${escapeHtml(jornada)}</strong> • ${escapeHtml(grupo)}</div>
      <div><strong>Fecha:</strong> <span id="head-fecha">${fecha}</span></div>
      <div><strong>Hora:</strong> <span id="head-hora">${escapeHtml(hora)}</span></div>
      <div><strong>Cancha:</strong> <span id="head-cancha">${escapeHtml(p.cancha || "Por definir")}</span></div>
      <div><strong>Ciudad:</strong> <span id="head-ciudad">${escapeHtml(p.ciudad || "Por definir")}</span></div>
    </div>
    <p class="planilla-head-docs"><strong>Requisitos documentos:</strong> ${reqCed} • ${reqCar}</p>
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

function renderFaltasVisual() {
  const cont = document.getElementById("planilla-faltas-visual");
  if (!cont || !dataPlanilla?.partido) return;

  const modelo = obtenerModeloPlanillaOficial();
  if (modelo !== "futbol_7_5_sala") {
    cont.innerHTML = "";
    cont.style.display = "none";
    return;
  }

  const itemNums = [1, 2, 3, 4, 5, 6]
    .map((n) => `<span class="${n === 6 ? "is-last" : ""}">${n}</span>`)
    .join("");
  const local = escapeHtml(dataPlanilla.partido.equipo_local_nombre || "Local");
  const visit = escapeHtml(dataPlanilla.partido.equipo_visitante_nombre || "Visitante");

  cont.style.display = "grid";
  cont.innerHTML = `
    <div class="planilla-faltas-team">
      <p>${local}</p>
      <div class="planilla-faltas-cols">
        <div><strong>FALTAS 1ER</strong><div class="planilla-faltas-numbers">${itemNums}</div></div>
        <div><strong>FALTAS 2DO</strong><div class="planilla-faltas-numbers">${itemNums}</div></div>
      </div>
    </div>
    <div class="planilla-faltas-team">
      <p>${visit}</p>
      <div class="planilla-faltas-cols">
        <div><strong>FALTAS 1ER</strong><div class="planilla-faltas-numbers">${itemNums}</div></div>
        <div><strong>FALTAS 2DO</strong><div class="planilla-faltas-numbers">${itemNums}</div></div>
      </div>
    </div>
  `;
}

function actualizarHeaderMetaEditable() {
  const cancha = String(dataPlanilla?.partido?.cancha || "Por definir");
  const ciudadVal = String(document.getElementById("ciudad-planilla")?.value || dataPlanilla?.partido?.ciudad || "Por definir");
  const canchaEl = document.getElementById("head-cancha");
  const ciudadEl = document.getElementById("head-ciudad");
  if (canchaEl) canchaEl.textContent = cancha;
  if (ciudadEl) ciudadEl.textContent = ciudadVal;
}

function actualizarHeaderResultado(local, visitante) {
  const localEl = document.getElementById("head-resultado-local");
  const visitEl = document.getElementById("head-resultado-visitante");
  const marcadorVacio = !hayDatosEnFormularioPlanilla() && aEntero(local, 0) === 0 && aEntero(visitante, 0) === 0;
  if (localEl) localEl.textContent = marcadorVacio ? "" : String(local);
  if (visitEl) visitEl.textContent = marcadorVacio ? "" : String(visitante);
}

function calcularTotalesCaptura() {
  const out = {
    local: { goles: 0, ta: 0, tr: 0 },
    visitante: { goles: 0, ta: 0, tr: 0 },
  };

  document.querySelectorAll(".planilla-player-row").forEach((row) => {
    const equipoId = Number(row.dataset.equipoId);
    const goles = valorNoNegativoEntero(row.querySelector(".cap-goles")?.value, 0, 99);
    const ta = valorNoNegativoEntero(row.querySelector(".cap-ta")?.value, 0, 99);
    const tr = valorNoNegativoEntero(row.querySelector(".cap-tr")?.value, 0, 99);

    if (equipoId === Number(equiposPartido.local.id)) {
      out.local.goles += goles;
      out.local.ta += ta;
      out.local.tr += tr;
    } else if (equipoId === Number(equiposPartido.visitante.id)) {
      out.visitante.goles += goles;
      out.visitante.ta += ta;
      out.visitante.tr += tr;
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
      const docs = [];
      if (documentosRequeridos.foto_cedula) {
        docs.push(j.foto_cedula_url ? "Cédula OK" : "Cédula pendiente");
      }
      if (documentosRequeridos.foto_carnet) {
        docs.push(j.foto_carnet_url ? "Carnet OK" : "Carnet pendiente");
      }
      const docsTxt = docs.length ? ` • ${docs.join(" • ")}` : "";

      return `
        <div class="planilla-plantel-item">
          <strong>#${j.numero_camiseta || "-"}</strong>
          <span>${nombreJugador(j)}</span>
          <small>${j.posicion || "-"}${docsTxt}</small>
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

function renderTablaCapturaEquipo(idContenedor, jugadores, equipoId, statsIniciales) {
  const cont = document.getElementById(idContenedor);
  if (!cont) return;

  if (!Array.isArray(jugadores) || !jugadores.length) {
    cont.innerHTML = "<p class='form-hint'>No hay jugadores registrados en este equipo.</p>";
    return;
  }

  const filas = jugadores
    .map((j, idx) => {
      const jugadorId = Number(j.id);
      const goles = statsIniciales.golesPorJugador.get(jugadorId) || "";
      const amarillas = statsIniciales.amarillasPorJugador.get(jugadorId) || "";
      const rojas = statsIniciales.rojasPorJugador.get(jugadorId) || "";
      const item = idx + 1;
      const numero = j.numero_camiseta || "-";
      const nombre = nombreJugador(j) || `Jugador ${idx + 1}`;
      const docs = [];
      if (documentosRequeridos.foto_cedula) docs.push(j.foto_cedula_url ? "Cedula OK" : "Cedula pendiente");
      if (documentosRequeridos.foto_carnet) docs.push(j.foto_carnet_url ? "Carnet OK" : "Carnet pendiente");
      const docsHtml = docs.length ? `<small>${docs.join(" • ")}</small>` : "";

      return `
        <tr class="planilla-player-row" data-equipo-id="${equipoId}" data-jugador-id="${j.id}">
          <td>${item}</td>
          <td>${numero}</td>
          <td>
            <strong>${escapeHtml(nombre)}</strong>
            ${docsHtml}
          </td>
          <td><input class="cap-goles" type="text" inputmode="numeric" maxlength="2" pattern="[0-9]*" value="${goles}" /></td>
          <td><input class="cap-ta" type="text" inputmode="numeric" maxlength="2" pattern="[0-9]*" value="${amarillas}" /></td>
          <td><input class="cap-tr" type="text" inputmode="numeric" maxlength="2" pattern="[0-9]*" value="${rojas}" /></td>
        </tr>
      `;
    })
    .join("");

  cont.innerHTML = `
    <div class="planilla-captura-table-wrap">
      <table class="planilla-captura-table">
        <thead>
          <tr><th>Item</th><th>N</th><th>Jugador</th><th>G</th><th>TA</th><th>TR</th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
}

function recalcularTotalesCapturaEquipo(idContenedor) {
  const cont = document.getElementById(idContenedor);
  if (!cont) return;

  let totalGoles = 0;
  let totalTa = 0;
  let totalTr = 0;

  cont.querySelectorAll(".planilla-player-row").forEach((row) => {
    totalGoles += valorNoNegativoEntero(row.querySelector(".cap-goles")?.value, 0, 99);
    totalTa += valorNoNegativoEntero(row.querySelector(".cap-ta")?.value, 0, 99);
    totalTr += valorNoNegativoEntero(row.querySelector(".cap-tr")?.value, 0, 99);
  });

  const golesCell = cont.querySelector(".cap-total-goles");
  const taCell = cont.querySelector(".cap-total-ta");
  const trCell = cont.querySelector(".cap-total-tr");

  if (golesCell) golesCell.textContent = String(totalGoles);
  if (taCell) taCell.textContent = String(totalTa);
  if (trCell) trCell.textContent = String(totalTr);
}

function recalcularResultadoDesdeCaptura(preservarSiSinDatos = false) {
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
  actualizarResumenFooterDesdeCaptura();
}

function conectarEventosCaptura() {
  document.querySelectorAll("#captura-local input, #captura-visitante input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      const limpio = String(target.value || "").replace(/\D+/g, "").slice(0, 2);
      const valor = valorNoNegativoEntero(limpio, 0, 99);
      target.value = valor ? String(valor) : "";
      recalcularTotalesCapturaEquipo("captura-local");
      recalcularTotalesCapturaEquipo("captura-visitante");
      recalcularResultadoDesdeCaptura(false);
      actualizarVistaPreviaPlanilla(true);
    });
  });
}

function renderCapturaOficialPorJugador() {
  const statsIniciales = construirStatsInicialesPlanilla();

  renderTablaCapturaEquipo(
    "captura-local",
    dataPlanilla?.plantel_local || [],
    equiposPartido.local.id,
    statsIniciales
  );
  renderTablaCapturaEquipo(
    "captura-visitante",
    dataPlanilla?.plantel_visitante || [],
    equiposPartido.visitante.id,
    statsIniciales
  );

  recalcularTotalesCapturaEquipo("captura-local");
  recalcularTotalesCapturaEquipo("captura-visitante");
  actualizarResumenFooterDesdeCaptura();
  recalcularResultadoDesdeCaptura(true);
  conectarEventosCaptura();
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
  const inputArbitro = document.getElementById("arbitro-planilla");
  const inputDelegado = document.getElementById("delegado-planilla");
  const inputCiudad = document.getElementById("ciudad-planilla");

  if (inputResultadoLocal) inputResultadoLocal.value = aEntero(p.resultado_local, 0);
  if (inputResultadoVisit) inputResultadoVisit.value = aEntero(p.resultado_visitante, 0);
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
  if (inputObserv) inputObserv.value = plan.observaciones || "";
  if (inputArbitro) inputArbitro.value = p.arbitro || "";
  if (inputDelegado) inputDelegado.value = p.delegado_partido || "";
  if (inputCiudad) inputCiudad.value = p.ciudad || "";

  actualizarHeaderMetaEditable();
  actualizarHeaderResultado(
    aEntero(document.getElementById("resultado-local")?.value, 0),
    aEntero(document.getElementById("resultado-visitante")?.value, 0)
  );
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

function poblarJornadasSelectorPlanilla() {
  const selectJornada = document.getElementById("select-jornada-planilla");
  if (!selectJornada) return;

  const jornadas = Array.from(
    new Set(partidosSelectorCache.map((p) => Number(p.jornada)).filter((j) => Number.isFinite(j)))
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

function poblarPartidosSelectorPlanilla() {
  const selectPartido = document.getElementById("select-partido-planilla");
  if (!selectPartido) return;

  let partidos = [...partidosSelectorCache];
  if (jornadaSelectorActual) {
    partidos = partidos.filter((p) => String(p.jornada || "") === String(jornadaSelectorActual));
  }

  partidos.sort((a, b) => {
    const ja = Number(a.jornada) || 0;
    const jb = Number(b.jornada) || 0;
    if (ja !== jb) return ja - jb;
    return String(a.fecha_partido || "").localeCompare(String(b.fecha_partido || ""));
  });

  selectPartido.innerHTML = '<option value="">- Selecciona un partido -</option>';
  partidos.forEach((p) => {
    const hora = (p.hora_partido || "--:--").toString().substring(0, 5);
    const numeroPartido = obtenerNumeroPartidoVisible(p) || "-";
    const label = `P${numeroPartido} • J${p.jornada || "-"} • ${p.equipo_local_nombre} vs ${p.equipo_visitante_nombre} • ${formatearFecha(p.fecha_partido)} ${hora}`;
    selectPartido.innerHTML += `<option value="${p.id}">${escapeHtml(label)}</option>`;
  });

  if (Number.isFinite(Number(partidoId))) {
    const existe = partidos.some((p) => Number(p.id) === Number(partidoId));
    if (existe) selectPartido.value = String(partidoId);
  }
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
  const selectPartido = document.getElementById("select-partido-planilla");
  if (!Number.isFinite(eventoNum) || eventoNum <= 0) {
    partidosSelectorCache = [];
    jornadaSelectorActual = "";
    poblarJornadasSelectorPlanilla();
    if (selectPartido) {
      selectPartido.innerHTML = '<option value="">- Selecciona un partido -</option>';
    }
    return;
  }

  try {
    const resp = await ApiClient.get(`/partidos/evento/${eventoNum}`);
    partidosSelectorCache = Array.isArray(resp) ? resp : (resp.partidos || []);
    let jornadaFijadaPorPartido = false;

    if (Number.isFinite(Number(partidoId))) {
      const partidoMatch = partidosSelectorCache.find((p) => Number(p.id) === Number(partidoId));
      if (partidoMatch && Number.isFinite(Number(partidoMatch.jornada))) {
        jornadaSelectorActual = String(partidoMatch.jornada);
        jornadaFijadaPorPartido = true;
      }
    }

    if (!jornadaFijadaPorPartido && !jornadaSelectorActual) {
      // Sugerimos la ultima jornada por defecto, pero el usuario puede cambiarla libremente.
      jornadaSelectorActual = obtenerUltimaJornadaDisponible(partidosSelectorCache);
    }

    poblarJornadasSelectorPlanilla();
    poblarPartidosSelectorPlanilla();
  } catch (error) {
    console.error("Error cargando partidos para planillaje directo:", error);
    mostrarNotificacion("Error cargando partidos del evento", "error");
    partidosSelectorCache = [];
    jornadaSelectorActual = "";
    poblarJornadasSelectorPlanilla();
    if (selectPartido) {
      selectPartido.innerHTML = '<option value="">- Selecciona un partido -</option>';
    }
  }
}

async function cargarEventosSelectorPlanilla() {
  const selectEvento = document.getElementById("select-evento-planilla");
  const selectJornada = document.getElementById("select-jornada-planilla");
  const selectPartido = document.getElementById("select-partido-planilla");
  if (!selectEvento || !selectJornada || !selectPartido) return;

  selectEvento.innerHTML = '<option value="">- Selecciona una categoría -</option>';

  try {
    const resp = await ApiClient.get("/eventos");
    eventosPlanillaCache = Array.isArray(resp) ? resp : (resp.eventos || []);

    eventosPlanillaCache.forEach((e) => {
      selectEvento.innerHTML += `<option value="${e.id}">${escapeHtml(e.nombre)} (${escapeHtml(e.categoria || "Sin categoria")})</option>`;
    });

    selectEvento.addEventListener("change", async () => {
      eventoId = selectEvento.value ? Number(selectEvento.value) : null;
      jornadaSelectorActual = "";
      partidoId = NaN;
      await cargarPartidosSelectorPorEvento(eventoId);
      actualizarVisibilidadContenidoPlanilla(false);
    });

    selectJornada.addEventListener("change", () => {
      jornadaSelectorActual = selectJornada.value || "";
      poblarPartidosSelectorPlanilla();
    });

    selectPartido.addEventListener("change", () => {
      const idSel = Number(selectPartido.value);
      partidoId = Number.isFinite(idSel) ? idSel : NaN;
    });

    if (Number.isFinite(Number(eventoId))) {
      selectEvento.value = String(eventoId);
      await cargarPartidosSelectorPorEvento(eventoId);
    }
  } catch (error) {
    console.error("Error cargando Categorías para planillaje directo:", error);
    mostrarNotificacion("Error cargando Categorías", "error");
  }
}

async function sincronizarSelectoresDesdePlanillaActual() {
  const selectEvento = document.getElementById("select-evento-planilla");
  const selectJornada = document.getElementById("select-jornada-planilla");
  const selectPartido = document.getElementById("select-partido-planilla");
  const p = dataPlanilla?.partido;
  if (!selectEvento || !selectJornada || !selectPartido || !p) return;

  const eventoActual = Number(p.evento_id || eventoId);
  if (Number.isFinite(eventoActual) && eventoActual > 0) {
    eventoId = eventoActual;
    if (String(selectEvento.value) !== String(eventoActual)) {
      selectEvento.value = String(eventoActual);
      await cargarPartidosSelectorPorEvento(eventoActual);
    } else if (!partidosSelectorCache.length) {
      await cargarPartidosSelectorPorEvento(eventoActual);
    }
  }

  if (Number.isFinite(Number(p.jornada))) {
    jornadaSelectorActual = String(p.jornada);
    selectJornada.value = jornadaSelectorActual;
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

  const params = new URLSearchParams();
  params.set("partido", String(partidoId));
  if (eventoId) params.set("evento", String(eventoId));
  window.history.replaceState({}, "", `planilla.html?${params.toString()}`);

  await cargarPlanilla();
}

async function cargarPlanilla() {
  if (!Number.isFinite(Number(partidoId)) || Number(partidoId) <= 0) return;

  try {
    const resp = await ApiClient.get(`/partidos/${partidoId}/planilla`);
    dataPlanilla = resp;

    const p = dataPlanilla.partido || {};
    equiposPartido = {
      local: { id: p.equipo_local_id, nombre: p.equipo_local_nombre || "Local" },
      visitante: { id: p.equipo_visitante_id, nombre: p.equipo_visitante_nombre || "Visitante" },
    };

    documentosRequeridos = {
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
  const goles = [];
  const tarjetas = [];
  const filasCaptura = Array.from(document.querySelectorAll(".planilla-player-row"));

  if (filasCaptura.length) {
    filasCaptura.forEach((row) => {
      const equipoId = Number(row.dataset.equipoId);
      const jugadorId = Number(row.dataset.jugadorId);
      if (!Number.isFinite(equipoId) || !Number.isFinite(jugadorId)) return;

      const golesNum = valorNoNegativoEntero(row.querySelector(".cap-goles")?.value, 0, 99);
      const amarillasNum = valorNoNegativoEntero(row.querySelector(".cap-ta")?.value, 0, 99);
      const rojasNum = valorNoNegativoEntero(row.querySelector(".cap-tr")?.value, 0, 99);

      if (golesNum > 0) {
        goles.push({
          equipo_id: equipoId,
          jugador_id: jugadorId,
          goles: golesNum,
          tipo_gol: "campo",
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

      for (let i = 0; i < rojasNum; i += 1) {
        tarjetas.push({
          equipo_id: equipoId,
          jugador_id: jugadorId,
          tipo_tarjeta: "roja",
          minuto: null,
          observacion: null,
        });
      }
    });
  } else {
    // Respaldo del flujo anterior por filas manuales.
    document.querySelectorAll(".planilla-row-gol").forEach((row) => {
      const equipoId = aEntero(row.querySelector(".row-equipo")?.value, NaN);
      const jugadorId = aEntero(row.querySelector(".row-jugador")?.value, NaN);
      const golesNum = aEntero(row.querySelector(".row-goles")?.value, 0);
      const tipoGol = String(row.querySelector(".row-tipo-gol")?.value || "campo").trim().toLowerCase();
      const minutoRaw = row.querySelector(".row-minuto")?.value;
      const minuto = minutoRaw ? aEntero(minutoRaw, null) : null;

      if (!Number.isFinite(equipoId) || !Number.isFinite(jugadorId) || golesNum <= 0) return;

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

      tarjetas.push({
        equipo_id: equipoId,
        jugador_id: jugadorId,
        tipo_tarjeta: tipoTarjeta,
        minuto: minutoRaw ? aEntero(minutoRaw, null) : null,
        observacion: observacion || null,
      });
    });
  }

  return {
    resultado_local: aEntero(document.getElementById("resultado-local")?.value, 0),
    resultado_visitante: aEntero(document.getElementById("resultado-visitante")?.value, 0),
    estado: String(document.getElementById("estado-partido")?.value || "finalizado"),
    arbitro: String(document.getElementById("arbitro-planilla")?.value || "").trim(),
    delegado_partido: String(document.getElementById("delegado-planilla")?.value || "").trim(),
    ciudad: String(document.getElementById("ciudad-planilla")?.value || "").trim(),
    observaciones: String(document.getElementById("observaciones-planilla")?.value || "").trim(),
    pagos: {
      pago_ta_local: leerPagoInput("pago-ta-local"),
      pago_ta_visitante: leerPagoInput("pago-ta-visitante"),
      pago_tr_local: leerPagoInput("pago-tr-local"),
      pago_tr_visitante: leerPagoInput("pago-tr-visitante"),
      pago_arbitraje_local: leerPagoInput("pago-arbitraje-local"),
      pago_arbitraje_visitante: leerPagoInput("pago-arbitraje-visitante"),
      // Compatibilidad con campos globales anteriores
      pago_ta: leerPagoInput("pago-ta-local") + leerPagoInput("pago-ta-visitante"),
      pago_tr: leerPagoInput("pago-tr-local") + leerPagoInput("pago-tr-visitante"),
      pago_arbitraje:
        leerPagoInput("pago-arbitraje-local") + leerPagoInput("pago-arbitraje-visitante"),
      pago_local: leerPagoInput("pago-local"),
      pago_visitante: leerPagoInput("pago-visitante"),
    },
    goles,
    tarjetas,
  };
}

function renderFilasVistaPreviaEquipo(jugadores, stats, maxFilas) {
  const filas = [];
  for (let i = 0; i < maxFilas; i += 1) {
    const j = jugadores[i] || null;
    const jugadorId = Number(j?.id);
    const item = i + 1;
    const numero = j ? j.numero_camiseta || "" : "";
    const nombre = j ? `${j.apellido || ""} ${j.nombre || ""}`.trim() : "";
    const goles = j ? stats.golesPorJugador.get(jugadorId) || "" : "";
    const amarillas = j ? stats.amarillasPorJugador.get(jugadorId) || "" : "";
    const rojas = j ? stats.rojasPorJugador.get(jugadorId) || "" : "";

    filas.push(`
      <tr>
        <td>${item}</td>
        <td>${numero}</td>
        <td>${escapeHtml(nombre)}</td>
        <td>${goles}</td>
        <td>${amarillas}</td>
        <td>${rojas}</td>
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
  const tipo = String(dataPlanilla?.partido?.tipo_futbol || "").toLowerCase();
  if (tipo.includes("11") || tipo.includes("indor")) return "futbol_11_indor";
  return "futbol_7_5_sala";
}

function obtenerMaxFilasVistaPreviaPlanilla() {
  const localCount = Array.isArray(dataPlanilla?.plantel_local)
    ? dataPlanilla.plantel_local.length
    : 0;
  const visitanteCount = Array.isArray(dataPlanilla?.plantel_visitante)
    ? dataPlanilla.plantel_visitante.length
    : 0;
  // En vista previa/impresion priorizamos una hoja compacta.
  const filasNecesarias = Math.max(localCount, visitanteCount, 8);
  return Math.min(filasNecesarias, 18);
}

function renderFilasVistaPreviaOficialEquipo(jugadores, stats, maxFilas) {
  const filas = [];
  for (let i = 0; i < maxFilas; i += 1) {
    const j = jugadores[i] || null;
    const jugadorId = Number(j?.id);
    const item = i + 1;
    const numero = j ? j.numero_camiseta || "" : "";
    const nombre = j ? `${j.apellido || ""} ${j.nombre || ""}`.trim() : "";
    const goles = j ? stats.golesPorJugador.get(jugadorId) || "" : "";
    const amarillas = j ? stats.amarillasPorJugador.get(jugadorId) || "" : "";
    const rojas = j ? stats.rojasPorJugador.get(jugadorId) || "" : "";

    filas.push(`
      <tr>
        <td>${item}</td>
        <td>${numero}</td>
        <td>${escapeHtml(nombre)}</td>
        <td>${goles}</td>
        <td>${amarillas}</td>
        <td>${rojas}</td>
      </tr>
    `);
  }
  return filas.join("");
}

function renderBloqueFaltasEquipo(label) {
  const items = [1, 2, 3, 4, 5, 6]
    .map((n) => `<span>${n}</span>`)
    .join("");

  return `
    <div class="planilla-oficial-faltas-team">
      <p>${escapeHtml(label)}</p>
      <div class="planilla-oficial-faltas-col">
        <strong>FALTAS 1ER</strong>
        <div class="planilla-oficial-faltas-grid">${items}</div>
      </div>
      <div class="planilla-oficial-faltas-col">
        <strong>FALTAS 2DO</strong>
        <div class="planilla-oficial-faltas-grid">${items}</div>
      </div>
    </div>
  `;
}

function renderVistaPreviaOficial(p, payload, stats, maxFilas, fecha, hora) {
  const cont = document.getElementById("planilla-preview-content");
  if (!cont) return;

  const modelo = obtenerModeloPlanillaOficial();
  const tituloModelo = modelo === "futbol_11_indor" ? "FUTBOL 11 / INDOR" : "FUTBOL 7 / 5 / SALA";
  const grupo = etiquetaGrupoPartido(p);
  const jornada = Number.isFinite(Number(p.jornada)) ? `Jornada ${p.jornada}` : "Jornada -";
  const arbitro = String(document.getElementById("arbitro-planilla")?.value || p.arbitro || "");
  const delegado = String(document.getElementById("delegado-planilla")?.value || p.delegado_partido || "");
  const ciudad = String(document.getElementById("ciudad-planilla")?.value || p.ciudad || "");
  const logoOrg = normalizarArchivoUrl(p.campeonato_logo_url);

  const filasLocal = renderFilasVistaPreviaOficialEquipo(dataPlanilla.plantel_local || [], stats, maxFilas);
  const filasVisit = renderFilasVistaPreviaOficialEquipo(dataPlanilla.plantel_visitante || [], stats, maxFilas);
  const mostrarEnBlanco = planillaSinDatosDeJuego(payload);
  const marcadorLocal = mostrarEnBlanco ? "" : String(aEntero(payload.resultado_local, 0));
  const marcadorVisit = mostrarEnBlanco ? "" : String(aEntero(payload.resultado_visitante, 0));

  cont.innerHTML = `
    <div class="planilla-oficial-sheet ${modelo}">
      <header class="planilla-oficial-head">
        <div class="planilla-oficial-head-text">
          <p class="planilla-oficial-org">${escapeHtml(p.campeonato_organizador || p.campeonato_nombre || "SGD")}</p>
          <h4>PLANILLA DE JUEGO</h4>
          <p class="planilla-oficial-type">${escapeHtml(tituloModelo)}</p>
        </div>
        ${
          logoOrg
            ? `<div class="planilla-oficial-head-logo-box"><img src="${logoOrg}" alt="Logo organizador" class="planilla-oficial-org-logo" /></div>`
            : ""
        }
      </header>

      <div class="planilla-oficial-meta">
        <div><strong>Fecha:</strong> ${fecha}</div>
        <div><strong>Hora:</strong> ${escapeHtml(hora)}</div>
        <div><strong>Cancha:</strong> ${escapeHtml(p.cancha || "Por definir")}</div>
        <div><strong>Ciudad:</strong> ${escapeHtml(ciudad || "Por definir")}</div>
        <div><strong>Arbitro:</strong> ${escapeHtml(arbitro || "________________")}</div>
        <div><strong>Delegado:</strong> ${escapeHtml(delegado || "________________")}</div>
        <div><strong>Partido:</strong> #${obtenerNumeroPartidoVisible(p) || "-"}</div>
        <div><strong>${escapeHtml(jornada)}</strong> • ${escapeHtml(grupo)}</div>
      </div>

      <div class="planilla-oficial-score">
        <div class="team">${escapeHtml(p.equipo_local_nombre || equiposPartido.local.nombre)}</div>
        <div class="result">${marcadorLocal}</div>
        <div class="sep">:</div>
        <div class="result">${marcadorVisit}</div>
        <div class="team">${escapeHtml(p.equipo_visitante_nombre || equiposPartido.visitante.nombre)}</div>
      </div>

      ${
        modelo === "futbol_7_5_sala"
          ? `<div class="planilla-oficial-faltas">${renderBloqueFaltasEquipo(
              p.equipo_local_nombre || equiposPartido.local.nombre
            )}${renderBloqueFaltasEquipo(p.equipo_visitante_nombre || equiposPartido.visitante.nombre)}</div>`
          : ""
      }

      <div class="planilla-oficial-teams">
        <article class="planilla-oficial-team">
          <div class="planilla-oficial-team-title">EQUIPO: ${escapeHtml(p.equipo_local_nombre || equiposPartido.local.nombre)}</div>
          <table class="planilla-oficial-table">
            <thead>
              <tr><th>Item</th><th>N</th><th>Nombre</th><th>Gol</th><th>TA</th><th>TR</th></tr>
            </thead>
            <tbody>${filasLocal}</tbody>
          </table>
          <div class="planilla-oficial-team-notes">
            <p><strong>Dirigente / Director tecnico:</strong> ${escapeHtml(p.equipo_local_director_tecnico || "________________")}</p>
            <p class="planilla-oficial-signature-line"><strong>Firma:</strong> ____________________________</p>
            <p><strong>Tarjetas amarillas:</strong> ${formatearConteoPlanilla(stats.totalAmarillasLocal, mostrarEnBlanco)}</p>
            <p><strong>Tarjetas rojas:</strong> ${formatearConteoPlanilla(stats.totalRojasLocal, mostrarEnBlanco)}</p>
          </div>
        </article>

        <article class="planilla-oficial-team">
          <div class="planilla-oficial-team-title">EQUIPO: ${escapeHtml(p.equipo_visitante_nombre || equiposPartido.visitante.nombre)}</div>
          <table class="planilla-oficial-table">
            <thead>
              <tr><th>Item</th><th>N</th><th>Nombre</th><th>Gol</th><th>TA</th><th>TR</th></tr>
            </thead>
            <tbody>${filasVisit}</tbody>
          </table>
          <div class="planilla-oficial-team-notes">
            <p><strong>Dirigente / Director tecnico:</strong> ${escapeHtml(p.equipo_visitante_director_tecnico || "________________")}</p>
            <p class="planilla-oficial-signature-line"><strong>Firma:</strong> ____________________________</p>
            <p><strong>Tarjetas amarillas:</strong> ${formatearConteoPlanilla(stats.totalAmarillasVisitante, mostrarEnBlanco)}</p>
            <p><strong>Tarjetas rojas:</strong> ${formatearConteoPlanilla(stats.totalRojasVisitante, mostrarEnBlanco)}</p>
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

        <div class="planilla-oficial-observ">
          <strong>OBSERVACIONES</strong>
          <p>${escapeHtml(payload.observaciones || "")}</p>
        </div>
      </div>
    </div>
  `;
}

function renderVistaPreviaResumen(p, payload, stats, maxFilas, fecha, hora) {
  const cont = document.getElementById("planilla-preview-content");
  if (!cont) return;

  const categoria = p.evento_nombre || "Sin categoria";
  const tipoFutbol = String(p.tipo_futbol || "").replaceAll("_", " ").toUpperCase();
  const grupo = etiquetaGrupoPartido(p);
  const filasLocal = renderFilasVistaPreviaEquipo(dataPlanilla.plantel_local || [], stats, maxFilas);
  const filasVisit = renderFilasVistaPreviaEquipo(dataPlanilla.plantel_visitante || [], stats, maxFilas);
  const eventosVistaPrevia = renderListaEventosVistaPrevia(payload);

  const mostrarEnBlanco = planillaSinDatosDeJuego(payload);
  const scoreLocal = mostrarEnBlanco ? "" : String(aEntero(payload.resultado_local, 0));
  const scoreVisit = mostrarEnBlanco ? "" : String(aEntero(payload.resultado_visitante, 0));

  cont.innerHTML = `
    <div class="planilla-preview-sheet">
      <div class="planilla-preview-head">
        <h4 class="preview-title">${escapeHtml(p.campeonato_nombre || "Planilla de Juego")}</h4>
        <p class="preview-subtitle">${escapeHtml(categoria)} • ${escapeHtml(tipoFutbol)} • ${escapeHtml(grupo)}</p>
      </div>

      <div class="planilla-preview-meta">
        <div class="meta-item"><strong>Partido</strong>#${obtenerNumeroPartidoVisible(p) || "-"}</div>
        <div class="meta-item"><strong>Fecha</strong>${fecha}</div>
        <div class="meta-item"><strong>Hora</strong>${hora}</div>
        <div class="meta-item"><strong>Cancha</strong>${escapeHtml(p.cancha || "Por definir")}</div>
      </div>

      <div class="planilla-preview-score">
        <div class="team-name">${escapeHtml(p.equipo_local_nombre || equiposPartido.local.nombre)}</div>
        <div class="score-box">${scoreLocal}${scoreLocal !== "" || scoreVisit !== "" ? " - " : ""}${scoreVisit}</div>
        <div class="team-name">${escapeHtml(p.equipo_visitante_nombre || equiposPartido.visitante.nombre)}</div>
      </div>

      <div class="planilla-preview-columns">
        <article class="planilla-preview-team">
          <h4>Plantel Local</h4>
          <table class="planilla-preview-table">
            <thead>
              <tr><th>Item</th><th>N</th><th>Jugador</th><th>G</th><th>TA</th><th>TR</th></tr>
            </thead>
            <tbody>${filasLocal}</tbody>
          </table>
        </article>
        <article class="planilla-preview-team">
          <h4>Plantel Visitante</h4>
          <table class="planilla-preview-table">
            <thead>
              <tr><th>Item</th><th>N</th><th>Jugador</th><th>G</th><th>TA</th><th>TR</th></tr>
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
          <h5 style="margin-top:0.8rem;">Observaciones</h5>
          <div class="planilla-preview-observ">${escapeHtml(payload.observaciones || "")}</div>
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

function construirFilasPlantelPdf(jugadores, stats, maxFilas) {
  const body = [[
    { text: "Item", style: "thCenter" },
    { text: "N", style: "thCenter" },
    { text: "Nombre", style: "thLeft" },
    { text: "Gol", style: "thCenter" },
    { text: "TA", style: "thCenter" },
    { text: "TR", style: "thCenter" },
  ]];

  for (let i = 0; i < maxFilas; i += 1) {
    const j = jugadores[i] || null;
    const jugadorId = Number(j?.id);
    const nombre = j ? `${j.apellido || ""} ${j.nombre || ""}`.trim() : "";
    const numero = j ? String(j.numero_camiseta || "") : "";
    const goles = j ? String(stats.golesPorJugador.get(jugadorId) || "") : "";
    const ta = j ? String(stats.amarillasPorJugador.get(jugadorId) || "") : "";
    const tr = j ? String(stats.rojasPorJugador.get(jugadorId) || "") : "";

    body.push([
      { text: String(i + 1), style: "tdCenter" },
      { text: numero, style: "tdCenter" },
      { text: nombre, style: "tdLeft" },
      { text: goles, style: "tdCenter" },
      { text: ta, style: "tdCenter" },
      { text: tr, style: "tdCenter" },
    ]);
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

  pdfTab.document.title = `Planilla Partido ${obtenerNumeroPartidoVisible(dataPlanilla.partido) || dataPlanilla.partido.id}`;
  pdfTab.document.body.innerHTML = "<p style='font-family:Arial,sans-serif;padding:12px;'>Generando PDF...</p>";

  try {
    const p = dataPlanilla.partido;
    const payload = recolectarPayloadPlanilla();
    const stats = construirIndicesEventos(payload);
    const fecha = formatearFecha(p.fecha_partido);
    const hora = (p.hora_partido || "--:--").toString().substring(0, 5);
    const jornada = Number.isFinite(Number(p.jornada)) ? `Jornada ${p.jornada}` : "Jornada -";
    const grupo = etiquetaGrupoPartido(p);
    const arbitro = String(document.getElementById("arbitro-planilla")?.value || p.arbitro || "");
    const delegado = String(document.getElementById("delegado-planilla")?.value || p.delegado_partido || "");
    const ciudad = String(document.getElementById("ciudad-planilla")?.value || p.ciudad || "");
    const modelo = obtenerModeloPlanillaOficial();
    const tituloModelo = modelo === "futbol_11_indor" ? "FUTBOL 11 / INDOR" : "FUTBOL 7 / 5 / SALA";
    const localNombre = p.equipo_local_nombre || equiposPartido.local.nombre;
    const visitNombre = p.equipo_visitante_nombre || equiposPartido.visitante.nombre;
    const localDt = p.equipo_local_director_tecnico || "-";
    const visitDt = p.equipo_visitante_director_tecnico || "-";
    const maxFilasObjetivo = modelo === "futbol_7_5_sala" ? 20 : 18;
    const maxFilas = maxFilasObjetivo;
    const alturaFilaPlantel = modelo === "futbol_7_5_sala" ? 10 : 9;
    const alturaCabeceraPlantel = 10;
    const bodyLocal = construirFilasPlantelPdf(dataPlanilla.plantel_local || [], stats, maxFilas);
    const bodyVisit = construirFilasPlantelPdf(dataPlanilla.plantel_visitante || [], stats, maxFilas);
    const logoOrg = await cargarImagenComoDataUrl(p.campeonato_logo_url);
    const mostrarEnBlanco = planillaSinDatosDeJuego(payload);
    const marcadorLocal = mostrarEnBlanco ? "" : String(aEntero(payload.resultado_local, 0));
    const marcadorVisit = mostrarEnBlanco ? "" : String(aEntero(payload.resultado_visitante, 0));

    const docDefinition = {
      pageSize: "A4",
      pageMargins: [8, 8, 8, 8],
      defaultStyle: { fontSize: 8.2, color: "#111827" },
      content: [
        {
          columns: [
            logoOrg
              ? {
                  width: 56,
                  image: logoOrg,
                  fit: [54, 54],
                  alignment: "left",
                  margin: [0, 2, 0, 0],
                }
              : { width: 56, text: "" },
            {
              width: "*",
              stack: [
                {
                  text: p.campeonato_organizador || p.campeonato_nombre || "SGD",
                  alignment: "center",
                  bold: true,
                  fontSize: 10.5,
                },
                { text: "PLANILLA DE JUEGO", alignment: "center", bold: true, fontSize: 17, margin: [0, 1, 0, 0] },
                { text: tituloModelo, alignment: "center", bold: true, fontSize: 10.5, margin: [0, 1, 0, 0] },
              ],
              margin: [0, 3, 0, 0],
            },
            { width: 56, text: "" },
          ],
          margin: [0, 0, 0, 36],
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
                { text: [{ text: "Arbitro: ", bold: true }, arbitro || "________________"] },
                { text: [{ text: "Delegado: ", bold: true }, delegado || "________________"] },
                { text: [{ text: "Partido: ", bold: true }, `#${obtenerNumeroPartidoVisible(p) || "-"}`] },
                { text: [{ text: `${jornada}: `, bold: true }, grupo] },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.6,
            vLineWidth: () => 0.6,
            hLineColor: () => "#cbd5e1",
            vLineColor: () => "#cbd5e1",
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
          margin: [0, 0, 0, 6],
        },
        {
          table: {
            widths: ["*", 30, 10, 30, "*"],
            body: [[
              { text: localNombre, alignment: "center", bold: true, fontSize: 11.5, border: [false, false, false, false], margin: [0, 13, 0, 0] },
              { text: marcadorLocal, alignment: "center", bold: true, fontSize: 16, margin: [0, 12, 0, 0] },
              { text: ":", alignment: "center", bold: true, fontSize: 16.5, border: [false, false, false, false], margin: [0, 12, 0, 0] },
              { text: marcadorVisit, alignment: "center", bold: true, fontSize: 16, margin: [0, 12, 0, 0] },
              { text: visitNombre, alignment: "center", bold: true, fontSize: 11.5, border: [false, false, false, false], margin: [0, 13, 0, 0] },
            ]],
            heights: () => 48,
          },
          layout: {
            hLineWidth: (i) => (i === 0 || i === 1 ? 0 : 0),
            vLineWidth: (i) => (i === 1 || i === 2 || i === 3 || i === 4 ? 0.6 : 0),
            hLineColor: () => "#94a3b8",
            vLineColor: () => "#94a3b8",
            paddingTop: () => 6,
            paddingBottom: () => 6,
          },
          margin: [0, 0, 0, 6],
        },
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
                { text: `EQUIPO: ${localNombre}`, style: "teamHead" },
                {
                  table: {
                    headerRows: 1,
                    widths: [20, 20, "*", 18, 18, 18],
                    body: bodyLocal,
                    heights: (row) => (row === 0 ? alturaCabeceraPlantel : alturaFilaPlantel),
                  },
                  layout: {
                    hLineWidth: () => 0.5,
                    vLineWidth: () => 0.5,
                    hLineColor: () => "#cbd5e1",
                    vLineColor: () => "#cbd5e1",
                    paddingLeft: () => 2,
                    paddingRight: () => 2,
                    paddingTop: () => 2,
                    paddingBottom: () => 2,
                  },
                },
                { text: [{ text: "Dirigente / Director tecnico: ", bold: true }, localDt], margin: [0, 4, 0, 0] },
                {
                  table: {
                    widths: [26, "*"],
                    body: [
                      [
                        { text: "Firma:", bold: true, border: [false, false, false, false] },
                        { text: "", border: [false, false, false, true] },
                      ],
                      [
                        { text: "", border: [false, false, false, false] },
                        { text: "", border: [false, false, false, true] },
                      ],
                      [
                        { text: "", border: [false, false, false, false] },
                        { text: "", border: [false, false, false, true] },
                      ],
                    ],
                    heights: (row) => (row === 0 ? 11 : 12),
                  },
                  layout: {
                    hLineWidth: () => 0,
                    vLineWidth: () => 0,
                    paddingLeft: () => 0,
                    paddingRight: () => 0,
                    paddingTop: () => 0,
                    paddingBottom: () => 0,
                  },
                  margin: [0, 1, 0, 0],
                },
                {
                  ...construirBloqueTarjetasEquipoPdf(
                    Number(stats.totalAmarillasLocal || 0),
                    Number(stats.totalRojasLocal || 0),
                    mostrarEnBlanco
                  ),
                  margin: [0, 3, 0, 0],
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
                { text: `EQUIPO: ${visitNombre}`, style: "teamHead" },
                {
                  table: {
                    headerRows: 1,
                    widths: [20, 20, "*", 18, 18, 18],
                    body: bodyVisit,
                    heights: (row) => (row === 0 ? alturaCabeceraPlantel : alturaFilaPlantel),
                  },
                  layout: {
                    hLineWidth: () => 0.5,
                    vLineWidth: () => 0.5,
                    hLineColor: () => "#cbd5e1",
                    vLineColor: () => "#cbd5e1",
                    paddingLeft: () => 2,
                    paddingRight: () => 2,
                    paddingTop: () => 2,
                    paddingBottom: () => 2,
                  },
                },
                { text: [{ text: "Dirigente / Director tecnico: ", bold: true }, visitDt], margin: [0, 4, 0, 0] },
                {
                  table: {
                    widths: [26, "*"],
                    body: [
                      [
                        { text: "Firma:", bold: true, border: [false, false, false, false] },
                        { text: "", border: [false, false, false, true] },
                      ],
                      [
                        { text: "", border: [false, false, false, false] },
                        { text: "", border: [false, false, false, true] },
                      ],
                      [
                        { text: "", border: [false, false, false, false] },
                        { text: "", border: [false, false, false, true] },
                      ],
                    ],
                    heights: (row) => (row === 0 ? 11 : 12),
                  },
                  layout: {
                    hLineWidth: () => 0,
                    vLineWidth: () => 0,
                    paddingLeft: () => 0,
                    paddingRight: () => 0,
                    paddingTop: () => 0,
                    paddingBottom: () => 0,
                  },
                  margin: [0, 1, 0, 0],
                },
                {
                  ...construirBloqueTarjetasEquipoPdf(
                    Number(stats.totalAmarillasVisitante || 0),
                    Number(stats.totalRojasVisitante || 0),
                    mostrarEnBlanco
                  ),
                  margin: [0, 3, 0, 0],
                },
              ],
            },
          ],
          margin: [0, 0, 0, 6],
        },
        {
          text: "PAGOS",
          style: "sectionTitle",
          margin: [0, 1, 0, 3],
        },
        {
          ...construirBloquePagosPdf(localNombre, visitNombre, payload.pagos, mostrarEnBlanco),
          margin: [0, 0, 0, 4],
        },
        {
          text: "OBSERVACIONES",
          style: "sectionTitle",
          margin: [0, 1, 0, 2],
        },
        {
          table: {
            widths: ["*"],
            body: [
              [{ text: payload.observaciones || "" }],
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
      styles: {
        sectionTitle: { bold: true, fontSize: 8.8, color: "#0f172a" },
        teamHead: { bold: true, fontSize: 8.6, margin: [0, 0, 0, 2] },
        thCenter: { bold: true, alignment: "center", fillColor: "#eef4fb", fontSize: 8 },
        thLeft: { bold: true, alignment: "left", fillColor: "#eef4fb", fontSize: 8 },
        tdCenter: { alignment: "center", fontSize: 7.8 },
        tdLeft: { alignment: "left", fontSize: 7.8 },
        footTeamTitle: { bold: true, fillColor: "#f3f4f6", fontSize: 8.5 },
        footLabel: { bold: true, fontSize: 7.8 },
        footValue: { fontSize: 7.8, alignment: "right" },
        footValueCenter: { fontSize: 8.2, alignment: "center", bold: true },
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

  try {
    await ApiClient.put(`/partidos/${partidoId}/planilla`, payload);
    mostrarNotificacion("Planilla guardada correctamente", "success");
    await cargarPlanilla();
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
      mostrarEnBlanco ? "" : aEntero(payload.resultado_local, 0)
    );
    setCellValue(
      sheet,
      cfg.meta.resultadoVisitante,
      mostrarEnBlanco ? "" : aEntero(payload.resultado_visitante, 0)
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

    const observaciones = payload.observaciones || "";
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
  if (eventoId) {
    window.location.href = `partidos.html?evento=${eventoId}`;
    return;
  }
  window.location.href = "partidos.html";
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

  partidoId = aEntero(qp("partido"), NaN);
  eventoId = aEntero(qp("evento"), NaN);
  if (!Number.isFinite(Number(eventoId))) eventoId = null;

  const formPlanilla = document.getElementById("form-planilla");
  formPlanilla?.addEventListener("submit", guardarPlanilla);
  formPlanilla?.addEventListener("input", () => actualizarVistaPreviaPlanilla(true));
  formPlanilla?.addEventListener("change", () => actualizarVistaPreviaPlanilla(true));
  inicializarModoVistaPreviaPlanilla();

  document.getElementById("ciudad-planilla")?.addEventListener("input", () => {
    actualizarHeaderMetaEditable();
  });

  await cargarEventosSelectorPlanilla();

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


