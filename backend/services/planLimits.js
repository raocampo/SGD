const pool = require("../config/database");

const PLANES = {
  demo: {
    codigo: "demo",
    nombre: "Demo",
    max_campeonatos: 2,
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
};

const PLANES_PUBLICOS = new Set(["demo", "free", "base", "competencia", "premium"]);
const PLANES_PAGADOS = new Set(["base", "competencia", "premium"]);

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
    ["plan_precio_demo",        "0",  "Precio mensual plan Demo (USD)"],
    ["plan_precio_free",        "0",  "Precio mensual plan Free (USD)"],
    ["plan_precio_base",        "15", "Precio mensual plan Base (USD)"],
    ["plan_precio_competencia", "35", "Precio mensual plan Competencia (USD)"],
    ["plan_precio_premium",     "70", "Precio mensual plan Premium (USD)"],
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
    return { demo: 0, free: 0, base: 15, competencia: 35, premium: 70 };
  }
}

async function actualizarPrecioPlan(planCodigo, precio, client = pool) {
  const codigo = normalizarPlanCodigo(planCodigo, null);
  if (!codigo) throw new Error("Plan inválido");
  const monto = Number(precio);
  if (!Number.isFinite(monto) || monto < 0) throw new Error("Precio inválido: debe ser >= 0");
  await asegurarTablaConfiguracion(client);
  await client.query(
    `INSERT INTO configuracion_sistema (clave, valor, tipo, descripcion)
     VALUES ($1, $2, 'number', $3)
     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = CURRENT_TIMESTAMP`,
    [`plan_precio_${codigo}`, String(monto), `Precio mensual plan ${PLANES[codigo]?.nombre || codigo} (USD)`]
  );
  return { codigo, precio: monto };
}

module.exports = {
  PLANES,
  PLANES_PUBLICOS,
  PLANES_PAGADOS,
  normalizarPlanCodigo,
  esPlanPublico,
  esPlanPagado,
  obtenerPlan,
  obtenerPlanUsuarioPorId,
  obtenerPlanPorCampeonatoId,
  asegurarTablaConfiguracion,
  obtenerPreciosPlanes,
  actualizarPrecioPlan,
};
