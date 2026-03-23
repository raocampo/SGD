# Plan De Transmision De Partidos

Fecha: 2026-03-22

## Objetivo

Permitir que el organizador configure y lance transmisiones de partidos desde SGD, con visibilidad en el portal publico y capacidad de retransmitir a redes sociales.

## Recomendacion de MVP

No conviene montar un servidor propio de video en esta primera fase. El camino mas seguro es:

1. SGD administra la configuracion de la transmision.
2. El organizador transmite con OBS / StreamYard / Restream.
3. SGD publica el estado `En vivo`, el enlace y los datos del partido.
4. La retransmision a redes sociales se delega a un proveedor especializado.

## Flujo propuesto

1. El organizador programa un partido para transmision.
2. El sistema crea o guarda una configuracion de stream:
   - titulo
   - descripcion
   - plataforma principal
   - url publica
   - estado
   - hora de inicio real
3. El portal publico muestra:
   - badge `En vivo`
   - boton `Ver transmision`
   - embebido opcional si la plataforma lo permite
4. Al finalizar, el organizador marca la transmision como cerrada y queda el enlace al replay si existe.

## Arquitectura recomendada

### Fase 1: Enlace y embebido

- Tabla `partido_transmisiones`
- Configuracion por campeonato / evento para branding de stream
- Enlace manual a:
  - YouTube Live
  - Facebook Live
  - Twitch
  - StreamYard / Restream page

Ventaja:
- implementacion rapida
- sin costo de video hosting propio
- muy baja complejidad operativa

### Fase 2: Panel operativo de stream

- Dashboard de transmisiones del organizador
- estados:
  - borrador
  - programada
  - en_vivo
  - finalizada
  - cancelada
- cronologia por partido
- boton de destacado en landing / portal

### Fase 3: Restream a redes

Proveedor sugerido para MVP operativo:

- Restream o StreamYard

Razon:
- un solo origen de video
- salida simultanea a Facebook / YouTube
- overlays simples
- menor carga de soporte para el organizador

### Fase 4: Ingesta propia avanzada

Solo si el volumen lo justifica:

- Cloudflare Stream
- Mux
- Livepeer

Esto ya implica:
- costos por almacenamiento y egreso
- moderacion
- mas observabilidad
- mayor mantenimiento

## Cambios de backend sugeridos

### Nueva tabla

`partido_transmisiones`

Campos base:

- `id`
- `partido_id`
- `campeonato_id`
- `evento_id`
- `titulo`
- `descripcion`
- `plataforma`
- `url_publica`
- `embed_url`
- `estado`
- `fecha_inicio_programada`
- `fecha_inicio_real`
- `fecha_fin_real`
- `thumbnail_url`
- `creado_por`
- timestamps

### Endpoints sugeridos

- `GET /partidos/:id/transmision`
- `POST /partidos/:id/transmision`
- `PUT /transmisiones/:id`
- `POST /transmisiones/:id/iniciar`
- `POST /transmisiones/:id/finalizar`
- `GET /public/partidos/:id/transmision`

## Cambios de frontend sugeridos

### Organizador

- boton `Transmitir` en `partidos.html`
- modal con:
  - plataforma
  - url
  - titulo
  - descripcion
  - thumbnail
- panel de transmisiones activas

### Portal publico

- badge `En vivo`
- filtro `Partidos en vivo`
- embed o boton externo
- bloque `Proxima transmision`

## Reglas operativas

- solo se puede tener una transmision activa por partido
- un partido finalizado no puede iniciar nueva transmision sin reabrir estado
- si el organizador no tiene plan compatible, la opcion debe quedar bloqueada

## Riesgos

- derechos de audio y musica
- caidas de red del organizador
- diferencias entre embeds permitidos por cada red
- soporte tecnico en vivo

## Recomendacion final

La mejor secuencia es:

1. Fase 1: enlaces y embeds por partido
2. Fase 2: dashboard operativo de transmisiones
3. Fase 3: integracion recomendada con Restream / StreamYard

Asi damos valor real rapido, sin meter al sistema en una operacion de video demasiado pesada desde el inicio.
