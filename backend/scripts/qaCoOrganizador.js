// QA: co-organizador (acceso adicional de una organización existente).
// Corre todo dentro de una transacción y hace ROLLBACK: no deja datos.
// Uso: node backend/scripts/qaCoOrganizador.js
const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const UsuarioAuth = require("../models/UsuarioAuth");
const { obtenerCampeonatoIdsOrganizador } = require("../services/organizadorScope");
const { signAccessToken } = require("../services/sessionService");

let fallos = 0;
function check(nombre, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${nombre}${extra ? ` — ${extra}` : ""}`);
  if (!ok) fallos += 1;
}

async function esperaError(nombre, fn, fragmento) {
  try {
    await fn();
    check(nombre, false, "no lanzó error");
  } catch (e) {
    check(nombre, String(e.message).includes(fragmento), e.message);
  }
}

async function main() {
  await UsuarioAuth.asegurarEsquema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sufijo = Date.now();

    // Titular con un campeonato propio.
    const titular = await UsuarioAuth.crear(
      {
        nombre: "QA Titular",
        username: `qa_tit_${sufijo}`,
        password: "secreto123",
        rol: "organizador",
        organizacion_nombre: "QA Liga Socios",
        plan_codigo: "premium",
      },
      client
    );
    const camp = await client.query(
      `INSERT INTO campeonatos (nombre, organizador, creador_usuario_id, fecha_inicio, fecha_fin)
       VALUES ('QA Camp Socios', 'QA Liga Socios', $1, CURRENT_DATE, CURRENT_DATE + 30) RETURNING id`,
      [titular.id]
    );
    const campId = Number(camp.rows[0].id);

    // Co-organizador vinculado al titular.
    const co = await UsuarioAuth.crear(
      {
        nombre: "QA Socio Dos",
        username: `qa_co_${sufijo}`,
        password: "otraclave1",
        rol: "organizador",
        organizacion_titular_id: titular.id,
      },
      client
    );
    check("crear guarda organizacion_titular_id", co.organizacion_titular_id === titular.id);
    check("crear copia nombre de organización", co.organizacion_nombre === "QA Liga Socios");

    const efectivo = await UsuarioAuth.resolverIdentidadEfectiva(co, client);
    check("identidad efectiva usa id del titular", efectivo.id === titular.id);
    check("conserva cuenta real", efectivo.cuenta_usuario_id === co.id);
    check("conserva nombre propio", efectivo.nombre === "QA Socio Dos");
    check("hereda plan del titular", efectivo.plan_codigo === titular.plan_codigo);
    check("marca es_co_organizador", efectivo.es_co_organizador === true);

    const ids = await obtenerCampeonatoIdsOrganizador(efectivo, client);
    check("ve los campeonatos del titular", ids.includes(campId), JSON.stringify(ids));

    const payload = jwt.decode(signAccessToken(efectivo));
    check("token firmado con la cuenta real", Number(payload.id) === co.id);

    const credenciales = await UsuarioAuth.validarCredenciales(`qa_co_${sufijo}`, "otraclave1", client);
    check("login con su propia contraseña", Number(credenciales?.id) === co.id);

    const titularSinCambio = await UsuarioAuth.resolverIdentidadEfectiva(titular, client);
    check("titular no cambia", titularSinCambio === titular);

    // Validaciones.
    await esperaError(
      "no permite encadenar titulares",
      () =>
        UsuarioAuth.crear(
          {
            nombre: "QA Cadena",
            username: `qa_cad_${sufijo}`,
            password: "secreto123",
            rol: "organizador",
            organizacion_titular_id: co.id,
          },
          client
        ),
      "organizador principal"
    );
    await esperaError(
      "no vincula un titular que tiene accesos",
      () => UsuarioAuth.actualizar(titular.id, { organizacion_titular_id: co.id }, client),
      "organizacion_titular_id invalido"
    );

    // Desvincular (cambio de rol) limpia el titular.
    const comoTecnico = await UsuarioAuth.actualizar(co.id, { rol: "tecnico" }, client);
    check("cambiar de rol desvincula", comoTecnico.organizacion_titular_id === null);

    // Re-vincular por edición.
    const revinculado = await UsuarioAuth.actualizar(
      co.id,
      { rol: "organizador", organizacion_titular_id: titular.id },
      client
    );
    check("editar vincula a organización existente", revinculado.organizacion_titular_id === titular.id);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
  console.log(fallos ? `\n${fallos} FALLO(S)` : "\nTodo OK");
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
