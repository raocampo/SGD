const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const express = require("express");
const jwt = require("jsonwebtoken");

function load(relative, dependencies) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", relative), "utf8"), {
    module, exports: module.exports,
    require: (name) => dependencies[name] || {},
    process: { env: { JWT_SECRET: "qa-asociacion-local-sin-credenciales" } },
    console: { error() {}, warn() {} },
  }, { filename: relative });
  return module.exports;
}

const rows = [
  { organizador_id: 100, organizador_nombre: "Organizador A", organizacion_nombre: "Liga A", campeonato_id: 10, campeonato_nombre: "Copa A", evento_id: 101, evento_nombre: "Abierta", equipo_id: 11, equipo_nombre: "Unión", numero_campeonato: 1 },
  { organizador_id: 100, organizador_nombre: "Organizador A", organizacion_nombre: "Liga A", campeonato_id: 10, campeonato_nombre: "Copa A", evento_id: 101, evento_nombre: "Abierta", equipo_id: 12, equipo_nombre: "Águilas", numero_campeonato: 2 },
  { organizador_id: 100, organizador_nombre: "Organizador A", organizacion_nombre: "Liga A", campeonato_id: 20, campeonato_nombre: "Copa B", evento_id: 201, evento_nombre: "Máster", equipo_id: null, equipo_nombre: null },
  { organizador_id: 200, organizador_nombre: "Organizador B", organizacion_nombre: null, campeonato_id: 30, campeonato_nombre: "Copa C", evento_id: 301, evento_nombre: "Abierta", equipo_id: 31, equipo_nombre: "Unión" },
];
function serviceHarness(data = rows) {
  const calls = [];
  const pool = { query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: params.length ? data.filter(r => r.equipo_id === params[0]) : data };
  } };
  return { calls, pool, service: load("services/equipoAsociacionService.js", { "../config/database": pool }) };
}

test("catálogo mínimo agrupa organización, campeonato, categoría y equipos inscritos", async () => {
  const { service, calls } = serviceHarness();
  const catalog = JSON.parse(JSON.stringify(await service.listarOpcionesAsociacion()));
  assert.equal(catalog.length, 2);
  assert.equal(catalog[0].nombre, "Liga A (Organizador A)");
  assert.equal(catalog[0].campeonatos.length, 2);
  assert.deepEqual(catalog[0].campeonatos[0].equipos.map(e => e.id), [11, 12]);
  assert.deepEqual(catalog[0].campeonatos[1].equipos, []);
  assert.equal(catalog[0].campeonatos[0].categorias[0].nombre, "Abierta");
  assert.deepEqual(catalog[0].campeonatos[0].categorias[0].equipos.map(e => e.id), [11, 12]);
  assert.deepEqual(Object.keys(catalog[0]).sort(), ["campeonatos", "id", "nombre"]);
  assert.deepEqual(Object.keys(catalog[0].campeonatos[0].equipos[0]).sort(), ["id", "nombre"]);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /org\.activo = TRUE/);
  assert.match(calls[0].sql, /LOWER\(org\.rol\) = 'organizador'/);
  assert.match(calls[0].sql, /IN \('inscripcion', 'en_curso', 'finalizado'\)/);
  assert.match(calls[0].sql, /c\.creador_usuario_id IS NULL/);
  assert.match(calls[0].sql, /JOIN evento_equipos ee ON ee.evento_id = ev.id/);
  assert.match(calls[0].sql, /e.id = ee.equipo_id AND e.campeonato_id = c.id/);
  assert.doesNotMatch(calls[0].sql, /INSERT|UPDATE|DELETE|ALTER|SELECT\s+\*/i);
});

test("servidor valida el trío y conserva clientes antiguos que solo envían equipo_id", async () => {
  const { service, calls } = serviceHarness();
  const result = await service.validarSeleccionAsociacion({ organizador_id: "100", campeonato_id: "10", equipo_id: "11" });
  assert.deepEqual({ ...result }, { organizador_id: 100, campeonato_id: 10, evento_id: 101, equipo_id: 11 });
  const legacy = await service.validarSeleccionAsociacion({ equipo_id: 31 });
  assert.deepEqual({ ...legacy }, { organizador_id: 200, campeonato_id: 30, evento_id: 301, equipo_id: 31 });
  assert.match(calls[0].sql, /AND e\.id = \$1/);
  assert.deepEqual(Array.from(calls[0].params), [11]);
});

test("combinaciones cruzadas o equipo ya no disponible se rechazan", async () => {
  const { service } = serviceHarness();
  for (const input of [
    { organizador_id: 200, campeonato_id: 10, equipo_id: 11 },
    { organizador_id: 100, campeonato_id: 30, equipo_id: 11 },
    { organizador_id: 100, campeonato_id: 20, equipo_id: 11 },
    { organizador_id: 100, campeonato_id: 10, equipo_id: 999 },
    { organizador_id: 100, campeonato_id: 10, evento_id: 201, equipo_id: 11 },
  ]) {
    await assert.rejects(service.validarSeleccionAsociacion(input), error => error.status === 400);
  }
});

test("IDs inválidos no alcanzan la base de datos", async () => {
  const { service, calls } = serviceHarness();
  for (const invalid of [undefined, null, "", 0, -1, true, "11x", "1.1", "1e2", 2147483648]) {
    await assert.rejects(service.validarSeleccionAsociacion({ equipo_id: invalid }), error => error.status === 400);
  }
  await assert.rejects(service.validarSeleccionAsociacion({ equipo_id: 11, campeonato_id: "10x" }));
  await assert.rejects(service.validarSeleccionAsociacion({ equipo_id: 11, organizador_id: -1 }));
  await assert.rejects(service.validarSeleccionAsociacion({ equipo_id: 11, evento_id: "101x" }));
  assert.equal(calls.length, 0);
});

test("IDs repetidos se muestran una vez; equipos homónimos conservan su identidad y número", async () => {
  const { service } = serviceHarness([
    rows[0], rows[0], rows[1],
    { ...rows[0], equipo_id:13, numero_campeonato:3 },
    { ...rows[0], evento_id:102, evento_nombre:"Juvenil" },
    { ...rows[2], campeonato_id:40, evento_id:null },
  ]);
  const catalog = JSON.parse(JSON.stringify(await service.listarOpcionesAsociacion()));
  const camp = catalog[0].campeonatos[0];
  assert.deepEqual(camp.categorias[0].equipos.map(e => e.id), [11,12,13]);
  assert.deepEqual(camp.categorias[0].equipos.filter(e => e.nombre === "Unión").map(e => e.etiqueta), ["Unión (N.º 1)", "Unión (N.º 3)"]);
  assert.deepEqual(camp.categorias[1].equipos.map(e => e.id), [11]);
  assert.deepEqual(camp.equipos.map(e => e.id), [11,12,13]);
  assert.deepEqual(catalog[0].campeonatos[1].categorias, []);
  await assert.rejects(service.validarSeleccionAsociacion({ equipo_id:11 }), error => error.status === 400);
  const selected = await service.validarSeleccionAsociacion({ equipo_id:11, evento_id:102 });
  assert.equal(selected.evento_id, 102);
});

test("flujo HTTP autenticado: asociación, alcance operativo e inscripción de jugadores", async (t) => {
  const { service, pool } = serviceHarness();
  const users = new Map([
    [1, { id: 1, rol: "dirigente", activo: true, equipo_ids: [] }],
    [2, { id: 2, rol: "tecnico", activo: true, equipo_ids: [] }],
    [3, { id: 3, rol: "jugador", activo: true, equipo_ids: [] }],
    [4, { id: 4, rol: "organizador", activo: true, equipo_ids: [] }],
    [5, { id: 5, rol: "dirigente", activo: true, solo_lectura: true, equipo_ids: [] }],
  ]);
  let assignmentWrites = 0;
  let playerWrites = 0;
  const model = {
    obtenerPorId: async id => users.get(Number(id)),
    obtenerEquipoIds: async id => users.get(Number(id)).equipo_ids,
    limpiarUsuario: user => ({ ...user, equipo_ids: [...user.equipo_ids] }),
    asignarEquipo: async (id, team) => {
      assignmentWrites++;
      const user = users.get(Number(id));
      if (!user.equipo_ids.includes(team)) user.equipo_ids.push(team);
      return model.limpiarUsuario(user);
    },
  };
  const auth = load("middleware/authMiddleware.js", { jsonwebtoken: jwt, "../models/UsuarioAuth": model });
  const controller = load("controllers/authController.js", {
    "../config/database": pool, "../models/UsuarioAuth": model,
    "../services/equipoAsociacionService": service,
  });
  const router = load("routes/authRoutes.js", { express, "../controllers/authController": controller, "../middleware/authMiddleware": auth });
  const scopePool = { query: async (sql, params) => {
    if (sql.includes("SELECT DISTINCT campeonato_id")) {
      return { rows: rows.filter(r => params[0].includes(r.equipo_id)).map(r => ({ campeonato_id: r.campeonato_id })) };
    }
    if (sql.includes("requiere_cedula_jugador")) return { rows: [{ requiere_cedula_jugador: false }] };
    return { rows: [] };
  } };
  const scope = load("services/roleScope.js", { "../config/database": scopePool, "../models/UsuarioAuth": model });
  const campController = load("controllers/campeonatoController.js", {
    "../models/Campeonato": { obtenerTodos: async () => [{ id: 10 }, { id: 20 }, { id: 30 }] },
    "../services/roleScope": scope,
  });
  const teamController = load("controllers/equipoController.js", {
    "../models/Equipo": { obtenerTodos: async () => rows.filter(r => r.equipo_id).map(r => ({ id: r.equipo_id, campeonato_id: r.campeonato_id })) },
    "../services/roleScope": scope, "../services/organizadorScope": { isOrganizador: () => false },
  });
  const playerController = load("controllers/jugadorController.js", {
    "../config/database": scopePool, "../services/roleScope": scope,
    "../models/Jugador": { normalizarCedidentidad: value => value || null, crear: async team => { playerWrites++; return { id: playerWrites, equipo_id: team }; } },
  });
  const app = express();
  app.use(express.json());
  app.use("/api/auth", router);
  app.get("/api/campeonatos", auth.requireAuth, campController.obtenerCampeonatos);
  app.get("/api/equipos", auth.requireAuth, teamController.obtenerTodosLosEquipos);
  app.post("/api/jugadores", auth.requireAuth, auth.requireRoles("administrador", "organizador", "tecnico", "dirigente"), playerController.crearJugador);
  const server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(id, route, body) {
    const token = id ? jwt.sign({ id }, "qa-asociacion-local-sin-credenciales") : null;
    const response = await fetch(base + route, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }

  await t.test("catálogo exige sesión y rol; permite cuentas nuevas sin equipos", async () => {
    assert.equal((await request(null, "/auth/mi-equipo/opciones")).status, 401);
    assert.equal((await request(4, "/auth/mi-equipo/opciones")).status, 403);
    for (const id of [1, 2, 3]) {
      const response = await request(id, "/auth/mi-equipo/opciones");
      assert.equal(response.status, 200);
      assert.equal(response.body.organizadores.length, 2);
      assert.deepEqual((await request(id, "/campeonatos")).body.campeonatos, []);
      assert.deepEqual((await request(id, "/equipos")).body.equipos, []);
    }
  });
  await t.test("ninguna escritura al enviar organización, campeonato o categoría incorrectos", async () => {
    for (const seleccion of [
      { equipo_id:11, campeonato_id:30, organizador_id:200 },
      { equipo_id:11, campeonato_id:10, organizador_id:100, evento_id:201 },
    ]) {
      const result = await request(1, "/auth/mi-equipo", seleccion);
      assert.equal(result.status, 400);
    }
    assert.equal(assignmentWrites, 0);
  });
  await t.test("dirigente y técnico se asocian y solo ven el campeonato/equipo escogidos", async () => {
    for (const id of [1, 2]) {
      const result = await request(id, "/auth/mi-equipo", { equipo_id: 11, evento_id:101, campeonato_id: 10, organizador_id: 100, usuario_id: 999 });
      assert.equal(result.status, 200);
      assert.equal(result.body.usuario.id, id);
      assert.deepEqual(result.body.usuario.equipo_ids, [11]);
      assert.deepEqual((await request(id, "/campeonatos")).body.campeonatos, [{ id: 10 }]);
      assert.deepEqual((await request(id, "/equipos")).body.equipos.map(e => e.id), [11]);
    }
    assert.equal(assignmentWrites, 2);
  });
  await t.test("pueden inscribir jugadores del equipo asociado y se rechaza otro equipo", async () => {
    for (const id of [1, 2]) {
      const own = await request(id, "/jugadores", { equipo_id: 11, nombre: "Jugador", apellido: "QA" });
      assert.equal(own.status, 201);
      assert.equal(own.body.jugador.equipo_id, 11);
      assert.equal((await request(id, "/jugadores", { equipo_id: 31, nombre: "Ajeno", apellido: "QA" })).status, 403);
    }
    assert.equal(playerWrites, 2);
  });
  await t.test("jugador mantiene compatibilidad de asociación y no puede inscribir planteles", async () => {
    const result = await request(3, "/auth/mi-equipo", { equipo_id: 31 });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.usuario.equipo_ids, [31]);
    assert.equal((await request(3, "/jugadores", { equipo_id: 31, nombre: "Jugador", apellido: "QA" })).status, 403);
    assert.equal(playerWrites, 2);
  });
  await t.test("cuenta solo lectura puede consultar el catálogo pero no modificar su asociación", async () => {
    assert.equal((await request(5, "/auth/mi-equipo/opciones")).status, 200);
    const before = assignmentWrites;
    assert.equal((await request(5, "/auth/mi-equipo", { equipo_id: 11 })).status, 403);
    assert.equal(assignmentWrites, before);
  });
});
