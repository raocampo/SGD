// frontend/js/eventos.js

let campeonatoSeleccionado = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("eventos.html")) return;

  wireUI();
  await cargarCampeonatos();
  await cargarEventos();
});

function wireUI() {
  const selCamp = document.getElementById("select-campeonato");
  selCamp.onchange = async () => {
    campeonatoSeleccionado = selCamp.value || null;
    await cargarEventos();
  };

  const chk = document.getElementById("chk-multi-canchas");
  chk.onchange = () => {
    document.getElementById("canchas-panel").style.display = chk.checked
      ? "block"
      : "none";
    if (chk.checked) renderCanchasInputs();
  };

  const num = document.getElementById("num-canchas");
  num.oninput = () => renderCanchasInputs();

  // nav toggle si tu core.js no lo hace
  const toggle = document.getElementById("nav-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const nav = document.getElementById("main-nav");
      nav.classList.toggle("open");
    });
  }
}

async function cargarCampeonatos() {
  try {
    // si ya tienes CampeonatosAPI lo usamos, si no, cae al GET directo
    let data;
    if (window.CampeonatosAPI?.obtenerTodos) {
      data = await CampeonatosAPI.obtenerTodos();
    } else {
      data = await ApiClient.get("/campeonatos");
    }

    const lista = data.campeonatos || data || [];
    const select = document.getElementById("select-campeonato");

    select.innerHTML = `<option value="">— Selecciona un campeonato —</option>`;
    lista.forEach((c) => {
      select.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error cargando campeonatos", "error");
  }
}

async function cargarEventos() {
  const cont = document.getElementById("lista-eventos");
  cont.innerHTML = "<p>Cargando eventos...</p>";

  try {
    let url = "/eventos";
    if (campeonatoSeleccionado) url = `/eventos/campeonato/${campeonatoSeleccionado}`;

    const resp = await ApiClient.get(url);
    const eventos = resp.eventos || resp || [];

    if (!eventos.length) {
      cont.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-calendar"></i>
          <p>No hay eventos registrados.</p>
        </div>`;
      return;
    }

    cont.innerHTML = eventos.map(renderEventoCard).join("");
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error cargando eventos", "error");
    cont.innerHTML = "";
  }
}

function renderEventoCard(e) {
  return `
    <div class="campeonato-card">
      <div class="campeonato-header">
        <h3>${e.nombre}</h3>
      </div>

      <div class="campeonato-info">
        <p><strong>Campeonato:</strong> ${e.campeonato_nombre || e.campeonato_id || "-"}</p>
        <p><strong>Fecha:</strong> ${e.fecha_inicio || "-"} → ${e.fecha_fin || "-"}</p>
        <p><strong>Estado:</strong> ${e.estado || "activo"}</p>
      </div>

      <div class="campeonato-actions">
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

function renderCanchasInputs() {
  const n = Math.max(1, parseInt(document.getElementById("num-canchas").value || "1"));
  const cont = document.getElementById("lista-canchas");

  let html = "";
  for (let i = 1; i <= n; i++) {
    html += `
      <div class="config-card" style="margin:0;">
        <h4>Cancha ${i}</h4>
        <div class="form-group">
          <label>Nombre:</label>
          <input type="text" class="cancha-nombre" placeholder="Cancha ${i}" />
        </div>
        <div class="form-group">
          <label>Ubicación (opcional):</label>
          <input type="text" class="cancha-ubicacion" placeholder="Ej: Barrio..., Estadio..." />
        </div>
      </div>
    `;
  }
  cont.innerHTML = html;
}

/**
 * Crear evento + canchas
 * Backend esperado:
 *  POST /eventos
 *  POST /canchas
 *  POST /eventos/:evento_id/canchas   (o /evento-canchas)
 *
 * Si tus rutas se llaman distinto, dime y lo ajusto.
 */
async function crearEvento() {
  if (!campeonatoSeleccionado) {
    mostrarNotificacion("Selecciona un campeonato", "warning");
    return;
  }

  const nombre = (document.getElementById("txt-nombre").value || "").trim();
  if (!nombre) {
    mostrarNotificacion("Ingresa el nombre del evento (categoría)", "warning");
    return;
  }

  const organizador = (document.getElementById("txt-organizador").value || "").trim();

  const fecha_inicio = document.getElementById("fecha-inicio").value;
  const fecha_fin = document.getElementById("fecha-fin").value;
  if (!fecha_inicio || !fecha_fin) {
    mostrarNotificacion("Completa fecha inicio y fin", "warning");
    return;
  }
  if (fecha_fin < fecha_inicio) {
    mostrarNotificacion("La fecha fin no puede ser menor a la fecha inicio", "warning");
    return;
  }

  const modalidad = document.getElementById("select-modalidad").value; // weekend | weekday | mixed

  // horarios
  const horarios = {
    weekend: {
      sat_start: document.getElementById("sat-start").value || "13:00",
      sat_end: document.getElementById("sat-end").value || "18:00",
      sun_start: document.getElementById("sun-start").value || "08:00",
      sun_end: document.getElementById("sun-end").value || "17:00",
    },
    weekday: {
      start: document.getElementById("wk-start").value || "19:00",
      end: document.getElementById("wk-end").value || "22:00",
    },
  };

  const usarCanchas = document.getElementById("chk-multi-canchas").checked;

  try {
    // 1) Crear evento
    const eventoPayload = {
      campeonato_id: parseInt(campeonatoSeleccionado),
      nombre,
      organizador: organizador || null,
      fecha_inicio,
      fecha_fin,

      // OJO: en tu DB aún no existe "modalidad".
      // Igual lo mandamos para que el backend lo use al generar fixture.
      modalidad,
      horarios,
    };

    const respEvento = await ApiClient.post("/eventos", eventoPayload);
    const evento = respEvento.evento || respEvento;
    if (!evento?.id) throw new Error("No se recibió ID del evento");

    // 2) Crear canchas + vincular
    if (usarCanchas) {
      const n = Math.max(1, parseInt(document.getElementById("num-canchas").value || "1"));

      const nombres = Array.from(document.querySelectorAll(".cancha-nombre")).map((x) => (x.value || "").trim());
      const ubicaciones = Array.from(document.querySelectorAll(".cancha-ubicacion")).map((x) => (x.value || "").trim());

      const canchaIds = [];

      for (let i = 0; i < n; i++) {
        const cPayload = {
          nombre: nombres[i] || `Cancha ${i + 1}`,
          ubicacion: ubicaciones[i] || null,
        };

        const respCancha = await ApiClient.post("/canchas", cPayload);
        const cancha = respCancha.cancha || respCancha;
        if (cancha?.id) canchaIds.push(cancha.id);
      }

      // vincular evento_canchas
      // Endpoint sugerido:
      // POST /eventos/:evento_id/canchas  body: { cancha_ids: [..] }
      await ApiClient.post(`/eventos/${evento.id}/canchas`, {
        cancha_ids: canchaIds,
      });
    }

    mostrarNotificacion("Evento creado correctamente", "success");

    // limpiar campos
    document.getElementById("txt-nombre").value = "";
    document.getElementById("txt-organizador").value = "";
    document.getElementById("chk-multi-canchas").checked = false;
    document.getElementById("canchas-panel").style.display = "none";

    await cargarEventos();
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error creando evento", "error");
  }
}

async function eliminarEvento(id) {
  if (!confirm("¿Seguro que quieres eliminar este evento?")) return;

  try {
    await ApiClient.delete(`/eventos/${id}`);
    mostrarNotificacion("Evento eliminado", "success");
    await cargarEventos();
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error eliminando evento", "error");
  }
}

async function editarEvento(id) {
  try {
    const resp = await ApiClient.get(`/eventos/${id}`);
    const e = resp.evento || resp;
    if (!e) {
      mostrarNotificacion("No se pudo cargar el evento", "error");
      return;
    }

    const nuevoNombre = prompt("Nombre del evento:", e.nombre || "");
    if (!nuevoNombre) return;

    const nuevaInicio = prompt("Fecha inicio (YYYY-MM-DD):", e.fecha_inicio || "");
    if (!nuevaInicio) return;

    const nuevaFin = prompt("Fecha fin (YYYY-MM-DD):", e.fecha_fin || "");
    if (!nuevaFin) return;

    await ApiClient.put(`/eventos/${id}`, {
      nombre: nuevoNombre,
      fecha_inicio: nuevaInicio,
      fecha_fin: nuevaFin,
    });

    mostrarNotificacion("Evento actualizado", "success");
    await cargarEventos();
  } catch (err) {
    console.error(err);
    mostrarNotificacion("Error editando evento", "error");
  }
}