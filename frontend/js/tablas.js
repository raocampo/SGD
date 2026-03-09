let tablasEventoSeleccionado = null;
let tablasEventosCache = [];
let tablasCampeonatosCache = [];
let tablasCampeonatoSeleccionado = null;

const TABLAS_TAB_IDS = ["tab-posiciones", "tab-goleadores", "tab-tarjetas", "tab-fair-play"];
const TABLAS_STORAGE_CAMPEONATO = "sgd_tablas_camp";
const TABLAS_STORAGE_EVENTO = "sgd_tablas_evento";

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("tablas.html")) return;

  inicializarTabs();
  inicializarAcciones();

  const params = new URLSearchParams(window.location.search);
  const campeonatoDesdeURL = parsePositiveInt(params.get("campeonato"));
  const eventoDesdeURL = parsePositiveInt(params.get("evento"));

  await cargarCampeonatos(campeonatoDesdeURL, eventoDesdeURL);
  await cargarEventos(eventoDesdeURL);

  if (tablasEventoSeleccionado) {
    await buscarTablasEvento();
  } else {
    limpiarPaneles();
  }
});

function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function storageKey(base) {
  const userId = parsePositiveInt(window.Auth?.getUser?.()?.id);
  return userId ? `${base}_${userId}` : base;
}

function guardarContextoTablas() {
  if (tablasCampeonatoSeleccionado) {
    localStorage.setItem(storageKey(TABLAS_STORAGE_CAMPEONATO), String(tablasCampeonatoSeleccionado));
  }
  if (tablasEventoSeleccionado) {
    localStorage.setItem(storageKey(TABLAS_STORAGE_EVENTO), String(tablasEventoSeleccionado));
  } else {
    localStorage.removeItem(storageKey(TABLAS_STORAGE_EVENTO));
  }
}

function limpiarContextoTablasEvento() {
  tablasEventoSeleccionado = null;
  localStorage.removeItem(storageKey(TABLAS_STORAGE_EVENTO));
}

async function resolverCampeonatoDesdeEvento(eventoId = null) {
  if (!eventoId) return null;
  try {
    const respEvento = await EventosAPI.obtenerPorId(eventoId);
    const evento = respEvento?.evento || respEvento || {};
    return parsePositiveInt(evento?.campeonato_id);
  } catch (error) {
    return null;
  }
}

async function cargarCampeonatos(campeonatoParam = null, eventoParam = null) {
  const selectCampeonato = document.getElementById("select-campeonato-tablas");
  if (!selectCampeonato) return;

  try {
    const resp = await CampeonatosAPI.obtenerTodos();
    const lista = Array.isArray(resp) ? resp : (resp?.campeonatos || []);
    tablasCampeonatosCache = lista;

    selectCampeonato.innerHTML = '<option value="">- Selecciona un campeonato -</option>';
    lista.forEach((camp) => {
      selectCampeonato.innerHTML += `
        <option value="${camp.id}">${escaparHtml(camp.nombre || `Campeonato ${camp.id}`)}</option>
      `;
    });

    let candidato = parsePositiveInt(campeonatoParam);
    if (!candidato) {
      candidato = await resolverCampeonatoDesdeEvento(parsePositiveInt(eventoParam));
    }
    if (!candidato) {
      candidato = parsePositiveInt(localStorage.getItem(storageKey(TABLAS_STORAGE_CAMPEONATO)));
    }

    const idsDisponibles = new Set(lista.map((camp) => Number(camp.id)));
    if (!idsDisponibles.has(Number(candidato))) {
      candidato = parsePositiveInt([...lista].sort((a, b) => Number(b.id) - Number(a.id))[0]?.id);
    }

    tablasCampeonatoSeleccionado = candidato || null;
    if (tablasCampeonatoSeleccionado) {
      selectCampeonato.value = String(tablasCampeonatoSeleccionado);
      guardarContextoTablas();
    } else {
      selectCampeonato.value = "";
      limpiarContextoTablasEvento();
      actualizarFormularioFormato(null);
      limpiarPaneles("No hay campeonatos disponibles para tu usuario.");
    }
  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error cargando campeonatos", "error");
    actualizarFormularioFormato(null);
  }
}

function inicializarTabs() {
  document.querySelectorAll("#tablas-main-tabs .partidos-main-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tablas-target");
      cambiarTablasTab(target);
    });
  });
}

function inicializarAcciones() {
  const btnBuscar = document.getElementById("btn-buscar-tablas");
  const btnRecargar = document.getElementById("btn-recargar-eventos");
  const selectEvento = document.getElementById("select-evento-tablas");
  const selectCampeonato = document.getElementById("select-campeonato-tablas");
  const btnGuardarFormato = document.getElementById("btn-guardar-formato-tablas");
  const selectMetodo = document.getElementById("tablas-metodo-competencia");

  if (btnBuscar) btnBuscar.addEventListener("click", buscarTablasEvento);
  if (btnRecargar) {
    btnRecargar.addEventListener("click", async () => {
      await cargarCampeonatos(tablasCampeonatoSeleccionado, tablasEventoSeleccionado);
      await cargarEventos(tablasEventoSeleccionado);
      mostrarNotificacion("Filtros recargados", "success");
    });
  }

  if (selectCampeonato) {
    selectCampeonato.addEventListener("change", async () => {
      tablasCampeonatoSeleccionado = parsePositiveInt(selectCampeonato.value);
      limpiarContextoTablasEvento();
      guardarContextoTablas();
      await cargarEventos(null);
      limpiarPaneles();
    });
  }

  if (selectEvento) {
    selectEvento.addEventListener("change", () => {
      tablasEventoSeleccionado = parsePositiveInt(selectEvento.value);
      const eventoSel = tablasEventosCache.find((e) => Number(e.id) === Number(tablasEventoSeleccionado));
      const campEvt = parsePositiveInt(eventoSel?.campeonato_id);
      if (campEvt) {
        tablasCampeonatoSeleccionado = campEvt;
      }
      guardarContextoTablas();
      actualizarFormularioFormato(eventoSel || null);
    });
  }

  if (selectMetodo) {
    selectMetodo.addEventListener("change", actualizarVisibilidadFormatoClasificacion);
  }

  if (btnGuardarFormato) {
    btnGuardarFormato.addEventListener("click", guardarFormatoClasificacion);
  }
}

function puedeEditarFormato() {
  return window.Auth?.isAdminLike?.() === true;
}

function actualizarVisibilidadFormatoClasificacion() {
  const selectMetodo = document.getElementById("tablas-metodo-competencia");
  const wrapClasificados = document.getElementById("tablas-wrap-clasificados");
  if (!selectMetodo || !wrapClasificados) return;
  const metodo = String(selectMetodo.value || "grupos").toLowerCase();
  wrapClasificados.style.display = ["grupos", "mixto"].includes(metodo) ? "" : "none";
}

function actualizarFormularioFormato(evento = null) {
  const selectMetodo = document.getElementById("tablas-metodo-competencia");
  const inputClasificados = document.getElementById("tablas-clasificados-por-grupo");
  const btnGuardar = document.getElementById("btn-guardar-formato-tablas");
  const ayuda = document.getElementById("tablas-formato-ayuda");
  if (!selectMetodo || !inputClasificados || !btnGuardar || !ayuda) return;

  if (!evento) {
    selectMetodo.value = "grupos";
    inputClasificados.value = "2";
    btnGuardar.disabled = true;
    ayuda.textContent = "Selecciona una categoría para editar su formato de clasificación.";
    actualizarVisibilidadFormatoClasificacion();
    return;
  }

  const metodo = String(evento.metodo_competencia || "grupos").toLowerCase();
  selectMetodo.value = ["grupos", "liga", "eliminatoria", "mixto"].includes(metodo) ? metodo : "grupos";
  inputClasificados.value = parsePositiveInt(evento.clasificados_por_grupo) || 2;

  if (!puedeEditarFormato()) {
    btnGuardar.disabled = true;
    ayuda.textContent = "Solo administrador u organizador pueden guardar el formato de clasificación.";
  } else {
    btnGuardar.disabled = false;
    ayuda.textContent = `Configuración activa para: ${evento.nombre || `Categoría ${evento.id}`}.`;
  }
  actualizarVisibilidadFormatoClasificacion();
}

async function guardarFormatoClasificacion() {
  if (!tablasEventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría primero.", "warning");
    return;
  }
  if (!puedeEditarFormato()) {
    mostrarNotificacion("No tienes permisos para guardar este formato.", "warning");
    return;
  }

  const selectMetodo = document.getElementById("tablas-metodo-competencia");
  const inputClasificados = document.getElementById("tablas-clasificados-por-grupo");
  const metodo = String(selectMetodo?.value || "grupos").toLowerCase();
  const payload = { metodo_competencia: metodo };

  if (["grupos", "mixto"].includes(metodo)) {
    const clasificados = parsePositiveInt(inputClasificados?.value);
    if (!clasificados) {
      mostrarNotificacion("Clasificados por grupo debe ser un entero mayor a 0.", "warning");
      return;
    }
    payload.clasificados_por_grupo = clasificados;
  } else {
    payload.clasificados_por_grupo = null;
  }

  try {
    const resp = await EventosAPI.actualizar(tablasEventoSeleccionado, payload);
    const eventoActualizado = resp?.evento || {};
    tablasEventosCache = tablasEventosCache.map((item) =>
      Number(item.id) === Number(tablasEventoSeleccionado) ? { ...item, ...eventoActualizado } : item
    );
    const eventoSel = tablasEventosCache.find((e) => Number(e.id) === Number(tablasEventoSeleccionado));
    actualizarFormularioFormato(eventoSel || eventoActualizado);
    mostrarNotificacion("Formato de clasificación guardado", "success");
    await buscarTablasEvento();
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo guardar el formato de clasificación", "error");
  }
}

async function cargarEventos(eventoPreseleccionado = null) {
  const select = document.getElementById("select-evento-tablas");
  if (!select) return;

  select.innerHTML = '<option value="">- Selecciona una categoría -</option>';
  tablasEventosCache = [];
  limpiarContextoTablasEvento();

  if (!tablasCampeonatoSeleccionado) {
    actualizarFormularioFormato(null);
    return;
  }

  try {
    const resp = await EventosAPI.obtenerPorCampeonato(Number(tablasCampeonatoSeleccionado));
    const eventos = resp.eventos || resp || [];
    tablasEventosCache = eventos;

    eventos.forEach((e) => {
      const label = e.nombre || `Categoría ${e.id}`;
      select.innerHTML += `<option value="${e.id}">${escaparHtml(label)}</option>`;
    });

    const preseleccionado = parsePositiveInt(eventoPreseleccionado);
    const cacheEvento = parsePositiveInt(localStorage.getItem(storageKey(TABLAS_STORAGE_EVENTO)));
    const candidato = preseleccionado || cacheEvento;

    if (candidato && eventos.some((e) => Number(e.id) === Number(candidato))) {
      tablasEventoSeleccionado = candidato;
      select.value = String(candidato);
    } else if (eventos.length === 1) {
      tablasEventoSeleccionado = Number(eventos[0].id);
      select.value = String(eventos[0].id);
    }

    guardarContextoTablas();
    const eventoSel = eventos.find((e) => Number(e.id) === Number(tablasEventoSeleccionado));
    actualizarFormularioFormato(eventoSel || null);
  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error cargando categorías", "error");
    actualizarFormularioFormato(null);
  }
}

function sincronizarFormatoConPosiciones(posicionesPayload = {}) {
  const eventoPos = posicionesPayload?.evento || {};
  if (!tablasEventoSeleccionado) return;
  tablasEventosCache = tablasEventosCache.map((item) => {
    if (Number(item.id) !== Number(tablasEventoSeleccionado)) return item;
    return {
      ...item,
      clasificados_por_grupo:
        parsePositiveInt(eventoPos?.clasificados_por_grupo) || item.clasificados_por_grupo || null,
    };
  });
  const eventoSel = tablasEventosCache.find((e) => Number(e.id) === Number(tablasEventoSeleccionado));
  if (eventoSel) {
    actualizarFormularioFormato(eventoSel);
  }
}

async function buscarTablasEvento() {
  const select = document.getElementById("select-evento-tablas");
  if (!tablasEventoSeleccionado && select?.value) {
    tablasEventoSeleccionado = parsePositiveInt(select.value);
    guardarContextoTablas();
  }

  if (!tablasEventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría primero", "warning");
    limpiarPaneles();
    return;
  }

  setCargandoPaneles();

  try {
    const [posiciones, goleadores, tarjetas, fairPlay] = await Promise.all([
      ApiClient.get(`/tablas/evento/${tablasEventoSeleccionado}/posiciones`),
      ApiClient.get(`/tablas/evento/${tablasEventoSeleccionado}/goleadores`),
      ApiClient.get(`/tablas/evento/${tablasEventoSeleccionado}/tarjetas`),
      ApiClient.get(`/tablas/evento/${tablasEventoSeleccionado}/fair-play`),
    ]);

    sincronizarFormatoConPosiciones(posiciones);
    renderPosiciones(posiciones);
    renderGoleadores(goleadores);
    renderTarjetas(tarjetas);
    renderFairPlay(fairPlay);

    mostrarNotificacion("Tablas actualizadas", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "Error cargando tablas", "error");
    limpiarPaneles("No se pudo cargar la información de la categoría.");
  }
}

function cambiarTablasTab(tabId) {
  const objetivo = TABLAS_TAB_IDS.includes(tabId) ? tabId : "tab-posiciones";

  document.querySelectorAll("#tablas-main-tabs .partidos-main-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-tablas-target") === objetivo);
  });

  document.querySelectorAll(".page-tablas .partidos-tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === objetivo);
  });
}

function setCargandoPaneles() {
  ["tablas-posiciones", "tablas-goleadores", "tablas-tarjetas", "tablas-fair-play"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Cargando datos...</p>
      </div>
    `;
  });
}

function limpiarPaneles(mensaje = "Selecciona una categoría y presiona Buscar para ver tablas.") {
  const html = `
    <div class="empty-state">
      <i class="fas fa-table"></i>
      <p>${escaparHtml(mensaje)}</p>
    </div>
  `;

  const posiciones = document.getElementById("tablas-posiciones");
  const goleadores = document.getElementById("tablas-goleadores");
  const tarjetas = document.getElementById("tablas-tarjetas");
  const fairPlay = document.getElementById("tablas-fair-play");

  if (posiciones) posiciones.innerHTML = html;
  if (goleadores) goleadores.innerHTML = html;
  if (tarjetas) tarjetas.innerHTML = html;
  if (fairPlay) fairPlay.innerHTML = html;
}

function renderPosiciones(data) {
  const cont = document.getElementById("tablas-posiciones");
  if (!cont) return;

  const grupos = data?.grupos || [];
  if (!grupos.length) {
    cont.innerHTML = renderVacio("No existen grupos o equipos para este evento.");
    return;
  }

  const nombreEvento = data?.evento?.nombre || "Evento";
  const nombreCampeonato = data?.evento?.campeonato_nombre || "Campeonato";
  const clasificanPorGrupo = Number.parseInt(data?.evento?.clasificados_por_grupo, 10);

  const resumen = `
    <div class="card tablas-resumen-card">
      <p><strong>Campeonato:</strong> ${escaparHtml(nombreCampeonato)}</p>
      <p><strong>Evento:</strong> ${escaparHtml(nombreEvento)}</p>
      <p><strong>Grupos:</strong> ${Number(data.total_grupos || grupos.length)}</p>
      <p><strong>Equipos:</strong> ${Number(data.total_equipos || 0)}</p>
      <p><strong>Clasifican por grupo:</strong> ${
        Number.isFinite(clasificanPorGrupo) && clasificanPorGrupo > 0 ? clasificanPorGrupo : "No definido"
      }</p>
    </div>
  `;

  const gruposHtml = grupos
    .map((g) => {
      const tabla = Array.isArray(g.tabla) ? g.tabla : [];
      const tituloGrupo = g?.grupo?.letra_grupo && g.grupo.letra_grupo !== "-"
        ? `Grupo ${g.grupo.letra_grupo}`
        : g?.grupo?.nombre_grupo || "Tabla general";
      const cuposGrupo = Number.parseInt(
        g?.grupo?.clasificados_por_grupo ?? data?.evento?.clasificados_por_grupo,
        10
      );

      return `
        <div class="card tablas-grupo-card">
          <h3>${escaparHtml(tituloGrupo)}</h3>
          ${renderTablaPosiciones(tabla, cuposGrupo)}
        </div>
      `;
    })
    .join("");

  cont.innerHTML = `${resumen}<div class="tablas-grid">${gruposHtml}</div>`;
}

function renderEstadoPosicion(row = {}) {
  const noPresentaciones = Number(row.no_presentaciones || 0);
  if (row.eliminado_automatico === true) {
    return `
      <div class="tabla-posicion-status">
        <span class="tabla-posicion-chip is-eliminado">Eliminado</span>
        <span class="tabla-posicion-chip is-neutral">NP ${noPresentaciones}</span>
      </div>
    `;
  }
  if (noPresentaciones > 0) {
    return `
      <div class="tabla-posicion-status">
        <span class="tabla-posicion-chip is-neutral">NP ${noPresentaciones}</span>
      </div>
    `;
  }
  return "";
}

function renderTablaPosiciones(tabla, clasificanPorGrupo = 0) {
  if (!tabla.length) {
    return renderVacio("Sin partidos finalizados para calcular posiciones.");
  }

  const rows = tabla
    .map((row, idx) => {
      const est = row.estadisticas || {};
      const posicion = Number(row.posicion || idx + 1);
      const fuera = row.fuera_clasificacion === true;
      const eliminado = row.eliminado_automatico === true;
      const classes = [
        fuera ? "tabla-posicion-fuera" : "",
        eliminado ? "tabla-posicion-eliminado" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <tr class="${classes}">
          <td>${posicion}</td>
          <td>
            <div class="tabla-posicion-equipo">
              <span>${escaparHtml(row?.equipo?.nombre || "-")}</span>
              ${renderEstadoPosicion(row)}
            </div>
          </td>
          <td>${Number(est.partidos_jugados || 0)}</td>
          <td>${Number(est.partidos_ganados || 0)}</td>
          <td>${Number(est.partidos_empatados || 0)}</td>
          <td>${Number(est.partidos_perdidos || 0)}</td>
          <td>${Number(est.goles_favor || 0)}</td>
          <td>${Number(est.goles_contra || 0)}</td>
          <td>${Number(est.diferencia_goles || 0)}</td>
          <td><strong>${Number(row.puntos || 0)}</strong></td>
        </tr>
      `;
    })
    .join("");

  return `
    ${
      Number.isFinite(Number(clasificanPorGrupo)) && Number(clasificanPorGrupo) > 0
        ? `<p class="tablas-clasificacion-help">
             Se pintan en rojo los equipos fuera de clasificación y los eliminados automáticamente.
           </p>`
        : ""
    }
    <div class="tabla-scroll">
      <table class="tabla-estadistica tabla-estadistica-posiciones">
        <thead>
          <tr>
            <th>#</th>
            <th>Equipo</th>
            <th>PJ</th>
            <th>PG</th>
            <th>PE</th>
            <th>PP</th>
            <th>GF</th>
            <th>GC</th>
            <th>DG</th>
            <th>PTS</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderGoleadores(data) {
  const cont = document.getElementById("tablas-goleadores");
  if (!cont) return;

  const lista = data?.goleadores || [];
  if (!lista.length) {
    cont.innerHTML = renderVacio(data?.mensaje || "No hay registros de goleadores para este evento.");
    return;
  }

  const rows = lista
    .map((g, idx) => {
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escaparHtml(g.jugador_nombre || "-")}</td>
          <td>${escaparHtml(g.equipo_nombre || "-")}</td>
          <td>${Number(g.goles || 0)}</td>
          <td>${Number(g.partidos_con_gol || 0)}</td>
        </tr>
      `;
    })
    .join("");

  cont.innerHTML = `
    <div class="card">
      <h3>Goleadores del Evento</h3>
      <div class="tabla-scroll">
        <table class="tabla-estadistica">
          <thead>
            <tr>
              <th>#</th>
              <th>Jugador</th>
              <th>Equipo</th>
              <th>Goles</th>
              <th>Partidos con gol</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderTarjetas(data) {
  const cont = document.getElementById("tablas-tarjetas");
  if (!cont) return;

  const lista = data?.tarjetas || [];
  if (!lista.length) {
    cont.innerHTML = renderVacio(data?.mensaje || "No hay registros de tarjetas para este evento.");
    return;
  }

  const rows = lista
    .map((t, idx) => {
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escaparHtml(t.equipo_nombre || "-")}</td>
          <td>${Number(t.amarillas || 0)}</td>
          <td>${Number(t.rojas || 0)}</td>
        </tr>
      `;
    })
    .join("");

  cont.innerHTML = `
    <div class="card">
      <h3>Resumen de Tarjetas</h3>
      <div class="tabla-scroll">
        <table class="tabla-estadistica">
          <thead>
            <tr>
              <th>#</th>
              <th>Equipo</th>
              <th>Amarillas</th>
              <th>Rojas</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderFairPlay(data) {
  const cont = document.getElementById("tablas-fair-play");
  if (!cont) return;

  const lista = data?.fair_play || [];
  const incluyeFaltas = data?.incluye_faltas === true;
  if (!lista.length) {
    cont.innerHTML = renderVacio("No hay datos suficientes para calcular fair play.");
    return;
  }

  const rows = lista
    .map((f, idx) => {
      return `
        <tr>
          <td>${Number(f.posicion || idx + 1)}</td>
          <td>${escaparHtml(f.equipo_nombre || "-")}</td>
          <td>${Number(f.amarillas || 0)}</td>
          <td>${Number(f.rojas || 0)}</td>
          ${incluyeFaltas ? `<td>${Number(f.faltas || 0)}</td>` : ""}
          <td>${Number(f.uniformidad || 0).toFixed(2)}</td>
          <td>${Number(f.comportamiento || 0).toFixed(2)}</td>
          <td>${Number(f.puntualidad || 0).toFixed(2)}</td>
          <td>${Number(f.penalizacion || 0).toFixed(2)}</td>
          <td>${Number(f.bonificacion || 0).toFixed(2)}</td>
          <td><strong>${Number(f.puntaje_fair_play || 0).toFixed(2)}</strong></td>
        </tr>
      `;
    })
    .join("");

  cont.innerHTML = `
    <div class="card">
      <h3>Tabla Fair Play</h3>
      <p class="tablas-fair-play-help">Formula: base + bonificaciones (uniformidad/comportamiento/puntualidad) - penalizacion por tarjetas${incluyeFaltas ? " y faltas" : ""}.</p>
      <div class="tabla-scroll">
        <table class="tabla-estadistica">
          <thead>
            <tr>
              <th>#</th>
              <th>Equipo</th>
              <th>Amarillas</th>
              <th>Rojas</th>
              ${incluyeFaltas ? "<th>Faltas</th>" : ""}
              <th>Uniformidad</th>
              <th>Comportamiento</th>
              <th>Puntualidad</th>
              <th>Penalizacion</th>
              <th>Bonificacion</th>
              <th>Puntaje</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderVacio(mensaje) {
  return `
    <div class="empty-state">
      <i class="fas fa-circle-info"></i>
      <p>${escaparHtml(mensaje)}</p>
    </div>
  `;
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}



