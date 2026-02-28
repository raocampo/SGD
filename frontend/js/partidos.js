// frontend/js/partidos.js

const BACKEND_BASE = "http://localhost:5000";

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
    if (titulo) titulo.textContent = "Generación de Fixture (Liga)";
  } else {
    if (titulo) titulo.textContent = "Generación de Fixture";
  }

  if (opciones) opciones.style.display = "";
  if (btn) btn.innerHTML = '<i class="fas fa-calendar-plus"></i> Generar Fixture (categoría)';
  if (selectGrupo) selectGrupo.disabled = false;
  if (selectJornada) selectJornada.disabled = false;
  if (inputFecha) inputFecha.disabled = false;
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("partidos.html")) return;
  actualizarBotonesVistaPartidos();

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
});

function limpiarFiltrosPartidosPorCambioContexto() {
  eventoSeleccionado = null;
  grupoSeleccionado = null;
  jornadaSeleccionada = null;
  fechaSeleccionada = null;
  eliminatoriasActuales = [];
  metodoCompetenciaActivo = "grupos";
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

    const params = new URLSearchParams(window.location.search);
    const campURL = Number.parseInt(params.get("campeonato") || "", 10);
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

      limpiarFiltrosPartidosPorCambioContexto();
      await cargarGruposPorEvento(null);
      await cargarContextoFixture(null);
      limpiarPartidosUI();
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
    if (metodoCompetenciaActivo === "eliminatoria") {
      const data = await ApiClient.get(`/eliminatorias/evento/${eventoSeleccionado}`);
      const cruces = Array.isArray(data?.partidos) ? data.partidos : [];
      eliminatoriasActuales = cruces;
      partidosActuales = [];
      limpiarJornadas();
      aplicarRenderEliminatorias();
      renderFixtureTemplate([]);
      return;
    }

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

async function aplicarEventoInicialDesdeURL() {
  const queryCamp = new URLSearchParams(window.location.search).get("campeonato");
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

  const queryEvento = new URLSearchParams(window.location.search).get("evento");
  const id = Number.parseInt(queryEvento || "", 10);
  if (!Number.isFinite(id)) return;

  const select = document.getElementById("select-evento");
  if (!select) return;
  if (![...select.options].some((x) => Number(x.value) === id)) return;

  select.value = String(id);
  await select.onchange?.();
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
  const evento = obtenerEventoSeleccionadoObj();
  const esEliminatoria = metodoCompetenciaActivo === "eliminatoria";
  const cantidadEquiposObjetivo = Number.parseInt(evento?.eliminatoria_equipos, 10) || null;

  const mensaje = esEliminatoria
    ? "Se generará la llave eliminatoria de la categoría seleccionada. Si ya existe, se reemplazará. ¿Continuar?"
    : "Se generara el fixture para todos los grupos del evento seleccionado. Si ya existen partidos del evento, se reemplazaran. Continuar?";

  if (
    !confirm(mensaje)
  ) {
    return;
  }

  try {
    await ApiClient.post(`/partidos/evento/${eventoSeleccionado}/generar-fixture`, {
      ida_y_vuelta: idaYVuelta,
      reemplazar: true,
      programacion_manual: programacionManual,
      modo: "auto",
      cantidad_equipos: cantidadEquiposObjetivo,
    });

    mostrarNotificacion(
      esEliminatoria ? "Llave eliminatoria generada correctamente" : "Fixture generado correctamente",
      "success"
    );
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

  const rlStr = prompt("Goles equipo local:", String(rlActual));
  if (rlStr === null) return;
  const rvStr = prompt("Goles equipo visitante:", String(rvActual));
  if (rvStr === null) return;

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

  window.location.href = `fixtureplantilla.html?${params.toString()}`;
}

function abrirVistaEliminatoria() {
  if (!eventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría primero.", "warning");
    return;
  }
  window.location.href = `eliminatorias.html?evento=${encodeURIComponent(eventoSeleccionado)}`;
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
window.editarResultadoEliminatoria = editarResultadoEliminatoria;
window.abrirVistaEliminatoria = abrirVistaEliminatoria;



