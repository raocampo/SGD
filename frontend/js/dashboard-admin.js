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
  let _orgData = []; // caché local de organizadores para el modal

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

    _orgData = organizadores;

    tbody.innerHTML = organizadores
      .map((o) => {
        const planLabel = PLAN_LABEL[o.plan_codigo] || o.plan_codigo || "free";
        const planEstado = String(o.plan_estado || "activo").toLowerCase();
        const estado = planEstado === "pendiente_pago"
          ? '<span class="badge-estado-pendiente">Pago pendiente</span>'
          : (o.activo ? '<span class="badge-estado-activo">Activo</span>' : '<span class="badge-estado-inactivo">Inactivo</span>');
        const torneos = Number(o.torneos_activos || 0);
        return `
        <tr>
          <td>${o.nombre || "—"}<br><small style="color:#94a3b8;font-size:11px;">${o.email || ""}</small></td>
          <td><span class="badge-plan-min badge-plan-${o.plan_codigo || 'free'}">${planLabel}</span></td>
          <td>${estado}</td>
          <td class="text-center">${torneos}</td>
          <td>${formatearFecha(o.created_at)}</td>
          <td class="text-center">
            <button class="btn-gestionar-org" data-id="${o.id}"
              style="background:#3498db; color:#fff; border:none; border-radius:6px; padding:4px 10px; font-size:11px; font-weight:700; cursor:pointer;">
              <i class="fas fa-edit"></i> Gestionar
            </button>
          </td>
        </tr>`;
      })
      .join("");

    // Enlazar botones de gestión
    tbody.querySelectorAll(".btn-gestionar-org").forEach((btn) => {
      btn.addEventListener("click", () => abrirModalOrg(Number(btn.dataset.id)));
    });
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

  function renderFormasPago(formas) {
    const wrap = document.getElementById("dash-admin-pago-wrap");
    const btn = document.getElementById("dash-admin-pago-guardar");
    if (!wrap) return;

    const tf = formas?.transferencia || {};
    const ef = formas?.efectivo || {};

    const pp  = formas?.paypal  || {};
    const tc  = formas?.tarjeta || {};

    wrap.innerHTML = `
      <div class="dash-pago-grid" id="dash-admin-pago-fields">

        <div class="dash-pago-group dash-pago-full">
          <label>WhatsApp para confirmar pagos <small style="color:#94a3b8;">(con código de país, sin +)</small></label>
          <input type="text" id="pago-whatsapp" value="${formas?.whatsapp || ""}" placeholder="Ej: 593982413081" maxlength="20" />
        </div>

        <!-- Tarjeta de crédito / débito -->
        <div class="dash-pago-group dash-pago-full" style="border-top:1.5px solid #e2e8f0;padding-top:14px;margin-top:4px;">
          <div class="dash-pago-check-row">
            <input type="checkbox" id="pago-tc-activo" ${tc.activo ? "checked" : ""} />
            <label for="pago-tc-activo"><i class="fas fa-credit-card" style="color:#7c3aed;"></i> Habilitar pago con tarjeta de crédito / débito</label>
          </div>
        </div>
        <div class="dash-pago-group">
          <label>Plataforma de cobro</label>
          <input type="text" id="pago-tc-plataforma" value="${tc.plataforma || "Payphone"}" placeholder="Ej: Payphone, Stripe" maxlength="50" />
        </div>
        <div class="dash-pago-group">
          <label>Enlace de pago con tarjeta</label>
          <input type="text" id="pago-tc-enlace" value="${tc.enlace || ""}" placeholder="Ej: https://pay.payphone.com/..." maxlength="300" />
        </div>
        <div class="dash-pago-group dash-pago-full">
          <label>Instrucciones para pago con tarjeta</label>
          <textarea id="pago-tc-instrucciones" maxlength="300" placeholder="Ej: Haz clic en el botón para pagar de forma segura.">${tc.instrucciones || ""}</textarea>
        </div>

        <!-- PayPal -->
        <div class="dash-pago-group dash-pago-full" style="border-top:1.5px solid #e2e8f0;padding-top:14px;margin-top:4px;">
          <div class="dash-pago-check-row">
            <input type="checkbox" id="pago-pp-activo" ${pp.activo ? "checked" : ""} />
            <label for="pago-pp-activo"><i class="fab fa-paypal" style="color:#003087;"></i> Habilitar pago con PayPal</label>
          </div>
        </div>
        <div class="dash-pago-group">
          <label>Enlace PayPal.me o correo PayPal</label>
          <input type="text" id="pago-pp-enlace" value="${pp.enlace || ""}" placeholder="Ej: paypal.me/tuusuario o pagos@correo.com" maxlength="200" />
        </div>
        <div class="dash-pago-group dash-pago-full">
          <label>Instrucciones para pago con PayPal</label>
          <textarea id="pago-pp-instrucciones" maxlength="300" placeholder='Ej: Envía el pago como "Amigos y familiares"...'>${pp.instrucciones || ""}</textarea>
        </div>

        <!-- Transferencia bancaria -->
        <div class="dash-pago-group dash-pago-full" style="border-top:1.5px solid #e2e8f0;padding-top:14px;margin-top:4px;">
          <label style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.4px;"><i class="fas fa-university" style="color:#3498db;"></i> Transferencia / Depósito bancario</label>
        </div>
        <div class="dash-pago-group">
          <label>Banco</label>
          <input type="text" id="pago-tf-banco" value="${tf.banco || ""}" placeholder="Ej: Banco Pichincha" maxlength="80" />
        </div>
        <div class="dash-pago-group">
          <label>Tipo de cuenta</label>
          <select id="pago-tf-tipo">
            <option value="Ahorro" ${tf.tipo === "Ahorro" ? "selected" : ""}>Ahorro</option>
            <option value="Corriente" ${tf.tipo === "Corriente" ? "selected" : ""}>Corriente</option>
          </select>
        </div>
        <div class="dash-pago-group">
          <label>Número de cuenta</label>
          <input type="text" id="pago-tf-cuenta" value="${tf.cuenta || ""}" placeholder="Ej: 2200123456" maxlength="30" />
        </div>
        <div class="dash-pago-group">
          <label>Titular de la cuenta</label>
          <input type="text" id="pago-tf-titular" value="${tf.titular || ""}" placeholder="Ej: Loja Torneos &amp; Competencias" maxlength="100" />
        </div>
        <div class="dash-pago-group">
          <label>Cédula / RUC del titular</label>
          <input type="text" id="pago-tf-cedula" value="${tf.cedula || ""}" placeholder="Ej: 1105001234001" maxlength="20" />
        </div>

        <!-- Efectivo -->
        <div class="dash-pago-group dash-pago-full" style="border-top:1.5px solid #e2e8f0;padding-top:14px;margin-top:4px;">
          <div class="dash-pago-check-row">
            <input type="checkbox" id="pago-ef-activo" ${ef.activo ? "checked" : ""} />
            <label for="pago-ef-activo"><i class="fas fa-money-bill-wave" style="color:#16a34a;"></i> Habilitar opción de pago en efectivo</label>
          </div>
        </div>
        <div class="dash-pago-group dash-pago-full">
          <label>Instrucciones para pago en efectivo</label>
          <textarea id="pago-ef-instrucciones" maxlength="300" placeholder="Ej: Coordina la entrega de efectivo por WhatsApp.">${ef.instrucciones || ""}</textarea>
        </div>

        <!-- Instrucciones generales -->
        <div class="dash-pago-group dash-pago-full" style="border-top:1.5px solid #e2e8f0;padding-top:14px;margin-top:4px;">
          <label>Instrucciones generales (se muestran al final del modal de pago)</label>
          <textarea id="pago-instrucciones-extra" maxlength="400" placeholder="Ej: Envía el comprobante de pago al WhatsApp indicado para activar tu cuenta.">${formas?.instrucciones_extra || ""}</textarea>
        </div>

      </div>`;

    if (btn) btn.style.display = "";
  }

  async function guardarFormasPago() {
    const btn = document.getElementById("dash-admin-pago-guardar");
    const msg = document.getElementById("dash-admin-pago-msg");

    const campos = {
      pago_whatsapp:               document.getElementById("pago-whatsapp")?.value?.trim() || "",
      pago_tarjeta_activo:         document.getElementById("pago-tc-activo")?.checked ? "true" : "false",
      pago_tarjeta_plataforma:     document.getElementById("pago-tc-plataforma")?.value?.trim() || "Payphone",
      pago_tarjeta_enlace:         document.getElementById("pago-tc-enlace")?.value?.trim() || "",
      pago_tarjeta_instrucciones:  document.getElementById("pago-tc-instrucciones")?.value?.trim() || "",
      pago_paypal_activo:          document.getElementById("pago-pp-activo")?.checked ? "true" : "false",
      pago_paypal_enlace:          document.getElementById("pago-pp-enlace")?.value?.trim() || "",
      pago_paypal_instrucciones:   document.getElementById("pago-pp-instrucciones")?.value?.trim() || "",
      pago_transferencia_banco:    document.getElementById("pago-tf-banco")?.value?.trim() || "",
      pago_transferencia_tipo:     document.getElementById("pago-tf-tipo")?.value || "Ahorro",
      pago_transferencia_cuenta:   document.getElementById("pago-tf-cuenta")?.value?.trim() || "",
      pago_transferencia_titular:  document.getElementById("pago-tf-titular")?.value?.trim() || "",
      pago_transferencia_cedula:   document.getElementById("pago-tf-cedula")?.value?.trim() || "",
      pago_efectivo_activo:        document.getElementById("pago-ef-activo")?.checked ? "true" : "false",
      pago_efectivo_instrucciones: document.getElementById("pago-ef-instrucciones")?.value?.trim() || "",
      pago_instrucciones_extra:    document.getElementById("pago-instrucciones-extra")?.value?.trim() || "",
    };

    try {
      if (btn) btn.disabled = true;
      if (msg) msg.textContent = "";
      await window.ApiClient.put("/auth/admin/formas-pago", { formas: campos });
      if (msg) { msg.style.color = "#22c55e"; msg.textContent = "Formas de pago guardadas."; }
      setTimeout(() => { if (msg) msg.textContent = ""; }, 3000);
    } catch (err) {
      if (msg) { msg.style.color = "#ef4444"; msg.textContent = err.message || "Error al guardar"; }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function cargarFormasPago() {
    try {
      const data = await window.ApiClient.get("/auth/admin/formas-pago");
      if (data?.ok) renderFormasPago(data.formas);
    } catch (err) {
      console.warn("No se pudo cargar formas de pago:", err.message);
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
      await cargarFormasPago();

      const loading = document.getElementById("dash-admin-loading");
      if (loading) loading.style.display = "none";
      cont.style.display = "";

      const btn = document.getElementById("dash-admin-precios-guardar");
      if (btn) btn.addEventListener("click", guardarPrecios);
      const btnPago = document.getElementById("dash-admin-pago-guardar");
      if (btnPago) btnPago.addEventListener("click", guardarFormasPago);
    } catch (err) {
      console.error("dashboardAdmin:", err);
      const loading = document.getElementById("dash-admin-loading");
      if (loading) loading.textContent = "No se pudo cargar el dashboard.";
    }
  }

  function abrirModalOrg(id) {
    const org = _orgData.find((o) => o.id === id);
    if (!org) return;

    const modal = document.getElementById("modal-org-estado");
    if (!modal) return;

    document.getElementById("modal-org-nombre").textContent = org.nombre || "—";
    document.getElementById("modal-org-email").textContent = org.email || "";
    document.getElementById("modal-org-plan").value = org.plan_codigo || "free";

    const planEstado = String(org.plan_estado || "activo").toLowerCase();
    const radio = document.querySelector(`input[name="modal-org-estado-radio"][value="${planEstado}"]`);
    if (radio) radio.checked = true;

    const msg = document.getElementById("modal-org-msg");
    if (msg) msg.textContent = "";

    modal.style.display = "flex";
    modal._orgId = id;

    document.getElementById("modal-org-cancelar").onclick = () => { modal.style.display = "none"; };
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };
    document.getElementById("modal-org-guardar").onclick = () => guardarEstadoOrg(modal, org);
  }

  async function guardarEstadoOrg(modal, org) {
    const planCodigo = document.getElementById("modal-org-plan").value;
    const planEstado = document.querySelector('input[name="modal-org-estado-radio"]:checked')?.value;
    const msg = document.getElementById("modal-org-msg");
    const btn = document.getElementById("modal-org-guardar");

    if (!planEstado) return;

    const activo = planEstado !== "suspendido";

    try {
      if (btn) btn.disabled = true;
      if (msg) { msg.style.color = "#64748b"; msg.textContent = "Guardando..."; }

      await window.ApiClient.put(`/usuarios/${org.id}`, {
        plan_codigo: planCodigo,
        plan_estado: planEstado,
        activo,
      });

      if (msg) { msg.style.color = "#27ae60"; msg.textContent = "¡Cambios guardados!"; }

      // Actualizar caché local y re-renderizar fila
      const idx = _orgData.findIndex((o) => o.id === org.id);
      if (idx !== -1) {
        _orgData[idx] = { ..._orgData[idx], plan_codigo: planCodigo, plan_estado: planEstado, activo };
        renderTablaOrgs(_orgData);
      }

      setTimeout(() => { modal.style.display = "none"; }, 900);
    } catch (err) {
      if (msg) { msg.style.color = "#dc2626"; msg.textContent = err.message || "Error al guardar"; }
    } finally {
      if (btn) btn.disabled = false;
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
