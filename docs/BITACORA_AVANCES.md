# Bitácora de Avances - SGD

Ultima actualizacion: 2026-02-18

## Objetivo
Mantener un registro vivo del progreso del proyecto para retomar trabajo sin perder contexto.

## Estado General
- Backend y frontend funcionales para flujo base de campeonatos, eventos, equipos, grupos, partidos, tablas y portal.
- Se corrigieron desalineaciones clave entre rutas, controladores, modelos y frontend.
- Modulo financiero en estado funcional inicial con cuenta corriente y morosidad.
- Pendiente continuar pruebas integrales de flujo real con carga de datos.

## Avances Recientes

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
- Carga de equipos reales para pruebas funcionales de sorteo -> grupos -> fixture.

## Pendientes Prioritarios
- Ejecutar pruebas end-to-end con datos reales (validar que todo el flujo quede estable).
- Consolidar autenticacion y roles (RBAC) minimo.
- Revisar y ordenar archivos legacy/antiguos para reducir deuda tecnica.
- Continuar modulo financiero: multas automaticas, bloqueos por morosidad y reportes de ingresos.

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
