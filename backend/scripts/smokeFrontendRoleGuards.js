/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function createStorage() {
  const memory = new Map();
  return {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      memory.set(String(key), String(value));
    },
    removeItem(key) {
      memory.delete(String(key));
    },
    clear() {
      memory.clear();
    },
    key(index) {
      return Array.from(memory.keys())[index] || null;
    },
    get length() {
      return memory.size;
    },
  };
}

function loadCoreGuards() {
  const corePath = path.resolve(__dirname, "../../frontend/js/core.js");
  let source = fs.readFileSync(corePath, "utf8");
  source = source.replace(/\}\)\(\);\s*$/, "window.__qa = { canAccessPage, getDefaultPageByRole };})();");

  const documentHead = {
    querySelector() {
      return null;
    },
    appendChild() {},
  };

  const context = {
    console,
    Headers,
    URL,
    window: {
      API_BASE_URL: "http://localhost:5000/api",
      location: {
        pathname: "/frontend/index.html",
        search: "",
        href: "http://127.0.0.1:5500/frontend/index.html",
      },
      fetch: async () => ({ ok: false }),
    },
    document: {
      head: documentHead,
      body: {
        classList: {
          add() {},
          remove() {},
        },
        appendChild() {},
      },
      createElement() {
        return {
          setAttribute() {},
          classList: {
            add() {},
            remove() {},
            toggle() {},
          },
          style: {},
          appendChild() {},
          addEventListener() {},
          remove() {},
          innerHTML: "",
          href: "",
        };
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      addEventListener() {},
      getElementById() {
        return null;
      },
    },
    localStorage: createStorage(),
    sessionStorage: createStorage(),
    setTimeout,
    clearTimeout,
  };
  context.window.document = context.document;
  context.window.localStorage = context.localStorage;
  context.window.sessionStorage = context.sessionStorage;

  vm.createContext(context);
  vm.runInContext(source, context, { filename: corePath });

  const qa = context.window.__qa;
  if (!qa || typeof qa.canAccessPage !== "function" || typeof qa.getDefaultPageByRole !== "function") {
    throw new Error("No se pudo extraer canAccessPage/getDefaultPageByRole desde core.js");
  }
  return qa;
}

function user(role) {
  return {
    id: 999,
    nombre: `QA ${role}`,
    email: `qa.${role}@ltc.local`,
    rol: role,
  };
}

function runAssertions(qa) {
  const assertions = [
    // Publico sin sesion.
    { role: null, page: "index.html", expected: true, label: "anon-public-index" },
    { role: null, page: "blog.html", expected: true, label: "anon-public-blog" },
    { role: null, page: "portal-cms.html", expected: false, label: "anon-cms-deny" },
    { role: null, page: "portal-admin.html", expected: false, label: "anon-admin-deny" },

    // Administrador.
    { role: "administrador", page: "portal-cms.html", expected: true, label: "admin-cms-allow" },
    { role: "administrador", page: "noticias.html", expected: true, label: "admin-noticias-allow" },
    { role: "administrador", page: "campeonatos.html", expected: true, label: "admin-deportivo-allow" },
    { role: "administrador", page: "usuarios.html", expected: true, label: "admin-usuarios-allow" },

    // Operador.
    { role: "operador", page: "portal-cms.html", expected: true, label: "operador-cms-allow" },
    { role: "operador", page: "noticias.html", expected: true, label: "operador-noticias-allow" },
    { role: "operador", page: "campeonatos.html", expected: false, label: "operador-deportivo-deny" },
    { role: "operador", page: "finanzas.html", expected: false, label: "operador-finanzas-deny" },
    { role: "operador", page: "portal-tecnico.html", expected: false, label: "operador-portal-tecnico-deny" },

    // Organizador.
    { role: "organizador", page: "portal-admin.html", expected: true, label: "organizador-admin-allow" },
    { role: "organizador", page: "campeonatos.html", expected: true, label: "organizador-campeonatos-allow" },
    { role: "organizador", page: "usuarios.html", expected: true, label: "organizador-usuarios-allow" },
    { role: "organizador", page: "portal-cms.html", expected: false, label: "organizador-cms-deny" },
    { role: "organizador", page: "noticias.html", expected: false, label: "organizador-noticias-deny" },

    // Tecnico / dirigente.
    { role: "tecnico", page: "portal-tecnico.html", expected: true, label: "tecnico-portal-allow" },
    { role: "tecnico", page: "pases.html", expected: true, label: "tecnico-pases-allow" },
    { role: "tecnico", page: "campeonatos.html", expected: false, label: "tecnico-campeonatos-deny" },
    { role: "tecnico", page: "portal-cms.html", expected: false, label: "tecnico-cms-deny" },

    { role: "dirigente", page: "portal-tecnico.html", expected: true, label: "dirigente-portal-allow" },
    { role: "dirigente", page: "pases.html", expected: true, label: "dirigente-pases-allow" },
    { role: "dirigente", page: "campeonatos.html", expected: false, label: "dirigente-campeonatos-deny" },
    { role: "dirigente", page: "portal-cms.html", expected: false, label: "dirigente-cms-deny" },

    // Jugador.
    { role: "jugador", page: "portal-tecnico.html", expected: true, label: "jugador-portal-allow" },
    { role: "jugador", page: "finanzas.html", expected: true, label: "jugador-finanzas-allow" },
    { role: "jugador", page: "pases.html", expected: false, label: "jugador-pases-deny" },
    { role: "jugador", page: "campeonatos.html", expected: false, label: "jugador-campeonatos-deny" },
    { role: "jugador", page: "portal-cms.html", expected: false, label: "jugador-cms-deny" },
  ];

  const results = assertions.map((item) => {
    const currentUser = item.role ? user(item.role) : null;
    const actual = qa.canAccessPage(currentUser, item.page);
    const ok = actual === item.expected;
    return { ...item, actual, ok };
  });

  const defaultPageChecks = [
    { role: "administrador", expected: "portal-admin.html" },
    { role: "organizador", expected: "portal-admin.html" },
    { role: "operador", expected: "portal-cms.html" },
    { role: "tecnico", expected: "portal-tecnico.html" },
    { role: "dirigente", expected: "portal-tecnico.html" },
    { role: "jugador", expected: "portal-tecnico.html" },
    { role: null, expected: "login.html" },
  ].map((item) => {
    const currentUser = item.role ? user(item.role) : null;
    const actual = qa.getDefaultPageByRole(currentUser);
    const ok = actual === item.expected;
    return {
      role: item.role || "anonimo",
      label: "default-page",
      expected: item.expected,
      actual,
      ok,
    };
  });

  return { access: results, defaults: defaultPageChecks };
}

function printResults(groupName, rows) {
  rows.forEach((row) => {
    console.log(
      `${row.ok ? "PASS" : "FAIL"} | ${groupName} | ${row.label} | role=${row.role || "anonimo"} | expected=${row.expected} actual=${row.actual}`
    );
  });
}

function main() {
  const qa = loadCoreGuards();
  const results = runAssertions(qa);
  printResults("frontend-access", results.access);
  printResults("frontend-default", results.defaults);

  const total = results.access.length + results.defaults.length;
  const failed = [...results.access, ...results.defaults].filter((row) => !row.ok);
  console.log(`[frontend-guards] total=${total} passed=${total - failed.length} failed=${failed.length}`);
  if (failed.length > 0) process.exitCode = 1;
}

main();
