// frontend/js/campeonatos.js

document.addEventListener("DOMContentLoaded", () => {
  if (!window.location.pathname.endsWith("campeonatos.html")) return;
  actualizarBotonesVistaCampeonatos();
  cargarCampeonatos();
});

const BACKEND_BASE = (
  window.resolveApiBaseUrl
    ? window.resolveApiBaseUrl()
    : window.API_BASE_URL || `${window.location.origin}/api`
).replace(/\/api\/?$/, "");
let campeonatosCache = [];
let vistaCampeonatos = localStorage.getItem("sgd_vista_campeonatos") || "cards";
vistaCampeonatos = vistaCampeonatos === "table" ? "table" : "cards";

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseMontoNoNegativo(valor, fallback = 0) {
  const n = Number.parseFloat(String(valor ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Number(n.toFixed(2));
}

function formatearFechaSolo(valor) {
  if (!valor) return "—";
  const texto = String(valor).trim();
  if (!texto) return "—";
  if (texto.includes("T")) return texto.split("T")[0];
  return texto.slice(0, 10);
}

function formatearTipoFutbolEtiqueta(valor) {
  const raw = String(valor || "").trim().toLowerCase();
  const mapa = {
    futbol_11: "Fútbol 11",
    futbol_9: "Fútbol 9",
    futbol_8: "Fútbol 8",
    futbol_7: "Fútbol 7",
    futbol_6: "Fútbol 6",
    futbol_5: "Fútbol 5",
    futsala: "Futsala",
    indor: "Indor",
  };
  if (mapa[raw]) return mapa[raw];
  return String(valor || "").replaceAll("_", " ");
}

function obtenerNumeroCampeonatoVisible(camp, fallback = null) {
  if (Number.isFinite(Number(fallback)) && Number(fallback) > 0) return Number(fallback);
  const n = Number.parseInt(camp?.numero_organizador, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return null;
}

function obtenerMetadatosCampeonato(camp) {
  const tipoFutbol = formatearTipoFutbolEtiqueta(camp.tipo_futbol || "");
  const sistema = camp.sistema_puntuacion || "tradicional";
  const estadoRaw = camp.estado || "planificacion";
  const estadoMap = {
    borrador: "Borrador",
    planificacion: "Borrador",
    inscripcion: "Inscripción",
    en_curso: "En Curso",
    finalizado: "Finalizado",
    archivado: "Archivado",
  };
  const estadoLabel = estadoMap[estadoRaw] || estadoRaw;
  const fechaInicio = formatearFechaSolo(camp.fecha_inicio);
  const fechaFin = formatearFechaSolo(camp.fecha_fin);
  const jugadoresMinMax = `${camp.min_jugador || "Mín"} - ${camp.max_jugador || "Máx"}`;
  const carnets = camp.genera_carnets === true || camp.genera_carnets === "true" ? "Habilitados" : "No habilitados";
  const costoArbitraje = parseMontoNoNegativo(camp.costo_arbitraje, 0);
  const costoTA = parseMontoNoNegativo(camp.costo_tarjeta_amarilla, 0);
  const costoTR = parseMontoNoNegativo(camp.costo_tarjeta_roja, 0);
  const bloquearMorosos =
    camp.bloquear_morosos === true || String(camp.bloquear_morosos).toLowerCase() === "true";
  const bloqueoMorosidadMonto = parseMontoNoNegativo(camp.bloqueo_morosidad_monto, 0);

  return {
    tipoFutbol,
    sistema,
    estadoRaw,
    estadoLabel,
    fechaInicio,
    fechaFin,
    jugadoresMinMax,
    carnets,
    costoArbitraje,
    costoTA,
    costoTR,
    bloquearMorosos,
    bloqueoMorosidadMonto,
  };
}

function actualizarBotonesVistaCampeonatos() {
  const btnCards = document.getElementById("btn-vista-campeonatos-cards");
  const btnTable = document.getElementById("btn-vista-campeonatos-table");
  if (btnCards) btnCards.classList.toggle("active", vistaCampeonatos === "cards");
  if (btnTable) btnTable.classList.toggle("active", vistaCampeonatos === "table");
}

function cambiarVistaCampeonatos(vista = "cards") {
  vistaCampeonatos = vista === "table" ? "table" : "cards";
  localStorage.setItem("sgd_vista_campeonatos", vistaCampeonatos);
  actualizarBotonesVistaCampeonatos();
  renderListadoCampeonatos();
}

function renderCampeonatoCard(camp, index = null) {
  const meta = obtenerMetadatosCampeonato(camp);
  const logoUrl = normalizarLogoCampeonato(camp.logo_url);
  const logoHtml = logoUrl ? `<img class="camp-logo" src="${logoUrl}" alt="Logo" />` : "";
  const numero = obtenerNumeroCampeonatoVisible(camp, Number(index) + 1);

  return `
    <div class="campeonato-card">
      <div class="campeonato-header">
        ${logoHtml}
        <div>
          <h3>${numero ? `${numero} - ` : ""}${escapeHtml(camp.nombre)}</h3>
          <p class="camp-organizador">
            <strong>Organiza:</strong> ${escapeHtml(camp.organizador || "No registrado")}
          </p>
        </div>
      </div>

      <div class="campeonato-info">
        <p><strong>Estado:</strong> <span class="badge-estado estado-${meta.estadoRaw}">${meta.estadoLabel}</span></p>
        <p><strong>Tipo:</strong> ${escapeHtml(meta.tipoFutbol)}</p>
        <p><strong>Sistema:</strong> ${escapeHtml(meta.sistema)}</p>
        <p><strong>Fechas:</strong> ${escapeHtml(meta.fechaInicio)} - ${escapeHtml(meta.fechaFin)}</p>
        <p><strong>Jugadores:</strong> ${escapeHtml(meta.jugadoresMinMax)}</p>
        <p><strong>Costos:</strong> Arb ${meta.costoArbitraje.toFixed(2)} | TA ${meta.costoTA.toFixed(2)} | TR ${meta.costoTR.toFixed(2)}</p>
        <p><strong>Bloqueo morosidad:</strong> ${meta.bloquearMorosos ? `Activo (>${meta.bloqueoMorosidadMonto.toFixed(2)})` : "Inactivo"}</p>
        <p><strong>Carnés:</strong> ${meta.carnets}</p>
      </div>

      <div class="campeonato-actions">
        <select class="select-estado" onchange="cambiarEstadoCampeonato(${camp.id}, this.value)" title="Cambiar estado">
          <option value="borrador" ${meta.estadoRaw === "borrador" || meta.estadoRaw === "planificacion" ? "selected" : ""}>Borrador</option>
          <option value="inscripcion" ${meta.estadoRaw === "inscripcion" ? "selected" : ""}>Inscripción</option>
          <option value="en_curso" ${meta.estadoRaw === "en_curso" ? "selected" : ""}>En Curso</option>
          <option value="finalizado" ${meta.estadoRaw === "finalizado" ? "selected" : ""}>Finalizado</option>
          <option value="archivado" ${meta.estadoRaw === "archivado" ? "selected" : ""}>Archivado</option>
        </select>
        <button class="btn btn-primary" onclick="irAEventos(${camp.id})">
          <i class="fas fa-layer-group"></i> Eventos / Categorías
        </button>
        <button class="btn btn-warning" onclick="editarCampeonato(${camp.id})">
          <i class="fas fa-edit"></i> Editar
        </button>
        <button class="btn btn-danger" onclick="eliminarCampeonato(${camp.id})">
          <i class="fas fa-trash"></i> Eliminar
        </button>
      </div>
    </div>
  `;
}

function renderTablaCampeonatos(campeonatos) {
  const filas = campeonatos
    .map((camp, index) => {
      const meta = obtenerMetadatosCampeonato(camp);
      const numero = obtenerNumeroCampeonatoVisible(camp, index + 1);
      return `
        <tr>
          <td>${numero}</td>
          <td>${escapeHtml(camp.nombre || "—")}</td>
          <td>${escapeHtml(camp.organizador || "No registrado")}</td>
          <td>${escapeHtml(meta.tipoFutbol || "—")}</td>
          <td>${escapeHtml(meta.sistema)}</td>
          <td>${escapeHtml(meta.fechaInicio)} - ${escapeHtml(meta.fechaFin)}</td>
          <td>
            <select class="select-estado" onchange="cambiarEstadoCampeonato(${camp.id}, this.value)" title="Cambiar estado">
              <option value="borrador" ${meta.estadoRaw === "borrador" || meta.estadoRaw === "planificacion" ? "selected" : ""}>Borrador</option>
              <option value="inscripcion" ${meta.estadoRaw === "inscripcion" ? "selected" : ""}>Inscripción</option>
              <option value="en_curso" ${meta.estadoRaw === "en_curso" ? "selected" : ""}>En Curso</option>
              <option value="finalizado" ${meta.estadoRaw === "finalizado" ? "selected" : ""}>Finalizado</option>
              <option value="archivado" ${meta.estadoRaw === "archivado" ? "selected" : ""}>Archivado</option>
            </select>
          </td>
          <td>${escapeHtml(meta.jugadoresMinMax)}</td>
          <td>Arb ${meta.costoArbitraje.toFixed(2)} / TA ${meta.costoTA.toFixed(2)} / TR ${meta.costoTR.toFixed(2)}</td>
          <td>${meta.bloquearMorosos ? `Sí (>${meta.bloqueoMorosidadMonto.toFixed(2)})` : "No"}</td>
          <td>${meta.carnets}</td>
          <td class="list-table-actions">
            <button class="btn btn-primary" onclick="irAEventos(${camp.id})"><i class="fas fa-layer-group"></i> Eventos</button>
            <button class="btn btn-warning" onclick="editarCampeonato(${camp.id})"><i class="fas fa-edit"></i> Editar</button>
            <button class="btn btn-danger" onclick="eliminarCampeonato(${camp.id})"><i class="fas fa-trash"></i> Eliminar</button>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="list-table-wrap">
      <table class="list-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Campeonato</th>
            <th>Organizador</th>
            <th>Tipo</th>
            <th>Sistema</th>
            <th>Fechas</th>
            <th>Estado</th>
            <th>Jugadores</th>
            <th>Costos</th>
            <th>Bloqueo morosos</th>
            <th>Carnés</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
}

function renderListadoCampeonatos() {
  const cont = document.getElementById("lista-campeonatos");
  if (!cont) return;

  if (!campeonatosCache.length) {
    cont.classList.remove("list-mode-table");
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-trophy"></i>
        <p>No hay campeonatos registrados.</p>
      </div>`;
    return;
  }

  if (vistaCampeonatos === "table") {
    cont.innerHTML = renderTablaCampeonatos(campeonatosCache);
    cont.classList.add("list-mode-table");
    return;
  }

  cont.classList.remove("list-mode-table");
  cont.innerHTML = campeonatosCache
    .map((camp, index) => renderCampeonatoCard(camp, index))
    .join("");
}

function normalizarLogoCampeonato(logoUrl) {
  if (!logoUrl) return "";
  const s = String(logoUrl).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return `${BACKEND_BASE}${s}`;
  if (s.startsWith("uploads/")) return `${BACKEND_BASE}/${s}`;
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(s)) return `${BACKEND_BASE}/uploads/campeonatos/${s}`;
  return `${BACKEND_BASE}/${s}`;
}

function normalizarMediaCampeonato(url) {
  return normalizarLogoCampeonato(url);
}

function renderPreviewMediaActual(url, etiqueta) {
  const href = normalizarMediaCampeonato(url);
  if (!href) return "";
  return `
    <div class="media-current-preview-card">
      <img src="${href}" alt="${escapeHtml(etiqueta)}" class="media-current-preview-image" />
      <div class="media-current-preview-info">
        <span class="media-current-preview-label">${escapeHtml(etiqueta)} actual</span>
        <a href="${href}" target="_blank" rel="noopener noreferrer">Ver archivo</a>
      </div>
    </div>
  `;
}

// ======================
// Cargar Campeonatos
// ======================
async function cargarCampeonatos() {
  const cont = document.getElementById("lista-campeonatos");
  cont.innerHTML = "<p>Cargando campeonatos...</p>";

  try {
    const data = await ApiClient.get("/campeonatos");
    campeonatosCache = data.campeonatos || data || [];
    renderListadoCampeonatos();
  } catch (error) {
    console.error("Error cargando campeonatos:", error);
    mostrarNotificacion("Error cargando campeonatos", "error");
    campeonatosCache = [];
    cont.innerHTML = "<p>Error cargando campeonatos.</p>";
  }
}

// ======================
// Navegación
// ======================
function irAEventos(campeonatoId) {
  if (window.RouteContext?.navigate) {
    window.RouteContext.navigate("eventos.html", { campeonato: Number(campeonatoId) || null });
    return;
  }
  window.location.href = `eventos.html?campeonato=${campeonatoId}`;
}

// ======================
// Modal crear campeonato
// ======================
/*function mostrarModalCrearCampeonato() {
  abrirModal("modal-campeonato");
}*/

// ======================
// Modal Crear / Editar
// ======================
function mostrarModalCrearCampeonato() {
  const titulo = document.getElementById("modal-campeonato-titulo");
  const form = document.getElementById("form-campeonato");

  if (titulo) titulo.textContent = "Nuevo Campeonato";
  if (form) form.reset();

  document.getElementById("campeonato-id").value = "";

  // Valores por defecto de colores
  const colorPrimario = document.getElementById("campeonato-color-primario");
  const colorSecundario = document.getElementById("campeonato-color-secundario");
  const colorAcento = document.getElementById("campeonato-color-acento");
  const reqCedulaJugador = document.getElementById("campeonato-req-cedula-jugador");
  const reqCedula = document.getElementById("campeonato-req-foto-cedula");
  const reqCarnet = document.getElementById("campeonato-req-foto-carnet");
  const generaCarnets = document.getElementById("campeonato-genera-carnets");
  const logoInput = document.getElementById("campeonato-logo");
  const fondoInput = document.getElementById("campeonato-carnet-fondo");
  const logoActual = document.getElementById("campeonato-logo-actual");
  const fondoActual = document.getElementById("campeonato-carnet-fondo-actual");
  const eliminarFondo = document.getElementById("campeonato-eliminar-carnet-fondo");
  if (colorPrimario) colorPrimario.value = "#FACC15";
  if (colorSecundario) colorSecundario.value = "#111827";
  if (colorAcento) colorAcento.value = "#22C55E";
  if (reqCedulaJugador) reqCedulaJugador.checked = true;
  if (reqCedula) reqCedula.checked = false;
  if (reqCarnet) reqCarnet.checked = false;
  if (generaCarnets) generaCarnets.checked = false;
  const costoArbitraje = document.getElementById("campeonato-costo-arbitraje");
  const costoTA = document.getElementById("campeonato-costo-ta");
  const costoTR = document.getElementById("campeonato-costo-tr");
  const costoCarnet = document.getElementById("campeonato-costo-carnet");
  const bloquearMorosos = document.getElementById("campeonato-bloquear-morosos");
  const bloqueoMorosidadMonto = document.getElementById("campeonato-bloqueo-morosidad-monto");
  if (costoArbitraje) costoArbitraje.value = "0";
  if (costoTA) costoTA.value = "0";
  if (costoTR) costoTR.value = "0";
  if (costoCarnet) costoCarnet.value = "0";
  if (bloquearMorosos) bloquearMorosos.checked = false;
  if (bloqueoMorosidadMonto) bloqueoMorosidadMonto.value = "0";
  if (logoInput) logoInput.value = "";
  if (fondoInput) fondoInput.value = "";
  if (logoActual) logoActual.innerHTML = "";
  if (fondoActual) fondoActual.innerHTML = "";
  if (eliminarFondo) eliminarFondo.checked = false;

  document.getElementById("campeonato-estado").value = "borrador";
  abrirModal("modal-campeonato");
}

async function cambiarEstadoCampeonato(id, estado) {
  try {
    await ApiClient.put(`/campeonatos/${id}/estado`, { estado });
    mostrarNotificacion("Estado actualizado", "success");
    await cargarCampeonatos();
  } catch (error) {
    mostrarNotificacion(error.message || "Error al cambiar estado", "error");
    await cargarCampeonatos();
  }
}

async function editarCampeonato(id) {
  try {
    const data = await ApiClient.get(`/campeonatos/${id}`);
    const camp = data.campeonato || data;

    const titulo = document.getElementById("modal-campeonato-titulo");
    if (titulo) titulo.textContent = "Editar Campeonato";

    document.getElementById("campeonato-id").value = camp.id;
    document.getElementById("campeonato-nombre").value = camp.nombre || "";
    document.getElementById("campeonato-organizador").value =
      camp.organizador || "";

    document.getElementById("campeonato-tipo").value =
      camp.tipo_futbol || "futbol_11";

    document.getElementById("campeonato-sistema").value =
      camp.sistema_puntuacion || "tradicional";

    document.getElementById("campeonato-fecha-inicio").value =
      formatearFechaSolo(camp.fecha_inicio).replace("—", "");
    document.getElementById("campeonato-fecha-fin").value =
      formatearFechaSolo(camp.fecha_fin).replace("—", "");

    document.getElementById("campeonato-min-jugadores").value =
      camp.min_jugador || "";
    document.getElementById("campeonato-max-jugadores").value =
      camp.max_jugador || "";

    if (camp.color_primario) {
      document.getElementById("campeonato-color-primario").value =
        camp.color_primario;
    }
    if (camp.color_secundario) {
      document.getElementById("campeonato-color-secundario").value =
        camp.color_secundario;
    }
    if (camp.color_acento) {
      document.getElementById("campeonato-color-acento").value =
        camp.color_acento;
    }
    document.getElementById("campeonato-logo").value = "";
    document.getElementById("campeonato-carnet-fondo").value = "";
    document.getElementById("campeonato-logo-actual").innerHTML = renderPreviewMediaActual(
      camp.logo_url,
      "Logo del campeonato"
    );
    document.getElementById("campeonato-carnet-fondo-actual").innerHTML = renderPreviewMediaActual(
      camp.carnet_fondo_url,
      "Fondo de carné"
    );
    document.getElementById("campeonato-eliminar-carnet-fondo").checked = false;

    const estadoVal = camp.estado === "planificacion" ? "borrador" : (camp.estado || "borrador");
    document.getElementById("campeonato-estado").value = estadoVal;
    document.getElementById("campeonato-req-cedula-jugador").checked =
      camp.requiere_cedula_jugador !== false && camp.requiere_cedula_jugador !== "false";
    document.getElementById("campeonato-req-foto-cedula").checked =
      camp.requiere_foto_cedula === true || camp.requiere_foto_cedula === "true";
    document.getElementById("campeonato-req-foto-carnet").checked =
      camp.requiere_foto_carnet === true || camp.requiere_foto_carnet === "true";
    document.getElementById("campeonato-genera-carnets").checked =
      camp.genera_carnets === true || camp.genera_carnets === "true";
    document.getElementById("campeonato-costo-arbitraje").value = parseMontoNoNegativo(
      camp.costo_arbitraje,
      0
    );
    document.getElementById("campeonato-costo-ta").value = parseMontoNoNegativo(
      camp.costo_tarjeta_amarilla,
      0
    );
    document.getElementById("campeonato-costo-tr").value = parseMontoNoNegativo(
      camp.costo_tarjeta_roja,
      0
    );
    document.getElementById("campeonato-costo-carnet").value = parseMontoNoNegativo(
      camp.costo_carnet,
      0
    );
    document.getElementById("campeonato-bloquear-morosos").checked =
      camp.bloquear_morosos === true || String(camp.bloquear_morosos).toLowerCase() === "true";
    document.getElementById("campeonato-bloqueo-morosidad-monto").value = parseMontoNoNegativo(
      camp.bloqueo_morosidad_monto,
      0
    );

    abrirModal("modal-campeonato");
  } catch (error) {
    console.error("Error cargando campeonato:", error);
    mostrarNotificacion("Error cargando datos del campeonato", "error");
  }
}

// ======================
// Guardar campeonato (crear / editar)
// ======================
document
  .getElementById("form-campeonato")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("campeonato-id").value;

    const nombre = document.getElementById("campeonato-nombre").value.trim();
    const organizador = document
      .getElementById("campeonato-organizador")
      .value.trim();
    const tipo = document.getElementById("campeonato-tipo").value;
    const sistema = document.getElementById("campeonato-sistema").value;
    const fechaInicio = document.getElementById("campeonato-fecha-inicio").value;
    const fechaFin = document.getElementById("campeonato-fecha-fin").value;
    const minJug = document.getElementById("campeonato-min-jugadores").value;
    const maxJug = document.getElementById("campeonato-max-jugadores").value;
    const colorPrimario =
      document.getElementById("campeonato-color-primario").value;
    const colorSecundario =
      document.getElementById("campeonato-color-secundario").value;
    const colorAcento =
      document.getElementById("campeonato-color-acento").value;
    const requiereCedulaJugador = document.getElementById("campeonato-req-cedula-jugador").checked;
    const requiereFotoCedula = document.getElementById("campeonato-req-foto-cedula").checked;
    const requiereFotoCarnet = document.getElementById("campeonato-req-foto-carnet").checked;
    const generaCarnets = document.getElementById("campeonato-genera-carnets").checked;
    const costoArbitraje = parseMontoNoNegativo(
      document.getElementById("campeonato-costo-arbitraje").value,
      0
    );
    const costoTarjetaAmarilla = parseMontoNoNegativo(
      document.getElementById("campeonato-costo-ta").value,
      0
    );
    const costoTarjetaRoja = parseMontoNoNegativo(
      document.getElementById("campeonato-costo-tr").value,
      0
    );
    const costoCarnet = parseMontoNoNegativo(
      document.getElementById("campeonato-costo-carnet").value,
      0
    );
    const bloquearMorosos = document.getElementById("campeonato-bloquear-morosos").checked;
    const bloqueoMorosidadMonto = parseMontoNoNegativo(
      document.getElementById("campeonato-bloqueo-morosidad-monto").value,
      0
    );

    const fileInput = document.getElementById("campeonato-logo");
    const file = fileInput.files[0];
    const carnetFondoInput = document.getElementById("campeonato-carnet-fondo");
    const carnetFondoFile = carnetFondoInput.files[0];
    const eliminarCarnetFondo = document.getElementById("campeonato-eliminar-carnet-fondo").checked;

    if (!nombre) {
      mostrarNotificacion("El nombre del campeonato es obligatorio", "error");
      return;
    }

    if (!fechaInicio || !fechaFin) {
      mostrarNotificacion(
        "Las fechas de inicio y fin son obligatorias",
        "error"
      );
      return;
    }

    if (file && file.size > 2 * 1024 * 1024) {
      mostrarNotificacion("El logo no debe superar los 2MB", "error");
      return;
    }
    if (carnetFondoFile && carnetFondoFile.size > 2 * 1024 * 1024) {
      mostrarNotificacion("El fondo de carné no debe superar los 2MB", "error");
      return;
    }

    const fd = new FormData();
    fd.append("nombre", nombre);
    fd.append("organizador", organizador);
    fd.append("tipo_futbol", tipo);
    fd.append("sistema_puntuacion", sistema);
    fd.append("fecha_inicio", fechaInicio);
    fd.append("fecha_fin", fechaFin);
    fd.append("min_jugador", minJug);
    fd.append("max_jugador", maxJug);
    fd.append("color_primario", colorPrimario);
    fd.append("color_secundario", colorSecundario);
    fd.append("color_acento", colorAcento);
    fd.append("requiere_cedula_jugador", String(requiereCedulaJugador));
    fd.append("requiere_foto_cedula", String(requiereFotoCedula));
    fd.append("requiere_foto_carnet", String(requiereFotoCarnet));
    fd.append("genera_carnets", String(generaCarnets));
    fd.append("costo_arbitraje", String(costoArbitraje));
    fd.append("costo_tarjeta_amarilla", String(costoTarjetaAmarilla));
    fd.append("costo_tarjeta_roja", String(costoTarjetaRoja));
    fd.append("costo_carnet", String(costoCarnet));
    fd.append("bloquear_morosos", String(bloquearMorosos));
    fd.append("bloqueo_morosidad_monto", String(bloqueoMorosidadMonto));
    fd.append("estado", document.getElementById("campeonato-estado").value);

    if (file) {
      fd.append("logo", file);
    }
    if (carnetFondoFile) {
      fd.append("carnet_fondo", carnetFondoFile);
    }
    if (eliminarCarnetFondo) {
      fd.append("eliminar_carnet_fondo", "true");
    }

    try {
      if (id) {
        // EDITAR
        const resp = await fetch(`${API_BASE_URL}/campeonatos/${id}`, {
          method: "PUT",
          body: fd,
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || "Error actualizando campeonato");
        }
        mostrarNotificacion("Campeonato actualizado correctamente", "success");
      } else {
        // CREAR
        const resp = await fetch(`${API_BASE_URL}/campeonatos`, {
          method: "POST",
          body: fd,
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || "Error creando campeonato");
        }
        mostrarNotificacion("Campeonato creado correctamente", "success");
      }

      cerrarModal("modal-campeonato");
      await cargarCampeonatos();
    } catch (error) {
      console.error("Error guardando campeonato:", error);
      mostrarNotificacion(
        error.message || "Error guardando el campeonato",
        "error"
      );
    }
  });

// ======================
// Eliminar campeonato
// ======================
async function eliminarCampeonato(id) {
  const confirmado = await window.mostrarConfirmacion({
    titulo: "Eliminar campeonato",
    mensaje:
      "¿Seguro que deseas eliminar este campeonato? Se eliminarán también sus equipos, grupos y partidos relacionados si el backend lo permite.",
    tipo: "warning",
    textoConfirmar: "Eliminar campeonato",
    claseConfirmar: "btn-danger",
  });
  if (!confirmado) {
    return;
  }

  try {
    await ApiClient.delete(`/campeonatos/${id}`);
    mostrarNotificacion("Campeonato eliminado", "success");
    await cargarCampeonatos();
  } catch (error) {
    console.error("Error eliminando campeonato:", error);
    mostrarNotificacion("Error eliminando el campeonato", "error");
  }
}

// ⚠️ IMPORTANTE: aquí dejo tus funciones editar/eliminar tal cual las tengas.
// Si ya existen abajo en tu archivo original, mantenlas.
// Si te faltan, me dices y te las dejo completas.
window.cambiarVistaCampeonatos = cambiarVistaCampeonatos;
