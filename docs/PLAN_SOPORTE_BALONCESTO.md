# Plan de Soporte para Baloncesto en SGD

Fecha: 2026-04-06  
Estado: Planificado — pendiente de inicio de implementación

---

## Objetivo

Extender el Sistema de Gestión Deportiva (SGD) para soportar campeonatos de **Baloncesto** con la misma profundidad funcional que tiene el módulo de Fútbol: fixture, planilla, sanciones, tablas, finanzas, portal público y exportaciones.

---

## Análisis de la situación actual

El sistema está construido exclusivamente para fútbol. El campo `tipo_futbol` en la tabla `campeonatos` acepta valores como `futbol_11`, `futbol_7`, `futbol_5`, `futsala`, `indor`, etc. Toda la lógica de negocio (planilla, sanciones, suspensiones) asume fútbol.

### Diferencias clave entre Fútbol y Baloncesto

| Aspecto | Fútbol | Baloncesto |
|---------|--------|------------|
| Estructura de tiempo | 2 tiempos × 45 min | 4 cuartos × 10 min |
| Prórroga | 2 tiempos extra de 15 min | Cuartos extra de 5 min (overtime) |
| Desempate | Penales (shootout) | No aplica |
| Unidad de marcador | Goles | Puntos (1pt libre, 2pt campo, 3pt triple) |
| Infracciones | Tarjeta amarilla / roja | Falta personal / técnica / antideportiva / flagrante |
| Acumulación | 4 amarillas = suspensión (F11) | 6 faltas personales = expulsión |
| Tarjeta técnica | No aplica | 2 técnicas = expulsión |
| Árbitros de línea | Sí (F11) | No |
| Posiciones | Arquero, Defensa, Delantero... | Base, Escolta, Alero, Ala-Pívot, Pívot |
| Jugadores en cancha | 11 / 7 / 5... | 5 |
| Cambios | Limitados (3–5 según reglamento) | Ilimitados |
| Walkover | 3-0 | 20-0 (o según reglamento local) |

---

## Estrategia de implementación

Se usará una arquitectura basada en **configuración por deporte**, evitando duplicar módulos. La idea es que cada deporte tenga su propia "ficha de configuración" que gobierne la lógica de planilla, sanciones, fixture y reportes.

### Principio rector
> No duplicar módulos. El mismo `partidos.html`, `planilla.html`, `tablas.html` y `finanzas.html` se adaptan al deporte del campeonato mostrando/ocultando secciones y usando la configuración correcta.

---

## Fases de implementación

---

### FASE 1 — Base de datos y configuración de deporte

**Objetivo:** Generalizar el campo `tipo_futbol` para soportar múltiples deportes sin romper los campeonatos existentes.

#### 1.1 Nueva migración: `063_tipo_deporte.sql`

```sql
-- Renombrar campo (con alias de retrocompatibilidad)
ALTER TABLE campeonatos ADD COLUMN IF NOT EXISTS tipo_deporte VARCHAR(30);
UPDATE campeonatos SET tipo_deporte = tipo_futbol WHERE tipo_deporte IS NULL;
-- tipo_futbol se mantiene como alias transitorio hasta que el frontend migre

-- Agregar tipo basquetbol a goleadores/puntos
ALTER TABLE goleadores ADD COLUMN IF NOT EXISTS tipo_punto VARCHAR(20);
-- Valores: '2pt_campo', '3pt_triple', '1pt_libre', 'tecnica'
-- Para fútbol: NULL (usa tipo_gol existente)

-- Extender tipo_tarjeta para baloncesto
-- 'amarilla', 'roja' → football | 'personal', 'tecnica', 'antideportiva', 'flagrante' → basketball
-- El campo ya es VARCHAR(20), solo se amplía el dominio de valores

-- Faltas por cuarto (baloncesto) — backward compatible
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS faltas_local_3er INTEGER DEFAULT 0;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS faltas_local_4to INTEGER DEFAULT 0;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS faltas_visitante_3er INTEGER DEFAULT 0;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS faltas_visitante_4to INTEGER DEFAULT 0;

-- Overtime (reemplaza shootout en baloncesto)
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS overtime_utilizado BOOLEAN DEFAULT FALSE;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS overtime_puntos_local INTEGER DEFAULT 0;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS overtime_puntos_visitante INTEGER DEFAULT 0;
```

#### 1.2 Nuevo archivo: `backend/config/sportsConfig.js`

Centraliza toda la configuración por deporte:

```javascript
module.exports = {
  basquetbol: {
    nombre: "Básquetbol",
    posiciones: ["Base", "Escolta", "Alero", "Ala-Pívot", "Pívot"],
    jugadoresEnCancha: 5,
    tiempos: 4,              // cuartos
    minutosPorTiempo: 10,
    tiposTiempo: ["1er", "2do", "3er", "4to"],
    maxFaltasPersonales: 6,  // → expulsión automática
    maxFaltasTecnicas: 2,    // → expulsión
    tienePenales: false,
    tieneArbitrosLinea: false,
    walkovorMarcadorLocal: 20,
    walkovorMarcadorVisitante: 0,
    tiposPunto: [
      { valor: "2pt_campo",  etiqueta: "Canasta (2 pts)", puntos: 2 },
      { valor: "3pt_triple", etiqueta: "Triple (3 pts)",  puntos: 3 },
      { valor: "1pt_libre",  etiqueta: "Tiro libre (1 pt)", puntos: 1 },
    ],
    tiposFalta: [
      { valor: "personal",       etiqueta: "Falta personal" },
      { valor: "tecnica",        etiqueta: "Falta técnica" },
      { valor: "antideportiva",  etiqueta: "Antideportiva" },
      { valor: "flagrante",      etiqueta: "Flagrante" },
    ],
    suspensionPorFaltas: {
      personales: 6,  // ejección inmediata en el partido
      tecnicas: 2,    // ejección inmediata en el partido
      acumulacionPartidos: null,  // sin acumulación entre partidos por ahora
    },
  },

  futbol_11: {
    nombre: "Fútbol 11",
    posiciones: ["Arquero", "Defensa", "Lateral", "Mediocampista", "Delantero"],
    jugadoresEnCancha: 11,
    tiempos: 2,
    minutosPorTiempo: 45,
    tiposTiempo: ["1er", "2do"],
    tienePenales: true,
    tieneArbitrosLinea: true,
    walkovorMarcadorLocal: 3,
    walkovorMarcadorVisitante: 0,
    umbralAmarillas: 4,
    // ... igual a lógica actual
  },

  // futbol_7, futbol_5, futsala, indor: heredan de futbol_11 con overrides
};
```

---

### FASE 2 — Backend: modelos y controladores

**Objetivo:** Hacer que la lógica de sanciones, faltas y resultados sea consciente del deporte.

#### 2.1 `backend/models/Partido.js`

| Función actual | Cambio |
|----------------|--------|
| `obtenerUmbralAmarillasSuspension(tipoFutbol)` | → `obtenerUmbralSuspension(tipoDeporte)` — retorna objeto con umbrales por tipo de infracción |
| `normalizarTarjetasPlanilla(tarjetas)` | → acepta tanto tarjetas (fútbol) como faltas (baloncesto) según deporte |
| `resolverTarjetasDisciplinariasPartido()` | → bifurca lógica: fútbol = acumulación amarillas, baloncesto = 6 faltas personales |
| `calcularEstadoDisciplinarioEquipo()` | → sport-aware usando `sportsConfig` |
| `normalizarFaltasPlanillaPayload()` | → soporta 4 cuartos además de 2 tiempos |
| `GOLES_WALKOVER = 3` | → `obtenerWalkover(tipoDeporte)` usando `sportsConfig` |

#### 2.2 `backend/models/Campeonato.js`

- Leer/escribir `tipo_deporte` en lugar de `tipo_futbol` (con fallback al campo viejo para retrocompatibilidad).
- Exponer `tipo_deporte` en el objeto limpiado.

#### 2.3 `backend/controllers/campeonatoController.js`

- Aceptar `tipo_deporte` en creación/edición.
- Renombrar `costo_tarjeta_amarilla`/`roja` a `costo_infraccion_leve`/`grave` (con aliases para no romper campeonatos existentes).

#### 2.4 `backend/controllers/planillaController.js`

- Detectar deporte del partido y aplicar reglas de sanciones correspondientes.
- Para baloncesto: verificar si un jugador llega a 6 faltas personales → marcarlo como expulsado en el partido (no suspensión para partidos futuros, a menos que el reglamento local lo indique).

---

### FASE 3 — Frontend: planilla adaptable

**Objetivo:** La planilla (`planilla.html` + `planilla.js`) se muestra distinta según el deporte.

#### 3.1 Secciones condicionales en `planilla.html`

| Sección | Fútbol | Baloncesto |
|---------|--------|------------|
| Tarjetas amarillas/rojas | ✅ visible | ❌ oculto |
| Faltas personales/técnicas | ❌ oculto | ✅ visible |
| Árbitros de línea | solo F11 | ❌ oculto |
| Penales | solo playoff | ❌ oculto |
| Overtime (prórroga) | texto libre | cuartos extra con puntaje |
| Faltas por tiempo | 1er/2do | 1er/2do/3er/4to |
| Posiciones en alineación | Arquero, Def... | Base, Alero... |
| Tipo de gol | campo/penal/libre | 2pt/3pt/libre |
| Sustituciones | min. de entrada/salida | sin minuto obligatorio |

Implementación: atributos `data-deporte="futbol"` / `data-deporte="basquetbol"` en cada sección, controlados por una función `adaptarPlanillaAlDeporte(tipoDeporte)` en `planilla.js`.

#### 3.2 `planilla.js`

- Nueva función `adaptarPlanillaAlDeporte(tipoDeporte)` que lee `sportsConfig` y muestra/oculta secciones.
- Modificar `normalizarConteoTarjetas()` → `normalizarConteoInfracciones(tipoDeporte)`.
- Modificar el guardado para enviar `tipo_deporte` al backend.

---

### FASE 4 — Frontend: campeonatos y partidos

**Objetivo:** Crear y listar campeonatos de baloncesto sin conflictos con los de fútbol.

#### 4.1 `campeonatos.js`

- `formatearTipoDeporteEtiqueta(tipo)` extiende el mapa actual:
  ```javascript
  basquetbol: "Básquetbol"
  ```
- Formulario de creación: el `<select>` de tipo deporte incluye **Básquetbol** como opción.

#### 4.2 `partidos.js`

- Al registrar resultado, mostrar "Puntos" en vez de "Goles" si es baloncesto.
- La vista de sanciones/suspensiones muestra faltas en vez de tarjetas según deporte.

---

### FASE 5 — Portal público

**Objetivo:** El portal muestra correctamente los datos según el deporte.

- Marcador: "**78 – 65**" en vez de "**2 – 1**" sin cambios de código (usa los mismos campos).
- Tabla de posiciones: mantener misma estructura (PJ, PG, PE, PP, PF, PC, DG, PTS) — en baloncesto `DG` se convierte en diferencia de puntos `DP`.
- Sección de sanciones en portal: mostrar "Faltas personales" si es baloncesto.

---

### FASE 6 — Carnés y reportes

- El carné no tiene lógica deporte-específica → sin cambios.
- Las exportaciones de fixture y jornadas → sin cambios (son agnósticas al deporte).
- El reporte disciplinario en `jugadores.html`: mostrar columna correcta (tarjetas vs faltas) según deporte del campeonato seleccionado.

---

## Impacto en datos existentes

| Riesgo | Mitigación |
|--------|------------|
| Campeonatos de fútbol existentes rompen | `tipo_futbol` se mantiene; `tipo_deporte` se copia de él con `UPDATE` |
| Queries que usan `tipo_futbol` | Se crean aliases y fallbacks; se migra campo a campo |
| Planilla de partidos jugados | Solo se procesan con la lógica correspondiente al deporte en el momento de guardar |
| Tablas de sanciones históricas | No se modifican; se interpretan con el deporte del campeonato al que pertenecen |

---

## Archivos a crear / modificar (resumen)

### Nuevos archivos
| Archivo | Descripción |
|---------|-------------|
| `database/migrations/063_tipo_deporte.sql` | Campos generalizados |
| `backend/config/sportsConfig.js` | Configuración centralizada por deporte |

### Archivos a modificar
| Archivo | Cambio principal |
|---------|-----------------|
| `backend/models/Partido.js` | Lógica disciplinaria sport-aware |
| `backend/models/Campeonato.js` | `tipo_deporte` en lugar de `tipo_futbol` |
| `backend/controllers/campeonatoController.js` | Aceptar baloncesto |
| `backend/controllers/planillaController.js` | Reglas de faltas por deporte |
| `frontend/planilla.html` | Secciones condicionales por deporte |
| `frontend/js/planilla.js` | `adaptarPlanillaAlDeporte()` |
| `frontend/js/campeonatos.js` | Etiqueta + opción baloncesto |
| `frontend/js/partidos.js` | Terminología por deporte |
| `frontend/js/jugadores.js` | Reporte disciplinario por deporte |

---

## Orden de implementación recomendado

```
Fase 1 (BD + config)  →  Fase 2 (backend)  →  Fase 3 (planilla)
      ↓
Fase 4 (campeonatos/partidos)  →  Fase 5 (portal)  →  Fase 6 (carnés/reportes)
```

Cada fase es independiente y no rompe las anteriores. Se puede pausar entre fases y el sistema queda funcional para fútbol en todo momento.

---

## Estimación de complejidad

| Fase | Complejidad | Archivos afectados |
|------|-------------|-------------------|
| 1 — BD y config | Baja | 2 nuevos |
| 2 — Backend modelos | Alta | 4 existentes |
| 3 — Planilla adaptable | Alta | 2 existentes |
| 4 — Campeonatos/partidos | Media | 3 existentes |
| 5 — Portal | Baja | 1 existente |
| 6 — Carnés/reportes | Baja | 1 existente |

---

## Notas adicionales

- **Handball, Voleibol, etc.:** La misma arquitectura de `sportsConfig.js` permite agregar más deportes en el futuro con mínimo esfuerzo.
- **Reglamentos locales:** El sistema debe poder configurar variantes (p.ej. cuartos de 10 min vs 12 min, límite de faltas por equipo por cuarto) por campeonato, no solo por deporte.
- **Fase B (largo plazo):** Si el volumen lo justifica, crear módulos de planilla totalmente separados por deporte (`planilla-futbol.html`, `planilla-basquetbol.html`) en vez de adaptar uno solo.
