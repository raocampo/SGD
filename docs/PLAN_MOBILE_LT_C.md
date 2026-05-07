# Plan Mobile App - LT&C (Loja Torneos & Competencias)

Ultima actualizacion: 2026-05-07

## 1. Objetivo
Construir una app movil de LT&C publicable en tiendas oficiales:
- Android (Google Play Store),
- iOS (Apple App Store),
sin perder funcionalidades criticas del sistema (admin, organizador, dirigente/tecnico y portal publico).

## 2. Enfoque
Implementar una estrategia `App Mobile + Publicacion en Stores` por fases.

Alcance tecnico propuesto:
- Fase 1: definicion de arquitectura mobile (Flutter / React Native / Ionic+Capacitor).
- Fase 2-4: desarrollo funcional por modulos criticos.
- Fase 5: pruebas de calidad mobile y hardening.
- Fase 6: publicacion en Google Play y App Store.

## 3. Prioridades de negocio (orden de implementacion)
1. Login/registro y navegacion principal.
2. Dashboard y modulos de gestion basica (campeonatos, categorias, equipos, jugadores).
3. Modulos operativos de campo (partidos, planillaje, tablas).
4. Modulo financiero (estado de cuenta, morosidad, movimientos).
5. Portal publico mobile (torneos, auspiciantes, precios, contacto).

## 4. Matriz de flujos criticos en movil
- Administrador/Organizador:
  - crear campeonato/categoria,
  - registrar equipos y jugadores,
  - generar sorteo/grupos/fixture,
  - revisar finanzas y reportes.
- Dirigente/Tecnico:
  - consultar su equipo,
  - registrar/editar jugadores,
  - ver tablas y finanzas de su equipo.
- Publico:
  - ver torneos activos,
  - consultar resultados/tablas,
  - contacto y registro.

## 5. Plan por fases (App Stores)

### Fase 0 - Discovery tecnico y producto (1-2 dias)
- Inventario de pantallas.
- Definir stack mobile definitivo:
  - opcion A: Flutter,
  - opcion B: React Native,
  - opcion C: Ionic + Capacitor.
- Definir modelo de login, sesion y almacenamiento local para mobile.

Entregable:
- Decision tecnica mobile y backlog por sprint.

### Fase 1 - Base de app y navegacion (2-3 dias)
- Crear proyecto mobile base.
- Configurar navegacion principal por rol.
- Configurar entorno de API y sesiones.

Entregable:
- App ejecutando login y navegacion basica en Android/iOS.

### Fase 2 - Modulos de gestion (3-5 dias)
- `admin`, `campeonatos`, `eventos`, `equipos`, `jugadores`, `usuarios`.
- Formularios y listados optimizados para touch.

Entregable:
- Flujo completo de alta/edicion en app mobile.

### Fase 3 - Operacion de torneo (4-6 dias)
- `sorteo`, `grupos`, `partidos`, `planilla`, `tablas`.
- Planillaje mobile:
  - priorizar captura rapida por jugador,
  - inputs compactos y teclado numerico,
  - bloques plegables para local/visitante.
- Exportaciones y vista previa adaptadas para pantalla pequena.

Entregable:
- Operacion de partido usable desde telefono.

### Fase 4 - Finanzas mobile (2-4 dias)
- `finanzas`:
  - filtros verticales,
  - resumen por tarjetas/inscripcion/arbitraje,
  - tablas con columnas esenciales en movil.
- Mejoras de legibilidad en recibos y estado de cuenta.

Entregable:
- Gestion financiera basica operable desde movil.

### Fase 5 - Calidad y performance mobile (2-4 dias)
- Lighthouse mobile (performance, accesibilidad, best practices).
- Optimizacion de imagenes y carga diferida.
- QA funcional Android/iOS.
- Validacion de notificaciones, permisos y almacenamiento local.

Entregable:
- Build candidata a release.

### Fase 6 - Publicacion en tiendas (2-4 dias)
- Preparar branding, screenshots, politica de privacidad y fichas de store.
- Generar builds firmadas:
  - Android AAB para Play Store,
  - iOS IPA para App Store Connect.
- Resolver checklist de compliance de tiendas.

Entregable:
- App LT&C publicada en Play Store y App Store.

## 6. Criterios de aceptacion
- No scroll horizontal en pantallas de 360px de ancho.
- Todas las acciones criticas alcanzables con una mano (botones visibles y tactiles).
- Formularios clave completables sin zoom manual.
- Tiempo de carga inicial aceptable en red movil (objetivo: <3s en pagina principal optimizada).
- Sin errores JS bloqueantes en consola durante flujo principal.
- APK/IPA validada y aceptada por pipelines de publicacion en stores.

## 7. Riesgos y mitigacion
- Riesgo: exceso de tablas con muchas columnas.
  - Mitigacion: vista card para movil + detalle expandible.
- Riesgo: formularios largos (planilla/finanzas).
  - Mitigacion: secciones plegables y pasos.
- Riesgo: regresiones visuales desktop.
  - Mitigacion: validacion cruzada desktop/tablet/movil por fase.

## 8. Checklist de ejecucion (sesion nocturna)
1. Ejecutar Fase 0 (diagnostico) y generar lista de pantallas prioritarias.
2. Iniciar Fase 1 en layout global (`style.css`, `core.js`).
3. Ajustar modulos `admin/campeonatos/equipos/jugadores` (Fase 2 parcial).
4. Validar rapidamente en viewport 390x844 y 768x1024.
5. Registrar resultados en bitacora y preparar siguiente bloque.

## 9. Estado del plan
- Documento creado: Si.
- Implementacion iniciada: Si (fase 1 base responsive web iniciada en esta sesion).
- Estado actualizado 2026-05-07: el responsive web/mobile queda como pendiente prioritario operativo. Falta auditoria pantalla por pantalla en móvil real y cierre visual/funcional de módulos internos, no solo landing pública.
- Avance 2026-05-07: primer bloque web responsive público aplicado en `index.html`, `torneos.html`, `portal.html`, `planes.html`, `equipo-publico.html` y `jugador-publico.html`; menú público reutilizable en `core.js`, fichas públicas compactas y tablas/selectores del portal con scroll táctil.
- Avance 2026-05-07: segundo bloque web responsive interno aplicado en `style.css` y `core.js`; cubre layout `app-layout`, topbar, acciones, tabs, grids, tablas, modales y páginas internas de operación (`portal-admin`, `campeonatos`, `equipos`, `jugadores`, `partidos`, `tablas`, `facturacion`, `transmisiones`).
- Avance 2026-05-07: tercer bloque responsive de cierre aplicado para `planilla`, `finanzas`, `gruposgen`, `sorteo`, `pases`, `eventos`, `usuarios` y `eliminatorias`; queda pendiente QA visual con datos reales.

## 10. Avance ejecutado (2026-02-24)
- Fase 1 iniciada sobre frontend web actual (base compartida):
  - ajuste global de `container` con paddings fluidos,
  - hardening de layout `app-layout` para evitar desbordes horizontales,
  - mejora de `top-bar` (titulo y badge de usuario) para pantallas pequenas,
  - normalizacion de barras de acciones (`actions`, `action-bar`, `partidos-actions`, etc.) para uso tactil,
  - ajuste responsive de `main` y `main.container` para modulos administrativos,
  - sidebar responsivo consolidado para `<=1200px`,
  - ajuste de breakpoint en `core.js` para no forzar navegacion movil en paginas publicas sin sidebar,
  - cierre parcial responsive en modulos `tablas` y `finanzas` (filtros tactiles, grillas de formulario simplificadas y tablas mas compactas),
  - cierre parcial responsive en `partidos` y `planilla` (acciones tactiles, tabs apilables y captura de planilla optimizada para pantalla pequena).
- Proximo bloque recomendado:
  - validacion funcional visual en `390x844` y `768x1024`,
  - cierre responsive de `grupos`, `eliminatorias` y `pases` para mantener consistencia completa de operacion mobile.

## 11. Avance ejecutado (2026-05-07 — bloque interno operativo)
- Se agrega una capa responsive comun en `frontend/css/style.css` para pantallas internas:
  - `top-bar` sticky y compacta,
  - contenido `main` con paddings moviles,
  - tarjetas/config-cards sin desborde,
  - grillas y formularios a 1 columna en movil,
  - tabs horizontales con scroll tactil,
  - tablas internas con scroll horizontal contenido,
  - acciones y botones a ancho completo en `<=560px`,
  - modales de facturacion adaptados a viewport movil.
- Se consolida el binding del sidebar interno:
  - `core.js` marca `nav-toggle` con `data-mobile-menu-bound`,
  - `facturacion.html`, `transmisiones.js` y `tablasplantilla.js` quedan alineados a `sidebar.nav-open`.
- Verificacion aplicada:
  - `node --check frontend/js/core.js frontend/js/transmisiones.js frontend/js/tablasplantilla.js`,
  - `npm run smoke:frontend` desde `backend/` con `39/39` checks OK.
- Proximo bloque recomendado:
  - abrir QA visual con navegador/devtools en `390x844` y `768x1024`,
  - corregir ajustes puntuales de pantallas con datos reales,
  - revisar luego `grupos`, `eliminatorias`, `pases`, `sorteo` y `usuarios` como cierre del circuito operativo completo.

## 12. Avance ejecutado (2026-05-07 — cierre responsive operativo)
- Se refuerza `core.js` para que el menu lateral interno sincronice `aria-expanded` / `aria-controls` y mantenga un solo binding por boton.
- Se agrega bloque `Mobile QA` en `style.css`:
  - planilla con captura y vista previa scrolleable,
  - finanzas con formularios largos a 1 columna y acciones compactas,
  - sorteo con ruleta escalable y paneles apilados,
  - eliminatorias con tabs/seed/manual/resumen protegidos contra desborde,
  - pases/eventos/usuarios con tablas contenidas y botones tactiles.
- Se agrega cierre responsive en `grupos.css`:
  - acciones de grupos a ancho completo en movil,
  - poster con textos largos contenidos,
  - modo liga a 1 columna,
  - playoff embebido con altura movil.
- Verificacion aplicada:
  - `node --check frontend/js/core.js frontend/js/transmisiones.js frontend/js/tablasplantilla.js`,
  - `npm run smoke:frontend` desde `backend/` con `39/39` checks OK,
  - paginas internas cubiertas responden `200` desde `http://localhost:5000/`.
- Proximo bloque recomendado:
  - QA visual manual con datos reales y viewport `390x844` / `768x1024`,
  - tomar capturas de pantallas criticas,
  - convertir tablas mas complejas a vista card mobile si el cliente confirma que el scroll horizontal no es suficiente.
