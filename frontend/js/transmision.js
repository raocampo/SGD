// frontend/js/transmision.js
// Gestión de transmisiones en vivo de partidos

(() => {
  const API = window.resolveApiBaseUrl ? window.resolveApiBaseUrl() : `${window.location.origin}/api`;

  let _transmisionActual = null;
  let _partidoIdActual = null;

  const ESTADOS_LABEL = {
    borrador: "Borrador",
    programada: "Programada",
    en_vivo: "🔴 EN VIVO",
    finalizada: "Finalizada",
    cancelada: "Cancelada",
  };

  const ESTADOS_CLASS = {
    borrador: "badge-secondary",
    programada: "badge-secondary",
    en_vivo: "badge-danger",
    finalizada: "badge-success",
    cancelada: "badge-warning",
  };

  function getToken() {
    return window.Auth?.getToken?.() || "";
  }

  function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
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

  async function apiPut(path, body) {
    const resp = await fetch(`${API}${path}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(body || {}),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || `Error ${resp.status}`);
    }
    return resp.json();
  }

  function crearModalSiNoExiste() {
    if (document.getElementById("modal-transmision")) return;

    const modal = document.createElement("div");
    modal.id = "modal-transmision";
    modal.className = "modal-overlay";
    modal.style.cssText = "display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10050;overflow-y:auto;";
    modal.innerHTML = `
      <div class="modal-box tx-modal-box">
        <div class="tx-modal-header">
          <h3>📡 Transmisión del Partido</h3>
          <button type="button" id="btn-cerrar-modal-transmision" class="tx-modal-close" aria-label="Cerrar">✕</button>
        </div>

        <div class="tx-modal-body">
          <div id="transmision-estado-badge" style="margin-bottom:1rem;"></div>

          <form id="form-transmision" autocomplete="off">
            <input type="hidden" id="tx-estado-destino" value="" />
            <div class="form-group">
              <label>Plataformas del directo</label>
              <small class="tx-enlaces-ayuda">Agrega un enlace por cada plataforma donde transmites al mismo tiempo. El primero es el principal.</small>
              <div id="tx-enlaces" class="tx-enlaces"></div>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-tx-agregar-enlace">
                <i class="fas fa-plus"></i> Agregar plataforma
              </button>
            </div>
            <div class="form-group">
              <label for="tx-titulo">Título (opcional)</label>
              <input type="text" id="tx-titulo" class="form-control" placeholder="Nombre descriptivo del partido" />
            </div>
            <div class="form-group">
              <label for="tx-descripcion">Descripción (opcional)</label>
              <textarea id="tx-descripcion" class="form-control" rows="2" placeholder="Detalles adicionales..."></textarea>
            </div>
            <div class="form-group">
              <label for="tx-embed-url">URL de embed (opcional)</label>
              <input type="url" id="tx-embed-url" class="form-control" placeholder="https://..." />
            </div>
            <div class="form-group">
              <label for="tx-fecha-inicio">Fecha/hora programada (opcional)</label>
              <input type="datetime-local" id="tx-fecha-inicio" class="form-control" />
            </div>

          </form>

          <div id="transmision-modal-error" style="color:red;margin-top:.75rem;display:none;"></div>
          <div id="transmision-modal-ok" style="color:green;margin-top:.75rem;display:none;"></div>
        </div>

        <!-- Pie fijo: las acciones quedan visibles aunque el cuerpo haga scroll (celular). -->
        <div id="transmision-modal-actions" class="tx-modal-footer">
          <button type="submit" form="form-transmision" class="btn btn-primary" onclick="document.getElementById('tx-estado-destino').value=''">
            <i class="fas fa-save"></i> Guardar
          </button>
          <button type="button" class="btn btn-secondary" id="btn-tx-borrador">
            <i class="fas fa-file-alt"></i> Guardar como borrador
          </button>
          <button type="button" id="btn-tx-iniciar" class="btn btn-success" style="display:none;">
            <i class="fas fa-play"></i> Iniciar transmisión
          </button>
          <button type="button" id="btn-tx-finalizar" class="btn btn-warning" style="display:none;">
            <i class="fas fa-stop"></i> Finalizar
          </button>
          <button type="button" id="btn-tx-cancelar" class="btn btn-danger" style="display:none;">
            <i class="fas fa-ban"></i> Cancelar transmisión
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("btn-cerrar-modal-transmision").addEventListener("click", cerrarModalTransmision);
    document.getElementById("btn-tx-agregar-enlace").addEventListener("click", () => agregarFilaEnlace());
    document.getElementById("form-transmision").addEventListener("submit", (e) => {
      e.preventDefault();
      guardarTransmision();
    });
    document.getElementById("btn-tx-borrador").addEventListener("click", () => {
      document.getElementById("tx-estado-destino").value = "borrador";
      guardarTransmision();
    });
    document.getElementById("btn-tx-iniciar").addEventListener("click", () => iniciarTransmision());
    document.getElementById("btn-tx-finalizar").addEventListener("click", () => finalizarTransmision());
    document.getElementById("btn-tx-cancelar").addEventListener("click", () => cancelarTransmision());
  }

  function mostrarEstadoBadge(estado) {
    const contenedor = document.getElementById("transmision-estado-badge");
    if (!contenedor) return;
    if (!estado) { contenedor.innerHTML = ""; return; }
    const label = ESTADOS_LABEL[estado] || estado;
    const cls = ESTADOS_CLASS[estado] || "badge-secondary";
    contenedor.innerHTML = `<span class="badge ${cls}" style="font-size:.95rem;padding:.3em .7em;">${label}</span>`;
  }

  function actualizarBotonesEstado(transmision) {
    const btnIniciar = document.getElementById("btn-tx-iniciar");
    const btnFinalizar = document.getElementById("btn-tx-finalizar");
    const btnCancelar = document.getElementById("btn-tx-cancelar");
    if (!btnIniciar) return;

    btnIniciar.style.display = "none";
    btnFinalizar.style.display = "none";
    btnCancelar.style.display = "none";

    if (!transmision) return;

    const estado = transmision.estado;
    if (estado === "borrador") {
      btnIniciar.style.display = "";
      btnCancelar.style.display = "";
    } else if (estado === "programada") {
      btnIniciar.style.display = "";
      btnCancelar.style.display = "";
    } else if (estado === "en_vivo") {
      btnFinalizar.style.display = "";
      btnCancelar.style.display = "";
    }
  }

  // ── Enlaces por plataforma (transmisión simultánea) ───────────────
  const PLATAFORMAS = ["YouTube Live", "Facebook Live", "TikTok Live", "Twitch", "Otro"];

  function detectarPlataforma(url) {
    const u = String(url || "").toLowerCase();
    if (/youtube\.com|youtu\.be/.test(u)) return "YouTube Live";
    if (/facebook\.com|fb\.watch/.test(u)) return "Facebook Live";
    if (/tiktok\.com/.test(u)) return "TikTok Live";
    if (/twitch\.tv/.test(u)) return "Twitch";
    return "";
  }

  function agregarFilaEnlace(enlace = {}) {
    const cont = document.getElementById("tx-enlaces");
    if (!cont) return;
    const fila = document.createElement("div");
    fila.className = "tx-enlace-fila";
    const plataforma = String(enlace.plataforma || "");
    const opciones = PLATAFORMAS.concat(plataforma && !PLATAFORMAS.includes(plataforma) ? [plataforma] : []);
    fila.innerHTML = `
      <select class="form-control tx-enlace-plataforma" aria-label="Plataforma">
        <option value="">— Plataforma —</option>
        ${opciones.map((op) => `<option value="${escapeAttr(op)}">${escapeAttr(op)}</option>`).join("")}
      </select>
      <input type="url" class="form-control tx-enlace-url" placeholder="https://..." aria-label="Enlace del directo" />
      <button type="button" class="btn btn-danger btn-sm tx-enlace-quitar" title="Quitar plataforma" aria-label="Quitar plataforma">
        <i class="fas fa-trash"></i>
      </button>`;
    const select = fila.querySelector(".tx-enlace-plataforma");
    const input = fila.querySelector(".tx-enlace-url");
    select.value = plataforma;
    input.value = enlace.url || "";
    // Al pegar el enlace se completa la plataforma si aún no se eligió.
    input.addEventListener("input", () => {
      if (!select.value) select.value = detectarPlataforma(input.value);
    });
    fila.querySelector(".tx-enlace-quitar").addEventListener("click", () => {
      fila.remove();
      if (!cont.children.length) agregarFilaEnlace();
    });
    cont.appendChild(fila);
  }

  function escapeAttr(texto) {
    return String(texto ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function leerEnlaces() {
    const filas = [...document.querySelectorAll("#tx-enlaces .tx-enlace-fila")];
    const enlaces = [];
    for (const fila of filas) {
      const url = fila.querySelector(".tx-enlace-url").value.trim();
      if (!url) continue;
      if (!/^https?:\/\//i.test(url)) {
        throw new Error(`El enlace "${url}" debe empezar con http:// o https://`);
      }
      const plataforma = fila.querySelector(".tx-enlace-plataforma").value || detectarPlataforma(url) || "Otro";
      enlaces.push({ plataforma, url });
    }
    return enlaces;
  }

  function rellenarFormulario(transmision) {
    const cont = document.getElementById("tx-enlaces");
    if (cont) cont.innerHTML = "";
    const enlaces = Array.isArray(transmision?.enlaces) && transmision.enlaces.length
      ? transmision.enlaces
      : (transmision?.url_publica ? [{ plataforma: transmision.plataforma, url: transmision.url_publica }] : [{}]);
    enlaces.forEach((enlace) => agregarFilaEnlace(enlace));
    document.getElementById("tx-titulo").value = transmision?.titulo || "";
    document.getElementById("tx-descripcion").value = transmision?.descripcion || "";
    document.getElementById("tx-embed-url").value = transmision?.embed_url || "";

    const fechaInicio = transmision?.fecha_inicio_programada;
    if (fechaInicio) {
      const d = new Date(fechaInicio);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      document.getElementById("tx-fecha-inicio").value = local;
    } else {
      document.getElementById("tx-fecha-inicio").value = "";
    }
  }

  function limpiarMensajes() {
    const err = document.getElementById("transmision-modal-error");
    const ok = document.getElementById("transmision-modal-ok");
    if (err) { err.style.display = "none"; err.textContent = ""; }
    if (ok) { ok.style.display = "none"; ok.textContent = ""; }
  }

  function mostrarError(msg) {
    const err = document.getElementById("transmision-modal-error");
    if (!err) return;
    err.textContent = msg;
    err.style.display = "";
  }

  function mostrarOk(msg) {
    const ok = document.getElementById("transmision-modal-ok");
    if (!ok) return;
    ok.textContent = msg;
    ok.style.display = "";
    setTimeout(() => { ok.style.display = "none"; }, 3000);
  }

  async function abrirModalTransmision(partidoId) {
    crearModalSiNoExiste();
    _partidoIdActual = partidoId;
    limpiarMensajes();

    const modal = document.getElementById("modal-transmision");
    modal.style.display = "";

    mostrarEstadoBadge(null);
    rellenarFormulario(null);
    actualizarBotonesEstado(null);

    try {
      const data = await apiGet(`/partidos/${partidoId}/transmision`);
      _transmisionActual = data.transmision || null;
      rellenarFormulario(_transmisionActual);
      mostrarEstadoBadge(_transmisionActual?.estado);
      actualizarBotonesEstado(_transmisionActual);
    } catch (err) {
      mostrarError(`Error cargando transmisión: ${err.message}`);
    }
  }

  function cerrarModalTransmision() {
    const modal = document.getElementById("modal-transmision");
    if (modal) modal.style.display = "none";
    _transmisionActual = null;
    _partidoIdActual = null;
  }

  async function guardarTransmision() {
    limpiarMensajes();
    const estadoDestino = (document.getElementById("tx-estado-destino")?.value || "").trim();
    let enlaces;
    try {
      enlaces = leerEnlaces();
    } catch (err) {
      mostrarError(err.message);
      return;
    }
    const payload = {
      enlaces,
      titulo: document.getElementById("tx-titulo").value || null,
      descripcion: document.getElementById("tx-descripcion").value || null,
      embed_url: document.getElementById("tx-embed-url").value || null,
      fecha_inicio_programada: document.getElementById("tx-fecha-inicio").value || null,
    };
    if (estadoDestino) payload.estado = estadoDestino;

    try {
      let data;
      if (_transmisionActual) {
        data = await apiPut(`/transmisiones/${_transmisionActual.id}`, payload);
      } else {
        data = await apiPost(`/partidos/${_partidoIdActual}/transmision`, payload);
      }
      _transmisionActual = data.transmision;
      mostrarEstadoBadge(_transmisionActual?.estado);
      actualizarBotonesEstado(_transmisionActual);
      mostrarOk("✅ Transmisión guardada correctamente.");
    } catch (err) {
      mostrarError(err.message);
    }
  }

  async function iniciarTransmision() {
    if (!_transmisionActual) return;
    limpiarMensajes();
    try {
      const data = await apiPost(`/transmisiones/${_transmisionActual.id}/iniciar`, {});
      _transmisionActual = data.transmision;
      mostrarEstadoBadge(_transmisionActual?.estado);
      actualizarBotonesEstado(_transmisionActual);
      mostrarOk("🔴 ¡Transmisión iniciada!");
    } catch (err) {
      mostrarError(err.message);
    }
  }

  async function finalizarTransmision() {
    if (!_transmisionActual) return;
    limpiarMensajes();
    try {
      const data = await apiPost(`/transmisiones/${_transmisionActual.id}/finalizar`, {});
      _transmisionActual = data.transmision;
      mostrarEstadoBadge(_transmisionActual?.estado);
      actualizarBotonesEstado(_transmisionActual);
      mostrarOk("✅ Transmisión finalizada.");
    } catch (err) {
      mostrarError(err.message);
    }
  }

  async function cancelarTransmision() {
    if (!_transmisionActual) return;
    limpiarMensajes();
    try {
      const data = await apiPost(`/transmisiones/${_transmisionActual.id}/cancelar`, {});
      _transmisionActual = data.transmision;
      mostrarEstadoBadge(_transmisionActual?.estado);
      actualizarBotonesEstado(_transmisionActual);
      mostrarOk("Transmisión cancelada.");
    } catch (err) {
      mostrarError(err.message);
    }
  }

  // Expose globally (called from inline onclick in partidos.js card HTML)
  window.abrirModalTransmision = abrirModalTransmision;
  window.cerrarModalTransmision = cerrarModalTransmision;
})();
