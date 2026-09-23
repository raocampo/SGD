#!/usr/bin/env node
// Genera landing_slug para organizadores que todavía no tienen uno (nunca
// abrieron "Mi Landing" / nunca guardaron su config de portal), para que
// /liga/<slug> funcione para TODOS los organizadores, no solo los que ya
// entraron al CMS al menos una vez.
//
//   node backend/scripts/backfillLandingSlugs.js            → DRY-RUN (solo lista)
//   node backend/scripts/backfillLandingSlugs.js --apply     → aplica el backfill
//
// No toca organizadores que ya tienen landing_slug (no sobrescribe nada
// existente) ni ningún otro campo de su config de portal.
require("dotenv").config();
const pool = require("../config/database");
const OrganizadorPortal = require("../models/OrganizadorPortal");

async function listarOrganizadoresSinSlug() {
  await OrganizadorPortal.asegurarEsquema(pool);
  const result = await pool.query(`
    SELECT
      u.id,
      u.nombre,
      u.email,
      u.organizacion_nombre,
      c.usuario_id IS NOT NULL AS tiene_config,
      c.landing_slug
    FROM usuarios u
    LEFT JOIN organizador_portal_config c ON c.usuario_id = u.id
    WHERE LOWER(COALESCE(u.rol, '')) = 'organizador'
      AND (c.landing_slug IS NULL OR TRIM(c.landing_slug) = '')
    ORDER BY u.id
  `);
  return result.rows;
}

async function aplicarBackfill(organizadores) {
  const resultados = [];
  for (const org of organizadores) {
    const base = org.organizacion_nombre || org.nombre || `organizador-${org.id}`;
    const slug = await OrganizadorPortal.generarSlugDisponible(base, org.id, pool);

    if (org.tiene_config) {
      await pool.query(
        `UPDATE organizador_portal_config
         SET landing_slug = $1, updated_at = CURRENT_TIMESTAMP
         WHERE usuario_id = $2`,
        [slug, org.id]
      );
    } else {
      await pool.query(
        `INSERT INTO organizador_portal_config (usuario_id, landing_slug, color_tema)
         VALUES ($1, $2, 'deportivo')`,
        [org.id, slug]
      );
    }
    resultados.push({ ...org, slug });
  }
  return resultados;
}

(async () => {
  const apply = process.argv.includes("--apply");
  const organizadores = await listarOrganizadoresSinSlug();

  if (!organizadores.length) {
    console.log("Todos los organizadores ya tienen landing_slug. Nada que hacer.");
    process.exit(0);
  }

  if (!apply) {
    console.log(`\n== Backfill de landing_slug (DRY-RUN) ==`);
    console.log(`${organizadores.length} organizador(es) sin landing_slug:\n`);
    for (const org of organizadores) {
      const base = org.organizacion_nombre || org.nombre || `organizador-${org.id}`;
      const slugPropuesto = await OrganizadorPortal.generarSlugDisponible(base, org.id, pool);
      console.log(
        `  #${org.id}  ${String(org.nombre || "").padEnd(28)} ${String(org.email || "").padEnd(30)} -> /liga/${slugPropuesto}${org.tiene_config ? "" : "  (sin config de portal todavía)"}`
      );
    }
    console.log(`\n(dry-run: no se modificó nada. Usa --apply para ejecutar.)`);
    process.exit(0);
  }

  const resultados = await aplicarBackfill(organizadores);
  console.log(`\n== Backfill de landing_slug (APLICADO) ==`);
  console.log(`${resultados.length} organizador(es) actualizados:\n`);
  for (const org of resultados) {
    console.log(`  #${org.id}  ${String(org.nombre || "").padEnd(28)} -> /liga/${org.slug}`);
  }
  process.exit(0);
})().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
