// frontend/js/tablasplantilla.js
// Postales exportables de Tablas (posiciones, goleadores, tarjetas, fair play)

(() => {
  const API = window.resolveApiBaseUrl
    ? window.resolveApiBaseUrl()
    : window.API_BASE_URL || `${window.location.origin}/api`;

  const BACKEND_BASE = (() => {
    try { return new URL(API).origin; } catch (_) { return window.location.origin; }
  })();

  function authHeaders() {
    const token = window.Auth?.getToken?.() || "";
    return token
      ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };
  }

  async function apiGet(path) {
    const resp = await fetch(`${API}${path}`, { headers: authHeaders() });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || `Error ${resp.status}`);
    }
    return resp.json();
  }

  // ── State ─────────────────────────────────────────────────────────────────

  let campeonatoActual = null;
  let eventoActual = null;
  let tipoActual = "posiciones";
  let fondoActual = "deportivo";
  let exportEnCurso = false;

  let dataPosiciones = null;
  let dataGoleadores = null;
  let dataTarjetas = null;
  let dataFairPlay = null;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizarLogoUrl(url) {
    if (!url) return null;
    const s = String(url).trim();
    if (!s) return null;
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    if (s.startsWith("/uploads/")) return `${BACKEND_BASE}${s}`;
    if (/\.(png|jpe?g|webp|gif|svg)$/i.test(s)) return `${BACKEND_BASE}/uploads/campeonatos/${s}`;
    return `${BACKEND_BASE}/uploads/${s}`;
  }

  function formatearFecha(val) {
    if (!val) return "";
    try {
      const d = new Date(val);
      return d.toLocaleDateString("es-EC", { year: "numeric", month: "short", day: "2-digit" });
    } catch (_) { return ""; }
  }

  // ── Logo helpers ──────────────────────────────────────────────────────────

  function logoEquipoHtml(logoUrl, nombre) {
    const src = normalizarLogoUrl(logoUrl);
    if (src) {
      return `<img src="${esc(src)}" alt="${esc(nombre)}" class="tblp-equipo-logo"
                   crossorigin="anonymous" referrerpolicy="no-referrer"
                   onerror="this.style.display='none'">`;
    }
    return `<span class="tblp-equipo-logo-placeholder"></span>`;
  }

  function rankHtml(idx) {
    const clases = ["tblp-rank-1", "tblp-rank-2", "tblp-rank-3"];
    const cls = idx < 3 ? clases[idx] : "tblp-rank-n";
    return `<span class="tblp-rank ${cls}">${idx + 1}</span>`;
  }

  // ── Render tabla posiciones ───────────────────────────────────────────────

  // El backend entrega cada grupo como { grupo: { letra_grupo, nombre_grupo,
  // clasificados_por_grupo }, tabla }. Una categoría sin grupos llega como un
  // único grupo «Tabla General» con letra "-".
  function obtenerGruposPosiciones(data) {
    const grupos = Array.isArray(data?.grupos) ? data.grupos : [];
    const clasificanEvento = Number.parseInt(data?.evento?.clasificados_por_grupo, 10) || 0;
    return grupos.map((g) => {
      const info = g?.grupo || {};
      const letra = String(info.letra_grupo || g?.letra_grupo || "").trim();
      const letraValida = letra && letra !== "-" ? letra.toUpperCase() : "";
      const nombre = String(info.nombre_grupo || g?.nombre_grupo || "").trim();
      let etiqueta = "";
      if (letraValida) {
        etiqueta = nombre && nombre.toUpperCase().includes(letraValida) ? nombre : `Grupo ${letraValida}`;
      }
      return {
        letra: letraValida,
        etiqueta,
        clasifican: Number.parseInt(info.clasificados_por_grupo, 10) || clasificanEvento,
        tabla: Array.isArray(g?.tabla) ? g.tabla : [],
      };
    });
  }

  function esPosicionesPorGrupo() {
    if (tipoActual !== "posiciones" || !dataPosiciones) return false;
    const grupos = obtenerGruposPosiciones(dataPosiciones);
    return grupos.length > 1 || (grupos.length === 1 && !!grupos[0].letra);
  }

  // Estado de clasificación según la configuración de la categoría. Se usan
  // las marcas que calcula el backend (cupos por grupo, eliminados manuales o
  // por no presentación, edición manual de la tabla), igual que en Tablas.
  function estadoClasificacionFila(row, idx, clasifican) {
    if (row.eliminado_competencia === true || row.eliminado_manual === true) return "eliminado";
    if (clasifican > 0) {
      if (row.fuera_clasificacion === true) return "fuera";
      if (row.clasifica === true || (row.clasifica === undefined && idx < clasifican)) return "clasifica";
    }
    return "";
  }

  function motivoEliminacionFila(row) {
    if (row.eliminado_manual === true) return row.motivo_eliminacion_label || "Eliminado";
    const np = Number(row.no_presentaciones || 0);
    if (row.eliminado_automatico === true && np > 0) return `${np} no presentaciones`;
    return "Eliminado";
  }

  function renderLeyendaClasificacion(grupo, estados) {
    const hayEliminados = estados.includes("eliminado");
    if (!(grupo.clasifican > 0) && !hayEliminados) return "";
    const items = [];
    if (grupo.clasifican > 0) {
      items.push(`<span class="tblp-leyenda-item"><i class="tblp-leyenda-dot is-clasifica"></i>Clasifican ${grupo.clasifican}</span>`);
      if (estados.includes("fuera")) {
        items.push('<span class="tblp-leyenda-item"><i class="tblp-leyenda-dot is-fuera"></i>Fuera de clasificación</span>');
      }
    }
    if (hayEliminados) {
      items.push('<span class="tblp-leyenda-item"><i class="tblp-leyenda-dot is-eliminado"></i>Eliminado</span>');
    }
    return `<div class="tblp-leyenda">${items.join("")}</div>`;
  }

  function renderTablaGrupoPosiciones(grupo) {
    const estados = grupo.tabla.map((row, idx) => estadoClasificacionFila(row, idx, grupo.clasifican));
    const filas = grupo.tabla.map((row, idx) => {
      const est = row.estadisticas || {};
      const estado = estados[idx];
      const claseTr = estado ? `tblp-${estado}` : "";
      const nombre = row?.equipo?.nombre || "-";
      const chipEliminado = estado === "eliminado"
        ? `<span class="tblp-chip-eliminado" title="${esc(motivoEliminacionFila(row))}">ELIMINADO</span>`
        : "";
      return `
        <tr class="${claseTr}">
          <td class="col-pos"><span class="tblp-pos-badge">${Number(row.posicion || idx + 1)}</span></td>
          <td class="col-equipo">
            <div class="tblp-equipo-cell">
              ${logoEquipoHtml(row?.equipo?.logo_url || null, nombre)}
              <span class="tblp-equipo-nombre">${esc(nombre)}</span>
              ${chipEliminado}
            </div>
          </td>
          <td>${Number(est.partidos_jugados || 0)}</td>
          <td>${Number(est.partidos_ganados || 0)}</td>
          <td>${Number(est.partidos_empatados || 0)}</td>
          <td>${Number(est.partidos_perdidos || 0)}</td>
          <td class="col-gf">${Number(est.goles_favor || 0)}</td>
          <td class="col-gc">${Number(est.goles_contra || 0)}</td>
          <td class="col-dg">${Number(est.diferencia_goles || 0)}</td>
          <td class="col-pts">${Number(row.puntos || 0)}</td>
        </tr>`;
    }).join("");

    return `
      ${grupo.etiqueta ? `<div class="tblp-group-label">${esc(grupo.etiqueta)}</div>` : ""}
      <div class="tblp-tabla-wrap">
        <table class="tblp-tabla">
          <thead>
            <tr>
              <th class="col-pos">#</th>
              <th class="col-equipo">Equipo</th>
              <th>PJ</th><th>PG</th><th>PE</th><th>PP</th>
              <th class="col-gf">GF</th>
              <th class="col-gc">GC</th>
              <th class="col-dg">DG</th>
              <th class="col-pts">PTS</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      ${renderLeyendaClasificacion(grupo, estados)}`;
  }

  // Una postal por grupo: cada una lleva su tabla (con la letra del grupo).
  function renderPosterPosicionesGrupo(grupo) {
    if (!grupo || !grupo.tabla.length) return emptyMsg("No hay datos de posiciones para este grupo.");
    return `<div class="tblp-poster-body">${renderTablaGrupoPosiciones(grupo)}</div>`;
  }

  function renderPosterPosiciones(data) {
    const grupos = obtenerGruposPosiciones(data);
    if (!grupos.length) return emptyMsg("No hay datos de posiciones para esta categoría.");
    return renderPosterPosicionesGrupo(grupos[0]);
  }

  // ── Render goleadores ─────────────────────────────────────────────────────

  function renderPosterGoleadores(data) {
    const lista = (data?.goleadores || []).slice(0, 15);
    if (!lista.length) return emptyMsg("No hay datos de goleadores.");

    const filas = lista.map((g, idx) => `
      <tr>
        <td class="col-pos">${rankHtml(idx)}</td>
        <td class="col-equipo">
          <div class="tblp-equipo-cell">
            ${logoEquipoHtml(g.logo_url || null, g.jugador_nombre || "")}
            <span class="tblp-equipo-nombre">${esc(g.jugador_nombre || "-")}</span>
          </div>
        </td>
        <td>${esc(g.equipo_nombre || "-")}</td>
        <td class="col-pts">${Number(g.goles || 0)}</td>
        <td>${Number(g.partidos_con_gol || 0)}</td>
      </tr>`).join("");

    return `
      <div class="tblp-poster-body">
        <div class="tblp-tabla-wrap">
          <table class="tblp-tabla">
            <thead>
              <tr>
                <th class="col-pos">#</th>
                <th class="col-equipo">Jugador</th>
                <th>Equipo</th>
                <th class="col-pts">Goles</th>
                <th>PG</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ── Render tarjetas ───────────────────────────────────────────────────────

  function renderPosterTarjetas(data) {
    const lista = (data?.tarjetas || []).slice(0, 15);
    if (!lista.length) return emptyMsg("No hay datos de tarjetas.");

    const filas = lista.map((t, idx) => `
      <tr>
        <td class="col-pos">${rankHtml(idx)}</td>
        <td class="col-equipo">
          <div class="tblp-equipo-cell">
            ${logoEquipoHtml(t.logo_url || null, t.equipo_nombre || "")}
            <span class="tblp-equipo-nombre">${esc(t.equipo_nombre || "-")}</span>
          </div>
        </td>
        <td class="col-gf">${Number(t.amarillas || 0)}</td>
        <td class="col-gc">${Number(t.rojas || 0)}</td>
      </tr>`).join("");

    return `
      <div class="tblp-poster-body">
        <div class="tblp-tabla-wrap">
          <table class="tblp-tabla">
            <thead>
              <tr>
                <th class="col-pos">#</th>
                <th class="col-equipo">Equipo</th>
                <th class="col-gf">Amarillas</th>
                <th class="col-gc">Rojas</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ── Render fair play ──────────────────────────────────────────────────────

  function renderPosterFairPlay(data) {
    const lista = (data?.fair_play || []).slice(0, 15);
    if (!lista.length) return emptyMsg("No hay datos de fair play.");

    const filas = lista.map((f, idx) => `
      <tr>
        <td class="col-pos">${rankHtml(idx)}</td>
        <td class="col-equipo">
          <div class="tblp-equipo-cell">
            ${logoEquipoHtml(f.logo_url || null, f.equipo_nombre || "")}
            <span class="tblp-equipo-nombre">${esc(f.equipo_nombre || "-")}</span>
          </div>
        </td>
        <td class="col-gf">${Number(f.amarillas || 0)}</td>
        <td class="col-gc">${Number(f.rojas || 0)}</td>
        <td class="col-pts">${Number(f.puntaje_fair_play || 0).toFixed(1)}</td>
      </tr>`).join("");

    return `
      <div class="tblp-poster-body">
        <div class="tblp-tabla-wrap">
          <table class="tblp-tabla">
            <thead>
              <tr>
                <th class="col-pos">#</th>
                <th class="col-equipo">Equipo</th>
                <th class="col-gf">Amarillas</th>
                <th class="col-gc">Rojas</th>
                <th class="col-pts">Puntaje</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>`;
  }

  function emptyMsg(msg) {
    return `<div class="tblp-empty-state"><i class="fas fa-info-circle"></i><p>${esc(msg)}</p></div>`;
  }

  // ── Actualizar poster ─────────────────────────────────────────────────────

  function actualizarContenidoPoster() {
    const cont = document.getElementById("tblp-poster-content");
    if (!cont) return;

    const labels = {
      posiciones: "Tabla General",
      goleadores: "Tabla de Goleadores",
      tarjetas:   "Tabla de Tarjetas",
      fair_play:  "Tabla Fair Play",
    };

    const strip = document.getElementById("tblp-title-strip");
    if (strip) strip.textContent = labels[tipoActual] || tipoActual;

    if (!eventoActual) {
      cont.innerHTML = emptyMsg("Selecciona campeonato y categoría.");
      return;
    }

    let html = "";
    switch (tipoActual) {
      case "posiciones": html = dataPosiciones ? renderPosterPosiciones(dataPosiciones) : emptyMsg("Cargando posiciones..."); break;
      case "goleadores": html = dataGoleadores ? renderPosterGoleadores(dataGoleadores) : emptyMsg("Cargando goleadores..."); break;
      case "tarjetas":   html = dataTarjetas   ? renderPosterTarjetas(dataTarjetas)     : emptyMsg("Cargando tarjetas..."); break;
      case "fair_play":  html = dataFairPlay    ? renderPosterFairPlay(dataFairPlay)     : emptyMsg("Cargando fair play..."); break;
      default:           html = emptyMsg("Tipo desconocido.");
    }
    cont.innerHTML = html;
    sincronizarPostersPorGrupo();
  }

  // Posiciones con grupos: la postal principal muestra el primer grupo y se
  // agrega una copia completa (cabecera, título, auspiciantes y fondo) por
  // cada grupo restante. Se vuelve a armar cuando cambian datos o fondo.
  function sincronizarPostersPorGrupo() {
    const wrap = document.getElementById("tblp-posters");
    const master = wrap?.querySelector('.tblp-poster-item[data-poster-master="true"]');
    if (!wrap || !master) return;
    wrap.querySelectorAll(".tblp-poster-item.is-clone").forEach((el) => el.remove());

    const barMaster = master.querySelector(".tblp-poster-item-bar");
    const hint = document.getElementById("tblp-posters-hint");
    const porGrupo = esPosicionesPorGrupo();
    if (barMaster) barMaster.style.display = porGrupo ? "" : "none";
    if (!porGrupo) {
      master.dataset.grupo = "";
      if (hint) hint.style.display = "none";
      return;
    }

    const grupos = obtenerGruposPosiciones(dataPosiciones);
    const etiquetaMaster = master.querySelector(".tblp-poster-item-label");
    if (etiquetaMaster) etiquetaMaster.textContent = grupos[0].etiqueta || "Grupo 1";
    master.dataset.grupo = grupos[0].letra || "1";

    let anterior = master;
    grupos.slice(1).forEach((grupo, idx) => {
      const clon = master.cloneNode(true);
      clon.classList.add("is-clone");
      clon.removeAttribute("data-poster-master");
      clon.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      clon.dataset.grupo = grupo.letra || String(idx + 2);
      const label = clon.querySelector(".tblp-poster-item-label");
      if (label) label.textContent = grupo.etiqueta || `Grupo ${idx + 2}`;
      const contenido = clon.querySelector(".tblp-poster-content");
      if (contenido) contenido.innerHTML = renderPosterPosicionesGrupo(grupo);
      anterior.after(clon);
      anterior = clon;
    });

    if (hint) {
      hint.textContent = `${grupos.length} postales, una por grupo. «Exportar imagen» descarga todas; también puedes descargar cada una por separado.`;
      hint.style.display = "";
    }
  }

  // ── Cabecera del poster ───────────────────────────────────────────────────

  async function actualizarHeaderPoster(camp, eventoNombre) {
    const poster = document.getElementById("tblp-poster");
    if (!poster) return;

    document.getElementById("tblp-organizador").textContent = camp.organizador || "ORGANIZA";
    document.getElementById("tblp-titulo").textContent = (camp.nombre || "TORNEO").toUpperCase();

    const tipo = (camp.tipo_futbol || "").replace(/_/g, " ").toUpperCase();
    const fi = formatearFecha(camp.fecha_inicio);
    const ff = formatearFecha(camp.fecha_fin);
    const detalleCamp = `${tipo}${fi || ff ? ` · ${fi}${ff ? " – " + ff : ""}` : ""}`;
    const detalleEvento = eventoNombre ? `CATEGORÍA: ${String(eventoNombre).toUpperCase()}` : "";
    document.getElementById("tblp-detalle").textContent = [detalleCamp, detalleEvento].filter(Boolean).join(" · ");

    // Año del campeonato
    const yearEl = document.getElementById("tblp-year");
    if (yearEl) {
      const yearStr = camp.fecha_inicio
        ? new Date(camp.fecha_inicio).getFullYear()
        : new Date().getFullYear();
      yearEl.textContent = yearStr;
    }

    // Colores para tema Torneo
    poster.style.setProperty("--t-primario", camp.color_primario || "#313131");
    poster.style.setProperty("--t-secundario", camp.color_secundario || "#242424");
    poster.style.setProperty("--t-acento", camp.color_acento || "#b7e853");

    // Logo
    const logoEl = document.getElementById("tblp-org-logo");
    if (logoEl) {
      const src = normalizarLogoUrl(camp.logo_url || null);
      if (src) {
        logoEl.src = src;
        logoEl.classList.remove("sin-logo");
      } else {
        logoEl.removeAttribute("src");
        logoEl.classList.add("sin-logo");
      }
    }
  }

  async function cargarAuspiciantes(campeonatoId) {
    const footer = document.getElementById("tblp-poster-footer");
    const grid = document.getElementById("tblp-sponsors-grid");
    if (!footer || !grid) return;

    let lista = [];

    // Intento 1: endpoint privado (con fallback a organizador + filesystem)
    try {
      const resp = await apiGet(`/auspiciantes/campeonato/${campeonatoId}`);
      lista = resp.auspiciantes || resp || [];
    } catch (e) {
      console.warn("[tablasplantilla] auspiciantes (privado) falló:", e.message);
    }

    // Intento 2: endpoint público (filesystem fallback de Render)
    if (!lista.length) {
      try {
        const resp = await fetch(
          `${BACKEND_BASE}/api/public/campeonatos/${campeonatoId}/auspiciantes`,
          { headers: { "Content-Type": "application/json" } }
        );
        if (resp.ok) {
          const data = await resp.json().catch(() => ({}));
          lista = data.auspiciantes || data || [];
        }
      } catch (e) {
        console.warn("[tablasplantilla] auspiciantes (público) falló:", e.message);
      }
    }

    if (!lista.length) { footer.style.display = "none"; return; }

    grid.innerHTML = lista.map((a) => {
      const src = normalizarLogoUrl(a.logo_url);
      if (src) {
        return `<img src="${esc(src)}" alt="${esc(a.nombre || "")}" class="tblp-sponsor-logo"
                    crossorigin="anonymous" referrerpolicy="no-referrer"
                    onerror="this.style.display='none'">`;
      }
      if (a.nombre) {
        return `<span class="tblp-sponsor-nombre">${esc(a.nombre)}</span>`;
      }
      return "";
    }).filter(Boolean).join("");

    footer.style.display = grid.innerHTML.trim() ? "" : "none";
  }

  // ── Cargar datos ──────────────────────────────────────────────────────────

  async function cargarDatos() {
    if (!eventoActual || !campeonatoActual) return;

    // Reset
    dataPosiciones = null;
    dataGoleadores = null;
    dataTarjetas = null;
    dataFairPlay = null;

    actualizarContenidoPoster();

    const [pos, gol, tar, fp] = await Promise.allSettled([
      apiGet(`/tablas/evento/${eventoActual}/posiciones`),
      apiGet(`/tablas/evento/${eventoActual}/goleadores`),
      apiGet(`/tablas/evento/${eventoActual}/tarjetas`),
      apiGet(`/tablas/evento/${eventoActual}/fair-play`),
    ]);

    if (pos.status === "fulfilled") dataPosiciones = pos.value;
    if (gol.status === "fulfilled") dataGoleadores = gol.value;
    if (tar.status === "fulfilled") dataTarjetas = tar.value;
    if (fp.status  === "fulfilled") dataFairPlay  = fp.value;

    actualizarContenidoPoster();

    // Header del poster
    try {
      const campData = await apiGet(`/campeonatos/${campeonatoActual}`);
      const camp = campData.campeonato || campData;
      const evData = await apiGet(`/eventos/${eventoActual}`);
      const eventoNombre = evData?.evento?.nombre || evData?.nombre || "";
      await actualizarHeaderPoster(camp, eventoNombre);
      await cargarAuspiciantes(campeonatoActual);
    } catch (e) {
      console.warn("No se pudo cargar cabecera del poster:", e);
    }
    sincronizarPostersPorGrupo();
  }

  // ── Fondos predefinidos ────────────────────────────────────────────────────

  function aplicarFondo(fondo) {
    const poster = document.getElementById("tblp-poster");
    if (!poster) return;
    const fondos = ["fondo-deportivo", "fondo-nocturno", "fondo-clasico", "fondo-azul", "fondo-vinotinto", "fondo-verde", "fondo-torneo"];
    fondos.forEach((f) => poster.classList.remove(f));
    if (fondo !== "limpiar") poster.classList.add(`fondo-${fondo}`);
    fondoActual = fondo;

    document.querySelectorAll(".tblp-bg-swatch[data-fondo]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.fondo === fondo);
    });
    sincronizarPostersPorGrupo();
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  function getNombreArchivo(grupo = "") {
    const tipo = tipoActual.replace("_", "-");
    const evento = eventoActual || "sin-evento";
    const sufijo = grupo ? `-grupo-${String(grupo).toLowerCase()}` : "";
    return `tabla-${tipo}-evento-${evento}${sufijo}`;
  }

  // Postales a exportar: una por grupo en Posiciones, si no la única.
  function obtenerPostersExportables() {
    const items = Array.from(document.querySelectorAll("#tblp-posters .tblp-poster-item"));
    return items
      .map((item) => ({ zona: item.querySelector(".tblp-poster"), grupo: item.dataset.grupo || "" }))
      .filter((x) => x.zona);
  }

  async function capturarPoster(zona) {
    await esperarImagenes(zona);
    await inlineImagesAsBase64(zona);
    return html2canvas(zona, {
      scale: 2,
      backgroundColor: null,
      useCors: true,
      width: zona.scrollWidth,
      height: zona.scrollHeight,
      windowWidth: zona.scrollWidth,
      windowHeight: zona.scrollHeight,
    });
  }

  async function esperarImagenes(zona) {
    const imgs = Array.from(zona.querySelectorAll("img"));
    await Promise.all(imgs.map((img) =>
      new Promise((resolve) => {
        if (img.complete && img.naturalWidth > 0) { resolve(); return; }
        let done = false;
        const fin = () => { if (!done) { done = true; resolve(); } };
        img.addEventListener("load", fin, { once: true });
        img.addEventListener("error", fin, { once: true });
        setTimeout(fin, 4000);
      })
    ));
  }

  async function inlineImagesAsBase64(zona) {
    const imgs = Array.from(zona.querySelectorAll("img")).filter((img) => img.src && img.naturalWidth > 0);
    await Promise.all(imgs.map(async (img) => {
      try {
        const resp = await fetch(img.src, { mode: "cors" });
        if (!resp.ok) return;
        const blob = await resp.blob();
        const dataUrl = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.onerror = rej;
          reader.readAsDataURL(blob);
        });
        img.src = dataUrl;
      } catch (_) { /* ignore */ }
    }));
  }

  async function exportarPNG(soloItem = null) {
    if (exportEnCurso) return;
    if (!eventoActual) { mostrarNotificacion("Selecciona una categoría antes de exportar", "warning"); return; }
    if (!window.html2canvas) { mostrarNotificacion("No se cargó html2canvas", "error"); return; }

    exportEnCurso = true;
    setBotonesExport(true);
    try {
      const posters = soloItem
        ? [{ zona: soloItem.querySelector(".tblp-poster"), grupo: soloItem.dataset.grupo || "" }]
        : obtenerPostersExportables();
      for (const { zona, grupo } of posters) {
        const canvas = await capturarPoster(zona);
        const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
        if (!blob) throw new Error("No se pudo generar imagen");
        descargarBlob(blob, `${getNombreArchivo(posters.length > 1 || soloItem ? grupo : "")}.png`);
        // Pausa breve: algunos navegadores bloquean descargas seguidas.
        if (posters.length > 1) await new Promise((r) => setTimeout(r, 400));
      }
      mostrarNotificacion(posters.length > 1 ? `${posters.length} imágenes exportadas (una por grupo)` : "Imagen exportada", "success");
    } catch (err) {
      console.error(err);
      mostrarNotificacion("No se pudo exportar la imagen", "error");
    } finally {
      exportEnCurso = false;
      setBotonesExport(false);
    }
  }

  async function exportarPDF() {
    if (exportEnCurso) return;
    if (!eventoActual) { mostrarNotificacion("Selecciona una categoría antes de exportar", "warning"); return; }
    if (!window.html2canvas || !window.jspdf?.jsPDF) { mostrarNotificacion("No se cargó librería PDF", "error"); return; }

    exportEnCurso = true;
    setBotonesExport(true);
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const posters = obtenerPostersExportables();
      for (let i = 0; i < posters.length; i += 1) {
        const canvas = await capturarPoster(posters[i].zona);
        const imgData = canvas.toDataURL("image/png");
        if (i > 0) pdf.addPage();
        const props = pdf.getImageProperties(imgData);
        let renderW = pageW - 10;
        let renderH = (props.height * renderW) / props.width;
        if (renderH > pageH - 12) {
          renderH = pageH - 12;
          renderW = (props.width * renderH) / props.height;
        }
        pdf.addImage(imgData, "PNG", (pageW - renderW) / 2, (pageH - renderH) / 2, renderW, renderH);
      }
      const blob = pdf.output("blob");
      descargarBlob(blob, `${getNombreArchivo()}.pdf`);
      mostrarNotificacion(posters.length > 1 ? `PDF exportado (${posters.length} páginas, una por grupo)` : "PDF exportado", "success");
    } catch (err) {
      console.error(err);
      mostrarNotificacion("No se pudo exportar el PDF", "error");
    } finally {
      exportEnCurso = false;
      setBotonesExport(false);
    }
  }

  function descargarBlob(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function setBotonesExport(activo) {
    const btnPng = document.getElementById("tblp-btn-png");
    const btnPdf = document.getElementById("tblp-btn-pdf");
    if (btnPng) { btnPng.disabled = activo; btnPng.innerHTML = activo ? "⏳ Generando..." : '<i class="fas fa-image"></i> Exportar imagen'; }
    if (btnPdf) { btnPdf.disabled = activo; if (!activo) btnPdf.innerHTML = '<i class="fas fa-file-pdf"></i> Exportar PDF'; }
  }

  function mostrarNotificacion(msg, tipo) {
    if (window.mostrarToast) { window.mostrarToast(msg, tipo); return; }
    console.log(`[${tipo}] ${msg}`);
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  async function cargarCampeonatos() {
    try {
      const data = await apiGet("/campeonatos");
      const lista = data.campeonatos || data || [];
      const sel = document.getElementById("tblp-select-campeonato");
      if (!sel) return;
      lista.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.nombre || `Campeonato #${c.id}`;
        sel.appendChild(opt);
      });
    } catch (_) { /* silent */ }
  }

  async function cargarEventos(campeonatoId) {
    const sel = document.getElementById("tblp-select-evento");
    if (!sel) return;
    sel.innerHTML = '<option value="">— Selecciona una categoría —</option>';
    sel.disabled = true;
    if (!campeonatoId) return;
    try {
      const data = await apiGet(`/eventos/campeonato/${campeonatoId}`);
      const lista = data.eventos || data || [];
      lista.forEach((e) => {
        const opt = document.createElement("option");
        opt.value = e.id;
        opt.textContent = e.nombre || `Categoría #${e.id}`;
        sel.appendChild(opt);
      });
      sel.disabled = false;
    } catch (_) { sel.disabled = false; }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    // Nav toggle
    const navToggle = document.getElementById("nav-toggle");
    const sidebar = document.getElementById("sidebar");
    if (navToggle && sidebar && navToggle.dataset.mobileMenuBound !== "true") {
      navToggle.dataset.mobileMenuBound = "true";
      navToggle.addEventListener("click", () => sidebar.classList.toggle("nav-open"));
    }

    await cargarCampeonatos();

    // Campeonato change
    document.getElementById("tblp-select-campeonato")?.addEventListener("change", async (e) => {
      const id = Number.parseInt(e.target.value, 10);
      campeonatoActual = Number.isFinite(id) && id > 0 ? id : null;
      eventoActual = null;
      dataPosiciones = null; dataGoleadores = null; dataTarjetas = null; dataFairPlay = null;
      actualizarContenidoPoster();
      await cargarEventos(campeonatoActual);
    });

    // Evento change
    document.getElementById("tblp-select-evento")?.addEventListener("change", (e) => {
      const id = Number.parseInt(e.target.value, 10);
      eventoActual = Number.isFinite(id) && id > 0 ? id : null;
    });

    // Botón cargar
    document.getElementById("tblp-btn-cargar")?.addEventListener("click", async () => {
      if (!campeonatoActual || !eventoActual) {
        mostrarNotificacion("Selecciona campeonato y categoría", "warning");
        return;
      }
      await cargarDatos();
    });

    // Tabs tipo
    document.querySelectorAll(".tblp-tipo-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tblp-tipo-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        tipoActual = btn.dataset.tipo;
        actualizarContenidoPoster();
      });
    });

    // Fondos predefinidos
    document.querySelectorAll(".tblp-bg-swatch[data-fondo]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const fondo = btn.dataset.fondo;
        if (fondo === "limpiar") {
          const poster = document.getElementById("tblp-poster");
          if (poster) {
            poster.classList.remove("has-custom-bg");
            poster.style.removeProperty("--p-custom-bg");
          }
          document.getElementById("tblp-btn-clear-bg").style.display = "none";
          document.getElementById("tblp-bg-custom-label").classList.remove("active");
          aplicarFondo(fondoActual === "custom" ? "deportivo" : fondoActual);
        } else {
          aplicarFondo(fondo);
        }
      });
    });

    // Imagen personalizada
    document.getElementById("tblp-bg-input")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const poster = document.getElementById("tblp-poster");
      if (poster) {
        poster.style.setProperty("--p-custom-bg", `url("${url}")`);
        poster.classList.add("has-custom-bg");
      }
      document.getElementById("tblp-btn-clear-bg").style.display = "";
      document.getElementById("tblp-bg-custom-label").classList.add("active");
      // Limpiar fondos predefinidos del active
      document.querySelectorAll(".tblp-bg-swatch[data-fondo]").forEach((b) => b.classList.remove("active"));
      document.getElementById("tblp-bg-custom-label").classList.add("active");
      sincronizarPostersPorGrupo();
    });

    // Export buttons
    document.getElementById("tblp-btn-png")?.addEventListener("click", () => exportarPNG());
    // Descarga individual de una postal (delegado: los clones se crean después).
    document.getElementById("tblp-posters")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".tblp-btn-png-item");
      if (!btn) return;
      const item = btn.closest(".tblp-poster-item");
      if (item) exportarPNG(item);
    });
    document.getElementById("tblp-btn-pdf")?.addEventListener("click", exportarPDF);

    // Pre-seleccionar desde RouteContext o URL params
    const routeCtx = window.RouteContext?.read?.("tablasplantilla.html", ["campeonato", "evento", "tipo"]) || {};
    const urlParams = new URLSearchParams(window.location.search);
    const preCamp = Number.parseInt(routeCtx.campeonato || urlParams.get("campeonato") || "", 10);
    const preEvento = Number.parseInt(routeCtx.evento || urlParams.get("evento") || "", 10);
    const preTipo = routeCtx.tipo || urlParams.get("tipo") || null;

    const TIPOS_VALIDOS = ["posiciones", "goleadores", "tarjetas", "fair_play"];
    if (preTipo && TIPOS_VALIDOS.includes(preTipo)) {
      const tabBtn = document.querySelector(`.tblp-tipo-tab[data-tipo="${preTipo}"]`);
      if (tabBtn) {
        document.querySelectorAll(".tblp-tipo-tab").forEach((b) => b.classList.remove("active"));
        tabBtn.classList.add("active");
        tipoActual = preTipo;
      }
    }

    if (Number.isFinite(preCamp) && preCamp > 0) {
      const selCamp = document.getElementById("tblp-select-campeonato");
      if (selCamp) {
        selCamp.value = String(preCamp);
        if (selCamp.value === String(preCamp)) {
          campeonatoActual = preCamp;
          await cargarEventos(preCamp);
          if (Number.isFinite(preEvento) && preEvento > 0) {
            const selEv = document.getElementById("tblp-select-evento");
            if (selEv) {
              selEv.value = String(preEvento);
              if (selEv.value === String(preEvento)) {
                eventoActual = preEvento;
                await cargarDatos();
              }
            }
          }
        }
      }
    }
  });
})();
