const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function modelo(pool) {
  const module = { exports:{} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../models/Equipo.js'),'utf8'), {
    module, require(name) {
      if(name === '../config/database')return pool;
      if(name === '../services/planLimits')return {obtenerPlan:()=>({max_equipos_por_campeonato:null})};
      throw new Error('Unexpected dependency');
    },
  });
  return module.exports;
}

test('listar un campeonato con huecos no renumera ni abre una transacción de escritura', async()=>{
  const calls=[];
  const rows=[{id:1,numero_campeonato:1},{id:2,numero_campeonato:5}];
  const Equipo=modelo({async query(sql){calls.push(sql);return {rows};},async connect(){throw new Error('READ_MUST_NOT_CONNECT_TRANSACTION');}});
  Equipo._esquemaAsegurado=true;
  assert.equal(await Equipo.obtenerPorCampeonato(22),rows);
  assert.equal(calls.length,1);
  assert.doesNotMatch(calls.join('\n'),/UPDATE|INSERT|DELETE|FOR UPDATE|BEGIN/i);
});

test('un fallo al asignar números revierte la transacción y libera la conexión',async()=>{
  const calls=[];
  const client={async query(sql){
    calls.push(sql);
    if(sql.includes('SELECT id, numero_campeonato'))return {rows:[{id:1,numero_campeonato:5}]};
    if(sql.includes('UNNEST'))throw new Error('FALLO_SIMULADO');
    return {rows:[]};
  },release(){calls.push('RELEASE');}};
  const Equipo=modelo({connect:async()=>client});
  await assert.rejects(Equipo.reordenarNumeracionCampeonato(22),/FALLO_SIMULADO/);
  assert.ok(calls.some(sql=>sql.includes('SET numero_campeonato = NULL')));
  assert.deepEqual(calls.slice(-2),['ROLLBACK','RELEASE']);
  assert.ok(!calls.includes('COMMIT'));
});

test('PostgreSQL local: índice único, transacciones y concurrencia', {
  skip:process.env.SGD_TEST_LOCAL_DB !== '1',
},async(t)=>{
  // Activación explícita; nunca toma DATABASE_URL ni las credenciales productivas.
  const dotenv=require('dotenv');
  const {Pool}=require('pg');
  const vars=dotenv.parse(fs.readFileSync(path.join(__dirname,'../.env')));
  const host=vars.DB_HOST || 'localhost';
  assert.ok(['localhost','127.0.0.1','::1'].includes(host),'Solo se permite PostgreSQL local');
  const config={host,port:Number(vars.DB_PORT || 5432),user:vars.DB_USER || 'postgres',password:vars.DB_PASSWORD,database:vars.DB_NAME,connectionTimeoutMillis:5000};
  const schema=`qa_equipos_${Date.now()}_${process.pid}`;
  assert.match(schema,/^qa_equipos_\d+_\d+$/);
  const admin=new Pool(config);
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool=new Pool({...config,max:5,options:`-c search_path=${schema}`});
  t.after(async()=>{await pool.end();try{await admin.query(`DROP SCHEMA "${schema}" CASCADE`);}finally{await admin.end();}});
  await pool.query(`
    CREATE TABLE usuarios(id INTEGER PRIMARY KEY,plan_codigo TEXT);
    CREATE TABLE campeonatos(id SERIAL PRIMARY KEY,nombre TEXT,max_equipos INTEGER,creador_usuario_id INTEGER REFERENCES usuarios(id));
    CREATE TABLE equipos(id SERIAL PRIMARY KEY,campeonato_id INTEGER REFERENCES campeonatos(id),nombre TEXT,
      director_tecnico TEXT,asistente_tecnico TEXT,medico TEXT,color_equipo TEXT,color_primario TEXT,color_secundario TEXT,
      color_terciario TEXT,telefono TEXT,email TEXT,logo_url TEXT,cabeza_serie BOOLEAN,numero_campeonato INTEGER);
    CREATE UNIQUE INDEX idx_equipos_numero_campeonato ON equipos(campeonato_id,numero_campeonato) WHERE numero_campeonato IS NOT NULL;
  `);
  const Equipo=modelo(pool);
  Equipo._esquemaAsegurado=true;
  async function reset(numeros=[8,7,6,5,3,2,1]) {
    await pool.query('TRUNCATE equipos,campeonatos RESTART IDENTITY CASCADE');
    await pool.query("INSERT INTO campeonatos(id,nombre,max_equipos) VALUES (1,'Principal',100),(2,'Otro',100)");
    for(const numero of numeros)await pool.query('INSERT INTO equipos(campeonato_id,nombre,numero_campeonato) VALUES(1,$1,$2)',['Equipo '+numero,numero]);
    await pool.query("INSERT INTO equipos(campeonato_id,nombre,numero_campeonato) VALUES(2,'Ajeno',1)");
  }
  const filas=async()=> (await pool.query('SELECT id,campeonato_id,nombre,numero_campeonato FROM equipos ORDER BY id')).rows;
  const consecutivos=async()=> (await pool.query('SELECT numero_campeonato FROM equipos WHERE campeonato_id=1 ORDER BY numero_campeonato')).rows.map(r=>r.numero_campeonato);

  await t.test('reproduce la colisión inmediata y renumera sin quitar el índice',async()=>{
    await reset();
    const c=await pool.connect();
    try {
      await c.query('BEGIN');
      // Forzar recorrido físico descendente de los números: la consulta
      // defectuosa no puede depender de que el planificador elija otro orden.
      await c.query('SET LOCAL enable_indexscan=off');
      await c.query('SET LOCAL enable_bitmapscan=off');
      await assert.rejects(c.query('UPDATE equipos SET numero_campeonato=numero_campeonato-1 WHERE campeonato_id=1 AND numero_campeonato>3'),e=>e.code==='23505');
    } finally { await c.query('ROLLBACK');c.release(); }
    const antes=await filas();
    await Equipo.reordenarNumeracionCampeonato(1);
    assert.deepEqual(await consecutivos(),[1,2,3,4,5,6,7]);
    assert.deepEqual((await filas()).map(r=>r.id),antes.map(r=>r.id));
    assert.deepEqual((await filas()).filter(r=>r.campeonato_id===2),antes.filter(r=>r.campeonato_id===2));
    const unaVez=await filas();await Equipo.reordenarNumeracionCampeonato(1);assert.deepEqual(await filas(),unaVez);
  });
  await t.test('la consulta funciona en READ ONLY y conserva los números originales',async()=>{
    await reset();const antes=await filas();const c=await pool.connect();
    try{
      await c.query('BEGIN READ ONLY');
      const lector=modelo({query:c.query.bind(c)});lector._esquemaAsegurado=true;
      assert.equal((await lector.obtenerPorCampeonato(1)).length,7);
      await c.query('ROLLBACK');
    }finally{c.release();}
    assert.deepEqual(await filas(),antes);
  });
  await t.test('crear, editar y eliminar sobre huecos guardan y devuelven la numeración final',async()=>{
    await reset();
    const nuevo=await Equipo.crear(1,'Nuevo');
    assert.equal(nuevo.numero_campeonato,8);
    assert.deepEqual(await consecutivos(),[1,2,3,4,5,6,7,8]);
    await reset();
    const editado=await Equipo.actualizar(1,{nombre:'Editado'});
    assert.equal(editado.nombre,'Editado');assert.equal(editado.numero_campeonato,7);
    await reset();
    const eliminado=await Equipo.eliminar(1);assert.equal(eliminado.id,1);
    assert.deepEqual(await consecutivos(),[1,2,3,4,5,6]);
  });
  for(const operacion of ['crear','actualizar','eliminar']) {
    await t.test(`rollback completo de ${operacion} si falla el renumerado`,async()=>{
      await reset();const antes=await filas();
      const defectuoso=modelo({query:pool.query.bind(pool),async connect(){
        const c=await pool.connect();
        return {query(sql,params){if(sql.includes('UNNEST'))return Promise.reject(new Error('FALLO_INYECTADO'));return c.query(sql,params);},release:()=>c.release()};
      }});defectuoso._esquemaAsegurado=true;
      const ejecutar=operacion==='crear'?()=>defectuoso.crear(1,'No persistir'):
        operacion==='actualizar'?()=>defectuoso.actualizar(1,{nombre:'No persistir'}):()=>defectuoso.eliminar(1);
      await assert.rejects(ejecutar(),/FALLO_INYECTADO/);
      assert.deepEqual(await filas(),antes);
    });
  }
  await t.test('traslado a un campeonato que ya ocupa el número conserva ambos consecutivos',async()=>{
    await reset();
    await pool.query('INSERT INTO equipos(campeonato_id,nombre,numero_campeonato) VALUES (2,$1,8)',['Otro 8']);
    const movido=await Equipo.actualizar(1,{campeonato_id:2});
    assert.equal(movido.campeonato_id,2);assert.equal(movido.numero_campeonato,3);
    assert.deepEqual(await consecutivos(),[1,2,3,4,5,6]);
  });
  await t.test('altas simultáneas se serializan sin duplicar números y respetan el cupo',async()=>{
    await reset([1]);
    const resultados=await Promise.all([Equipo.crear(1,'A'),Equipo.crear(1,'B'),Equipo.crear(1,'C')]);
    assert.equal(new Set(resultados.map(r=>r.numero_campeonato)).size,3);
    assert.deepEqual(await consecutivos(),[1,2,3,4]);
    await pool.query('UPDATE campeonatos SET max_equipos=5 WHERE id=1');
    const limitados=await Promise.allSettled([Equipo.crear(1,'Último A'),Equipo.crear(1,'Último B')]);
    assert.equal(limitados.filter(r=>r.status==='fulfilled').length,1);
    assert.deepEqual(await consecutivos(),[1,2,3,4,5]);
  });
  await t.test('inicializar registros sin número no cambia ni colisiona con números existentes',async()=>{
    await reset([1,3]);
    await pool.query("INSERT INTO equipos(campeonato_id,nombre) VALUES (1,'Legado')");
    Equipo._esquemaAsegurado=false;await Equipo.asegurarEsquema();
    assert.deepEqual(await consecutivos(),[1,3,4]);
  });
});
