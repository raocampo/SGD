# Estado de Implementación vs Propuesta SGD

Ultima actualizacion: 2026-02-17
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
| 7 Modulo financiero | Parcial inicial | Base incorporada en planilla por partido (pagos arbitraje/local/visitante). Pendiente cuentas corrientes, multas automaticas, estado de deuda y reportes financieros. |

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

## Pendientes Prioritarios Recomendados

1. Modulo financiero completo (prioridad alta):
- Crear tablas/entidades para cuenta corriente por equipo (cargos/abonos/saldo).
- Registrar inscripcion, cobros por fecha, multas y estados de pago.
- Reportes de morosidad e ingresos por campeonato/evento.

2. Cierre de eliminatorias:
- Definir flujo completo de cruces y UI (32vos/final, ida-vuelta, desempates).

3. Seguridad y roles:
- Login, JWT/sesion y perfiles (admin/organizador/arbitro/publico).

4. Auditoria y trazabilidad:
- Bitacora de acciones sobre fixture/resultados/sanciones/pagos.

5. Notificaciones:
- Avisos por programacion/reprogramacion/resultado.
