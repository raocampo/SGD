(function () {
  const PLANES_PAGADOS = new Set(["base", "competencia", "premium"]);

  function esPlanPagado(planCodigo) {
    return PLANES_PAGADOS.has(String(planCodigo || "").trim().toLowerCase());
  }

  // Fallback legacy (?organizador=ID) para organizadores sin landing_slug
  // todavía -- desde el 2026-09-06 toda cuenta nueva ya trae slug solo, así
  // que esto solo debería usarse para cuentas viejas sin backfillear.
  function construirLandingUrlLegacy(usuarioId) {
    const url = new URL("index.html", window.location.href);
    url.searchParams.set("organizador", String(usuarioId));
    return url.toString();
  }

  // La URL "bonita" (/liga/<slug>) es la que se comparte con equipos y
  // audiencia -- antes esta tarjeta siempre mostraba el enlace viejo
  // ?organizador=ID aunque el organizador ya tuviera su slug configurado.
  async function construirLandingUrl(usuarioId) {
    try {
      const payload = await window.OrganizadorPortalAPI.obtenerContexto();
      const slug = String(payload?.config?.landing_slug || "").trim();
      if (slug) return new URL(`/liga/${slug}`, window.location.origin).toString();
    } catch (error) {
      console.warn("No se pudo obtener landing_slug, se usa el enlace legacy:", error);
    }
    return construirLandingUrlLegacy(usuarioId);
  }

  async function copiarTexto(texto) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return;
    }
    const aux = document.createElement("textarea");
    aux.value = texto;
    aux.setAttribute("readonly", "true");
    aux.style.position = "fixed";
    aux.style.left = "-9999px";
    document.body.appendChild(aux);
    aux.select();
    document.execCommand("copy");
    document.body.removeChild(aux);
  }

  async function renderLandingOrganizadorCard() {
    if (!window.location.pathname.endsWith("portal-admin.html")) return;

    const card = document.getElementById("landing-organizador-card");
    const shortcut = document.getElementById("landing-organizador-shortcut");
    const msg = document.getElementById("landing-organizador-msg");
    const actions = document.getElementById("landing-organizador-actions");
    const openLink = document.getElementById("landing-organizador-open");
    const copyBtn = document.getElementById("landing-organizador-copy");
    if (!card || !msg || !actions || !openLink || !copyBtn) return;

    const user = window.Auth?.getUser?.();
    const rol = String(user?.rol || "").toLowerCase();
    if (rol !== "organizador") {
      card.style.display = "none";
      if (shortcut) shortcut.style.display = "none";
      return;
    }

    card.style.display = "block";
    if (shortcut) shortcut.style.display = "";

    if (!esPlanPagado(user?.plan_codigo)) {
      msg.textContent =
        "Tu plan actual no incluye landing pública personalizada. Disponible en planes Base, Competencia y Premium.";
      actions.style.display = "none";
      return;
    }

    const landingUrl = await construirLandingUrl(user.id);
    msg.textContent = "Tu landing pública está activa. Comparte este enlace con tus equipos y audiencia.";
    actions.style.display = "flex";
    openLink.href = landingUrl;

    if (copyBtn.dataset.bound === "true") return;
    copyBtn.dataset.bound = "true";
    copyBtn.addEventListener("click", async () => {
      try {
        await copiarTexto(openLink.href);
        mostrarNotificacion("Enlace copiado al portapapeles", "success");
      } catch (error) {
        console.error(error);
        mostrarNotificacion("No se pudo copiar el enlace", "warning");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", renderLandingOrganizadorCard);
})();
