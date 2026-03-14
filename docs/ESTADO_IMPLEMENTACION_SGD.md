# Estado de Implementacion vs Propuesta LT&C

Ultima actualizacion: 2026-03-14
Documento base revisado: `docs/propuestaDesarrolloSGD.md`

## Resumen por Modulo

| Modulo | Estado | Avance actual |
|---|---|---|
| 3.1 Gestion de Torneos/Campeonatos | Parcial-Alto | CRUD y estados operativos, organizador/logo/colores; tipos de futbol ampliados (`futbol_11`, `futbol_9`, `futbol_8`, `futbol_7`, `futbol_6`, `futbol_5`, `futsala`, `indor`) y fondo de carné configurable por campeonato; pendiente reglamento PDF/bases y sedes multiples. |
| 3.2 Categorias por torneo | Alto | Eventos/categorias por campeonato funcionales con asignacion de equipos y parametro `clasificados_por_grupo`. |
| 3.3 Gestion de Equipos | Alto | Registro completo con logo/contacto/colores, asignacion por evento, flujo hacia sorteo y vista Tarjetas/Tabla. |
| 3.4 Gestion de Jugadores | Alto | CRUD por equipo y acceso global; validacion de jugador unico por categoria/evento (ya no por campeonato completo), permitiendo la misma cedula en distintas categorias; documentos opcionales/requeridos segun campeonato; cedula configurable como obligatoria/opcional por campeonato; importacion masiva y reportes. Uploads reorganizados por tipo (`jugadores/cedulas`, `jugadores/fotos`) sin romper carnés ni reporteria; fecha de nacimiento ya no sufre desfase por zona horaria, la `foto carné` puede borrarse desde el perfil del jugador y las cards/fichas ya usan hero con foto o logo de equipo como fallback. El guardado multipart ya usa cliente autenticado, el backend responde errores amigables de subida y el limite de imagenes se amplio a `8MB`. Los carnés ya soportan fondo configurable por campeonato mezclando imagen, logo y colores institucionales, y ahora guardan un recorte estable (`foto_carnet_recorte_url`) para evitar desfases entre preview y PDF. Modulo de pases con UI operativa, sincronizacion contable integrada (cargo/abono por pase) e historial visual por jugador/equipo. |
| 3.5 Creacion de Grupos | Alto | Modo aleatorio, cabezas de serie y manual con ruleta funcionando. |
| 3.6 Generacion de Fixture | Alto | Generacion por evento, filtros por grupo/jornada/fecha, vista plantilla y exportaciones. |
| 3.7 Resultados/Tablas/Clasificados | Alto | Tablas por evento (posiciones, goleadores, tarjetas, fair play) con selector de campeonato en UI y guardado explícito del formato de clasificación (`metodo_competencia` + `clasificados_por_grupo`). Planillaje ya alimenta resultado + estadisticas. Clasificacion por grupo parametrizable; equipos eliminados ya bajan al final aunque tengan mayor puntaje y los fuera de cupo quedan diferenciados visualmente en naranja. Pendiente refinamiento de desempates avanzados. |
| 3.8 Eliminatorias | Alto | Configuracion por categoria (`metodo_competencia`) y generacion automatica de llave integrada en `partidos`; soporte de siembra/byes/progresion de ganador; UI dedicada de llaves en `eliminatorias.html`; playoff desde grupos con `clasificados por grupo`, `cruces de grupos` o `tabla unica`; configuracion compartida con `tablas.html`; nueva clasificacion manual sugerida por grupo con candidatos externos del evento cuando el grupo queda incompleto, y exclusion de equipos eliminados manualmente. Pendiente validacion operativa real y reglas avanzadas de desempate. |
| 4 Portal publico | Alto | Portal operativo con vistas publicas deportivas e institucionales; el listado general expone campeonatos de organizadores reales y tambien registros legacy con `organizador` informado, manteniendo fuera `administrador`/QA. La landing publica de organizador ya no mezcla torneos por alias de texto y ya muestra todas las cards reales visibles del organizador, incluidos torneos proximos/inscripcion. El detalle del campeonato muestra tabs por categoria con subtabs de `tabla de posiciones`, `goleadores`, `fair play`, `tarjetas amarillas`, `tarjetas rojas` y `playoff`. Las tablas de posiciones publicas ya salen en grid `2 columnas` desktop / `1 columna` movil, replican estados competitivos (fuera de clasificacion / eliminado) y excluyen eliminados del ranking de `Fair Play`. Ademas queda operativa la base de branding/publicidad por organizador (`Mi Landing`) con auspiciantes y media publica separados de LT&C. |
| 5 Roles y permisos (RBAC) | Medio-Alto | Autenticacion operativa; fase 1 de separacion de dominios iniciada con rol `operador` para CMS publico; rol `jugador` agregado para consulta de equipo en modo solo lectura; noticias, galeria, contenido y contacto institucional fuera del alcance de organizadores; smokes RBAC (`npm run smoke:roles`, `npm run smoke:matrix`, `npm run smoke:frontend`) operativos para validacion rapida por rol. Se agrega bandera `debe_cambiar_password`, cambio obligatorio de clave al primer ingreso para cuentas creadas por admin/organizador y accion de cambio de contraseña propio desde UI. Las cuentas internas ya pueden autenticarse con `correo o username`; la recuperacion de contraseña sigue limitada a cuentas con correo. `usuarios.html` ya quedo alineado con la base de `Mi Landing` para organizadores (organizacion, lema, contacto publico y logo). La web ya fuerza cierre de sesion por inactividad tras 1 hora, sincroniza ese timeout entre pestañas del navegador y ahora avisa antes de expulsar la sesion. |
| 6 Extras profesionales | Parcial | Exportaciones (PNG/PDF/XLSX) en modulos clave; pendiente notificaciones, auditoria completa y reportes ejecutivos. |
| 7 Modulo financiero | Medio-Alto | Cuenta corriente por equipo (cargos/abonos), estado de cuenta y morosidad operativos con sincronizacion de inscripcion por categoria y conciliacion desde planilla; consolidado TA/TR, resumen ejecutivo por campeonato e impresion dedicadas; politica de morosidad parametrizable (campeonato + override por categoria) aplicada en planilla en modo aviso (sin bloqueo). Pendiente cierre de reglas avanzadas y reporteria ejecutiva adicional. |
| 8 Adaptacion mobile web | En progreso | Plan mobile documentado en `docs/PLAN_MOBILE_LT_C.md`; fase 1 base responsive iniciada en `style.css`/`core.js` (layout, topbar, acciones y sidebar) con cierre parcial en `tablas`, `finanzas`, `partidos` y `planilla`; pendiente cierre de `grupos/eliminatorias/pases` y validacion final en viewports objetivo. |

## Infraestructura de Despliegue
- Render:
  - backend y frontend ya operan por mismo origen en un solo servicio Node.
  - la conexion a PostgreSQL remoto por `DATABASE_URL` y `DATABASE_SSL` ya fue validada en `/salud` y `/testDb`.
  - servicio activo verificado: `https://ltyc.onrender.com`.
- Uploads:
  - el backend ya soporta `UPLOADS_DIR` para desacoplar logos/fotos/documentos del contenedor efimero.
  - `render.yaml` queda preparado para usar disco persistente en `/var/data` con `UPLOADS_DIR=/var/data/uploads`.
  - la migracion `033_campeonatos_tipos_futbol_ampliados.sql` ya fue aplicada en Render para alinear el `CHECK` de `campeonatos.tipo_futbol` con las nuevas modalidades.
  - la migracion `034_organizador_portal_branding.sql` ya fue aplicada en Render para habilitar branding/media/auspiciantes propios por organizador.
  - la migracion `035_campeonato_fondo_carnet.sql` ya fue aplicada en Render para habilitar fondo de carné configurable por campeonato.
  - pendiente operativo: copiar el contenido historico de `backend/uploads/` al disco persistente antes de validar carga completa de imagenes/documentos en produccion.

## Estado Detallado del Alcance Actual

1. Planillaje oficial de partido:
- Flujo directo por `evento -> grupo -> jornada -> partido` con filtro adicional por grupo para carga operativa rapida.
- Captura oficial por jugador (`G`, `TA`, `TR`) para local/visitante.
- Captura de faltas por `1ER` y `2DO` tiempo con persistencia por equipo para tablas de fair play.
- Resultado calculado automaticamente por suma de goles capturados.
- Registro de pagos y observaciones dentro del mismo formulario.
- Inscripcion rapida de jugadores desde la misma planilla, por equipo y sin perder la captura en curso.
- Doble amarilla preservada como evento disciplinario explicito al guardar/reabrir la planilla.
- No presentacion parcial aplicada por lado: solo se bloquea el equipo ausente y el equipo presente mantiene pagos/captura habilitados.
- Doble no presentacion corregida: marcador vacio (`NULL/NULL`), estado `no_presentaron_ambos`, sin sumar partido jugado y manteniendo la multa financiera.
- Edicion de planilla cerrada con auditoria:
  - si la planilla ya esta finalizada, exige motivo de edicion,
  - se registra auditoria con snapshot antes/despues en `partido_planilla_ediciones`.
- Exportacion en XLSX (template oficial) y PDF.
- Vista previa con dos modos: `Formato PDF` y `Resumen anterior`.

2. Jugadores y documentos:
- Gestion por equipo y tambien desde modulo global de jugadores.
- Configuracion por campeonato para requerir o no la cedula de identidad del jugador.
- Configuracion por campeonato para requerir foto de cedula/carnet.
- Nuevos uploads por tipo de documento:
  - `uploads/jugadores/cedulas`,
  - `uploads/jugadores/fotos`.
- La `fecha_nacimiento` ya se renderiza sin desplazar el dia por zona horaria del navegador.
- La `foto carné` puede eliminarse desde el perfil del jugador.
- La `foto carné` ahora puede generar y guardar una version recortada especifica para el carné (`foto_carnet_recorte_url`) sin perder la foto original.
- La misma cedula puede registrarse en distintas categorias del mismo campeonato; el bloqueo solo se aplica cuando intenta quedar en dos equipos de la misma categoria/evento.
- Las cards de jugadores ya muestran hero con `foto carné` o logo del equipo como fallback.
- El ajuste de foto para el carné ya se opera con controles visuales de zoom/posicion sin sliders visibles y la vista previa ahora representa el recorte real mediante `canvas`.
- Los formularios ya permiten apertura directa de camara en celular cuando el navegador soporta `capture`.
- Los carnets se reimprimen regenerando el PDF desde BD + foto/documentos del jugador; no se persiste una imagen final del carnet.
- Los carnets ahora pueden usar un fondo configurable por campeonato como marca de agua, manteniendo el mismo diseño en preview, impresion y PDF.
- Importacion masiva por archivo con normalizacion de encabezados.
- Flujo de importacion de documentos por lote (`ZIP + mapeo por cedula`).

3. Operacion deportiva:
- Sorteo funcional en modos aleatorio, manual y con cabezas de serie.
- Generacion de grupos por evento.
- Generacion de fixture por evento y filtros de consulta.
- Generacion eliminatoria por categoria segun metodo configurado.
- Tablas/estadisticas por evento consumiendo resultados reales.
- Parametro `clasificados_por_grupo` operativo en categoria/evento y reflejado visualmente en tablas.
- Eliminacion automatica por `3` no presentaciones dentro de la categoria (`evento_equipos.no_presentaciones` / `eliminado_automatico`).
- Eliminacion manual por categoria con causales:
  - `indisciplina`,
  - `deudas`,
  - `sin_justificativo_segunda_no_presentacion`.
- Clasificacion manual sugerida por grupo para definir playoff cuando el organizador necesita resolver cupos manualmente.
- Si un clasificado deportivo queda eliminado, el sistema promueve automaticamente al siguiente elegible del grupo.
- Si el grupo no alcanza cupos con sus propios elegibles, el sistema propone mejores no clasificados del evento y permite guardar el criterio del organizador (`decision`, `mejor no clasificado`, `partido extra/reclasificacion`).
- Nuevo reporte operativo de sanciones en `partidos.html` por categoria:
  - suspendidos,
  - acumulacion de amarillas,
  - impresion y exportacion PDF.
- Nueva capa de alertas rapidas en `equipos.html`:
  - resumen operativo de deuda y disciplina,
  - chips por equipo para deuda, suspendidos y seguimiento por TA.
- Nueva capa de alertas rapidas en `partidos.html`:
  - resumen operativo de los equipos de los partidos mostrados,
  - alertas separadas para local y visitante en tarjetas/tabla.

4. Financiero base:
- Registro de movimientos (cargo/abono).
- Estado de cuenta por equipo.
- Reporte de morosidad operativo.
- Sincronizacion automatica de cargos de inscripcion por categoria/equipo.
- Sincronizacion de planilla a finanzas (arbitraje, multas y abonos por equipo).
- Resumen de estado de cuenta por concepto (inscripcion/arbitraje/multas) y total.
- Resumen ejecutivo por campeonato y nuevo consolidado ejecutivo por equipo:
  - saldo actual,
  - abiertos/vencidos,
  - saldo por inscripcion/arbitraje/multas,
  - impresion dedicada.

5. RBAC y separacion de dominios:
- Roles deportivos operativos: `administrador`, `organizador`, `tecnico`, `dirigente`.
- Nuevo rol objetivo para CMS publico: `operador`.
- Fase 1 iniciada para separar:
  - `portal deportivo`,
  - `portal web publico / CMS`.
- Cambio de contraseña propio disponible para cuentas autenticadas.
- Boton visible `Salir` agregado a la topbar del sistema deportivo, junto al badge del usuario, manteniendo tambien la accion en sidebar.
- Timeout de sesion por inactividad de `1 hora` operativo en web, con advertencia previa y aviso al volver a login.
- Cuentas creadas por administrador/organizador quedan en estado `debe_cambiar_password` hasta que el usuario defina su clave.
- Noticias quedan definidas como contenido institucional del portal, no como modulo del organizador.
- Nuevo modulo `Mi Landing` para organizadores con gestion de branding y publicidad publica.

6. CMS del portal publico:
- Noticias/blog con CRUD base, vistas publicas y detalle por `slug`.
- Galeria institucional con base de administracion y render publico en landing.
- Contenido institucional editable:
  - hero principal,
  - seccion Nosotros,
  - cards del home,
  - datos y redes de contacto.
- Formulario de contacto persistente con seguimiento basico por estado.

7. Portal deportivo publico:
- El listado general ya muestra campeonatos de cuentas `organizador` y registros legacy con `organizador` informado.
- Quedan fuera del portal general:
  - campeonatos creados por `administrador`,
  - campeonatos de QA ligados a cuentas administrativas.
- La landing publica del organizador ya muestra:
  - cards reales visibles del organizador,
  - torneos proximos/inscripcion creados desde el sistema,
  - nombre del organizador sobre el nombre del campeonato.
- Los auspiciantes del organizador ya quedan separados de los auspiciantes institucionales LT&C.
- Las cards y el detalle publico del campeonato ya pueden consumir media publica propia del organizador/campeonato.
- Los endpoints publicos de:
  - `goleadores`,
  - `tarjetas`,
  - `fair play`,
  ya quedaron encapsulados bajo `publicPortalController` para respetar el mismo filtro publico por campeonato/evento.
- La vista publica del torneo ya usa navegacion por:
  - tabs de categoria,
  - subtabs deportivas separadas,
  - tablas de posiciones agrupadas en layout `2x1` en escritorio y `1x1` en movil.
- Las cards del portal ya muestran resumen de categorias con cantidad de equipos.
- El detalle publico compartible del campeonato ya puede abrirse de forma directa en:
  - `portal.html?campeonato=<id>`
- La pagina compartible ya incluye:
  - header completo,
  - tabs/subtabs deportivas,
  - auspiciantes del campeonato,
  - footer institucional.
- El endpoint publico de auspiciantes ya soporta fallback por filesystem cuando no existen relaciones cargadas en BD.
- Endpoint publico agregado para auspiciantes:
  - `/api/public/campeonatos/:campeonato_id/auspiciantes`

## Pendientes Prioritarios Recomendados

0. Despliegue inicial (prioridad inmediata):
- Base tecnica ya preparada para Render con:
  - `docs/DEPLOY_RENDER.md`,
  - `render.yaml`,
  - soporte `DATABASE_URL` + mismo origen en frontend.
- Pendiente operativo:
  - desplegar servicio,
  - cargar BD remota,
  - definir estrategia persistente para `uploads`.

1. Cierre de planillaje oficial (prioridad alta):
- Pulido UX final del formulario para operacion en campo.
- Ajustes finos de impresion A4 en ambos modelos.
- Extender visibilidad de sanciones/suspendidos fuera de `planilla.html`:
  - listado por jugador en `jugadores.html` ya visible,
  - reporte disciplinario por equipo ya disponible en `jugadores.html`,
  - consolidado global de sanciones/suspensiones por categoria/equipo ya disponible en `jugadores.html`,
  - reporte operativo adicional ya disponible en `partidos.html`,
  - alertas rapidas en `equipos.html` ya disponibles,
  - alertas rapidas en listado de `partidos.html` ya disponibles,
  - pendiente seguir llevandolo a otros reportes/alertas donde haga falta.

2. Pruebas E2E con datos reales (prioridad alta):
- Flujo completo: campeonato -> evento -> equipos -> sorteo -> grupos -> fixture -> planilla -> tablas.
- Script operativo disponible (solo lectura): `npm run e2e:ops-flow` para validar rapidamente el dataset real sin modificar datos.

3. Modulo financiero completo (prioridad alta):
- Reglas base ya incorporadas desde planilla para:
  - walkover / no presentacion,
  - doble amarilla convertida en roja,
  - roja directa y acumulacion de amarillas en futbol 11 para suspensiones visibles en planilla.
- Pendiente completar:
  - consolidado financiero/disciplinario por sanciones ya disponible en `finanzas.html` (bloque `Consolidado de Sanciones TA/TR` + impresion),
  - salida ejecutiva global por campeonato ya disponible en `finanzas.html` (bloque `Resumen Ejecutivo por Campeonato` + impresion),
  - salida ejecutiva por equipo ya disponible en `finanzas.html` (bloque `Resumen Ejecutivo por Equipo` + impresion),
  - politica por morosidad parametrizable ya aplicada en guardado de planilla (campeonato + override categoria) en modo aviso,
  - pendiente definir si se mantiene solo informativo o se aplica bloqueo en otros flujos operativos,
  - pendiente extender a reportes ejecutivos historicos/comparativos por periodos si el cliente lo requiere.

4. Seguridad y roles:
- Consolidar separacion final entre roles deportivos y CMS institucional.
- Completar panel propio del `operador` con modulos editoriales.
- Completar pruebas reales por rol para `administrador` y `operador` en:
  - noticias,
  - galeria,
  - contenido portal,
  - contacto.
- Validar con usuarios reales si la advertencia previa de inactividad (actualmente `5 minutos`) necesita otro umbral.
- Ejecutar la migracion `031_usuarios_cambio_password_obligatorio.sql` en todos los entornos y validar el flujo de primer ingreso con cambio obligatorio.
- Extender portal de organizador para gestion de usuarios internos:
  - alta de dirigentes,
  - alta de tecnicos.
- Mantener fuera del organizador los modulos:
  - noticias,
  - galeria,
  - nosotros,
  - contacto institucional.
- Completar onboarding comercial de planes pagados:
  - desde card de plan -> registro con datos de organizacion (`nombre organizacion` obligatorio, `logo` opcional, `lema` opcional),
  - paso a formulario/pagina de cobro,
  - integracion con pasarela de pago y confirmacion de activacion de plan.
- Revisar si la proteccion visual de rutas privadas debe extenderse con skeleton/spinner para evitar pantalla en blanco mientras se valida sesion.

5. Eliminatorias:
- Validar con datos reales la nueva clasificacion manual sugerida, la promocion automatica de elegibles y el reemplazo manual de clasificados antes de cierre definitivo del modulo.
- Definir si el criterio `partido_extra_reclasificacion` generara un partido automaticamente en fixture o si quedara como solo trazabilidad de decision.
- Consolidar reglas avanzadas de desempate y cierre visual final del bracket.
- `tabla acumulada` ya quedo disponible como metodo visible para eventos:
  - pendiente validar con dataset real el flujo completo `grupos -> ranking global -> llaves`.

6. Modulo de pases (nuevo):
- Pantalla de gestion (`pases.html`) implementada con filtros, registro y aprobacion/anulacion de pase.
- Salida contable en finanzas integrada (ingreso/egreso por pase) con movimientos idempotentes por `origen_clave`.
- Historial de pases por jugador y por equipo implementado (resumen + detalle, con filtros por campeonato/categoria/estado).

7. Auditoria y trazabilidad:
- Registro de cambios en fixture, planilla, sanciones y finanzas.

8. Roadmap mobile:
- Reorientar ejecucion de `docs/PLAN_MOBILE_LT_C.md` a app movil publicable en tiendas.
- Objetivo de salida:
  - Android (Play Store),
  - iOS (App Store).

9. Auspiciantes (calidad de datos):
- Migrar/cargar auspiciantes por campeonato en tabla `campeonato_auspiciantes` para no depender de fallback por filesystem.
- Mantener consistencia entre logos en `uploads` y registros de BD (nombre, orden, activo, campeonato).
- Validar visualmente la nueva seccion publica de auspiciantes por campeonato en `portal.html?campeonato=<id>`.
- En Render, copiar el contenido real de `uploads/auspiciantes` al almacenamiento persistente para que el fallback muestre logos en produccion.

10. Jugadores / carnés:
- La `Planilla del jugador` ya esta disponible en reportes de `jugadores.html`.
- El ajuste de foto para carné ya soporta:
  - horizontal,
  - vertical,
  - zoom,
  - control direccional.
- Pendiente:
  - validar visualmente en pruebas de campo la comodidad del ajuste desde movil,
  - ejecutar la migracion formal `038_jugadores_foto_carnet_zoom.sql` sobre la BD de Render si se requiere dejarla sincronizada sin depender del endurecimiento de esquema por uso.

11. Migraciones recientes:
- `037_eventos_clasificacion_tabla_acumulada.sql`
- `038_jugadores_foto_carnet_zoom.sql`
- Estado:
  - aplicadas y verificadas en BD local,
  - versionadas en repo para despliegue,
  - en Render quedan cubiertas por el endurecimiento de esquema del backend en los modulos afectados, pero sigue siendo recomendable ejecutar la migracion formal directa cuando se tenga acceso operativo a esa BD.

## Documentacion Operativa Vinculada
- Bitacora de sesion y continuidad: `docs/BITACORA_AVANCES.md`
- Historial de cambios implementados: `docs/CAMBIOS_IMPLEMENTADOS.md`
- Propuesta funcional original: `docs/propuestaDesarrolloSGD.md`
- Plan mobile web: `docs/PLAN_MOBILE_LT_C.md`
- Plan CMS del portal publico: `docs/PLAN_CMS_PORTAL_PUBLICO.md`
