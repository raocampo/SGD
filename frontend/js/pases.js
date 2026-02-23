let pasesState = {
  campeonatos: [],
  eventos: [],
  equipos: [],
  jugadores: [],
  pases: [],
  esAdminLike: false,
};

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("pases.html")) return;
  await inicializarPases();
});

async function inicializarPases() {
  pasesState.esAdminLike = !!window.Auth?.isAdminLike?.();
  aplicarPermisosPasesUI();
  bindEventosPases();
  await cargarCatalogosPases();
  await cargarPases();
}

function aplicarPermisosPasesUI() {
  const cardRegistro = document.getElementById("pas-card-registro");
  if (!pasesState.esAdminLike && cardRegistro) {
    cardRegistro.style.display = "none";
  }
}

function bindEventosPases() {
  document.getElementById("btn-pas-buscar")?.addEventListener("click", cargarPases);
  document.getElementById("btn-pas-recargar")?.addEventListener("click", async () => {
    await cargarCatalogosPases();
    await cargarPases();
    mostrarNotificacion("Módulo de pases recargado", "success");
  });

  document.getElementById("pas-filtro-campeonato")?.addEventListener("change", () => {
    sincronizarFiltrosPorCampeonato();
    cargarPases();
  });
  document.getElementById("pas-filtro-evento")?.addEventListener("change", cargarPases);
  document.getElementById("pas-filtro-equipo-origen")?.addEventListener("change", cargarPases);
  document.getElementById("pas-filtro-equipo-destino")?.addEventListener("change", cargarPases);
  document.getElementById("pas-filtro-estado")?.addEventListener("change", cargarPases);
  document.getElementById("pas-filtro-busqueda")?.addEventListener("input", () => renderListadoPases());

  document.getElementById("pas-campeonato")?.addEventListener("change", sincronizarFormularioPase);
  document.getElementById("pas-jugador")?.addEventListener("change", sincronizarEquiposDestinoPorJugador);
  document.getElementById("pas-form-crear")?.addEventListener("submit", crearPase);
}

async function cargarCatalogosPases() {
  try {
    const [campR, evR, eqR, jugR] = await Promise.all([
      ApiClient.get("/campeonatos"),
      ApiClient.get("/eventos"),
      ApiClient.get("/equipos"),
      ApiClient.get("/jugadores"),
    ]);

    pasesState.campeonatos = campR.campeonatos || campR || [];
    pasesState.eventos = evR.eventos || evR || [];
    pasesState.equipos = eqR.equipos || eqR || [];
    pasesState.jugadores = jugR.jugadores || jugR || [];

    llenarSelectCampeonatos("pas-filtro-campeonato", true);
    llenarSelectCampeonatos("pas-campeonato", false);
    sincronizarFiltrosPorCampeonato();
    sincronizarFormularioPase();
  } catch (error) {
    console.error(error);
    mostrarNotificacion("No se pudieron cargar catálogos de pases", "error");
  }
}

function llenarSelectCampeonatos(selectId, incluirTodos) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const previo = select.value;
  select.innerHTML = incluirTodos
    ? '<option value="">Todos</option>'
    : '<option value="">Selecciona campeonato</option>';

  pasesState.campeonatos.forEach((c) => {
    const option = document.createElement("option");
    option.value = String(c.id);
    option.textContent = c.nombre || `Campeonato ${c.id}`;
    select.appendChild(option);
  });

  if ([...select.options].some((op) => op.value === previo)) {
    select.value = previo;
  }
}

function obtenerEquipoPorId(id) {
  const n = Number.parseInt(id, 10);
  if (!Number.isFinite(n)) return null;
  return pasesState.equipos.find((x) => Number(x.id) === n) || null;
}

function obtenerCampeonatoIdDeJugador(jugador) {
  const equipo = obtenerEquipoPorId(jugador?.equipo_id);
  const campeonatoId = Number.parseInt(equipo?.campeonato_id, 10);
  return Number.isFinite(campeonatoId) ? campeonatoId : null;
}

function construirLabelJugador(jugador) {
  const nombre = `${jugador?.nombre || ""} ${jugador?.apellido || ""}`.trim() || "Jugador";
  const cedula = jugador?.cedidentidad ? ` - CI ${jugador.cedidentidad}` : "";
  const equipo = jugador?.nombre_equipo ? ` (${jugador.nombre_equipo})` : "";
  return `${nombre}${cedula}${equipo}`;
}

function sincronizarFiltrosPorCampeonato() {
  const campeonatoId = Number.parseInt(
    document.getElementById("pas-filtro-campeonato")?.value || "",
    10
  );

  const eventosSelect = document.getElementById("pas-filtro-evento");
  const origenSelect = document.getElementById("pas-filtro-equipo-origen");
  const destinoSelect = document.getElementById("pas-filtro-equipo-destino");
  if (!eventosSelect || !origenSelect || !destinoSelect) return;

  const prevEvento = eventosSelect.value;
  const prevOrigen = origenSelect.value;
  const prevDestino = destinoSelect.value;

  const eventos = Number.isFinite(campeonatoId)
    ? pasesState.eventos.filter((e) => Number(e.campeonato_id) === campeonatoId)
    : pasesState.eventos;

  const equipos = Number.isFinite(campeonatoId)
    ? pasesState.equipos.filter((e) => Number(e.campeonato_id) === campeonatoId)
    : pasesState.equipos;

  eventosSelect.innerHTML = '<option value="">Todas</option>';
  eventos.forEach((e) => {
    const op = document.createElement("option");
    op.value = String(e.id);
    op.textContent = e.nombre || `Categoría ${e.id}`;
    eventosSelect.appendChild(op);
  });

  origenSelect.innerHTML = '<option value="">Todos</option>';
  destinoSelect.innerHTML = '<option value="">Todos</option>';
  equipos.forEach((e) => {
    const op1 = document.createElement("option");
    op1.value = String(e.id);
    op1.textContent = e.nombre || `Equipo ${e.id}`;
    origenSelect.appendChild(op1);

    const op2 = document.createElement("option");
    op2.value = String(e.id);
    op2.textContent = e.nombre || `Equipo ${e.id}`;
    destinoSelect.appendChild(op2);
  });

  if ([...eventosSelect.options].some((x) => x.value === prevEvento)) eventosSelect.value = prevEvento;
  if ([...origenSelect.options].some((x) => x.value === prevOrigen)) origenSelect.value = prevOrigen;
  if ([...destinoSelect.options].some((x) => x.value === prevDestino)) destinoSelect.value = prevDestino;
}

function sincronizarFormularioPase() {
  const campeonatoId = Number.parseInt(document.getElementById("pas-campeonato")?.value || "", 10);
  const eventoSelect = document.getElementById("pas-evento");
  const jugadorSelect = document.getElementById("pas-jugador");
  const equipoDestinoSelect = document.getElementById("pas-equipo-destino");
  if (!eventoSelect || !jugadorSelect || !equipoDestinoSelect) return;

  const prevEvento = eventoSelect.value;
  const prevJugador = jugadorSelect.value;

  const eventos = Number.isFinite(campeonatoId)
    ? pasesState.eventos.filter((e) => Number(e.campeonato_id) === campeonatoId)
    : [];

  const jugadores = Number.isFinite(campeonatoId)
    ? pasesState.jugadores.filter((j) => Number(obtenerCampeonatoIdDeJugador(j)) === campeonatoId)
    : [];

  eventoSelect.innerHTML = '<option value="">Sin categoría</option>';
  eventos.forEach((e) => {
    const op = document.createElement("option");
    op.value = String(e.id);
    op.textContent = e.nombre || `Categoría ${e.id}`;
    eventoSelect.appendChild(op);
  });

  jugadorSelect.innerHTML = '<option value="">Selecciona jugador</option>';
  jugadores.forEach((j) => {
    const op = document.createElement("option");
    op.value = String(j.id);
    op.textContent = construirLabelJugador(j);
    jugadorSelect.appendChild(op);
  });

  if ([...eventoSelect.options].some((x) => x.value === prevEvento)) eventoSelect.value = prevEvento;
  if ([...jugadorSelect.options].some((x) => x.value === prevJugador)) jugadorSelect.value = prevJugador;
  sincronizarEquiposDestinoPorJugador();
}

function sincronizarEquiposDestinoPorJugador() {
  const jugadorId = Number.parseInt(document.getElementById("pas-jugador")?.value || "", 10);
  const campeonatoId = Number.parseInt(document.getElementById("pas-campeonato")?.value || "", 10);
  const selectDestino = document.getElementById("pas-equipo-destino");
  if (!selectDestino) return;

  const prev = selectDestino.value;
  selectDestino.innerHTML = '<option value="">Selecciona equipo</option>';

  if (!Number.isFinite(campeonatoId)) return;

  const jugador = pasesState.jugadores.find((j) => Number(j.id) === jugadorId) || null;
  const equipoOrigenId = Number.parseInt(jugador?.equipo_id, 10);

  const equiposDisponibles = pasesState.equipos.filter(
    (e) => Number(e.campeonato_id) === campeonatoId && Number(e.id) !== equipoOrigenId
  );

  equiposDisponibles.forEach((e) => {
    const op = document.createElement("option");
    op.value = String(e.id);
    op.textContent = e.nombre || `Equipo ${e.id}`;
    selectDestino.appendChild(op);
  });

  if ([...selectDestino.options].some((x) => x.value === prev)) {
    selectDestino.value = prev;
  }
}

function construirParamsFiltrosPases() {
  return {
    campeonato_id: document.getElementById("pas-filtro-campeonato")?.value || "",
    evento_id: document.getElementById("pas-filtro-evento")?.value || "",
    equipo_origen_id: document.getElementById("pas-filtro-equipo-origen")?.value || "",
    equipo_destino_id: document.getElementById("pas-filtro-equipo-destino")?.value || "",
    estado: document.getElementById("pas-filtro-estado")?.value || "",
  };
}

async function cargarPases() {
  const cont = document.getElementById("pas-listado");
  if (cont) {
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-people-arrows"></i>
        <p>Cargando pases...</p>
      </div>`;
  }

  try {
    const resp = await PasesAPI.listar(construirParamsFiltrosPases());
    pasesState.pases = resp.pases || [];
    renderListadoPases();
    renderKPIsPases();
  } catch (error) {
    console.error(error);
    pasesState.pases = [];
    renderKPIsPases();
    if (cont) {
      cont.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-triangle-exclamation"></i>
          <p>${escapeHtml(error.message || "No se pudieron cargar los pases")}</p>
        </div>`;
    }
  }
}

function renderKPIsPases() {
  const total = pasesState.pases.length;
  const pendientes = pasesState.pases.filter((x) => String(x.estado).toLowerCase() === "pendiente").length;
  const aprobados = pasesState.pases.filter((x) => ["aprobado", "pagado"].includes(String(x.estado).toLowerCase())).length;
  const montoTotal = pasesState.pases.reduce((acc, x) => acc + Number(x.monto || 0), 0);

  const setText = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setText("pas-kpi-total", String(total));
  setText("pas-kpi-pendiente", String(pendientes));
  setText("pas-kpi-aprobado", String(aprobados));
  setText("pas-kpi-monto", formatoMoneda(montoTotal));
}

function obtenerPasesFiltradosLocal() {
  const q = String(document.getElementById("pas-filtro-busqueda")?.value || "")
    .trim()
    .toLowerCase();
  if (!q) return [...pasesState.pases];

  return pasesState.pases.filter((p) => {
    const cadena = [
      p.jugador_nombre,
      p.jugador_apellido,
      p.jugador_cedula,
      p.equipo_origen_nombre,
      p.equipo_destino_nombre,
      p.campeonato_nombre,
      p.evento_nombre,
      p.observacion,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return cadena.includes(q);
  });
}

function renderListadoPases() {
  const cont = document.getElementById("pas-listado");
  if (!cont) return;

  const lista = obtenerPasesFiltradosLocal();
  if (!lista.length) {
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-list"></i>
        <p>No hay pases para los filtros seleccionados.</p>
      </div>`;
    return;
  }

  const filas = lista
    .map((p) => {
      const jugador = `${p.jugador_nombre || ""} ${p.jugador_apellido || ""}`.trim() || "Jugador";
      const fecha = formatearFechaCorta(p.fecha_pase);
      const estado = String(p.estado || "pendiente").toLowerCase();

      return `
        <tr>
          <td>${escapeHtml(p.id)}</td>
          <td>${escapeHtml(fecha)}</td>
          <td>${escapeHtml(p.campeonato_nombre || "-")}</td>
          <td>${escapeHtml(p.evento_nombre || "-")}</td>
          <td>
            <strong>${escapeHtml(jugador)}</strong><br />
            <small>${escapeHtml(p.jugador_cedula || "-")}</small>
          </td>
          <td>${escapeHtml(p.equipo_origen_nombre || "-")}</td>
          <td>${escapeHtml(p.equipo_destino_nombre || "-")}</td>
          <td>${escapeHtml(formatoMoneda(p.monto))}</td>
          <td><span class="pas-badge ${escapeHtml(`pas-estado-${estado}`)}">${escapeHtml(estado.toUpperCase())}</span></td>
          <td class="list-table-actions">
            ${renderAccionesPase(p)}
          </td>
        </tr>`;
    })
    .join("");

  cont.innerHTML = `
    <div class="list-table-wrap">
      <table class="list-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Fecha</th>
            <th>Campeonato</th>
            <th>Categoría</th>
            <th>Jugador</th>
            <th>Origen</th>
            <th>Destino</th>
            <th>Monto</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

function renderAccionesPase(pase) {
  if (!pasesState.esAdminLike) return '<span class="text-muted">Solo lectura</span>';
  const estado = String(pase.estado || "pendiente").toLowerCase();

  if (estado === "anulado") {
    return '<span class="text-muted">Anulado</span>';
  }

  const btnAprobar = `
    <button class="btn btn-success" onclick="actualizarEstadoPase(${Number(pase.id)}, 'aprobado', true)">
      <i class="fas fa-check"></i> Aprobar
    </button>`;
  const btnPagado = `
    <button class="btn btn-primary" onclick="actualizarEstadoPase(${Number(pase.id)}, 'pagado', false)">
      <i class="fas fa-money-check-dollar"></i> Pagado
    </button>`;
  const btnAnular = `
    <button class="btn btn-danger" onclick="actualizarEstadoPase(${Number(pase.id)}, 'anulado', false)">
      <i class="fas fa-ban"></i> Anular
    </button>`;

  if (estado === "pendiente") return `${btnAprobar}${btnPagado}${btnAnular}`;
  if (estado === "pagado") return `${btnAprobar}${btnAnular}`;
  if (estado === "aprobado") return `<span class="text-muted">Transferido</span>${btnAnular}`;
  return btnAnular;
}

async function crearPase(e) {
  e.preventDefault();
  if (!pasesState.esAdminLike) return;

  const campeonatoId = Number.parseInt(document.getElementById("pas-campeonato")?.value || "", 10);
  const eventoId = Number.parseInt(document.getElementById("pas-evento")?.value || "", 10);
  const jugadorId = Number.parseInt(document.getElementById("pas-jugador")?.value || "", 10);
  const equipoDestinoId = Number.parseInt(
    document.getElementById("pas-equipo-destino")?.value || "",
    10
  );
  const monto = Number.parseFloat(document.getElementById("pas-monto")?.value || "");
  const fechaPase = document.getElementById("pas-fecha")?.value || "";
  const observacion = (document.getElementById("pas-observacion")?.value || "").trim();

  if (!Number.isFinite(campeonatoId) || !Number.isFinite(jugadorId) || !Number.isFinite(equipoDestinoId)) {
    mostrarNotificacion("Selecciona campeonato, jugador y equipo destino", "warning");
    return;
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    mostrarNotificacion("Monto de pase inválido", "warning");
    return;
  }

  try {
    await PasesAPI.crear({
      campeonato_id: campeonatoId,
      evento_id: Number.isFinite(eventoId) ? eventoId : null,
      jugador_id: jugadorId,
      equipo_destino_id: equipoDestinoId,
      monto: Number(monto.toFixed(2)),
      fecha_pase: fechaPase || null,
      observacion: observacion || null,
      estado: "pendiente",
    });

    mostrarNotificacion("Pase registrado correctamente", "success");
    document.getElementById("pas-form-crear")?.reset();
    sincronizarFormularioPase();
    await cargarPases();
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo registrar el pase", "error");
  }
}

async function actualizarEstadoPase(id, estado, aplicarTransferencia) {
  const accion =
    estado === "aprobado"
      ? "aprobar y transferir al jugador"
      : estado === "pagado"
        ? "marcar como pagado"
        : "anular";
  if (!confirm(`¿Deseas ${accion} este pase?`)) return;

  try {
    await PasesAPI.actualizarEstado(id, {
      estado,
      aplicar_transferencia: aplicarTransferencia === true,
    });
    mostrarNotificacion("Estado de pase actualizado", "success");
    await cargarCatalogosPases();
    await cargarPases();
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo actualizar el pase", "error");
  }
}

function formatearFechaCorta(v) {
  if (!v) return "-";
  const str = String(v);
  const iso = str.includes("T") ? str.split("T")[0] : str.slice(0, 10);
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatoMoneda(v) {
  const num = Number.parseFloat(v || 0);
  if (!Number.isFinite(num)) return "$0,00";
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

window.actualizarEstadoPase = actualizarEstadoPase;
