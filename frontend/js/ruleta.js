/* frontend/js/ruleta.js
   Ruleta visual simple para sorteo de equipos. Usa canvas y un botón para girar.
*/
(function(global){
  function Ruleta(canvasId, equipos, onAsign){
    this.canvas = document.getElementById(canvasId);
    if(!this.canvas) throw new Error('Canvas no encontrado: '+canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.equipos = equipos.slice();
    this.onAsign = onAsign;
    this.angle = 0;
    this.isSpinning = false;
  }
  Ruleta.prototype.draw = function(){
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const cx = w/2, cy = h/2, r = Math.min(cx,cy)-10;
    const n = this.equipos.length || 1;
    ctx.clearRect(0,0,w,h);
    for(let i=0;i<n;i++){
      const start = (i/n)*Math.PI*2 + this.angle;
      const end = ((i+1)/n)*Math.PI*2 + this.angle;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,r,start,end);
      ctx.closePath();
      ctx.fillStyle = `hsl(${(i*360/n)},70%,60%)`;
      ctx.fill();
      ctx.save();
      ctx.translate(cx,cy);
      const mid = (start+end)/2 - this.angle;
      ctx.rotate(mid + Math.PI/2);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#111';
      ctx.font = '14px sans-serif';
      const text = (this.equipos[i] && (this.equipos[i].nombre || this.equipos[i])) || '---';
      ctx.fillText(text, r*0.6, 0);
      ctx.restore();
    }
    // marker
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(cx,5);
    ctx.lineTo(cx-10,25);
    ctx.lineTo(cx+10,25);
    ctx.closePath();
    ctx.fill();
  };
  Ruleta.prototype.spin = function(){
    if(this.isSpinning || this.equipos.length===0) return;
    this.isSpinning = true;
    const spins = 4 + Math.floor(Math.random()*3);
    const extra = Math.random()*2*Math.PI;
    const finalAngle = spins*2*Math.PI + extra;
    const duration = 4000 + Math.random()*2000;
    const start = performance.now();
    const startAngle = this.angle;
    const that = this;
    function animate(t){
      const p = Math.min(1, (t-start)/duration);
      const ease = 1 - Math.pow(1-p,3);
      that.angle = startAngle + (finalAngle*ease);
      that.draw();
      if(p<1){
        requestAnimationFrame(animate);
      } else {
        that.isSpinning = false;
        const n = that.equipos.length;
        const norm = ((-that.angle)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
        const idx = Math.floor(norm / (2*Math.PI/n));
        const equipo = that.equipos.splice(idx,1)[0];
        that.onAsign && that.onAsign(equipo);
        that.draw();
      }
    }
    requestAnimationFrame(animate);
  };

  global.Ruleta = Ruleta;
})(window);
