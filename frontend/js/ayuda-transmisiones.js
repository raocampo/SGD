// frontend/js/ayuda-transmisiones.js
// Manual interactivo de transmisiones: pasos con avance, pestañas,
// calculadora de internet, buscador de preguntas y lista imprimible.
// El avance se guarda solo en este navegador (localStorage, opcional).

(() => {
  const CLAVE_PASOS = "sgd_ayuda_tx_pasos";
  const CLAVE_CHECKLIST = "sgd_ayuda_tx_checklist";
  const CLAVE_CALC = "sgd_ayuda_tx_calc";

  function leer(clave, porDefecto) {
    try {
      const raw = localStorage.getItem(clave);
      return raw ? JSON.parse(raw) : porDefecto;
    } catch (_) {
      return porDefecto;
    }
  }

  function guardar(clave, valor) {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
    } catch (_) {
      /* sin almacenamiento: la página funciona igual */
    }
  }

  // ── Pasos ────────────────────────────────────────────────────────────
  function abrirPaso(li, abrir) {
    li.classList.toggle("is-open", abrir);
    li.querySelector(".ayt-paso-head")?.setAttribute("aria-expanded", abrir ? "true" : "false");
  }

  function actualizarProgreso() {
    const pasos = Array.from(document.querySelectorAll(".ayt-paso"));
    const hechos = pasos.filter((li) => li.querySelector("[data-paso-check]")?.checked).length;
    pasos.forEach((li) => {
      li.classList.toggle("is-done", !!li.querySelector("[data-paso-check]")?.checked);
    });
    const relleno = document.getElementById("ayt-progreso-relleno");
    const texto = document.getElementById("ayt-progreso-texto");
    if (relleno) relleno.style.width = `${pasos.length ? Math.round((hechos / pasos.length) * 100) : 0}%`;
    if (texto) {
      texto.textContent = hechos === pasos.length
        ? "¡Listo! Todos los pasos completados"
        : `${hechos} de ${pasos.length} pasos`;
    }
  }

  function iniciarPasos() {
    const estado = leer(CLAVE_PASOS, {});
    const pasos = Array.from(document.querySelectorAll(".ayt-paso"));

    pasos.forEach((li) => {
      const check = li.querySelector("[data-paso-check]");
      if (check) check.checked = estado[check.dataset.pasoCheck] === true;

      li.querySelector(".ayt-paso-head")?.addEventListener("click", () => {
        abrirPaso(li, !li.classList.contains("is-open"));
      });

      check?.addEventListener("change", () => {
        const actual = leer(CLAVE_PASOS, {});
        actual[check.dataset.pasoCheck] = check.checked;
        guardar(CLAVE_PASOS, actual);
        actualizarProgreso();
        // Al completar un paso, se cierra y se abre el siguiente pendiente.
        if (check.checked) {
          abrirPaso(li, false);
          const siguiente = pasos.find((p) => !p.querySelector("[data-paso-check]")?.checked);
          if (siguiente) {
            abrirPaso(siguiente, true);
            siguiente.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }
      });
    });

    // Abre el primer paso pendiente (o el primero).
    const pendiente = pasos.find((p) => !p.querySelector("[data-paso-check]")?.checked) || pasos[0];
    pasos.forEach((p) => abrirPaso(p, p === pendiente));

    document.getElementById("ayt-reiniciar-pasos")?.addEventListener("click", () => {
      guardar(CLAVE_PASOS, {});
      pasos.forEach((p, idx) => {
        const check = p.querySelector("[data-paso-check]");
        if (check) check.checked = false;
        abrirPaso(p, idx === 0);
      });
      actualizarProgreso();
    });

    actualizarProgreso();
  }

  // ── Pestañas ─────────────────────────────────────────────────────────
  function iniciarPestanas() {
    document.querySelectorAll(".ayt-tabs").forEach((grupo) => {
      const seccion = grupo.closest(".ayt-seccion");
      grupo.querySelectorAll(".ayt-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
          grupo.querySelectorAll(".ayt-tab").forEach((t) => {
            t.classList.toggle("active", t === tab);
            t.setAttribute("aria-selected", t === tab ? "true" : "false");
          });
          seccion?.querySelectorAll(".ayt-tab-panel").forEach((panel) => {
            panel.classList.toggle("active", panel.dataset.panel === tab.dataset.tab);
          });
        });
      });
    });
  }

  // ── Calculadora ──────────────────────────────────────────────────────
  function numero(id, porDefecto, min, max) {
    const valor = Number.parseFloat(document.getElementById(id)?.value);
    if (!Number.isFinite(valor)) return porDefecto;
    return Math.min(Math.max(valor, min), max);
  }

  function formatoMbps(valor) {
    return `${Number(valor.toFixed(1)).toLocaleString("es-EC")} Mbps`;
  }

  function calcular() {
    const partidos = numero("ayt-calc-partidos", 1, 1, 8);
    const plataformas = numero("ayt-calc-plataformas", 1, 1, 4);
    const calidad = numero("ayt-calc-calidad", 4, 1, 20);
    const modo = document.getElementById("ayt-calc-modo")?.value || "directo";
    const medidaRaw = document.getElementById("ayt-calc-medida")?.value;
    const medida = medidaRaw === "" || medidaRaw === undefined ? null : numero("ayt-calc-medida", 0, 0, 10000);

    const senalesPorPartido = modo === "restream" ? 1 : plataformas;
    const totalSenales = partidos * senalesPorPartido;
    const consumo = totalSenales * calidad;
    const recomendado = consumo * 1.5;

    let veredicto = "";
    if (medida !== null) {
      if (medida >= recomendado) {
        veredicto = `<div class="ayt-calc-veredicto is-ok"><i class="fas fa-circle-check"></i> Tu subida (${formatoMbps(medida)}) alcanza con margen.</div>`;
      } else if (medida >= consumo) {
        veredicto = `<div class="ayt-calc-veredicto is-justo"><i class="fas fa-triangle-exclamation"></i> Alcanza justo (${formatoMbps(medida)}): cualquier baja puede cortar el directo. Baja la calidad o el número de plataformas.</div>`;
      } else {
        veredicto = `<div class="ayt-calc-veredicto is-mal"><i class="fas fa-circle-xmark"></i> No alcanza (${formatoMbps(medida)}). Baja a 720p o 480p, usa un servicio de retransmisión o emite cada partido desde otra conexión.</div>`;
      }
    }

    const alertaTiktok = plataformas > 1 && partidos > 1
      ? '<p class="ayt-calc-extra"><i class="fab fa-tiktok"></i> Recuerda: TikTok y Twitch permiten un solo directo a la vez por cuenta o canal.</p>'
      : "";

    const resultado = document.getElementById("ayt-calc-resultado");
    if (resultado) {
      resultado.innerHTML = `
        <div class="ayt-calc-cifras">
          <div><span>Señales que salen</span><strong>${totalSenales}</strong></div>
          <div><span>Consumo estimado</span><strong>${formatoMbps(consumo)}</strong></div>
          <div class="is-destacado"><span>Subida recomendada</span><strong>${formatoMbps(recomendado)}</strong></div>
        </div>
        ${veredicto}
        ${alertaTiktok}`;
    }

    guardar(CLAVE_CALC, {
      partidos,
      plataformas,
      calidad: document.getElementById("ayt-calc-calidad")?.value,
      modo,
      medida: medidaRaw ?? "",
    });
  }

  function iniciarCalculadora() {
    const previo = leer(CLAVE_CALC, null);
    if (previo) {
      const asignar = (id, valor) => {
        const el = document.getElementById(id);
        if (el && valor !== undefined && valor !== null) el.value = valor;
      };
      asignar("ayt-calc-partidos", previo.partidos);
      asignar("ayt-calc-plataformas", previo.plataformas);
      asignar("ayt-calc-calidad", previo.calidad);
      asignar("ayt-calc-modo", previo.modo);
      asignar("ayt-calc-medida", previo.medida);
    }
    document.querySelectorAll("#ayt-calc input, #ayt-calc select").forEach((el) => {
      el.addEventListener("input", calcular);
      el.addEventListener("change", calcular);
    });
    calcular();
  }

  // ── Preguntas frecuentes ─────────────────────────────────────────────
  function normalizar(texto) {
    return String(texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  }

  function iniciarBuscador() {
    const input = document.getElementById("ayt-faq-buscar");
    const items = Array.from(document.querySelectorAll("#ayt-faq-lista details"));
    const vacio = document.getElementById("ayt-faq-vacio");
    input?.addEventListener("input", () => {
      const q = normalizar(input.value.trim());
      let visibles = 0;
      items.forEach((item) => {
        const coincide = !q || normalizar(item.textContent).includes(q);
        item.style.display = coincide ? "" : "none";
        item.open = !!q && coincide;
        if (coincide) visibles += 1;
      });
      if (vacio) vacio.style.display = visibles ? "none" : "";
    });
  }

  // ── Lista del día ────────────────────────────────────────────────────
  function iniciarChecklist() {
    const estado = leer(CLAVE_CHECKLIST, {});
    const checks = Array.from(document.querySelectorAll("[data-check]"));
    checks.forEach((check) => {
      check.checked = estado[check.dataset.check] === true;
      check.addEventListener("change", () => {
        const actual = leer(CLAVE_CHECKLIST, {});
        actual[check.dataset.check] = check.checked;
        guardar(CLAVE_CHECKLIST, actual);
      });
    });
    document.getElementById("ayt-limpiar-checklist")?.addEventListener("click", () => {
      guardar(CLAVE_CHECKLIST, {});
      checks.forEach((c) => { c.checked = false; });
    });
    document.getElementById("ayt-imprimir")?.addEventListener("click", () => {
      document.body.classList.add("ayt-imprimiendo-checklist");
      window.print();
      setTimeout(() => document.body.classList.remove("ayt-imprimiendo-checklist"), 500);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const navToggle = document.getElementById("nav-toggle");
    const sidebar = document.getElementById("sidebar");
    if (navToggle && sidebar && navToggle.dataset.mobileMenuBound !== "true") {
      navToggle.dataset.mobileMenuBound = "true";
      navToggle.addEventListener("click", () => sidebar.classList.toggle("nav-open"));
    }

    iniciarPasos();
    iniciarPestanas();
    iniciarCalculadora();
    iniciarBuscador();
    iniciarChecklist();

    // Abrir directamente una sección: ayuda-transmisiones.html#ayt-varios
    if (window.location.hash) {
      document.querySelector(window.location.hash)?.scrollIntoView();
    }
  });
})();
