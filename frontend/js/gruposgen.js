// frontend/js/gruposgen.js
const BACKEND_BASE = "http://localhost:5000"; // para logos si vienen como /uploads/...

let contextoGrupos = {
  campeonatoId: null,
  eventoId: null,
  eventoNombre: "",
  auspiciantes: [],
};

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.endsWith("gruposgen.html")) return;

  const select = document.getElementById("select-campeonato-grupos");
  const btnRecargar = document.getElementById("btn-recargar-grupos");

  await cargarCampeonatosEnSelect(select);

  const campeonatoParam = Number.parseInt(getQueryParam("campeonato") || "", 10);
  const eventoParam = Number.parseInt(getQueryParam("evento") || "", 10);

  if (Number.isFinite(eventoParam) && eventoParam > 0) {
    await aplicarContextoEventoDesdeURL(eventoParam, select, campeonatoParam);
  } else if (Number.isFinite(campeonatoParam) && campeonatoParam > 0) {
    select.value = String(campeonatoParam);
    contextoGrupos = {
      campeonatoId: campeonatoParam,
      eventoId: null,
      eventoNombre: "",
      auspiciantes: [],
    };
    await cargarYMostrarGrupos({ campeonatoId: campeonatoParam, eventoId: null });
  }

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

    await cargarYMostrarGrupos({ campeonatoId, eventoId: null });
  });

  btnRecargar.addEventListener("click", async () => {
    const campeonatoId = Number.parseInt(select.value || "", 10);
    const eventoId = getEventoIdActual();

    if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
      mostrarNotificacion("Selecciona un campeonato", "warning");
      return;
    }

    await cargarYMostrarGrupos({ campeonatoId, eventoId });
  });
});

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
    const orgLogoEl = document.getElementById("poster-org-logo");

    if (orgLogoEl && camp.logo_url) {
      //orgLogoEl.src = normalizarLogoUrl(camp.logo_url);
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
  // Si viene como /uploads/...
  if (logoUrl.startsWith("/")) return `${BACKEND_BASE}${logoUrl}`;
  // Si viene sin slash
  return `${BACKEND_BASE}/${logoUrl}`;
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
  window.location.href = "index.html";
}

function getZonaExport() {
  const el = document.getElementById("zona-grupos-export");
  if (!el) {
    alert("No se encontró la zona de grupos para exportar.");
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
          if (img.complete && img.naturalHeight > 0) return resolve();
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true }); // no bloquea si falla una
        })
    )
  );
}

async function exportarGruposPNG() {
  const zona = getZonaExport();
  if (!zona) return;

  await esperarImagenes(zona);
  await inlineImagesAsBase64(zona);

  const canvas = await html2canvas(zona, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCors: true,
  });
  const dataUrl = canvas.toDataURL("image/png");

  const a = document.createElement("a");
  a.href = dataUrl;
  const baseName = getEventoIdActual()
    ? `grupos_evento_${getEventoIdActual()}`
    : `grupos_campeonato_${getCampeonatoIdActual() || "sin_id"}`;
  a.download = `${baseName}.png`;
  a.click();
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
  const zona = getZonaExport();
  if (!zona) return;

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
}

async function compartirRedes() {
  const zona = getZonaExport();
  if (!zona) return;

  await esperarImagenes(zona);
  await inlineImagesAsBase64(zona);

  const canvas = await html2canvas(zona, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCors: true,
  });
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );

  const file = new File(
    [blob],
    getEventoIdActual()
      ? `grupos_evento_${getEventoIdActual()}.png`
      : `grupos_campeonato_${getCampeonatoIdActual() || "sin_id"}.png`,
    {
      type: "image/png",
    }
  );

  const shareData = {
    title: "Grupos del Campeonato",
    text: "Te comparto los grupos del campeonato.",
    files: [file],
  };

  if (
    navigator.share &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share(shareData);
    } catch (e) {
      console.warn("Share cancelado o falló:", e);
    }
    return;
  }

  alert(
    "Tu navegador no permite compartir directo. Se descargará la imagen para que la subas a redes."
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function getCampeonatoIdActual() {
  if (contextoGrupos.campeonatoId) return String(contextoGrupos.campeonatoId);

  const select = document.getElementById("select-campeonato-grupos");
  if (select && select.value) return select.value;

  const params = new URLSearchParams(window.location.search);
  return params.get("campeonato");
}

function getEventoIdActual() {
  if (contextoGrupos.eventoId) return String(contextoGrupos.eventoId);

  const params = new URLSearchParams(window.location.search);
  return params.get("evento");
}

