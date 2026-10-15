// Regresión de publicación sin base de datos ni credenciales.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

async function main() {
  let filtro = null;
  const partidos = [
    { id: 1, jornada: 1, estado: 'finalizado', resultado_local: 2, resultado_visitante: 1 },
    { id: 2, jornada: 2, estado: 'programado' },
    { id: 3, jornada: null, playoff_ronda: 'final', estado: 'programado' },
  ];
  const service = { module: { exports: {} }, require(name) {
    if (name === '../config/database') return { query: async () => ({ rows: [{ id: 34, campeonato_estado: 'en_curso', portal_jornadas_habilitadas: filtro }] }) };
    if (name === '../models/Partido') return { obtenerPorEvento: async () => partidos };
    return {};
  } };
  vm.runInNewContext(read('backend/services/publicPortalService.js'), service);
  const obtener = service.module.exports.obtenerPartidosPublicosPorEvento;
  let data = await obtener(34);
  assert.deepEqual(Array.from(data.partidos, p => p.id), [1, 2, 3]);
  assert.equal(data.publicacion_restringida, false);
  filtro = [];
  data = await obtener(34);
  assert.deepEqual(Array.from(data.partidos, p => p.id), [3]); // Playoff conserva su publicación.
  assert.equal(data.publicacion_restringida, true);
  filtro = [1];
  data = await obtener(34);
  assert.deepEqual(Array.from(data.partidos, p => p.id), [1, 3]);

  let checkboxes = [];
  const lista = { querySelectorAll: () => checkboxes, set innerHTML(html) {
    checkboxes = Array.from(html.matchAll(/<input[^>]*value="(\d+)"([^>]*)>/g), m => ({
      value: m[1], checked: /\bchecked\b/.test(m[2]), addEventListener() {},
    }));
  } };
  const elements = { 'op-jornadas-lista': lista };
  let saved;
  const document = { addEventListener() {}, getElementById: id => elements[id] ||= { style: {} }, querySelectorAll: () => checkboxes };
  const window = { mostrarNotificacion() {}, OrganizadorPortalAPI: { guardarJornadasPortal: async (id, value) => {
    saved = value; return { jornadas_habilitadas: value };
  } } };
  let source = read('frontend/js/organizador-portal.js');
  const end = source.lastIndexOf('})();');
  source = source.slice(0, end) + 'window.qa = { state, renderJornadasLista, guardarJornadasPortal };\n' + source.slice(end);
  vm.runInNewContext(source, { document, window, console });
  const qa = window.qa;
  qa.state.jornadasEvento = { eventoId: 34, jornadasDisponibles: [1, 2], jornadasHabilitadas: null };
  qa.renderJornadasLista();
  assert.equal(checkboxes.every(c => c.checked), true);
  await qa.guardarJornadasPortal();
  assert.equal(saved, null); // Guardar sin cambios no oculta nada ni excluye jornadas futuras.
  checkboxes[1].checked = false;
  await qa.guardarJornadasPortal();
  assert.deepEqual(Array.from(saved), [1]);
  qa.state.jornadasEvento.jornadasHabilitadas = [];
  qa.renderJornadasLista();
  assert.equal(checkboxes.every(c => !c.checked), true);
  await qa.guardarJornadasPortal();
  assert.equal(saved.length, 0); // Ocultar intencionalmente sigue disponible.

  const browser = {
    window: { API_BASE_URL: 'https://api.example.test/api', location: { origin: 'https://example.test', pathname: '/portal.html' }, addEventListener() {} },
    document: { addEventListener() {} }, console: { error() {} },
    fetch: async () => ({ ok: false, status: 500 }), URLSearchParams, Map, Set,
  };
  vm.createContext(browser);
  vm.runInContext(read('frontend/js/portal.js'), browser);
  for (const logo of ['/uploads/equipos/logo.png', 'uploads/equipos/logo.png']) {
    browser.logoPrueba = logo;
    const html = vm.runInContext('renderLogoEquipoPortal(logoPrueba, "Equipo")', browser);
    assert.ok(html.includes('src="https://api.example.test/uploads/equipos/logo.png"'));
  }
  assert.ok(vm.runInContext('renderLogoEquipoPortal("https://cdn.example.test/logo.png", "Equipo")', browser)
    .includes('src="https://cdn.example.test/logo.png"'));
  assert.ok(vm.runInContext('renderLogoEquipoPortal(null, "Equipo")', browser)
    .includes('portal-match-logo-placeholder">E</span>'));
  assert.ok(!vm.runInContext('renderLogoEquipoPortal("   ", "Equipo")', browser).includes('<img'));
  assert.ok(vm.runInContext('renderLogoEquipoPortal("/uploads/equipos/logo.png", "Equipo")', browser)
    .includes('textContent:this.dataset.inicial'));
  let result = await vm.runInContext('cargarPartidosPublicosPortal(34)', browser);
  assert.equal(result.errorCarga, true);
  browser.fetch = async () => ({ ok: true, json: async () => ({ error: 'fallo' }) });
  result = await vm.runInContext('cargarPartidosPublicosPortal(34)', browser);
  assert.equal(result.errorCarga, true);
  browser.fetch = async () => ({ ok: true, json: async () => ({ ok: true, jornadas: [], partidos: [] }) });
  result = await vm.runInContext('cargarPartidosPublicosPortal(34)', browser);
  assert.equal(result.errorCarga, undefined);
  const restringido = vm.runInContext('renderCategoriaPanelPortal({evento:{id:34}, publicacionRestringida:true, partidos:[]})', browser);
  assert.ok(restringido.includes('El organizador no ha habilitado'));
  const fallido = vm.runInContext('renderCategoriaPanelPortal({evento:{id:34}, errorPartidos:true})', browser);
  assert.ok(fallido.includes('No se pudieron cargar las jornadas'));
  assert.ok(!fallido.includes('No hay jornadas publicadas'));
  console.log('PASS: filtros null/[]/parcial, playoff, casillas, guardado, errores de carga y logos con backend separado.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
