const BACKEND_BASE_J = (window.resolveBackendBaseUrl
  ? window.resolveBackendBaseUrl()
  : `${window.location.origin}`).replace(/\/$/, "");

let eventoIdJ = null;
let jornadaActualJ = null;
let jornadasDisponibles = [];
let partidosJ = [];

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
    window.RouteContext?.read?.("jornadasplantilla.html", ["evento", "jornada"]) || {};
  eventoIdJ = Number.parseInt(routeCtx.evento || "", 10);
  jornadaActualJ = routeCtx.jornada ? Number.parseInt(routeCtx.jornada, 10) : null;

  if (!Number.isFinite(eventoIdJ) || eventoIdJ <= 0) {
    document.getElementById("jornada-partidos").innerHTML =
      "<p class='empty-state'>Evento no válido para la plantilla.</p>";
    return;
  }

  await cargarContextoJ();
  await cargarPartidosJ();
  construirNavJornadas();
  renderJornadaActual();
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

    actualizarCabeceraJ();
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
    // Detectar jornadas disponibles (con algún partido programado)
    const mapaJornadas = new Map();
    partidosJ.forEach((p) => {
      const j = Number(p.jornada);
      if (!j) return;
      if (!mapaJornadas.has(j)) mapaJornadas.set(j, []);
      mapaJornadas.get(j).push(p);
    });
    jornadasDisponibles = Array.from(mapaJornadas.keys()).sort((a, b) => a - b);

    // Auto-selección: primera con partidos programados
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

function construirNavJornadas() {
  const nav = document.getElementById("jornadas-nav");
  if (!nav || jornadasDisponibles.length <= 1) {
    if (nav) nav.style.display = "none";
    return;
  }
  nav.style.display = "flex";
  nav.innerHTML = jornadasDisponibles
    .map(
      (j) =>
        `<button type="button" class="btn-poster-tema ${j === jornadaActualJ ? "active" : ""}"
          onclick="seleccionarJornadaJ(${j})">J${j}</button>`
    )
    .join("");
}

function seleccionarJornadaJ(j) {
  jornadaActualJ = j;
  document.querySelectorAll("#jornadas-nav .btn-poster-tema").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.textContent.replace("J", "")) === j);
  });
  renderJornadaActual();
}

function renderJornadaActual() {
  const zona = document.getElementById("jornada-partidos");
  if (!zona) return;

  const partidos = partidosJ.filter((p) => Number(p.jornada) === jornadaActualJ);

  // Actualizar título con número de jornada
  const tituloEl = document.getElementById("jornada-titulo");
  if (tituloEl) {
    tituloEl.textContent = `${(ctxJ.campeonatoNombre || "TORNEO").toUpperCase()} • JORNADA ${jornadaActualJ}`;
  }

  if (!partidos.length) {
    zona.innerHTML = "<p class='empty-state'>No hay partidos en esta jornada.</p>";
    return;
  }

  // Calcular fecha/rango de la jornada
  const fechas = partidos
    .map((p) => p.fecha_partido)
    .filter(Boolean)
    .map((f) => parseFechaLocalJ(f))
    .filter(Boolean)
    .sort((a, b) => a - b);
  let rangoFecha = "";
  if (fechas.length) {
    const ops = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    rangoFecha = fechas[0].toLocaleDateString("es-EC", ops);
    if (fechas.length > 1) {
      const ultima = fechas[fechas.length - 1];
      if (ultima.toDateString() !== fechas[0].toDateString()) {
        rangoFecha += ` — ${ultima.toLocaleDateString("es-EC", ops)}`;
      }
    }
  }
  const detalleEl = document.getElementById("jornada-detalle");
  if (detalleEl && rangoFecha) detalleEl.textContent = rangoFecha;

  zona.innerHTML = partidos.map(renderPartidoJornadaJ).join("");
}

function renderPartidoJornadaJ(p) {
  const local = escJ(p.equipo_local_nombre || p.equipo_local || "?");
  const visita = escJ(p.equipo_visitante_nombre || p.equipo_visitante || "?");
  const logoLocal = normalizarLogoUrlJ(p.equipo_local_logo_url);
  const logoVisita = normalizarLogoUrlJ(p.equipo_visitante_logo_url);
  const estado = p.estado || "pendiente";
  const finalizado = ["finalizado", "no_presentaron_ambos"].includes(estado);
  const gL = p.goles_local != null ? p.goles_local : (finalizado ? "?" : "-");
  const gV = p.goles_visitante != null ? p.goles_visitante : (finalizado ? "?" : "-");

  const hora = p.hora_partido ? String(p.hora_partido).slice(0, 5) : "";
  const cancha = p.cancha || "";
  let fechaStr = "";
  if (p.fecha_partido) {
    const d = parseFechaLocalJ(p.fecha_partido);
    if (d) {
      fechaStr = d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
    }
  }

  const estadoBadge = {
    programado: "Programado",
    pendiente: "Pendiente",
    finalizado: "Finalizado",
    no_presentaron_ambos: "N/P",
    suspendido: "Suspendido",
    aplazado: "Aplazado",
    en_curso: "En curso",
  }[estado] || estado;

  const badgeClase = {
    finalizado: "badge-finalizado",
    no_presentaron_ambos: "badge-finalizado",
    programado: "badge-programado",
    en_curso: "badge-en-curso",
    suspendido: "badge-suspendido",
    aplazado: "badge-suspendido",
  }[estado] || "";

  const logoLocalHtml = logoLocal
    ? `<img src="${escJ(logoLocal)}" alt="${local}" class="poster-jornada-logo" crossorigin="anonymous" referrerpolicy="no-referrer">`
    : `<span class="poster-jornada-logo-fallback">${local.charAt(0).toUpperCase()}</span>`;
  const logoVisitaHtml = logoVisita
    ? `<img src="${escJ(logoVisita)}" alt="${visita}" class="poster-jornada-logo" crossorigin="anonymous" referrerpolicy="no-referrer">`
    : `<span class="poster-jornada-logo-fallback">${visita.charAt(0).toUpperCase()}</span>`;

  const metaParts = [fechaStr, hora ? `Hora ${hora}` : "", cancha].filter(Boolean);

  return `
  <div class="poster-jornada-partido">
    <div class="poster-partido-badge ${badgeClase}">${estadoBadge}</div>
    <div class="poster-partido-meta">${metaParts.join(" • ")}</div>
    <div class="poster-partido-row">
      <div class="poster-partido-equipo poster-partido-local">
        ${logoLocalHtml}
        <span class="poster-partido-nombre">${local}</span>
      </div>
      <div class="poster-partido-score">
        <span class="poster-score-num">${gL}</span>
        <span class="poster-score-sep">–</span>
        <span class="poster-score-num">${gV}</span>
      </div>
      <div class="poster-partido-equipo poster-partido-visita">
        <span class="poster-partido-nombre">${visita}</span>
        ${logoVisitaHtml}
      </div>
    </div>
  </div>`;
}

function actualizarCabeceraJ() {
  const orgEl = document.getElementById("jornada-organizador");
  const detalleEl = document.getElementById("jornada-detalle");
  const logoEl = document.getElementById("jornada-org-logo");

  if (orgEl) orgEl.textContent = `ORGANIZA: ${ctxJ.organizador}`;
  if (detalleEl) {
    const partes = [ctxJ.tipoFutbol, ctxJ.eventoNombre ? `CATEGORÍA: ${ctxJ.eventoNombre.toUpperCase()}` : ""].filter(Boolean);
    detalleEl.textContent = partes.join(" • ") || "—";
  }
  if (logoEl && ctxJ.logoUrl) {
    logoEl.src = ctxJ.logoUrl;
    logoEl.style.display = "block";
  }
}

function renderAuspiciantesJ(auspiciantes) {
  const wrap = document.getElementById("jornada-sponsors");
  const grid = document.getElementById("jornada-sponsors-grid");
  if (!wrap || !grid) return;
  const visibles = auspiciantes.filter((a) => a.logo_url);
  if (!visibles.length) { wrap.style.display = "none"; return; }
  wrap.style.display = "block";
  grid.innerHTML = visibles
    .map((a) => `<img src="${escJ(normalizarLogoUrlJ(a.logo_url))}" alt="${escJ(a.nombre || "")}" class="sponsor-logo" crossorigin="anonymous" referrerpolicy="no-referrer">`)
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
  return `${BACKEND_BASE_J}/${url.replace(/^\/+/, "")}`;
}

function escJ(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Exportar PNG ──
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
    a.download = `jornada_${jornadaActualJ || 1}_${ctxJ.eventoNombre || "evento"}.png`
      .toLowerCase().replace(/[^a-z0-9_.-]/g, "_");
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    mostrarNotificacion("No se pudo exportar la imagen", "error");
  }
}

// ── Exportar PDF ──
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
    const nombre = `jornada_${jornadaActualJ || 1}_${ctxJ.eventoNombre || "evento"}.pdf`
      .toLowerCase().replace(/[^a-z0-9_.-]/g, "_");
    pdf.save(nombre);
    mostrarNotificacion("PDF exportado", "success");
  } catch (e) {
    mostrarNotificacion("No se pudo exportar el PDF", "error");
  }
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

function volverPartidos() {
  window.RouteContext?.navigate?.("partidos.html", {}) || (window.location.href = "partidos.html");
}

function mostrarNotificacion(msg, tipo) {
  if (window.mostrarToast) { window.mostrarToast(msg, tipo); return; }
  console.log(`[${tipo}] ${msg}`);
}

window.seleccionarJornadaJ = seleccionarJornadaJ;
window.aplicarTemaJornada = aplicarTemaJornada;
window.exportarJornadaPNG = exportarJornadaPNG;
window.exportarJornadaPDF = exportarJornadaPDF;
window.volverPartidos = volverPartidos;
