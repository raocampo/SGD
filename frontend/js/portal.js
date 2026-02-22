const API = window.API_BASE_URL || "http://localhost:5000/api";
const BACKEND_BASE = API.replace(/\/api\/?$/, "");
const IMG_TORNEO_ACTIVO = "assets/ltc/torneos/Torneo1.jpeg";
const IMG_TORNEO_PROXIMO = "assets/ltc/torneos/ProximoTorneo.jpeg";
const IMG_TORNEO_SVG_A = "assets/ltc/torneos/ProximoA.svg";
const IMG_TORNEO_SVG_B = "assets/ltc/torneos/ProximoB.svg";

function leerContextoPortalDesdeUrl() {
  const params = new URLSearchParams(window.location.search);
  const campeonato = Number.parseInt(params.get("campeonato") || "", 10);
  const evento = Number.parseInt(params.get("evento") || "", 10);
  const organizador = Number.parseInt(params.get("organizador") || "", 10);
  return {
    campeonatoId: Number.isFinite(campeonato) && campeonato > 0 ? campeonato : null,
    eventoId: Number.isFinite(evento) && evento > 0 ? evento : null,
    organizadorId: Number.isFinite(organizador) && organizador > 0 ? organizador : null,
  };
}

function normalizarLogoUrl(logoUrl) {
  if (!logoUrl) return "";
  const s = String(logoUrl).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return `${BACKEND_BASE}${s}`;
  if (s.startsWith("uploads/")) return `${BACKEND_BASE}/${s}`;
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(s)) return `${BACKEND_BASE}/uploads/campeonatos/${s}`;
  return `${BACKEND_BASE}/${s}`;
}

function limpiarCodigoTorneo(texto) {
  if (texto == null) return "";
  return String(texto)
    .replace(/\bT\d{2,}\s*[:\-]\s*[A-Z0-9]+\b/gi, "")
    .replace(/\bT\d{2,}[A-Z0-9]{2,}\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-:|]+|[\s\-:|]+$/g, "")
    .trim();
}

function formatearFechaPortal(fecha) {
  if (!fecha) return "Por definir";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return String(fecha);
  return d.toLocaleDateString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function renderCardTorneoPrincipal(torneo) {
  const nombre = limpiarCodigoTorneo(torneo?.nombre) || "Torneo LT&C";
  const estado = (torneo?.estado || "planificacion").replace("planificacion", "borrador");
  const labelEstado =
    { borrador: "Borrador", inscripcion: "Inscripción", en_curso: "En Curso", finalizado: "Finalizado" }[estado] ||
    "Activo";
  const fechaInicio = formatearFechaPortal(torneo?.fecha_inicio);
  const fechaFin = formatearFechaPortal(torneo?.fecha_fin);

  return `
    <article class="portal-campeonato-card" onclick="portalVerCampeonato(${torneo.id})" role="button" tabindex="0">
      <div class="portal-card-media">
        <img src="${IMG_TORNEO_ACTIVO}" alt="${nombre}" />
      </div>
      <div class="portal-card-body">
        <span class="badge-estado estado-${estado}">${labelEstado}</span>
        <h3>${nombre}</h3>
        <p class="portal-card-date">Fecha: ${fechaInicio} - ${fechaFin}</p>
        <button class="portal-card-btn" type="button">Ver torneo</button>
      </div>
    </article>
  `;
}

function renderCardsProximos() {
  const proximos = [
    {
      titulo: "1er Campeonato Interjorgas Financiero",
      fecha: "Inauguración 28 de marzo de 2026",
      imagen: IMG_TORNEO_PROXIMO,
      className: "portal-card-featured",
      boton: "Próximo torneo",
    },
    {
      titulo: "Próximo Torneo Empresarial",
      fecha: "Fecha: Próximamente",
      imagen: IMG_TORNEO_SVG_A,
      className: "",
      boton: "Muy pronto",
    },
    {
      titulo: "Copa LT&C 2026",
      fecha: "Fecha: Próximamente",
      imagen: IMG_TORNEO_SVG_B,
      className: "",
      boton: "Muy pronto",
    },
  ];

  return proximos
    .map((item) => {
    return `
      <article class="portal-campeonato-card portal-card-upcoming ${item.className}">
        <div class="portal-card-media">
          <img src="${item.imagen}" alt="${item.titulo}" />
        </div>
        <div class="portal-card-body">
          <span class="badge-estado estado-borrador">Próximo</span>
          <h3>${item.titulo}</h3>
          <p class="portal-card-date">${item.fecha}</p>
          <button class="portal-card-btn" type="button" disabled>${item.boton}</button>
        </div>
      </article>
    `;
    })
    .join("");
}

function estadoEsVisibleEnPortal(estado) {
  return ["en_curso", "inscripcion", "planificacion", "borrador"].includes(String(estado || ""));
}

function renderErrorPortal(mensaje) {
  const cont = document.getElementById("portal-lista-campeonatos");
  if (!cont) return;
  cont.innerHTML = `<p class="empty-msg">${mensaje}</p>`;
}

async function portalCargarCampeonatos(listaForzada = null, options = {}) {
  const cont = document.getElementById("portal-lista-campeonatos");
  const mostrarProximos = options?.mostrarProximos !== false;
  try {
    let lista = Array.isArray(listaForzada) ? listaForzada : null;
    if (!lista) {
      const data = await fetch(`${API}/campeonatos`).then((r) => r.json());
      lista = data.campeonatos || data || [];
    }
    const activos = (lista || []).filter((c) => estadoEsVisibleEnPortal(c.estado));

    if (!mostrarProximos) {
      if (!activos.length) {
        cont.innerHTML = '<p class="empty-msg">No hay torneos públicos para este organizador.</p>';
        return;
      }
      cont.innerHTML = activos.map((t) => renderCardTorneoPrincipal(t)).join("");
      return;
    }

    if (!activos.length) {
      cont.innerHTML = `
        <article class="portal-campeonato-card portal-card-upcoming">
          <div class="portal-card-media">
            <img src="${IMG_TORNEO_ACTIVO}" alt="Torneo LT&C" />
          </div>
          <div class="portal-card-body">
            <span class="badge-estado estado-borrador">Borrador</span>
            <h3>Torneo LT&C</h3>
            <p class="portal-card-date">Fecha: Por definir</p>
            <button class="portal-card-btn" type="button" disabled>Sin torneos activos</button>
          </div>
        </article>
        ${renderCardsProximos()}
      `;
      return;
    }

    const principal = activos[0];
    cont.innerHTML = `${renderCardTorneoPrincipal(principal)}${renderCardsProximos()}`;
  } catch (err) {
    console.error(err);
    cont.innerHTML = '<p class="empty-msg">Error cargando torneos.</p>';
  }
}

function aplicarModoLandingOrganizador(payload) {
  const organizador = payload?.organizador || {};
  const campeonatos = Array.isArray(payload?.campeonatos) ? payload.campeonatos : [];
  const torneosVisibles = campeonatos.filter((c) => estadoEsVisibleEnPortal(c.estado));
  const totalCategorias = campeonatos.reduce(
    (acc, c) => acc + (Number.parseInt(c.total_categorias, 10) || 0),
    0
  );
  const totalEquipos = campeonatos.reduce(
    (acc, c) => acc + (Number.parseInt(c.total_equipos, 10) || 0),
    0
  );

  const heroTitle = document.getElementById("ltc-hero-title");
  const heroDescription = document.getElementById("ltc-hero-description");
  const heroChip = document.getElementById("ltc-hero-chip");
  const heroCta = document.getElementById("ltc-hero-cta");
  const torneosTitle = document.getElementById("ltc-torneos-title");
  const torneosSubtitle = document.getElementById("ltc-torneos-subtitle");
  const newsTitle = document.getElementById("ltc-news-title");
  const newsDescription = document.getElementById("ltc-news-description");
  const newsAuthor = document.getElementById("ltc-news-author");
  const contactEmail = document.getElementById("ltc-contact-email");
  const banner = document.getElementById("ltc-organizador-banner");
  const preciosSection = document.getElementById("precios");
  const navPrecios = document.getElementById("ltc-nav-link-precios");

  if (heroTitle) heroTitle.textContent = `Torneos de ${organizador.nombre || "Organizador"}`;
  if (heroDescription) {
    heroDescription.textContent =
      "Landing pública del organizador con campeonatos activos, categorías, fixture y tablas actualizadas.";
  }
  if (heroChip) heroChip.textContent = "LANDING OFICIAL";
  if (heroCta) {
    heroCta.textContent = "Ver torneos";
    heroCta.href = "#torneos";
  }
  if (torneosTitle) torneosTitle.textContent = `CAMPEONATOS DE ${String(organizador.nombre || "ORGANIZADOR").toUpperCase()}`;
  if (torneosSubtitle) {
    torneosSubtitle.textContent =
      "Competencias visibles para equipos, jugadores y audiencia del campeonato.";
  }

  if (newsTitle) newsTitle.textContent = "Información del organizador";
  if (newsDescription) {
    newsDescription.textContent = `Actualmente tiene ${torneosVisibles.length} torneo(s) visible(s), ${totalCategorias} categoría(s) y ${totalEquipos} equipo(s) registrados.`;
  }
  if (newsAuthor) newsAuthor.textContent = organizador.nombre || "Organizador";

  if (contactEmail) {
    const mail = String(organizador.email || "").trim();
    if (mail) {
      contactEmail.textContent = mail;
      contactEmail.href = `mailto:${mail}`;
    }
  }

  if (banner) {
    const plan = String(organizador.plan_nombre || organizador.plan_codigo || "").trim();
    banner.innerHTML = `
      <strong>${organizador.nombre || "Organizador"}</strong> •
      Plan: <strong>${plan || "N/D"}</strong> •
      Torneos visibles: <strong>${torneosVisibles.length}</strong>
    `;
    banner.style.display = "block";
  }

  if (preciosSection) preciosSection.style.display = "none";
  if (navPrecios) navPrecios.style.display = "none";

  document
    .querySelectorAll(
      "#ltc-nav-register, #ltc-nav-login, #ltc-head-register, #ltc-head-login"
    )
    .forEach((el) => {
      if (el) el.style.display = "none";
    });
}

async function cargarLandingOrganizador(organizadorId) {
  const resp = await fetch(`${API}/auth/organizadores/${organizadorId}/landing`);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.error || "No se pudo cargar la landing del organizador");
  }
  aplicarModoLandingOrganizador(data);
  await portalCargarCampeonatos(data.campeonatos || [], { mostrarProximos: false });
  return data;
}

async function portalVerCampeonato(campeonatoId, options = {}) {
  document.getElementById("portal-inicio").classList.remove("active");
  document.getElementById("portal-detalle").classList.add("active");
  const cont = document.getElementById("portal-detalle-contenido");
  cont.innerHTML = "<p>Cargando...</p>";

  try {
    const [campRes, eventosRes] = await Promise.all([
      fetch(`${API}/campeonatos/${campeonatoId}`).then((r) => r.json()),
      fetch(`${API}/eventos/campeonato/${campeonatoId}`).then((r) => r.json()),
    ]);
    const camp = campRes.campeonato || campRes;
    const eventos = eventosRes.eventos || eventosRes || [];
    const eventoObjetivo = Number.parseInt(options?.eventoId || "", 10);
    const eventosFiltrados =
      Number.isFinite(eventoObjetivo) && eventoObjetivo > 0
        ? eventos.filter((ev) => Number(ev.id) === eventoObjetivo)
        : eventos;

    let html = `
      <div class="portal-card">
        <h2>${limpiarCodigoTorneo(camp.nombre) || "Torneo"}</h2>
        <p>${camp.organizador || ""} • ${camp.fecha_inicio || ""} - ${camp.fecha_fin || ""}</p>
      </div>
    `;

    for (const ev of eventosFiltrados) {
      const partidosRes = await fetch(`${API}/partidos/evento/${ev.id}`).then((r) => r.json());
      const partidos = partidosRes.partidos || partidosRes || [];
      const gruposRes = await fetch(`${API}/grupos/evento/${ev.id}`)
        .then((r) => r.json())
        .catch(() => ({ grupos: [] }));
      const grupos = gruposRes.grupos || gruposRes || [];

      html += `<div class="portal-card"><h3>📅 ${limpiarCodigoTorneo(ev.nombre) || "Categoría"}</h3>`;

      if (partidos.length) {
        html += "<h4>Fixture / Resultados</h4>";
        partidos.slice(0, 20).forEach((p) => {
          const res =
            p.estado === "finalizado" ? `${p.resultado_local || 0} - ${p.resultado_visitante || 0}` : "vs";
          html += `
            <div class="partido-publico">
              <div class="equipo-nombre">${p.equipo_local_nombre || "-"}</div>
              <div class="marcador">${res}</div>
              <div class="equipo-nombre">${p.equipo_visitante_nombre || "-"}</div>
            </div>
          `;
        });
        if (partidos.length > 20) html += `<p><small>... y ${partidos.length - 20} partidos más</small></p>`;
      }

      if (grupos.length) {
        html += "<h4>Tablas de posición</h4>";
        for (const g of grupos) {
          try {
            const tablaRes = await fetch(`${API}/tablas/grupo/${g.id}`).then((r) => r.json());
            const tabla = tablaRes.tabla || [];
            if (tabla.length) {
              html += `<p><strong>${g.nombre_grupo || g.letra_grupo || "Grupo"}</strong></p>`;
              html +=
                "<table class=\"tabla-posicion\"><tr><th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th></tr>";
              tabla.forEach((row, i) => {
                const est = row.estadisticas || {};
                html += `<tr>
                  <td>${row.posicion || i + 1}</td>
                  <td>${row.equipo?.nombre || "-"}</td>
                  <td>${est.partidos_jugados || 0}</td>
                  <td>${est.partidos_ganados || 0}</td>
                  <td>${est.partidos_empatados || 0}</td>
                  <td>${est.partidos_perdidos || 0}</td>
                  <td>${est.goles_favor || 0}</td>
                  <td>${est.goles_contra || 0}</td>
                  <td>${(est.goles_favor || 0) - (est.goles_contra || 0)}</td>
                  <td><strong>${row.puntos || 0}</strong></td>
                </tr>`;
              });
              html += "</table>";
            }
          } catch (_) {}
        }
      }

      html += "</div>";
    }

    cont.innerHTML = html || '<p class="empty-msg">Sin datos disponibles.</p>';
  } catch (err) {
    console.error(err);
    cont.innerHTML = '<p class="empty-msg">Error cargando datos.</p>';
  }
}

function portalVolver() {
  document.getElementById("portal-detalle").classList.remove("active");
  document.getElementById("portal-inicio").classList.add("active");
}

window.portalVerCampeonato = portalVerCampeonato;
window.portalVolver = portalVolver;

document.addEventListener("DOMContentLoaded", async () => {
  const contexto = leerContextoPortalDesdeUrl();

  if (contexto.organizadorId) {
    try {
      const landing = await cargarLandingOrganizador(contexto.organizadorId);
      if (contexto.campeonatoId) {
        const lista = Array.isArray(landing?.campeonatos) ? landing.campeonatos : [];
        const permitido = lista.some((c) => Number(c.id) === Number(contexto.campeonatoId));
        if (permitido) {
          portalVerCampeonato(contexto.campeonatoId, { eventoId: contexto.eventoId });
        }
      }
      return;
    } catch (error) {
      console.error(error);
      renderErrorPortal(error.message || "No se pudo cargar la landing del organizador.");
      return;
    }
  }

  await portalCargarCampeonatos();
  if (contexto.campeonatoId) {
    portalVerCampeonato(contexto.campeonatoId, { eventoId: contexto.eventoId });
  }
});

