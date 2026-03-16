let tablasEventoSeleccionado = null;
let tablasEventosCache = [];
let tablasCampeonatosCache = [];
let tablasCampeonatoSeleccionado = null;
let tablasConfigPlayoff = null;
let tablasUltimoPayloadPosiciones = null;
let tablasGrupoEditando = null;

const TABLAS_TAB_IDS = ["tab-posiciones", "tab-goleadores", "tab-tarjetas", "tab-fair-play"];
const TABLAS_STORAGE_CAMPEONATO = "sgd_tablas_camp";
const TABLAS_STORAGE_EVENTO = "sgd_tablas_evento";

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("tablas.html")) return;

  inicializarTabs();
  inicializarAcciones();

  const routeContext = window.RouteContext?.read?.("tablas.html", ["campeonato", "evento"]) || {};
  const campeonatoDesdeURL = parsePositiveInt(routeContext.campeonato);
  const eventoDesdeURL = parsePositiveInt(routeContext.evento);

  await cargarCampeonatos(campeonatoDesdeURL, eventoDesdeURL);
  await cargarEventos(eventoDesdeURL);

  if (tablasEventoSeleccionado) {
    await cargarConfiguracionCompetenciaCompartida();
    await buscarTablasEvento();
  } else {
    limpiarPaneles();
  }
});

function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function obtenerMetodoCompetenciaVisibleTablas(evento = {}) {
  if (evento?.clasificacion_tabla_acumulada === true) return "tabla_acumulada";
  return String(evento?.metodo_competencia || "grupos").toLowerCase();
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
  const btnReiniciarFormato = document.getElementById("btn-reiniciar-formato-tablas");
  const selectMetodo = document.getElementById("tablas-metodo-competencia");
  const selectOrigen = document.getElementById("tablas-origen-playoff");
  const selectMetodoPlayoff = document.getElementById("tablas-metodo-playoff");
  const contPosiciones = document.getElementById("tablas-posiciones");

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
      tablasConfigPlayoff = null;
      limpiarContextoTablasEvento();
      guardarContextoTablas();
      window.RouteContext?.save?.("tablas.html", {
        campeonato: tablasCampeonatoSeleccionado,
        evento: null,
      });
      await cargarEventos(null);
      limpiarPaneles();
    });
  }

  if (selectEvento) {
    selectEvento.addEventListener("change", async () => {
      tablasEventoSeleccionado = parsePositiveInt(selectEvento.value);
      tablasConfigPlayoff = null;
      const eventoSel = tablasEventosCache.find((e) => Number(e.id) === Number(tablasEventoSeleccionado));
      const campEvt = parsePositiveInt(eventoSel?.campeonato_id);
      if (campEvt) {
        tablasCampeonatoSeleccionado = campEvt;
      }
      guardarContextoTablas();
      window.RouteContext?.save?.("tablas.html", {
        campeonato: tablasCampeonatoSeleccionado,
        evento: tablasEventoSeleccionado,
      });
      actualizarFormularioFormato(eventoSel || null);
      await cargarConfiguracionCompetenciaCompartida();
    });
  }

  if (selectMetodo) {
    selectMetodo.addEventListener("change", actualizarVisibilidadFormatoClasificacion);
  }
  if (selectOrigen) {
    selectOrigen.addEventListener("change", actualizarVisibilidadFormatoClasificacion);
  }
  if (selectMetodoPlayoff) {
    selectMetodoPlayoff.addEventListener("change", actualizarVisibilidadFormatoClasificacion);
  }

  if (btnGuardarFormato) {
    btnGuardarFormato.addEventListener("click", guardarFormatoClasificacion);
  }
  if (btnReiniciarFormato) {
    btnReiniciarFormato.addEventListener("click", reiniciarFormatoClasificacion);
  }
  if (contPosiciones) {
    contPosiciones.addEventListener("click", manejarAccionesTablaManual);
    contPosiciones.addEventListener("input", (event) => {
      const input = event.target.closest(".tabla-manual-input");
      if (!input) return;
      const grupoKey = String(input.getAttribute("data-manual-key") || "").trim();
      if (!grupoKey) return;
      reordenarTablaManualGrupo(grupoKey);
    });
  }
}

function puedeEditarFormato() {
  return window.Auth?.isAdminLike?.() === true;
}

function esAdministradorTablas() {
  return window.Auth?.isAdministrador?.() === true;
}

function numeroManual(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizarSistemaPuntuacionManual(sistema = "tradicional") {
  return String(sistema || "tradicional").trim().toLowerCase() === "shootouts"
    ? "shootouts"
    : "tradicional";
}

function obtenerSistemaPuntuacionGrupo(grupo = {}) {
  return normalizarSistemaPuntuacionManual(
    grupo?.sistema_puntuacion || tablasUltimoPayloadPosiciones?.evento?.sistema_puntuacion || "tradicional"
  );
}

function calcularPuntosFilaManual(stats = {}, tr = null, sistema = "tradicional") {
  const partidosGanados = numeroManual(stats?.partidos_ganados, 0);
  const partidosEmpatados = numeroManual(stats?.partidos_empatados, 0);
  const partidosPerdidos = numeroManual(stats?.partidos_perdidos, 0);
  if (normalizarSistemaPuntuacionManual(sistema) !== "shootouts") {
    return partidosGanados * 3 + partidosEmpatados;
  }

  const victoriasShootoutsBase = numeroManual(tr?.dataset?.baseVictoriasShootouts, 0);
  const derrotasShootoutsBase = numeroManual(tr?.dataset?.baseDerrotasShootouts, 0);
  const victoriasShootouts = Math.min(victoriasShootoutsBase, partidosGanados);
  const derrotasShootouts = Math.min(derrotasShootoutsBase, partidosPerdidos);
  const victoriasTiempo = Math.max(partidosGanados - victoriasShootouts, 0);

  return victoriasTiempo * 3 + victoriasShootouts * 2 + derrotasShootouts + partidosEmpatados;
}

function obtenerReglasGrupoManual(grupo = {}) {
  const reglasGrupo = Array.isArray(grupo?.reglas_desempate) ? grupo.reglas_desempate : [];
  if (reglasGrupo.length) return reglasGrupo;
  const reglasEvento = Array.isArray(tablasUltimoPayloadPosiciones?.evento?.reglas_desempate)
    ? tablasUltimoPayloadPosiciones.evento.reglas_desempate
    : [];
  return reglasEvento.length ? reglasEvento : ["puntos", "diferencia_goles", "goles_favor"];
}

function claveGrupoTablaManual(grupo = {}) {
  const grupoId = parsePositiveInt(grupo?.id);
  return grupoId ? `grupo:${grupoId}` : "grupo:0";
}

function obtenerCrucesConfiguradosDesdeContenedor(cont) {
  if (!cont) return [];
  const aSelects = Array.from(cont.querySelectorAll("select[data-cruce-a]"));
  const cruces = [];
  for (const selA of aSelects) {
    const idx = selA.getAttribute("data-cruce-a");
    const selB = cont.querySelector(`select[data-cruce-b="${idx}"]`);
    const a = String(selA.value || "").toUpperCase().trim();
    const b = String(selB?.value || "").toUpperCase().trim();
    if (!a || !b || a === b) continue;
    cruces.push([a, b]);
  }
  const usados = new Set();
  return cruces.filter(([a, b]) => {
    if (usados.has(a) || usados.has(b)) return false;
    usados.add(a);
    usados.add(b);
    return true;
  });
}

function obtenerCrucesConfiguradosTablas() {
  return obtenerCrucesConfiguradosDesdeContenedor(document.getElementById("tablas-cruces-grupos"));
}

function renderCrucesTablas() {
  const cont = document.getElementById("tablas-cruces-grupos");
  if (!cont) return;
  const grupos = Array.isArray(tablasConfigPlayoff?.configuracion?.grupos)
    ? tablasConfigPlayoff.configuracion.grupos
        .map((grupo) => String(grupo?.letra_grupo || "").toUpperCase().trim())
        .filter(Boolean)
    : [];
  const crucesActuales = obtenerCrucesConfiguradosDesdeContenedor(cont);
  const crucesGuardados = Array.isArray(tablasConfigPlayoff?.configuracion?.cruces_grupos)
    ? tablasConfigPlayoff.configuracion.cruces_grupos
    : [];

  if (grupos.length < 2) {
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-layer-group"></i>
        <p>Primero debes tener grupos creados para configurar cruces.</p>
      </div>`;
    return;
  }

  const pares = Math.floor(grupos.length / 2);
  cont.innerHTML = Array.from({ length: pares }, (_, idx) => {
    const base = crucesActuales[idx] || crucesGuardados[idx] || [
      grupos[idx],
      grupos[grupos.length - 1 - idx],
    ];
    const a = base[0];
    const b = base[1];
    return `
      <div class="eli-cruce-row">
        <span>Cruce ${idx + 1}</span>
        <select data-cruce-a="${idx}">
          ${grupos
            .map(
              (grupo) =>
                `<option value="${escaparHtml(grupo)}" ${grupo === a ? "selected" : ""}>Grupo ${escaparHtml(grupo)}</option>`
            )
            .join("")}
        </select>
        <span>vs</span>
        <select data-cruce-b="${idx}">
          ${grupos
            .map(
              (grupo) =>
                `<option value="${escaparHtml(grupo)}" ${grupo === b ? "selected" : ""}>Grupo ${escaparHtml(grupo)}</option>`
            )
            .join("")}
        </select>
      </div>
    `;
  }).join("");

  const bloqueada = tablasConfigPlayoff?.configuracion?.guardada === true || !puedeEditarFormato();
  cont.querySelectorAll("select").forEach((select) => {
    select.disabled = bloqueada;
  });
}

function aplicarBloqueoConfiguracionTablas(guardada = false) {
  const disabled = guardada || !puedeEditarFormato();
  ["tablas-metodo-competencia", "tablas-clasificados-por-grupo", "tablas-origen-playoff", "tablas-metodo-playoff"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = disabled;
    }
  );
  document.querySelectorAll("#tablas-cruces-grupos select").forEach((select) => {
    select.disabled = disabled;
  });
  const btnGuardar = document.getElementById("btn-guardar-formato-tablas");
  const btnReset = document.getElementById("btn-reiniciar-formato-tablas");
  if (btnGuardar) {
    btnGuardar.disabled = !puedeEditarFormato();
    btnGuardar.style.display = guardada && puedeEditarFormato() ? "none" : "";
  }
  if (btnReset) {
    btnReset.disabled = !puedeEditarFormato();
    btnReset.style.display = guardada && puedeEditarFormato() ? "" : "none";
  }
}

function actualizarVisibilidadFormatoClasificacion() {
  const selectMetodo = document.getElementById("tablas-metodo-competencia");
  const wrapClasificados = document.getElementById("tablas-wrap-clasificados");
  const selectOrigen = document.getElementById("tablas-origen-playoff");
  const selectMetodoPlayoff = document.getElementById("tablas-metodo-playoff");
  const wrapMetodoPlayoff = document.getElementById("tablas-wrap-metodo-playoff");
  const wrapCruces = document.getElementById("tablas-wrap-cruces");
  if (!selectMetodo || !wrapClasificados) return;
  const metodo = String(selectMetodo.value || "grupos").toLowerCase();
  if (metodo === "tabla_acumulada") {
    if (selectOrigen) selectOrigen.value = "grupos";
    if (selectMetodoPlayoff) selectMetodoPlayoff.value = "tabla_unica";
  }
  const origen = String(selectOrigen?.value || "grupos").toLowerCase();
  const metodoPlayoff = String(selectMetodoPlayoff?.value || "cruces_grupos").toLowerCase();
  wrapClasificados.style.display = ["grupos", "mixto", "liga", "tabla_acumulada"].includes(metodo) ? "" : "none";
  if (wrapMetodoPlayoff) wrapMetodoPlayoff.style.display = origen === "grupos" ? "" : "none";
  if (wrapCruces) wrapCruces.style.display = origen === "grupos" && metodoPlayoff === "cruces_grupos" ? "" : "none";
  if (selectOrigen) {
    const bloqueado = metodo === "tabla_acumulada" || !puedeEditarFormato() || tablasConfigPlayoff?.configuracion?.guardada === true;
    selectOrigen.disabled = bloqueado;
  }
  if (selectMetodoPlayoff) {
    const bloqueado = metodo === "tabla_acumulada" || !puedeEditarFormato() || tablasConfigPlayoff?.configuracion?.guardada === true;
    selectMetodoPlayoff.disabled = bloqueado;
  }
  if (origen === "grupos" && metodoPlayoff === "cruces_grupos") {
    renderCrucesTablas();
  }
}

function actualizarFormularioFormato(evento = null) {
  const selectMetodo = document.getElementById("tablas-metodo-competencia");
  const inputClasificados = document.getElementById("tablas-clasificados-por-grupo");
  const selectOrigen = document.getElementById("tablas-origen-playoff");
  const selectMetodoPlayoff = document.getElementById("tablas-metodo-playoff");
  const btnGuardar = document.getElementById("btn-guardar-formato-tablas");
  const ayuda = document.getElementById("tablas-formato-ayuda");
  if (!selectMetodo || !inputClasificados || !btnGuardar || !ayuda) return;

  const eventoVista = tablasConfigPlayoff?.evento || evento || null;
  const config = tablasConfigPlayoff?.configuracion || null;
  const guardada = config?.guardada === true;

  if (!eventoVista) {
    selectMetodo.value = "grupos";
    inputClasificados.value = "2";
    if (selectOrigen) selectOrigen.value = "grupos";
    if (selectMetodoPlayoff) selectMetodoPlayoff.value = "cruces_grupos";
    btnGuardar.disabled = true;
    ayuda.textContent = "Selecciona una categoría para editar su configuración.";
    aplicarBloqueoConfiguracionTablas(false);
    actualizarVisibilidadFormatoClasificacion();
    return;
  }

  const metodo = obtenerMetodoCompetenciaVisibleTablas(eventoVista);
  selectMetodo.value = ["grupos", "liga", "eliminatoria", "mixto", "tabla_acumulada"].includes(metodo) ? metodo : "grupos";
  inputClasificados.value = parsePositiveInt(eventoVista.clasificados_por_grupo) || 2;
  if (selectOrigen) {
    selectOrigen.value = String(
      metodo === "tabla_acumulada" ? "grupos" : (config?.origen || (metodo === "eliminatoria" ? "evento" : "grupos"))
    ).toLowerCase();
  }
  if (selectMetodoPlayoff) {
    selectMetodoPlayoff.value = String(
      metodo === "tabla_acumulada" ? "tabla_unica" : (config?.metodo_clasificacion || "cruces_grupos")
    ).toLowerCase();
  }

  if (!puedeEditarFormato()) {
    btnGuardar.disabled = true;
    ayuda.textContent = "Solo administrador u organizador pueden guardar esta configuración.";
  } else {
    btnGuardar.disabled = false;
    ayuda.textContent = guardada
      ? `Configuración guardada para: ${eventoVista.nombre || `Categoría ${eventoVista.id}`}. Usa Reiniciar configuración para modificarla.`
      : `Configuración editable para: ${eventoVista.nombre || `Categoría ${eventoVista.id}`}.`;
  }
  renderCrucesTablas();
  aplicarBloqueoConfiguracionTablas(guardada);
  actualizarVisibilidadFormatoClasificacion();
}

async function cargarConfiguracionCompetenciaCompartida({ notificar = false } = {}) {
  if (!tablasEventoSeleccionado) {
    tablasConfigPlayoff = null;
    actualizarFormularioFormato(null);
    return null;
  }
  try {
    const resp = await ApiClient.get(`/eliminatorias/evento/${tablasEventoSeleccionado}/configuracion`);
    tablasConfigPlayoff = resp || null;
    if (resp?.evento) {
      tablasEventosCache = tablasEventosCache.map((item) =>
        Number(item.id) === Number(tablasEventoSeleccionado) ? { ...item, ...resp.evento } : item
      );
    }
    const eventoSel = tablasEventosCache.find((e) => Number(e.id) === Number(tablasEventoSeleccionado));
    actualizarFormularioFormato(eventoSel || resp?.evento || null);
    if (notificar) {
      mostrarNotificacion("Configuración cargada", "success");
    }
    return resp;
  } catch (error) {
    console.error(error);
    tablasConfigPlayoff = null;
    const eventoSel = tablasEventosCache.find((e) => Number(e.id) === Number(tablasEventoSeleccionado));
    actualizarFormularioFormato(eventoSel || null);
    return null;
  }
}

async function guardarFormatoClasificacion() {
  if (!tablasEventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría primero.", "warning");
    return;
  }
  if (!puedeEditarFormato()) {
    mostrarNotificacion("No tienes permisos para guardar esta configuración.", "warning");
    return;
  }

  const selectMetodo = document.getElementById("tablas-metodo-competencia");
  const inputClasificados = document.getElementById("tablas-clasificados-por-grupo");
  const selectOrigen = document.getElementById("tablas-origen-playoff");
  const selectMetodoPlayoff = document.getElementById("tablas-metodo-playoff");
  const metodo = String(selectMetodo?.value || "grupos").toLowerCase();
  const origen = metodo === "tabla_acumulada"
    ? "grupos"
    : String(selectOrigen?.value || "grupos").toLowerCase();
  const metodoPlayoff = metodo === "tabla_acumulada"
    ? "tabla_unica"
    : String(selectMetodoPlayoff?.value || "cruces_grupos").toLowerCase();
  const payload = {
    metodo_competencia: metodo,
    origen,
    metodo_clasificacion: metodoPlayoff,
  };

  if (["grupos", "mixto", "liga"].includes(metodo)) {
    const clasificados = parsePositiveInt(inputClasificados?.value);
    if (!clasificados) {
      mostrarNotificacion("Clasificados por grupo debe ser un entero mayor a 0.", "warning");
      return;
    }
    payload.clasificados_por_grupo = clasificados;
  } else {
    payload.clasificados_por_grupo = null;
  }

  if (origen === "grupos" && metodoPlayoff === "cruces_grupos") {
    payload.cruces_grupos = obtenerCrucesConfiguradosTablas();
  }

  try {
    const resp = await ApiClient.put(`/eliminatorias/evento/${tablasEventoSeleccionado}/configuracion`, payload);
    tablasConfigPlayoff = resp || null;
    const eventoActualizado = resp?.evento || {};
    tablasEventosCache = tablasEventosCache.map((item) =>
      Number(item.id) === Number(tablasEventoSeleccionado) ? { ...item, ...eventoActualizado } : item
    );
    const eventoSel = tablasEventosCache.find((e) => Number(e.id) === Number(tablasEventoSeleccionado));
    actualizarFormularioFormato(eventoSel || eventoActualizado);
    mostrarNotificacion("Configuración guardada", "success");
    await buscarTablasEvento();
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo guardar la configuración", "error");
  }
}

async function reiniciarFormatoClasificacion() {
  if (!tablasEventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría primero.", "warning");
    return;
  }
  const ok = await window.mostrarConfirmacion({
    titulo: "Reiniciar configuración",
    mensaje:
      "Se desbloqueará la configuración compartida y se limpiará la selección manual de clasificados. ¿Continuar?",
    tipo: "warning",
    textoConfirmar: "Reiniciar",
    claseConfirmar: "btn-warning",
  });
  if (!ok) return;
  try {
    const resp = await ApiClient.delete(`/eliminatorias/evento/${tablasEventoSeleccionado}/configuracion`);
    tablasConfigPlayoff = resp || null;
    if (resp?.evento) {
      tablasEventosCache = tablasEventosCache.map((item) =>
        Number(item.id) === Number(tablasEventoSeleccionado) ? { ...item, ...resp.evento } : item
      );
    }
    const eventoSel = tablasEventosCache.find((e) => Number(e.id) === Number(tablasEventoSeleccionado));
    actualizarFormularioFormato(eventoSel || resp?.evento || null);
    mostrarNotificacion("Configuración reiniciada", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo reiniciar la configuración", "error");
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
    if (tablasEventoSeleccionado) {
      await cargarConfiguracionCompetenciaCompartida();
    }
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
      metodo_competencia: eventoPos?.metodo_competencia || item.metodo_competencia || "grupos",
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

  tablasGrupoEditando = null;
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
  tablasUltimoPayloadPosiciones = null;
  tablasGrupoEditando = null;
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

function construirResumenGrupoEditable(grupo = {}, idx = 0) {
  const grupoMeta = grupo?.grupo || {};
  const grupoId = parsePositiveInt(grupoMeta?.id);
  return {
    key: claveGrupoTablaManual(grupoMeta),
    grupo_id: grupoId,
    titulo:
      grupoMeta?.letra_grupo && grupoMeta.letra_grupo !== "-"
        ? `Grupo ${grupoMeta.letra_grupo}`
        : grupoMeta?.nombre_grupo || "Tabla general",
    clasificados_por_grupo: parsePositiveInt(
      grupoMeta?.clasificados_por_grupo ?? tablasUltimoPayloadPosiciones?.evento?.clasificados_por_grupo
    ),
    index: idx,
  };
}

function renderAccionesGrupoTabla(grupo = {}) {
  if (!esAdministradorTablas()) return "";
  const info = construirResumenGrupoEditable(grupo);
  const metaManual = grupo?.grupo?.edicion_manual_meta || {};
  const fechaManual = metaManual?.updated_at
    ? new Date(metaManual.updated_at).toLocaleString("es-EC")
    : "";
  return `
    <div class="tablas-admin-actions">
      <div class="tablas-admin-copy">
        ${
          grupo?.grupo?.edicion_manual_activa
            ? `<span class="tabla-posicion-chip is-neutral">Edición manual activa${fechaManual ? ` · ${escaparHtml(fechaManual)}` : ""}</span>`
            : `<span class="tabla-posicion-chip is-neutral">Tabla automática</span>`
        }
      </div>
      <div class="tablas-admin-btns">
        <button class="btn btn-secondary btn-sm" type="button" data-tabla-action="editar" data-tabla-grupo="${escaparHtml(info.key)}">
          <i class="fas fa-pen"></i> Editar tabla
        </button>
        ${
          grupo?.grupo?.edicion_manual_activa
            ? `<button class="btn btn-warning btn-sm" type="button" data-tabla-action="reset" data-tabla-grupo="${escaparHtml(info.key)}">
                <i class="fas fa-rotate-left"></i> Restablecer
              </button>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderTablaPosicionesEditable(grupo = {}) {
  const info = construirResumenGrupoEditable(grupo);
  const tabla = Array.isArray(grupo?.tabla) ? grupo.tabla : [];
  const rows = tabla
    .map((row, idx) => {
      const est = row?.estadisticas || {};
      const equipoId = Number(row?.equipo?.id || 0);
      const eliminado = row?.eliminado_competencia === true || row?.eliminado_manual === true;
      return `
        <tr class="${eliminado ? "tabla-posicion-eliminado" : ""}"
            data-base-victorias-shootouts="${Number(est.victorias_shootouts || 0)}"
            data-base-derrotas-shootouts="${Number(est.derrotas_shootouts || 0)}">
          <td>
            <input type="number" min="1" step="1" class="tabla-manual-input"
              data-manual-key="${escaparHtml(info.key)}"
              data-manual-equipo="${equipoId}"
              data-manual-field="posicion_deportiva"
              title="La posición se usa como desempate manual cuando los equipos quedan igualados."
              value="${Number(row?.posicion_deportiva || row?.posicion || idx + 1)}" />
          </td>
          <td>
            <div class="tabla-posicion-equipo">
              <span>${escaparHtml(row?.equipo?.nombre || "-")}</span>
              ${renderEstadoPosicion(row)}
            </div>
          </td>
          <td><input type="number" min="0" step="1" class="tabla-manual-input" data-manual-key="${escaparHtml(info.key)}" data-manual-equipo="${equipoId}" data-manual-field="partidos_jugados" value="${Number(est.partidos_jugados || 0)}" title="PJ es editable manualmente para correcciones administrativas." /></td>
          <td><input type="number" min="0" step="1" class="tabla-manual-input" data-manual-key="${escaparHtml(info.key)}" data-manual-equipo="${equipoId}" data-manual-field="partidos_ganados" value="${Number(est.partidos_ganados || 0)}" /></td>
          <td><input type="number" min="0" step="1" class="tabla-manual-input" data-manual-key="${escaparHtml(info.key)}" data-manual-equipo="${equipoId}" data-manual-field="partidos_empatados" value="${Number(est.partidos_empatados || 0)}" /></td>
          <td><input type="number" min="0" step="1" class="tabla-manual-input" data-manual-key="${escaparHtml(info.key)}" data-manual-equipo="${equipoId}" data-manual-field="partidos_perdidos" value="${Number(est.partidos_perdidos || 0)}" /></td>
          <td><input type="number" min="0" step="1" class="tabla-manual-input" data-manual-key="${escaparHtml(info.key)}" data-manual-equipo="${equipoId}" data-manual-field="goles_favor" value="${Number(est.goles_favor || 0)}" /></td>
          <td><input type="number" min="0" step="1" class="tabla-manual-input" data-manual-key="${escaparHtml(info.key)}" data-manual-equipo="${equipoId}" data-manual-field="goles_contra" value="${Number(est.goles_contra || 0)}" /></td>
          <td><strong data-manual-key="${escaparHtml(info.key)}" data-manual-equipo="${equipoId}" data-manual-dg="1">${Number(est.diferencia_goles || row?.diferencia_goles || 0)}</strong></td>
          <td><input type="number" min="0" step="1" class="tabla-manual-input" data-manual-key="${escaparHtml(info.key)}" data-manual-equipo="${equipoId}" data-manual-field="puntos" value="${Number(row?.puntos || 0)}" readonly title="PTS se calcula automáticamente según PG, PE y PP." /></td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="tablas-manual-wrap">
      <p class="tablas-clasificacion-help">
        Solo administrador puede corregir esta tabla. PJ es editable manualmente; DG y PTS se recalculan automáticamente según los valores editados. Si dos equipos quedan idénticos, la posición manual sirve como desempate. Los equipos eliminados seguirán fuera de clasificación.
      </p>
      <div class="tabla-scroll">
        <table class="tabla-estadistica tabla-estadistica-posiciones">
          <thead>
            <tr>
              <th>Pos.</th>
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
      <div class="form-group" style="margin-top:1rem;">
        <label for="tablas-manual-comment-${escaparHtml(info.key)}">Comentario de auditoría</label>
        <textarea id="tablas-manual-comment-${escaparHtml(info.key)}" rows="3" placeholder="Explica la corrección aplicada por el administrador."></textarea>
      </div>
      <div class="tablas-admin-btns">
        <button class="btn btn-success btn-sm" type="button" data-tabla-action="save" data-tabla-grupo="${escaparHtml(info.key)}">
          <i class="fas fa-save"></i> Guardar corrección
        </button>
        <button class="btn btn-secondary btn-sm" type="button" data-tabla-action="cancel" data-tabla-grupo="${escaparHtml(info.key)}">
          <i class="fas fa-xmark"></i> Cancelar
        </button>
      </div>
    </div>
  `;
}

async function manejarAccionesTablaManual(event) {
  const btn = event.target.closest("[data-tabla-action]");
  if (!btn) return;
  const accion = String(btn.getAttribute("data-tabla-action") || "").trim();
  const grupoKey = String(btn.getAttribute("data-tabla-grupo") || "").trim();
  if (!accion || !grupoKey || !esAdministradorTablas()) return;

  if (accion === "editar") {
    tablasGrupoEditando = grupoKey;
    renderPosiciones(tablasUltimoPayloadPosiciones || {});
    return;
  }
  if (accion === "cancel") {
    tablasGrupoEditando = null;
    renderPosiciones(tablasUltimoPayloadPosiciones || {});
    return;
  }
  if (accion === "save") {
    await guardarTablaManualGrupo(grupoKey);
    return;
  }
  if (accion === "reset") {
    await restablecerTablaManualGrupo(grupoKey);
  }
}

function recolectarFilasTablaManual(grupoKey) {
  const inputs = Array.from(document.querySelectorAll(`.tabla-manual-input[data-manual-key="${grupoKey}"]`));
  const filasMap = new Map();
  inputs.forEach((input) => {
    const equipoId = parsePositiveInt(input.getAttribute("data-manual-equipo"));
    const field = String(input.getAttribute("data-manual-field") || "").trim();
    if (!equipoId || !field) return;
    if (!filasMap.has(equipoId)) filasMap.set(equipoId, { equipo_id: equipoId });
    filasMap.get(equipoId)[field] = Number.parseInt(input.value || "0", 10) || 0;
  });
  return Array.from(filasMap.values());
}

function compararFilasTablaManual(a = {}, b = {}, reglas = []) {
  const reglasAplicadas = Array.isArray(reglas) && reglas.length
    ? reglas
    : ["puntos", "diferencia_goles", "goles_favor"];
  for (const regla of reglasAplicadas) {
    if (regla === "puntos" && Number(b.puntos || 0) !== Number(a.puntos || 0)) {
      return Number(b.puntos || 0) - Number(a.puntos || 0);
    }
    if (
      regla === "diferencia_goles" &&
      Number(b.diferencia_goles || 0) !== Number(a.diferencia_goles || 0)
    ) {
      return Number(b.diferencia_goles || 0) - Number(a.diferencia_goles || 0);
    }
    if (regla === "goles_favor" && Number(b.goles_favor || 0) !== Number(a.goles_favor || 0)) {
      return Number(b.goles_favor || 0) - Number(a.goles_favor || 0);
    }
    if (regla === "goles_contra" && Number(a.goles_contra || 0) !== Number(b.goles_contra || 0)) {
      return Number(a.goles_contra || 0) - Number(b.goles_contra || 0);
    }
    if (
      regla === "menos_perdidos" &&
      Number(a.partidos_perdidos || 0) !== Number(b.partidos_perdidos || 0)
    ) {
      return Number(a.partidos_perdidos || 0) - Number(b.partidos_perdidos || 0);
    }
  }

  if (Number(a.posicion_deportiva || 0) !== Number(b.posicion_deportiva || 0)) {
    return Number(a.posicion_deportiva || 9999) - Number(b.posicion_deportiva || 9999);
  }

  return String(a.nombre || "").localeCompare(String(b.nombre || ""));
}

function reordenarTablaManualGrupo(grupoKey) {
  const data = tablasUltimoPayloadPosiciones || {};
  const grupos = Array.isArray(data?.grupos) ? data.grupos : [];
  const grupo = grupos.find((item) => claveGrupoTablaManual(item?.grupo || {}) === grupoKey);
  const sistema = obtenerSistemaPuntuacionGrupo(grupo || {});
  const tbody = document.querySelector(`.tabla-manual-input[data-manual-key="${grupoKey}"]`)?.closest("tbody");
  if (!grupo || !tbody) return;

  const filas = Array.from(tbody.querySelectorAll("tr"));
  const resumen = filas.map((tr, idx) => {
    const equipoId = parsePositiveInt(
      tr.querySelector('[data-manual-field="puntos"]')?.getAttribute("data-manual-equipo")
    );
    const nombre = tr.querySelector(".tabla-posicion-equipo span")?.textContent?.trim() || "";
    const golesFavor = numeroManual(
      tr.querySelector('[data-manual-field="goles_favor"]')?.value,
      0
    );
    const golesContra = numeroManual(
      tr.querySelector('[data-manual-field="goles_contra"]')?.value,
      0
    );
    const dg = golesFavor - golesContra;
    const dgNode = tr.querySelector(`[data-manual-dg="1"][data-manual-equipo="${equipoId}"]`);
    if (dgNode) dgNode.textContent = String(dg);
    const partidosGanados = numeroManual(
      tr.querySelector('[data-manual-field="partidos_ganados"]')?.value,
      0
    );
    const partidosEmpatados = numeroManual(
      tr.querySelector('[data-manual-field="partidos_empatados"]')?.value,
      0
    );
    const partidosPerdidos = numeroManual(
      tr.querySelector('[data-manual-field="partidos_perdidos"]')?.value,
      0
    );
    const pjInput = tr.querySelector('[data-manual-field="partidos_jugados"]');
    const partidosJugados = numeroManual(pjInput?.value, 0);
    const puntosCalculados = calcularPuntosFilaManual(
      {
        partidos_ganados: partidosGanados,
        partidos_empatados: partidosEmpatados,
        partidos_perdidos: partidosPerdidos,
      },
      tr,
      sistema
    );
    const puntosInput = tr.querySelector('[data-manual-field="puntos"]');
    if (puntosInput) puntosInput.value = String(puntosCalculados);

    return {
      tr,
      equipo_id: equipoId,
      nombre,
      posicion_deportiva: numeroManual(
        tr.querySelector('[data-manual-field="posicion_deportiva"]')?.value,
        idx + 1
      ),
      partidos_jugados: partidosJugados,
      partidos_ganados: partidosGanados,
      partidos_empatados: partidosEmpatados,
      partidos_perdidos: partidosPerdidos,
      goles_favor: golesFavor,
      goles_contra: golesContra,
      diferencia_goles: dg,
      puntos: puntosCalculados,
    };
  });

  resumen.sort((a, b) => compararFilasTablaManual(a, b, obtenerReglasGrupoManual(grupo)));
  resumen.forEach((fila, idx) => {
    const posInput = fila.tr.querySelector('[data-manual-field="posicion_deportiva"]');
    if (posInput) posInput.value = String(idx + 1);
    tbody.appendChild(fila.tr);
  });
}

async function guardarTablaManualGrupo(grupoKey) {
  const data = tablasUltimoPayloadPosiciones || {};
  const grupos = Array.isArray(data?.grupos) ? data.grupos : [];
  const grupo = grupos.find((item) => claveGrupoTablaManual(item?.grupo || {}) === grupoKey);
  if (!grupo || !tablasEventoSeleccionado) return;

  const comentario = String(
    document.getElementById(`tablas-manual-comment-${grupoKey}`)?.value || ""
  ).trim();
  if (comentario.length < 5) {
    mostrarNotificacion("Debes registrar un comentario de auditoría claro.", "warning");
    return;
  }

  const filas = recolectarFilasTablaManual(grupoKey);
  if (!filas.length) {
    mostrarNotificacion("No se pudieron leer los datos editados de la tabla.", "warning");
    return;
  }

  try {
    const resp = await ApiClient.put(`/tablas/evento/${tablasEventoSeleccionado}/posiciones/manual`, {
      grupo_id: parsePositiveInt(grupo?.grupo?.id),
      comentario,
      filas,
    });
    tablasGrupoEditando = null;
    tablasUltimoPayloadPosiciones = resp || null;
    sincronizarFormatoConPosiciones(resp || {});
    renderPosiciones(resp || {});
    mostrarNotificacion("Corrección manual aplicada con auditoría.", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo guardar la corrección manual.", "error");
  }
}

async function restablecerTablaManualGrupo(grupoKey) {
  const data = tablasUltimoPayloadPosiciones || {};
  const grupos = Array.isArray(data?.grupos) ? data.grupos : [];
  const grupo = grupos.find((item) => claveGrupoTablaManual(item?.grupo || {}) === grupoKey);
  if (!grupo || !tablasEventoSeleccionado) return;

  const comentario = await window.mostrarPrompt({
    titulo: "Restablecer tabla manual",
    mensaje: "Registra el motivo de auditoría para volver a la tabla automática.",
    label: "Comentario",
    placeholder: "Motivo del restablecimiento",
    required: true,
    rows: 3,
    inputType: "textarea",
    textoConfirmar: "Restablecer",
    claseConfirmar: "btn-warning",
  });
  if (!comentario || String(comentario).trim().length < 5) {
    mostrarNotificacion("El comentario de auditoría es obligatorio.", "warning");
    return;
  }

  try {
    const resp = await ApiClient.post(`/tablas/evento/${tablasEventoSeleccionado}/posiciones/manual/reset`, {
      grupo_id: parsePositiveInt(grupo?.grupo?.id),
      comentario: String(comentario).trim(),
    });
    tablasGrupoEditando = null;
    tablasUltimoPayloadPosiciones = resp || null;
    sincronizarFormatoConPosiciones(resp || {});
    renderPosiciones(resp || {});
    mostrarNotificacion("La tabla volvió al cálculo automático.", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo restablecer la tabla.", "error");
  }
}

function renderPosiciones(data) {
  const cont = document.getElementById("tablas-posiciones");
  if (!cont) return;
  tablasUltimoPayloadPosiciones = data || null;

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
    .map((g, idx) => {
      const tabla = Array.isArray(g.tabla) ? g.tabla : [];
      const tituloGrupo = g?.grupo?.letra_grupo && g.grupo.letra_grupo !== "-"
        ? `Grupo ${g.grupo.letra_grupo}`
        : g?.grupo?.nombre_grupo || "Tabla general";
      const cuposGrupo = Number.parseInt(
        g?.grupo?.clasificados_por_grupo ?? data?.evento?.clasificados_por_grupo,
        10
      );
      const grupoKey = claveGrupoTablaManual(g?.grupo || {});
      const enEdicion = esAdministradorTablas() && tablasGrupoEditando === grupoKey;

      return `
        <div class="card tablas-grupo-card">
          <div class="section-head-inline">
            <h3>${escaparHtml(tituloGrupo)}</h3>
          </div>
          ${renderAccionesGrupoTabla(g)}
          ${enEdicion ? renderTablaPosicionesEditable(g, idx) : renderTablaPosiciones(tabla, cuposGrupo)}
        </div>
      `;
    })
    .join("");

  cont.innerHTML = `${resumen}<div class="tablas-grid">${gruposHtml}</div>`;
}

function renderEstadoPosicion(row = {}) {
  const noPresentaciones = Number(row.no_presentaciones || 0);
  if (noPresentaciones > 0) {
    return `
      <div class="tabla-posicion-status">
        <span class="tabla-posicion-chip is-neutral">NP ${noPresentaciones}</span>
      </div>
    `;
  }
  return "";
}

function obtenerMotivoEliminacionTabla(row = {}) {
  if (row.eliminado_manual === true) {
    return row.motivo_eliminacion_label || "Eliminado manualmente";
  }
  const noPresentaciones = Number(row.no_presentaciones || 0);
  if (row.eliminado_automatico === true && noPresentaciones > 0) {
    return `${noPresentaciones} no presentaciones`;
  }
  return row.eliminado_competencia === true ? "Equipo eliminado" : "";
}

function renderCeldaEliminadoTabla(row = {}, classes = "") {
  const motivo = obtenerMotivoEliminacionTabla(row);
  const className = [classes, "tabla-posicion-eliminado-main"].filter(Boolean).join(" ");
  return `
    <td class="${className}" colspan="8" ${motivo ? `title="${escaparHtml(motivo)}"` : ""}>
      <div class="tabla-posicion-eliminado-overlay">ELIMINADO</div>
    </td>
  `;
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
      const eliminado = row.eliminado_competencia === true || row.eliminado_manual === true;
      const classes = [
        fuera ? "tabla-posicion-fuera" : "",
        eliminado ? "tabla-posicion-eliminado" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const statsHtml = eliminado
        ? renderCeldaEliminadoTabla(row, classes)
        : `
          <td>${Number(est.partidos_jugados || 0)}</td>
          <td>${Number(est.partidos_ganados || 0)}</td>
          <td>${Number(est.partidos_empatados || 0)}</td>
          <td>${Number(est.partidos_perdidos || 0)}</td>
          <td>${Number(est.goles_favor || 0)}</td>
          <td>${Number(est.goles_contra || 0)}</td>
          <td>${Number(est.diferencia_goles || 0)}</td>
          <td><strong>${Number(row.puntos || 0)}</strong></td>
        `;
      return `
        <tr class="${classes}">
          <td>${posicion}</td>
          <td>
            <div class="tabla-posicion-equipo">
              <span>${escaparHtml(row?.equipo?.nombre || "-")}</span>
              ${renderEstadoPosicion(row)}
            </div>
          </td>
          ${statsHtml}
        </tr>
      `;
    })
    .join("");

  return `
    ${
      Number.isFinite(Number(clasificanPorGrupo)) && Number(clasificanPorGrupo) > 0
        ? `<p class="tablas-clasificacion-help">
             Se pintan en naranja los equipos fuera de clasificación y en rojo oscuro los equipos eliminados.
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




