const BACKEND_BASE_J = (window.resolveBackendBaseUrl
  ? window.resolveBackendBaseUrl()
  : `${window.location.origin}`).replace(/\/$/, "");

const RONDAS_ORDEN_J = ["32vos", "16vos", "12vos", "8vos", "4tos", "semifinal", "final", "tercer_puesto"];

let eventoIdJ = null;
let modoPlantillaJ = "regular";
let jornadaActualJ = null;
let rondaActualJ = null;
let jornadasDisponibles = [];
let rondasDisponiblesJ = [];
let partidosJ = [];
let crucesPlayoffJ = [];

let ctxJ = {
  campeonatoNombre: "",
  organizador: "",
  tipoFutbol: "",
  eventoNombre: "",
  logoUrl: null,
  colorPrimario: "#1e3a5f",
  colorSecundario: "#0b1f35",
  colorAcento: "#facc15",
  auspiciantes: [],
};

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("jornadasplantilla.html")) return;

  const routeCtx =
    window.RouteContext?.read?.("jornadasplantilla.html", ["evento", "jornada", "modo", "ronda"]) || {};
  eventoIdJ = Number.parseInt(routeCtx.evento || "", 10);
  modoPlantillaJ = String(routeCtx.modo || "").toLowerCase() === "playoff" ? "playoff" : "regular";
  jornadaActualJ = routeCtx.jornada ? Number.parseInt(routeCtx.jornada, 10) : null;
  rondaActualJ = routeCtx.ronda ? String(routeCtx.ronda).toLowerCase() : null;

  if (!Number.isFinite(eventoIdJ) || eventoIdJ <= 0) {
    document.getElementById("jornada-partidos").innerHTML =
      "<p class='empty-state'>Evento no válido para la plantilla.</p>";
    return;
  }

  actualizarTituloPantallaJ();
  await cargarContextoJ();
  if (modoPlantillaJ === "playoff") await cargarCrucesPlayoffJ();
  else await cargarPartidosJ();
  construirNavPlantillaJ();
  renderVistaActualJ();
});

async function cargarContextoJ() {
  try {
    const evResp = await ApiClient.get(`/eventos/${eventoIdJ}`);
    const ev = evResp.evento || evResp || {};
    const campeonatoId = Number.parseInt(ev.campeonato_id, 10);
    ctxJ.eventoNombre = ev.nombre || "Categoría";

    if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) return;

    const [campResp, ausResp] = await Promise.all([
      ApiClient.get(`/campeonatos/${campeonatoId}`),
      ApiClient.get(`/organizador-portal/campeonatos/${campeonatoId}/auspiciantes`).catch(() => ({ auspiciantes: [] })),
    ]);
    const camp = campResp.campeonato || campResp || {};

    ctxJ = {
      campeonatoNombre: camp.nombre || "Campeonato",
      organizador: camp.organizador || "No registrado",
      tipoFutbol: (camp.tipo_futbol || "").replaceAll("_", " ").toUpperCase(),
      eventoNombre: ctxJ.eventoNombre,
      logoUrl: normalizarLogoUrlJ(camp.logo_url || null),
      colorPrimario: camp.color_primario || "#1e3a5f",
      colorSecundario: camp.color_secundario || "#0b1f35",
      colorAcento: camp.color_acento || "#facc15",
      auspiciantes: (ausResp.auspiciantes || []).filter((a) => a.visible_portal),
    };

    actualizarCabeceraBaseJ();
    renderAuspiciantesJ(ctxJ.auspiciantes);

    const poster = document.getElementById("jornada-export");
    if (poster) {
      poster.style.setProperty("--t-primario", ctxJ.colorPrimario);
      poster.style.setProperty("--t-secundario", ctxJ.colorSecundario);
      poster.style.setProperty("--t-acento", ctxJ.colorAcento);
    }
  } catch (e) {
    console.warn("No se pudo cargar contexto de jornada plantilla:", e);
  }
}

async function cargarPartidosJ() {
  try {
    const resp = await ApiClient.get(`/partidos/evento/${eventoIdJ}`);
    partidosJ = resp.partidos || resp || [];
    const mapaJornadas = new Map();
    partidosJ.forEach((p) => {
      const j = Number(p.jornada);
      if (!j) return;
      if (!mapaJornadas.has(j)) mapaJornadas.set(j, []);
      mapaJornadas.get(j).push(p);
    });
    jornadasDisponibles = Array.from(mapaJornadas.keys()).sort((a, b) => a - b);

    if (!jornadaActualJ || !jornadasDisponibles.includes(jornadaActualJ)) {
      const conProgramado = jornadasDisponibles.find((j) =>
        (mapaJornadas.get(j) || []).some((p) => p.estado === "programado")
      );
      jornadaActualJ = conProgramado || jornadasDisponibles[0] || 1;
    }
  } catch (e) {
    console.warn("No se pudieron cargar partidos:", e);
    partidosJ = [];
    jornadasDisponibles = [];
  }
}

async function cargarCrucesPlayoffJ() {
  try {
    const resp = await ApiClient.get(`/eliminatorias/evento/${eventoIdJ}`);
    crucesPlayoffJ = Array.isArray(resp?.partidos) ? resp.partidos : [];
    const rondasMap = new Map();

    crucesPlayoffJ.forEach((cruce) => {
      const ronda = String(cruce?.ronda || "").toLowerCase();
      if (!ronda) return;
      if (!rondasMap.has(ronda)) rondasMap.set(ronda, []);
      rondasMap.get(ronda).push(cruce);
    });

    const extras = Array.from(rondasMap.keys()).filter((r) => !RONDAS_ORDEN_J.includes(r));
    rondasDisponiblesJ = [
      ...RONDAS_ORDEN_J.filter((r) => rondasMap.has(r)),
      ...extras.sort(),
    ];

    if (!rondaActualJ || !rondasDisponiblesJ.includes(rondaActualJ)) {
      const preferida =
        rondasDisponiblesJ.find((ronda) => (rondasMap.get(ronda) || []).some((cruce) => tieneActividadPlayoffJ(cruce))) ||
        rondasDisponiblesJ[0] ||
        null;
      rondaActualJ = preferida;
    }
  } catch (e) {
    console.warn("No se pudieron cargar cruces de playoff:", e);
    crucesPlayoffJ = [];
    rondasDisponiblesJ = [];
  }
}

function construirNavPlantillaJ() {
  const nav = document.getElementById("jornadas-nav");
  if (!nav) return;

  const items =
    modoPlantillaJ === "playoff"
      ? rondasDisponiblesJ.map((ronda) => ({
          value: ronda,
          label: formatearRondaJ(ronda),
          active: ronda === rondaActualJ,
        }))
      : jornadasDisponibles.map((jornada) => ({
          value: String(jornada),
          label: `J${jornada}`,
          active: jornada === jornadaActualJ,
        }));

  if (items.length <= 1) {
    nav.style.display = "none";
    nav.innerHTML = "";
    return;
  }

  nav.style.display = "flex";
  nav.innerHTML = items
    .map(
      (item) => `
        <button
          type="button"
          class="btn-poster-tema ${item.active ? "active" : ""}"
          data-value="${escJ(item.value)}"
        >${escJ(item.label)}</button>
      `
    )
    .join("");

  nav.querySelectorAll(".btn-poster-tema").forEach((btn) => {
    btn.addEventListener("click", () => seleccionarVistaPlantillaJ(btn.dataset.value || ""));
  });
}

function seleccionarVistaPlantillaJ(value) {
  if (modoPlantillaJ === "playoff") {
    rondaActualJ = String(value || "").toLowerCase();
  } else {
    jornadaActualJ = Number.parseInt(value || "", 10) || 1;
  }
  persistirContextoPlantillaJ();
  construirNavPlantillaJ();
  renderVistaActualJ();
}

function persistirContextoPlantillaJ() {
  window.RouteContext?.save?.("jornadasplantilla.html", {
    evento: eventoIdJ,
    modo: modoPlantillaJ,
    jornada: modoPlantillaJ === "playoff" ? null : jornadaActualJ,
    ronda: modoPlantillaJ === "playoff" ? rondaActualJ : null,
  });
}

function renderVistaActualJ() {
  if (modoPlantillaJ === "playoff") renderPlayoffActualJ();
  else renderJornadaActualRegularJ();
}

function renderJornadaActualRegularJ() {
  const zona = document.getElementById("jornada-partidos");
  if (!zona) return;

  const partidos = partidosJ.filter((p) => Number(p.jornada) === jornadaActualJ);
  const titulo = `${(ctxJ.campeonatoNombre || "TORNEO").toUpperCase()} • JORNADA ${jornadaActualJ || "-"}`;
  const rangoFecha = construirRangoFechaJ(partidos);
  const detalle = [ctxJ.tipoFutbol, ctxJ.eventoNombre ? `CATEGORÍA: ${ctxJ.eventoNombre.toUpperCase()}` : "", rangoFecha]
    .filter(Boolean)
    .join(" • ");

  actualizarCabeceraVistaJ({
    pageTitle: "Plantilla de Jornada",
    posterTitle: titulo,
    detail: detalle || "—",
  });

  if (!partidos.length) {
    zona.innerHTML = "<p class='empty-state'>No hay partidos en esta jornada.</p>";
    return;
  }

  zona.innerHTML = partidos.map(renderPartidoJornadaJ).join("");
}

function renderPlayoffActualJ() {
  const zona = document.getElementById("jornada-partidos");
  if (!zona) return;

  const cruces = crucesPlayoffJ.filter((cruce) => String(cruce?.ronda || "").toLowerCase() === String(rondaActualJ || ""));
  const titulo = `${(ctxJ.campeonatoNombre || "TORNEO").toUpperCase()} • ${formatearRondaJ(rondaActualJ).toUpperCase()}`;
  const rangoFecha = construirRangoFechaJ(cruces);
  const detalle = [
    ctxJ.tipoFutbol,
    ctxJ.eventoNombre ? `CATEGORÍA: ${ctxJ.eventoNombre.toUpperCase()}` : "",
    cruces.length ? `${cruces.length} partido(s)` : "",
    rangoFecha,
  ]
    .filter(Boolean)
    .join(" • ");

  actualizarCabeceraVistaJ({
    pageTitle: "Plantilla de Playoff",
    posterTitle: titulo,
    detail: detalle || "—",
  });

  if (!cruces.length) {
    zona.innerHTML = "<p class='empty-state'>No hay partidos de playoff en esta ronda.</p>";
    return;
  }

  zona.innerHTML = cruces.map(renderCrucePlayoffJ).join("");
}

function actualizarCabeceraBaseJ() {
  const orgEl = document.getElementById("jornada-organizador");
  const logoEl = document.getElementById("jornada-org-logo");

  if (orgEl) orgEl.textContent = `ORGANIZA: ${ctxJ.organizador}`;
  if (logoEl && ctxJ.logoUrl) {
    logoEl.src = ctxJ.logoUrl;
    logoEl.style.display = "block";
  }
}

function actualizarCabeceraVistaJ({ pageTitle, posterTitle, detail }) {
  const pageTitleEl = document.getElementById("jornada-page-title");
  const tituloEl = document.getElementById("jornada-titulo");
  const detalleEl = document.getElementById("jornada-detalle");

  if (pageTitleEl) pageTitleEl.textContent = pageTitle || "Plantilla";
  document.title = pageTitle ? `${pageTitle} | LT&C` : "Plantilla | LT&C";
  actualizarCabeceraBaseJ();
  if (tituloEl) tituloEl.textContent = posterTitle || "PLANTILLA";
  if (detalleEl) detalleEl.textContent = detail || "—";
}

function renderPartidoJornadaJ(p) {
  const local = escJ(p.equipo_local_nombre || p.equipo_local || "?");
  const visita = escJ(p.equipo_visitante_nombre || p.equipo_visitante || "?");
  const logoLocal = normalizarLogoUrlJ(p.equipo_local_logo_url);
  const logoVisita = normalizarLogoUrlJ(p.equipo_visitante_logo_url);
  const estado = p.estado || "pendiente";
  const finalizado = ["finalizado", "no_presentaron_ambos"].includes(estado);
  const gL = p.goles_local != null ? p.goles_local : finalizado ? "?" : "-";
  const gV = p.goles_visitante != null ? p.goles_visitante : finalizado ? "?" : "-";

  const hora = p.hora_partido ? String(p.hora_partido).slice(0, 5) : "";
  const cancha = p.cancha || "";
  const fechaStr = formatearFechaCortaJ(p.fecha_partido);
  const estadoBadge = formatearEstadoJ(estado);
  const metaParts = [estadoBadge, fechaStr, hora ? `Hora ${hora}` : "", cancha].filter(Boolean);

  return renderFilaPosterJ({
    badge: `J${Number.parseInt(p.jornada, 10) || "-"}`,
    meta: metaParts.join(" • "),
    local,
    visita,
    logoLocal,
    logoVisita,
    golesLocal: gL,
    golesVisitante: gV,
  });
}

function renderCrucePlayoffJ(cruce) {
  const local = escJ(cruce.equipo_local_nombre || "Por definir");
  const visita = escJ(cruce.equipo_visitante_nombre || "Por definir");
  const logoLocal = normalizarLogoUrlJ(cruce.equipo_local_logo || cruce.equipo_local_logo_url);
  const logoVisita = normalizarLogoUrlJ(cruce.equipo_visitante_logo || cruce.equipo_visitante_logo_url);
  const estado = cruce.estado || "pendiente";
  const finalizado = ["finalizado", "no_presentaron_ambos"].includes(estado);
  const gL = cruce.resultado_local != null ? cruce.resultado_local : finalizado ? "?" : "-";
  const gV = cruce.resultado_visitante != null ? cruce.resultado_visitante : finalizado ? "?" : "-";
  const hora = cruce.hora_partido ? String(cruce.hora_partido).slice(0, 5) : "";
  const cancha = cruce.cancha || "";
  const fechaStr = formatearFechaCortaJ(cruce.fecha_partido);
  const metaParts = [
    formatearEstadoJ(estado),
    fechaStr,
    hora ? `Hora ${hora}` : "",
    cancha,
  ].filter(Boolean);

  return renderFilaPosterJ({
    badge: formatearEtiquetaPartidoEliminatoriaJ(cruce.ronda, cruce.partido_numero),
    meta: metaParts.join(" • "),
    local,
    visita,
    logoLocal,
    logoVisita,
    golesLocal: gL,
    golesVisitante: gV,
  });
}

function renderFilaPosterJ({ badge, meta, local, visita, logoLocal, logoVisita, golesLocal, golesVisitante }) {
  const logoLocalHtml = logoLocal
    ? `<img src="${escJ(logoLocal)}" alt="${local}" class="poster-jornada-logo" crossorigin="anonymous" referrerpolicy="no-referrer">`
    : `<span class="poster-jornada-logo-fallback">${local.charAt(0).toUpperCase()}</span>`;
  const logoVisitaHtml = logoVisita
    ? `<img src="${escJ(logoVisita)}" alt="${visita}" class="poster-jornada-logo" crossorigin="anonymous" referrerpolicy="no-referrer">`
    : `<span class="poster-jornada-logo-fallback">${visita.charAt(0).toUpperCase()}</span>`;

  return `
  <div class="poster-jornada-partido">
    <div class="poster-partido-badge">${escapeHtmlJ(badge)}</div>
    <div class="poster-partido-meta">${escapeHtmlJ(meta || "Por programar")}</div>
    <div class="poster-partido-row">
      <div class="poster-partido-equipo poster-partido-local">
        ${logoLocalHtml}
        <span class="poster-partido-nombre">${local}</span>
      </div>
      <div class="poster-partido-score">
        <span class="poster-score-num">${escapeHtmlJ(golesLocal)}</span>
        <span class="poster-score-sep">–</span>
        <span class="poster-score-num">${escapeHtmlJ(golesVisitante)}</span>
      </div>
      <div class="poster-partido-equipo poster-partido-visita">
        <span class="poster-partido-nombre">${visita}</span>
        ${logoVisitaHtml}
      </div>
    </div>
  </div>`;
}

function construirRangoFechaJ(lista = []) {
  const fechas = lista
    .map((p) => p?.fecha_partido)
    .filter(Boolean)
    .map((f) => parseFechaLocalJ(f))
    .filter(Boolean)
    .sort((a, b) => a - b);

  if (!fechas.length) return "";

  const formato = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  let rango = fechas[0].toLocaleDateString("es-EC", formato);
  const ultima = fechas[fechas.length - 1];
  if (ultima.toDateString() !== fechas[0].toDateString()) {
    rango += ` — ${ultima.toLocaleDateString("es-EC", formato)}`;
  }
  return rango;
}

function formatearFechaCortaJ(fecha) {
  const d = parseFechaLocalJ(fecha);
  if (!d) return "";
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function tieneActividadPlayoffJ(cruce) {
  return Boolean(
    cruce?.fecha_partido ||
      cruce?.hora_partido ||
      cruce?.cancha ||
      cruce?.ganador_id ||
      cruce?.ganador_nombre ||
      ["finalizado", "en_curso", "programado", "no_presentaron_ambos"].includes(String(cruce?.estado || "").toLowerCase())
  );
}

function formatearEstadoJ(estado) {
  return (
    {
      programado: "Programado",
      pendiente: "Pendiente",
      finalizado: "Finalizado",
      no_presentaron_ambos: "N/P",
      suspendido: "Suspendido",
      aplazado: "Aplazado",
      en_curso: "En curso",
    }[String(estado || "").toLowerCase()] || String(estado || "Pendiente")
  );
}

function formatearRondaJ(ronda) {
  const key = String(ronda || "").toLowerCase();
  if (key === "32vos") return "32vos de final";
  if (key === "16vos") return "16vos de final";
  if (key === "12vos") return "12vos de final";
  if (key === "8vos") return "Octavos";
  if (key === "4tos") return "Cuartos";
  if (key === "semifinal") return "Semifinal";
  if (key === "final") return "Final";
  if (key === "tercer_puesto") return "Tercer y cuarto";
  return key || "-";
}

function formatearEtiquetaPartidoEliminatoriaJ(ronda, numero) {
  const n = Number.parseInt(numero, 10);
  const key = String(ronda || "").toLowerCase();
  if (!Number.isFinite(n) || n <= 0) return formatearRondaJ(ronda);
  if (key === "8vos") return `8VO P${n}`;
  if (key === "4tos") return `4TO G${n}`;
  if (key === "semifinal") return `SEM G${n}`;
  if (key === "final") return n === 1 ? "FINAL" : `FINAL ${n}`;
  if (key === "tercer_puesto") return "TERCER Y CUARTO";
  if (key === "12vos") return `12VO P${n}`;
  if (key === "16vos") return `16VO P${n}`;
  if (key === "32vos") return `32VO P${n}`;
  return `P${n}`;
}

function renderAuspiciantesJ(auspiciantes) {
  const wrap = document.getElementById("jornada-sponsors");
  const grid = document.getElementById("jornada-sponsors-grid");
  if (!wrap || !grid) return;
  const visibles = auspiciantes.filter((a) => a.logo_url);
  if (!visibles.length) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "block";
  grid.innerHTML = visibles
    .map(
      (a) =>
        `<img src="${escJ(normalizarLogoUrlJ(a.logo_url))}" alt="${escJ(a.nombre || "")}" class="sponsor-logo" crossorigin="anonymous" referrerpolicy="no-referrer">`
    )
    .join("");
}

function parseFechaLocalJ(valor) {
  if (!valor) return null;
  const s = String(valor).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

function normalizarLogoUrlJ(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${BACKEND_BASE_J}/${String(url).replace(/^\/+/, "")}`;
}

function escJ(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlJ(str) {
  return escJ(str);
}

async function exportarJornadaPNG() {
  const zona = document.getElementById("jornada-export");
  if (!zona || !window.html2canvas) {
    mostrarNotificacion("No se pudo preparar la exportación", "error");
    return;
  }
  try {
    const canvas = await html2canvas(zona, { scale: 2, useCORS: true, allowTaint: false });
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = construirNombreArchivoPlantillaJ("png");
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    mostrarNotificacion("No se pudo exportar la imagen", "error");
  }
}

async function exportarJornadaPDF() {
  const zona = document.getElementById("jornada-export");
  if (!zona || !window.html2canvas || !window.jspdf?.jsPDF) {
    mostrarNotificacion("No se pudo preparar el PDF", "error");
    return;
  }
  try {
    const canvas = await html2canvas(zona, { scale: 2, useCORS: true, allowTaint: false });
    const imgData = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    const pW = pdf.internal.pageSize.getWidth();
    const pH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / canvas.height;
    const imgW = pW - 20;
    const imgH = imgW / ratio;
    const yOff = Math.max(0, (pH - imgH) / 2);
    pdf.addImage(imgData, "PNG", 10, yOff, imgW, Math.min(imgH, pH - 20));
    pdf.save(construirNombreArchivoPlantillaJ("pdf"));
    mostrarNotificacion("PDF exportado", "success");
  } catch (e) {
    mostrarNotificacion("No se pudo exportar el PDF", "error");
  }
}

function construirNombreArchivoPlantillaJ(ext) {
  const base =
    modoPlantillaJ === "playoff"
      ? `playoff_${rondaActualJ || "ronda"}_${ctxJ.eventoNombre || "evento"}`
      : `jornada_${jornadaActualJ || 1}_${ctxJ.eventoNombre || "evento"}`;
  return `${base}.${ext}`.toLowerCase().replace(/[^a-z0-9_.-]/g, "_");
}

function aplicarTemaJornada(tema) {
  const poster = document.getElementById("jornada-export");
  if (!poster) return;
  poster.classList.remove("tema-oscuro", "tema-clasico", "tema-torneo");
  poster.classList.add(`tema-${tema}`);
  document.querySelectorAll(".btn-poster-tema").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tema === tema);
  });
}

function actualizarTituloPantallaJ() {
  const pageTitleEl = document.getElementById("jornada-page-title");
  if (pageTitleEl) {
    pageTitleEl.textContent = modoPlantillaJ === "playoff" ? "Plantilla de Playoff" : "Plantilla de Jornada";
  }
}

function volverPartidos() {
  window.RouteContext?.navigate?.("partidos.html", {}) || (window.location.href = "partidos.html");
}

function mostrarNotificacion(msg, tipo) {
  if (window.mostrarToast) {
    window.mostrarToast(msg, tipo);
    return;
  }
  console.log(`[${tipo}] ${msg}`);
}

window.aplicarTemaJornada = aplicarTemaJornada;
window.exportarJornadaPNG = exportarJornadaPNG;
window.exportarJornadaPDF = exportarJornadaPDF;
window.volverPartidos = volverPartidos;
