# Cambios implementados según propuesta SGD

> Seguimiento continuo actualizado: `docs/BITACORA_AVANCES.md`

## Resumen
Se implementaron las recomendaciones priorizadas del documento `propuestaDesarrolloSGD.md`.

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

## Migraciones de base de datos
Ejecutar en orden desde la carpeta `database`:

```bash
# 1. Reglas de desempate
psql -U postgres -d gestionDeportiva -f migrations/001_reglas_desempate.sql

# 2. Eliminatorias (requiere tabla eventos)
psql -U postgres -d gestionDeportiva -f migrations/002_eliminatorias.sql
```

---

## Notas
- El portal consume las mismas APIs que el panel admin.
- Las eliminatorias requieren que la tabla `eventos` exista y tenga relación con campeonatos.
- Las tablas de posición usan grupos por campeonato; si se trabaja con eventos, asegurar que los grupos tengan `campeonato_id` o adaptar las consultas.
