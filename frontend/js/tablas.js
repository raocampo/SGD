let tablasEventoSeleccionado = null;
let tablasEventosCache = [];
let tablasCampeonatoSeleccionado = null;

const TABLAS_TAB_IDS = ["tab-posiciones", "tab-goleadores", "tab-tarjetas", "tab-fair-play"];

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("tablas.html")) return;

  inicializarTabs();
  inicializarAcciones();

  const campeonatoDesdeURL = new URLSearchParams(window.location.search).get("campeonato");
  const eventoDesdeURL = new URLSearchParams(window.location.search).get("evento");
  await resolverCampeonatoContextoTablas(
    campeonatoDesdeURL ? Number(campeonatoDesdeURL) : null,
    eventoDesdeURL ? Number(eventoDesdeURL) : null
  );
  await cargarEventos(eventoDesdeURL ? Number(eventoDesdeURL) : null);

  if (eventoDesdeURL) {
    tablasEventoSeleccionado = Number(eventoDesdeURL);
    await buscarTablasEvento();
  } else {
    limpiarPaneles();
  }
});

async function resolverCampeonatoContextoTablas(campeonatoParam = null, eventoParam = null) {
  if (Number.isFinite(Number(campeonatoParam)) && Number(campeonatoParam) > 0) {
    tablasCampeonatoSeleccionado = Number(campeonatoParam);
    localStorage.setItem("sgd_tablas_camp", String(tablasCampeonatoSeleccionado));
    return;
  }

  const cacheTablas = Number.parseInt(localStorage.getItem("sgd_tablas_camp") || "", 10);
  if (Number.isFinite(cacheTablas) && cacheTablas > 0) {
    tablasCampeonatoSeleccionado = cacheTablas;
  }

  const cachePartidos = Number.parseInt(localStorage.getItem("sgd_partidos_camp") || "", 10);
  if (!Number.isFinite(Number(tablasCampeonatoSeleccionado)) && Number.isFinite(cachePartidos) && cachePartidos > 0) {
    tablasCampeonatoSeleccionado = cachePartidos;
  }

  if (Number.isFinite(Number(eventoParam)) && Number(eventoParam) > 0) {
    try {
      const respEvento = await ApiClient.get(`/eventos/${Number(eventoParam)}`);
      const evento = respEvento?.evento || respEvento || {};
      const campEvt = Number.parseInt(evento?.campeonato_id, 10);
      if (Number.isFinite(campEvt) && campEvt > 0) {
        tablasCampeonatoSeleccionado = campEvt;
        localStorage.setItem("sgd_tablas_camp", String(campEvt));
      }
    } catch (error) {
      console.warn("No se pudo resolver campeonato para tablas desde la categoría:", error);
    }
  }

  if (!Number.isFinite(Number(tablasCampeonatoSeleccionado))) {
    try {
      const respCamp = await ApiClient.get("/campeonatos");
      const lista = Array.isArray(respCamp) ? respCamp : (respCamp?.campeonatos || []);
      if (lista.length) {
        const ultimo = [...lista].sort((a, b) => Number(b.id) - Number(a.id))[0];
        const campDefault = Number.parseInt(ultimo?.id, 10);
        if (Number.isFinite(campDefault) && campDefault > 0) {
          tablasCampeonatoSeleccionado = campDefault;
          localStorage.setItem("sgd_tablas_camp", String(campDefault));
        }
      }
    } catch (error) {
      console.warn("No se pudo obtener campeonato por defecto para tablas:", error);
    }
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

  if (btnBuscar) btnBuscar.addEventListener("click", buscarTablasEvento);
  if (btnRecargar) {
    btnRecargar.addEventListener("click", async () => {
      await cargarEventos(tablasEventoSeleccionado);
      mostrarNotificacion("Categorías recargadas", "success");
    });
  }

  if (selectEvento) {
    selectEvento.addEventListener("change", () => {
      tablasEventoSeleccionado = selectEvento.value ? Number(selectEvento.value) : null;
      const eventoSel = tablasEventosCache.find((e) => Number(e.id) === Number(tablasEventoSeleccionado));
      const campEvt = Number.parseInt(eventoSel?.campeonato_id, 10);
      if (Number.isFinite(campEvt) && campEvt > 0) {
        tablasCampeonatoSeleccionado = campEvt;
        localStorage.setItem("sgd_tablas_camp", String(campEvt));
      }
    });
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

async function cargarEventos(eventoPreseleccionado = null) {
  const select = document.getElementById("select-evento-tablas");
  if (!select) return;

  try {
    const endpoint = Number.isFinite(Number(tablasCampeonatoSeleccionado)) && Number(tablasCampeonatoSeleccionado) > 0
      ? `/eventos/campeonato/${Number(tablasCampeonatoSeleccionado)}`
      : "/eventos";
    const resp = await ApiClient.get(endpoint);
    const eventos = resp.eventos || resp || [];
    tablasEventosCache = eventos;

    select.innerHTML = '<option value="">- Selecciona una categoría -</option>';

    eventos.forEach((e) => {
      const label = e.nombre || `Categoría ${e.id}`;
      select.innerHTML += `<option value="${e.id}">${escaparHtml(label)}</option>`;
    });

    if (eventoPreseleccionado && eventos.some((e) => Number(e.id) === Number(eventoPreseleccionado))) {
      select.value = String(eventoPreseleccionado);
      tablasEventoSeleccionado = Number(eventoPreseleccionado);
    }
  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error cargando categorías", "error");
  }
}

async function buscarTablasEvento() {
  const select = document.getElementById("select-evento-tablas");
  if (!tablasEventoSeleccionado && select?.value) {
    tablasEventoSeleccionado = Number(select.value);
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



