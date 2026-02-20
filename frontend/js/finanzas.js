let finanzasState = {
  campeonatos: [],
  eventos: [],
  equipos: [],
};

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("finanzas.html")) return;
  await inicializarFinanzas();
});

async function inicializarFinanzas() {
  bindEventosFinanzas();
  inicializarTogglesReportes();
  await cargarCatalogosFinanzas();
  await Promise.all([
    buscarMovimientosFinanzas(),
    cargarMorosidadFinanzas(),
    cargarEstadoCuentaActual(),
  ]);
}

function bindEventosFinanzas() {
  document
    .getElementById("btn-fin-buscar")
    ?.addEventListener("click", buscarMovimientosFinanzas);

  document.getElementById("btn-fin-recargar")?.addEventListener("click", async () => {
    await cargarCatalogosFinanzas();
    await Promise.all([
      buscarMovimientosFinanzas(),
      cargarMorosidadFinanzas(),
      cargarEstadoCuentaActual(),
    ]);
    mostrarNotificacion("Datos financieros recargados", "success");
  });

  document
    .getElementById("fin-campeonato")
    ?.addEventListener("change", () => {
      sincronizarSelectoresPorCampeonato();
      buscarMovimientosFinanzas();
      cargarMorosidadFinanzas();
      cargarEstadoCuentaActual();
    });

  document
    .getElementById("fin-evento")
    ?.addEventListener("change", () => {
      buscarMovimientosFinanzas();
      cargarMorosidadFinanzas();
      cargarEstadoCuentaActual();
    });

  document.getElementById("fin-equipo")?.addEventListener("change", async () => {
    await cargarEstadoCuentaActual();
  });

  document
    .getElementById("fin-form-movimiento")
    ?.addEventListener("submit", guardarMovimientoFinanzas);

  document
    .getElementById("mov-campeonato")
    ?.addEventListener("change", sincronizarFormularioMovimiento);
}

function inicializarTogglesReportes() {
  configurarToggleReporte("btn-toggle-morosidad", "fin-morosidad-contenido", true);
  configurarToggleReporte("btn-toggle-movimientos", "fin-movimientos-contenido", true);
}

function configurarToggleReporte(btnId, targetId, expandedInicial = true) {
  const btn = document.getElementById(btnId);
  const target = document.getElementById(targetId);
  if (!btn || !target) return;

  const icon = () => btn.querySelector("i");

  const renderEstado = (expanded) => {
    target.style.display = expanded ? "" : "none";
    btn.setAttribute("aria-expanded", expanded ? "true" : "false");
    const i = icon();
    if (i) i.className = expanded ? "fas fa-times" : "fas fa-plus";
  };

  let expanded = expandedInicial;
  renderEstado(expanded);

  btn.addEventListener("click", () => {
    expanded = !expanded;
    renderEstado(expanded);
  });
}

async function cargarCatalogosFinanzas() {
  try {
    const [campR, evR, eqR] = await Promise.all([
      ApiClient.get("/campeonatos"),
      ApiClient.get("/eventos"),
      ApiClient.get("/equipos"),
    ]);

    finanzasState.campeonatos = campR.campeonatos || campR || [];
    finanzasState.eventos = evR.eventos || evR || [];
    finanzasState.equipos = eqR.equipos || eqR || [];

    llenarSelectCampeonatos("fin-campeonato", true);
    llenarSelectCampeonatos("mov-campeonato", false);
    sincronizarSelectoresPorCampeonato();
    sincronizarFormularioMovimiento();
  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error cargando catalogos financieros", "error");
  }
}

function llenarSelectCampeonatos(id, includeAll) {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = includeAll
    ? '<option value="">Todos</option>'
    : '<option value="">Selecciona campeonato</option>';

  finanzasState.campeonatos.forEach((c) => {
    const op = document.createElement("option");
    op.value = String(c.id);
    op.textContent = c.nombre || `Campeonato ${c.id}`;
    select.appendChild(op);
  });
}

function sincronizarSelectoresPorCampeonato() {
  const campeonatoId = Number.parseInt(
    document.getElementById("fin-campeonato")?.value || "",
    10
  );
  const eventoSelect = document.getElementById("fin-evento");
  const equipoSelect = document.getElementById("fin-equipo");
  if (!eventoSelect || !equipoSelect) return;

  const eventosFiltrados = Number.isFinite(campeonatoId)
    ? finanzasState.eventos.filter((e) => Number(e.campeonato_id) === campeonatoId)
    : finanzasState.eventos;

  const equiposFiltrados = Number.isFinite(campeonatoId)
    ? finanzasState.equipos.filter((e) => Number(e.campeonato_id) === campeonatoId)
    : finanzasState.equipos;

  const prevEvento = eventoSelect.value;
  const prevEquipo = equipoSelect.value;

  eventoSelect.innerHTML = '<option value="">Todos</option>';
  eventosFiltrados.forEach((e) => {
    const op = document.createElement("option");
    op.value = String(e.id);
    op.textContent = e.nombre || `Categoría ${e.id}`;
    eventoSelect.appendChild(op);
  });

  equipoSelect.innerHTML = '<option value="">Todos</option>';
  equiposFiltrados.forEach((e) => {
    const op = document.createElement("option");
    op.value = String(e.id);
    op.textContent = e.nombre || `Equipo ${e.id}`;
    equipoSelect.appendChild(op);
  });

  if ([...eventoSelect.options].some((x) => x.value === prevEvento)) {
    eventoSelect.value = prevEvento;
  }
  if ([...equipoSelect.options].some((x) => x.value === prevEquipo)) {
    equipoSelect.value = prevEquipo;
  }
}

function sincronizarFormularioMovimiento() {
  const campeonatoId = Number.parseInt(
    document.getElementById("mov-campeonato")?.value || "",
    10
  );

  const eventoSelect = document.getElementById("mov-evento");
  const equipoSelect = document.getElementById("mov-equipo");
  if (!eventoSelect || !equipoSelect) return;

  const eventosFiltrados = Number.isFinite(campeonatoId)
    ? finanzasState.eventos.filter((e) => Number(e.campeonato_id) === campeonatoId)
    : [];

  const equiposFiltrados = Number.isFinite(campeonatoId)
    ? finanzasState.equipos.filter((e) => Number(e.campeonato_id) === campeonatoId)
    : [];

  const prevEvento = eventoSelect.value;
  const prevEquipo = equipoSelect.value;

  eventoSelect.innerHTML = '<option value="">Sin categoría</option>';
  eventosFiltrados.forEach((e) => {
    const op = document.createElement("option");
    op.value = String(e.id);
    op.textContent = e.nombre || `Categoría ${e.id}`;
    eventoSelect.appendChild(op);
  });

  equipoSelect.innerHTML = '<option value="">Selecciona equipo</option>';
  equiposFiltrados.forEach((e) => {
    const op = document.createElement("option");
    op.value = String(e.id);
    op.textContent = e.nombre || `Equipo ${e.id}`;
    equipoSelect.appendChild(op);
  });

  if ([...eventoSelect.options].some((x) => x.value === prevEvento)) {
    eventoSelect.value = prevEvento;
  }
  if ([...equipoSelect.options].some((x) => x.value === prevEquipo)) {
    equipoSelect.value = prevEquipo;
  }
}

async function buscarMovimientosFinanzas() {
  const params = {
    campeonato_id: document.getElementById("fin-campeonato")?.value || "",
    evento_id: document.getElementById("fin-evento")?.value || "",
    equipo_id: document.getElementById("fin-equipo")?.value || "",
    tipo_movimiento: document.getElementById("fin-tipo")?.value || "",
    estado: document.getElementById("fin-estado")?.value || "",
    desde: document.getElementById("fin-desde")?.value || "",
    hasta: document.getElementById("fin-hasta")?.value || "",
    limit: 500,
  };

  const cont = document.getElementById("fin-movimientos-contenido");
  if (cont) cont.innerHTML = renderCargando("Cargando movimientos...");

  try {
    const resp = await FinanzasAPI.listarMovimientos(params);
    renderTablaMovimientos(resp.movimientos || []);
  } catch (error) {
    console.error(error);
    if (cont) cont.innerHTML = renderVacio(error.message || "No se pudo cargar");
  }
}

async function cargarMorosidadFinanzas() {
  const params = {
    campeonato_id: document.getElementById("fin-campeonato")?.value || "",
    evento_id: document.getElementById("fin-evento")?.value || "",
  };
  const cont = document.getElementById("fin-morosidad-contenido");
  if (cont) cont.innerHTML = renderCargando("Calculando morosidad...");

  try {
    const resp = await FinanzasAPI.morosidad(params);
    renderMorosidad(resp.equipos || []);
  } catch (error) {
    console.error(error);
    if (cont) cont.innerHTML = renderVacio(error.message || "No se pudo calcular morosidad");
  }
}

async function cargarEstadoCuentaActual() {
  const equipoId = document.getElementById("fin-equipo")?.value || "";
  const resumen = document.getElementById("fin-estado-cuenta-resumen");
  const movimientos = document.getElementById("fin-estado-cuenta-movimientos");

  if (!equipoId) {
    if (resumen) {
      resumen.className = "fin-resumen-vacio";
      resumen.textContent =
        "Selecciona un equipo para visualizar su estado de cuenta.";
    }
    if (movimientos) movimientos.innerHTML = "";
    return;
  }

  if (movimientos) movimientos.innerHTML = renderCargando("Cargando estado de cuenta...");

  try {
    const params = {
      campeonato_id: document.getElementById("fin-campeonato")?.value || "",
      evento_id: document.getElementById("fin-evento")?.value || "",
    };
    const resp = await FinanzasAPI.estadoCuentaEquipo(equipoId, params);
    const r = resp.resumen || {};
    if (resumen) {
      resumen.className = "fin-resumen-cuenta";
      resumen.innerHTML = `
        <div><strong>Equipo:</strong> ${escaparHtml(resp?.equipo?.nombre || "-")}</div>
        <div><strong>Cargo inscripción:</strong> ${formatoMoneda(r.cargos_inscripcion)}</div>
        <div><strong>Abono inscripción:</strong> ${formatoMoneda(r.abonos_inscripcion)}</div>
        <div><strong>Saldo inscripción:</strong> <span class="${r.saldo_inscripcion > 0 ? "fin-saldo-deuda" : "fin-saldo-ok"}">${formatoMoneda(r.saldo_inscripcion)}</span></div>
        <div><strong>Saldo arbitraje:</strong> <span class="${r.saldo_arbitraje > 0 ? "fin-saldo-deuda" : "fin-saldo-ok"}">${formatoMoneda(r.saldo_arbitraje)}</span></div>
        <div><strong>Saldo tarjetas:</strong> <span class="${r.saldo_multa > 0 ? "fin-saldo-deuda" : "fin-saldo-ok"}">${formatoMoneda(r.saldo_multa)}</span></div>
        <div><strong>Saldo total:</strong> <span class="${r.saldo > 0 ? "fin-saldo-deuda" : "fin-saldo-ok"}">${formatoMoneda(r.saldo)}</span></div>
        <div><strong>Cargos pendientes:</strong> ${formatoMoneda(r.cargos_pendientes)}</div>
        <div><strong>Vencido:</strong> ${formatoMoneda(r.cargos_vencidos)}</div>
      `;
    }
    renderTablaEstadoCuenta(resp.movimientos || []);
  } catch (error) {
    console.error(error);
    if (resumen) {
      resumen.className = "fin-resumen-vacio";
      resumen.textContent = error.message || "No se pudo cargar estado de cuenta";
    }
    if (movimientos) movimientos.innerHTML = "";
  }
}

async function guardarMovimientoFinanzas(e) {
  e.preventDefault();
  const payload = {
    campeonato_id: document.getElementById("mov-campeonato")?.value || "",
    evento_id: document.getElementById("mov-evento")?.value || null,
    equipo_id: document.getElementById("mov-equipo")?.value || "",
    tipo_movimiento: document.getElementById("mov-tipo")?.value || "",
    concepto: document.getElementById("mov-concepto")?.value || "",
    monto: document.getElementById("mov-monto")?.value || "",
    estado: document.getElementById("mov-estado")?.value || "",
    fecha_movimiento: document.getElementById("mov-fecha")?.value || "",
    fecha_vencimiento: document.getElementById("mov-vencimiento")?.value || "",
    metodo_pago: document.getElementById("mov-metodo")?.value || "",
    referencia: document.getElementById("mov-referencia")?.value || "",
    descripcion: document.getElementById("mov-descripcion")?.value || "",
  };

  if (!payload.campeonato_id || !payload.equipo_id) {
    mostrarNotificacion("Selecciona campeonato y equipo", "warning");
    return;
  }

  try {
    await FinanzasAPI.crearMovimiento(payload);
    mostrarNotificacion("Movimiento registrado", "success");
    document.getElementById("fin-form-movimiento")?.reset();
    sincronizarFormularioMovimiento();
    await Promise.all([
      buscarMovimientosFinanzas(),
      cargarMorosidadFinanzas(),
      cargarEstadoCuentaActual(),
    ]);
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo registrar movimiento", "error");
  }
}

function renderTablaMovimientos(movimientos) {
  const cont = document.getElementById("fin-movimientos-contenido");
  if (!cont) return;
  if (!movimientos.length) {
    cont.innerHTML = renderVacio("No hay movimientos para los filtros actuales.");
    return;
  }

  const rows = movimientos
    .map((m) => {
      return `
        <tr>
          <td class="fin-col-fecha">${escaparHtml(formatearFechaFinanzas(m.fecha_movimiento))}</td>
          <td>${escaparHtml(m.campeonato_nombre || "-")}</td>
          <td>${escaparHtml(m.evento_nombre || "-")}</td>
          <td>${escaparHtml(m.equipo_nombre || "-")}</td>
          <td><span class="badge">${escaparHtml(m.tipo_movimiento || "-")}</span></td>
          <td>${escaparHtml(m.concepto || "-")}</td>
          <td class="fin-col-monto">${formatoMoneda(m.monto)}</td>
          <td>${escaparHtml(m.estado || "-")}</td>
          <td class="fin-col-descripcion">${escaparHtml(m.descripcion || "-")}</td>
        </tr>
      `;
    })
    .join("");

  cont.innerHTML = `
    <table class="tabla-estadistica tabla-estadistica-compacta">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Campeonato</th>
          <th>Categoría</th>
          <th>Equipo</th>
          <th>Tipo</th>
          <th>Concepto</th>
          <th>Monto</th>
          <th>Estado</th>
          <th>Descripcion</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderMorosidad(equipos) {
  const cont = document.getElementById("fin-morosidad-contenido");
  if (!cont) return;
  if (!equipos.length) {
    cont.innerHTML = renderVacio("No hay equipos morosos en el contexto seleccionado.");
    return;
  }

  const rows = equipos
    .map((x, idx) => {
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escaparHtml(x.equipo_nombre || "-")}</td>
          <td>${escaparHtml(x.campeonato_nombre || "-")}</td>
          <td>${formatoMoneda(x.total_cargos)}</td>
          <td>${formatoMoneda(x.total_abonos)}</td>
          <td class="${Number(x.saldo || 0) > 0 ? "fin-saldo-deuda" : "fin-saldo-ok"}">${formatoMoneda(x.saldo)}</td>
          <td>${formatoMoneda(x.saldo_vencido)}</td>
        </tr>
      `;
    })
    .join("");

  cont.innerHTML = `
    <table class="tabla-estadistica tabla-estadistica-compacta">
      <thead>
        <tr>
          <th>#</th>
          <th>Equipo</th>
          <th>Campeonato</th>
          <th>Cargos</th>
          <th>Abonos</th>
          <th>Saldo</th>
          <th>Vencido</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderTablaEstadoCuenta(items) {
  const cont = document.getElementById("fin-estado-cuenta-movimientos");
  if (!cont) return;
  if (!items.length) {
    cont.innerHTML = renderVacio("Sin movimientos para este equipo.");
    return;
  }

  const rows = items
    .map((m) => {
      return `
        <tr>
          <td class="fin-col-fecha">${escaparHtml(formatearFechaFinanzas(m.fecha_movimiento))}</td>
          <td>${escaparHtml(m.tipo_movimiento || "-")}</td>
          <td>${escaparHtml(m.concepto || "-")}</td>
          <td class="fin-col-monto">${formatoMoneda(m.monto)}</td>
          <td>${escaparHtml(m.estado || "-")}</td>
          <td>${escaparHtml(m.evento_nombre || "-")}</td>
        </tr>
      `;
    })
    .join("");

  cont.innerHTML = `
    <table class="tabla-estadistica tabla-estadistica-compacta">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Concepto</th>
          <th>Monto</th>
          <th>Estado</th>
          <th>Categoría</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function formatoMoneda(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "$0.00";
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatearFechaFinanzas(valor) {
  if (!valor) return "-";
  const texto = String(valor).trim();
  if (!texto) return "-";
  if (texto.includes("T")) return texto.split("T")[0];
  return texto.slice(0, 10);
}

function renderCargando(texto) {
  return `
    <div class="empty-state">
      <i class="fas fa-spinner fa-spin"></i>
      <p>${escaparHtml(texto)}</p>
    </div>
  `;
}

function renderVacio(texto) {
  return `
    <div class="empty-state">
      <i class="fas fa-circle-info"></i>
      <p>${escaparHtml(texto)}</p>
    </div>
  `;
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
