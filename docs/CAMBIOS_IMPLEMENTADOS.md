# Cambios implementados según propuesta LT&C

> Seguimiento continuo actualizado: `docs/BITACORA_AVANCES.md`

## Resumen
Se implementaron las recomendaciones priorizadas del documento `propuestaDesarrolloSGD.md`.

---

## 2026-03-05 - CMS Fase 6 (endurecimiento + cierre operativo en progreso)
- Endurecimiento backend del CMS:
  - validacion de URLs en `Noticia`, `GaleriaItem` y `PortalContenido` (solo `http/https` o rutas relativas seguras donde aplica),
  - validacion de email de contacto y normalizacion de cards/iconos en `PortalContenido`,
  - validacion de email y longitud minima de mensaje en `ContactoMensaje`.
- Endurecimiento del formulario publico de contacto:
  - rate-limit por `IP + email` en `contactoController` (`3` envios cada `10` minutos),
  - honeypot `website` para mitigar bots basicos,
  - mapeo de error a `429` en exceso de solicitudes.
- Correccion de seguridad por rol en dominio deportivo:
  - `backend/routes/campeonatoRoutes.js` ahora exige `requireAuth + requireRoles` en `GET /campeonatos` y `GET /campeonatos/:id`,
  - `operador` deja de tener acceso al modulo deportivo de campeonatos (`403`).
- Correccion funcional en CMS noticias:
  - fix de tipado SQL en `Noticia.cambiarEstado`,
  - `publicar/despublicar` ahora responde `200` correctamente.
- Mejora operativa de panel CMS:
  - nuevo dashboard de KPI editorial en `frontend/portal-cms.html` + `frontend/js/portal-cms.js`.
- Frontend portal ajustado:
  - campo honeypot oculto en `frontend/index.html`,
  - envio del campo `website` desde `frontend/js/portal.js`.
- Documentacion de cierre CMS agregada:
  - `docs/CHECKLIST_QA_CMS_PORTAL_PUBLICO.md`,
  - `docs/GUIA_DESPLIEGUE_CMS_PORTAL_PUBLICO.md`.
- Saneamiento de verificacion tecnica automatizada:
  - nuevo script `backend/scripts/smokeIntegration.js`,
  - nuevo script `backend/scripts/smokeRoleAccess.js`,
  - nuevo script del equipo app mobile `backend/scripts/smokeProvidedUsers.js`,
  - nuevo script `backend/scripts/smokeRoleMatrixDb.js`,
  - nuevo script `backend/scripts/smokeFrontendRoleGuards.js`,
  - nuevo comando `npm run smoke` en `backend/package.json`,
  - nuevo comando `npm run smoke:roles` en `backend/package.json`,
  - nuevo comando `npm run smoke:provided` en `backend/package.json`,
  - nuevo comando `npm run smoke:matrix` en `backend/package.json`,
  - nuevo comando `npm run smoke:frontend` en `backend/package.json`,
  - valida rapidamente:
    - salud + DB,
    - portal publico,
    - bloqueo de endpoints privados sin token (CMS/deportivo),
    - bloqueo de endpoints mobile sin token.
  - `smoke:roles` valida RBAC mobile con usuarios QA (`organizador`, `tecnico`, `dirigente`) y permisos esperados de lectura/escritura.
  - `smoke:matrix` valida RBAC completo (6 roles) contra endpoints CMS/deportivo/mobile/web.
  - `smoke:frontend` audita la politica de acceso por pagina desde `frontend/js/core.js`.

---

## 2026-03-04 - Finanzas: consolidado disciplinario-contable
- Se ajusto la politica de morosidad para planilla a modo informativo:
  - el guardado de planilla no se bloquea por deuda,
  - backend retorna `aviso_morosidad` con detalle por equipo.
- Se agrego notificacion de deuda para roles de equipo (`tecnico/dirigente/jugador`) y banner fijo en `portal-tecnico.html`.
- Se implemento el rol `jugador`:
  - soporte en autenticacion/usuarios y restricciones de lectura por equipo,
  - `jugador` queda en modo `solo_lectura`,
  - migracion: `database/migrations/024_rol_jugador.sql`.
- Se incorporo en `finanzas.html` el bloque `Consolidado de Sanciones (TA/TR)` con:
  - tabla por equipo,
  - resumen de saldos de TA, TR y otras multas,
  - saldo total de sanciones.
- En `frontend/js/finanzas.js` se agrego:
  - consulta filtrada de movimientos de `concepto=multa` (incluyendo origen sistema),
  - clasificacion automatica de movimientos por `TA`, `TR` y `otras`,
  - recarga integrada con filtros generales del modulo financiero.
- Se agrego impresion dedicada:
  - boton `Imprimir sanciones`,
  - salida con membrete de campeonato y pie de auspiciantes.
- Se agrego salida ejecutiva por campeonato en `finanzas.html`:
  - nuevo bloque `Resumen Ejecutivo por Campeonato`,
  - consolidado por campeonato de cargos/abonos/saldo,
  - totales de inscripcion, arbitraje y saldo de multas,
  - impresion dedicada (`Imprimir ejecutivo`).
- Se implemento politica de morosidad parametrizable:
  - nueva migracion `023_bloqueo_morosidad_parametrizable.sql`,
  - configuracion en campeonato (`bloquear_morosos`, `bloqueo_morosidad_monto`),
  - override por categoria/evento (`bloquear_morosos`, `bloqueo_morosidad_monto`),
  - evaluacion aplicada en `Partido.guardarPlanilla` para web y mobile con devolucion de aviso (sin bloqueo).

---

## 2026-03-03 - Planilla por grupo y reportes disciplinarios
- Planilla operativa mejorada para carga directa:
  - nuevo selector de `grupo` en `frontend/planilla.html`,
  - flujo encadenado `categoria -> grupo -> jornada -> partido` en `frontend/js/planilla.js`,
  - el selector de partidos ahora identifica el grupo dentro de cada opcion.
- Disciplina visible fuera de planilla:
  - `backend/models/Partido.js` centraliza suspension, amarillas acumuladas y partidos pendientes por `evento/equipo/jugador`,
  - `backend/controllers/jugadorController.js` enriquece `/jugadores/equipo/:id?evento_id=...` con estado disciplinario,
  - `frontend/js/jugadores.js` muestra `Habilitado`, `Acumula TA` o `Suspendido` en tarjetas y tabla.
- Reporteria disciplinaria en `jugadores.html`:
  - nuevo `Reporte de sanciones` por equipo,
  - nuevo `Consolidado sanciones categoria` por categoria/equipo/jugador,
  - ambos con impresion y exportacion PDF.
- Pendiente abierto del bloque:
  - extender esta informacion disciplinaria a otros reportes operativos y consolidado financiero.

---

## 2026-02-23 - Grupos/Playoff, exportaciones y auspiciantes
- Correccion de exportacion/compartir en `grupos` y `eliminatorias`:
  - solucion al bloqueo por imagenes rotas (`404`) durante `html2canvas`,
  - exportaciones PNG/PDF estabilizadas.
- `gruposgen.html` reorganizado con pestanas:
  - `Plantilla de Grupos`,
  - `Clasificacion / Playoff` (embebido),
  - opcion de abrir playoff en pantalla completa.
- Navegacion:
  - se retiro el acceso directo de `Eliminatorias` desde sidebar para centralizar flujo desde `Grupos`.
- Plantilla de eliminatorias para publicar:
  - conectores visuales de llave entre rondas (render SVG),
  - ajuste de recorte horizontal para exportar toda la llave,
  - fondo grafico estilo poster.
- Auspiciantes en plantillas:
  - eliminatorias ahora incluye bloque de auspiciantes en zona exportable (imagen/PDF/compartir).
- Backend `auspiciantes` reforzado:
  - fallback automatico desde `backend/uploads/auspiciantes` cuando no hay registros en tabla `campeonato_auspiciantes`.

---

## 2026-02-21 - Branding LT&C y base mobile plan
- Branding visible del frontend unificado a `LT&C (Loja Torneos & Competencias)`.
- Landing renovada con:
  - seccion de precios,
  - carrusel de auspiciantes,
  - ajustes de redes y contacto.
- Icono global de web/sistema incorporado:
  - `frontend/assets/ltc/favicon.svg`,
  - aplicacion global desde `frontend/js/core.js`.
- Plan mobile web creado:
  - `docs/PLAN_MOBILE_LT_C.md` con fases, riesgos, criterios de aceptacion y checklist de ejecucion.

---

## 1. Validación jugador único por torneo
- **Ubicación:** `backend/models/Jugador.js`
- Un jugador no puede estar en dos equipos del mismo campeonato.
- Validación por cédula de identidad.
- Aplicada en creación y actualización (cambio de equipo).
- Mensaje de error claro cuando se intenta duplicar.

---

## 2. Estados del torneo
- **Estados:** Borrador → Inscripción → En Curso → Finalizado → Archivado
- **Ubicación:** `backend/models/Campeonato.js`, `campeonatoController.js`, rutas, frontend
- Nuevo endpoint: `PUT /api/campeonatos/:id/estado` con body `{ "estado": "en_curso" }`
- Selector de estado en tarjetas de campeonatos y en el formulario de edición.
- Compatibilidad con estado anterior "planificacion" (se trata como Borrador).

---

## 3. Reglas de desempate configurables
- **Ubicación:** `database/migrations/001_reglas_desempate.sql`, `tablaController.js`
- Nueva columna `reglas_desempate` en tabla `campeonatos` (TEXT/JSON).
- Criterios soportados: `puntos`, `diferencia_goles`, `goles_favor`, `goles_contra`, `menos_perdidos`.
- Valor por defecto: `["puntos","diferencia_goles","goles_favor"]`.
- Para configurar: actualizar el campeonato con `reglas_desempate` en formato JSON array.

---

## 4. Fases eliminatorias (bracket)
- **Ubicación:** `database/migrations/002_eliminatorias.sql`, `backend/models/Eliminatoria.js`, `eliminatoriaController.js`
- Nueva tabla `partidos_eliminatoria` para llaves eliminatorias.
- Rutas:
  - `GET /api/eliminatorias/evento/:evento_id` – Obtener llave
  - `POST /api/eliminatorias/evento/:evento_id/generar` – Generar bracket (body: `{ cantidad_equipos: 8 }`)
  - `PUT /api/eliminatorias/:id/resultado` – Actualizar resultado
  - `PUT /api/eliminatorias/:id/equipos` – Asignar equipos a un slot

---

## 5. Portal público
- **Ubicación:** `frontend/portal.html`
- Página pública con torneos activos.
- Vista por campeonato: fixture, resultados, tablas de posición.
- Acceso desde el menú principal: "Portal Público" (abre en nueva pestaña).

---

## 6. Estadísticas y tablas
- Se agregaron `obtenerEstadisticasEquipoAvanzado` y `calcularPuntos` al modelo `Partido.js` para soportar correctamente las tablas de posición con shootouts.

---

## 7. Método de competencia por categoría (evento)
- **Ubicación:** `backend/controllers/eventoController.js`, `frontend/eventos.html`, `frontend/js/eventos.js`
- Nuevos campos en `eventos`:
  - `metodo_competencia`: `grupos`, `liga`, `eliminatoria`, `mixto`
  - `eliminatoria_equipos`: `4/8/16/32` (opcional)
- Se expone y edita desde UI de categorías.
- El método queda visible en tarjetas y vista tabla de categorías.

---

## 8. Eliminatorias integradas a generación de partidos
- **Ubicación:** `backend/controllers/partidoController.js`, `backend/models/Eliminatoria.js`, `frontend/js/partidos.js`
- `POST /api/partidos/evento/:evento_id/generar-fixture` ahora soporta `modo=auto`:
  - resuelve automáticamente según `metodo_competencia` de la categoría,
  - si es eliminatoria, genera llave en `partidos_eliminatoria`.
- Mejoras de lógica eliminatoria:
  - siembra automática de equipos inscritos (`evento_equipos`),
  - byes automáticos cuando faltan equipos para completar potencia de 2,
  - propagación de ganador al siguiente cruce al registrar resultado.
- `partidos.html` ahora muestra cruces eliminatorios y permite registrar resultado por cruce.

---

## 9. Módulo de pases (fase 1 backend)
- **Ubicación:** `backend/models/Pase.js`, `backend/controllers/paseController.js`, `backend/routes/paseRoutes.js`, `database/migrations/014_pases_jugadores.sql`
- Nueva tabla `pases_jugadores` para registrar pases entre equipos.
- Nuevas rutas:
  - `GET /api/pases`
  - `GET /api/pases/:id`
  - `POST /api/pases`
  - `PUT /api/pases/:id/estado`
- Al aprobar/pagar un pase, puede aplicarse la transferencia del jugador al equipo destino.
- API frontend preparada con `PasesAPI` en `frontend/js/api.js` para integrar pantalla UI en siguiente iteración.

---

## 10. UI de Pases y Llaves Eliminatorias
- **Ubicación:** `frontend/pases.html`, `frontend/js/pases.js`, `frontend/eliminatorias.html`, `frontend/js/eliminatorias.js`
- Nueva pantalla de pases:
  - registro de pase por jugador y equipo destino,
  - filtros por campeonato/categoría/equipos/estado,
  - acciones de estado (aprobar, pagado, anular) según rol.
- Nueva pantalla dedicada de eliminatorias:
  - visualización de bracket por rondas,
  - generación/regeneración de llave,
  - registro de resultados por cruce.
- Playoff desde fase de grupos incorporado:
  - parámetro de `clasificados por grupo`,
  - modo `cruces entre grupos` configurable (A vs C, B vs D, etc.),
  - modo `tabla única` por rendimiento (puntos, diferencia y porcentaje) con cruces `1 vs último`.
- Accesos integrados en sidebar dinámico y enlace directo desde `partidos.html`.

---

## Migraciones de base de datos
Ejecutar en orden desde la carpeta `database`:

```bash
# 1. Reglas de desempate
psql -U postgres -d gestionDeportiva -f migrations/001_reglas_desempate.sql

# 2. Eliminatorias (requiere tabla eventos)
psql -U postgres -d gestionDeportiva -f migrations/002_eliminatorias.sql

# 14. Pases de jugadores
psql -U postgres -d gestionDeportiva -f migrations/014_pases_jugadores.sql
```

---

## Notas
- El portal consume las mismas APIs que el panel admin.
- Las eliminatorias requieren que la tabla `eventos` exista y tenga relación con campeonatos.
- Las tablas de posición usan grupos por campeonato; si se trabaja con eventos, asegurar que los grupos tengan `campeonato_id` o adaptar las consultas.

---

## 11. Planillaje: inasistencias, walkover y suspensiones visibles
- **Ubicación:** `frontend/planilla.html`, `frontend/js/planilla.js`, `backend/models/Partido.js`, `database/migrations/021_planilla_ambos_no_presentes.sql`, `database/migrations/022_planilla_inasistencia_equipo.sql`
- El formulario de planilla ahora soporta `inasistencia / walkover` con selector dedicado:
  - sin inasistencia,
  - no se presenta local,
  - no se presenta visitante,
  - no se presentan ambos.
- Reglas automáticas aplicadas:
  - local ausente -> `0-3`,
  - visitante ausente -> `3-0`,
  - ambos ausentes -> `0-0` y el partido no suma puntos/goles.
- Sincronización financiera desde planilla:
  - walkover individual -> multa de arbitraje solo al equipo ausente,
  - ambos ausentes -> multa de arbitraje a ambos equipos,
  - no se generan pagos manuales ni captura deportiva cuando hay inasistencia.
- Regla disciplinaria integrada:
  - `2 amarillas` del mismo jugador en el partido se convierten a `1 roja`,
  - se cobra solo `roja`,
  - el resumen deportivo y la tabla de tarjetas quedan normalizados.
- Suspensiones visibles en la propia planilla:
  - doble amarilla -> suspension `1` partido,
  - roja directa -> suspension `2` partidos,
  - futbol 11 -> suspension `1` partido al acumular `4` amarillas.
- El backend calcula la suspension con el historial previo del jugador en el `evento/categoria` y entrega el estado ya resuelto para renderizarlo en rojo y bloquear su fila en captura.

---

## 12. Pases: integración contable en finanzas
- **Ubicación:** `backend/models/Pase.js`
- Se incorporó sincronización financiera automática al actualizar estado del pase:
  - al pasar a `pagado` o `aprobado`, se registran/actualizan:
    - `cargo` al equipo destino,
    - `abono` al equipo origen.
  - al pasar a `anulado`, los movimientos del pase quedan en estado `anulado`.
- Se aplica idempotencia con `origen='sistema'` y `origen_clave` único por pase/tipo:
  - `pase:{id}:cargo_destino`
  - `pase:{id}:abono_origen`
- Los movimientos quedan con:
  - `concepto='otro'`,
  - referencia trazable (`PASE-{id}-CARGO` / `PASE-{id}-ABONO`),
  - fecha normalizada a `YYYY-MM-DD` para evitar errores de parseo.

---

## 13. Pases: historial por jugador y por equipo
- **Ubicación backend:** `backend/models/Pase.js`, `backend/controllers/paseController.js`, `backend/routes/paseRoutes.js`
- **Ubicación frontend:** `frontend/pases.html`, `frontend/js/pases.js`, `frontend/js/api.js`, `frontend/css/style.css`
- Nuevos endpoints de historial:
  - `GET /api/pases/historial/jugadores`
  - `GET /api/pases/historial/jugadores/:jugadorId`
  - `GET /api/pases/historial/equipos`
  - `GET /api/pases/historial/equipos/:equipoId`
- Funcionalidad incorporada:
  - resumen de pases por jugador (totales, pendientes, aprobados, anulados, monto total),
  - detalle cronológico por jugador (origen, destino, estado, monto),
  - resumen por equipo (entradas/salidas, montos, estado),
  - detalle cronológico por equipo con tipo de movimiento (`entrada`/`salida`).
- Integración de filtros:
  - el historial respeta filtros activos de campeonato, categoría y estado definidos en el módulo de pases.

---

## 14. QA de dataset UI (coexistencia web + mobile)
- **Ubicación:** `backend/scripts/qaUiDatasetCheck.js`, `backend/package.json`
- Se agregó comando `npm run qa:ui-dataset` para validar de forma rápida:
  - endpoints mobile del dataset objetivo (campeonato/evento/partido/equipo),
  - endpoints públicos equivalentes del portal,
  - carga de pantallas web críticas (`campeonatos`, `sorteo`, `partidos`, `planilla`, `finanzas`, `portal-admin`).
- Objetivo:
  - verificar integridad mínima del flujo UI sin romper contratos del backend principal mientras avanza el equipo mobile.

---

## 15. Documentacion para cliente y tutoriales
- **Ubicación:** `docs/GUIA_OPERATIVA_CLIENTE_LT_C.md`, `docs/GUIA_VIDEO_TUTORIALES_LT_C.md`
- Se incorporo documentacion orientada a adopcion del cliente:
  - operacion diaria por rol,
  - checklists de cierre semanal y cierre de campeonato,
  - escalamiento de soporte y buenas practicas.
- Se incorporo guion de produccion de tutoriales:
  - serie recomendada de videos por modulo,
  - estructura estandar por video,
  - checklist previo a grabacion y entregables.
- Se actualizaron referencias en:
  - `README.md`,
  - `docs/INDICE_DOCUMENTACION.md`,
  - `docs/GUIA_PRESENTACION_SISTEMA_LT_C.md`.
