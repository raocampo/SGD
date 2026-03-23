const RONDAS_ORDEN_ELI = ["32vos", "16vos", "12vos", "8vos", "4tos", "semifinal", "final", "tercer_puesto"];
const BACKEND_BASE = (window.resolveBackendBaseUrl
  ? window.resolveBackendBaseUrl()
  : `${window.location.origin}`).replace(/\/$/, "");
const EMBED_MODE = new URLSearchParams(window.location.search).get("embed") === "1";
const ELI_TAB_DEFAULT = "config";

let eliminatoriaState = {
  eventos: [],
  gruposEvento: [],
  cruces: [],
  eventoSeleccionado: null,
  configuracionPlayoff: null,
  esAdminLike: false,
  motivosEliminacion: [],
  equiposEvento: [],
  resumenClasificacion: null,
  contextoPublicacion: {
    campeonatoId: null,
    campeonatoNombre: "",
    eventoNombre: "",
    organizador: "",
    logoUrl: null,
    auspiciantes: [],
    fondoPersonalizado: "",
  },
  rondaJornadaSeleccionada: "",
};
let listenersConectoresExportInicializados = false;

function obtenerTabEliminatoriaActual() {
  return (
    document.querySelector(".eli-main-tab.active")?.getAttribute("data-eli-tab-target") ||
    ELI_TAB_DEFAULT
  );
}

function activarTabEliminatoria(tabKey = ELI_TAB_DEFAULT) {
  const tabs = Array.from(document.querySelectorAll(".eli-main-tab"));
  const visibles = tabs.filter((tab) => tab.style.display !== "none");
  const destinoExiste = visibles.some((tab) => tab.getAttribute("data-eli-tab-target") === tabKey);
  const destino = destinoExiste
    ? tabKey
    : visibles[0]?.getAttribute("data-eli-tab-target") || ELI_TAB_DEFAULT;

  tabs.forEach((tab) => {
    const activa = tab.getAttribute("data-eli-tab-target") === destino && tab.style.display !== "none";
    tab.classList.toggle("active", activa);
    tab.setAttribute("aria-selected", activa ? "true" : "false");
    tab.setAttribute("tabindex", activa ? "0" : "-1");
  });

  document.querySelectorAll("[data-eli-tab-panel]").forEach((panel) => {
    const activa = panel.getAttribute("data-eli-tab-panel") === destino;
    panel.classList.toggle("active", activa);
    panel.hidden = !activa;
  });
}

function inicializarTabsEliminatoria() {
  document.querySelectorAll(".eli-main-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activarTabEliminatoria(tab.getAttribute("data-eli-tab-target") || ELI_TAB_DEFAULT);
    });
  });
  activarTabEliminatoria(ELI_TAB_DEFAULT);
}

function parsePositiveInt(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asegurarOpcionesClasificadosPorGrupo(valorActual = null) {
  const select = document.getElementById("eli-clasificados");
  if (!select) return;
  const valorNormalizado = parsePositiveInt(valorActual) || parsePositiveInt(select.value) || 2;
  const maximo = Math.max(16, valorNormalizado);
  const valorPrevio = parsePositiveInt(select.value) || valorNormalizado;
  select.innerHTML = Array.from({ length: maximo }, (_, idx) => {
    const cupo = idx + 1;
    return `<option value="${cupo}">${cupo} por grupo</option>`;
  }).join("");
  select.value = String(valorPrevio);
}

function obtenerClasificadosPorGrupoActual() {
  const evento = obtenerEventoActual();
  const select = document.getElementById("eli-clasificados");
  const valorUI = parsePositiveInt(select?.value || "");
  const valorEvento = parsePositiveInt(
    evento?.clasificados_por_grupo ||
      eliminatoriaState.configuracionPlayoff?.evento?.clasificados_por_grupo ||
      eliminatoriaState.resumenClasificacion?.clasificados_por_grupo
  );
  const clasificados = valorUI || valorEvento || 2;
  asegurarOpcionesClasificadosPorGrupo(clasificados);
  if (select) select.value = String(clasificados);
  return clasificados;
}

function actualizarEventoCache(eventoId, cambios = {}) {
  const id = Number.parseInt(eventoId, 10);
  if (!Number.isFinite(id)) return null;
  let actualizado = null;
  eliminatoriaState.eventos = eliminatoriaState.eventos.map((evento) => {
    if (Number(evento.id) !== id) return evento;
    actualizado = { ...evento, ...cambios };
    return actualizado;
  });
  return actualizado;
}

function obtenerMetodoCompetenciaVisibleEliminatoria(evento = {}) {
  if (evento?.clasificacion_tabla_acumulada === true) return "tabla_acumulada";
  return String(evento?.metodo_competencia || "grupos").toLowerCase();
}

function formatearPlantillaLlaveEliminatoria(valor) {
  const key = String(valor || "estandar").toLowerCase();
  if (key === "balanceada_8vos") return "Evitar reencuentros tempranos de grupo (balanceada)";
  if (key === "mejores_perdedores_12vos") return "Mejores perdedores (24 -> 12vos -> 8vos)";
  return "Estándar";
}

function nombrePlaceholderEliminatoria(partido = {}, lado = "local") {
  const sideKey = lado === "visitante" ? "visitante" : "local";
  const equipoNombre = partido?.[`equipo_${sideKey}_nombre`] || null;
  if (equipoNombre) return equipoNombre;
  const seedRef = String(partido?.[`seed_${sideKey}_ref`] || "").trim().toUpperCase();
  if (/^MP\d+$/.test(seedRef)) {
    return `Mejor perdedor ${seedRef.replace("MP", "")}`;
  }
  return "Por definir";
}

function obtenerNombreNodoPublicacion(partido = {}, lado = "local") {
  const sideKey = lado === "visitante" ? "visitante" : "local";
  const equipoNombre = String(partido?.[`equipo_${sideKey}_nombre`] || "").trim();
  if (equipoNombre) return equipoNombre;
  const seedRef = String(partido?.[`seed_${sideKey}_ref`] || "").trim().toUpperCase();
  if (/^MP\d+$/.test(seedRef)) {
    return `Mejor perdedor ${seedRef.replace("MP", "")}`;
  }
  return "Por definir";
}

function obtenerClaveFondoPlayoff() {
  const ctx = eliminatoriaState.contextoPublicacion || {};
  const eventoId = Number.parseInt(eliminatoriaState.eventoSeleccionado || "", 10) || "na";
  const campeonatoId = Number.parseInt(ctx.campeonatoId || "", 10) || "na";
  return `eli-playoff-bg:${campeonatoId}:${eventoId}`;
}

function aplicarFondoPublicacion(url = "") {
  const zonas = [
    document.getElementById("eli-zona-export"),
    document.getElementById("eli-jornada-export"),
  ].filter(Boolean);
  const status = document.getElementById("eli-export-bg-status");
  const clearBtn = document.getElementById("btn-eli-clear-bg");
  const limpio = String(url || "").trim();

  zonas.forEach((zona) => {
    if (limpio) {
      zona.classList.add("has-custom-background");
      zona.style.setProperty("--eli-export-custom-bg", `url("${limpio.replace(/"/g, "%22")}")`);
    } else {
      zona.classList.remove("has-custom-background");
      zona.style.removeProperty("--eli-export-custom-bg");
    }
  });

  if (status) {
    status.textContent = limpio
      ? "Fondo personalizado cargado para esta categoría."
      : "Sin fondo personalizado.";
  }
  if (clearBtn) clearBtn.disabled = !limpio;
  if (eliminatoriaState.contextoPublicacion) {
    eliminatoriaState.contextoPublicacion.fondoPersonalizado = limpio;
  }
}

function restaurarFondoPublicacionGuardado() {
  try {
    const valor = window.localStorage?.getItem?.(obtenerClaveFondoPlayoff()) || "";
    aplicarFondoPublicacion(valor);
  } catch (error) {
    console.warn("No se pudo restaurar el fondo del playoff:", error);
    aplicarFondoPublicacion("");
  }
}

async function manejarCambioFondoPublicacion(event) {
  const archivo = event?.target?.files?.[0];
  if (!archivo) return;
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
      reader.readAsDataURL(archivo);
    });
    window.localStorage?.setItem?.(obtenerClaveFondoPlayoff(), dataUrl);
    aplicarFondoPublicacion(dataUrl);
    mostrarNotificacion("Fondo cargado para la plantilla", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion("No se pudo cargar el fondo", "error");
  } finally {
    if (event?.target) event.target.value = "";
  }
}

function limpiarFondoPublicacion() {
  try {
    window.localStorage?.removeItem?.(obtenerClaveFondoPlayoff());
  } catch (error) {
    console.warn("No se pudo limpiar el fondo guardado:", error);
  }
  aplicarFondoPublicacion("");
}

function obtenerCrucesConfiguradosDesdeWrap(wrap) {
  if (!wrap) return [];
  const aSelects = Array.from(wrap.querySelectorAll("select[data-cruce-a]"));
  const cruces = [];
  for (const selA of aSelects) {
    const idx = selA.getAttribute("data-cruce-a");
    const selB = wrap.querySelector(`select[data-cruce-b="${idx}"]`);
    const a = String(selA.value || "").toUpperCase().trim();
    const b = String(selB?.value || "").toUpperCase().trim();
    if (!a || !b || a === b) continue;
    cruces.push([a, b]);
  }
  return cruces;
}

function obtenerCrucesPorDefecto(letras = [], plantillaLlave = "estandar", clasificados = 2) {
  const grupos = Array.isArray(letras)
    ? letras.map((letra) => String(letra || "").toUpperCase().trim()).filter(Boolean)
    : [];
  if (
    String(plantillaLlave || "estandar").toLowerCase() === "balanceada_8vos" &&
    grupos.length === 4 &&
    Number(clasificados || 0) >= 4
  ) {
    return [
      [grupos[0], grupos[2]],
      [grupos[1], grupos[3]],
    ];
  }

  const pares = Math.floor(grupos.length / 2);
  return Array.from({ length: pares }, (_, i) => [grupos[i], grupos[grupos.length - 1 - i]]);
}

function obtenerEtiquetaRondaInicial(totalEquipos = 0) {
  const mapa = {
    4: "SEM",
    8: "4TO",
    16: "8VO",
    32: "16VO",
  };
  return mapa[Number(totalEquipos)] || "P";
}

function construirPreviewBalanceadaCuatroGrupos(cruces = []) {
  if (!Array.isArray(cruces) || cruces.length !== 2) return [];
  const [parA, parB] = cruces;
  if (!Array.isArray(parA) || !Array.isArray(parB) || parA.length < 2 || parB.length < 2) return [];
  const [g1, g2] = parA;
  const [g3, g4] = parB;
  return [
    `8VO P1: 1${g1} vs 4${g2}`,
    `8VO P2: 2${g3} vs 3${g4}`,
    `8VO P3: 1${g4} vs 4${g3}`,
    `8VO P4: 2${g2} vs 3${g1}`,
    `8VO P5: 1${g3} vs 4${g4}`,
    `8VO P6: 2${g1} vs 3${g2}`,
    `8VO P7: 1${g2} vs 4${g1}`,
    `8VO P8: 2${g4} vs 3${g3}`,
  ];
}

function construirPreviewBalanceadaDosGrupos(cruces = [], clasificados = 2) {
  if (!Array.isArray(cruces) || cruces.length !== 1) return [];
  const [par] = cruces;
  if (!Array.isArray(par) || par.length < 2) return [];
  const [g1, g2] = par.map((item) => String(item || "").toUpperCase().trim());
  const cupos = Math.max(2, Number.parseInt(clasificados, 10) || 0);
  const mitad = Math.ceil(cupos / 2);
  const etiqueta = obtenerEtiquetaRondaInicial(cupos * 2);
  const preview = [];
  for (let idx = 1; idx <= cupos; idx += 1) {
    const indiceLado = idx <= mitad ? idx : idx - mitad;
    const visitaPosicion = cupos - indiceLado + 1;
    const ladoIzquierdo = idx <= mitad;
    const impar = indiceLado % 2 === 1;
    let local = `${indiceLado}${g1}`;
    let visita = `${visitaPosicion}${g2}`;
    if (ladoIzquierdo) {
      if (!impar) {
        local = `${indiceLado}${g2}`;
        visita = `${visitaPosicion}${g1}`;
      }
    } else if (impar) {
      local = `${indiceLado}${g2}`;
      visita = `${visitaPosicion}${g1}`;
    }
    preview.push(`${etiqueta} P${idx}: ${local} vs ${visita}`);
  }
  return preview;
}

function renderVistaPreviaBalanceadaBracket16(preview = []) {
  const izquierda = preview.slice(0, 4);
  const derecha = preview.slice(4, 8);
  const renderNode = (item) => {
    const [head, body] = String(item || "").split(": ");
    return `${escapeHtml(head || "")}<br>${escapeHtml(body || "")}`;
  };
  return `
    <div class="eli-cruces-preview-card eli-cruces-preview-bracket">
      <strong>Vista previa sugerida de playoff balanceado</strong>
      <p>Con esta plantilla se minimizan reencuentros tempranos entre equipos del mismo grupo.</p>
      <div class="eli-preview-bracket16">
        <div class="eli-preview-col eli-preview-col-first">
          ${izquierda.map((item) => `<div class="eli-preview-node">${renderNode(item)}</div>`).join("")}
        </div>
        <div class="eli-preview-col eli-preview-col-stage">
          <div class="eli-preview-node eli-preview-node-stage">4TO G1<br><small>P1 vs P2</small></div>
          <div class="eli-preview-node eli-preview-node-stage">4TO G2<br><small>P3 vs P4</small></div>
        </div>
        <div class="eli-preview-col eli-preview-col-stage">
          <div class="eli-preview-node eli-preview-node-stage">SEM G1<br><small>G1 vs G2</small></div>
          <div class="eli-preview-node eli-preview-node-stage">SEM G2<br><small>G3 vs G4</small></div>
        </div>
        <div class="eli-preview-col eli-preview-col-center">
          <div class="eli-preview-node eli-preview-node-stage">FINAL<br><small>G1 vs G2</small></div>
          <div class="eli-preview-node eli-preview-node-stage">TERCER Y CUARTO<br><small>P1 vs P2</small></div>
        </div>
        <div class="eli-preview-col eli-preview-col-stage">
          <div class="eli-preview-node eli-preview-node-stage">4TO G3<br><small>P5 vs P6</small></div>
          <div class="eli-preview-node eli-preview-node-stage">4TO G4<br><small>P7 vs P8</small></div>
        </div>
        <div class="eli-preview-col eli-preview-col-first">
          ${derecha.map((item) => `<div class="eli-preview-node">${renderNode(item)}</div>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderVistaPreviaBalanceadaChips(preview = []) {
  return `
    <div class="eli-cruces-preview-card">
      <strong>Vista previa sugerida de playoff balanceado</strong>
      <p>Con esta plantilla se minimizan reencuentros tempranos entre equipos del mismo grupo.</p>
      <div class="eli-cruces-preview-grid">
        ${preview.map((item) => `<span class="eli-cruces-preview-chip">${escapeHtml(item)}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderVistaPreviaBalanceada(preview = []) {
  if (preview.length === 8 && preview.every((item) => String(item || "").startsWith("8VO "))) {
    return renderVistaPreviaBalanceadaBracket16(preview);
  }
  return renderVistaPreviaBalanceadaChips(preview);
}

function construirVistaPreviaBalanceada(cruces = [], clasificados = 2) {
  if (!Array.isArray(cruces) || !cruces.length) return [];
  if (cruces.length === 2 && Number(clasificados || 0) >= 4) {
    return construirPreviewBalanceadaCuatroGrupos(cruces);
  }
  if (cruces.length === 1 && Number(clasificados || 0) >= 2) {
    return construirPreviewBalanceadaDosGrupos(cruces, clasificados);
  }
  return [];
}

function renderVistaPreviaCruces(cruces = []) {
  const cont = document.getElementById("eli-cruces-preview");
  if (!cont) return;
  const plantilla = String(document.getElementById("eli-plantilla-llave")?.value || "estandar").toLowerCase();
  const clasificados = obtenerClasificadosPorGrupoActual();
  if (plantilla !== "balanceada_8vos") {
    cont.innerHTML = "";
    return;
  }
  const preview = construirVistaPreviaBalanceada(cruces, clasificados);
  if (!preview.length) {
    cont.innerHTML = "";
    return;
  }
  cont.innerHTML = renderVistaPreviaBalanceada(preview);
}

function aplicarBloqueoConfiguracionPlayoff(guardada = false) {
  const disabled = !!guardada;
  [
    "eli-evento",
    "eli-origen",
    "eli-clasificados",
    "eli-metodo-grupos",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el && id !== "eli-evento") el.disabled = disabled;
  });
  document.querySelectorAll("#eli-cruces-grupos select").forEach((el) => {
    el.disabled = disabled;
  });
  const btnGuardar = document.getElementById("btn-eli-guardar-config");
  const btnReset = document.getElementById("btn-eli-reset-config");
  if (btnGuardar) btnGuardar.style.display = disabled ? "none" : "";
  if (btnReset) btnReset.style.display = disabled ? "" : "none";
}

function actualizarEstadoVisualConfiguracionPlayoff() {
  const statusEl = document.getElementById("eli-config-status");
  const ayudaEl = document.getElementById("eli-aviso-metodo");
  const guardada = eliminatoriaState.configuracionPlayoff?.configuracion?.guardada === true;
  const guardadoEn = eliminatoriaState.configuracionPlayoff?.configuracion?.guardado_en || null;
  if (statusEl) {
    statusEl.textContent = guardada
      ? `Configuración guardada${guardadoEn ? ` el ${new Date(guardadoEn).toLocaleString("es-EC")}` : ""}. Usa Reiniciar configuración para modificarla.`
      : "La configuración actual todavía no está guardada. Guarda primero para compartirla con Tablas y Grupos.";
  }
  if (ayudaEl) {
    ayudaEl.classList.toggle("is-warning", !guardada);
  }
  aplicarBloqueoConfiguracionPlayoff(guardada);
}

async function cargarConfiguracionPlayoffCompartida({ notificar = false } = {}) {
  const eventoId = eliminatoriaState.eventoSeleccionado;
  if (!eventoId) {
    eliminatoriaState.configuracionPlayoff = null;
    actualizarMetaEvento();
    return null;
  }
  const resp = await ApiClient.get(`/eliminatorias/evento/${eventoId}/configuracion`);
  eliminatoriaState.configuracionPlayoff = resp || null;
  if (resp?.evento) {
    actualizarEventoCache(eventoId, resp.evento);
  }
  eliminatoriaState.gruposEvento = Array.isArray(resp?.configuracion?.grupos)
    ? resp.configuracion.grupos
        .map((grupo) => String(grupo?.letra_grupo || "").toUpperCase().trim())
        .filter(Boolean)
    : [];
  actualizarMetaEvento();
  if (notificar) {
    mostrarNotificacion("Configuración cargada", "success");
  }
  return resp;
}

async function guardarConfiguracionPlayoffCompartida({ silencioso = false } = {}) {
  if (!eliminatoriaState.esAdminLike) return true;
  const evento = obtenerEventoActual();
  const eventoId = eliminatoriaState.eventoSeleccionado;
  if (!eventoId || !evento) {
    mostrarNotificacion("Selecciona una categoría primero.", "warning");
    return false;
  }

  const metodoCompetencia = obtenerMetodoCompetenciaVisibleEliminatoria(evento);
  const clasificados = obtenerClasificadosPorGrupoActual();
  if (["grupos", "mixto", "liga", "tabla_acumulada"].includes(metodoCompetencia) && !clasificados) {
    mostrarNotificacion("Clasifican por grupo debe ser mayor a 0.", "warning");
    return false;
  }

  const origen = metodoCompetencia === "tabla_acumulada"
    ? "grupos"
    : String(document.getElementById("eli-origen")?.value || "grupos").toLowerCase();
  const metodoClasificacion = metodoCompetencia === "tabla_acumulada"
    ? "tabla_unica"
    : String(
        document.getElementById("eli-metodo-grupos")?.value || "cruces_grupos"
      ).toLowerCase();
  const plantillaLlave = String(
    document.getElementById("eli-plantilla-llave")?.value || "estandar"
  ).toLowerCase();
  const incluirTercerPuesto =
    String(document.getElementById("eli-tercer-puesto")?.value || "false").toLowerCase() === "true";
  const crucesGrupos =
    origen === "grupos" && metodoClasificacion === "cruces_grupos"
      ? obtenerCrucesConfigurados()
      : [];

  try {
    const resp = await ApiClient.put(`/eliminatorias/evento/${eventoId}/configuracion`, {
      metodo_competencia: metodoCompetencia,
      clasificados_por_grupo: clasificados,
      origen,
      metodo_clasificacion: metodoClasificacion,
      plantilla_llave: plantillaLlave,
      incluir_tercer_puesto: incluirTercerPuesto,
      cruces_grupos: crucesGrupos,
    });
    eliminatoriaState.configuracionPlayoff = resp || null;
    if (resp?.evento) {
      actualizarEventoCache(eventoId, resp.evento);
    }
    eliminatoriaState.gruposEvento = Array.isArray(resp?.configuracion?.grupos)
      ? resp.configuracion.grupos
          .map((grupo) => String(grupo?.letra_grupo || "").toUpperCase().trim())
          .filter(Boolean)
      : eliminatoriaState.gruposEvento;
    actualizarMetaEvento();
    if (!silencioso) {
      mostrarNotificacion("Configuración guardada", "success");
    }
    return true;
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo guardar la configuración", "error");
    return false;
  }
}

async function reiniciarConfiguracionPlayoffCompartida() {
  const eventoId = eliminatoriaState.eventoSeleccionado;
  if (!eventoId) {
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
    const resp = await ApiClient.delete(`/eliminatorias/evento/${eventoId}/configuracion`);
    eliminatoriaState.configuracionPlayoff = resp || null;
    if (resp?.evento) {
      actualizarEventoCache(eventoId, resp.evento);
    }
    eliminatoriaState.resumenClasificacion = null;
    actualizarMetaEvento();
    await refrescarGestionCompetitiva();
    mostrarNotificacion("Configuración reiniciada", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo reiniciar la configuración", "error");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("eliminatorias.html")) return;
  if (EMBED_MODE) {
    document.body.classList.add("embed-mode");
  }
  eliminatoriaState.esAdminLike = !!window.Auth?.isAdminLike?.();
  inicializarTabsEliminatoria();
  aplicarPermisosEliminatoriaUI();
  bindEventosEliminatoria();
  await cargarEventosEliminatoria();
  await preseleccionarEventoDesdeURL();
  await cargarContextoPublicacion(eliminatoriaState.eventoSeleccionado);
  actualizarUIPlayoffPorOrigen();
});

function aplicarPermisosEliminatoriaUI() {
  const adminTabs = document.querySelectorAll('.eli-main-tab[data-admin-only="true"]');
  const adminPanels = ["estado", "clasificacion"];

  if (eliminatoriaState.esAdminLike) {
    adminTabs.forEach((tab) => {
      tab.style.display = "";
    });
    adminPanels.forEach((panelKey) => {
      const panel = document.querySelector(`[data-eli-tab-panel="${panelKey}"]`);
      if (panel) panel.style.display = "";
    });
    return;
  }

  const btn = document.getElementById("btn-eli-generar");
  if (btn) btn.style.display = "none";
  const adminEstado = document.getElementById("eli-admin-estado-section");
  const adminClasif = document.getElementById("eli-admin-clasificacion-section");
  if (adminEstado) adminEstado.style.display = "none";
  if (adminClasif) adminClasif.style.display = "none";
  adminTabs.forEach((tab) => {
    tab.style.display = "none";
  });
  adminPanels.forEach((panelKey) => {
    const panel = document.querySelector(`[data-eli-tab-panel="${panelKey}"]`);
    if (panel) panel.style.display = "none";
  });
  if (["estado", "clasificacion"].includes(obtenerTabEliminatoriaActual())) {
    activarTabEliminatoria(ELI_TAB_DEFAULT);
  }
}

function bindEventosEliminatoria() {
  document.getElementById("eli-evento")?.addEventListener("change", async () => {
    const id = Number.parseInt(document.getElementById("eli-evento")?.value || "", 10);
    eliminatoriaState.eventoSeleccionado = Number.isFinite(id) ? id : null;
    window.RouteContext?.save?.("eliminatorias.html", { evento: eliminatoriaState.eventoSeleccionado });
    await cargarContextoPublicacion(eliminatoriaState.eventoSeleccionado);
    await cargarConfiguracionPlayoffCompartida();
    await refrescarGestionCompetitiva();
  });
  document.getElementById("eli-origen")?.addEventListener("change", () => {
    actualizarUIPlayoffPorOrigen();
  });
  document.getElementById("eli-metodo-grupos")?.addEventListener("change", () => {
    actualizarUIPlayoffPorOrigen();
  });
  document.getElementById("eli-clasificados")?.addEventListener("change", async () => {
    actualizarUIPlayoffPorOrigen();
    await cargarResumenClasificacionManual();
  });
  document.getElementById("eli-plantilla-llave")?.addEventListener("change", () => {
    actualizarUIPlayoffPorOrigen();
  });
  document
    .getElementById("btn-eli-guardar-config")
    ?.addEventListener("click", () => guardarConfiguracionPlayoffCompartida());
  document
    .getElementById("btn-eli-reset-config")
    ?.addEventListener("click", reiniciarConfiguracionPlayoffCompartida);
  document.getElementById("btn-eli-cargar")?.addEventListener("click", cargarLlaveEliminatoria);
  document.getElementById("btn-eli-generar")?.addEventListener("click", generarLlaveEliminatoria);
  document
    .getElementById("btn-eli-guardar-clasificacion")
    ?.addEventListener("click", guardarClasificacionManual);
  document.getElementById("eli-clasificacion-manual")?.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-reclasif-id][data-reclasif-ganador]");
    if (!btn || !eliminatoriaState.eventoSeleccionado) return;
    const reclasificacionId = Number.parseInt(btn.getAttribute("data-reclasif-id") || "", 10);
    const ganadorId = Number.parseInt(btn.getAttribute("data-reclasif-ganador") || "", 10);
    if (!Number.isFinite(reclasificacionId) || !Number.isFinite(ganadorId)) return;
    await resolverReclasificacion(eliminatoriaState.eventoSeleccionado, reclasificacionId, ganadorId);
  });
  document.getElementById("eli-clasificacion-manual")?.addEventListener("click", (event) => {
    const btnPlanilla = event.target.closest("[data-reclasif-planilla]");
    if (btnPlanilla) {
      const partidoId = Number.parseInt(btnPlanilla.getAttribute("data-reclasif-planilla") || "", 10);
      if (Number.isFinite(partidoId) && partidoId > 0) {
        if (window.RouteContext?.navigate) {
          window.RouteContext.navigate("planilla.html", {
            partido: partidoId,
            evento: Number(eliminatoriaState.eventoSeleccionado) || null,
            regreso_pagina: "eliminatorias.html",
            regreso_evento: Number(eliminatoriaState.eventoSeleccionado) || null,
            regreso_fuente: "reclasificacion_playoff",
          });
        } else {
          window.location.href = `planilla.html?partido=${encodeURIComponent(partidoId)}`;
        }
      }
      return;
    }
    const btnPartidos = event.target.closest("[data-reclasif-partidos]");
    if (btnPartidos) {
      const partidoId = Number.parseInt(btnPartidos.getAttribute("data-reclasif-partidos") || "", 10);
      if (window.RouteContext?.navigate) {
        window.RouteContext.navigate("partidos.html", {
          evento: Number(eliminatoriaState.eventoSeleccionado) || null,
          partido: Number.isFinite(partidoId) ? partidoId : null,
        });
      } else {
        window.location.href = `partidos.html?evento=${encodeURIComponent(
          eliminatoriaState.eventoSeleccionado
        )}`;
      }
    }
  });
  document.getElementById("btn-eli-exportar")?.addEventListener("click", abrirEnPartidos);
  document.getElementById("btn-eli-toggle-jornada")?.addEventListener("click", () => {
    const section = document.getElementById("eli-jornada-section");
    const button = document.getElementById("btn-eli-toggle-jornada");
    if (!section || !button) return;
    const visible = section.style.display !== "none";
    section.style.display = visible ? "none" : "";
    button.classList.toggle("is-active", !visible);
    button.innerHTML = visible
      ? '<i class="fas fa-calendar-days"></i> Jornada del playoff'
      : '<i class="fas fa-eye-slash"></i> Ocultar jornada';
    if (!visible) {
      activarTabEliminatoria("bracket");
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  document.getElementById("eli-jornada-ronda")?.addEventListener("change", () => {
    eliminatoriaState.rondaJornadaSeleccionada =
      document.getElementById("eli-jornada-ronda")?.value || "";
    renderJornadaPlayoffPoster();
  });
  document.getElementById("btn-eli-toggle-plantilla")?.addEventListener("click", () => {
    const section = document.getElementById("eli-publicacion-section");
    const button = document.getElementById("btn-eli-toggle-plantilla");
    if (!section || !button) return;
    const visible = section.style.display !== "none";
    section.style.display = visible ? "none" : "";
    button.classList.toggle("is-active", !visible);
    button.innerHTML = visible
      ? '<i class="fas fa-file-lines"></i> Plantilla para publicar'
      : '<i class="fas fa-eye-slash"></i> Ocultar plantilla';
    if (!visible) {
      activarTabEliminatoria("bracket");
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  document.getElementById("btn-eli-jornada-png")?.addEventListener("click", exportarJornadaPlayoffPNG);
  document.getElementById("btn-eli-jornada-pdf")?.addEventListener("click", exportarJornadaPlayoffPDF);
  document.getElementById("btn-eli-export-png")?.addEventListener("click", exportarEliminatoriaPNG);
  document.getElementById("btn-eli-export-pdf")?.addEventListener("click", exportarEliminatoriaPDF);
  document.getElementById("btn-eli-share")?.addEventListener("click", compartirEliminatoria);
  document.getElementById("eli-export-bg-input")?.addEventListener("change", manejarCambioFondoPublicacion);
  document.getElementById("btn-eli-clear-bg")?.addEventListener("click", limpiarFondoPublicacion);
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) return;
      if (overlay.id === "modal-prog-partido-eli") cerrarModalProgPartidoEli();
      if (overlay.id === "modal-auto-prog-eli") cerrarModalAutoProgEli();
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (document.getElementById("modal-prog-partido-eli")?.style.display === "flex") {
      cerrarModalProgPartidoEli();
    }
    if (document.getElementById("modal-auto-prog-eli")?.style.display === "flex") {
      cerrarModalAutoProgEli();
    }
  });
}

async function cargarEventosEliminatoria() {
  try {
    const resp = await ApiClient.get("/eventos");
    const eventos = resp.eventos || resp || [];
    eliminatoriaState.eventos = eventos;

    const select = document.getElementById("eli-evento");
    if (!select) return;
    const prev = select.value;
    select.innerHTML = '<option value="">Selecciona categoría</option>';
    eventos.forEach((e) => {
      const op = document.createElement("option");
      op.value = String(e.id);
      op.textContent = e.nombre || "Categoría";
      select.appendChild(op);
    });
    if ([...select.options].some((x) => x.value === prev)) {
      select.value = prev;
    }
  } catch (error) {
    console.error(error);
    mostrarNotificacion("No se pudieron cargar categorías", "error");
  }
}

async function preseleccionarEventoDesdeURL() {
  const routeContext = window.RouteContext?.read?.("eliminatorias.html", ["evento"]) || {};
  const param = routeContext.evento;
  const id = Number.parseInt(param || "", 10);
  if (!Number.isFinite(id)) {
    actualizarMetaEvento();
    return;
  }

  const select = document.getElementById("eli-evento");
  if (select && [...select.options].some((x) => Number(x.value) === id)) {
    select.value = String(id);
  }
  eliminatoriaState.eventoSeleccionado = id;
  await cargarContextoPublicacion(eliminatoriaState.eventoSeleccionado);
  await cargarConfiguracionPlayoffCompartida();
  await refrescarGestionCompetitiva();
  await cargarLlaveEliminatoria();
}

function obtenerEventoActual() {
  return (
    eliminatoriaState.eventos.find((e) => Number(e.id) === Number(eliminatoriaState.eventoSeleccionado)) ||
    null
  );
}

async function cargarGruposEventoSeleccionado() {
  const eventoId = eliminatoriaState.eventoSeleccionado;
  if (!eventoId) {
    eliminatoriaState.gruposEvento = [];
    return;
  }
  if (Array.isArray(eliminatoriaState.configuracionPlayoff?.configuracion?.grupos)) {
    eliminatoriaState.gruposEvento = eliminatoriaState.configuracionPlayoff.configuracion.grupos
      .map((grupo) => String(grupo?.letra_grupo || "").toUpperCase())
      .filter(Boolean);
    return;
  }
  try {
    const resp = await ApiClient.get(`/grupos/evento/${eventoId}`);
    const grupos = Array.isArray(resp?.grupos) ? resp.grupos : [];
    eliminatoriaState.gruposEvento = grupos
      .map((g) => String(g.letra_grupo || "").toUpperCase())
      .filter(Boolean);
  } catch (error) {
    console.warn("No se pudieron cargar grupos del evento:", error);
    eliminatoriaState.gruposEvento = [];
  }
}

async function refrescarGestionCompetitiva() {
  if (!eliminatoriaState.esAdminLike) return;
  await cargarEquiposEventoGestion();
  await cargarResumenClasificacionManual();
}

async function cargarEquiposEventoGestion() {
  const cont = document.getElementById("eli-equipo-status-grid");
  const eventoId = eliminatoriaState.eventoSeleccionado;
  if (!cont) return;

  if (!eventoId) {
    eliminatoriaState.equiposEvento = [];
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users"></i>
        <p>Selecciona una categoría para gestionar equipos.</p>
      </div>`;
    return;
  }

  cont.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-spinner fa-spin"></i>
      <p>Cargando estado de equipos...</p>
    </div>`;

  try {
    const resp = await ApiClient.get(`/eventos/${eventoId}/equipos`);
    eliminatoriaState.equiposEvento = Array.isArray(resp?.equipos) ? resp.equipos : [];
    eliminatoriaState.motivosEliminacion = Array.isArray(resp?.motivos_eliminacion)
      ? resp.motivos_eliminacion
      : ["indisciplina", "deudas", "sin_justificativo_segunda_no_presentacion"];
    renderGestionEquipos();
  } catch (error) {
    console.error(error);
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-triangle-exclamation"></i>
        <p>No se pudo cargar el estado de equipos.</p>
      </div>`;
  }
}

function renderGestionEquipos() {
  const cont = document.getElementById("eli-equipo-status-grid");
  if (!cont) return;

  const equipos = Array.isArray(eliminatoriaState.equiposEvento)
    ? eliminatoriaState.equiposEvento
    : [];
  if (!equipos.length) {
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users-slash"></i>
        <p>No hay equipos inscritos en esta categoría.</p>
      </div>`;
    return;
  }

  cont.innerHTML = equipos
    .map((equipo) => {
      const teamId = Number(equipo.id);
      const eliminadoAutomatico = equipo.eliminado_automatico === true;
      const eliminadoManual = equipo.eliminado_manual === true;
      const eliminado = eliminadoAutomatico || eliminadoManual;
      const motivoActual = String(equipo.motivo_eliminacion || "");
      const detalleActual = String(equipo.detalle_eliminacion || "");
      const estadoHtml = eliminadoAutomatico
        ? `<span class="eli-badge is-danger">Eliminado automático por 3 no presentaciones</span>`
        : eliminadoManual
        ? `<span class="eli-badge is-warning">${escapeHtml(
            equipo.motivo_eliminacion_label || "Eliminado manualmente"
          )}</span>`
        : `<span class="eli-badge is-success">Habilitado</span>`;

      return `
        <article class="eli-admin-card">
          <div class="eli-admin-card-head">
            <div>
              <h4>${escapeHtml(equipo.nombre || "Equipo")}</h4>
              <div class="eli-admin-badges">
                ${estadoHtml}
                ${
                  Number(equipo.no_presentaciones || 0) > 0
                    ? `<span class="eli-badge is-neutral">NP ${Number(
                        equipo.no_presentaciones || 0
                      )}</span>`
                    : ""
                }
              </div>
            </div>
          </div>
          <div class="eli-admin-card-body">
            <label>Motivo de eliminación</label>
            <select data-equipo-motivo="${teamId}" ${eliminadoAutomatico ? "disabled" : ""}>
              <option value="">Mantener habilitado</option>
              ${eliminatoriaState.motivosEliminacion
                .map(
                  (motivo) => `
                    <option value="${escapeHtml(motivo)}" ${
                    motivoActual === motivo ? "selected" : ""
                  }>
                      ${escapeHtml(formatearMotivoEliminacion(motivo))}
                    </option>
                  `
                )
                .join("")}
            </select>
            <label>Detalle</label>
            <textarea
              rows="2"
              data-equipo-detalle="${teamId}"
              placeholder="Observación o resolución del organizador"
              ${eliminadoAutomatico ? "disabled" : ""}
            >${escapeHtml(detalleActual)}</textarea>
            <div class="eli-admin-actions">
              <button
                type="button"
                class="btn btn-primary"
                data-accion-equipo="guardar"
                data-equipo-id="${teamId}"
                ${eliminadoAutomatico ? "disabled" : ""}
              >
                <i class="fas fa-save"></i> ${eliminadoManual ? "Actualizar" : "Guardar"}
              </button>
              ${
                eliminadoManual && !eliminadoAutomatico
                  ? `
                    <button
                      type="button"
                      class="btn btn-outline"
                      data-accion-equipo="reactivar"
                      data-equipo-id="${teamId}"
                    >
                      <i class="fas fa-rotate-left"></i> Rehabilitar
                    </button>
                  `
                  : ""
              }
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  cont.querySelectorAll("[data-accion-equipo]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const equipoId = Number.parseInt(btn.getAttribute("data-equipo-id") || "", 10);
      const accion = String(btn.getAttribute("data-accion-equipo") || "");
      if (!Number.isFinite(equipoId)) return;
      if (accion === "reactivar") {
        await guardarEstadoCompetitivoEquipo(equipoId, false);
        return;
      }
      await guardarEstadoCompetitivoEquipo(equipoId, true);
    });
  });
}

async function guardarEstadoCompetitivoEquipo(equipoId, desdeFormulario = true) {
  const eventoId = eliminatoriaState.eventoSeleccionado;
  if (!eventoId || !Number.isFinite(Number(equipoId))) return;

  const motivoEl = document.querySelector(`[data-equipo-motivo="${Number(equipoId)}"]`);
  const detalleEl = document.querySelector(`[data-equipo-detalle="${Number(equipoId)}"]`);
  const motivo = String(motivoEl?.value || "").trim();
  const detalle = String(detalleEl?.value || "").trim();

  const payload = desdeFormulario && motivo
    ? {
        eliminado_manual: true,
        motivo_eliminacion: motivo,
        detalle_eliminacion: detalle,
      }
    : {
        eliminado_manual: false,
        motivo_eliminacion: null,
        detalle_eliminacion: null,
      };

  if (desdeFormulario && !motivo) {
    mostrarNotificacion("Selecciona un motivo o usa Rehabilitar.", "warning");
    return;
  }

  try {
    await ApiClient.put(
      `/eventos/${eventoId}/equipos/${Number(equipoId)}/estado-competencia`,
      payload
    );
    mostrarNotificacion("Estado del equipo actualizado", "success");
    await refrescarGestionCompetitiva();
  } catch (error) {
    console.error(error);
    mostrarNotificacion(
      error.message || "No se pudo actualizar el estado del equipo",
      "error"
    );
  }
}

async function cargarResumenClasificacionManual() {
  const cont = document.getElementById("eli-clasificacion-manual");
  const eventoId = eliminatoriaState.eventoSeleccionado;
  const cupos = obtenerClasificadosPorGrupoActual();
  if (!cont) return;

  if (!eventoId) {
    eliminatoriaState.resumenClasificacion = null;
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-list-check"></i>
        <p>Selecciona una categoría para revisar la clasificación.</p>
      </div>`;
    return;
  }

  cont.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-spinner fa-spin"></i>
      <p>Cargando clasificación sugerida...</p>
    </div>`;

  try {
    const resp = await ApiClient.get(
      `/eliminatorias/evento/${eventoId}/clasificacion?clasificados_por_grupo=${cupos}`
    );
    eliminatoriaState.resumenClasificacion = resp || null;
    renderResumenClasificacionManual();
  } catch (error) {
    console.error(error);
    eliminatoriaState.resumenClasificacion = null;
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-triangle-exclamation"></i>
        <p>No se pudo cargar la clasificación manual.</p>
      </div>`;
  }
}

function construirEtiquetaCandidatoClasificacion(row = {}, includeGrupo = false) {
  const nombre = escapeHtml(row.equipo_nombre || row.nombre || "-");
  const posicion = Number.parseInt(row.posicion || row.posicion_deportiva || 0, 10);
  const grupoOrigen = escapeHtml(row.grupo_origen_letra || row.grupo_letra || "");
  const criterios = [
    `Pts ${Number(row.puntos || 0)}`,
    `DG ${Number(row.diferencia_goles || 0)}`,
    `GF ${Number(row.goles_favor || 0)}`,
    `FP ${Number(row.puntaje_fair_play || 0).toFixed(2)}`,
  ].join(" | ");
  const extras = [
    Number.isFinite(posicion) && posicion > 0 ? `Pos. ${posicion}` : null,
    includeGrupo && grupoOrigen ? `Grupo ${grupoOrigen}` : null,
    criterios,
  ]
    .filter(Boolean)
    .join(" | ");
  return `${nombre}${extras ? ` (${extras})` : ""}`;
}

function renderReclasificacionesGrupo(reclasificaciones = []) {
  const lista = Array.isArray(reclasificaciones) ? reclasificaciones : [];
  if (!lista.length) return "";

  return `
    <div class="eli-reclasificaciones-block">
      <h5>Partidos extra por vacante</h5>
      <div class="eli-reclasificaciones-grid">
        ${lista
          .map((item) => {
            const resuelta = String(item?.estado || "").toLowerCase() === "resuelto";
            return `
              <article class="eli-reclasificacion-card ${resuelta ? "is-resolved" : "is-pending"}">
                <div class="eli-admin-badges">
                  <span class="eli-badge ${resuelta ? "is-success" : "is-warning"}">
                    ${resuelta ? "Resuelta" : "Pendiente"}
                  </span>
                  <span class="eli-badge is-neutral">Cupo ${Number(item?.slot_posicion || 0)}</span>
                </div>
                <div class="eli-reclasificacion-match">
                  <button
                    type="button"
                    class="btn btn-outline btn-sm"
                    data-reclasif-id="${Number(item.id)}"
                    data-reclasif-ganador="${Number(item.equipo_a_id)}"
                  >
                    ${escapeHtml(item.equipo_a_nombre || "Equipo A")}
                  </button>
                  <span>vs</span>
                  <button
                    type="button"
                    class="btn btn-outline btn-sm"
                    data-reclasif-id="${Number(item.id)}"
                    data-reclasif-ganador="${Number(item.equipo_b_id)}"
                  >
                    ${escapeHtml(item.equipo_b_nombre || "Equipo B")}
                  </button>
                </div>
                <p class="form-hint">
                  ${
                    resuelta
                      ? `Ganador: ${escapeHtml(item.ganador_nombre || "Por definir")}`
                      : "Selecciona el ganador cuando se dispute el partido extra."
                  }
                </p>
                ${
                  Number(item?.partido_id || 0) > 0
                    ? `
                      <div class="eli-admin-actions">
                        <button
                          type="button"
                          class="btn btn-outline btn-sm"
                          data-reclasif-partidos="${Number(item.partido_id)}"
                        >
                          <i class="fas fa-futbol"></i> Ver en partidos
                        </button>
                        <button
                          type="button"
                          class="btn btn-primary btn-sm"
                          data-reclasif-planilla="${Number(item.partido_id)}"
                        >
                          <i class="fas fa-clipboard-list"></i> Abrir planilla
                        </button>
                      </div>
                      <p class="form-hint">
                        Partido #${escapeHtml(item.numero_campeonato || "-")} · Estado: ${escapeHtml(
                          item.partido_estado || "pendiente"
                        )}${item.cancha ? ` · ${escapeHtml(item.cancha)}` : ""}
                      </p>
                    `
                    : `
                      <p class="form-hint">
                        El partido extra se crea al guardar la selección manual. Luego aparecerá aquí para abrirlo en Partidos o registrar su planilla.
                      </p>
                    `
                }
                ${
                  item?.detalle
                    ? `<p class="form-hint" style="color:#7a4b00;">${escapeHtml(item.detalle)}</p>`
                    : ""
                }
              </article>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

async function resolverReclasificacion(eventoId, reclasificacionId, ganadorId) {
  const detalle = await window.mostrarPrompt({
    titulo: "Registrar ganador de reclasificación",
    mensaje: "Puedes registrar una observación opcional para auditoría de este partido extra.",
    label: "Observación",
    inputType: "textarea",
    rows: 3,
    value: "",
    textoConfirmar: "Guardar ganador",
    textoCancelar: "Cancelar",
  });
  if (detalle === null) return;

  try {
    const resp = await ApiClient.put(
      `/eliminatorias/evento/${eventoId}/reclasificaciones/${reclasificacionId}`,
      {
        ganador_id: ganadorId,
        detalle: String(detalle || "").trim() || null,
      }
    );
    eliminatoriaState.resumenClasificacion = resp || null;
    renderResumenClasificacionManual();
    mostrarNotificacion("Ganador de reclasificación registrado.", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo registrar la reclasificación.", "error");
  }
}

function renderResumenClasificacionManual() {
  const cont = document.getElementById("eli-clasificacion-manual");
  if (!cont) return;

  const grupos = Array.isArray(eliminatoriaState.resumenClasificacion?.grupos)
    ? eliminatoriaState.resumenClasificacion.grupos
    : [];
  const cupos = Number.parseInt(
    eliminatoriaState.resumenClasificacion?.clasificados_por_grupo || "2",
    10
  );

  if (!grupos.length) {
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-layer-group"></i>
        <p>Esta categoría aún no tiene grupos para configurar clasificación manual.</p>
      </div>`;
    return;
  }

  cont.innerHTML = grupos
    .map((grupo) => {
      const elegibles = Array.isArray(grupo?.tabla)
        ? grupo.tabla.filter(
            (row) =>
              row?.eliminado_competencia !== true &&
              row?.eliminado_automatico !== true &&
              row?.eliminado_manual !== true
          )
        : [];
      const candidatosAdicionales = Array.isArray(grupo?.candidatos_adicionales)
        ? grupo.candidatos_adicionales
        : [];
      const manualMap = new Map(
        (Array.isArray(grupo?.manuales) ? grupo.manuales : []).map((item) => [
          Number(item.slot_posicion),
          item,
        ])
      );
      const reclasMap = new Map(
        (Array.isArray(grupo?.reclasificaciones) ? grupo.reclasificaciones : []).map((item) => [
          Number(item.slot_posicion),
          item,
        ])
      );

      const filasTabla = (grupo.tabla || [])
        .map((row) => {
          const eliminado = row.eliminado_competencia === true || row.eliminado_manual === true;
          return `
            <tr class="${eliminado ? "is-disabled" : ""}">
              <td>${Number(row.posicion || 0)}</td>
              <td>${escapeHtml(row.equipo_nombre || "-")}</td>
              <td>${Number(row.puntos || 0)}</td>
              <td>${Number(row.diferencia_goles || 0)}</td>
            </tr>
          `;
        })
        .join("");

      const slotsHtml = Array.from({ length: cupos }, (_, idx) => {
        const slot = idx + 1;
        const manual = manualMap.get(slot) || null;
        const reclasificacion = reclasMap.get(slot) || null;
        const sugerido =
          (Array.isArray(grupo?.sugeridos) ? grupo.sugeridos : []).find(
            (item) => Number(item.slot_posicion) === slot
          ) || null;
        const criterioManual = String(
          manual?.criterio ||
            (reclasificacion ? "partido_extra_reclasificacion" : "decision_organizador")
        ).trim();

        return `
          <div class="eli-slot-card">
            <label>Cupo ${slot}</label>
            <select
              data-clasif-grupo="${Number(grupo.grupo_id)}"
              data-clasif-slot="${slot}"
            >
              <option value="">Usar sugerencia del sistema${
                sugerido ? ` (${escapeHtml(sugerido.equipo_nombre || "-")})` : ""
              }</option>
              ${
                elegibles.length
                  ? `
                    <optgroup label="Elegibles del grupo">
                      ${elegibles
                        .map(
                          (row) => `
                            <option value="${Number(row.equipo_id)}" ${
                              Number(manual?.equipo_id) === Number(row.equipo_id) ? "selected" : ""
                            }>
                              ${construirEtiquetaCandidatoClasificacion(row, false)}
                            </option>
                          `
                        )
                        .join("")}
                    </optgroup>
                  `
                  : ""
              }
              ${
                candidatosAdicionales.length
                  ? `
                    <optgroup label="Mejores no clasificados del evento">
                      ${candidatosAdicionales
                        .map(
                          (row) => `
                            <option value="${Number(row.equipo_id)}" ${
                              Number(manual?.equipo_id) === Number(row.equipo_id) ? "selected" : ""
                            }>
                              ${construirEtiquetaCandidatoClasificacion(row, true)}
                            </option>
                          `
                        )
                        .join("")}
                    </optgroup>
                  `
                  : ""
              }
            </select>
            <small class="form-hint">
              Sugerencia: ${escapeHtml(sugerido?.equipo_nombre || "Sin sugerencia")}
            </small>
            ${
              sugerido?.nota
                ? `<small class="form-hint" style="display:block;color:#7a4b00;">${escapeHtml(sugerido.nota)}</small>`
                : ""
            }
            ${
              manual && manual.valido === false
                ? `<small class="form-hint" style="display:block;color:#b42318;">La selección manual anterior quedó invalidada porque ese equipo ya no es elegible.</small>`
                : ""
            }
            ${
              reclasificacion
                ? `<small class="form-hint" style="display:block;color:#155eef;">
                    ${
                      String(reclasificacion.estado || "").toLowerCase() === "resuelto"
                        ? `El cupo ${slot} quedó definido por reclasificación. Ganador: ${escapeHtml(
                            reclasificacion.ganador_nombre || "Por definir"
                          )}.`
                        : `El cupo ${slot} tiene una reclasificación pendiente entre ${escapeHtml(
                            reclasificacion.equipo_a_nombre || "Equipo A"
                          )} y ${escapeHtml(reclasificacion.equipo_b_nombre || "Equipo B")}.`
                    }
                  </small>`
                : ""
            }
            <select data-clasif-criterio="${Number(grupo.grupo_id)}:${slot}">
              <option value="decision_organizador" ${
                criterioManual === "decision_organizador" ? "selected" : ""
              }>Decisión del organizador</option>
              <option value="mejor_no_clasificado_evento" ${
                criterioManual === "mejor_no_clasificado_evento" ? "selected" : ""
              }>Mejor no clasificado del evento</option>
              <option value="partido_extra_reclasificacion" ${
                criterioManual === "partido_extra_reclasificacion" ? "selected" : ""
              }>Partido extra / reclasificación</option>
            </select>
            <textarea
              rows="2"
              data-clasif-detalle="${Number(grupo.grupo_id)}:${slot}"
              placeholder="Detalle de la decisión manual (opcional)"
            >${escapeHtml(manual?.detalle || "")}</textarea>
          </div>
        `;
      }).join("");

      return `
        <article class="eli-admin-card eli-clasif-card">
          <div class="eli-admin-card-head">
            <div>
              <h4>Grupo ${escapeHtml(grupo.grupo_letra || "-")}</h4>
              <div class="eli-admin-badges">
                <span class="eli-badge is-neutral">${cupos} cupo(s)</span>
                ${
                  grupo.incompleto
                    ? `<span class="eli-badge is-warning">Clasificación incompleta</span>`
                    : `<span class="eli-badge is-success">Clasificación completa</span>`
                }
              </div>
              ${
                grupo.incompleto && candidatosAdicionales.length
                  ? `<p class="form-hint" style="margin-top:0.55rem;color:#7a4b00;">Este grupo no completa cupos con sus equipos elegibles. El sistema propone mejores no clasificados del evento y puedes registrar el criterio usado.</p>`
                  : ""
              }
            </div>
          </div>
          <div class="eli-admin-card-body">
            <div class="eli-resumen-table-wrap">
              <table class="eli-resumen-table">
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Equipo</th>
                    <th>Pts</th>
                    <th>DG</th>
                  </tr>
                </thead>
                <tbody>${filasTabla}</tbody>
              </table>
            </div>
            <div class="eli-slot-grid">${slotsHtml}</div>
            ${renderReclasificacionesGrupo(grupo?.reclasificaciones || [])}
          </div>
        </article>
      `;
    })
    .join("");
}

async function guardarClasificacionManual() {
  const eventoId = eliminatoriaState.eventoSeleccionado;
  const cupos = Number.parseInt(document.getElementById("eli-clasificados")?.value || "2", 10);
  const resumen = eliminatoriaState.resumenClasificacion;
  if (!eventoId || !resumen?.grupos?.length) {
    mostrarNotificacion("No hay clasificación para guardar.", "warning");
    return;
  }

  const configOk = await guardarConfiguracionPlayoffCompartida({ silencioso: true });
  if (!configOk) return;

  const grupos = resumen.grupos.map((grupo) => {
    const selecciones = Array.from({ length: cupos }, (_, idx) => {
      const slot = idx + 1;
      const select = document.querySelector(
        `[data-clasif-grupo="${Number(grupo.grupo_id)}"][data-clasif-slot="${slot}"]`
      );
      const criterio = document.querySelector(
        `[data-clasif-criterio="${Number(grupo.grupo_id)}:${slot}"]`
      );
      const detalle = document.querySelector(
        `[data-clasif-detalle="${Number(grupo.grupo_id)}:${slot}"]`
      );
      const equipoId = Number.parseInt(select?.value || "", 10);
      return {
        slot_posicion: slot,
        equipo_id: Number.isFinite(equipoId) ? equipoId : null,
        criterio: String(criterio?.value || "decision_organizador").trim() || "decision_organizador",
        detalle: String(detalle?.value || "").trim() || null,
      };
    });

    return {
      grupo_id: Number(grupo.grupo_id),
      selecciones,
    };
  });

  try {
    const resp = await ApiClient.put(
      `/eliminatorias/evento/${eventoId}/clasificacion-manual`,
      {
        clasificados_por_grupo: cupos,
        grupos,
      }
    );
    eliminatoriaState.resumenClasificacion = resp || null;
    renderResumenClasificacionManual();
    mostrarNotificacion("Clasificación manual guardada", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion(
      error.message || "No se pudo guardar la clasificación manual",
      "error"
    );
  }
}

async function cargarContextoPublicacion(eventoId) {
  const eventoIdNum = parsePositiveInt(eventoId);
  if (!eventoIdNum) {
    eliminatoriaState.contextoPublicacion = {
      campeonatoId: null,
      campeonatoNombre: "",
      eventoNombre: "",
      organizador: "",
      logoUrl: null,
      auspiciantes: [],
    };
    renderCabeceraPublicacion();
    await cargarAuspiciantesPublicacion(null);
    return;
  }

  let evento = obtenerEventoActual();
  try {
    if (!evento || !evento.campeonato_id) {
      const respEvento = await ApiClient.get(`/eventos/${eventoIdNum}`);
      evento = respEvento?.evento || respEvento || evento;
    }

    const campeonatoId = Number.parseInt(evento?.campeonato_id, 10);
    let camp = null;
    if (Number.isFinite(campeonatoId) && campeonatoId > 0) {
      const respCamp = await ApiClient.get(`/campeonatos/${campeonatoId}`);
      camp = respCamp?.campeonato || respCamp || null;
    }

    eliminatoriaState.contextoPublicacion = {
      campeonatoId: Number.isFinite(campeonatoId) ? campeonatoId : null,
      campeonatoNombre: camp?.nombre || "Campeonato",
      eventoNombre: evento?.nombre || "Categoría",
      organizador: camp?.organizador || "No registrado",
      logoUrl: normalizarLogoUrl(camp?.logo_url || null),
      auspiciantes: [],
    };
  } catch (error) {
    console.warn("No se pudo cargar contexto de publicación:", error);
    eliminatoriaState.contextoPublicacion = {
      campeonatoId: Number.parseInt(evento?.campeonato_id, 10) || null,
      campeonatoNombre: evento?.campeonato_nombre || "Campeonato",
      eventoNombre: evento?.nombre || "Categoría",
      organizador: "No registrado",
      logoUrl: null,
      auspiciantes: [],
    };
  }

  renderCabeceraPublicacion();
  await cargarAuspiciantesPublicacion(eliminatoriaState.contextoPublicacion?.campeonatoId);
}

function renderCabeceraPublicacion() {
  const tituloEl = document.getElementById("eli-export-titulo");
  const subtituloEl = document.getElementById("eli-export-subtitulo");
  const organizadorEl = document.getElementById("eli-export-organizador");
  const logoEl = document.getElementById("eli-export-logo");
  const ctx = eliminatoriaState.contextoPublicacion || {};

  if (tituloEl) {
    const base = String(ctx.campeonatoNombre || "Campeonato").toUpperCase();
    tituloEl.textContent = `${base} - PLAYOFF`;
  }
  if (subtituloEl) {
    subtituloEl.textContent = `Categoría: ${ctx.eventoNombre || "-"}`;
  }
  if (organizadorEl) {
    organizadorEl.textContent = `ORGANIZA: ${ctx.organizador || "No registrado"}`;
  }
  if (logoEl) {
    if (ctx.logoUrl) {
      logoEl.src = ctx.logoUrl;
      logoEl.style.display = "block";
    } else {
      logoEl.removeAttribute("src");
      logoEl.style.display = "none";
    }
  }
  restaurarFondoPublicacionGuardado();
  renderJornadaPlayoffPoster();
}

function renderAuspiciantesPosterEnGrid(wrapId, gridId, lista = [], fallbackTexto = "") {
  const wrap = document.getElementById(wrapId);
  const grid = document.getElementById(gridId);
  if (!wrap || !grid) return;

  const items = Array.isArray(lista) ? lista : [];
  if (!items.length) {
    if (fallbackTexto) {
      grid.innerHTML = `<div class="eli-export-sponsor-item is-text"><span>${escapeHtml(fallbackTexto)}</span></div>`;
      wrap.style.display = "block";
    } else {
      grid.innerHTML = "";
      wrap.style.display = "none";
    }
    return;
  }

  grid.innerHTML = items
    .map((a) => {
      const nombre = String(a?.nombre || "Auspiciante");
      const logo = normalizarLogoUrl(a?.logo_url || null);
      if (logo) {
        return `
          <div class="eli-export-sponsor-item">
            <img src="${escapeHtml(logo)}" alt="${escapeHtml(
          nombre
        )}" crossorigin="anonymous" referrerpolicy="no-referrer" />
          </div>
        `;
      }
      return `
        <div class="eli-export-sponsor-item is-text">
          <span>${escapeHtml(nombre)}</span>
        </div>
      `;
    })
    .join("");
  wrap.style.display = "block";
}

function obtenerRondasDisponiblesJornadaPlayoff() {
  return agruparPorRonda(eliminatoriaState.cruces || []).filter(
    (col) => Array.isArray(col?.cruces) && col.cruces.length
  );
}

function tieneProgramacionPlayoff(partido = {}) {
  return Boolean(partido?.fecha_partido || partido?.hora_partido || partido?.cancha);
}

function sincronizarSelectorRondaPlayoff() {
  const select = document.getElementById("eli-jornada-ronda");
  const rounds = obtenerRondasDisponiblesJornadaPlayoff();
  if (!select) return;

  const previo = eliminatoriaState.rondaJornadaSeleccionada || select.value || "";
  const preferida =
    rounds.find((round) => (round.cruces || []).some((c) => tieneProgramacionPlayoff(c)))?.ronda ||
    rounds[0]?.ronda ||
    "";
  const actual = rounds.some((round) => round.ronda === previo) ? previo : preferida;

  select.innerHTML = rounds.length
    ? rounds
        .map(
          (round) =>
            `<option value="${escapeHtml(round.ronda)}">${escapeHtml(formatearRonda(round.ronda))}</option>`
        )
        .join("")
    : '<option value="">Selecciona una ronda</option>';
  select.value = actual;
  select.disabled = !rounds.length;
  eliminatoriaState.rondaJornadaSeleccionada = actual;
}

function formatearFechaPlayoffPoster(valor) {
  if (!valor) return "";
  const match = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const fecha = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return fecha.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function construirMetaPlayoffPoster(partido = {}) {
  const fecha = formatearFechaPlayoffPoster(partido.fecha_partido);
  const hora = partido.hora_partido ? String(partido.hora_partido).slice(0, 5) : "";
  const cancha = String(partido.cancha || "").trim();
  return [fecha, hora, cancha].filter(Boolean).join(" • ");
}

function renderJornadaPlayoffPoster() {
  const section = document.getElementById("eli-jornada-section");
  const lista = document.getElementById("eli-jornada-lista");
  const tituloEl = document.getElementById("eli-round-titulo");
  const subtituloEl = document.getElementById("eli-round-subtitulo");
  const organizadorEl = document.getElementById("eli-round-organizador");
  const logoEl = document.getElementById("eli-round-logo");
  const btnPng = document.getElementById("btn-eli-jornada-png");
  const btnPdf = document.getElementById("btn-eli-jornada-pdf");
  if (!lista) return;

  sincronizarSelectorRondaPlayoff();
  const rounds = obtenerRondasDisponiblesJornadaPlayoff();
  const ronda = eliminatoriaState.rondaJornadaSeleccionada;
  const round = rounds.find((item) => item.ronda === ronda) || null;
  const ctx = eliminatoriaState.contextoPublicacion || {};

  if (organizadorEl) {
    organizadorEl.textContent = `ORGANIZA: ${ctx.organizador || "No registrado"}`;
  }
  if (logoEl) {
    if (ctx.logoUrl) {
      logoEl.src = ctx.logoUrl;
      logoEl.style.display = "block";
    } else {
      logoEl.removeAttribute("src");
      logoEl.style.display = "none";
    }
  }

  if (!round || !Array.isArray(round.cruces) || !round.cruces.length) {
    if (tituloEl) tituloEl.textContent = "JORNADA DEL PLAYOFF";
    if (subtituloEl) subtituloEl.textContent = `Categoría: ${ctx.eventoNombre || "-"}`;
    lista.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-calendar-days"></i>
        <p>No hay partidos de playoff listos para esta ronda.</p>
      </div>`;
    if (btnPng) btnPng.disabled = true;
    if (btnPdf) btnPdf.disabled = true;
    if (section) section.style.display = rounds.length ? section.style.display : "none";
    return;
  }

  if (tituloEl) {
    tituloEl.textContent = `${String(ctx.campeonatoNombre || "Campeonato").toUpperCase()} - ${String(
      formatearRonda(round.ronda) || "PLAYOFF"
    ).toUpperCase()}`;
  }
  if (subtituloEl) {
    subtituloEl.textContent = `Categoría: ${ctx.eventoNombre || "-"} • ${round.cruces.length} partido(s)`;
  }

  lista.innerHTML = round.cruces
    .map((partido) => {
      const local = obtenerNombreNodoPublicacion(partido, "local");
      const visita = obtenerNombreNodoPublicacion(partido, "visitante");
      const logoLocal = normalizarLogoUrl(partido.equipo_local_logo || null);
      const logoVisita = normalizarLogoUrl(partido.equipo_visitante_logo || null);
      const meta = construirMetaPlayoffPoster(partido);
      const estado = String(partido.estado || "").toLowerCase();
      const badge = estado === "finalizado"
        ? "Finalizado"
        : meta
          ? "Programado"
          : "Pendiente";
      const marcador = Number.isFinite(Number(partido.resultado_local)) && Number.isFinite(Number(partido.resultado_visitante))
        ? `${Number(partido.resultado_local)} - ${Number(partido.resultado_visitante)}`
        : "vs";
      return `
        <article class="eli-round-match-card">
          <div class="eli-round-match-head">
            <span class="eli-round-match-label">${escapeHtml(
              formatearEtiquetaPartidoEliminatoria(partido.ronda, partido.partido_numero)
            )}</span>
            <span class="eli-round-match-badge">${escapeHtml(badge)}</span>
          </div>
          <div class="eli-round-match-team is-local">
            <span class="eli-round-match-team-meta">
              ${renderEquipoLogo(logoLocal, local, "eli-round-team-logo")}
              <span>${escapeHtml(local)}</span>
            </span>
          </div>
          <div class="eli-round-match-score">${escapeHtml(marcador)}</div>
          <div class="eli-round-match-team is-visitante">
            <span class="eli-round-match-team-meta">
              ${renderEquipoLogo(logoVisita, visita, "eli-round-team-logo")}
              <span>${escapeHtml(visita)}</span>
            </span>
          </div>
          <div class="eli-round-match-meta">${escapeHtml(meta || "Por programar")}</div>
        </article>
      `;
    })
    .join("");

  if (btnPng) btnPng.disabled = false;
  if (btnPdf) btnPdf.disabled = false;
}

async function cargarAuspiciantesPublicacion(campeonatoIdRaw) {
  const wrap = document.getElementById("eli-export-sponsors");
  const grid = document.getElementById("eli-export-sponsors-grid");
  if (!wrap || !grid) return;

  renderAuspiciantesPosterEnGrid("eli-export-sponsors", "eli-export-sponsors-grid", []);
  renderAuspiciantesPosterEnGrid("eli-round-sponsors", "eli-round-sponsors-grid", []);

  let campeonatoId = Number.parseInt(campeonatoIdRaw || "", 10);
  if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
    const eventoActual = obtenerEventoActual();
    campeonatoId = Number.parseInt(eventoActual?.campeonato_id || "", 10);
  }
  if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
    if (eliminatoriaState.contextoPublicacion) {
      eliminatoriaState.contextoPublicacion.auspiciantes = [];
    }
    renderAuspiciantesPosterEnGrid("eli-export-sponsors", "eli-export-sponsors-grid", []);
    renderAuspiciantesPosterEnGrid("eli-round-sponsors", "eli-round-sponsors-grid", []);
    return;
  }

  try {
    let data = await ApiClient.get(`/auspiciantes/campeonato/${campeonatoId}?activo=1`);
    let lista = Array.isArray(data?.auspiciantes) ? data.auspiciantes : [];
    // fallback: si no hay activos, traer todos para no perder la plantilla
    if (!lista.length) {
      data = await ApiClient.get(`/auspiciantes/campeonato/${campeonatoId}`);
      lista = Array.isArray(data?.auspiciantes) ? data.auspiciantes : [];
    }

    if (eliminatoriaState.contextoPublicacion) {
      eliminatoriaState.contextoPublicacion.auspiciantes = lista;
    }

    if (!lista.length) {
      renderAuspiciantesPosterEnGrid(
        "eli-export-sponsors",
        "eli-export-sponsors-grid",
        [],
        "Sin auspiciantes registrados"
      );
      renderAuspiciantesPosterEnGrid(
        "eli-round-sponsors",
        "eli-round-sponsors-grid",
        [],
        "Sin auspiciantes registrados"
      );
      return;
    }

    renderAuspiciantesPosterEnGrid("eli-export-sponsors", "eli-export-sponsors-grid", lista);
    renderAuspiciantesPosterEnGrid("eli-round-sponsors", "eli-round-sponsors-grid", lista);
  } catch (error) {
    console.warn("No se pudieron cargar auspiciantes para la plantilla de eliminatoria:", error);
    if (eliminatoriaState.contextoPublicacion) {
      eliminatoriaState.contextoPublicacion.auspiciantes = [];
    }
    renderAuspiciantesPosterEnGrid(
      "eli-export-sponsors",
      "eli-export-sponsors-grid",
      [],
      "No se pudieron cargar auspiciantes"
    );
    renderAuspiciantesPosterEnGrid(
      "eli-round-sponsors",
      "eli-round-sponsors-grid",
      [],
      "No se pudieron cargar auspiciantes"
    );
  }
}

function actualizarMetaEvento() {
  const evento = obtenerEventoActual();
  const config = eliminatoriaState.configuracionPlayoff?.configuracion || null;
  const metodoEl = document.getElementById("eli-metodo");
  const llaveEl = document.getElementById("eli-llave");
  const avisoEl = document.getElementById("eli-aviso-metodo");
  const origenSel = document.getElementById("eli-origen");
  const clasificadosSel = document.getElementById("eli-clasificados");
  const metodoGruposSel = document.getElementById("eli-metodo-grupos");

  const metodo = obtenerMetodoCompetenciaVisibleEliminatoria(evento);
  const llave = Number.parseInt(evento?.eliminatoria_equipos, 10);
  const clasificados =
    parsePositiveInt(evento?.clasificados_por_grupo) ||
    parsePositiveInt(eliminatoriaState.configuracionPlayoff?.evento?.clasificados_por_grupo) ||
    2;
  const origen = String(
    metodo === "tabla_acumulada"
      ? "grupos"
      : (config?.origen || (metodo === "eliminatoria" ? "evento" : "grupos"))
  ).toLowerCase();
  const metodoGrupos = String(
    metodo === "tabla_acumulada" ? "tabla_unica" : (config?.metodo_clasificacion || "cruces_grupos")
  ).toLowerCase();
  const plantillaLlave = String(
    config?.plantilla_llave || evento?.playoff_plantilla || "estandar"
  ).toLowerCase();
  const incluirTercerPuesto =
    config?.incluir_tercer_puesto === true || evento?.playoff_tercer_puesto === true;

  if (metodoEl) metodoEl.value = formatearMetodo(metodo);
  if (llaveEl) llaveEl.value = Number.isFinite(llave) ? String(llave) : "Automática";
  asegurarOpcionesClasificadosPorGrupo(clasificados);
  if (clasificadosSel) clasificadosSel.value = String(clasificados);
  if (metodoGruposSel) metodoGruposSel.value = metodoGrupos;
  const plantillaSel = document.getElementById("eli-plantilla-llave");
  const tercerSel = document.getElementById("eli-tercer-puesto");
  if (plantillaSel) plantillaSel.value = plantillaLlave;
  if (tercerSel) tercerSel.value = incluirTercerPuesto ? "true" : "false";
  if (avisoEl) {
    avisoEl.textContent =
      metodo === "tabla_acumulada"
        ? `Esta categoría clasifica por tabla acumulada: ranking global de clasificados por rendimiento. Plantilla: ${formatearPlantillaLlaveEliminatoria(plantillaLlave)}${incluirTercerPuesto ? " + tercer puesto" : ""}.`
        : metodo === "eliminatoria" || metodo === "mixto"
          ? `Esta categoría soporta eliminación directa. Plantilla actual: ${formatearPlantillaLlaveEliminatoria(plantillaLlave)}${incluirTercerPuesto ? " + tercer puesto" : ""}.`
          : `Modo sugerido: playoff desde grupos (clasificados por grupo). Plantilla: ${formatearPlantillaLlaveEliminatoria(plantillaLlave)}${incluirTercerPuesto ? " + tercer puesto" : ""}.`;
  }
  if (origenSel) {
    origenSel.value = origen;
  }
  actualizarEstadoVisualConfiguracionPlayoff();
  actualizarUIPlayoffPorOrigen();
}

function actualizarUIPlayoffPorOrigen() {
  const evento = obtenerEventoActual();
  const metodoCompetencia = obtenerMetodoCompetenciaVisibleEliminatoria(evento);
  const origenEl = document.getElementById("eli-origen");
  const metodoGruposEl = document.getElementById("eli-metodo-grupos");
  if (metodoCompetencia === "tabla_acumulada") {
    if (origenEl) origenEl.value = "grupos";
    if (metodoGruposEl) metodoGruposEl.value = "tabla_unica";
  }
  const origen = origenEl?.value || "evento";
  const metodoGrupos = metodoGruposEl?.value || "cruces_grupos";
  const wrapClasificados = document.getElementById("eli-wrap-clasificados");
  const wrapMetodo = document.getElementById("eli-wrap-metodo-grupos");
  const wrapCruces = document.getElementById("eli-wrap-cruces");
  const wrapPlantilla = document.getElementById("eli-wrap-plantilla-llave");
  const wrapTercer = document.getElementById("eli-wrap-tercer-puesto");

  const usaGrupos = origen === "grupos";
  if (wrapClasificados) wrapClasificados.style.display = usaGrupos ? "" : "none";
  if (wrapMetodo) wrapMetodo.style.display = usaGrupos ? "" : "none";
  if (wrapCruces) wrapCruces.style.display = usaGrupos && metodoGrupos === "cruces_grupos" ? "" : "none";
  if (wrapPlantilla) wrapPlantilla.style.display = usaGrupos ? "" : "none";
  if (wrapTercer) {
    wrapTercer.style.display = ["grupos", "eliminatoria", "mixto", "tabla_acumulada"].includes(metodoCompetencia)
      ? ""
      : "none";
  }
  if (origenEl) origenEl.disabled = metodoCompetencia === "tabla_acumulada" || eliminatoriaState.configuracionPlayoff?.configuracion?.guardada === true;
  if (metodoGruposEl) metodoGruposEl.disabled = metodoCompetencia === "tabla_acumulada" || eliminatoriaState.configuracionPlayoff?.configuracion?.guardada === true;
  const plantillaSel = document.getElementById("eli-plantilla-llave");
  const tercerSel = document.getElementById("eli-tercer-puesto");
  if (plantillaSel) plantillaSel.disabled = eliminatoriaState.configuracionPlayoff?.configuracion?.guardada === true;
  if (tercerSel) tercerSel.disabled = eliminatoriaState.configuracionPlayoff?.configuracion?.guardada === true;

  if (usaGrupos && metodoGrupos === "cruces_grupos") {
    renderConfiguracionCruces();
  } else {
    renderVistaPreviaCruces([]);
  }
}

function renderConfiguracionCruces() {
  const cont = document.getElementById("eli-cruces-grupos");
  if (!cont) return;

  const crucesActuales = obtenerCrucesConfiguradosDesdeWrap(cont);
  const crucesGuardados = Array.isArray(eliminatoriaState.configuracionPlayoff?.configuracion?.cruces_grupos)
    ? eliminatoriaState.configuracionPlayoff.configuracion.cruces_grupos
    : [];
  const letras = [...eliminatoriaState.gruposEvento];
  const plantillaLlave = String(document.getElementById("eli-plantilla-llave")?.value || "estandar").toLowerCase();
  const clasificados = obtenerClasificadosPorGrupoActual();
  if (letras.length < 2) {
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-layer-group"></i>
        <p>Debes tener al menos 2 grupos creados para configurar cruces.</p>
      </div>`;
    return;
  }

  const pares = Math.floor(letras.length / 2);
  const crucesDefault = obtenerCrucesPorDefecto(letras, plantillaLlave, clasificados);
  const rows = [];
  for (let i = 0; i < pares; i++) {
    const parBase = crucesActuales[i] || crucesGuardados[i] || [
      crucesDefault[i]?.[0] || letras[i],
      crucesDefault[i]?.[1] || letras[letras.length - 1 - i],
    ];
    const a = parBase[0];
    const b = parBase[1];
    rows.push(`
      <div class="eli-cruce-row">
        <span>Cruce ${i + 1}</span>
        <select data-cruce-a="${i}">
          ${letras
            .map((l) => `<option value="${escapeHtml(l)}" ${l === a ? "selected" : ""}>Grupo ${escapeHtml(l)}</option>`)
            .join("")}
        </select>
        <span>vs</span>
        <select data-cruce-b="${i}">
          ${letras
            .map((l) => `<option value="${escapeHtml(l)}" ${l === b ? "selected" : ""}>Grupo ${escapeHtml(l)}</option>`)
            .join("")}
        </select>
      </div>
    `);
  }
  cont.innerHTML = rows.join("");
  cont.querySelectorAll("select").forEach((select) => {
    select.disabled = eliminatoriaState.configuracionPlayoff?.configuracion?.guardada === true;
    select.addEventListener("change", () => {
      renderVistaPreviaCruces(obtenerCrucesConfigurados());
    });
  });
  renderVistaPreviaCruces(obtenerCrucesConfigurados());
}

function obtenerCrucesConfigurados() {
  const wrap = document.getElementById("eli-cruces-grupos");
  if (!wrap) return [];
  const cruces = obtenerCrucesConfiguradosDesdeWrap(wrap);

  // valida que no se repitan grupos
  const usados = new Set();
  const limpios = [];
  for (const [a, b] of cruces) {
    if (usados.has(a) || usados.has(b)) continue;
    usados.add(a);
    usados.add(b);
    limpios.push([a, b]);
  }
  return limpios;
}

async function cargarLlaveEliminatoria() {
  const eventoId = eliminatoriaState.eventoSeleccionado;
  if (!eventoId) {
    mostrarNotificacion("Selecciona una categoría", "warning");
    renderPosterPublicacion([]);
    return;
  }
  activarTabEliminatoria("bracket");

  const cont = document.getElementById("eli-bracket");
  if (cont) {
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Cargando llave...</p>
      </div>`;
  }

  try {
    const resp = await ApiClient.get(`/eliminatorias/evento/${eventoId}`);
    eliminatoriaState.cruces = Array.isArray(resp?.partidos) ? resp.partidos : [];
    actualizarBarraProgPlayoff();
    renderBracket();
  } catch (error) {
    console.error(error);
    eliminatoriaState.cruces = [];
    renderPosterPublicacion([]);
    if (cont) {
      cont.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-triangle-exclamation"></i>
          <p>${escapeHtml(error.message || "No se pudo cargar la llave")}</p>
        </div>`;
    }
  }
}

async function generarLlaveEliminatoria() {
  const eventoId = eliminatoriaState.eventoSeleccionado;
  if (!eventoId) {
    mostrarNotificacion("Selecciona una categoría", "warning");
    return;
  }

  const evento = obtenerEventoActual();
  const cantidadObjetivo = Number.parseInt(evento?.eliminatoria_equipos, 10);
  const metodoEvento = obtenerMetodoCompetenciaVisibleEliminatoria(evento);
  const origen = metodoEvento === "tabla_acumulada"
    ? "grupos"
    : (document.getElementById("eli-origen")?.value || "evento");
  const clasificadosPorGrupo = obtenerClasificadosPorGrupoActual();
  const metodoGrupos = metodoEvento === "tabla_acumulada"
    ? "tabla_unica"
    : (document.getElementById("eli-metodo-grupos")?.value || "cruces_grupos");
  const plantillaLlave = String(document.getElementById("eli-plantilla-llave")?.value || "estandar").toLowerCase();
  const incluirTercerPuesto =
    String(document.getElementById("eli-tercer-puesto")?.value || "false").toLowerCase() === "true";
  const cruces = metodoGrupos === "cruces_grupos" ? obtenerCrucesConfigurados() : [];

  const configOk = await guardarConfiguracionPlayoffCompartida({ silencioso: true });
  if (!configOk) return;

  if (origen === "grupos" && metodoGrupos === "cruces_grupos" && !cruces.length) {
    mostrarNotificacion("Configura al menos un cruce de grupos válido.", "warning");
    return;
  }

  const ok = await window.mostrarConfirmacion({
    titulo: "Generar llave eliminatoria",
    mensaje: "¿Generar o reemplazar la llave eliminatoria de esta categoría?",
    tipo: "warning",
    textoConfirmar: "Generar llave",
    claseConfirmar: "btn-primary",
  });
  if (!ok) return;

  try {
    const payload = {
      origen,
      metodo_clasificacion: metodoGrupos,
      clasificados_por_grupo: clasificadosPorGrupo,
      plantilla_llave: plantillaLlave,
      incluir_tercer_puesto: incluirTercerPuesto,
    };
    if (origen !== "grupos" && Number.isFinite(cantidadObjetivo)) {
      payload.cantidad_equipos = cantidadObjetivo;
    }
    if (cruces.length) payload.cruces_grupos = cruces;

    const resp = await ApiClient.post(`/eliminatorias/evento/${eventoId}/generar`, payload);
    const meta = resp?.meta || null;
    if (meta?.mejores_perdedores_habilitado === true) {
      mostrarNotificacion("Playoff generado con plantilla de mejores perdedores", "success");
    } else if (meta?.metodo_clasificacion === "tabla_unica") {
      mostrarNotificacion("Playoff generado por tabla única", "success");
    } else if (meta?.metodo_clasificacion === "cruces_grupos") {
      mostrarNotificacion("Playoff generado por cruces de grupos", "success");
    } else {
      mostrarNotificacion("Llave eliminatoria generada", "success");
    }
    await cargarLlaveEliminatoria();
    activarTabEliminatoria("bracket");
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo generar la llave", "error");
  }
}

function agruparPorRonda(cruces = []) {
  const map = new Map();
  cruces.forEach((c) => {
    const ronda = String(c.ronda || "-").toLowerCase();
    if (!map.has(ronda)) map.set(ronda, []);
    map.get(ronda).push(c);
  });

  return RONDAS_ORDEN_ELI.filter((r) => map.has(r)).map((r) => ({
    ronda: r,
    cruces: (map.get(r) || []).sort((a, b) => Number(a.partido_numero || 0) - Number(b.partido_numero || 0)),
  }));
}

function normalizarColumnasPlayoff(columnas = []) {
  if (!Array.isArray(columnas) || !columnas.length) return [];
  const finalCol = columnas.find((col) => String(col?.ronda || "").toLowerCase() === "final");
  const tercerCol = columnas.find((col) => String(col?.ronda || "").toLowerCase() === "tercer_puesto");
  return columnas
    .filter((col) => String(col?.ronda || "").toLowerCase() !== "tercer_puesto")
    .map((col) => {
      if (String(col?.ronda || "").toLowerCase() !== "final") return col;
      return {
        ...col,
        crucesExtra: Array.isArray(tercerCol?.cruces) ? tercerCol.cruces : [],
        tieneTercerPuesto: Array.isArray(tercerCol?.cruces) && tercerCol.cruces.length > 0,
      };
    });
}

function construirScheduleHtmlPartido(c = {}) {
  if (!c.fecha_partido && !c.hora_partido && !c.cancha) return "";
  let fechaStr = "";
  if (c.fecha_partido) {
    const m = String(c.fecha_partido).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      fechaStr = d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
    }
  }
  const hora = c.hora_partido ? String(c.hora_partido).slice(0, 5) : "";
  const partes = [fechaStr, hora ? `Hora ${hora}` : "", c.cancha || ""].filter(Boolean);
  return `<div class="eli-match-schedule"><i class="fas fa-calendar-alt"></i> ${escapeHtml(partes.join(" • "))}</div>`;
}

function renderMatchCardEliminatoria(c, { compact = false } = {}) {
  const local = nombrePlaceholderEliminatoria(c, "local");
  const visita = nombrePlaceholderEliminatoria(c, "visitante");
  const localLogo = normalizarLogoUrl(c.equipo_local_logo || null);
  const visitaLogo = normalizarLogoUrl(c.equipo_visitante_logo || null);
  const rl = Number.isFinite(Number(c.resultado_local)) ? Number(c.resultado_local) : "-";
  const rv = Number.isFinite(Number(c.resultado_visitante)) ? Number(c.resultado_visitante) : "-";
  const localEsGanador = c.ganador_id && Number(c.equipo_local_id) === Number(c.ganador_id);
  const visitaEsGanador = c.ganador_id && Number(c.equipo_visitante_id) === Number(c.ganador_id);
  const finalizado = String(c.estado || "").toLowerCase() === "finalizado";
  const seedL = c.seed_local_ref ? `<small>${escapeHtml(c.seed_local_ref)}</small>` : "";
  const seedV = c.seed_visitante_ref ? `<small>${escapeHtml(c.seed_visitante_ref)}</small>` : "";
  const estadoBadge = finalizado
    ? '<span class="eli-match-badge eli-badge-finalizado">Finalizado</span>'
    : c.fecha_partido
    ? '<span class="eli-match-badge eli-badge-programado">Programado</span>'
    : '<span class="eli-match-badge eli-badge-pendiente">Pendiente</span>';
  const scheduleHtml = construirScheduleHtmlPartido(c);

  return `
    <article class="eli-match-card${finalizado ? " eli-match-finalizado" : ""}${compact ? " is-compact" : ""}">
      <div class="eli-match-head">
        <strong>${escapeHtml(formatearEtiquetaPartidoEliminatoria(c.ronda, c.partido_numero))}</strong>
        ${estadoBadge}
      </div>
      ${scheduleHtml}
      <div class="eli-team-row${localEsGanador ? " eli-team-ganador" : ""}">
        <span class="eli-team-meta">
          ${renderEquipoLogo(localLogo, local, "eli-team-logo")}
          <span>${seedL} ${escapeHtml(local)}</span>
        </span>
        <span class="eli-score${localEsGanador ? " eli-score-ganador" : ""}">${escapeHtml(String(rl))}</span>
      </div>
      <div class="eli-team-row${visitaEsGanador ? " eli-team-ganador" : ""}">
        <span class="eli-team-meta">
          ${renderEquipoLogo(visitaLogo, visita, "eli-team-logo")}
          <span>${seedV} ${escapeHtml(visita)}</span>
        </span>
        <span class="eli-score${visitaEsGanador ? " eli-score-ganador" : ""}">${escapeHtml(String(rv))}</span>
      </div>
      ${
        !finalizado
          ? '<div class="eli-winner eli-winner-pendiente"><i class="fas fa-clock"></i> Partido pendiente</div>'
          : c.ganador_nombre
            ? `<div class="eli-winner eli-winner-ok"><i class="fas fa-trophy"></i> ${escapeHtml(c.ganador_nombre)}</div>`
            : ""
      }
      ${
        eliminatoriaState.esAdminLike
          ? `<div class="eli-match-actions">
              <button class="btn btn-warning" onclick="registrarResultadoEliminatoria(${Number(c.id)})">
                <i class="fas fa-edit"></i> Resultado
              </button>
              <button class="btn btn-secondary" onclick="abrirModalProgPartidoEli(${Number(c.id)}, '${escapeHtml(formatearEtiquetaPartidoEliminatoria(c.ronda, c.partido_numero))}', '${c.fecha_partido || ""}', '${c.hora_partido ? String(c.hora_partido).slice(0,5) : ""}', '${escapeHtml(c.cancha || "")}')">
                <i class="fas fa-calendar-alt"></i> Programar
              </button>
              ${
                !finalizado
                  ? `<button class="btn btn-outline" onclick="editarCruceEliminatoria(${Number(c.id)})">
                       <i class="fas fa-right-left"></i> Editar cruce
                     </button>`
                  : ""
              }
            </div>`
          : ""
      }
    </article>
  `;
}

function formatearNombreNodoEliminatoria(partido = {}, lado = "local") {
  const sideKey = lado === "visitante" ? "visitante" : "local";
  const nombreBase = nombrePlaceholderEliminatoria(partido, sideKey);
  const seedRef = String(partido?.[`seed_${sideKey}_ref`] || "").trim().toUpperCase();
  if (!seedRef || nombreBase === "Por definir" || /^Mejor perdedor \d+$/i.test(nombreBase)) {
    return nombreBase;
  }
  return `${seedRef} ${nombreBase}`;
}

function renderLineaNodoEliminatoria(partido = {}, lado = "local", logoClass = "eli-node-logo") {
  const sideKey = lado === "visitante" ? "visitante" : "local";
  const nombre = formatearNombreNodoEliminatoria(partido, sideKey);
  const logo = normalizarLogoUrl(partido?.[`equipo_${sideKey}_logo`] || null);
  return `
    <div class="eli-node-team">
      ${renderEquipoLogo(logo, nombre, logoClass)}
      <span>${escapeHtml(nombre)}</span>
    </div>
  `;
}

function renderLineaNodoPublicacion(partido = {}, lado = "local", logoClass = "eli-node-logo") {
  const sideKey = lado === "visitante" ? "visitante" : "local";
  const nombre = obtenerNombreNodoPublicacion(partido, sideKey);
  const logo = normalizarLogoUrl(partido?.[`equipo_${sideKey}_logo`] || null);
  return `
    <div class="eli-node-team">
      ${renderEquipoLogo(logo, nombre, logoClass)}
      <span>${escapeHtml(nombre)}</span>
    </div>
  `;
}

function renderMetaNodoPublicacion(partido = {}) {
  if (!partido?.fecha_partido && !partido?.hora_partido && !partido?.cancha) return "";
  let fechaStr = "";
  if (partido.fecha_partido) {
    const m = String(partido.fecha_partido).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      fechaStr = `${m[3]}/${m[2]}/${m[1]}`;
    }
  }
  const hora = partido.hora_partido ? String(partido.hora_partido).slice(0, 5) : "";
  const partes = [fechaStr, hora, partido.cancha || ""].filter(Boolean);
  if (!partes.length) return "";
  return `<div class="eli-node-meta">${escapeHtml(partes.join(" • "))}</div>`;
}

function renderPlantillaNodeEliminatoria(partido, { compact = false } = {}) {
  return `
    <article class="eli-plantilla-node${compact ? " is-compact" : ""}">
      <div class="eli-node-body">
        ${renderLineaNodoPublicacion(partido, "local", "eli-node-logo")}
        <div class="eli-node-vs">vs</div>
        ${renderLineaNodoPublicacion(partido, "visitante", "eli-node-logo")}
      </div>
      ${renderMetaNodoPublicacion(partido)}
    </article>
  `;
}

function esLayoutEspecial16(columnas = []) {
  const ronda8vos = columnas.find((col) => String(col?.ronda || "").toLowerCase() === "8vos");
  const ronda4tos = columnas.find((col) => String(col?.ronda || "").toLowerCase() === "4tos");
  const rondaSemis = columnas.find((col) => String(col?.ronda || "").toLowerCase() === "semifinal");
  const rondaFinal = columnas.find((col) => String(col?.ronda || "").toLowerCase() === "final");

  return !!(
    ronda8vos &&
    ronda4tos &&
    rondaSemis &&
    rondaFinal &&
    Array.isArray(ronda8vos.cruces) &&
    Array.isArray(ronda4tos.cruces) &&
    Array.isArray(rondaSemis.cruces) &&
    Array.isArray(rondaFinal.cruces) &&
    ronda8vos.cruces.length === 8 &&
    ronda4tos.cruces.length === 4 &&
    rondaSemis.cruces.length === 2 &&
    rondaFinal.cruces.length >= 1
  );
}

function medirTextoPublicacion(texto = "") {
  const valor = String(texto || "Por definir").trim() || "Por definir";
  if (typeof document === "undefined") {
    return Math.max(120, valor.length * 8);
  }
  if (!medirTextoPublicacion.canvas) {
    medirTextoPublicacion.canvas = document.createElement("canvas");
  }
  const ctx = medirTextoPublicacion.canvas.getContext("2d");
  if (!ctx) {
    return Math.max(120, valor.length * 8);
  }
  ctx.font = '800 11.5px "Segoe UI", Arial, sans-serif';
  return Math.ceil(ctx.measureText(valor).width);
}

function medirAnchoNodoPublicacion(partido, { compact = false } = {}) {
  const nombres = [
    obtenerNombreNodoPublicacion(partido, "local"),
    obtenerNombreNodoPublicacion(partido, "visitante"),
  ];
  const maxTexto = Math.max(...nombres.map((item) => medirTextoPublicacion(item)));
  const base = Math.round(maxTexto * 0.78) + (compact ? 54 : 64);
  const min = compact ? 150 : 190;
  const max = compact ? 176 : 208;
  return Math.min(max, Math.max(min, base));
}

function construirEstiloBracketEspecial16({
  izquierda8vos = [],
  derecha8vos = [],
  izquierda4tos = [],
  derecha4tos = [],
  semiIzquierda = null,
  semiDerecha = null,
  final = null,
  tercer = null,
} = {}) {
  const edgeWidth = Math.max(
    ...izquierda8vos.concat(derecha8vos).map((partido) => medirAnchoNodoPublicacion(partido)),
    280
  );
  const stageWidth = Math.max(
    ...izquierda4tos.concat(derecha4tos).map((partido) => medirAnchoNodoPublicacion(partido)),
    240
  );
  const semiWidth = Math.max(
    medirAnchoNodoPublicacion(semiIzquierda),
    medirAnchoNodoPublicacion(semiDerecha),
    230
  );
  const centerWidth = Math.max(
    medirAnchoNodoPublicacion(final),
    tercer ? medirAnchoNodoPublicacion(tercer, { compact: true }) : 0,
    250
  );

  return [
    `--eli-edge-col:${edgeWidth}px`,
    `--eli-stage-col:${stageWidth}px`,
    `--eli-semi-col:${semiWidth}px`,
    `--eli-center-col:${centerWidth}px`,
  ].join("; ");
}

function renderPlantillaPreviewEliminatoriaEspecial16(columnas = []) {
  if (!esLayoutEspecial16(columnas)) {
    return "";
  }

  const ronda8vos = columnas.find((col) => String(col?.ronda || "").toLowerCase() === "8vos");
  const ronda4tos = columnas.find((col) => String(col?.ronda || "").toLowerCase() === "4tos");
  const rondaSemis = columnas.find((col) => String(col?.ronda || "").toLowerCase() === "semifinal");
  const rondaFinal = columnas.find((col) => String(col?.ronda || "").toLowerCase() === "final");

  const izquierda8vos = ronda8vos.cruces.slice(0, 4);
  const derecha8vos = ronda8vos.cruces.slice(4);
  const izquierda4tos = ronda4tos.cruces.slice(0, 2);
  const derecha4tos = ronda4tos.cruces.slice(2);
  const semiIzquierda = rondaSemis.cruces[0];
  const semiDerecha = rondaSemis.cruces[1];
  const final = rondaFinal.cruces[0];
  const tercer = Array.isArray(rondaFinal.crucesExtra) ? rondaFinal.crucesExtra[0] : null;
  const estiloBracket = construirEstiloBracketEspecial16({
    izquierda8vos,
    derecha8vos,
    izquierda4tos,
    derecha4tos,
    semiIzquierda,
    semiDerecha,
    final,
    tercer,
  });

  return `
    <div class="eli-plantilla-preview-card">
      <strong>Vista previa sugerida del playoff</strong>
      <p>La plantilla resume los cruces activos con el mismo orden que se usará para publicar y compartir.</p>
      <div class="eli-plantilla-bracket16${tercer ? " has-third-place" : ""}" style="${estiloBracket}">
        <div class="eli-plantilla-col is-edge is-left">
          <h4 class="eli-plantilla-stage-title">Octavos</h4>
          ${izquierda8vos.map((partido) => renderPlantillaNodeEliminatoria(partido)).join("")}
        </div>
        <div class="eli-plantilla-col is-stage is-left">
          <h4 class="eli-plantilla-stage-title">Cuartos</h4>
          ${izquierda4tos.map((partido) => renderPlantillaNodeEliminatoria(partido)).join("")}
        </div>
        <div class="eli-plantilla-col is-semifinal is-left">
          <h4 class="eli-plantilla-stage-title">Semifinal</h4>
          ${semiIzquierda ? renderPlantillaNodeEliminatoria(semiIzquierda) : ""}
        </div>
        <div class="eli-plantilla-col is-center">
          <h4 class="eli-plantilla-stage-title">Final</h4>
          ${renderPlantillaNodeEliminatoria(final)}
          ${
            tercer
              ? `
            <div class="eli-plantilla-subcolumn is-third-place">
              <h5>Tercer y cuarto</h5>
              ${renderPlantillaNodeEliminatoria(tercer, { compact: true })}
            </div>`
              : ""
          }
        </div>
        <div class="eli-plantilla-col is-semifinal is-right">
          <h4 class="eli-plantilla-stage-title">Semifinal</h4>
          ${semiDerecha ? renderPlantillaNodeEliminatoria(semiDerecha) : ""}
        </div>
        <div class="eli-plantilla-col is-stage is-right">
          <h4 class="eli-plantilla-stage-title">Cuartos</h4>
          ${derecha4tos.map((partido) => renderPlantillaNodeEliminatoria(partido)).join("")}
        </div>
        <div class="eli-plantilla-col is-edge is-right">
          <h4 class="eli-plantilla-stage-title">Octavos</h4>
          ${derecha8vos.map((partido) => renderPlantillaNodeEliminatoria(partido)).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderExportNodeEliminatoria(partido, { compact = false } = {}) {
  return `
    <article class="eli-export-node${compact ? " is-compact" : ""}">
      <div class="eli-node-body">
        ${renderLineaNodoPublicacion(partido, "local", "eli-node-logo")}
        <div class="eli-node-vs">vs</div>
        ${renderLineaNodoPublicacion(partido, "visitante", "eli-node-logo")}
      </div>
      ${renderMetaNodoPublicacion(partido)}
    </article>
  `;
}

function renderPosterPublicacionEspecial16(columnas = []) {
  if (!esLayoutEspecial16(columnas)) return "";

  const ronda8vos = columnas.find((col) => String(col?.ronda || "").toLowerCase() === "8vos");
  const ronda4tos = columnas.find((col) => String(col?.ronda || "").toLowerCase() === "4tos");
  const rondaSemis = columnas.find((col) => String(col?.ronda || "").toLowerCase() === "semifinal");
  const rondaFinal = columnas.find((col) => String(col?.ronda || "").toLowerCase() === "final");
  const izquierda8vos = ronda8vos.cruces.slice(0, 4);
  const derecha8vos = ronda8vos.cruces.slice(4);
  const izquierda4tos = ronda4tos.cruces.slice(0, 2);
  const derecha4tos = ronda4tos.cruces.slice(2);
  const semiIzquierda = rondaSemis.cruces[0];
  const semiDerecha = rondaSemis.cruces[1];
  const final = rondaFinal.cruces[0];
  const tercer = Array.isArray(rondaFinal.crucesExtra) ? rondaFinal.crucesExtra[0] : null;
  const estiloBracket = construirEstiloBracketEspecial16({
    izquierda8vos,
    derecha8vos,
    izquierda4tos,
    derecha4tos,
    semiIzquierda,
    semiDerecha,
    final,
    tercer,
  });

  return `
    <div class="eli-export-preview-card">
      <div class="eli-export-bracket16${tercer ? " has-third-place" : ""}" style="${estiloBracket}">
        <div class="eli-export-col is-edge is-left">
          <div class="eli-export-stage-title">Octavos</div>
          ${izquierda8vos.map((partido) => renderExportNodeEliminatoria(partido)).join("")}
        </div>
        <div class="eli-export-col is-stage is-left">
          <div class="eli-export-stage-title">Cuartos</div>
          ${izquierda4tos.map((partido) => renderExportNodeEliminatoria(partido)).join("")}
        </div>
        <div class="eli-export-col is-semifinal is-left">
          <div class="eli-export-stage-title">Semifinal</div>
          ${semiIzquierda ? renderExportNodeEliminatoria(semiIzquierda) : ""}
        </div>
        <div class="eli-export-col is-center">
          <div class="eli-export-stage-title">Final</div>
          ${renderExportNodeEliminatoria(final)}
          ${
            tercer
              ? `
            <div class="eli-export-subcolumn is-third-place">
              <h5>Tercer y cuarto</h5>
              ${renderExportNodeEliminatoria(tercer, { compact: true })}
            </div>`
              : ""
          }
        </div>
        <div class="eli-export-col is-semifinal is-right">
          <div class="eli-export-stage-title">Semifinal</div>
          ${semiDerecha ? renderExportNodeEliminatoria(semiDerecha) : ""}
        </div>
        <div class="eli-export-col is-stage is-right">
          <div class="eli-export-stage-title">Cuartos</div>
          ${derecha4tos.map((partido) => renderExportNodeEliminatoria(partido)).join("")}
        </div>
        <div class="eli-export-col is-edge is-right">
          <div class="eli-export-stage-title">Octavos</div>
          ${derecha8vos.map((partido) => renderExportNodeEliminatoria(partido)).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderPlantillaPreviewEliminatoria(columnas = []) {
  const cont = document.getElementById("eli-plantilla-preview");
  if (!cont) return;

  if (!Array.isArray(columnas) || !columnas.length) {
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-image"></i>
        <p>Genera o carga una llave para visualizar la plantilla.</p>
      </div>`;
    return;
  }

  const htmlEspecial = renderPlantillaPreviewEliminatoriaEspecial16(columnas);
  if (htmlEspecial) {
    cont.innerHTML = htmlEspecial;
    return;
  }

  const html = columnas
    .map((col) => {
      const tarjetas = (col.cruces || [])
        .map((partido) => renderPlantillaNodeEliminatoria(partido))
        .join("");
      const extra = Array.isArray(col.crucesExtra) && col.crucesExtra.length
        ? `
          <div class="eli-plantilla-subcolumn">
            <h5>Tercer y cuarto</h5>
            ${col.crucesExtra
              .map((partido) => renderPlantillaNodeEliminatoria(partido, { compact: true }))
              .join("")}
          </div>`
        : "";
      return `
        <section class="eli-plantilla-col">
          <h4>${escapeHtml(formatearRonda(col.ronda))}</h4>
          <div class="eli-plantilla-stack">
            ${tarjetas}
          </div>
          ${extra}
        </section>
      `;
    })
    .join("");

  cont.innerHTML = `<div class="eli-plantilla-grid">${html}</div>`;
}

function obtenerPrimeraRondaActual() {
  const columnas = agruparPorRonda(eliminatoriaState.cruces || []);
  return columnas[0]?.ronda || null;
}

function obtenerEquiposDisponiblesRonda(rondaActual) {
  const vistos = new Set();
  const opciones = [];
  for (const partido of eliminatoriaState.cruces || []) {
    if (String(partido?.ronda || "").toLowerCase() !== String(rondaActual || "").toLowerCase()) continue;
    [
      {
        equipo_id: partido?.equipo_local_id,
        equipo_nombre: partido?.equipo_local_nombre,
        equipo_logo: partido?.equipo_local_logo,
        seed_ref: partido?.seed_local_ref,
      },
      {
        equipo_id: partido?.equipo_visitante_id,
        equipo_nombre: partido?.equipo_visitante_nombre,
        equipo_logo: partido?.equipo_visitante_logo,
        seed_ref: partido?.seed_visitante_ref,
      },
    ].forEach((entry) => {
      const equipoId = Number.parseInt(entry?.equipo_id, 10);
      if (!Number.isFinite(equipoId) || vistos.has(equipoId)) return;
      vistos.add(equipoId);
      opciones.push({
        equipo_id: equipoId,
        equipo_nombre: entry?.equipo_nombre || `Equipo ${equipoId}`,
        equipo_logo: entry?.equipo_logo || null,
        seed_ref: String(entry?.seed_ref || "").toUpperCase().trim() || null,
      });
    });
  }
  return opciones;
}

async function editarCruceEliminatoria(id) {
  const cruce = eliminatoriaState.cruces.find((x) => Number(x.id) === Number(id));
  if (!cruce) {
    mostrarNotificacion("Cruce no encontrado", "warning");
    return;
  }

  const estado = String(cruce?.estado || "pendiente").toLowerCase();
  const tieneResultado =
    Number.isFinite(Number.parseInt(cruce?.resultado_local, 10)) ||
    Number.isFinite(Number.parseInt(cruce?.resultado_visitante, 10)) ||
    Number.isFinite(Number.parseInt(cruce?.ganador_id, 10));
  if (estado === "finalizado" || tieneResultado) {
    mostrarNotificacion("Solo puedes editar cruces pendientes y sin resultado.", "warning");
    return;
  }

  const rondaActual = String(cruce?.ronda || "").toLowerCase() || obtenerPrimeraRondaActual();
  const opciones = obtenerEquiposDisponiblesRonda(rondaActual);
  if (opciones.length < 2) {
    mostrarNotificacion("No hay suficientes equipos disponibles para editar este cruce.", "warning");
    return;
  }

  const opcionesSelect = opciones.map((item) => ({
    value: String(item.equipo_id),
    label: `${item.seed_ref ? `${item.seed_ref} - ` : ""}${item.equipo_nombre}`,
  }));

  const form = await window.mostrarFormularioModal({
    titulo: "Editar cruce manualmente",
    mensaje: "Reasigna los equipos de este partido pendiente. El sistema validará que no se repitan en la misma ronda.",
    tipo: "warning",
    textoConfirmar: "Guardar cruce",
    claseConfirmar: "btn-primary",
    ancho: "md",
    campos: [
      {
        name: "equipo_local_id",
        label: "Equipo local",
        type: "select",
        value: String(cruce.equipo_local_id || ""),
        options: opcionesSelect,
        required: true,
      },
      {
        name: "equipo_visitante_id",
        label: "Equipo visitante",
        type: "select",
        value: String(cruce.equipo_visitante_id || ""),
        options: opcionesSelect,
        required: true,
        validate: (value, values) =>
          String(value || "") === String(values.equipo_local_id || "")
            ? "Local y visitante no pueden ser el mismo equipo."
            : "",
      },
    ],
  });
  if (!form) return;

  const localId = Number.parseInt(form.equipo_local_id, 10);
  const visitanteId = Number.parseInt(form.equipo_visitante_id, 10);
  if (!Number.isFinite(localId) || !Number.isFinite(visitanteId) || localId === visitanteId) {
    mostrarNotificacion("Selecciona dos equipos distintos.", "warning");
    return;
  }

  const conflicto = (eliminatoriaState.cruces || []).find((partido) => {
    if (Number(partido.id) === Number(cruce.id)) return false;
    if (String(partido?.ronda || "").toLowerCase() !== rondaActual) return false;
    return [partido?.equipo_local_id, partido?.equipo_visitante_id]
      .map((value) => Number.parseInt(value, 10))
      .some((value) => value === localId || value === visitanteId);
  });
  if (conflicto) {
    mostrarNotificacion(
      `Uno de los equipos ya está asignado en ${formatearEtiquetaPartidoEliminatoria(
        conflicto.ronda,
        conflicto.partido_numero
      )}.`,
      "warning"
    );
    return;
  }

  const local = opciones.find((item) => Number(item.equipo_id) === localId) || null;
  const visitante = opciones.find((item) => Number(item.equipo_id) === visitanteId) || null;

  try {
    await ApiClient.put(`/eliminatorias/${id}/equipos`, {
      equipo_local_id: localId,
      equipo_visitante_id: visitanteId,
      seed_local_ref: local?.seed_ref || null,
      seed_visitante_ref: visitante?.seed_ref || null,
    });
    mostrarNotificacion("Cruce actualizado", "success");
    await cargarLlaveEliminatoria();
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo actualizar el cruce", "error");
  }
}

function renderBracket() {
  const cont = document.getElementById("eli-bracket");
  if (!cont) return;

  if (!eliminatoriaState.cruces.length) {
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-sitemap"></i>
        <p>No hay llave creada para esta categoría.</p>
      </div>`;
    renderPlantillaPreviewEliminatoria([]);
    renderPosterPublicacion([]);
    renderJornadaPlayoffPoster();
    return;
  }

  const columnas = normalizarColumnasPlayoff(agruparPorRonda(eliminatoriaState.cruces));
  const html = columnas
    .map((col) => {
      const cards = (col.cruces || []).map((c) => renderMatchCardEliminatoria(c)).join("");
      const extra = Array.isArray(col.crucesExtra) && col.crucesExtra.length
        ? `
          <div class="eli-round-subgroup">
            <h5>Tercer y cuarto</h5>
            <div class="eli-round-subgroup-stack">
              ${col.crucesExtra.map((c) => renderMatchCardEliminatoria(c, { compact: true })).join("")}
            </div>
          </div>`
        : "";

      return `
        <section class="eli-round-col">
          <h4>${escapeHtml(formatearRonda(col.ronda))}</h4>
          ${cards}
          ${extra}
        </section>`;
    })
    .join("");

  cont.innerHTML = html;
  renderPlantillaPreviewEliminatoria(columnas);
  renderPosterPublicacion(columnas);
  renderJornadaPlayoffPoster();
}

function renderPosterPublicacion(columnas = []) {
  const cont = document.getElementById("eli-export-rounds");
  const zona = document.getElementById("eli-zona-export");
  if (!cont) return;

  if (!Array.isArray(columnas) || !columnas.length) {
    zona?.classList.remove("is-preview-style");
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-image"></i>
        <p>Genera o carga una llave para preparar la gráfica.</p>
      </div>`;
    return;
  }

  const htmlEspecial = renderPosterPublicacionEspecial16(columnas);
  if (htmlEspecial) {
    zona?.classList.add("is-preview-style");
    cont.style.removeProperty("--eli-round-count");
    cont.innerHTML = htmlEspecial;
    normalizarVistaPosterPublicacion();
    programarRenderConectoresExport();
    return;
  }

  zona?.classList.remove("is-preview-style");

  cont.style.setProperty("--eli-round-count", String(columnas.length));
  const baseGapRem = 1.1;
  const cardHeightRem = 7.6;
  const gapByRound = [baseGapRem];
  const offsetByRound = [0];
  for (let idx = 1; idx < columnas.length; idx += 1) {
    gapByRound[idx] = gapByRound[idx - 1] * 2 + cardHeightRem;
    offsetByRound[idx] = offsetByRound[idx - 1] + (cardHeightRem + gapByRound[idx - 1]) / 2;
  }

  cont.innerHTML = columnas
    .map((col, idx) => {
      const esUltima = idx === columnas.length - 1;
      const gapRem = gapByRound[idx] ?? baseGapRem;
      const offsetRem = offsetByRound[idx] ?? 0;
      const cards = (col.cruces || [])
        .map((c, matchIdx) => {
          const local = c.equipo_local_nombre || "Por definir";
          const visita = c.equipo_visitante_nombre || "Por definir";
          const localLogo = normalizarLogoUrl(c.equipo_local_logo || null);
          const visitaLogo = normalizarLogoUrl(c.equipo_visitante_logo || null);
          const rl = Number.isFinite(Number(c.resultado_local)) ? Number(c.resultado_local) : "-";
          const rv = Number.isFinite(Number(c.resultado_visitante)) ? Number(c.resultado_visitante) : "-";
          const seedL = c.seed_local_ref ? `<small>${escapeHtml(c.seed_local_ref)}</small>` : "";
          const seedV = c.seed_visitante_ref ? `<small>${escapeHtml(c.seed_visitante_ref)}</small>` : "";
          return `
            <article class="eli-export-match" data-round-idx="${idx}" data-match-idx="${matchIdx}">
              <header>${escapeHtml(formatearEtiquetaPartidoEliminatoria(c.ronda, c.partido_numero))}</header>
              <div class="eli-export-team">
                <span class="eli-export-team-meta">
                  ${renderEquipoLogo(localLogo, local, "eli-export-team-logo")}
                  <span>${seedL} ${escapeHtml(local)}</span>
                </span>
                <strong>${escapeHtml(rl)}</strong>
              </div>
              <div class="eli-export-team">
                <span class="eli-export-team-meta">
                  ${renderEquipoLogo(visitaLogo, visita, "eli-export-team-logo")}
                  <span>${seedV} ${escapeHtml(visita)}</span>
                </span>
                <strong>${escapeHtml(rv)}</strong>
              </div>
            </article>
          `;
        })
        .join("");
      const extra = Array.isArray(col.crucesExtra) && col.crucesExtra.length
        ? `
          <div class="eli-export-subround">
            <h5>Tercer y cuarto</h5>
            <div class="eli-export-submatches">
              ${col.crucesExtra
                .map((c) => {
                  const local = c.equipo_local_nombre || "Por definir";
                  const visita = c.equipo_visitante_nombre || "Por definir";
                  const localLogo = normalizarLogoUrl(c.equipo_local_logo || null);
                  const visitaLogo = normalizarLogoUrl(c.equipo_visitante_logo || null);
                  const rl = Number.isFinite(Number(c.resultado_local)) ? Number(c.resultado_local) : "-";
                  const rv = Number.isFinite(Number(c.resultado_visitante)) ? Number(c.resultado_visitante) : "-";
                  return `
                    <article class="eli-export-match is-compact">
                      <header>${escapeHtml(formatearEtiquetaPartidoEliminatoria(c.ronda, c.partido_numero))}</header>
                      <div class="eli-export-team">
                        <span class="eli-export-team-meta">
                          ${renderEquipoLogo(localLogo, local, "eli-export-team-logo")}
                          <span>${escapeHtml(local)}</span>
                        </span>
                        <strong>${escapeHtml(rl)}</strong>
                      </div>
                      <div class="eli-export-team">
                        <span class="eli-export-team-meta">
                          ${renderEquipoLogo(visitaLogo, visita, "eli-export-team-logo")}
                          <span>${escapeHtml(visita)}</span>
                        </span>
                        <strong>${escapeHtml(rv)}</strong>
                      </div>
                    </article>
                  `;
                })
                .join("")}
            </div>
          </div>`
        : "";

      return `
        <section
          class="eli-export-round ${esUltima ? "is-last" : ""}"
          data-round-idx="${idx}"
          style="--eli-gap:${gapRem}rem; --eli-offset:${offsetRem}rem"
        >
          <h4>${escapeHtml(formatearRonda(col.ronda))}</h4>
          <div class="eli-export-matches">
            ${cards}
          </div>
          ${extra}
        </section>
      `;
    })
    .join("");

  programarRenderConectoresExport();
  normalizarVistaPosterPublicacion();
}

function programarRenderConectoresExport() {
  if (!listenersConectoresExportInicializados) {
    listenersConectoresExportInicializados = true;
    window.addEventListener("resize", () => {
      renderConectoresExport();
      renderConectoresEspecialesActivos();
    });
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      renderConectoresExport();
      renderConectoresEspecialesActivos();
    });
  });
}

function renderConectoresEspecialesActivos() {
  renderConectoresBracketEspecial(".eli-plantilla-bracket16", ".eli-plantilla-col", ".eli-plantilla-node", "eli-plantilla-connectors");
  renderConectoresBracketEspecial(".eli-export-bracket16", ".eli-export-col", ".eli-export-node", "eli-export-special-connectors");
}

function renderConectoresBracketEspecial(bracketSelector, colSelector, nodeSelector, svgClass) {
  const bracket = document.querySelector(bracketSelector);
  if (!bracket) return;

  const previo = bracket.querySelector(`.${svgClass}`);
  if (previo) previo.remove();

  const cols = Array.from(bracket.querySelectorAll(colSelector));
  if (cols.length < 7) return;

  const left8 = Array.from(cols[0].querySelectorAll(nodeSelector));
  const left4 = Array.from(cols[1].querySelectorAll(nodeSelector));
  const semiLeft = cols[2].querySelector(nodeSelector);
  const centerNodes = Array.from(cols[3].querySelectorAll(nodeSelector));
  const finalNode = centerNodes[0] || null;
  const semiRight = cols[4].querySelector(nodeSelector);
  const right4 = Array.from(cols[5].querySelectorAll(nodeSelector));
  const right8 = Array.from(cols[6].querySelectorAll(nodeSelector));

  if (!finalNode || !semiLeft || !semiRight || left4.length < 2 || right4.length < 2 || left8.length < 4 || right8.length < 4) {
    return;
  }

  const rect = bracket.getBoundingClientRect();
  const width = Math.ceil(bracket.scrollWidth || rect.width);
  const height = Math.ceil(bracket.scrollHeight || rect.height);
  if (width <= 0 || height <= 0) return;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", svgClass);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));

  const outline = "rgba(255,255,255,0.74)";
  const color = "#4f78ba";
  const strokeWidth = 2.7;

  function appendStyledPath(d) {
    const base = document.createElementNS("http://www.w3.org/2000/svg", "path");
    base.setAttribute("d", d);
    base.setAttribute("fill", "none");
    base.setAttribute("stroke", outline);
    base.setAttribute("stroke-width", String(strokeWidth + 1.8));
    base.setAttribute("stroke-linecap", "round");
    base.setAttribute("stroke-linejoin", "round");
    base.setAttribute("opacity", "0.65");
    svg.appendChild(base);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("d", d);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", String(strokeWidth));
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("stroke-linejoin", "round");
    svg.appendChild(line);
  }

  function appendPath(sourceEl, targetEl, direction = "ltr") {
    if (!sourceEl || !targetEl) return;
    const sourceRect = sourceEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const startX =
      direction === "rtl" ? sourceRect.left - rect.left : sourceRect.right - rect.left;
    const endX =
      direction === "rtl" ? targetRect.right - rect.left : targetRect.left - rect.left;
    const startY = sourceRect.top - rect.top + sourceRect.height / 2;
    const endY = targetRect.top - rect.top + targetRect.height / 2;
    const distance = Math.abs(endX - startX);
    const offset = Math.max(16, distance * 0.36);
    const midX = direction === "rtl" ? startX - offset : startX + offset;

    appendStyledPath(`M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`);
  }

  appendPath(left8[0], left4[0], "ltr");
  appendPath(left8[1], left4[0], "ltr");
  appendPath(left8[2], left4[1], "ltr");
  appendPath(left8[3], left4[1], "ltr");
  appendPath(left4[0], semiLeft, "ltr");
  appendPath(left4[1], semiLeft, "ltr");
  appendPath(semiLeft, finalNode, "ltr");

  appendPath(right8[0], right4[0], "rtl");
  appendPath(right8[1], right4[0], "rtl");
  appendPath(right8[2], right4[1], "rtl");
  appendPath(right8[3], right4[1], "rtl");
  appendPath(right4[0], semiRight, "rtl");
  appendPath(right4[1], semiRight, "rtl");
  appendPath(semiRight, finalNode, "rtl");

  bracket.appendChild(svg);
}

function renderConectoresExport() {
  const cont = document.getElementById("eli-export-rounds");
  if (!cont) return;

  const rounds = Array.from(cont.querySelectorAll(".eli-export-round"));
  const previous = cont.querySelector(".eli-export-connectors");
  if (previous) previous.remove();

  if (rounds.length < 2) return;

  const contRect = cont.getBoundingClientRect();
  const width = Math.ceil(cont.scrollWidth);
  const height = Math.ceil(cont.scrollHeight);
  if (width <= 0 || height <= 0) return;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "eli-export-connectors");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));

  for (let roundIdx = 0; roundIdx < rounds.length - 1; roundIdx += 1) {
    const round = rounds[roundIdx];
    const nextRound = rounds[roundIdx + 1];
    const matches = Array.from(round.querySelectorAll(".eli-export-match"));
    const nextMatches = Array.from(nextRound.querySelectorAll(".eli-export-match"));
    if (!matches.length || !nextMatches.length) continue;

    const color = roundIdx === rounds.length - 2 ? "#9f1239" : "#8ea3bc";
    const strokeWidth = roundIdx === rounds.length - 2 ? 3.4 : 2.6;

    matches.forEach((match, idx) => {
      const target = nextMatches[Math.floor(idx / 2)] || null;
      if (!target) return;

      const mRect = match.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();

      const startX = mRect.right - contRect.left;
      const startY = mRect.top - contRect.top + mRect.height / 2;
      const endX = tRect.left - contRect.left;
      const endY = tRect.top - contRect.top + tRect.height / 2;
      const midX = startX + Math.max(22, (endX - startX) * 0.5);

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute(
        "d",
        `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`
      );
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", String(strokeWidth));
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
    });
  }

  cont.appendChild(svg);
}

function normalizarVistaPosterPublicacion() {
  const cont = document.getElementById("eli-export-rounds");
  if (!cont) return;
  cont.scrollLeft = 0;
  cont.scrollTop = 0;
}

function prepararZonaParaCapturaEliminatoria(zona) {
  const rounds = document.getElementById("eli-export-rounds");
  if (!zona || !rounds) {
    return () => {};
  }

  const prevZonaWidth = zona.style.width;
  const prevZonaMaxWidth = zona.style.maxWidth;
  const prevZonaOverflow = zona.style.overflow;
  const prevRoundsWidth = rounds.style.width;
  const prevRoundsMaxWidth = rounds.style.maxWidth;
  const prevRoundsOverflowX = rounds.style.overflowX;
  const prevRoundsOverflowY = rounds.style.overflowY;
  const prevRoundsMinWidth = rounds.style.minWidth;

  normalizarVistaPosterPublicacion();
  rounds.style.overflowX = "visible";
  rounds.style.overflowY = "visible";
  rounds.style.minWidth = "0";
  rounds.style.width = `${Math.max(rounds.scrollWidth, rounds.clientWidth)}px`;
  rounds.style.maxWidth = "none";
  zona.style.width = `${Math.max(zona.scrollWidth, rounds.scrollWidth, zona.clientWidth)}px`;
  zona.style.maxWidth = "none";
  zona.style.overflow = "visible";

  renderConectoresExport();
  renderConectoresEspecialesActivos();

  return () => {
    zona.style.width = prevZonaWidth;
    zona.style.maxWidth = prevZonaMaxWidth;
    zona.style.overflow = prevZonaOverflow;
    rounds.style.width = prevRoundsWidth;
    rounds.style.maxWidth = prevRoundsMaxWidth;
    rounds.style.overflowX = prevRoundsOverflowX;
    rounds.style.overflowY = prevRoundsOverflowY;
    rounds.style.minWidth = prevRoundsMinWidth;
    normalizarVistaPosterPublicacion();
  };
}

async function registrarResultadoEliminatoria(id) {
  const cruce = eliminatoriaState.cruces.find((x) => Number(x.id) === Number(id));
  if (!cruce) {
    mostrarNotificacion("Cruce no encontrado", "warning");
    return;
  }
  if (!cruce.equipo_local_id || !cruce.equipo_visitante_id) {
    mostrarNotificacion("El cruce aún no tiene ambos equipos definidos", "warning");
    return;
  }

  const form = await window.mostrarFormularioModal({
    titulo: "Registrar resultado",
    mensaje: "Ingresa el marcador final del cruce eliminatorio.",
    tipo: "info",
    textoConfirmar: "Guardar resultado",
    ancho: "sm",
    campos: [
      {
        name: "resultado_local",
        label: cruce.equipo_local_nombre || "Equipo local",
        type: "number",
        value: String(cruce.resultado_local ?? 0),
        min: 0,
        step: 1,
        required: true,
      },
      {
        name: "resultado_visitante",
        label: cruce.equipo_visitante_nombre || "Equipo visitante",
        type: "number",
        value: String(cruce.resultado_visitante ?? 0),
        min: 0,
        step: 1,
        required: true,
      },
    ],
  });
  if (!form) return;

  const rlRaw = String(form.resultado_local || "").trim();
  const rvRaw = String(form.resultado_visitante || "").trim();

  const rl = Number.parseInt(rlRaw, 10);
  const rv = Number.parseInt(rvRaw, 10);
  if (!Number.isFinite(rl) || !Number.isFinite(rv) || rl < 0 || rv < 0) {
    mostrarNotificacion("Marcador inválido", "warning");
    return;
  }
  if (rl === rv) {
    mostrarNotificacion("No se permiten empates en eliminatoria", "warning");
    return;
  }

  const ganadorId = rl > rv ? Number(cruce.equipo_local_id) : Number(cruce.equipo_visitante_id);
  try {
    await ApiClient.put(`/eliminatorias/${id}/resultado`, {
      resultado_local: rl,
      resultado_visitante: rv,
      ganador_id: ganadorId,
    });
    mostrarNotificacion("Resultado actualizado", "success");
    await cargarLlaveEliminatoria();
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo registrar resultado", "error");
  }
}

function abrirEnPartidos() {
  const eventoId = eliminatoriaState.eventoSeleccionado;
  if (!eventoId) {
    mostrarNotificacion("Selecciona una categoría", "warning");
    return;
  }
  if (window.RouteContext?.navigate) {
    window.RouteContext.navigate("partidos.html", { evento: Number(eventoId) || null });
    return;
  }
  window.location.href = `partidos.html?evento=${encodeURIComponent(eventoId)}`;
}

function normalizarLogoUrl(logoUrl) {
  if (!logoUrl) return null;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  const limpio = String(logoUrl).trim();
  if (!limpio) return null;
  if (limpio.startsWith("/uploads/")) return `${BACKEND_BASE}${limpio}`;
  if (limpio.startsWith("uploads/")) return `${BACKEND_BASE}/${limpio}`;
  if (limpio.startsWith("/")) return `${BACKEND_BASE}${limpio}`;
  return `${BACKEND_BASE}/uploads/${limpio}`;
}

function getZonaExportEliminatoria() {
  return document.getElementById("eli-zona-export");
}

function getZonaJornadaPlayoff() {
  return document.getElementById("eli-jornada-export");
}

async function esperarImagenes(zona) {
  const imgs = Array.from(zona.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          let done = false;
          const finalizar = () => {
            if (done) return;
            done = true;
            resolve();
          };
          if (img.complete) return finalizar();
          img.addEventListener("load", finalizar, { once: true });
          img.addEventListener("error", finalizar, { once: true });
          setTimeout(finalizar, 5000);
        })
    )
  );
}

async function imgToDataURL(url) {
  const res = await fetch(url, { mode: "cors", cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`No se pudo cargar imagen (${res.status})`);
  }
  const blob = await res.blob();
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function inlineImagesAsBase64(zona) {
  const imgs = Array.from(zona.querySelectorAll("img"));
  for (const img of imgs) {
    try {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) continue;
      const dataUrl = await imgToDataURL(src);
      img.setAttribute("src", dataUrl);
    } catch (e) {
      console.warn("No se pudo convertir imagen:", img?.src, e);
    }
  }
}

function getNombreArchivoBase() {
  return eliminatoriaState.eventoSeleccionado
    ? `playoff_evento_${eliminatoriaState.eventoSeleccionado}`
    : "playoff_evento";
}

function getNombreArchivoJornadaPlayoff() {
  const ronda = eliminatoriaState.rondaJornadaSeleccionada || "ronda";
  return `${getNombreArchivoBase()}_${ronda}`.toLowerCase();
}

function obtenerSiglaEquipo(nombre = "") {
  const limpio = String(nombre || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!limpio.length) return "EQ";
  if (limpio.length === 1) return limpio[0].slice(0, 2).toUpperCase();
  return `${limpio[0][0] || ""}${limpio[1][0] || ""}`.toUpperCase();
}

function renderEquipoLogo(logoUrl, nombreEquipo, className = "eli-team-logo") {
  if (logoUrl) {
    return `<img class="${className}" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(
      nombreEquipo || "Equipo"
    )}" crossorigin="anonymous" referrerpolicy="no-referrer" />`;
  }
  return `<span class="${className} is-fallback">${escapeHtml(obtenerSiglaEquipo(nombreEquipo))}</span>`;
}

function descargarBlobEliminatoria(blob, filename) {
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
  return true;
}

function prepararZonaParaCapturaSimple(zona) {
  if (!zona) return () => {};
  const prevWidth = zona.style.width;
  const prevMaxWidth = zona.style.maxWidth;
  const prevOverflow = zona.style.overflow;
  zona.style.width = `${Math.max(zona.scrollWidth, zona.clientWidth)}px`;
  zona.style.maxWidth = "none";
  zona.style.overflow = "visible";
  return () => {
    zona.style.width = prevWidth;
    zona.style.maxWidth = prevMaxWidth;
    zona.style.overflow = prevOverflow;
  };
}

async function exportarEliminatoriaPNG() {
  let restaurarCaptura = () => {};
  try {
    const zona = getZonaExportEliminatoria();
    if (!zona) return;
    if (!eliminatoriaState.cruces.length) {
      mostrarNotificacion("No hay llave cargada para exportar", "warning");
      return;
    }
    if (!window.html2canvas) {
      mostrarNotificacion("No se cargó html2canvas", "error");
      return;
    }

    restaurarCaptura = prepararZonaParaCapturaEliminatoria(zona);
    await esperarImagenes(zona);
    await inlineImagesAsBase64(zona);

    const canvas = await html2canvas(zona, {
      scale: 2,
      backgroundColor: "#eef2f7",
      useCors: true,
      width: zona.scrollWidth,
      height: zona.scrollHeight,
      windowWidth: zona.scrollWidth,
      windowHeight: zona.scrollHeight,
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob || !descargarBlobEliminatoria(blob, `${getNombreArchivoBase()}.png`)) {
      throw new Error("No se pudo preparar la descarga de la imagen.");
    }
    mostrarNotificacion("Imagen exportada", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion("No se pudo exportar la imagen", "error");
  } finally {
    restaurarCaptura();
  }
}

async function exportarEliminatoriaPDF() {
  let restaurarCaptura = () => {};
  try {
    const zona = getZonaExportEliminatoria();
    if (!zona) return;
    if (!eliminatoriaState.cruces.length) {
      mostrarNotificacion("No hay llave cargada para exportar", "warning");
      return;
    }
    if (!window.html2canvas || !window.jspdf?.jsPDF) {
      mostrarNotificacion("No se cargó librería PDF", "error");
      return;
    }

    restaurarCaptura = prepararZonaParaCapturaEliminatoria(zona);
    await esperarImagenes(zona);
    await inlineImagesAsBase64(zona);

    const canvas = await html2canvas(zona, {
      scale: 2,
      backgroundColor: "#eef2f7",
      useCors: true,
      width: zona.scrollWidth,
      height: zona.scrollHeight,
      windowWidth: zona.scrollWidth,
      windowHeight: zona.scrollHeight,
    });
    const imgData = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("l", "mm", "a4");

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const props = pdf.getImageProperties(imgData);
    const renderW = pageW - 10;
    const renderH = (props.height * renderW) / props.width;
    const finalH = Math.min(renderH, pageH - 12);
    const y = (pageH - finalH) / 2;
    pdf.addImage(imgData, "PNG", 5, y, renderW, finalH);
    const blob = pdf.output("blob");
    if (!blob || !descargarBlobEliminatoria(blob, `${getNombreArchivoBase()}.pdf`)) {
      throw new Error("No se pudo preparar la descarga del PDF.");
    }
    mostrarNotificacion("PDF exportado", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion("No se pudo exportar el PDF", "error");
  } finally {
    restaurarCaptura();
  }
}

async function compartirEliminatoria() {
  let restaurarCaptura = () => {};
  try {
    const zona = getZonaExportEliminatoria();
    if (!zona) return;
    if (!eliminatoriaState.cruces.length) {
      mostrarNotificacion("No hay llave cargada para compartir", "warning");
      return;
    }
    if (!window.html2canvas) {
      mostrarNotificacion("No se cargó html2canvas", "error");
      return;
    }

    restaurarCaptura = prepararZonaParaCapturaEliminatoria(zona);
    await esperarImagenes(zona);
    await inlineImagesAsBase64(zona);

    const canvas = await html2canvas(zona, {
      scale: 2,
      backgroundColor: "#eef2f7",
      useCors: true,
      width: zona.scrollWidth,
      height: zona.scrollHeight,
      windowWidth: zona.scrollWidth,
      windowHeight: zona.scrollHeight,
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      mostrarNotificacion("No se pudo preparar la imagen para compartir", "error");
      return;
    }

    const file = new File([blob], `${getNombreArchivoBase()}.png`, { type: "image/png" });
    const titulo = eliminatoriaState.contextoPublicacion?.campeonatoNombre || "Playoff";

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `Llave eliminatoria - ${titulo}`,
          text: "Te comparto la llave eliminatoria del campeonato.",
          files: [file],
        });
        return;
      } catch (error) {
        console.warn("Compartir cancelado o falló:", error);
      }
    }

    mostrarNotificacion("Tu navegador no soporta compartir directo. Se descargará la imagen.", "warning");
    if (!descargarBlobEliminatoria(blob, file.name)) {
      throw new Error("No se pudo preparar la descarga de la imagen compartible.");
    }
  } catch (error) {
    console.error(error);
    mostrarNotificacion("No se pudo compartir/exportar la imagen", "error");
  } finally {
    restaurarCaptura();
  }
}

async function exportarJornadaPlayoffPNG() {
  let restaurarCaptura = () => {};
  try {
    const zona = getZonaJornadaPlayoff();
    if (!zona) return;
    if (!eliminatoriaState.rondaJornadaSeleccionada) {
      mostrarNotificacion("Selecciona una ronda del playoff", "warning");
      return;
    }
    if (!window.html2canvas) {
      mostrarNotificacion("No se cargó html2canvas", "error");
      return;
    }

    restaurarCaptura = prepararZonaParaCapturaSimple(zona);
    await esperarImagenes(zona);
    await inlineImagesAsBase64(zona);

    const canvas = await html2canvas(zona, {
      scale: 2,
      backgroundColor: "#eef2f7",
      useCors: true,
      width: zona.scrollWidth,
      height: zona.scrollHeight,
      windowWidth: zona.scrollWidth,
      windowHeight: zona.scrollHeight,
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob || !descargarBlobEliminatoria(blob, `${getNombreArchivoJornadaPlayoff()}.png`)) {
      throw new Error("No se pudo preparar la descarga de la jornada.");
    }
    mostrarNotificacion("Imagen de la jornada exportada", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion("No se pudo exportar la jornada", "error");
  } finally {
    restaurarCaptura();
  }
}

async function exportarJornadaPlayoffPDF() {
  let restaurarCaptura = () => {};
  try {
    const zona = getZonaJornadaPlayoff();
    if (!zona) return;
    if (!eliminatoriaState.rondaJornadaSeleccionada) {
      mostrarNotificacion("Selecciona una ronda del playoff", "warning");
      return;
    }
    if (!window.html2canvas || !window.jspdf?.jsPDF) {
      mostrarNotificacion("No se cargó librería PDF", "error");
      return;
    }

    restaurarCaptura = prepararZonaParaCapturaSimple(zona);
    await esperarImagenes(zona);
    await inlineImagesAsBase64(zona);

    const canvas = await html2canvas(zona, {
      scale: 2,
      backgroundColor: "#eef2f7",
      useCors: true,
      width: zona.scrollWidth,
      height: zona.scrollHeight,
      windowWidth: zona.scrollWidth,
      windowHeight: zona.scrollHeight,
    });
    const imgData = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const props = pdf.getImageProperties(imgData);
    const renderW = pageW - 12;
    const renderH = (props.height * renderW) / props.width;
    const finalH = Math.min(renderH, pageH - 12);
    const y = (pageH - finalH) / 2;
    pdf.addImage(imgData, "PNG", 6, y, renderW, finalH);
    const blob = pdf.output("blob");
    if (!blob || !descargarBlobEliminatoria(blob, `${getNombreArchivoJornadaPlayoff()}.pdf`)) {
      throw new Error("No se pudo preparar el PDF de la jornada.");
    }
    mostrarNotificacion("PDF de la jornada exportado", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion("No se pudo exportar el PDF de la jornada", "error");
  } finally {
    restaurarCaptura();
  }
}

function formatearRonda(ronda) {
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

function formatearEtiquetaPartidoEliminatoria(ronda, numero) {
  const n = Number.parseInt(numero, 10);
  const key = String(ronda || "").toLowerCase();
  if (!Number.isFinite(n) || n <= 0) return formatearRonda(ronda);
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

function formatearMetodo(metodo) {
  const key = String(metodo || "").toLowerCase();
  if (key === "liga") return "Liga";
  if (key === "eliminatoria") return "Eliminatoria";
  if (key === "mixto") return "Mixto";
  if (key === "tabla_acumulada") return "Tabla acumulada";
  return "Grupos";
}

function formatearMotivoEliminacion(motivo) {
  const key = String(motivo || "").trim().toLowerCase();
  if (key === "indisciplina") return "Indisciplina";
  if (key === "deudas") return "No pagar cuentas";
  if (key === "sin_justificativo_segunda_no_presentacion") {
    return "2da no presentación sin justificativo";
  }
  return "Sin motivo";
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

window.registrarResultadoEliminatoria = registrarResultadoEliminatoria;
window.editarCruceEliminatoria = editarCruceEliminatoria;
window.exportarEliminatoriaPNG = exportarEliminatoriaPNG;
window.exportarEliminatoriaPDF = exportarEliminatoriaPDF;
window.compartirEliminatoria = compartirEliminatoria;
window.exportarJornadaPlayoffPNG = exportarJornadaPlayoffPNG;
window.exportarJornadaPlayoffPDF = exportarJornadaPlayoffPDF;

// ══ Programación de partidos de playoff ══

let _eliProgPartidoId = null;

function actualizarBarraProgPlayoff() {
  const toolbar = document.getElementById("eli-prog-toolbar");
  if (toolbar) toolbar.style.display = eliminatoriaState.esAdminLike ? "flex" : "none";
}

// Modal: programar partido individual
function abrirModalProgPartidoEli(partidoId, titulo, fecha, hora, cancha) {
  _eliProgPartidoId = partidoId;
  const tituloEl = document.getElementById("modal-prog-titulo");
  if (tituloEl) tituloEl.textContent = `Programar: ${titulo}`;
  const fechaEl = document.getElementById("eli-prog-fecha");
  const horaEl = document.getElementById("eli-prog-hora");
  const canchaEl = document.getElementById("eli-prog-cancha");
  if (fechaEl) fechaEl.value = fecha || "";
  if (horaEl) horaEl.value = hora || "";
  if (canchaEl) canchaEl.value = cancha || "";
  const modal = document.getElementById("modal-prog-partido-eli");
  if (modal) {
    modal.style.display = "flex";
    document.body.classList.add("eli-modal-open");
  }
  window.requestAnimationFrame(() => {
    (fechaEl || horaEl || canchaEl)?.focus?.();
  });
}

function cerrarModalProgPartidoEli() {
  const modal = document.getElementById("modal-prog-partido-eli");
  if (modal) modal.style.display = "none";
  document.body.classList.remove("eli-modal-open");
  _eliProgPartidoId = null;
}

async function guardarProgPartidoEli() {
  if (!_eliProgPartidoId) return;
  const fecha = document.getElementById("eli-prog-fecha")?.value || null;
  const hora = document.getElementById("eli-prog-hora")?.value || null;
  const cancha = document.getElementById("eli-prog-cancha")?.value || null;
  try {
    await ApiClient.put(`/eliminatorias/${_eliProgPartidoId}/programar`, {
      fecha_partido: fecha || null,
      hora_partido: hora || null,
      cancha: cancha || null,
    });
    mostrarNotificacion("Partido programado correctamente", "success");
    cerrarModalProgPartidoEli();
    await cargarLlaveEliminatoria();
    renderBracket();
  } catch (e) {
    mostrarNotificacion(e?.message || "No se pudo programar el partido", "error");
  }
}

// Modal: auto-programar todos los partidos pendientes
function abrirModalAutoProgramarPlayoff() {
  // Prefill fecha con hoy
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");
  const fechaEl = document.getElementById("eli-auto-fecha");
  if (fechaEl && !fechaEl.value) fechaEl.value = `${yyyy}-${mm}-${dd}`;
  const modal = document.getElementById("modal-auto-prog-eli");
  if (modal) {
    modal.style.display = "flex";
    document.body.classList.add("eli-modal-open");
  }
  window.requestAnimationFrame(() => {
    fechaEl?.focus?.();
  });
}

function cerrarModalAutoProgEli() {
  const modal = document.getElementById("modal-auto-prog-eli");
  if (modal) modal.style.display = "none";
  document.body.classList.remove("eli-modal-open");
}

async function ejecutarAutoProgEli() {
  const fecha = document.getElementById("eli-auto-fecha")?.value;
  const horaInicioStr = document.getElementById("eli-auto-hora-inicio")?.value || "09:00";
  const horaFinStr = document.getElementById("eli-auto-hora-fin")?.value || "18:00";
  const duracion = Number(document.getElementById("eli-auto-duracion")?.value) || 90;
  const cancha = document.getElementById("eli-auto-cancha")?.value || "";
  const sobrescribir = document.getElementById("eli-auto-sobrescribir")?.checked || false;

  if (!fecha) {
    mostrarNotificacion("Selecciona una fecha de inicio", "warning");
    return;
  }

  // Obtener todos los cruces, ordenados por ronda y partido
  const crucesPendientes = [...eliminatoriaState.cruces]
    .filter((c) => c.id && (sobrescribir || !c.fecha_partido))
    .sort((a, b) => Number(a.ronda) - Number(b.ronda) || Number(a.partido_numero) - Number(b.partido_numero));

  if (!crucesPendientes.length) {
    mostrarNotificacion("No hay partidos pendientes de programar", "info");
    return;
  }

  // Convertir hora a minutos desde medianoche
  const toMinutes = (hStr) => {
    const [h, m] = hStr.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const toHoraStr = (min) => {
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  let fechaActual = fecha;
  let minutosActuales = toMinutes(horaInicioStr);
  const minutosLimite = toMinutes(horaFinStr);

  const avanzarDia = () => {
    const d = new Date(`${fechaActual}T12:00:00`);
    d.setDate(d.getDate() + 1);
    const yy = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const dy = String(d.getDate()).padStart(2, "0");
    fechaActual = `${yy}-${mo}-${dy}`;
    minutosActuales = toMinutes(horaInicioStr);
  };

  let errores = 0;
  for (const c of crucesPendientes) {
    // Si se pasa del horario limite, avanzar al siguiente día
    if (minutosActuales + duracion > minutosLimite) {
      avanzarDia();
    }
    const horaAsignada = toHoraStr(minutosActuales);
    try {
      await ApiClient.put(`/eliminatorias/${c.id}/programar`, {
        fecha_partido: fechaActual,
        hora_partido: `${horaAsignada}:00`,
        cancha: cancha || null,
      });
    } catch {
      errores++;
    }
    minutosActuales += duracion;
  }

  cerrarModalAutoProgEli();
  await cargarLlaveEliminatoria();
  renderBracket();

  if (errores) {
    mostrarNotificacion(`Programados con ${errores} error(es)`, "warning");
  } else {
    mostrarNotificacion(`${crucesPendientes.length} partidos programados correctamente`, "success");
  }
}

window.abrirModalProgPartidoEli = abrirModalProgPartidoEli;
window.cerrarModalProgPartidoEli = cerrarModalProgPartidoEli;
window.guardarProgPartidoEli = guardarProgPartidoEli;
window.abrirModalAutoProgramarPlayoff = abrirModalAutoProgramarPlayoff;
window.cerrarModalAutoProgEli = cerrarModalAutoProgEli;
window.ejecutarAutoProgEli = ejecutarAutoProgEli;
