(function () {
  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
  }

  function toNumber(value) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function formatearFechaCorta(fecha) {
    if (!fecha) return "-";
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("es-EC", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function cargarKpisCms() {
    const estado = document.getElementById("cms-kpi-estado");
    try {
      const [noticiasR, galeriaR, contactoR, contenidoR] = await Promise.all([
        window.NoticiasAPI.listar(),
        window.GaleriaAPI.listar(),
        window.ContactoAPI.listar({ estado: "nuevo" }),
        window.PortalContenidoAPI.obtener(),
      ]);

      const noticias = Array.isArray(noticiasR?.noticias) ? noticiasR.noticias : [];
      const publicadas = noticias.filter((n) => String(n?.estado || "").toLowerCase() === "publicada").length;

      const galeria = Array.isArray(galeriaR?.items) ? galeriaR.items : [];
      const activa = galeria.filter((g) => g?.activo === true).length;

      const mensajesNuevos = Array.isArray(contactoR?.mensajes) ? contactoR.mensajes.length : 0;
      const contenido = contenidoR?.contenido || null;
      const actualizado = formatearFechaCorta(contenido?.updated_at || contenido?.created_at || null);

      setText("cms-kpi-noticias-publicadas", String(toNumber(publicadas)));
      setText("cms-kpi-galeria-activa", String(toNumber(activa)));
      setText("cms-kpi-contacto-nuevo", String(toNumber(mensajesNuevos)));
      setText("cms-kpi-contenido-actualizado", actualizado);

      if (estado) {
        estado.textContent = "Métricas actualizadas correctamente.";
        estado.style.color = "#166534";
      }
    } catch (error) {
      console.error("Error cargando KPIs CMS:", error);
      if (estado) {
        estado.textContent = `No se pudieron cargar métricas: ${error?.message || "error desconocido"}`;
        estado.style.color = "#b91c1c";
      }
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.location.pathname.endsWith("portal-cms.html")) return;
    await cargarKpisCms();
  });
})();

