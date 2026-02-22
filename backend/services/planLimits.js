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
};
