const BACKEND_BASE = "http://localhost:5000";

let eventoId = null;
let grupoId = null;
let jornada = null;
let fecha = null;
let vistaFixture = "todos";
let partidos = [];

let contexto = {
  campeonatoNombre: "",
  organizador: "",
  tipoFutbol: "",
  fechaInicio: "",
  fechaFin: "",
  eventoNombre: "",
  logoUrl: null,
};

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("fixtureplantilla.html")) return;

  const params = new URLSearchParams(window.location.search);
  eventoId = Number.parseInt(params.get("evento") || "", 10);
  grupoId = Number.parseInt(params.get("grupo") || "", 10);
  jornada = params.get("jornada");
  fecha = params.get("fecha");
  vistaFixture = params.get("vista") || "todos";

  if (!Number.isFinite(eventoId) || eventoId <= 0) {
    mostrarNotificacion("Evento no valido para plantilla.", "warning");
    renderVacio("Evento no valido.");
    return;
  }

  await cargarContexto();
  await cargarPartidos();
  actualizarTabsVistaFixture();
  actualizarCabecera();
  renderFixture();
});

async function cargarContexto() {
  try {
    const evResp = await ApiClient.get(`/eventos/${eventoId}`);
    const ev = evResp.evento || evResp || {};
    const campeonatoId = Number.parseInt(ev.campeonato_id, 10);

    contexto.eventoNombre = ev.nombre || "Evento";

    if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) return;

    const campResp = await ApiClient.get(`/campeonatos/${campeonatoId}`);
    const camp = campResp.campeonato || campResp || {};

    contexto = {
      campeonatoNombre: camp.nombre || "Campeonato",
      organizador: camp.organizador || "No registrado",
      tipoFutbol: (camp.tipo_futbol || "").replaceAll("_", " ").toUpperCase(),
      fechaInicio: formatearFecha(camp.fecha_inicio),
      fechaFin: formatearFecha(camp.fecha_fin),
      eventoNombre: contexto.eventoNombre,
      logoUrl: normalizarLogoUrl(camp.logo_url || null),
    };
  } catch (error) {
    console.warn("No se pudo cargar contexto de plantilla:", error);
  }
}

async function cargarPartidos() {
  const endpoint = Number.isFinite(grupoId) && grupoId > 0
    ? `/partidos/grupo/${grupoId}`
    : `/partidos/evento/${eventoId}`;

  const resp = await ApiClient.get(endpoint);
  partidos = resp.partidos || resp || [];
}

function getPartidosFiltrados() {
  let data = [...partidos];

  if (jornada) {
    data = data.filter((p) => String(p.jornada || "") === String(jornada));
  }
  if (fecha) {
    data = data.filter((p) => normalizarFechaISO(p.fecha_partido) === String(fecha));
  }

  return data;
}

function actualizarCabecera() {
  const organizadorEl = document.getElementById("fixture-organizador");
  const tituloEl = document.getElementById("fixture-titulo");
  const detalleEl = document.getElementById("fixture-detalle");
  const filtrosEl = document.getElementById("fixture-filtros");
  const logoEl = document.getElementById("fixture-org-logo");

  if (!organizadorEl || !tituloEl || !detalleEl || !filtrosEl || !logoEl) return;

  organizadorEl.textContent = `ORGANIZA: ${contexto.organizador || "No registrado"}`;
  tituloEl.textContent = `${(contexto.campeonatoNombre || "FIXTURE").toUpperCase()} - FIXTURE`;

  const detalle = [
    contexto.tipoFutbol || "",
    contexto.fechaInicio || contexto.fechaFin
      ? `${contexto.fechaInicio}${contexto.fechaFin ? " - " + contexto.fechaFin : ""}`
      : "",
    contexto.eventoNombre ? `CATEGORIA: ${String(contexto.eventoNombre).toUpperCase()}` : "",
  ]
    .filter(Boolean)
    .join(" • ");

  detalleEl.textContent = detalle || "-";

  const filtroGrupo = Number.isFinite(grupoId) && grupoId > 0 ? `GRUPO: ${grupoId}` : "GRUPO: TODOS";
  const filtroJornada = jornada ? `JORNADA: ${jornada}` : "JORNADA: TODAS";
  const filtroFecha = fecha ? `FECHA: ${fecha}` : "FECHA: TODAS";
  const vista =
    vistaFixture === "grupo"
      ? "VISTA: POR GRUPO"
      : vistaFixture === "jornada"
        ? "VISTA: POR JORNADA"
        : "VISTA: TODOS";
  filtrosEl.textContent = `${filtroGrupo} • ${filtroJornada} • ${filtroFecha} • ${vista}`;

  if (contexto.logoUrl) {
    logoEl.src = contexto.logoUrl;
    logoEl.style.display = "block";
  } else {
    logoEl.removeAttribute("src");
    logoEl.style.display = "none";
  }
}

function cambiarVistaFixture(vista) {
  if (!["todos", "grupo", "jornada"].includes(vista)) return;
  vistaFixture = vista;
  actualizarTabsVistaFixture();
  actualizarCabecera();
  renderFixture();
}

function actualizarTabsVistaFixture() {
  document
    .querySelectorAll("#fixture-view-tabs .fixture-view-btn")
    .forEach((btn) => btn.classList.toggle("active", btn.getAttribute("data-fixture-view") === vistaFixture));
}

function renderFixture() {
  const cont = document.getElementById("fixture-grupos");
  if (!cont) return;

  const data = getPartidosFiltrados();
  if (!data.length) {
    renderVacio("No hay partidos para la plantilla con este filtro.");
    return;
  }

  let bloques = [];
  let html = "";

  if (vistaFixture === "grupo") {
    bloques = agruparPorGrupo(data);
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
    bloques = agruparPorJornada(data);
    html = bloques
      .map(
        (b) => `
        <div class="poster-col fixture-poster-col">
          <div class="col-header">JORNADA ${b.jornada || "-"}</div>
          <div class="col-body">
            ${b.items.map((p) => renderLineaPartido(p, true)).join("")}
          </div>
        </div>
      `
      )
      .join("");
  } else {
    bloques = agruparPorJornadaGrupo(data);
    html = bloques
      .map(
        (b) => `
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
          </div>
        </div>
      `
      )
      .join("");
  }

  aplicarLayoutPorCantidadColumnas(bloques.length);
  cont.innerHTML = html;
}

function renderLineaPartido(p, mostrarGrupo = false) {
  const fechaTxt = formatearFechaPartido(p.fecha_partido);
  const hora = (p.hora_partido || "--:--").toString().substring(0, 5);
  const cancha = p.cancha || "Cancha por definir";
  const grupoTxt = p.letra_grupo ? `Grupo ${p.letra_grupo}` : "Sin grupo";

  const base = `${fechaTxt} • ${hora} • ${cancha}`;
  const meta = mostrarGrupo ? `${grupoTxt} • ${base}` : base;

  return `
    <div class="fixture-match-row">
      <span>${p.equipo_local_nombre}</span>
      <strong>vs</strong>
      <span>${p.equipo_visitante_nombre}</span>
    </div>
    <div class="fixture-meta-row">${meta}</div>
  `;
}

function agruparPorJornadaGrupo(data) {
  const map = new Map();
  for (const p of data) {
    const j = Number(p.jornada) || 0;
    const g = p.letra_grupo || "-";
    if (!map.has(j)) map.set(j, new Map());
    if (!map.get(j).has(g)) map.get(j).set(g, []);
    map.get(j).get(g).push(p);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([jornadaNum, gruposMap]) => ({
      jornada: jornadaNum,
      grupos: Array.from(gruposMap.entries())
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        .map(([grupo, items]) => ({ grupo, items })),
    }));
}

function agruparPorGrupo(data) {
  const map = new Map();
  for (const p of data) {
    const g = p.letra_grupo || "-";
    const j = Number(p.jornada) || 0;
    if (!map.has(g)) map.set(g, new Map());
    if (!map.get(g).has(j)) map.get(g).set(j, []);
    map.get(g).get(j).push(p);
  }
  return Array.from(map.entries())
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([grupo, jornadasMap]) => ({
      grupo,
      jornadas: Array.from(jornadasMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([jornadaNum, items]) => ({ jornada: jornadaNum, items })),
    }));
}

function agruparPorJornada(data) {
  const map = new Map();
  for (const p of data) {
    const j = Number(p.jornada) || 0;
    if (!map.has(j)) map.set(j, []);
    map.get(j).push(p);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([jornadaNum, items]) => ({ jornada: jornadaNum, items }));
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

function renderVacio(texto) {
  const cont = document.getElementById("fixture-grupos");
  if (!cont) return;
  cont.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-futbol"></i>
      <p>${texto}</p>
    </div>
  `;
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
  a.download = `fixture_evento_${eventoId || "sin_id"}.png`;
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
  pdf.save(`fixture_evento_${eventoId || "sin_id"}.pdf`);
}

function volverPartidos() {
  window.location.href = "partidos.html";
}

function normalizarLogoUrl(logoUrl) {
  if (!logoUrl) return null;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  if (logoUrl.startsWith("/")) return `${BACKEND_BASE}${logoUrl}`;
  return `${BACKEND_BASE}/${logoUrl}`;
}

function normalizarFechaISO(valor) {
  if (!valor) return "";
  const str = String(valor);
  if (str.includes("T")) return str.split("T")[0];
  return str.slice(0, 10);
}

function formatearFechaPartido(valor) {
  const fechaTxt = normalizarFechaISO(valor);
  return fechaTxt || "Por definir";
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

window.cambiarVistaFixture = cambiarVistaFixture;
window.exportarFixturePNG = exportarFixturePNG;
window.exportarFixturePDF = exportarFixturePDF;
window.volverPartidos = volverPartidos;
