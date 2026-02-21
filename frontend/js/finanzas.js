let finanzasState = {
  campeonatos: [],
  eventos: [],
  equipos: [],
  ultimoRecibo: null,
  ultimoMovimientos: [],
  ultimoMorosidad: [],
  ultimoEstadoCuenta: null,
  esTecnico: false,
};

function obtenerNumeroSecuencial(valor, fallback = null) {
  const n = Number.parseInt(valor, 10);
  if (Number.isFinite(n) && n > 0) return n;
  const f = Number.parseInt(fallback, 10);
  if (Number.isFinite(f) && f > 0) return f;
  return null;
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("finanzas.html")) return;
  await inicializarFinanzas();
});

async function inicializarFinanzas() {
  finanzasState.esTecnico = !!window.Auth?.isTecnico?.();
  aplicarPermisosFinanzasUI();
  bindEventosFinanzas();
  inicializarTogglesReportes();
  await cargarCatalogosFinanzas();
  await Promise.all([
    buscarMovimientosFinanzas(),
    cargarMorosidadFinanzas(),
    cargarEstadoCuentaActual(),
  ]);
}

function aplicarPermisosFinanzasUI() {
  if (!finanzasState.esTecnico) return;

  const cardMovimiento = document.getElementById("fin-card-movimiento");
  if (cardMovimiento) cardMovimiento.style.display = "none";

  const cardMorosidad = document.querySelector(".fin-card-morosidad");
  if (cardMorosidad) cardMorosidad.style.display = "none";
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

  document
    .getElementById("btn-fin-recibo-ultimo")
    ?.addEventListener("click", () => emitirReciboMovimiento(finanzasState.ultimoRecibo, true));
  document
    .getElementById("btn-fin-imprimir-estado")
    ?.addEventListener("click", imprimirReporteEstadoCuenta);
  document
    .getElementById("btn-fin-imprimir-morosidad")
    ?.addEventListener("click", imprimirReporteMorosidad);
  document
    .getElementById("btn-fin-imprimir-movimientos")
    ?.addEventListener("click", imprimirReporteMovimientos);
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
    if (finanzasState.esTecnico && finanzasState.equipos.length > 0) {
      const campeonatoUnico = Number(finanzasState.equipos[0].campeonato_id || 0);
      if (Number.isFinite(campeonatoUnico) && campeonatoUnico > 0) {
        const filtroCamp = document.getElementById("fin-campeonato");
        const movCamp = document.getElementById("mov-campeonato");
        if (filtroCamp) {
          filtroCamp.value = String(campeonatoUnico);
          filtroCamp.disabled = true;
        }
        if (movCamp) {
          movCamp.value = String(campeonatoUnico);
          movCamp.disabled = true;
        }
      }
    }
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
    op.textContent = c.nombre || "Campeonato";
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
    op.textContent = e.nombre || "Categoría";
    eventoSelect.appendChild(op);
  });

  equipoSelect.innerHTML = '<option value="">Todos</option>';
  equiposFiltrados.forEach((e) => {
    const op = document.createElement("option");
    op.value = String(e.id);
    op.textContent = e.nombre || "Equipo";
    equipoSelect.appendChild(op);
  });

  if ([...eventoSelect.options].some((x) => x.value === prevEvento)) {
    eventoSelect.value = prevEvento;
  }
  if ([...equipoSelect.options].some((x) => x.value === prevEquipo)) {
    equipoSelect.value = prevEquipo;
  }

  if (finanzasState.esTecnico) {
    const equipoOpciones = [...equipoSelect.options].filter((x) => x.value);
    if (equipoOpciones.length === 1) {
      equipoSelect.value = equipoOpciones[0].value;
    }
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
    op.textContent = e.nombre || "Categoría";
    eventoSelect.appendChild(op);
  });

  equipoSelect.innerHTML = '<option value="">Selecciona equipo</option>';
  equiposFiltrados.forEach((e) => {
    const op = document.createElement("option");
    op.value = String(e.id);
    op.textContent = e.nombre || "Equipo";
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
    const movimientos = resp.movimientos || [];
    finanzasState.ultimoMovimientos = movimientos;
    renderTablaMovimientos(movimientos);
  } catch (error) {
    console.error(error);
    finanzasState.ultimoMovimientos = [];
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
    const equipos = resp.equipos || [];
    finanzasState.ultimoMorosidad = equipos;
    renderMorosidad(equipos);
  } catch (error) {
    console.error(error);
    finanzasState.ultimoMorosidad = [];
    if (cont) cont.innerHTML = renderVacio(error.message || "No se pudo calcular morosidad");
  }
}

function clasificarMovimientoCuenta(mov = {}) {
  const concepto = String(mov.concepto || "").toLowerCase();
  const descripcion = String(mov.descripcion || "").toLowerCase();
  const origenClave = String(mov.origen_clave || "").toLowerCase();
  const combinado = `${concepto} ${descripcion} ${origenClave}`;

  if (concepto === "inscripcion" || combinado.includes("inscripcion")) return "inscripcion";
  if (concepto === "arbitraje" || combinado.includes("arbitraje")) return "arbitraje";
  if (combinado.includes("amarilla") || origenClave.includes(":ta:")) return "ta";
  if (combinado.includes("roja") || origenClave.includes(":tr:")) return "tr";
  return null;
}

function calcularResumenCuentaPorConcepto(movimientos = []) {
  const base = () => ({ cargo: 0, abono: 0, saldo: 0 });
  const resumen = {
    inscripcion: base(),
    arbitraje: base(),
    ta: base(),
    tr: base(),
  };

  movimientos.forEach((mov) => {
    if (String(mov.estado || "").toLowerCase() === "anulado") return;
    const bucket = clasificarMovimientoCuenta(mov);
    if (!bucket || !resumen[bucket]) return;

    const monto = Number.parseFloat(mov.monto || 0);
    if (!Number.isFinite(monto) || monto <= 0) return;

    if (String(mov.tipo_movimiento || "").toLowerCase() === "abono") {
      resumen[bucket].abono += monto;
    } else {
      resumen[bucket].cargo += monto;
    }
  });

  Object.keys(resumen).forEach((k) => {
    const item = resumen[k];
    item.cargo = Number(item.cargo.toFixed(2));
    item.abono = Number(item.abono.toFixed(2));
    item.saldo = Number(Math.max(item.cargo - item.abono, 0).toFixed(2));
  });

  return resumen;
}

async function cargarEstadoCuentaActual() {
  const equipoId = document.getElementById("fin-equipo")?.value || "";
  const resumen = document.getElementById("fin-estado-cuenta-resumen");
  const movimientos = document.getElementById("fin-estado-cuenta-movimientos");

  if (!equipoId) {
    finanzasState.ultimoEstadoCuenta = null;
    if (resumen) {
      resumen.className = "fin-resumen-vacio";
      resumen.textContent = "Selecciona un equipo para visualizar su estado de cuenta.";
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
    const resumenConceptos = calcularResumenCuentaPorConcepto(resp.movimientos || []);
    finanzasState.ultimoEstadoCuenta = {
      equipo: resp.equipo || null,
      resumen: r,
      movimientos: resp.movimientos || [],
    };

    if (resumen) {
      resumen.className = "fin-resumen-cuenta";
      resumen.innerHTML = `
        <div><strong>Equipo:</strong> ${escaparHtml(resp?.equipo?.nombre || "-")}</div>
        <div><strong>Cargo inscripción:</strong> ${formatoMoneda(resumenConceptos.inscripcion.cargo)}</div>
        <div><strong>Pago inscripción:</strong> ${formatoMoneda(resumenConceptos.inscripcion.abono)}</div>
        <div><strong>Saldo inscripción:</strong> <span class="${resumenConceptos.inscripcion.saldo > 0 ? "fin-saldo-deuda" : "fin-saldo-ok"}">${formatoMoneda(resumenConceptos.inscripcion.saldo)}</span></div>
        <div><strong>Pago arbitraje:</strong> ${formatoMoneda(resumenConceptos.arbitraje.abono)}</div>
        <div><strong>Saldo arbitraje:</strong> <span class="${resumenConceptos.arbitraje.saldo > 0 ? "fin-saldo-deuda" : "fin-saldo-ok"}">${formatoMoneda(resumenConceptos.arbitraje.saldo)}</span></div>
        <div><strong>Pago tarjetas amarillas:</strong> ${formatoMoneda(resumenConceptos.ta.abono)}</div>
        <div><strong>Saldo tarjetas amarillas:</strong> <span class="${resumenConceptos.ta.saldo > 0 ? "fin-saldo-deuda" : "fin-saldo-ok"}">${formatoMoneda(resumenConceptos.ta.saldo)}</span></div>
        <div><strong>Pago tarjetas rojas:</strong> ${formatoMoneda(resumenConceptos.tr.abono)}</div>
        <div><strong>Saldo tarjetas rojas:</strong> <span class="${resumenConceptos.tr.saldo > 0 ? "fin-saldo-deuda" : "fin-saldo-ok"}">${formatoMoneda(resumenConceptos.tr.saldo)}</span></div>
      `;
    }
    renderTablaEstadoCuenta(resp.movimientos || []);
  } catch (error) {
    console.error(error);
    finanzasState.ultimoEstadoCuenta = null;
    if (resumen) {
      resumen.className = "fin-resumen-vacio";
      resumen.textContent = error.message || "No se pudo cargar estado de cuenta";
    }
    if (movimientos) movimientos.innerHTML = "";
  }
}

async function guardarMovimientoFinanzas(e) {
  e.preventDefault();
  if (finanzasState.esTecnico) {
    mostrarNotificacion("No autorizado para registrar movimientos", "warning");
    return;
  }

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

  const contexto = capturarContextoFormularioMovimiento(payload);

  try {
    const resp = await FinanzasAPI.crearMovimiento(payload);
    const movimiento = resp?.movimiento || resp || {};

    finanzasState.ultimoRecibo = construirReciboMovimiento(movimiento, contexto);
    mostrarNotificacion("Movimiento registrado", "success");
    emitirReciboMovimiento(finanzasState.ultimoRecibo, true);

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

function capturarContextoFormularioMovimiento(payload) {
  const campeonatoId = Number.parseInt(payload.campeonato_id, 10);
  const campeonato = finanzasState.campeonatos.find(
    (c) => Number(c.id) === Number(campeonatoId)
  );
  const campeonatoNombre = obtenerTextoSeleccion("mov-campeonato", payload.campeonato_id);
  const eventoNombre = obtenerTextoSeleccion("mov-evento", "Sin categoría");
  const equipoNombre = obtenerTextoSeleccion("mov-equipo", payload.equipo_id);

  return {
    campeonato_id: Number.isFinite(campeonatoId) ? campeonatoId : null,
    campeonato_numero: obtenerNumeroSecuencial(campeonato?.numero_organizador),
    campeonato_nombre: campeonatoNombre,
    evento_nombre: payload.evento_id ? eventoNombre : "Sin categoría",
    equipo_nombre: equipoNombre,
  };
}

function construirReciboMovimiento(movimiento = {}, contexto = {}) {
  const id = Number(movimiento.id || 0);
  const numeroReciboSec = obtenerNumeroSecuencial(
    movimiento.numero_recibo_campeonato,
    movimiento.id
  );
  const numeroRecibo = generarNumeroRecibo(numeroReciboSec, contexto.campeonato_numero);

  return {
    numero_recibo: numeroRecibo,
    id,
    fecha_emision: new Date().toISOString(),
    fecha_movimiento: movimiento.fecha_movimiento || new Date().toISOString().slice(0, 10),
    campeonato_id: contexto.campeonato_id || null,
    campeonato_nombre: contexto.campeonato_nombre || "-",
    evento_nombre: contexto.evento_nombre || "Sin categoría",
    equipo_nombre: contexto.equipo_nombre || "-",
    tipo_movimiento: movimiento.tipo_movimiento || "-",
    concepto: movimiento.concepto || "-",
    estado: movimiento.estado || "-",
    monto: movimiento.monto,
    metodo_pago: movimiento.metodo_pago || "-",
    referencia: movimiento.referencia || "-",
    descripcion: movimiento.descripcion || "-",
  };
}

function obtenerCampeonatoPorId(campeonatoId) {
  const id = Number.parseInt(campeonatoId, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return finanzasState.campeonatos.find((c) => Number(c.id) === id) || null;
}

function normalizarLogoReporte(url) {
  if (!url) return "";
  const texto = String(url).trim();
  if (!texto) return "";
  if (/^https?:\/\//i.test(texto)) return texto;
  const base = (window.API_BASE_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");
  return texto.startsWith("/") ? `${base}${texto}` : `${base}/${texto}`;
}

async function cargarAuspiciantesActivosReporte(campeonatoId) {
  const id = Number.parseInt(campeonatoId, 10);
  if (!Number.isFinite(id) || id <= 0) return [];
  try {
    const data = await AuspiciantesAPI.listarPorCampeonato(id, true);
    return Array.isArray(data?.auspiciantes) ? data.auspiciantes : [];
  } catch (error) {
    console.warn("No se pudieron cargar auspiciantes para reporte:", error);
    return [];
  }
}

function renderMembreteReporte(campeonato, fallbackTitulo = "") {
  const nombre = campeonato?.nombre || fallbackTitulo || "Campeonato";
  const organizador = campeonato?.organizador || "";
  const logo = normalizarLogoReporte(campeonato?.logo_url || "");

  return `
    <div class="fin-membrete">
      <div class="fin-membrete-left">
        ${
          logo
            ? `<img src="${escaparHtml(logo)}" alt="Logo campeonato" class="fin-membrete-logo" />`
            : `<div class="fin-membrete-logo-fallback">SGD</div>`
        }
      </div>
      <div class="fin-membrete-center">
        ${organizador ? `<div class="fin-membrete-org">${escaparHtml(organizador)}</div>` : ""}
        <div class="fin-membrete-camp">${escaparHtml(nombre)}</div>
      </div>
    </div>
  `;
}

function renderPieAuspiciantes(auspiciantes = []) {
  if (!Array.isArray(auspiciantes) || !auspiciantes.length) return "";
  const logos = auspiciantes
    .map((a) => {
      const nombre = escaparHtml(a?.nombre || "Auspiciante");
      const logo = normalizarLogoReporte(a?.logo_url || "");
      return `
        <div class="fin-sponsor-item">
          ${
            logo
              ? `<img src="${escaparHtml(logo)}" alt="${nombre}" class="fin-sponsor-logo" />`
              : `<span class="fin-sponsor-name">${nombre}</span>`
          }
        </div>
      `;
    })
    .join("");

  return `
    <div class="fin-sponsors">
      <div class="fin-sponsors-title">Auspician</div>
      <div class="fin-sponsors-grid">${logos}</div>
    </div>
  `;
}

async function emitirReciboMovimiento(recibo, autoPrint = true) {
  if (!recibo) {
    mostrarNotificacion("No hay recibo reciente para imprimir", "warning");
    return;
  }

  const campeonato = obtenerCampeonatoPorId(recibo.campeonato_id);
  const auspiciantes = await cargarAuspiciantesActivosReporte(recibo.campeonato_id);

  const html = `
    <div class="fin-report-wrap fin-report-wrap-recibo">
      <div class="fin-report-header">
        <h1>Recibo de Pago</h1>
      </div>
      <div class="fin-report-meta">
        <div><strong>N° recibo:</strong> ${escaparHtml(recibo.numero_recibo)}</div>
        <div><strong>Fecha emisión:</strong> ${escaparHtml(formatearFechaHoraReporte(recibo.fecha_emision))}</div>
      </div>
      <div class="fin-report-grid">
        <div><strong>Campeonato:</strong> ${escaparHtml(recibo.campeonato_nombre)}</div>
        <div><strong>Categoría:</strong> ${escaparHtml(recibo.evento_nombre || "Sin categoría")}</div>
        <div><strong>Equipo:</strong> ${escaparHtml(recibo.equipo_nombre)}</div>
        <div><strong>Fecha mov.:</strong> ${escaparHtml(formatearFechaFinanzas(recibo.fecha_movimiento))}</div>
        <div><strong>Tipo:</strong> ${escaparHtml(recibo.tipo_movimiento)}</div>
        <div><strong>Concepto:</strong> ${escaparHtml(recibo.concepto)}</div>
        <div><strong>Estado:</strong> ${escaparHtml(recibo.estado)}</div>
        <div><strong>Monto:</strong> <span class="fin-report-amount">${formatoMoneda(recibo.monto)}</span></div>
        <div><strong>Método pago:</strong> ${escaparHtml(recibo.metodo_pago || "-")}</div>
        <div><strong>Referencia:</strong> ${escaparHtml(recibo.referencia || "-")}</div>
      </div>
      <div class="fin-report-box">
        <strong>Descripción:</strong>
        <div>${escaparHtml(recibo.descripcion || "-")}</div>
      </div>
      <div class="fin-report-signatures">
        <div class="fin-sign">Firma responsable</div>
        <div class="fin-sign">Firma equipo</div>
      </div>
    </div>
    ${renderPieAuspiciantes(auspiciantes)}
  `;

  await abrirVentanaReporteFinanzas({
    membreteHtml: renderMembreteReporte(campeonato, recibo.campeonato_nombre),
    tituloVentana: "Recibo de Pago",
    cuerpoHtml: html,
    autoPrint,
  });
}
async function imprimirReporteEstadoCuenta() {
  const data = finanzasState.ultimoEstadoCuenta;
  if (!data?.equipo) {
    mostrarNotificacion("Selecciona un equipo para imprimir el estado de cuenta", "warning");
    return;
  }

  const campeonatoId = Number.parseInt(
    document.getElementById("fin-campeonato")?.value || "",
    10
  );
  const campeonato = obtenerCampeonatoPorId(campeonatoId);
  const auspiciantes = await cargarAuspiciantesActivosReporte(campeonatoId);

  const movimientos = data.movimientos || [];
  const resumenConceptos = calcularResumenCuentaPorConcepto(movimientos);
  const filas = movimientos
    .map((m) => {
      const tipo = String(m.tipo_movimiento || "").toLowerCase();
      const cargo = tipo === "cargo" ? formatoMoneda(m.monto) : "";
      const abono = tipo === "abono" ? formatoMoneda(m.monto) : "";
      return `
        <tr>
          <td>${escaparHtml(formatearFechaFinanzas(m.fecha_movimiento))}</td>
          <td>${escaparHtml(m.evento_nombre || "-")}</td>
          <td>${escaparHtml(m.concepto || "-")}</td>
          <td>${escaparHtml(m.descripcion || "-")}</td>
          <td class="num">${cargo}</td>
          <td class="num">${abono}</td>
          <td>${escaparHtml(m.estado || "-")}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <div class="fin-report-wrap">
      <div class="fin-report-header">
        <h1>Reporte Estado de Cuenta</h1>
        <div class="fin-report-sub">Equipo: ${escaparHtml(data.equipo.nombre || "-")}</div>
      </div>
      <div class="fin-report-grid">
        <div><strong>Cargo inscripción:</strong> ${formatoMoneda(resumenConceptos.inscripcion.cargo)}</div>
        <div><strong>Pago inscripción:</strong> ${formatoMoneda(resumenConceptos.inscripcion.abono)}</div>
        <div><strong>Saldo inscripción:</strong> <span class="${resumenConceptos.inscripcion.saldo > 0 ? "deuda" : "ok"}">${formatoMoneda(resumenConceptos.inscripcion.saldo)}</span></div>
        <div><strong>Pago arbitraje:</strong> ${formatoMoneda(resumenConceptos.arbitraje.abono)}</div>
        <div><strong>Saldo arbitraje:</strong> <span class="${resumenConceptos.arbitraje.saldo > 0 ? "deuda" : "ok"}">${formatoMoneda(resumenConceptos.arbitraje.saldo)}</span></div>
        <div><strong>Pago tarjetas amarillas:</strong> ${formatoMoneda(resumenConceptos.ta.abono)}</div>
        <div><strong>Saldo tarjetas amarillas:</strong> <span class="${resumenConceptos.ta.saldo > 0 ? "deuda" : "ok"}">${formatoMoneda(resumenConceptos.ta.saldo)}</span></div>
        <div><strong>Pago tarjetas rojas:</strong> ${formatoMoneda(resumenConceptos.tr.abono)}</div>
        <div><strong>Saldo tarjetas rojas:</strong> <span class="${resumenConceptos.tr.saldo > 0 ? "deuda" : "ok"}">${formatoMoneda(resumenConceptos.tr.saldo)}</span></div>
      </div>
      <table class="fin-report-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Categoría</th>
            <th>Concepto</th>
            <th>Descripción</th>
            <th class="num">Cargo</th>
            <th class="num">Abono</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${filas || `<tr><td colspan="7" class="fin-report-empty">Sin movimientos.</td></tr>`}
        </tbody>
      </table>
    </div>
    ${renderPieAuspiciantes(auspiciantes)}
  `;

  await abrirVentanaReporteFinanzas({
    membreteHtml: renderMembreteReporte(campeonato, "Estado de Cuenta"),
    tituloVentana: "Estado de Cuenta",
    cuerpoHtml: html,
    autoPrint: true,
  });
}

async function imprimirReporteMorosidad() {
  const equipos = finanzasState.ultimoMorosidad || [];
  if (!equipos.length) {
    mostrarNotificacion("No hay datos de morosidad para imprimir", "warning");
    return;
  }

  const campeonatoId = Number.parseInt(
    document.getElementById("fin-campeonato")?.value || "",
    10
  );
  const campeonato = obtenerCampeonatoPorId(campeonatoId);
  const auspiciantes = await cargarAuspiciantesActivosReporte(campeonatoId);

  const filas = equipos
    .map((x, idx) => {
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escaparHtml(x.equipo_nombre || "-")}</td>
          <td>${escaparHtml(x.campeonato_nombre || "-")}</td>
          <td class="num">${formatoMoneda(x.total_cargos)}</td>
          <td class="num">${formatoMoneda(x.total_abonos)}</td>
          <td class="num ${Number(x.saldo || 0) > 0 ? "deuda" : "ok"}">${formatoMoneda(x.saldo)}</td>
          <td class="num">${formatoMoneda(x.saldo_vencido)}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <div class="fin-report-wrap">
      <div class="fin-report-header">
        <h1>Reporte de Morosidad</h1>
        <div class="fin-report-sub">Corte: ${escaparHtml(formatearFechaHoraReporte(new Date().toISOString()))}</div>
      </div>
      <table class="fin-report-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Equipo</th>
            <th>Campeonato</th>
            <th class="num">Cargos</th>
            <th class="num">Abonos</th>
            <th class="num">Saldo</th>
            <th class="num">Vencido</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    ${renderPieAuspiciantes(auspiciantes)}
  `;

  await abrirVentanaReporteFinanzas({
    membreteHtml: renderMembreteReporte(campeonato, "Morosidad por Equipo"),
    tituloVentana: "Morosidad por Equipo",
    cuerpoHtml: html,
    autoPrint: true,
  });
}

async function imprimirReporteMovimientos() {
  const movimientos = finanzasState.ultimoMovimientos || [];
  if (!movimientos.length) {
    mostrarNotificacion("No hay movimientos para imprimir con los filtros actuales", "warning");
    return;
  }

  const campeonatoId = Number.parseInt(
    document.getElementById("fin-campeonato")?.value || "",
    10
  );
  const campeonato = obtenerCampeonatoPorId(campeonatoId);
  const auspiciantes = await cargarAuspiciantesActivosReporte(campeonatoId);

  const filas = movimientos
    .map((m) => {
      return `
        <tr>
          <td>${escaparHtml(formatearFechaFinanzas(m.fecha_movimiento))}</td>
          <td>${escaparHtml(m.campeonato_nombre || "-")}</td>
          <td>${escaparHtml(m.evento_nombre || "-")}</td>
          <td>${escaparHtml(m.equipo_nombre || "-")}</td>
          <td>${escaparHtml(m.tipo_movimiento || "-")}</td>
          <td>${escaparHtml(m.concepto || "-")}</td>
          <td class="num">${formatoMoneda(m.monto)}</td>
          <td>${escaparHtml(m.estado || "-")}</td>
          <td>${escaparHtml(m.descripcion || "-")}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <div class="fin-report-wrap">
      <div class="fin-report-header">
        <h1>Reporte de Movimientos</h1>
        <div class="fin-report-sub">Total registros: ${movimientos.length}</div>
      </div>
      <table class="fin-report-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Campeonato</th>
            <th>Categoría</th>
            <th>Equipo</th>
            <th>Tipo</th>
            <th>Concepto</th>
            <th class="num">Monto</th>
            <th>Estado</th>
            <th>Descripción</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    ${renderPieAuspiciantes(auspiciantes)}
  `;

  await abrirVentanaReporteFinanzas({
    membreteHtml: renderMembreteReporte(campeonato, "Movimientos Financieros"),
    tituloVentana: "Movimientos Financieros",
    cuerpoHtml: html,
    autoPrint: true,
  });
}

function abrirVentanaReporteFinanzas({
  membreteHtml = "",
  tituloVentana = "Reporte",
  cuerpoHtml,
  autoPrint = true,
}) {
  const w = window.open("", "_blank", "width=1100,height=900");
  if (!w) {
    mostrarNotificacion("El navegador bloqueó la ventana del reporte. Habilita popups.", "warning");
    return;
  }

  const css = `
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 16px;
        font-family: "Segoe UI", Arial, sans-serif;
        color: #0f172a;
        background: #ffffff;
      }
      .fin-doc {
        max-width: 980px;
        margin: 0 auto;
      }
      .fin-membrete {
        border: 1px solid #d1dae8;
        border-radius: 8px;
        padding: 8px 10px;
        margin-bottom: 12px;
        display: grid;
        grid-template-columns: 74px 1fr;
        align-items: center;
        gap: 10px;
      }
      .fin-membrete-left {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .fin-membrete-logo,
      .fin-membrete-logo-fallback {
        width: 62px;
        height: 62px;
        border-radius: 8px;
        object-fit: contain;
        border: 1px solid #d1dae8;
        background: #fff;
      }
      .fin-membrete-logo-fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        color: #334155;
      }
      .fin-membrete-center {
        text-align: center;
      }
      .fin-membrete-org {
        font-size: 0.95rem;
        font-weight: 700;
        color: #0f172a;
      }
      .fin-membrete-camp {
        font-size: 1.12rem;
        font-weight: 900;
        color: #0f172a;
      }
      .fin-report-wrap {
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 12px;
      }
      .fin-report-wrap-recibo {
        max-width: 760px;
        margin: 0 auto;
      }
      .fin-report-header {
        margin-bottom: 10px;
        text-align: center;
      }
      .fin-report-header h1 {
        margin: 0;
        font-size: 1.12rem;
      }
      .fin-report-sub {
        margin-top: 4px;
        color: #334155;
        font-size: 0.9rem;
      }
      .fin-report-meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 10px;
      }
      .fin-report-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px 14px;
        margin-bottom: 10px;
      }
      .fin-report-box {
        border: 1px solid #dbe4ef;
        border-radius: 6px;
        padding: 8px;
        margin-bottom: 14px;
      }
      .fin-report-amount {
        font-weight: 800;
        font-size: 1.05rem;
      }
      .fin-report-signatures {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 22px;
        margin-top: 28px;
      }
      .fin-sign {
        border-top: 1px solid #334155;
        padding-top: 6px;
        text-align: center;
        min-height: 54px;
        font-size: 0.9rem;
      }
      .fin-report-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.84rem;
      }
      .fin-report-table th,
      .fin-report-table td {
        border: 1px solid #cbd5e1;
        padding: 5px 6px;
        text-align: left;
        vertical-align: top;
      }
      .fin-report-table th {
        background: #eef4fb;
      }
      .fin-report-table td.num,
      .fin-report-table th.num {
        text-align: right;
        white-space: nowrap;
      }
      .fin-report-empty {
        text-align: center;
        color: #64748b;
      }
      .fin-sponsors {
        margin-top: 10px;
        border: 1px solid #d1dae8;
        border-radius: 8px;
        padding: 8px;
      }
      .fin-sponsors-title {
        text-transform: uppercase;
        text-align: center;
        font-size: 0.75rem;
        font-weight: 800;
        color: #334155;
        margin-bottom: 6px;
      }
      .fin-sponsors-grid {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 2px;
      }
      .fin-sponsor-item {
        flex: 0 1 90px;
        width: 90px;
        min-height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2px;
      }
      .fin-sponsor-logo {
        width: 100%;
        max-width: 84px;
        max-height: 32px;
        object-fit: contain;
      }
      .fin-sponsor-name {
        font-size: 0.68rem;
        text-align: center;
        font-weight: 700;
        line-height: 1.05;
      }
      .ok { color: #15803d; font-weight: 700; }
      .deuda { color: #b91c1c; font-weight: 700; }
      @media print {
        body { padding: 0; }
        .fin-doc { max-width: 100%; }
      }
    </style>
  `;

  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escaparHtml(tituloVentana)}</title>
        ${css}
      </head>
      <body>
        <div class="fin-doc">
          ${membreteHtml || ""}
          ${cuerpoHtml}
        </div>
      </body>
    </html>
  `;

  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();

  if (autoPrint) {
    setTimeout(() => w.print(), 300);
  }
}

function obtenerTextoSeleccion(id, fallback = "-") {
  const select = document.getElementById(id);
  if (!select) return fallback;
  const opt = select.options?.[select.selectedIndex];
  const texto = opt?.textContent?.trim();
  return texto || fallback;
}

function generarNumeroRecibo(id, campeonatoNumero = null) {
  const consecutivo = String(Number(id) || 0).padStart(6, "0");
  if (!Number.isFinite(Number(id)) || Number(id) <= 0) return "REC-000000";
  const campNum = obtenerNumeroSecuencial(campeonatoNumero);
  if (campNum) {
    return `REC-C${String(campNum).padStart(3, "0")}-${consecutivo}`;
  }
  return `REC-${consecutivo}`;
}

function formatearFechaHoraReporte(valor) {
  if (!valor) return "-";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  return d.toLocaleString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
          <th>Descripción</th>
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
