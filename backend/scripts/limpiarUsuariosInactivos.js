#!/usr/bin/env node
// Ejecuta la limpieza de cuentas inactivas sin vínculo.
//   node backend/scripts/limpiarUsuariosInactivos.js            → DRY-RUN (solo lista)
//   node backend/scripts/limpiarUsuariosInactivos.js --apply    → aplica bloqueo/eliminación
//
// Ventanas configurables por env:
//   LIMPIEZA_DIAS_BLOQUEO     (default 30)
//   LIMPIEZA_DIAS_ELIMINACION (default 60)
require("dotenv").config();
const { ejecutarLimpiezaUsuariosInactivos } = require("../services/limpiezaUsuariosInactivos");

(async () => {
  const apply = process.argv.includes("--apply");
  const r = await ejecutarLimpiezaUsuariosInactivos({ dryRun: !apply });

  console.log(`\n== Limpieza de usuarios inactivos ${r.dryRun ? "(DRY-RUN)" : "(APLICADO)"} ==`);
  console.log(`Ventanas: bloqueo > ${r.diasBloqueo} días · eliminación > ${r.diasEliminacion} días\n`);

  console.log(`A BLOQUEAR (${r.bloqueados.length}):`);
  r.bloqueados.forEach((u) => console.log(`  #${u.id}  ${u.rol.padEnd(11)} ${String(u.nombre || "").padEnd(24)} ${u.email || ""}  (${u.dias_inactivo}d)`));

  console.log(`\nA ELIMINAR (${r.eliminados.length}):`);
  r.eliminados.forEach((u) => console.log(`  #${u.id}  ${u.rol.padEnd(11)} ${String(u.nombre || "").padEnd(24)} ${u.email || ""}  (${u.dias_inactivo}d)`));

  if (r.dryRun) console.log(`\n(dry-run: no se modificó nada. Usa --apply para ejecutar.)`);
  process.exit(0);
})().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
