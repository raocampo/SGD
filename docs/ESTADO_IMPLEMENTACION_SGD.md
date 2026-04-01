# Estado de Implementacion SGD - LT&C

Ultima actualizacion: 2026-03-31 (sesión 20)

## Portal público - ajuste reciente

- Resuelto el fallo que dejaba campeonatos sin jornadas/resultados por una consulta incompleta en `Partido.obtenerPorEvento...` al referenciar `pe.*` sin `JOIN`.
- El portal público ahora reconoce partidos con `planilla` guardada como información deportiva publicada, incluso si el organizador todavía no cerró el `estado` en `finalizado`.
- Impacto esperado en Render: vuelven a aparecer las jornadas y la subtab `Resultados` ya no se queda vacía en categorías con planillas registradas.
# Estado de Implementacion vs Propuesta LT&C

Ultima actualizacion: 2026-03-30 (sesión 18)
Documento base revisado: `docs/propuestaDesarrolloSGD.md`

## Resumen por Modulo

| Modulo | Estado | Avance actual |
|---|---|---|
| 3.1 Gestion de Torneos/Campeonatos | Parcial-Alto | CRUD y estados operativos, organizador/logo/colores; tipos de futbol ampliados (`futbol_11`, `futbol_9`, `futbol_8`, `futbol_7`, `futbol_6`, `futbol_5`, `futsala`, `indor`) y fondo de carné configurable por campeonato; pendiente reglamento PDF/bases y sedes multiples. |
| 3.2 Categorias por torneo | Alto | Eventos/categorias por campeonato funcionales con asignacion de equipos, parametro `clasificados_por_grupo`, configuracion inicial de playoff (`playoff_plantilla`, `playoff_tercer_puesto`) y reglas etarias por categoría (`categoria_juvenil`, cupos juveniles, diferencia máxima permitida y control de edad visible en carné). |
| 3.3 Gestion de Equipos | Alto | Registro completo con logo/contacto/colores, asignacion por evento, flujo hacia sorteo y vista Tarjetas/Tabla. |
| 3.4 Gestion de Jugadores | Alto | CRUD por equipo y acceso global; validacion de jugador unico por categoria/evento (ya no por campeonato completo), permitiendo la misma cedula en distintas categorias. La validacion ya toma el `evento_id` actual enviado por la UI, evitando falsos bloqueos cuando el equipo participa en varias categorias. `jugadores` ya incorpora `evento_id` para separar la nomina por categoria real; lectura de plantel, conteo maximo, numero de camiseta, capitania y planilla ya se resuelven con ese contexto. La restriccion vieja `jugadores_dni_key UNIQUE (cedidentidad)` fue reemplazada por un indice unico por `cedidentidad + evento_id`, con lo que la misma cédula ya puede repetirse en categorias distintas manteniendo el bloqueo dentro de la misma categoria. Para equipos de una sola categoria se mantiene compatibilidad legacy con filas `evento_id IS NULL`; para equipos de multiples categorias, la lectura se fuerza al `evento_id` actual para evitar compartir roster. Documentos opcionales/requeridos segun campeonato; cedula configurable como obligatoria/opcional por campeonato; importacion masiva y reportes. Uploads reorganizados por tipo (`jugadores/cedulas`, `jugadores/fotos`) sin romper carnés ni reporteria; fecha de nacimiento ya no sufre desfase por zona horaria, la `foto carné` puede borrarse desde el perfil del jugador y las cards/fichas ya usan hero con foto o logo de equipo como fallback. El guardado multipart ya usa cliente autenticado, el backend responde errores amigables de subida y el limite de imagenes se amplio a `8MB`. Los carnés ya soportan fondo configurable por campeonato mezclando imagen, logo y colores institucionales, y ahora guardan un recorte estable (`foto_carnet_recorte_url`) para evitar desfases entre preview y PDF; el ajuste de encuadre ya soporta arrastre directo, guía visual y restablecimiento rapido. La gestión etaria por categoría ya valida jugadores juveniles para categorías `Sub/U 30` a `Sub/U 60`, controla cupos juveniles por equipo y permite que tarjetas, tabla y carné muestren edad/condición juvenil cuando corresponde. Modulo de pases con UI operativa, sincronizacion contable integrada (cargo/abono por pase) e historial visual por jugador/equipo. `jugadores.html` ya incorpora `Nómina simple de jugadores` y exportación `Excel` para nómina oficial/simple, sanciones y ficha individual. |
| 3.5 Creacion de Grupos | Alto | Modo aleatorio, cabezas de serie y manual con ruleta funcionando. |
| 3.6 Generacion de Fixture | Alto | Generacion por evento, filtros por grupo/jornada/fecha, vista plantilla y exportaciones. Eliminacion de fixture con confirmacion ante partidos finalizados. Regeneracion preservando partidos jugados: ahora preserva tambien `programado`, `suspendido`, `aplazado`, `en_curso`; elimina solo `pendiente`; las jornadas ya calendarizadas no se tocan al agregar un equipo nuevo. Creacion de partido manual por administrador (modal con dropdowns de equipos del evento, jornada, fecha, hora, cancha y `N° visible del partido`). Edicion de equipos de un partido (solo administrador, via dropdowns en modal Editar) y edición del número visible operativo sin tocar el identificador interno de auditoría. Badge de estado coloreado en cada card de partido. Equipo que descansa (bye) calculado automaticamente y mostrado en: listing de gestion, fixture exportable y portal publico. Auto-estado: al programar fecha pasa a `programado`; al borrarla vuelve a `pendiente`; estado manual explícito disponible (suspendido/aplazado/en_curso). |
| 3.7 Resultados/Tablas/Clasificados | Alto | Tablas por evento (posiciones, goleadores, tarjetas, fair play) con selector de campeonato en UI y guardado explícito del formato de clasificación (`metodo_competencia` + `clasificados_por_grupo`). Planillaje ya alimenta resultado + estadisticas. Clasificacion por grupo parametrizable; equipos eliminados ya bajan al final aunque tengan mayor puntaje y los fuera de cupo quedan diferenciados visualmente en naranja. El administrador ya puede corregir manualmente la tabla con comentario obligatorio y auditoria persistente; si cambia puntos/estadisticas, la posicion se recalcula automaticamente y la posicion manual queda como desempate final. La invalidacion automática por nuevos resultados ahora respeta el grupo afectado: ya no elimina tablas manuales de otros grupos del mismo evento. Pendiente refinamiento de desempates avanzados. |
| 3.8 Eliminatorias | Alto | Configuracion por categoria (`metodo_competencia`) y generacion automatica de llave integrada en `partidos`; soporte de siembra/byes/progresion de ganador; UI dedicada de llaves en `eliminatorias.html`; playoff desde grupos con `clasificados por grupo`, `cruces de grupos` o `tabla unica`; configuracion compartida con `tablas.html`; nueva clasificacion manual sugerida por grupo con candidatos externos del evento cuando el grupo queda incompleto, exclusion de equipos eliminados manualmente y reclasificacion por vacante real antes de cerrar la llave. La reclasificacion ya genera un `partido` operativo enlazado para verse en `partidos.html` y registrar `planilla.html`, sincronizando el ganador al cerrar el partido. Tambien quedan disponibles las plantillas `Evitar reencuentros tempranos de grupo (balanceada)` y `Mejores perdedores (24 -> 12vos -> 8vos)`, ademas de la opcion de `Tercer y cuarto puesto` enlazando perdedores de semifinal. La UI de playoff ya soporta `clasificados_por_grupo` mayores a `6`, hereda correctamente valores altos (ej. `8`) desde la categoria y muestra una vista previa del orden real de partidos cuando aplica la plantilla balanceada, tanto para `4 grupos x 4 clasificados` (sugiriendo `A-C / B-D`) como para `2 grupos x N clasificados` con sembrado espejo `A/B` (ej. `1A-8B`, `2B-7A`, `3A-6B`, `4B-5A`). Cuando el playoff arranca en `8vos`, la vista previa ya se dibuja como grilla tipo bracket para acercarse al diagrama operativo que usa organización. La categoría pasó a ser la fuente de verdad para `playoff_plantilla` y `playoff_tercer_puesto`; si existe una fila antigua en `evento_playoff_config`, ya no pisa visualmente la configuración actual del evento. Además, la propia llave ya permite edición manual básica de cruces pendientes (`Editar cruce`) con validación para no repetir equipos en la misma ronda y mantener los `seed_ref` alineados con la nueva asignación. La plantilla publicable ya incorpora fondo personalizable, conectores SVG reforzados, anchos dinámicos por el nombre más largo y un bloque `Tercer y cuarto` compacto debajo de `Final` para exportar `PNG/PDF` sin desbordes; cuando los cruces ya están programados, la imagen publicable ahora incluye `fecha`, `hora` y `cancha` dentro del nodo. `planilla.html` ya soporta fase `Playoff` con selector por ronda y lectura real de partidos de llave/reclasificación. La planilla de playoff ya soporta desempate por penales y el portal público ya muestra el resumen del desempate cuando corresponde. Pendiente validación operativa real en campeonatos activos, recomposición de llaves afectadas en producción y cierre de formatos no potencia de 2 adicionales si el cliente los confirma. |
| 4 Portal publico | Alto | Portal operativo con vistas publicas deportivas e institucionales; el listado general expone campeonatos de organizadores reales y tambien registros legacy con `organizador` informado, manteniendo fuera `administrador`/QA. La landing publica de organizador ya no mezcla torneos por alias de texto y ya muestra todas las cards reales visibles del organizador, incluidos torneos proximos/inscripcion. El detalle del campeonato muestra tabs por categoria con subtabs de `Jornadas`, `Resultados`, `Tabla de posiciones`, `Goleadores`, `Fair play`, `Tarjetas amarillas`, `Tarjetas rojas` y `Playoff`. Las tablas de posiciones publicas ya salen en grid `2 columnas` desktop / `1 columna` movil, replican estados competitivos (fuera de clasificacion / eliminado) y excluyen eliminados del ranking de `Fair Play`. La pestaña `Playoff` ahora valida la llave guardada contra la clasificacion vigente y deja de publicarla si detecta equipos eliminados, vacantes o reclasificaciones pendientes. Ademas queda operativa la base de branding/publicidad por organizador (`Mi Landing`) con auspiciantes y media publica separados de LT&C. Control de jornadas visibles por evento: el organizador puede habilitar/deshabilitar jornadas especificas desde el portal de organizador (`portal_jornadas_habilitadas`); `null` muestra todas (backward compat), lista vacia oculta todo. Subtab Jornadas: muestra partidos pendientes/programados con logos de equipos, selector J1..Jn (deshabilitado si no tiene programados o si ya esta finalizada), card centrada max-width 680px. Subtab Resultados: muestra jornadas completamente finalizadas. Auto-seleccion de jornada activa: primera con partidos en `estado='programado'`. Fechas corregidas: `parseFechaLocalPortal()` captura tanto `YYYY-MM-DD` como `YYYY-MM-DDT00:00:00.000Z` (formato pg) para evitar desfase UTC. |
| 5 Roles y permisos (RBAC) | Medio-Alto | Autenticacion operativa; fase 1 de separacion de dominios iniciada con rol `operador` para CMS publico; rol `jugador` agregado para consulta de equipo en modo solo lectura; noticias, galeria, contenido y contacto institucional fuera del alcance de organizadores; smokes RBAC (`npm run smoke:roles`, `npm run smoke:matrix`, `npm run smoke:frontend`) operativos para validacion rapida por rol. Se agrega bandera `debe_cambiar_password`, cambio obligatorio de clave al primer ingreso para cuentas creadas por admin/organizador y accion de cambio de contraseña propio desde UI. Las cuentas internas ya pueden autenticarse con `correo o username`; la recuperacion de contraseña sigue limitada a cuentas con correo. `usuarios.html` ya quedo alineado con la base de `Mi Landing` para organizadores (organizacion, lema, contacto publico y logo). La web ya fuerza cierre de sesion por inactividad tras 1 hora, sincroniza ese timeout entre pestañas del navegador y ahora avisa antes de expulsar la sesion. |
| 6 Extras profesionales | Parcial-Alto | Exportaciones (PNG/PDF/XLSX) en modulos clave. Plantillas de publicacion con 3 temas visuales (Oscuro/Clasico/Colores del torneo) aplicables a posters de grupos y fixture. Nueva pagina `jornadasplantilla.html` para exportar programacion de jornada como poster (PNG/PDF), incluyendo modo `playoff` por ronda. Se corrige la exportación de grupos para evitar doble render/doble descarga con `html2canvas`. Seleccion individual de carnets para imprimir/exportar. Pendiente notificaciones, auditoria completa y reportes ejecutivos. |
| 7 Modulo financiero | Medio-Alto | Cuenta corriente por equipo (cargos/abonos), estado de cuenta y morosidad operativos con sincronizacion de inscripcion por categoria y conciliacion desde planilla; consolidado TA/TR, resumen ejecutivo por campeonato e impresion dedicadas; politica de morosidad parametrizable (campeonato + override por categoria) aplicada en planilla en modo aviso (sin bloqueo). El modulo de `gastos_operativos` ya quedó endurecido para organizadores: listar, editar, eliminar y resumir se limita solo a campeonatos propios, incluso cuando la UI no envía un `campeonato_id` puntual. Pendiente cierre de reglas avanzadas y reporteria ejecutiva adicional. |
| 8 Adaptacion mobile web | En progreso | Plan mobile documentado en `docs/PLAN_MOBILE_LT_C.md`; fase 1 base responsive iniciada en `style.css`/`core.js` (layout, topbar, acciones y sidebar) con cierre parcial en `tablas`, `finanzas`, `partidos` y `planilla`; fase 1 cerrada para `grupos`, `eliminatorias` y `pases` (bracket con scroll horizontal, pases con tabla scrolleable y layout 1 col ≤480px); sesión 13: clases `page-*` añadidas a `campeonatos`, `equipos`, `eventos`, `usuarios`; grid de listas corregido para no desbordar en pantallas <313px; botones de card-actions al 100% de ancho en ≤520px; tabla de usuarios con scroll horizontal explícito. |

## Navegacion Interna y Seguridad Visual
- El sistema deportivo ya oculta el contexto operativo principal de la barra del navegador para los modulos internos.
- La navegacion ahora usa `RouteContext` en `sessionStorage` para mantener:
  - campeonato,
  - evento,
  - equipo,
  - partido,
  - filtros de fixture/playoff.
- Flujos ya cubiertos:
  - `campeonatos -> eventos -> equipos -> jugadores`
  - `equipos -> sorteo -> grupos -> playoff`
  - `partidos -> planilla / fixture plantilla / eliminatorias`
  - `planilla -> partidos`
  - `tablas`
- Aclaracion tecnica:
  - ocultar la query string mejora UX y reduce exposicion visual de IDs,
  - la seguridad real sigue dependiendo del backend (token, rol y permisos sobre campeonato/evento/equipo).

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
- la migracion `039_jugadores_foto_carnet_recorte.sql` ya fue aplicada en Render para persistir el recorte estable de foto de carné.
- las migraciones `040_tablas_posiciones_manual_y_auditoria.sql` y `041_reclasificacion_playoff_vacantes.sql` ya fueron aplicadas en Render para alinear:
  - edicion manual de tablas con auditoria,
  - reclasificaciones playoff por vacante real.
- la migracion `042_reclasificacion_playoff_partido_operativo.sql` ya fue aplicada en Render para enlazar cada reclasificacion playoff con un partido real y su planilla operativa.
- las migraciones `043_evento_playoff_templates_y_tercer_puesto.sql` y `044_partidos_eliminatoria_fuente_ganador_perdedor.sql` ya fueron aplicadas en Render para alinear:
  - configuracion inicial de plantilla de playoff por categoria,
  - partido de tercer puesto,
  - propagacion de ganador/perdedor en slots de eliminatoria.
- la migracion `045_jugadores_evento_categoria.sql` ya fue aplicada en BD local y Render para separar la nomina por categoria.
- la migracion `046_jugadores_cedula_por_evento.sql` ya fue aplicada en BD local y Render para reemplazar la unicidad global de cédula por una unicidad `cedidentidad + evento_id`.
- la migracion `050_eventos_juvenil_cupos_y_carnet_edad.sql` ya fue aplicada en BD local y Render para habilitar:
  - cupos juveniles por categoría,
  - diferencia máxima juvenil,
  - impresión de edad en carné.
- las migraciones `051_roles_operador_sistema.sql`, `052_configuracion_sistema.sql`, `053_formas_pago.sql` y `054_formas_pago_paypal_tarjeta.sql` ya están alineadas en BD local y Render.
- la migracion `055_plan_estado_pendiente_pago.sql` ya fue aplicada en BD local y Render para permitir el estado `pendiente_pago` en usuarios.
- la migracion  56_gastos_operativos.sql ya fue aplicada en BD local y Render para habilitar el registro de gastos operativos del organizador.
- la migracion  57_fix_fk_on_delete_set_null.sql ya fue aplicada y verificada en BD local y Render para asegurar ON DELETE SET NULL en goleadores.jugador_id y 	arjetas.jugador_id.
- pendiente operativo: copiar el contenido historico de `backend/uploads/` al disco persistente antes de validar carga completa de imagenes/documentos en produccion.

## Estado Detallado del Alcance Actual

1. Planillaje oficial de partido:
- La planilla de `playoff` ya soporta captura de `penales`; si el partido termina empatado, el sistema exige el desempate, clasifica al ganador y refleja ese resumen en cabecera, vista previa y PDF.
- Flujo directo por `evento -> grupo -> jornada -> partido` con filtro adicional por grupo para carga operativa rapida.
- Captura oficial por jugador (`G`, `TA`, `TR`) para local/visitante.
- Captura de faltas por `1ER` y `2DO` tiempo con persistencia por equipo para tablas de fair play.
- Resultado calculado automaticamente por suma de goles capturados.
- Registro de pagos y observaciones dentro del mismo formulario.
- En `futbol 11`, la planilla ya soporta terna arbitral:
  - `arbitro central`,
  - `arbitro linea 1`,
  - `arbitro linea 2`.
- Las observaciones ya quedan separadas por actor:
  - `observacion local`,
  - `observacion visitante`,
  - `observacion arbitro`.
- En impresion/PDF oficial:
  - `Delegado` ya no se repite,
  - `liga` se imprime como `Liga`,
  - las observaciones ya salen en una segunda hoja, una debajo de otra y a ancho completo.
- La cantidad de filas del plantel ya usa `max_jugador` del campeonato/categoria, soportando `25` jugadores en `futbol 11` cuando así fue configurado.
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
- El ajuste del recorte ya permite arrastrar la imagen con mouse o dedo, muestra guía visual del rostro y permite restablecer el encuadre base en un clic.
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
- Correccion manual de tabla de posiciones solo para `administrador`, con comentario obligatorio y auditoria por snapshot en:
  - `tabla_posiciones_manuales`,
  - `tabla_posiciones_auditoria`.
- Parametro `clasificados_por_grupo` operativo en categoria/evento y reflejado visualmente en tablas.
- Eliminacion automatica por `3` no presentaciones dentro de la categoria (`evento_equipos.no_presentaciones` / `eliminado_automatico`).
- Eliminacion manual por categoria con causales:
  - `indisciplina`,
  - `deudas`,
  - `sin_justificativo_segunda_no_presentacion`.
- Clasificacion manual sugerida por grupo para definir playoff cuando el organizador necesita resolver cupos manualmente.
- Si un clasificado deportivo queda eliminado, el sistema promueve automaticamente al siguiente elegible del grupo.
- Si el grupo no alcanza cupos con sus propios elegibles, el sistema propone mejores no clasificados del evento y permite guardar el criterio del organizador (`decision`, `mejor no clasificado`, `partido extra/reclasificacion`).
- Si el criterio elegido es `partido extra/reclasificacion` y existe una vacante real, el sistema crea una reclasificacion formal por cupo en `evento_reclasificaciones_playoff`, exige resolver su ganador y bloquea la generacion de la llave hasta cerrar ese cupo.
- Cada reclasificacion por vacante ya crea y enlaza un partido real (`partido_id`) para que el organizador pueda:
  - verlo en `partidos.html`,
  - abrir la `planilla`,
  - registrar el resultado del partido extra sin resolverlo manualmente fuera del flujo deportivo.
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
- `npm run qa:ui-dataset` tambien queda operativo para validar dataset mobile/web/publico sobre un campeonato visible.
- Ambos scripts ya autodetectan un campeonato/evento publico valido cuando el primer campeonato del administrador corresponde a QA o entorno interno.

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
- Validar con usuarios reales si el nuevo flujo de recorte por arrastre + guía visual cubre casos difíciles de rostro inclinado o si conviene sumar rotación/reencuadre avanzado.
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
- Recomponer y validar la llave de playoff en los campeonatos afectados de producción antes de continuar la operación deportiva, asegurando que los cruces recuperados queden visibles y consistentes en módulo interno y portal público.
- Validar con datos reales la nueva clasificacion manual sugerida, la promocion automatica de elegibles y el reemplazo manual de clasificados antes de cierre definitivo del modulo.
- Validar con usuarios reales si la reclasificacion por vacante debe seguir resolviendose desde `eliminatorias.html` o si conviene dar el siguiente paso y generar un partido operativo programable en fixture/planilla.
- Consolidar reglas avanzadas de desempate y cierre visual final del bracket.
- `tabla acumulada` ya quedo disponible como metodo visible para eventos:
  - pendiente validar con dataset real el flujo completo `grupos -> ranking global -> llaves`.
- `playoff_plantilla=balanceada_8vos` ya cubre formato balanceado en:
  - `4 grupos x 4 clasificados` con vista previa `P1..P8`,
  - `2 grupos x N clasificados` usando sembrado espejo `A/B`.
  - pendiente validar con datos reales de campeonato activo si hace falta sumar mas plantillas predefinidas (por ejemplo 32avos balanceados u otros cruces personalizados).
- `playoff_tercer_puesto` ya puede activarse por categoria:
  - pendiente validar con usuarios reales si siempre debe mostrarse o si conviene condicionarlo por etapa/cantidad de equipos.
- `eliminatorias.html` ya fue reorganizado en pestañas (`Configuración de llave`, `Estado competitivo`, `Clasificación manual`, `Playoff / Llave`) y la programación abre en modal real:
  - pendiente QA visual de flujo completo con organizadores reales.
- La plantilla publicable del playoff ya quedó alineada con el borrador para el caso `8vos -> 4tos -> semifinal -> final`:
  - pendiente validar en producción la exportación `PNG/PDF` y decidir si hace falta un nivel extra de detalle en conectores estilo broadcast.

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
- `037_eventos_clasificacion_tabla_acumulada.sql` — columna `clasificacion_tabla_acumulada` manejada via `ALTER TABLE IF NOT EXISTS` inline en `eventoController.js`; aplicada automaticamente en Render al primer uso.
- `038_jugadores_foto_carnet_zoom.sql` — columna `foto_carnet_zoom` manejada via `ALTER TABLE IF NOT EXISTS` inline en `Jugador.js`; aplicada automaticamente en Render al primer uso.
- `043_evento_playoff_templates_y_tercer_puesto.sql`
- `044_partidos_eliminatoria_fuente_ganador_perdedor.sql`
- Estado:
  - `037` y `038`: aplicadas en BD local y en Render (via inline ALTER TABLE IF NOT EXISTS; no requieren ejecucion manual).
  - `043` y `044`: aplicadas formalmente en BD local y en PostgreSQL de Render.
  - `045` y `046`: aplicadas formalmente en BD local y en Render.
  - `portal_jornadas_habilitadas` (sin numero de migracion): inline en `organizadorPortalController.js`; aplicada automaticamente en Render.

12. Tablas manuales:
- La correccion manual de posiciones ya recalcula automaticamente:
  - `PJ`
  - `DG`
  - `PTS`
- Esto evita que una tabla manual quede con `PG/PE/PP` actualizados pero `PTS` viejo.
- El recalculo vive tanto en frontend como en backend para mantener consistencia entre entorno local y Render.
- Quedo corregida ademas la regresion publica posterior al ajuste:
  - `portal.html`, tablas publicas y calculo de clasificados vuelven a responder correctamente,
  - tanto en local como en Render.

13. Eliminatorias - siguiente validacion ya definida:
- Validar en torneo real la nueva plantilla `Mejores perdedores (24 -> 12vos -> 8vos)`.
- Confirmar si el emparejamiento de `8vos` queda aprobado con este criterio:
  - `W12-1 vs MP4`
  - `W12-2 vs MP3`
  - `W12-3 vs MP2`
  - `W12-4 vs MP1`
  - el resto entre ganadores de `12vos`.
- Si el cliente necesita plantillas equivalentes para `20`, `12` u otros cupos no potencia de 2, extender la misma logica sin romper el flujo ya estable de 24 equipos.

14. Portal público / plantillas de exportación (pendiente sesión 5):
- **A) Carnet individual**: agregar dropdown "Jugador:" en toolbar de carnets para filtrar e imprimir solo el carnet de un jugador específico (en lugar de todo el equipo). Simple cambio en `jugadores.html` + `jugadores.js`.
- **B) Tema/fondo para exportación de fixture**: ya implementado con carga local, persistencia por contexto y exportación compatible con `PNG/PDF`.
- **C) Plantilla exportable de jornadas**: nueva página `jornadadplantilla.html` similar a `fixtureplantilla.html` mostrando partidos de una jornada con logo de equipos, fecha/hora/cancha, lista para compartir en redes.
- **D) Tema aplicado a grupos**: ya implementado con carga local, persistencia por contexto y exportación/compartir con fondo personalizado.

15. Fixture / validación operativa con campeonato real (pendiente sesión 5):
- Verificar bye/descansa en portal público con campeonato activo real (11 equipos, Academia Pedro Larrea en J1).
- Probar botón "Crear Partido Manual" para construir J1 completa.
- Probar edición de equipos en partido como administrador.
- Confirmar que "Regenerar (preservar jugados)" respeta J1 programada y genera J2-Jn correctamente.

16. Portal público / playoff:
- La subtab pública `Playoff` ya muestra la metadata del partido enlazado:
  - estado,
  - fecha,
  - hora,
  - cancha,
  - jornada.
- Pendiente:
  - confirmar con operación real que todos los cruces relevantes estén efectivamente programados antes de publicar,
  - validar que la nueva plantilla publicable mantenga legibilidad con logos largos o equipos con nombres extensos,
  - revisar si conviene incorporar una variante adicional de arte para `12vos` / `32avos`.

17. Publicación visual de posters:
- `fixtureplantilla.html` y `gruposgen.html` ya soportan fondo personalizado por imagen local:
  - guardado en `localStorage`,
  - aplicado por contexto,
  - exportable a `PNG/PDF`.
- Pendiente:
  - validar contraste con fondos reales cargados por usuarios,
  - revisar si conviene agregar presets de overlay claro/oscuro además del tema actual,
  - decidir si este mismo patrón se replica luego a más posters del sistema.

18. Landing del organizador:
- Ya existe un bloque público para bienvenida a equipos participantes:
  - título,
  - descripción,
  - imagen,
  - listado de equipos visibles por campeonato.
- Estado:
  - implementado en backend y frontend,
  - validado en local,
  - migración `049` aplicada formalmente también en Render,
  - ajustado el refresh de `index.html` para no reabrir el último torneo por contexto persistido.

19. Categorías juveniles / carnés:
- Ya existe el flag `categoria_juvenil` en eventos.
- Cuando la categoría es juvenil, el carné muestra:
  - fecha de nacimiento,
  - edad.
- Estado:
  - implementado y validado en local.

20. Servicio de transmisión de partidos:
- Ya existe plan funcional/documental inicial en `docs/PLAN_TRANSMISION_PARTIDOS.md`.
- Estado:
  - diseño funcional listo,
  - sin implementación de backend/frontend todavía.
- Siguiente fase recomendada:
  - Fase 1 operativa con tabla `partido_transmisiones`, endpoints básicos y bloque público `Próxima transmisión`.

21. Fixture / sincronización de fechas:
- Ya quedó corregida la sincronización de fechas de campeonato a categorías que seguían heredando esas fechas.
- Ya existe selección explícita de:
  - programación automática,
  - programación manual.
- En automático, cuando la ventana no alcanza:
  - se programan los partidos posibles,
  - el resto queda sin fecha/hora/cancha para edición manual,
  - el sistema informa el resumen de capacidad.
- La BD local fue realineada con un dump actualizado de Render para seguir validando sobre datos reales de producción.

## Documentacion Operativa Vinculada
- Bitacora de sesion y continuidad: `docs/BITACORA_AVANCES.md`
- Historial de cambios implementados: `docs/CAMBIOS_IMPLEMENTADOS.md`
- Propuesta funcional original: `docs/propuestaDesarrolloSGD.md`
- Plan mobile web: `docs/PLAN_MOBILE_LT_C.md`
- Plan CMS del portal publico: `docs/PLAN_CMS_PORTAL_PUBLICO.md`




