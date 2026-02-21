# Plan Mobile Web - LT&C (Loja Torneos & Competencias)

Ultima actualizacion: 2026-02-21

## 1. Objetivo
Adaptar LT&C para uso operativo real en telefonos moviles sin perder funcionalidades criticas del sistema web (admin, organizador, dirigente/tecnico y portal publico).

## 2. Enfoque
Implementar una estrategia `Responsive Web + Mobile First` por fases.

Alcance tecnico propuesto:
- Fase 1-3: responsive completo en frontend actual (HTML/CSS/JS vanilla).
- Fase 4: optimizacion de performance y experiencia tactil.
- Fase 5 (opcional): evolucion a PWA (icono instalable, cache de vistas clave, modo offline parcial).

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

## 5. Plan por fases

### Fase 0 - Diagnostico UI (1-2 dias)
- Inventario de pantallas.
- Deteccion de componentes no responsive:
  - tablas anchas,
  - formularios de multiples columnas,
  - modales con overflow,
  - botones pequenos y controles muy juntos.
- Definicion de breakpoints oficiales:
  - `<=480`, `<=768`, `<=1024`, `>1024`.

Entregable:
- Checklist por pagina con severidad (alta/media/baja).

### Fase 1 - Base responsive global (2-3 dias)
- Normalizar layout base:
  - sidebar/overlay,
  - header sticky,
  - contenedores fluidos.
- Estandarizar tipografia y espaciados mobile.
- Definir altura minima tactil de botones/inputs (`44px`).
- Corregir navegacion horizontal no deseada.

Entregable:
- Sistema navegable en movil sin desbordes globales.

### Fase 2 - Modulos de gestion (3-5 dias)
- `admin`, `campeonatos`, `eventos`, `equipos`, `jugadores`, `usuarios`.
- Convertir tablas a:
  - vista tabla scrollable controlada, o
  - vista cards en movil.
- Formularios en 1 columna para `<=768`.
- Acciones principales fijadas arriba (guardar, nuevo, filtrar).

Entregable:
- Flujo completo de alta/edicion en movil.

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

### Fase 5 - Calidad, performance y PWA opcional (2-4 dias)
- Lighthouse mobile (performance, accesibilidad, best practices).
- Optimizacion de imagenes y carga diferida.
- PWA opcional:
  - `manifest`,
  - iconos,
  - cache de recursos estaticos clave.

Entregable:
- Version mobile estable para produccion.

## 6. Criterios de aceptacion
- No scroll horizontal en pantallas de 360px de ancho.
- Todas las acciones criticas alcanzables con una mano (botones visibles y tactiles).
- Formularios clave completables sin zoom manual.
- Tiempo de carga inicial aceptable en red movil (objetivo: <3s en pagina principal optimizada).
- Sin errores JS bloqueantes en consola durante flujo principal.

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
- Implementacion iniciada: No (pendiente iniciar en siguiente sesion de desarrollo mobile).
