const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function plantel(cantidad, lado = 'Local') {
  return Array.from({ length:cantidad }, (_, i) => ({
    id:i + (lado === 'Local' ? 1 : 1001), apellido:`Apellido ${String(i+1).padStart(2,'0')}`,
    nombre:lado, numero_camiseta:i+1, equipo_id:lado === 'Local' ? 1 : 2,
  }));
}

function crearContexto(tipo = 'futbol_7', local = 20, visitante = 15, maximo = 30, extras = {}) {
  const context = vm.createContext({
    console, URLSearchParams, Blob, URL, setTimeout, clearTimeout,
    document:{addEventListener(){},getElementById(){return null;},querySelectorAll(){return [];}},
    window:{location:{search:'',pathname:'/planilla.html'},setTimeout(){}},
    ...extras,
  });
  vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../js/planilla.js'),'utf8'),context);
  context.fixture = {
    partido:{id:123,tipo_futbol:tipo,tipo_deporte:tipo,max_jugador:maximo,fecha_partido:'2026-10-22',hora_partido:'15:00',
      evento_nombre:'Categoría de prueba',campeonato_nombre:'Campeonato de prueba',campeonato_organizador:'LT&C',
      equipo_local_nombre:'Local',equipo_visitante_nombre:'Visitante'},
    plantel_local:plantel(local),plantel_visitante:plantel(visitante,'Visitante'),planilla:{},
  };
  vm.runInContext("dataPlanilla=fixture; equiposPartido={local:{id:1,nombre:'Local'},visitante:{id:2,nombre:'Visitante'}}",context);
  return context;
}

const stats = () => ({golesPorJugador:new Map(),amarillasPorJugador:new Map(),rojasPorJugador:new Map()});
module.exports = { crearContexto, plantel, stats };
