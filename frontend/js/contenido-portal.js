(function () {
  function getCardsPayload() {
    return [1, 2, 3].map((n) => ({
      titulo: String(document.getElementById(`pc-card-${n}-title`)?.value || "").trim(),
      descripcion: String(document.getElementById(`pc-card-${n}-desc`)?.value || "").trim(),
      icono: String(document.getElementById(`pc-card-${n}-icon`)?.value || "").trim() || "fa-star",
    }));
  }

  function setCards(cards = []) {
    [1, 2, 3].forEach((n, idx) => {
      const item = cards[idx] || {};
      document.getElementById(`pc-card-${n}-title`).value = item.titulo || "";
      document.getElementById(`pc-card-${n}-desc`).value = item.descripcion || "";
      document.getElementById(`pc-card-${n}-icon`).value = item.icono || "";
    });
  }

  function cargarFormulario(c) {
    if (!c) return;
    document.getElementById("pc-hero-title").value = c.hero_title || "";
    document.getElementById("pc-hero-chip").value = c.hero_chip || "";
    document.getElementById("pc-hero-cta").value = c.hero_cta_label || "";
    document.getElementById("pc-hero-description").value = c.hero_description || "";
    document.getElementById("pc-about-title").value = c.about_title || "";
    document.getElementById("pc-about-image").value = c.about_image_url || "";
    document.getElementById("pc-about-text-1").value = c.about_text_1 || "";
    document.getElementById("pc-about-text-2").value = c.about_text_2 || "";
    document.getElementById("pc-contact-title").value = c.contact_title || "";
    document.getElementById("pc-contact-description").value = c.contact_description || "";
    document.getElementById("pc-contact-email").value = c.contact_email || "";
    document.getElementById("pc-contact-phone").value = c.contact_phone || "";
    document.getElementById("pc-facebook-url").value = c.facebook_url || "";
    document.getElementById("pc-instagram-url").value = c.instagram_url || "";
    document.getElementById("pc-whatsapp-url").value = c.whatsapp_url || "";
    setCards(Array.isArray(c.cards_json) ? c.cards_json : []);
  }

  async function cargar() {
    const data = await window.PortalContenidoAPI.obtener();
    cargarFormulario(data?.contenido || null);
  }

  async function guardar(e) {
    e.preventDefault();
    const payload = {
      hero_title: String(document.getElementById("pc-hero-title").value || "").trim(),
      hero_chip: String(document.getElementById("pc-hero-chip").value || "").trim(),
      hero_cta_label: String(document.getElementById("pc-hero-cta").value || "").trim(),
      hero_description: String(document.getElementById("pc-hero-description").value || "").trim(),
      about_title: String(document.getElementById("pc-about-title").value || "").trim(),
      about_image_url: String(document.getElementById("pc-about-image").value || "").trim(),
      about_text_1: String(document.getElementById("pc-about-text-1").value || "").trim(),
      about_text_2: String(document.getElementById("pc-about-text-2").value || "").trim(),
      contact_title: String(document.getElementById("pc-contact-title").value || "").trim(),
      contact_description: String(document.getElementById("pc-contact-description").value || "").trim(),
      contact_email: String(document.getElementById("pc-contact-email").value || "").trim(),
      contact_phone: String(document.getElementById("pc-contact-phone").value || "").trim(),
      facebook_url: String(document.getElementById("pc-facebook-url").value || "").trim(),
      instagram_url: String(document.getElementById("pc-instagram-url").value || "").trim(),
      whatsapp_url: String(document.getElementById("pc-whatsapp-url").value || "").trim(),
      cards_json: getCardsPayload(),
    };

    try {
      await window.PortalContenidoAPI.actualizar(payload);
      mostrarNotificacion("Contenido del portal actualizado", "success");
      await cargar();
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo guardar el contenido", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.location.pathname.endsWith("contenido-portal.html")) return;
    document.getElementById("contenido-portal-form")?.addEventListener("submit", guardar);
    document.getElementById("btn-contenido-recargar")?.addEventListener("click", cargar);
    await cargar();
  });
})();
