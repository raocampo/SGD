(function () {
  const PRICE_CATALOG_FALLBACK = {
    free: { codigo: 'free', nombre: 'Plan Free', familia: 'pruebas', nivel: 'free', registrable: true, plan_registro: 'free', periodicidad: '/ gratis', precio_mensual: 0 },
    mensual_base: { codigo: 'mensual_base', nombre: 'Básico mensual', familia: 'mensual', nivel: 'base', registrable: true, plan_registro: 'base', periodicidad: '/ mes', precio_mensual: 20 },
    mensual_competencia: { codigo: 'mensual_competencia', nombre: 'Competencia mensual', familia: 'mensual', nivel: 'competencia', registrable: true, plan_registro: 'competencia', periodicidad: '/ mes', precio_mensual: 60 },
    mensual_premium: { codigo: 'mensual_premium', nombre: 'Premium mensual', familia: 'mensual', nivel: 'premium', registrable: true, plan_registro: 'premium', periodicidad: '/ mes', precio_mensual: 150 },
    campeonato_base: { codigo: 'campeonato_base', nombre: 'Básico por campeonato', familia: 'campeonato', nivel: 'base', registrable: false, plan_registro: null, periodicidad: '/ campeonato', precio_mensual: 200 },
    campeonato_competencia: { codigo: 'campeonato_competencia', nombre: 'Competencia por campeonato', familia: 'campeonato', nivel: 'competencia', registrable: false, plan_registro: null, periodicidad: '/ campeonato', precio_mensual: 500 },
    campeonato_premium: { codigo: 'campeonato_premium', nombre: 'Premium por campeonato', familia: 'campeonato', nivel: 'premium', registrable: false, plan_registro: null, periodicidad: '/ campeonato', precio_mensual: 1500 },
    anual_base: { codigo: 'anual_base', nombre: 'Básico anual', familia: 'anual', nivel: 'base', registrable: false, plan_registro: null, periodicidad: '/ año', precio_mensual: 49 },
    anual_competencia: { codigo: 'anual_competencia', nombre: 'Competencia anual', familia: 'anual', nivel: 'competencia', registrable: false, plan_registro: null, periodicidad: '/ año', precio_mensual: 500 },
    anual_premium: { codigo: 'anual_premium', nombre: 'Premium anual', familia: 'anual', nivel: 'premium', registrable: false, plan_registro: null, periodicidad: '/ año', precio_mensual: 1000 },
  };

  let catalogByCode = { ...PRICE_CATALOG_FALLBACK };
  let formasPagoCache = null;
  let planActual = { codigo: '', nombre: '', precio: '', planRegistro: null, registrable: false };

  function setupNav() {
    const toggle = document.getElementById('ltc-nav-toggle');
    const nav = document.getElementById('ltc-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
    nav.querySelectorAll('a').forEach((lnk) => lnk.addEventListener('click', () => nav.classList.remove('open')));
  }

  function formatPrice(value, suffix) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      return `A convenir <span>${suffix || ''}</span>`;
    }
    return `$${amount.toLocaleString('es-EC')} <span>${suffix || ''}</span>`;
  }

  function applyPricingToElements() {
    Object.values(catalogByCode).forEach((plan) => {
      const el = document.querySelector(`[data-price-code="${plan.codigo}"]`) || document.getElementById(`precio-plan-${plan.codigo}`);
      if (el) el.innerHTML = formatPrice(plan.precio_mensual, plan.periodicidad || '');
    });

    document.querySelectorAll('[data-price-family-min]').forEach((el) => {
      const familia = String(el.dataset.priceFamilyMin || '').trim().toLowerCase();
      const items = Object.values(catalogByCode).filter((item) => item.familia === familia);
      const positivos = items.map((item) => Number(item.precio_mensual)).filter((v) => Number.isFinite(v) && v > 0);
      const minimo = positivos.length ? Math.min(...positivos) : 0;
      const suffix = items[0]?.periodicidad || '';
      el.innerHTML = formatPrice(minimo, suffix).replace('$', 'Desde $');
    });
  }

  async function fetchPublicPrices() {
    try {
      const base = (window.API_BASE_URL || '').replace(/\/$/, '');
      const resp = await fetch(`${base}/auth/planes/precios`);
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data?.ok || !Array.isArray(data.planes)) return;
      catalogByCode = data.planes.reduce((acc, item) => {
        acc[item.codigo] = item;
        return acc;
      }, { ...PRICE_CATALOG_FALLBACK });
      applyPricingToElements();
    } catch {
      applyPricingToElements();
    }
  }

  function buildWhatsappHref(whatsapp, planNombre, precioTxt) {
    const wa = String(whatsapp || '').trim();
    if (!wa) return '';
    const msg = encodeURIComponent(`Hola, quiero contratar ${planNombre} (${precioTxt}). ¿Me ayudas con el proceso?`);
    return `https://wa.me/${wa}?text=${msg}`;
  }

  async function cargarFormasPago() {
    if (formasPagoCache) return formasPagoCache;
    try {
      const base = (window.API_BASE_URL || '').replace(/\/$/, '');
      const resp = await fetch(`${base}/auth/formas-pago`);
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data?.ok) formasPagoCache = data.formas;
      return formasPagoCache;
    } catch {
      return null;
    }
  }

  function renderMetodosPago(formas) {
    const wrap = document.getElementById('ltc-pago-metodos-wrap');
    if (!wrap) return;
    const tf = formas?.transferencia;
    const ef = formas?.efectivo;
    const pp = formas?.paypal;
    const tc = formas?.tarjeta;
    const instrExtra = formas?.instrucciones_extra || '';
    const whatsapp = formas?.whatsapp || '';

    let html = '<p style="font-size:11px;color:#94a3b8;margin:0 0 10px;text-transform:uppercase;font-weight:700;letter-spacing:.5px;">Elige tu forma de pago</p>';

    if (tc?.activo) {
      const plat = tc.plataforma || 'Payphone';
      const isPP = /payphone/i.test(plat);
      const iconoCls = isPP ? 'fas fa-mobile-alt' : 'fas fa-credit-card';
      html += `
      <div class="ltc-pago-metodo ltc-pago-metodo-tarjeta">
        <div class="ltc-pago-metodo-titulo"><i class="${iconoCls}"></i> Tarjeta de crédito / débito</div>
        <p style="font-size:12.5px;color:#475569;margin:0 0 10px;">${tc.instrucciones || ''}</p>
        ${tc.enlace ? `<a class="ltc-pago-link-btn ltc-pago-link-btn-tarjeta" href="${tc.enlace}" target="_blank" rel="noopener noreferrer"><i class="fas fa-credit-card"></i> Pagar con ${plat}</a>` : '<p style="font-size:12px;color:#94a3b8;margin:0;">Contacta por WhatsApp para recibir el enlace de pago.</p>'}
      </div>`;
    }

    if (pp?.activo) {
      const esLink = pp.enlace && (pp.enlace.startsWith('http') || pp.enlace.startsWith('paypal.me'));
      const href = esLink ? (pp.enlace.startsWith('http') ? pp.enlace : `https://${pp.enlace}`) : (pp.enlace ? `mailto:${pp.enlace}` : '#');
      html += `
      <div class="ltc-pago-metodo ltc-pago-metodo-paypal">
        <div class="ltc-pago-metodo-titulo"><i class="fab fa-paypal"></i> PayPal</div>
        <p style="font-size:12.5px;color:#475569;margin:0 0 10px;">${pp.instrucciones || ''}</p>
        ${pp.enlace ? `<a class="ltc-pago-link-btn ltc-pago-link-btn-paypal" href="${href}" target="_blank" rel="noopener noreferrer"><i class="fab fa-paypal"></i> Pagar con PayPal</a>` : '<p style="font-size:12px;color:#94a3b8;margin:0;">Consulta el correo PayPal por WhatsApp.</p>'}
      </div>`;
    }

    if (tf?.cuenta) {
      html += `
      <div class="ltc-pago-metodo">
        <div class="ltc-pago-metodo-titulo"><i class="fas fa-university"></i> Transferencia / Depósito bancario</div>
        <div class="ltc-pago-metodo-fila"><span class="ltc-pago-metodo-lbl">Banco</span><span class="ltc-pago-metodo-val"><strong>${tf.banco || '—'}</strong></span></div>
        <div class="ltc-pago-metodo-fila"><span class="ltc-pago-metodo-lbl">Cuenta</span><span class="ltc-pago-metodo-val"><strong>${tf.cuenta}</strong></span></div>
        <div class="ltc-pago-metodo-fila"><span class="ltc-pago-metodo-lbl">Tipo</span><span class="ltc-pago-metodo-val">${tf.tipo || 'Ahorro'}</span></div>
        <div class="ltc-pago-metodo-fila"><span class="ltc-pago-metodo-lbl">Titular</span><span class="ltc-pago-metodo-val">${tf.titular || '—'}</span></div>
        ${tf.cedula ? `<div class="ltc-pago-metodo-fila"><span class="ltc-pago-metodo-lbl">Cédula / RUC</span><span class="ltc-pago-metodo-val">${tf.cedula}</span></div>` : ''}
      </div>`;
    }

    if (ef?.activo) {
      html += `
      <div class="ltc-pago-metodo">
        <div class="ltc-pago-metodo-titulo"><i class="fas fa-money-bill-wave"></i> Pago en efectivo</div>
        <p style="font-size:12.5px;color:#0f172a;margin:0;">${ef.instrucciones || 'Coordina por WhatsApp.'}</p>
      </div>`;
    }

    if (whatsapp) {
      const msg = encodeURIComponent(`Hola, quiero contratar ${planActual.nombre} (${planActual.precio}). ¿Me ayudas con el proceso?`);
      html += `<a class="ltc-pago-whatsapp-btn" href="https://wa.me/${whatsapp}?text=${msg}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> Consultar o confirmar pago por WhatsApp</a>`;
    }

    if (instrExtra) {
      html += `<div class="ltc-pago-instrucciones"><i class="fas fa-info-circle"></i><span>${instrExtra}</span></div>`;
    }

    wrap.innerHTML = html;
  }

  function configurarAccionModalPrincipal(formas) {
    const btn = document.getElementById('ltc-pago-continuar-btn');
    if (!btn) return;
    if (planActual.registrable && planActual.planRegistro) {
      btn.href = `register.html?plan=${planActual.planRegistro}`;
      btn.innerHTML = '<i class="fas fa-user-plus"></i> Continuar al registro';
      btn.target = '_blank';
      btn.rel = 'noopener noreferrer';
      return;
    }
    btn.href = buildWhatsappHref(formas?.whatsapp, planActual.nombre, planActual.precio) || 'mailto:lojatorneosycompetencia@gmail.com';
    btn.innerHTML = '<i class="fab fa-whatsapp"></i> Solicitar por WhatsApp';
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
  }

  async function abrirModalPago(planCodigo) {
    const plan = catalogByCode[planCodigo] || PRICE_CATALOG_FALLBACK[planCodigo];
    if (!plan) return;

    const modal = document.getElementById('ltc-pago-modal');
    const titleEl = document.getElementById('ltc-pago-modal-title');
    const nombreEl = document.getElementById('ltc-pago-plan-nombre-txt');
    const precioEl = document.getElementById('ltc-pago-plan-precio-txt');
    const wrap = document.getElementById('ltc-pago-metodos-wrap');
    if (!modal || !titleEl || !nombreEl || !precioEl || !wrap) return;

    const precioTxt = (document.querySelector(`[data-price-code="${planCodigo}"]`) || document.getElementById(`precio-plan-${planCodigo}`))?.textContent?.trim() || formatPrice(plan.precio_mensual, plan.periodicidad || '').replace(/<[^>]+>/g, '');
    planActual = {
      codigo: planCodigo,
      nombre: plan.nombre,
      precio: precioTxt,
      registrable: plan.registrable === true,
      planRegistro: plan.plan_registro || null,
    };

    titleEl.textContent = plan.registrable ? `Pagar ${plan.nombre}` : `Solicitar ${plan.nombre}`;
    nombreEl.textContent = plan.nombre;
    precioEl.textContent = precioTxt;
    wrap.innerHTML = '<p class="ltc-pago-cargando"><i class="fas fa-spinner fa-spin"></i> Cargando formas de pago...</p>';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const formas = await cargarFormasPago();
    renderMetodosPago(formas);
    configurarAccionModalPrincipal(formas);
  }

  function cerrarModalPago() {
    const modal = document.getElementById('ltc-pago-modal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  function bindModalTriggers() {
    document.querySelectorAll('.ltc-pricing-btn-pago').forEach((btn) => {
      btn.addEventListener('click', () => abrirModalPago(btn.dataset.plan));
    });

    document.getElementById('ltc-pago-modal-close')?.addEventListener('click', cerrarModalPago);
    document.getElementById('ltc-pago-cancelar-btn')?.addEventListener('click', cerrarModalPago);
    document.getElementById('ltc-pago-modal')?.addEventListener('click', function (e) {
      if (e.target === this) cerrarModalPago();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupNav();
    applyPricingToElements();
    fetchPublicPrices();
    bindModalTriggers();
  });
})();
