let ausState = {
  campeonatos: [],
  lista: [],
  editId: null,
};

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("auspiciantes.html")) return;

  document
    .getElementById("btn-aus-guardar")
    ?.addEventListener("click", guardarAuspiciante);
  document
    .getElementById("btn-aus-limpiar")
    ?.addEventListener("click", limpiarFormularioAuspiciante);
  document
    .getElementById("aus-campeonato")
    ?.addEventListener("change", cargarListadoAuspiciantes);

  await cargarCampeonatosAuspiciantes();
  await cargarListadoAuspiciantes();
});

async function cargarCampeonatosAuspiciantes() {
  const select = document.getElementById("aus-campeonato");
  if (!select) return;

  try {
    const data = await ApiClient.get("/campeonatos");
    ausState.campeonatos = data.campeonatos || data || [];
    select.innerHTML = '<option value="">Selecciona campeonato</option>';

    ausState.campeonatos.forEach((c) => {
      const op = document.createElement("option");
      op.value = String(c.id);
      op.textContent = c.nombre || `Campeonato ${c.id}`;
      select.appendChild(op);
    });
  } catch (error) {
    console.error(error);
    mostrarNotificacion("No se pudo cargar campeonatos", "error");
  }
}

async function cargarListadoAuspiciantes() {
  const cont = document.getElementById("aus-listado");
  const campeonatoId = Number.parseInt(
    document.getElementById("aus-campeonato")?.value || "",
    10
  );
  if (!cont) return;

  if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
    ausState.lista = [];
    cont.innerHTML = '<div class="fin-resumen-vacio">Selecciona un campeonato.</div>';
    return;
  }

  cont.innerHTML = '<div class="fin-resumen-vacio">Cargando auspiciantes...</div>';

  try {
    const data = await AuspiciantesAPI.listarPorCampeonato(campeonatoId, false);
    ausState.lista = data.auspiciantes || [];
    renderTablaAuspiciantes();
  } catch (error) {
    console.error(error);
    ausState.lista = [];
    cont.innerHTML = `<div class="fin-resumen-vacio">${error.message || "No se pudo cargar"}</div>`;
  }
}

function renderTablaAuspiciantes() {
  const cont = document.getElementById("aus-listado");
  if (!cont) return;

  if (!ausState.lista.length) {
    cont.innerHTML = '<div class="fin-resumen-vacio">No hay auspiciantes registrados.</div>';
    return;
  }

  const rows = ausState.lista
    .map((x, idx) => {
      const logo = normalizarLogoUrlAuspiciante(x.logo_url);
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>
            ${
              logo
                ? `<img src="${logo}" alt="${escapeHtmlAuspiciante(x.nombre || "-")}" class="aus-logo-thumb" />`
                : "<span>-</span>"
            }
          </td>
          <td>${escapeHtmlAuspiciante(x.nombre || "-")}</td>
          <td>${Number(x.orden || 1)}</td>
          <td>${x.activo ? "Activo" : "Inactivo"}</td>
          <td class="list-table-actions">
            <button class="btn btn-warning" type="button" onclick="editarAuspiciante(${x.id})">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn btn-danger" type="button" onclick="eliminarAuspiciante(${x.id})">
              <i class="fas fa-trash"></i> Eliminar
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  cont.innerHTML = `
    <table class="tabla-estadistica tabla-estadistica-compacta">
      <thead>
        <tr>
          <th>#</th>
          <th>Logo</th>
          <th>Nombre</th>
          <th>Orden</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function guardarAuspiciante() {
  const campeonatoSelect = document.getElementById("aus-campeonato");
  const campeonatoSeleccionado = String(campeonatoSelect?.value || "");
  const campeonatoId = Number.parseInt(campeonatoSeleccionado, 10);
  const nombre = String(document.getElementById("aus-nombre")?.value || "").trim();
  const orden = String(document.getElementById("aus-orden")?.value || "1");
  const activo = String(document.getElementById("aus-activo")?.value || "true");
  const logoFile = document.getElementById("aus-logo")?.files?.[0] || null;

  if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
    mostrarNotificacion("Selecciona un campeonato", "warning");
    return;
  }
  if (!nombre) {
    mostrarNotificacion("Ingresa el nombre del auspiciantes", "warning");
    return;
  }

  const fd = new FormData();
  fd.append("campeonato_id", String(campeonatoId));
  fd.append("nombre", nombre);
  fd.append("orden", orden);
  fd.append("activo", activo);
  if (logoFile) fd.append("logo", logoFile);

  try {
    if (ausState.editId) {
      await AuspiciantesAPI.actualizar(ausState.editId, fd);
      mostrarNotificacion("Auspiciantes actualizado", "success");
    } else {
      await AuspiciantesAPI.crear(fd);
      mostrarNotificacion("Auspiciantes creado", "success");
    }
    limpiarFormularioAuspiciante({
      preservarCampeonato: true,
      campeonatoId: campeonatoSeleccionado,
    });
    await cargarListadoAuspiciantes();
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo guardar", "error");
  }
}

function editarAuspiciante(id) {
  const item = ausState.lista.find((x) => Number(x.id) === Number(id));
  if (!item) return;

  ausState.editId = Number(item.id);
  document.getElementById("aus-nombre").value = item.nombre || "";
  document.getElementById("aus-orden").value = String(item.orden || 1);
  document.getElementById("aus-activo").value = item.activo ? "true" : "false";
  document.getElementById("aus-logo").value = "";
}

async function eliminarAuspiciante(id) {
  const ok = await window.mostrarConfirmacion({
    titulo: "Eliminar auspiciante",
    mensaje: "¿Eliminar este auspiciante del campeonato seleccionado?",
    tipo: "warning",
    textoConfirmar: "Eliminar",
    claseConfirmar: "btn-danger",
  });
  if (!ok) return;
  try {
    await AuspiciantesAPI.eliminar(id);
    mostrarNotificacion("Auspiciantes eliminado", "success");
    if (Number(ausState.editId) === Number(id)) limpiarFormularioAuspiciante();
    await cargarListadoAuspiciantes();
  } catch (error) {
    console.error(error);
    mostrarNotificacion(error.message || "No se pudo eliminar", "error");
  }
}

function limpiarFormularioAuspiciante(opts = {}) {
  const preservarCampeonato = Boolean(opts.preservarCampeonato);
  const campeonatoId = String(opts.campeonatoId || "");

  ausState.editId = null;
  document.getElementById("aus-nombre").value = "";
  document.getElementById("aus-orden").value = "1";
  document.getElementById("aus-activo").value = "true";
  document.getElementById("aus-logo").value = "";

  if (preservarCampeonato) {
    const selectCampeonato = document.getElementById("aus-campeonato");
    if (selectCampeonato) selectCampeonato.value = campeonatoId;
  }
}

function normalizarLogoUrlAuspiciante(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const base = (window.API_BASE_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
}

function escapeHtmlAuspiciante(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

window.editarAuspiciante = editarAuspiciante;
window.eliminarAuspiciante = eliminarAuspiciante;

