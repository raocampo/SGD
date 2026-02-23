# Cambios implementados según propuesta LT&C

> Seguimiento continuo actualizado: `docs/BITACORA_AVANCES.md`

## Resumen
Se implementaron las recomendaciones priorizadas del documento `propuestaDesarrolloSGD.md`.

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
