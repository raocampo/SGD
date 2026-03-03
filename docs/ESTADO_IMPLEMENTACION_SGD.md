# Estado de Implementacion vs Propuesta LT&C

Ultima actualizacion: 2026-03-03
Documento base revisado: `docs/propuestaDesarrolloSGD.md`

## Resumen por Modulo

| Modulo | Estado | Avance actual |
|---|---|---|
| 3.1 Gestion de Torneos/Campeonatos | Parcial-Alto | CRUD y estados operativos, organizador/logo/colores; pendiente reglamento PDF/bases y sedes multiples. |
| 3.2 Categorias por torneo | Alto | Eventos/categorias por campeonato funcionales con asignacion de equipos. |
| 3.3 Gestion de Equipos | Alto | Registro completo con logo/contacto/colores, asignacion por evento, flujo hacia sorteo y vista Tarjetas/Tabla. |
| 3.4 Gestion de Jugadores | Alto | CRUD por equipo y acceso global; validacion de jugador unico por campeonato; documentos opcionales/requeridos segun campeonato; cedula configurable como obligatoria/opcional por campeonato; importacion masiva y reportes. Backend base de modulo de pases implementado; pendiente UI de pases e historial visual por jugador. |
| 3.5 Creacion de Grupos | Alto | Modo aleatorio, cabezas de serie y manual con ruleta funcionando. |
| 3.6 Generacion de Fixture | Alto | Generacion por evento, filtros por grupo/jornada/fecha, vista plantilla y exportaciones. |
| 3.7 Resultados/Tablas/Clasificados | Medio-Alto | Tablas por evento (posiciones, goleadores, tarjetas, fair play). Planillaje ya alimenta resultado + estadisticas. Pendiente automatizacion robusta de clasificados para todos los formatos. |
| 3.8 Eliminatorias | Alto | Configuracion por categoria (`metodo_competencia`) y generacion automatica de llave integrada en `partidos`; soporte de siembra/byes/progresion de ganador; UI dedicada de llaves en `eliminatorias.html`; playoff desde grupos con `clasificados por grupo`, `cruces de grupos` o `tabla unica`; plantilla de publicacion reforzada (conectores de llave, export completo y fondo grafico). Pendiente reglas avanzadas de desempate y refinamiento visual final. |
| 4 Portal publico | Alto | Portal operativo con vistas de campeonato/grupos/tablas; iniciada separacion formal entre landing de organizador y CMS institucional del portal; noticias/blog, galeria, contenido institucional y contacto ya tienen base CRUD/CMS y consumo publico integrado en landing; pendiente cierre funcional y pulido editorial. |
| 5 Roles y permisos (RBAC) | En progreso | Autenticacion operativa; fase 1 de separacion de dominios iniciada con rol `operador` para CMS publico; noticias, galeria, contenido y contacto institucional fuera del alcance de organizadores. |
| 6 Extras profesionales | Parcial | Exportaciones (PNG/PDF/XLSX) en modulos clave; pendiente notificaciones, auditoria completa y reportes ejecutivos. |
| 7 Modulo financiero | Medio-Alto | Cuenta corriente por equipo (cargos/abonos), estado de cuenta y morosidad operativos con sincronizacion de inscripcion por categoria y conciliacion desde planilla. Pendiente reglas avanzadas de sancion/bloqueo y reporteria ejecutiva. |
| 8 Adaptacion mobile web | En progreso | Plan mobile documentado en `docs/PLAN_MOBILE_LT_C.md`; fase 1 base responsive iniciada en `style.css`/`core.js` (layout, topbar, acciones y sidebar) con cierre parcial en `tablas`, `finanzas`, `partidos` y `planilla`; pendiente cierre de `grupos/eliminatorias/pases` y validacion final en viewports objetivo. |

## Estado Detallado del Alcance Actual

1. Planillaje oficial de partido:
- Flujo directo por `evento -> grupo -> jornada -> partido` con filtro adicional por grupo para carga operativa rapida.
- Captura oficial por jugador (`G`, `TA`, `TR`) para local/visitante.
- Resultado calculado automaticamente por suma de goles capturados.
- Registro de pagos y observaciones dentro del mismo formulario.
- Exportacion en XLSX (template oficial) y PDF.
- Vista previa con dos modos: `Formato PDF` y `Resumen anterior`.

2. Jugadores y documentos:
- Gestion por equipo y tambien desde modulo global de jugadores.
- Configuracion por campeonato para requerir o no la cedula de identidad del jugador.
- Configuracion por campeonato para requerir foto de cedula/carnet.
- Importacion masiva por archivo con normalizacion de encabezados.
- Flujo de importacion de documentos por lote (`ZIP + mapeo por cedula`).

3. Operacion deportiva:
- Sorteo funcional en modos aleatorio, manual y con cabezas de serie.
- Generacion de grupos por evento.
- Generacion de fixture por evento y filtros de consulta.
- Generacion eliminatoria por categoria segun metodo configurado.
- Tablas/estadisticas por evento consumiendo resultados reales.

4. Financiero base:
- Registro de movimientos (cargo/abono).
- Estado de cuenta por equipo.
- Reporte de morosidad operativo.
- Sincronizacion automatica de cargos de inscripcion por categoria/equipo.
- Sincronizacion de planilla a finanzas (arbitraje, multas y abonos por equipo).
- Resumen de estado de cuenta por concepto (inscripcion/arbitraje/multas) y total.

5. RBAC y separacion de dominios:
- Roles deportivos operativos: `administrador`, `organizador`, `tecnico`, `dirigente`.
- Nuevo rol objetivo para CMS publico: `operador`.
- Fase 1 iniciada para separar:
  - `portal deportivo`,
  - `portal web publico / CMS`.
- Noticias quedan definidas como contenido institucional del portal, no como modulo del organizador.

6. CMS del portal publico:
- Noticias/blog con CRUD base, vistas publicas y detalle por `slug`.
- Galeria institucional con base de administracion y render publico en landing.
- Contenido institucional editable:
  - hero principal,
  - seccion Nosotros,
  - cards del home,
  - datos y redes de contacto.
- Formulario de contacto persistente con seguimiento basico por estado.

## Pendientes Prioritarios Recomendados

1. Cierre de planillaje oficial (prioridad alta):
- Pulido UX final del formulario para operacion en campo.
- Ajustes finos de impresion A4 en ambos modelos.
- Extender visibilidad de sanciones/suspendidos fuera de `planilla.html`:
  - listado por jugador en `jugadores.html` ya visible,
  - reporte disciplinario por equipo ya disponible en `jugadores.html`,
  - consolidado global de sanciones/suspensiones por categoria/equipo ya disponible en `jugadores.html`,
  - pendiente extender esa informacion a reportes operativos adicionales.

2. Pruebas E2E con datos reales (prioridad alta):
- Flujo completo: campeonato -> evento -> equipos -> sorteo -> grupos -> fixture -> planilla -> tablas.

3. Modulo financiero completo (prioridad alta):
- Reglas base ya incorporadas desde planilla para:
  - walkover / no presentacion,
  - doble amarilla convertida en roja,
  - roja directa y acumulacion de amarillas en futbol 11 para suspensiones visibles en planilla.
- Pendiente completar:
  - consolidado financiero/disciplinario por sanciones en reportes,
  - bloqueos por morosidad parametrizables por campeonato/categoria,
  - reportes ejecutivos de ingresos/pendientes con consolidado por campeonato y equipo.

4. Seguridad y roles:
- Consolidar separacion final entre roles deportivos y CMS institucional.
- Completar panel propio del `operador` con modulos editoriales.
- Completar pruebas reales por rol para `administrador` y `operador` en:
  - noticias,
  - galeria,
  - contenido portal,
  - contacto.
- Completar alta/edicion de usuario organizador con datos de perfil:
  - nombre de la organizacion,
  - logo de la organizacion.
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

5. Eliminatorias:
- Consolidar UI dedicada de llaves (bracket visual), progresion completa y reglas de desempate segun formato.

6. Modulo de pases (nuevo):
- Pantalla de gestion (`pases.html`) implementada con filtros, registro y aprobacion/anulacion de pase.
- Integrar salida contable en finanzas (ingreso/egreso por pase).
- Agregar historial de pases por jugador y por equipo.

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

## Documentacion Operativa Vinculada
- Bitacora de sesion y continuidad: `docs/BITACORA_AVANCES.md`
- Historial de cambios implementados: `docs/CAMBIOS_IMPLEMENTADOS.md`
- Propuesta funcional original: `docs/propuestaDesarrolloSGD.md`
- Plan mobile web: `docs/PLAN_MOBILE_LT_C.md`
- Plan CMS del portal publico: `docs/PLAN_CMS_PORTAL_PUBLICO.md`

