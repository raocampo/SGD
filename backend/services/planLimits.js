const pool = require("../config/database");

const PLANES = {
  demo: {
    codigo: "demo",
    nombre: "Demo",
    max_campeonatos: 1,
    max_categorias_por_campeonato: 3,
    max_equipos_por_campeonato: 8,
    max_equipos_por_categoria: 8,
    max_jugadores_por_equipo: 15,
    permite_carnets: false,
    precio_mensual: 0,
  },
  free: {
    codigo: "free",
    nombre: "Free",
    max_campeonatos: 2,
    max_categorias_por_campeonato: 3,
    max_equipos_por_campeonato: null,
    max_equipos_por_categoria: 32,
    max_jugadores_por_equipo: 15,
    permite_carnets: false,
    precio_mensual: 0,
  },
  base: {
    codigo: "base",
    nombre: "Base",
    max_campeonatos: 6,
    max_categorias_por_campeonato: 8,
    max_equipos_por_campeonato: null,
    max_equipos_por_categoria: 64,
    max_jugadores_por_equipo: 25,
    permite_carnets: false,
    precio_mensual: 15,
  },
  competencia: {
    codigo: "competencia",
    nombre: "Competencia",
    max_campeonatos: 20,
    max_categorias_por_campeonato: 20,
    max_equipos_por_campeonato: null,
    max_equipos_por_categoria: 128,
    max_jugadores_por_equipo: 40,
    permite_carnets: true,
    precio_mensual: 35,
  },
  premium: {
    codigo: "premium",
    nombre: "Premium",
    max_campeonatos: null,
    max_categorias_por_campeonato: null,
    max_equipos_por_campeonato: null,
    max_equipos_por_categoria: null,
    max_jugadores_por_equipo: null,
    permite_carnets: true,
    precio_mensual: 70,
  },
  // ── Planes por campeonato (pago único por torneo — max_campeonatos = 1) ─────
  campeonato_base: {
    codigo: "campeonato_base",
    nombre: "Básico por campeonato",
    max_campeonatos: 1,
    max_categorias_por_campeonato: 8,
    max_equipos_por_campeonato: null,
    max_equipos_por_categoria: 64,
    max_jugadores_por_equipo: 25,
    permite_carnets: false,
    precio_mensual: null,
  },
  campeonato_competencia: {
    codigo: "campeonato_competencia",
    nombre: "Competencia por campeonato",
    max_campeonatos: 1,
    max_categorias_por_campeonato: 20,
    max_equipos_por_campeonato: null,
    max_equipos_por_categoria: 128,
    max_jugadores_por_equipo: 40,
    permite_carnets: true,
    precio_mensual: null,
  },
  campeonato_premium: {
    codigo: "campeonato_premium",
    nombre: "Premium por campeonato",
    max_campeonatos: 1,
    max_categorias_por_campeonato: null,
    max_equipos_por_campeonato: null,
    max_equipos_por_categoria: null,
    max_jugadores_por_equipo: null,
    permite_carnets: true,
    precio_mensual: null,
  },
  // ── Planes anuales (mismos límites que mensual del mismo tier) ────────────
  anual_base: {
    codigo: "anual_base",
    nombre: "Básico anual",
    max_campeonatos: 6,
    max_categorias_por_campeonato: 8,
    max_equipos_por_campeonato: null,
    max_equipos_por_categoria: 64,
    max_jugadores_por_equipo: 25,
    permite_carnets: false,
    precio_mensual: null,
  },
  anual_competencia: {
    codigo: "anual_competencia",
    nombre: "Competencia anual",
    max_campeonatos: 20,
    max_categorias_por_campeonato: 20,
    max_equipos_por_campeonato: null,
    max_equipos_por_categoria: 128,
    max_jugadores_por_equipo: 40,
    permite_carnets: true,
    precio_mensual: null,
  },
  anual_premium: {
    codigo: "anual_premium",
    nombre: "Premium anual",
    max_campeonatos: null,
    max_categorias_por_campeonato: null,
    max_equipos_por_campeonato: null,
    max_equipos_por_categoria: null,
    max_jugadores_por_equipo: null,
    permite_carnets: true,
    precio_mensual: null,
  },
};

const PLANES_PUBLICOS = new Set([
  "demo", "free", "base", "competencia", "premium",
  "campeonato_base", "campeonato_competencia", "campeonato_premium",
  "anual_base", "anual_competencia", "anual_premium",
]);
const PLANES_PAGADOS = new Set([
  "base", "competencia", "premium",
  "campeonato_base", "campeonato_competencia", "campeonato_premium",
  "anual_base", "anual_competencia", "anual_premium",
]);
const CATALOGO_PRECIOS_PUBLICOS = {
  free: {
    codigo: "free",
    nombre: "Plan Free",
    tipo: "gratuito",
    familia: "pruebas",
    nivel: "free",
    sufijo_precio: "/ gratis",
    descripcion_precio: "Precio mensual plan Free (USD)",
    precio_default: PLANES.free.precio_mensual ?? 0,
    registrable: true,
    plan_registro: "free",
  },
  mensual_base: {
    codigo: "mensual_base",
    nombre: "Básico mensual",
    tipo: "plan",
    familia: "mensual",
    nivel: "base",
    sufijo_precio: "/ mes",
    descripcion_precio: "Precio plan básico mensual (USD)",
    precio_default: 20,
    registrable: true,
    plan_registro: "base",
  },
  mensual_competencia: {
    codigo: "mensual_competencia",
    nombre: "Competencia mensual",
    tipo: "plan",
    familia: "mensual",
    nivel: "competencia",
    sufijo_precio: "/ mes",
    descripcion_precio: "Precio plan competencia mensual (USD)",
    precio_default: 60,
    registrable: true,
    plan_registro: "competencia",
  },
  mensual_premium: {
    codigo: "mensual_premium",
    nombre: "Premium mensual",
    tipo: "plan",
    familia: "mensual",
    nivel: "premium",
    sufijo_precio: "/ mes",
    descripcion_precio: "Precio plan premium mensual (USD)",
    precio_default: 150,
    registrable: true,
    plan_registro: "premium",
  },
  campeonato_base: {
    codigo: "campeonato_base",
    nombre: "Básico por campeonato",
    tipo: "plan",
    familia: "campeonato",
    nivel: "base",
    sufijo_precio: "/ campeonato",
    descripcion_precio: "Precio plan básico por campeonato (USD)",
    precio_default: 200,
    registrable: true,
    plan_registro: "campeonato_base",
  },
  campeonato_competencia: {
    codigo: "campeonato_competencia",
    nombre: "Competencia por campeonato",
    tipo: "plan",
    familia: "campeonato",
    nivel: "competencia",
    sufijo_precio: "/ campeonato",
    descripcion_precio: "Precio plan competencia por campeonato (USD)",
    precio_default: 500,
    registrable: true,
    plan_registro: "campeonato_competencia",
  },
  campeonato_premium: {
    codigo: "campeonato_premium",
    nombre: "Premium por campeonato",
    tipo: "plan",
    familia: "campeonato",
    nivel: "premium",
    sufijo_precio: "/ campeonato",
    descripcion_precio: "Precio plan premium por campeonato (USD)",
    precio_default: 1500,
    registrable: true,
    plan_registro: "campeonato_premium",
  },
  anual_base: {
    codigo: "anual_base",
    nombre: "Básico anual",
    tipo: "plan",
    familia: "anual",
    nivel: "base",
    sufijo_precio: "/ año",
    descripcion_precio: "Precio plan básico anual (USD)",
    precio_default: 49,
    registrable: true,
    plan_registro: "anual_base",
  },
  anual_competencia: {
    codigo: "anual_competencia",
    nombre: "Competencia anual",
    tipo: "comercial",
    familia: "anual",
    nivel: "competencia",
    sufijo_precio: "/ año",
    descripcion_precio: "Precio plan competencia anual (USD)",
    precio_default: 500,
    registrable: true,
    plan_registro: "anual_competencia",
  },
  anual_premium: {
    codigo: "anual_premium",
    nombre: "Premium anual",
    tipo: "plan",
    familia: "anual",
    nivel: "premium",
    sufijo_precio: "/ año",
    descripcion_precio: "Precio plan premium anual (USD)",
    precio_default: 1000,
    registrable: true,
    plan_registro: "anual_premium",
  },
};

function obtenerCatalogoPreciosPublicos() {
  return { ...CATALOGO_PRECIOS_PUBLICOS };
}

function normalizarPlanCodigo(planCodigo, fallback = "demo") {
  const code = String(planCodigo || "").trim().toLowerCase();
  if (PLANES[code]) return code;
  return fallback;
}

function esPlanPublico(planCodigo) {
  const code = String(planCodigo || "").trim().toLowerCase();
  return PLANES_PUBLICOS.has(code);
}

function esPlanPagado(planCodigo) {
  const code = normalizarPlanCodigo(planCodigo, "demo");
  return PLANES_PAGADOS.has(code);
}

function obtenerPlan(planCodigo) {
  return PLANES[normalizarPlanCodigo(planCodigo)];
}

async function obtenerPlanUsuarioPorId(usuarioId, client = pool) {
  const id = Number.parseInt(usuarioId, 10);
  if (!Number.isFinite(id) || id <= 0) return obtenerPlan("premium");

  const r = await client.query(
    `SELECT COALESCE(plan_codigo, 'premium') AS plan_codigo FROM usuarios WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (!r.rows.length) return obtenerPlan("premium");
  return obtenerPlan(r.rows[0].plan_codigo);
}

async function obtenerPlanPorCampeonatoId(campeonatoId, client = pool) {
  const id = Number.parseInt(campeonatoId, 10);
  if (!Number.isFinite(id) || id <= 0) return obtenerPlan("premium");

  const r = await client.query(
    `
      SELECT COALESCE(u.plan_codigo, 'premium') AS plan_codigo
      FROM campeonatos c
      LEFT JOIN usuarios u ON u.id = c.creador_usuario_id
      WHERE c.id = $1
      LIMIT 1
    `,
    [id]
  );
  if (!r.rows.length) return obtenerPlan("premium");
  return obtenerPlan(r.rows[0].plan_codigo);
}

// ── Configuración de sistema (precios desde BD) ───────────────────────────

async function asegurarTablaConfiguracion(client = pool) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS configuracion_sistema (
      clave       VARCHAR(120) PRIMARY KEY,
      valor       TEXT         NOT NULL,
      tipo        VARCHAR(20)  NOT NULL DEFAULT 'string'
                    CHECK (tipo IN ('string', 'number', 'boolean', 'json')),
      descripcion TEXT,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const claves = [
    ["plan_precio_demo", "0", "Precio mensual plan Demo (USD)"],
    ...Object.values(CATALOGO_PRECIOS_PUBLICOS).map((item) => [
      `plan_precio_${item.codigo}`,
      String(item.precio_default ?? 0),
      item.descripcion_precio,
    ]),
  ];
  for (const [clave, valor, descripcion] of claves) {
    await client.query(
      `INSERT INTO configuracion_sistema (clave, valor, tipo, descripcion)
       VALUES ($1, $2, 'number', $3)
       ON CONFLICT (clave) DO NOTHING`,
      [clave, valor, descripcion]
    );
  }
}

async function obtenerPreciosPlanes(client = pool) {
  try {
    await asegurarTablaConfiguracion(client);
    const r = await client.query(
      `SELECT clave, valor FROM configuracion_sistema
       WHERE clave LIKE 'plan_precio_%'`
    );
    const precios = {};
    for (const row of r.rows) {
      const codigo = row.clave.replace("plan_precio_", "");
      precios[codigo] = Number(row.valor) || 0;
    }
    return precios;
  } catch {
    // fallback a valores hardcodeados
    return {
      demo: 0,
      ...Object.values(CATALOGO_PRECIOS_PUBLICOS).reduce((acc, item) => {
        acc[item.codigo] = Number(item.precio_default) || 0;
        return acc;
      }, {}),
    };
  }
}

async function actualizarPrecioPlan(planCodigo, precio, client = pool) {
  const codigo = String(planCodigo || "").trim().toLowerCase();
  const item = CATALOGO_PRECIOS_PUBLICOS[codigo] || (PLANES[codigo] ? { codigo, nombre: PLANES[codigo]?.nombre || codigo } : null);
  if (!item?.codigo) throw new Error("Plan inválido");
  const monto = Number(precio);
  if (!Number.isFinite(monto) || monto < 0) throw new Error("Precio inválido: debe ser >= 0");
  await asegurarTablaConfiguracion(client);
  await client.query(
    `INSERT INTO configuracion_sistema (clave, valor, tipo, descripcion)
     VALUES ($1, $2, 'number', $3)
     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = CURRENT_TIMESTAMP`,
    [`plan_precio_${codigo}`, String(monto), item.descripcion_precio || `Precio plan ${item.nombre || codigo} (USD)`]
  );
  return { codigo, precio: monto };
}

// ── Formas de pago ────────────────────────────────────────────────────────────

const FORMAS_PAGO_DEFAULTS = {
  pago_whatsapp:               "593982413081",
  pago_transferencia_banco:    "Banco Pichincha",
  pago_transferencia_cuenta:   "",
  pago_transferencia_tipo:     "Ahorro",
  pago_transferencia_titular:  "Loja Torneos & Competencias",
  pago_transferencia_cedula:   "",
  pago_efectivo_activo:        "false",
  pago_efectivo_instrucciones: "Coordina la entrega de efectivo por WhatsApp.",
  pago_paypal_activo:          "false",
  pago_paypal_enlace:          "",
  pago_paypal_instrucciones:   'Envía el pago como "Amigos y familiares" a la cuenta PayPal indicada y adjunta el comprobante por WhatsApp.',
  pago_tarjeta_activo:         "false",
  pago_tarjeta_plataforma:     "Payphone",
  pago_tarjeta_enlace:         "",
  pago_tarjeta_instrucciones:  "Haz clic en el botón para pagar de forma segura con tu tarjeta de crédito o débito.",
  pago_instrucciones_extra:    "Envía el comprobante de pago al WhatsApp indicado para activar tu cuenta.",
};

async function obtenerFormasPago(client = pool) {
  try {
    await asegurarTablaConfiguracion(client);
    const r = await client.query(
      `SELECT clave, valor FROM configuracion_sistema WHERE clave LIKE 'pago_%'`
    );
    const cfg = { ...FORMAS_PAGO_DEFAULTS };
    for (const row of r.rows) {
      cfg[row.clave] = row.valor;
    }
    return {
      whatsapp:              cfg.pago_whatsapp,
      transferencia: {
        banco:    cfg.pago_transferencia_banco,
        cuenta:   cfg.pago_transferencia_cuenta,
        tipo:     cfg.pago_transferencia_tipo,
        titular:  cfg.pago_transferencia_titular,
        cedula:   cfg.pago_transferencia_cedula,
      },
      efectivo: {
        activo:        cfg.pago_efectivo_activo === "true",
        instrucciones: cfg.pago_efectivo_instrucciones,
      },
      paypal: {
        activo:        cfg.pago_paypal_activo === "true",
        enlace:        cfg.pago_paypal_enlace,
        instrucciones: cfg.pago_paypal_instrucciones,
      },
      tarjeta: {
        activo:        cfg.pago_tarjeta_activo === "true",
        plataforma:    cfg.pago_tarjeta_plataforma,
        enlace:        cfg.pago_tarjeta_enlace,
        instrucciones: cfg.pago_tarjeta_instrucciones,
      },
      instrucciones_extra: cfg.pago_instrucciones_extra,
    };
  } catch {
    return {
      whatsapp: FORMAS_PAGO_DEFAULTS.pago_whatsapp,
      transferencia: {
        banco:   FORMAS_PAGO_DEFAULTS.pago_transferencia_banco,
        cuenta:  "",
        tipo:    "Ahorro",
        titular: FORMAS_PAGO_DEFAULTS.pago_transferencia_titular,
        cedula:  "",
      },
      efectivo: { activo: false, instrucciones: "" },
      paypal:   { activo: false, enlace: "", instrucciones: "" },
      tarjeta:  { activo: false, plataforma: "Payphone", enlace: "", instrucciones: "" },
      instrucciones_extra: FORMAS_PAGO_DEFAULTS.pago_instrucciones_extra,
    };
  }
}

async function actualizarFormasPago(campos, client = pool) {
  await asegurarTablaConfiguracion(client);
  const CLAVES_PERMITIDAS = new Set(Object.keys(FORMAS_PAGO_DEFAULTS));
  for (const [clave, valor] of Object.entries(campos)) {
    if (!CLAVES_PERMITIDAS.has(clave)) continue;
    await client.query(
      `INSERT INTO configuracion_sistema (clave, valor, tipo)
       VALUES ($1, $2, 'string')
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = CURRENT_TIMESTAMP`,
      [clave, String(valor ?? "")]
    );
  }
}

module.exports = {
  PLANES,
  PLANES_PUBLICOS,
  PLANES_PAGADOS,
  CATALOGO_PRECIOS_PUBLICOS,
  normalizarPlanCodigo,
  esPlanPublico,
  esPlanPagado,
  obtenerPlan,
  obtenerCatalogoPreciosPublicos,
  obtenerPlanUsuarioPorId,
  obtenerPlanPorCampeonatoId,
  asegurarTablaConfiguracion,
  obtenerPreciosPlanes,
  actualizarPrecioPlan,
  obtenerFormasPago,
  actualizarFormasPago,
};
