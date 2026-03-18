// frontend/js/gruposgen.js
const BACKEND_BASE = (window.resolveBackendBaseUrl
  ? window.resolveBackendBaseUrl()
  : `${window.location.origin}`).replace(/\/$/, "");

let contextoGrupos = {
  campeonatoId: null,
  eventoId: null,
  eventoNombre: "",
  auspiciantes: [],
};

let gruposUiState = {
  eventosPlayoff: [],
  playoffIframeSrc: "",
  tabActiva: "panel-grupos",
};
let gruposEventosCache = [];

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("gruposgen.html")) return;

  const select = document.getElementById("select-campeonato-grupos");
  const selectEventoGrupos = document.getElementById("select-evento-grupos");
  const btnRecargar = document.getElementById("btn-recargar-grupos");
  const btnExportImg = document.getElementById("btn-grupos-export-img");
  const btnExportPdf = document.getElementById("btn-grupos-export-pdf");
  const btnShare = document.getElementById("btn-grupos-share");
  const btnPrint = document.getElementById("btn-grupos-print");
  const btnVolver = document.getElementById("btn-grupos-volver");
  const btnPlayoffCargarTab = document.getElementById("btn-playoff-cargar-tab");
  const btnPlayoffAbrirFull = document.getElementById("btn-playoff-abrir-full");
  const selectPlayoffEvento = document.getElementById("playoff-evento-select");

  configurarTabsGrupos();

  await cargarCampeonatosEnSelect(select);

  const routeContext = window.RouteContext?.read?.("gruposgen.html", ["campeonato", "evento"]) || {};
  const campeonatoParam = Number.parseInt(routeContext.campeonato || "", 10);
  const eventoParam = Number.parseInt(routeContext.evento || "", 10);

  if (Number.isFinite(eventoParam) && eventoParam > 0) {
    await aplicarContextoEventoDesdeURL(eventoParam, select, campeonatoParam);
    await cargarEventosEnSelectGrupos(getCampeonatoIdActual(), eventoParam);
  } else if (Number.isFinite(campeonatoParam) && campeonatoParam > 0) {
    select.value = String(campeonatoParam);
    contextoGrupos = {
      campeonatoId: campeonatoParam,
      eventoId: null,
      eventoNombre: "",
      auspiciantes: [],
    };
    await cargarEventosEnSelectGrupos(campeonatoParam, null);
    await cargarYMostrarGrupos({ campeonatoId: campeonatoParam, eventoId: null });
  } else {
    await cargarEventosEnSelectGrupos(null, null);
  }
  await refrescarSelectEventoPlayoff(getCampeonatoIdActual(), getEventoIdActual());

  select.addEventListener("change", async () => {
    const id = select.value;
    if (!id) return;

    const campeonatoId = Number.parseInt(id, 10);
    contextoGrupos = {
      campeonatoId,
      eventoId: null,
      eventoNombre: "",
      auspiciantes: [],
    };
    window.RouteContext?.save?.("gruposgen.html", {
      campeonato: campeonatoId,
      evento: null,
    });

    await cargarEventosEnSelectGrupos(campeonatoId, null);
    await cargarYMostrarGrupos({ campeonatoId, eventoId: null });
    await refrescarSelectEventoPlayoff(campeonatoId, null);
  });

  selectEventoGrupos?.addEventListener("change", async () => {
    const campeonatoId = Number.parseInt(select.value || "", 10);
    if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
      mostrarNotificacion("Selecciona un campeonato primero", "warning");
      return;
    }

    const eventoId = Number.parseInt(selectEventoGrupos.value || "", 10);
    const evento = gruposEventosCache.find((e) => Number(e.id) === Number(eventoId)) || null;
    const eventoNombre = evento?.nombre || "";

    contextoGrupos = {
      campeonatoId,
      eventoId: Number.isFinite(eventoId) && eventoId > 0 ? eventoId : null,
      eventoNombre,
      auspiciantes: [],
    };
    window.RouteContext?.save?.("gruposgen.html", {
      campeonato: campeonatoId,
      evento: contextoGrupos.eventoId,
    });

    await cargarYMostrarGrupos({
      campeonatoId,
      eventoId: contextoGrupos.eventoId,
      eventoNombre: contextoGrupos.eventoNombre,
    });
    await refrescarSelectEventoPlayoff(campeonatoId, contextoGrupos.eventoId);
  });

  btnRecargar.addEventListener("click", async () => {
    const campeonatoId = Number.parseInt(select.value || "", 10);
    const eventoIdRaw = Number.parseInt(selectEventoGrupos?.value || "", 10);
    const eventoId = Number.isFinite(eventoIdRaw) && eventoIdRaw > 0 ? eventoIdRaw : null;
    const evento = gruposEventosCache.find((e) => Number(e.id) === Number(eventoId)) || null;

    if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
      mostrarNotificacion("Selecciona un campeonato", "warning");
      return;
    }

    await cargarYMostrarGrupos({ campeonatoId, eventoId, eventoNombre: evento?.nombre || "" });
    await refrescarSelectEventoPlayoff(campeonatoId, eventoId);
  });

  btnExportImg?.addEventListener("click", exportarGruposPNG);
  btnExportPdf?.addEventListener("click", exportarPDF);
  btnShare?.addEventListener("click", compartirRedes);
  btnPrint?.addEventListener("click", () => window.print());
  btnVolver?.addEventListener("click", volverInicio);
  btnPlayoffCargarTab?.addEventListener("click", cargarPlayoffEnPestana);
  btnPlayoffAbrirFull?.addEventListener("click", irAClasificacionPlayoff);
  selectPlayoffEvento?.addEventListener("change", () => {
    limpiarIframePlayoff();
  });
});

function configurarTabsGrupos() {
  const tabs = Array.from(document.querySelectorAll(".grupos-main-tab"));
  if (!tabs.length) return;
  tabs.forEach((tab) => {
    tab.addEventListener("click", async () => {
      const panelId = tab.dataset.tabTarget || "";
      activarTabGrupos(panelId);
      if (panelId === "panel-playoff") {
        await cargarPlayoffEnPestana();
      }
    });
  });
}

function activarTabGrupos(panelId) {
  if (!panelId) return;
  const tabs = Array.from(document.querySelectorAll(".grupos-main-tab"));
  const panels = Array.from(document.querySelectorAll(".grupos-tab-panel"));
  tabs.forEach((tab) => {
    const active = tab.dataset.tabTarget === panelId;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  panels.forEach((panel) => {
    const active = panel.id === panelId;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
  gruposUiState.tabActiva = panelId;
}

async function refrescarSelectEventoPlayoff(campeonatoIdRaw, eventoPreferidoRaw = null) {
  const select = document.getElementById("playoff-evento-select");
  const help = document.getElementById("playoff-tab-help");
  if (!select) return;

  const campeonatoId = Number.parseInt(campeonatoIdRaw || "", 10);
  const eventoPreferido = Number.parseInt(eventoPreferidoRaw || "", 10);
  select.innerHTML = '<option value="">Selecciona una categoría</option>';
  gruposUiState.eventosPlayoff = [];
  limpiarIframePlayoff();

  if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
    if (help) help.textContent = "Selecciona un campeonato para habilitar playoff.";
    return;
  }

  try {
    const data = await ApiClient.get(`/eventos/campeonato/${campeonatoId}`);
    const eventos = Array.isArray(data?.eventos) ? data.eventos : [];
    gruposUiState.eventosPlayoff = eventos;
    if (!eventos.length) {
      if (help) help.textContent = "Este campeonato todavía no tiene categorías.";
      return;
    }

    eventos.forEach((evento) => {
      const option = document.createElement("option");
      option.value = String(evento.id);
      option.textContent = evento.nombre || `Categoría #${evento.id}`;
      select.appendChild(option);
    });

    const eventoSeleccionado = Number.isFinite(eventoPreferido) && eventoPreferido > 0
      ? eventoPreferido
      : Number.parseInt(select.value || "", 10) || Number.parseInt(eventos[0]?.id || "", 10);
    if (Number.isFinite(eventoSeleccionado) && eventoSeleccionado > 0) {
      select.value = String(eventoSeleccionado);
    }

    if (help) help.textContent = "La configuración se abre directamente en esta pestaña.";
  } catch (error) {
    console.error("No se pudieron cargar categorías para playoff:", error);
    if (help) help.textContent = "No se pudieron cargar categorías para playoff.";
  }
}

function getEventoPlayoffSeleccionado() {
  const select = document.getElementById("playoff-evento-select");
  const value = Number.parseInt(select?.value || "", 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function construirUrlPlayoff({ embed }) {
  const eventoId = getEventoPlayoffSeleccionado() || Number.parseInt(getEventoIdActual() || "", 10);
  if (!Number.isFinite(eventoId) || eventoId <= 0) return null;
  if (window.RouteContext?.save) {
    window.RouteContext.save("eliminatorias.html", { evento: eventoId });
  }
  const params = new URLSearchParams();
  if (embed) params.set("embed", "1");
  return params.toString() ? `eliminatorias.html?${params.toString()}` : "eliminatorias.html";
}

function limpiarIframePlayoff() {
  const iframe = document.getElementById("playoff-embed-frame");
  if (!iframe) return;
  iframe.removeAttribute("src");
  gruposUiState.playoffIframeSrc = "";
}

async function cargarPlayoffEnPestana() {
  const iframe = document.getElementById("playoff-embed-frame");
  if (!iframe) return;

  const url = construirUrlPlayoff({ embed: true });
  if (!url) {
    mostrarNotificacion("Selecciona una categoría para abrir playoff.", "warning");
    return;
  }

  if (gruposUiState.playoffIframeSrc === url) return;
  gruposUiState.playoffIframeSrc = url;
  iframe.src = url;
}

async function aplicarContextoEventoDesdeURL(
  eventoId,
  selectCampeonato,
  campeonatoIdFallback = null
) {
  let campeonatoId = Number.isFinite(campeonatoIdFallback)
    ? campeonatoIdFallback
    : null;
  let eventoNombre = "";

  try {
    const data = await ApiClient.get(`/eventos/${eventoId}`);
    const evento = data.evento || data || {};
    campeonatoId = Number.parseInt(evento.campeonato_id, 10) || campeonatoId;
    eventoNombre = evento.nombre || "";
  } catch (e) {
    console.warn("No se pudo cargar detalle del evento para contexto:", e);
  }

  if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
    mostrarNotificacion("No se pudo resolver el campeonato del evento", "warning");
    return;
  }

  selectCampeonato.value = String(campeonatoId);

  contextoGrupos = {
    campeonatoId,
    eventoId,
    eventoNombre,
    auspiciantes: [],
  };

  await cargarYMostrarGrupos({ campeonatoId, eventoId, eventoNombre });
}

async function cargarCampeonatosEnSelect(select) {
  try {
    const data = await ApiClient.get("/campeonatos");
    const lista = data.campeonatos || [];

    select.innerHTML = `<option value="">— Selecciona un campeonato —</option>`;
    lista.forEach((c) => {
      select.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });
  } catch (e) {
    console.error(e);
    mostrarNotificacion("Error cargando campeonatos", "error");
  }
}

async function cargarEventosEnSelectGrupos(campeonatoIdRaw, eventoPreferidoRaw = null) {
  const selectEvento = document.getElementById("select-evento-grupos");
  if (!selectEvento) return;

  const campeonatoId = Number.parseInt(campeonatoIdRaw || "", 10);
  const eventoPreferido = Number.parseInt(eventoPreferidoRaw || "", 10);
  gruposEventosCache = [];
  selectEvento.innerHTML = '<option value="">— Todas las categorías —</option>';

  if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
    selectEvento.disabled = true;
    return;
  }

  try {
    const data = await ApiClient.get(`/eventos/campeonato/${campeonatoId}`);
    const eventos = Array.isArray(data?.eventos) ? data.eventos : [];
    gruposEventosCache = eventos;

    eventos.forEach((evento) => {
      const option = document.createElement("option");
      option.value = String(evento.id);
      option.textContent = evento.nombre || `Categoría #${evento.id}`;
      selectEvento.appendChild(option);
    });

    if (Number.isFinite(eventoPreferido) && eventoPreferido > 0) {
      const existe = eventos.some((e) => Number(e.id) === Number(eventoPreferido));
      selectEvento.value = existe ? String(eventoPreferido) : "";
    } else {
      selectEvento.value = "";
    }
    selectEvento.disabled = false;
  } catch (error) {
    console.error("No se pudieron cargar categorías para grupos:", error);
    selectEvento.disabled = true;
  }
}

async function cargarCabeceraCampeonato(campeonatoId, eventoNombre = "") {
  try {
    const data = await ApiClient.get(`/campeonatos/${campeonatoId}`);
    const camp = data.campeonato || data;

    const organizadorEl = document.getElementById("poster-organizador");
    const tituloEl = document.getElementById("poster-titulo");
    const detalleEl = document.getElementById("poster-detalle");

    if (organizadorEl) {
      organizadorEl.textContent = `${camp.organizador || "No registrado"}`;
    }
    if (tituloEl) {
      tituloEl.textContent = (camp.nombre || "TORNEO").toUpperCase();
    }
    if (detalleEl) {
      const tipo = (camp.tipo_futbol || "").replaceAll("_", " ").toUpperCase();
      const fi = formatearFecha(camp.fecha_inicio);
      const ff = formatearFecha(camp.fecha_fin);
      const detalleBase = `${tipo}${
        fi || ff ? ` • ${fi}${ff ? " - " + ff : ""}` : ""
      }`;
      const detalleEvento = eventoNombre
        ? ` • CATEGORÍA: ${String(eventoNombre).toUpperCase()}`
        : "";
      detalleEl.textContent = `${detalleBase}${detalleEvento}`;
    }
    // Guardar colores del campeonato para el tema "Torneo"
    const poster = document.getElementById("zona-grupos-export");
    if (poster) {
      const primario = camp.color_primario || "#1e3a5f";
      const secundario = camp.color_secundario || "#0b1f35";
      const acento = camp.color_acento || "#facc15";
      poster.style.setProperty("--t-primario", primario);
      poster.style.setProperty("--t-secundario", secundario);
      poster.style.setProperty("--t-acento", acento);
    }

    const orgLogoEl = document.getElementById("poster-org-logo");

    if (orgLogoEl && camp.logo_url) {
      const logoOrg = normalizarLogoUrl(camp.logo_url || null);
      if (logoOrg) {
        orgLogoEl.src = logoOrg;
        orgLogoEl.crossOrigin = "anonymous";
        orgLogoEl.referrerPolicy = "no-referrer";
        orgLogoEl.style.display = "block";
      } else {
        orgLogoEl.removeAttribute("src");
        orgLogoEl.style.display = "none";
      }
      /*if (orgLogoEl) {
        if (logoOrg) {
          orgLogoEl.src = logoOrg;
          orgLogoEl.style.display = "block";
        } else {
          // si no hay logo, lo ocultamos para que no rompa el layout
          orgLogoEl.removeAttribute("src");
          orgLogoEl.style.display = "none";
        }
      }*/
    }
  } catch (e) {
    console.warn("No se pudo cargar cabecera del campeonato:", e);
  }
}

function normalizarLogoUrl(logoUrl) {
  if (!logoUrl) return null;
  // Si ya viene como http(s) lo devolvemos
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  const limpio = String(logoUrl).trim();
  if (!limpio) return null;
  if (limpio.startsWith("/uploads/")) return `${BACKEND_BASE}${limpio}`;
  if (limpio.startsWith("uploads/")) return `${BACKEND_BASE}/${limpio}`;
  if (limpio.startsWith("/")) return `${BACKEND_BASE}${limpio}`;
  return `${BACKEND_BASE}/uploads/${limpio}`;
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return "";
  const d = new Date(fechaISO);
  if (Number.isNaN(d.getTime())) return String(fechaISO);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function aplicarLayoutPorCantidadGrupos(cant) {
  const posterGrupos = document.getElementById("poster-grupos");
  if (!posterGrupos) return;

  // reset
  posterGrupos.classList.remove("cols-2", "cols-3", "cols-4");

  if (cant <= 2) posterGrupos.classList.add("cols-2");
  else if (cant === 3) posterGrupos.classList.add("cols-3");
  else if (cant === 4) posterGrupos.classList.add("cols-4");
  else posterGrupos.classList.add("cols-3"); // 5 o 6 grupos -> 3 columnas se ve mejor
}

async function cargarYMostrarGrupos(ctx) {
  const posterGrupos = document.getElementById("poster-grupos");
  if (!posterGrupos) return;

  posterGrupos.innerHTML = "<p style='padding:12px'>Cargando grupos...</p>";
  const campeonatoId =
    typeof ctx === "object"
      ? Number.parseInt(ctx.campeonatoId, 10)
      : Number.parseInt(ctx, 10);
  const eventoId =
    typeof ctx === "object" ? Number.parseInt(ctx.eventoId, 10) : null;
  const eventoNombre =
    typeof ctx === "object" ? String(ctx.eventoNombre || "") : "";

  if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
    posterGrupos.innerHTML =
      "<p style='padding:12px'>Selecciona un campeonato válido.</p>";
    return;
  }

  // llenar cabecera arriba
  await cargarCabeceraCampeonato(campeonatoId, eventoNombre);
  await cargarAuspiciantesGrupos(campeonatoId);

  try {
    const endpoint =
      Number.isFinite(eventoId) && eventoId > 0
        ? `/grupos/evento/${eventoId}/completo`
        : `/grupos/campeonato/${campeonatoId}/completo`;

    const data = await ApiClient.get(endpoint);

    const grupos = data.grupos || [];
    aplicarLayoutPorCantidadGrupos(grupos.length);

    if (grupos.length === 0) {
      posterGrupos.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-users-slash"></i>
          <p>${
            Number.isFinite(eventoId) && eventoId > 0
              ? "No hay grupos creados para esta categoría."
              : "No hay grupos creados para este campeonato."
          }</p>
        </div>`;
      return;
    }

    // ordenar Grupo A, B, C...
    grupos.sort((a, b) =>
      (a.letra_grupo || "").localeCompare(b.letra_grupo || "")
    );

    posterGrupos.innerHTML = "";

    grupos.forEach((g, idx) => {
      const letra = g.letra_grupo || String.fromCharCode(65 + idx);
      const equipos = g.equipos || [];

      const columna = document.createElement("div");
      columna.className = "poster-col";

      const equiposHTML = equipos.length
        ? equipos
            .map((eq, i) => {
              const logo = normalizarLogoUrl(
                eq.logo_url || eq.escudo_url || eq.logo || null
              );
              return `
              <div class="team-row">
                ${
                  logo
                    ? `<img class="team-logo" src="${logo}" alt="${eq.nombre}" crossorigin="anonymous" referrerpolicy="no-referrer">`
                    : `<div class="team-logo placeholder"></div>`
                }
                <div class="team-name">${eq.nombre}</div>
              </div>
            `;
            })
            .join("")
        : `<div class="empty-equipos">Sin equipos asignados</div>`;

      columna.innerHTML = `
        <div class="col-header">GRUPO ${letra}</div>
        <div class="col-body">${equiposHTML}</div>
      `;

      posterGrupos.appendChild(columna);
    });

    mostrarNotificacion("✅ Grupos cargados", "success");
  } catch (e) {
    console.error(e);
    mostrarNotificacion("Error cargando grupos", "error");
    posterGrupos.innerHTML =
      "<p style='padding:12px'>Error cargando grupos.</p>";
  }
}

async function imgToDataURL(url) {
  const res = await fetch(url, { mode: "cors", cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`No se pudo cargar imagen (${res.status})`);
  }
  const blob = await res.blob();

  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result); // dataURL
    reader.readAsDataURL(blob);
  });
}

async function inlineImagesAsBase64(zona) {
  const imgs = Array.from(zona.querySelectorAll("img"));

  for (const img of imgs) {
    try {
      const src = img.getAttribute("src");
      if (!src) continue;

      // si ya es base64, saltar
      if (src.startsWith("data:")) continue;

      const dataUrl = await imgToDataURL(src);
      img.setAttribute("src", dataUrl);
    } catch (e) {
      console.warn("No se pudo convertir imagen a base64:", img.src, e);
    }
  }
}

function volverInicio() {
  const campeonatoId = getCampeonatoIdActual();
  const eventoId = getEventoIdActual();
  if (window.RouteContext?.navigate) {
    window.RouteContext.navigate("sorteo.html", {
      campeonato: Number.parseInt(campeonatoId || "", 10) || null,
      evento: Number.parseInt(eventoId || "", 10) || null,
    });
    return;
  }
  const params = new URLSearchParams();
  if (campeonatoId) params.set("campeonato", String(campeonatoId));
  if (eventoId) params.set("evento", String(eventoId));
  window.location.href = params.toString() ? `sorteo.html?${params.toString()}` : "sorteo.html";
}

function getZonaExport() {
  const el = document.getElementById("zona-grupos-export");
  if (!el) {
    window.mostrarAlerta({
      titulo: "No se pudo exportar",
      mensaje: "No se encontró la zona de grupos para exportar.",
      tipo: "warning",
    });
    return null;
  }
  return el;
}
async function esperarImagenes(zona) {
  const imgs = Array.from(zona.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          let done = false;
          const finalizar = () => {
            if (done) return;
            done = true;
            resolve();
          };
          if (img.complete) return finalizar();
          img.addEventListener("load", finalizar, { once: true });
          img.addEventListener("error", finalizar, { once: true }); // no bloquea si falla una
          setTimeout(finalizar, 5000); // evita bloqueo si la imagen quedó en estado intermedio
        })
    )
  );
}

async function exportarGruposPNG() {
  try {
    const zona = getZonaExport();
    if (!zona) return;
    if (!window.html2canvas) {
      mostrarNotificacion("No se cargó html2canvas", "error");
      return;
    }

    await esperarImagenes(zona);
    await inlineImagesAsBase64(zona);

    const canvas = await html2canvas(zona, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCors: true,
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("No se pudo generar blob de imagen");

    const baseName = getEventoIdActual()
      ? `grupos_evento_${getEventoIdActual()}`
      : `grupos_campeonato_${getCampeonatoIdActual() || "sin_id"}`;
    descargarBlob(blob, `${baseName}.png`);
    mostrarNotificacion("Imagen exportada", "success");
  } catch (error) {
    console.error("Error exportando imagen de grupos:", error);
    mostrarNotificacion("No se pudo exportar imagen", "error");
  }
}

async function cargarAuspiciantesGrupos(campeonatoId) {
  const wrap = document.getElementById("poster-sponsors");
  const grid = document.getElementById("sponsors-grid");
  if (!wrap || !grid) return;

  wrap.style.display = "none";
  grid.innerHTML = "";

  if (!Number.isFinite(Number(campeonatoId)) || Number(campeonatoId) <= 0) return;

  try {
    const data = await ApiClient.get(`/auspiciantes/campeonato/${campeonatoId}?activo=1`);
    const lista = Array.isArray(data?.auspiciantes) ? data.auspiciantes : [];
    contextoGrupos.auspiciantes = lista;

    if (!lista.length) return;

    grid.innerHTML = lista
      .map((a) => {
        const logo = normalizarLogoUrl(a.logo_url || "");
        const nombre = String(a.nombre || "Auspiciante");
        return `
          <div class="sponsor-item">
            ${
              logo
                ? `<img src="${logo}" alt="${nombre}" crossorigin="anonymous" referrerpolicy="no-referrer" />`
                : `<div class="sponsor-name">${nombre}</div>`
            }
          </div>
        `;
      })
      .join("");

    wrap.style.display = "block";
  } catch (error) {
    contextoGrupos.auspiciantes = [];
    console.warn("No se pudieron cargar auspiciantes:", error);
  }
}

async function exportarPDF() {
  try {
    const zona = getZonaExport();
    if (!zona) return;
    if (!window.html2canvas || !window.jspdf?.jsPDF) {
      mostrarNotificacion("No se cargó librería PDF", "error");
      return;
    }

    await esperarImagenes(zona);
    await inlineImagesAsBase64(zona);

    const canvas = await html2canvas(zona, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCors: true,
    });
    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgProps = pdf.getImageProperties(imgData);
    const imgWidth = pageWidth;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

    let y = 10;
    if (imgHeight <= pageHeight - 20) {
      pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
    } else {
      const scale = (pageHeight - 20) / imgHeight;
      const newW = imgWidth * scale;
      const newH = imgHeight * scale;
      pdf.addImage(imgData, "PNG", (pageWidth - newW) / 2, y, newW, newH);
    }

    const baseName = getEventoIdActual()
      ? `grupos_evento_${getEventoIdActual()}`
      : `grupos_campeonato_${getCampeonatoIdActual() || "sin_id"}`;
    pdf.save(`${baseName}.pdf`);
    mostrarNotificacion("PDF exportado", "success");
  } catch (error) {
    console.error("Error exportando PDF de grupos:", error);
    mostrarNotificacion("No se pudo exportar PDF", "error");
  }
}

async function compartirRedes() {
  try {
    const zona = getZonaExport();
    if (!zona) return;
    if (!window.html2canvas) {
      mostrarNotificacion("No se cargó html2canvas", "error");
      return;
    }

    await esperarImagenes(zona);
    await inlineImagesAsBase64(zona);

    const canvas = await html2canvas(zona, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCors: true,
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      mostrarNotificacion("No se pudo preparar la imagen para compartir", "error");
      return;
    }

    const filename = getEventoIdActual()
      ? `grupos_evento_${getEventoIdActual()}.png`
      : `grupos_campeonato_${getCampeonatoIdActual() || "sin_id"}.png`;
    const file = new File([blob], filename, { type: "image/png" });

    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          title: "Grupos del Campeonato",
          text: "Te comparto los grupos del campeonato.",
          files: [file],
        });
        return;
      } catch (e) {
        console.warn("Share cancelado o falló:", e);
      }
    }

    mostrarNotificacion(
      "Tu navegador no permite compartir directo. Se descargará la imagen.",
      "warning"
    );
    descargarBlob(blob, filename);
  } catch (error) {
    console.error("Error compartiendo grupos:", error);
    mostrarNotificacion("No se pudo compartir la imagen", "error");
  }
}

function descargarBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

function irAClasificacionPlayoff() {
  const eventoId = getEventoPlayoffSeleccionado() || Number.parseInt(getEventoIdActual() || "", 10);
  if (!Number.isFinite(eventoId) || eventoId <= 0) {
    mostrarNotificacion("Selecciona una categoría para abrir playoff.", "warning");
    return;
  }
  if (window.RouteContext?.navigate) {
    window.RouteContext.navigate("eliminatorias.html", { evento: Number(eventoId) || null });
    return;
  }
  window.location.href = `eliminatorias.html?evento=${encodeURIComponent(eventoId)}`;
}

function getCampeonatoIdActual() {
  if (contextoGrupos.campeonatoId) return String(contextoGrupos.campeonatoId);

  const select = document.getElementById("select-campeonato-grupos");
  if (select && select.value) return select.value;

  const stored = window.RouteContext?.load?.("gruposgen.html");
  return stored?.campeonato ? String(stored.campeonato) : null;
}

function getEventoIdActual() {
  const selectEvento = document.getElementById("select-evento-grupos");
  if (selectEvento && selectEvento.value) return selectEvento.value;

  if (contextoGrupos.eventoId) return String(contextoGrupos.eventoId);

  const stored = window.RouteContext?.load?.("gruposgen.html");
  return stored?.evento ? String(stored.evento) : null;
}

window.exportarGruposPNG = exportarGruposPNG;
window.exportarPDF = exportarPDF;
window.compartirRedes = compartirRedes;
window.volverInicio = volverInicio;

function aplicarTemaPoster(tema) {
  const poster = document.getElementById("zona-grupos-export");
  if (!poster) return;
  poster.classList.remove("tema-oscuro", "tema-clasico", "tema-torneo");
  poster.classList.add(`tema-${tema}`);
  document.querySelectorAll(".btn-poster-tema").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tema === tema);
  });
}
window.aplicarTemaPoster = aplicarTemaPoster;
