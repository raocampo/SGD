(function () {
  const PLANES_PAGADOS = new Set(["base", "competencia", "premium"]);

  function esPlanPagado(planCodigo) {
    return PLANES_PAGADOS.has(String(planCodigo || "").trim().toLowerCase());
  }

  function construirLandingUrl(usuarioId) {
    const url = new URL("index.html", window.location.href);
    url.searchParams.set("organizador", String(usuarioId));
    return url.toString();
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

  function renderLandingOrganizadorCard() {
    if (!window.location.pathname.endsWith("portal-admin.html")) return;

    const card = document.getElementById("landing-organizador-card");
    const msg = document.getElementById("landing-organizador-msg");
    const actions = document.getElementById("landing-organizador-actions");
    const openLink = document.getElementById("landing-organizador-open");
    const copyBtn = document.getElementById("landing-organizador-copy");
    if (!card || !msg || !actions || !openLink || !copyBtn) return;

    const user = window.Auth?.getUser?.();
    const rol = String(user?.rol || "").toLowerCase();
    if (rol !== "organizador") {
      card.style.display = "none";
      return;
    }

    card.style.display = "block";

    if (!esPlanPagado(user?.plan_codigo)) {
      msg.textContent =
        "Tu plan actual no incluye landing pública personalizada. Disponible en planes Base, Competencia y Premium.";
      actions.style.display = "none";
      return;
    }

    const landingUrl = construirLandingUrl(user.id);
    msg.textContent = "Tu landing pública está activa. Comparte este enlace con tus equipos y audiencia.";
    actions.style.display = "flex";
    openLink.href = landingUrl;

    copyBtn.addEventListener("click", async () => {
      try {
        await copiarTexto(landingUrl);
        mostrarNotificacion("Enlace copiado al portapapeles", "success");
      } catch (error) {
        console.error(error);
        mostrarNotificacion("No se pudo copiar el enlace", "warning");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", renderLandingOrganizadorCard);
})();
