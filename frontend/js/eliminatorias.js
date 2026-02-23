const RONDAS_ORDEN_ELI = ["32vos", "16vos", "8vos", "4tos", "semifinal", "final"];
const BACKEND_BASE = "http://localhost:5000";
const EMBED_MODE = new URLSearchParams(window.location.search).get("embed") === "1";

let eliminatoriaState = {
  eventos: [],
  gruposEvento: [],
  cruces: [],
  eventoSeleccionado: null,
  esAdminLike: false,
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
}

function bindEventosEliminatoria() {
  document.getElementById("eli-evento")?.addEventListener("change", async () => {
    const id = Number.parseInt(document.getElementById("eli-evento")?.value || "", 10);
    eliminatoriaState.eventoSeleccionado = Number.isFinite(id) ? id : null;
    actualizarMetaEvento();
    await cargarContextoPublicacion(eliminatoriaState.eventoSeleccionado);
    await cargarGruposEventoSeleccionado();
    renderConfiguracionCruces();
  });
  document.getElementById("eli-origen")?.addEventListener("change", () => {
    actualizarUIPlayoffPorOrigen();
  });
  document.getElementById("eli-metodo-grupos")?.addEventListener("change", () => {
    actualizarUIPlayoffPorOrigen();
  });
  document.getElementById("btn-eli-cargar")?.addEventListener("click", cargarLlaveEliminatoria);
  document.getElementById("btn-eli-generar")?.addEventListener("click", generarLlaveEliminatoria);
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
      op.textContent = `${e.nombre || "Categoría"} (#${e.id})`;
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
  const param = new URLSearchParams(window.location.search).get("evento");
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
  actualizarMetaEvento();
  await cargarContextoPublicacion(eliminatoriaState.eventoSeleccionado);
  await cargarGruposEventoSeleccionado();
  renderConfiguracionCruces();
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
  const metodoEl = document.getElementById("eli-metodo");
  const llaveEl = document.getElementById("eli-llave");
  const avisoEl = document.getElementById("eli-aviso-metodo");
  const origenSel = document.getElementById("eli-origen");

  const metodo = String(evento?.metodo_competencia || "grupos").toLowerCase();
  const llave = Number.parseInt(evento?.eliminatoria_equipos, 10);

  if (metodoEl) metodoEl.value = formatearMetodo(metodo);
  if (llaveEl) llaveEl.value = Number.isFinite(llave) ? String(llave) : "Automática";
  if (avisoEl) {
    avisoEl.textContent =
      metodo === "eliminatoria" || metodo === "mixto"
        ? "Esta categoría soporta eliminación directa. También puedes generar playoff desde grupos."
        : "Modo sugerido: playoff desde grupos (clasificados por grupo).";
    avisoEl.classList.toggle("is-warning", metodo === "grupos" || metodo === "liga");
  }
  if (origenSel) {
    if (metodo === "grupos" || metodo === "liga") origenSel.value = "grupos";
    else if (metodo === "eliminatoria") origenSel.value = "evento";
  }
  actualizarUIPlayoffPorOrigen();
}

function actualizarUIPlayoffPorOrigen() {
  const origen = document.getElementById("eli-origen")?.value || "evento";
  const metodoGrupos = document.getElementById("eli-metodo-grupos")?.value || "cruces_grupos";
  const wrapClasificados = document.getElementById("eli-wrap-clasificados");
  const wrapMetodo = document.getElementById("eli-wrap-metodo-grupos");
  const wrapCruces = document.getElementById("eli-wrap-cruces");

  const usaGrupos = origen === "grupos";
  if (wrapClasificados) wrapClasificados.style.display = usaGrupos ? "" : "none";
  if (wrapMetodo) wrapMetodo.style.display = usaGrupos ? "" : "none";
  if (wrapCruces) wrapCruces.style.display = usaGrupos && metodoGrupos === "cruces_grupos" ? "" : "none";

  if (usaGrupos && metodoGrupos === "cruces_grupos") {
    renderConfiguracionCruces();
  }
}

function renderConfiguracionCruces() {
  const cont = document.getElementById("eli-cruces-grupos");
  if (!cont) return;

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
    const a = letras[i];
    const b = letras[letras.length - 1 - i];
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
}

function obtenerCrucesConfigurados() {
  const wrap = document.getElementById("eli-cruces-grupos");
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
  const origen = document.getElementById("eli-origen")?.value || "evento";
  const clasificadosPorGrupo = Number.parseInt(
    document.getElementById("eli-clasificados")?.value || "2",
    10
  );
  const metodoGrupos = document.getElementById("eli-metodo-grupos")?.value || "cruces_grupos";
  const cruces = metodoGrupos === "cruces_grupos" ? obtenerCrucesConfigurados() : [];

  if (origen === "grupos" && metodoGrupos === "cruces_grupos" && !cruces.length) {
    mostrarNotificacion("Configura al menos un cruce de grupos válido.", "warning");
    return;
  }

  if (!confirm("¿Generar/Reemplazar la llave eliminatoria de esta categoría?")) return;

  try {
    const payload = {
      origen,
      metodo_clasificacion: metodoGrupos,
      clasificados_por_grupo: clasificadosPorGrupo,
    };
    if (origen !== "grupos" && Number.isFinite(cantidadObjetivo)) {
      payload.cantidad_equipos = cantidadObjetivo;
    }
    if (cruces.length) payload.cruces_grupos = cruces;

    const resp = await ApiClient.post(`/eliminatorias/evento/${eventoId}/generar`, payload);
    const meta = resp?.meta || null;
    if (meta?.metodo_clasificacion === "tabla_unica") {
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
          const local = c.equipo_local_nombre || "Por definir";
          const visita = c.equipo_visitante_nombre || "Por definir";
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
                <strong>Partido ${escapeHtml(c.partido_numero || "-")}</strong>
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
              <header>P${escapeHtml(c.partido_numero || "-")}</header>
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

  const rlRaw = prompt("Goles equipo local:", String(cruce.resultado_local ?? 0));
  if (rlRaw === null) return;
  const rvRaw = prompt("Goles equipo visitante:", String(cruce.resultado_visitante ?? 0));
  if (rvRaw === null) return;

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
  if (key === "8vos") return "Octavos";
  if (key === "4tos") return "Cuartos";
  if (key === "semifinal") return "Semifinal";
  if (key === "final") return "Final";
  return key || "-";
}

function formatearMetodo(metodo) {
  const key = String(metodo || "").toLowerCase();
  if (key === "liga") return "Liga";
  if (key === "eliminatoria") return "Eliminatoria";
  if (key === "mixto") return "Mixto";
  return "Grupos";
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
