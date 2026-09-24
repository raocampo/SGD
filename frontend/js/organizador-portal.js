(function () {
  const state = {
    organizador: null,
    config: null,
    campeonatos: [],
    auspiciantes: [],
    media: [],
    jornadasEvento: {
      eventoId: null,
      jornadasDisponibles: [],
      jornadasHabilitadas: null, // null = todas; array = específicas
    },
  };

  function backendBase() {
    return window.resolveBackendBaseUrl ? window.resolveBackendBaseUrl() : window.location.origin;
  }

  function currentPageIsValid() {
    return window.location.pathname.endsWith("organizador-portal.html");
  }

  function normalizarMedia(url) {
    const value = String(url || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/")) return `${backendBase()}${value}`;
    if (value.startsWith("uploads/")) return `${backendBase()}/${value}`;
    return `${backendBase()}/${value}`;
  }

  function landingUrl() {
    const slug = String(state.config?.landing_slug || "").trim();
    if (slug) return `/liga/${slug}`;
    const userId = Number.parseInt(state.organizador?.id, 10);
    if (!Number.isFinite(userId) || userId <= 0) return "index.html";
    return `index.html?organizador=${userId}`;
  }

  function llenarInput(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? "";
  }

  // ── Tema visual + previsualización en vivo ─────────────────────────────────
  // Debe reflejar TEMAS_LANDING_ORGANIZADOR de portal.js.
  const TEMAS_PREVIEW = {
    deportivo: { from: "#313131", to: "#252525", accent: "#b7e853", heading: "#b7e853" },
    nocturno: { from: "#1f1f1f", to: "#080808", accent: "#b7e853", heading: "#b7e853" },
    verde: { from: "#45651f", to: "#233414", accent: "#b7e853", heading: "#ffffff" },
    vinotinto: { from: "#5b1a2b", to: "#7a1f2f", accent: "#e5c76b", heading: "#f2d98c" },
    clasico: { from: "#1c1c1a", to: "#2f2f2b", accent: "#b7e853", heading: "#ffffff" },
  };

  function textoLegibleSobre(hex) {
    const c = String(hex || "").replace("#", "");
    if (c.length !== 6) return "#141414";
    const lin = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const L =
      0.2126 * lin(parseInt(c.slice(0, 2), 16)) +
      0.7152 * lin(parseInt(c.slice(2, 4), 16)) +
      0.0722 * lin(parseInt(c.slice(4, 6), 16));
    return L > 0.45 ? "#141414" : "#ffffff";
  }

  function paletaTemaActual() {
    const tema = document.getElementById("op-color-tema")?.value || "deportivo";
    if (tema === "personalizado") {
      const from = document.getElementById("op-color-primario")?.value || "#313131";
      const to = document.getElementById("op-color-secundario")?.value || "#1f1f1f";
      const accent = document.getElementById("op-color-acento")?.value || "#b7e853";
      return { from, to, accent, heading: accent };
    }
    return TEMAS_PREVIEW[tema] || TEMAS_PREVIEW.deportivo;
  }

  function refrescarPreviewTema() {
    const box = document.getElementById("op-tema-preview-live");
    if (!box) return;
    const p = paletaTemaActual();
    box.style.setProperty("--tpl-hero-from", p.from);
    box.style.setProperty("--tpl-hero-to", p.to);
    box.style.setProperty("--tpl-accent", p.accent);
    box.style.setProperty("--tpl-accent-fg", textoLegibleSobre(p.accent));
    box.style.setProperty("--tpl-heading", p.heading);
  }

  function toggleBloqueColoresPersonalizado() {
    const tema = document.getElementById("op-color-tema")?.value || "deportivo";
    const bloque = document.getElementById("op-colores-personalizado");
    if (bloque) bloque.style.display = tema === "personalizado" ? "block" : "none";
  }

  function initTemaSelector() {
    document.querySelectorAll(".op-tema-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".op-tema-btn").forEach((b) => b.classList.remove("activo"));
        btn.classList.add("activo");
        const temaInput = document.getElementById("op-color-tema");
        if (temaInput) temaInput.value = btn.dataset.tema || "deportivo";
        toggleBloqueColoresPersonalizado();
        refrescarPreviewTema();
      });
    });
    ["op-color-primario", "op-color-secundario", "op-color-acento"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", () => {
        const temaInput = document.getElementById("op-color-tema");
        if (temaInput && temaInput.value !== "personalizado") {
          temaInput.value = "personalizado";
          document.querySelectorAll(".op-tema-btn").forEach((b) =>
            b.classList.toggle("activo", b.dataset.tema === "personalizado")
          );
          toggleBloqueColoresPersonalizado();
        }
        refrescarPreviewTema();
      });
    });
  }

  function renderResumen() {
    const resumen = document.getElementById("op-resumen");
    const open = document.getElementById("op-open-landing");
    if (!resumen || !open) return;

    const nombre =
      state.config?.organizacion_nombre ||
      state.organizador?.organizacion_nombre ||
      state.organizador?.nombre ||
      "Organizador";
    resumen.textContent = `${nombre}: ${state.campeonatos.length} campeonato(s), ${state.auspiciantes.length} auspiciante(s) y ${state.media.length} recurso(s) públicos.`;
    open.href = landingUrl();
  }

  function mostrarImagenPrevia(previewId, wrapId, url) {
    if (!url) return;
    const img = document.getElementById(previewId);
    const wrap = document.getElementById(wrapId);
    if (img && wrap) {
      img.src = normalizarMedia(url);
      wrap.style.display = "flex";
    }
  }

  function poblarConfig() {
    const config = state.config || {};
    llenarInput("op-landing-slug", config.landing_slug || "");
    actualizarPreviewSlug();
    llenarInput("op-organizacion-nombre", config.organizacion_nombre || state.organizador?.organizacion_nombre || "");
    llenarInput("op-lema", config.lema || "");
    llenarInput("op-hero-title", config.hero_title || "");
    llenarInput("op-hero-chip", config.hero_chip || "");
    llenarInput("op-hero-description", config.hero_description || "");
    llenarInput("op-team-welcome-title", config.equipos_bienvenida_titulo || "");
    llenarInput("op-team-welcome-description", config.equipos_bienvenida_descripcion || "");
    llenarInput("op-about-title", config.about_title || "");
    llenarInput("op-about-text-1", config.about_text_1 || "");
    llenarInput("op-about-text-2", config.about_text_2 || "");
    llenarInput("op-contact-title", config.contact_title || "");
    llenarInput("op-contact-description", config.contact_description || "");
    llenarInput("op-contact-email", config.contact_email || state.organizador?.email || "");
    llenarInput("op-contact-phone", config.contact_phone || "");
    llenarInput("op-facebook-url", config.facebook_url || "");
    llenarInput("op-instagram-url", config.instagram_url || "");
    llenarInput("op-whatsapp-url", config.whatsapp_url || "");

    // Tema
    const tema = config.color_tema || "deportivo";
    llenarInput("op-color-tema", tema);
    document.querySelectorAll(".op-tema-btn").forEach(btn => {
      btn.classList.toggle("activo", btn.dataset.tema === tema);
    });
    llenarInput("op-color-primario", config.color_primario || "#313131");
    llenarInput("op-color-secundario", config.color_secundario || "#1f1f1f");
    llenarInput("op-color-acento", config.color_acento || "#b7e853");
    toggleBloqueColoresPersonalizado();
    refrescarPreviewTema();

    // Previsualizaciones de imágenes ya guardadas
    mostrarImagenPrevia("op-logo-preview", "op-logo-preview-wrap", config.logo_url);
    mostrarImagenPrevia("op-hero-preview", "op-hero-preview-wrap", config.hero_image_url);
    mostrarImagenPrevia(
      "op-team-preview",
      "op-team-preview-wrap",
      config.equipos_bienvenida_imagen_url
    );
  }

  function actualizarPreviewSlug() {
    const input = document.getElementById("op-landing-slug");
    const preview = document.getElementById("op-landing-slug-preview");
    if (!preview) return;
    const slug = String(input?.value || state.config?.landing_slug || "").trim();
    preview.textContent = slug
      ? `${window.location.origin}/liga/${slug}`
      : "Se generará automáticamente al guardar.";
  }

  function resetAuspicianteForm() {
    llenarInput("op-auspiciante-id", "");
    llenarInput("op-auspiciante-nombre", "");
    llenarInput("op-auspiciante-enlace", "");
    llenarInput("op-auspiciante-orden", 1);
    llenarInput("op-auspiciante-logo", "");
    const activo = document.getElementById("op-auspiciante-activo");
    if (activo) activo.value = "true";
    const cancelar = document.getElementById("op-auspiciante-cancelar");
    if (cancelar) cancelar.style.display = "none";
    const guardar = document.getElementById("op-auspiciante-guardar");
    if (guardar) guardar.innerHTML = '<i class="fas fa-plus"></i> Guardar auspiciante';
  }

  function resetMediaForm() {
    llenarInput("op-media-id", "");
    llenarInput("op-media-titulo", "");
    llenarInput("op-media-descripcion", "");
    llenarInput("op-media-orden", 1);
    llenarInput("op-media-imagen", "");
    const tipo = document.getElementById("op-media-tipo");
    if (tipo) tipo.value = "landing_gallery";
    const activo = document.getElementById("op-media-activo");
    if (activo) activo.value = "true";
    const campeonato = document.getElementById("op-media-campeonato");
    if (campeonato) campeonato.value = "";
    toggleMediaCampeonato();
    const cancelar = document.getElementById("op-media-cancelar");
    if (cancelar) cancelar.style.display = "none";
    const guardar = document.getElementById("op-media-guardar");
    if (guardar) guardar.innerHTML = '<i class="fas fa-plus"></i> Guardar media';
  }

  function poblarCampeonatos() {
    const select = document.getElementById("op-media-campeonato");
    if (!select) return;
    select.innerHTML = '<option value="">Selecciona un campeonato</option>';
    state.campeonatos.forEach((campeonato) => {
      const option = document.createElement("option");
      option.value = String(campeonato.id);
      option.textContent = `${campeonato.nombre} (${campeonato.estado || "borrador"})`;
      select.appendChild(option);
    });
  }

  function toggleMediaCampeonato() {
    const tipo = document.getElementById("op-media-tipo");
    const group = document.getElementById("op-media-campeonato-group");
    const select = document.getElementById("op-media-campeonato");
    const requiere = ["campeonato_card", "campeonato_gallery"].includes(String(tipo?.value || ""));
    if (group) group.style.display = requiere ? "" : "none";
    if (select) select.required = requiere;
  }

  function renderAuspiciantes() {
    const cont = document.getElementById("op-auspiciantes-listado");
    if (!cont) return;
    if (!state.auspiciantes.length) {
      cont.innerHTML = "<p>No hay auspiciantes del organizador registrados.</p>";
      return;
    }

    cont.innerHTML = `
      <table class="tabla-posicion">
        <thead>
          <tr>
            <th>Logo</th>
            <th>Nombre</th>
            <th>Enlace</th>
            <th>Orden</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${state.auspiciantes
            .map(
              (item) => `
                <tr>
                  <td>${item.logo_url ? `<img src="${normalizarMedia(item.logo_url)}" alt="${item.nombre}" style="width:56px;height:56px;object-fit:contain;border-radius:10px;background:#fff;padding:6px;border:1px solid #d9e2f1;" />` : "-"}</td>
                  <td>${item.nombre}</td>
                  <td>${item.enlace_url ? `<a href="${item.enlace_url}" target="_blank" rel="noopener noreferrer">Abrir</a>` : "-"}</td>
                  <td>${item.orden || 1}</td>
                  <td>${item.activo ? "Activo" : "Inactivo"}</td>
                  <td class="list-table-actions">
                    <button class="btn btn-warning" type="button" data-auspiciante-edit="${item.id}"><i class="fas fa-pen"></i> Editar</button>
                    <button class="btn btn-danger" type="button" data-auspiciante-delete="${item.id}"><i class="fas fa-trash"></i> Eliminar</button>
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderMedia() {
    const cont = document.getElementById("op-media-listado");
    if (!cont) return;
    if (!state.media.length) {
      cont.innerHTML = "<p>No hay media pública registrada.</p>";
      return;
    }

    const campeonatoNombre = new Map(state.campeonatos.map((item) => [Number(item.id), item.nombre]));
    cont.innerHTML = `
      <table class="tabla-posicion">
        <thead>
          <tr>
            <th>Imagen</th>
            <th>Tipo</th>
            <th>Campeonato</th>
            <th>Título</th>
            <th>Orden</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${state.media
            .map(
              (item) => `
                <tr>
                  <td>${item.imagen_url ? `<img src="${normalizarMedia(item.imagen_url)}" alt="${item.titulo || item.tipo}" style="width:72px;height:56px;object-fit:cover;border-radius:10px;border:1px solid #d9e2f1;" />` : "-"}</td>
                  <td>${item.tipo}</td>
                  <td>${campeonatoNombre.get(Number(item.campeonato_id)) || "-"}</td>
                  <td>${item.titulo || "-"}</td>
                  <td>${item.orden || 1}</td>
                  <td>${item.activo ? "Activo" : "Inactivo"}</td>
                  <td class="list-table-actions">
                    <button class="btn btn-warning" type="button" data-media-edit="${item.id}"><i class="fas fa-pen"></i> Editar</button>
                    <button class="btn btn-danger" type="button" data-media-delete="${item.id}"><i class="fas fa-trash"></i> Eliminar</button>
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function poblarCampeonatosJornadas() {
    const select = document.getElementById("op-jornadas-campeonato");
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">— Selecciona un campeonato —</option>';
    state.campeonatos.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = String(c.id);
      opt.textContent = `${c.nombre} (${c.estado || "borrador"})`;
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }

  function renderJornadasLista() {
    const panel = document.getElementById("op-jornadas-panel");
    const empty = document.getElementById("op-jornadas-empty");
    const lista = document.getElementById("op-jornadas-lista");
    const hint = document.getElementById("op-jornadas-hint");
    if (!panel || !empty || !lista) return;

    const { jornadasDisponibles, jornadasHabilitadas } = state.jornadasEvento;

    if (!jornadasDisponibles.length) {
      panel.style.display = "none";
      empty.style.display = "";
      return;
    }

    empty.style.display = "none";
    panel.style.display = "";

    const habSet = jornadasHabilitadas === null ? null : new Set(jornadasHabilitadas.map(Number));

    if (hint) {
      hint.textContent = jornadasHabilitadas === null
        ? "Sin filtro activo: se muestran todas las jornadas en el portal."
        : jornadasHabilitadas.length === 0
        ? "Ninguna jornada visible en el portal."
        : `Jornadas habilitadas: ${jornadasHabilitadas.sort((a, b) => a - b).join(", ")}`;
    }

    lista.innerHTML = jornadasDisponibles
      .map((j) => {
        const checked = habSet === null ? false : habSet.has(Number(j));
        return `
          <label class="jornada-portal-item${checked ? " jornada-portal-item--activa" : ""}">
            <input type="checkbox" class="op-jornada-chk" value="${j}" ${checked ? "checked" : ""} />
            <span class="jornada-portal-num">Jornada ${j}</span>
            <span class="jornada-portal-estado">${checked ? "Visible" : "Oculta"}</span>
          </label>
        `;
      })
      .join("");

    // Update labels on change
    lista.querySelectorAll(".op-jornada-chk").forEach((chk) => {
      chk.addEventListener("change", () => {
        const lbl = chk.closest(".jornada-portal-item");
        const estado = lbl.querySelector(".jornada-portal-estado");
        if (chk.checked) {
          lbl.classList.add("jornada-portal-item--activa");
          if (estado) estado.textContent = "Visible";
        } else {
          lbl.classList.remove("jornada-portal-item--activa");
          if (estado) estado.textContent = "Oculta";
        }
      });
    });
  }

  async function cargarJornadasEvento(eventoId) {
    const panel = document.getElementById("op-jornadas-panel");
    const empty = document.getElementById("op-jornadas-empty");
    const lista = document.getElementById("op-jornadas-lista");
    if (panel) panel.style.display = "none";
    if (empty) empty.style.display = "none";
    if (lista) lista.innerHTML = '<p style="color:#94a3b8;">Cargando jornadas...</p>';
    if (empty) empty.style.display = "";

    if (!eventoId) {
      state.jornadasEvento = { eventoId: null, jornadasDisponibles: [], jornadasHabilitadas: null };
      return;
    }

    try {
      const data = await window.OrganizadorPortalAPI.obtenerJornadasPortal(eventoId);
      state.jornadasEvento = {
        eventoId: Number(eventoId),
        jornadasDisponibles: Array.isArray(data.jornadas_disponibles) ? data.jornadas_disponibles.map(Number) : [],
        jornadasHabilitadas: Array.isArray(data.jornadas_habilitadas) ? data.jornadas_habilitadas.map(Number) : null,
      };
      renderJornadasLista();
    } catch (error) {
      console.error("Error cargando jornadas portal:", error);
      window.mostrarNotificacion(error.message || "No se pudieron cargar las jornadas", "error");
    }
  }

  async function guardarJornadasPortal() {
    const { eventoId, jornadasHabilitadas } = state.jornadasEvento;
    if (!eventoId) {
      window.mostrarNotificacion("Selecciona una categoría primero.", "warning");
      return;
    }

    // Leer estado actual de los checkboxes
    const checkboxes = document.querySelectorAll(".op-jornada-chk");
    // Si no hay checkboxes visibles, significa "sin filtro" (null)
    if (!checkboxes.length) {
      window.mostrarNotificacion("No hay jornadas para configurar.", "warning");
      return;
    }

    const seleccionadas = [];
    checkboxes.forEach((chk) => {
      if (chk.checked) seleccionadas.push(Number(chk.value));
    });

    try {
      const resp = await window.OrganizadorPortalAPI.guardarJornadasPortal(eventoId, seleccionadas);
      state.jornadasEvento.jornadasHabilitadas = Array.isArray(resp.jornadas_habilitadas)
        ? resp.jornadas_habilitadas
        : null;
      renderJornadasLista();
      window.mostrarNotificacion(resp.mensaje || "Configuración guardada.", "success");
    } catch (error) {
      console.error("Error guardando jornadas portal:", error);
      window.mostrarNotificacion(error.message || "No se pudo guardar la configuración.", "error");
    }
  }

  async function quitarFiltroJornadas() {
    const { eventoId } = state.jornadasEvento;
    if (!eventoId) {
      window.mostrarNotificacion("Selecciona una categoría primero.", "warning");
      return;
    }
    try {
      const resp = await window.OrganizadorPortalAPI.guardarJornadasPortal(eventoId, null);
      state.jornadasEvento.jornadasHabilitadas = null;
      renderJornadasLista();
      window.mostrarNotificacion(resp.mensaje || "Filtro eliminado: se muestran todas.", "success");
    } catch (error) {
      window.mostrarNotificacion(error.message || "No se pudo quitar el filtro.", "error");
    }
  }

  async function cargarContexto() {
    const payload = await window.OrganizadorPortalAPI.obtenerContexto();
    state.organizador = payload.organizador || null;
    state.config = payload.config || null;
    state.campeonatos = Array.isArray(payload.campeonatos) ? payload.campeonatos : [];
    state.auspiciantes = Array.isArray(payload.auspiciantes) ? payload.auspiciantes : [];
    state.media = Array.isArray(payload.media) ? payload.media : [];
    poblarConfig();
    poblarCampeonatos();
    poblarCampeonatosJornadas();
    renderResumen();
    renderAuspiciantes();
    renderMedia();
  }

  async function guardarConfig(event) {
    event.preventDefault();
    const formData = new FormData();
    [
      "landing_slug",
      "organizacion_nombre",
      "lema",
      "hero_title",
      "hero_chip",
      "hero_description",
      "about_title",
      "about_text_1",
      "about_text_2",
      "contact_title",
      "contact_description",
      "contact_email",
      "contact_phone",
      "facebook_url",
      "instagram_url",
      "whatsapp_url",
    ].forEach((field) => {
      const element = document.getElementById(`op-${field.replace(/_/g, "-")}`);
      if (element) formData.append(field, String(element.value || "").trim());
    });
    formData.append(
      "equipos_bienvenida_titulo",
      String(document.getElementById("op-team-welcome-title")?.value || "").trim()
    );
    formData.append(
      "equipos_bienvenida_descripcion",
      String(document.getElementById("op-team-welcome-description")?.value || "").trim()
    );
    const logo = document.getElementById("op-logo")?.files?.[0];
    const heroImage = document.getElementById("op-hero-image")?.files?.[0];
    const teamWelcomeImage = document.getElementById("op-team-welcome-image")?.files?.[0];
    if (logo) formData.append("logo", logo);
    if (heroImage) formData.append("hero_image", heroImage);
    if (teamWelcomeImage) formData.append("team_welcome_image", teamWelcomeImage);

    // Tema visual seleccionado
    const colorTema = document.getElementById("op-color-tema")?.value || "deportivo";
    formData.append("color_tema", colorTema);
    formData.append("color_primario", document.getElementById("op-color-primario")?.value || "");
    formData.append("color_secundario", document.getElementById("op-color-secundario")?.value || "");
    formData.append("color_acento", document.getElementById("op-color-acento")?.value || "");

    try {
      await window.OrganizadorPortalAPI.actualizarConfig(formData);
      window.mostrarNotificacion("Configuración pública actualizada", "success");
      await cargarContexto();
    } catch (error) {
      window.mostrarNotificacion(
        error?.message || "No se pudo guardar la configuración pública",
        "error"
      );
    }
  }

  async function guardarAuspiciante(event) {
    event.preventDefault();
    const id = Number.parseInt(document.getElementById("op-auspiciante-id")?.value || "", 10);
    const formData = new FormData();
    formData.append("nombre", String(document.getElementById("op-auspiciante-nombre")?.value || "").trim());
    formData.append("enlace_url", String(document.getElementById("op-auspiciante-enlace")?.value || "").trim());
    formData.append("orden", String(document.getElementById("op-auspiciante-orden")?.value || "1").trim());
    formData.append("activo", String(document.getElementById("op-auspiciante-activo")?.value || "true").trim());
    const logo = document.getElementById("op-auspiciante-logo")?.files?.[0];
    if (logo) formData.append("logo", logo);

    if (Number.isFinite(id) && id > 0) {
      await window.OrganizadorPortalAPI.actualizarAuspiciante(id, formData);
      window.mostrarNotificacion("Auspiciante actualizado", "success");
    } else {
      await window.OrganizadorPortalAPI.crearAuspiciante(formData);
      window.mostrarNotificacion("Auspiciante creado", "success");
    }
    resetAuspicianteForm();
    await cargarContexto();
  }

  async function guardarMedia(event) {
    event.preventDefault();
    const id = Number.parseInt(document.getElementById("op-media-id")?.value || "", 10);
    const tipo = String(document.getElementById("op-media-tipo")?.value || "").trim();
    const formData = new FormData();
    formData.append("tipo", tipo);
    formData.append("titulo", String(document.getElementById("op-media-titulo")?.value || "").trim());
    formData.append("descripcion", String(document.getElementById("op-media-descripcion")?.value || "").trim());
    formData.append("orden", String(document.getElementById("op-media-orden")?.value || "1").trim());
    formData.append("activo", String(document.getElementById("op-media-activo")?.value || "true").trim());
    if (["campeonato_card", "campeonato_gallery"].includes(tipo)) {
      formData.append("campeonato_id", String(document.getElementById("op-media-campeonato")?.value || "").trim());
    }
    const imagen = document.getElementById("op-media-imagen")?.files?.[0];
    if (imagen) formData.append("imagen", imagen);

    if (Number.isFinite(id) && id > 0) {
      await window.OrganizadorPortalAPI.actualizarMedia(id, formData);
      window.mostrarNotificacion("Media pública actualizada", "success");
    } else {
      await window.OrganizadorPortalAPI.crearMedia(formData);
      window.mostrarNotificacion("Media pública creada", "success");
    }
    resetMediaForm();
    await cargarContexto();
  }

  function editarAuspiciante(id) {
    const item = state.auspiciantes.find((row) => Number(row.id) === Number(id));
    if (!item) return;
    llenarInput("op-auspiciante-id", item.id);
    llenarInput("op-auspiciante-nombre", item.nombre || "");
    llenarInput("op-auspiciante-enlace", item.enlace_url || "");
    llenarInput("op-auspiciante-orden", item.orden || 1);
    const activo = document.getElementById("op-auspiciante-activo");
    if (activo) activo.value = item.activo ? "true" : "false";
    const cancelar = document.getElementById("op-auspiciante-cancelar");
    if (cancelar) cancelar.style.display = "";
    const guardar = document.getElementById("op-auspiciante-guardar");
    if (guardar) guardar.innerHTML = '<i class="fas fa-floppy-disk"></i> Actualizar auspiciante';
  }

  function editarMedia(id) {
    const item = state.media.find((row) => Number(row.id) === Number(id));
    if (!item) return;
    llenarInput("op-media-id", item.id);
    llenarInput("op-media-titulo", item.titulo || "");
    llenarInput("op-media-descripcion", item.descripcion || "");
    llenarInput("op-media-orden", item.orden || 1);
    const tipo = document.getElementById("op-media-tipo");
    if (tipo) tipo.value = item.tipo || "landing_gallery";
    const activo = document.getElementById("op-media-activo");
    if (activo) activo.value = item.activo ? "true" : "false";
    const campeonato = document.getElementById("op-media-campeonato");
    if (campeonato) campeonato.value = item.campeonato_id || "";
    toggleMediaCampeonato();
    const cancelar = document.getElementById("op-media-cancelar");
    if (cancelar) cancelar.style.display = "";
    const guardar = document.getElementById("op-media-guardar");
    if (guardar) guardar.innerHTML = '<i class="fas fa-floppy-disk"></i> Actualizar media';
  }

  async function eliminarAuspiciante(id) {
    const ok = await window.mostrarConfirmacion({
      titulo: "Eliminar auspiciante",
      mensaje: "Se eliminará este auspiciante del organizador.",
      peligro: true,
      textoConfirmar: "Eliminar",
      claseConfirmar: "btn-danger",
    });
    if (!ok) return;
    await window.OrganizadorPortalAPI.eliminarAuspiciante(id);
    window.mostrarNotificacion("Auspiciante eliminado", "success");
    await cargarContexto();
  }

  async function eliminarMedia(id) {
    const ok = await window.mostrarConfirmacion({
      titulo: "Eliminar media pública",
      mensaje: "Se eliminará esta imagen pública del organizador.",
      peligro: true,
      textoConfirmar: "Eliminar",
      claseConfirmar: "btn-danger",
    });
    if (!ok) return;
    await window.OrganizadorPortalAPI.eliminarMedia(id);
    window.mostrarNotificacion("Media pública eliminada", "success");
    await cargarContexto();
  }

  async function copiarLanding() {
    try {
      await navigator.clipboard.writeText(new URL(landingUrl(), window.location.href).toString());
      window.mostrarNotificacion("Enlace copiado", "success");
    } catch (error) {
      console.error(error);
      window.mostrarNotificacion("No se pudo copiar el enlace", "warning");
    }
  }

  function bindEvents() {
    initTemaSelector();
    document.getElementById("op-config-form")?.addEventListener("submit", async (event) => {
      try {
        await guardarConfig(event);
      } catch (error) {
        console.error(error);
        window.mostrarNotificacion(error.message || "No se pudo guardar la configuración", "error");
      }
    });

    document.getElementById("op-auspiciante-form")?.addEventListener("submit", async (event) => {
      try {
        await guardarAuspiciante(event);
      } catch (error) {
        console.error(error);
        window.mostrarNotificacion(error.message || "No se pudo guardar el auspiciante", "error");
      }
    });

    document.getElementById("op-media-form")?.addEventListener("submit", async (event) => {
      try {
        await guardarMedia(event);
      } catch (error) {
        console.error(error);
        window.mostrarNotificacion(error.message || "No se pudo guardar la media pública", "error");
      }
    });

    document.getElementById("op-auspiciante-cancelar")?.addEventListener("click", resetAuspicianteForm);
    document.getElementById("op-media-cancelar")?.addEventListener("click", resetMediaForm);
    document.getElementById("op-media-tipo")?.addEventListener("change", toggleMediaCampeonato);
    document.getElementById("op-copy-landing")?.addEventListener("click", copiarLanding);

    // Jornadas portal
    document.getElementById("op-jornadas-campeonato")?.addEventListener("change", async (e) => {
      const campeonatoId = e.target.value;
      const selectEvento = document.getElementById("op-jornadas-evento");
      if (!selectEvento) return;
      selectEvento.innerHTML = '<option value="">— Cargando... —</option>';
      selectEvento.disabled = true;
      if (!campeonatoId) {
        selectEvento.innerHTML = '<option value="">— Selecciona una categoría —</option>';
        state.jornadasEvento = { eventoId: null, jornadasDisponibles: [], jornadasHabilitadas: null };
        const panel = document.getElementById("op-jornadas-panel");
        const empty = document.getElementById("op-jornadas-empty");
        if (panel) panel.style.display = "none";
        if (empty) empty.style.display = "none";
        return;
      }
      try {
        const data = await window.OrganizadorPortalAPI.listarEventosCampeonato(campeonatoId);
        selectEvento.innerHTML = '<option value="">— Selecciona una categoría —</option>';
        (Array.isArray(data.eventos) ? data.eventos : []).forEach((ev) => {
          const opt = document.createElement("option");
          opt.value = String(ev.id);
          opt.textContent = ev.nombre;
          selectEvento.appendChild(opt);
        });
        selectEvento.disabled = false;
      } catch (error) {
        selectEvento.innerHTML = '<option value="">— Error cargando categorías —</option>';
        window.mostrarNotificacion("No se pudieron cargar las categorías.", "error");
      }
    });

    document.getElementById("op-jornadas-evento")?.addEventListener("change", async (e) => {
      await cargarJornadasEvento(e.target.value);
    });

    document.getElementById("op-jornadas-guardar")?.addEventListener("click", async () => {
      try {
        await guardarJornadasPortal();
      } catch (error) {
        window.mostrarNotificacion(error.message || "Error al guardar.", "error");
      }
    });

    document.getElementById("op-jornadas-marcar-todas")?.addEventListener("click", () => {
      document.querySelectorAll(".op-jornada-chk").forEach((chk) => {
        chk.checked = true;
        const lbl = chk.closest(".jornada-portal-item");
        const estado = lbl?.querySelector(".jornada-portal-estado");
        lbl?.classList.add("jornada-portal-item--activa");
        if (estado) estado.textContent = "Visible";
      });
    });

    document.getElementById("op-jornadas-desmarcar-todas")?.addEventListener("click", () => {
      document.querySelectorAll(".op-jornada-chk").forEach((chk) => {
        chk.checked = false;
        const lbl = chk.closest(".jornada-portal-item");
        const estado = lbl?.querySelector(".jornada-portal-estado");
        lbl?.classList.remove("jornada-portal-item--activa");
        if (estado) estado.textContent = "Oculta";
      });
    });

    document.getElementById("op-jornadas-mostrar-todas")?.addEventListener("click", async () => {
      await quitarFiltroJornadas();
    });

    document.addEventListener("click", async (event) => {
      const auspicianteEdit = event.target.closest("[data-auspiciante-edit]");
      if (auspicianteEdit) {
        editarAuspiciante(auspicianteEdit.dataset.auspicianteEdit);
        return;
      }
      const auspicianteDelete = event.target.closest("[data-auspiciante-delete]");
      if (auspicianteDelete) {
        try {
          await eliminarAuspiciante(auspicianteDelete.dataset.auspicianteDelete);
        } catch (error) {
          console.error(error);
          window.mostrarNotificacion(error.message || "No se pudo eliminar el auspiciante", "error");
        }
        return;
      }
      const mediaEdit = event.target.closest("[data-media-edit]");
      if (mediaEdit) {
        editarMedia(mediaEdit.dataset.mediaEdit);
        return;
      }
      const mediaDelete = event.target.closest("[data-media-delete]");
      if (mediaDelete) {
        try {
          await eliminarMedia(mediaDelete.dataset.mediaDelete);
        } catch (error) {
          console.error(error);
          window.mostrarNotificacion(error.message || "No se pudo eliminar la media", "error");
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!currentPageIsValid()) return;
    bindEvents();
    try {
      await cargarContexto();
      resetAuspicianteForm();
      resetMediaForm();
    } catch (error) {
      console.error(error);
      window.mostrarNotificacion(error.message || "No se pudo cargar el módulo de landing", "error");
      const resumen = document.getElementById("op-resumen");
      if (resumen) resumen.textContent = error.message || "No se pudo cargar la configuración del organizador.";
    }
  });
})();
