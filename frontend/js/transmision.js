// frontend/js/transmision.js
// Gestión de transmisiones en vivo de partidos

(() => {
  const API = window.resolveApiBaseUrl ? window.resolveApiBaseUrl() : `${window.location.origin}/api`;

  let _transmisionActual = null;
  let _partidoIdActual = null;

  const ESTADOS_LABEL = {
    programada: "Programada",
    en_vivo: "🔴 EN VIVO",
    finalizada: "Finalizada",
    cancelada: "Cancelada",
  };

  const ESTADOS_CLASS = {
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
    modal.style.cssText = "display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;overflow-y:auto;";
    modal.innerHTML = `
      <div class="modal-box" style="background:#fff;max-width:560px;margin:2rem auto;border-radius:10px;padding:1.5rem;position:relative;">
        <button type="button" id="btn-cerrar-modal-transmision" style="position:absolute;top:.75rem;right:.75rem;background:none;border:none;font-size:1.4rem;cursor:pointer;" aria-label="Cerrar">✕</button>
        <h3 style="margin-top:0;">📡 Transmisión del Partido</h3>

        <div id="transmision-estado-badge" style="margin-bottom:1rem;"></div>

        <form id="form-transmision" autocomplete="off">
          <div class="form-group">
            <label for="tx-plataforma">Plataforma</label>
            <select id="tx-plataforma" class="form-control">
              <option value="">— Selecciona —</option>
              <option value="YouTube Live">YouTube Live</option>
              <option value="Facebook Live">Facebook Live</option>
              <option value="Twitch">Twitch</option>
              <option value="StreamYard">StreamYard</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div class="form-group">
            <label for="tx-url-publica">URL pública de la transmisión</label>
            <input type="url" id="tx-url-publica" class="form-control" placeholder="https://..." />
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

          <div id="transmision-modal-actions" style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1rem;">
            <button type="submit" class="btn btn-primary">
              <i class="fas fa-save"></i> Guardar
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
        </form>

        <div id="transmision-modal-error" style="color:red;margin-top:.75rem;display:none;"></div>
        <div id="transmision-modal-ok" style="color:green;margin-top:.75rem;display:none;"></div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("btn-cerrar-modal-transmision").addEventListener("click", cerrarModalTransmision);
    modal.addEventListener("click", (e) => { if (e.target === modal) cerrarModalTransmision(); });
    document.getElementById("form-transmision").addEventListener("submit", (e) => {
      e.preventDefault();
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
    if (estado === "programada") {
      btnIniciar.style.display = "";
      btnCancelar.style.display = "";
    } else if (estado === "en_vivo") {
      btnFinalizar.style.display = "";
      btnCancelar.style.display = "";
    }
  }

  function rellenarFormulario(transmision) {
    document.getElementById("tx-plataforma").value = transmision?.plataforma || "";
    document.getElementById("tx-url-publica").value = transmision?.url_publica || "";
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
    const payload = {
      plataforma: document.getElementById("tx-plataforma").value || null,
      url_publica: document.getElementById("tx-url-publica").value || null,
      titulo: document.getElementById("tx-titulo").value || null,
      descripcion: document.getElementById("tx-descripcion").value || null,
      embed_url: document.getElementById("tx-embed-url").value || null,
      fecha_inicio_programada: document.getElementById("tx-fecha-inicio").value || null,
    };

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
