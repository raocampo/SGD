// frontend/js/eventos.js

let campeonatoSeleccionado = null;
let eventosCache = [];
let campeonatosEventosCache = [];
let vistaEventos = localStorage.getItem("sgd_vista_eventos") || "cards";
vistaEventos = vistaEventos === "table" ? "table" : "cards";
const formatoMoneda = new Intl.NumberFormat("es-EC", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizarCostoInscripcion(valor, fallback = null) {
  if (valor === null || valor === undefined || valor === "") return fallback;
  const numero = Number.parseFloat(String(valor).replace(",", "."));
  if (!Number.isFinite(numero) || numero < 0) return fallback;
  return Number(numero.toFixed(2));
}

function formatearCostoInscripcion(valor) {
  const numero = Number.parseFloat(valor);
  if (!Number.isFinite(numero)) return "$0.00";
  return `$${formatoMoneda.format(numero)}`;
}

function formatearFechaSolo(valor) {
  if (!valor) return "-";
  const texto = String(valor).trim();
  if (!texto) return "-";
  if (texto.includes("T")) return texto.split("T")[0];
  return texto.slice(0, 10);
}

function formatearMetodoCompetencia(valor) {
  const key = String(valor || "grupos").toLowerCase();
  if (key === "liga") return "Liga";
  if (key === "eliminatoria") return "Eliminatoria";
  if (key === "mixto") return "Mixto";
  if (key === "tabla_acumulada") return "Tabla acumulada";
  return "Grupos";
}

function formatearPlantillaPlayoff(valor) {
  const key = String(valor || "estandar").toLowerCase();
  if (key === "balanceada_8vos") return "Evitar reencuentros tempranos de grupo (balanceada)";
  if (key === "mejores_perdedores_12vos") return "Mejores perdedores (24 -> 12vos -> 8vos)";
  return "Estándar";
}

function esTablaAcumuladaEvento(evento = null) {
  if (!evento) return false;
  if (typeof evento === "string") return String(evento).toLowerCase() === "tabla_acumulada";
  return evento?.clasificacion_tabla_acumulada === true;
}

function obtenerMetodoCompetenciaVisibleEvento(evento = {}) {
  if (esTablaAcumuladaEvento(evento)) return "tabla_acumulada";
  return normalizarMetodoCompetencia(evento?.metodo_competencia) || "grupos";
}

function normalizarClasificadosPorGrupo(valor, fallback = null) {
  if (valor === null || valor === undefined || valor === "") return fallback;
  const n = Number.parseInt(valor, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function normalizarColorHexEvento(valor, fallback = "") {
  const raw = String(valor || "").trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
    if (raw.length === 4) {
      return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toUpperCase();
    }
    return raw.toUpperCase();
  }
  return fallback;
}

function obtenerColoresCarnetCampeonatoSeleccionado() {
  const camp = campeonatosEventosCache.find((item) => Number(item.id) === Number(campeonatoSeleccionado));
  return {
    primario: normalizarColorHexEvento(camp?.color_primario, "#FACC15"),
    secundario: normalizarColorHexEvento(camp?.color_secundario, "#111827"),
    acento: normalizarColorHexEvento(camp?.color_acento, "#22C55E"),
  };
}

function formatearCarnetEstilo(valor) {
  const key = String(valor || "").toLowerCase();
  if (key === "franja") return "Franja diagonal";
  if (key === "marco") return "Marco deportivo";
  if (key === "minimal") return "Minimal";
  if (key === "clasico") return "Clásico";
  return "Hereda campeonato";
}

function formatearCategoriaJuvenil(valor) {
  return valor === true || String(valor).toLowerCase() === "true" ? "Si" : "No";
}

function inferirEdadBaseCategoria(nombreEvento) {
  const raw = String(nombreEvento || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!raw) return null;
  const match = raw.match(/\b(?:sub|u)\s*\+?\s*(3\d|4\d|50|51|52|53|54|55|56|57|58|59|60)\b/);
  if (!match) return null;
  const edad = Number.parseInt(match[1], 10);
  return Number.isFinite(edad) && edad >= 30 && edad <= 60 ? edad : null;
}

function normalizarCuposJuvenilEvento(valor, fallback = 0) {
  if (valor === null || valor === undefined || valor === "") return fallback;
  const numero = Number.parseInt(valor, 10);
  if (!Number.isFinite(numero) || numero < 0) return fallback;
  return numero;
}

function normalizarDiferenciaJuvenilEvento(valor, fallback = 1) {
  if (valor === null || valor === undefined || valor === "") return fallback;
  const numero = Number.parseInt(valor, 10);
  if (![1, 2].includes(numero)) return fallback;
  return numero;
}

function formatearConfiguracionJuvenil(evento = {}) {
  const activo = evento?.categoria_juvenil === true || String(evento?.categoria_juvenil).toLowerCase() === "true";
  if (!activo) return "No";
  const cupos = normalizarCuposJuvenilEvento(evento?.categoria_juvenil_cupos, 0);
  const diferencia = normalizarDiferenciaJuvenilEvento(evento?.categoria_juvenil_max_diferencia, 1);
  return `Sí • ${cupos || 0} cupo${cupos === 1 ? "" : "s"} • hasta ${diferencia} año${diferencia === 1 ? "" : "s"} menor`;
}

function actualizarVisibilidadConfigJuvenil() {
  const inputNombre = document.getElementById("evt-nombre");
  const selectJuvenil = document.getElementById("evt-categoria-juvenil");
  const wrapCupos = document.getElementById("evt-wrap-categoria-juvenil-cupos");
  const wrapDif = document.getElementById("evt-wrap-categoria-juvenil-diferencia");
  const hint = document.getElementById("evt-categoria-juvenil-hint");
  const edadBase = inferirEdadBaseCategoria(inputNombre?.value || "");
  const esCategoriaEtaria = Number.isFinite(edadBase);
  const juvenilActivo = selectJuvenil?.value === "true";

  if (wrapCupos) wrapCupos.style.display = esCategoriaEtaria && juvenilActivo ? "" : "none";
  if (wrapDif) wrapDif.style.display = esCategoriaEtaria && juvenilActivo ? "" : "none";

  if (hint) {
    if (esCategoriaEtaria) {
      hint.textContent = `Categoría ${edadBase}+: puedes habilitar juveniles de hasta 1 o 2 años menores y definir cuántos cupos admite el equipo.`;
    } else {
      hint.textContent = "Disponible solo para categorías Sub 30 a Sub 60 detectadas por el nombre.";
    }
  }

  if (!esCategoriaEtaria && selectJuvenil) {
    selectJuvenil.value = "false";
  }
}

function formatearClasificadosPorGrupo(evento = {}) {
  const metodo = obtenerMetodoCompetenciaVisibleEvento(evento);
  if (!["grupos", "mixto", "tabla_acumulada"].includes(metodo)) return "No aplica";
  const n = normalizarClasificadosPorGrupo(evento?.clasificados_por_grupo, 2);
  return `${n || 2}`;
}

function formatearBloqueoMorososEvento(evento = {}) {
  const valor = evento?.bloquear_morosos;
  if (valor === null || valor === undefined || valor === "") return "Hereda";
  const activo = valor === true || String(valor).toLowerCase() === "true";
  const monto = normalizarCostoInscripcion(evento?.bloqueo_morosidad_monto, null);
  if (!activo) return "Desactivado";
  if (monto === null) return "Activo";
  return `Activo (> ${formatearCostoInscripcion(monto)})`;
}

function normalizarMetodoCompetencia(valor) {
  const key = String(valor || "").toLowerCase();
  if (["grupos", "liga", "eliminatoria", "mixto", "tabla_acumulada"].includes(key)) return key;
  return null;
}

function actualizarVisibilidadConfigEliminatoria() {
  const metodo = document.getElementById("evt-metodo-competencia")?.value || "grupos";
  const wrap = document.getElementById("evt-wrap-eliminatoria-equipos");
  const wrapClasificados = document.getElementById("evt-wrap-clasificados-por-grupo");
  const wrapPlantilla = document.getElementById("evt-wrap-playoff-plantilla");
  const wrapTercer = document.getElementById("evt-wrap-playoff-tercer-puesto");
  if (!wrap) return;
  wrap.style.display = ["eliminatoria", "mixto", "tabla_acumulada"].includes(metodo) ? "" : "none";
  if (wrapClasificados) {
    wrapClasificados.style.display = ["grupos", "mixto", "tabla_acumulada"].includes(metodo) ? "" : "none";
  }
  if (wrapPlantilla) {
    wrapPlantilla.style.display = ["grupos", "eliminatoria", "mixto", "tabla_acumulada"].includes(metodo) ? "" : "none";
  }
  if (wrapTercer) {
    wrapTercer.style.display = ["grupos", "eliminatoria", "mixto", "tabla_acumulada"].includes(metodo) ? "" : "none";
  }
  actualizarVisibilidadConfigJuvenil();
}

function toggleFormularioCategoria(forzarEstado) {
  const bloque = document.getElementById("bloque-crear-evento");
  if (!bloque) return;
  const visibleActual = bloque.style.display !== "none";
  const mostrar = typeof forzarEstado === "boolean" ? forzarEstado : !visibleActual;
  bloque.style.display = mostrar ? "" : "none";
}

function obtenerNumeroEventoVisible(evento, fallback = null) {
  const n = Number.parseInt(evento?.numero_campeonato, 10);
  if (Number.isFinite(n) && n > 0) return n;
  if (Number.isFinite(Number(fallback)) && Number(fallback) > 0) return Number(fallback);
  return null;
}

function aplicarFechasDesdeCampeonato() {
  const inicio = document.getElementById("evt-fecha-inicio");
  const fin = document.getElementById("evt-fecha-fin");
  if (!inicio || !fin) return;

  const camp = campeonatosEventosCache.find(
    (x) => Number(x.id) === Number(campeonatoSeleccionado)
  );
  if (!camp) {
    inicio.value = "";
    fin.value = "";
    return;
  }

  const fechaInicio = formatearFechaSolo(camp.fecha_inicio);
  const fechaFin = formatearFechaSolo(camp.fecha_fin);
  inicio.value = fechaInicio === "-" ? "" : fechaInicio;
  fin.value = fechaFin === "-" ? "" : fechaFin;
  const colores = obtenerColoresCarnetCampeonatoSeleccionado();
  const colorPrimario = document.getElementById("evt-carnet-color-primario");
  const colorSecundario = document.getElementById("evt-carnet-color-secundario");
  const colorAcento = document.getElementById("evt-carnet-color-acento");
  if (colorPrimario) colorPrimario.value = colores.primario;
  if (colorSecundario) colorSecundario.value = colores.secundario;
  if (colorAcento) colorAcento.value = colores.acento;
}

function actualizarBotonesVistaEventos() {
  const btnCards = document.getElementById("btn-vista-eventos-cards");
  const btnTable = document.getElementById("btn-vista-eventos-table");
  if (btnCards) btnCards.classList.toggle("active", vistaEventos === "cards");
  if (btnTable) btnTable.classList.toggle("active", vistaEventos === "table");
}

function cambiarVistaEventos(vista = "cards") {
  vistaEventos = vista === "table" ? "table" : "cards";
  localStorage.setItem("sgd_vista_eventos", vistaEventos);
  actualizarBotonesVistaEventos();
  renderListadoEventos();
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("eventos.html")) return;
  actualizarBotonesVistaEventos();
  actualizarVisibilidadConfigEliminatoria();
  toggleFormularioCategoria(false);

  const selectMetodo = document.getElementById("evt-metodo-competencia");
  const inputNombreEvento = document.getElementById("evt-nombre");
  const selectCategoriaJuvenil = document.getElementById("evt-categoria-juvenil");
  if (selectMetodo) {
    selectMetodo.addEventListener("change", actualizarVisibilidadConfigEliminatoria);
  }
  inputNombreEvento?.addEventListener("input", actualizarVisibilidadConfigJuvenil);
  selectCategoriaJuvenil?.addEventListener("change", actualizarVisibilidadConfigJuvenil);

  await cargarCampeonatosSelect();

  const routeContext = window.RouteContext?.read?.("eventos.html", ["campeonato"]) || {};
  const cId = routeContext.campeonato;
  if (cId) {
    campeonatoSeleccionado = parseInt(cId, 10);
    const sel = document.getElementById("select-campeonato");
    sel.value = String(campeonatoSeleccionado);
    window.RouteContext?.save?.("eventos.html", { campeonato: campeonatoSeleccionado });
    aplicarFechasDesdeCampeonato();
    await cargarEventos();
    return;
  }

  if (campeonatoSeleccionado) {
    aplicarFechasDesdeCampeonato();
    actualizarVisibilidadConfigJuvenil();
    await cargarEventos();
  }
});

async function cargarCampeonatosSelect() {
  const select = document.getElementById("select-campeonato");
  select.innerHTML = `<option value="">— Selecciona un campeonato —</option>`;

  try {
    const data = await CampeonatosAPI.obtenerTodos();
    const lista = Array.isArray(data) ? data : (data.campeonatos || data.data || []);
    campeonatosEventosCache = lista;

    lista.forEach((c) => {
      select.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });

    if (!campeonatoSeleccionado && lista.length) {
      const ultimo = [...lista]
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))[0];
      if (ultimo?.id) {
      campeonatoSeleccionado = Number.parseInt(ultimo.id, 10);
      select.value = String(campeonatoSeleccionado);
      window.RouteContext?.save?.("eventos.html", { campeonato: campeonatoSeleccionado });
    }
  }

  select.onchange = async () => {
    campeonatoSeleccionado = select.value ? parseInt(select.value, 10) : null;
    window.RouteContext?.save?.("eventos.html", { campeonato: campeonatoSeleccionado });
    aplicarFechasDesdeCampeonato();
    eventosCache = [];
    document.getElementById("lista-eventos").innerHTML = "";
      if (campeonatoSeleccionado) {
        await cargarEventos();
      }
    };
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error cargando campeonatos", "error");
  }
}

// botón "Cargar categorías" (también usado al cambiar campeonato)
async function cargarEventos() {
  const cont = document.getElementById("lista-eventos");
  cont.innerHTML = "<p>Cargando categorías...</p>";

  const select = document.getElementById("select-campeonato");
  campeonatoSeleccionado = select.value ? parseInt(select.value, 10) : null;

  if (!campeonatoSeleccionado) {
    eventosCache = [];
    cont.innerHTML = "";
    mostrarNotificacion("Selecciona un campeonato", "warning");
    return;
  }

  try {
    const resp = await EventosAPI.obtenerPorCampeonato(campeonatoSeleccionado);
    const eventos = Array.isArray(resp) ? resp : (resp.eventos || resp.data || []);
    eventosCache = eventos;
    renderListadoEventos();
  } catch (err) {
    console.error(err);
    eventosCache = [];
    cont.innerHTML = "";
    mostrarNotificacion("Error cargando categorías", "error");
  }
}

function renderListadoEventos() {
  const cont = document.getElementById("lista-eventos");
  if (!cont) return;

  if (!eventosCache.length) {
    cont.classList.remove("list-mode-table");
    cont.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-layer-group"></i>
        <p>No hay categorías creadas en este campeonato.</p>
      </div>`;
    return;
  }

  if (vistaEventos === "table") {
    cont.classList.add("list-mode-table");
    cont.innerHTML = renderTablaEventos(eventosCache);
    return;
  }

  cont.classList.remove("list-mode-table");
  cont.innerHTML = eventosCache.map(renderEventoCard).join("");
}

function renderEventoCard(e) {
  const numero = obtenerNumeroEventoVisible(e);
  return `
    <div class="campeonato-card">
      <div class="campeonato-header">
        <h3>${numero ? `${numero} - ` : ""}${escapeHtml(e.nombre || "Categoría")}</h3>
      </div>
      <div class="campeonato-info">
        <p><strong>Modalidad:</strong> ${escapeHtml(e.modalidad || "-")}</p>
        <p><strong>Método:</strong> ${escapeHtml(formatearMetodoCompetencia(obtenerMetodoCompetenciaVisibleEvento(e)))}</p>
        <p><strong>Clasifican/grupo:</strong> ${escapeHtml(formatearClasificadosPorGrupo(e))}</p>
        <p><strong>Llave elim.:</strong> ${escapeHtml(e.eliminatoria_equipos || "Automática")}</p>
        <p><strong>Armado playoff:</strong> ${escapeHtml(formatearPlantillaPlayoff(e.playoff_plantilla))}</p>
        <p><strong>Tercer puesto:</strong> ${e.playoff_tercer_puesto === true ? "Sí" : "No"}</p>
        <p><strong>Costo inscripción:</strong> ${escapeHtml(formatearCostoInscripcion(e.costo_inscripcion))}</p>
        <p><strong>Bloqueo morosos:</strong> ${escapeHtml(formatearBloqueoMorososEvento(e))}</p>
        <p><strong>Diseño carné:</strong> ${escapeHtml(formatearCarnetEstilo(e.carnet_estilo))}</p>
        <p><strong>Categoría juvenil:</strong> ${escapeHtml(formatearConfiguracionJuvenil(e))}</p>
        <p><strong>Carné muestra edad:</strong> ${e.carnet_mostrar_edad === true ? "Sí" : "No"}</p>
        <p><strong>Fechas:</strong> ${escapeHtml(formatearFechaSolo(e.fecha_inicio))} - ${escapeHtml(formatearFechaSolo(e.fecha_fin))}</p>
      </div>
      <div class="campeonato-actions">
        <button class="btn btn-primary" onclick="irAElegirEquipos(${e.id})">
          <i class="fas fa-users"></i> Equipos
        </button>
        <button class="btn btn-warning" onclick="editarEvento(${e.id})">
          <i class="fas fa-edit"></i> Editar
        </button>
        <button class="btn btn-danger" onclick="eliminarEvento(${e.id})">
          <i class="fas fa-trash"></i> Eliminar
        </button>
      </div>
    </div>
  `;
}

function renderTablaEventos(eventos) {
  const filas = eventos
    .map((e, index) => {
      const numero = obtenerNumeroEventoVisible(e, index + 1);
      return `
        <tr>
          <td>${numero}</td>
          <td>${escapeHtml(e.nombre || "—")}</td>
          <td>${escapeHtml(e.modalidad || "-")}</td>
          <td>${escapeHtml(formatearMetodoCompetencia(obtenerMetodoCompetenciaVisibleEvento(e)))}</td>
          <td>${escapeHtml(formatearClasificadosPorGrupo(e))}</td>
          <td>${escapeHtml(e.eliminatoria_equipos || "Auto")}</td>
          <td>${escapeHtml(formatearPlantillaPlayoff(e.playoff_plantilla))}</td>
          <td>${e.playoff_tercer_puesto === true ? "Sí" : "No"}</td>
          <td>${escapeHtml(formatearCostoInscripcion(e.costo_inscripcion))}</td>
          <td>${escapeHtml(formatearBloqueoMorososEvento(e))}</td>
          <td>${escapeHtml(formatearCarnetEstilo(e.carnet_estilo))}</td>
          <td>${escapeHtml(formatearConfiguracionJuvenil(e))}</td>
          <td>${e.carnet_mostrar_edad === true ? "Sí" : "No"}</td>
          <td>${escapeHtml(formatearFechaSolo(e.fecha_inicio))}</td>
          <td>${escapeHtml(formatearFechaSolo(e.fecha_fin))}</td>
          <td class="list-table-actions">
            <button class="btn btn-primary" onclick="irAElegirEquipos(${e.id})">
              <i class="fas fa-users"></i> Equipos
            </button>
            <button class="btn btn-warning" onclick="editarEvento(${e.id})">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn btn-danger" onclick="eliminarEvento(${e.id})">
              <i class="fas fa-trash"></i> Eliminar
            </button>
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
            <th>Categoría</th>
            <th>Modalidad</th>
            <th>Método</th>
            <th>Clasif./grupo</th>
            <th>Llave elim.</th>
            <th>Armado</th>
            <th>3er puesto</th>
            <th>Costo inscripción</th>
            <th>Bloqueo morosos</th>
            <th>Diseño carné</th>
            <th>Juvenil</th>
            <th>Edad en carné</th>
            <th>Fecha inicio</th>
            <th>Fecha fin</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
}

function irAElegirEquipos(eventoId) {
  // aquí enlazamos a una pantalla de equipos por evento
  // (puede ser equipos.html si lo adaptas, o una nueva equipos_evento.html)
  if (window.RouteContext?.navigate) {
    window.RouteContext.navigate("equipos.html", {
      campeonato: Number(campeonatoSeleccionado) || null,
      evento: Number(eventoId) || null,
    });
    return;
  }
  window.location.href = `equipos.html?campeonato=${campeonatoSeleccionado}&evento=${eventoId}`;
}

async function crearEvento() {
  if (!campeonatoSeleccionado) {
    mostrarNotificacion("Selecciona un campeonato", "warning");
    return;
  }

  const nombre = document.getElementById("evt-nombre").value.trim();
  const modalidad = document.getElementById("evt-modalidad").value;
  const metodoCompetencia = document.getElementById("evt-metodo-competencia")?.value || "grupos";
  const clasificadosRaw = document.getElementById("evt-clasificados-por-grupo")?.value || "";
  const eliminatoriaEquiposRaw = document.getElementById("evt-eliminatoria-equipos")?.value || "";
  const playoffPlantilla = document.getElementById("evt-playoff-plantilla")?.value || "estandar";
  const playoffTercerPuesto = document.getElementById("evt-playoff-tercer-puesto")?.value === "true";
  const fecha_inicio = document.getElementById("evt-fecha-inicio").value;
  const fecha_fin = document.getElementById("evt-fecha-fin").value;
  const costo_inscripcion = normalizarCostoInscripcion(
    document.getElementById("evt-costo-inscripcion").value,
    0
  );
  const bloqueoMorososRaw = document.getElementById("evt-bloquear-morosos")?.value ?? "";
  const bloqueoMorosos =
    bloqueoMorososRaw === "" ? null : bloqueoMorososRaw === "true";
  const bloqueoMorosidadMonto = normalizarCostoInscripcion(
    document.getElementById("evt-bloqueo-morosidad-monto")?.value,
    null
  );
  const carnet_estilo = String(document.getElementById("evt-carnet-estilo")?.value || "").trim() || null;
  const carnet_color_primario = normalizarColorHexEvento(
    document.getElementById("evt-carnet-color-primario")?.value,
    ""
  ) || null;
  const carnet_color_secundario = normalizarColorHexEvento(
    document.getElementById("evt-carnet-color-secundario")?.value,
    ""
  ) || null;
  const carnet_color_acento = normalizarColorHexEvento(
    document.getElementById("evt-carnet-color-acento")?.value,
    ""
  ) || null;
  const categoria_juvenil = document.getElementById("evt-categoria-juvenil")?.value === "true";
  const categoria_juvenil_cupos = normalizarCuposJuvenilEvento(
    document.getElementById("evt-categoria-juvenil-cupos")?.value,
    categoria_juvenil ? 2 : 0
  );
  const categoria_juvenil_max_diferencia = normalizarDiferenciaJuvenilEvento(
    document.getElementById("evt-categoria-juvenil-max-diferencia")?.value,
    categoria_juvenil ? 2 : 1
  );
  const carnet_mostrar_edad = document.getElementById("evt-carnet-mostrar-edad")?.value === "true";
  const edadBaseCategoria = inferirEdadBaseCategoria(nombre);
  const coloresCamp = obtenerColoresCarnetCampeonatoSeleccionado();
  const personalizaCarnetCategoria =
    Boolean(carnet_estilo) ||
    carnet_color_primario !== coloresCamp.primario ||
    carnet_color_secundario !== coloresCamp.secundario ||
    carnet_color_acento !== coloresCamp.acento;
  const metodo_competencia = normalizarMetodoCompetencia(metodoCompetencia);
  if (!metodo_competencia) {
    mostrarNotificacion("Método de competencia inválido.", "warning");
    return;
  }
  const clasificados_por_grupo = ["grupos", "mixto", "tabla_acumulada"].includes(metodo_competencia)
    ? normalizarClasificadosPorGrupo(clasificadosRaw, 2)
    : null;
  if (["grupos", "mixto", "tabla_acumulada"].includes(metodo_competencia) && !clasificados_por_grupo) {
    mostrarNotificacion("Clasificados por grupo inválido.", "warning");
    return;
  }
  const eliminatoria_equipos = eliminatoriaEquiposRaw ? Number(eliminatoriaEquiposRaw) : null;

  if (!nombre || !fecha_inicio || !fecha_fin) {
    mostrarNotificacion("Completa nombre + fechas", "warning");
    return;
  }
  if (categoria_juvenil && !edadBaseCategoria) {
    mostrarNotificacion("La opción juvenil solo aplica a categorías Sub 30 a Sub 60 detectadas por el nombre.", "warning");
    return;
  }
  if (categoria_juvenil && !categoria_juvenil_cupos) {
    mostrarNotificacion("Indica cuántos juveniles permite la categoría.", "warning");
    return;
  }

  try {
    await EventosAPI.crear({
      campeonato_id: campeonatoSeleccionado,
      nombre,
      modalidad,
      metodo_competencia,
      clasificados_por_grupo,
      eliminatoria_equipos,
      playoff_plantilla: playoffPlantilla,
      playoff_tercer_puesto: playoffTercerPuesto,
      fecha_inicio,
      fecha_fin,
      costo_inscripcion,
      bloquear_morosos: bloqueoMorosos,
      bloqueo_morosidad_monto: bloqueoMorosidadMonto,
      carnet_estilo: personalizaCarnetCategoria ? carnet_estilo : null,
      carnet_color_primario: personalizaCarnetCategoria ? carnet_color_primario : null,
      carnet_color_secundario: personalizaCarnetCategoria ? carnet_color_secundario : null,
      carnet_color_acento: personalizaCarnetCategoria ? carnet_color_acento : null,
      categoria_juvenil,
      categoria_juvenil_cupos: categoria_juvenil ? categoria_juvenil_cupos : 0,
      categoria_juvenil_max_diferencia: categoria_juvenil ? categoria_juvenil_max_diferencia : 1,
      carnet_mostrar_edad,
    });
    mostrarNotificacion("Categoría creada", "success");
    document.getElementById("evt-nombre").value = "";
    document.getElementById("evt-costo-inscripcion").value = "";
    const inputClasificados = document.getElementById("evt-clasificados-por-grupo");
    const selectMetodo = document.getElementById("evt-metodo-competencia");
    const selectElim = document.getElementById("evt-eliminatoria-equipos");
    const selectPlantilla = document.getElementById("evt-playoff-plantilla");
    const selectTercer = document.getElementById("evt-playoff-tercer-puesto");
    if (inputClasificados) inputClasificados.value = "2";
    if (selectMetodo) selectMetodo.value = "grupos";
    if (selectElim) selectElim.value = "";
    if (selectPlantilla) selectPlantilla.value = "estandar";
    if (selectTercer) selectTercer.value = "false";
    const selectBloqMorosos = document.getElementById("evt-bloquear-morosos");
    const inputBloqMonto = document.getElementById("evt-bloqueo-morosidad-monto");
    if (selectBloqMorosos) selectBloqMorosos.value = "";
    if (inputBloqMonto) inputBloqMonto.value = "";
    const selectCarnetEstilo = document.getElementById("evt-carnet-estilo");
    const selectCategoriaJuvenil = document.getElementById("evt-categoria-juvenil");
    const inputCategoriaJuvenilCupos = document.getElementById("evt-categoria-juvenil-cupos");
    const selectCategoriaJuvenilDif = document.getElementById("evt-categoria-juvenil-max-diferencia");
    const selectCarnetMostrarEdad = document.getElementById("evt-carnet-mostrar-edad");
    const colorPrimario = document.getElementById("evt-carnet-color-primario");
    const colorSecundario = document.getElementById("evt-carnet-color-secundario");
    const colorAcento = document.getElementById("evt-carnet-color-acento");
    const coloresCamp = obtenerColoresCarnetCampeonatoSeleccionado();
    if (selectCarnetEstilo) selectCarnetEstilo.value = "";
    if (selectCategoriaJuvenil) selectCategoriaJuvenil.value = "false";
    if (inputCategoriaJuvenilCupos) inputCategoriaJuvenilCupos.value = "2";
    if (selectCategoriaJuvenilDif) selectCategoriaJuvenilDif.value = "2";
    if (selectCarnetMostrarEdad) selectCarnetMostrarEdad.value = "false";
    if (colorPrimario) colorPrimario.value = coloresCamp.primario;
    if (colorSecundario) colorSecundario.value = coloresCamp.secundario;
    if (colorAcento) colorAcento.value = coloresCamp.acento;
    actualizarVisibilidadConfigEliminatoria();
    actualizarVisibilidadConfigJuvenil();
    toggleFormularioCategoria(false);
    await cargarEventos();
  } catch (err) {
    console.error(err);
    mostrarNotificacion(err.message || "Error creando categoría", "error");
  }
}

async function eliminarEvento(id) {
  const ok = await window.mostrarConfirmacion({
    titulo: "Eliminar categoría",
    mensaje: "¿Eliminar esta categoría del campeonato actual?",
    tipo: "warning",
    textoConfirmar: "Eliminar",
    claseConfirmar: "btn-danger",
  });
  if (!ok) return;

  try {
    await EventosAPI.eliminar(id);
    mostrarNotificacion("Categoría eliminada", "success");
    await cargarEventos();
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error eliminando categoría", "error");
  }
}

// (opcional) editar rápido por prompt
async function editarEvento(id) {
  const evento = eventosCache.find((item) => Number(item.id) === Number(id));
  if (!evento) {
    mostrarNotificacion("No se encontró la categoría seleccionada.", "warning");
    return;
  }
  const costoActual = normalizarCostoInscripcion(evento?.costo_inscripcion, 0);
  const metodoActual = obtenerMetodoCompetenciaVisibleEvento(evento);
  const bloqueoActual =
    evento?.bloquear_morosos === null || evento?.bloquear_morosos === undefined || evento?.bloquear_morosos === ""
      ? "heredar"
      : (evento?.bloquear_morosos === true || String(evento?.bloquear_morosos).toLowerCase() === "true")
        ? "activar"
        : "desactivar";
  const montoBloqueoActual = normalizarCostoInscripcion(evento?.bloqueo_morosidad_monto, null);
  const coloresCamp = obtenerColoresCarnetCampeonatoSeleccionado();
  const form = await window.mostrarFormularioModal({
    titulo: "Editar categoría",
    mensaje: "Actualiza la configuración deportiva y financiera de la categoría.",
    tipo: "info",
    textoConfirmar: "Guardar cambios",
    ancho: "lg",
    campos: [
      {
        name: "nombre",
        label: "Nombre de la categoría",
        type: "text",
        value: evento?.nombre || "",
        required: true,
      },
      {
        name: "costo_inscripcion",
        label: "Costo de inscripción",
        type: "number",
        value: String(costoActual ?? 0),
        min: 0,
        step: "0.01",
      },
      {
        name: "metodo_competencia",
        label: "Método de competencia",
        type: "select",
        value: metodoActual,
        required: true,
        options: [
          { value: "grupos", label: "Grupos" },
          { value: "liga", label: "Liga" },
          { value: "eliminatoria", label: "Eliminatoria" },
          { value: "mixto", label: "Mixto" },
          { value: "tabla_acumulada", label: "Tabla acumulada" },
        ],
      },
      {
        name: "clasificados_por_grupo",
        label: "Clasifican por grupo",
        type: "number",
        value: evento?.clasificados_por_grupo ? String(evento.clasificados_por_grupo) : "2",
        min: 1,
        step: 1,
        validate: (value, values) => {
          if (!["grupos", "mixto", "tabla_acumulada"].includes(values.metodo_competencia)) return "";
          return normalizarClasificadosPorGrupo(value, null)
            ? ""
            : "Clasificados por grupo inválido. Usa un entero mayor a 0.";
        },
      },
      {
        name: "eliminatoria_equipos",
        label: "Tamaño de llave eliminatoria",
        type: "select",
        value: evento?.eliminatoria_equipos ? String(evento.eliminatoria_equipos) : "",
        options: [
          { value: "", label: "Automática" },
          { value: "4", label: "4 equipos" },
          { value: "8", label: "8 equipos" },
          { value: "16", label: "16 equipos" },
          { value: "32", label: "32 equipos" },
        ],
        validate: (value, values) => {
          if (!["eliminatoria", "mixto", "tabla_acumulada"].includes(values.metodo_competencia)) return "";
          return value && !["4", "8", "16", "32"].includes(value)
            ? "Llave inválida. Usa 4, 8, 16, 32 o vacía."
            : "";
        },
      },
      {
        name: "playoff_plantilla",
        label: "Armado de llaves / finish",
        type: "select",
        value: String(evento?.playoff_plantilla || "estandar"),
        options: [
          { value: "estandar", label: "Estándar automático" },
          { value: "balanceada_8vos", label: "Evitar reencuentros tempranos de grupo (balanceada)" },
          { value: "mejores_perdedores_12vos", label: "Mejores perdedores (24 -> 12vos -> 8vos)" },
        ],
      },
      {
        name: "playoff_tercer_puesto",
        label: "Partido tercer y cuarto puesto",
        type: "select",
        value: evento?.playoff_tercer_puesto === true ? "true" : "false",
        options: [
          { value: "false", label: "No" },
          { value: "true", label: "Sí" },
        ],
      },
      {
        name: "bloquear_morosos",
        label: "Bloqueo morosos",
        type: "select",
        value: bloqueoActual,
        options: [
          { value: "heredar", label: "Heredar" },
          { value: "activar", label: "Activar" },
          { value: "desactivar", label: "Desactivar" },
        ],
      },
      {
        name: "bloqueo_morosidad_monto",
        label: "Monto de bloqueo",
        type: "number",
        value: montoBloqueoActual === null ? "" : String(montoBloqueoActual),
        min: 0,
        step: "0.01",
        validate: (value) => {
          if (String(value || "").trim() === "") return "";
          return normalizarCostoInscripcion(value, null) === null
            ? "Monto de bloqueo inválido. Usa solo números >= 0."
            : "";
        },
      },
      {
        name: "carnet_estilo",
        label: "Diseño de carné",
        type: "select",
        value: String(evento?.carnet_estilo || "").trim(),
        options: [
          { value: "", label: "Heredar campeonato" },
          { value: "clasico", label: "Clásico" },
          { value: "franja", label: "Franja diagonal" },
          { value: "marco", label: "Marco deportivo" },
          { value: "minimal", label: "Minimal" },
        ],
      },
      {
        name: "carnet_color_primario",
        label: "Color primario carné",
        type: "color",
        value: normalizarColorHexEvento(evento?.carnet_color_primario, coloresCamp.primario),
      },
      {
        name: "carnet_color_secundario",
        label: "Color secundario carné",
        type: "color",
        value: normalizarColorHexEvento(evento?.carnet_color_secundario, coloresCamp.secundario),
      },
      {
        name: "carnet_color_acento",
        label: "Color acento carné",
        type: "color",
        value: normalizarColorHexEvento(evento?.carnet_color_acento, coloresCamp.acento),
      },
      {
        name: "categoria_juvenil",
        label: "Categoría juvenil",
        type: "select",
        value: evento?.categoria_juvenil === true ? "true" : "false",
        options: [
          { value: "false", label: "No" },
          { value: "true", label: "Si" },
        ],
      },
      {
        name: "categoria_juvenil_cupos",
        label: "Cupos juveniles permitidos",
        type: "number",
        value: String(normalizarCuposJuvenilEvento(evento?.categoria_juvenil_cupos, evento?.categoria_juvenil === true ? 2 : 0)),
        min: 0,
        step: 1,
      },
      {
        name: "categoria_juvenil_max_diferencia",
        label: "Máximo años menor",
        type: "select",
        value: String(normalizarDiferenciaJuvenilEvento(evento?.categoria_juvenil_max_diferencia, evento?.categoria_juvenil === true ? 2 : 1)),
        options: [
          { value: "1", label: "1 año menor" },
          { value: "2", label: "2 años menor" },
        ],
      },
      {
        name: "carnet_mostrar_edad",
        label: "Mostrar edad en carné",
        type: "select",
        value: evento?.carnet_mostrar_edad === true ? "true" : "false",
        options: [
          { value: "false", label: "No" },
          { value: "true", label: "Sí" },
        ],
      },
    ],
  });
  if (!form) return;

  const nuevoNombre = String(form.nombre || "").trim();
  const nuevoMetodo = normalizarMetodoCompetencia(form.metodo_competencia);
  const clasificadosPrompt = ["grupos", "mixto", "tabla_acumulada"].includes(nuevoMetodo)
    ? String(form.clasificados_por_grupo || "").trim()
    : "";
  const nuevaLlave = ["eliminatoria", "mixto", "tabla_acumulada"].includes(nuevoMetodo)
    ? String(form.eliminatoria_equipos || "").trim()
    : "";
  const nuevaPlantillaPlayoff = String(form.playoff_plantilla || "estandar").trim();
  const nuevoTercerPuesto = String(form.playoff_tercer_puesto || "false").trim().toLowerCase() === "true";
  const costo_inscripcion = normalizarCostoInscripcion(form.costo_inscripcion, null);
  const nuevoBloqueo = String(form.bloquear_morosos || bloqueoActual).trim().toLowerCase();
  const nuevoMontoBloqueoRaw = String(form.bloqueo_morosidad_monto || "").trim();
  const nuevoMontoBloqueo = normalizarCostoInscripcion(nuevoMontoBloqueoRaw, null);
  const categoriaJuvenilActiva = String(form.categoria_juvenil || "false").trim().toLowerCase() === "true";
  const edadBaseCategoria = inferirEdadBaseCategoria(nuevoNombre);
  const categoriaJuvenilCupos = normalizarCuposJuvenilEvento(form.categoria_juvenil_cupos, categoriaJuvenilActiva ? 2 : 0);
  const categoriaJuvenilMaxDiferencia = normalizarDiferenciaJuvenilEvento(
    form.categoria_juvenil_max_diferencia,
    categoriaJuvenilActiva ? 2 : 1
  );

  if (!nuevoNombre) return;
  if (!nuevoMetodo) {
    mostrarNotificacion("Método inválido. Usa: grupos, liga, eliminatoria, mixto o tabla acumulada.", "warning");
    return;
  }
  if (["grupos", "mixto", "tabla_acumulada"].includes(nuevoMetodo) && !normalizarClasificadosPorGrupo(clasificadosPrompt, null)) {
    mostrarNotificacion("Clasificados por grupo inválido. Usa un entero mayor a 0.", "warning");
    return;
  }
  if (nuevaLlave && !["4", "8", "16", "32"].includes(nuevaLlave)) {
    mostrarNotificacion("Llave inválida. Usa 4, 8, 16, 32 o vacío.", "warning");
    return;
  }
  if (String(form.costo_inscripcion || "").trim() !== "" && costo_inscripcion === null) {
    mostrarNotificacion("Costo inválido. Usa solo números.", "warning");
    return;
  }
  if (!["heredar", "activar", "desactivar"].includes(nuevoBloqueo)) {
    mostrarNotificacion("Valor inválido para bloqueo. Usa: heredar, activar, desactivar.", "warning");
    return;
  }
  if (nuevoMontoBloqueoRaw && nuevoMontoBloqueo === null) {
    mostrarNotificacion("Monto de bloqueo inválido. Usa solo números >= 0.", "warning");
    return;
  }
  if (categoriaJuvenilActiva && !edadBaseCategoria) {
    mostrarNotificacion("La opción juvenil solo aplica a categorías Sub 30 a Sub 60 detectadas por el nombre.", "warning");
    return;
  }
  if (categoriaJuvenilActiva && !categoriaJuvenilCupos) {
    mostrarNotificacion("Indica cuántos juveniles permite la categoría.", "warning");
    return;
  }

  try {
    const payload = { nombre: nuevoNombre, metodo_competencia: nuevoMetodo };
    payload.clasificados_por_grupo =
      nuevoMetodo === "grupos" || nuevoMetodo === "mixto" || nuevoMetodo === "tabla_acumulada"
        ? normalizarClasificadosPorGrupo(clasificadosPrompt, 2)
        : null;
    payload.eliminatoria_equipos = nuevaLlave ? Number(nuevaLlave) : null;
    payload.playoff_plantilla = nuevaPlantillaPlayoff || "estandar";
    payload.playoff_tercer_puesto = nuevoTercerPuesto;
    if (costo_inscripcion !== null) payload.costo_inscripcion = costo_inscripcion;
    payload.bloquear_morosos =
      nuevoBloqueo === "heredar" ? null : nuevoBloqueo === "activar";
    payload.bloqueo_morosidad_monto =
      String(nuevoMontoBloqueoRaw || "").trim() === "" ? null : nuevoMontoBloqueo;
    const nuevoEstiloCarnet = String(form.carnet_estilo || "").trim() || null;
    const nuevoColorPrimarioCarnet = normalizarColorHexEvento(form.carnet_color_primario, "") || null;
    const nuevoColorSecundarioCarnet = normalizarColorHexEvento(form.carnet_color_secundario, "") || null;
    const nuevoColorAcentoCarnet = normalizarColorHexEvento(form.carnet_color_acento, "") || null;
    const personalizaCarnet =
      Boolean(nuevoEstiloCarnet) ||
      nuevoColorPrimarioCarnet !== coloresCamp.primario ||
      nuevoColorSecundarioCarnet !== coloresCamp.secundario ||
      nuevoColorAcentoCarnet !== coloresCamp.acento;
    payload.carnet_estilo = personalizaCarnet ? nuevoEstiloCarnet : null;
    payload.carnet_color_primario = personalizaCarnet ? nuevoColorPrimarioCarnet : null;
    payload.carnet_color_secundario = personalizaCarnet ? nuevoColorSecundarioCarnet : null;
    payload.carnet_color_acento = personalizaCarnet ? nuevoColorAcentoCarnet : null;
    payload.categoria_juvenil = categoriaJuvenilActiva;
    payload.categoria_juvenil_cupos = categoriaJuvenilActiva ? categoriaJuvenilCupos : 0;
    payload.categoria_juvenil_max_diferencia = categoriaJuvenilActiva ? categoriaJuvenilMaxDiferencia : 1;
    payload.carnet_mostrar_edad = String(form.carnet_mostrar_edad || "false").trim().toLowerCase() === "true";
    await EventosAPI.actualizar(id, payload);
    mostrarNotificacion("Categoría actualizada", "success");
    await cargarEventos();
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error actualizando categoría", "error");
  }
}

window.cambiarVistaEventos = cambiarVistaEventos;
window.toggleFormularioCategoria = toggleFormularioCategoria;
