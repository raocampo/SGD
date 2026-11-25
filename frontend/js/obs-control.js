// frontend/js/obs-control.js
// Cliente mínimo de OBS WebSocket v5 (incluido en OBS Studio 28+).
// Permite al Panel de Director mostrar/ocultar y reproducir los videos e
// imágenes que están en la computadora que transmite (fuentes de OBS), sin
// subirlos al servidor. La conexión es local: ws://localhost:4455.
//
// Protocolo: Hello (op 0) → Identify (op 1, con autenticación SHA-256 si
// hay contraseña) → Identified (op 2). Peticiones op 6 / respuestas op 7.
// Eventos op 5.

(() => {
  const OP = { HELLO: 0, IDENTIFY: 1, IDENTIFIED: 2, EVENT: 5, REQUEST: 6, RESPONSE: 7 };
  // General | Scenes | Inputs | SceneItems | MediaInputs
  const SUSCRIPCIONES = 1 | 4 | 8 | 128 | 256;

  async function sha256Base64(texto) {
    const datos = new TextEncoder().encode(texto);
    const hash = await crypto.subtle.digest("SHA-256", datos);
    let binario = "";
    new Uint8Array(hash).forEach((b) => { binario += String.fromCharCode(b); });
    return btoa(binario);
  }

  class ObsControl {
    constructor() {
      this.ws = null;
      this.pendientes = new Map();
      this.oyentes = new Map();
      this.conectado = false;
      this.contador = 0;
    }

    on(evento, cb) {
      if (!this.oyentes.has(evento)) this.oyentes.set(evento, new Set());
      this.oyentes.get(evento).add(cb);
    }

    emitir(evento, datos) {
      (this.oyentes.get(evento) || []).forEach((cb) => {
        try { cb(datos); } catch (e) { console.error(e); }
      });
    }

    conectar(url, password = "") {
      this.desconectar();
      return new Promise((resolve, reject) => {
        let ws;
        try {
          ws = new WebSocket(url, "obswebsocket.json");
        } catch (err) {
          reject(new Error("Dirección inválida. Usa, por ejemplo, ws://localhost:4455"));
          return;
        }
        this.ws = ws;
        let identificado = false;
        const tiempo = setTimeout(() => {
          if (!identificado) {
            try { ws.close(); } catch (_) {}
            reject(new Error("OBS no respondió. ¿Está abierto y con el servidor WebSocket activado?"));
          }
        }, 8000);

        ws.onmessage = async (ev) => {
          let msg;
          try { msg = JSON.parse(ev.data); } catch (_) { return; }
          if (msg.op === OP.HELLO) {
            const identify = { rpcVersion: 1, eventSubscriptions: SUSCRIPCIONES };
            const auth = msg.d?.authentication;
            if (auth) {
              if (!password) {
                clearTimeout(tiempo);
                reject(new Error("OBS pide contraseña: cópiala de Herramientas → Ajustes del servidor WebSocket."));
                try { ws.close(); } catch (_) {}
                return;
              }
              const secreto = await sha256Base64(password + auth.salt);
              identify.authentication = await sha256Base64(secreto + auth.challenge);
            }
            ws.send(JSON.stringify({ op: OP.IDENTIFY, d: identify }));
          } else if (msg.op === OP.IDENTIFIED) {
            identificado = true;
            this.conectado = true;
            clearTimeout(tiempo);
            resolve(msg.d);
            this.emitir("conectado", msg.d);
          } else if (msg.op === OP.RESPONSE) {
            const p = this.pendientes.get(msg.d?.requestId);
            if (!p) return;
            this.pendientes.delete(msg.d.requestId);
            if (msg.d.requestStatus?.result) p.resolve(msg.d.responseData || {});
            else p.reject(new Error(msg.d.requestStatus?.comment || `OBS rechazó ${msg.d.requestType}`));
          } else if (msg.op === OP.EVENT) {
            this.emitir(msg.d?.eventType, msg.d?.eventData || {});
          }
        };

        ws.onclose = (ev) => {
          const estaba = this.conectado;
          this.conectado = false;
          this.pendientes.forEach((p) => p.reject(new Error("Conexión con OBS cerrada")));
          this.pendientes.clear();
          if (!identificado) {
            clearTimeout(tiempo);
            // 4009: autenticación fallida (código de OBS WebSocket).
            reject(new Error(ev.code === 4009
              ? "Contraseña de OBS incorrecta."
              : "No se pudo conectar con OBS. Revisa que esté abierto, con el servidor WebSocket activado y en esta misma computadora."));
          }
          if (estaba) this.emitir("desconectado", { code: ev.code });
        };

        ws.onerror = () => { /* el cierre informa el motivo */ };
      });
    }

    desconectar() {
      if (this.ws) {
        try { this.ws.onclose = null; this.ws.close(); } catch (_) {}
      }
      const estaba = this.conectado;
      this.ws = null;
      this.conectado = false;
      this.pendientes.clear();
      if (estaba) this.emitir("desconectado", {});
    }

    request(requestType, requestData = {}) {
      if (!this.ws || !this.conectado) return Promise.reject(new Error("No hay conexión con OBS"));
      const requestId = `sgd-${Date.now()}-${++this.contador}`;
      return new Promise((resolve, reject) => {
        this.pendientes.set(requestId, { resolve, reject });
        this.ws.send(JSON.stringify({ op: OP.REQUEST, d: { requestType, requestId, requestData } }));
        setTimeout(() => {
          if (this.pendientes.has(requestId)) {
            this.pendientes.delete(requestId);
            reject(new Error(`OBS no respondió a ${requestType}`));
          }
        }, 8000);
      });
    }
  }

  window.ObsControl = ObsControl;
})();
