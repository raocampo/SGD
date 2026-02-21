# Estado de Implementacion vs Propuesta LT&C

Ultima actualizacion: 2026-02-21
Documento base revisado: `docs/propuestaDesarrolloSGD.md`

## Resumen por Modulo

| Modulo | Estado | Avance actual |
|---|---|---|
| 3.1 Gestion de Torneos/Campeonatos | Parcial-Alto | CRUD y estados operativos, organizador/logo/colores; pendiente reglamento PDF/bases y sedes multiples. |
| 3.2 Categorias por torneo | Alto | Eventos/categorias por campeonato funcionales con asignacion de equipos. |
| 3.3 Gestion de Equipos | Alto | Registro completo con logo/contacto/colores, asignacion por evento, flujo hacia sorteo y vista Tarjetas/Tabla. |
| 3.4 Gestion de Jugadores | Medio-Alto | CRUD por equipo y acceso global; validacion de jugador unico por campeonato; documentos opcionales/requeridos segun campeonato; importacion masiva y reportes. Pendiente historial de transferencias y reglas de edad automatica. |
| 3.5 Creacion de Grupos | Alto | Modo aleatorio, cabezas de serie y manual con ruleta funcionando. |
| 3.6 Generacion de Fixture | Alto | Generacion por evento, filtros por grupo/jornada/fecha, vista plantilla y exportaciones. |
| 3.7 Resultados/Tablas/Clasificados | Medio-Alto | Tablas por evento (posiciones, goleadores, tarjetas, fair play). Planillaje ya alimenta resultado + estadisticas. Pendiente automatizacion robusta de clasificados para todos los formatos. |
| 3.8 Eliminatorias | Parcial | Base de modulo/rutas disponible; pendiente cierre de flujo completo y UI final de llaves. |
| 4 Portal publico | Alto | Portal operativo con vistas de campeonato/grupos/tablas; pendiente contenido editorial/noticias. |
| 5 Roles y permisos (RBAC) | Pendiente | Aun sin autenticacion y perfiles de acceso. |
| 6 Extras profesionales | Parcial | Exportaciones (PNG/PDF/XLSX) en modulos clave; pendiente notificaciones, auditoria completa y reportes ejecutivos. |
| 7 Modulo financiero | Medio-Alto | Cuenta corriente por equipo (cargos/abonos), estado de cuenta y morosidad operativos con sincronizacion de inscripcion por categoria y conciliacion desde planilla. Pendiente reglas avanzadas de sancion/bloqueo y reporteria ejecutiva. |
| 8 Adaptacion mobile web | Pendiente-Iniciado | Plan mobile documentado en `docs/PLAN_MOBILE_LT_C.md`; pendiente ejecucion por fases (responsive global, modulos criticos, operacion de campo, finanzas). |

## Estado Detallado del Alcance Actual

1. Planillaje oficial de partido:
- Flujo directo por `evento -> jornada -> partido`.
- Captura oficial por jugador (`G`, `TA`, `TR`) para local/visitante.
- Resultado calculado automaticamente por suma de goles capturados.
- Registro de pagos y observaciones dentro del mismo formulario.
- Exportacion en XLSX (template oficial) y PDF.
- Vista previa con dos modos: `Formato PDF` y `Resumen anterior`.

2. Jugadores y documentos:
- Gestion por equipo y tambien desde modulo global de jugadores.
- Configuracion por campeonato para requerir foto de cedula/carnet.
- Importacion masiva por archivo con normalizacion de encabezados.
- Flujo de importacion de documentos por lote (`ZIP + mapeo por cedula`).

3. Operacion deportiva:
- Sorteo funcional en modos aleatorio, manual y con cabezas de serie.
- Generacion de grupos por evento.
- Generacion de fixture por evento y filtros de consulta.
- Tablas/estadisticas por evento consumiendo resultados reales.

4. Financiero base:
- Registro de movimientos (cargo/abono).
- Estado de cuenta por equipo.
- Reporte de morosidad operativo.
- Sincronizacion automatica de cargos de inscripcion por categoria/equipo.
- Sincronizacion de planilla a finanzas (arbitraje, multas y abonos por equipo).
- Resumen de estado de cuenta por concepto (inscripcion/arbitraje/multas) y total.

## Pendientes Prioritarios Recomendados

1. Cierre de planillaje oficial (prioridad alta):
- Pulido UX final del formulario para operacion en campo.
- Ajustes finos de impresion A4 en ambos modelos.

2. Pruebas E2E con datos reales (prioridad alta):
- Flujo completo: campeonato -> evento -> equipos -> sorteo -> grupos -> fixture -> planilla -> tablas.

3. Modulo financiero completo (prioridad alta):
- Reglas de cobro y suspension por acumulacion de tarjetas segun tipo de futbol.
- Bloqueos por morosidad parametrizables por campeonato/categoria.
- Reportes ejecutivos de ingresos/pendientes con consolidado por campeonato y equipo.

4. Seguridad y roles:
- Login, sesion/JWT y perfiles (admin/organizador/arbitro/publico).

5. Eliminatorias:
- Consolidar llaves, progresion y reglas de desempate segun formato.

6. Auditoria y trazabilidad:
- Registro de cambios en fixture, planilla, sanciones y finanzas.

7. Roadmap mobile:
- Ejecutar `docs/PLAN_MOBILE_LT_C.md` por fases con prioridad en flujos operativos.

## Documentacion Operativa Vinculada
- Bitacora de sesion y continuidad: `docs/BITACORA_AVANCES.md`
- Historial de cambios implementados: `docs/CAMBIOS_IMPLEMENTADOS.md`
- Propuesta funcional original: `docs/propuestaDesarrolloSGD.md`
- Plan mobile web: `docs/PLAN_MOBILE_LT_C.md`
