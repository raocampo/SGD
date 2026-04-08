# Plan: Módulo de Transmisión Deportiva en Vivo — SGD LT&C

Elaborado: 2026-04-08
Estado: **PLANIFICADO — listo para implementar**

---

## Contexto

El sistema ya tiene un módulo básico de transmisiones (`transmisiones.html`) que solo gestiona
links de YouTube/Facebook. El objetivo es convertirlo en un sistema de producción deportiva
similar a Prism Live o Restream: overlays gráficos en tiempo real, transmisión desde cámara
de PC o celular, y compartir en redes sociales.

### ¿Qué es Render y por qué importa?

**Render** es el servicio de hosting donde vive la aplicación (`ltyc.onrender.com`).
El plan actual es gratuito (Free). Esto significa:
- RAM: 512 MB — suficiente para lógica de negocio y mensajes en tiempo real
- CPU: compartida — suficiente para Socket.io (mensajes JSON pequeños)
- **NO suficiente** para transcodificar/procesar video (eso requeriría un servidor dedicado caro)

**El plan diseñado funciona 100% en el plan gratuito actual.** El video nunca pasa por
el servidor de Render — viaja directamente entre la cámara del organizador y los espectadores
(tecnología WebRTC, P2P). Render solo actúa de "intermediario de mensajes" para establecer
la conexión (signaling), lo cual es muy liviano.

---

## Qué hay implementado actualmente

- Tabla `partido_transmisiones`: CRUD, estados (programada/en_vivo/finalizada), destacado, embed_url
- Página `transmisiones.html`: lista transmisiones por campeonato, tabs Activas/Todas/Programadas
- Modal editar transmisión: plataforma, URL pública, URL embed, título, fecha programada
- Endpoints: listar, actualizar, iniciar, finalizar, cancelar, destacar, endpoints públicos
- **Lo que NO tiene**: nada en tiempo real, no overlays, no cámara, no compartir

---

## Arquitectura General

```
[Organizador/Director en browser]          [Servidor Render]           [OBS / Viewers]
         |                                        |                            |
         | Socket.io: "cambia marcador 1-0"       |                            |
         |--------------------------------------->|                            |
         |                                        | Socket.io broadcast        |
         |                                        |--------------------------->|
         |                                        |               overlay.html (Browser Source OBS)
         |                                        |               portal.html (espectadores)
         |
[Cámara PC/Celular]
         |
         | WebRTC P2P (video directo, NO pasa por Render)
         |<============================================> [Viewer en portal]
```

---

## Fase 1: Overlays / Gráficos en Tiempo Real ⭐ (PRIORIDAD ALTA)

### Qué es
El organizador controla desde un panel qué se muestra sobre el video en tiempo real:
marcador, minuto, alineaciones, banners publicitarios, texto de evento ("¡GOL!", "TARJETA ROJA").

Esto se integra con OBS (software gratuito de streaming) vía "Browser Source": OBS
captura la página de overlay como capa transparente sobre el video.

### Nuevas tablas BD

**`transmision_overlay_state`** (una fila por transmisión):
```sql
-- database/migrations/064_transmision_overlay.sql
CREATE TABLE IF NOT EXISTS transmision_overlay_state (
  id                    SERIAL PRIMARY KEY,
  transmision_id        INTEGER NOT NULL REFERENCES partido_transmisiones(id) ON DELETE CASCADE,
  marcador_local        INTEGER NOT NULL DEFAULT 0,
  marcador_visitante    INTEGER NOT NULL DEFAULT 0,
  minuto                INTEGER,
  periodo               VARCHAR(30) DEFAULT 'primer_tiempo',
  -- primer_tiempo | segundo_tiempo | tiempo_extra | penales | descanso
  mostrar_marcador      BOOLEAN NOT NULL DEFAULT TRUE,
  mostrar_alineacion    BOOLEAN NOT NULL DEFAULT FALSE,
  mostrar_banner_pub    BOOLEAN NOT NULL DEFAULT FALSE,
  alineacion_local      JSONB,   -- [{numero, nombre, posicion}]
  alineacion_visitante  JSONB,
  banner_texto          TEXT,
  banner_url_imagen     TEXT,
  evento_texto          TEXT,    -- "¡GOL!", "TARJETA ROJA", texto libre
  mostrar_evento        BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(transmision_id)
);
```

**Columnas adicionales en `partido_transmisiones`**:
```sql
-- database/migrations/065_transmisiones_overlay_token.sql
ALTER TABLE partido_transmisiones
  ADD COLUMN IF NOT EXISTS overlay_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS director_token UUID DEFAULT gen_random_uuid();
```
- `overlay_token`: URL pública sin login para OBS → `/overlay?token=UUID`
- `director_token`: identifica el "room" Socket.io del director

### Nuevos endpoints API

```
GET  /api/transmisiones/:id/overlay          → estado actual del overlay (auth: admin/organizador)
PUT  /api/transmisiones/:id/overlay          → actualizar overlay + emite Socket.io (auth)
POST /api/transmisiones/:id/overlay/reset    → reiniciar a cero (auth)
GET  /api/public/overlay/:overlay_token      → estado overlay por token (sin auth, para OBS/portal)
```

### Nuevas páginas frontend

**`frontend/director.html`** — Panel del director (requiere login):
- Selector de transmisión activa
- Controles de marcador: botones +1 / -1 por equipo
- Selector de minuto y periodo
- Toggles: mostrar marcador / alineación / banner publicitario
- Editor de alineación (carga jugadores del partido automáticamente)
- Campo texto de evento + botón "Limpiar" (auto-desaparece a los 5 segundos)
- URL del Browser Source para copiar (botón copiar)
- Preview en tiempo real del overlay (iframe embebido)

**`frontend/overlay.html`** — Browser Source para OBS (URL pública, sin login):
- Fondo transparente (`background: transparent`) — OBS lo superpone sobre el video
- Escucha Socket.io y actualiza en tiempo real
- Diseño tipo broadcast deportivo: fuentes bold, colores del equipo, animaciones

### Nuevos archivos backend

```
backend/models/TransmisionOverlay.js       ← CRUD de transmision_overlay_state
backend/controllers/overlayController.js   ← GET/PUT/POST overlay + emite Socket.io
backend/routes/overlayRoutes.js            ← monta rutas
backend/services/socketService.js          ← inicializa Socket.io, maneja rooms
```

### Cambio crítico en server.js

```js
// ANTES:
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));

// DESPUÉS:
const { createServer } = require('http');
const { initSocket }   = require('./services/socketService');
const httpServer = createServer(app);
initSocket(httpServer);
httpServer.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
```

### Dependencia npm a instalar

```bash
npm install socket.io
```
El cliente de Socket.io se sirve automáticamente en `/socket.io/socket.io.js` — no hay que
instalar nada en el frontend.

---

## Fase 2: Transmisión desde Cámara (WebRTC)

### Qué es
La cámara del PC o del celular (cualquier browser moderno, sin instalar nada) transmite
en vivo al portal deportivo. El video viaja P2P directamente entre el broadcaster y los
espectadores — Render solo intercambia mensajes pequeños de "establecimiento de conexión".

### Límite de viewers
WebRTC P2P funciona bien hasta ~12-15 espectadores simultáneos. Si hay más, el sistema
cambia automáticamente a mostrar el embed de YouTube/Facebook (fallback).

### Tecnología STUN/TURN
- **STUN** (Google, gratuito): permite que las cámaras detrás de routers descubran su IP pública. Cubre ~80% de los casos.
- **TURN** (Metered.ca, gratuito hasta cierto volumen): para redes corporativas estrictas que bloquean P2P.

### Nueva tabla BD

```sql
-- database/migrations/066_transmision_webrtc.sql
CREATE TABLE IF NOT EXISTS transmision_webrtc_sessions (
  id               SERIAL PRIMARY KEY,
  transmision_id   INTEGER NOT NULL REFERENCES partido_transmisiones(id) ON DELETE CASCADE,
  broadcaster_socket_id VARCHAR(100),
  viewer_count     INTEGER NOT NULL DEFAULT 0,
  iniciada_at      TIMESTAMPTZ,
  finalizada_at    TIMESTAMPTZ,
  activa           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Nuevo endpoint

```
GET /api/public/partidos/:partidoId/stream-mode
→ { modo: 'webrtc' | 'embed' | 'ninguno', embed_url?, webrtc_transmision_id?, viewer_count? }
```

### Nuevas páginas frontend

**`frontend/broadcaster.html`** — Panel del broadcaster (requiere login):
- Botón "Activar cámara" (`getUserMedia`)
- Preview de la cámara local
- Selector de calidad: 720p / 480p / 360p
- Botón "Transmitir en vivo" (conecta con viewers vía WebRTC)
- Indicador de viewers conectados en tiempo real
- Compatible con celular: usa cámara trasera (`facingMode: 'environment'`)

**Widget en portal público** (`portal.html`):
- Si `modo === 'webrtc'` → muestra `<video>` WebRTC
- Si `modo === 'embed'` → muestra `<iframe>` de YouTube/Facebook
- Overlay de marcador superpuesto (de Fase 1)

### Rooms WebRTC en Socket.io

```
Rooms: webrtc:{transmision_id}

Broadcaster emite:  'broadcaster:join', 'broadcaster:offer', 'broadcaster:ice'
Viewer emite:       'viewer:join', 'viewer:answer', 'viewer:ice'
Servidor emite:     'broadcaster:available', 'broadcaster:gone', 'viewer:joined'
```

**Sin dependencias npm adicionales** — WebRTC es nativo del browser.

---

## Fase 3: Compartir en Redes Sociales + Instrucciones OBS

### Botones de compartir (frontend only)

```
WhatsApp:   https://wa.me/?text=TEXTO+URL
Facebook:   https://www.facebook.com/sharer/sharer.php?u=URL
Twitter/X:  https://twitter.com/intent/tweet?text=TEXTO&url=URL
Copiar:     navigator.clipboard.writeText(url)
```

Texto generado automáticamente:
```
"Sigue el partido EN VIVO: {equipo_local} vs {equipo_visitante}
{campeonato} — Jornada {jornada}
📅 {fecha_hora}
▶ Ver aquí: {url}"
```

### Panel instrucciones OBS en director.html

Sección colapsable con pasos para que el organizador configure OBS:
1. Descargar OBS Studio (gratuito)
2. Configuración → Stream → Servicio: Custom / YouTube / Facebook
3. Pegar la stream key de su cuenta de YouTube/Facebook Studio
4. Agregar "Browser Source" → pegar la URL del overlay (`/overlay?token=xxx`)
5. Ajustes recomendados: 720p30, bitrate 2500 kbps

---

## Resumen de archivos nuevos

### Backend
```
backend/services/socketService.js
backend/models/TransmisionOverlay.js
backend/controllers/overlayController.js
backend/routes/overlayRoutes.js
backend/controllers/webrtcController.js   (Fase 2)
backend/routes/webrtcRoutes.js            (Fase 2)
```

### Frontend
```
frontend/director.html
frontend/overlay.html
frontend/broadcaster.html                 (Fase 2)
frontend/js/director.js
frontend/js/overlay.js
frontend/js/broadcaster.js               (Fase 2)
frontend/js/webrtc-viewer.js             (Fase 2)
```

### Migraciones
```
database/migrations/064_transmision_overlay.sql
database/migrations/065_transmisiones_overlay_token.sql
database/migrations/066_transmision_webrtc.sql          (Fase 2)
```

### Modificaciones en archivos existentes
```
backend/server.js                   ← app.listen → httpServer.listen + initSocket
backend/models/PartidoTransmision.js ← agregar overlay_token, director_token
frontend/transmisiones.html         ← columna "Director" + URL Browser Source
frontend/js/api.js                  ← métodos overlay y stream-mode
frontend/portal.html / portal.js    ← widget de video + overlay superpuesto (Fase 2)
```

---

## Orden de implementación

### Sesión próxima — Fase 1 completa:
1. `npm install socket.io`
2. `socketService.js` + modificar `server.js`
3. Migración 064 + 065
4. `TransmisionOverlay.js` + `overlayController.js` + `overlayRoutes.js`
5. `overlay.html` + `overlay.js` (fondo transparente, Socket.io listener)
6. `director.html` + `director.js` (panel control, Socket.io emitter)
7. CSS broadcast: marcador, logos equipos, animación GOL!
8. Botón "Director" en `transmisiones.html`

### Sesión siguiente — Fase 2:
9. Rooms WebRTC en `socketService.js`
10. `broadcaster.html` + `broadcaster.js`
11. Widget viewer en portal + fallback embed
12. Endpoint `stream-mode`

### Sesión final — Fase 3:
13. Botones compartir en portal
14. Panel instrucciones OBS en `director.html`
15. CSS responsive broadcaster para celular

---

## Lo que NO se implementará (fuera de alcance)

- ❌ Servidor RTMP propio (requeriría servidor dedicado caro, $50+/mes)
- ❌ Transcodificación de video en Render
- ❌ Chat en vivo (fuera del alcance actual)
- ❌ Grabación de transmisiones en servidor
- ❌ Más de 15 viewers WebRTC (se usa fallback a YouTube/Facebook embed)
- ❌ Almacenar stream keys de YouTube/Facebook en la BD (el usuario las ingresa en OBS directamente)
