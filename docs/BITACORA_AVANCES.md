## 2026-05-24 — Equipos: historial de partidos jugados en sistema y portal público

### Cambio aplicado
- En `equipos.html`, el nombre del equipo y el botón `Partidos` abren un modal con los partidos ya jugados por el equipo.
- El modal muestra fecha, jornada, condición local/visita, rival, cancha, marcador y estado del resultado.
- El portal público ahora abre el perfil del equipo directamente en la pestaña `Partidos` cuando se hace clic desde el listado de equipos.
- `equipo-publico.html` filtra la pestaña para mostrar solo partidos jugados y conserva el mensaje vacío cuando todavía no hay historial.
- El endpoint público de partidos por equipo agrega `jugado`, `marcador` y resultado normalizado (`V`, `D`, `E`) para facilitar la vista pública e interna.

### Verificación local
- `node --check backend/services/publicPortalService.js`
- `node --check frontend/js/equipos.js`
- `node --check frontend/js/portal.js`
- Validación del script inline de `frontend/equipo-publico.html` con `new Function(...)` → PASS.
- `GET http://localhost:5000/api/public/equipos/24/partidos?evento_id=5` → devuelve `total = 3` y un partido `jugado: true` con marcador `0 - 0`, jornada `3` y resultado `E`.
- `npm run smoke` desde `backend/` → 9/9 PASS.
- `npm run smoke:frontend` desde `backend/` → 39/39 PASS.

### Pendientes siguientes
- QA visual en navegador: `equipos.html` → clic en equipo/botón Partidos, y `portal.html` → clic en equipo público → pestaña Partidos.
- Prueba end-to-end en Render de Transmisiones WebRTC.
- QA visual de descarga PDF/RIDE en Facturación con documento real conservado.
- QA responsive visual con datos reales.

---

## 2026-05-24 — Transmisiones: esquema autoasegurado y QA funcional

### Cambio aplicado
- `PartidoTransmision` ahora asegura/migra `partido_transmisiones` antes de cualquier lectura o escritura, incluyendo `destacado`, `overlay_token`, `director_token` e índices.
- `TransmisionOverlay` ahora asegura `transmision_overlay_state` antes de operar el marcador/overlay.
- Los controladores que consultan transmisiones por SQL directo aseguran la tabla antes de consultar.
- El overlay público valida el formato UUID del token y devuelve `400` en vez de provocar un `500` por token inválido.
- Se agregó `backend/scripts/qaTransmisionesFlow.js` y el comando `npm run qa:transmisiones`.

### Verificación local
- `npm run qa:transmisiones` → PASS completo:
  - crea transmisión temporal,
  - valida listado privado,
  - inicia transmisión,
  - valida activas públicas,
  - valida viewer público,
  - valida overlay público,
  - actualiza overlay autenticado,
  - valida token inválido,
  - limpia transmisión y overlay QA.
- Verificación posterior en BD local: `partido_transmisiones = 0`, `transmision_overlay_state = 0`.
- Checks de sintaxis en modelos/controladores/script de transmisiones.

### Pendientes siguientes
- Prueba end-to-end en Render con `transmisiones.html -> broadcast.html -> viewer.html?tx=<ID>`.
- Agregar TURN (Metered.ca u otro) si la prueba real confirma bloqueo por NAT estricto.
- QA responsive visual con datos reales.

---

## 2026-05-24 — Facturación: QA funcional automatizado con limpieza

### Cambio aplicado
- Se agregó `backend/scripts/qaFacturacionFlow.js` y el comando `npm run qa:facturacion`.
- El QA crea por API un documento temporal tipo `recibo` usando un movimiento financiero libre, valida:
  - creación del documento,
  - detalle con ítems y movimiento vinculado,
  - bloqueo de doble documentación del mismo movimiento,
  - emisión a estado `emitido`,
  - presencia en listado de emitidos.
- Al finalizar, elimina el documento QA y restaura la configuración/secuenciales de facturación del organizador usado, salvo que se ejecute con `QA_FACT_KEEP_DOCUMENT=1`.

### Verificación local
- `npm run qa:facturacion` → PASS completo.
- Verificación posterior en BD local: `documentos_facturacion = 0`, `documentos_pagos = 0`, configuración temporal restaurada.
- `node --check backend/scripts/qaFacturacionFlow.js`

### Pendientes siguientes
- QA visual en navegador de la descarga PDF/RIDE desde `facturacion.html` con un documento real conservado.
- Transmisiones WebRTC en Render.
- QA responsive visual con datos reales.

---

## 2026-05-24 — Liga: clasificados por grupo se conserva en categorías y tablas

### Cambio aplicado
- Se corrigió el flujo de categorías con `metodo_competencia = liga` para que `clasificados_por_grupo` sí aplique igual que en grupos/mixto.
- `frontend/js/eventos.js` ahora muestra, valida y envía cupos de clasificación cuando la categoría es Liga.
- `backend/controllers/eventoController.js` ahora persiste cupos para Liga y normaliza categorías antiguas de Liga sin cupos a `2` como fallback.
- `backend/controllers/tablaController.js` ahora devuelve fallback de cupos para Liga en tablas internas, evitando que el módulo Tablas muestre un valor incoherente o “No definido”.

### Verificación local
- `git pull` quedó aplicado/alineado con `origin/main` en `37c603e`.
- `node --check frontend/js/eventos.js`
- `node --check backend/controllers/eventoController.js`
- `node --check backend/controllers/tablaController.js`
- `npm run smoke:frontend` desde `backend/` → 39/39 PASS

### Pendientes siguientes
- QA funcional en navegador con una categoría real en Liga: editar `Clasifican por grupo` a `8`, guardar, abrir `tablas.html` y confirmar que el formulario bloqueado y la tabla muestran `8`.
- Retomar pendientes operativos vigentes: QA Facturación Fase 3 con datos reales, Transmisiones WebRTC en Render y QA responsive visual.

---

## 2026-05-15 — Facturación Fase 3: PDF/RIDE descargable

### Cambio aplicado
- Se agregó descarga PDF desde la tabla de documentos y desde el modal de detalle en `frontend/facturacion.html`.
- El PDF se genera con `jsPDF` y maqueta profesional tipo representación impresa:
  - cabecera con tipo, número y fecha,
  - datos de emisor, receptor y contexto operativo,
  - tabla de ítems con paginación automática,
  - totales, IVA/descuentos y movimientos financieros documentados,
  - pie aclaratorio mientras la autorización electrónica SRI queda para fase posterior.
- Backend:
  - `Facturacion.obtenerDocumento` devuelve los datos de emisor desde `facturacion_config` para que el PDF use la configuración real del organizador del documento.

### Verificación local
- `node --check backend/models/Facturacion.js`
- `node --check backend/controllers/facturacionController.js`
- `node --check backend/models/Finanza.js`
- Parse del script inline de `frontend/facturacion.html`
- `npm run smoke:frontend` desde `backend/` → 39/39 PASS
- `git diff --check`

### Pendientes siguientes
- QA visual/funcional en navegador con documento real:
  - crear documento desde Finanzas,
  - emitirlo,
  - descargar PDF,
  - confirmar ítems, totales, movimientos vinculados y nombre de archivo.
- Facturación Fase 4: SRI electrónico cuando el cliente confirme certificado digital.
- Transmisiones WebRTC en Render y QA responsive visual siguen como pendientes operativos.

---

## 2026-05-15 — Facturación Fase 2: integración con Finanzas

### Cambio aplicado
- Se implementó el flujo `Finanzas -> Facturación` desde el estado de cuenta de un equipo:
  - botón `Emitir documento` en `frontend/finanzas.html`,
  - selección de movimientos no documentados en `frontend/js/finanzas.js`,
  - envío por `sessionStorage` hacia `facturacion.html`,
  - modal de documento prellenado con campeonato, equipo, receptor, ítems y movimientos vinculados.
- Backend:
  - nueva relación `documentos_pagos (documento_id, movimiento_id)`,
  - `Facturacion.js` acepta `movimiento_ids` al crear/editar documentos,
  - validación de pertenencia por campeonato/equipo y bloqueo de movimientos ya documentados,
  - `Finanza.js` devuelve `documento_id`, número, tipo y estado del documento vinculado.
- BD:
  - nueva migración `database/migrations/069_facturacion_documentos_pagos.sql` para formalizar tablas de facturación y el vínculo con movimientos financieros.

### Verificación local
- `node --check backend/models/Facturacion.js`
- `node --check backend/controllers/facturacionController.js`
- `node --check backend/models/Finanza.js`
- `node --check frontend/js/finanzas.js`
- Parse de script inline en `frontend/facturacion.html`
- `npm run smoke:frontend` desde `backend/` → 39/39 PASS
- `git diff --check`

### Pendientes siguientes
- QA funcional con datos reales: seleccionar cargos/abonos de un equipo, crear recibo/factura, confirmar badge `Documentado` y bloqueo de doble documentación.
- Facturación Fase 3: PDF/RIDE profesional descargable.
- Facturación Fase 4: SRI electrónico cuando el cliente confirme certificado digital.

---

## 2026-05-11 — Cierre de sesión y continuidad para oficina

### Estado al cierre
- Rama `main` actualizada y publicada en GitHub.
- Sidebar del organizador corregido y publicado:
  - el rol `organizador` ya ve el menú completo desde `organizador-portal.html` y el resto de módulos.
- Reportes PDF de planilla corregidos y publicados:
  - sin observaciones: objetivo 1 página,
  - con observaciones: objetivo 2 páginas,
  - máximo 30 filas de jugadores por equipo,
  - ajuste compacto también cuando hay menos jugadores.
- Validación funcional reportada por el usuario:
  - "Ya quedó la planilla muy bien".
  - Se da por cerrado el bloque urgente de paginación PDF de planillaje.

### Commits publicados en esta sesión
- `5f13201 fix: completar sidebar del organizador`
- `976ca56 fix: ajustar paginacion PDF de planillas`

### Pendientes para retomar en oficina
1. **Facturación Fase 2 — integración con Finanzas**:
   - agregar botón `Emitir documento` desde el estado de cuenta de equipo en `finanzas.html`,
   - permitir seleccionar movimientos a documentar,
   - abrir/prellenar modal de documento en `facturacion.html`,
   - crear vínculo `documentos_pagos (documento_id, movimiento_id)`,
   - mostrar badge `Documentado` en movimientos ya vinculados.
2. **QA rápido post-deploy en Render**:
   - confirmar sidebar completo del organizador en producción,
   - confirmar PDF de planilla con un partido real sin observaciones y otro con observaciones.
3. **Transmisiones WebRTC en Render**:
   - probar `transmisiones.html` → `broadcast.html` → `viewer.html?tx=<ID>`,
   - si falla por NAT estricto, preparar TURN server.
4. **Portal público / playoff con datos reales**:
   - validar `Copa Ciudad de Loja -> Abierta`,
   - revisar que `Resultados` no oculte jornadas parciales,
   - confirmar que no reaparezca `Sin jornada` en eliminatorias públicas.
5. **QA funcional de jugadores multi inscripción**:
   - misma cédula en varias categorías,
   - misma cédula en dos equipos de la misma categoría,
   - bloqueo al intentar usarla con segundo equipo después de jugar con el primero.
6. **Responsive visual pendiente**:
   - revisión manual en 390x844 y 768x1024 de panel organizador, planilla, tablas, finanzas, facturación y transmisiones.

### Recomendación de arranque
Empezar por **Facturación Fase 2**, porque el bloque de planillaje ya quedó validado y Facturación es el siguiente flujo operativo con mayor impacto para el cliente.

---

## 2026-05-11 — Ajuste de paginación PDF de planillas

### Objetivo
Corregir los reportes PDF de planilla para que:
- sin observaciones salgan en 1 página,
- con observaciones salgan en 2 páginas,
- el plantel tenga un máximo de 30 filas por equipo,
- y los casos con menos filas se ajusten sin empujar páginas extra.

### Cambio aplicado
- `frontend/js/planilla.js`:
  - La salida PDF usa siempre maqueta compacta y pasa a modo ultra desde 24 filas.
  - Se recalibró el presupuesto de altura fija de la página 1 para reservar espacio real a encabezado, metadatos, marcador, faltas, planteles, firmas, tarjetas y pagos.
  - Se redujeron alturas, paddings y fuentes de filas altas para que 30 filas por equipo entren en la página 1.
  - Los nombres de equipos, jugadores y metadatos críticos quedan en una línea para evitar que un wrap aumente la altura de filas.
  - Pagos y resumen de tarjetas ahora tienen padding compacto en PDF.
  - Las observaciones se fuerzan siempre a página 2 cuando se exporta el PDF con observaciones.

### Verificación local
- `node --check frontend/js/planilla.js`
- `npm run smoke:frontend` desde `backend/` → 39/39 PASS
- `git diff --check`

### Validación posterior
- Validado visualmente por el usuario después del deploy/cambio:
  - "Ya quedó la planilla muy bien".
- Estado: bloque cerrado.

---

## 2026-05-11 — Sidebar completo para rol organizador

### Objetivo
Corregir el menú lateral del organizador, donde `organizador-portal.html` mostraba solo una parte de las opciones operativas del sistema.

### Diagnóstico
- El sidebar se construye con una mezcla de HTML estático por página y ajustes dinámicos en `frontend/js/core.js`.
- Para el rol `organizador`, el ajuste dinámico solo agregaba algunos accesos (`Portal Deportivo`, `Finanzas`, `Pases`, `Mi Landing`, `Usuarios`) y dependía de la base estática de cada pantalla.
- En `organizador-portal.html`, esa base estática estaba recortada, por lo que no aparecían opciones como categorías, equipos, jugadores, sorteo, grupos, partidos, transmisiones, planillaje, tablas y playoff.

### Cambio aplicado
- `frontend/js/core.js`:
  - Se agregó renderizado ordenado del sidebar cuando el usuario autenticado tiene rol `organizador`.
  - El menú del organizador ahora muestra de forma consistente:
    - Portal Deportivo, Mi Landing, Campeonatos, Auspiciantes, Categorías, Equipos, Jugadores, Sorteo, Grupos, Partidos, Transmisiones, Planillaje, Tablas, Playoff, Usuarios, Facturación, Finanzas, Pases y Ver Portal.
  - Se elimina la dependencia del link estático viejo `admin.html` para ese rol.

### Verificación local
- `node --check frontend/js/core.js`
- `npm run smoke:frontend` desde `backend/` → 39/39 PASS
- `git diff --check`

---

## 2026-05-11 — Ajuste tabla pública y tope de planillaje

### Objetivo
Corregir la tabla de posiciones móvil para que los nombres de equipos sean legibles y asegurar que los reportes PDF de planillaje trabajen con un máximo de 30 jugadores por equipo.

### Cambio aplicado
- `frontend/css/portal.css`:
  - La columna `Equipo` en tabla de posiciones móvil recibe prioridad de ancho.
  - Los nombres de equipos permiten hasta 2 líneas en móvil en lugar de quedar truncados con puntos suspensivos.
  - Se reducen anchos/padding de `#`, `PJ`, `GD/DP` y `PTOS` para dar espacio al nombre.
- `frontend/js/planilla.js`:
  - Se agrega `MAX_JUGADORES_REPORTE_PLANILLA = 30`.
  - Vista previa e impresión PDF capan jugadores de planilla a 30 filas por equipo.
  - El PDF calcula filas usando planteles reales + configuración, pero nunca supera 30; así sin observaciones debe conservarse en 1 página y con observaciones en máximo 2 páginas.

### Verificación local
- Playwright en `portal.html?campeonato=9&evento=19`, viewport 360px:
  - `Tabla de posiciones` conserva columnas `#`, `Equipo`, `PJ`, `GD`, `PTOS`.
  - Los nombres completos de equipos se ven en 1 o 2 líneas.
  - `scrollWidth` igual al viewport y sin ofensores horizontales.

---

## 2026-05-11 — Tablas públicas compactas en móvil

### Objetivo
Reducir la densidad de columnas en tablas del portal público para que la vista responsiva muestre solo los datos más relevantes.

### Cambio aplicado
- `frontend/js/portal.js`:
  - Tabla de posiciones marca columnas primarias/secundarias.
  - En fútbol se usa `GD` y `PTOS`; en básquet se conserva `DP` para diferencia de puntos.
  - Fair play marca `Faltas` como columna secundaria móvil.
- `frontend/css/portal.css`:
  - En móvil, tabla de posiciones muestra `#`, `Equipo`, `PJ`, `GD/DP`, `PTOS`.
  - En móvil, fair play muestra `#`, `Equipo`, `TA`, `TR`, `Puntaje`.
  - Se evita overflow horizontal en las tablas densas y se ajustan anchos para 320–412px.

### Verificación local
- Playwright headless en `portal.html?campeonato=9&evento=19` con viewports 320, 360, 390 y 412 px:
  - `Tabla de posiciones` → columnas visibles `#`, `Equipo`, `PJ`, `GD`, `PTOS`.
  - `Fair play` → columnas visibles `#`, `Equipo`, `TA`, `TR`, `Puntaje`.
  - `scrollWidth` igual al viewport y sin ofensores horizontales.

---

## 2026-05-08 — Fix responsive portal público detalle de torneos

### Objetivo
Corregir el desbordamiento horizontal en `portal.html` en vista móvil, visible en todos los torneos al entrar al detalle de categorías, tabs y jornadas.

### Diagnóstico
- El detalle del torneo reutiliza `portal-detail-shell`, `portal-category-panel`, `portal-subtabs` y tarjetas de jornadas para todos los campeonatos.
- En móvil, textos largos como `Tabla de posiciones`, el resumen de categoría y los metadatos de partidos podían empujar el ancho efectivo del panel.
- Aunque los tabs tenían `overflow-x: auto`, faltaba contención con `min-width: 0`, `max-width: 100%` y wrapping en los nodos internos.

### Cambio aplicado
- `frontend/css/portal.css`:
  - Se refuerzan `portal-category-tabs` y `portal-subtabs` con ancho contenido, wrapping móvil y `overscroll-behavior-inline`.
  - Se agrega bloque mobile `max-width: 700px` para contener `portal-detalle`, `portal-detail-shell`, paneles, jornadas, partidos y tablas.
  - Se fuerza wrapping en resumen de categoría, metadatos de jornada y nombres de equipos.
  - Subtabs y selector de jornadas pasan a filas compactas en móvil para evitar botones parcialmente cortados.
  - Se compactan subtabs, cards de jornada, logos y marcador en móviles de 420px o menos.

### Verificación local
- `git diff --check`
- `node --max-old-space-size=4096 scripts/smokeFrontendRoleGuards.js` desde `backend/` → 39/39 PASS
- Playwright headless en `portal.html?campeonato=9&evento=19` con viewports 320, 360, 390 y 412 px → `scrollWidth` igual al viewport y sin ofensores horizontales.

### Pendiente
QA visual en Render con viewport aproximado 412x915 en `portal.html`, probando tabs `Jornadas`, `Resultados`, `Tabla de posiciones` y varias jornadas.

---

## 2026-05-08 — Regla multi inscripción por categoría/equipo

### Objetivo
Actualizar la regla de jugadores para permitir que una misma cédula pueda preinscribirse en varias categorías y también en varios equipos de la misma categoría, siempre que cumpla la edad de cada categoría. La participación efectiva queda bloqueada por el primer equipo con el que juegue en esa categoría.

### Regla aplicada
- Un jugador de 50 años puede estar inscrito en U35, U40 y U50 si cumple edad.
- Puede estar preinscrito en equipos diferentes, incluso dentro de la misma categoría.
- La inscripción administrativa no define el equipo final.
- Al guardar una planilla finalizada, la cédula queda asociada al primer equipo con el que participa en esa categoría.
- Si luego se intenta guardar planilla en la misma categoría con esa cédula en otro equipo, el backend bloquea la participación.

### Cambios aplicados
- `backend/models/Jugador.js`
  - `validarDireccionCategoriaPorCedula()` ya no bloquea por dirección de categoría; conserva el contexto de categoría/campeonato.
  - `verificarJugadorUnicoPorEvento()` queda como compatibilidad histórica y deja de bloquear la preinscripción en otro equipo de la misma categoría.
  - El mensaje para el índice antiguo `jugadores_cedidentidad_evento_uidx` ahora indica aplicar la migración 068.
- `backend/models/Partido.js`
  - Nuevo control al guardar planilla finalizada: detecta cédulas ya usadas en la misma categoría con otro equipo y bloquea la nueva participación.
  - También bloquea si la misma cédula aparece en dos equipos dentro de la misma planilla.
- `database/migrations/068_jugadores_cedula_multi_equipo_categoria.sql`
  - Elimina el índice único `jugadores_cedidentidad_evento_uidx`.
  - Crea índice no único de consulta para `cedidentidad + evento_id`.

### Verificación local
- `node --check backend/models/Jugador.js`
- `node --check backend/models/Partido.js`
- `node --check frontend/js/jugadores.js`
- `npm run smoke:frontend`

### Pendiente
QA en Render después del deploy: crear/editar misma cédula en U50 aunque exista en U40, registrar misma cédula en dos equipos de U50, guardar planilla con el primer equipo y confirmar bloqueo al intentar guardarla con el segundo.

---

## 2026-05-08 — Fix inscripción desde categoría inferior (jugadores)

### Objetivo
Corregir el flujo de `jugadores.html` para inscribir formalmente en una categoría superior a un jugador ya registrado en una categoría inferior del mismo campeonato, cuando cumple la edad mínima de la categoría destino.

### Diagnóstico
- La pestaña **Desde categoría inferior** sí filtraba jugadores elegibles por edad.
- Al cargar el jugador al formulario se marcaba `jugadorEsAscendente = true`.
- Pero `mostrarModalCrearJugador()` reiniciaba ese estado a `false` al abrir el modal.
- Por eso el `FormData` no enviaba `es_ascendente=true`, y el backend aplicaba la validación antigua de dirección: "Solo se permite bajar jugadores desde categorías más altas hacia categorías más bajas".

### Cambio aplicado
- `frontend/js/jugadores.js`:
  - `mostrarModalCrearJugador(opciones = {})` ahora acepta `{ esAscendente: true }`.
  - El flujo **Desde categoría inferior** abre el modal con ese contexto y conserva el flag hasta el guardado.
  - Si el modal no puede abrirse por permisos, equipo faltante o cupo máximo, el flujo se detiene sin rellenar datos.
  - Se aplicó el mismo control de apertura al flujo **Desde categoría superior**.
- El backend mantiene las validaciones de edad/documentos/cupos; cuando recibe `es_ascendente=true`, omite solo la validación direccional entre categorías.

### Verificación local
- `git pull --ff-only --autostash origin main`
- `node --check frontend/js/jugadores.js`
- `node --check backend/models/Jugador.js`
- `node --check backend/controllers/jugadorController.js`
- `npm run smoke:frontend`

### Pendiente
QA en Render con el caso real: jugador de U40 con edad válida guardado en U50 desde la pestaña **Desde categoría inferior**.

---

## 2026-05-08 — Responsive completo: admin app + portal web público

### Objetivo
Cerrar cobertura responsive de todas las páginas del sistema — tanto la app de gestión (`app-layout`) como el portal web público (`ltc-landing`).

### Admin app — `frontend/css/style.css`

**Bloque `MOBILE QA` (`@media max-width: 900px / 560px`):**
- **iOS auto-zoom** en tablas operativas: `planilla-captura-table input/select`, `planilla-penales-grid input`, `planilla-overtime-grid input`, `tabla-scroll input/select`, `list-table input/select` → `font-size: 16px !important`
- **`grupos-main-tabs` / `grupos-main-tab`** agregados a la regla general de tabs scrollables (`overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none`) — antes solo cubría `partidos-main-tabs`, `jugadores-main-tabs`

**`frontend/director.html`** — nuevo `@media (max-width: 600px)` inline:
- `.btn-gol`: 36×36 → 52×52 px (mínimo táctil Apple: 44px)
- Inputs/selects: `font-size: 16px` (iOS zoom prevention)
- `.action-row` columna, `.btn-action` full-width
- `.share-btns` grid 2×2
- Padding y tipografía compactos

### Portal web público — `frontend/css/portal.css`

**Audit completo sobre:** `index.html`, `portal.html`, `torneos.html`, `planes.html`, `blog.html`, `noticia.html`

Nuevo bloque `MOBILE CIERRE PORTAL` al final de `portal.css`:

| Problema | Breakpoint | Fix |
|----------|-----------|-----|
| iOS auto-zoom búsqueda/select torneos | 700px | `font-size: 16px` en `ltc-torneos-search-wrap input` y `ltc-torneos-select` |
| `ltc-feature-grid` salta 3→1 col (sin paso intermedio) | 980px/640px | 2-col en 980px, 1-col en 640px |
| `portal-category-tabs` sin scroll inercial iOS | 700px | `-webkit-overflow-scrolling: touch; scrollbar-width: none` |
| Hero blob demasiado alto en phones (<480px) | 480px | `ltc-hero-media min-height: 180px`, shape `min(200px, 60vw)` |
| `ltc-hero-actions` no apila en phones muy pequeños | 480px | `flex-direction: column; align-items: stretch`, botones full-width |
| `ltc-team-welcome-groups` 2-col en 390px (~165px/col) | 480px | `grid-template-columns: 1fr` |
| `ltc-about-banner` sin height cap tras 1-col a 980px | 700px | `max-height: 250px; object-fit: cover` |
| `ltc-clientes-section` con 70px padding en móvil | 700px | `padding: 40px 0` |
| `ltc-gallery-card img` 230px en layout 1-col | 700px | `height: 180px` |
| `ltc-plans-hero` padding excesivo en phones | 480px | `padding: 1.8rem 0 0.8rem` |

### Pendiente
QA visual en viewport 390×844 y 768×1024 con datos reales — no verificable en código. Ver `ESTADO_IMPLEMENTACION_SGD.md`.

---

## 2026-05-08 — Jugadores ascendentes en planilla

### Objetivo
Permitir que jugadores inscritos en categorías Sub inferiores suban a jugar en partidos de categorías superiores (Sub más alta) de cualquier equipo, siempre que cumplan la edad mínima de la categoría destino. Es el inverso de la feature "categoría juvenil" ya existente.

### Diseño adoptado
- **Planilla-level** (no inscripción formal): el jugador NO se inscribe en la categoría destino; solo se registra como presente en ese partido específico.
- Nota posterior: desde la regla multi inscripción, `validarDireccionCategoriaPorCedula` ya no bloquea dirección de categoría; las inscripciones formales se validan por edad/documentos/cupos y el bloqueo por equipo se aplica al guardar planilla.
- Los ascendentes se almacenan en el JSONB `partido_planillas.registro_jugadores_local/visitante` con `es_ascendente: true` y `evento_origen_id`.
- La categoría debe tener `permite_ascenso = true` activado por el organizador.

### Implementación aplicada

**Backend — `backend/controllers/eventoController.js`:**
- `asegurarEsquemaEventos()`: migración inline que agrega `permite_ascenso BOOLEAN DEFAULT FALSE` y `max_ascendentes_por_partido INTEGER DEFAULT 2` a la tabla `eventos`.
- `crearEvento()`: destructura y persiste los dos campos (params `$32` y `$33` en el INSERT).
- `actualizarEvento()` (PATCH): maneja `permite_ascenso` y `max_ascendentes_por_partido` con validación.

**Backend — `backend/models/Jugador.js`:**
- Nuevo método estático `buscarAscendentesDisponibles(partidoId)`:
  - Resuelve campeonato, evento destino y `edad_base_objetivo` del partido.
  - Busca todos los jugadores del mismo campeonato en eventos con `edad_base < objetivo`.
  - Filtra en JS los que tienen `calcularEdadPorAnio >= edad_base_objetivo`.
  - Devuelve `{ permite_ascenso, max_ascendentes_por_partido, jugadores[] }`.

**Backend — `backend/models/Partido.js`:**
- `normalizarRegistroJugadoresPlanilla()`: preserva `es_ascendente` y `evento_origen_id` en los registros del JSONB.
- `obtenerPlanilla()`: join con `eventos` para exponer `permite_ascenso` y `max_ascendentes_por_partido` en la respuesta de planilla.
- `guardarPlanilla()`: valida que el número de jugadores con `es_ascendente = true` no supere `max_ascendentes_por_partido` por equipo; lanza `400` si se supera.

**Backend — `backend/controllers/partidoController.js`:**
- Nuevo export `obtenerJugadoresAscendentes`: llama a `Jugador.buscarAscendentesDisponibles(id)` y retorna JSON.

**Backend — `backend/routes/partidoRoutes.js`:**
- Nueva ruta `GET /:id/jugadores-ascendentes` con auth `administrador | organizador | operador_sistema`, posicionada antes de `/:id` para evitar shadowing.

**Frontend — `frontend/eventos.html`:**
- Nuevo select `#evt-permite-ascenso` (No/Sí) con `onchange="actualizarVisibilidadAscenso()"`.
- Nuevo input `#evt-max-ascendentes-por-partido` (min 1, max 10), visible solo cuando `permite_ascenso = true`.

**Frontend — `frontend/js/eventos.js`:**
- `actualizarVisibilidadAscenso()`: muestra/oculta el campo max según el select.
- `crearEvento()`: lee y envía `permite_ascenso` + `max_ascendentes_por_partido`.
- `editarEvento()`: agrega ambos campos al modal y al payload PATCH.

**Frontend — `frontend/planilla.html`:**
- Bloque `#bloque-ascendentes` (oculto por defecto), revelado cuando `permite_ascenso = true`.
- Por cada lado (local/visitante): `<h5>`, input de búsqueda con `oninput`, resultados, y contenedor de seleccionados.

**Frontend — `frontend/css/style.css`:**
- Estilos `.planilla-asc-search`, `.planilla-asc-resultados`, `.planilla-asc-item`, `.planilla-asc-seleccionados`, `.planilla-asc-tag`, `.badge-ascendente`.

**Frontend — `frontend/js/planilla.js`:**
- Estado: `ascendentesDisponiblesCache` y `ascendentesSeleccionados { local, visitante }`.
- `cargarAscendentesDisponibles()`: GET a la API, muestra/oculta el bloque, actualiza títulos con nombres reales de equipos.
- `cargarAscendentesDesdeRegistro()`: al recargar la planilla, parsea los registros con `es_ascendente = true` y reconstituye el estado.
- `filtrarAscendentes(lado)`: búsqueda en tiempo real por nombre o cédula.
- `agregarAscendente(lado, id)` / `quitarAscendente(lado, id)`: gestión del estado.
- `renderAscendentesSeleccionados(lado)`: renderiza tags con badge `ASC` y botón quitar.
- Al guardar: merge de `ascendentesSeleccionados` en `registroJugadoresLocal/Visitante` con `es_ascendente: true`, `evento_origen_id` y `equipo_id = equipo del partido` (para pasar el filtro `equipoIdPermitido`).
- Se integra en `refrescarPlanillaPreservandoFormulario()` reseteando el estado y recargando.
- `window.filtrarAscendentes`, `window.agregarAscendente`, `window.quitarAscendente` expuestos globalmente.

### Pendientes de esta feature
- QA en Render: crear evento con `permite_ascenso = true`, confirmar que la búsqueda devuelve elegibles, agregar ascendente, guardar planilla y verificar el JSONB guardado.

---

## 2026-05-07 — Portal público: fix Equipos, landing organizador y responsive pendiente

### Bloque mobile aplicado — cierre operativo restante

- `frontend/js/core.js`: el menú lateral interno ahora sincroniza `aria-expanded` y `aria-controls`, además de mantener el guard `data-mobile-menu-bound`.
- `frontend/css/style.css`: se agrega bloque **Mobile QA** para `planilla`, `finanzas`, `sorteo`, `eliminatorias`, `pases`, `eventos` y `usuarios`: tablas con scroll táctil, formularios largos a 1 columna, botones full-width en `<=560px`, ruleta escalable, acciones financieras compactas y planilla con captura scrolleable.
- `frontend/css/grupos.css`: se cierra responsive de `gruposgen.html`: acciones, selector de tema, poster, liga, nombres largos, controles de playoff e iframe embebido.
- Verificación HTTP local: `planilla.html`, `finanzas.html`, `gruposgen.html`, `sorteo.html`, `pases.html`, `eventos.html`, `usuarios.html` y `eliminatorias.html` responden `200` desde `http://localhost:5000/`.

Pendiente del cierre:
- QA visual con datos reales en 390x844 y 768x1024. El objetivo ya no es corregir estructura base, sino ajustes finos por contenido real: columnas imprescindibles, nombres largos, botones muy densos y postales exportables.

### Bloque mobile aplicado — pantallas internas de operación

- `frontend/css/style.css`: se agrega una capa responsive común para páginas internas `app-layout` en `<=900px` y `<=560px`: topbar sticky compacta, padding táctil, tarjetas sin desborde, grillas a 1/2 columnas, tabs con scroll horizontal, tablas con scroll táctil y botones de acción a ancho completo en móvil pequeño.
- Se cubren patrones usados por `portal-admin`, `campeonatos`, `equipos`, `jugadores`, `partidos`, `tablas`, `facturacion` y `transmisiones`.
- `frontend/js/core.js`: el menú lateral interno ahora marca el botón con `data-mobile-menu-bound` para evitar doble binding.
- `frontend/facturacion.html`, `frontend/js/transmisiones.js` y `frontend/js/tablasplantilla.js`: se elimina el fallback práctico a `sidebar.open` y se alinea con `sidebar.nav-open`, respetando el binding global.
- Verificación: `node --check` OK para `core.js`, `transmisiones.js` y `tablasplantilla.js`; `npm run smoke:frontend` desde `backend/` queda en `39/39` checks OK.

Pendiente del bloque interno:
- Validación visual real en 390x844 y 768x1024, especialmente modales largos de `facturacion`, tablas anchas de `transmisiones/tablas` y poster exportable de `partidos`.

### Bloque mobile aplicado — portal público y fichas públicas

- `frontend/js/core.js`: nuevo inicializador reusable para el menú público (`ltc-nav-toggle` + `ltc-nav`), evitando que cada página tenga que duplicar lógica.
- `frontend/js/public-pricing.js` y `frontend/portal.html`: protegidos contra doble binding del menú móvil.
- `frontend/index.html`, `frontend/torneos.html`, `frontend/portal.html`, `frontend/planes.html`: botón de menú público con `aria-expanded`.
- `frontend/equipo-publico.html`: se agrega menú móvil y media queries para hero, estadísticas, tabs, nómina, partidos e información en pantallas pequeñas.
- `frontend/jugador-publico.html`: se agrega menú móvil y media queries para hero, estadísticas, tabs, participaciones y ficha.
- `frontend/css/portal.css`: ajustes mobile para contenedores públicos, header, cards de torneo, detalle de campeonato, tablas con scroll táctil y selector de jornadas.

Pendiente del bloque mobile:
- Validación visual real en 390x844 y 768x1024 después del despliegue.
- Continuar con pantallas internas de operación: `portal-admin`, `campeonatos`, `equipos`, `jugadores`, `partidos`, `planilla`, `tablas`, `finanzas`, `facturacion` y `transmisiones`.

### Fix adicional — Ver todos los torneos

- Problema: el botón **Ver todos los torneos** abría `torneos.html`, pero el guard global la trataba como página privada y redirigía a `login.html`.
- Causa: `torneos.html` no estaba incluida en `PUBLIC_PAGES` dentro de `frontend/js/core.js`.
- Solución: se agrega `torneos.html` al set de páginas públicas y se añade smoke `anon-public-torneos` en `backend/scripts/smokeFrontendRoleGuards.js`.
- Verificación: `npm run smoke:frontend` queda en `39/39` checks OK.

### Contexto

Se revisó captura de producción en `ltyc.onrender.com/portal.html`: el tab **Equipos** devolvía `500` en `/api/public/eventos/19/equipos`.

### Implementación aplicada

**Backend — `backend/services/publicPortalService.js`:**
- Se corrige la consulta pública de equipos: la BD real usa `equipos.cabeza_serie`, no `equipos.es_cabeza_serie`.
- Se mantiene la propiedad pública `es_cabeza_serie` en la respuesta para compatibilidad frontend.
- Se separa el cálculo de jugadores y estadísticas de partidos para evitar duplicar goles/PJ por el join con la nómina.

**Landing organizador — `backend/controllers/authController.js` + `frontend/js/portal.js`:**
- `equipos_participantes` ahora incluye `evento_id`, `evento_nombre` y `total_jugadores`.
- Las tarjetas de equipos en `index.html?organizador=ID` enlazan a `equipo-publico.html?id=EQUIPO_ID&evento=EVENTO_ID`.

**Postales de tablas — `frontend/tablasplantilla.html` + `frontend/css/tablasplantilla.css`:**
- Se elimina la imagen de cancha/perspectiva del poster.
- La franja inferior queda dedicada solo a auspiciantes centrados.

**Responsive web/mobile:**
- Queda registrado como pendiente prioritario real. Falta auditoría visual y cierre por módulos en móviles, especialmente para pantallas internas de operación.

### Pendientes inmediatos

- Desplegar en Render y validar que `/api/public/eventos/19/equipos` responda `200`.
- Probar en móvil real `portal.html`, `index.html?organizador=ID`, `equipo-publico.html` y `jugador-publico.html`.
- Abrir bloque de trabajo específico para responsive web/mobile por módulos.

---

## 2026-05-05/06 — Portal público: perfiles de equipo y jugador

### Objetivo

Mostrar en la landing del organizador (y en el portal general) los equipos inscritos en cada campeonato, con páginas de perfil para equipo y jugador: nómina, partidos, estadísticas, tarjetas.

### Implementación aplicada

**Backend — `backend/services/publicPortalService.js`:**
6 nuevas funciones exportadas:
- `listarEquiposPublicosPorEvento(eventoId)` — equipos con totales (jugadores, PJ, GF, GC).
- `obtenerEquipoPublico(equipoId)` — perfil de equipo + eventos + estadísticas globales (PJ/PG/PE/PP/GF/GC).
- `listarJugadoresPublicosPorEquipo(equipoId, eventoId?)` — nómina con goles y tarjetas.
- `listarPartidosPublicosPorEquipo(equipoId, eventoId?)` — partidos del equipo con resultado V/D/E y datos del rival.
- `obtenerJugadorPublico(jugadorId)` — ficha de jugador con equipo, campeonato y estadísticas.
- `listarParticipacionesPublicasJugador(jugadorId)` — partidos donde el jugador registró goles o tarjetas.

**Backend — `backend/controllers/publicPortalController.js`:**
6 nuevos controladores correspondientes.

**Backend — `backend/routes/publicRoutes.js`:**
6 nuevas rutas GET:
- `GET /api/public/eventos/:evento_id/equipos`
- `GET /api/public/equipos/:equipo_id`
- `GET /api/public/equipos/:equipo_id/jugadores`
- `GET /api/public/equipos/:equipo_id/partidos`
- `GET /api/public/jugadores/:jugador_id`
- `GET /api/public/jugadores/:jugador_id/participaciones`

**Frontend — `frontend/equipo-publico.html`** (nuevo):
- URL: `equipo-publico.html?id=EQUIPO_ID&evento=EVENTO_ID&back=URL`
- Hero con logo, colores del equipo, chip de campeonato, nombre, DT y strip de stats (PJ/PG/PE/PP/GF/GC).
- Tab **Jugadores**: grid de tarjetas con foto/avatar, número, nombre, posición, badges (Capitán, goles, amarillas, rojas). Cada tarjeta enlaza a `jugador-publico.html`.
- Tab **Partidos**: lista con fecha, resultado (V/D/E coloreado), rival, estado badge.
- Tab **Información**: tabla clave/valor con DT, staff, contacto, campeonato.

**Frontend — `frontend/jugador-publico.html`** (nuevo):
- URL: `jugador-publico.html?id=JUGADOR_ID&back=URL`
- Hero con foto circular, número badge, colores del equipo, chip con enlace al equipo, nombre y posición.
- Strip de stats: Goles, Partidos, Amarillas, Rojas.
- Tab **Partidos**: historial de partidos donde registró goles o tarjetas, con fecha, jornada, resultado, contribuciones por partido.
- Tab **Ficha**: tabla con datos personales, edad calculada, vínculos a equipo y campeonato.
- Nota informativa: "El sistema aún no lleva registro de titularidad o suplencia."

**Frontend — `frontend/js/portal.js`:**
- Nuevo subtab **Equipos** en cada categoría de evento (carga lazy al hacer clic).
- Función `cargarEquiposTabPortal(eventoId, container)` que fetcha y renderiza grilla de equipos.
- Cada tarjeta de equipo enlaza a `equipo-publico.html` con parámetro `back=` para regreso limpio.

### Limitación documentada

El sistema **no registra titularidad ni suplencia** en partidos. Solo se pueden mostrar partidos donde el jugador tiene goles (`goleadores` table) o tarjetas (`tarjetas` table). Para implementar titular/suplente se necesitará una nueva tabla `planilla_jugadores (partido_id, jugador_id, rol)`.

### Commits
| Hash | Descripción |
|---|---|
| `7fbf1a7` | feat: páginas públicas de equipo y jugador con API REST |
| `e2c3d05` | feat: tab Equipos en portal con carga lazy y enlace a ficha pública |

---

## 2026-05-04 — Módulo de Facturación: Fase 1

### Objetivo

Agregar un módulo de facturación, nota de venta y recibo para que organizadores puedan emitir documentos tributarios a clientes (equipos/participantes) cuando lo soliciten. Contexto Ecuador/SRI.

### Implementación aplicada

**Backend — `backend/models/Facturacion.js`:**
- `asegurarEsquema()` crea inline las 3 tablas si no existen:
  - `facturacion_config`: datos del emisor por organizador (RUC/RISE, razón social, dirección, establecimiento, punto de emisión, % IVA, secuenciales por tipo).
  - `documentos_facturacion`: documento maestro (tipo, serie, secuencial, número completo, datos del receptor, totales, IVA, estado: borrador/emitido/anulado).
  - `documentos_items`: líneas del documento (descripción, cantidad, precio, descuento, subtotal).
- Métodos: `obtenerConfig`, `guardarConfig`, `listarDocumentos`, `obtenerDocumento`, `crearDocumento` (transaccional, genera número secuencial), `actualizarDocumento` (solo borradores), `cambiarEstado`.
- Cálculo automático: subtotal, base imponible, IVA (solo en `factura`), total.
- `nota_venta` y `recibo` no desglosan IVA (contribuyentes RISE / uso interno).

**Backend — `backend/controllers/facturacionController.js`:**
- `obtenerConfig / guardarConfig`: configuración del emisor.
- `listar / obtener / crear / actualizar / emitir / anular`: CRUD con scope por rol (organizador ve solo los suyos).

**Backend — `backend/routes/facturacionRoutes.js`:**
- `GET/PUT /api/facturacion/config`
- `GET/POST /api/facturacion`
- `GET/PUT /api/facturacion/:id`
- `POST /api/facturacion/:id/emitir`
- `POST /api/facturacion/:id/anular`
- Roles: `administrador`, `organizador`.

**Backend — `backend/server.js`:**
- `require('./routes/facturacionRoutes')` registrado en `/api/facturacion`.

**Frontend — `frontend/facturacion.html`:**
- Sidebar con link activo `Facturación`.
- KPIs: facturas/notas/recibos emitidos y total USD.
- Filtros por tipo, estado y campeonato.
- Tabla con badge de tipo y estado, acciones por estado (editar, emitir, anular, ver).
- Modal config emisor: tipo contribuyente, RUC/CI, razón social, nombre comercial, dirección, establecimiento, punto emisión, % IVA.
- Modal nuevo/editar documento: selector de tipo, datos receptor, ítems dinámicos, cálculo en tiempo real de subtotales/IVA/total, observaciones.
- Modal detalle: vista de impresión con datos del emisor, receptor, tabla de ítems y totales.
- Link agregado al sidebar de 21 páginas internas (`admin.html`, `campeonatos.html`, `equipos.html`, etc.).

### Verificación

- `node -e "require('./backend/controllers/facturacionController.js')"` — OK
- `node -e "require('./backend/routes/facturacionRoutes.js')"` — OK
- `node -e "require('./backend/models/Facturacion.js')"` — OK
- `Facturacion.asegurarEsquema()` — tablas creadas en BD local OK
- Tablas verificadas: `facturacion_config`, `documentos_facturacion`, `documentos_items`.

### Pendientes del módulo

- **Fase 2** — Integración con finanzas:
  - Botón "Emitir documento" en estado de cuenta de equipo (`finanzas.html`).
  - Modal pre-llenado con movimientos seleccionados como ítems.
  - Nueva tabla `documentos_pagos (documento_id, movimiento_id)` en `Facturacion.js`.
  - Badge "Documentado" en movimientos ya vinculados.
- **Fase 3** — PDF oficial A4:
  - Logo emisor, datos SRI, receptor, tabla ítems, totales, QR visual.
  - Usar `jsPDF` (ya en proyecto). Botón "Descargar PDF" en modal detalle.
- **Fase 4** — SRI electrónico (futuro):
  - XML según XSD del SRI Ecuador, firma `.p12`, RIDE. Requiere certificado digital del cliente.

### Estado de la BD

- Tablas creadas con `asegurarEsquema()` en BD local (Render las creará al primer request autenticado).
- Sin migración numerada: el esquema es inline en `Facturacion.js`, igual que otros modelos del proyecto.

---

## 2026-05-04 — Resumen de sesión (continuidad desde casa)

### Commits del día
| Hash | Descripción |
|---|---|
| `b53be6b` | feat: transmisiones Fase 2+3 — WebRTC broadcaster/viewer + OBS + compartir en redes |
| `4eee71b` | feat: módulo de facturación Fase 1 — factura, nota de venta y recibo |

### Estado al cerrar sesión
- BD local: alineada, con tablas de facturación creadas.
- Render: transmisiones Fase 2 no probada aún (WebRTC puede fallar en NAT estricto).
- Facturación: operativa en local, Render la recibe al primer `GET /api/facturacion/config` autenticado.

### Dónde continuar (orden sugerido)

**1. Probar Transmisiones en Render** (prioridad inmediata):
- Ingresar a `https://ltyc.onrender.com` con cuenta organizador.
- Crear o abrir una transmisión → "Transmitir video" → compartir URL viewer con otro dispositivo.
- Si WebRTC no conecta por NAT: agregar TURN de Metered.ca en `broadcast.html` y `viewer.html`.
  ```js
  // iceServers a agregar en RTCPeerConnection:
  { urls: "turn:relay.metered.ca:80", username: "...", credential: "..." }
  ```

**2. Facturación Fase 2** (siguiente feature a implementar):
- En `frontend/finanzas.html`: agregar botón "Emitir doc." en la sección `Estado de cuenta equipo`.
- En `backend/models/Facturacion.js`: agregar tabla `documentos_pagos` en `asegurarEsquema()`.
- En `frontend/facturacion.html` o `finanzas.html`: flujo de selección de movimientos → documento.

**3. Facturación Fase 3** (PDF profesional):
- Archivo: `frontend/facturacion.html`, función `imprimirDetalle()` ya existe (usa `window.print()`).
- Reemplazar con generación `jsPDF` para PDF descargable sin depender del print del navegador.

**4. Validación portal público** (cuando haya tiempo):
- `Copa Ciudad de Loja → Abierta` en Render: verificar pestaña Playoff y Resultados.
- Revisar que ningún campeonato muestre "Sin jornada" en la vista pública de eliminatorias.

### Archivos clave del módulo de facturación
| Archivo | Descripción |
|---|---|
| `backend/models/Facturacion.js` | Modelo: esquema, config emisor, CRUD documentos |
| `backend/controllers/facturacionController.js` | Controlador REST |
| `backend/routes/facturacionRoutes.js` | Rutas `/api/facturacion` |
| `backend/server.js` línea ~107 | `app.use("/api/facturacion", facturacionRoutes)` |
| `frontend/facturacion.html` | UI completa: listado, config emisor, nuevo doc, detalle |

---

## 2026-05-03 — Transmisiones Fase 2: WebRTC broadcaster + viewer público

### Objetivo

Permitir transmitir video en vivo directamente desde el navegador (cámara o pantalla compartida) sin necesidad de OBS ni software externo. Cualquier persona con el enlace puede ver el stream en tiempo real.

### Implementación aplicada

**Backend — `backend/services/socketService.js`:**
- Se añadió el mapa `webrtcBroadcasters` (transmision_id → socket.id) para rastrear al broadcaster activo por transmisión.
- Nuevos handlers Socket.io para señalización WebRTC:
  - `webrtc:broadcaster-join` — el broadcaster anuncia presencia; el servidor notifica a viewers ya conectados.
  - `webrtc:viewer-join` — el viewer entra; el servidor notifica al broadcaster para que cree oferta y confirma al viewer si hay broadcaster.
  - `webrtc:offer / webrtc:answer / webrtc:ice` — relay genérico dirigido a socket.id destino.
  - `disconnect` — limpia el mapa y emite `webrtc:broadcaster-left` a la sala.
- `actualizarConteoViewers(transmision_id)` calcula la cantidad de viewers reales (total sala − 1 broadcaster).

**Backend — `backend/controllers/transmisionController.js`:**
- Nueva función `obtenerTransmisionViewer(req, res)` — endpoint público que devuelve únicamente datos seguros (sin overlay_token, sin director_token): id, título, descripción, plataforma, url_publica, estado, fechas, nombres y logos de equipos.

**Backend — `backend/routes/publicRoutes.js`:**
- Nueva ruta `GET /api/public/transmisiones/:id` → `obtenerTransmisionViewer`.
- Puesta ANTES de `/transmisiones/destacadas` para evitar colisión de rutas.

**Frontend — `frontend/broadcast.html`** (nuevo, requiere auth organizador/operador/administrador):
- Selector de fuente: cámara (`getUserMedia`) o pantalla (`getDisplayMedia`) con toggle de audio.
- Vista previa local en `<video>`.
- Gestión multi-peer: Map `peerConns` (viewer_id → RTCPeerConnection); para cada viewer nuevo se crea oferta independiente.
- ICE servers: STUN Google público (`stun.l.google.com:19302`).
- Al detener: cierra todos los PeerConnections, libera tracks del stream.
- Muestra URL pública de viewer (`viewer.html?tx=ID`) con botón copiar.
- Enlace de vuelta al director (`director.html?tx=ID`).

**Frontend — `frontend/viewer.html`** (nuevo, público sin auth):
- Carga info del partido vía `/api/public/transmisiones/:id` (equipos, título, plataforma).
- Badge "EN VIVO" animado cuando el stream está activo.
- Se conecta a Socket.io y emite `webrtc:viewer-join`.
- Cuando recibe oferta WebRTC: crea `RTCPeerConnection`, asigna `srcObject` al `<video>`.
- Fallback YouTube: si el broadcaster se desconecta y la transmisión tiene `url_publica` válida (YouTube), convierte a embed URL y muestra iframe automáticamente.
- `convertirAEmbed(url)` extrae el ID de video de YouTube y genera la URL de embed.

**Frontend — `frontend/director.html`** (modificado):
- Card nueva "Transmitir video en vivo" con botón `btn-ir-broadcast` → `broadcast.html?tx=ID`.
- El ID se rellena automáticamente al conectar la transmisión.

**Frontend — `frontend/js/transmisiones.js`** (modificado):
- `btnViewer`: botón rojo (ojo) que aparece únicamente en filas con estado `en_vivo`; abre `viewer.html?tx=ID` en pestaña nueva.

### Verificación

- `node -e "require('./backend/services/socketService.js')"` — OK
- `node -e "require('./backend/controllers/transmisionController.js')"` — OK (obtenerTransmisionViewer exportado)
- `node -e "require('./backend/routes/publicRoutes.js')"` — OK

---

## 2026-05-03 — Transmisiones Fase 3: instrucciones OBS + compartir en redes

### Objetivo

Añadir al panel de director dos funcionalidades complementarias: una guía colapsable para configurar OBS y botones para compartir la transmisión en redes sociales con texto auto-generado.

### Implementación aplicada

**`frontend/director.html`:**
- Card **"¿Cómo agregar a OBS?"** (colapsable):
  - Lista `<ol>` con 7 pasos: abrir OBS → Sources → Browser Source → pegar URL → dimensión 1280×180 → activar "Shutdown when not visible" → OK.
  - Nota: el overlay se actualiza automáticamente sin reiniciar OBS.
  - `toggleInstrucciones()` con chevron animado (CSS `transform: rotate(180deg)`).
- Card **"Compartir"**:
  - `actualizarSharePreview(tx)` construye el mensaje con nombre de equipos, título y URL pública (`tx.url_publica` o `location.origin`).
  - `compartir(red)` abre las URLs de share de WhatsApp, Facebook, Twitter/X, o copia al portapapeles.
  - Vista previa del texto en una `div.share-preview` que el organizador puede leer antes de compartir.
- Variable global `txInfoGlobal` para acceso desde funciones de compartir sin pasar parámetros.

---

## 2026-05-03 — Fix: parámetro `tipo` en botón "Postales" de tablas.html

### Problema detectado

Al hacer clic en el botón "Postales" en `tablas.html`, `tablasplantilla.html` siempre abría en el tab "Posiciones" sin importar en cuál de los cuatro tabs estaba el usuario (Posiciones / Goleadores / Tarjetas / Fair Play).

### Causa

`actualizarBotonPostales()` en `tablas.js` construía la URL con parámetros `campeonato` y `evento` pero no incluía el tab activo. `tablasplantilla.js` no leía ningún parámetro `tipo` en su bloque de inicialización.

### Implementación aplicada

**`frontend/js/tablas.js`:**
- Nueva variable `let tablasTabActual = "tab-posiciones"`.
- Nuevo mapa `TABLAS_TAB_A_TIPO` que convierte IDs de tab a valores `tipo` (`"tab-goleadores"` → `"goleadores"`, etc.).
- `cambiarTablasTab(tabId)` ahora actualiza `tablasTabActual` y llama `actualizarBotonPostales()` en cada cambio de tab.
- `actualizarBotonPostales()` añade `tipo` a los parámetros de la URL si no es el valor por defecto (`"posiciones"` se omite para URLs más limpias).

**`frontend/js/tablasplantilla.js`:**
- Bloque de init ahora lee `tipo` de `RouteContext` y `URLSearchParams`.
- Si el tipo es válido (`posiciones/goleadores/tarjetas/fair_play`), activa el tab correspondiente (`data-tipo="..."`) y actualiza `tipoActual` antes de cargar datos.
- La activación del tab ocurre antes de `cargarDatos()` para que `actualizarContenidoPoster()` renderice el tipo correcto desde el primer ciclo.

---

## 2026-05-02 — Planilla PDF: separación visual entre etiqueta y valor

### Problema detectado

- Al quitar líneas y placeholders, algunas celdas de cabecera quedaban con el texto pegado:
  - `Categoria:SENIOR`
  - `Jornada:Jornada 4`
- Además, en la vista previa HTML el criterio visual no estaba centralizado.

### Implementación aplicada

- `frontend/js/planilla.js`
  - Se agregó `etiquetaReportePlanilla()` para normalizar el rótulo con `:`.
  - Se agregó `renderCampoMetaReportePlanilla()` para renderizar campos de cabecera como:
    - etiqueta,
    - separación fija,
    - valor o espacio libre.
  - La cabecera oficial y la vista previa resumen ahora usan el mismo patrón de campo.
  - En el PDF, `celdaMetaPdf()` ahora:
    - alinea etiqueta y valor a la izquierda,
    - agrega separación real entre columnas internas,
    - deja el área restante de la celda disponible para llenado manual.
- `frontend/css/style.css`
  - Se agregó `.planilla-meta-field` para mantener rótulo y área de valor alineados sin pegarse.

### Verificación

- `node --check frontend/js/planilla.js`
- `git diff --check`

---

## 2026-05-02 — Planillas: campos no llenados salen vacíos en reportes

### Objetivo

Evitar que los reportes de planilla impriman líneas de relleno o textos de placeholder cuando no se llenan datos operativos.

### Implementación aplicada

- `frontend/js/planilla.js`
  - Se agregó `valorReportePlanilla()` para normalizar valores vacíos en reportes.
  - En vista previa oficial, vista previa resumen y PDF, ahora quedan vacíos:
    - fecha/hora no definidas,
    - cancha/ciudad no definidas,
    - árbitro central,
    - línea 1 / línea 2,
    - delegado,
    - número visible de partido,
    - jornada sin dato,
    - dirigente/director técnico.
  - Se eliminaron placeholders visibles tipo `________________`, `Por definir`, `--:--`, `#-`, `Jornada -` y `-` en la salida del reporte.
  - Ajuste posterior: en el PDF los rótulos de la cabecera quedan alineados a la izquierda y el resto de cada celda queda libre para llenado manual en cancha, sin imprimir líneas de relleno.
  - Las líneas de firma se conservan porque son espacios operativos para firma, no datos faltantes.

### Verificación

- `node --check frontend/js/planilla.js`
- `git diff --check`

---

## 2026-05-02 — Planillas: orden alfabético por apellido en todos los deportes

### Objetivo

Ordenar los planteles de las planillas en forma alfabética por `apellido` para todos los tipos de deporte/formato disponibles, sin priorizar capitán ni número de camiseta.

### Implementación aplicada

- `backend/models/Jugador.js`
  - `obtenerPorEquipo()` ahora devuelve jugadores ordenados por:
    - apellido normalizado,
    - nombre,
    - `id` como desempate estable.
  - Se eliminó la prioridad visual previa de `es_capitan DESC` para que el orden de planilla sea estrictamente alfabético por apellido.
- `frontend/js/planilla.js`
  - Se agregó comparador `compararJugadoresPorApellidoPlanilla()`.
  - Se agregó `ordenarJugadoresPorApellidoPlanilla()` y `ordenarPlantelesPlanilla()`.
  - El orden se refuerza en:
    - plantel lateral,
    - tabla de captura oficial,
    - vista previa resumen,
    - vista previa oficial,
    - PDF,
    - Excel/lista de jugadores.

### Verificación

- `node --check backend/models/Jugador.js`
- `node --check frontend/js/planilla.js`

---

## 2026-05-01 — Continuidad: planilla PDF, documentación y checks rápidos

### Contexto

Se retomó el proyecto revisando documentación, pendientes y cambios locales abiertos. La continuidad inmediata quedó centrada en `frontend/js/planilla.js`, con dos PDFs de prueba generados:

- `docs/planillaConObservaciones.pdf`
- `docs/planillaSinObservaciones.pdf`

### Estado revisado

- `frontend/js/planilla.js` tiene cambios locales acotados a:
  - mostrar `Categoría` en encabezado web, vista previa oficial/resumen y PDF,
  - imprimir valores reales de convocatoria (`P/S`) en vista previa/PDF cuando el formato lo permite,
  - mantener helper único `obtenerCategoriaPlanilla()` para evitar diferencias entre vistas.
- Los PDFs nuevos tienen cabecera válida `%PDF-1.3`, pero en el entorno local no hay herramientas PDF instaladas (`pdfinfo`, `pdftotext`, `mutool`, `magick` o navegador headless en PATH) para extraer texto o hacer comparación visual automatizada desde consola.
- Se validó sintaxis con:
  - `node --check frontend/js/planilla.js`
  - `node --check frontend/js/tablasplantilla.js`
  - `node --check frontend/js/transmisiones.js`
- Se reparó el smoke frontend de roles:
  - `backend/scripts/smokeFrontendRoleGuards.js` ahora simula `document.documentElement` con APIs DOM suficientes para el `core.js` actual,
  - la página por defecto del rol `administrador` se actualizó a `admin.html`,
  - verificación final: `npm run smoke:frontend` con `38/38` aserciones correctas.

### Limpieza documental aplicada

- `docs/ESTADO_IMPLEMENTACION_SGD.md` tenía 2 bytes nulos y `rg` lo detectaba como archivo binario.
- Se eliminaron esos bytes y se corrigieron las referencias dañadas:
  - `056_gastos_operativos.sql`
  - `057_fix_fk_on_delete_set_null.sql`
- Verificación posterior: 0 bytes nulos.

### Pendientes inmediatos

- [ ] Validar visualmente en navegador/Render los PDFs con y sin observaciones:
  - categoría visible,
  - columnas `P/S` según formato,
  - fútbol 7/8/9 en una hoja cuando corresponde,
  - fútbol 11 sin regresión visual.
- [ ] Decidir si los PDFs de prueba deben versionarse como evidencia o mantenerse solo como artefactos locales.
- [ ] Ejecutar QA real de postales de tablas:
  - export PNG/PDF,
  - auspiciantes reales,
  - Goleadores / Tarjetas / Fair Play,
  - tema `Torneo`.
- [ ] Probar integración real de transmisiones Fase 1:
  - crear transmisión,
  - abrir `director.html`,
  - abrir `overlay.html` como Browser Source,
  - confirmar actualización por Socket.io.

---

## 2026-04-24 — Postales de Tablas: fixes visuales y UX completos

### Contexto
Sesión de prueba y corrección del módulo de postales (`tablasplantilla.html`) en producción (`ltyc.conrender.com`). Se detectaron y corrigieron 7 problemas distintos.

### Fixes implementados

#### 1. Botón "Postales" en `tablas.html` sin parámetros (`858c033`)
**Problema:** al hacer clic en "Postales" desde `tablas.html`, se abría `tablasplantilla.html` en blanco; el usuario tenía que re-seleccionar campeonato y categoría manualmente.
**Fix (`frontend/js/tablas.js`):** nueva función `actualizarBotonPostales()` que actualiza el `href` del botón con `?campeonato=X&evento=Y`. Se llama al cambiar campeonato, al cambiar categoría, al terminar de cargar tablas y en `DOMContentLoaded`. `tablasplantilla.js` ya leía URL params para pre-seleccionar.

#### 2. Layout header roto cuando no hay logo (`e0a30f3`)
**Problema:** el logo del campeonato arrancaba con `style="display:none"`, lo que sacaba el elemento del flujo CSS Grid. Los títulos y el año se desplazaban a las columnas incorrectas.
**Fix:** nueva clase CSS `.sin-logo` con `visibility:hidden; border:transparent` en lugar de `display:none`. Se agregaron `grid-column` explícitos al logo (col 1), títulos (col 2) y año (col 3). JS usa `classList.toggle("sin-logo")`. `onerror` en el img también aplica `.sin-logo`.

#### 3. Márgenes del banner "TABLA GENERAL" (`e0a30f3`)
**Fix:** `margin: .4rem [sides] .6rem` en `.tblp-title-strip` para separar visualmente el banner del header y del contenido.

#### 4. Nombres de equipos truncados (`cc63a4c` → `7103e90`)
**Problema:** `table-layout:fixed` + `max-width` en px fijo aplastaba la columna Equipo a ~2-3 caracteres visibles.
**Fix final:**
- `table-layout: auto` → el browser calcula anchos; columnas numéricas con `white-space:nowrap` son compactas
- `.tblp-equipo-nombre`: eliminado `max-width`, reemplazado por `flex:1; min-width:0`
- `.tblp-equipo-cell`: `min-width:0` para que el flex container pueda comprimirse
- `td.col-equipo`: `max-width:1px` activa el overflow del flex

#### 5. Imagen de cancha — perspectiva incorrecta (`cc63a4c` → `7103e90`)
**Problema:** `object-position: center 35%` mostraba el cielo y graderías, no el campo/pelota.
**Fix:** `object-position: center 65%` → muestra el campo verde en perspectiva con arco y pelota.

#### 6. Imagen de cancha personalizable por el organizador (`a160d67`, `7f77b67`)
- Commiteado `frontend/assets/ltc/cancha_fondo.jpg` como imagen predeterminada
- Reemplazada decoración CSS dibujada por `<img class="tblp-field-img">` con fallback `onerror`
- Nueva fila "**Cancha:**" en controles con 3 opciones:
  - **Predeterminada** → restaura `assets/ltc/cancha_fondo.jpg`
  - **Personalizar** → upload de cualquier imagen (aplicada vía `createObjectURL`)
  - **Restablecer** → aparece tras subir imagen custom; vuelve a la predeterminada

#### 7. Auspiciantes no aparecían (`7103e90`)
**Problema:** `cargarAuspiciantes` filtraba `.filter((a) => a.logo_url)` — si los auspiciantes del campeonato no tienen logo subido, el footer quedaba oculto.
**Fix:**
- Eliminado el filtro; se itera toda la lista
- Con logo → `<img class="tblp-sponsor-logo">`
- Sin logo, con nombre → `<span class="tblp-sponsor-nombre">` (borde suave, tipografía del tema)
- Footer visible con cualquier combinación de sponsors

### Archivos modificados
| Archivo | Cambios |
|---|---|
| `frontend/js/tablas.js` | `actualizarBotonPostales()` — link dinámico a postales |
| `frontend/tablasplantilla.html` | clase `sin-logo`, fila "Cancha:", `<img>` estadio |
| `frontend/js/tablasplantilla.js` | logo visibility, cancha personalizable, sponsors sin logo |
| `frontend/css/tablasplantilla.css` | grid-column header, table-layout:auto, flex nombres, object-position, `.tblp-sponsor-nombre` |
| `frontend/assets/ltc/cancha_fondo.jpg` | imagen de estadio predeterminada (nueva) |

### Commits de la sesión
| Hash | Descripción |
|---|---|
| `858c033` | feat: botón Postales pasa campeonato+evento a tablasplantilla |
| `e0a30f3` | fix: layout header con/sin logo y márgenes title strip |
| `a160d67` | asset: imagen estadio fondo cancha |
| `cc63a4c` | fix: nombres equipo + imagen estadio desde archivo |
| `7f77b67` | feat: cancha personalizable por el organizador |
| `7103e90` | fix: nombres completos, cancha en perspectiva, auspiciantes |

### Estado al cierre
- Poster funcional en producción con: fondo amarillo/deportivo, logo campeonato, año, banner "TABLA GENERAL", tabla con nombres completos, imagen estadio en perspectiva, auspiciantes (logo o nombre)
- 7 fondos predefinidos + fondo personalizado (imagen)
- Cancha predeterminada + cancha personalizable
- Export PNG y PDF operativos

### Pendientes próxima sesión
- [ ] **Probar export PNG/PDF** con datos reales y verificar que la imagen de cancha y los logos se incrustan correctamente en el archivo descargado
- [ ] **Validar con auspiciantes reales** — confirmar que el footer de sponsors aparece al cargar el campeonato "Interjorgas Financiero"
- [ ] **Probar Goleadores, Tarjetas y Fair Play** — verificar que los 4 tipos de tabla se renderizan bien en el poster
- [ ] **Tema "Torneo"** — probar con un campeonato que tenga `color_primario/secundario/acento` configurados
- [ ] **Playoff/Eliminatorias** — validación operativa del sembrado interleaved con datos reales
- [ ] Pruebas integrales del flujo completo: `tablas.html` → Buscar → Postales → Exportar

---

## 2026-04-23 — Sesión 2: Postales de Tablas — diseño deportivo completo

### Objetivo
Implementar página `tablasplantilla.html` para crear y exportar postales visuales (PNG/PDF) de las tablas de posiciones, goleadores, tarjetas y fair play, replicando un diseño "deportivo" con fondo amarillo, banner pill, badges de posición y decoración cancha de fútbol.

### Archivos modificados

#### `frontend/tablasplantilla.html`
- Fondo inicial del poster cambiado de `fondo-nocturno` a **`fondo-deportivo`** (amarillo).
- Swatch "Deportivo" agregado como **primera opción** en el selector de fondos.
- Columna derecha del header poster: reemplazado `tblp-tipo-badge` por **`tblp-year`** (año del campeonato, llenado dinámicamente por JS).
- Añadido **`tblp-title-strip`** estático (banner pill) entre header y contenido; el JS actualiza su texto al cambiar de tab.
- Añadida **decoración cancha CSS** (`tblp-field-deco` + `tblp-field-ball`) entre contenido y footer de auspiciantes.

#### `frontend/css/tablasplantilla.css` — reescritura completa
- **7 temas** definidos con CSS variables: `deportivo` (amarillo, predeterminado), `nocturno`, `clasico`, `azul`, `vinotinto`, `verde`, `torneo`.
- Variables por tema: `--p-bg`, `--p-color`, `--p-card-bg/border/text`, `--p-accent`, `--p-row-even/odd`, `--p-badge-bg/color`, `--p-title-bg/color`, `--p-col-gf/gc/pts/dg`, `--p-sponsors-bg/color`.
- **Header 3 columnas** (logo | títulos | año): `grid-template-columns: auto 1fr auto`.
- **`.tblp-year`**: año grande en la columna derecha.
- **`.tblp-title-strip`**: franja pill `border-radius:999px` para nombre de tabla.
- **`.tblp-pos-badge`**: ovalo con `--p-badge-bg/color` en columna de posición.
- **Columnas con tono diferenciado**: `.col-gf`, `.col-gc`, `.col-pts`, `.col-dg`.
- **`.tblp-field-deco`**: campo verde CSS con líneas (gradients lineales/radiales) y círculo central.
- **`.tblp-field-ball`**: pelota de fútbol CSS centrada en la cancha.
- **`.tblp-poster-footer`**: franja auspiciantes con `--p-sponsors-bg`.

#### `frontend/js/tablasplantilla.js`
- `fondoActual` inicializado a `"deportivo"`.
- `aplicarFondo()`: array de fondos incluye `fondo-deportivo`; fallback al quitar imagen custom usa `"deportivo"`.
- `actualizarContenidoPoster()`: actualiza el texto del `#tblp-title-strip` según tab activo (`Tabla General`, `Tabla de Goleadores`, etc.).
- `actualizarHeaderPoster()`: extrae año de `camp.fecha_inicio` y rellena `#tblp-year`.
- `renderPosterPosiciones()`: usa `tblp-pos-badge`, `tblp-poster-body`, `tblp-tabla-wrap`, clases `col-pos/col-equipo/col-gf/col-gc/col-dg/col-pts`.
- `renderPosterGoleadores()`, `renderPosterTarjetas()`, `renderPosterFairPlay()`: idem — envueltos en `tblp-poster-body` + `tblp-tabla-wrap`, columnas con clases semánticas.

### Commits
| Hash | Descripción |
|------|-------------|
| `a528798` | feat: página de postales exportables de tablas (tablasplantilla) |
| `538a6df` | feat: postales de tablas con diseño deportivo completo |

### Pendientes próxima sesión
- [ ] Probar en browser con datos reales (campeonato + categoría cargada).
- [ ] Validar export PNG y PDF con los 4 tipos de tabla.
- [ ] Verificar tema "Torneo" con colores reales del campeonato (`color_primario/secundario/acento`).
- [ ] Playoff/Eliminatorias: validación operativa del sembrado interleaved con datos reales.

---

## 2026-04-23 — Módulo Liga: poster con temas visuales + verificación backlog

### Cambios implementados
- **`frontend/gruposgen.html`**: agrega card wrapper (`poster-liga-card`) con header "Equipos inscritos" y `<span id="poster-liga-count">` dentro de `poster-liga`. La exportación PNG/PDF existente (`zona-grupos-export`) ya captura esta sección sin cambios adicionales.
- **`frontend/js/gruposgen.js`** (`cargarEquiposLiga`): actualiza el contador `poster-liga-count` con el número de equipos cargados.
- **`frontend/css/grupos.css`**: añade estilos para `.poster-liga-card` y `.poster-liga-card-head` usando CSS variables del tema (`--poster-card-bg`, `--poster-card-border`, `--poster-card-text`). Agrega overrides `.poster .team-row` y `.poster .team-logo` para que los bordes y fondos sean theme-aware en los tres temas (oscuro, clásico, torneo).

### Verificaciones de backlog (sin cambio de código)
| Ítem | Estado |
|------|--------|
| auto-programar slots sin partido_id | ✅ `programarSlot` crea el registro y lo vincula |
| Playoff fecha/hora/cancha en portal | ✅ `renderEliminatoriasPortal` líneas 1716-1721 |
| Tema visual `jornadasplantilla.html` | ✅ `aplicarTemaJornada()` + CSS variables |
| Exportación PNG/PDF bracket | ✅ `exportarEliminatoriaPNG/PDF` + html2canvas/jspdf |

### Commits
`feat: poster de liga con card wrapper, conteo y temas visuales theme-aware`

---

## 2026-04-22 — Sesión 2 (noche): UX Transmisiones + fix categorías Infanto-Juveniles

### 1. Mejora UX módulo Transmisiones (`e5a864a`)

**Problema reportado:** la página `transmisiones.html` abría en el tab "En vivo" (vacío el 99% del tiempo), no había explicación del flujo, no había botón para crear ni guía.

**Cambios en `frontend/transmisiones.html` + `frontend/js/transmisiones.js`:**

- **Guía colapsable** al inicio: explica el flujo de 3 pasos (1. Configurar desde Partidos → 2. Panel Director → 3. Overlay OBS).
- **Tab por defecto cambiado a "Todas"** (antes era "Activas" / En vivo).
- **Contadores de badge** en cada tab: Todas / 🔴 En vivo / Programadas, se actualizan al cargar datos.
- **Botón "Nueva transmisión"** junto al selector de campeonato; enlaza a `partidos.html?campeonato=ID` con el campeonato ya cargado.
- **Auto-selección de campeonato** si solo existe uno en el sistema.
- **Href del botón "Nueva transmisión"** se actualiza dinámicamente al cambiar el campeonato.
- **Estados vacíos enriquecidos**: icono + título + mensaje y botón de acción contextual por tab (Todas / En vivo / Programadas).
- **Estado vacío inicial**: si no hay campeonato seleccionado, muestra mensaje claro "Selecciona un campeonato".

### 2. Fix crítico + UX: categorías Infanto-Juveniles (`8a30eea`)

**Problema reportado:** al crear una categoría "SUB 4", el campo "Fecha de corte de edad" no aparecía en el formulario. El backend rechazaba la creación con error 400.

**Causa raíz (doble bug en `frontend/js/eventos.js` línea 130):**
- Los bytes `\b` (word boundary) estaban almacenados como `0x08` (carácter de control backspace) en el archivo.
- Los `\s` (whitespace) estaban como `s` sin backslash.
- Resultado: la regex `/\b(?:sub|u)s*-?s*(4|6|8|...)\b/` nunca detectaba "SUB 4" (con espacio).

**Fix del regex:** reescritura byte a byte para dejar `/\b(?:sub|u)\s*-?\s*(4|6|8|10|12|14|16|17|18|19)\b/`.

**Reemplazo del enfoque de auto-detección por nombre → selector explícito:**

- **Nuevo selector "Tipo de categoría por edad"** al inicio del formulario:
  - `Libre / Sin restricción de edad`
  - `Infanto-Juvenil (Sub-4 a Sub-19)` → despliega sub-selector + fecha de corte
  - `Veteranos (Sub-30 a Sub-60)` → muestra cupos/diferencia juvenil
- **Selector Sub-N** (Sub-4, Sub-6, Sub-8, Sub-10, Sub-12, Sub-14, Sub-16, Sub-17, Sub-18, Sub-19): al elegir, auto-rellena el nombre con "Sub N". El usuario puede añadir sufijo (ej: "Sub 8 Varones").
- **Campo "Fecha de corte"** ahora aparece visible e inmediatamente debajo del selector Sub-N (marcada con `*` de requerido).
- Al crear exitosamente, el formulario resetea tipo, sub-edad y fecha de corte.

### Commits de esta sesión
| Hash | Descripción |
|------|-------------|
| `e5a864a` | feat: mejora UX módulo transmisiones — guía, tabs, contadores y estados vacíos |
| `8a30eea` | fix: categorías infanto-juveniles — selector explícito, regex corregida |

---

## 2026-04-22 — Transmisiones Fase 1: navegación director ↔ lista

### Cambios
- **`frontend/js/transmisiones.js`**: botón morado (ícono `fa-sliders-h`) en la tabla de transmisiones que abre `director.html?tx=ID` para estados `programada`, `borrador` o `en_vivo`.
- **`frontend/director.html`**: flecha de regreso (`fa-arrow-left`) en el header que navega a `transmisiones.html`.

### Verificación de arquitectura (sin cambios de código)
- Socket.io (`socket.io@^4.8.3`) está en las dependencias del backend.
- `overlay.html` se sirve como archivo estático sin barrera de auth.
- `/api/public/overlay/:token` registrado en `publicRoutes.js` (sin auth).
- `director.html` lee `?tx=` desde la URL y llama `cargarTransmision()` automáticamente en `DOMContentLoaded`.
- `programarSlot` crea un registro en `partidos` cuando `partido_id` es null (ítem 782 del backlog cubierto).
- La función `esPartidoConResultadoPortal` excluye correctamente `suspendido`, `pendiente` y `aplazado` del tab Resultados (ítem de filtrado verificado).

### Commit
`871b7ee` feat: acceso directo al panel de director desde lista de transmisiones

---
## 2026-04-21 — Fix: portal Copa Ciudad de Loja — 8vos pendientes y Sub+40 sin resultados

### Síntoma 1 — Abierta: 8vos de final se mostraban como "pendientes"
- En el portal, la categoría Abierta (evento 8) mostraba los 8 partidos de 8vos con `estado=pendiente`
  aunque los resultados ya estaban registrados.
- Causa: los slots en `partidos_eliminatoria` tenían `ganador_id` y resultados correctos,
  pero los registros correspondientes en `partidos` (IDs 4368-4375) seguían con `estado='pendiente'` y 0-0.
- El portal usa `partidos.estado` para decidir si mostrar como "finalizado" o "pendiente".

### Fix — migración 066 (`database/migrations/066_fix_bracket_slots_finalizado.sql`)
```sql
UPDATE partidos p
SET estado = 'finalizado',
    resultado_local = pe.resultado_local,
    resultado_visitante = pe.resultado_visitante,
    updated_at = NOW()
FROM partidos_eliminatoria pe
WHERE pe.partido_id = p.id
  AND pe.ganador_id IS NOT NULL
  AND pe.resultado_local IS NOT NULL
  AND pe.resultado_visitante IS NOT NULL
  AND p.estado = 'pendiente';
```
- Idempotente: solo actualiza partidos que aún estén `pendiente` con slot ya resuelto.
- En producción actualizará los 8 slots de Abierta 8vos (IDs 4368-4375).

### Síntoma 2 — Sub+40: tab "Resultados" no mostraba 8vos ni 4tos
- Los slots del bracket de Sub+40 (evento 9) tienen `partido_id` apuntando a registros
  de `partidos` con `evento_id` distinto de 9.
- Por eso, `/api/public/eventos/9/partidos` devuelve solo las 9 jornadas regulares (86 partidos).
- El tab "Resultados" usaba solo esos 86 partidos → no veía los 8vos/4tos finalizados.
- El tab "Playoff" SÍ los mostraba (endpoint `/eliminatorias` usa `partidos_eliminatoria.evento_id`).

### Fix — `frontend/js/portal.js` — `enriquecerColeccionesPortal` (commit `a3d9359`)
Después de construir `rondasEnriquecidas`, se recogen los slots cuyo `partido_id` no
está en el endpoint regular y se agregan como "partidos virtuales" al array de partidos:
```javascript
const slotsHuerfanos = rondasEnriquecidas.flatMap(ronda =>
  ronda.partidos
    .filter(slot => !partidosPorId.has(Number.parseInt(slot?.partido_id, 10)))
    .map(slot => ({ ...slot, id: slot?.partido_id, equipo_local_logo_url: slot?.equipo_local_logo, ... }))
);
return { partidos: [...partidosEnriquecidos, ...slotsHuerfanos], ... };
```
- Los slots con `estado='finalizado'` pasan el filtro `esPartidoConResultadoPortal` → aparecen en Resultados.
- Los slots `pendiente` (semifinal futura, etc.) también aparecen en Jornadas como partidos próximos.

### Commits de esta sesión
| Hash | Descripción |
|------|-------------|
| `a3d9359` | fix: portal Copa Loja — 8vos pendientes y resultados Sub+40 |

---

## 2026-04-21 — Fix: fechas de partidos en portal organizador (desfase UTC-5)

### Síntoma
En el dashboard del organizador (`portal-admin.html`), los partidos mostraban
la fecha un día anterior a la fecha real.

### Causa raíz
`frontend/js/dashboard-organizador.js` — función `formatearFecha()`:

```javascript
// ANTES (buggy)
const d = new Date(String(f).includes("T") ? f : f + "T00:00:00");
```

El campo `fecha_partido` (`DATE` en PostgreSQL) es serializado por el driver `pg`
como `"2025-12-27T00:00:00.000Z"`. Al contener `"T"`, el código usaba el string
completo con zona UTC (`Z`). `new Date("...Z")` = UTC medianoche = **día anterior
a las 19:00 en Ecuador (UTC-5)** → `toLocaleDateString` mostraba el día incorrecto.

### Fix (`frontend/js/dashboard-organizador.js`, commit `ebadd78`)

```javascript
// AHORA (correcto)
const ymd = String(f).slice(0, 10);           // extrae "YYYY-MM-DD" ignorando la parte T y Z
const [y, m, d] = ymd.split("-").map(Number);
const dt = new Date(y, m - 1, d);             // hora local, sin desfase UTC
return dt.toLocaleDateString("es-EC", { weekday: "short", day: "2-digit", month: "short" });
```

### Por qué solo este archivo
- `portal.js` ya tenía `parseFechaLocalPortal()` con regex que extrae `YYYY-MM-DD` → correcto.
- `partidos.js` usa `normalizarFechaISO()` que retorna el string sin construir `Date` → correcto.
- Solo `dashboard-organizador.js` tenía el patrón incorrecto.

### Patrón correcto para fechas DATE de PostgreSQL en frontend (UTC-5 Ecuador)
```javascript
// ✅ Siempre extraer YYYY-MM-DD antes de construir un Date
const [y, m, d] = String(fecha).slice(0, 10).split("-").map(Number);
const dt = new Date(y, m - 1, d); // hora local
```

---

## 2026-04-18 - Planilla PDF fútbol 8/9: modo compacto para todos los formatos no-fútbol11

### Objetivos de la sesión
Corregir desbordamiento de página en planillas PDF de fútbol 8 y fútbol 9:
- Ambos formatos usaban modo NORMAL (márgenes amplios, `_espacioFijo=490`) con < 24 filas
- En modo normal la estimación de espacio fijo era incorrecta → filas se derramaban a pág 2
- Solución: cualquier formato que no sea fútbol 11 usa siempre modo compacto

### Cambios en `frontend/js/planilla.js`

#### Modo compacto — cobertura extendida (línea ~5207)
- **Antes**: `modoCompactoPdf = esFutbol7 || totalFilasImpresion >= 24`
  → Fútbol 8/9 con 18 filas (< 24) caía en modo NORMAL → overflow
- **Ahora**: `modoCompactoPdf = !arbitraje.esFutbol11 || totalFilasImpresion >= 24`
  → Todos los formatos no-fútbol11 (f7, f8, f9, f6, f5, sala, indor, basquetbol) siempre compactos
  → Fútbol 11 con < 24 filas conserva modo NORMAL (comportamiento anterior)

#### `_alturaFilaMax` unificado
- **Antes**: compact → 20, normal → 30 (distinción compact/normal)
- **Ahora**: no-ultra → **28** (cap único; ultra sigue en 22)
- Razón: cap de 20pt dejaba ~134pt vacíos en fútbol 8/9 con 18 filas (fórmula calculaba 26.9pt → capado a 20)
- Con cap 28: fútbol 8/9 → 26.9pt × 19 filas = ~511pt → página llena correctamente

#### Verificación matemática (modo compacto, _espacioFijo=320, _margenVertical=10)
| Formato | Filas | alturaFila | Total |
|---------|-------|-----------|-------|
| Fútbol 7  | 14 | 28.0pt | 746/841pt |
| Fútbol 8/9 | 18 | 26.9pt | 837/841pt |
| Fútbol 11 custom (≤23f) | 17 | 17.1pt | 838/841pt (modo normal) |

### Formatos NO afectados
- Fútbol 11 custom (≤23 filas): sigue en modo NORMAL
- Fútbol 11 estándar (24-29 filas): modo COMPACTO (sin cambio en lógica)
- Fútbol 11 ultra (30+ filas): modo ULTRA-COMPACTO (sin cambio)

---

## 2026-04-18 - Planilla PDF fútbol 7: modo compacto, filas angostas, obs en pág 2

### Objetivos de la sesión
Ajustes a la generación de PDF de planilla para fútbol 7 (Liga y otros formatos):
1. Modo compacto siempre activo para fútbol 7 → 1 hoja sin obs, filas angostas
2. Observaciones siempre en página 2 con `pageBreak: "before"` (no más inline compacto)
3. `_alturaFilaMax` reducido (compact: 26→20, normal: 40→30) para filas más angostas
4. Fila 3 de la tabla de info: eliminar duplicación de Partido/Jornada para formatos no-fútbol11

### Cambios en `frontend/js/planilla.js`

#### Modo compacto (línea ~5207)
- **Antes**: `modoCompactoPdf = usarObservacionesCompactasPdf || totalFilasImpresion >= 24`
  (`usarObservacionesCompactasPdf` activaba modo compacto Y obs inline para fútbol 7)
- **Ahora**: `modoCompactoPdf = esFutbol7 || totalFilasImpresion >= 24`
  Fútbol 7 siempre compacto; obs nunca inline.
- `modoUltraCompactoPdf = totalFilasImpresion >= 30` (simplificado, mismo resultado)
- `_espacioFijo = modoUltraCompactoPdf ? 387 : modoCompactoPdf ? 320 : 490` (sin delta obs compactas)

#### Altura de filas (línea ~5220)
- `_alturaFilaMax`: compact 26→**20**, normal 40→**30**
- Efecto para fútbol 7 compacto con 14 filas: ~20pt por fila (más angosta que antes)

#### Tabla de información — fila 3 (línea ~5337)
- **Antes**: fila 3 col1=Partido, col3=Jornada para TODOS los formatos (duplicado con fila 2 en no-futbol11)
- **Ahora**: fila 3 col1 y col3 solo se llenan si `arbitraje.esFutbol11 = true`
- Para fútbol 7: fila 3 = `"" | "" | "" | "Liga: X"` → sin duplicación

#### Observaciones (línea ~5582)
- **Antes**: `if usarObservacionesCompactasPdf → obs inline (misma hoja)` else `pageBreak`
- **Ahora**: siempre `pageBreak: "before"` para todos los formatos
- Resultado: **sin obs = 1 hoja**, **con obs = 2 hojas** para fútbol 7 y fútbol 11

### Nota sobre etiquetas de árbitro (Árbitro central / Línea 1 / Línea 2)
Estas etiquetas solo aparecen cuando `esFutbol11 = true` (código correcto).
Si un campeonato de fútbol 7 Liga muestra etiquetas de fútbol 11, es porque su
`tipo_futbol` o `tipo_deporte` en BD tiene el valor `"futbol_11"` (default al crear sin especificar).
**Solución**: editar el campeonato y cambiar el tipo de deporte a `"futbol_7"`.

### Formatos NO afectados
- Fútbol 11 (≤23 filas custom): sigue en modo NORMAL (sin cambio)
- Fútbol 11 (24-29 filas): sigue en modo COMPACTO (misma lógica anterior, alturaFilaMax era 26, ahora 20 — filas ligeramente más angostas)
- Fútbol 11 (30+ filas): modo ULTRA-COMPACTO (sin cambio)

---

## 2026-04-17 - Módulo de Transmisión en Vivo Phase 1: Socket.io Overlay para OBS

### Objetivos de la sesión
Implementar el módulo de transmisión en vivo Phase 1 (Pendiente 2):
- Panel de director (`director.html`) para controlar marcador en tiempo real
- Overlay para OBS Browser Source (`overlay.html`) con fondo transparente
- Backend Socket.io para broadcast instantáneo del estado del marcador
- API REST para persistir estado en BD (PostgreSQL)
- Tokens únicos por transmisión para acceso público sin auth al overlay

### Archivos creados

#### Base de datos
- `database/migrations/064_transmision_overlay.sql` — tabla `transmision_overlay_state` (goles, minuto, período, toggles)
- `database/migrations/065_transmisiones_overlay_token.sql` — columnas `overlay_token` + `director_token` en `partido_transmisiones`

#### Backend
- `backend/services/socketService.js` — inicializa Socket.io 4.8.3, gestiona salas `overlay:{id}`, expone `emitOverlayState()`
- `backend/models/TransmisionOverlay.js` — CRUD para `transmision_overlay_state` con `obtenerOCrear`, `actualizar`, `reset`
- `backend/controllers/overlayController.js` — GET/PUT overlay (auth) + GET público por token (sin auth para OBS)
- `backend/routes/overlayRoutes.js` — monta rutas en `/api/transmisiones/:id/overlay`

#### Frontend
- `frontend/overlay.html` — Browser Source para OBS (fondo transparente, socket.io client, marcador animado)
- `frontend/director.html` — Panel de control completo: ajuste de goles +/-, cronómetro, período, toggles, presets de texto, URL overlay para copiar

### Cambios en archivos existentes

#### `backend/server.js`
- `app.listen` → `httpServer = createServer(app)` + `httpServer.listen`
- `initSocket(httpServer)` llamado justo antes de listen
- `require('./services/socketService')` + `require('./routes/overlayRoutes')`
- Nueva ruta: `app.use('/api/transmisiones/:id/overlay', overlayRoutes)`

#### `backend/models/PartidoTransmision.js`
- `asegurarTabla()`: agrega inline migration para `overlay_token` y `director_token`
- `limpiar()`: expone `overlay_token` y `director_token` en el JSON de respuesta

#### `backend/controllers/transmisionController.js`
- Nueva función `obtenerTransmisionPorId(req, res)` — GET transmisión por su propio ID (incluye nombres de equipo y tokens)

#### `backend/routes/transmisionRoutes.js`
- `GET /:id` → `obtenerTransmisionPorId` (para que el director panel pueda cargar datos de la transmisión)

#### `backend/routes/publicRoutes.js`
- `GET /api/public/overlay/:overlay_token` → `overlayController.getOverlayPublico` (sin auth, para overlay.html en OBS)

### Arquitectura Socket.io

```
Director Panel (director.html)
  │  PUT /api/transmisiones/:id/overlay (HTTP REST → persiste en BD)
  │  socket.emit("overlay:update", { transmision_id, state })
  ▼
Backend Socket.io (socketService.js)
  │  socket.to(`overlay:${id}`).emit("overlay:state", state)
  ▼
OBS Browser Source (overlay.html)
  socket.on("overlay:state", aplicarState)
```

### Flujo de uso
1. Organizador va a `director.html`, ingresa el ID de la transmisión y hace clic en "Conectar"
2. El sistema muestra el marcador 0-0, nombres de equipos y genera la URL del overlay
3. Copia la URL del overlay → la pega en OBS como Browser Source (1280×180px, fondo transparente)
4. Controla goles (+/-), minuto, período, toggles y texto de evento
5. Hace clic en "Enviar ahora" → el overlay en OBS se actualiza en tiempo real via Socket.io

### npm
- `socket.io@4.8.3` instalado en `backend/`

---

## 2026-04-11 - Planilla PDF: dual-mode sin/con observaciones + layout A4 completo

### Objetivos de la sesión
El usuario compartió el PDF de planillaje de Fútbol 11 y solicitó:
1. Versión **sin observaciones**: toda el acta en una hoja A4, mejor uso del espacio, logo más grande
2. Versión **con observaciones**: mismas mejoras + observaciones en página 2
3. Dos botones PDF para elegir versión
4. Logo y nombre del equipo **centrados juntos** en la sección del marcador
5. Font size de jugadores más grande

### Commits de esta sesión
- `37a9901` — feat: planilla PDF dual mode — sin/con observaciones, logo+nombre centrado apilado
- `bce2cfc` — fix: centrado logo+nombre planilla y ocupar hoja A4 completa
- `dcff480` — fix: altura de filas planilla dinámica para llenar A4 en todos los modos
- `86c4763` — fix: centrado marcador y ajuste espacioFijo para evitar overflow
- `99ee6e6` — fix: reducir 1pt altura filas ultra compact (30 jugadores)
- `4188473` — fix: restar 2pt altura filas ultra compact para entrar en 1 pagina
- `7804c71` — fix: espacio firma tecnico y evitar corte de texto en ultra compact

### Cambios en `frontend/js/planilla.js`

#### `construirCeldaMarcadorEquipoPdf()` (línea ~4778)
- **Antes**: logo + nombre en tabla horizontal lado a lado, logo pequeño [22/18/14]
- **Ahora**: tabla vertical (`widths: ["*"]`), logo arriba centrado [36/28/22], nombre centrado debajo
- Centrado real: tabla con `widths: ["*"]` para que `alignment: "center"` funcione en celdas de pdfMake

#### `imprimirPDFPlanilla(conObservaciones = true)` — nuevo parámetro
- `conObservaciones = false` → omite sección de observaciones (toda la planilla en 1 A4)
- `conObservaciones = true` → observaciones en **página 2** con `pageBreak: "before"` (aplica a todos los deportes, incluyendo Fútbol 11 que antes las ponía en la misma página)

#### Tabla del marcador
- `widths`: columnas de equipo cambiadas de `[150, ..., 150]` → `["*", ..., "*"]` → la tabla ocupa el ancho completo de la página y ambos equipos quedan perfectamente centrados y simétricos
- Altura de fila marcador: 34/28/24 → **72/46/38** pt
- Score digits: `verticalAlignment: "middle"` + `margin: [0,0,0,0]` (antes con top-margin fijo)

#### Fuentes de jugadores (aumentadas)
- `defaultStyle.fontSize`: 8.1/7.5/6.9 → **8.8/8.0/7.4**
- `tdCenter/tdLeft`: 7.3/6.4/5.9 → **8.5/7.4/6.6**
- `thCenter/thLeft`: 7.6/6.6/6.1 → **8.8/7.6/6.8**

#### Alturas de filas — cálculo dinámico (clave de la solución)
- **Problema original**: alturas hardcodeadas (5.8pt ultra, 7pt compact, 10pt normal) dejaban mucho espacio vacío porque `modoUltraCompactoPdf` se activa si `totalFilasImpresion >= 30` — incluso cuando hay solo 5 jugadores reales pero maxFilas=30
- **Solución**: cálculo dinámico que distribuye el espacio disponible:
  ```javascript
  const _espacioFijo = modoUltraCompactoPdf ? 387 : modoCompactoPdf ? 320 : 490;
  const _espacioParaFilas = 841 - margenVertical - _espacioFijo;
  const alturaFilaPlantel = clamp(min, max, _espacioParaFilas / (totalFilas + 1));
  ```
- Resultado: con 30 filas ultra compact → ~14.4pt/fila, la planilla llena ~97% de A4

#### Márgenes de página (modo normal < 24 jugadores)
- `pageMargins`: `[8,6,8,6]` → `[10,22,10,22]`

#### Separación entre bloques (modo normal)
- Header→info: 12 → 20pt
- Info→score: 5 → 14pt
- Score→plantel: 5 → 16pt
- Plantel→pagos: 6 → 18pt

#### Firma técnico (ultra compact)
- Columna label: 38 → **56pt** (evita que "Firma tecnico:" se parta en 2 líneas)
- Altura fila firma: 7 → **10pt**
- Margen DT arriba: 1 → **3pt** (respiro entre plantel y línea del director técnico)

### Cambios en `frontend/planilla.html`
- Reemplazado el botón único "Imprimir / PDF" por **dos botones**:
  - `PDF sin observaciones` (btn-danger) → `exportarPlanillaPDFSinObservaciones()`
  - `PDF con observaciones` (btn-outline rojo) → `exportarPlanillaPDF()`
- Mismo patrón en la barra de la vista previa (botones xs)

### Nuevas funciones JS expuestas en `window`
- `exportarPlanillaPDFSinObservaciones()` → llama `imprimirPDFPlanilla(false)`
- `exportarPlanillaPDF()` → llama `imprimirPDFPlanilla(true)`

---

## 2026-04-07 - Baloncesto: Planilla UI + Portal + Jugadores (Fases 3, 5, 6)

### Planilla baloncesto (Fase 3 — `219708d`)
- **`planilla.html`**: nueva sección `#grupo-overtime-planilla` (amber card, hidden) con campos de puntos en tiempo extra local/visitante.
- **`planilla.js`**:
  - `renderTablaCapturaEquipo`: detecta `esBasquetbol`; agrega selector `cap-tipo-punto` (2pts/3pts/1pt) por fila cuando es baloncesto.
  - `obtenerColumnasRegistroPlanilla`: cabeceras adaptadas → G/Gol → P/Pts, TA → Falt, TR → F.Téc para baloncesto.
  - `recolectarPayloadPlanilla`: lee `cap-tipo-punto`, incluye `tipo_punto` + `tipo_gol` en payload de goles; incluye `overtime_utilizado`, `overtime_puntos_local/visitante`.
  - `actualizarVisibilidadOvertimePlanilla` (nueva): muestra/oculta sección overtime cuando hay empate en baloncesto.
  - `adaptarLabelsBasquetbol` (nueva): renombra etiquetas del footer (Tarjetas → Faltas personales/técnicas).
- **`style.css`**: `.cap-goles-basquet` (flex selector + input), `.planilla-overtime-grid` (amber card).

### Portal baloncesto (Fase 5 — `8631034`)
- **`portal.js`**:
  - `renderCategoriaPanelPortal`: deriva `esBasquetbol` y pasa a subtabs → Goleadores → Anotadores, Tarjetas → Faltas personales/Faltas técnicas.
  - `renderGoleadoresPortal(esBasquetbol)`: columna Goles → Pts; mensaje vacío sport-aware.
  - `renderTarjetasPortal(esBasquetbol)`: columnas TA/TR → Faltas/F.Téc; mensaje sport-aware.
  - `renderResumenCategoriaPortal`: "Goleadores activos" → "Anotadores activos" para baloncesto.

### Jugadores baloncesto (Fase 6 — `8631034`)
- **`jugadores.js`**:
  - `campeonatoMeta`: agrega campo `tipo_deporte` (leído de API).
  - `obtenerEstadoDisciplinarioJugador`: badge "Acumula X TA" → "Acumula X falta(s)" para baloncesto.

## 2026-04-06 - Fase 2: Panel operativo de transmisiones + destacado en portal

- **Migración 062**: `ALTER TABLE partido_transmisiones ADD COLUMN destacado BOOLEAN DEFAULT FALSE` + índice parcial.
- **`PartidoTransmision.js`**: `listarPorCampeonato()` (JOIN con partidos/equipos), `toggleDestacado()`, `listarDestacadas()`; `limpiar()` incluye `destacado`; `crear()` acepta `estado`.
- **`transmisionController.js`**: `listarTransmisionesPorCampeonato`, `toggleDestacado`, `listarDestacadasPublicas`.
- **`transmisionRoutes.js`**: GET `/` (listar por campeonato) y POST `/:id/destacar`.
- **`publicRoutes.js`**: GET `/public/transmisiones/destacadas`.
- **`frontend/transmisiones.html`** (nuevo): página de gestión con selector de campeonato, tabs Activas/Todas/Programadas, tabla con badge de estado y botón ⭐ para destacar.
- **`frontend/js/transmisiones.js`** (nuevo): lógica completa de gestión de transmisiones.
- **`frontend/js/transmision.js`**: soporte de estado `borrador` (label, badge, botones modal).
- **`frontend/js/portal.js`**: `renderProximaTransmisionPortal()` — card de "Próxima transmisión/En vivo" en detalle de campeonato.
- **`frontend/partidos.html`** y **`frontend/campeonatos.html`**: link "Transmisiones" en sidebar.

## 2026-04-06 - Fase 1: Transmisión de partidos en vivo

- **Migración 061** (`partido_transmisiones`): tabla con `partido_id` (FK única), `campeonato_id`, `evento_id`, `titulo`, `descripcion`, `plataforma`, `url_publica`, `embed_url`, `estado` (`programada/en_vivo/finalizada/cancelada`), `fecha_inicio_programada`, `fecha_inicio_real`, `fecha_fin_real`, `thumbnail_url`, `creado_por` + timestamps.
- **`backend/models/PartidoTransmision.js`**: `asegurarTabla`, `obtenerPorPartido`, `crear`, `actualizar`, `iniciar`, `finalizar`, `cancelar`, `listarActivas`, `listarActivasPorCampeonato`.
- **`backend/controllers/transmisionController.js`**: 8 funciones (obtener, crear, actualizar, iniciar, finalizar, cancelar, pública, activas-por-campeonato).
- **`backend/routes/transmisionRoutes.js`**: PUT `/:id`, POST `/:id/iniciar|finalizar|cancelar` (auth organizador/administrador).
- **`backend/routes/partidoRoutes.js`**: GET + POST `/:id/transmision` (auth organizador/administrador).
- **`backend/routes/publicRoutes.js`**: GET `/partidos/:id/transmision` + GET `/campeonatos/:id/transmisiones-activas` (sin auth).
- **`backend/server.js`**: registro `app.use('/api/transmisiones', transmisionRoutes)`.
- **`frontend/js/transmision.js`**: modal dinámico con formulario (plataforma, URL, título, descripción, embed, fecha inicio), botones de acción por estado y mensajes de error/éxito.
- **`frontend/js/partidos.js`**: botón `Transmitir` agregado en vista card y tabla.
- **`frontend/js/portal.js`**: carga transmisiones activas por campeonato una sola vez; `renderPartidoJornadaPortal` muestra badge `🔴 EN VIVO` + botón `Ver transmisión`.

## 2026-04-06 - Auditoría fixture/planilla/finanzas + fondo personalizado en plantilla de jornadas

- **`backend/services/auditoria.js`**: 8 nuevas constantes `ACCIONES`: `FIXTURE_GENERADO`, `FIXTURE_REGENERADO`, `FIXTURE_ELIMINADO`, `PLANILLA_GUARDADA`, `RESULTADO_REGISTRADO`, `MOVIMIENTO_FINANCIERO`, `GASTO_CREADO`, `GASTO_ELIMINADO`.
- **`backend/controllers/partidoController.js`**: `registrarAuditoria` importado + llamadas en `generarFixtureEvento`, `eliminarFixtureEvento`, `regenerarFixturePreservando`, `registrarResultado`, `guardarPlanillaPartido`.
- **`backend/controllers/finanzaController.js`**: `registrarAuditoria` importado + llamadas en `crearMovimiento`, `crearGasto`, `eliminarGasto`.
- **`frontend/js/dashboard-admin.js`**: `badgeAuditoria()` extendido con 8 nuevos mapeos (fixture/planilla/finanzas).
- **`frontend/admin.html`**: 3 nuevas clases CSS `badge-audit-fixture/planilla/finanza` + 8 nuevos `<option>` en `#dash-audit-accion`.
- **`frontend/jornadasplantilla.html`**: controles de fondo personalizado (`Fondo` / `Quitar fondo` / estado) igual a `fixtureplantilla.html`.
- **`frontend/js/jornadasplantilla.js`**: `obtenerClaveFondoJ`, `aplicarFondoJ`, `restaurarFondoJGuardado`, `manejarCambioFondoJ`, `limpiarFondoJ` — la imagen se persiste en `localStorage` por `evento_id`.

## 2026-04-06 - Pestañas en admin.html + carnet individual + módulos editoriales operador

- **`frontend/admin.html`**: layout de pestañas (Dashboard, Planes, Formas de pago, Auditoría, Comprobantes). Dashboard es la pestaña activa por defecto. CSS responsive inline + JS de tabs con soporte de URL hash. Métricas globales (campeonatos/equipos/jugadores) movidas al inicio del tab Dashboard.
- **`frontend/js/dashboard-admin.js`**: cachea `_lastPorPlan` para re-renderizar Chart.js al volver al tab Dashboard. Expone `DashboardAdmin.refreshChart()`.
- **`frontend/jugadores.html`**: agrega `<select id="carnet-filtro-jugador">` en toolbar de carnés para imprimir/exportar el carné de un jugador individual.
- **`frontend/js/jugadores.js`**: `actualizarDropdownJugadorCarnet()` popula el dropdown; `obtenerIdsCarnetSeleccionados()` prioriza el dropdown sobre checkboxes; evento `change` del dropdown re-renderiza solo el carné seleccionado.
- **`frontend/portal-operador.html`**: nueva sección "Módulos editoriales" con tarjetas para Noticias, Galería, Contenido portal y Mensajes de contacto. Sidebar actualizado con sección "Editorial".

## 2026-04-05 - Activación por pago — Fase A completa (comprobante manual)

- **Migración 060** (`comprobantes_pago`): tabla con columnas `id`, `usuario_id`, `archivo_url`, `estado` (`pendiente/aprobado/rechazado`), `nota_admin`, `revisado_por`, `created_at`, `updated_at`. Aplicada en local y Render.
- **`backend/config/multerComprobantes.js`**: config Multer dedicada para comprobantes (acepta `image/*` + `application/pdf`, máx. 10 MB, carpeta `uploads/comprobantes/`).
- **`backend/controllers/comprobanteController.js`**: endpoints `subirComprobante` (valida `plan_estado='pendiente_pago'`), `listarComprobantes` (admin, filtra por estado), `activarCuenta` (activa la cuenta + aprueba comprobante), `rechazarComprobante`.
- **`backend/routes/comprobanteRoutes.js`**: `POST /api/comprobantes`, `GET /api/comprobantes/admin`, `PUT /api/comprobantes/admin/:id/activar`, `PUT /api/comprobantes/admin/:id/rechazar`.
- **`backend/services/emailService.js`**: `enviarEmailComprobanteRecibido` notifica al admin por email cuando llega un comprobante nuevo.
- **`frontend/login.html`** y **`frontend/register.html`**: modal de pago pendiente ahora incluye sección para subir comprobante (input file + botón + mensaje de estado).
- **`frontend/js/login.js`** y **`frontend/js/register.js`**: `initSubirComprobanteLogin()` / `initSubirComprobanteRegister()` — upload con FormData + Bearer token al endpoint `/api/comprobantes`.
- **`frontend/admin.html`** + **`frontend/js/dashboard-admin.js`**: panel "Comprobantes de pago" con tabla, filtro por estado, botones "Activar" (activa la cuenta del organizador en 1 clic) y "Rechazar" (con nota opcional). Todas las acciones quedan registradas en auditoría.

## 2026-04-05 - Fix: duplicate key en idx_partidos_numero_campeonato

- **Root cause**: `Eliminatoria.js` al crear un partido para un slot de llave incluía la CTE `next_num` pero no la usaba en el INSERT (la columna `numero_campeonato` estaba ausente de la lista de columnas). Esas filas quedaban con `numero_campeonato = NULL`.
- Al reiniciar el servidor (Render resetea la variable estática `_esquemaSecuenciaAsegurado`), `asegurarEsquemaSecuencia` asignaba `ROW_NUMBER()` empezando desde 1 a las filas NULL, colisionando con los valores ya existentes de otras categorías del mismo campeonato → error 500 en cualquier endpoint de partidos.
- **Fix `Eliminatoria.js`**: el INSERT del slot ahora incluye `numero_campeonato` en la lista de columnas y usa `next_num.next_num` en el SELECT.
- **Fix `Partido.js`**: `asegurarEsquemaSecuencia` ahora usa `MAX(existente) + ROW_NUMBER()` para las filas NULL en lugar de solo `ROW_NUMBER()`, garantizando que no haya colisión con valores previos.
- **Render**: 16 filas NULL saneadas directamente en producción con la query corregida.

## 2026-04-05 - Planes campeonato y anual con restricciones técnicas reales

- `backend/services/planLimits.js`: se agregaron 6 nuevos planes técnicos al objeto `PLANES`:
  - `campeonato_base`, `campeonato_competencia`, `campeonato_premium` — pago por torneo, `max_campeonatos = 1`, demás límites iguales al tier correspondiente (base/competencia/premium).
  - `anual_base`, `anual_competencia`, `anual_premium` — pago anual, mismos límites funcionales que el tier mensual equivalente.
- `PLANES_PUBLICOS` y `PLANES_PAGADOS` actualizados con los 6 nuevos códigos.
- `CATALOGO_PRECIOS_PUBLICOS`: los 6 planes cambian a `registrable: true` y `plan_registro` apunta a su propio código — el frontend ya puede registrar usuarios con estos planes.
- `backend/models/UsuarioAuth.js`: CHECK constraint inline actualizado con los 11 códigos válidos.
- `database/migrations/058_plan_codigo_ampliar.sql`: migración que actualiza `usuarios_plan_codigo_check` en BD. Aplicada en local; **pendiente en Render**.
- Efecto: `normalizarPlanCodigo('campeonato_base')` ya retorna `'campeonato_base'` (antes caía a `'demo'`); `esPlanPagado` y `esPlanPublico` los reconocen correctamente.

## 2026-04-05 - Planes y precios públicos en landing + panel admin

- `frontend/index.html`: se añadieron las cards comerciales `Plan por torneo` y `Plan anual` dentro de `Planes y precios`.
- `backend/services/planLimits.js`: se separó el catálogo público de precios (`CATALOGO_PRECIOS_PUBLICOS`) de los planes técnicos que sí gobiernan límites reales del sistema.
- `backend/controllers/authController.js`: los endpoints públicos y administrativos de precios ahora exponen también `torneo` y `anual`.
- `frontend/admin.html` + `frontend/js/dashboard-admin.js`: el administrador ya puede cambiar desde el panel los precios de `free`, `base`, `competencia`, `premium`, `plan por torneo` y `plan anual`.
- Criterio implementado: `torneo` y `anual` son ofertas comerciales públicas, no nuevos `plan_codigo` del usuario.
- Restricciones técnicas vigentes y ya operativas por plan: `max_campeonatos`, `max_categorias_por_campeonato`, `max_equipos_por_campeonato`, `max_equipos_por_categoria`, `max_jugadores_por_equipo` y `permite_carnets`.
- Los límites siguen aplicando únicamente a los planes técnicos `demo`, `free`, `base`, `competencia` y `premium`.

## 2026-04-05 - Página dedicada de planes y nuevas modalidades comerciales

- `backend/services/planLimits.js`: el plan `demo` baja de `2` a `1 campeonato`; el resto de límites se mantiene.
- Se reemplazó el catálogo público simple por modalidades detalladas:
  - `mensual_base`, `mensual_competencia`, `mensual_premium`
  - `campeonato_base`, `campeonato_competencia`, `campeonato_premium`
  - `anual_base`, `anual_competencia`, `anual_premium`
  - `free` como plan gratuito visible
- `frontend/index.html`: la portada ahora muestra 3 cards resumen (`mensual`, `campeonato`, `anual`) con precios `Desde...`, más un bloque corto de `Demo` y `Free`.
- `frontend/planes.html`: nueva página pública con el detalle completo de:
  - Demo / Free
  - Plan mensual
  - Plan campeonato
  - Plan anual
- `frontend/css/portal.css`: se añadió soporte visual para:
  - submenú de `Planes` en la navegación
  - cards resumen en portada
  - layout completo de la nueva página `planes.html`
- `frontend/js/public-pricing.js`: nuevo script compartido para:
  - cargar precios públicos desde backend
  - calcular mínimos por familia (`Desde`)
  - manejar modal de contratación / contacto
- `frontend/admin.html` + `frontend/js/dashboard-admin.js`: el panel de precios ahora se agrupa por familias (`pruebas`, `mensual`, `campeonato`, `anual`).
- El bloque `Premium` de las tres modalidades ya menciona `Módulo de transmisión (servicio streaming)` como parte de la oferta comercial.

## 2026-03-31 - Portal público: fix de playoff y tabla pública con planillas

- `frontend/js/portal.js`: se corrigió la referencia rota `formatearRondaPortal(...)` por `formatearRondaPlayoffPortal(...)`, que estaba rompiendo el detalle de torneos con playoff en el portal público.
- `backend/controllers/tablaController.js`: las tablas públicas ya consideran como partidos publicados los `finalizado / no_presentaron_ambos` y también los partidos con `partido_planillas` guardada.
- Esto corrige el caso donde la pestaña `Resultados` sí mostraba partidos y la `Tabla de posiciones` seguía vacía o en cero por depender solo de `estado='finalizado'`.
# Bitácora de Avances - LT&C

Ultima actualizacion: 2026-03-31 (sesión 20)

## 2026-03-31 - Portal público: jornadas y resultados con planilla publicada

- `backend/models/Partido.js`: se corrigió un bug en `obtenerPorEvento`, `obtenerPorEventoYJornada`, `obtenerPorCampeonato` y `obtenerPorCampeonatoYJornada` donde se seleccionaban campos de `partidos_eliminatoria` sin el `LEFT JOIN` correspondiente. Eso provocaba que algunos campeonatos aparecieran sin jornadas ni resultados en el portal.
- En esas mismas lecturas se añadió `tiene_planilla_publicada` para que el frontend pueda distinguir partidos con planilla guardada aunque no tengan `estado = 'finalizado'`.
- `backend/services/publicPortalService.js`: el resumen público de eventos ya cuenta como partidos publicados tanto los `finalizado / no_presentaron_ambos` como los partidos con `partido_planillas` guardada.
- `frontend/js/portal.js`: la subtab `Resultados` y los badges de jornada ya consideran `tiene_planilla_publicada`, evitando ocultar jornadas parciales con información deportiva ya cargada.
- Validación local: el evento `SENIOR` del campeonato `CAMPEONATO BARRIAL DE FUTBOL` volvió a exponer `55` partidos en el servicio público y el resumen pasó de `0/55` a `2/55` partidos publicados, consistente con las dos planillas guardadas.
# Bitácora de Avances - LT&C

Ultima actualizacion: 2026-03-30 (sesión 19)

## 2026-03-30 - Sembrado manual asistido de playoff

- `frontend/eliminatorias.html` y `frontend/eventos.html` agregan la plantilla `Manual asistida (definir P1..Pn)`.
- `frontend/js/eliminatorias.js` parte de una sugerencia balanceada y permite redefinir manualmente el orden `P1..Pn` con clasificados vigentes antes de generar la llave.
- `backend/models/Eliminatoria.js` valida el sembrado manual, evita repetir equipos y genera la llave exactamente con el orden elegido por el organizador.
- `backend/controllers/eventoController.js` ya normaliza `manual_asistida` como valor válido de `playoff_plantilla`.
- Pendiente inmediato: validar en operación real que la vista previa, la llave generada y la plantilla exportable respeten el mismo orden manual.

### Fix de sembrado balanceado por slot_posicion

- Se corrigió `backend/models/Eliminatoria.js` para que el armado balanceado de playoff use el `slot_posicion` real de cada clasificado y no la posición accidental del arreglo.
- Además se ordenan los clasificados de cada grupo antes de construir el sembrado.
- Esto corrige el caso donde la vista previa sugerida mostraba un orden balanceado correcto, pero la llave real se generaba corrida en `P1..P8`.

## Avances recientes (2026-03-30 — sesión 18)
### Cierre de migración 057 en local y Render

- Se aplicó y verificó formalmente `database/migrations/057_fix_fk_on_delete_set_null.sql` tanto en BD local como en PostgreSQL de Render.
- Verificación posterior:
  - `goleadores_jugador_id_fkey` -> `ON DELETE SET NULL`
  - `tarjetas_jugador_id_fkey` -> `ON DELETE SET NULL`
- Con esto queda alineado el fix estructural para eliminación de jugadores, complementando el `UPDATE ... SET jugador_id = NULL` defensivo ya incorporado en `backend/models/Jugador.js`.

## Avances recientes (2026-03-29 — sesión 17)

### Playoff — penales en planilla y publicación pública

- `frontend/planilla.html`, `frontend/js/planilla.js` y `frontend/css/style.css`: la planilla de partidos de `playoff` ya soporta captura de `penales` cuando el marcador regular termina empatado.
- `backend/models/Partido.js`: al guardar una planilla de playoff finalizada con empate, el backend ya exige penales válidos, resuelve el ganador y propaga al clasificado en la llave.
- `backend/models/Eliminatoria.js`: la sincronización de cruces/reclasificaciones ya considera `resultado_local_shootouts`, `resultado_visitante_shootouts` y `shootouts`.
- `frontend/js/portal.js` + `frontend/css/portal.css`: el portal público ya muestra debajo del resultado el resumen `Penales: X - Y • Clasifica ... por penales` cuando corresponde.

### Pendiente prioritario para la siguiente sesión

- Recomponer y validar la llave de playoff en los campeonatos afectados de producción, asegurando que los cruces recuperados queden visibles y consistentes tanto en el módulo interno como en el portal público.

## Avances recientes (2026-03-27 — sesión 16)

### Fix: admin redirige a admin.html como página inicial

- `core.js` — `getDefaultPageByRole()`: administrador ahora retorna `admin.html`, organizador retorna `portal-admin.html`.
- `core.js` — `canAccessPage()`: se bloquea explícitamente al rol `administrador` en `portal-admin.html`; si intenta acceder directamente por URL, es redirigido a `admin.html`.
- Criterio de negocio: el administrador no organiza torneos — administra la plataforma. Para organizar debe crear cuenta de organizador (trazabilidad y auditoría).

### Fix: error al eliminar jugador (violación FK en goleadores/tarjetas)

- **Causa**: el FK `goleadores_jugador_id_fkey` en Render fue creado sin `ON DELETE SET NULL` (table pre-existente antes de la migración 005). Lo mismo aplica a `tarjetas_jugador_id_fkey`.
- **Fix inmediato** — `backend/models/Jugador.js` → `static async eliminar()`: antes del `DELETE`, se nullifican las referencias en `goleadores` y `tarjetas` con `UPDATE ... SET jugador_id = NULL WHERE jugador_id = $1`. Funciona independientemente del comportamiento del FK en la BD.
- **Fix estructural** — Migración `057_fix_fk_on_delete_set_null.sql`: recrea ambos FK con `ON DELETE SET NULL`. Aplicada y verificada en BD local y Render.

### Fix: error al crear jugador ocultaba el mensaje real de PostgreSQL

- `backend/controllers/jugadorController.js`: el catch del endpoint de creación retornaba `error: 'Error creando jugador'` que no coincidía con el regex `/interno/i` de `api.js`, por lo que `detalle` (el error real de PG) nunca llegaba al usuario.
- Corregido a `error: 'Error interno del servidor'` para que `extractErrorMessage` en `api.js` exponga el `detalle` real al frontend.
- Permite diagnosticar la causa raíz si el error de creación persiste tras el redespliegue.

## Avances recientes (2026-03-27 — sesión 15)

### Finanzas — permisos correctos para gastos operativos del organizador

- Se corrigió el módulo de `gastos_operativos` para que un organizador ya no pueda listar gastos fuera de sus campeonatos cuando no envía `campeonato_id`.
- `backend/models/Finanza.js` ahora acepta `campeonato_ids` en `listarGastos(...)` y agrega `obtenerGastoPorId(...)` para recuperar un gasto puntual sin cargar toda la tabla.
- `backend/controllers/finanzaController.js` ahora:
  - usa `obtenerCampeonatoIdsOrganizador(user)` con el objeto `user` correcto,
  - restringe el listado a `campeonato_ids` permitidos cuando no se filtra un campeonato puntual,
  - valida edición y eliminación con `obtenerGastoPorId(...)` en lugar de listar todos los gastos.
- Resultado: el organizador solo puede crear, listar, editar, eliminar y resumir gastos de campeonatos propios, sin fugas de datos ni consultas innecesariamente amplias.

## Avances recientes (2026-03-27 — sesión 14)

### Alineación de migraciones entre local y Render

- Se revisó el estado documental vs. el estado real de las bases local y Render.
- Verificación realizada sobre migraciones recientes:
  - `051_roles_operador_sistema.sql`
  - `052_configuracion_sistema.sql`
  - `053_formas_pago.sql`
  - `054_formas_pago_paypal_tarjeta.sql`
  - `055_plan_estado_pendiente_pago.sql`
  - `056_gastos_operativos.sql`
- Resultado:
  - `051`, `052`, `053` y `054` ya estaban aplicadas en local y Render.
  - `055` faltaba en local y quedó aplicada.
  - `056` faltaba en local y Render y quedó aplicada en ambos entornos.
- Verificación posterior:
  - `usuarios_plan_estado_check` ya acepta `pendiente_pago` en local y Render.
  - la tabla `gastos_operativos` ya existe en local y Render.
- Se identificó además un desajuste documental previo:
  - `050_eventos_juvenil_cupos_y_carnet_edad.sql` ya estaba aplicada también en Render y no solo en local.

## Avances recientes (2026-03-26 — sesión 13)

### Formas de pago — modal en landing y configuración desde admin

- Al hacer clic en una card de plan de pago en `index.html`, ya no navega directo a `register.html`; abre un modal que muestra las formas de pago disponibles antes de continuar el registro.
- Nuevas migraciones `053_formas_pago.sql` y `054_formas_pago_paypal_tarjeta.sql` agregaron 16 claves en `configuracion_sistema` para WhatsApp, transferencia, efectivo, PayPal y tarjeta de crédito/débito.
- `backend/services/planLimits.js`: funciones `obtenerFormasPago()` y `actualizarFormasPago()` con validación de claves permitidas.
- `backend/controllers/authController.js`: endpoints `GET /auth/formas-pago` (público), `GET/PUT /auth/admin/formas-pago` (admin).
- `backend/routes/authRoutes.js`: rutas para las tres formas de pago.
- `frontend/admin.html` + `frontend/js/dashboard-admin.js`: panel "Formas de pago" con formulario completo de configuración de métodos.
- `frontend/index.html`: modal intercepción con `renderMetodosPago()`, botones de WhatsApp, PayPal, tarjeta y transferencia bancaria.

### Notificaciones por email — infraestructura completa

- `backend/services/emailService.js` ampliado con:
  - `wrapHtml()` — plantilla HTML con CSS embebido reutilizable.
  - `enviarEmail()` — helper genérico SMTP con fallback graceful a consola si no está configurado.
  - `enviarEmailBienvenida()` — bienvenida al nuevo usuario con datos de cuenta y enlace de login.
  - `enviarEmailNotificacionAdminNuevoRegistro()` — alerta al admin con ⚠️ si el plan es de pago.
  - `enviarEmailNotificacionContacto()` — notifica al admin cuando se recibe un mensaje del formulario de contacto.
- `backend/controllers/authController.js`: en `registerPublic()` dispara bienvenida + alerta admin en `Promise.allSettled()` background.
- `backend/controllers/contactoController.js`: dispara `enviarEmailNotificacionContacto()` en background tras guardar el mensaje en BD.
- Configuración requerida en producción: `ADMIN_EMAIL`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (sin estas vars solo logea en consola).

### Responsive web — módulos campeonatos, equipos, eventos, jugadores y usuarios

- Añadida clase `page-campeonatos` a `campeonatos.html`, `page-equipos` a `equipos.html`, `page-eventos` a `eventos.html`, `page-usuarios` a `usuarios.html`.
- Corrección de overflow en grid de `#lista-campeonatos` y `#lista-eventos`: cambiado `minmax(300px, 1fr)` → `minmax(min(300px, 100%), 1fr)` para evitar desborde en pantallas < 313px.
- `.usuarios-table-wrap` ya tiene `overflow-x: auto` explícito para garantizar scroll horizontal en cualquier viewport.
- Nuevos bloques `@media (max-width: 768px)` y `@media (max-width: 520px)` en `style.css`:
  - tarjetas de campeonato/equipo/jugador: padding compacto, `h3` reducido en móvil.
  - botones de `campeonato-actions`, `equipo-actions`, `jugador-actions`: pasan a `flex: 1 1 100%` en ≤ 520px.
  - `select-estado` en campeonato: ancho 100% en móvil.
  - `#lista-equipos` y `#jugadores-lista`: forzados a 1 columna en ≤ 520px.
  - `form-grid` de selección en eventos/equipos/usuarios: 1 columna en ≤ 768px.

### Spinner de carga durante verificación de sesión (UX)
- Reemplaza el `visibility: hidden` en body (pantalla en blanco) por un overlay con spinner animado y texto "Verificando sesión…" mientras se valida la sesión.
- El overlay usa `visibility: visible` para escapar del heredado `visibility: hidden` del body.
- Se elimina al completar la verificación y el sidebar + topbar están listos.
- Archivos modificados: `frontend/js/core.js`.

### Portal de organizador — alta de técnicos
- Organizador ahora puede crear usuarios con rol `técnico` además de `dirigente` desde `usuarios.html`.
- Backend `authController.crearUsuario`: acepta `rol='tecnico'` del organizador (antes forzaba `dirigente`).
- Backend `authController.eliminarUsuario`: permite eliminar tanto `dirigente` como `tecnico` para organizadores.
- Backend `listarUsuariosVisiblesPorOrganizador`: ahora incluye `tecnico` además de `dirigente`.
- Frontend `usuarios.js`: selector de rol con dos opciones, título y botón dinámicos según rol seleccionado.
- Archivos modificados: `backend/controllers/authController.js`, `frontend/js/usuarios.js`.

### Documentación de despliegue actualizada
- `docs/DEPLOY_RENDER.md`: añadidas variables `ADMIN_EMAIL` y `FRONTEND_URL` con nota explicativa.
- `backend/.env.example`: añadidas mismas variables con comentarios descriptivos.
- README §11 actualizado: dashboard de estadísticas marcado como IMPLEMENTADO.

---

## Avances recientes (2026-03-25 — sesión 12)

### Rol Operador Sistema (nuevo)
- Se divide el rol `operador` en dos perfiles distintos con responsabilidades separadas:
  - `operador` → **Operador CMS**: gestiona contenido del sitio web (noticias, galería, contenido del portal). Redirige a `portal-cms.html`.
  - `operador_sistema` → **Operador Sistema**: registra planillas de partido y consulta todos los módulos deportivos en solo lectura. Redirige a `portal-operador.html`.
- Migración `051_roles_operador_sistema.sql` aplicada en BD local y remota (Render actualiza en arranque via `asegurarEsquema`).
- Archivos modificados:
  - `backend/models/UsuarioAuth.js`: ROLES set, constraint en initTable, mensajes de error.
  - `backend/services/sessionService.js`: permisos separados por tipo de operador.
  - `backend/routes/partidoRoutes.js`: `operador_sistema` habilitado en `GET` y `PUT /planilla`; `operador` CMS eliminado de esas rutas.
  - `frontend/js/core.js`: `OPERADOR_SISTEMA_ALLOWED_PAGES`, función `esOperadorSistema()`, redirección y bloque de sidebar diferenciados por tipo.
  - `frontend/js/planilla.js`: `operador_sistema` puede inscribir jugadores de último momento en la planilla.
  - `frontend/usuarios.html` + `frontend/js/usuarios.js`: dos opciones en el selector de rol con etiquetas descriptivas.
  - `frontend/portal-operador.html` (nuevo): panel de bienvenida para `operador_sistema` con lista de partidos pendientes de planilla y accesos rápidos a módulos en solo lectura.
- Commit: `eadf562` — `feat(roles): agregar operador_sistema y separar roles de operador`

### Pendiente identificado — Dashboard de Estadísticas (próxima sesión)
- Se detecta la ausencia de un dashboard estadístico/financiero para organizadores y administrador.
- Ver sección §11 del README para el detalle completo del plan de implementación.

## Avances recientes (2026-03-25)
- Categorías / juvenil:
  - se agrega la migración `database/migrations/050_eventos_juvenil_cupos_y_carnet_edad.sql`.
  - `eventos` ahora soporta:
    - `categoria_juvenil_cupos`,
    - `categoria_juvenil_max_diferencia`,
    - `carnet_mostrar_edad`.
  - la configuración juvenil ya queda limitada a categorías `Sub/U 30` hasta `Sub/U 60`.
  - si una categoría activa juveniles, ahora debe definir:
    - cuántos cupos juveniles permite por equipo,
    - si tolera `1` o `2` años menor.
- Jugadores:
  - `backend/models/Jugador.js` ahora valida elegibilidad etaria por `evento_id` al crear y editar.
  - en categorías etarias:
    - se exige fecha de nacimiento,
    - se habilita o rechaza al jugador según la edad base,
    - y si aplica juvenil, se controlan también los cupos consumidos por equipo.
  - `frontend/js/jugadores.js` ya muestra la edad en tarjetas y tabla.
  - los jugadores juveniles se marcan con chip `Juvenil`.
  - el resumen del equipo muestra `Juveniles: X / cupos`.
- Carnés:
  - el carné ahora puede imprimir `Fecha nac.` y `Edad` cuando la categoría activa `Mostrar edad en carné`.
  - si el jugador entra como juvenil, el carné imprime además `Condición: Juvenil`.
- Planilla:
  - la posición `Arquero` ahora se resalta con color en:
    - plantel lateral,
    - tabla de captura,
    - vista previa oficial.
- Migración local:
  - `050_eventos_juvenil_cupos_y_carnet_edad.sql` aplicada y verificada en la BD local.

- Jugadores / cédula:
  - la cédula ya se normaliza y guarda como texto numérico conservando ceros iniciales.
  - creación y edición de jugadores ahora validan `10 dígitos` exactos cuando la cédula está informada.
  - el mismo criterio ya se aplica en búsqueda local, importación y flujo mobile.
- Planilla de juego:
  - `planilla.html` ahora permite editar el `Número de partido` y guardarlo desde la propia planilla.
  - la cabecera, vista previa y PDF reutilizan ese mismo número visible.
  - el guardado de planilla ya intercepta errores de duplicidad del número visible con mensaje funcional.
- Auspiciantes:
  - la planilla ahora intenta cargar primero auspiciantes activos y, si no existen, hace fallback al listado completo del campeonato.
  - la vista previa mantiene auspiciantes en cabecera y el PDF ahora también los imprime en el encabezado.

## Avances recientes (2026-03-23)
- Partidos / fixture:
  - el organizador ya puede definir el `N° visible del partido` sin tocar el identificador interno de BD.
  - el número visible se puede editar desde `Editar partido` y también se puede definir al crear un `Partido manual`.
  - el backend ahora valida este número y responde un mensaje claro si el valor se repite dentro del mismo campeonato.
  - la visualización pública/interna deja de depender del `id` interno como fallback cuando el partido no tiene número visible asignado.
- Planilla de juego / playoff:
  - `planilla.html` ya soporta dos fases:
    - `Fase regular`
    - `Playoff`
  - en modo `Playoff`:
    - se ocultan `Grupo` y `Jornada`,
    - aparece selector por `Ronda`,
    - se cargan partidos reales de `reclasificación`, `32vos`, `16vos`, `12vos`, `8vos`, `4tos`, `semifinal`, `final` y `tercer y cuarto`.
  - la cabecera, vista previa y PDF ya muestran `Llave` / `Ronda` cuando el partido pertenece a playoff.
  - cada card de `eliminatorias.html` con partido enlazado ya permite abrir su `Planilla` directa.
- Plantillas / posters:
  - `jornadasplantilla.html` ya soporta modo `playoff` además de la fase regular, con navegación por ronda.
  - `gruposgen.html` corrige la exportación duplicada:
    - se elimina el doble disparo de `html2canvas`,
    - los botones quedan bloqueados mientras la exportación está en curso,
    - ya no se generan dos archivos ni dos toasts de éxito por un solo click.

## Avances recientes (2026-03-22)
- Playoff / publicación:
  - la plantilla publicable del playoff ahora muestra también la programación del cruce (`fecha`, `hora`, `cancha`) cuando el partido ya fue agendado, reutilizando el mismo fondo del bracket.
  - se compacta el layout especial `8vos -> 4tos -> semis -> final`:
    - tarjetas más angostas,
    - conectores más cortos,
    - nombres con quiebre controlado,
    - fondo personalizado más contenido en la exportación.
- Jugadores / reportes:
  - se agrega el nuevo tipo `Nómina simple de jugadores`.
  - esta variante solo muestra:
    - nombres y apellidos,
    - cédula,
    - fecha de nacimiento.
  - `jugadores.html` incorpora botón `Exportar Excel` para:
    - nómina oficial,
    - nómina simple,
    - reporte de sanciones,
    - consolidado disciplinario por categoría,
    - ficha individual del jugador.
- Planillaje:
  - la planilla oficial ya separa observaciones por actor:
    - `observacion local`,
    - `observacion visitante`,
    - `observacion arbitro`.
  - se agrega migracion `database/migrations/048_planilla_observaciones_por_lado.sql` para persistir:
    - `partido_planillas.observaciones_local`,
    - `partido_planillas.observaciones_visitante`.
  - en impresion/PDF:
    - `Delegado` ya no se repite en la cabecera,
    - cuando el formato es `liga` se imprime `Liga` en lugar de `Grupo: Sin grupo`,
    - las observaciones pasan a una segunda hoja y ahora ocupan todo el ancho, una debajo de otra.
  - la planilla ya toma `max_jugador` como cantidad real de filas por equipo; en `futbol 11` soporta correctamente `25` jugadores cuando así fue configurado por el organizador.

## Avances recientes (2026-03-21)
- Planillaje:
  - se extiende la planilla para `futbol 11` con terna arbitral:
    - `arbitro central`,
    - `arbitro linea 1`,
    - `arbitro linea 2`.
  - se agrega `observaciones del arbitro` como campo separado de las observaciones generales del partido.
  - el guardado / recarga de planilla ya persiste estos campos en BD:
    - `partidos.arbitro_linea_1`,
    - `partidos.arbitro_linea_2`,
    - `partido_planillas.observaciones_arbitro`.
  - la vista previa oficial, el resumen y el PDF ya muestran la terna arbitral y el bloque especifico de observaciones del arbitro.
  - la exportacion XLSX mantiene compatibilidad combinando ambas observaciones en el area de observaciones de la plantilla oficial.

## Avances recientes (2026-03-20)
- Playoff / eliminatorias:
  - se corrige la herencia de `playoff_plantilla` y `playoff_tercer_puesto` desde la categoría hacia `eliminatorias.html`; la categoría pasa a ser la fuente de verdad visual aunque exista una fila previa en `evento_playoff_config`.
  - `backend/controllers/eventoController.js` ahora sincroniza una configuración `evento_playoff_config` existente cuando el organizador edita la categoría desde `eventos.html`.
  - `backend/models/Eliminatoria.js` prioriza los valores actuales del evento al leer la configuración de playoff, evitando que una configuración antigua deje la UI en `Estándar automático` cuando la categoría ya está en `balanceada`.
  - se habilita edición manual básica de cruces pendientes desde la propia llave (`Editar cruce`), reasignando equipos y `seed_ref` de forma segura.
  - la edición manual valida que:
    - el partido siga pendiente y sin resultado,
    - no se repita un equipo dentro de la misma ronda,
    - el local y visitante sean distintos.
- Operación:
  - si el playoff ya estaba generado con una plantilla anterior, ahora puede corregirse desde la llave regenerando con la plantilla heredada correcta o ajustando un cruce puntual manualmente.

## Pendientes (al 2026-03-18)

### Playoff / Eliminatorias
- [ ] Validación operativa del nuevo sembrado interleaved con datos reales de campeonato activo (confirmar que la semif siempre cruza grupos distintos).
- [x] Verificar que `auto-programar` funciona correctamente cuando hay slots sin partido_id en rounds 2+ — `programarSlot` ya crea el registro `partidos` si `partido_id` es null (verificado 2026-04-23).
- [ ] Plantilla `balanceada_8vos` con 4 grupos × 2 clasificados: actualmente cae al algoritmo estándar (interleaved). Evaluar si el usuario quiere un sembrado específico distinto para ese caso también.
- [ ] Cierre de formatos no potencia de 2 adicionales (ej: 6, 10, 12 equipos) si el cliente los confirma.

### Portal público
- [ ] Revisar subtab **Playoff** en portal: validación de llave contra clasificación vigente (equipos eliminados, vacantes pendientes).
- [x] Programación de partidos de playoff visible en portal (fecha/hora/cancha) — ya implementado en `renderEliminatoriasPortal` líneas 1716-1721 (verificado 2026-04-23).

### Plantillas de publicación
- [x] Aplicar selector de tema visual a `jornadasplantilla.html` — implementado y verificado: `aplicarTemaJornada()` aplica `--t-primario/secundario/acento` (verificado 2026-04-23).
- [x] Exportación PNG/PDF de llaves eliminatorias en "Plantilla para Publicar" — implementado (`exportarEliminatoriaPNG/PDF`) con html2canvas + jspdf (verificado 2026-04-23).

### Módulo Liga
- [ ] Verificar que la tab **Liga** en `gruposgen.html` carga correctamente los equipos (requiere test en browser con categoría liga real).
- [x] Exportación de plantilla de liga con temas visuales — implementado 2026-04-23: card wrapper (`poster-liga-card`) con header y conteo, CSS variables de tema aplicadas a `team-row`/`team-logo`, exporta vía `zona-grupos-export` existente.

### General / Infraestructura
- [ ] Pruebas integrales de flujo real con carga de datos de campeonato completo.
- [ ] Copiar histórico de `backend/uploads/` al disco persistente de Render antes de validar carga completa de imágenes/documentos en producción.
- [ ] Notificaciones (email/push) para partidos y resultados — pendiente de confirmar alcance.
- [ ] Auditoría completa y reportes ejecutivos.

---

## Objetivo
Mantener un registro vivo del progreso del proyecto para retomar trabajo sin perder contexto.

## Estado General
- Backend y frontend funcionales para flujo base de campeonatos, eventos, equipos, grupos, partidos, tablas y portal.
- Se corrigieron desalineaciones clave entre rutas, controladores, modelos y frontend.
- Modulo financiero en estado funcional inicial con cuenta corriente y morosidad.
- Pendiente continuar pruebas integrales de flujo real con carga de datos.

## Avances Recientes

### 2026-03-18 (sesión 7)
- Corrección de 3 bugs en módulo de eliminatorias/playoff:

**Bug 1: `playoff_tercer_puesto` y `playoff_plantilla` no se guardaban para método "grupos" o "liga"**
  - Causa: `frontend/js/eventos.js` líneas 749-754 tenían condición restrictiva que excluía los métodos `'grupos'` y `'liga'` al leer esos campos del formulario, asignando siempre `"estandar"` y `false`.
  - Solución: Eliminada la condición — ahora siempre se lee el valor real del formulario sin importar el `metodo_competencia`.

**Bug 2: El bracket playoff no evitaba que equipos del mismo cruce se enfrentaran en semifinal**
  - Causa: `construirSembradoCrucesGrupos` en `backend/models/Eliminatoria.js` iteraba todos los partidos de [A,C] juntos, luego todos los de [B,D]. Resultado: ambos partidos del cruce A-C quedaban en la misma mitad del bracket → semifinal entre A y C era posible.
  - Solución: El algoritmo ahora **intercala** los partidos de distintos cruces. Con cruces [[A,C],[B,D]] y 2 clasificados por grupo el resultado es:
    - QF1: 1A vs 2C | QF2: 1B vs 2D → Semi 1: ganador(A o C) vs ganador(B o D) ✓
    - QF3: 2A vs 1C | QF4: 2B vs 1D → Semi 2: ganador(A o C) vs ganador(B o D) ✓
    - Las semifinales siempre son entre cruces distintos; equipos del mismo grupo solo se pueden encontrar en la final.

**Bug 3: Botón "Programar" no visible en partidos de ronda 2+ (cuartos, semis, final)**
  - Causa: El botón solo se mostraba si `c.partido_id` era truthy. En las rondas 2+ los slots no tienen `partido_id` aún (el registro en `partidos` se crea solo en ronda 1 cuando se conocen los equipos).
  - Solución completa:
    - Nuevo endpoint `PUT /eliminatorias/:id/programar` en backend que:
      - Si el slot no tiene `partido_id`: crea un registro en `partidos` (con equipos null si aún no están definidos) y vincula `partido_id` al slot en `partidos_eliminatoria`.
      - Si ya tiene `partido_id`: actualiza `fecha_partido`, `hora_partido` y `cancha`.
    - El botón "Programar" ahora aparece en **todos** los cruces (usa `c.id` del slot, no `c.partido_id`).
    - `guardarProgPartidoEli()` y `ejecutarAutoProgEli()` llaman al nuevo endpoint `/eliminatorias/:id/programar`.
    - Auto-programar ahora incluye todos los slots (no solo los que ya tienen partido_id).
  - Archivos modificados:
    - `backend/models/Eliminatoria.js`: nuevo método estático `programarSlot()`
    - `backend/controllers/eliminatoriaController.js`: nuevo handler `programarSlot`
    - `backend/routes/eliminatoriaRoutes.js`: nueva ruta `PUT /:id/programar`
    - `frontend/js/eliminatorias.js`: botón, `guardarProgPartidoEli`, `ejecutarAutoProgEli`
    - `frontend/js/eventos.js`: condición restrictiva eliminada
  - Commit: `fix(eliminatorias): corregir 3 bugs de playoff`

---

### 2026-03-18 (sesión 6)
- Modo Liga en página de grupos (`gruposgen.html` / `gruposgen.js`):
  - Cuando `metodo_competencia = 'liga'`, el tab "Plantilla de Grupos" cambia a **"Plantilla Liga"**.
  - Se oculta el grid de grupos (`poster-grupos`) y se muestra un bloque `poster-liga` con todos los equipos del evento en lista ordenada (con logo y número).
  - `contextoGrupos` ahora almacena `metodoCompetencia`; se detecta desde `gruposEventosCache` al seleccionar la categoría.
  - Nueva función `cargarEquiposLiga(eventoId)` carga equipos via `/evento_equipos/:id`.
  - Nueva función `actualizarModoLiga(metodo)` actualiza visibilidad de elementos y label del tab.
  - CSS: `.poster-liga-equipos-grid` en `grupos.css`.
- Programación de partidos de playoff (`eliminatorias.html` / `eliminatorias.js`):
  - Cada match card del bracket ahora muestra **fecha, hora y cancha** si están asignadas (badge "Programado" en amarillo, badge "Programado" distingue de "Pendiente").
  - Botón **"Programar"** en cada card (solo admin/organizador) → abre modal con campos fecha, hora, cancha. Guarda via `PUT /partidos/:partido_id`.
  - Barra de herramientas sobre el bracket (solo admin) con botón **"Auto-programar fechas"**.
  - Modal **Auto-programar**: fecha inicio, hora inicio, hora límite, duración por partido (min), cancha, opción sobrescribir. Asigna tiempo secuencial a todos los partidos pendientes del bracket; si supera el horario límite, avanza al día siguiente.
  - CSS nuevos: `.eli-badge-programado` (amarillo), `.eli-match-schedule`, `.eli-match-actions`, `.eli-prog-toolbar`.
  - Commits de la sesión:
    - `feat(grupos+eli): modo liga en grupos y programación de partidos playoff`

### 2026-03-18 (sesión 5)
- Selección de carnets para imprimir / exportar PDF:
  - Cada carnet en `bloque-carnets-jugadores` ahora muestra un **checkbox** en la esquina superior derecha (oculto en impresión via `@media print`).
  - Barra de selección (`carnets-sel-bar`) con toggle "Seleccionar todos / ninguno" y contador `N de M seleccionados`.
  - `imprimirCarnetsJugadores()` y `exportarCarnetsPDF()` usan `obtenerIdsCarnetSeleccionados()`: si hay checkboxes marcados, solo se incluyen esos; si ninguno marcado, se imprimen todos (backward compatible).
  - El PDF lleva sufijo `_selN` en el nombre de archivo cuando hay selección parcial.
  - CSS: `.carnet-sel-overlay`, `.carnets-sel-bar`, efecto outline azul en carnets seleccionados (`:has()` selector).
- Temas visuales para posters de exportación:
  - 3 temas aplicables a todos los posters: **Oscuro** (default, gradiente navy), **Clásico** (gradiente claro), **Colores del torneo** (usa `color_primario`/`color_secundario`/`color_acento` del campeonato via CSS vars `--t-primario`, `--t-secundario`, `--t-acento`).
  - Selector de tema visible en `gruposgen.html` (poster de grupos) y en `fixtureplantilla.html`.
  - `cargarCabeceraCampeonato()` en `gruposgen.js` ya carga y aplica los CSS vars del campeonato al poster.
  - `cargarContexto()` en `fixtureplantilla.js` idem para el poster de fixture.
  - CSS de temas en `grupos.css` con variables `--poster-bg`, `--poster-color`, `--poster-card-bg`, `--poster-card-border`, `--poster-card-text`.
- Nueva página de plantilla para jornadas: `jornadasplantilla.html` + `jornadasplantilla.js`:
  - Accesible desde `partidos.html` > pestaña Plantilla Fixture > botón "Plantilla Jornada".
  - Carga el evento/campeonato por `RouteContext` (`evento`, `jornada`).
  - Renderiza un poster con: cabecera (logo, nombre torneo, categoría), selector de jornada (cuando hay más de una), y cards de partidos de la jornada seleccionada con logos, marcador, fecha, hora y cancha.
  - Auto-selecciona la primera jornada con partidos en estado `programado`.
  - Soporta exportación PNG y PDF (via `html2canvas` + `jsPDF`).
  - Soporta los 3 temas visuales.
  - CSS de cards de partido en poster: `.poster-jornada-partido`, `.poster-partido-row`, `.poster-partido-score`, `.poster-jornada-logo`, etc. (agregado en `grupos.css`).
- Commits de la sesión:
  - `feat(plantillas): selección carnets, temas poster, página jornadas`

### 2026-03-17 (sesión 3)
- Portal público / mejoras visuales y lógica de jornadas:
  - Cards de partidos en Jornadas ahora muestran **logos de equipos** (`equipo_local_logo_url` / `equipo_visitante_logo_url`) con fallback a inicial del nombre en círculo.
  - Subtab **Jornadas** separado de nuevo subtab **Resultados**: Jornadas muestra solo partidos pendientes/programados; Resultados muestra jornadas completamente finalizadas.
  - Card de jornada centrada con `max-width: 680px` para no ocupar todo el ancho del body.
  - Corrección definitiva del desfase UTC en fechas: `parseFechaLocalPortal()` ahora captura también el formato `"YYYY-MM-DDT00:00:00.000Z"` que devuelve el driver `pg` para columnas `DATE`, extrayendo solo la parte de fecha y construyendo como hora local.
  - Botones de jornada en selector: habilitado **solo si la jornada tiene partidos con `estado='programado'`**. Deshabilitados con tooltip contextual: `"Por programar"` (sin fecha) o `"Jornada finalizada"` (todas completadas). Opacity 0.38 + `cursor: not-allowed`.
  - Jornada activa auto-seleccionada: primera con al menos un partido en `estado='programado'`.
- Auto-estado de partidos (`estado` automático por programación):
  - `actualizarPartido` (backend): al asignar `fecha_partido` → `estado='programado'` automático; al borrarla → `estado='pendiente'`. Estados terminales (`finalizado`, `no_presentaron_ambos`, `suspendido`, `aplazado`, `en_curso`) no se modifican.
  - Migración inline en `asegurarEsquemaSecuencia`: al arrancar Render, partidos existentes con `fecha_partido IS NOT NULL AND estado='pendiente'` migran automáticamente a `estado='programado'`.
  - Resultado del flujo completo de estados:
    - Fixture generado sin fecha → `pendiente`
    - Se programa fecha/hora → `programado` (automático)
    - Se ingresan resultados → `finalizado` (ya existía por defecto)
    - Se borra la fecha → vuelve a `pendiente`
- Commits de la sesión:
  - `ec2727e` fix(portal): corregir desfase UTC en fechas (primera versión parcial)
  - `372dfda` feat(portal): logos de equipos, separar Jornadas/Resultados y centrar cards
  - `cfa025f` fix(portal): corregir fecha ISO de pg y deshabilitar botones de jornadas finalizadas
  - `ad0c58e` feat(partidos): auto-estado programado/pendiente y activación de jornadas por estado

### 2026-03-17 (sesión 2)
- Portal publico / tab Jornadas:
  - nueva subtab `Jornadas` agregada como primera pestaña en el panel de cada categoria del portal.
  - `portalVerCampeonato()` ahora fetcha `GET /api/public/eventos/:id/partidos` en paralelo con el resto de datos del evento.
  - `renderJornadasPortal()` mejorado:
    - selector de jornada con botones numerados (`J1`, `J2`, ...) para navegar entre fechas sin scrollear.
    - la jornada activa se determina automaticamente: primera con partidos pendientes, o ultima si todo esta finalizado.
    - cada card de jornada muestra la fecha/rango de fechas extraída de `fecha_partido` de los partidos.
    - badge de estado por jornada: `Próxima` (azul), `En curso` (amarillo), `Finalizada` (verde).
    - solo se muestra una jornada a la vez (toggled por selector), sin scroll lateral.
  - el filtro de `portal_jornadas_habilitadas` del organizador se aplica correctamente: el backend ya filtra, el frontend renderiza solo las jornadas recibidas.
  - nuevos estilos en `portal.css`:
    - `.portal-jornadas-wrap`, `.portal-jornadas-selector`, `.portal-jornada-selector-btn`
    - `.portal-jornada-badge` con variantes `badge-proxima`, `badge-en-curso`, `badge-finalizada`
    - `.portal-jornada-card-title`, `.portal-jornada-fecha`, `.portal-jornada-card-meta`
  - validacion tecnica:
    - `node --check frontend/js/portal.js` => OK

### 2026-03-17
- Fixture / gestion avanzada:
  - nuevo endpoint `DELETE /partidos/evento/:evento_id/fixture` para eliminar el fixture completo de un evento.
    - detecta partidos finalizados y exige confirmacion (`force=true`) antes de borrarlos.
    - boton `Eliminar Fixture` (rojo) en `partidos.html` > seccion Generacion de Fixture.
  - nuevo endpoint `POST /partidos/evento/:evento_id/regenerar-preservando` para regenerar el fixture conservando partidos ya jugados.
    - conserva partidos en estado `finalizado` / `no_presentaron_ambos`.
    - elimina solo partidos pendientes y regenera round-robin completo para los equipos actuales.
    - soporta modo con grupos (`grupo_equipos`) y sin grupos (`evento_equipos`).
    - continua numeracion de jornadas desde la ultima jugada + 1.
    - boton `Regenerar (preservar jugados)` (amarillo) en `partidos.html`.
  - ambos botones se muestran solo cuando existe fixture generado en el evento.
- Portal publico / control de jornadas visibles:
  - nueva columna `portal_jornadas_habilitadas JSONB` en tabla `eventos` (agregada via `ALTER TABLE IF NOT EXISTS`, sin migracion separada).
    - `null` = mostrar todas las jornadas (backward compatible).
    - `[1,2]` = solo esas jornadas visibles en el portal.
    - `[]` = ninguna jornada visible.
  - filtro aplicado en `publicPortalService` al servir partidos publicos por categoria.
  - nuevos endpoints:
    - `GET /organizador-portal/eventos/:id/jornadas-portal`
    - `PUT /organizador-portal/eventos/:id/jornadas-portal`
    - `GET /organizador-portal/campeonatos/:id/eventos`
  - UI en `organizador-portal.html`: seccion con checkboxes por jornada, botones `marcar todas`, `desmarcar todas` y `sin filtro (todas)`.
  - validacion tecnica:
    - `node --check backend/controllers/organizadorPortalController.js`
    - `node --check backend/controllers/partidoController.js`
    - `node --check backend/models/Partido.js`
    - `node --check backend/services/publicPortalService.js`
    - `node --check frontend/js/organizador-portal.js`
    - `node --check frontend/js/partidos.js`

### 2026-03-16
- Playoff / eliminatorias:
  - `eliminatorias.html` ya soporta valores de `clasificados_por_grupo` mayores a `6` en la UI de playoff.
  - se corrigio la herencia del valor guardado en la categoria para que el selector no quede vacio cuando una categoria clasifica `8` o mas por grupo.
  - `frontend/js/eliminatorias.js` ahora usa el valor persistido del evento/configuracion como fallback operativo antes de cargar clasificacion manual o generar la llave.
  - con esto la logica existente de reemplazo por equipos eliminados vuelve a aplicarse correctamente en categorias distintas a Abierta, porque el flujo deja de degradarse a `0`/`2` cupos por un problema visual del selector.
  - la plantilla `balanceada_8vos` se renombro en UI como `Evitar reencuentros tempranos de grupo (balanceada)`.
  - esa plantilla ahora cubre dos escenarios:
    - `4 grupos x 4 clasificados`: sugiere `A vs C` y `B vs D`, mostrando la vista previa `P1..P8`.
    - `2 grupos x N clasificados`: arma un sembrado espejo `A/B` siguiendo el orden deportivo solicitado por el cliente (ej. para `8` clasificados: `1A-8B`, `2B-7A`, `3A-6B`, `4B-5A`, espejo al lado derecho).
  - la vista previa ya refleja ambos casos y, cuando el playoff arranca en `8vos`, se dibuja una grilla tipo bracket para que el organizador confirme visualmente el armado antes de generarlo.
- Jugadores / roster por categoria:
  - se incorporo la migracion `045_jugadores_evento_categoria.sql`.
  - se agrego la migracion `046_jugadores_cedula_por_evento.sql` para eliminar la restriccion global `jugadores_dni_key`.
  - `jugadores` ahora soporta `evento_id` para que la nomina quede asociada a la categoria/evento y no solo al `equipo_id`.
  - `backend/models/Jugador.js` ya separa por categoria:
    - lectura de plantel,
    - conteo maximo de jugadores,
    - validacion de cédula,
    - validacion de numero de camiseta,
    - capitan por categoria.
  - `backend/models/Partido.js` arma la planilla usando `Jugador.obtenerPorEquipo(equipo_id, partido.evento_id)`, por lo que el plantel visible del partido ya queda acotado a la categoria real.
  - `frontend/js/planilla.js` y el flujo mobile ya envian `evento_id` en el alta de jugadores para que las inscripciones hechas desde planilla/app tambien queden en la categoria correcta.
  - compatibilidad:
    - equipos de una sola categoria siguen leyendo filas legacy `evento_id IS NULL` hasta completar migracion.
    - equipos de multiples categorias ya se leen solo por `evento_id` para cortar el problema de nomina compartida.
  - validacion local:
    - migracion `045` aplicada en BD local: `OK`
    - migracion `046` aplicada en BD local: `OK`
    - verificacion posterior: `733/733` jugadores con `evento_id` cargado.
    - verificacion posterior: la unicidad vieja por `cedidentidad` fue reemplazada por `jugadores_cedidentidad_evento_uidx`.
  - despliegue:
    - migraciones `045` y `046` aplicadas en Render: `OK`
    - verificacion remota:
      - restriccion vieja `jugadores_dni_key` ausente,
      - indice `jugadores_cedidentidad_evento_uidx` presente.
- Jugadores / categorías activas:
  - se corrigió la validación de cédula al crear/editar/importar jugadores para que use el `evento_id` actual enviado por la UI.
  - el bloqueo ya no se calcula con todas las categorías donde esté inscrito el equipo destino, sino con la categoría concreta desde la que se registra el jugador.
  - impacto: un jugador vuelve a poder inscribirse en distintas categorías del mismo campeonato, incluso con equipos diferentes, siempre que no repita en la misma categoría.
- Tablas manuales vs resultados reales:
  - se ajustó la invalidación automática al cargar resultados/planillas.
  - antes, un resultado nuevo en un grupo eliminaba las tablas manuales de todo el evento.
  - ahora:
    - en formato por grupos, solo se invalida la tabla manual, la clasificación manual y la reclasificación del grupo afectado,
    - la llave eliminatoria del evento se limpia completa para obligar regeneración coherente.
  - esto evita perder correcciones manuales de otros grupos no afectados.
- Eliminatorias / plantilla mejores perdedores:
  - se incorporo la nueva plantilla `Mejores perdedores (24 -> 12vos -> 8vos)` dentro de la configuracion de playoff.
  - la opcion ya queda visible en:
    - `eventos.html`,
    - `eliminatorias.html`.
  - comportamiento implementado:
    - genera una ronda inicial `12vos` con 24 clasificados,
    - clasifica automaticamente a los 12 ganadores,
    - reserva `4` cupos `MP1..MP4` para mejores perdedores,
    - al cerrarse los `12vos`, el backend calcula los mejores perdedores con las mismas reglas deportivas vigentes:
      - rendimiento/porcentaje,
      - diferencia de goles,
      - goles a favor,
      - enfrentamiento directo cuando aplique,
      - fair play final.
  - los cupos `MP` se completan automaticamente antes de `8vos` siempre que la ronda siguiente no haya empezado.
  - se agregaron etiquetas y soporte visual para la nueva ronda `12vos` en:
    - backend de eliminatorias,
    - `frontend/js/eliminatorias.js`,
    - `frontend/js/portal.js`.
  - tambien se blindo la logica de byes para que un ganador de `12vos` no avance solo mientras el slot del mejor perdedor siga pendiente.

### 2026-03-15
- Tablas manuales vs resultados reales:
  - se corrigio el desfase donde una `edicion manual activa` podia congelar puntos/posiciones antiguas despues de registrar nuevos partidos o guardar una planilla finalizada.
  - ahora, cuando cambia el resultado deportivo real de un partido (`resultado`, `estado`, `shootouts`), el sistema invalida automaticamente:
    - `tabla_posiciones_manuales`,
    - `evento_clasificados_manuales`,
    - `evento_reclasificaciones_playoff`,
    - `partidos_eliminatoria`
    del evento afectado.
  - ademas se registra auditoria automatica sobre la tabla manual removida con comentario de invalidacion por nuevo resultado real.
  - impacto funcional:
    - la tabla vuelve a calcularse con los datos reales del partido,
    - el playoff debe regenerarse despues de ese cambio para no quedar desfasado.
- Eliminatorias / llaves configurables desde categoria:
  - se agrego configuracion inicial de playoff directamente en la categoria/evento para definir:
    - `playoff_plantilla`,
    - `playoff_tercer_puesto`.
  - nuevas opciones visibles:
    - `Estandar`,
    - `Balanceada 8vos`.
  - la opcion `Balanceada 8vos` implementa el armado solicitado para 16 clasificados desde cruces de grupos, generando:
    - `8VO P1: 1A vs 4C`,
    - `8VO P2: 2B vs 3D`,
    - `8VO P3: 1D vs 4B`,
    - `8VO P4: 2C vs 3A`,
    - `8VO P5: 1B vs 4D`,
    - `8VO P6: 2A vs 3C`,
    - `8VO P7: 1C vs 4A`,
    - `8VO P8: 2D vs 3B`.
  - la configuracion tambien permite incluir `Tercer y cuarto puesto`, creando un cruce extra entre perdedores de semifinal.
  - se ajusto la rotulacion de llaves/exportaciones para mostrar:
    - `8VO P#`,
    - `4TO G#`,
    - `SEM G#`,
    - `FINAL`,
    - `TERCER Y CUARTO`.
  - nuevas migraciones:
    - `database/migrations/043_evento_playoff_templates_y_tercer_puesto.sql`
    - `database/migrations/044_partidos_eliminatoria_fuente_ganador_perdedor.sql`
  - migraciones `043` y `044` aplicadas y verificadas en:
    - BD local,
    - PostgreSQL de Render.
  - validacion tecnica:
    - `node --check backend/models/Eliminatoria.js`
    - `node --check backend/controllers/eventoController.js`
    - `node --check frontend/js/eliminatorias.js`
    - `node --check frontend/js/eventos.js`
    - `node --check frontend/js/portal.js`
    - `npm --prefix backend run smoke` => `PASS 9/9`.
- Eliminatorias / reclasificación operativa:
  - se corrigio el flujo de `partido_extra_reclasificacion` para que, al guardar la clasificacion manual, la reclasificacion ya no quede solo como registro logico.
  - ahora cada reclasificacion genera y enlaza un `partido` real mediante `evento_reclasificaciones_playoff.partido_id`.
  - desde `eliminatorias.html` ya queda visible:
    - `Ver en partidos`,
    - `Abrir planilla`,
    - numero de partido y estado operativo.
  - ese partido extra tambien aparece en `partidos.html` con badge `Partido extra playoff`, permitiendo registrar planilla y resultado como cualquier otro partido del evento.
  - cuando la planilla deja el partido `finalizado`, el backend sincroniza automaticamente el ganador hacia la reclasificacion y libera el cupo playoff correspondiente.
  - nueva migracion:
    - `database/migrations/042_reclasificacion_playoff_partido_operativo.sql`
  - migracion `042` aplicada y verificada en:
    - BD local,
    - PostgreSQL de Render.
  - validacion tecnica:
    - `node --check backend/models/Eliminatoria.js`
    - `node --check frontend/js/eliminatorias.js`
    - `node --check frontend/js/partidos.js`
    - `npm --prefix backend run smoke` => `PASS 9/9`.
- Portal publico / playoff:
  - se corrigio la publicacion del bloque `Playoff` en `portal.html` para que ya no muestre llaves desactualizadas.
  - el backend ahora compara la llave guardada en `partidos_eliminatoria` contra la clasificacion vigente del evento antes de publicarla.
  - si detecta equipos eliminados dentro de la llave, cambios de sembrado o cupos pendientes, el portal deja de renderizar la ronda y muestra un mensaje claro de regeneracion.
  - para eventos con cupo vacante, el portal tambien bloquea la publicacion hasta que se resuelva la reclasificacion o se regenere la llave.
  - validacion real ejecutada sobre el evento publico donde aparecian `Inter FC` y `San Rafael`:
    - resultado esperado: `inconsistente=true`, `codigo=bracket_desactualizado`,
    - detalle: `Equipos fuera de clasificación detectados: Inter FC, San Rafael. Regenera el playoff.`
  - archivos clave:
    - `backend/models/Eliminatoria.js`
    - `backend/services/publicPortalService.js`
    - `frontend/js/portal.js`

### 2026-03-14
- Tablas / auditoria / playoff:
  - se habilito edicion manual de tablas de posiciones solo para `administrador`.
  - la correccion manual exige comentario de auditoria y guarda:
    - snapshot anterior,
    - snapshot nuevo,
    - usuario responsable,
    - fecha de cambio.
  - nuevas migraciones:
    - `database/migrations/040_tablas_posiciones_manual_y_auditoria.sql`
    - `database/migrations/041_reclasificacion_playoff_vacantes.sql`
  - ambas migraciones quedaron aplicadas y verificadas en:
    - BD local,
    - PostgreSQL de Render.
  - la clasificacion a playoff ahora consume la misma tabla ajustada que ve el modulo `tablas`, por lo que:
    - los equipos eliminados no entran a los cupos playoff,
    - una correccion manual de posiciones hecha por administrador se refleja al calcular clasificados.
  - la tabla manual ahora se reordena automaticamente cuando el administrador cambia puntos o estadisticas; la `posicion manual` queda solo como desempate final si los equipos terminan igualados.
  - cuando un grupo queda con vacante real de clasificacion, el sistema ya puede abrir una `reclasificación playoff` entre los mejores opcionados externos al grupo.
  - la reclasificacion queda registrada por cupo, evita reutilizar equipos en varios cupos y exige resolver ganador antes de generar la llave definitiva.
  - validacion tecnica:
    - `node --check backend/controllers/tablaController.js`
    - `node --check backend/models/Eliminatoria.js`
    - `node --check backend/controllers/eliminatoriaController.js`
    - `node --check frontend/js/tablas.js`
    - `node --check frontend/js/eliminatorias.js`
    - `npm --prefix backend run smoke` => `PASS 9/9`.
- QA / despliegue / migraciones:
  - se sincronizo `main` con remoto y se aplico la migracion `039_jugadores_foto_carnet_recorte.sql` en:
    - BD local,
    - PostgreSQL de Render.
  - se detecto que los scripts de validacion con dataset real tomaban por defecto un campeonato QA/admin no publico y fallaban al llegar a `/api/public/...`.
  - `backend/scripts/e2eOperationalFlowCheck.js` y `backend/scripts/qaUiDatasetCheck.js` ahora descubren automaticamente un campeonato/evento/partido/equipo visibles en portal publico antes de ejecutar las comprobaciones deportivas/publicas.
  - validacion tecnica ejecutada:
    - `npm --prefix backend run smoke:roles` => `PASS 18/18`,
    - `npm --prefix backend run smoke:frontend` => `PASS 38/38`,
    - `npm --prefix backend run smoke:matrix` => `PASS 48/48`,
    - `npm --prefix backend run e2e:ops-flow` => `OK dataset campeonato=2 evento=8 partido=65 equipo=42`,
    - `npm --prefix backend run qa:ui-dataset` => `OK dataset campeonato=2 evento=8 partido=65 equipo=42`.
- Navegacion interna / UX:
  - se implemento `RouteContext` en `frontend/js/core.js` para guardar contexto de navegacion interna en `sessionStorage`.
  - las pantallas internas ya no dependen de `?campeonato=...&evento=...&equipo=...&partido=...` visibles en la barra del navegador.
  - el sistema ahora limpia la URL al cargar y mantiene el contexto entre:
    - `campeonatos -> eventos`
    - `eventos -> equipos`
    - `equipos -> jugadores`
    - `equipos -> sorteo`
    - `sorteo -> grupos`
    - `grupos -> playoff`
    - `partidos -> planilla`
    - `partidos -> fixture plantilla`
    - `partidos -> eliminatorias`
    - `planilla -> partidos`
    - `tablas`
  - se mantiene soporte de compatibilidad para enlaces antiguos con query string: el modulo toma el contexto una vez y luego limpia la barra.
  - validacion tecnica:
    - `node --check frontend/js/core.js`
    - `node --check frontend/js/campeonatos.js`
    - `node --check frontend/js/eventos.js`
    - `node --check frontend/js/equipos.js`
    - `node --check frontend/js/jugadores.js`
    - `node --check frontend/js/sorteo.js`
    - `node --check frontend/js/gruposgen.js`
    - `node --check frontend/js/eliminatorias.js`
    - `node --check frontend/js/partidos.js`
    - `node --check frontend/js/planilla.js`
    - `node --check frontend/js/fixtureplantilla.js`
    - `node --check frontend/js/tablas.js`
  - pendiente de prueba manual:
    - verificar visualmente todos los flujos internos despues de `Ctrl + F5` para confirmar que la barra quede limpia en cada modulo.
- Jugadores / carnés:
  - se agregó soporte de recorte estable para `foto carné`.
  - el ajuste visual ahora se previsualiza con `canvas` para representar el recorte real.
  - al guardar, el sistema genera y sube una imagen recortada específica del carné (`foto_carnet_recorte_url`) sin perder la foto original.
  - el PDF y la impresión del carné ahora priorizan esa imagen recortada, evitando desfases entre preview y exportación.
  - el ajuste ahora permite arrastrar la imagen con mouse o dedo, incluye guía visual para el rostro y añade botón `Restablecer` para volver al encuadre base.
  - se agregó la migración `database/migrations/039_jugadores_foto_carnet_recorte.sql`.
  - validación técnica:
    - `node --check backend/models/Jugador.js`
    - `node --check backend/controllers/jugadorController.js`
    - `node --check backend/routes/jugadorRoutes.js`
    - `node --check frontend/js/jugadores.js`
    - `npm --prefix backend run smoke` => `PASS 9/9`.
- Seguridad / sesion:
  - `frontend/js/core.js` ahora muestra una advertencia previa con cuenta regresiva antes del cierre automatico por inactividad.
  - el usuario puede elegir `Seguir conectado` para renovar la sesion o `Cerrar sesión ahora` si quiere salir manualmente.
  - la advertencia tambien se sincroniza correctamente con la actividad de otras pestañas.
  - validacion tecnica:
    - `node --check frontend/js/core.js`,
    - `npm --prefix backend run smoke` => `PASS 9/9`.
- Jugadores / uploads:
  - se corrigio el guardado de jugadores con foto/documentos para que use `ApiClient.requestForm(...)` y herede el token de autenticacion.
  - `frontend/js/api.js` ahora expone mejor el `detalle` de errores HTTP cuando el backend devuelve un mensaje tecnico controlado.
  - `backend/config/multerConfig.js` amplia el limite de imagenes a `8MB`.
  - `backend/server.js` transforma errores de `multer` (por ejemplo `LIMIT_FILE_SIZE`) en respuestas `400` con mensaje claro.
  - `backend/controllers/jugadorController.js` ya responde `400` cuando el archivo no pasa la validacion de tipo (`req.fileValidationError`), evitando que llegue como error interno generico.
  - validacion tecnica:
    - `node --check frontend/js/api.js`
    - `node --check frontend/js/jugadores.js`
    - `node --check backend/config/multerConfig.js`
    - `node --check backend/controllers/jugadorController.js`
    - `node --check backend/server.js`
    - `npm --prefix backend run smoke` => `PASS 9/9`.

### 2026-03-13
- Repositorio:
  - se auditaron y consolidaron cambios locales pendientes antes de sincronizar con remoto.
  - migraciones aplicadas en BD local:
    - `database/migrations/037_eventos_clasificacion_tabla_acumulada.sql`
    - `database/migrations/038_jugadores_foto_carnet_zoom.sql`
  - validacion tecnica:
    - `node --check` sobre backend/frontend modificados,
    - `npm --prefix backend run smoke` => `PASS 9/9`.
- UX del sistema deportivo:
  - `frontend/js/core.js` y `frontend/css/style.css` ahora muestran un boton visible `Salir` junto al badge del usuario en la topbar.
  - en movil el bloque de usuario hace wrap y el boton baja debajo del nombre cuando no entra en una sola fila.
- Seguridad / sesion:
  - `frontend/js/core.js` ya fuerza cierre de sesion automatico tras `1 hora` de inactividad en cualquier dispositivo.
  - la ultima actividad se sincroniza entre pestañas con `localStorage` y `login.html` muestra aviso cuando la sesion fue cerrada por timeout.
  - `frontend/js/api.js`, `frontend/js/login.js` y `frontend/js/register.js` ya consumen `refreshToken` para acompañar el cierre de sesion y el control de actividad.
- Jugadores:
  - `backend/models/Jugador.js` ya permite reutilizar la misma cedula en distintas categorias y equipos del mismo campeonato si cumple edad; desde la migracion `068`, el bloqueo por equipo dentro de una categoria se valida al guardar planilla, con el primer equipo que juega.
  - `frontend/jugadores.html`, `frontend/js/jugadores.js` y `frontend/css/style.css` ajustaron la experiencia de fichas/tarjetas:
    - hero visual con `foto carné`,
    - fallback al logo del equipo o placeholder,
    - reubicacion de `Planilla` en la franja de acciones,
    - controles de ajuste de foto sin barras visibles, solo con botones de zoom y posicion.
  - pendiente de UX:
    - validar con datos reales si el layout final de cards de jugadores debe quedarse en `4/3/2/1` o endurecer un minimo mayor por card.

### 2026-03-12
- Usuarios / organizadores:
  - `frontend/usuarios.html` y `frontend/js/usuarios.js` ya alinean el alta/edicion del rol `organizador` con la base usada por `Mi Landing`.
  - desde el formulario de usuarios ya se puede capturar:
    - nombre de organizacion,
    - lema publico,
    - correo de contacto publico,
    - telefono / WhatsApp publico,
    - logo de la organizacion.
  - al editar un organizador, `usuarios.html` consulta su contexto real de `Mi Landing` y precarga:
    - branding,
    - contacto,
    - logo actual.
  - si el administrador sube logo desde usuarios, el archivo se sincroniza contra `organizador_portal_config` sin obligar a entrar luego a `organizador-portal.html`.
- Backend / sincronizacion:
  - `backend/controllers/authController.js` ahora sincroniza automaticamente el perfil base del organizador hacia `OrganizadorPortal` en:
    - registro publico del organizador,
    - alta de usuario organizador por administrador,
    - actualizacion de usuario organizador.
  - `backend/models/OrganizadorPortal.js` ya mantiene sincronizado `usuarios.organizacion_nombre` cuando el nombre de organizacion se cambia desde `Mi Landing`, evitando divergencia entre ambos modulos.
- Verificacion:
  - validacion de sintaxis OK en:
    - `frontend/js/usuarios.js`,
    - `frontend/js/api.js`,
    - `backend/controllers/authController.js`,
    - `backend/models/OrganizadorPortal.js`.
  - smoke backend:
    - `npm --prefix backend run smoke` => `PASS 9/9`.

### 2026-03-11
- Carnés:
  - nueva migracion:
    - `database/migrations/035_campeonato_fondo_carnet.sql`.
  - `campeonatos` ya permite gestionar un `fondo de carné / marca de agua` independiente del logo.
  - el fondo se usa como capa visual sobre el carné mezclando:
    - imagen subida,
    - colores del campeonato,
    - logo del campeonato.
  - el organizador puede:
    - subirlo,
    - reemplazarlo,
    - eliminarlo.
  - el render queda unificado para:
    - vista previa,
    - impresion,
    - exportacion PDF.
  - la migracion `035` ya fue aplicada:
    - en BD local,
    - en PostgreSQL remoto de Render.
- Portal del organizador:
  - se implemento la base de branding/media propia por organizador con nueva migracion:
    - `database/migrations/034_organizador_portal_branding.sql`.
  - nuevo modulo privado `Mi Landing` para organizadores con gestion de:
    - configuracion basica del portal,
    - auspiciantes propios,
    - media publica para landing,
    - media publica para cards/galeria de campeonatos.
  - el portal publico ya separa los auspiciantes del organizador de los auspiciantes institucionales LT&C.
  - las cards de campeonatos ahora pueden consumir primero:
    - media publica del campeonato,
    - logo del organizador,
    - y solo despues fallback LT&C.
  - la migracion `034` ya fue aplicada:
    - en BD local,
    - en PostgreSQL remoto de Render.
- Textos visibles:
  - se corrigio la ortografia visible de `carnet/carnets` a `carné/carnés` en formularios, reportes y mensajes al usuario sin tocar claves tecnicas (`foto_carnet_url`, ids internos, etc.).
- Jugadores:
  - se corrigio el bug de `fecha_nacimiento` que restaba un dia en tarjetas/listados por conversion de zona horaria del navegador.
  - ahora se puede eliminar la `foto carné` desde el modal/perfil del jugador y el backend limpia el archivo reemplazado o marcado para borrado.
  - los campos de `foto_cedula` y `foto_carnet` quedan listos para captura directa desde celular (`capture=environment` / `capture=user`), facilitando la toma de foto en cancha.
- Portal publico:
  - el listado general vuelve a mostrar torneos `borrador` / `inscripcion` cuando son campeonatos reales del organizador o registros legacy con `organizador` informado.
  - se mantiene fuera del portal cualquier campeonato de `administrador` o QA.
- Campeonatos:
  - se ampliaron los tipos de futbol soportados en backend/frontend:
    - `futbol_11`,
    - `futbol_9`,
    - `futbol_8`,
    - `futbol_7`,
    - `futbol_6`,
    - `futbol_5`,
    - `futsala`,
    - `indor`.
  - nueva migracion agregada:
    - `database/migrations/033_campeonatos_tipos_futbol_ampliados.sql`.
  - la migracion `033` ya fue aplicada:
    - en BD local,
    - en PostgreSQL de Render.
- Portal/landing:
  - `Ingresar` y `Registrarse` ahora abren en nueva ventana para no romper la navegacion del portal publico compartible.

### 2026-03-10
- Render ya quedo operativo en produccion inicial:
  - servicio `https://ltyc.onrender.com` en estado `Live`,
  - verificados endpoints:
    - `/salud`,
    - `/testDb`.
  - favicon LT&C visible en navegador.
- Sorteo endurecido para no romper integridad:
  - `backend/models/Grupo.js` ya impide reiniciar/eliminar grupos si la categoria tiene:
    - partidos programados,
    - eliminatorias generadas.
  - `backend/controllers/grupoController.js` devuelve error de negocio controlado (`400`) en vez de fallo FK/`500`.
- Portal publico refinado para operacion real:
  - `frontend/js/portal.js` ya lista todas las cards reales visibles del organizador, incluyendo torneos proximos creados en el sistema.
  - se eliminan cards estaticas/de relleno de proximos torneos.
  - las cards ahora muestran:
    - nombre del organizador sobre el nombre del campeonato,
    - fecha consistente aun cuando falte `fecha_fin`.
  - la palabra `ELIMINADO` en tablas publicas/internas se redujo visualmente para no endurecer tanto la fila.
- Auspiciantes del portal compartible reforzados:
  - `backend/services/publicPortalService.js` ya usa fallback por filesystem (`/uploads/auspiciantes`) cuando no existen relaciones cargadas en BD.
  - pendiente operativo en Render:
    - copiar tambien los archivos reales de `uploads/` al almacenamiento persistente para que el portal muestre imagenes reales.
- Proteccion visual de rutas privadas:
  - `frontend/js/core.js` ahora oculta el `body` de paginas privadas mientras se valida la sesion/rol.
  - objetivo:
    - evitar que se vea contenido interno durante la navegacion directa antes del redirect/autorizacion.

- Portal publico deportivo ajustado para operacion real:
  - `backend/services/publicPortalService.js` ahora expone solo campeonatos creados por usuarios con rol `organizador`.
  - quedan excluidos del portal general:
    - campeonatos creados por `administrador`,
    - campeonatos de QA/pruebas ligados a cuentas administrativas.
  - `backend/controllers/publicPortalController.js` y `backend/routes/publicRoutes.js` ahora protegen tambien en dominio publico:
    - `goleadores`,
    - `tarjetas`,
    - `fair play`,
    de modo que no puedan consultarse por `evento_id` oculto si el campeonato no es publico.
- Landing publica por organizador endurecida:
  - `backend/controllers/authController.js` deja de mezclar campeonatos por alias de texto,
  - la landing de organizador ahora lista solo campeonatos con `creador_usuario_id = organizador`.
- UX del detalle publico del campeonato refinada:
  - `frontend/js/portal.js` mantiene nombre del campeonato arriba y tabs por categoria,
  - las subtabs deportivas quedan alineadas a la operacion solicitada:
    - `Tabla de posiciones`,
    - `Goleadores`,
    - `Fair play`,
    - `Tarjetas amarillas`,
    - `Tarjetas rojas`.
  - se elimina de esta vista publica el foco en `Jornadas`/`Tarjetas` combinadas para simplificar lectura estadistica.
- Layout responsive de tablas publicas:
  - `frontend/css/portal.css` y `frontend/js/portal.js` ahora muestran tablas de posiciones:
    - `2` bloques por fila en desktop,
    - `1` bloque por fila en tablet/movil.

- Preparacion de despliegue en Render:
  - nuevo documento `docs/DEPLOY_RENDER.md` con:
    - variables requeridas,
    - uso de `DATABASE_URL`,
    - `render.yaml`,
    - consideraciones de `uploads/`.
  - nuevo archivo `render.yaml` para bootstrap de un solo servicio Node en Render.
- Backend listo para despliegue por URL de conexion:
  - `backend/config/database.js` ahora soporta:
    - `DATABASE_URL`,
    - `DATABASE_SSL` / `PGSSLMODE`,
    - fallback al esquema clasico `DB_*`.
- Frontend preparado para mismo origen en produccion:
  - `frontend/js/core.js` y `frontend/js/api.js` resuelven automaticamente la base de API segun entorno.
  - en local con Live Server se mantiene compatibilidad con `http://localhost:5000/api`.
  - en produccion el frontend consume `/api` sobre el mismo dominio.
- Portal publico mejorado:
  - `frontend/portal.html`, `frontend/js/portal.js` y `frontend/css/portal.css` ahora muestran:
    - detalle de campeonato con tabs por categoria,
    - subtabs por posiciones, jornadas, goleadores, tarjetas, fair play y playoff,
    - vista de jornadas agrupadas con metadatos de fecha/hora/cancha.
- Branding tecnico:
  - nuevo `frontend/favicon.svg`.
  - favicon agregado al portal y a las pantallas principales del sistema.
- Uploads estables para despliegue:
  - nuevo archivo `backend/config/uploads.js` para centralizar la ruta real de almacenamiento.
  - `backend/server.js` ahora publica `/uploads` desde `UPLOADS_DIR` si existe; en local mantiene fallback a `backend/uploads`.
  - `backend/config/multerConfig.js` escribe siempre sobre la misma ruta configurada.
  - controladores que eliminan o leen archivos (`campeonatos`, `equipos`, `auspiciantes`) ya no dependen de una ruta fija dentro del contenedor.
  - `render.yaml` queda preparado con disco persistente en `/var/data` y `UPLOADS_DIR=/var/data/uploads`.
  - documentado el paso operativo para copiar el contenido historico de `backend/uploads/` al disco persistente en Render.
- Jugadores: uploads reorganizados sin romper compatibilidad:
  - `backend/config/multerConfig.js` ahora permite carpetas por campo.
  - `backend/routes/jugadorRoutes.js` enruta:
    - `foto_cedula` -> `uploads/jugadores/cedulas`,
    - `foto_carnet` -> `uploads/jugadores/fotos`.
  - `backend/controllers/jugadorController.js` ya guarda nuevas URLs por subcarpeta manteniendo los campos existentes:
    - `foto_cedula_url`,
    - `foto_carnet_url`.
  - impacto operativo:
    - los carnets siguen reimprimiendose regenerando PDF desde BD + foto del jugador,
    - no se almacena una imagen final del carnet, por lo que no se rompe reimpresion historica.
- Seguridad de usuarios reforzada:
  - nueva migracion `database/migrations/031_usuarios_cambio_password_obligatorio.sql`.
  - `usuarios.debe_cambiar_password` ya queda disponible en backend.
  - usuarios creados por `administrador` u `organizador` quedan obligados a cambiar contraseña al primer ingreso.
  - nuevo endpoint autenticado:
    - `POST /api/auth/password/change`.
  - `frontend/js/core.js` ya fuerza el cambio al detectar una cuenta pendiente y expone accion visible `Cambiar clave` en el top bar.
  - `frontend/js/login.js` y `frontend/js/usuarios.js` ya informan al usuario/administrador cuando la cuenta exige cambio de contraseña.
  - `backend/middleware/authMiddleware.js` permite esta operacion incluso para roles en modo `solo_lectura` (`jugador`).
- Portal publico deportivo refinado para cierre visual:
  - `frontend/js/portal.js` reincorpora la subtab `Playoff` por categoria consumiendo `GET /api/public/eventos/:evento_id/eliminatorias`.
  - la llave publica ahora se muestra por rondas con tarjetas propias, manteniendo el avance del cuadro eliminatorio.
  - el portal ya replica el color de estados de la tabla interna:
    - fuera de clasificacion en naranja,
    - eliminados en rojo oscuro con causal visible.
  - `backend/controllers/tablaController.js` excluye equipos eliminados de `Fair Play`, tanto en panel interno como en portal publico.
- Usuarios internos con correo o username:
  - nueva migracion `database/migrations/032_usuarios_username_opcional.sql`.
  - `backend/models/UsuarioAuth.js` ahora acepta `email` nullable y `username` opcional/unique, con regla obligatoria de al menos un identificador.
  - `backend/controllers/authController.js` permite login por `identificador` (`correo o usuario`).
  - `frontend/login.html` y `frontend/js/login.js` cambian la UX de acceso a `Correo o usuario`.
  - `frontend/usuarios.html` y `frontend/js/usuarios.js` permiten crear/editar usuarios con:
    - correo,
    - username,
    - o ambos.
  - la recuperacion de contraseña sigue funcionando solo para cuentas con correo.

### 2026-03-09
- Configuracion compartida de clasificacion/playoff:
  - nueva persistencia `evento_playoff_config` para mantener sincronizados `tablas.html` y `eliminatorias.html`.
  - nuevos endpoints:
    - `GET /api/eliminatorias/evento/:evento_id/configuracion`,
    - `PUT /api/eliminatorias/evento/:evento_id/configuracion`,
    - `DELETE /api/eliminatorias/evento/:evento_id/configuracion`.
  - `frontend/tablas.html` y `frontend/eliminatorias.html` ahora consumen la misma fuente de verdad para:
    - `metodo_competencia`,
    - `clasificados_por_grupo`,
    - `origen_playoff`,
    - `metodo_playoff`,
    - `cruces_grupos`.
  - nueva migracion agregada:
    - `database/migrations/030_evento_playoff_config.sql`.
- Eliminacion manual por categoria:
  - nuevo servicio `backend/services/competitionStatusService.js` para centralizar estados competitivos de `evento_equipos`.
  - nuevas causales operativas soportadas:
    - `indisciplina`,
    - `deudas`,
    - `sin_justificativo_segunda_no_presentacion`.
  - nuevo endpoint `PUT /api/eventos/:evento_id/equipos/:equipo_id/estado-competencia` para eliminar o rehabilitar equipos dentro de una categoria.
- Clasificacion manual con sugerencia del sistema:
  - nuevo almacenamiento `evento_clasificados_manuales` para guardar decisiones del organizador por `grupo` y `slot_posicion`.
  - nuevos endpoints:
    - `GET /api/eliminatorias/evento/:evento_id/clasificacion`,
    - `PUT /api/eliminatorias/evento/:evento_id/clasificacion-manual`.
  - `backend/models/Eliminatoria.js` ahora:
    - excluye eliminados automaticos/manuales de llaves directas y playoff desde grupos,
    - permite sugerencia automatica por tabla y sobrescritura manual por grupo,
    - cuando un grupo queda incompleto puede proponer al mejor no clasificado elegible del evento,
    - permite guardar criterio manual por cupo:
      - `decision_organizador`,
      - `mejor_no_clasificado_evento`,
      - `partido_extra_reclasificacion`.
- UI operativa en eliminatorias:
  - `frontend/eliminatorias.html` agrega bloque `Estado competitivo de equipos`,
  - `frontend/eliminatorias.html` agrega bloque `Clasificación manual con sugerencia`,
  - `frontend/js/eliminatorias.js` permite:
    - marcar causal y detalle de eliminacion,
    - rehabilitar equipos manualmente eliminados,
    - escoger clasificados por grupo y guardar criterio del organizador,
    - usar candidatos adicionales del evento cuando no hay suficientes elegibles dentro del grupo.
- Tablas y equipos ya reflejan el nuevo estado:
  - `frontend/js/tablas.js` pinta eliminaciones manuales con su causal,
  - `frontend/js/equipos.js` muestra chips de eliminacion manual en tarjetas y tabla,
  - `backend/controllers/tablaController.js` reordena posiciones competitivas para que los eliminados bajen al final aunque tengan mejor puntaje,
  - los equipos fuera de clasificacion ahora se pintan en naranja/marron y los eliminados en rojo oscuro,
  - la leyenda de eliminacion/no presentacion ocupa mas espacio visual dentro de la celda.
- Sistema visual de avisos y dialogos unificado:
  - `frontend/js/core.js` reemplaza `alert/confirm/prompt` por dialogos reutilizables y notificaciones visuales.
  - integracion aplicada en modulos operativos:
    - usuarios,
    - campeonatos,
    - equipos,
    - sorteo,
    - grupos,
    - partidos,
    - planilla,
    - eliminatorias,
    - CMS.
- Migraciones agregadas del bloque:
  - `database/migrations/029_eliminacion_manual_y_clasificacion_manual.sql`,
  - `database/migrations/030_evento_playoff_config.sql`.
- Validacion tecnica:
  - `node --check backend/controllers/eventoController.js` (`PASS`),
  - `node --check backend/controllers/eliminatoriaController.js` (`PASS`),
  - `node --check backend/controllers/tablaController.js` (`PASS`),
  - `node --check backend/models/Eliminatoria.js` (`PASS`),
  - `node --check backend/services/competitionStatusService.js` (`PASS`),
  - `node --check frontend/js/eliminatorias.js` (`PASS`),
  - `node --check frontend/js/tablas.js` (`PASS`),
  - `node --check frontend/js/equipos.js` (`PASS`),
  - `node --check frontend/js/core.js` (`PASS`),
  - `npm --prefix backend run smoke` (`PASS`, 9/9).

### 2026-03-08
- Auditoria de edicion de planillas finalizadas:
  - `backend/models/Partido.js` incorpora control de motivo obligatorio (minimo 8 caracteres) cuando se edita una planilla ya finalizada.
  - se registra traza en `partido_planilla_ediciones` con:
    - `partido_id`,
    - `usuario_id`,
    - `motivo`,
    - `estado_anterior` (snapshot JSON),
    - `estado_nuevo` (snapshot JSON).
  - se agrega migracion `database/migrations/028_auditoria_edicion_planilla.sql`.
- API de planilla y mobile ajustadas para auditoria:
  - `backend/controllers/partidoController.js` ahora envia `usuario_id` a `Partido.guardarPlanilla` y respeta `statusCode` de errores de negocio.
  - `backend/services/mobileOperationsService.js` y `backend/services/mobileCompetitionService.js` soportan `editReason/motivoEdicion/motivo_edicion` para reapertura/edicion controlada desde clientes mobile.
- UX de planillaje:
  - en `frontend/planilla.js` al guardar una planilla finalizada se solicita motivo de edicion antes de enviar.
  - el selector de partidos resalta en amarillo estados cerrados (`finalizado` y `no_presentaron_ambos`) para evitar ediciones accidentales.

- Tablas por categoría: aislamiento por usuario y campeonato corregido.
  - `GET /api/eventos`, `GET /api/eventos/campeonato/:id` y `GET /api/eventos/:id` ahora requieren autenticación y respetan alcance de organizador por campeonato.
  - `GET /api/tablas/*` ahora es privado (autenticado) para evitar cruces de datos internos; el portal público mantiene sus endpoints propios en `/api/public/*`.
  - se reforzó control de acceso por organizador también en lectura/edición de canchas y equipos de categoría.
- Pantalla `tablas.html` mejorada para operación multi-campeonato:
  - nuevo selector de campeonato (`Campeonato -> Categoría`),
  - selección de contexto persistida por usuario en `localStorage` para evitar arrastre de contexto entre cuentas (ejemplo: administrador vs organizador),
  - nuevo bloque `Formato de Clasificación` con botón explícito `Guardar formato` para persistir `metodo_competencia` y `clasificados_por_grupo` de la categoría.
- Resultado del ajuste:
  - organizador ya no recibe categorías de campeonatos ajenos,
  - las tablas se generan sobre el campeonato/categoría seleccionados,
  - el formato de clasificación se guarda de forma explícita desde el módulo de tablas.

- Clasificacion por grupo y tablas:
  - `eventos/categorias` ahora permite configurar `clasificados_por_grupo`,
  - `tablas` muestra el cupo por grupo en el resumen,
  - los equipos fuera de clasificacion se pintan en rojo,
  - si un equipo queda eliminado automaticamente por inasistencias, tambien se marca en rojo y se etiqueta como `Eliminado`.
- No presentacion acumulada por categoria:
  - nueva persistencia en `evento_equipos` para `no_presentaciones` y `eliminado_automatico`,
  - al guardar una planilla, el backend recalcula no presentaciones por equipo dentro de la categoria,
  - con `3` no presentaciones el equipo queda eliminado automaticamente en esa categoria.
- Correccion de doble inasistencia:
  - `ambos no se presentan` ahora guarda `resultado_local/resultado_visitante = NULL`,
  - el estado del partido queda `no_presentaron_ambos`,
  - no se contabiliza como partido jugado,
  - se mantiene la multa por arbitraje/no presentacion para ambos equipos.
- Migraciones aplicadas en la BD local:
  - `database/migrations/026_ambos_no_presentes_sin_resultado.sql`,
  - `database/migrations/027_clasificacion_y_no_presentacion_automatica.sql`.
- Prueba E2E operativa agregada (solo lectura, datos reales):
  - nuevo script `backend/scripts/e2eOperationalFlowCheck.js`,
  - nuevo comando `npm run e2e:ops-flow`,
  - valida punta a punta: autenticacion -> campeonato -> categoria -> equipos -> grupos -> partidos -> planilla -> tablas -> finanzas -> portal publico.

### 2026-03-07
- Planillaje y disciplina:
  - se corrigio el tratamiento de `doble amarilla` para no perder la trazabilidad disciplinaria al guardar/reabrir planillas,
  - ahora la roja generada por `2 TA` queda marcada explicitamente como `Expulsion por doble amarilla`,
  - la suspension conserva la regla correcta:
    - `doble amarilla` -> `1 partido`,
    - `roja directa` -> `2 partidos`.
- Planilla operativa mejorada:
  - nueva inscripcion rapida de jugadores desde `planilla.html`,
  - alta por equipo sin salir del formulario del partido,
  - recarga del plantel sin perder goles/tarjetas/pagos/observaciones ya capturados en pantalla.
- Ajustes operativos de planilla:
  - faltas de `1ER` y `2DO` tiempo ahora se capturan por clic y se guardan por equipo/tiempo para alimentar fair play,
  - el encabezado de planilla mueve los logos de los equipos junto al marcador y reserva el bloque derecho para auspiciantes,
  - la no presentacion parcial ya bloquea solo el lado ausente y mantiene habilitados los pagos/evidencia del equipo que si se presenta.
- Reporteria operativa adicional de disciplina:
  - `frontend/partidos.html` incorpora nueva pestaña `Reporte Sanciones`,
  - consolidado operativo por categoria con foco en:
    - jugadores suspendidos,
    - jugadores con amarillas acumuladas,
    - resumen por equipos con novedades,
  - incluye impresion y exportacion PDF para uso previo a programacion/partidos.
- Modulo financiero ampliado en reporteria ejecutiva:
  - `frontend/finanzas.html` incorpora nuevo bloque `Resumen Ejecutivo por Equipo`,
  - consolidado por equipo con:
    - campeonato y categoria,
    - cargos, abonos y saldo actual,
    - cargos abiertos y vencidos,
    - saldo por inscripcion, arbitraje y multas,
  - incluye impresion dedicada para salida operativa/administrativa.
- Alertas operativas extendidas a gestion de equipos:
  - `frontend/equipos.html` suma bloque `Alertas Operativas`,
  - cada tarjeta/tabla de equipo ahora muestra chips de:
    - deuda pendiente,
    - jugadores suspendidos,
    - seguimiento por amarillas acumuladas,
  - la vista se alimenta con:
    - morosidad del equipo desde finanzas,
    - estado disciplinario por categoria desde jugadores/partidos.
- Alertas operativas extendidas a gestion de partidos:
  - `frontend/partidos.html` suma bloque `Alertas Operativas de los Partidos Mostrados`,
  - cada partido ahora muestra alertas separadas para local y visitante:
    - deuda,
    - suspendidos,
    - seguimiento por amarillas,
  - la tabla de partidos incorpora nueva columna `Alertas` con el mismo detalle operativo.
- Validacion tecnica del bloque:
  - `node --check backend/models/Partido.js` (`PASS`),
  - `node --check frontend/js/planilla.js` (`PASS`),
  - `node --check frontend/js/partidos.js` (`PASS`),
  - `node --check frontend/js/finanzas.js` (`PASS`),
  - `node --check frontend/js/equipos.js` (`PASS`).

### 2026-03-05
- CMS Portal Publico - Fase 6 (cierre operativo) avanzando:
  - endurecimiento de validaciones en backend para modelos CMS:
    - `Noticia`: limpieza de texto y validacion de `imagen_portada_url`,
    - `GaleriaItem`: validacion de `imagen_url` y limites de texto,
    - `PortalContenido`: validacion de email de contacto, URLs sociales y normalizacion de cards/iconos,
    - `ContactoMensaje`: validacion de formato de email y longitud minima de mensaje.
- Formulario publico de contacto reforzado contra abuso:
  - rate-limit por `IP + email` (maximo 3 envios cada 10 minutos),
  - campo honeypot `website` integrado para mitigar bots basicos,
  - respuesta `429` para exceso de solicitudes.
- Frontend landing actualizado para hardening de contacto:
  - nuevo input oculto honeypot en `index.html`,
  - envio del campo `website` desde `frontend/js/portal.js`.
- Documentacion de cierre de fases CMS agregada:
  - `docs/CHECKLIST_QA_CMS_PORTAL_PUBLICO.md`,
  - `docs/GUIA_DESPLIEGUE_CMS_PORTAL_PUBLICO.md`.
- QA automatizado ejecutado para CMS/portal publico:
  - evidencia en `docs/RESULTADO_QA_CMS_2026-03-05.md`,
  - validado:
    - endpoints publicos (`/public/portal-contenido`, `/public/noticias`),
    - proteccion de endpoints CMS privados sin token (`401`),
    - rate-limit de contacto (`3x201 + 429`),
    - honeypot `website` (aceptacion silenciosa),
    - validacion de mensaje corto (`400`).
- QA por rol ejecutado con usuarios de prueba:
  - `administrador` y `operador` con acceso CMS correcto,
  - `organizador/tecnico/dirigente/jugador` bloqueados en endpoints CMS (`403`).
- Hallazgo corregido en esta iteracion:
  - `operador` podia consultar `GET /api/campeonatos`,
  - se ajusto `backend/routes/campeonatoRoutes.js` para exigir `requireAuth + requireRoles` en `GET /` y `GET /:id`,
  - resultado post-fix: `operador` ahora recibe `403` en campeonatos.
- Panel CMS reforzado para operacion diaria:
  - `frontend/portal-cms.html` ahora muestra KPIs editoriales,
  - nuevo script `frontend/js/portal-cms.js` con metricas en tiempo real:
    - noticias publicadas,
    - imagenes activas de galeria,
    - mensajes nuevos de contacto,
    - fecha de ultima actualizacion de contenido institucional.
- Bug CMS corregido en noticias:
  - `publicar/despublicar` devolvia `500` por conflicto de tipos SQL en `Noticia.cambiarEstado`,
  - ajustado casteo explicito y validado en QA:
    - crear noticia `201`,
    - publicar `200`,
    - despublicar `200`.
- Saneamiento de integracion backend (web + mobile + CMS):
  - se agrego script reutilizable `backend/scripts/smokeIntegration.js` y comando `npm run smoke` en `backend/package.json`,
  - se agrego script de verificacion RBAC mobile `backend/scripts/smokeRoleAccess.js` con comando `npm run smoke:roles`,
  - integracion de script del equipo mobile `backend/scripts/smokeProvidedUsers.js` con comando `npm run smoke:provided`,
  - nuevo smoke de matriz RBAC multi-rol desde usuarios activos de BD: `backend/scripts/smokeRoleMatrixDb.js` (`npm run smoke:matrix`),
  - nueva auditoria automatizada de guard frontend por rol sobre `frontend/js/core.js`: `backend/scripts/smokeFrontendRoleGuards.js` (`npm run smoke:frontend`),
  - cobertura base del smoke:
    - salud/DB (`/salud`, `/testDb`),
    - portal publico (`/api/public/campeonatos`, `/api/public/noticias`),
    - endpoints privados sin token (`/api/noticias`, `/api/campeonatos`),
    - endpoints mobile sin token (`/api/mobile/v1/session`, `/api/mobile/v1/eventos/:id/sorteo`, `/api/mobile/v1/finanzas/movimientos`).
  - corrida local validada en esta sesion: `9/9` pruebas en `PASS`.
  - corrida RBAC mobile validada en esta sesion: `18/18` pruebas en `PASS` (`organizador`, `tecnico`, `dirigente`).
  - corrida auditoria frontend por roles: `38/38 PASS`.
  - corrida matriz RBAC completa por rol (DB): `48/48 PASS`.
  - corrida smoke con cuentas provistas app mobile: `27/27 PASS` (`organizador`, `tecnico`, `dirigente`).
  - con esta evidencia, Fase 6 CMS queda cerrada tecnicamente; se mantiene solo validacion visual/manual opcional en navegador como control final operativo.
- Cierre operativo formalizado:
  - nueva acta `docs/ACTA_ACEPTACION_CMS_FASE6_2026-03-05.md`,
  - nuevo comando consolidado de QA CMS en backend: `npm run qa:cms` (`smoke + smoke:frontend + smoke:matrix`).
  - corrida consolidada ejecutada en esta sesion: `95/95 PASS`.
- Modulo de pases: integracion contable completada para el flujo deportivo-financiero:
  - `backend/models/Pase.js` ahora sincroniza movimientos en `finanzas_movimientos` al aprobar/pagar/anular pases,
  - se crean/actualizan dos movimientos por pase (`cargo` equipo destino y `abono` equipo origen),
  - se usa `origen='sistema'` + `origen_clave='pase:{id}:{tipo}'` para idempotencia y trazabilidad.
- Validacion tecnica del bloque de pases-finanzas:
  - chequeo de sintaxis backend: `node --check backend/models/Pase.js` (`PASS`),
  - corrida QA consolidada: `npm run qa:cms` (`95/95 PASS`),
  - prueba controlada de pase temporal en BD: `2 movimientos` contables generados (`cargo/abono`) y limpieza posterior ejecutada.
- Modulo de pases: historial por jugador y por equipo implementado:
  - nuevos endpoints backend:
    - `GET /api/pases/historial/jugadores`
    - `GET /api/pases/historial/jugadores/:jugadorId`
    - `GET /api/pases/historial/equipos`
    - `GET /api/pases/historial/equipos/:equipoId`
  - `frontend/pases.html` ahora incluye bloque visual de historial dedicado:
    - selector de jugador y selector de equipo,
    - resumen consolidado por entidad,
    - tabla de detalle cronologico.
  - `frontend/js/pases.js` sincroniza filtros globales (`campeonato/categoria/estado`) con historial para analisis operativo.
- Validacion de coexistencia con equipo mobile:
  - nuevo script de QA de dataset UI en backend: `npm run qa:ui-dataset`,
  - corrida ejecutada en esta sesion sobre dataset real (`campeonato=6`, `evento=13`, `partido=195`, `equipo=91`) con resultado `PASS`.
- Documentacion ampliada para entrega a cliente y capacitacion:
  - nuevo manual operativo: `docs/GUIA_OPERATIVA_CLIENTE_LT_C.md`,
  - nuevo guion de tutoriales: `docs/GUIA_VIDEO_TUTORIALES_LT_C.md`,
  - actualizacion de referencias en `README.md`, `docs/INDICE_DOCUMENTACION.md` y `docs/GUIA_PRESENTACION_SISTEMA_LT_C.md`.

### 2026-03-04
- Planilla y morosidad:
  - se retiro el bloqueo por deuda al guardar planillas,
  - ahora la planilla siempre se puede registrar y el backend devuelve `aviso_morosidad` como mensaje informativo.
- Avisos de deuda por rol de equipo:
  - tecnico/dirigente/jugador reciben notificacion de deuda acumulada del equipo (toast global),
  - en `portal-tecnico.html` se muestra ademas un banner fijo con el detalle de deuda.
- Nuevo rol `jugador` incorporado:
  - alta de rol en autenticacion y validaciones de usuarios,
  - rol permitido en consultas de lectura de equipo/jugadores/finanzas/planilla,
  - usuario `jugador` forzado a `solo_lectura=true`,
  - migracion agregada: `database/migrations/024_rol_jugador.sql`.
- Coexistencia web + app movil validada para este bloque:
  - el backend principal mantiene contratos de lectura/escritura vigentes,
  - `aviso_morosidad` se entrega como dato informativo sin bloqueo de planilla.
- Modulo financiero extendido con reporte disciplinario-contable:
  - nuevo bloque `Consolidado de Sanciones (TA/TR)` en `frontend/finanzas.html`,
  - calculo agrupado por equipo en `frontend/js/finanzas.js` usando movimientos `concepto=multa`,
  - clasificacion de sanciones entre:
    - `TA` (tarjeta amarilla),
    - `TR` (tarjeta roja),
    - `otras multas`.
  - resumen de saldos por bloque (`TA`, `TR`, `otras`) y saldo total de sanciones.
- Reporteria del consolidado financiero de sanciones:
  - impresion dedicada (`Imprimir sanciones`) con membrete y pie de auspiciantes,
  - filtros integrados con campeonato/categoria/equipo y recarga conjunta con movimientos/morosidad/estado de cuenta.
- Salida ejecutiva global financiera implementada:
  - nuevo bloque `Resumen Ejecutivo por Campeonato` en `frontend/finanzas.html`,
  - consolidado por campeonato en `frontend/js/finanzas.js` con:
    - total cargos/abonos/saldo,
    - cargos de inscripcion,
    - cargos de arbitraje,
    - saldo de multas,
    - cantidad de equipos con movimiento,
  - impresion dedicada (`Imprimir ejecutivo`) con membrete y pie de auspiciantes.
- Alcance pendiente que sigue abierto en finanzas:
  - reforzar reglas de aviso/gestion de morosidad parametrizable.
- Politica de morosidad parametrizable implementada (base):
  - nueva migracion `database/migrations/023_bloqueo_morosidad_parametrizable.sql`,
  - configuracion en campeonato:
    - `bloquear_morosos`,
    - `bloqueo_morosidad_monto`,
  - override opcional por categoria/evento:
    - `bloquear_morosos` (`null` hereda),
    - `bloqueo_morosidad_monto` (`null` hereda),
  - validacion aplicada en guardado de planilla (`backend/models/Partido.js`) en modo informativo:
    - si existe deuda, no bloquea el guardado,
    - retorna aviso de deuda para web y mobile (mismo flujo backend).
- Alcance pendiente que sigue abierto para morosidad:
  - definir si se mantiene solo como aviso o se activa bloqueo en otros flujos operativos fuera de planilla (segun reglas de negocio finales).

### 2026-03-03
- Planilla directa mejorada para operacion por grupo:
  - nuevo selector `grupo` en `frontend/planilla.html`,
  - filtrado encadenado `categoria -> grupo -> jornada -> partido` en `frontend/js/planilla.js`,
  - el selector de partidos ahora muestra el grupo dentro de la etiqueta para identificar mas rapido cada encuentro.
- Estado disciplinario visible fuera de planilla:
  - `backend/models/Partido.js` centraliza el calculo de suspensiones y acumulacion de amarillas por `evento/equipo/jugador`,
  - `backend/controllers/jugadorController.js` ahora puede enriquecer `/jugadores/equipo/:id?evento_id=...` con el estado disciplinario,
  - `frontend/js/jugadores.js` muestra `habilitado`, `acumula TA` o `suspendido` en tarjetas y tabla,
  - nuevo `Reporte de sanciones` en `jugadores.html` con impresion y exportacion PDF por equipo/categoria,
  - nuevo `Consolidado sanciones categoria` en `jugadores.html` con resumen global y detalle por `equipo/jugador`, tambien imprimible y exportable a PDF sin exigir equipo seleccionado.
- Alcance pendiente que sigue abierto en disciplina:
  - ya existe reporte formal por `equipo/jugador`,
  - ya existe consolidado global por `categoria/equipo/jugador`,
  - falta seguir mostrando estas sanciones en otros reportes operativos ademas de `jugadores.html`.

### 2026-03-02
- Planillaje reforzado para escenarios disciplinarios y de inasistencia:
  - nuevo flujo de `inasistencia / walkover` en `frontend/planilla.html` y `frontend/js/planilla.js`,
  - soporte para:
    - no se presenta equipo local,
    - no se presenta equipo visitante,
    - no se presentan ambos equipos.
  - resultado automatico aplicado desde planilla:
    - local ausente -> `0-3`,
    - visitante ausente -> `3-0`,
    - ambos ausentes -> marcador vacio (`NULL/NULL`) con estado `no_presentaron_ambos`.
  - al existir inasistencia:
    - se bloquea captura por jugador,
    - se limpian pagos manuales,
    - se generan multas por arbitraje en finanzas segun corresponda.
- Persistencia backend para inasistencia de planilla:
  - `backend/models/Partido.js` ahora guarda `ambos_no_presentes` e `inasistencia_equipo`,
  - nuevas migraciones:
    - `database/migrations/021_planilla_ambos_no_presentes.sql`,
    - `database/migrations/022_planilla_inasistencia_equipo.sql`.
- Regla disciplinaria aplicada en planilla:
  - `2 tarjetas amarillas` del mismo jugador en un partido se convierten automaticamente en `1 tarjeta roja`,
  - el resumen del partido, la exportacion y finanzas ya reflejan solo roja,
  - no se cobra amarilla + roja en el mismo caso.
- Suspensiones automaticas visibles en planillaje:
  - un jugador suspendido llega marcado en rojo en la planilla y con sus campos bloqueados,
  - reglas activas:
    - doble amarilla en el partido -> suspension de `1` partido,
    - roja directa -> suspension de `2` partidos,
    - futbol 11 -> suspension de `1` partido al acumular `4` amarillas.
  - el calculo se realiza con historial del jugador dentro del `evento/categoria`, previo al partido actual.

### 2026-02-28
- Inicio formal del plan de separacion entre panel deportivo y CMS del portal publico:
  - nuevo documento maestro `docs/PLAN_CMS_PORTAL_PUBLICO.md`,
  - definicion de dos dominios de operacion:
    - gestion deportiva,
    - portal web publico / CMS.
- Fase 1 iniciada:
  - nuevo rol `operador` definido como rol exclusivo para CMS publico,
  - nueva migracion `database/migrations/016_rol_operador_cms.sql`,
  - backend actualizado para aceptar `operador` en autenticacion/permisos,
  - noticias restringidas a `administrador` y `operador`,
  - organizador removido del alcance editorial del portal institucional.
- Frontend base de CMS habilitado:
  - nueva vista `frontend/portal-cms.html`,
  - redireccion de `operador` hacia panel propio,
  - control de acceso por pagina para evitar ingreso de `operador` al panel deportivo,
  - `usuarios.html` actualizado para alta/edicion del rol `operador` por parte del administrador.
- Ajuste semantico de navegacion:
  - `portal-admin.html` pasa a identificarse como `Portal Deportivo` para diferenciarlo del CMS.
- Fase 2 iniciada para noticias/blog:
  - nueva pagina administrativa `frontend/noticias.html` con formulario y listado CRUD,
  - nuevo script `frontend/js/noticias.js`,
  - API frontend extendida con `NoticiasAPI`,
  - nuevas vistas publicas `frontend/blog.html` y `frontend/noticia.html`,
  - la landing principal consume la ultima noticia publicada desde `/api/public/noticias`,
  - nueva migracion formal `database/migrations/017_noticias_cms.sql` para versionar la tabla `noticias`.
- Fases 3, 4 y 5 iniciadas en base funcional:
  - nueva migracion `database/migrations/018_galeria_cms.sql` para galeria institucional,
  - nueva migracion `database/migrations/019_portal_contenido_cms.sql` para contenido editable del portal,
  - nueva migracion `database/migrations/020_contacto_portal.sql` para mensajes del formulario de contacto,
  - nuevos modulos backend:
    - `GaleriaItem`,
    - `PortalContenido`,
    - `ContactoMensaje`,
  - nuevas rutas administrativas:
    - `/api/galeria`,
    - `/api/portal-contenido`,
    - `/api/contacto`,
  - nuevas rutas publicas:
    - `/api/public/galeria`,
    - `/api/public/portal-contenido`,
    - `/api/public/contacto`,
  - nuevas vistas CMS:
    - `frontend/galeria-admin.html`,
    - `frontend/contenido-portal.html`,
    - `frontend/contacto-admin.html`,
  - la landing publica ahora consume contenido institucional editable para:
    - hero,
    - cards destacadas,
    - seccion nosotros,
    - galeria,
    - datos/redes/contacto,
  - el formulario `Escribenos` ya persiste mensajes en base de datos.
- Soporte para presentacion del sistema:
  - nuevo documento `docs/GUIA_PRESENTACION_SISTEMA_LT_C.md` con guion de demo por bloques, roles y flujo sugerido.

### 2026-02-27
- Cierre de lote de ajustes funcionales y de consistencia para organizadores/operacion diaria:
  - refinamientos en autenticacion/usuarios/alcances de organizador,
  - ajustes en campeonatos, categorias, equipos, grupos, partidos, planilla, tablas y registro publico,
  - continuidad del trabajo responsive/mobile en vistas administrativas.
- Configuracion flexible de inscripcion de jugadores por campeonato:
  - nuevo flag `requiere_cedula_jugador` para permitir torneos donde la cedula no sea obligatoria,
  - nuevo check en `campeonatos.html` para activar/desactivar la solicitud de cedula,
  - validacion integrada en backend y frontend para creacion, edicion e importacion de jugadores.
- Nueva migracion agregada:
  - `database/migrations/015_campeonato_cedula_opcional.sql`.
- Documentacion sincronizada para continuidad de trabajo:
  - actualizacion de bitacora,
  - actualizacion de estado de implementacion,
  - actualizacion de README con migracion 015 y estado reciente.

### 2026-02-24
- Inicio de ejecucion del plan mobile (`Fase 1`) en frontend administrativo:
  - refuerzo de layout global para evitar desbordes horizontales en `app-layout`,
  - `container` con padding fluido por viewport para mejorar lectura en movil/tablet,
  - ajuste de `top-bar` y titulo para pantallas pequenas,
  - normalizacion de barras de acciones (incluye `actions`, `action-bar`, `partidos-actions`, `reportes-actions`, etc.) para mejor uso tactil,
  - ajuste responsive dedicado para paginas con `main.container` (caso `equipos.html`).
- Navegacion responsive estabilizada:
  - sidebar responsive unificado para `<=1200px` en CSS,
  - ajuste de breakpoint en `frontend/js/core.js`:
    - paginas con sidebar: comportamiento movil hasta `1200px`,
    - paginas publicas sin sidebar: comportamiento movil hasta `768px`.
- Cierre parcial de responsive por modulo:
  - `tablas`: filtros con botones tactiles full-width en movil, ajuste de anchos minimos y correccion de `overflow-x` en cards de grupo,
  - `finanzas`: formularios en una sola columna para `<=900px`, botones de acciones de registro adaptados a movil, tablas compactadas para anchos pequenos,
  - `partidos`: acciones de generacion/exportacion ajustadas a grilla tactil y tabs apilables en movil,
  - `planilla`: barra superior de acciones responsive, tabla de captura compactada en moviles pequenos y footer de pagos adaptado a una sola columna.
- Documentacion de continuidad sincronizada:
  - `docs/PLAN_MOBILE_LT_C.md` actualizado con estado `implementacion iniciada`,
  - `docs/ESTADO_IMPLEMENTACION_SGD.md` actualizado a `adaptacion mobile web: en progreso`.

### 2026-02-23
- Correccion integral de exportaciones en `Grupos` y `Eliminatorias`:
  - se resolvio bloqueo de `Exportar imagen / PDF / Compartir` cuando existen logos faltantes (imagenes con `404`),
  - se ajusto espera de imagenes para no quedar colgado en estados de carga incompletos.
- Modulo `Grupos` reorganizado con pestanas:
  - nueva pestana `Plantilla de Grupos`,
  - nueva pestana `Clasificacion / Playoff` embebida en la misma pantalla,
  - acceso a playoff en pantalla completa desde la misma pestana.
- Navegacion del sidebar refinada:
  - se removio el item directo `Eliminatorias` del menu lateral para concentrar flujo en `Grupos -> Clasificacion/Playoff`.
- Plantilla de eliminatorias mejorada para publicacion:
  - nuevo armado de llaves con conectores reales (SVG) entre rondas,
  - correcciones de recorte horizontal para exportar el diagrama completo,
  - fondo tipo arte (linea visual similar a grupos/fixture).
- Eliminatorias ahora incluyen bloque de auspiciantes en la zona exportable.
- Diagnostico y ajuste backend para auspiciantes:
  - se detecto entorno con tabla `campeonato_auspiciantes` vacia (aunque habia logos en disco),
  - se implemento fallback en `GET /api/auspiciantes/campeonato/:id` para leer desde `backend/uploads/auspiciantes` cuando no hay registros en BD.
- Pendiente tecnico identificado para siguiente iteracion:
  - normalizar definitivamente auspiciantes por campeonato en BD (evitar depender del fallback por filesystem).

### 2026-02-22
- Categorias/eventos ahora soportan configuracion de metodo de competencia:
  - `metodo_competencia`: `grupos`, `liga`, `eliminatoria`, `mixto`.
  - `eliminatoria_equipos`: objetivo de llave (`4/8/16/32`) o automatico.
  - cambios aplicados en backend (`eventoController`) y frontend (`eventos.html/js`) incluyendo visualizacion en cards y tabla.
- Generacion de partidos conectada al metodo de competencia:
  - `POST /api/partidos/evento/:evento_id/generar-fixture` ahora resuelve `modo=auto` segun categoria.
  - si la categoria es `eliminatoria`, genera llave en `partidos_eliminatoria` en lugar de fixture de grupos.
- Eliminatorias reforzadas (backend + frontend de partidos):
  - siembra automatica de equipos inscritos al evento.
  - soporte de `byes` y propagacion automatica de clasificados.
  - actualizacion de resultados propagando ganador al siguiente cruce.
  - vista de cruces eliminatorios en `partidos.html` (cards/tabla) y accion para registrar resultado por cruce.
- Modulo de pases (fase 1 backend) implementado:
  - nueva tabla `pases_jugadores` (runtime + migracion `014_pases_jugadores.sql`).
  - nuevos endpoints:
    - `GET /api/pases`
    - `GET /api/pases/:id`
    - `POST /api/pases`
    - `PUT /api/pases/:id/estado`
  - al confirmar pase (`pagado/aprobado`) se puede aplicar transferencia de jugador al equipo destino.
- API frontend extendida con `PasesAPI` para integrar UI de pases en la siguiente iteracion.
- UI de pases implementada para pruebas operativas:
  - nueva pagina `frontend/pases.html` + `frontend/js/pases.js`,
  - registro de pase, filtros, estado y acciones de aprobacion/pago/anulacion,
  - actualizacion de estado con opcion de aplicar transferencia.
- UI dedicada de eliminatorias implementada:
  - nueva pagina `frontend/eliminatorias.html` + `frontend/js/eliminatorias.js`,
  - vista de bracket por rondas y carga por categoria,
  - generacion/regeneracion de llave (admin/organizador) y registro de resultados.
  - nuevo flujo de playoff desde grupos:
    - selector de `clasificados por grupo`,
    - metodo `cruces entre grupos` (A vs C, B vs D, etc.),
    - metodo `tabla unica` (ranking global y cruces 1 vs ultimo).
- Navegacion mejorada:
  - sidebar dinamico (`core.js`) ahora inyecta accesos a `Pases` y `Eliminatorias`.
  - desde `partidos.html` se agrego acceso directo a la vista de llave eliminatoria.

- Planes por usuario/organizador consolidados en gestion de usuarios:
  - `usuarios.html/js` ahora permite al administrador crear/editar organizadores con `plan` (`demo/free/base/competencia/premium`) y `estado del plan` (`activo/suspendido`),
  - listado de usuarios muestra columnas de plan y estado de plan,
  - para organizadores con plan pagado se muestra enlace de landing publica.
- Landing publica por organizador implementada:
  - backend: nuevo endpoint `GET /api/auth/organizadores/:id/landing`,
  - disponibilidad restringida a planes pagados (`base`, `competencia`, `premium`) y plan activo,
  - frontend: `index.html` soporta modo landing con query `?organizador=ID` y personaliza textos/contacto/torneos segun el organizador.
- Portal de organizador mejorado:
  - `portal-admin.html` incorpora bloque "Landing publica de organizador",
  - permite abrir/copiar enlace de landing cuando el plan es pagado,
  - muestra aviso de upgrade cuando el organizador esta en plan `demo/free`.
- Correccion tecnica importante en backend:
  - `backend/models/Campeonato.js` corregido en el orden de parametros SQL al crear campeonatos (`creador_usuario_id` quedaba desfasado por costos), evitando inconsistencias en ownership y filtros por organizador/plan.

### 2026-02-21
- Landing page LT&C ajustada con linea visual final:
  - branding consolidado a `LT&C (Loja Torneos & Competencias)` en textos visibles del frontend,
  - cabecera y pie de pagina en paleta LT&C (negro/amarillo/azules),
  - enlaces reales integrados (Facebook, Instagram, WhatsApp y correo oficial).
- Seccion de torneos mejorada:
  - tarjetas de torneos/proximos torneos con imagenes locales,
  - soporte visual para imagenes pequenas con fondo de respaldo `bannerLTC`,
  - ajuste de tarjeta destacada para mayor altura.
- Nueva seccion `Planes y Precios` incorporada en landing.
- Seccion de auspiciantes redisenada:
  - carrusel unico sin cards ni nombres,
  - animacion acelerada para mejor dinamica visual.
- Seccion `Escribenos` actualizada:
  - texto `Sociales` corregido,
  - formulario ajustado en ancho/alto para mejor proporcion visual.
- README actualizado para denominacion oficial del sistema:
  - de `SGD - Sistema de Gestion Deportiva` a `LT&C - Loja Torneos & Competencias`.
- Iconografia del sistema/web incorporada:
  - nuevo favicon LT&C (`frontend/assets/ltc/favicon.svg`),
  - aplicacion global desde `frontend/js/core.js`.
- Ajustes finales UX en portal admin y landing:
  - se elimino leyenda inferior en bloque `Accesos rapidos` del portal administrador,
  - hover del menu principal con linea amarilla,
  - CTA de demo convertido en texto operativo y enlace principal a `registro`.
- Plan mobile web creado:
  - nuevo documento `docs/PLAN_MOBILE_LT_C.md` con roadmap por fases, criterios de aceptacion y checklist de ejecucion.

### 2026-02-20
- Documentacion de continuidad sincronizada para evitar perdida de contexto entre sesiones:
  - `README.md` creado y estructurado para GitHub con:
    - arquitectura,
    - requisitos e instalacion,
    - scripts y endpoints,
    - modulos implementados,
    - mapa de documentacion y pendientes prioritarios.
- Documento de estado actualizado:
  - `docs/ESTADO_IMPLEMENTACION_SGD.md` sincronizado a fecha actual (`2026-02-20`) con matriz real por modulo y prioridades vigentes.
- Bitacora operativa actualizada:
  - este archivo mantiene fecha vigente y nuevo bloque de sesion para continuidad inmediata.
- Se mantiene foco operativo actual:
  - pruebas funcionales del planillaje con datos reales para capturar bugs de campo y cerrar ajustes UX/impresion.
- Ajustes de navegacion global y responsive:
  - sidebar administrativo configurado para iniciar contraido por defecto en todas las paginas con layout lateral,
  - correccion de superposicion `sidebar/overlay` para que el menu sea clickeable en movil y no se cierre al intentar usar enlaces.
- Ajustes UX en modulo financiero (`finanzas.html/js/css`):
  - formularios de filtros y registro compactados por breakpoints para evitar desbordes horizontales,
  - reordenamiento visual priorizando `Estado de Cuenta` y controles de reporte mas claros en pantallas pequenas,
  - tablas de estado/morosidad/movimientos con modo compacto y mejor legibilidad responsive,
  - toggles por seccion para expandir/colapsar `Morosidad` y `Movimientos` sin scroll excesivo.
- Ajustes funcionales en reglas financieras:
  - sincronizacion automatica de cargos de inscripcion por categoria/equipo al consultar estado/morosidad/listados,
  - sincronizacion de planilla -> finanzas por equipo con cargos de arbitraje/multas y abonos registrados en planilla,
  - estado de cuenta con resumen por concepto (inscripcion, arbitraje, multas) ademas de totales,
  - filtro de movimientos para excluir por defecto registros internos de sistema (`origen='sistema'`).
- Configuracion economica extendida:
  - campeonato ahora gestiona costos base (`costo_arbitraje`, `costo_tarjeta_amarilla`, `costo_tarjeta_roja`, `costo_carnet`),
  - categoria/evento incorpora `costo_inscripcion` para cuenta corriente por equipo.
- Compatibilidades backend reforzadas:
  - soporte de columnas de timestamp alternativas (`updated_at` / `update_at`) en actualizacion de eventos y partidos.
- Nuevos reportes operativos en modulo financiero:
  - al registrar `Movimiento` se genera recibo de pago imprimible (con opcion de reimpresion),
  - se agregaron reportes imprimibles para:
    - estado de cuenta del equipo (incluye resumen + movimientos),
    - morosidad por equipo,
    - movimientos financieros filtrados en pantalla.
- Mejora funcional en carnets de jugadores:
  - selector de fuente de foto para anverso (`automatico`, `solo carnet`, `solo cedula`),
  - se incorpora `categoria` visible en el carnet,
  - se incorpora codigo QR que direcciona al portal del torneo/categoria.
- Portal publico mejorado para QR:
  - `index.html` ahora soporta abrir campeonato/categoria por query params (`?campeonato=ID&evento=ID`).
- Ajustes solicitados en modulo de carnets y tablas:
  - carnet muestra nombre real de categoria (no `Evento X`) usando contexto activo de evento,
  - exportacion/impresion de carnets ajustada a tamano fisico por tarjeta (`8.5cm x 5.5cm`) con layout A4,
  - modulo `Tablas` reorganizado a 2 columnas para reducir scroll horizontal en posiciones.
- Fair Play ampliado por modalidad:
  - para futbol 7 / futbol 5 / sala se incorpora conteo y penalizacion por faltas,
  - para futbol 11 e indor se mantiene comportamiento anterior (sin faltas en calculo).
- Finanzas (estado de cuenta) simplificado:
  - resumen en pantalla y reporte impreso ahora priorizan valores operativos por concepto:
    - inscripcion (cargo/pago/saldo),
    - arbitraje (pago/saldo),
    - tarjetas amarillas (pago/saldo),
    - tarjetas rojas (pago/saldo),
  - se elimina visualmente del resumen el bloque confuso de `saldo total` y `cargos pendientes`.
- Campeonatos/Eventos/Equipos:
  - fechas de campeonato normalizadas para evitar textos con sufijo `T...` y conservar fechas al editar,
  - en crear evento las fechas se rellenan automaticamente desde el campeonato seleccionado,
  - selector de colores en equipos simplificado a controles tipo color (alineado al estilo de campeonatos),
  - bloque de costos del formulario de campeonato ajustado para mejor alineacion visual.
- Ajuste terminologico UX:
  - se estandariza el texto visible a `Categoria/Categorias` en pantallas clave para evitar confusion con el termino tecnico `evento`.
- Modulo de auspiciantes implementado:
  - nueva migracion `database/migrations/008_auspiciantes.sql`,
  - nueva API `api/auspiciantes` (listar por campeonato, crear, actualizar y eliminar con logo),
  - nueva pantalla administrativa `frontend/auspiciantes.html` + `frontend/js/auspiciantes.js`.
- Reporteria con membrete + pie de auspiciantes:
  - reportes financieros (recibo, estado de cuenta, morosidad, movimientos) ahora generan encabezado con membrete del campeonato/organizador,
  - recibo de pago ajustado segun observacion operativa (titulo centrado, sin subtitulo redundante, mas espacio para firmas),
  - pie de reportes financieros incorpora logos de auspiciantes activos,
  - plantillas de `Grupos` y `Fixture` ahora muestran logos de auspiciantes en pie para impresion/exportacion.

### 2026-02-19
- Correccion de bug critico en planillaje de pagos:
  - los campos `Tarjetas amarillas (pago)` y `Tarjetas rojas (pago)` ahora son independientes por equipo (local/visitante),
  - se elimino el comportamiento espejo que copiaba automaticamente el valor de un equipo al otro.
- Planillaje financiero por equipo extendido:
  - frontend usa nuevos campos separados:
    - `pago_ta_local`, `pago_ta_visitante`,
    - `pago_tr_local`, `pago_tr_visitante`,
  - backend persiste estos campos en `partido_planillas` manteniendo compatibilidad con columnas globales previas (`pago_ta`, `pago_tr`).
- Confirmacion funcional de criterio operativo:
  - los totales de tarjetas ubicados bajo nomina (`Tarjetas amarillas/rojas`) se mantienen como conteo deportivo/Fair Play,
  - pagos de tarjetas quedan exclusivamente en la seccion `Pagos y Observaciones`.
- Ajustes de reporte (vista y PDF) alineados a operacion:
  - bloque de pagos muestra importes por equipo (inscripcion, arbitraje, TA pago, TR pago),
  - bajo firma se mantienen dos filas por equipo (Tarjetas amarillas / Tarjetas rojas),
  - se elimino la linea compacta `TA | TR` para evitar ambiguedad.
- Planillaje migrado a flujo de captura directa estilo formulario oficial:
  - se elimino la dependencia operativa de seleccionar goleador/tarjeta fila por fila,
  - ahora el ingreso principal se hace por jugador (columnas `G`, `TA`, `TR`) para local y visitante.
- Marcador automatico integrado al formulario:
  - `Goles Local` y `Goles Visitante` se calculan por suma de goles ingresados en la tabla de jugadores,
  - los resultados se envian al backend dentro del mismo payload de guardado.
- Formulario de planilla redisenado con estructura tipo planilla impresa (segun referencia):
  - cabecera con organizador, tipo de futbol, logos y metadatos del partido,
  - bloque visual de faltas para futbol 7/5/sala,
  - seccion de captura por jugador en dos tablas (local/visitante),
  - footer por equipo con resumen de tarjetas, director tecnico y pagos.
- Exportacion e impresion:
  - nuevo boton `Exportar PDF` que imprime directamente el formulario oficial,
  - `Imprimir Vista Previa` mantiene impresion de la vista previa alternativa,
  - estilos de impresion separados por modo (`print-planilla-form` / `print-planilla-preview`).
- Vista previa oficial mejorada y mantenida:
  - pestañas de vista previa: `Formato PDF` y `Resumen Anterior`,
  - la vista anterior se mantiene como respaldo para comparacion y continuidad.
- Backend ajustado para soportar cabecera oficial de planilla:
  - `backend/models/Partido.js` ahora incluye en `obtenerPlanilla`:
    - `max_jugador`,
    - `campeonato_organizador`,
    - `campeonato_logo_url`.
- Se mantiene exportacion XLSX oficial ya implementada previamente, alineada con `templates/PlanillaJuego.xlsx`.

### 2026-02-18
- Modulo financiero base implementado (backend + frontend):
  - nueva migracion `database/migrations/006_finanzas_cuenta_corriente.sql`,
  - nueva API `api/finanzas` con endpoints:
    - `GET /api/finanzas/movimientos`
    - `POST /api/finanzas/movimientos`
    - `GET /api/finanzas/equipo/:equipo_id/estado-cuenta`
    - `GET /api/finanzas/morosidad`
  - nuevo modelo/controlador/rutas en backend:
    - `backend/models/Finanza.js`
    - `backend/controllers/finanzaController.js`
    - `backend/routes/finanzaRoutes.js`
  - nueva pantalla administrativa `frontend/finanzas.html` + `frontend/js/finanzas.js` para:
    - registrar cargos/abonos,
    - consultar movimientos,
    - revisar morosidad por equipo,
    - ver estado de cuenta detallado.
- Navegacion global del admin actualizada para incluir `Finanzas` en sidebar mediante `frontend/js/core.js`.
- Importacion masiva de jugadores habilitada de extremo a extremo:
  - backend: endpoint `POST /api/jugadores/importar-masivo`,
  - frontend: botones `Descargar Plantilla` e `Importar Archivo` en `jugadores.html`,
  - parser en `frontend/js/jugadores.js` para `.xlsx/.xls/.csv` con normalizacion de encabezados comunes.
- Plantilla oficial de carga de jugadores disponible para equipos:
  - archivo `.xlsx` con hoja `Datos` (columnas esperadas) y hoja `Instrucciones`,
  - validaciones previas en cliente (nombre, apellido, cedidentidad) antes de enviar.
- Resumen de importacion implementado:
  - total de filas leidas/enviadas/creadas/errores,
  - vista rapida de errores detectados por backend.
- Exportacion e impresion de nomina de jugadores:
  - nueva plantilla visual de nomina por equipo en `jugadores.html`,
  - acciones `Imprimir Nomina` y `Exportar Nomina PDF`.
- Soporte documental en importacion de jugadores:
  - plantilla de carga agrega `foto_cedula_url` y `foto_carnet_url`,
  - backend valida documentos requeridos del campeonato tambien en importacion masiva.
- Carnets de jugadores (base funcional):
  - nuevo ajuste de campeonato `genera_carnets` (crear/editar),
  - vista de carnets por equipo en modulo jugadores,
  - exportacion PDF e impresion de carnets desde plantilla predefinida.
- Ajuste UX en `jugadores.html`:
  - barra principal simplificada (accion primaria `Nuevo Jugador`),
  - nuevo bloque ordenado `Reportes e Importaciones`,
  - acciones habilitadas solo con contexto seleccionado (campeonato/categoria/equipo).
- Navegacion por pestanas en modulo de jugadores:
  - nueva pestana `Jugadores` y nueva pestana `Reportes e Importaciones`,
  - evita scroll largo para llegar a reportes/importaciones.
- Mejoras de visualizacion en listados principales:
  - `campeonatos`, `equipos` y `jugadores` ahora tienen selector de vista `Tarjetas / Tabla`,
  - preferencia guardada por modulo en `localStorage`,
  - en vista tabla se mantienen acciones clave (editar, eliminar, navegar) en columna final.
- Vista dual extendida a otros modulos:
  - `eventos` y `partidos` tambien tienen selector `Tarjetas / Tabla`,
  - filtros, acciones y flujo de fixture se mantienen sin cambios funcionales.
- Checkpoint Git de interfaz:
  - consolidado el cambio de visualizacion dual en modulos administrativos para evitar scroll extenso,
  - se mantiene preferencia de vista por modulo para continuidad de uso.
- Importacion documental avanzada:
  - nuevo flujo `ZIP + mapeo por cédula` para cargar foto de cédula/carnet en lote,
  - deteccion de tipo de documento por nombre de archivo (`cedula` / `carnet`) y asignacion automatica a jugador.

### 2026-02-17
- Se alinearon endpoints y compatibilidades de `partidos`:
  - Generacion de fixture por evento (grupos y todos contra todos).
  - Rutas de compatibilidad para frontend anterior.
  - Registro de resultados y resultados con shootouts.
- Se agregaron metodos faltantes en `backend/models/Partido.js` para evitar errores de ejecucion:
  - fixture por evento (modo auto/grupos/todos),
  - consultas por campeonato/jornada,
  - estadisticas por equipo,
  - resultado con shootouts.
- Se agrego compatibilidad por campeonato en `grupos`:
  - rutas y controladores para `GET /grupos/campeonato/:id` y `/completo`.
- Se corrigio UX visual global en admin:
  - espaciados y distribucion de contenedores/botones,
  - consistencia de tarjetas entre `admin`, `campeonatos`, `eventos`,
  - mejora de layout responsivo en dashboard y listados.
- Se ajusto layout de equipos:
  - 1 columna movil (<=768px),
  - 2 columnas base,
  - 3 columnas en pantallas grandes,
  - 4 columnas en pantallas muy grandes.
- Se separo codigo inline del portal:
  - estilos a `frontend/css/portal.css`,
  - scripts a `frontend/js/portal.js`.
- Se corrigio carga de logos en portal y campeonatos:
  - normalizacion de `logo_url` para rutas relativas/absolutas,
  - eliminacion del error 404 por resolucion incorrecta de URL.
- Se mejoro seguridad/configuracion DB:
  - `backend/config/database.js` ahora usa variables de entorno.
  - se agrego `backend/.env.example`.
- Se corrigio `database/esquema.sql`:
  - eliminada definicion duplicada de tabla `partidos`,
  - limpiado error estructural asociado.
- Se corrigio modulo de sorteo (flujo por categoria/evento):
  - se alineo `sorteo.html` con `sorteo.js` (IDs y funciones),
  - se agrego selector de categoria (evento),
  - se removio script inline duplicado que generaba conflictos,
  - se implemento flujo funcional de sorteo:
    - creacion de grupos por evento,
    - asignacion automatica,
    - asignacion con cabezas de serie,
    - modo manual con ruleta y asignacion de equipo seleccionado,
  - se corrigio el error `Cannot set properties of null (innerHTML)` y `iniciarSorteo is not defined`.
- Se mejoro modulo de equipos:
  - numeracion visual de equipos en listado,
  - resumen con cantidad de equipos inscritos por categoria,
  - boton `Ir a Sorteo` que abre `sorteo.html` con campeonato y categoria preseleccionados.
- Se reforzo backend de grupos:
  - validacion de pertenencia del equipo al evento mediante tabla pivote `evento_equipos` (en lugar de `equipos.evento_id`).
- Se mejoro la experiencia del sorteo manual:
  - ruleta con etiquetas por equipo, mejor contraste de texto y seleccion final sincronizada con la flecha,
  - mejor distribucion de botones de accion de ruleta en desktop y movil.
- Se corrigio flujo `Sorteo -> Ver grupos`:
  - `gruposgen.js` ahora soporta contexto por `evento` desde URL,
  - carga grupos por endpoint de evento cuando corresponde,
  - exportaciones (PNG/PDF/compartir) nombran archivo por evento cuando aplica,
  - cabecera del poster muestra tambien la categoria en contexto.
- Ajustes UX adicionales en sorteo:
  - nombres en ruleta orientados a lo largo del segmento para mejor lectura,
  - boton `Ver grupos` movido junto a controles de configuracion y visible solo cuando el sorteo ya finalizo.
- Correccion backend para plantilla de grupos por campeonato:
  - consultas por campeonato ahora recuperan grupos mediante `eventos.campeonato_id` (antes consultaban `grupos.campeonato_id`, que quedaba vacio en el flujo actual por evento).
- Ajustes responsive de plantilla de grupos (`grupos.css`):
  - poster adaptativo con tipografia y espaciado con `clamp`,
  - mejor centrado del bloque de titulo en pantallas grandes,
  - columnas y nombres de equipos menos sobredimensionados en pantallas amplias.
- Modulo de partidos mejorado:
  - corregido error `generarFixtureEvento is not defined` en `partidos.html/js`,
  - agregado filtro por jornada en UI,
  - agregada plantilla visual de fixture (agrupada por jornada y grupo),
  - agregado exportar fixture en PNG y PDF.
- Continuacion visual y funcional de fixture:
  - la plantilla de fixture ahora usa estilo tipo poster igual al modulo de grupos (logo organizador, encabezado completo y datos de categoria),
  - integracion de `partidos.html` con `grupos.css` para mantener lenguaje visual consistente,
  - cabecera de fixture alimentada por evento + campeonato (nombre, organizador, tipo, fechas y logo),
  - distribucion de columnas de jornada adaptable por tamano de pantalla,
  - filtros de visualizacion por grupo, jornada y fecha.
- Mejora de navegacion en plantilla de fixture:
  - agregadas pestanas de vista: `Todos`, `Por Grupo`, `Por Jornada`.
- Ajuste de formato de fecha en partidos/fixture:
  - cuando el backend retorna fecha ISO (`2026-04-11T05:00:00.000Z`), se muestra solo la parte de fecha (`2026-04-11`) sin el bloque de hora/UTC.
- Reorganizacion de pantalla de partidos:
  - la vista principal mantiene cards de partidos,
  - la plantilla poster de fixture se movio a un bloque acordeon para no saturar la pagina,
  - se agrego boton para abrir la plantilla en pantalla dedicada `fixtureplantilla.html` con filtros actuales.
- Ajuste UX solicitado en `partidos.html`:
  - reemplazo del acordeon por pestanas principales: `Filtrar Partidos` y `Plantilla Fixture`,
  - `Buscar` queda visualmente separado del bloque `Generacion de Fixture`,
  - checkboxes de configuracion alineados correctamente con sus labels.
- Correccion adicional de alineacion en `Generacion de Fixture`:
  - se encapsularon opciones en `fixture-generation-options` para orden vertical estable,
  - se forzo estilo de checkbox (`width:auto`, sin padding/border globales) para evitar desalineado por reglas generales de `input`,
  - se agrego accion rapida `Volver a Cards` desde la pestana de plantilla para editar partidos sin friccion.
- Correccion backend en edicion de partidos:
  - `backend/models/Partido.js` ahora detecta automaticamente la columna de timestamp de actualizacion en la tabla `partidos` (`updated_at` o `update_at`),
  - las operaciones `actualizar`, `actualizarResultado` y `actualizarResultadoConShootouts` ya no fallan por diferencia de nombre de columna entre entornos.
- Ajuste UX en tarjetas de equipos (`equipos.html`):
  - encabezado de card reestructurado (indice + logo + titulo) para evitar cortes raros de nombre,
  - titulo con salto de linea balanceado y alineacion consistente en nombres largos,
  - eliminado estilo inline del logo para que el tamano dependa de CSS unificado.
- Modulo `Tablas/Estadisticas` habilitado por evento:
  - backend `tablaController` reescrito para esquema actual por `evento` (sin dependencia de `grupos.campeonato_id`),
  - nuevos endpoints:
    - `GET /api/tablas/evento/:evento_id/posiciones`
    - `GET /api/tablas/evento/:evento_id/goleadores`
    - `GET /api/tablas/evento/:evento_id/tarjetas`
    - `GET /api/tablas/evento/:evento_id/fair-play`
  - compatibilidad mantenida para portal/legacy:
    - `GET /api/tablas/grupo/:grupo_id`
    - `GET /api/tablas/campeonato/:campeonato_id`
- Frontend `tablas.html` + `frontend/js/tablas.js` implementado:
  - filtro por evento y busqueda,
  - pestanas de vista: Posiciones, Goleadores, Tarjetas y Fair Play,
  - render de tablas en UI con estados vacios y mensajes utiles cuando no hay datos.
- Estilos globales agregados en `frontend/css/style.css` para `page-tablas`:
  - contenedor con `max-width` estable en desktop,
  - tablas responsive con scroll horizontal controlado en movil/tablet.
- Flujo equipos -> jugadores mejorado:
  - agregado boton `Jugadores` en cada card de equipo para navegar con contexto de campeonato/categoria.
- Gestion documental de jugadores por campeonato:
  - `campeonatos.html/js` ahora guarda y edita:
    - `requiere_foto_cedula`
    - `requiere_foto_carnet`
  - `jugadores.html/js` ahora permite cargar:
    - foto de cedula,
    - foto carnet,
    - y valida requisitos segun configuracion del campeonato.
- Planilla de juego por partido implementada:
  - nueva pantalla `frontend/planilla.html`,
  - nuevo script `frontend/js/planilla.js`,
  - integrada desde `partidos` con boton `Planilla` por card.
  - permite registrar:
    - resultado/estado,
    - goleadores,
    - tarjetas,
    - pagos (arbitraje/local/visitante),
    - observaciones.
  - exportacion de planilla en `.xlsx`.
- Backend de planilla consolidado para UI:
  - `Partido.obtenerPlanilla` ahora devuelve:
    - requisitos documentales del campeonato,
    - planteles con URLs de foto de cedula/carnet.
- Navegacion y flujo directo de jugadores mejorado:
  - agregado item global `Jugadores` en el menu lateral de modulos administrativos,
  - `jugadores.html` ahora soporta modo directo (sin venir desde equipos):
    - selector de campeonato,
    - selector de categoria/evento,
    - selector de equipo,
    - carga de jugadores por seleccion.
- Exportacion XLSX de planilla alineada al formato oficial:
  - `frontend/js/planilla.js` ahora exporta sobre `frontend/templates/PlanillaJuego.xlsx` (sin hojas genericas nuevas),
  - se completa automaticamente la hoja correcta segun `tipo_futbol` (`FUTBOL 11` o `FUTBOL 7/5/SALA`),
  - se rellenan datos de partido, equipos, resultado, planteles, goles, tarjetas, pagos y observaciones en las celdas del template,
  - se llena tambien `LISTAJUGADORES` con el plantel local.
- Vista previa en pantalla de planilla oficial:
  - `frontend/planilla.html` incorpora boton `Vista Previa` y panel dedicado,
  - `frontend/js/planilla.js` renderiza una maqueta visual tipo formato de impresion (encabezado, score, planteles, goles/tarjetas, pagos, observaciones),
  - la vista previa se actualiza en vivo al cambiar cualquier campo del formulario o filas de eventos.
- Planillaje directo y navegacion independiente:
  - `planilla.html` ahora permite acceso directo sin depender de tarjetas:
    - selector de evento,
    - selector de jornada,
    - selector de partido,
    - carga de planilla con boton dedicado.
  - se agrego item de menu lateral `Planillaje` en modulos admin para entrada directa.
- Impresion directa desde planilla:
  - nuevo boton `Imprimir` en acciones principales y en la barra de vista previa,
  - estilos `@media print` para imprimir el formato visual de la planilla (sin sidebar ni formularios).
- UX de modales mejorada (centrado global):
  - correccion en `frontend/js/core.js` para abrir modales con `display:flex` (antes `block`, causando apertura en esquina),
  - bloqueo de scroll del body mientras hay modal abierto (`body.modal-open`),
  - ajuste de `frontend/css/style.css` para mayor ancho util y mejor espaciado en modales con `h3 + form`.
  - los modales ya no se cierran al hacer click fuera; cierre solo por accion explicita (`X`, boton cancelar o `cerrarModal(...)`).
- Ajustes backend para soporte de exportacion oficial:
  - `backend/models/Partido.js` incluye `tipo_futbol`, `campeonato_nombre`, `evento_nombre` y director tecnico local/visitante en `obtenerPlanilla`,
  - `obtenerPlanilla` ahora retorna `cedidentidad` en planteles para alimentar `LISTAJUGADORES`.
- Documento de control de alcance actualizado:
  - nuevo archivo `docs/ESTADO_IMPLEMENTACION_SGD.md` con matriz:
    - modulo vs estado real (hecho/parcial/pendiente),
    - pendientes prioritarios (financiero, roles, eliminatorias, auditoria).

## En Curso
- Pruebas reales de operacion en planillaje y finanzas para cerrar ultimos bugs de consistencia contable.
- Pulido visual final de planillaje oficial (alineaciones finas, espacios y ajustes de impresion en distintos tamanos de papel).
- Ajustes UX finales en finanzas para pantallas pequenas (<= 1366 px) sin perder densidad de informacion.

## Pendientes Prioritarios
- Ejecutar pruebas end-to-end con datos reales (validar que todo el flujo quede estable).
- Validar en operacion real:
  - eliminacion manual por causal,
  - clasificacion manual con sugerencia,
  - generacion de playoff con equipos sustituidos manualmente.
- Consolidar autenticacion y roles (RBAC) minimo.
- Completar alta/edicion de usuario organizador con campos de perfil:
  - alinear `usuarios.html` con los datos base usados por `Mi Landing`,
  - nombre de la organizacion,
  - logo de la organizacion,
  - contacto minimo.
- Habilitar en el portal del organizador la gestion de usuarios internos:
  - crear usuarios con rol dirigente,
  - crear usuarios con rol tecnico.
- En formulario de registro desde cards de planes pagados, agregar:
  - nombre de la organizacion (obligatorio),
  - logo (opcional),
  - lema (opcional).
- Implementar flujo de cobro/pasarela para planes pagados:
  - seleccionar plan,
  - registrar organizador con datos de organizacion,
  - continuar a formulario/pantalla de cobro y confirmacion de pago.
- Revisar y ordenar archivos legacy/antiguos para reducir deuda tecnica.
- Continuar modulo financiero: sanciones/suspensiones por reglas deportivas, bloqueos por morosidad y reportes ejecutivos.
- Ajustar detalles de UX del nuevo formulario de planilla segun retroalimentacion de operacion en campo.
- Completar visibilidad de disciplina fuera de la planilla:
  - ya visible en `jugadores.html`,
  - ya disponible reporte/listado de sanciones por categoria/equipo/jugador,
  - pendiente extender la disciplina a otros reportes operativos.
- Completar carga inicial del disco persistente de `uploads` en Render con el contenido historico local antes de validar logos/fotos/documentos en produccion.
- Ejecutar migracion `031_usuarios_cambio_password_obligatorio.sql` en todos los entornos antes de probar el nuevo flujo de cambio obligatorio de contraseña.
- Validar en produccion Render:
  - carga real de logos/fotos/documentos desde el disco persistente,
  - reimpresion de carnets usando jugadores con foto existente.
- Validar visualmente el nuevo `fondo de carné` en:
  - vista previa,
  - impresion,
  - exportacion PDF,
  para confirmar opacidad/mezcla adecuados con logo y colores.
- Verificar en operacion real de campo la captura directa de foto desde celular para:
  - foto de cedula,
  - foto de jugador/foto carnet.
- Validar visualmente portal publico en produccion/local:
  - listado general sin campeonatos administrativos,
  - inclusion correcta de torneos `borrador` / `inscripcion` del organizador,
  - detalle por campeonato con tabs de categorias,
  - subtabs deportivas correctas por categoria,
  - tablas de posiciones en `2 columnas` desktop / `1 columna` movil.
- Reorientar plan mobile a aplicacion instalable para tiendas:
  - app Android (Play Store),
  - app iOS (App Store).

## Actualizacion 2026-03-10 (Portal publico compartible)
- Se enriquecio el listado publico de campeonatos con `categorias_resumen` para mostrar en cada card:
  - nombre de categoria,
  - cantidad de equipos por categoria.
- Se habilito vista publica compartible por campeonato en `portal.html?campeonato=<id>`:
  - header completo,
  - detalle del campeonato,
  - tabs por categoria,
  - subtabs deportivas (`Tabla de posiciones`, `Goleadores`, `Fair Play`, `Tarjetas amarillas`, `Tarjetas rojas`, `Playoff`),
  - seccion de auspiciantes,
  - footer institucional.
- Se agrego endpoint publico para auspiciantes del campeonato:
  - `GET /api/public/campeonatos/:campeonato_id/auspiciantes`
- La landing publica del organizador ahora tambien entrega `categorias_resumen`, manteniendo consistencia entre:
  - `index.html?organizador=<id>`
  - `portal.html?campeonato=<id>&organizador=<id>`

## En Curso
- Validacion visual del detalle compartible del portal en produccion (`portal.html?campeonato=<id>`), incluyendo auspiciantes, tabs y subtabs por categoria.
- Continuidad del hardening de despliegue Render:
  - carga historica de `uploads`,
  - verificacion real de logos, fotos y documentos.
- Validar en operacion real la nueva `plantilla balanceada 8vos` y la opcion `tercer y cuarto puesto` con datos de campeonato activo.

## Actualizacion 2026-03-12 (Tabla acumulada, foto carné y planilla del jugador)
- Se incorporo el tipo visible de competencia `tabla acumulada` para categorias/eventos:
  - pensado para grupos + clasificacion global por rendimiento,
  - soportado en `eventos`, `tablas`, `eliminatorias` y payloads del portal publico,
  - reutilizando la logica ya existente de `tabla_unica` sin tocar `backend/models/Eliminatoria.js`.
- Se agrego migracion formal:
  - `database/migrations/037_eventos_clasificacion_tabla_acumulada.sql`
- Se aplico/verifico en BD local:
  - columna `eventos.clasificacion_tabla_acumulada`.
- Se mejoro el ajuste de foto para carné en `jugadores.html`:
  - zoom `+/-`,
  - control direccional arriba/abajo/izquierda/derecha,
  - persistencia del zoom del jugador,
  - reubicacion del bloque informativo de `foto carné cargada` debajo del panel de ajuste.
- Se agrego migracion formal:
  - `database/migrations/038_jugadores_foto_carnet_zoom.sql`
- Se aplico/verifico en BD local:
  - columna `jugadores.foto_carnet_zoom`.
- Se implemento `Planilla del jugador` dentro de reportes:
  - selector individual,
  - vista previa,
  - impresion,
  - exportacion PDF,
  - acceso directo desde cards/listado del jugador.
- Se ajustaron cards:
  - equipos con nombre a la izquierda y logo a la derecha,
  - jugadores con layout mas ordenado en metadata/documentos.
- Se redujo visualmente la marca `ELIMINADO` en tablas internas y portal publico.
- Se agrego `Polifuncional` como posicion disponible para:
  - formulario de jugadores,
  - planilla/manual de jugador.
- Render / produccion:
  - las migraciones `037` y `038` quedaron versionadas en repo,
  - el backend ya incorpora endurecimiento de esquema para crear esas columnas al usar modulos de `eventos` / `jugadores` tras el redeploy,
  - pendiente ejecutar migracion formal directa sobre la BD de Render cuando se disponga de la cadena/console operativa del servicio.

## Checklist de Pruebas Siguiente Sesion
1. Crear/seleccionar campeonato y evento.
2. Registrar y asignar equipos al evento.
3. Generar grupos y validar distribucion.
4. Generar fixture por evento.
5. Registrar resultados.
6. Revisar tablas por grupo y portal publico.
7. Validar eliminatorias (si aplica al evento probado).

## Regla de Mantenimiento de Esta Bitacora
- Al cerrar cada sesion:
  - actualizar fecha de "Ultima actualizacion",
  - agregar bloque con cambios del dia,
  - marcar estado en "En Curso" y "Pendientes".

## 2026-03-15 - Ajuste de tabla manual derivada
- Se corrigio la edicion manual de `tablas.html` para que:
  - `PTS` ya no quede congelado ni dependa de un valor escrito manualmente,
  - `PJ` se derive automaticamente de `PG + PE + PP`,
  - `DG` siga derivandose de `GF - GC`,
  - la posicion se reordene en vivo con esos valores recalculados.
- El backend (`backend/controllers/tablaController.js`) ahora recalcula nuevamente `PTS` y `PJ` al guardar, para mantener consistencia entre local y Render aunque el navegador envie datos viejos.
- El frontend (`frontend/js/tablas.js`) marca `PJ` y `PTS` como campos derivados para evitar inconsistencias durante la correccion manual de la tabla.

## 2026-03-15 - Cierre de estabilidad tablas publicas / portal
- Se corrigio la regresion que rompia `tablas` y `playoff` publicos con el error:
  - `ReferenceError: sistema is not defined`
- La funcion `generarTablasEventoInterna()` del backend ya devuelve nuevamente:
  - tablas publicas por evento,
  - clasificacion usada por eliminatorias,
  - resumen de clasificacion manual para playoff.
- Se verifico localmente que vuelven a responder correctamente:
  - `GET /api/public/eventos/:id/tablas`
  - `GET /api/public/eventos/:id/eliminatorias`
- Render quedo alineado con el fix publicado en `origin/main`.

## Pendiente inmediato siguiente sesion
- Validar con un campeonato real de 24 clasificados la nueva plantilla `Mejores perdedores (24 -> 12vos -> 8vos)`.
- Confirmar con operacion real si el criterio de emparejamiento en `8vos` queda aprobado asi:
  - `W12-1 vs MP4`
  - `W12-2 vs MP3`
  - `W12-3 vs MP2`
  - `W12-4 vs MP1`
  - resto de cruces entre ganadores de `12vos`.
- Si el cliente pide un formato adicional para `20`, `12` u otros cupos no potencia de 2, ampliar esta misma plantilla a un modo mas general.

### 2026-03-17 (sesión 4)
- Fixture / gestión avanzada — corrección de regresión y nuevas herramientas:

  **Fix regenerarFixturePreservandoJugados (`backend/models/Partido.js`):**
  - El bug eliminaba partidos `programado` (con fecha asignada), destruyendo jornadas ya calendarizadas al regenerar tras ingresar un equipo nuevo.
  - Corrección: el DELETE ahora elimina SOLO partidos con `estado IS NULL OR estado = 'pendiente'`.
  - Se preservan: `programado`, `finalizado`, `no_presentaron_ambos`, `suspendido`, `aplazado`, `en_curso`.
  - `maxJornadaJugada` ahora toma el máximo sobre TODOS los estados preservados (no solo finalizado).
  - Las queries de `pairsJugados` (pares ya existentes) también incluyen los estados preservados para no regenerar enfrentamientos que ya existen en cualquier estado activo.
  - Efecto: si un equipo nuevo ingresa con Jornada 1 ya programada, esa jornada queda intacta y el nuevo equipo descansa automáticamente.

  **Estado manual de partidos (`backend/controllers/partidoController.js` + `frontend/js/partidos.js`):**
  - Backend: `actualizarPartido` acepta campo `estado` explícito (pendiente/programado/suspendido/aplazado/en_curso).
  - Si se envía `estado` explícito tiene precedencia sobre la auto-transición por fecha.
  - Frontend: formulario "Editar partido" incluye selector de Estado con 5 opciones.

  **Badge de estado en card de partido (`frontend/js/partidos.js`):**
  - Nueva función `renderEstadoPartidoBadge(estado)`.
  - Cada card muestra el estado actual con badge de color: azul=programado, gris=pendiente, verde=finalizado, rojo=suspendido, naranja=aplazado, amarillo=en curso.

  **Equipo que descansa (bye) por jornada:**
  - Nueva función `calcularByesPorJornada(todosPartidos)` en `partidos.js`: compara equipos del universo del evento contra los que aparecen en cada jornada; detecta automáticamente el equipo que no juega.
  - Vista de cards en `partidos.html`: agrupa por jornada con encabezado y muestra `"Descansa: [equipo]"` en morado cuando aplica.
  - Fixture exportable (vista jornada y vista todos): muestra `"☾ DESCANSA: [equipo]"` al pie de cada jornada.
  - Portal público (`frontend/js/portal.js`): nueva función `calcularByesPortal(todosPartidos)`; cada tarjeta de jornada muestra `"🌙 Descansa: [equipo]"` al pie, con estilos en `portal.css`.
  - Estilos nuevos en `style.css`: `.badge-estado-partido`, `.fixture-jornada-bloque`, `.fixture-jornada-titulo`, `.fixture-bye-notice`, `.fixture-bye-linea`.

  **Crear partido manual (`frontend/partidos.html` + `frontend/js/partidos.js`):**
  - Nuevo botón "Crear Partido Manual" en la sección de Generación de Fixture.
  - Modal con: dropdown Equipo Local, dropdown Equipo Visitante (cargados de `/eventos/:id/equipos`), Jornada, Fecha, Hora, Cancha.
  - Validación: no permite mismo equipo en local y visitante.
  - POST a `POST /partidos/` con campeonato_id, evento_id y estado automático.
  - Útil para construir jornadas parciales antes de regenerar, o para partidos especiales fuera del round-robin.

  **Edición de equipos en partido (solo Administrador):**
  - `editarPartido()` detecta `window.Auth.getUser().rol`.
  - Si es `administrador`: carga equipos del evento y muestra dropdowns de Equipo Local/Visitante en el formulario "Editar".
  - Backend `actualizarPartido`: acepta `equipo_local_id` y `equipo_visitante_id` solo si `req.user.rol === 'administrador'`.

  **Commits de la sesión:**
  - `5bec42c` feat(fixture): preservar jornadas programadas al regenerar, estados de partido y bye por jornada
  - `20d6bb7` feat(portal): mostrar equipo que descansa (bye) por jornada en portal público
  - `48b08c1` feat(fixture): crear partido manual y edición de equipos por administrador

## Pendiente inmediato sesion 5 (2026-03-18)
- Plantillas de exportación (sección 14 del ESTADO_IMPLEMENTACION):
  - **A)** Carné individual: dropdown "Jugador:" en toolbar de carnés → `jugadores.html`
  - **B)** Fondo personalizado en export de fixture → `fixtureplantilla.html`
  - **C)** Plantilla exportable de jornada (`jornadadplantilla.html`) — logo equipos, fecha/hora/cancha, para compartir en redes
  - **D)** Fondo personalizado en export de grupos → `gruposgen.js`
- Validar en operación real:
  - bye/descansa en portal público con campeonato activo real
  - botón "Crear Partido Manual" con el fixture del campeonato de 11 equipos
  - edición de equipos en partido (botón Editar como administrador)
  - regenerar fixture tras crear J1 manualmente → verifica que Academia Pedro Larrea descanse en J1
- Validar plantilla `Mejores perdedores (24 -> 12vos -> 8vos)` con campeonato real de 24 clasificados.

## 2026-03-20 - Portal playoff y plantilla publicable unificada
- Se amplió la carga pública de eliminatorias para que cada cruce exponga también su programación enlazada desde `partidos`:
  - `estado`
  - `fecha_partido`
  - `hora_partido`
  - `cancha`
  - `jornada`
  - `numero_campeonato`
- La pestaña pública `Playoff` del portal ya muestra esa metadata por encuentro cuando el cruce tiene partido operativo asociado.
- El módulo interno de `eliminatorias.html` se reorganizó en pestañas independientes:
  - `Configuración de llave`
  - `Estado competitivo`
  - `Clasificación manual`
  - `Playoff / Llave`
- La programación manual y la auto-programación de playoff ahora se trabajan en overlays reales tipo modal:
  - fondo oscurecido
  - cierre por `Esc`
  - cierre por click fuera
  - foco automático al abrir
- Se agregó el botón `Plantilla para publicar` junto a `Auto-programar fechas` para abrir/cerrar la vista exportable del playoff sin perder el contexto de la llave.
- La vista interna de `Playoff / Llave` ahora presenta:
  - `Final` en la columna central
  - `Tercer y cuarto` debajo de `Final`
  - tarjetas de tercer puesto más compactas
  - rounds en horizontal, no apilados verticalmente
- La plantilla exportable/publicable del playoff para el caso principal `8vos -> 4tos -> semifinal -> final` se rediseñó para seguir el mismo lenguaje visual del borrador:
  - layout horizontal de 7 columnas
  - fondo claro con grilla
  - tarjetas azules compactas
  - local arriba / `vs` / visitante abajo
  - logos de equipos dentro de cada nodo
  - `Final` centrada
  - `Tercer y cuarto` debajo de `Final`
- Se ajustó también la vista previa para que use el mismo esquema del arte final, evitando que la publicación se vea completamente distinta al borrador.

## Pendiente inmediato siguiente sesión
- Validar visualmente en Render la exportación `PNG/PDF` de la nueva plantilla de playoff para confirmar:
  - conectores
  - anchos finales de tarjetas
  - tamaño real de logos
  - legibilidad en móvil y escritorio
- Si el organizador lo solicita, refinar aún más el arte de conectores del playoff para acercarlo al estilo TV/gráfico compartido, manteniendo la estructura ya estabilizada.

## 2026-03-21 - Afinado visual de plantilla publicable del playoff
- La plantilla publicable `8vos -> 4tos -> semifinal -> final` se afinó para acercarse más al arte de referencia sin perder exportabilidad estable:
  - los nodos ya muestran solo `logo + nombre local`, `vs`, `nombre visitante + logo`, sin etiquetas internas tipo `8VO P1` ni sembrados `1A/4C`,
  - los títulos de ronda (`Octavos`, `Cuartos`, `Semifinal`, `Final`) se ubican sobre cada bloque de columnas,
  - el lado derecho ya alinea logos y texto desde la derecha para espejar el lado izquierdo.
- Se agregó personalización de fondo en `Plantilla para publicar`:
  - carga de imagen local,
  - persistencia por `campeonato + categoría` en `localStorage`,
  - botón para quitar el fondo,
  - overlay claro/oscuro compatible con exportación `PNG/PDF`.
- Los auspiciantes de la plantilla publicable ya no se deforman:
  - caja fija,
  - `object-fit: contain`,
  - padding y fondo estables.
- Los conectores del layout especial ahora se redibujan también justo antes de capturar/exportar, con doble trazo para ganar legibilidad sobre fondos personalizados.
- El ancho de columnas del bracket especial ahora se calcula dinámicamente según el string más largo de cada ronda, evitando que los cuadros queden demasiado estrechos o que el texto fuerce cortes innecesarios.
- `Tercer y cuarto` quedó como subbloque compacto real:
  - más pequeño,
  - centrado debajo de `Final`,
  - con reserva de espacio propia para no salirse del lienzo en la vista previa/exportación.

## 2026-03-21 - Fondo personalizado en exportación de fixture y grupos
- Se cerró el pendiente de publicación visual para `fixtureplantilla.html` y `gruposgen.html`:
  - ahora ambas vistas permiten cargar una imagen local como fondo del poster,
  - el fondo queda guardado en `localStorage` por contexto (`campeonato + evento`),
  - se puede limpiar con botón `Quitar fondo`.
- La exportación `PNG/PDF` de fixture y grupos ya respeta el fondo personalizado:
  - se retiró el `backgroundColor` fijo de `html2canvas`,
  - el poster conserva su propia capa visual durante la captura.
- La implementación reutiliza el mismo enfoque de playoff:
  - overlay por tema para mantener legibilidad,
  - imagen de fondo aplicada vía CSS variable,
  - persistencia por clave específica del contexto publicado.
- En grupos también se corrigió el markup del selector de tema/fondo para evitar comillas tipográficas inválidas en el HTML.

## Pendiente inmediato siguiente sesión
- Completar el bloque restante de plantillas de exportación:
  - dropdown `Jugador:` para carné individual
  - plantilla exportable de jornadas (`jornadasplantilla.html`) con arte listo para redes
- Validar visualmente en producción:
  - fixture con fondo personalizado
  - grupos con fondo personalizado
  - contraste de textos/logos sobre fondos cargados por el usuario

## 2026-03-22 - Landing del organizador con bienvenida a equipos y categorías juveniles
- Se incorporó un nuevo bloque público en la landing del organizador para dar la bienvenida a los equipos participantes:
  - título personalizado,
  - descripción personalizada,
  - imagen de bienvenida,
  - listado de equipos participantes visibles por campeonato.
- La configuración quedó integrada en `organizador-portal.html` y se guarda dentro de `organizador_portal_config`:
  - `equipos_bienvenida_titulo`
  - `equipos_bienvenida_descripcion`
  - `equipos_bienvenida_imagen_url`
- El landing público del organizador ahora expone `equipos_participantes` por campeonato:
  - se deduplican nombres repetidos,
  - se conservan logos cuando existan,
  - la sección solo se muestra si realmente hay equipos visibles para ese organizador.
- Se agregó la migración `049_portal_bienvenida_equipos_y_categoria_juvenil.sql`, aplicada en la BD local:
  - nuevos campos de bienvenida para `organizador_portal_config`,
  - nuevo flag `categoria_juvenil` en `eventos`.

## 2026-03-22 - Carnés con fecha de nacimiento y edad para categorías juveniles
- En la creación/edición de categorías ahora existe el selector `Categoría juvenil`.
- Cuando una categoría está marcada como juvenil:
  - los carnés de jugadores muestran fecha de nacimiento,
  - muestran también la edad calculada,
  - el resto de categorías mantiene el formato actual sin ruido extra.
- El ajuste quedó implementado en:
  - `frontend/eventos.html`
  - `frontend/js/eventos.js`
  - `frontend/js/jugadores.js`
  - `backend/controllers/eventoController.js`

## 2026-03-22 - Plan inicial para transmisión de partidos
- Se dejó documentado el plan base para un nuevo servicio de transmisión operado por el organizador:
  - administración desde SGD,
  - visibilidad pública en el portal,
  - retransmisión a redes mediante proveedor especializado,
  - recomendación de MVP con OBS / StreamYard / Restream.
- Documento nuevo:
  - `docs/PLAN_TRANSMISION_PARTIDOS.md`

## 2026-03-22 - Render alineado con migración 049 y ajuste de refresh en landing
- Se ejecutó formalmente `049_portal_bienvenida_equipos_y_categoria_juvenil.sql` en PostgreSQL de Render.
- Verificación positiva en Render:
  - `organizador_portal_config.equipos_bienvenida_titulo`
  - `organizador_portal_config.equipos_bienvenida_descripcion`
  - `organizador_portal_config.equipos_bienvenida_imagen_url`
  - `eventos.categoria_juvenil`
- También se corrigió un comportamiento molesto del portal público:
  - al hacer `refresh` en `index.html`, ya no se reabre automáticamente el último torneo visto,
  - la portada principal solo abre detalle si `campeonato` o `evento` vienen explícitamente en la URL,
  - `portal.html` mantiene su comportamiento de contexto compartible sin afectar la landing.

## Pendiente inmediato siguiente sesión
- Validar en el portal público del organizador:
  - carga de imagen de bienvenida,
  - cards/listado de equipos participantes,
  - comportamiento con organizadores sin equipos visibles.
- Diseñar la Fase 1 operativa del servicio de transmisión:
  - modelo de datos definitivo,
  - endpoints mínimos,
  - primer flujo en panel del organizador.

## 2026-03-23 - Sincronización de fechas de campeonato a categorías heredadas
- Se corrigió la actualización de campeonatos para que, cuando cambien `fecha_inicio` o `fecha_fin`, las categorías/eventos del mismo campeonato que seguían heredando esas fechas también se sincronicen automáticamente.
- La sincronización es conservadora:
  - actualiza solo eventos que mantenían la fecha anterior del campeonato,
  - no pisa categorías que ya fueron ajustadas manualmente a otra fecha.
- Implementado en:
  - `backend/controllers/campeonatoController.js`

## 2026-03-23 - Fixture con selección explícita automático/manual
- En `partidos.html` se añadió la selección explícita del modo de programación:
  - `Programación automática (fecha/hora/cancha)`
  - `Programación manual (sin fecha/hora/cancha)`
- Si el organizador no selecciona ninguna opción, el sistema ahora bloquea la generación y muestra un modal explicativo.
- Si se elige `automática`:
  - programa todos los partidos que entren dentro de la ventana del evento,
  - deja los partidos restantes sin `fecha/hora/cancha`,
  - muestra un resumen indicando cuántos quedaron para edición manual.
- También quedó aplicado a `Regenerar (preservar jugados)`.
- Implementado en:
  - `frontend/partidos.html`
  - `frontend/js/partidos.js`
  - `backend/controllers/partidoController.js`
  - `backend/models/Partido.js`
  - `backend/services/mobileCompetitionService.js`

## 2026-03-23 - Entorno local realineado con producción
- Se hizo respaldo preventivo de la BD local en:
  - `database/backups/pre-render-sync-20260323-115731.custom.backup`
- Se instaló cliente PostgreSQL 18 para compatibilidad con Render.
- Se descargó un dump actualizado de Render en:
  - `database/backups/render-sync-20260323-133148.custom.backup`
- La BD local `gestionDeportiva` fue restaurada desde ese dump para trabajar con datos reales de producción.
- Verificación posterior:
  - `campeonatos: 9`
  - `eventos: 15`
  - `equipos: 138`
  - `partidos: 414`
  - `usuarios: 18`
- El `smoke` del backend pasó `9/9` contra `http://localhost:5000`.

## 2026-03-31 - Portal público: resultados parciales y rondas de playoff
- Se corrigió el portal público para que la subtab `Resultados` ya no dependa de jornadas completamente cerradas.
- Ahora los partidos ya jugados aparecen aunque la jornada siga parcial, siempre que tengan:
  - estado `finalizado` / `no_presentaron_ambos`, o
  - planilla pública guardada.
- También se normalizó el agrupamiento de bloques en fase eliminatoria:
  - ya no se muestra `Sin jornada` para partidos de playoff,
  - el portal agrupa y rotula por ronda (`Octavos`, `Cuartos`, `Semifinal`, `Final`, `Tercer y cuarto`, `Reclasificación`).
- Se reforzó el cruce de datos entre `partidos` y `eliminatorias` para que la pestaña `Playoff` publique correctamente:
  - estado,
  - fecha,
  - hora,
  - cancha,
  - número visible del partido,
  - logos de los equipos,
  - resumen de penales cuando aplica.
- Archivos ajustados:
  - `backend/services/publicPortalService.js`
  - `frontend/js/portal.js`

## Pendiente inmediato siguiente sesión
- Validar en Render con datos reales de oficina:
  - `Copa Ciudad de Loja -> Abierta`
  - campeonatos de terceros organizadores con jornadas parciales
- Confirmar visualmente en portal público:
  - `Resultados` con ronda de playoff en vez de `Sin jornada`,
  - `Playoff` con estado `Finalizado` en cruces ya jugados,
  - publicación consistente de fecha, hora, cancha y logos.
- Revisar si conviene replicar la misma normalización de rondas en cualquier vista pública adicional que consuma `partidos` sin pasar por `portal.js`.

## 2026-04-01 - Portal público: playoff legacy y jornadas solo activas
- Se corrigió el caso real detectado en `Copa Ciudad de Loja` donde categorías con partidos de playoff legacy seguían mostrando `Sin jornada` en el portal público.
- Ahora `frontend/js/portal.js` hace una coincidencia adicional por equipos cuando el partido público no trae `playoff_ronda` ni `partido_id` enlazado en el slot de eliminatoria:
  - intenta primero por `equipo_local_id` y `equipo_visitante_id`,
  - si no existen ids confiables, hace fallback por nombres normalizados.
- Con eso, rondas como `Octavos` ya se rotulan correctamente aunque producción tenga partidos heredados con `jornada = null`.
- También se ajustó la pestaña `Jornadas` del portal:
  - solo quedan activas jornadas/rondas que todavía tengan partidos sin resultado,
  - bloques completamente cerrados se siguen consultando desde `Resultados`,
  - si no hay ninguna jornada activa, el portal lo informa explícitamente.
- En backend se añadió una sincronización correctiva para eliminatorias enlazadas a `partidos`:
  - si el partido real ya está finalizado y tiene marcador o penales,
  - pero `partidos_eliminatoria` quedó sin `resultado_local`, `resultado_visitante` o `ganador_id`,
  - el sistema ahora recompone esos datos al consultar la llave y vuelve a propagar el clasificado a la siguiente ronda.
- Esto apunta al caso observado en `Master (Sub +40)`:
  - octavos ya finalizados con planilla,
  - cuartos todavía sin armar por datos stale en `partidos_eliminatoria`.
- Implementado en:
  - `frontend/js/portal.js`
  - `backend/models/Eliminatoria.js`
- Verificación realizada:
  - `node --check frontend/js/portal.js`
  - `node --check backend/models/Eliminatoria.js`
  - simulación contra payload público real de Render para `evento 8`, confirmando detección de `8vos` en partidos legacy sin jornada.

## 2026-04-01 - BD local realineada nuevamente con Render
- Se recibió y validó la `External Database URL` de Render.
- Primero se hizo respaldo preventivo de la BD local en:
  - `database/backups/pre-render-sync-20260401-103256.custom.backup`
- Se confirmó que producción ya estaba por delante de la copia local:
  - `campeonatos: 11`
  - `eventos: 16`
  - `equipos: 144`
  - `partidos: 422`
  - `usuarios: 25`
- El primer intento de dump con `pg_dump` 17 falló por incompatibilidad con PostgreSQL 18 de Render.
- Se repitió correctamente con cliente PostgreSQL 18 y se generó:
  - `database/backups/render-sync-20260401-173728.custom.backup`
- Luego se recreó la base local `gestionDeportiva` y se restauró ese dump limpio.
- Verificación final en local, ya alineada con Render:
  - `campeonatos: 11`
  - `eventos: 16`
  - `equipos: 144`
  - `partidos: 422`
  - `usuarios: 25`

## 2026-04-03 - Compactación final de planilla oficial y nueva realineación local
- Se compactó la `planilla` oficial tanto en vista previa como en PDF para soportar mejor partidos con planteles grandes, incluyendo el caso operativo de hasta `30` registros impresos.
- Ajustes aplicados en `frontend/js/planilla.js` y `frontend/css/style.css`:
  - menor espacio entre secciones,
  - bloque de marcador más pequeño,
  - nombres y logos de los equipos centrados en el marcador,
  - columnas `P/S`, `Entra` y `Sale` impresas como casillas en blanco más pequeñas y sin corchetes,
  - impresión/PDF limitada a filas realmente cargadas, sin arrastrar filas vacías.
- También se consolidó en el mismo cierre el ajuste previo de `backend/models/Eliminatoria.js` para mantener sincronizados los partidos operativos de playoff.
- El bloque completo se publicó en:
  - `commit 3783216`
  - mensaje: `feat: compact planilla print layout and playoff match sync`
- Antes de volver a probar en oficina se hizo una nueva realineación de la BD local con la base actual de Render.
- Respaldo preventivo de la BD local:
  - `database/backups/pre-render-sync-20260403-000331.custom.backup`
- Nuevo dump traído desde Render:
  - `database/backups/render-sync-20260403-000331.custom.backup`
- Verificación posterior a la restauración local:
  - `campeonatos: 11`
  - `eventos: 16`
  - `equipos: 144`
  - `partidos: 422`
  - `usuarios: 25`

## Pendiente inmediato siguiente sesión
- Hacer deploy en Render de los cambios de `portal.js` y `Eliminatoria.js`.
- Validar visualmente en producción:
  - `Copa Ciudad de Loja -> Abierta`: playoff rotulado por ronda y no como `Sin jornada`.
  - `Copa Ciudad de Loja -> Abierta`: pestaña `Jornadas` sin rondas de playoff cerradas activas.
  - `Copa Ciudad de Loja -> Master (Sub +40)`: octavos ya finalizados reflejados y cuartos armados automáticamente.
- Confirmar en `eliminatorias.html` y en el portal público que la propagación de ganadores ya quedó consistente tras el deploy.
- Ejecutar una revisión rápida con datos reales sobre:
  - `portal público`,
  - `resultados`,
  - `playoff`,
  - `planillas` ya registradas en cruces.
- Si aparece otro caso legacy sin `playoff_ronda`, revisar si conviene mover esta normalización a una capa compartida del backend público y no solo al enriquecimiento del frontend.


## 2026-04-07 - Correcciones de bugs y revisión sistema de transmisiones

### Bugs corregidos

1. **campeonatos.js — error de sintaxis crítico**
   - La edición del widget de pestañas deportivas fusionó accidentalmente el cierre de switchSportTab con la declaración const BACKEND_BASE = (, generando SyntaxError: Unexpected token '=' que rompía toda la página de campeonatos.
   - Corregido: } separado de const BACKEND_BASE.
   - Commit: 58cc57

2. **dashboard-admin.js — ruta PUT incorrecta para cambio de plan**
   - guardarEstadoOrg llamaba a /usuarios/:id sin el prefijo /auth/, produciendo Cannot PUT /api/usuarios/17.
   - Corregido a /auth/usuarios/:id.
   - Commit: 58cc57

3. **campeonatos.html — widget de pestañas de tipo deporte**
   - Reemplazado el <select> con <optgroup> por un widget de dos pestañas (⚽ Fútbol | 🏀 Básquetbol), cada una con su propio <select>.
   - Un <input type="hidden" id="campeonato-tipo"> mantiene el valor en sync para el submit.
   - En modo edición, switchSportTab activa la pestaña correcta según el tipo guardado.
   - Commit: ef2fd9

4. **PartidoTransmision.js — columna destacado faltante en CREATE TABLE**
   - El schema CREATE TABLE IF NOT EXISTS no incluía la columna destacado, que sí existe en la migración  62_transmisiones_destacado_borrador.sql.
   - Agregada como defensa en el modelo: se incluye en CREATE TABLE y se añade un bloque DO ___BEGIN___COMMAND_DONE_MARKER___$LASTEXITCODE con ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
   - Commit: 74db898

### Sistema de transmisiones — auditoría completa

Se auditó el sistema de transmisiones y se confirmó que está implementado al **95%** (Fase 1 y 2 del plan completas):

**Backend:**
- ackend/models/PartidoTransmision.js — modelo con CRUD, estado machine, destacados
- ackend/controllers/transmisionController.js — 10 funciones (create, update, iniciar, finalizar, cancelar, destacar, public/private)
- ackend/routes/transmisionRoutes.js — rutas autenticadas (/api/transmisiones)
- ackend/routes/publicRoutes.js — rutas públicas (/api/public/campeonatos/:id/transmisiones-activas, /api/public/transmisiones/destacadas)
- ackend/routes/partidoRoutes.js — integrado: GET/POST /api/partidos/:id/transmision
- Migrations:  61 (tabla base) y  62 (columna destacado + estado borrador)

**Frontend:**
- rontend/transmisiones.html — página de gestión con selector de campeonato y 3 tabs (Activas/Todas/Programadas)
- rontend/js/transmisiones.js — lógica completa de tabla, filtros, acciones
- rontend/js/transmision.js — modal flotante para editar/iniciar/finalizar transmisión desde partidos
- rontend/campeonatos.html — botón "📡 Transmisiones" en cada tarjeta de campeonato con irATransmisiones(id)
- rontend/js/campeonatos.js — función irATransmisiones() navega a 	ransmisiones.html?campeonato=ID
- rontend/js/portal.js — muestra badge EN VIVO en cada partido y card de próxima transmisión destacada
- rontend/index.html — sección de servicio de streaming en la landing page

**Pendiente Fase 3 y 4** (restream a redes sociales / ingesta propia de video) — requiere infraestructura externa.

## 2026-04-10 - Auto generación de Grupo Liga para fixture

### Contexto

- Antes de continuar se revisó la bitácora y se hizo `git fetch` para validar el estado de `origin/main`.
- No se ejecutó `git pull` porque el árbol local ya tenía cambios abiertos en el módulo de transmisiones y el remoto también avanzó; mezclar ambos frentes en este punto era riesgoso.
- Se retomó el pendiente funcional de categorías con `metodo_competencia = liga`.

### Problema detectado

- Cuando una categoría se configuraba como `liga`, la UI cambiaba a modo liga, pero backend no garantizaba la existencia de un grupo real asociado al evento.
- Eso dejaba inconsistencias entre:
  - pantalla de grupos,
  - selector de grupos en fixture,
  - y sincronización de equipos dentro de `grupo_equipos`.
- En la práctica, el sistema podía funcionar "sin grupos" para algunos cálculos de fixture, pero otros flujos seguían esperando un grupo válido y persistido.

### Implementación aplicada

- `backend/models/Grupo.js`
  - se agregó `asegurarGrupoLigaPorEvento(evento_id)`,
  - crea automáticamente `Grupo Liga` (`letra_grupo = L`) si la categoría es liga y todavía no tiene grupo,
  - sincroniza a ese grupo los equipos de `evento_equipos`,
  - actualiza `orden_sorteo` cuando la categoría trabaja con un único grupo,
  - y expone `removerEquipoDeEvento()` para limpiar asignaciones de grupo al sacar un equipo de la categoría.
- `backend/controllers/grupoController.js`
  - al consultar grupos por evento ahora primero asegura el `Grupo Liga` cuando corresponde.
- `backend/controllers/eventoController.js`
  - al crear o actualizar una categoría se asegura el `Grupo Liga` si el método competitivo quedó en liga,
  - al asignar un equipo a la categoría también se sincroniza automáticamente en el grupo liga,
  - al quitar un equipo se eliminan sus asignaciones en `grupo_equipos` para no dejar basura relacional.

### Resultado esperado

- Si se escoge `liga` para una categoría, al entrar a los flujos de grupos/fixture ya existirá un `Grupo Liga` utilizable.
- Los equipos inscritos quedarán sincronizados con ese grupo sin pasos manuales extra.
- El selector de grupos en fixture podrá mostrar el grupo de liga desde backend de forma consistente.

### Validación realizada

- `node --check backend/models/Grupo.js`
- `node --check backend/controllers/grupoController.js`
- `node --check backend/controllers/eventoController.js`

### Pendiente siguiente

- Probar en UI con una categoría real en `liga`:
  - crear o cambiar la categoría a liga,
  - inscribir equipos,
  - abrir grupos,
  - y generar fixture verificando que el selector ya ofrezca `Grupo Liga`.
- Cuando se limpie el árbol local de cambios ajenos, recién ahí evaluar `pull/rebase` contra `origin/main`.

## 2026-04-10 - Contexto persistente entre módulos + planilla por deporte afinada

### Navegación con contexto persistente

- Se ajustó la navegación entre módulos administrativos para conservar el contexto ya seleccionado:
  - si el administrador ya escogió un campeonato, al entrar a `Categorías`, `Equipos` o `Grupos` ese campeonato queda precargado;
  - si además ya estaba seleccionada una categoría, también se arrastra hacia `Equipos` y `Grupos`;
  - si no hay selección previa válida, el sistema limpia el contexto y obliga a escoger manualmente.
- Implementado en:
  - `frontend/js/core.js`
  - `frontend/js/eventos.js`
  - `frontend/js/equipos.js`

### Planilla: separación real entre fútbol y baloncesto

- Se reforzó `frontend/js/planilla.js` para normalizar el tipo de deporte con fallback entre `tipo_futbol` y `tipo_deporte`.
- Ahora la captura por jugador se comporta así:
  - `futbol_11` e `indor`: sin columna `P/S`,
  - otros modelos de fútbol: mantienen `P/S`,
  - baloncesto: conserva su lógica propia de puntos/faltas y no reutiliza labels ni bloques de fútbol.
- También se corrigió el reseteo de labels y visibilidad al cambiar entre deportes en la misma pantalla:
  - el bloque `Tiempo extra local/visitante` ya no queda visible en fútbol,
  - los textos del footer vuelven a sus etiquetas de fútbol cuando no es baloncesto.

### Planilla: ajuste visual de captura en pantalla

- Se afinó `frontend/css/style.css` para la tabla de captura:
  - `P/S`, `E` y `S` quedaron como columnas compactas solo en pantalla,
  - en fútbol 11 el encabezado ya muestra solo `E` y `S`,
  - el input del número de camiseta ya no invade la columna vecina,
  - se eliminó el cruce visual entre `N` con `P/S` o con `E/S`.
- El formato de impresión/PDF se dejó intacto donde ya estaba correcto.

### Estado validado al cierre

- `portal` y `playoff / llave eliminatoria` quedaron validados correctamente tanto en local como en Render.
- Baloncesto sigue pendiente de pruebas funcionales completas con datos reales.

### Verificación realizada

- `node --check frontend/js/core.js`
- `node --check frontend/js/eventos.js`
- `node --check frontend/js/equipos.js`
- `node --check frontend/js/planilla.js`

### Pendiente para continuar desde casa

- Probar en UI:
  - planilla `futbol_11`,
  - planilla `indor`,
  - planilla de un modelo con `P/S`,
  - y planilla de baloncesto.
- Confirmar especialmente:
  - encabezados `E` / `S` en fútbol 11,
  - ausencia total de overtime en fútbol,
  - no superposición visual entre `N` y `P/S`,
  - y consistencia del guardado/recarga de la captura por jugador.

## 2026-04-14 - Tabla de posiciones liga: resultados ya reflejan PJ/PTS aunque exista Grupo Liga

### Problema detectado

- En categorías `liga` de terceros organizadores se detectó un caso real donde:
  - los partidos y goleadores sí estaban registrados,
  - pero la `Tabla de posiciones` seguía saliendo completamente en cero.
- El caso observado fue:
  - campeonato `Copa Velocity Máster`
  - categoría `U 35`
  - con partidos históricos creados por fixture `todos contra todos`.

### Causa raíz

- El fixture `liga` todavía generaba partidos con `grupo_id = NULL`.
- Después de introducir `Grupo Liga`, algunas vistas pasaron a calcular posiciones por grupo al detectar que el evento ya tenía un grupo asociado.
- Eso producía una inconsistencia:
  - los partidos históricos seguían colgados al `evento`,
  - pero la tabla intentaba leer estadísticas desde `grupo_id`,
  - por eso `PJ`, `PG`, `GF`, `PTS`, etc. quedaban en `0`.

### Implementación aplicada

- `backend/models/Partido.js`
  - `generarFixtureEventoTodosContraTodos()` ahora asegura `Grupo Liga` cuando la categoría está en modo liga,
  - y los nuevos partidos se crean con `grupo_id` apuntando a ese grupo.
- `backend/controllers/tablaController.js`
  - `generarTablaGrupoInterna()` ahora detecta cuando el grupo pertenece a una categoría `liga`,
  - y en ese caso calcula la tabla usando el resumen por `evento` en vez de depender de `grupo_id`.
- Con esto quedan cubiertos ambos escenarios:
  - fixtures nuevos de liga ya salen ligados a `Grupo Liga`,
  - fixtures viejos con `grupo_id = NULL` siguen alimentando correctamente la tabla de posiciones.

### Verificación realizada

- `node --check backend/models/Partido.js`
- `node --check backend/controllers/tablaController.js`
- Prueba real local:
  - se aseguró `Grupo Liga` para `evento 16` (`U 35`),
  - y la tabla dejó de salir en cero.
- Resultado observado en local tras la corrección:
  - `BOCHA'S F.C.` → `PJ 1`, `PTS 3`
  - `ROMA F.C.` → `PJ 1`, `PTS 3`
  - `ALFARO VIVE CARAJO` → `PJ 1`, `PTS 1`

### Pendiente siguiente

- Validar en UI:
  - `portal` de `Copa Velocity Máster -> U 35`,
  - `tablas.html` para la misma categoría,
  - y alguna categoría `liga` adicional de otro organizador.
- Confirmar también que al regenerar nuevos fixtures de liga, los partidos recién creados ya queden guardados con `grupo_id = Grupo Liga`.

## 2026-04-14 - Inscripción cruzada de jugadores: solo se permite bajar de categoría

### Necesidad operativa

- Se solicitó permitir que un jugador ya inscrito en una categoría mayor pueda jugar también en una categoría menor del mismo campeonato.
- Ejemplos válidos:
  - `U 50 -> U 40`
  - `U 50 -> U 35`
  - `U 50 -> Abierta`
- Ejemplos que deben bloquearse:
  - `U 35 -> U 40`
  - `U 40 -> U 50`
  - `Abierta -> U 35`

### Implementación aplicada

- `backend/models/Jugador.js`
  - se agregó `inferirNivelCategoriaMovimiento()` para traducir la categoría a una jerarquía operativa:
    - `U/Sub +XX` usa el número de edad como nivel,
    - `Abierta/Libre/Open` usa nivel `0`.
  - se agregó `validarDireccionCategoriaPorCedula()`:
    - busca otras categorías donde ya participa la misma cédula dentro del mismo campeonato,
    - y bloquea la inscripción si el destino intenta subir respecto a una categoría ya registrada.
  - la validación se ejecuta tanto en `crear()` como en `actualizar()`.
- `backend/controllers/jugadorController.js`
  - `actualizarJugador` ahora devuelve `400` para este tipo de validación operativa en vez de degradarla a error `500`.

### Verificación realizada

- `node --check backend/models/Jugador.js`
- `node --check backend/controllers/jugadorController.js`
- Pruebas reales sobre `Copa Velocity Máster`:
  - cédula `1102905237`:
    - `U 40 -> U 50`: bloqueado
    - `U 50 -> U 40`: permitido
  - cédula `1103774251`:
    - `U 35 -> U 40`: bloqueado

### Notas

- La regla se apoya en la cédula para identificar que es el mismo jugador.
- Si el campeonato no exige cédula, esta restricción no puede inferirse de forma confiable con nombre/apellido solamente.
- La edición normal de una ficha ya existente no se bloquea si el jugador permanece en la misma categoría; la restricción se dispara al crear una nueva inscripción o al mover realmente la cédula a otra categoría.

## 2026-04-14 - Resultados válidos en tablas/portal y pestaña para traer jugadores desde categoría superior

### Problema detectado

- Se reportó que algunas categorías mostraban partidos `pendiente` o `suspendido` con marcador `0-0` en la pestaña de resultados del portal.
- Ese mismo tipo de registros podía contaminar:
  - la tabla de posiciones,
  - goleadores,
  - tarjetas,
  - faltas/fair play,
  - y los contadores públicos de jornadas ya jugadas.
- Además se pidió una forma operativa en `jugadores.html` para cargar en la inscripción actual a un jugador que ya exista en una categoría superior del mismo campeonato.

### Implementación aplicada

- `backend/models/Partido.js`
  - se unificó una regla de resultado computable:
    - solo cuentan `finalizado`, `no_presentaron_ambos` y `programado` con ambos marcadores presentes,
    - `pendiente`, `suspendido` y `aplazado` limpian marcador y shootouts.
  - `guardarPlanilla()` dejó de forzar `0-0` cuando los inputs llegan vacíos.
  - las lecturas públicas/admin (`obtenerPorEvento`, `obtenerPorGrupo`, etc.) ahora saneán marcadores en estados bloqueados aunque la BD vieja todavía tenga `0-0`.
  - las estadísticas de equipo ya no suman partidos bloqueados.
- `backend/controllers/tablaController.js`
  - tabla, goleadores, tarjetas y faltas/fair play ahora usan la misma condición de “resultado computable”, en vez de tomar cualquier partido con planilla.
- `backend/services/publicPortalService.js`
  - el contador `partidos_finalizados` público ya no depende de `partido_planillas`; ahora exige estado válido + marcador real.
- `frontend/js/planilla.js`
  - el payload de planilla dejó de serializar marcador vacío como `0`.
- `frontend/js/portal.js`
  - la pestaña `Resultados` dejó de usar `tiene_planilla_publicada` como sinónimo de resultado.
  - solo se muestran marcadores cuando el partido realmente califica como resultado válido.
  - los partidos `pendiente/suspendido/aplazado` ya no aparecen como resultados aunque históricamente hayan quedado con `0-0`.
- `frontend/jugadores.html`
  - se agregó la pestaña `Desde categoría superior`.
- `frontend/js/jugadores.js`
  - la nueva pestaña filtra solo categorías superiores del mismo campeonato,
  - permite escoger categoría origen, equipo origen y jugador origen,
  - y carga sus datos al formulario normal de inscripción del equipo/categoría destino.
- `frontend/css/style.css`
  - se añadieron estilos para la nueva pestaña de movimiento entre categorías.

### Verificación realizada

- `node --check backend/models/Partido.js`
- `node --check backend/controllers/tablaController.js`
- `node --check backend/services/publicPortalService.js`
- `node --check frontend/js/portal.js`
- `node --check frontend/js/planilla.js`
- `node --check frontend/js/jugadores.js`
- Validación real local:
  - se detectaron partidos `pendiente/suspendido/aplazado` con marcador persistido en BD,
  - ejemplo: partido `4383`, `evento 9`, estado `pendiente`, guardado como `0-0`,
  - al leerlo por modelo ya sale saneado como `resultado_local = null`, `resultado_visitante = null`.

### Estado operativo

- Portal/playoff:
  - el usuario confirmó que la llave eliminatoria ya está correcta tanto en local como en Render.
- Baloncesto:
  - la implementación base sigue pendiente de pruebas funcionales reales.

### Pendiente siguiente

- Probar en Render:
  - una categoría con partidos suspendidos/pedientes para confirmar que desaparecen de `Resultados`,
  - y la nueva pestaña `Desde categoría superior` en un flujo real de inscripción.
- Si la revisión visual queda conforme, hacer commit y push de este bloque.

## 2026-04-18 - Git pull seguro y ajuste PDF de planilla para fútbol 7 en una sola hoja

### Sincronización previa

- Se ejecutó `git pull --ff-only` sobre `main` antes de tocar la planilla.
- Como había trabajo local abierto, primero se resguardó temporalmente con `git stash`.
- El `pull` avanzó de `5aa40af` a `64ea8ef` e incorporó el bloque reciente de overlays/transmisiones.
- El stash quedó conservado como respaldo porque el remoto ya traía varios de esos archivos y no fue necesario reinyectar nada al árbol para continuar con este ajuste.

### Problema reportado

- El PDF oficial de la planilla para `fútbol 7` debía salir en una sola hoja.
- El cambio no debía afectar la exportación actual de:
  - `fútbol 11`
  - `fútbol 9`
  - `fútbol 8`

### Implementación aplicada

- `frontend/js/planilla.js`
  - se agregó `esPlanillaFutbol7()` para detectar ese caso de manera explícita.
  - en `imprimirPDFPlanilla()`:
    - `fútbol 7` ahora activa observaciones compactas dentro de la primera hoja,
    - se fuerza el modo compacto solo para ese escenario,
    - y se ajusta el cálculo de altura disponible para filas considerando ese bloque adicional.
  - para el resto de formatos:
    - `fútbol 11`, `fútbol 9` y `fútbol 8` mantienen su flujo anterior,
    - incluyendo el comportamiento existente de observaciones/paginación.

### Verificación realizada

- `node --check frontend/js/planilla.js`
- Revisión del diff funcional:
  - el ajuste quedó encapsulado en la rama PDF y condicionado a `fútbol 7`,
  - sin tocar las reglas de columnas, observaciones ni paginación de `fútbol 8/9/11`.

### Pendiente siguiente

- Probar visualmente en Render:
  - una planilla real de `fútbol 7` exportada a PDF y confirmar que sale en **1 hoja**,
  - comparar contra `fútbol 8`, `fútbol 9` y `fútbol 11` para confirmar que no cambiaron.

---

## 2026-04-18 — Estado del repositorio y hoja de ruta para próxima sesión

### Rama `main` sincronizada — commits en producción (Render)

| Hash | Descripción |
|------|-------------|
| `40bb99e` | fix: modo compacto para todos los formatos no-fútbol11 (f8, f9, etc.) |
| `f48070d` | fix: planilla PDF fútbol 7 — modo compacto, filas angostas, obs en pág 2 |
| `f5d39a4` | fix: PDF planilla fútbol 7 en una sola hoja con observaciones compactas |
| `64ea8ef` | feat: módulo transmisión Phase 1 — Socket.io overlay para OBS |
| `9f1fac8` | feat: valid-result filter + jugadores from superior category |

### Estado de módulos en Render

| Módulo | Estado |
|--------|--------|
| Portal público (resultados, tabla, goleadores) | Operativo |
| Planilla PDF fútbol 11 / 9 / 8 | Operativo |
| Planilla PDF fútbol 7 (1 hoja, modo compacto) | Subido — **pendiente prueba visual** |
| Planilla PDF todos los formatos no-fútbol11 (modo compacto) | Subido — **pendiente prueba visual** |
| Importación Excel (cédulas/teléfonos con cero inicial) | Operativo |
| Pestaña "Desde categoría superior" en jugadores | Subido — **pendiente prueba funcional** |
| Resultados filtrados (suspendidos/pendientes ocultos) | Subido — **pendiente prueba en Render** |
| Módulo transmisión Phase 1 (Socket.io overlay OBS) | Subido — **pendiente prueba de integración** |
| Baloncesto | Base implementada — pendiente pruebas funcionales |

### Pendientes priorizados para próxima sesión

1. **Planilla fútbol 7 y otros formatos** — exportar PDF de categorías reales:
   - fútbol 7: confirmar 1 hoja, observaciones en pág 2
   - fútbol 8/9: confirmar que también quedan en 1 hoja (modo compacto extendido)
   - fútbol 11 < 24 filas: confirmar que sigue en modo normal sin cambios

2. **Resultados filtrados** — buscar categoría con partidos `suspendido`/`pendiente` que antes aparecían en pestaña `Resultados` y confirmar que ya no salen.

3. **Jugadores desde categoría superior** — flujo real de inscripción en un campeonato activo.

4. **Módulo transmisión Phase 1** — prueba de integración completa:
   - Crear transmisión desde panel de administración
   - Abrir `frontend/director.html` con `director_token`
   - Abrir `frontend/overlay.html` como Browser Source en OBS
   - Ajustar marcador y confirmar actualización en tiempo real vía Socket.io

5. **Baloncesto** — prueba funcional básica: registro de partido y generación de planilla.

### Archivos clave por módulo

| Módulo | Archivos principales |
|--------|----------------------|
| Planilla PDF | `frontend/js/planilla.js` |
| Transmisión / Overlay | `frontend/director.html`, `frontend/overlay.html`, `backend/services/socketService.js`, `backend/controllers/overlayController.js`, `backend/models/TransmisionOverlay.js`, `backend/routes/overlayRoutes.js` |
| Transmisión BD | `database/migrations/064_transmision_overlay.sql`, `database/migrations/065_transmisiones_overlay_token.sql` |
| Jugadores categoría superior | `frontend/js/jugadores.js`, `frontend/jugadores.html` |
| Resultados / tabla pública | `frontend/js/portal.js`, `backend/models/Partido.js`, `backend/controllers/tablaController.js` |

---

## 2026-04-21 — Ajustes PDF planilla no-F11: columnas, fuente dinámica y una sola hoja

### Problema reportado (con PDFs de prueba)

Se revisaron dos PDFs (con y sin observaciones) de una categoría no-F11 y se detectaron:
1. Nombres de jugadores ocupando 2 líneas → fuente demasiado grande.
2. Planilla desbordando a una segunda hoja (pagos cortados).
3. Columnas P y S presentes en fútbol 7/8/9/indor/sala cuando no deben estar.
4. Títulos de columna muy grandes ocupando espacio excesivo en el encabezado.

### Causa raíz

- La fórmula de escala de fuente usaba `alturaFilaPlantel * 0.38` → con 17 filas el cap de 28pt ya se alcanzaba y la fuente subía a 10.5pt, desbordando los nombres.
- `_espacioFijo = 320pt` subestimaba el contenido fijo real (~343–367pt dependiendo del modelo).
- `usaConvocatoriaPlanilla()` retorna `true` para futbol_7/8/9/sala → las columnas P/S aparecían en el PDF.
- `totalFilasImpresion` siempre es igual a `maxFilas` (las filas se rellenan con null) → el ratio de fuente siempre daba 1.0, sin escala real.

### Cambios en `frontend/js/planilla.js`

#### 1. P/S eliminados del PDF para todos los formatos no-F11
```javascript
// Antes:
if (usaConvocatoria) { ... añade P/S ... }
// Ahora:
if (usaConvocatoria && modo !== "pdf") { ... añade P/S ... }
```
La UI (captura y vista previa) conserva P/S sin cambios; solo el PDF los omite.

#### 2. Fuente basada en jugadores reales (no filas de relleno)
```javascript
const totalJugadoresReales = Math.max(
  plantelLocalImpresion.filter(j => j !== null).length,
  plantelVisitanteImpresion.filter(j => j !== null).length, 0
);
const _filasRatio = maxFilas > 0 ? Math.min(1, totalJugadoresReales / maxFilas) : 1;
const _fontScaleNoF11 = !arbitraje.esFutbol11 ? (1 + (1 - _filasRatio) * 0.35) : 1.0;
const fontCeldaJugador = Math.min(9.0, _fontCeldaBase * _fontScaleNoF11);
```
- Lleno (ratio=1): fuente base (7.4pt) → nombres en 1 línea.
- Mitad (ratio=0.5): 8.7pt.
- Muy pocos (ratio~0): máx 9.0pt.

#### 3. `_espacioFijo` diferenciado por modelo
- `futbol_7_5_sala` (fútbol 7, sala): 345 + 22 = **367pt** (incluye bloque de faltas).
- `futbol_11_indor` (fútbol 8, 9, indor): **345pt**.
- Ultra-compacto (≥30 filas): **387pt** sin cambio.

#### 4. `_alturaFilaMax` aumentado de 28 → **32pt**
Da mayor altura visual a las filas cuando hay pocas inscripciones (cap se alcanza con ≤14 filas).

### Garantía 1 hoja hasta 30 jugadores

| Formato / Caso | Fila(pt) | Fuente | Resultado |
|----------------|----------|--------|-----------|
| f7 maxFilas=14, lleno | 30.9 | 7.4pt | 1 pág ✅ |
| f7 maxFilas=14, 7 reales | 30.9 | 8.7pt | 1 pág ✅ |
| sala maxFilas=20, lleno | 22.1 | 7.4pt | 1 pág ✅ |
| f9 maxFilas=18, lleno | 25.6 | 7.4pt | 1 pág ✅ |
| f8 maxFilas=17, 15 reales | 27.0 | 7.7pt | 1 pág ✅ |
| Cualquier formato maxFilas=30 | 14.4 | 6.6pt | 1 pág ✅ |

### Commits de esta sesión

| Hash | Descripción |
|------|-------------|
| `033b47a` | fix: PDF planilla no-F11 — fuente dinámica y observaciones adaptativas |
| `d8209ce` | fix: PDF planilla no-F11 — sin P/S, fuente conservadora y sin overflow |
| `69b2b40` | fix: PDF planilla no-F11 — fuente real, espacio por modelo, hasta 30 filas |

### Pendiente siguiente

- Probar en Render con un partido real de cada formato:
  - **Fútbol 7** (maxFilas=14 aprox): verificar que P/S no aparecen, nombres en 1 línea, 1 hoja.
  - **Fútbol 8/9** (maxFilas=17-18): verificar 1 hoja sin overflow.
  - **Con observaciones**: confirmar que van a página 2 cuando no caben en la primera.
  - **Pocos jugadores** (mitad del max): verificar que la fuente es visiblemente más grande.
- Si todo está correcto, cerrar este bloque de ajustes PDF.
