// frontend/js/transmisiones.js
// Gestión de transmisiones — página transmisiones.html

(() => {
  const API = window.resolveApiBaseUrl
    ? window.resolveApiBaseUrl()
    : window.API_BASE_URL || `${window.location.origin}/api`;

  let _campeonatoId = null;
  let _transmisiones = [];
  let _tabActiva = "activas";

  // ── Helpers de API ────────────────────────────────────────────────────────

  function getToken() {
    return window.Auth?.getToken?.() || "";
  }

  function authHeaders() {
    const token = getToken();
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

  // ── Estado badge ──────────────────────────────────────────────────────────

  function badgeEstado(estado) {
    const map = {
      borrador:   { label: "Borrador",    bg: "#718096", dot: false },
      programada: { label: "Programada",  bg: "#3182ce", dot: false },
      en_vivo:    { label: "🔴 EN VIVO",  bg: "#e53e3e", dot: true  },
      finalizada: { label: "Finalizada",  bg: "#38a169", dot: false },
      cancelada:  { label: "Cancelada",   bg: "#dd6b20", dot: false },
    };
    const cfg = map[estado] || { label: estado, bg: "#718096", dot: false };
    const dot = cfg.dot
      ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#fff;margin-right:4px;animation:txPulse 1s infinite;"></span>`
      : "";
    return `<span style="background:${cfg.bg};color:#fff;padding:.2em .55em;border-radius:4px;font-size:.8rem;font-weight:700;white-space:nowrap;">${dot}${cfg.label}</span>`;
  }

  // ── Render tabla ──────────────────────────────────────────────────────────

  function filtrarPorTab(list, tab) {
    if (tab === "activas") return list.filter((t) => t.estado === "en_vivo");
    if (tab === "programadas") return list.filter((t) => t.estado === "programada" || t.estado === "borrador");
    return list;
  }

  function formatFecha(val) {
    if (!val) return "—";
    try {
      return new Date(val).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" });
    } catch (_) {
      return val;
    }
  }

  function renderTablaTransmisiones(transmisiones, filtro) {
    const lista = filtrarPorTab(transmisiones, filtro);
    const tbody = document.getElementById("tx-tabla-body");
    const emptyMsg = document.getElementById("tx-empty-msg");
    const container = document.getElementById("tx-table-container");
    if (!tbody) return;

    if (!lista.length) {
      if (container) container.style.display = "none";
      if (emptyMsg) {
        emptyMsg.style.display = "";
        emptyMsg.textContent = filtro === "activas"
          ? "No hay transmisiones EN VIVO ahora."
          : "No hay transmisiones en esta vista.";
      }
      return;
    }

    if (emptyMsg) emptyMsg.style.display = "none";
    if (container) container.style.display = "";

    tbody.innerHTML = lista.map((tx) => {
      const local = tx.equipo_local_nombre || "—";
      const visit = tx.equipo_visitante_nombre || "—";
      const partido = `${local} vs ${visit}`;
      const jornada = tx.jornada != null ? `J${tx.jornada}` : "—";
      const plataforma = tx.plataforma || "—";
      const fecha = formatFecha(tx.fecha_inicio_programada);
      const destacadoIcon = tx.destacado
        ? `<span title="Quitar destacado" style="cursor:pointer;font-size:1.2rem;" onclick="window._txToggleDestacado(${tx.id})">⭐</span>`
        : `<span title="Destacar" style="cursor:pointer;font-size:1.2rem;opacity:.4;" onclick="window._txToggleDestacado(${tx.id})">☆</span>`;

      const btnVer = tx.url_publica
        ? `<a href="${tx.url_publica}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary" title="Ver transmisión"><i class="fas fa-external-link-alt"></i></a>`
        : "";

      const btnEditar = `<button type="button" class="btn btn-sm btn-primary" title="Editar" onclick="window._txEditar(${tx.partido_id})"><i class="fas fa-edit"></i></button>`;

      let btnAccion = "";
      if (tx.estado === "programada" || tx.estado === "borrador") {
        btnAccion = `<button type="button" class="btn btn-sm btn-success" title="Iniciar" onclick="window._txCambiarEstado(${tx.id},'iniciar')"><i class="fas fa-play"></i></button>`;
      } else if (tx.estado === "en_vivo") {
        btnAccion = `<button type="button" class="btn btn-sm btn-warning" title="Finalizar" onclick="window._txCambiarEstado(${tx.id},'finalizar')"><i class="fas fa-stop"></i></button>`;
      }

      const btnCancelar = (tx.estado !== "finalizada" && tx.estado !== "cancelada")
        ? `<button type="button" class="btn btn-sm btn-danger" title="Cancelar" onclick="window._txCambiarEstado(${tx.id},'cancelar')"><i class="fas fa-ban"></i></button>`
        : "";

      return `<tr data-tx-id="${tx.id}">
        <td>${partido}</td>
        <td>${jornada}</td>
        <td>${plataforma}</td>
        <td>${badgeEstado(tx.estado)}</td>
        <td style="white-space:nowrap;">${fecha}</td>
        <td style="text-align:center;">${destacadoIcon}</td>
        <td style="white-space:nowrap;display:flex;gap:.25rem;flex-wrap:wrap;">${btnVer}${btnEditar}${btnAccion}${btnCancelar}</td>
      </tr>`;
    }).join("");
  }

  // ── Próxima transmisión card ───────────────────────────────────────────────

  async function mostrarProximaCard() {
    try {
      const data = await fetch(`${API}/public/transmisiones/destacadas`)
        .then((r) => r.json())
        .catch(() => ({ transmisiones: [] }));
      const lista = data.transmisiones || [];
      const card = document.getElementById("tx-proxima-card");
      if (!lista.length || !card) return;

      const tx = lista[0];
      const enVivo = tx.estado === "en_vivo";
      const labelEl = document.getElementById("tx-proxima-label");
      const tituloEl = document.getElementById("tx-proxima-titulo");
      const metaEl = document.getElementById("tx-proxima-meta");
      const linkEl = document.getElementById("tx-proxima-link");

      if (labelEl) labelEl.textContent = enVivo ? "🔴 En vivo ahora" : "📅 Próxima transmisión";
      if (tituloEl) tituloEl.textContent = tx.titulo || `${tx.plataforma || "Transmisión"}`;
      if (metaEl) {
        const meta = [];
        if (tx.plataforma) meta.push(tx.plataforma);
        if (!enVivo && tx.fecha_inicio_programada) meta.push(formatFecha(tx.fecha_inicio_programada));
        metaEl.textContent = meta.join(" · ");
      }
      if (linkEl) {
        linkEl.href = tx.url_publica || "#";
        linkEl.textContent = enVivo ? "Ver en vivo →" : "Ver →";
        if (!tx.url_publica) linkEl.style.display = "none";
      }
      card.style.display = "";
    } catch (_) {
      // silent
    }
  }

  // ── Acciones ──────────────────────────────────────────────────────────────

  async function recargarTabla() {
    if (!_campeonatoId) return;
    try {
      const data = await apiGet(`/transmisiones?campeonato_id=${_campeonatoId}`);
      _transmisiones = data.transmisiones || [];
      renderTablaTransmisiones(_transmisiones, _tabActiva);
    } catch (err) {
      const emptyMsg = document.getElementById("tx-empty-msg");
      if (emptyMsg) { emptyMsg.style.display = ""; emptyMsg.textContent = `Error: ${err.message}`; }
    }
  }

  window._txToggleDestacado = async function (id) {
    try {
      await apiPost(`/transmisiones/${id}/destacar`, {});
      await recargarTabla();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  window._txCambiarEstado = async function (id, accion) {
    try {
      await apiPost(`/transmisiones/${id}/${accion}`, {});
      await recargarTabla();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  window._txEditar = function (partidoId) {
    if (typeof window.abrirModalTransmision === "function") {
      window.abrirModalTransmision(partidoId);
    } else {
      alert("Modal de edición no disponible. Asegúrese de incluir transmision.js.");
    }
  };

  // ── Init ─────────────────────────────────────────────────────────────────

  async function cargarCampeonatos() {
    try {
      const data = await apiGet("/campeonatos");
      const campeonatos = data.campeonatos || data || [];
      const sel = document.getElementById("tx-campeonato-select");
      if (!sel) return;
      campeonatos.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.nombre || `Campeonato #${c.id}`;
        sel.appendChild(opt);
      });
    } catch (_) {
      // silent — selector queda vacío
    }
  }

  function initTabs() {
    const tabs = document.querySelectorAll("[data-tx-tab]");
    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabs.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        _tabActiva = btn.dataset.txTab;
        renderTablaTransmisiones(_transmisiones, _tabActiva);
      });
    });
  }

  function initSelector() {
    const sel = document.getElementById("tx-campeonato-select");
    if (!sel) return;
    sel.addEventListener("change", async () => {
      const val = Number.parseInt(sel.value, 10);
      _campeonatoId = Number.isFinite(val) && val > 0 ? val : null;
      _transmisiones = [];
      const emptyMsg = document.getElementById("tx-empty-msg");
      const container = document.getElementById("tx-table-container");
      if (!_campeonatoId) {
        if (container) container.style.display = "none";
        if (emptyMsg) { emptyMsg.style.display = ""; emptyMsg.textContent = "Selecciona un campeonato para ver sus transmisiones."; }
        return;
      }
      await recargarTabla();
    });
  }

  // Inject pulse animation
  const style = document.createElement("style");
  style.textContent = `@keyframes txPulse{0%,100%{opacity:1}50%{opacity:.3}}`;
  document.head.appendChild(style);

  document.addEventListener("DOMContentLoaded", async () => {
    await cargarCampeonatos();
    initSelector();
    initTabs();

    // Pre-seleccionar campeonato si viene por URL o RouteContext
    const routeCtx = window.RouteContext?.read?.("transmisiones.html", ["campeonato"]) || {};
    const urlParams = new URLSearchParams(window.location.search);
    const preId = Number.parseInt(routeCtx.campeonato || urlParams.get("campeonato") || "", 10);
    if (Number.isFinite(preId) && preId > 0) {
      const sel = document.getElementById("tx-campeonato-select");
      if (sel) {
        sel.value = String(preId);
        if (sel.value === String(preId)) {
          _campeonatoId = preId;
          await recargarTabla();
        }
      }
    }

    await mostrarProximaCard();

    // Nav toggle (same pattern as other pages)
    const navToggle = document.getElementById("nav-toggle");
    const sidebar = document.getElementById("sidebar");
    if (navToggle && sidebar) {
      navToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
    }
  });
})();
