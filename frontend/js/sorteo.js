let campeonatoSeleccionado = null;
let eventoSeleccionado = null;

let equiposEvento = [];
let gruposEvento = [];
let equiposPendientes = [];
let equipoSeleccionado = null;
let sorteoFinalizado = false;
let ruletaRotation = 0;
let ruletaSpinning = false;
let ruletaFrame = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("sorteo.html")) return;

  await cargarCampeonatos();
  await aplicarContextoDesdeURL();
});

async function aplicarContextoDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  const camp = params.get("campeonato");
  const ev = params.get("evento");

  const selectCamp = document.getElementById("select-campeonato");
  const selectEvt = document.getElementById("select-evento");

  if (camp && selectCamp) {
    selectCamp.value = String(camp);
    campeonatoSeleccionado = parseInt(camp, 10);
    await cargarEventosPorCampeonato(campeonatoSeleccionado);
  }

  if (ev && selectEvt) {
    selectEvt.value = String(ev);
    eventoSeleccionado = parseInt(ev, 10);
    await recargarEstadoSorteo();
  }
}

async function cargarCampeonatos() {
  const select = document.getElementById("select-campeonato");
  if (!select) return;

  select.innerHTML = '<option value="">-- Selecciona un campeonato --</option>';
  try {
    const data = await CampeonatosAPI.obtenerTodos();
    const lista = data.campeonatos || data || [];
    lista.forEach((c) => {
      select.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });

    select.onchange = async () => {
      campeonatoSeleccionado = select.value ? parseInt(select.value, 10) : null;
      eventoSeleccionado = null;
      await cargarEventosPorCampeonato(campeonatoSeleccionado);
      limpiarSorteoUI();
    };
  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error cargando campeonatos", "error");
  }
}

async function cargarEventosPorCampeonato(campeonatoId) {
  const selectEvt = document.getElementById("select-evento");
  if (!selectEvt) return;

  selectEvt.innerHTML = '<option value="">-- Selecciona una categoría --</option>';
  if (!campeonatoId) return;

  try {
    const resp = await EventosAPI.obtenerPorCampeonato(campeonatoId);
    const eventos = resp.eventos || resp || [];
    eventos.forEach((e) => {
      selectEvt.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
    });

    selectEvt.onchange = async () => {
      eventoSeleccionado = selectEvt.value ? parseInt(selectEvt.value, 10) : null;
      await recargarEstadoSorteo();
    };
  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error cargando categorías", "error");
  }
}

function limpiarSorteoUI() {
  equiposEvento = [];
  gruposEvento = [];
  equiposPendientes = [];
  equipoSeleccionado = null;
  document.getElementById("lista-grupos").innerHTML = "";
  document.getElementById("lista-equipos-pendientes").innerHTML = "";
  document.getElementById("btn-asignar").disabled = true;
  ruletaRotation = 0;
  ruletaSpinning = false;
  if (ruletaFrame) cancelAnimationFrame(ruletaFrame);
  dibujarRuleta();
  actualizarVistaSorteo();
}

function actualizarVistaSorteo() {
  const body = document.body;
  if (!body) return;
  body.classList.toggle("sorteo-finalizado", !!sorteoFinalizado);

  const btnVerGrupos = document.getElementById("btn-ver-grupos");
  if (btnVerGrupos) {
    btnVerGrupos.style.display = sorteoFinalizado ? "inline-flex" : "none";
    btnVerGrupos.disabled = !sorteoFinalizado;
  }
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderGrupos() {
  const cont = document.getElementById("lista-grupos");
  if (!cont) return;

  if (!gruposEvento.length) {
    cont.innerHTML = '<div class="empty-state"><p>No hay grupos creados aún.</p></div>';
    return;
  }

  cont.innerHTML = gruposEvento
    .map((g) => {
      const equipos = g.equipos || [];
      const items = equipos.length
        ? equipos
            .map(
              (e, idx) =>
                `<div class="equipo-en-grupo"><span class="item-index">${idx + 1}.</span><span class="nombre-equipo">${e.nombre}</span></div>`
            )
            .join("")
        : '<div class="empty-equipos">Sin equipos</div>';

      return `
        <div class="grupo-card">
          <div class="grupo-header">
            <h4>${g.nombre_grupo || `Grupo ${g.letra_grupo || ""}`}</h4>
            <span class="contador-equipos">${equipos.length}</span>
          </div>
          <div class="equipos-grupo">${items}</div>
        </div>
      `;
    })
    .join("");
}

function renderPendientes() {
  const cont = document.getElementById("lista-equipos-pendientes");
  if (!cont) return;

  if (!equiposPendientes.length) {
    cont.innerHTML = '<div class="empty-state"><p>Todos los equipos ya fueron asignados.</p></div>';
    return;
  }

  cont.innerHTML = equiposPendientes
    .map(
      (e, idx) => `
      <div class="equipo-card">
        <div class="equipo-info">
          <strong>${idx + 1}. ${e.nombre}</strong>
          <small>${e.cabeza_serie ? "Cabeza de serie" : "Equipo regular"}</small>
        </div>
      </div>
    `
    )
    .join("");
}

function dibujarRuleta() {
  const canvas = document.getElementById("ruletaCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.42;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f4f6f8";
  ctx.fillRect(0, 0, w, h);

  if (!equiposPendientes.length) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Sin equipos pendientes", cx, cy);
    dibujarFlechaRuleta(ctx, cx, cy, r);
    return;
  }

  const total = equiposPendientes.length;
  const colors = ["#1e88e5", "#43a047", "#fb8c00", "#8e24aa", "#e53935", "#00acc1"];
  const seg = (2 * Math.PI) / total;
  const baseStart = -Math.PI / 2;

  for (let i = 0; i < total; i++) {
    const start = baseStart + ruletaRotation + i * seg;
    const end = start + seg;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();

    // etiqueta de equipo
    const mid = (start + end) / 2;
    const tx = cx + Math.cos(mid) * (r * 0.34);
    const ty = cy + Math.sin(mid) * (r * 0.34);
    const nombre = (equiposPendientes[i]?.nombre || "").trim();
    const label = nombre.length > 16 ? `${nombre.slice(0, 16)}...` : nombre;
    const fuente = total >= 12 ? "bold 10px Arial" : "bold 12px Arial";
    const invertido = Math.cos(mid) < 0;

    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(mid + (invertido ? Math.PI : 0));
    ctx.fillStyle = "#ffffff";
    ctx.font = fuente;
    ctx.textAlign = invertido ? "right" : "left";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeText(label, invertido ? -8 : 8, 0);
    ctx.fillText(label, invertido ? -8 : 8, 0);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.18, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  const nombre = equipoSeleccionado ? equipoSeleccionado.nombre : "Pulsa Girar Ruleta";
  ctx.fillStyle = "#111827";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.fillText(nombre, cx, h - 25);

  dibujarFlechaRuleta(ctx, cx, cy, r);
}

function dibujarFlechaRuleta(ctx, cx, cy, r) {
  const topY = cy - r - 8;
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx - 16, topY - 30);
  ctx.lineTo(cx + 16, topY - 30);
  ctx.closePath();
  ctx.fillStyle = "#111827";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
  ctx.fillStyle = "#111827";
  ctx.fill();
}

function obtenerIndiceBajoFlecha(totalSegmentos, rotacion) {
  if (!totalSegmentos) return -1;
  const seg = (2 * Math.PI) / totalSegmentos;
  const offset = ((-rotacion % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.floor(offset / seg) % totalSegmentos;
}

async function crearGruposSiNoExisten() {
  if (!eventoSeleccionado) throw new Error("Selecciona una categoría");
  if (gruposEvento.length > 0) return;

  const cantidad = parseInt(document.getElementById("cantidad-grupos")?.value || "0", 10);
  if (!Number.isFinite(cantidad) || cantidad < 2) {
    throw new Error("Cantidad de grupos inválida (mínimo 2)");
  }

  await ApiClient.post("/grupos/evento/crear", {
    evento_id: eventoSeleccionado,
    cantidad_grupos: cantidad,
  });
}

async function limpiarGruposEventoActual() {
  if (!eventoSeleccionado) return;

  const resp = await ApiClient.get(`/grupos/evento/${eventoSeleccionado}`);
  const grupos = resp.grupos || [];
  for (const g of grupos) {
    await ApiClient.delete(`/grupos/${g.id}`);
  }
}

async function recargarEstadoSorteo() {
  limpiarSorteoUI();
  if (!eventoSeleccionado) return;

  const [equiposResp, gruposResp] = await Promise.all([
    ApiClient.get(`/eventos/${eventoSeleccionado}/equipos`),
    ApiClient.get(`/grupos/evento/${eventoSeleccionado}/completo`).catch(() => ({ grupos: [] })),
  ]);

  equiposEvento = equiposResp.equipos || [];
  gruposEvento = gruposResp.grupos || [];

  const asignados = new Set(
    gruposEvento.flatMap((g) => (g.equipos || []).map((e) => e.id))
  );
  equiposPendientes = equiposEvento.filter((e) => !asignados.has(e.id));
  sorteoFinalizado =
    gruposEvento.length > 0 &&
    equiposEvento.length > 0 &&
    equiposPendientes.length === 0;

  renderGrupos();
  renderPendientes();
  dibujarRuleta();
  actualizarVistaSorteo();
}

async function sorteoAutomatico(conCabezas = false) {
  await crearGruposSiNoExisten();
  await recargarEstadoSorteo();

  if (!equiposPendientes.length) {
    mostrarNotificacion("No hay equipos pendientes para sortear", "info");
    return;
  }

  const gruposOrdenados = [...gruposEvento].sort((a, b) =>
    String(a.letra_grupo || "").localeCompare(String(b.letra_grupo || ""))
  );

  let orden = 1;
  let indiceGrupo = 0;

  if (conCabezas) {
    const cabezas = equiposPendientes.filter((e) => e.cabeza_serie);
    const resto = equiposPendientes.filter((e) => !e.cabeza_serie);

    if (cabezas.length > gruposOrdenados.length) {
      throw new Error("Hay más cabezas de serie que grupos");
    }

    for (const equipo of shuffle(cabezas)) {
      const grupo = gruposOrdenados[indiceGrupo++];
      await ApiClient.post(`/grupos/${grupo.id}/equipos`, {
        equipo_id: equipo.id,
        orden_sorteo: orden++,
      });
    }

    for (const equipo of shuffle(resto)) {
      const grupo = gruposOrdenados[indiceGrupo % gruposOrdenados.length];
      indiceGrupo++;
      await ApiClient.post(`/grupos/${grupo.id}/equipos`, {
        equipo_id: equipo.id,
        orden_sorteo: orden++,
      });
    }
  } else {
    for (const equipo of shuffle(equiposPendientes)) {
      const grupo = gruposOrdenados[indiceGrupo % gruposOrdenados.length];
      indiceGrupo++;
      await ApiClient.post(`/grupos/${grupo.id}/equipos`, {
        equipo_id: equipo.id,
        orden_sorteo: orden++,
      });
    }
  }

  await recargarEstadoSorteo();
}

async function iniciarSorteo() {
  if (!campeonatoSeleccionado) {
    mostrarNotificacion("Selecciona un campeonato", "warning");
    return;
  }
  if (!eventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría", "warning");
    return;
  }

  const sistema = document.getElementById("sistema-sorteo")?.value || "automatico";
  try {
    sorteoFinalizado = false;
    actualizarVistaSorteo();

    await recargarEstadoSorteo();
    if (gruposEvento.length > 0) {
      const confirmar = confirm(
        "Ya existen grupos para esta categoría. Para iniciar un nuevo sorteo se eliminarán los grupos actuales y sus asignaciones. ¿Deseas continuar?"
      );
      if (!confirmar) return;
      await limpiarGruposEventoActual();
      await recargarEstadoSorteo();
    }

    if (sistema === "automatico") {
      await sorteoAutomatico(false);
      mostrarNotificacion("Sorteo automático completado", "success");
    } else if (sistema === "cabezas-serie") {
      await sorteoAutomatico(true);
      mostrarNotificacion("Sorteo con cabezas de serie completado", "success");
    } else {
      await crearGruposSiNoExisten();
      await recargarEstadoSorteo();
      mostrarNotificacion("Modo manual listo. Usa la ruleta para asignar.", "info");
    }
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "Error en sorteo", "error");
  }
}

async function reiniciarSorteo() {
  if (!eventoSeleccionado) {
    mostrarNotificacion("Selecciona una categoría", "warning");
    return;
  }

  const confirmar = confirm(
    "Se eliminarán los grupos y asignaciones actuales para esta categoría. ¿Deseas continuar?"
  );
  if (!confirmar) return;

  try {
    await limpiarGruposEventoActual();
    sorteoFinalizado = false;
    equipoSeleccionado = null;
    await recargarEstadoSorteo();
    mostrarNotificacion("Sorteo reiniciado. Puedes iniciar uno nuevo.", "success");
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo reiniciar el sorteo", "error");
  }
}

function girarRuleta() {
  if (ruletaSpinning) return;
  if (!equiposPendientes.length) {
    mostrarNotificacion("No hay equipos pendientes", "info");
    return;
  }

  const total = equiposPendientes.length;
  const seg = (2 * Math.PI) / total;
  const idxObjetivo = Math.floor(Math.random() * total);
  const giros = 6 + Math.floor(Math.random() * 2); // 6-7 giros
  const puntoInternoSegmento = 0.25 + Math.random() * 0.5;
  const desired = idxObjetivo * seg + seg * puntoInternoSegmento;
  const targetMod = ((2 * Math.PI - desired) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const currentMod = ((ruletaRotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let delta = targetMod - currentMod;
  if (delta < 0) delta += 2 * Math.PI;

  const inicio = ruletaRotation;
  const fin = ruletaRotation + giros * 2 * Math.PI + delta;
  const duracion = 3200;
  const t0 = performance.now();

  ruletaSpinning = true;
  document.getElementById("btn-girar").disabled = true;
  document.getElementById("btn-asignar").disabled = true;
  equipoSeleccionado = null;

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const step = (now) => {
    const t = Math.min(1, (now - t0) / duracion);
    ruletaRotation = inicio + (fin - inicio) * easeOutCubic(t);
    dibujarRuleta();
    if (t < 1) {
      ruletaFrame = requestAnimationFrame(step);
      return;
    }

    ruletaRotation = ((ruletaRotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const idxFinal = obtenerIndiceBajoFlecha(total, ruletaRotation);
    equipoSeleccionado = equiposPendientes[idxFinal] || equiposPendientes[idxObjetivo] || null;
    ruletaSpinning = false;
    document.getElementById("btn-girar").disabled = false;
    document.getElementById("btn-asignar").disabled = !equipoSeleccionado;
    dibujarRuleta();
    if (equipoSeleccionado) {
      mostrarNotificacion(`Equipo seleccionado: ${equipoSeleccionado.nombre}`, "info");
    }
  };

  ruletaFrame = requestAnimationFrame(step);
}

async function asignarEquipoSeleccionado() {
  if (!equipoSeleccionado) {
    mostrarNotificacion("Primero gira la ruleta", "warning");
    return;
  }
  if (!gruposEvento.length) {
    mostrarNotificacion("Primero crea los grupos", "warning");
    return;
  }

  try {
    const gruposOrdenados = [...gruposEvento].sort(
      (a, b) => (a.equipos?.length || 0) - (b.equipos?.length || 0)
    );
    const grupoDestino = gruposOrdenados[0];
    const orden = (grupoDestino.equipos?.length || 0) + 1;

    await ApiClient.post(`/grupos/${grupoDestino.id}/equipos`, {
      equipo_id: equipoSeleccionado.id,
      orden_sorteo: orden,
    });

    mostrarNotificacion(
      `${equipoSeleccionado.nombre} asignado a ${grupoDestino.nombre_grupo || `Grupo ${grupoDestino.letra_grupo}`}`,
      "success"
    );

    equipoSeleccionado = null;
    document.getElementById("btn-asignar").disabled = true;
    await recargarEstadoSorteo();
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo asignar equipo", "error");
  }
}

function verGruposSorteo() {
  if (!campeonatoSeleccionado) {
    mostrarNotificacion("Selecciona campeonato", "warning");
    return;
  }
  const q = new URLSearchParams({
    campeonato: String(campeonatoSeleccionado),
    evento: String(eventoSeleccionado || ""),
  });
  window.location.href = `gruposgen.html?${q.toString()}`;
}

window.iniciarSorteo = iniciarSorteo;
window.girarRuleta = girarRuleta;
window.asignarEquipoSeleccionado = asignarEquipoSeleccionado;
window.verGruposSorteo = verGruposSorteo;
window.reiniciarSorteo = reiniciarSorteo;
