// frontend/js/fixture.js

const API_BASE = (typeof API_BASE_URL !== "undefined")
  ? API_BASE_URL
  : "http://localhost:5000/api";

const UPLOADS_BASE = API_BASE.replace(/\/api$/, "");

function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function toAbsUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${UPLOADS_BASE}${url}`;
  return `${UPLOADS_BASE}/${url}`;
}

function safeText(v, fallback = "-") {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

function formatHora(hora) {
  if (!hora) return "--:--";
  return String(hora).substring(0, 5);
}

/**
 * ✅ Normaliza fecha del backend:
 * - Si viene "2025-12-27T05:00:00.000Z" => "2025-12-27"
 * - Si viene "2025-12-27" => "2025-12-27"
 */
function normalizeYMD(fecha) {
  if (!fecha) return "";
  const s = String(fecha);
  return s.includes("T") ? s.split("T")[0] : s;
}

/**
 * ✅ Convierte "YYYY-MM-DD" a texto local bonito:
 *   sábado, 27 dic 2025
 */
function formatFechaBonita(ymd) {
  if (!ymd) return "Sin fecha";
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;

  // Usamos Date.UTC para evitar desfase de zona horaria
  const date = new Date(Date.UTC(y, m - 1, d));

  return new Intl.DateTimeFormat("es-EC", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

async function cargarFixture() {
  const flyer = document.getElementById("flyer-root");
  const errorBox = document.getElementById("mensaje-error");
  const acciones = document.getElementById("acciones");

  const campeonatoId = getParam("campeonato");
  const jornadaParam = getParam("jornada"); // puede ser null
  const grupoId = getParam("grupo");        // opcional

  if (!campeonatoId) {
    flyer.innerHTML = "";
    errorBox.style.display = "block";
    errorBox.textContent = "❌ Falta parámetro: campeonato";
    return;
  }

  // parse jornada
  let jornada = null;
  if (jornadaParam) {
    jornada = parseInt(jornadaParam, 10);
    if (!Number.isFinite(jornada)) jornada = null;
  }

  try {
    // ===========================
    // ✅ 1) Elegir endpoint correcto
    // ===========================
    let data;

    if (jornada !== null) {
      // 🔥 Jornada completa del campeonato (todos los grupos)
      data = await ApiClient.get(`/partidos/campeonato/${campeonatoId}/jornada/${jornada}`);
    } else if (grupoId) {
      data = await ApiClient.get(`/partidos/grupo/${grupoId}`);
    } else {
      data = await ApiClient.get(`/partidos/campeonato/${campeonatoId}`);
    }

    let partidos = [];
    if (Array.isArray(data)) partidos = data;
    else if (data.partidos && Array.isArray(data.partidos)) partidos = data.partidos;

    if (!partidos.length) {
      flyer.innerHTML = "";
      errorBox.style.display = "block";
      errorBox.textContent = "ℹ️ No hay partidos para mostrar.";
      return;
    }

    // ✅ 2) Normalizar fechas a YYYY-MM-DD para evitar "T05:00:00.000Z"
    partidos = partidos.map(p => ({
      ...p,
      fecha_partido: normalizeYMD(p.fecha_partido),
    }));

    // ✅ 3) Si NO usamos endpoint por jornada, pero vino jornadaParam, filtramos (compatibilidad)
    if (jornada !== null && !(data && data.mensaje && String(data.mensaje).includes("Fixture por jornada"))) {
      partidos = partidos.filter(p => Number(p.jornada) === jornada);
    }

    // Ordenar
    partidos.sort((a, b) => {
      const fa = (a.fecha_partido || "").localeCompare(b.fecha_partido || "");
      if (fa !== 0) return fa;
      const ha = (formatHora(a.hora_partido)).localeCompare(formatHora(b.hora_partido));
      if (ha !== 0) return ha;
      return (Number(a.jornada || 0) - Number(b.jornada || 0));
    });

    // Header data
    const p0 = partidos[0];
    const nombreCampeonato = safeText(p0.nombre_campeonato, "Campeonato");
    const organizador = safeText(p0.organizador, "");
    const logoCampeonato = toAbsUrl(p0.logo_campeonato_url);

    const colorPrimario = p0.color_primario || "#111";
    const colorSecundario = p0.color_secundario || "#444";
    const colorAcento = p0.color_acento || "#0ea5e9";

    // Agrupar por fecha (ya normalizada YMD)
    const porFecha = groupBy(partidos, (p) => p.fecha_partido || "Sin fecha");

    // Render
    errorBox.style.display = "none";
    acciones.style.display = "flex";

    flyer.innerHTML = `
      <div class="fixture-head" style="border-color:${colorAcento}">
        <div class="fixture-head-left">
          ${logoCampeonato ? `<img class="logo-campeonato" src="${logoCampeonato}" crossorigin="anonymous" />` : ""}
          <div>
            <div class="titulo">${nombreCampeonato}</div>
            ${organizador ? `<div class="subtitulo">${organizador}</div>` : ""}
            <div class="meta">
              ${jornada !== null ? `<span class="badge">Jornada ${jornada}</span>` : `<span class="badge">Fixture</span>`}
              ${grupoId ? `<span class="badge badge-muted">Grupo ${safeText(p0.letra_grupo || p0.nombre_grupo || "")}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="fixture-head-right">
          <div class="badge badge-outline" style="border-color:${colorAcento}; color:${colorAcento}">
            ${new Date().toLocaleDateString("es-EC")}
          </div>
        </div>
      </div>

      <div class="fixture-body">
        ${Array.from(porFecha.entries()).map(([fechaYMD, lista]) => {
          const fechaTexto = (fechaYMD === "Sin fecha") ? "Sin fecha" : formatFechaBonita(fechaYMD);

          // agrupar por grupo dentro de la fecha
          const porGrupo = groupBy(lista, (p) => p.letra_grupo || p.nombre_grupo || "General");

          return `
            <div class="bloque-fecha">
              <div class="fecha-titulo" style="color:${colorPrimario}">
                <i class="fa-regular fa-calendar"></i> ${fechaTexto}
              </div>

              ${Array.from(porGrupo.entries()).map(([grupoNombre, juegos]) => {
                const mostrarGrupo = grupoNombre && grupoNombre !== "General";

                return `
                  <div class="bloque-grupo">
                    ${mostrarGrupo ? `
                      <div class="grupo-titulo" style="color:${colorSecundario}">
                        <i class="fa-solid fa-layer-group"></i> ${safeText(grupoNombre)}
                      </div>
                    ` : ""}

                    <div class="tabla-partidos">
                      ${juegos.map((p) => {
                        const localLogo = toAbsUrl(p.equipo_local_logo_url);
                        const visLogo = toAbsUrl(p.equipo_visitante_logo_url);
                        const estado = (p.estado || "pendiente").toLowerCase();

                        return `
                          <div class="partido-row estado-${estado}">
                            <div class="col-hora">
                              <div class="hora">${formatHora(p.hora_partido)}</div>
                              <div class="cancha">${safeText(p.cancha, "Por definir")}</div>
                            </div>

                            <div class="col-equipos">
                              <div class="equipo">
                                ${localLogo ? `<img class="logo-equipo" src="${localLogo}" crossorigin="anonymous" />` : `<div class="logo-placeholder"></div>`}
                                <span class="nombre">${safeText(p.equipo_local_nombre)}</span>
                              </div>

                              <div class="vs">VS</div>

                              <div class="equipo">
                                ${visLogo ? `<img class="logo-equipo" src="${visLogo}" crossorigin="anonymous" />` : `<div class="logo-placeholder"></div>`}
                                <span class="nombre">${safeText(p.equipo_visitante_nombre)}</span>
                              </div>
                            </div>

                            <div class="col-extra">
                              <div class="jornada">J${safeText(p.jornada, "-")}</div>
                              <div class="estado">${estado}</div>
                            </div>
                          </div>
                        `;
                      }).join("")}
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          `;
        }).join("")}
      </div>
    `;

    bindAcciones(nombreCampeonato, jornada, grupoId);

  } catch (err) {
    console.error(err);
    flyer.innerHTML = "";
    errorBox.style.display = "block";
    errorBox.textContent = "❌ Error cargando fixture: " + (err.message || err);
  }
}

function bindAcciones(nombreCampeonato, jornada, grupoId) {
  const btnImg = document.getElementById("btn-descargar-imagen");
  const btnPdf = document.getElementById("btn-descargar-pdf");
  const btnPrint = document.getElementById("btn-imprimir");

  const suffix = [
    "fixture",
    jornada !== null ? `jornada_${jornada}` : "completo",
    grupoId ? `grupo_${grupoId}` : null
  ].filter(Boolean).join("_");

  const baseName = `${(nombreCampeonato || "campeonato").replace(/\s+/g, "_")}_${suffix}`;

  if (btnImg) btnImg.onclick = async () => {
    await exportarImagen(`${baseName}.png`);
  };

  if (btnPdf) btnPdf.onclick = async () => {
    await exportarPDF(`${baseName}.pdf`);
  };

  if (btnPrint) btnPrint.onclick = () => window.print();
}

async function exportarImagen(filename) {
  const node = document.getElementById("flyer-root");
  if (!node) return;

  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function exportarPDF(filename) {
  const node = document.getElementById("flyer-root");
  if (!node) return;

  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgProps = pdf.getImageProperties(imgData);
  const imgWidth = pageWidth;
  const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

  if (imgHeight <= pageHeight) {
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
  } else {
    let remaining = imgHeight;
    let position = 0;

    while (remaining > 0) {
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      remaining -= pageHeight;
      position -= pageHeight;
      if (remaining > 0) pdf.addPage();
    }
  }

  pdf.save(filename);
}

document.addEventListener("DOMContentLoaded", cargarFixture);
