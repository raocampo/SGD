const API = window.resolveApiBaseUrl
  ? window.resolveApiBaseUrl()
  : window.API_BASE_URL || `${window.location.origin}/api`;
const BACKEND_BASE = API.replace(/\/api\/?$/, "");
const IMG_TORNEO_ACTIVO = "assets/ltc/torneos/Torneo1.jpeg";
const IMG_TORNEO_PROXIMO = "assets/ltc/torneos/ProximoTorneo.jpeg";
const IMG_TORNEO_SVG_A = "assets/ltc/torneos/ProximoA.svg";
const IMG_TORNEO_SVG_B = "assets/ltc/torneos/ProximoB.svg";
const ES_PORTAL_PAGE = /\/portal\.html$/i.test(window.location.pathname);

let portalContextoActual = null;

function leerContextoPortalDesdeUrl() {
  const pageKey = ES_PORTAL_PAGE ? "portal.html" : "index.html";
  const routeContext = window.RouteContext?.read?.(pageKey, [
    "campeonato",
    "evento",
    "organizador",
  ]) || {};
  const campeonato = Number.parseInt(routeContext.campeonato || "", 10);
  const evento = Number.parseInt(routeContext.evento || "", 10);
  const organizador = Number.parseInt(routeContext.organizador || "", 10);
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

function normalizarMediaPortal(url) {
  return normalizarLogoUrl(url);
}

function obtenerUrlInicioPortalCompartible() {
  const organizadorId = Number.parseInt(portalContextoActual?.organizadorId, 10);
  if (Number.isFinite(organizadorId) && organizadorId > 0) {
    window.RouteContext?.save?.("index.html", { organizador: organizadorId });
  }
  return "index.html#torneos";
}

function abrirTorneoEnNuevaPestana(href, contexto = null) {
  let targetHref = String(href || "").trim();
  if (!targetHref && contexto?.campeonatoId) {
    targetHref = construirUrlPortalCampeonato(contexto.campeonatoId, {
      eventoId: contexto?.eventoId,
      organizadorId: contexto?.organizadorId,
    });
  }
  if (!targetHref) return;
  if (contexto && typeof contexto === "object") {
    window.RouteContext?.save?.("portal.html", {
      campeonato: Number.isFinite(Number.parseInt(contexto.campeonatoId, 10))
        ? Number.parseInt(contexto.campeonatoId, 10)
        : null,
      evento: Number.isFinite(Number.parseInt(contexto.eventoId, 10))
        ? Number.parseInt(contexto.eventoId, 10)
        : null,
      organizador: Number.isFinite(Number.parseInt(contexto.organizadorId, 10))
        ? Number.parseInt(contexto.organizadorId, 10)
        : null,
    });
  }
  window.open(targetHref, "_blank", "noopener");
}

function abrirDetallePortalCampeonato(campeonatoId, organizadorId = null) {
  const contexto = {
    campeonatoId: Number.parseInt(campeonatoId, 10) || null,
    organizadorId: Number.parseInt(organizadorId, 10) || null,
  };
  guardarContextoPortalCompartible(contexto);
  abrirTorneoEnNuevaPestana(
    construirUrlPortalCampeonato(contexto.campeonatoId, {
      organizadorId: contexto.organizadorId,
    }),
    contexto
  );
}

function obtenerImagenCardPortal(torneo) {
  const custom = normalizarMediaPortal(
    torneo?.card_image_url || torneo?.organizador_logo_url || torneo?.logo_url || ""
  );
  if (custom) return custom;
  const estado = String(torneo?.estado || "planificacion")
    .trim()
    .toLowerCase()
    .replace("planificacion", "borrador");
  return estado === "en_curso" ? IMG_TORNEO_ACTIVO : IMG_TORNEO_PROXIMO;
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

// Parsea una fecha evitando el desfase UTC.
// PostgreSQL/pg puede devolver DATE como "YYYY-MM-DD" o como "YYYY-MM-DDT00:00:00.000Z".
// Ambos casos representan solo una fecha sin hora real → se construyen como hora local
// para evitar que UTC-5 retroceda el display 1 día.
function parseFechaLocalPortal(valor) {
  if (!valor) return null;
  const s = String(valor).trim();
  // Extraer la parte YYYY-MM-DD si es string de solo fecha o ISO medianoche UTC
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00|$)/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  // Fecha con hora real → new Date() interpreta correctamente
  return new Date(s);
}

function formatearFechaPortal(fecha) {
  if (!fecha) return "Por definir";
  const d = parseFechaLocalPortal(fecha);
  if (!d || Number.isNaN(d.getTime())) return String(fecha);
  return d.toLocaleDateString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function limpiarResumenPortal(texto = "", max = 180) {
  const clean = String(texto || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}...`;
}

function escPortal(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizarCategoriasResumenPortal(resumen) {
  const data =
    typeof resumen === "string"
      ? (() => {
          try {
            return JSON.parse(resumen);
          } catch (_) {
            return [];
          }
        })()
      : resumen;

  if (!Array.isArray(data)) return [];
  return data
    .map((item) => ({
      id: Number.parseInt(item?.id, 10),
      nombre: limpiarCodigoTorneo(item?.nombre || ""),
      total_equipos: Number.parseInt(item?.total_equipos, 10) || 0,
      modalidad: item?.modalidad || null,
      metodo_competencia: item?.metodo_competencia || "grupos",
      clasificacion_tabla_acumulada: item?.clasificacion_tabla_acumulada === true,
    }))
    .filter((item) => Number.isFinite(item.id) && item.id > 0 && item.nombre);
}

function capitalizarPortal(texto = "") {
  const clean = String(texto || "").trim();
  if (!clean) return "";
  return `${clean.charAt(0).toUpperCase()}${clean.slice(1)}`;
}

function humanizarTokenPortal(valor = "") {
  return String(valor || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
}

function formatearModalidadPortal(valor = "") {
  const raw = String(valor || "").trim().toLowerCase();
  if (!raw) return "";
  const alias = {
    weekend: "Fin de semana",
    fin_de_semana: "Fin de semana",
    semanal: "Semanal",
    diario: "Diario",
  };
  return alias[raw] || capitalizarPortal(humanizarTokenPortal(raw));
}

function formatearFormatoCompetenciaPortal(valor = "") {
  const raw = String(valor || "").trim().toLowerCase();
  if (!raw) return "";
  const alias = {
    grupos: "Grupos",
    liga: "Liga",
    eliminatoria: "Eliminatoria",
    todos_contra_todos: "Todos contra todos",
    grupos_y_eliminacion: "Grupos y eliminacion",
    tabla_acumulada: "Tabla acumulada",
  };
  return alias[raw] || capitalizarPortal(humanizarTokenPortal(raw));
}

function obtenerMetodoCompetenciaVisiblePortal(item = {}) {
  if (item?.clasificacion_tabla_acumulada === true) return "tabla_acumulada";
  return String(item?.metodo_competencia || "grupos").trim().toLowerCase();
}

function renderMetaCardPortal(torneo) {
  const categorias = normalizarCategoriasResumenPortal(torneo?.categorias_resumen);
  if (!categorias.length) return "";

  const modalidades = [...new Set(categorias.map((item) => formatearModalidadPortal(item.modalidad)).filter(Boolean))];
  const formatos = [
    ...new Set(
      categorias
        .map((item) => formatearFormatoCompetenciaPortal(obtenerMetodoCompetenciaVisiblePortal(item)))
        .filter(Boolean)
    ),
  ];
  const resumen = [];
  if (modalidades.length) resumen.push(`Modalidad: ${modalidades.join(" / ")}`);
  if (formatos.length) resumen.push(`Formato: ${formatos.join(" / ")}`);
  if (!resumen.length) return "";
  return `<p class="portal-card-meta">${escPortal(resumen.join(" · "))}</p>`;
}

function obtenerMotivoEliminacionPortal(row = {}) {
  if (row.eliminado_manual === true) {
    return row.motivo_eliminacion_label || "Eliminado manualmente";
  }
  const noPresentaciones = Number(row.no_presentaciones || 0);
  if (row.eliminado_automatico === true && noPresentaciones > 0) {
    return `${noPresentaciones} no presentaciones`;
  }
  return row.eliminado_competencia === true ? "Equipo eliminado" : "";
}

function renderCeldaEliminadoPortal(row = {}, classes = "") {
  const motivo = obtenerMotivoEliminacionPortal(row);
  const className = [classes, "portal-tabla-posicion-eliminado-main"].filter(Boolean).join(" ");
  return `
    <td class="${className}" colspan="8" ${motivo ? `title="${escPortal(motivo)}"` : ""}>
      <div class="portal-tabla-posicion-eliminado-overlay">ELIMINADO</div>
    </td>
  `;
}

function construirUrlPortalCampeonato(campeonatoId, options = {}) {
  const params = new URLSearchParams();
  params.set("campeonato", String(campeonatoId));
  if (Number.isFinite(Number.parseInt(options?.eventoId, 10))) {
    params.set("evento", String(Number.parseInt(options.eventoId, 10)));
  }
  if (Number.isFinite(Number.parseInt(options?.organizadorId, 10))) {
    params.set("organizador", String(Number.parseInt(options.organizadorId, 10)));
  }
  return `portal.html?${params.toString()}`;
}

function guardarContextoPortalCompartible(contexto = {}) {
  const payload = {
    campeonato: Number.isFinite(Number.parseInt(contexto?.campeonatoId, 10))
      ? Number.parseInt(contexto.campeonatoId, 10)
      : null,
    evento: Number.isFinite(Number.parseInt(contexto?.eventoId, 10))
      ? Number.parseInt(contexto.eventoId, 10)
      : null,
    organizador: Number.isFinite(Number.parseInt(contexto?.organizadorId, 10))
      ? Number.parseInt(contexto.organizadorId, 10)
      : null,
  };
  window.RouteContext?.save?.("portal.html", payload);
  if (!ES_PORTAL_PAGE) {
    window.RouteContext?.save?.("index.html", payload);
  }
}

function renderCategoriasResumenCard(torneo) {
  const categorias = normalizarCategoriasResumenPortal(torneo?.categorias_resumen);
  if (!categorias.length) return "";

  return `
    <div class="portal-card-categorias">
      ${categorias
        .map(
          (categoria) => `
            <span class="portal-card-categoria-chip">
              ${escPortal(categoria.nombre)} <strong>${categoria.total_equipos}</strong>
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function renderCardTorneoPrincipal(torneo) {
  const nombre = limpiarCodigoTorneo(torneo?.nombre) || "Torneo LT&C";
  const organizador = String(torneo?.organizador || "").trim();
  const estado = String(torneo?.estado || "planificacion")
    .trim()
    .toLowerCase()
    .replace("planificacion", "borrador");
  const labelEstado =
    { borrador: "Borrador", inscripcion: "Inscripción", en_curso: "En Curso", finalizado: "Finalizado" }[estado] ||
    "Activo";
  const imagenCard = obtenerImagenCardPortal(torneo);
  const fechaInicio = formatearFechaPortal(torneo?.fecha_inicio);
  const fechaFin = formatearFechaPortal(torneo?.fecha_fin);
  const campeonatoId = Number.parseInt(torneo?.id, 10) || 0;
  const organizadorId = Number.parseInt(portalContextoActual?.organizadorId, 10) || 0;
  const hrefPortal = construirUrlPortalCampeonato(campeonatoId, {
    organizadorId: organizadorId || null,
  });
  const textoFecha =
    fechaInicio && fechaFin ? `Fecha: ${fechaInicio} - ${fechaFin}` : fechaInicio ? `Fecha: ${fechaInicio}` : "Fecha por confirmar";

  return `
    <article
      class="portal-campeonato-card"
      onclick="abrirDetallePortalCampeonato(${campeonatoId}, ${organizadorId || "null"})"
      onkeypress="if(event.key==='Enter'||event.key===' '){event.preventDefault();abrirDetallePortalCampeonato(${campeonatoId}, ${organizadorId || "null"});}"
      role="button"
      tabindex="0"
    >
      <div class="portal-card-media">
        <img src="${imagenCard}" alt="${nombre}" />
      </div>
      <div class="portal-card-body">
        <span class="badge-estado estado-${estado}">${labelEstado}</span>
        ${organizador ? `<p class="portal-card-organizer">${escPortal(organizador)}</p>` : ""}
        <h3>${nombre}</h3>
        <p class="portal-card-date">${textoFecha}</p>
        ${renderMetaCardPortal(torneo)}
        ${renderCategoriasResumenCard(torneo)}
        <div class="portal-card-actions">
          <a
            class="portal-card-btn"
            href="${escPortal(hrefPortal)}"
            target="_blank"
            rel="noopener noreferrer"
            onclick="event.stopPropagation(); abrirDetallePortalCampeonato(${campeonatoId}, ${organizadorId || "null"}); return false;"
          >Ver torneo</a>
        </div>
      </div>
    </article>
  `;
}

function ordenarTorneosPortal(lista = []) {
  const prioridadEstado = {
    en_curso: 0,
    inscripcion: 1,
    planificacion: 2,
    borrador: 3,
    finalizado: 4,
  };

  return [...lista].sort((a, b) => {
    const estadoA = String(a?.estado || "").trim().toLowerCase();
    const estadoB = String(b?.estado || "").trim().toLowerCase();
    const diffEstado = (prioridadEstado[estadoA] ?? 99) - (prioridadEstado[estadoB] ?? 99);
    if (diffEstado !== 0) return diffEstado;

    const fechaA = new Date(a?.fecha_inicio || a?.created_at || 0).getTime() || 0;
    const fechaB = new Date(b?.fecha_inicio || b?.created_at || 0).getTime() || 0;
    return fechaA - fechaB;
  });
}

function estadoEsVisibleEnPortal(estado) {
  return ["en_curso", "inscripcion", "planificacion", "borrador"].includes(
    String(estado || "").trim().toLowerCase()
  );
}

function renderErrorPortal(mensaje) {
  const cont = document.getElementById("portal-lista-campeonatos");
  if (!cont) return;
  cont.innerHTML = `<p class="empty-msg">${mensaje}</p>`;
}

async function portalCargarCampeonatos(listaForzada = null, options = {}) {
  const cont = document.getElementById("portal-lista-campeonatos");
  try {
    let lista = Array.isArray(listaForzada) ? listaForzada : null;
    if (!lista) {
      const data = window.PortalPublicAPI
        ? await window.PortalPublicAPI.listarCampeonatos()
        : await fetch(`${API}/public/campeonatos`).then((r) => r.json());
      lista = data.campeonatos || data || [];
    }
    const activos = ordenarTorneosPortal((lista || []).filter((c) => estadoEsVisibleEnPortal(c.estado)));

    if (!activos.length) {
      cont.innerHTML = '<p class="empty-msg">No hay torneos públicos para este organizador.</p>';
      return;
    }

    cont.innerHTML = activos.map((t) => renderCardTorneoPrincipal(t)).join("");
  } catch (err) {
    console.error(err);
    cont.innerHTML = '<p class="empty-msg">Error cargando torneos.</p>';
  }
}

function aplicarModoLandingOrganizador(payload) {
  const organizador = payload?.organizador || {};
  const portalConfig = payload?.portal_config || {};
  const auspiciantes = Array.isArray(payload?.auspiciantes) ? payload.auspiciantes : [];
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
  const contactPhone = document.getElementById("ltc-contact-phone");
  const contactTitle = document.getElementById("ltc-contact-title");
  const contactDescription = document.getElementById("ltc-contact-description");
  const aboutTitle = document.getElementById("ltc-about-title");
  const aboutText1 = document.getElementById("ltc-about-text-1");
  const aboutText2 = document.getElementById("ltc-about-text-2");
  const aboutImage = document.getElementById("ltc-about-image");
  const heroMediaImage = document.querySelector(".ltc-hero-media-shape img");
  const socialFacebook = document.getElementById("ltc-social-facebook");
  const socialInstagram = document.getElementById("ltc-social-instagram");
  const socialWhatsapp = document.getElementById("ltc-social-whatsapp");
  const gallerySection = document.getElementById("galeria");
  const galleryTitle = document.getElementById("ltc-gallery-title");
  const gallerySubtitle = document.getElementById("ltc-gallery-subtitle");
  const galleryGrid = document.getElementById("ltc-gallery-grid");
  const sponsorsSection = document.getElementById("auspiciantes");
  const sponsorsTitle = document.getElementById("ltc-sponsors-title");
  const sponsorsSubtitle = document.getElementById("ltc-sponsors-subtitle");
  const sponsorsTrack = document.getElementById("ltc-sponsors-track");
  const brandImages = document.querySelectorAll(".ltc-header-brand img");
  const banner = document.getElementById("ltc-organizador-banner");
  const preciosSection = document.getElementById("precios");
  const navPrecios = document.getElementById("ltc-nav-link-precios");

  if (heroTitle) {
    heroTitle.textContent =
      portalConfig.hero_title || `Torneos de ${organizador.organizacion_nombre || organizador.nombre || "Organizador"}`;
  }
  if (heroDescription) {
    heroDescription.textContent =
      portalConfig.hero_description ||
      "Landing pública del organizador con campeonatos activos, categorías, fixture y tablas actualizadas.";
  }
  if (heroChip) heroChip.textContent = portalConfig.hero_chip || "LANDING OFICIAL";
  if (heroCta) {
    heroCta.textContent = portalConfig.hero_cta_label || "Ver torneos";
    heroCta.href = "#torneos";
  }
  if (torneosTitle) {
    torneosTitle.textContent = `CAMPEONATOS DE ${String(
      portalConfig.organizacion_nombre || organizador.organizacion_nombre || organizador.nombre || "ORGANIZADOR"
    ).toUpperCase()}`;
  }
  if (torneosSubtitle) {
    torneosSubtitle.textContent =
      "Competencias visibles para equipos, jugadores y audiencia del campeonato.";
  }

  if (newsTitle) newsTitle.textContent = "Información del organizador";
  if (newsDescription) {
    newsDescription.textContent = `Actualmente tiene ${torneosVisibles.length} torneo(s) visible(s), ${totalCategorias} categoría(s) y ${totalEquipos} equipo(s) registrados.`;
  }
  if (newsAuthor) {
    newsAuthor.textContent =
      portalConfig.organizacion_nombre || organizador.organizacion_nombre || organizador.nombre || "Organizador";
  }

  if (contactEmail) {
    const mail = String(portalConfig.contact_email || organizador.email || "").trim();
    if (mail) {
      contactEmail.textContent = mail;
      contactEmail.href = `mailto:${mail}`;
    }
  }
  if (contactPhone) {
    const phone = String(portalConfig.contact_phone || "").trim();
    if (phone) {
      contactPhone.textContent = phone;
    }
  }
  if (contactTitle && portalConfig.contact_title) {
    contactTitle.textContent = portalConfig.contact_title;
  }
  if (contactDescription && portalConfig.contact_description) {
    contactDescription.textContent = portalConfig.contact_description;
  }

  if (aboutTitle && portalConfig.about_title) {
    aboutTitle.textContent = portalConfig.about_title;
  }
  if (aboutText1 && portalConfig.about_text_1) {
    aboutText1.textContent = portalConfig.about_text_1;
  }
  if (aboutText2 && portalConfig.about_text_2) {
    aboutText2.textContent = portalConfig.about_text_2;
  }
  if (aboutImage && portalConfig.hero_image_url) {
    aboutImage.src = normalizarMediaPortal(portalConfig.hero_image_url);
  }
  if (heroMediaImage && portalConfig.hero_image_url) {
    heroMediaImage.src = normalizarMediaPortal(portalConfig.hero_image_url);
  }
  if (socialFacebook && portalConfig.facebook_url) {
    socialFacebook.href = portalConfig.facebook_url;
  }
  if (socialInstagram && portalConfig.instagram_url) {
    socialInstagram.href = portalConfig.instagram_url;
  }
  if (socialWhatsapp && portalConfig.whatsapp_url) {
    socialWhatsapp.href = portalConfig.whatsapp_url;
  }

  const brandLogo = normalizarMediaPortal(portalConfig.logo_url);
  if (brandLogo) {
    brandImages.forEach((img) => {
      img.src = brandLogo;
      img.alt = portalConfig.organizacion_nombre || organizador.organizacion_nombre || organizador.nombre || "Organizador";
    });
  }

  if (gallerySection) {
    const landingGallery = Array.isArray(payload?.landing_gallery) ? payload.landing_gallery : [];
    if (landingGallery.length && galleryGrid) {
      if (galleryTitle) galleryTitle.textContent = "GALERÍA DEL ORGANIZADOR";
      if (gallerySubtitle) {
        gallerySubtitle.textContent = `Imágenes públicas de ${
          portalConfig.organizacion_nombre || organizador.organizacion_nombre || organizador.nombre || "este organizador"
        }.`;
      }
      galleryGrid.innerHTML = renderGaleriaPortalItems(
        landingGallery,
        "Este organizador todavía no ha publicado imágenes en su landing."
      );
      gallerySection.style.display = "";
    } else {
      gallerySection.style.display = "none";
    }
  }

  if (banner) {
    const plan = String(organizador.plan_nombre || organizador.plan_codigo || "").trim();
    banner.innerHTML = `
      <strong>${portalConfig.organizacion_nombre || organizador.organizacion_nombre || organizador.nombre || "Organizador"}</strong> •
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

  if (sponsorsSection) {
    if (auspiciantes.length && sponsorsTrack) {
      if (sponsorsTitle) sponsorsTitle.textContent = "AUSPICIANTES DEL ORGANIZADOR";
      if (sponsorsSubtitle) {
        sponsorsSubtitle.textContent = `Marcas que respaldan ${
          portalConfig.organizacion_nombre || organizador.organizacion_nombre || organizador.nombre || "este organizador"
        }.`;
      }
      sponsorsTrack.innerHTML = renderTrackAuspiciantesPortal(auspiciantes);
      sponsorsSection.style.display = "";
      sponsorsSection.hidden = false;
    } else {
      sponsorsSection.style.display = "none";
      sponsorsSection.hidden = true;
    }
  }
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

async function cargarNoticiasPublicasPortal() {
  const newsTitle = document.getElementById("ltc-news-title");
  const newsDescription = document.getElementById("ltc-news-description");
  const newsAuthor = document.getElementById("ltc-news-author");
  const newsLink = document.getElementById("ltc-news-link");

  try {
    const resp = await fetch(`${API}/public/noticias`);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || "No se pudo cargar noticias");
    const noticia = Array.isArray(data?.noticias) && data.noticias.length ? data.noticias[0] : null;
    if (!noticia) {
      if (newsLink) {
        newsLink.textContent = "Ver blog";
        newsLink.href = "blog.html";
      }
      return;
    }

    if (newsTitle) newsTitle.textContent = noticia.titulo || "Últimas noticias";
    if (newsDescription) {
      newsDescription.textContent = limpiarResumenPortal(noticia.resumen || noticia.contenido || "", 220);
    }
    if (newsAuthor) {
      const fecha = formatearFechaPortal(noticia.publicada_at || noticia.created_at);
      const autor = noticia.autor_nombre || "LT&C";
      newsAuthor.textContent = `${autor} • ${fecha}`;
    }
    if (newsLink) {
      newsLink.textContent = "Leer noticia";
      newsLink.href = noticia.slug ? `noticia.html?slug=${encodeURIComponent(noticia.slug)}` : "blog.html";
    }
  } catch (error) {
    console.error(error);
    if (newsLink) {
      newsLink.textContent = "Ver blog";
      newsLink.href = "blog.html";
    }
  }
}

function aplicarContenidoPortal(contenido) {
  if (!contenido) return;

  const heroTitle = document.getElementById("ltc-hero-title");
  const heroDescription = document.getElementById("ltc-hero-description");
  const heroChip = document.getElementById("ltc-hero-chip");
  const heroCta = document.getElementById("ltc-hero-cta");
  const aboutTitle = document.getElementById("ltc-about-title");
  const aboutText1 = document.getElementById("ltc-about-text-1");
  const aboutText2 = document.getElementById("ltc-about-text-2");
  const aboutImage = document.getElementById("ltc-about-image");
  const contactTitle = document.getElementById("ltc-contact-title");
  const contactDescription = document.getElementById("ltc-contact-description");
  const contactEmail = document.getElementById("ltc-contact-email");
  const contactPhone = document.getElementById("ltc-contact-phone");
  const socialFacebook = document.getElementById("ltc-social-facebook");
  const socialInstagram = document.getElementById("ltc-social-instagram");
  const socialWhatsapp = document.getElementById("ltc-social-whatsapp");
  const featureCards = document.getElementById("ltc-feature-cards");

  if (heroTitle) heroTitle.textContent = contenido.hero_title || heroTitle.textContent;
  if (heroDescription) {
    heroDescription.textContent = contenido.hero_description || heroDescription.textContent;
  }
  if (heroChip) heroChip.textContent = contenido.hero_chip || heroChip.textContent;
  if (heroCta) heroCta.textContent = contenido.hero_cta_label || heroCta.textContent;

  if (aboutTitle) aboutTitle.textContent = contenido.about_title || aboutTitle.textContent;
  if (aboutText1) aboutText1.textContent = contenido.about_text_1 || aboutText1.textContent;
  if (aboutText2) aboutText2.textContent = contenido.about_text_2 || aboutText2.textContent;
  if (aboutImage && contenido.about_image_url) {
    aboutImage.src = contenido.about_image_url;
  }

  if (contactTitle) contactTitle.textContent = contenido.contact_title || contactTitle.textContent;
  if (contactDescription) {
    contactDescription.textContent = contenido.contact_description || contactDescription.textContent;
  }
  if (contactEmail && contenido.contact_email) {
    contactEmail.textContent = contenido.contact_email;
    contactEmail.href = `mailto:${contenido.contact_email}`;
  }
  if (contactPhone && contenido.contact_phone) {
    contactPhone.textContent = contenido.contact_phone;
    contactPhone.href = contenido.whatsapp_url || "#";
  }
  if (socialFacebook && contenido.facebook_url) socialFacebook.href = contenido.facebook_url;
  if (socialInstagram && contenido.instagram_url) socialInstagram.href = contenido.instagram_url;
  if (socialWhatsapp && contenido.whatsapp_url) socialWhatsapp.href = contenido.whatsapp_url;

  if (featureCards && Array.isArray(contenido.cards_json) && contenido.cards_json.length) {
    featureCards.innerHTML = contenido.cards_json
      .map(
        (item) => `
          <article class="ltc-feature-card">
            <i class="fas ${escPortal(item.icono || "fa-star")}"></i>
            <h3>${escPortal(item.titulo || "")}</h3>
            <p>${escPortal(item.descripcion || "")}</p>
          </article>
        `
      )
      .join("");
  }
}

async function cargarContenidoPortalPublico() {
  try {
    const resp = await fetch(`${API}/public/portal-contenido`);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || "No se pudo cargar contenido del portal");
    aplicarContenidoPortal(data?.contenido || null);
  } catch (error) {
    console.error(error);
  }
}

async function cargarGaleriaPublica() {
  const cont = document.getElementById("ltc-gallery-grid");
  if (!cont) return;
  try {
    const resp = await fetch(`${API}/public/galeria`);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || "No se pudo cargar la galería");
    const items = Array.isArray(data?.items) ? data.items : [];
    if (!items.length) {
      cont.innerHTML = '<p class="empty-msg">No hay imágenes publicadas.</p>';
      return;
    }
    cont.innerHTML = items
      .map(
        (item) => `
          <article class="ltc-gallery-card">
            <img src="${escPortal(item.imagen_url || "")}" alt="${escPortal(item.titulo || "")}" onerror="this.src='assets/ltc/bannerLTC.jpg'" />
            <div class="ltc-gallery-card-copy">
              <h3>${escPortal(item.titulo || "")}</h3>
              <p>${escPortal(item.descripcion || "")}</p>
            </div>
          </article>
        `
      )
      .join("");
  } catch (error) {
    console.error(error);
    cont.innerHTML = '<p class="empty-msg">No se pudo cargar la galería.</p>';
  }
}

function initFormularioContactoPublico() {
  const form = document.getElementById("ltc-contact-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      nombre: String(document.getElementById("ltc-contact-name-input")?.value || "").trim(),
      telefono: String(document.getElementById("ltc-contact-phone-input")?.value || "").trim(),
      email: String(document.getElementById("ltc-contact-email-input")?.value || "").trim(),
      mensaje: String(document.getElementById("ltc-contact-message-input")?.value || "").trim(),
      website: String(document.getElementById("ltc-contact-website-input")?.value || "").trim(),
    };

    if (!payload.nombre || !payload.email || !payload.mensaje) {
      mostrarNotificacion("Nombre, email y mensaje son obligatorios", "warning");
      return;
    }

    const btn = document.getElementById("ltc-contact-submit");
    try {
      if (btn) btn.disabled = true;
      const resp = await fetch(`${API}/public/contacto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "No se pudo enviar el mensaje");
      form.reset();
      mostrarNotificacion("Mensaje enviado correctamente", "success");
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo enviar el mensaje", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

function renderTablasPortal(tablas = []) {
  if (!Array.isArray(tablas) || !tablas.length) {
    return '<p class="empty-msg">No hay tablas de posicion disponibles.</p>';
  }

  const bloques = tablas
    .map((grupoData) => {
      const grupo = grupoData?.grupo || {};
      const filas = Array.isArray(grupoData?.tabla) ? grupoData.tabla : [];
      if (!filas.length) return "";
      const titulo = grupo.nombre_grupo || grupo.letra_grupo || "Tabla";
      const cuposGrupo = Number.parseInt(grupo?.clasificados_por_grupo, 10);
      const rowsHtml = filas
        .map((row, index) => {
          const est = row.estadisticas || {};
          const fuera = row.fuera_clasificacion === true;
          const eliminado = row.eliminado_competencia === true || row.eliminado_manual === true;
          const classes = [fuera ? "portal-tabla-posicion-fuera" : "", eliminado ? "portal-tabla-posicion-eliminado" : ""]
            .filter(Boolean)
            .join(" ");
          const statsHtml = eliminado
            ? renderCeldaEliminadoPortal(row, classes)
            : `
                <td class="${classes}">${est.partidos_jugados || 0}</td>
                <td class="${classes}">${est.partidos_ganados || 0}</td>
                <td class="${classes}">${est.partidos_empatados || 0}</td>
                <td class="${classes}">${est.partidos_perdidos || 0}</td>
                <td class="${classes}">${est.goles_favor || 0}</td>
                <td class="${classes}">${est.goles_contra || 0}</td>
                <td class="${classes}">${(est.goles_favor || 0) - (est.goles_contra || 0)}</td>
                <td class="${classes}"><strong>${row.puntos || 0}</strong></td>
              `;
          return `<tr>
            <td class="${classes}">${row.posicion || index + 1}</td>
            <td class="${classes}">
              <div class="portal-tabla-posicion-equipo">
                <span>${escPortal(row.equipo?.nombre || "-")}</span>
                ${renderEstadoPosicionPortal(row)}
              </div>
            </td>
            ${statsHtml}
          </tr>`;
        })
        .join("");

      return `
        <div class="portal-stat-block">
          <p><strong>${titulo}</strong></p>
          ${
            Number.isFinite(cuposGrupo) && cuposGrupo > 0
              ? '<p class="portal-tabla-clasificacion-help">Se pintan en naranja los equipos fuera de clasificación y en rojo oscuro los equipos eliminados.</p>'
              : ""
          }
          <div class="portal-table-wrap">
            <table class="tabla-posicion portal-tabla-posiciones">
              <thead>
                <tr><th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th></tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    })
    .filter(Boolean)
    .join("");

  if (!bloques) {
    return '<p class="empty-msg">No hay tablas de posicion disponibles.</p>';
  }

  return `<div class="portal-stat-grid">${bloques}</div>`;
}

function renderEstadoPosicionPortal(row = {}) {
  const noPresentaciones = Number(row.no_presentaciones || 0);

  if (noPresentaciones > 0) {
    return `
      <div class="portal-tabla-posicion-status">
        <span class="portal-tabla-posicion-chip is-neutral">NP ${noPresentaciones}</span>
      </div>
    `;
  }

  return "";
}

function formatearHoraPortal(hora) {
  if (!hora) return "";
  const raw = String(hora).trim();
  const match = raw.match(/^(\d{2}:\d{2})/);
  if (match) return match[1];
  const fecha = new Date(raw);
  if (!Number.isNaN(fecha.getTime())) {
    return fecha.toLocaleTimeString("es-EC", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return raw;
}

/**
 * Calcula qué equipos descansan (bye) en cada jornada del portal.
 * Un equipo descansa si aparece en otras jornadas pero no en ésta.
 * @param {Array} todosPartidos - todos los partidos del evento
 * @returns {Map<string, Array<string>>} jornada (string) -> nombres de equipos que descansan
 */
function calcularByesPortal(todosPartidos = []) {
  const equiposMap = new Map(); // id -> nombre
  for (const p of todosPartidos) {
    const lid = p.equipo_local_id   || p.local_id;
    const vid = p.equipo_visitante_id || p.visitante_id;
    const ln  = p.equipo_local_nombre   || p.local_nombre   || p.nombre_local   || "";
    const vn  = p.equipo_visitante_nombre || p.visitante_nombre || p.nombre_visitante || "";
    if (lid) equiposMap.set(String(lid), ln || String(lid));
    if (vid) equiposMap.set(String(vid), vn || String(vid));
  }
  const todosEquipos = new Set(equiposMap.keys());

  const enJornada = new Map();
  for (const p of todosPartidos) {
    const j = String(p.jornada ?? "");
    if (!enJornada.has(j)) enJornada.set(j, new Set());
    const lid = p.equipo_local_id   || p.local_id;
    const vid = p.equipo_visitante_id || p.visitante_id;
    if (lid) enJornada.get(j).add(String(lid));
    if (vid) enJornada.get(j).add(String(vid));
  }

  const byes = new Map();
  for (const [j, presentes] of enJornada.entries()) {
    const descansam = [];
    for (const eqId of todosEquipos) {
      if (!presentes.has(eqId)) {
        descansam.push(equiposMap.get(eqId) || eqId);
      }
    }
    if (descansam.length) byes.set(j, descansam);
  }
  return byes;
}

function normalizarJornadasPortal(jornadas = [], partidos = []) {
  if (Array.isArray(jornadas) && jornadas.length) {
    return jornadas
      .map((item) => ({
        numero: item?.numero ?? "Sin jornada",
        partidos: Array.isArray(item?.partidos) ? item.partidos : [],
      }))
      .sort((a, b) => {
        const aNum = Number.parseInt(a.numero, 10);
        const bNum = Number.parseInt(b.numero, 10);
        if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
        return String(a.numero).localeCompare(String(b.numero));
      });
  }

  const jornadasMap = new Map();
  (Array.isArray(partidos) ? partidos : []).forEach((partido) => {
    const numero = partido?.jornada ?? "Sin jornada";
    const key = String(numero);
    if (!jornadasMap.has(key)) {
      jornadasMap.set(key, { numero, partidos: [] });
    }
    jornadasMap.get(key).partidos.push(partido);
  });

  return Array.from(jornadasMap.values()).sort((a, b) => {
    const aNum = Number.parseInt(a.numero, 10);
    const bNum = Number.parseInt(b.numero, 10);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
    return String(a.numero).localeCompare(String(b.numero));
  });
}

function obtenerEstadoPartidoPortal(partido) {
  const estado = String(partido?.estado || "").trim().toLowerCase();
  const mapa = {
    finalizado: "Finalizado",
    programado: "Programado",
    pendiente: "Pendiente",
    en_curso: "En curso",
    suspendido: "Suspendido",
    aplazado: "Aplazado",
    no_presentaron_ambos: "No se presentaron",
  };
  return mapa[estado] || (estado ? estado.replace(/_/g, " ") : "Programado");
}

function renderLogoEquipoPortal(logoUrl, nombre) {
  if (logoUrl) {
    return `<img src="${escPortal(logoUrl)}" alt="${escPortal(nombre || "")}" class="portal-match-logo" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'portal-match-logo-placeholder',textContent:'${escPortal((nombre || "?")[0].toUpperCase())}'}))">`;
  }
  const inicial = (nombre || "?")[0].toUpperCase();
  return `<span class="portal-match-logo-placeholder">${escPortal(inicial)}</span>`;
}

function renderPartidoJornadaPortal(partido = {}) {
  const fecha = formatearFechaPortal(partido.fecha_partido || partido.fecha || partido.fecha_programada);
  const hora = formatearHoraPortal(partido.hora_partido || partido.hora || partido.hora_programada);
  const cancha = String(partido.cancha || partido.escenario || "").trim();
  const meta = [fecha, hora ? `Hora ${hora}` : "", cancha].filter(Boolean).join(" • ");
  const finalizado = String(partido.estado || "").trim().toLowerCase() === "finalizado";
  const tieneMarcador =
    Number.isFinite(Number(partido.resultado_local)) || Number.isFinite(Number(partido.resultado_visitante));
  const marcador = finalizado || tieneMarcador
    ? `${partido.resultado_local ?? 0} - ${partido.resultado_visitante ?? 0}`
    : "vs";
  const estado = obtenerEstadoPartidoPortal(partido);
  const estadoClass = String(partido.estado || "programado").replace(/[^a-z_]/gi, "_").toLowerCase();

  return `
    <article class="portal-jornada-match">
      <div class="portal-jornada-match-head">
        <span class="portal-jornada-match-status estado-${estadoClass}">${escPortal(estado)}</span>
        ${meta ? `<span class="portal-jornada-match-meta">${escPortal(meta)}</span>` : ""}
      </div>
      <div class="partido-publico">
        <div class="equipo-col equipo-local">
          ${renderLogoEquipoPortal(partido.equipo_local_logo_url, partido.equipo_local_nombre)}
          <div class="equipo-nombre">${escPortal(partido.equipo_local_nombre || "-")}</div>
        </div>
        <div class="marcador-col">
          <div class="marcador">${escPortal(marcador)}</div>
        </div>
        <div class="equipo-col equipo-visitante">
          ${renderLogoEquipoPortal(partido.equipo_visitante_logo_url, partido.equipo_visitante_nombre)}
          <div class="equipo-nombre">${escPortal(partido.equipo_visitante_nombre || "-")}</div>
        </div>
      </div>
    </article>
  `;
}

function extraerFechasJornada(partidos = []) {
  const fechas = partidos
    .map((p) => p.fecha_partido || p.fecha || p.fecha_programada)
    .filter(Boolean)
    .map((f) => parseFechaLocalPortal(f))
    .filter((d) => d && !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);
  return fechas;
}

function esJornadaFinalizada(partidos = []) {
  if (!partidos.length) return false;
  return partidos.every((p) => {
    const st = String(p.estado || "").toLowerCase();
    return st === "finalizado" || st === "no_presentaron_ambos";
  });
}

function renderBadgeJornadaPortal(partidos = []) {
  const total = partidos.length;
  if (!total) return "";
  const finalizados = partidos.filter((p) => String(p.estado || "").toLowerCase() === "finalizado").length;
  const noPresentaron = partidos.filter((p) => String(p.estado || "").toLowerCase() === "no_presentaron_ambos").length;
  const jugados = finalizados + noPresentaron;
  const enCurso = partidos.some((p) => String(p.estado || "").toLowerCase() === "en_curso");
  if (enCurso) return '<span class="portal-jornada-badge badge-en-curso">En curso</span>';
  if (jugados === total) return '<span class="portal-jornada-badge badge-finalizada">Finalizada</span>';
  if (jugados > 0) return '<span class="portal-jornada-badge badge-parcial">En curso</span>';
  return '<span class="portal-jornada-badge badge-proxima">Próxima</span>';
}

// modo: "proximas" muestra todos los botones (deshabilita finalizadas); "finalizadas" solo las completadas
function renderJornadasPortal(jornadas = [], partidos = [], modo = "proximas") {
  // Calcular byes usando TODOS los partidos del evento (no solo los del modo)
  const byesPorJornada = calcularByesPortal(partidos);
  const bloques = normalizarJornadasPortal(jornadas, partidos);

  // Para "finalizadas" solo mostramos las completadas
  const bloquesVista = modo === "finalizadas"
    ? bloques.filter((b) => esJornadaFinalizada(b.partidos))
    : bloques; // "proximas": todos los botones visibles

  if (!bloquesVista.length) {
    const msg = modo === "finalizadas"
      ? "No hay resultados registrados aún para esta categoría."
      : "No hay jornadas publicadas para esta categoría.";
    return `<p class="empty-msg">${msg}</p>`;
  }

  // Para proximas: primera jornada con al menos un partido no finalizado (habilitada)
  // Para finalizadas: la última
  let jornadaActivaIndex = -1;
  if (modo === "finalizadas") {
    jornadaActivaIndex = bloquesVista.length - 1;
  } else {
    for (let i = 0; i < bloquesVista.length; i++) {
      const ps = Array.isArray(bloquesVista[i].partidos) ? bloquesVista[i].partidos : [];
      // Jornada activa = primera con al menos un partido en estado "programado"
      if (ps.some((p) => String(p.estado || "").toLowerCase() === "programado")) {
        jornadaActivaIndex = i; break;
      }
    }
    if (jornadaActivaIndex < 0) jornadaActivaIndex = bloquesVista.length - 1;
  }

  // Alias para el resto del render
  const bloques_ = bloquesVista;

  const selectorHtml = bloques_.length > 1
    ? `<div class="portal-jornadas-selector" role="tablist" aria-label="Seleccionar jornada">
        ${bloques_.map((j, i) => {
          const ps = Array.isArray(j.partidos) ? j.partidos : [];
          // Habilitado solo si la jornada tiene al menos un partido explícitamente "programado"
          const tieneProgr = modo === "finalizadas"
            ? true
            : ps.some((p) => String(p.estado || "").toLowerCase() === "programado");
          const esFinalizada = esJornadaFinalizada(ps);
          const tooltip = !tieneProgr
            ? (esFinalizada ? "Jornada finalizada" : "Jornada por programar")
            : "";
          const isActive = i === jornadaActivaIndex;
          return `<button
            class="portal-jornada-selector-btn${isActive ? " active" : ""}${!tieneProgr ? " disabled" : ""}"
            type="button"
            data-jornada-btn="${i}"
            aria-selected="${isActive ? "true" : "false"}"
            ${!tieneProgr ? "disabled" : ""}
            title="${escPortal(tooltip)}"
          >J${escPortal(j.numero)}</button>`;
        }).join("")}
      </div>`
    : "";

  const tarjetasHtml = bloques_
    .map((jornada, i) => {
      const ps = Array.isArray(jornada.partidos) ? jornada.partidos : [];
      const fechas = extraerFechasJornada(ps);
      let subtituloFecha = "";
      if (fechas.length === 1) {
        subtituloFecha = fechas[0].toLocaleDateString("es-EC", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      } else if (fechas.length > 1) {
        const primera = fechas[0].toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
        const ultima = fechas[fechas.length - 1].toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
        subtituloFecha = `${primera} – ${ultima}`;
      }
      const badge = renderBadgeJornadaPortal(ps);
      const byesJornada = byesPorJornada.get(String(jornada.numero)) || [];
      const byeHtml = byesJornada.length
        ? `<div class="portal-jornada-bye"><span class="portal-jornada-bye-icon">🌙</span> <strong>Descansa:</strong> ${byesJornada.map(escPortal).join(", ")}</div>`
        : "";
      return `
        <section class="portal-jornada-card${i === jornadaActivaIndex ? " portal-jornada-activa" : ""}" data-jornada-card="${i}" ${i !== jornadaActivaIndex ? 'hidden' : ''}>
          <div class="portal-jornada-card-head">
            <div class="portal-jornada-card-title">
              <h4>Jornada ${escPortal(jornada.numero)}</h4>
              ${subtituloFecha ? `<span class="portal-jornada-fecha">${escPortal(subtituloFecha)}</span>` : ""}
            </div>
            <div class="portal-jornada-card-meta">
              ${badge}
              <span class="portal-jornada-count">${ps.length} partido${ps.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <div class="portal-jornada-card-body">
            ${ps.map((partido) => renderPartidoJornadaPortal(partido)).join("") || '<p class="empty-msg">Sin partidos en esta jornada.</p>'}
            ${byeHtml}
          </div>
        </section>
      `;
    })
    .join("");

  return `
    <div class="portal-jornadas-wrap">
      ${selectorHtml}
      <div class="portal-jornadas-cards" data-jornadas-cards>
        ${tarjetasHtml}
      </div>
    </div>
  `;
}

function renderResultadosPortal(jornadas = [], partidos = []) {
  return renderJornadasPortal(jornadas, partidos, "finalizadas");
}

function renderEliminatoriasPortal(payload = []) {
  const data = Array.isArray(payload) ? { rondas: payload } : (payload || {});
  const rondasValidas = Array.isArray(data?.rondas)
    ? data.rondas.filter((item) => Array.isArray(item?.partidos) && item.partidos.length)
    : [];
  if (!rondasValidas.length) {
    const mensaje = data?.detalle || data?.mensaje || "No hay llave eliminatoria generada.";
    return `<p class="empty-msg">${escPortal(mensaje)}</p>`;
  }

  const resolverNombreSeedPortal = (partido, lado = "local") => {
    const sideKey = lado === "visitante" ? "visitante" : "local";
    const nombre = partido?.[`equipo_${sideKey}_nombre`] || null;
    if (nombre) return nombre;
    const seedRef = String(partido?.[`seed_${sideKey}_ref`] || "").trim().toUpperCase();
    if (/^MP\d+$/.test(seedRef)) {
      return `Mejor perdedor ${seedRef.replace("MP", "")}`;
    }
    return "Por definir";
  };

  const formatearRondaPortal = (ronda) => {
    const key = String(ronda || "").toLowerCase();
    if (key === "32vos") return "32vos de final";
    if (key === "16vos") return "16vos de final";
    if (key === "12vos") return "12vos de final";
    if (key === "8vos") return "Octavos";
    if (key === "4tos") return "Cuartos";
    if (key === "semifinal") return "Semifinal";
    if (key === "final") return "Final";
    if (key === "tercer_puesto") return "Tercer y cuarto";
    return ronda || "Ronda";
  };

  return `
    <div class="portal-eliminatoria-grid">
      ${rondasValidas
        .map((ronda) => {
          const partidosHtml = ronda.partidos
            .map((partido) => {
              const marcador =
                Number.isFinite(Number(partido.resultado_local)) || Number.isFinite(Number(partido.resultado_visitante))
                  ? `${partido.resultado_local ?? 0} - ${partido.resultado_visitante ?? 0}`
                  : "vs";
              return `
                <div class="partido-publico">
                  <div class="equipo-nombre">${escPortal(resolverNombreSeedPortal(partido, "local"))}</div>
                  <div class="marcador">${escPortal(marcador)}</div>
                  <div class="equipo-nombre">${escPortal(resolverNombreSeedPortal(partido, "visitante"))}</div>
                </div>
              `;
            })
            .join("");

          return `
            <section class="portal-eliminatoria-ronda">
              <div class="portal-eliminatoria-ronda-head">
                <h4>${escPortal(formatearRondaPortal(ronda.ronda))}</h4>
                <span>${Array.isArray(ronda.partidos) ? ronda.partidos.length : 0} partido(s)</span>
              </div>
              <div class="portal-eliminatoria-ronda-body">
                ${partidosHtml}
              </div>
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderGoleadoresPortal(goleadores = []) {
  const rows = Array.isArray(goleadores) ? goleadores.slice(0, 10) : [];
  if (!rows.length) {
    return '<p class="empty-msg">No hay datos de goleadores para esta categoría.</p>';
  }

  const rowsHtml = rows
    .map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escPortal(row.jugador_nombre || "-")}</td>
        <td>${escPortal(row.equipo_nombre || "-")}</td>
        <td><strong>${Number(row.goles || 0)}</strong></td>
      </tr>
    `)
    .join("");

  return `
    <div class="portal-table-wrap">
      <table class="tabla-posicion">
        <tr><th>#</th><th>Jugador</th><th>Equipo</th><th>Goles</th></tr>
        ${rowsHtml}
      </table>
    </div>
  `;
}

function renderTarjetasPortal(tarjetas = [], tipo = "amarillas") {
  const rows = Array.isArray(tarjetas) ? [...tarjetas] : [];
  if (!rows.length) {
    return `<p class="empty-msg">No hay datos de tarjetas ${tipo === "rojas" ? "rojas" : "amarillas"} para esta categoría.</p>`;
  }

  const labelColumna = tipo === "rojas" ? "TR" : "TA";
  rows.sort((a, b) => {
    const valorA = Number(a?.[tipo] || 0);
    const valorB = Number(b?.[tipo] || 0);
    if (valorB !== valorA) return valorB - valorA;
    const secundarioA = Number(a?.[tipo === "rojas" ? "amarillas" : "rojas"] || 0);
    const secundarioB = Number(b?.[tipo === "rojas" ? "amarillas" : "rojas"] || 0);
    if (secundarioB !== secundarioA) return secundarioB - secundarioA;
    return String(a?.equipo_nombre || "").localeCompare(String(b?.equipo_nombre || ""));
  });

  const rowsHtml = rows
    .map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escPortal(row.equipo_nombre || "-")}</td>
        <td>${Number(row[tipo] || 0)}</td>
      </tr>
    `)
    .join("");

  return `
    <div class="portal-table-wrap">
      <table class="tabla-posicion">
        <tr><th>#</th><th>Equipo</th><th>${labelColumna}</th></tr>
        ${rowsHtml}
      </table>
    </div>
  `;
}

function renderFairPlayPortal(fairPlay = []) {
  const rows = Array.isArray(fairPlay) ? fairPlay.slice(0, 10) : [];
  if (!rows.length) {
    return '<p class="empty-msg">No hay datos de fair play para esta categoría.</p>';
  }

  const rowsHtml = rows
    .map((row) => `
      <tr>
        <td>${Number(row.posicion || 0)}</td>
        <td>${escPortal(row.equipo_nombre || "-")}</td>
        <td>${Number(row.amarillas || 0)}</td>
        <td>${Number(row.rojas || 0)}</td>
        <td>${Number(row.faltas || 0)}</td>
        <td><strong>${Number(row.puntaje_fair_play || 0)}</strong></td>
      </tr>
    `)
    .join("");

  return `
    <div class="portal-table-wrap">
      <table class="tabla-posicion">
        <tr><th>#</th><th>Equipo</th><th>TA</th><th>TR</th><th>Faltas</th><th>Puntaje</th></tr>
        ${rowsHtml}
      </table>
    </div>
  `;
}

function renderResumenCategoriaPortal(evento, data) {
  const resumen = [
    evento?.modalidad ? `Modalidad: ${formatearModalidadPortal(evento.modalidad)}` : "",
    evento?.metodo_competencia
      ? `Formato: ${formatearFormatoCompetenciaPortal(obtenerMetodoCompetenciaVisiblePortal(evento))}`
      : "",
    `Equipos: ${Number(evento?.total_equipos || 0)}`,
    Number(evento?.total_grupos || 0) > 0 ? `Grupos: ${Number(evento.total_grupos || 0)}` : "",
    `Partidos: ${Number(evento?.partidos_finalizados || 0)}/${Number(evento?.total_partidos || 0)}`,
    Number(data?.goleadores?.length || 0) > 0 ? `Goleadores activos: ${Number(data.goleadores.length)}` : "",
  ].filter(Boolean);

  return `
    <div class="portal-category-summary">
      <div>
        <h3>${limpiarCodigoTorneo(evento?.nombre) || "Categoría"}</h3>
        <p>${escPortal(resumen.join(" • "))}</p>
      </div>
    </div>
  `;
}

function renderCategoriaPanelPortal(data, index = 0) {
  const evento = data?.evento || {};
  const panelId = `portal-category-panel-${evento.id}`;
  const subtabs = [
    { key: "jornadas", label: "Jornadas", html: renderJornadasPortal(data?.jornadas || [], data?.partidos || [], "proximas") },
    { key: "resultados", label: "Resultados", html: renderResultadosPortal(data?.jornadas || [], data?.partidos || []) },
    { key: "posiciones", label: "Tabla de posiciones", html: renderTablasPortal(data?.tablas || []) },
    { key: "goleadores", label: "Goleadores", html: renderGoleadoresPortal(data?.goleadores || []) },
    { key: "fair-play", label: "Fair play", html: renderFairPlayPortal(data?.fairPlay || []) },
    { key: "tarjetas-amarillas", label: "Tarjetas amarillas", html: renderTarjetasPortal(data?.tarjetas || [], "amarillas") },
    { key: "tarjetas-rojas", label: "Tarjetas rojas", html: renderTarjetasPortal(data?.tarjetas || [], "rojas") },
    { key: "playoff", label: "Playoff", html: renderEliminatoriasPortal(data?.eliminatorias || []) },
  ];

  return `
    <section id="${panelId}" class="portal-category-panel ${index === 0 ? "active" : ""}" ${index === 0 ? "" : "hidden"}>
      ${renderResumenCategoriaPortal(evento, data)}
      <div class="portal-subtabs" role="tablist" aria-label="Secciones de ${escPortal(evento?.nombre || "categoría")}">
        ${subtabs
          .map(
            (subtab, subIndex) => `
              <button
                class="portal-subtab ${subIndex === 0 ? "active" : ""}"
                type="button"
                data-portal-tab="subcategoria"
                data-target="${panelId}-${subtab.key}"
                aria-selected="${subIndex === 0 ? "true" : "false"}"
              >
                ${subtab.label}
              </button>
            `
          )
          .join("")}
      </div>
      ${subtabs
        .map(
          (subtab, subIndex) => `
            <div id="${panelId}-${subtab.key}" class="portal-subtab-panel ${subIndex === 0 ? "active" : ""}" ${subIndex === 0 ? "" : "hidden"}>
              ${subtab.html}
            </div>
          `
        )
        .join("")}
    </section>
  `;
}

function renderDetalleCampeonatoPortal(campeonato, eventosData = []) {
  const nombre = limpiarCodigoTorneo(campeonato?.nombre) || "Torneo";
  const base = `
    <div class="portal-card portal-detail-header">
      <div class="portal-detail-heading">
        ${campeonato?.logo_url ? `<img class="portal-detail-logo" src="${normalizarLogoUrl(campeonato.logo_url)}" alt="${escPortal(nombre)}" />` : ""}
        <div>
          <h2>${nombre}</h2>
          <p>${escPortal(campeonato?.organizador || "")}</p>
          <span>${formatearFechaPortal(campeonato?.fecha_inicio)} - ${formatearFechaPortal(campeonato?.fecha_fin)}</span>
        </div>
      </div>
    </div>
  `;

  if (!Array.isArray(eventosData) || !eventosData.length) {
    return `${base}<p class="empty-msg">Este campeonato no tiene categorías públicas disponibles.</p>`;
  }

  return `
    ${base}
    <div class="portal-detail-shell">
      <div class="portal-category-tabs" role="tablist" aria-label="Categorías del campeonato">
        ${eventosData
          .map(
            (item, index) => `
              <button
                class="portal-category-tab ${index === 0 ? "active" : ""}"
                type="button"
                data-portal-tab="categoria"
                data-target="portal-category-panel-${item.evento.id}"
                aria-selected="${index === 0 ? "true" : "false"}"
              >
                ${escPortal(limpiarCodigoTorneo(item?.evento?.nombre) || "Categoría")}
              </button>
            `
          )
          .join("")}
      </div>
      ${eventosData.map((item, index) => renderCategoriaPanelPortal(item, index)).join("")}
      <section id="portal-detail-galeria-${campeonato?.id}" class="ltc-gallery-section portal-detail-gallery" hidden>
        <div class="ltc-section-title">
          <h2>GALERÍA DEL TORNEO</h2>
          <p id="portal-detail-galeria-description-${campeonato?.id}">Imágenes públicas del campeonato.</p>
        </div>
        <div id="portal-detail-galeria-grid-${campeonato?.id}" class="ltc-gallery-grid"></div>
      </section>
      <section id="portal-detail-auspiciantes-${campeonato?.id}" class="portal-detail-sponsors" hidden>
        <div class="portal-detail-sponsors-head">
          <h3>Auspiciantes</h3>
          <p id="portal-detail-auspiciantes-description-${campeonato?.id}">Marcas que respaldan ${escPortal(nombre)}.</p>
        </div>
        <div class="ltc-sponsors-strip portal-detail-sponsors-strip" aria-label="Auspiciantes del campeonato">
          <div id="portal-detail-auspiciantes-track-${campeonato?.id}" class="ltc-sponsors-track portal-detail-sponsors-track"></div>
        </div>
      </section>
    </div>
  `;
}

async function cargarMediaCampeonatoPublica(campeonatoId, campeonatoNombre = "") {
  const section = document.getElementById(`portal-detail-galeria-${campeonatoId}`);
  const grid = document.getElementById(`portal-detail-galeria-grid-${campeonatoId}`);
  const description = document.getElementById(`portal-detail-galeria-description-${campeonatoId}`);
  if (!section || !grid) return;

  section.hidden = true;
  grid.innerHTML = "";
  if (description) {
    description.textContent = campeonatoNombre
      ? `Imágenes públicas de ${campeonatoNombre}.`
      : "Imágenes públicas del campeonato.";
  }

  try {
    const data = window.PortalPublicAPI
      ? await window.PortalPublicAPI.listarMediaPorCampeonato(campeonatoId)
      : await (async () => {
          const resp = await fetch(`${API}/public/campeonatos/${campeonatoId}/media`);
          const payload = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(payload?.error || "No se pudo cargar la galería del campeonato");
          return payload;
        })();
    const media = Array.isArray(data?.media) ? data.media : [];
    if (!media.length) return;
    grid.innerHTML = renderGaleriaPortalItems(media, "No hay imágenes públicas del campeonato.");
    section.hidden = false;
  } catch (error) {
    console.error(error);
  }
}

function renderTrackAuspiciantesPortal(auspiciantes = [], options = {}) {
  const unicos = [];
  const vistos = new Set();
  (Array.isArray(auspiciantes) ? auspiciantes : []).forEach((item) => {
    const nombre = String(item?.nombre || "")
      .trim()
      .toLowerCase();
    const logo = String(item?.logo_url || "")
      .trim()
      .toLowerCase();
    const clave = `${nombre}|${logo}`;
    if ((!nombre && !logo) || vistos.has(clave)) return;
    vistos.add(clave);
    unicos.push(item);
  });
  const items = unicos.filter((item) => item?.logo_url || item?.nombre);
  if (!items.length) return "";
  const repetir = options?.repeat === true;
  const repetidos = repetir && items.length > 1 ? [...items, ...items] : items;
  return repetidos
    .map(
      (item, index) => `
        ${
          item?.logo_url
            ? `<img
                src="${escPortal(normalizarLogoUrl(item.logo_url))}"
                alt="${index < items.length ? escPortal(item.nombre || "Auspiciante") : ""}"
                ${index >= items.length ? 'aria-hidden="true"' : ""}
              />`
            : `<span class="ltc-sponsor-text-chip" ${index >= items.length ? 'aria-hidden="true"' : ""}>${escPortal(
                item?.nombre || "Auspiciante"
              )}</span>`
        }
      `
    )
    .join("");
}

function renderGaleriaPortalItems(items = [], emptyMessage = "No hay imágenes públicas disponibles.") {
  const rows = Array.isArray(items) ? items.filter((item) => item?.imagen_url) : [];
  if (!rows.length) {
    return `<p class="empty-msg">${escPortal(emptyMessage)}</p>`;
  }
  return rows
    .map(
      (item) => `
        <article class="ltc-gallery-card">
          <img src="${escPortal(normalizarMediaPortal(item.imagen_url))}" alt="${escPortal(item.titulo || "Galería pública")}" />
          <div class="ltc-gallery-card-copy">
            <h3>${escPortal(item.titulo || "Imagen destacada")}</h3>
            <p>${escPortal(item.descripcion || "Contenido público del organizador o campeonato.")}</p>
          </div>
        </article>
      `
    )
    .join("");
}

async function cargarAuspiciantesCampeonatoPublico(campeonatoId, campeonatoNombre = "") {
  const section = document.getElementById("portal-auspiciantes-section");
  const track = document.getElementById("portal-auspiciantes-track");
  const description = document.getElementById("portal-auspiciantes-description");
  const detailSection = document.getElementById(`portal-detail-auspiciantes-${campeonatoId}`);
  const detailTrack = document.getElementById(`portal-detail-auspiciantes-track-${campeonatoId}`);
  const detailDescription = document.getElementById(`portal-detail-auspiciantes-description-${campeonatoId}`);
  if (!section && !detailSection) return;

  if (section) section.hidden = true;
  if (track) track.innerHTML = "";
  if (detailSection) detailSection.hidden = true;
  if (detailTrack) detailTrack.innerHTML = "";
  if (description) {
    description.textContent = campeonatoNombre
      ? `Marcas que respaldan ${campeonatoNombre}.`
      : "Marcas que respaldan esta competencia.";
  }
  if (detailDescription) {
    detailDescription.textContent = campeonatoNombre
      ? `Marcas que respaldan ${campeonatoNombre}.`
      : "Marcas que respaldan esta competencia.";
  }

  try {
    const data = window.PortalPublicAPI
      ? await window.PortalPublicAPI.listarAuspiciantesPorCampeonato(campeonatoId)
      : await (async () => {
          const resp = await fetch(`${API}/public/campeonatos/${campeonatoId}/auspiciantes`);
          const payload = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(payload?.error || "No se pudieron cargar auspiciantes");
          return payload;
        })();
    const auspiciantes = Array.isArray(data?.auspiciantes) ? data.auspiciantes : [];
    if (!auspiciantes.length) return;
    const html = renderTrackAuspiciantesPortal(auspiciantes, { repeat: true });
    if (!html) return;
    if (detailTrack) detailTrack.innerHTML = html;
    if (detailSection) detailSection.hidden = false;
    if (!detailSection) {
      if (track) track.innerHTML = html;
      if (section) section.hidden = false;
    }
  } catch (error) {
    console.error(error);
  }
}

function prepararVistaDetallePortal(campeonato = null, options = {}) {
  const backBtn = document.getElementById("portal-back-btn");
  const esVistaCompartible = options?.detalleCompartible === true;

  if (backBtn) {
    if (esVistaCompartible || ES_PORTAL_PAGE) {
      backBtn.style.display = "";
      backBtn.dataset.href = obtenerUrlInicioPortalCompartible();
      backBtn.innerHTML = portalContextoActual?.organizadorId
        ? '<i class="fas fa-arrow-left"></i> Volver al portal del organizador'
        : '<i class="fas fa-arrow-left"></i> Volver al inicio';
    } else {
      backBtn.style.display = "";
      delete backBtn.dataset.href;
      backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Volver al listado';
    }
  }

  if (esVistaCompartible && campeonato?.nombre) {
    document.title = `${limpiarCodigoTorneo(campeonato.nombre)} | LT&C`;
  }
}

function activarPortalTab(scope, buttonSelector, panelSelector, targetId) {
  if (!scope || !targetId) return;
  scope.querySelectorAll(buttonSelector).forEach((button) => {
    const activo = button.dataset.target === targetId;
    button.classList.toggle("active", activo);
    button.setAttribute("aria-selected", activo ? "true" : "false");
  });
  scope.querySelectorAll(panelSelector).forEach((panel) => {
    const activo = panel.id === targetId;
    panel.classList.toggle("active", activo);
    panel.hidden = !activo;
  });
}

async function portalVerCampeonato(campeonatoId, options = {}) {
  const inicio = document.getElementById("portal-inicio");
  const detalle = document.getElementById("portal-detalle");
  const cont = document.getElementById("portal-detalle-contenido");
  if (!inicio || !detalle || !cont) return;

  inicio.classList.remove("active");
  detalle.classList.add("active");
  cont.innerHTML = "<p>Cargando...</p>";

  try {
    const [campRes, eventosRes] = await Promise.all([
      window.PortalPublicAPI
        ? window.PortalPublicAPI.obtenerCampeonato(campeonatoId)
        : fetch(`${API}/public/campeonatos/${campeonatoId}`).then((r) => r.json()),
      window.PortalPublicAPI
        ? window.PortalPublicAPI.listarEventosPorCampeonato(campeonatoId)
        : fetch(`${API}/public/campeonatos/${campeonatoId}/eventos`).then((r) => r.json()),
    ]);
    const camp = campRes.campeonato || campRes;
    const eventos = eventosRes.eventos || eventosRes || [];
    const eventoObjetivo = Number.parseInt(options?.eventoId || "", 10);
    const eventosFiltrados =
      Number.isFinite(eventoObjetivo) && eventoObjetivo > 0
        ? eventos.filter((ev) => Number(ev.id) === eventoObjetivo)
        : eventos;

    const eventosData = await Promise.all(
      eventosFiltrados.map(async (ev) => {
        const [tablasRes, goleadoresRes, tarjetasRes, fairPlayRes, eliminatoriasRes, partidosRes] = await Promise.all([
          (
            window.PortalPublicAPI
              ? window.PortalPublicAPI.obtenerTablasPorEvento(ev.id)
              : fetch(`${API}/public/eventos/${ev.id}/tablas`).then((r) => r.json())
          ).catch(() => ({ grupos: [] })),
          (
            window.PortalPublicAPI
              ? window.PortalPublicAPI.obtenerGoleadoresPorEvento(ev.id)
              : fetch(`${API}/public/eventos/${ev.id}/goleadores`).then((r) => r.json())
          ).catch(() => ({ goleadores: [] })),
          (
            window.PortalPublicAPI
              ? window.PortalPublicAPI.obtenerTarjetasPorEvento(ev.id)
              : fetch(`${API}/public/eventos/${ev.id}/tarjetas`).then((r) => r.json())
          ).catch(() => ({ tarjetas: [] })),
          (
            window.PortalPublicAPI
              ? window.PortalPublicAPI.obtenerFairPlayPorEvento(ev.id)
              : fetch(`${API}/public/eventos/${ev.id}/fair-play`).then((r) => r.json())
          ).catch(() => ({ fair_play: [] })),
          (
            window.PortalPublicAPI
              ? window.PortalPublicAPI.obtenerEliminatoriasPorEvento(ev.id)
              : fetch(`${API}/public/eventos/${ev.id}/eliminatorias`).then((r) => r.json())
          ).catch(() => ({ rondas: [] })),
          fetch(`${API}/public/eventos/${ev.id}/partidos`).then((r) => r.json()).catch(() => ({ jornadas: [], partidos: [] })),
        ]);

        return {
          evento: ev,
          tablas: tablasRes.grupos || [],
          goleadores: goleadoresRes.goleadores || [],
          tarjetas: tarjetasRes.tarjetas || [],
          fairPlay: fairPlayRes.fair_play || [],
          eliminatorias: eliminatoriasRes || { rondas: [] },
          jornadas: partidosRes.jornadas || [],
          partidos: partidosRes.partidos || [],
        };
      })
    );

    cont.innerHTML = renderDetalleCampeonatoPortal(camp, eventosData);
    prepararVistaDetallePortal(camp, options);
    if (options?.cargarAuspiciantes !== false) {
      await cargarAuspiciantesCampeonatoPublico(campeonatoId, limpiarCodigoTorneo(camp?.nombre || ""));
    }
    await cargarMediaCampeonatoPublica(campeonatoId, limpiarCodigoTorneo(camp?.nombre || ""));
  } catch (err) {
    console.error(err);
    cont.innerHTML = '<p class="empty-msg">Error cargando datos.</p>';
  }
}
function portalVolver() {
  const backBtn = document.getElementById("portal-back-btn");
  const hrefRetorno = String(backBtn?.dataset?.href || "").trim();
  if (hrefRetorno) {
    window.location.href = hrefRetorno;
    return;
  }
  const detalle = document.getElementById("portal-detalle");
  const inicio = document.getElementById("portal-inicio");
  const section = document.getElementById("portal-auspiciantes-section");
  if (detalle) detalle.classList.remove("active");
  if (inicio) inicio.classList.add("active");
  if (section) section.hidden = true;
  if (backBtn) backBtn.style.display = "";
  document.title = "Portal Público - LT&C";
}

window.abrirTorneoEnNuevaPestana = abrirTorneoEnNuevaPestana;
window.abrirDetallePortalCampeonato = abrirDetallePortalCampeonato;
window.portalVerCampeonato = portalVerCampeonato;
window.portalVolver = portalVolver;

document.addEventListener("click", (event) => {
  const categoryButton = event.target.closest("[data-portal-tab='categoria']");
  if (categoryButton) {
    const scope = categoryButton.closest(".portal-detail-shell");
    activarPortalTab(scope, ".portal-category-tab", ".portal-category-panel", categoryButton.dataset.target);
    return;
  }

  const subtabButton = event.target.closest("[data-portal-tab='subcategoria']");
  if (subtabButton) {
    const scope = subtabButton.closest(".portal-category-panel");
    activarPortalTab(scope, ".portal-subtab", ".portal-subtab-panel", subtabButton.dataset.target);
    return;
  }

  // Selector de jornada dentro del tab Jornadas
  const jornadaBtn = event.target.closest("[data-jornada-btn]");
  if (jornadaBtn) {
    const wrap = jornadaBtn.closest(".portal-jornadas-wrap");
    if (!wrap) return;
    const targetIdx = Number(jornadaBtn.dataset.jornadaBtn);
    wrap.querySelectorAll("[data-jornada-btn]").forEach((btn) => {
      const activo = Number(btn.dataset.jornadaBtn) === targetIdx;
      btn.classList.toggle("active", activo);
      btn.setAttribute("aria-selected", activo ? "true" : "false");
    });
    wrap.querySelectorAll("[data-jornada-card]").forEach((card) => {
      const activo = Number(card.dataset.jornadaCard) === targetIdx;
      card.hidden = !activo;
      card.classList.toggle("portal-jornada-activa", activo);
    });
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const contexto = leerContextoPortalDesdeUrl();
  portalContextoActual = contexto;
  guardarContextoPortalCompartible(contexto);

  if (ES_PORTAL_PAGE) {
    const cargarListado = async () => {
      if (contexto.organizadorId) {
        const landing = await cargarLandingOrganizador(contexto.organizadorId);
        return landing;
      }
      await portalCargarCampeonatos(null, { mostrarProximos: false });
      return null;
    };

    try {
      const landing = contexto.organizadorId ? await cargarListado() : null;
      if (!contexto.organizadorId && !contexto.campeonatoId) {
        await portalCargarCampeonatos(null, { mostrarProximos: false });
      }
      if (contexto.campeonatoId) {
        if (landing && Array.isArray(landing?.campeonatos) && landing.campeonatos.length) {
          const permitido = landing.campeonatos.some((item) => Number(item.id) === Number(contexto.campeonatoId));
          if (!permitido) {
            renderErrorPortal("El campeonato solicitado no esta disponible en esta landing.");
            return;
          }
        }
        await portalVerCampeonato(contexto.campeonatoId, {
          eventoId: contexto.eventoId,
          detalleCompartible: true,
          cargarAuspiciantes: true,
        });
      }
    } catch (error) {
      console.error(error);
      renderErrorPortal(error.message || "No se pudo cargar el portal publico.");
    }
    return;
  }

  await cargarContenidoPortalPublico();
  await cargarGaleriaPublica();
  initFormularioContactoPublico();

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

  await cargarNoticiasPublicasPortal();
  await portalCargarCampeonatos();
  if (contexto.campeonatoId) {
    portalVerCampeonato(contexto.campeonatoId, { eventoId: contexto.eventoId });
  }
});
