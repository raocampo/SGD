const API = window.resolveApiBaseUrl
  ? window.resolveApiBaseUrl()
  : window.API_BASE_URL || `${window.location.origin}/api`;
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
      const data = window.PortalPublicAPI
        ? await window.PortalPublicAPI.listarCampeonatos()
        : await fetch(`${API}/public/campeonatos`).then((r) => r.json());
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

  return tablas
    .map((grupoData) => {
      const grupo = grupoData?.grupo || {};
      const filas = Array.isArray(grupoData?.tabla) ? grupoData.tabla : [];
      if (!filas.length) return "";
      const titulo = grupo.nombre_grupo || grupo.letra_grupo || "Tabla";
      const rowsHtml = filas
        .map((row, index) => {
          const est = row.estadisticas || {};
          return `<tr>
            <td>${row.posicion || index + 1}</td>
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
        })
        .join("");

      return `
        <div class="portal-stat-block">
          <p><strong>${titulo}</strong></p>
          <div class="portal-table-wrap">
            <table class="tabla-posicion">
              <tr><th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th></tr>
              ${rowsHtml}
            </table>
          </div>
        </div>
      `;
    })
    .join("");
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
        <div class="equipo-nombre">${escPortal(partido.equipo_local_nombre || "-")}</div>
        <div class="marcador">${escPortal(marcador)}</div>
        <div class="equipo-nombre">${escPortal(partido.equipo_visitante_nombre || "-")}</div>
      </div>
    </article>
  `;
}

function renderJornadasPortal(jornadas = [], partidos = []) {
  const bloques = normalizarJornadasPortal(jornadas, partidos);
  if (!bloques.length) {
    return '<p class="empty-msg">No hay jornadas publicadas para esta categoría.</p>';
  }

  return `
    <div class="portal-jornadas-grid">
      ${bloques
        .map((jornada) => `
          <section class="portal-jornada-card">
            <div class="portal-jornada-card-head">
              <h4>Jornada ${escPortal(jornada.numero)}</h4>
              <span>${Array.isArray(jornada.partidos) ? jornada.partidos.length : 0} partido(s)</span>
            </div>
            <div class="portal-jornada-card-body">
              ${(Array.isArray(jornada.partidos) ? jornada.partidos : [])
                .map((partido) => renderPartidoJornadaPortal(partido))
                .join("")}
            </div>
          </section>
        `)
        .join("")}
    </div>
  `;
}

function renderEliminatoriasPortal(rondas = []) {
  const rondasValidas = Array.isArray(rondas) ? rondas.filter((item) => Array.isArray(item?.partidos) && item.partidos.length) : [];
  if (!rondasValidas.length) {
    return '<p class="empty-msg">No hay llave eliminatoria generada.</p>';
  }

  return rondasValidas
    .map((ronda) => {
      const partidosHtml = ronda.partidos
        .map((partido) => {
          const marcador =
            Number.isFinite(Number(partido.resultado_local)) || Number.isFinite(Number(partido.resultado_visitante))
              ? `${partido.resultado_local ?? 0} - ${partido.resultado_visitante ?? 0}`
              : "vs";
          return `
            <div class="partido-publico">
              <div class="equipo-nombre">${partido.equipo_local_nombre || "Por definir"}</div>
              <div class="marcador">${marcador}</div>
              <div class="equipo-nombre">${partido.equipo_visitante_nombre || "Por definir"}</div>
            </div>
          `;
        })
        .join("");

      return `<h4>Llave ${escPortal(ronda.ronda || "Ronda")}</h4>${partidosHtml}`;
    })
    .join("");
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

function renderTarjetasPortal(tarjetas = []) {
  const rows = Array.isArray(tarjetas) ? tarjetas.slice(0, 10) : [];
  if (!rows.length) {
    return '<p class="empty-msg">No hay datos de tarjetas para esta categoría.</p>';
  }

  const rowsHtml = rows
    .map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escPortal(row.equipo_nombre || "-")}</td>
        <td>${Number(row.amarillas || 0)}</td>
        <td>${Number(row.rojas || 0)}</td>
      </tr>
    `)
    .join("");

  return `
    <div class="portal-table-wrap">
      <table class="tabla-posicion">
        <tr><th>#</th><th>Equipo</th><th>TA</th><th>TR</th></tr>
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
    evento?.modalidad ? `Modalidad: ${evento.modalidad}` : "",
    evento?.metodo_competencia ? `Formato: ${String(evento.metodo_competencia).replace(/_/g, " ")}` : "",
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
    { key: "posiciones", label: "Tabla de posiciones", html: renderTablasPortal(data?.tablas || []) },
    { key: "jornadas", label: "Jornadas", html: renderJornadasPortal(data?.jornadas || [], data?.partidos || []) },
    { key: "goleadores", label: "Goleadores", html: renderGoleadoresPortal(data?.goleadores || []) },
    { key: "tarjetas", label: "Tarjetas", html: renderTarjetasPortal(data?.tarjetas || []) },
    { key: "fair-play", label: "Fair play", html: renderFairPlayPortal(data?.fairPlay || []) },
  ];

  if (Array.isArray(data?.rondas) && data.rondas.length) {
    subtabs.push({ key: "playoff", label: "Playoff", html: renderEliminatoriasPortal(data.rondas) });
  }

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
    </div>
  `;
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
  document.getElementById("portal-inicio").classList.remove("active");
  document.getElementById("portal-detalle").classList.add("active");
  const cont = document.getElementById("portal-detalle-contenido");
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
        const [partidosRes, tablasRes, eliminatoriasRes, goleadoresRes, tarjetasRes, fairPlayRes] = await Promise.all([
          (
            window.PortalPublicAPI
              ? window.PortalPublicAPI.obtenerPartidosPorEvento(ev.id)
              : fetch(`${API}/public/eventos/${ev.id}/partidos`).then((r) => r.json())
          ).catch(() => ({ partidos: [], jornadas: [] })),
          (
            window.PortalPublicAPI
              ? window.PortalPublicAPI.obtenerTablasPorEvento(ev.id)
              : fetch(`${API}/public/eventos/${ev.id}/tablas`).then((r) => r.json())
          ).catch(() => ({ grupos: [] })),
          (
            window.PortalPublicAPI
              ? window.PortalPublicAPI.obtenerEliminatoriasPorEvento(ev.id)
              : fetch(`${API}/public/eventos/${ev.id}/eliminatorias`).then((r) => r.json())
          ).catch(() => ({ rondas: [] })),
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
        ]);

        return {
          evento: ev,
          partidos: partidosRes.partidos || [],
          jornadas: partidosRes.jornadas || [],
          tablas: tablasRes.grupos || [],
          rondas: eliminatoriasRes.rondas || [],
          goleadores: goleadoresRes.goleadores || [],
          tarjetas: tarjetasRes.tarjetas || [],
          fairPlay: fairPlayRes.fair_play || [],
        };
      })
    );

    cont.innerHTML = renderDetalleCampeonatoPortal(camp, eventosData);
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
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const contexto = leerContextoPortalDesdeUrl();
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


