// frontend/js/dashboard-organizador.js
(function () {
  const CONCEPTO_LABEL = {
    inscripcion: "Inscripción",
    arbitraje: "Arbitraje",
    multa: "Multa",
    pago: "Pago",
    ajuste: "Ajuste",
    otro: "Otro",
  };
  const CONCEPTO_COLOR = {
    inscripcion: "#3b82f6",
    arbitraje: "#10b981",
    multa: "#ef4444",
    pago: "#8b5cf6",
    ajuste: "#f59e0b",
    otro: "#6b7280",
  };
  const PLAN_BADGE = {
    demo: { label: "Demo", cls: "badge-plan-demo" },
    free: { label: "Free", cls: "badge-plan-free" },
    base: { label: "Base", cls: "badge-plan-base" },
    competencia: { label: "Competencia", cls: "badge-plan-competencia" },
    premium: { label: "Premium", cls: "badge-plan-premium" },
  };

  let chartInstance = null;

  function fmt(n) {
    return Number(n || 0).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtNum(n) {
    return Number(n || 0).toLocaleString("es-EC");
  }

  function formatearFecha(f) {
    if (!f) return "—";
    // Extraer YYYY-MM-DD y construir como hora local para evitar desfase UTC-5
    const ymd = String(f).slice(0, 10);
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("es-EC", { weekday: "short", day: "2-digit", month: "short" });
  }

  function formatearHora(h) {
    if (!h) return "";
    return String(h).substring(0, 5);
  }

  function setKpi(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  }

  function renderPlanBadge(plan) {
    const info = PLAN_BADGE[String(plan?.codigo || "free").toLowerCase()] || PLAN_BADGE.free;
    const elBadge = document.getElementById("dash-plan-badge");
    const elNombre = document.getElementById("dash-plan-nombre");
    const elLimite = document.getElementById("dash-plan-limite");
    const elPrecio = document.getElementById("dash-plan-precio");

    if (elBadge) {
      elBadge.textContent = info.label;
      elBadge.className = `dash-plan-badge ${info.cls}`;
    }
    if (elNombre) elNombre.textContent = `Plan ${info.label}`;
    if (elLimite) {
      const usado = plan?.campeonatos_usados ?? "?";
      const max = plan?.max_campeonatos != null ? plan.max_campeonatos : "∞";
      elLimite.textContent = `Campeonatos: ${usado} / ${max}`;
    }
    if (elPrecio) {
      const precio = plan?.precio_mensual;
      elPrecio.textContent = precio > 0 ? `$${precio}/mes` : "Gratuito";
    }
  }

  function renderChart(porConcepto) {
    const canvas = document.getElementById("dash-chart-concepto");
    if (!canvas) return;

    const conceptos = (porConcepto || []).filter((r) => Number(r.total) > 0);

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    if (!conceptos.length) {
      const wrapper = canvas.parentElement;
      if (wrapper) {
        wrapper.innerHTML = '<p class="dash-empty-msg">Sin ingresos registrados este mes.</p>';
      }
      return;
    }

    const labels = conceptos.map((r) => CONCEPTO_LABEL[r.concepto] || r.concepto);
    const data = conceptos.map((r) => Number(r.total));
    const colors = conceptos.map((r) => CONCEPTO_COLOR[r.concepto] || "#9ca3af");

    chartInstance = new window.Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Ingresos ($)",
            data,
            backgroundColor: colors,
            borderRadius: 4,
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` $${fmt(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => `$${fmtNum(v)}`,
              font: { size: 11 },
            },
            grid: { color: "#f1f5f9" },
          },
          x: {
            ticks: { font: { size: 11 } },
            grid: { display: false },
          },
        },
      },
    });
  }

  function renderEncuentros(lista) {
    const cont = document.getElementById("dash-encuentros-lista");
    if (!cont) return;

    if (!lista || !lista.length) {
      cont.innerHTML = '<p class="dash-empty-msg">Sin partidos programados en los próximos 7 días.</p>';
      return;
    }

    cont.innerHTML = lista
      .map((p) => {
        const num = p.numero_partido_visible ? `#${p.numero_partido_visible}` : "";
        const hora = formatearHora(p.hora_partido);
        const fecha = formatearFecha(p.fecha_partido);
        const local = p.equipo_local_nombre || "Local";
        const visit = p.equipo_visitante_nombre || "Visitante";
        const cat = p.evento_nombre || p.campeonato_nombre || "";
        const cancha = p.cancha ? `· ${p.cancha}` : "";
        return `
        <div class="dash-encuentro-card">
          <div class="dash-encuentro-fecha">${fecha} ${hora ? "· " + hora : ""} ${cancha}</div>
          <div class="dash-encuentro-equipos">${local} <span class="dash-vs">vs</span> ${visit}</div>
          <div class="dash-encuentro-meta">${cat} ${num}</div>
        </div>`;
      })
      .join("");
  }

  function renderMorosos(lista) {
    const cont = document.getElementById("dash-morosos-lista");
    if (!cont) return;

    if (!lista || !lista.length) {
      cont.innerHTML = '<p class="dash-empty-msg">Sin equipos morosos.</p>';
      return;
    }

    cont.innerHTML = `
      <table class="dash-table">
        <thead><tr><th>Equipo</th><th>Campeonato</th><th class="text-right">Saldo</th></tr></thead>
        <tbody>
          ${lista
            .map(
              (m) => `
            <tr>
              <td>${m.equipo_nombre || m.nombre || "—"}</td>
              <td>${m.campeonato_nombre || "—"}</td>
              <td class="text-right text-danger">-$${fmt(Math.abs(m.saldo || 0))}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  async function cargarDashboard() {
    const cont = document.getElementById("dash-organizador-root");
    if (!cont) return;

    try {
      const data = await window.ApiClient.get("/finanzas/dashboard");
      if (!data?.ok) throw new Error(data?.error || "Error al cargar");

      setKpi("dash-kpi-torneos", fmtNum(data.kpis?.torneos_activos));
      setKpi("dash-kpi-equipos", fmtNum(data.kpis?.equipos_inscritos));
      setKpi("dash-kpi-jugadores", fmtNum(data.kpis?.jugadores_registrados));
      setKpi("dash-kpi-ingresos", `$${fmt(data.kpis?.ingresos_mes)}`);

      renderPlanBadge(data.plan);
      renderChart(data.ingresos_por_concepto);
      renderEncuentros(data.proximos_encuentros);
      renderMorosos(data.morosos);

      const loading = document.getElementById("dash-loading");
      if (loading) loading.style.display = "none";
      cont.style.display = "";
    } catch (err) {
      console.error("dashboardOrganizador:", err);
      const loading = document.getElementById("dash-loading");
      if (loading) loading.textContent = "No se pudo cargar el dashboard.";
    }
  }

  function init() {
    if (!window.location.pathname.includes("portal-admin.html")) return;
    if (!window.Chart) {
      console.warn("Chart.js no disponible");
    }
    cargarDashboard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.DashboardOrganizador = { cargarDashboard };
})();
