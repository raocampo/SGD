// frontend/js/partidos.js

let campeonatoSeleccionado = null;
let grupoSeleccionado = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("partidos.html")) return;
  await cargarCampeonatos();
});

// ====================================
// Cargar Campeonatos
// ====================================
async function cargarCampeonatos() {
  try {
    const data = await CampeonatosAPI.obtenerTodos();
    const lista = data.campeonatos || [];

    const select = document.getElementById("select-campeonato");
    select.innerHTML = `<option value="">— Selecciona un campeonato —</option>`;

    lista.forEach((c) => {
      select.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });

    select.onchange = async () => {
      campeonatoSeleccionado = select.value || null;
      grupoSeleccionado = null;
      await cargarGrupos(campeonatoSeleccionado);
      document.getElementById("lista-partidos").innerHTML = "";
    };
  } catch (error) {
    mostrarNotificacion("Error cargando campeonatos", "error");
    console.error(error);
  }
}

// ====================================
// Cargar Grupos según campeonato
// ====================================
async function cargarGrupos(campeonatoId) {
  const select = document.getElementById("select-grupo");
  select.innerHTML = `<option value="">— Todos —</option>`;

  if (!campeonatoId) return;

  try {
    const resp = await ApiClient.get(`/grupos/campeonato/${campeonatoId}`);
    const grupos = resp.grupos || resp || [];

    grupos.forEach((g) => {
      const nombre = g.nombre_grupo || g.nombre || "Grupo";
      const letra = g.letra_grupo || g.letra || "";
      select.innerHTML += `<option value="${g.id}">${nombre} ${letra}</option>`;
    });

    select.onchange = () => {
      grupoSeleccionado = select.value || null;
    };
  } catch (error) {
    mostrarNotificacion("Error cargando grupos", "error");
    console.error(error);
  }
}

// ====================================
// Cargar Partidos
// ====================================
async function cargarPartidos() {
  const cont = document.getElementById("lista-partidos");
  cont.innerHTML = "<p>Cargando partidos...</p>";

  if (!campeonatoSeleccionado) {
    mostrarNotificacion("Selecciona un campeonato", "warning");
    cont.innerHTML = "";
    return;
  }

  try {
    const url = grupoSeleccionado
      ? `/partidos/grupo/${grupoSeleccionado}`
      : `/partidos/campeonato/${campeonatoSeleccionado}`;

    const data = await ApiClient.get(url);

    let partidos = [];
    if (Array.isArray(data)) partidos = data;
    else if (data.partidos) partidos = data.partidos;

    if (partidos.length === 0) {
      cont.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-futbol"></i>
          <p>No hay partidos registrados.</p>
        </div>`;
      return;
    }

    cont.innerHTML = partidos.map((p) => renderPartidoCard(p)).join("");
  } catch (error) {
    mostrarNotificacion("Error cargando partidos", "error");
    console.error(error);
  }
}

// ====================================
// Tarjeta de partido
// ====================================
function renderPartidoCard(p) {
  return `
    <div class="campeonato-card">
      <div class="campeonato-header">
        <h3>${p.equipo_local_nombre} vs ${p.equipo_visitante_nombre}</h3>
      </div>

      <div class="campeonato-info">
        <p><strong>Fecha:</strong> ${p.fecha_partido || "Por definir"}</p>
        <p><strong>Hora:</strong> ${(p.hora_partido || "--:--")
          .toString()
          .substring(0, 5)}</p>
        <p><strong>Cancha:</strong> ${p.cancha || "Por definir"}</p>
        <p><strong>Jornada:</strong> ${p.jornada || "-"}</p>
      </div>

      <div class="campeonato-actions">
        <button class="btn btn-warning" onclick="editarPartido(${p.id})">
          <i class="fas fa-edit"></i> Editar
        </button>
        <button class="btn btn-danger" onclick="eliminarPartido(${p.id})">
          <i class="fas fa-trash"></i> Eliminar
        </button>
      </div>
    </div>
  `;
}

// ====================================
// Eliminar partido
// ====================================
async function eliminarPartido(id) {
  if (!confirm("¿Seguro que quieres eliminar este partido?")) return;

  try {
    await ApiClient.delete(`/partidos/${id}`);
    mostrarNotificacion("Partido eliminado.", "success");
    cargarPartidos();
  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error al eliminar el partido.", "error");
  }
}

// ====================================
// Editar partido (fecha, hora, cancha, jornada)
// ====================================
async function editarPartido(id) {
  try {
    const resp = await ApiClient.get(`/partidos/${id}`);
    const p = resp.partido || resp;

    if (!p) {
      mostrarNotificacion("No se pudo cargar el partido.", "error");
      return;
    }

    const fechaActual = p.fecha_partido || "";
    const nuevaFecha = prompt("Fecha del partido (YYYY-MM-DD):", fechaActual);
    if (!nuevaFecha) return;

    const horaActual = (p.hora_partido || "15:00:00").toString().substring(0, 5);
    const nuevaHora = prompt("Hora del partido (HH:MM):", horaActual);
    if (!nuevaHora) return;

    const nuevaCancha = prompt("Cancha:", p.cancha || "Cancha 1");
    if (!nuevaCancha) return;

    const jornadaActual = p.jornada || "";
    const nuevaJornadaStr = prompt("Jornada (número):", String(jornadaActual));
    if (!nuevaJornadaStr) return;

    const nuevaJornada = parseInt(nuevaJornadaStr, 10);
    if (!Number.isFinite(nuevaJornada) || nuevaJornada <= 0) {
      mostrarNotificacion("Jornada inválida.", "error");
      return;
    }

    await ApiClient.put(`/partidos/${id}`, {
      fecha_partido: nuevaFecha,
      hora_partido: nuevaHora.length === 5 ? `${nuevaHora}:00` : nuevaHora,
      cancha: nuevaCancha,
      jornada: nuevaJornada, // ✅ ahora sí editable
    });

    mostrarNotificacion("Partido actualizado.", "success");
    cargarPartidos();
  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error al editar el partido.", "error");
  }
}

// ====================================
// Generar Fixture (backend)
// ====================================
async function generarFixture() {
  if (!campeonatoSeleccionado) {
    mostrarNotificacion("Selecciona un campeonato primero.", "warning");
    return;
  }

  const modoInput = document.querySelector('input[name="modo-fixture"]:checked');
  const modo = modoInput ? modoInput.value : "grupo";
  const idaYVuelta = document.getElementById("chk-ida-vuelta").checked;

  // ✅ Pedimos solo lo que sirve para ambos
  const duracionMin = prompt(
    "Tiempo de juego del partido en minutos (ej: 90 fútbol 11 / 60 fútbol 7):",
    "90"
  );
  if (!duracionMin) return;

  const descansoMin = prompt(
    "Descanso entre partidos en minutos (ej: 10):",
    "10"
  );
  if (!descansoMin) return;

  const canchaBase = prompt(
    "Cancha base por defecto (puedes editar luego partido por partido):",
    "Don Rafa"
  );
  if (!canchaBase) return;

  // Confirmación
  let mensajeConfirm = "";

  if (modo === "grupo") {
    if (!grupoSeleccionado) {
      mostrarNotificacion("Selecciona un grupo para generar el fixture por grupo.", "warning");
      return;
    }

    mensajeConfirm =
      "Se GENERARÁ el fixture para este grupo.\n\n" +
      "⚠️ Si ya existen partidos en este grupo, serán ELIMINADOS y reemplazados.\n\n" +
      "¿Continuar?";
  } else {
    mensajeConfirm =
      "Se GENERARÁ el fixture COMPLETO por JORNADAS (todos los grupos) usando:\n" +
      "✅ fecha_inicio y fecha_fin del campeonato\n" +
      "✅ horarios por defecto fin de semana (Sáb/Dom)\n\n" +
      "⚠️ Si ya existen partidos en este campeonato, serán ELIMINADOS y reemplazados.\n\n" +
      "¿Continuar?";
  }

  if (!confirm(mensajeConfirm)) return;

  try {
    if (modo === "grupo") {
      // 🔹 Por grupo (usa tu endpoint actual)
      await ApiClient.post("/partidos/generar-fixture", {
        grupo_id: parseInt(grupoSeleccionado),
        reemplazar: true,
        ida_y_vuelta: idaYVuelta,
        duracion_min: parseInt(duracionMin, 10),
        descanso_min: parseInt(descansoMin, 10),
        cancha_base: canchaBase,
        // NOTA: aquí opcionalmente puedes seguir mandando hora_inicio/hora_fin si tu backend los usa.
      });
    } else {
      // 🔹 Campeonato completo por jornadas fin de semana (NUEVO)
      await ApiClient.post("/partidos/generar-fixture-completo", {
        campeonato_id: parseInt(campeonatoSeleccionado),
        reemplazar: true,
        ida_y_vuelta: idaYVuelta,
        duracion_min: parseInt(duracionMin, 10),
        descanso_min: parseInt(descansoMin, 10),
        cancha_base: canchaBase,
      });
    }

    mostrarNotificacion("¡Fixture generado correctamente!", "success");
    cargarPartidos();
  } catch (error) {
    console.error(error);
    mostrarNotificacion(
      "Error al generar el fixture. Revisa consola y que el campeonato tenga fecha_inicio/fecha_fin.",
      "error"
    );
  }
}

// ====================================
// Exportar CSV
// ====================================
async function exportarFixture() {
  if (!campeonatoSeleccionado) {
    mostrarNotificacion("Selecciona un campeonato primero.", "warning");
    return;
  }

  let url = "";
  let nombreArchivo = "";

  if (grupoSeleccionado) {
    url = `/partidos/exportar/grupo/${grupoSeleccionado}`;
    nombreArchivo = `fixture_grupo_${grupoSeleccionado}.csv`;
  } else {
    url = `/partidos/exportar/campeonato/${campeonatoSeleccionado}`;
    nombreArchivo = `fixture_campeonato_${campeonatoSeleccionado}.csv`;
  }

  try {
    const respuesta = await fetch(`${API_BASE_URL}${url}`);
    if (!respuesta.ok) {
      mostrarNotificacion("No se pudo exportar el fixture.", "error");
      return;
    }

    const blob = await respuesta.blob();
    const enlace = document.createElement("a");
    const urlBlob = URL.createObjectURL(blob);
    enlace.href = urlBlob;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(urlBlob);
  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error al exportar el fixture.", "error");
  }
}

// ====================================
// Tarjeta de Jornada (campeonato completo)
// ====================================
function abrirTarjetaFixture() {
  if (!campeonatoSeleccionado) {
    mostrarNotificacion("Selecciona un campeonato primero.", "warning");
    return;
  }

  const jornadaStr = prompt(
    "Número de jornada a mostrar en la tarjeta (ej: 1, 2, 3...):",
    "1"
  );
  if (!jornadaStr) return;

  const jornada = parseInt(jornadaStr, 10);
  if (!Number.isFinite(jornada) || jornada <= 0) {
    mostrarNotificacion("Número de jornada inválido.", "error");
    return;
  }

  // ✅ Por defecto la tarjeta debe ser “Jornada N” con A,B,C,D juntos
  const url = `fixture.html?campeonato=${campeonatoSeleccionado}&jornada=${jornada}`;
  window.open(url, "_blank");
}
