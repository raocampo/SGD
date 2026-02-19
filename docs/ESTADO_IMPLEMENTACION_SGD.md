# Estado de Implementación vs Propuesta SGD

Ultima actualizacion: 2026-02-18
Documento base revisado: `docs/propuestaDesarrolloSGD.md`

## Resumen por Módulo

| Modulo | Estado | Avance actual |
|---|---|---|
| 3.1 Gestion de Torneos/Campeonatos | Parcial-Alto | CRUD y estados operativos, organizador/logo/colores; pendiente reglamento PDF/bases y sedes multiples. |
| 3.2 Categorias por torneo | Alto | Eventos/categorias por campeonato funcionales con asignacion de equipos. |
| 3.3 Gestion de Equipos | Alto | Registro completo con logo/contacto/colores, asignacion por evento, flujo hacia sorteo. |
| 3.4 Gestion de Jugadores | Medio-Alto | CRUD por equipo, validacion de jugador unico por campeonato, carga opcional/requerida de foto cedula/carnet segun campeonato. Pendiente historial de transferencias y reglas de edad automatica. |
| 3.5 Creacion de Grupos | Alto | Modo aleatorio, cabezas de serie y manual con ruleta funcionando. |
| 3.6 Generacion de Fixture | Alto | Generacion por evento (grupos y todos-contra-todos), filtros, vista por grupo/jornada/todos, export PNG/PDF. |
| 3.7 Resultados/Tablas/Clasificados | Medio-Alto | Tablas de posiciones, goleadores, tarjetas y fair play por evento. Planilla por partido ya registra resultado/goles/tarjetas/pagos. Pendiente automatizar clasificados en todos los formatos de competencia. |
| 3.8 Eliminatorias | Parcial | Existe base de modulo/rutas, requiere consolidacion de flujo completo de llaves y UI final. |
| 4 Portal publico | Alto | Portal operativo con vistas de campeonato/grupos/tablas; pendiente enriquecer secciones editoriales/noticias. |
| 5 Roles y permisos (RBAC) | Pendiente | Aun sin autenticacion y perfiles de acceso. |
| 6 Extras profesionales | Parcial | Exportaciones avanzadas parciales (PNG/PDF/XLSX planilla). Pendiente notificaciones, auditoria completa y reportes ejecutivos. |
| 7 Modulo financiero | Medio | Modulo base implementado con cuenta corriente por equipo (cargos/abonos), estado de cuenta y reporte de morosidad. Pendiente automatizacion de multas, reglas de bloqueo por morosidad y reportes ejecutivos avanzados. |

## Estado Detallado de lo Nuevo (Sesion actual)

1. Requisitos documentales de jugadores por campeonato:
- Se guardan `requiere_foto_cedula` y `requiere_foto_carnet` desde UI de campeonatos.
- Jugadores valida esos requisitos al crear/editar.

2. Flujo Equipos -> Jugadores:
- Cada tarjeta de equipo incluye boton `Jugadores` con contexto de campeonato/evento.

3. Planilla de juego por partido:
- Nueva pantalla `frontend/planilla.html` + `frontend/js/planilla.js`.
- Permite cargar y guardar:
  - resultado y estado del partido,
  - goleadores,
  - tarjetas,
  - pagos (arbitraje/local/visitante),
  - observaciones.
- Exporta planilla en XLSX.

4. Integracion para estadisticas/tablas:
- Al guardar planilla se alimentan tablas `goleadores` y `tarjetas`, y resultados en `partidos`.
- Con esto se actualizan fuentes para modulo de `tablas/estadisticas`.

5. Modulo financiero base:
- Nueva tabla `finanzas_movimientos` (migracion `006_finanzas_cuenta_corriente.sql`) para registrar:
  - cargos/abonos por equipo,
  - concepto, estado, vencimiento, metodo y referencia.
- Nuevos endpoints backend:
  - `GET /api/finanzas/movimientos`
  - `POST /api/finanzas/movimientos`
  - `GET /api/finanzas/equipo/:equipo_id/estado-cuenta`
  - `GET /api/finanzas/morosidad`
- Nueva pantalla administrativa `frontend/finanzas.html` con:
  - filtros de movimientos,
  - alta manual de movimientos,
  - vista de morosidad y estado de cuenta por equipo.

## Pendientes Prioritarios Recomendados

1. Modulo financiero completo (prioridad alta):
- Automatizar multas por tarjetas/inasistencias y reglas de recargo.
- Integrar reglas de bloqueo por morosidad (programacion/habilitacion).
- Reportes ejecutivos: ingresos por fecha, categoria y campeonato con exportacion.

2. Cierre de eliminatorias:
- Definir flujo completo de cruces y UI (32vos/final, ida-vuelta, desempates).

3. Seguridad y roles:
- Login, JWT/sesion y perfiles (admin/organizador/arbitro/publico).

4. Auditoria y trazabilidad:
- Bitacora de acciones sobre fixture/resultados/sanciones/pagos.

5. Notificaciones:
- Avisos por programacion/reprogramacion/resultado.
