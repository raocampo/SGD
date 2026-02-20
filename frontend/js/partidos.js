// frontend/js/partidos.js

const BACKEND_BASE = "http://localhost:5000";

let eventoSeleccionado = null;
let grupoSeleccionado = null;
let jornadaSeleccionada = null;
let fechaSeleccionada = null;
let vistaFixture = "todos";
let partidosActuales = [];
let eventosCache = [];
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

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function obtenerNumeroPartidoVisible(partido, fallback = null) {
  const n = Number.parseInt(partido?.numero_campeonato, 10);
  if (Number.isFinite(n) && n > 0) return n;
  if (Number.isFinite(Number(fallback)) && Number(fallback) > 0) return Number(fallback);
  return null;
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
  aplicarRenderPartidos();
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("partidos.html")) return;
  actualizarBotonesVistaPartidos();

  const selectJornada = document.getElementById("select-jornada");
  if (selectJornada) {
    selectJornada.addEventListener("change", () => {
      jornadaSeleccionada = selectJornada.value || null;
      aplicarRenderPartidos();
      actualizarCabeceraFixture();
    });
  }

  const inputFecha = document.getElementById("input-fecha");
  if (inputFecha) {
    inputFecha.addEventListener("change", () => {
      fechaSeleccionada = inputFecha.value || null;
      aplicarRenderPartidos();
      actualizarCabeceraFixture();
    });
  }

  await cargarEventos();
  actualizarCabeceraFixture();
  actualizarTabsVistaFixture();
  actualizarPestanasPartidos("tab-filtrar");
});

async function cargarEventos() {
  try {
    const resp = await ApiClient.get("/eventos");
    const lista = resp.eventos || resp || [];
    eventosCache = lista;

    const select = document.getElementById("select-evento");
    select.innerHTML = '<option value="">- Selecciona una categoría -</option>';

    lista.forEach((e) => {
      select.innerHTML += `<option value="${e.id}">${e.nombre} (${e.categoria || "Sin categoria"})</option>`;
    });

    select.onchange = async () => {
      eventoSeleccionado = select.value ? Number(select.value) : null;
      grupoSeleccionado = null;
      jornadaSeleccionada = null;
      fechaSeleccionada = null;
      const inputFecha = document.getElementById("input-fecha");
      if (inputFecha) inputFecha.value = "";
      limpiarJornadas();
      await cargarGruposPorEvento(eventoSeleccionado);
      await cargarContextoFixture(eventoSeleccionado);
      limpiarPartidosUI();
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

  if (!eventoId) return;

  try {
    const resp = await ApiClient.get(`/grupos/evento/${eventoId}`);
    const grupos = resp.grupos || resp || [];

    grupos.forEach((g) => {
      const nombre = g.nombre_grupo || g.nombre || "Grupo";
      const letra = g.letra_grupo || g.letra || "";
      select.innerHTML += `<option value="${g.id}">${nombre} ${letra}</option>`;
    });

    select.onchange = () => {
      grupoSeleccionado = select.value ? Number(select.value) : null;
      cargarPartidos();
      actualizarCabeceraFixture();
    };
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

  if (!eventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría", "warning");
    limpiarPartidosUI();
    return;
  }

  try {
    const url = grupoSeleccionado
      ? `/partidos/grupo/${grupoSeleccionado}`
      : `/partidos/evento/${eventoSeleccionado}`;

    const data = await ApiClient.get(url);

    let partidos = [];
    if (Array.isArray(data)) partidos = data;
    else if (data.partidos) partidos = data.partidos;

    partidosActuales = partidos;
    poblarJornadasDesdePartidos(partidosActuales);
    aplicarRenderPartidos();
    actualizarCabeceraFixture();
  } catch (error) {
    mostrarNotificacion("Error cargando partidos", "error");
    console.error(error);
    limpiarPartidosUI();
  }
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
    cont.innerHTML = partidos.map((p) => renderPartidoCard(p)).join("");
  }

  renderFixtureTemplate(partidos);
}

function cambiarVistaFixture(vista) {
  if (!["todos", "grupo", "jornada"].includes(vista)) return;
  vistaFixture = vista;
  actualizarTabsVistaFixture();
  renderFixtureTemplate(getPartidosFiltrados());
}

function cambiarPestanaPartidos(tabId) {
  actualizarPestanasPartidos(tabId);
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

function actualizarTabsVistaFixture() {
  const tabs = document.querySelectorAll("#fixture-view-tabs .fixture-view-btn");
  tabs.forEach((btn) => {
    const key = btn.getAttribute("data-fixture-view");
    btn.classList.toggle("active", key === vistaFixture);
  });
}

function renderPartidoCard(p) {
  const numero = obtenerNumeroPartidoVisible(p);
  return `
    <div class="campeonato-card">
      <div class="campeonato-header">
        <h3>${escapeHtml(p.equipo_local_nombre || "Equipo local")} vs ${escapeHtml(p.equipo_visitante_nombre || "Equipo visitante")}</h3>
      </div>

      <div class="campeonato-info">
        <p><strong>N° Partido:</strong> ${escapeHtml(numero || "-")}</p>
        <p><strong>Grupo:</strong> ${escapeHtml(p.letra_grupo ? `Grupo ${p.letra_grupo}` : "-")}</p>
        <p><strong>Jornada:</strong> ${escapeHtml(p.jornada || "-")}</p>
        <p><strong>Fecha:</strong> ${escapeHtml(formatearFechaPartido(p.fecha_partido))}</p>
        <p><strong>Hora:</strong> ${escapeHtml((p.hora_partido || "--:--").toString().substring(0, 5))}</p>
        <p><strong>Cancha:</strong> ${escapeHtml(p.cancha || "Por definir")}</p>
      </div>

      <div class="campeonato-actions">
        <button class="btn btn-primary" onclick="abrirPlanillaPartido(${p.id})">
          <i class="fas fa-clipboard-list"></i> Planilla
        </button>
        <button class="btn btn-warning" onclick="editarPartido(${p.id})">
          <i class="fas fa-edit"></i> Editar
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
    .map((p, index) => {
      const numero = obtenerNumeroPartidoVisible(p, index + 1);
      const local = escapeHtml(p.equipo_local_nombre || "Local");
      const visita = escapeHtml(p.equipo_visitante_nombre || "Visitante");
      const grupo = escapeHtml(p.letra_grupo ? `Grupo ${p.letra_grupo}` : "-");
      const jornada = escapeHtml(p.jornada || "-");
      const fecha = escapeHtml(formatearFechaPartido(p.fecha_partido));
      const hora = escapeHtml((p.hora_partido || "--:--").toString().substring(0, 5));
      const cancha = escapeHtml(p.cancha || "Por definir");

      return `
        <tr>
          <td>${numero}</td>
          <td>${local} vs ${visita}</td>
          <td>${grupo}</td>
          <td>${jornada}</td>
          <td>${fecha}</td>
          <td>${hora}</td>
          <td>${cancha}</td>
          <td class="list-table-actions">
            <button class="btn btn-primary" onclick="abrirPlanillaPartido(${p.id})">
              <i class="fas fa-clipboard-list"></i> Planilla
            </button>
            <button class="btn btn-warning" onclick="editarPartido(${p.id})">
              <i class="fas fa-edit"></i> Editar
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
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
}

function abrirPlanillaPartido(partidoId) {
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
    bloques = agruparPartidosPorJornadaYGrupo(partidos);
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
  if (!confirm("Seguro que quieres eliminar este partido?")) return;

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

    const nuevaFecha = prompt("Fecha del partido (YYYY-MM-DD):", normalizarFechaISO(p.fecha_partido) || "");
    if (nuevaFecha === null) return;

    const horaActual = (p.hora_partido || "00:00:00").toString().substring(0, 5);
    const nuevaHora = prompt("Hora del partido (HH:MM) o vacio para NULL:", horaActual);
    if (nuevaHora === null) return;

    const nuevaCancha = prompt("Cancha (vacio para NULL):", p.cancha || "");
    if (nuevaCancha === null) return;

    const nuevaJornada = prompt("Jornada (numero):", String(p.jornada || 1));
    if (nuevaJornada === null) return;

    await ApiClient.put(`/partidos/${id}`, {
      fecha_partido: nuevaFecha || null,
      hora_partido: nuevaHora
        ? nuevaHora.length === 5
          ? `${nuevaHora}:00`
          : nuevaHora
        : null,
      cancha: nuevaCancha || null,
      jornada: nuevaJornada ? Number(nuevaJornada) : p.jornada,
    });

    mostrarNotificacion("Partido actualizado.", "success");
    cargarPartidos();
  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error al editar el partido.", "error");
  }
}

async function generarFixtureEvento() {
  if (!eventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría primero.", "warning");
    return;
  }

  const idaYVuelta = document.getElementById("chk-ida-vuelta")?.checked === true;
  const programacionManual =
    document.getElementById("chk-programacion-manual")?.checked === true;

  if (
    !confirm(
      "Se generara el fixture para todos los grupos del evento seleccionado. Si ya existen partidos del evento, se reemplazaran. Continuar?"
    )
  ) {
    return;
  }

  try {
    await ApiClient.post(`/partidos/evento/${eventoSeleccionado}/generar-fixture`, {
      ida_y_vuelta: idaYVuelta,
      reemplazar: true,
      programacion_manual: programacionManual,
      modo: "grupos",
    });

    mostrarNotificacion("Fixture generado correctamente", "success");
    await cargarPartidos();
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "Error al generar el fixture.", "error");
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

  window.location.href = `fixtureplantilla.html?${params.toString()}`;
}

function limpiarPartidosUI() {
  partidosActuales = [];
  const cont = document.getElementById("lista-partidos");
  if (cont) {
    cont.classList.remove("list-mode-table");
    cont.innerHTML = "";
  }
  renderFixtureTemplate([]);
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

window.cargarPartidos = cargarPartidos;
window.cambiarPestanaPartidos = cambiarPestanaPartidos;
window.cambiarVistaFixture = cambiarVistaFixture;
window.generarFixtureEvento = generarFixtureEvento;
window.exportarFixturePNG = exportarFixturePNG;
window.exportarFixturePDF = exportarFixturePDF;
window.abrirPlantillaFixturePantallaCompleta = abrirPlantillaFixturePantallaCompleta;
window.editarPartido = editarPartido;
window.eliminarPartido = eliminarPartido;
window.abrirPlanillaPartido = abrirPlanillaPartido;
window.cambiarVistaPartidos = cambiarVistaPartidos;


