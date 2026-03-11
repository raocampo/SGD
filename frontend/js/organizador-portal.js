(function () {
  const state = {
    organizador: null,
    config: null,
    campeonatos: [],
    auspiciantes: [],
    media: [],
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
    const userId = Number.parseInt(state.organizador?.id, 10);
    if (!Number.isFinite(userId) || userId <= 0) return "index.html";
    return `index.html?organizador=${userId}`;
  }

  function llenarInput(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? "";
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

  function poblarConfig() {
    const config = state.config || {};
    llenarInput("op-organizacion-nombre", config.organizacion_nombre || state.organizador?.organizacion_nombre || "");
    llenarInput("op-lema", config.lema || "");
    llenarInput("op-hero-title", config.hero_title || "");
    llenarInput("op-hero-chip", config.hero_chip || "");
    llenarInput("op-hero-description", config.hero_description || "");
    llenarInput("op-about-title", config.about_title || "");
    llenarInput("op-about-text-1", config.about_text_1 || "");
    llenarInput("op-about-text-2", config.about_text_2 || "");
    llenarInput("op-contact-email", config.contact_email || state.organizador?.email || "");
    llenarInput("op-contact-phone", config.contact_phone || "");
    llenarInput("op-facebook-url", config.facebook_url || "");
    llenarInput("op-instagram-url", config.instagram_url || "");
    llenarInput("op-whatsapp-url", config.whatsapp_url || "");
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

  async function cargarContexto() {
    const payload = await window.OrganizadorPortalAPI.obtenerContexto();
    state.organizador = payload.organizador || null;
    state.config = payload.config || null;
    state.campeonatos = Array.isArray(payload.campeonatos) ? payload.campeonatos : [];
    state.auspiciantes = Array.isArray(payload.auspiciantes) ? payload.auspiciantes : [];
    state.media = Array.isArray(payload.media) ? payload.media : [];
    poblarConfig();
    poblarCampeonatos();
    renderResumen();
    renderAuspiciantes();
    renderMedia();
  }

  async function guardarConfig(event) {
    event.preventDefault();
    const formData = new FormData();
    [
      "organizacion_nombre",
      "lema",
      "hero_title",
      "hero_chip",
      "hero_description",
      "about_title",
      "about_text_1",
      "about_text_2",
      "contact_email",
      "contact_phone",
      "facebook_url",
      "instagram_url",
      "whatsapp_url",
    ].forEach((field) => {
      const element = document.getElementById(`op-${field.replace(/_/g, "-")}`);
      if (element) formData.append(field, String(element.value || "").trim());
    });
    const logo = document.getElementById("op-logo")?.files?.[0];
    const heroImage = document.getElementById("op-hero-image")?.files?.[0];
    if (logo) formData.append("logo", logo);
    if (heroImage) formData.append("hero_image", heroImage);

    await window.OrganizadorPortalAPI.actualizarConfig(formData);
    window.mostrarNotificacion("Configuración pública actualizada", "success");
    await cargarContexto();
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
