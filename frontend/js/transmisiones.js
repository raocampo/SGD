// frontend/js/transmisiones.js
// Gestión de transmisiones — página transmisiones.html
// Tarjeta por transmisión con acciones con texto (Panel de Director,
// Iniciar/Finalizar/Reabrir, Editar, Cancelar), filtros por estado y
// selector de partido para crear una transmisión sin salir de la página.

(() => {
  const API = window.resolveApiBaseUrl
    ? window.resolveApiBaseUrl()
    : window.API_BASE_URL || `${window.location.origin}/api`;

  let _campeonatoId = null;
  let _transmisiones = [];
  let _tabActiva = "todas";

  // ── API ──────────────────────────────────────────────────────────────
  function authHeaders() {
    const token = window.Auth?.getToken?.() || "";
    return token
      ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };
  }

  async function apiGet(path) {
    const resp = await fetch(`${API}${path}`, { headers: authHeaders() });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || `Error ${resp.status}`);
    }
    return resp.json();
  }

  async function apiPost(path, body) {
    const resp = await fetch(`${API}${path}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body || {}),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || `Error ${resp.status}`);
    }
    return resp.json();
  }

  // ── Helpers ──────────────────────────────────────────────────────────
  function esc(valor) {
    return String(valor ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function notificar(mensaje, tipo = "info") {
    if (typeof window.mostrarNotificacion === "function") window.mostrarNotificacion(mensaje, tipo);
    else if (typeof window.mostrarToast === "function") window.mostrarToast(mensaje, tipo);
    else console.log(`[${tipo}] ${mensaje}`);
  }

  async function confirmar({ titulo, mensaje, textoConfirmar, claseConfirmar = "btn-primary", tipo = "warning" }) {
    if (typeof window.mostrarConfirmacion === "function") {
      return window.mostrarConfirmacion({ titulo, mensaje, tipo, textoConfirmar, claseConfirmar });
    }
    return window.confirm(`${titulo}\n\n${mensaje}`);
  }

  function formatFecha(val) {
    if (!val) return "";
    try {
      return new Date(val).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });
    } catch (_) {
      return String(val);
    }
  }

  const ESTADOS = {
    borrador: { label: "Borrador", icono: "fa-file-alt" },
    programada: { label: "Programada", icono: "fa-calendar" },
    en_vivo: { label: "EN VIVO", icono: null },
    finalizada: { label: "Finalizada", icono: "fa-check" },
    cancelada: { label: "Cancelada", icono: "fa-ban" },
  };

  function badgeEstado(estado) {
    const cfg = ESTADOS[estado] || { label: estado || "—", icono: null };
    const icono = estado === "en_vivo"
      ? '<span class="tx-dot" aria-hidden="true"></span>'
      : cfg.icono ? `<i class="fas ${cfg.icono}" aria-hidden="true"></i>` : "";
    return `<span class="tx-estado is-${esc(estado)}">${icono}${esc(cfg.label)}</span>`;
  }

  const NOMBRES_PLATAFORMA = [
    [/youtu/i, "YouTube", "fab fa-youtube"],
    [/facebook|fb\./i, "Facebook", "fab fa-facebook"],
    [/tiktok/i, "TikTok", "fab fa-tiktok"],
    [/twitch/i, "Twitch", "fab fa-twitch"],
    [/instagram/i, "Instagram", "fab fa-instagram"],
  ];

  function datosPlataforma(enlace = {}) {
    const texto = `${enlace.plataforma || ""} ${enlace.url || ""}`;
    const hallado = NOMBRES_PLATAFORMA.find(([re]) => re.test(texto));
    return hallado
      ? { nombre: hallado[1], icono: hallado[2] }
      : { nombre: enlace.plataforma || "Enlace", icono: "fas fa-link" };
  }

  function enlacesDe(tx) {
    if (Array.isArray(tx.enlaces) && tx.enlaces.length) return tx.enlaces;
    return tx.url_publica ? [{ plataforma: tx.plataforma || "", url: tx.url_publica }] : [];
  }

  // ── Filtros ──────────────────────────────────────────────────────────
  function filtrarPorTab(list, tab) {
    if (tab === "activas") return list.filter((t) => t.estado === "en_vivo");
    if (tab === "programadas") return list.filter((t) => t.estado === "programada" || t.estado === "borrador");
    if (tab === "finalizadas") return list.filter((t) => t.estado === "finalizada" || t.estado === "cancelada");
    return list;
  }

  function actualizarContadoresTabs(list) {
    const upd = (id, n) => {
      const el = document.getElementById(id);
      if (el) el.textContent = n;
    };
    upd("tx-count-todas", list.length);
    upd("tx-count-activas", filtrarPorTab(list, "activas").length);
    upd("tx-count-programadas", filtrarPorTab(list, "programadas").length);
    upd("tx-count-finalizadas", filtrarPorTab(list, "finalizadas").length);
  }

  // Orden: en vivo, programadas/borradores (por fecha), finalizadas, canceladas.
  const PRIORIDAD = { en_vivo: 0, programada: 1, borrador: 2, finalizada: 3, cancelada: 4 };
  function ordenar(list) {
    return [...list].sort((a, b) => {
      const pa = PRIORIDAD[a.estado] ?? 9;
      const pb = PRIORIDAD[b.estado] ?? 9;
      if (pa !== pb) return pa - pb;
      const fa = a.fecha_inicio_programada ? new Date(a.fecha_inicio_programada).getTime() : Infinity;
      const fb = b.fecha_inicio_programada ? new Date(b.fecha_inicio_programada).getTime() : Infinity;
      return pa >= 3 ? fb - fa : fa - fb;
    });
  }

  // ── Render ───────────────────────────────────────────────────────────
  function emptyStateHtml(tab) {
    const hrefPartidos = `partidos.html${_campeonatoId ? `?campeonato=${_campeonatoId}` : ""}`;
    const botonCrear = `<button type="button" class="btn btn-primary" onclick="window._txNueva()"><i class="fas fa-plus"></i> Nueva transmisión</button>`;
    if (!_campeonatoId) {
      return `<div class="tx-empty-guide">
        <div class="tx-empty-icon">🏆</div>
        <h3>Selecciona un campeonato</h3>
        <p>Elige un campeonato para ver y crear sus transmisiones.</p>
      </div>`;
    }
    if (tab === "activas") {
      return `<div class="tx-empty-guide">
        <div class="tx-empty-icon">📡</div>
        <h3>No hay transmisiones en vivo ahora</h3>
        <p>Cuando salgas en vivo, pulsa <strong>Iniciar</strong> en la tarjeta del partido y aparecerá aquí y en el portal.</p>
      </div>`;
    }
    if (tab === "programadas") {
      return `<div class="tx-empty-guide">
        <div class="tx-empty-icon">📅</div>
        <h3>Sin transmisiones programadas</h3>
        <p>Crea la transmisión de un partido para tenerla lista antes del juego.</p>
        ${botonCrear}
      </div>`;
    }
    if (tab === "finalizadas") {
      return `<div class="tx-empty-guide">
        <div class="tx-empty-icon">✅</div>
        <h3>Sin transmisiones finalizadas</h3>
        <p>Aquí quedan las transmisiones terminadas o canceladas. Se pueden reabrir.</p>
      </div>`;
    }
    return `<div class="tx-empty-guide">
      <div class="tx-empty-icon">🎬</div>
      <h3>Aún no hay transmisiones en este campeonato</h3>
      <p>Elige un partido y registra los enlaces de su directo. También puedes hacerlo desde <a href="${hrefPartidos}">Partidos</a>.</p>
      ${botonCrear}
    </div>`;
  }

  function renderTarjeta(tx) {
    const local = tx.equipo_local_nombre || "Local";
    const visita = tx.equipo_visitante_nombre || "Visitante";
    const estado = tx.estado || "borrador";
    const fecha = formatFecha(tx.fecha_inicio_programada);
    const enlaces = enlacesDe(tx);

    const plataformas = enlaces.length
      ? enlaces.map((e) => {
          const p = datosPlataforma(e);
          return `<a class="tx-plataforma" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer" title="Abrir ${esc(p.nombre)}">
              <i class="${p.icono}" aria-hidden="true"></i> ${esc(p.nombre)}
            </a>`;
        }).join("")
      : '<span class="tx-sin-enlace"><i class="fas fa-triangle-exclamation"></i> Sin enlace: edítala y agrega el enlace del directo</span>';

    // Panel de Director: disponible salvo canceladas (sirve para preparar
    // el overlay en OBS antes del partido y para pruebas).
    const btnDirector = estado !== "cancelada"
      ? `<a class="btn tx-btn-director" href="director.html?tx=${Number(tx.id)}"><i class="fas fa-sliders-h"></i> Panel de Director</a>`
      : "";

    let btnEstado = "";
    if (estado === "programada" || estado === "borrador") {
      btnEstado = `<button type="button" class="btn btn-success" onclick="window._txCambiarEstado(${Number(tx.id)}, 'iniciar')"><i class="fas fa-play"></i> Iniciar</button>`;
    } else if (estado === "en_vivo") {
      btnEstado = `<button type="button" class="btn btn-warning" onclick="window._txCambiarEstado(${Number(tx.id)}, 'finalizar')"><i class="fas fa-stop"></i> Finalizar</button>`;
    } else if (estado === "finalizada" || estado === "cancelada") {
      btnEstado = `<button type="button" class="btn btn-outline" onclick="window._txCambiarEstado(${Number(tx.id)}, 'reabrir')"><i class="fas fa-rotate-left"></i> Reabrir</button>`;
    }

    const btnViewer = estado === "en_vivo"
      ? `<a class="btn btn-outline tx-btn-icono" href="viewer.html?tx=${Number(tx.id)}" target="_blank" rel="noopener noreferrer" title="Ver como espectador"><i class="fas fa-eye"></i></a>`
      : "";
    const btnEditar = `<button type="button" class="btn btn-secondary" onclick="window._txEditar(${Number(tx.partido_id)})"><i class="fas fa-pen"></i> Editar</button>`;
    const btnCancelar = estado !== "finalizada" && estado !== "cancelada"
      ? `<button type="button" class="btn btn-outline tx-btn-icono" title="Cancelar transmisión" aria-label="Cancelar transmisión" onclick="window._txCambiarEstado(${Number(tx.id)}, 'cancelar')"><i class="fas fa-ban"></i></button>`
      : "";

    const meta = [
      tx.jornada != null ? `<span><i class="fas fa-layer-group"></i>Jornada ${esc(tx.jornada)}</span>` : "",
      fecha ? `<span><i class="fas fa-clock"></i>${esc(fecha)}</span>` : '<span><i class="fas fa-clock"></i>Sin fecha programada</span>',
    ].join("");

    return `
      <article class="tx-card is-${esc(estado)}" data-tx-id="${Number(tx.id)}">
        <div class="tx-card-top">
          ${badgeEstado(estado)}
          <button type="button" class="tx-destacar${tx.destacado ? " is-on" : ""}" onclick="window._txToggleDestacado(${Number(tx.id)})"
                  title="${tx.destacado ? "Quitar de destacadas" : "Destacar en el portal"}">
            <i class="${tx.destacado ? "fas" : "far"} fa-star"></i> ${tx.destacado ? "Destacada" : "Destacar"}
          </button>
        </div>
        <h3 class="tx-card-partido">${esc(local)}<span>vs</span>${esc(visita)}</h3>
        ${tx.titulo ? `<div class="tx-card-meta"><span><i class="fas fa-heading"></i>${esc(tx.titulo)}</span></div>` : ""}
        <div class="tx-card-meta">${meta}</div>
        <div class="tx-plataformas">${plataformas}</div>
        <div class="tx-card-acciones">
          ${btnDirector}
          ${btnEstado}
          <div class="tx-acciones-sec">${btnViewer}${btnEditar}${btnCancelar}</div>
        </div>
      </article>`;
  }

  function renderLista() {
    const cont = document.getElementById("tx-lista");
    const emptyMsg = document.getElementById("tx-empty-msg");
    if (!cont) return;
    const lista = ordenar(filtrarPorTab(_transmisiones, _tabActiva));
    if (!lista.length) {
      cont.innerHTML = "";
      if (emptyMsg) {
        emptyMsg.style.display = "";
        emptyMsg.innerHTML = emptyStateHtml(_tabActiva);
      }
      return;
    }
    if (emptyMsg) emptyMsg.style.display = "none";
    cont.innerHTML = lista.map(renderTarjeta).join("");
  }

  // ── Acciones ─────────────────────────────────────────────────────────
  async function recargarTabla() {
    if (!_campeonatoId) {
      _transmisiones = [];
      actualizarContadoresTabs([]);
      renderLista();
      return;
    }
    try {
      const data = await apiGet(`/transmisiones?campeonato_id=${_campeonatoId}`);
      _transmisiones = data.transmisiones || [];
      actualizarContadoresTabs(_transmisiones);
      renderLista();
    } catch (err) {
      const emptyMsg = document.getElementById("tx-empty-msg");
      document.getElementById("tx-lista").innerHTML = "";
      if (emptyMsg) {
        emptyMsg.style.display = "";
        emptyMsg.innerHTML = `<div class="tx-empty-guide"><div class="tx-empty-icon">⚠️</div><h3>Error al cargar</h3><p>${esc(err.message)}</p></div>`;
      }
    }
  }

  window._txToggleDestacado = async function (id) {
    try {
      await apiPost(`/transmisiones/${id}/destacar`, {});
      await recargarTabla();
    } catch (err) {
      notificar(err.message, "error");
    }
  };

  const CONFIRMACIONES = {
    iniciar: { titulo: "Iniciar transmisión", mensaje: "El portal mostrará este partido «EN VIVO» con sus enlaces. Inícialo cuando ya estés emitiendo desde OBS o Prism.", textoConfirmar: "Iniciar", claseConfirmar: "btn-success", ok: "🔴 Transmisión iniciada" },
    finalizar: { titulo: "Finalizar transmisión", mensaje: "Se quitará el «EN VIVO» del portal. Podrás reabrirla si fue un error.", textoConfirmar: "Finalizar", claseConfirmar: "btn-warning", ok: "Transmisión finalizada" },
    cancelar: { titulo: "Cancelar transmisión", mensaje: "La transmisión quedará cancelada y no se anunciará en el portal. Podrás reabrirla después.", textoConfirmar: "Cancelar transmisión", claseConfirmar: "btn-danger", ok: "Transmisión cancelada" },
    reabrir: { titulo: "Reabrir transmisión", mensaje: "Volverá a «Programada» con sus enlaces y su overlay, lista para probar o transmitir de nuevo.", textoConfirmar: "Reabrir", claseConfirmar: "btn-primary", ok: "Transmisión reabierta" },
  };

  window._txCambiarEstado = async function (id, accion) {
    const cfg = CONFIRMACIONES[accion];
    if (!cfg) return;
    const ok = await confirmar(cfg);
    if (!ok) return;
    try {
      await apiPost(`/transmisiones/${id}/${accion}`, {});
      notificar(cfg.ok, "success");
      await recargarTabla();
    } catch (err) {
      notificar(err.message, "error");
    }
  };

  window._txEditar = function (partidoId) {
    if (typeof window.abrirModalTransmision === "function") {
      window.abrirModalTransmision(partidoId);
    } else {
      notificar("No se pudo abrir el formulario de transmisión", "error");
    }
  };

  // ── Nueva transmisión: elegir partido ────────────────────────────────
  function asegurarModalPartido() {
    let modal = document.getElementById("tx-modal-partido");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "tx-modal-partido";
    modal.className = "modal-overlay";
    modal.style.display = "none";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "tx-modal-partido-titulo");
    modal.innerHTML = `
      <div class="modal-box tx-modal-partido-box">
        <div class="modal-header">
          <h3 id="tx-modal-partido-titulo"><i class="fas fa-futbol"></i> ¿Qué partido vas a transmitir?</h3>
          <button class="modal-close" type="button" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-body">
          <input type="search" id="tx-buscar-partido" class="form-control" placeholder="Buscar por equipo o jornada" />
          <label class="tx-check-pasados"><input type="checkbox" id="tx-ver-jugados" /> Mostrar también partidos ya jugados</label>
          <div id="tx-lista-partidos" class="tx-lista-partidos"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.closest("[data-cerrar]")) modal.style.display = "none";
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.style.display !== "none") modal.style.display = "none";
    });
    return modal;
  }

  let _partidosCampeonato = [];

  function renderPartidosModal() {
    const cont = document.getElementById("tx-lista-partidos");
    if (!cont) return;
    const q = String(document.getElementById("tx-buscar-partido")?.value || "").trim().toLowerCase();
    const verJugados = document.getElementById("tx-ver-jugados")?.checked === true;
    const conTransmision = new Set(_transmisiones.map((t) => Number(t.partido_id)));
    const lista = _partidosCampeonato.filter((p) => {
      const jugado = ["finalizado", "no_presentaron_ambos"].includes(String(p.estado || "").toLowerCase());
      if (jugado && !verJugados) return false;
      if (!q) return true;
      const texto = `${p.equipo_local_nombre} ${p.equipo_visitante_nombre} jornada ${p.jornada ?? ""} ${p.letra_grupo ? `grupo ${p.letra_grupo}` : ""}`.toLowerCase();
      return texto.includes(q);
    });
    if (!lista.length) {
      cont.innerHTML = '<p class="form-hint">No hay partidos que coincidan. Activa «Mostrar también partidos ya jugados» o revisa el fixture en Partidos.</p>';
      return;
    }
    cont.innerHTML = lista.slice(0, 80).map((p) => {
      const tiene = conTransmision.has(Number(p.id));
      const fecha = p.fecha_partido ? String(p.fecha_partido).slice(0, 10).split("-").reverse().join("/") : "Sin fecha";
      const hora = p.hora_partido ? ` · ${String(p.hora_partido).slice(0, 5)}` : "";
      return `
        <button type="button" class="tx-partido-opcion" data-partido="${Number(p.id)}">
          <span class="tx-partido-equipos">${esc(p.equipo_local_nombre)} <em>vs</em> ${esc(p.equipo_visitante_nombre)}</span>
          <span class="tx-partido-meta">
            ${p.jornada != null ? `J${esc(p.jornada)} · ` : ""}${p.letra_grupo ? `Grupo ${esc(p.letra_grupo)} · ` : ""}${esc(fecha)}${esc(hora)}
            ${tiene ? '<span class="tx-partido-tiene">Ya tiene transmisión · editar</span>' : ""}
          </span>
        </button>`;
    }).join("");
  }

  window._txNueva = async function () {
    if (!_campeonatoId) {
      notificar("Selecciona primero un campeonato", "warning");
      document.getElementById("tx-campeonato-select")?.focus();
      return;
    }
    const modal = asegurarModalPartido();
    const cont = document.getElementById("tx-lista-partidos");
    if (cont) cont.innerHTML = '<p class="form-hint"><i class="fas fa-spinner fa-spin"></i> Cargando partidos…</p>';
    modal.style.display = "flex";
    document.getElementById("tx-buscar-partido").value = "";
    try {
      const data = await apiGet(`/partidos/campeonato/${_campeonatoId}`);
      _partidosCampeonato = Array.isArray(data?.partidos) ? data.partidos : [];
    } catch (err) {
      _partidosCampeonato = [];
      if (cont) cont.innerHTML = `<p class="form-hint">No se pudieron cargar los partidos: ${esc(err.message)}</p>`;
      return;
    }
    renderPartidosModal();
    document.getElementById("tx-buscar-partido")?.focus();
  };

  function initModalPartido() {
    document.addEventListener("input", (e) => {
      if (e.target?.id === "tx-buscar-partido") renderPartidosModal();
    });
    document.addEventListener("change", (e) => {
      if (e.target?.id === "tx-ver-jugados") renderPartidosModal();
    });
    document.addEventListener("click", (e) => {
      const opcion = e.target.closest?.(".tx-partido-opcion");
      if (!opcion) return;
      const modal = document.getElementById("tx-modal-partido");
      if (modal) modal.style.display = "none";
      window._txEditar(Number(opcion.dataset.partido));
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────
  async function cargarCampeonatos() {
    try {
      const data = await apiGet("/campeonatos");
      const campeonatos = data.campeonatos || data || [];
      const sel = document.getElementById("tx-campeonato-select");
      if (!sel) return campeonatos;
      campeonatos.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.nombre || `Campeonato #${c.id}`;
        sel.appendChild(opt);
      });
      return campeonatos;
    } catch (_) {
      return [];
    }
  }

  function initTabs() {
    const tabs = document.querySelectorAll("[data-tx-tab]");
    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabs.forEach((b) => {
          b.classList.toggle("active", b === btn);
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });
        _tabActiva = btn.dataset.txTab;
        renderLista();
      });
    });
    document.querySelector('[data-tx-tab="todas"]')?.classList.add("active");
  }

  function seleccionarCampeonato(id) {
    _campeonatoId = Number.isFinite(id) && id > 0 ? id : null;
    const btnCrear = document.getElementById("tx-btn-crear");
    if (btnCrear) btnCrear.href = _campeonatoId ? `partidos.html?campeonato=${_campeonatoId}` : "partidos.html";
    return recargarTabla();
  }

  function initSelector() {
    const sel = document.getElementById("tx-campeonato-select");
    sel?.addEventListener("change", () => seleccionarCampeonato(Number.parseInt(sel.value, 10)));
  }

  document.addEventListener("DOMContentLoaded", async () => {
    initTabs();
    initSelector();
    initModalPartido();

    // «Nueva transmisión» abre el selector de partido (el enlace a Partidos
    // queda como alternativa si el script no carga).
    document.getElementById("tx-btn-crear")?.addEventListener("click", (e) => {
      e.preventDefault();
      window._txNueva();
    });

    // El formulario de transmisión avisa cada cambio: refrescar la lista.
    window.addEventListener("transmision:cambio", () => recargarTabla());

    const campeonatos = await cargarCampeonatos();
    const routeCtx = window.RouteContext?.read?.("transmisiones.html", ["campeonato"]) || {};
    const urlParams = new URLSearchParams(window.location.search);
    let preId = Number.parseInt(routeCtx.campeonato || urlParams.get("campeonato") || "", 10);
    if ((!Number.isFinite(preId) || preId <= 0) && campeonatos.length === 1) preId = campeonatos[0].id;

    const sel = document.getElementById("tx-campeonato-select");
    if (Number.isFinite(preId) && preId > 0 && sel) {
      sel.value = String(preId);
      if (sel.value === String(preId)) {
        await seleccionarCampeonato(preId);
      } else {
        renderLista();
      }
    } else {
      renderLista();
    }

    const navToggle = document.getElementById("nav-toggle");
    const sidebar = document.getElementById("sidebar");
    if (navToggle && sidebar && navToggle.dataset.mobileMenuBound !== "true") {
      navToggle.dataset.mobileMenuBound = "true";
      navToggle.addEventListener("click", () => sidebar.classList.toggle("nav-open"));
    }
  });
})();
