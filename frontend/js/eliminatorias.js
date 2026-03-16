const RONDAS_ORDEN_ELI = ["32vos", "16vos", "12vos", "8vos", "4tos", "semifinal", "final", "tercer_puesto"];
const BACKEND_BASE = (window.resolveBackendBaseUrl
  ? window.resolveBackendBaseUrl()
  : `${window.location.origin}`).replace(/\/$/, "");
const EMBED_MODE = new URLSearchParams(window.location.search).get("embed") === "1";

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
  },
};
let listenersConectoresExportInicializados = false;

function parsePositiveInt(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
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
  if (key === "balanceada_8vos") return "Balanceada 8vos";
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
  const clasificados = parsePositiveInt(document.getElementById("eli-clasificados")?.value || "");
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
  aplicarPermisosEliminatoriaUI();
  bindEventosEliminatoria();
  await cargarEventosEliminatoria();
  await preseleccionarEventoDesdeURL();
  await cargarContextoPublicacion(eliminatoriaState.eventoSeleccionado);
  actualizarUIPlayoffPorOrigen();
});

function aplicarPermisosEliminatoriaUI() {
  if (eliminatoriaState.esAdminLike) return;
  const btn = document.getElementById("btn-eli-generar");
  if (btn) btn.style.display = "none";
  const adminEstado = document.getElementById("eli-admin-estado-section");
  const adminClasif = document.getElementById("eli-admin-clasificacion-section");
  if (adminEstado) adminEstado.style.display = "none";
  if (adminClasif) adminClasif.style.display = "none";
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
    await cargarResumenClasificacionManual();
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
  document.getElementById("btn-eli-export-png")?.addEventListener("click", exportarEliminatoriaPNG);
  document.getElementById("btn-eli-export-pdf")?.addEventListener("click", exportarEliminatoriaPDF);
  document.getElementById("btn-eli-share")?.addEventListener("click", compartirEliminatoria);
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
  const cupos = Number.parseInt(document.getElementById("eli-clasificados")?.value || "2", 10);
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
}

async function cargarAuspiciantesPublicacion(campeonatoIdRaw) {
  const wrap = document.getElementById("eli-export-sponsors");
  const grid = document.getElementById("eli-export-sponsors-grid");
  if (!wrap || !grid) return;

  wrap.style.display = "none";
  grid.innerHTML = "";

  let campeonatoId = Number.parseInt(campeonatoIdRaw || "", 10);
  if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
    const eventoActual = obtenerEventoActual();
    campeonatoId = Number.parseInt(eventoActual?.campeonato_id || "", 10);
  }
  if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
    if (eliminatoriaState.contextoPublicacion) {
      eliminatoriaState.contextoPublicacion.auspiciantes = [];
    }
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
      grid.innerHTML = `<div class="eli-export-sponsor-item is-text"><span>Sin auspiciantes registrados</span></div>`;
      wrap.style.display = "block";
      return;
    }

    grid.innerHTML = lista
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
  } catch (error) {
    console.warn("No se pudieron cargar auspiciantes para la plantilla de eliminatoria:", error);
    if (eliminatoriaState.contextoPublicacion) {
      eliminatoriaState.contextoPublicacion.auspiciantes = [];
    }
    grid.innerHTML = `<div class="eli-export-sponsor-item is-text"><span>No se pudieron cargar auspiciantes</span></div>`;
    wrap.style.display = "block";
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
  const clasificados = parsePositiveInt(evento?.clasificados_por_grupo) || 2;
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
  if (letras.length < 2) {
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-layer-group"></i>
        <p>Debes tener al menos 2 grupos creados para configurar cruces.</p>
      </div>`;
    return;
  }

  const pares = Math.floor(letras.length / 2);
  const rows = [];
  for (let i = 0; i < pares; i++) {
    const parBase = crucesActuales[i] || crucesGuardados[i] || [
      letras[i],
      letras[letras.length - 1 - i],
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
  });
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
  const clasificadosPorGrupo = Number.parseInt(
    document.getElementById("eli-clasificados")?.value || "2",
    10
  );
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

function renderBracket() {
  const cont = document.getElementById("eli-bracket");
  if (!cont) return;

  if (!eliminatoriaState.cruces.length) {
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-sitemap"></i>
        <p>No hay llave creada para esta categoría.</p>
      </div>`;
    renderPosterPublicacion([]);
    return;
  }

  const columnas = agruparPorRonda(eliminatoriaState.cruces);
  const html = columnas
    .map((col) => {
      const cards = col.cruces
        .map((c) => {
          const local = nombrePlaceholderEliminatoria(c, "local");
          const visita = nombrePlaceholderEliminatoria(c, "visitante");
          const localLogo = normalizarLogoUrl(c.equipo_local_logo || null);
          const visitaLogo = normalizarLogoUrl(c.equipo_visitante_logo || null);
          const rl = Number.isFinite(Number(c.resultado_local)) ? Number(c.resultado_local) : "-";
          const rv = Number.isFinite(Number(c.resultado_visitante)) ? Number(c.resultado_visitante) : "-";
          const ganador = c.ganador_nombre || "Pendiente";
          const seedL = c.seed_local_ref ? `<small>${escapeHtml(c.seed_local_ref)}</small>` : "";
          const seedV = c.seed_visitante_ref ? `<small>${escapeHtml(c.seed_visitante_ref)}</small>` : "";
          return `
            <article class="eli-match-card">
              <div class="eli-match-head">
                <strong>${escapeHtml(formatearEtiquetaPartidoEliminatoria(c.ronda, c.partido_numero))}</strong>
              </div>
              <div class="eli-team-row">
                <span class="eli-team-meta">
                  ${renderEquipoLogo(localLogo, local, "eli-team-logo")}
                  <span>${seedL} ${escapeHtml(local)}</span>
                </span>
                <span class="eli-score">${escapeHtml(rl)}</span>
              </div>
              <div class="eli-team-row">
                <span class="eli-team-meta">
                  ${renderEquipoLogo(visitaLogo, visita, "eli-team-logo")}
                  <span>${seedV} ${escapeHtml(visita)}</span>
                </span>
                <span class="eli-score">${escapeHtml(rv)}</span>
              </div>
              <div class="eli-winner">Ganador: ${escapeHtml(ganador)}</div>
              ${
                eliminatoriaState.esAdminLike
                  ? `<button class="btn btn-warning" onclick="registrarResultadoEliminatoria(${Number(
                      c.id
                    )})"><i class="fas fa-edit"></i> Resultado</button>`
                  : ""
              }
            </article>
          `;
        })
        .join("");

      return `
        <section class="eli-round-col">
          <h4>${escapeHtml(formatearRonda(col.ronda))}</h4>
          ${cards}
        </section>`;
    })
    .join("");

  cont.innerHTML = html;
  renderPosterPublicacion(columnas);
}

function renderPosterPublicacion(columnas = []) {
  const cont = document.getElementById("eli-export-rounds");
  if (!cont) return;

  if (!Array.isArray(columnas) || !columnas.length) {
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-image"></i>
        <p>Genera o carga una llave para preparar la gráfica.</p>
      </div>`;
    return;
  }

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
    });
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      renderConectoresExport();
    });
  });
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

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${getNombreArchivoBase()}.png`;
    a.click();
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
    pdf.save(`${getNombreArchivoBase()}.pdf`);
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
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (error) {
    console.error(error);
    mostrarNotificacion("No se pudo compartir/exportar la imagen", "error");
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
window.exportarEliminatoriaPNG = exportarEliminatoriaPNG;
window.exportarEliminatoriaPDF = exportarEliminatoriaPDF;
window.compartirEliminatoria = compartirEliminatoria;
