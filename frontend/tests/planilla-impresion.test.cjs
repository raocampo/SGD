const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearContexto, plantel, stats } = require('./helpers/planilla.cjs');

for (const tipo of ['futbol_11','futbol_9','futbol_8','futbol_7','futbol_6','futbol_5','futbol_sala','indor',
  'basquetbol','basquetbol_3x3','basquetbol_minibasket','basquetbol_callejero','voleibol']) {
  test(`${tipo}: imprime el mayor plantel, sin usar el cupo ni agregar mínimos`, () => {
    for (const [local,visitante,cupo] of [[20,15,30],[15,20,30],[15,15,30],[7,3,30],[0,15,30],[15,0,30],[0,0,30],[35,20,40],[20,15,10],[15,15,null]]) {
      const ctx = crearContexto(tipo,local,visitante,cupo);
      const cantidad = ctx.obtenerMaxFilasVistaPreviaPlanilla();
      assert.equal(cantidad,Math.max(local,visitante));
      for (const [lista,esperados] of [[ctx.fixture.plantel_local,local],[ctx.fixture.plantel_visitante,visitante]]) {
        const filas = ctx.obtenerJugadoresImpresionPlanilla(lista,cantidad);
        assert.equal(filas.length,cantidad);
        assert.equal(filas.filter(Boolean).length,esperados);
        assert.equal(filas.filter(j=>j===null).length,cantidad-esperados);
        for (const render of [ctx.renderFilasVistaPreviaEquipo,ctx.renderFilasVistaPreviaOficialEquipo]) {
          const html = render(lista,stats(),cantidad);
          assert.equal((html.match(/<tr\b/g)||[]).length,cantidad);
          assert.equal((html.match(/Apellido \d+/g)||[]).length,esperados);
        }
        const pdf = ctx.construirFilasPlantelPdf(lista,stats(),cantidad);
        assert.equal(pdf.length,cantidad+1); // incluye cabecera
        assert.equal(pdf.flat().filter(c=>/^Apellido \d+/.test(c.text)).length,esperados);
      }
    }
  });
}

test('no cuenta rellenos y conserva todos los jugadores, su orden y estadísticas', () => {
  const ctx=crearContexto();
  ctx.fixture.plantel_local=[null,{}, {id:null}, ...plantel(20).reverse()];
  assert.equal(ctx.obtenerMaxFilasVistaPreviaPlanilla(),20);
  const filas=ctx.obtenerJugadoresImpresionPlanilla(ctx.fixture.plantel_local,15);
  assert.equal(filas.length,20);
  assert.equal(filas[0].id,1);
  assert.equal(ctx.fixture.plantel_local[3].id,20); // no muta el plantel
  const eventos=stats();eventos.golesPorJugador.set(1,2);
  const pdf=ctx.construirFilasPlantelPdf(filas,eventos,20);
  assert.ok(pdf[1].some(c=>c.text==='2'));
});

test('Excel reubica el pie y las combinaciones al reducir, ampliar o vaciar el plantel', () => {
  const decode = ref => {const m=ref.match(/^([A-Z]+)(\d+)$/); return {c:m[1].charCodeAt(0)-65,r:Number(m[2])-1};};
  const encode = p => `${String.fromCharCode(p.c+65)}${p.r+1}`;
  const utils={decode_cell:decode,encode_cell:encode,
    decode_range:ref=>{const [a,b]=ref.split(':');return {s:decode(a),e:decode(b)};},
    encode_range:r=>`${encode(r.s)}:${encode(r.e)}`};
  const ctx=crearContexto('futbol_7',20,15,30,{XLSX:{utils}});
  for(const cantidad of [0,7,15,20,35]) {
    const sheet={'!ref':'B1:R49','!rows':[],'!merges':[]};
    for(let row=16;row<=30;row++) {
      sheet[`C${row}`]={t:'s',v:'',s:{border:'estilo original'}};
      sheet['!merges'].push({s:{r:row-1,c:2},e:{r:row-1,c:5}});
      sheet['!rows'][row-1]={hpt:15};
    }
    sheet.B36={t:'s',v:'Resumen de tarjetas'};
    sheet.B40={t:'s',v:'Observaciones'};
    sheet.E46={t:'s',v:'Pago arbitraje'};
    sheet['!merges'].push({s:{r:39,c:1},e:{r:41,c:8}});
    const cfg=ctx.ajustarFilasPlantelExcel(sheet,ctx.obtenerConfigExportacionPlanilla('futbol_7'),cantidad);
    const diferencia=cantidad-15;
    assert.equal(cfg.jugadores.fin-cfg.jugadores.inicio+1,cantidad);
    assert.equal(sheet[`B${36+diferencia}`].v,'Resumen de tarjetas');
    assert.equal(sheet[`B${40+diferencia}`].v,'Observaciones');
    assert.equal(cfg.pagos.arbitrajeRow,46+diferencia);
    assert.equal(sheet['!merges'].filter(m=>m.s.c===2).length,cantidad);
    assert.equal(sheet['!ref'],`B1:R${49+diferencia}`);
    if(cantidad)assert.equal(sheet[`C${15+cantidad}`].s.border,'estilo original');
  }
});
