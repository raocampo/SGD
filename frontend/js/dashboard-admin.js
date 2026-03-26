// frontend/js/dashboard-admin.js
(function () {
  const PLAN_COLORS = {
    demo: "#94a3b8",
    free: "#60a5fa",
    base: "#34d399",
    competencia: "#f59e0b",
    premium: "#8b5cf6",
  };
  const PLAN_LABEL = {
    demo: "Demo",
    free: "Free",
    base: "Base",
    competencia: "Competencia",
    premium: "Premium",
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
    const d = new Date(f);
    return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
  }

  function setKpi(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  }

  function renderChartPlanes(porPlan) {
    const canvas = document.getElementById("dash-admin-chart-planes");
    if (!canvas) return;

    const filas = (porPlan || []).filter((r) => Number(r.total) > 0);

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    if (!filas.length) {
      const wrapper = canvas.parentElement;
      if (wrapper) wrapper.innerHTML = '<p class="dash-empty-msg">Sin organizadores registrados.</p>';
      return;
    }

    const labels = filas.map((r) => PLAN_LABEL[r.plan_codigo] || r.plan_codigo);
    const data = filas.map((r) => Number(r.total));
    const colors = filas.map((r) => PLAN_COLORS[r.plan_codigo] || "#9ca3af");

    chartInstance = new window.Chart(canvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: "#fff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { font: { size: 11 }, padding: 10 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed} organizadores`,
            },
          },
        },
      },
    });
  }

  function renderTablaOrgs(organizadores) {
    const tbody = document.getElementById("dash-admin-orgs-tbody");
    if (!tbody) return;

    if (!organizadores || !organizadores.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="dash-empty-msg">Sin organizadores registrados.</td></tr>';
      return;
    }

    tbody.innerHTML = organizadores
      .map((o) => {
        const planLabel = PLAN_LABEL[o.plan_codigo] || o.plan_codigo || "free";
        const estado = o.activo ? '<span class="badge-estado-activo">Activo</span>' : '<span class="badge-estado-inactivo">Inactivo</span>';
        const torneos = Number(o.torneos_activos || 0);
        return `
        <tr>
          <td>${o.nombre || "—"}</td>
          <td><span class="badge-plan-min badge-plan-${o.plan_codigo || 'free'}">${planLabel}</span></td>
          <td>${estado}</td>
          <td class="text-center">${torneos}</td>
          <td>${formatearFecha(o.created_at)}</td>
        </tr>`;
      })
      .join("");
  }

  function renderPreciosPlanes(planes) {
    const wrap = document.getElementById("dash-admin-precios-wrap");
    const btn = document.getElementById("dash-admin-precios-guardar");
    if (!wrap) return;

    if (!planes || !planes.length) {
      wrap.innerHTML = '<p class="dash-empty-msg">Sin planes disponibles.</p>';
      return;
    }

    wrap.innerHTML = `
      <div class="dash-precios-grid" id="dash-admin-precios-inputs">
        ${planes.map((p) => `
          <div class="dash-precio-item">
            <span class="precio-badge badge-plan-${p.codigo}">${p.nombre}</span>
            <label>Precio mensual (USD)</label>
            <input
              type="number"
              min="0"
              step="1"
              value="${p.precio_mensual}"
              data-plan-codigo="${p.codigo}"
              id="precio-plan-${p.codigo}"
            />
          </div>
        `).join("")}
      </div>`;

    if (btn) btn.style.display = "";
  }

  async function guardarPrecios() {
    const btn = document.getElementById("dash-admin-precios-guardar");
    const msg = document.getElementById("dash-admin-precios-msg");
    const inputs = document.querySelectorAll("#dash-admin-precios-inputs input[data-plan-codigo]");
    if (!inputs.length) return;

    const precios = {};
    for (const input of inputs) {
      const codigo = input.dataset.planCodigo;
      const valor = Number(input.value);
      if (!Number.isFinite(valor) || valor < 0) {
        if (msg) { msg.style.color = "#ef4444"; msg.textContent = `Precio inválido para ${codigo}`; }
        return;
      }
      precios[codigo] = valor;
    }

    try {
      if (btn) btn.disabled = true;
      if (msg) msg.textContent = "";
      await window.ApiClient.put("/auth/admin/planes/precios", { precios });
      if (msg) { msg.style.color = "#22c55e"; msg.textContent = "Precios guardados correctamente."; }
      setTimeout(() => { if (msg) msg.textContent = ""; }, 3000);
    } catch (err) {
      if (msg) { msg.style.color = "#ef4444"; msg.textContent = err.message || "Error al guardar"; }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function cargarPrecios() {
    try {
      const data = await window.ApiClient.get("/auth/admin/planes/precios");
      if (data?.ok) renderPreciosPlanes(data.planes);
    } catch (err) {
      console.warn("No se pudo cargar precios:", err.message);
    }
  }

  async function cargarDashboard() {
    const cont = document.getElementById("dash-admin-root");
    if (!cont) return;

    try {
      const data = await window.ApiClient.get("/auth/admin/dashboard");
      if (!data?.ok) throw new Error(data?.error || "Error al cargar");

      setKpi("dash-admin-kpi-orgs", fmtNum(data.kpis?.organizadores_activos));
      setKpi("dash-admin-kpi-nuevos", fmtNum(data.kpis?.nuevos_este_mes));
      setKpi("dash-admin-kpi-mrr", `$${fmt(data.kpis?.mrr_estimado)}`);
      setKpi("dash-admin-kpi-plan-popular", PLAN_LABEL[data.kpis?.plan_popular] || data.kpis?.plan_popular || "—");
      setKpi("dash-admin-global-camps", fmtNum(data.global?.total_campeonatos));
      setKpi("dash-admin-global-equipos", fmtNum(data.global?.total_equipos));
      setKpi("dash-admin-global-jugadores", fmtNum(data.global?.total_jugadores));

      renderChartPlanes(data.por_plan);
      renderTablaOrgs(data.organizadores);
      await cargarPrecios();

      const loading = document.getElementById("dash-admin-loading");
      if (loading) loading.style.display = "none";
      cont.style.display = "";

      const btn = document.getElementById("dash-admin-precios-guardar");
      if (btn) btn.addEventListener("click", guardarPrecios);
    } catch (err) {
      console.error("dashboardAdmin:", err);
      const loading = document.getElementById("dash-admin-loading");
      if (loading) loading.textContent = "No se pudo cargar el dashboard.";
    }
  }

  function init() {
    if (!window.location.pathname.includes("admin.html")) return;
    const user = window.Auth?.getUser?.();
    const rol = String(user?.rol || "").toLowerCase();
    if (rol !== "administrador") {
      const loading = document.getElementById("dash-admin-loading");
      const forbidden = document.getElementById("dash-admin-forbidden");
      if (loading) loading.style.display = "none";
      if (forbidden) forbidden.style.display = "";
      return;
    }
    if (!window.Chart) {
      console.warn("Chart.js no disponible en dashboard-admin.js");
    }
    cargarDashboard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.DashboardAdmin = { cargarDashboard };
})();
