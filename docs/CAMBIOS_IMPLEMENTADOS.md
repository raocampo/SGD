## 2026-03-31 - Portal público: fix de playoff y tabla pública con planillas

- `frontend/js/portal.js`: se corrigió la referencia rota `formatearRondaPortal(...)` por `formatearRondaPlayoffPortal(...)`, que estaba rompiendo el detalle de torneos con playoff en el portal público.
- `backend/controllers/tablaController.js`: las tablas públicas ya consideran como partidos publicados los `finalizado / no_presentaron_ambos` y también los partidos con `partido_planillas` guardada.
- Esto corrige el caso donde la pestaña `Resultados` sí mostraba partidos y la `Tabla de posiciones` seguía vacía o en cero por depender solo de `estado='finalizado'`.
# Cambios Implementados - LT&C

Ultima actualizacion: 2026-03-31 (sesión 20)

## Portal público - resultados con planilla

- Se corrigió la lectura pública de partidos para incluir el `LEFT JOIN` faltante a `partidos_eliminatoria` y el flag `tiene_planilla_publicada`.
- Se ajustó el conteo público de partidos publicados por evento para considerar planillas ya guardadas.
- Se ajustó `frontend/js/portal.js` para que la pestaña `Resultados` y el badge de jornada consideren partidos con planilla publicada además de los `finalizados`.
# Cambios implementados según propuesta LT&C

> Seguimiento continuo actualizado: `docs/BITACORA_AVANCES.md`

## Resumen
Se implementaron las recomendaciones priorizadas del documento `propuestaDesarrolloSGD.md`.

---

## 2026-03-30 - Playoff con sembrado manual asistido
- `frontend/eliminatorias.html`, `frontend/eventos.html`, `frontend/js/eliminatorias.js` y `frontend/js/eventos.js` agregan la plantilla `Manual asistida (definir P1..Pn)` dentro de la configuración de playoff.
- El organizador ahora puede partir de una sugerencia balanceada por grupos y luego redefinir manualmente el orden `P1..Pn` antes de generar la llave, manteniendo validación para no repetir equipos y usando solo clasificados vigentes.
- `backend/models/Eliminatoria.js` soporta `manual_asistida`, construye el catálogo actual de clasificados y genera la llave exactamente con el sembrado manual enviado por la UI.
- `backend/controllers/eventoController.js` normaliza y valida `manual_asistida` como valor aceptado de `playoff_plantilla`.

---
## 2026-03-29 - Penales en planilla de playoff y publicación pública
- `frontend/planilla.html`, `frontend/js/planilla.js` y `frontend/css/style.css` agregan captura de penales en la planilla de `playoff`, con validación para exigir un ganador cuando el partido termina empatado.
- `backend/models/Partido.js` persiste `resultado_local_shootouts`, `resultado_visitante_shootouts` y `shootouts`, y ya propaga el clasificado correcto a la llave cuando el desempate se define por penales.
- `backend/models/Eliminatoria.js` sincroniza cruces y reclasificaciones resueltas usando también el marcador de penales.
- `frontend/js/portal.js` y `frontend/css/portal.css` muestran en el portal público el resumen de penales debajo del resultado del partido cuando aplica.
- Pendiente operativo documentado: recomponer y validar la llave de playoff de los campeonatos afectados en producción para retomar pruebas E2E desde oficina.

---

## 2026-03-27 - Fix jugadores: eliminar y crear

- `backend/models/Jugador.js` → `eliminar()`: nullifica `jugador_id` en `goleadores` y `tarjetas` antes del `DELETE` para evitar violación del FK en Render (que no tenía `ON DELETE SET NULL`).
- `backend/controllers/jugadorController.js`: catch de creación usa `'Error interno del servidor'` para que `api.js` muestre el detalle real del error al usuario.
- Migración `057_fix_fk_on_delete_set_null.sql`: recrea FK `goleadores_jugador_id_fkey` y `tarjetas_jugador_id_fkey` con `ON DELETE SET NULL`. Aplicada y verificada en local y Render.
- `core.js`: administrador redirige a `admin.html` (no a `portal-admin.html`); acceso directo a `portal-admin.html` bloqueado para rol administrador.

---

## 2026-03-27 - Finanzas: cierre de permisos en gastos operativos
- `backend/models/Finanza.js` ahora soporta `campeonato_ids` en `listarGastos(...)` y añade `obtenerGastoPorId(...)` para consultar un gasto puntual con sus joins.
- `backend/controllers/finanzaController.js` corrige el uso de `obtenerCampeonatoIdsOrganizador(user)` en gastos operativos.
- El listado ya no devuelve gastos de otros campeonatos cuando el organizador no envía `campeonato_id`; ahora filtra por todos sus campeonatos permitidos.
- La edición y eliminación de gastos ya no cargan la tabla completa para buscar un ID; validan directamente sobre el gasto objetivo.
- Se endurece así el alcance real del módulo de `gastos_operativos` para organizadores y se evita exposición de datos financieros ajenos.

---
## 2026-03-27 - Alineación de migraciones local / Render
- Se auditó el estado real de migraciones recientes en ambas bases (`local` y `Render`) contra la documentación vigente.
- Se confirmó que ya estaban presentes en ambos entornos:
  - `051_roles_operador_sistema.sql`
  - `052_configuracion_sistema.sql`
  - `053_formas_pago.sql`
  - `054_formas_pago_paypal_tarjeta.sql`
- Se aplicó en BD local la migración pendiente:
  - `055_plan_estado_pendiente_pago.sql`
- Se aplicó en BD local y Render la migración pendiente:
  - `056_gastos_operativos.sql`
- Verificación final:
  - `usuarios_plan_estado_check` ya incluye `pendiente_pago` en ambos entornos.
  - `gastos_operativos` ya existe en ambas bases.
- También se corrigió el estado documental para reflejar que:
  - `050_eventos_juvenil_cupos_y_carnet_edad.sql` ya estaba aplicada en Render, no solo en local.

---

## 2026-03-25 - Juveniles por categoría, edad en carné y arquero resaltado en planilla
- Nueva migración `database/migrations/050_eventos_juvenil_cupos_y_carnet_edad.sql`.
- `backend/controllers/eventoController.js` y `frontend/eventos.html` / `frontend/js/eventos.js` ahora permiten configurar por categoría:
  - `categoria_juvenil`,
  - `categoria_juvenil_cupos`,
  - `categoria_juvenil_max_diferencia`,
  - `carnet_mostrar_edad`.
- La opción juvenil queda restringida a categorías `Sub/U 30` hasta `Sub/U 60`.
- `backend/models/Jugador.js` ahora valida la elegibilidad etaria por `evento_id`:
  - exige fecha de nacimiento cuando la categoría controla edad,
  - permite jugadores menores solo si la categoría activa juveniles,
  - valida el margen permitido (`1` o `2` años menor),
  - y controla cupos juveniles por equipo dentro de esa categoría.
- `frontend/js/jugadores.js` ya muestra la edad en tarjetas y tabla, marca a los jugadores juveniles con chip visual y resume `Juveniles: X / cupos` en la ficha del equipo.
- Los carnés ahora imprimen `Fecha nac.` y `Edad` si la categoría activa `Mostrar edad en carné`, y agregan `Condición: Juvenil` cuando corresponde.
- `frontend/js/planilla.js` + `frontend/css/style.css` ahora resaltan al arquero por color en:
  - el plantel lateral,
  - la tabla de captura,
  - la vista previa oficial de planilla.

---

## 2026-03-25 - Cédula consistente y planilla con número visible / auspiciantes en PDF
- `backend/models/Jugador.js` ahora normaliza `cedidentidad` eliminando caracteres no numéricos pero conservando ceros iniciales y valida que la cédula tenga exactamente `10 dígitos` cuando se informa.
- `backend/controllers/jugadorController.js` y `backend/services/mobileOperationsService.js` reutilizan la misma normalización para:
  - alta web,
  - importación masiva,
  - búsqueda local por cédula,
  - alta móvil.
- `frontend/jugadores.html`, `frontend/planilla.html`, `frontend/js/jugadores.js` y `frontend/js/planilla.js` refuerzan esa regla en UI:
  - inputs numéricos de cédula con longitud máxima `10`,
  - sanitización en vivo,
  - mensaje funcional si no se completan los `10` dígitos.
- `frontend/planilla.html` y `frontend/js/planilla.js` agregan el campo `Número de partido` editable dentro de la planilla.
- `backend/models/Partido.js` ahora actualiza `numero_campeonato` también desde `guardarPlanilla(...)`, y `backend/controllers/partidoController.js` ya devuelve error claro si ese número visible está duplicado en el campeonato.
- `frontend/js/planilla.js` mejora el bloque de auspiciantes:
  - fallback `activos -> todos`,
  - impresión real de logos en la cabecera del PDF,
  - continuidad visual entre cabecera web, vista previa y PDF.

---
## 2026-03-23 - Numeración visible de partidos y planilla de playoff
- `backend/controllers/partidoController.js` y `backend/models/Partido.js` ahora permiten definir `numero_campeonato` como número visible editable para cada partido:
  - se puede enviar al crear un partido manual,
  - se puede actualizar después desde `Editar partido`,
  - el identificador interno sigue intacto para auditoría.
- El backend ya intercepta la restricción única `idx_partidos_numero_campeonato` y devuelve un error funcional:
  - `Ese número visible de partido ya está en uso en este campeonato.`
- `frontend/js/partidos.js` añade el campo `N° visible del partido` en:
  - creación manual,
  - edición de partido.
- `frontend/js/planilla.js` deja de usar el `id` interno como fallback visual; si no existe número visible, la UI muestra `-` en lugar de filtrar el identificador técnico.
- `frontend/planilla.html` y `frontend/js/planilla.js` ya soportan `Planilla de Juego` para `playoff`:
  - nueva fase `Playoff`,
  - selector de `Ronda`,
  - lectura de partidos de llave y reclasificación,
  - cabecera/PDF con contexto `Llave` en vez de `Grupo`.
- `frontend/js/eliminatorias.js` expone el acceso directo a `Planilla` desde los cruces que ya tienen partido operativo.
- `frontend/jornadasplantilla.html` y `frontend/js/jornadasplantilla.js` soportan también posters por ronda de `playoff`.
- `frontend/gruposgen.html` y `frontend/js/gruposgen.js` corrigen la exportación duplicada de imagen/PDF:
  - se quitan disparos dobles,
  - se bloquean botones durante el render,
  - se evita crear dos archivos por una sola acción.

---

## 2026-03-22 - Cierre de impresión oficial de planilla
- `frontend/js/eliminatorias.js` y `frontend/css/style.css` ahora permiten que la plantilla publicable del playoff incluya la programación real del partido (`fecha`, `hora`, `cancha`) dentro del nodo cuando el cruce ya fue agendado.
- se compacta el layout especial del bracket publicable:
  - tarjetas más angostas,
  - wrapping controlado en nombres largos,
  - conectores más cortos,
  - fondo personalizado más contenido para evitar que la imagen se abra demasiado al exportar.
- `frontend/jugadores.html` incorpora el tipo de reporte `Nómina simple de jugadores`.
- `frontend/js/jugadores.js` añade exportación `Excel` para reportes de jugadores:
  - nómina oficial,
  - nómina simple,
  - sanciones por equipo,
  - consolidado disciplinario por categoría,
  - ficha individual.
- la nómina simple imprime/exporta solo:
  - nombres y apellidos,
  - cédula,
  - fecha de nacimiento.

---

## 2026-03-22 - Cierre de impresión oficial de planilla
- `frontend/planilla.html` y `frontend/js/planilla.js` separan las observaciones en tres bloques:
  - `Observación local`,
  - `Observación visitante`,
  - `Observación árbitro`.
- La impresión/PDF ya corrige la cabecera:
  - `Delegado` aparece una sola vez,
  - si el formato es `liga` se imprime `Liga` en vez de `Grupo: Sin grupo`.
- Las observaciones de la planilla oficial ahora se imprimen en una segunda hoja:
  - a ancho completo,
  - apiladas una debajo de otra.
- La vista previa y el PDF ya usan `max_jugador` como número real de filas del plantel, permitiendo `25` filas en `futbol 11` cuando así lo definió el organizador.
- `backend/models/Partido.js` persiste observaciones por lado:
  - `partido_planillas.observaciones_local`,
  - `partido_planillas.observaciones_visitante`.
- Nueva migración:
  - `database/migrations/048_planilla_observaciones_por_lado.sql`

---

## 2026-03-21 - Planilla arbitral extendida para futbol 11
- `frontend/planilla.html` agrega:
  - `Arbitro central`,
  - `Arbitro linea 1`,
  - `Arbitro linea 2`,
  - `Observaciones del arbitro`.
- `frontend/js/planilla.js` ya:
  - guarda y recarga esos campos,
  - oculta `linea 1 / linea 2` fuera de `futbol 11`,
  - los refleja en la vista previa oficial,
  - los refleja en el resumen,
  - los incluye en el PDF,
  - y combina observaciones generales + observaciones del arbitro al exportar XLSX para mantener compatibilidad con la plantilla base.
- `backend/models/Partido.js` persiste:
  - `partidos.arbitro_linea_1`,
  - `partidos.arbitro_linea_2`,
  - `partido_planillas.observaciones_arbitro`.
- nueva migracion:
  - `database/migrations/047_planilla_arbitros_f11_y_observaciones.sql`

---

## 2026-03-21 - Ajuste visual final de plantilla publicable del playoff
- `frontend/js/eliminatorias.js` y `frontend/css/style.css` afinan el bracket publicable especial (`8vos -> 4tos -> semifinal -> final`) para que los nodos muestren solo:
  - logo local + nombre local,
  - `vs`,
  - nombre visitante + logo visitante.
- Se retiran de los nodos publicables:
  - etiquetas internas tipo `8VO P1`, `4TO G1`,
  - referencias de siembra/tabla como `1A`, `4C`, `8B`.
- Las rondas ahora se titulan por bloque superior:
  - `Octavos`,
  - `Cuartos`,
  - `Semifinal`,
  - `Final`.
- Se agrega fondo personalizable para la plantilla desde `eliminatorias.html`, persistido por `campeonato + categoría`, sin alterar la llave base.
- Los conectores SVG del layout especial ahora se recalculan también al preparar la captura/exportación, con doble trazo para mejorar legibilidad.
- El layout especial ahora calcula anchos por columna a partir del nombre más largo de los equipos para evitar cuadros demasiado estrechos.
- El bloque `Tercer y cuarto` queda compacto y reservado debajo de `Final`, evitando que se salga del lienzo.
- Los auspiciantes se normalizan con cajas estables y `object-fit: contain`, evitando estiramientos.

---

## 2026-03-20 - Sincronización real de plantilla playoff y edición manual de cruces
- `backend/models/Eliminatoria.js` ya toma `eventos.playoff_plantilla` y `eventos.playoff_tercer_puesto` como fuente de verdad al cargar la configuración en `eliminatorias.html`, evitando que una fila vieja en `evento_playoff_config` deje la UI en `estandar`.
- `backend/controllers/eventoController.js` sincroniza una configuración de playoff existente cuando se actualiza la categoría desde `eventos.html`, manteniendo alineadas la card de categoría y la pantalla de eliminatorias.
- `frontend/js/eliminatorias.js` incorpora edición manual básica de partidos pendientes en el bracket mediante el botón `Editar cruce`.
- la edición manual usa el endpoint existente `PUT /eliminatorias/:id/equipos`, pero ahora también propaga `seed_local_ref` y `seed_visitante_ref` para que la gráfica quede coherente.
- validaciones nuevas en backend:
  - no se permite editar cruces finalizados o con resultado,
  - no se permite repetir equipos dentro de la misma ronda,
  - no se permite usar el mismo equipo como local y visitante.

---

## 2026-03-16 - Nómina de jugadores separada por categoría/evento
- nueva migracion `database/migrations/045_jugadores_evento_categoria.sql`.
- nueva migracion `database/migrations/046_jugadores_cedula_por_evento.sql`.
- `jugadores` incorpora `evento_id` para asociar la ficha operativa a la categoria/evento donde realmente participa.
- `backend/models/Jugador.js` ya usa ese contexto para:
  - crear jugadores por categoria,
  - leer planteles por `equipo + evento`,
  - validar cédula en la misma categoria,
  - validar numero de camiseta por categoria,
  - contar el maximo de jugadores por categoria,
  - designar/limpiar capitan por categoria.
- `backend/models/Partido.js` deja de consultar `jugadores` solo por `equipo_id` y ahora arma la planilla con el plantel del `evento_id` del partido.
- `backend/controllers/jugadorController.js`, `frontend/js/planilla.js`, `backend/services/mobileReadService.js` y `backend/services/mobileOperationsService.js` propagan `evento_id` para que las altas/lecturas queden alineadas.
- compatibilidad transitoria:
  - si un equipo participa en una sola categoria, el sistema aun puede leer filas legacy (`evento_id IS NULL`) mientras termina de migrarse el historial.
  - si un equipo participa en multiples categorias, la lectura se fuerza al `evento_id` actual para impedir compartir nomina entre categorias.
- la restriccion vieja `jugadores_dni_key UNIQUE (cedidentidad)` se reemplazo por un indice unico parcial sobre `(cedidentidad, evento_id)` para permitir la misma cédula en distintas categorías sin perder el bloqueo dentro de la misma categoría.
- despliegue:
  - `045` aplicada en BD local y Render.
  - `046` aplicada en BD local y Render.

---

## 2026-03-16 - Playoff respeta valores altos de clasificados por grupo
- `frontend/eliminatorias.html` amplia el selector visible de `Clasifican por grupo` para soportar cupos mayores a `6`.
- `frontend/js/eliminatorias.js` incorpora una lectura centralizada del valor actual de `clasificados_por_grupo`, usando como fallback el valor persistido en la categoria/configuracion cuando la UI llega sin opcion visible.
- esto corrige el caso de categorias como `Master (Sub +40)` donde la card mostraba `8 por grupo`, pero la pantalla de playoff quedaba vacia y terminaba bloqueando la generacion con el aviso `Clasifican por grupo debe ser mayor a 0`.
- al quedar alineado el valor real de cupos, la logica de clasificacion existente vuelve a sugerir correctamente al siguiente equipo elegible del mismo grupo y, si ya no alcanza, al mejor no clasificado del evento.

---

## 2026-03-16 - Plantilla balanceada para playoff por grupos
- la plantilla `balanceada_8vos` se renombra en UI como `Evitar reencuentros tempranos de grupo (balanceada)` para reflejar mejor su objetivo deportivo.
- `frontend/eliminatorias.html` y `frontend/js/eliminatorias.js` ahora muestran una vista previa del orden real de partidos cuando la categoria usa una llave balanceada desde grupos.
- escenario `4 grupos x 4 clasificados`:
  - el sistema sugiere por defecto los cruces `A vs C` y `B vs D`, que producen el orden:
  - `P1 1A vs 4C`
  - `P2 2B vs 3D`
  - `P3 1D vs 4B`
  - `P4 2C vs 3A`
  - `P5 1B vs 4D`
  - `P6 2A vs 3C`
  - `P7 1C vs 4A`
  - `P8 2D vs 3B`
- escenario `2 grupos x N clasificados`:
  - el backend ahora usa un sembrado espejo `A/B` que replica el criterio deportivo solicitado por operación.
  - ejemplo con `8 clasificados por grupo`:
    - `P1 1A vs 8B`
    - `P2 2B vs 7A`
    - `P3 3A vs 6B`
    - `P4 4B vs 5A`
    - `P5 1B vs 8A`
    - `P6 2A vs 7B`
    - `P7 3B vs 6A`
    - `P8 4A vs 5B`
  - la vista previa en UI ya no sale solo en chips: cuando arranca en `8vos`, muestra una grilla tipo bracket más cercana al diagrama operativo del cliente.
- con esto el organizador puede confirmar visualmente el armado antes de generar la llave y reducir el riesgo de cruces tempranos entre equipos del mismo grupo tanto en formatos `A/B` como `A/B/C/D`.

---

## 2026-03-16 - Plantilla de playoff con mejores perdedores
- `backend/models/Eliminatoria.js` incorpora una nueva plantilla formal:
  - `mejores_perdedores_12vos`
  - caso operativo soportado: `24 clasificados -> 12vos -> 12 ganadores + 4 mejores perdedores -> 8vos`.
- la plantilla:
  - genera la ronda `12vos`,
  - reserva `MP1..MP4` como placeholders de mejores perdedores en `8vos`,
  - y completa automaticamente esos cupos cuando termina la ronda `12vos`.
- la seleccion de mejores perdedores se resuelve usando el mismo ranking deportivo ya vigente:
  - rendimiento/porcentaje,
  - diferencia de goles,
  - goles a favor,
  - enfrentamiento directo cuando aplica,
  - fair play final.
- se blindo la logica de byes para que un ganador de `12vos` no avance automaticamente si el cupo rival todavia depende de `MP1..MP4`.
- `frontend/eliminatorias.html`, `frontend/js/eliminatorias.js`, `frontend/eventos.html` y `frontend/js/eventos.js` ya muestran la nueva opcion de plantilla.
- `frontend/js/portal.js` traduce la nueva ronda `12vos` y placeholders `Mejor perdedor #` en el portal publico.

---

## 2026-03-16 - Jugadores por categoria e invalidacion selectiva de tablas manuales
- `frontend/js/jugadores.js` ahora envia `evento_id` en alta/importacion de jugadores para que el backend valide la cédula contra la categoría real en contexto.
- `backend/controllers/jugadorController.js` y `backend/models/Jugador.js` usan ese `evento_id` como alcance de validación, evitando bloquear al mismo jugador en categorías distintas del mismo campeonato.
- `backend/models/Partido.js` deja de invalidar todas las tablas manuales del evento cuando se modifica un resultado.
- nuevo comportamiento:
  - si el evento trabaja por grupos, solo se elimina la edición manual del grupo afectado,
  - también se limpian únicamente la clasificación manual y la reclasificación del grupo afectado,
  - la llave de playoff del evento se elimina completa para regenerarse con la clasificación actual.

---

## 2026-03-15 - Portal público: playoff consistente con clasificación vigente
- `backend/models/Eliminatoria.js` incorpora un diagnóstico de consistencia para la llave publicada:
  - toma la clasificación vigente por grupos o tabla acumulada,
  - detecta reclasificaciones pendientes,
  - detecta vacantes playoff,
  - compara los equipos publicados en primera ronda contra los clasificados vigentes.
- `backend/services/publicPortalService.js` ya no publica una llave stale:
  - si la llave no coincide con la clasificación actual, responde sin rondas y con mensaje explicativo.
- `frontend/js/portal.js` muestra ese mensaje en la pestaña `Playoff` en vez de dibujar cruces incorrectos.
- impacto funcional:
  - equipos eliminados ya no deben verse en el playoff público,
  - si falta un cupo y la clasificación exige reclasificación o regeneración, el portal deja de publicar la llave hasta resolverlo.

---

## 2026-03-15 - Reclasificación playoff con partido y planilla operativa
- `backend/models/Eliminatoria.js` ya no deja la reclasificación solo en estado lógico:
  - al guardar `partido_extra_reclasificacion`, el `INSERT` devuelve la fila creada,
  - se sincroniza un `partido` real y se guarda en `evento_reclasificaciones_playoff.partido_id`.
- `frontend/js/eliminatorias.js` muestra ese enlace operativo en la tarjeta de reclasificación:
  - `Ver en partidos`
  - `Abrir planilla`
  - número de partido y estado
- `frontend/js/partidos.js` identifica estos cruces con badge `Partido extra playoff` y detalle `Grupo X • Cupo Y`.
- cuando el partido extra termina y queda `finalizado`, el backend ya sincroniza el ganador hacia la reclasificación para que el cupo playoff quede resuelto desde la planilla.
- base de datos:
  - nueva migración `database/migrations/042_reclasificacion_playoff_partido_operativo.sql`
  - aplicada en BD local y PostgreSQL de Render.

---

## 2026-03-15 - Plantillas configurables de playoff y tercer puesto
- `backend/controllers/eventoController.js` extiende el alta/edicion de categorias/eventos para guardar:
  - `playoff_plantilla`
  - `playoff_tercer_puesto`
- `frontend/eventos.html` y `frontend/js/eventos.js` agregan la configuracion inicial visible del armado de playoff:
  - `Estandar`
  - `Evitar reencuentros tempranos de grupo (balanceada)`
  - `Tercer y cuarto puesto`
- `backend/models/Eliminatoria.js` incorpora plantillas de llave configurables:
  - la plantilla `balanceada_8vos` arma 8vos para `16 clasificados / 4 grupos` con el orden solicitado:
    - `1A vs 4C`
    - `2B vs 3D`
    - `1D vs 4B`
    - `2C vs 3A`
    - `1B vs 4D`
    - `2A vs 3C`
    - `1C vs 4A`
    - `2D vs 3B`
  - tambien arma playoff balanceado para `2 grupos x N clasificados` usando orden de seeds de bracket para retrasar reencuentros del mismo grupo.
  - mantiene fallback al armado estandar cuando el dataset no corresponde al caso balanceado de 16 clasificados.
- `backend/models/Eliminatoria.js` y `frontend/js/eliminatorias.js` agregan soporte para:
  - partido de `tercer_puesto`,
  - propagacion de `ganador` y `perdedor` hacia slots posteriores,
  - etiquetas operativas `8VO P#`, `4TO G#`, `SEM G#`, `FINAL`, `TERCER Y CUARTO`.
- `frontend/eliminatorias.html` expone la misma configuracion dentro del modulo de playoff para regenerar o ajustar la llave con esos criterios.
- `frontend/js/portal.js` traduce esas rondas a etiquetas legibles en el portal publico.
- base de datos:
  - nueva migración `database/migrations/043_evento_playoff_templates_y_tercer_puesto.sql`
  - nueva migración `database/migrations/044_partidos_eliminatoria_fuente_ganador_perdedor.sql`
  - ambas aplicadas en BD local y PostgreSQL de Render.

---

## 2026-03-14 - Recorte estable de foto para carné
- Navegacion interna limpia:
  - `frontend/js/core.js` incorpora `RouteContext` para guardar contexto por pagina en `sessionStorage`.
  - las pantallas internas dejan de exponer IDs operativos en la URL y recuperan el contexto desde sesion.
  - se adapto la navegacion entre:
    - `campeonatos`, `eventos`, `equipos`, `jugadores`,
    - `sorteo`, `grupos`, `eliminatorias`,
    - `partidos`, `planilla`, `fixtureplantilla`,
    - `tablas`.
  - tambien se agrega limpieza de la barra al cargar cuando la pagina entra desde un enlace legacy con query string.
  - verificacion:
    - `node --check frontend/js/core.js`
    - `node --check frontend/js/campeonatos.js`
    - `node --check frontend/js/eventos.js`
    - `node --check frontend/js/equipos.js`
    - `node --check frontend/js/jugadores.js`
    - `node --check frontend/js/sorteo.js`
    - `node --check frontend/js/gruposgen.js`
    - `node --check frontend/js/eliminatorias.js`
    - `node --check frontend/js/partidos.js`
    - `node --check frontend/js/planilla.js`
    - `node --check frontend/js/fixtureplantilla.js`
    - `node --check frontend/js/tablas.js`

---

## 2026-03-14 - Tablas manuales con auditoria y reclasificacion playoff
- Tablas de posiciones:
  - `backend/controllers/tablaController.js` incorpora persistencia de correcciones manuales por evento/grupo en:
    - `tabla_posiciones_manuales`,
    - `tabla_posiciones_auditoria`.
  - solo `administrador` puede guardar o restablecer una tabla manual.
  - cada correccion exige `comentario` y deja auditoria con snapshot anterior/nuevo y usuario responsable.
  - la tabla manual ya no conserva un orden fijo ciego: si el administrador corrige `PTS`, `GF`, `GC` u otros datos base, la posicion se recalcula automaticamente segun las reglas de desempate y la posicion manual queda como desempate final.
  - `backend/routes/tablaRoutes.js` expone:
    - `PUT /api/tablas/evento/:evento_id/posiciones/manual`
    - `POST /api/tablas/evento/:evento_id/posiciones/manual/reset`
  - `frontend/js/tablas.js` agrega modo de edicion inline por grupo para administradores:
    - editar orden/estadisticas visibles,
    - guardar con comentario,
    - restablecer tabla calculada.
- Eliminatorias / playoff:
  - `backend/models/Eliminatoria.js` deja de clasificar equipos eliminados y ahora consume la misma tabla ya ajustada que genera `tablaController`, incluyendo correcciones manuales.
  - se modela el caso `partido_extra_reclasificacion` cuando existe una vacante real de clasificacion:
    - se crea un registro en `evento_reclasificaciones_playoff`,
    - se proponen automaticamente los mejores opcionados externos,
    - el sistema reserva esos equipos para no duplicarlos en otros cupos,
    - no permite generar la llave final mientras exista una reclasificacion pendiente.
  - `frontend/js/eliminatorias.js` muestra esas reclasificaciones por grupo y permite registrar el ganador para cerrar el cupo.
  - `backend/controllers/eliminatoriaController.js` y `backend/routes/eliminatoriaRoutes.js` agregan el endpoint de resolucion:
    - `PUT /api/eliminatorias/evento/:evento_id/reclasificaciones/:reclasificacion_id`
- Base de datos:
  - nuevas migraciones:
    - `database/migrations/040_tablas_posiciones_manual_y_auditoria.sql`
    - `database/migrations/041_reclasificacion_playoff_vacantes.sql`
  - aplicadas y verificadas en:
    - local,
    - Render.
- Verificacion:
  - `node --check backend/controllers/tablaController.js`
  - `node --check backend/models/Eliminatoria.js`
  - `node --check backend/controllers/eliminatoriaController.js`
  - `node --check frontend/js/tablas.js`
  - `node --check frontend/js/eliminatorias.js`
  - `npm --prefix backend run smoke` => `PASS 9/9`

---

## 2026-03-14 - E2E y dataset publico auto-descubierto
- QA operativa:
  - `backend/scripts/e2eOperationalFlowCheck.js` deja de depender del "primer campeonato" visible para administrador.
  - el script ahora busca automaticamente un campeonato visible en portal publico y dentro de el selecciona un evento con:
    - equipos,
    - partidos,
    - tablas y partidos publicos disponibles.
  - `backend/scripts/qaUiDatasetCheck.js` deja de usar IDs fijos legacy (`6/13/194/91`) y tambien descubre un dataset publico/operativo valido antes de validar:
    - mobile,
    - portal publico,
    - pantallas web clave.
- Base de datos:
  - `database/migrations/039_jugadores_foto_carnet_recorte.sql` aplicada y verificada en local y Render.
- Verificacion:
  - `npm --prefix backend run smoke:roles` => `PASS 18/18`
  - `npm --prefix backend run smoke:frontend` => `PASS 38/38`
  - `npm --prefix backend run smoke:matrix` => `PASS 48/48`
  - `npm --prefix backend run e2e:ops-flow` => `OK dataset campeonato=2 evento=8 partido=65 equipo=42`
  - `npm --prefix backend run qa:ui-dataset` => `OK dataset campeonato=2 evento=8 partido=65 equipo=42`

---

## 2026-03-14 - Recorte estable de foto para carné
- Jugadores / carnés:
  - `frontend/jugadores.html` reemplaza la previsualización de ajuste por un `canvas` que muestra el encuadre real del carné.
  - `frontend/js/jugadores.js` genera una imagen recortada específica al guardar (`foto_carnet_recorte`) usando el mismo algoritmo que la vista previa.
  - el mismo flujo de ajuste ahora permite arrastrar la imagen con mouse o dedo dentro del marco, muestra una guía visual de rostro y agrega el botón `Restablecer` para volver al encuadre base.
  - `backend/routes/jugadorRoutes.js` y `backend/controllers/jugadorController.js` aceptan y persisten ese recorte como archivo propio.
  - `backend/models/Jugador.js` incorpora `foto_carnet_recorte_url` para conservar la foto original y un derivado estable para PDF/impresión.
  - `renderPlantillaCarnets()` ahora prioriza `foto_carnet_recorte_url`, evitando desfases cuando el navegador exporta a PDF.
- Base de datos:
  - nueva migración `database/migrations/039_jugadores_foto_carnet_recorte.sql`.
- Verificación:
  - `node --check backend/models/Jugador.js`
  - `node --check backend/controllers/jugadorController.js`
  - `node --check backend/routes/jugadorRoutes.js`
  - `node --check frontend/js/jugadores.js`
  - `npm --prefix backend run smoke` => `PASS 9/9`

---

## 2026-03-14 - Advertencia previa al cierre por inactividad
- Seguridad / autenticacion:
  - `frontend/js/core.js` agrega una advertencia visual antes del cierre de sesion por inactividad.
  - el modal muestra cuenta regresiva y ofrece dos acciones:
    - `Seguir conectado`,
    - `Cerrar sesión ahora`.
  - si el usuario renueva la sesion, la actividad se vuelve a registrar y el temporizador se rearma.
  - la advertencia se cierra tambien si otra pestaña registra actividad y actualiza `AUTH_LAST_ACTIVITY_KEY`.
- Verificacion:
  - `node --check frontend/js/core.js`
  - `npm --prefix backend run smoke` => `PASS 9/9`

---

## 2026-03-14 - Correccion de guardado de jugadores con fotos
- Frontend:
  - `frontend/js/jugadores.js` deja de usar `fetch(...)` directo para multipart y ahora usa `ApiClient.requestForm(...)`, heredando el header `Authorization`.
  - `frontend/js/api.js` ya prioriza `detalle` cuando el backend devuelve `error interno` con mensaje tecnico util.
- Backend:
  - `backend/config/multerConfig.js` aumenta el limite de archivos a `8MB`.
  - `backend/controllers/jugadorController.js` valida `req.fileValidationError` tanto en crear como en actualizar.
  - `backend/server.js` agrega manejo global de `multer.MulterError` para devolver `400` en vez de `500` cuando falla la subida por tamaño o parsing del adjunto.
- Resultado:
  - la subida de fotos de jugador en web ya no depende de un `fetch` sin token,
  - si una imagen falla por peso/tipo, el usuario recibe mensaje claro en vez de `Error interno del servidor`.
- Verificacion:
  - `node --check frontend/js/api.js`
  - `node --check frontend/js/jugadores.js`
  - `node --check backend/config/multerConfig.js`
  - `node --check backend/controllers/jugadorController.js`
  - `node --check backend/server.js`
  - `npm --prefix backend run smoke` => `PASS 9/9`

---

## 2026-03-13 - Consolidacion local y salida visible en topbar
- Repositorio:
  - se auditaron y consolidaron cambios locales antes de sincronizar con `origin/main`.
  - se aplicaron en la BD local las migraciones:
    - `037_eventos_clasificacion_tabla_acumulada.sql`
    - `038_jugadores_foto_carnet_zoom.sql`
  - verificacion tecnica ejecutada:
    - `node --check` sobre backend/frontend modificado,
    - `npm --prefix backend run smoke` => `PASS 9/9`.
- UX del sistema deportivo:
  - `frontend/js/core.js` ahora agrega un boton visible `Salir` junto al badge del usuario en la topbar.
  - `frontend/css/style.css` hace que ese bloque sea responsivo, permitiendo que el boton baje debajo del nombre del usuario en pantallas pequenas sin romper el header.

## 2026-03-13 - Inactividad web y jugadores por categoria
- Seguridad / autenticacion:
  - `frontend/js/core.js` implementa timeout de sesion por inactividad de `1 hora`.
  - la ultima actividad queda sincronizada entre pestañas y, si expira, la aplicacion redirige a `login.html` con motivo `idle`.
  - `frontend/js/api.js` agrega `AuthAPI.logout(...)`.
  - `frontend/js/login.js` y `frontend/js/register.js` ahora guardan tambien `refreshToken` en `window.Auth.setSession(...)` y muestran aviso claro cuando la sesion se cerro por inactividad.
- Jugadores:
  - `backend/models/Jugador.js` reemplaza la validacion `verificarJugadorUnicoPorCampeonato(...)` por una validacion por `evento/categoria`, permitiendo que la misma cedula participe en varias categorias del mismo campeonato.
  - la restriccion sigue vigente para evitar que un jugador quede en dos equipos de la misma categoria.
  - `frontend/jugadores.html` oculta sliders visibles de posicion/zoom de la foto de carné y deja una herramienta de ajuste solo con botones.
  - `frontend/js/jugadores.js` agrega hero visual a la card del jugador:
    - usa `foto_carnet_url` si existe,
    - cae al logo del equipo si no hay foto,
    - y finalmente usa placeholder si falta todo.
  - `Planilla` deja de ocupar la cabecera de la card y queda en la franja de acciones.
  - `frontend/css/style.css` agrega el layout `4/3/2/1` para cards de jugadores y estilos del nuevo hero.

---

## 2026-03-12 - Usuarios organizadores alineados con Mi Landing
- Usuarios / roles:
  - `frontend/usuarios.html` incorpora campos base del organizador para no fragmentar el perfil entre modulos:
    - `organizacion`,
    - `lema publico`,
    - `correo de contacto publico`,
    - `telefono / WhatsApp publico`,
    - `logo de la organizacion`.
  - `frontend/js/usuarios.js` ahora:
    - muestra/oculta esos campos segun el rol seleccionado,
    - precarga el contexto real de `Mi Landing` al editar un organizador,
    - renderiza preview del logo actual,
    - sincroniza el logo con `Mi Landing` cuando el administrador lo sube desde usuarios.
- API / backend:
  - `frontend/js/api.js` permite actualizar configuracion de `Mi Landing` por `organizador_id`, para que el administrador pueda operar sobre organizadores concretos desde `usuarios.html`.
  - `backend/controllers/authController.js` sincroniza el perfil base del organizador hacia `OrganizadorPortal` en:
    - registro publico,
    - alta por administrador,
    - edicion por administrador.
  - `backend/models/OrganizadorPortal.js` devuelve la sincronizacion en sentido inverso y actualiza `usuarios.organizacion_nombre` cuando ese dato cambia desde `Mi Landing`.
- Verificacion:
  - `node --check frontend/js/usuarios.js`
  - `node --check frontend/js/api.js`
  - `node --check backend/controllers/authController.js`
  - `node --check backend/models/OrganizadorPortal.js`
  - `npm --prefix backend run smoke` => `PASS 9/9`

---

## 2026-03-11 - Fondo de carné configurable por campeonato
- Campeonatos:
  - nueva migracion:
    - `database/migrations/035_campeonato_fondo_carnet.sql`.
  - `backend/models/Campeonato.js` agrega soporte para `carnet_fondo_url`.
  - `backend/routes/campeonatoRoutes.js` pasa de `upload.single("logo")` a `upload.fields(...)` para soportar:
    - `logo`,
    - `carnet_fondo`.
  - `backend/controllers/campeonatoController.js` ahora:
    - guarda el fondo de carné como upload propio en `uploads/campeonatos/carnets`,
    - permite reemplazarlo,
    - permite eliminarlo,
    - limpia el archivo anterior cuando cambia.
- Frontend de campeonatos:
  - `frontend/campeonatos.html` incorpora:
    - campo de archivo para `Fondo de carné / marca de agua`,
    - preview del archivo actual,
    - checkbox para eliminar fondo actual.
  - `frontend/js/campeonatos.js` ya envia:
    - `carnet_fondo`,
    - `eliminar_carnet_fondo`,
    y muestra previews del logo/fondo actuales.
- Render de carnés:
  - `frontend/js/jugadores.js` ahora incorpora en `campeonatoMeta`:
    - `carnet_fondo_url`,
    - `color_primario`,
    - `color_secundario`,
    - `color_acento`.
  - se genera un estilo por carné con variables CSS para mezclar:
    - colores del campeonato,
    - logo,
    - imagen de fondo tipo marca de agua.
  - el carné sigue generandose dinamicamente, por lo que al reimprimir toma siempre la identidad visual actual del campeonato.
- Estilos:
  - `frontend/css/style.css` agrega capa `carnet-backdrop` y variables visuales para que preview, impresion y PDF compartan el mismo layout.
- Migracion aplicada:
  - local: `OK`,
  - Render: `OK`.

---

## 2026-03-11 - Jugadores, portal publico y tipos de futbol ampliados
- Portal del organizador:
  - `database/migrations/034_organizador_portal_branding.sql` crea:
    - `organizador_portal_config`,
    - `organizador_portal_media`,
    - `organizador_portal_auspiciantes`.
  - `backend/models/OrganizadorPortal.js` encapsula configuracion, media y auspiciantes propios del organizador.
  - nuevo modulo:
    - `backend/controllers/organizadorPortalController.js`,
    - `backend/routes/organizadorPortalRoutes.js`,
    - `frontend/organizador-portal.html`,
    - `frontend/js/organizador-portal.js`.
  - `backend/server.js` expone `/api/organizador-portal`.
  - `backend/controllers/authController.js`, `backend/services/publicPortalService.js`, `backend/controllers/publicPortalController.js`, `backend/routes/publicRoutes.js` y `frontend/js/portal.js` ya consumen branding/media/auspiciantes propios del organizador y dejan de mezclar auspiciantes LT&C con los del torneo/organizador.
  - `frontend/js/core.js`, `frontend/portal-admin.html` y `frontend/js/portal-admin.js` agregan acceso directo a `Mi Landing` para organizadores.
  - la migracion `034` se aplico y verifico tanto en local como en Render.
- Estilo/ortografia:
  - formularios, reportes y mensajes visibles al usuario quedan estandarizados con `carné/carnés`.
  - no se alteran claves tecnicas existentes como:
    - `foto_carnet_url`,
    - `requiere_foto_carnet`,
    - ids/nombres internos usados por backend/frontend.
- Jugadores:
  - `frontend/js/jugadores.js` corrige el formateo de `fecha_nacimiento` para evitar el desfase de `-1 dia` provocado por la zona horaria del navegador.
  - `frontend/jugadores.html`, `frontend/js/jugadores.js` y `backend/controllers/jugadorController.js` agregan eliminacion explicita de `foto carné` desde el perfil/modal del jugador, incluyendo limpieza del archivo local cuando se reemplaza o marca para borrado.
  - los inputs de `foto_cedula` y `foto_carnet` quedan preparados para captura directa desde celular con:
    - `capture="environment"` para cédula,
    - `capture="user"` para foto del jugador/foto carnet.
- Portal publico:
  - `frontend/js/portal.js` vuelve a mostrar campeonatos `borrador` / `inscripcion` cuando son torneos reales del organizador o registros legacy con `organizador` informado.
  - `backend/services/publicPortalService.js` amplía la regla publica para aceptar campeonatos legacy con `creador_usuario_id IS NULL` y `organizador` poblado, manteniendo fuera torneos QA/admin.
- Campeonatos:
  - `frontend/campeonatos.html` y `frontend/js/campeonatos.js` amplian el catalogo de modalidades:
    - `futbol_11`,
    - `futbol_9`,
    - `futbol_8`,
    - `futbol_7`,
    - `futbol_6`,
    - `futbol_5`,
    - `futsala`,
    - `indor`.
  - `frontend/js/planilla.js` y `backend/controllers/tablaController.js` se alinean para que fair play/planilla entiendan correctamente las nuevas modalidades.
  - nueva migracion:
    - `database/migrations/033_campeonatos_tipos_futbol_ampliados.sql`.
  - `database/esquema.sql` queda alineado con el nuevo `CHECK` de `campeonatos.tipo_futbol`.
  - la migracion `033` se aplico en:
    - entorno local,
    - PostgreSQL remoto en Render.
- Navegacion publica:
  - `frontend/index.html` y `frontend/portal.html` ahora abren `Ingresar` / `Registrarse` en nueva ventana para no perder el contexto del portal compartible.

---

## 2026-03-10 - Preparacion de despliegue + portal publico por mismo origen
- Render:
  - servicio `https://ltyc.onrender.com` desplegado y en estado `Live`,
  - verificacion tecnica inicial completada en:
    - `/salud`,
    - `/testDb`.
  - favicon LT&C visible en el navegador.
- Sorteo:
  - `backend/models/Grupo.js` impide reiniciar el sorteo si la categoria ya tiene:
    - partidos programados,
    - eliminatorias generadas.
  - `backend/controllers/grupoController.js` devuelve error controlado de negocio en lugar de excepcion FK sobre `grupos`.
- Portal publico:
  - `frontend/js/portal.js` ya renderiza todas las cards reales visibles del organizador, incluyendo torneos proximos creados desde el sistema.
  - se eliminan las cards estaticas/de relleno de "proximo torneo".
  - las cards ahora muestran el nombre del organizador por encima del campeonato.
  - el texto `ELIMINADO` en tablas publicas/internas se reduce para suavizar la fila visualmente.
- Auspiciantes:
  - `backend/services/publicPortalService.js` incorpora fallback desde `/uploads/auspiciantes` si no existen registros vinculados en BD.
  - esto alinea el portal publico con el comportamiento ya aplicado en grupos, fixture y eliminatorias.
- Seguridad visual:
  - `frontend/js/core.js` oculta el contenido de paginas privadas mientras se valida sesion/rol para evitar exposicion visual transitoria al navegar directo.

- Portal publico endurecido para competiciones reales:
  - `backend/services/publicPortalService.js` filtra campeonatos publicos solo por `creador_usuario_id` cuyo usuario tenga rol `organizador`.
  - quedan fuera del portal general los campeonatos creados por `administrador` y los torneos QA asociados a cuentas administrativas.
  - `backend/controllers/publicPortalController.js` asume tambien la capa publica de:
    - goleadores,
    - tarjetas,
    - fair play,
    evitando que eventos no publicos se consulten por URL directa.
  - `backend/routes/publicRoutes.js` deja de exponer esos endpoints por `tablaController` sin filtro publico.
- Landing publica del organizador ajustada:
  - `backend/controllers/authController.js` ya no mezcla campeonatos por alias de texto,
  - solo lista campeonatos creados por el organizador real (`creador_usuario_id = organizador.id`).
- Portal deportivo refinado en frontend:
  - `frontend/js/portal.js` mantiene tabs por categoria y deja subtabs enfocadas en:
    - `Tabla de posiciones`,
    - `Goleadores`,
    - `Fair play`,
    - `Tarjetas amarillas`,
    - `Tarjetas rojas`.
  - se separa la tabla de tarjetas en dos vistas por equipo para lectura mas clara.
  - las tablas de posiciones por grupo ahora se renderizan en grid responsive `2x1` mediante `frontend/css/portal.css`.
- Despliegue:
  - nuevo documento `docs/DEPLOY_RENDER.md`,
  - nuevo archivo `render.yaml` para desplegar LT&C como un solo servicio Node en Render.
- Conexion a base de datos:
  - `backend/config/database.js` ahora acepta `DATABASE_URL`,
  - soporte de SSL configurable por:
    - `DATABASE_SSL`,
    - `PGSSLMODE`.
  - se mantiene compatibilidad con `DB_USER/DB_HOST/DB_NAME/DB_PASSWORD/DB_PORT`.
- Frontend por entorno:
  - `frontend/js/core.js` y `frontend/js/api.js` ya resuelven la API automaticamente:
    - local con Live Server -> `http://localhost:5000/api`,
    - produccion -> `${window.location.origin}/api`.
  - modulos visuales ajustados para construir URLs de backend por mismo origen.
- Portal publico:
  - `frontend/portal.html` y `frontend/js/portal.js` fueron reestructurados para mostrar:
    - tabs por categoria,
    - subtabs por seccion deportiva,
    - jornadas agrupadas,
    - tablas/fair play/goleadores/playoff dentro de un mismo detalle navegable.
- Branding tecnico:
  - nuevo `frontend/favicon.svg`,
  - favicon agregado a las vistas principales del sistema y del portal.
- Uploads estables en despliegue:
  - nuevo archivo `backend/config/uploads.js`,
  - `backend/server.js` ahora expone `/uploads` desde `UPLOADS_DIR` si esta configurado,
  - `backend/config/multerConfig.js` y los controladores de borrado/lectura de archivos (`campeonatos`, `equipos`, `auspiciantes`) consumen la misma ruta centralizada,
  - `backend/.env.example` incorpora `UPLOADS_DIR`,
  - `render.yaml` queda preparado con disco persistente en `/var/data` y `UPLOADS_DIR=/var/data/uploads`.
- Jugadores:
  - `backend/config/multerConfig.js` ya permite definir carpetas por campo de archivo.
  - `backend/routes/jugadorRoutes.js` separa fisicamente:
    - `foto_cedula` en `uploads/jugadores/cedulas`,
    - `foto_carnet` en `uploads/jugadores/fotos`.
  - `backend/controllers/jugadorController.js` construye URLs por subcarpeta manteniendo compatibilidad con:
    - `foto_cedula_url`,
    - `foto_carnet_url`.
  - criterio operativo mantenido:
    - el carnet generado no se almacena como imagen final,
    - la reimpresion se resuelve regenerando el PDF desde la informacion del jugador y sus fotos/documentos almacenados.
- Seguridad:
  - nueva migracion `database/migrations/031_usuarios_cambio_password_obligatorio.sql`.
  - `backend/models/UsuarioAuth.js` ahora soporta `debe_cambiar_password`.
  - usuarios creados por `administrador/organizador` quedan marcados para cambio obligatorio al primer ingreso.
  - `backend/controllers/authController.js` expone cambio de contraseña propio y marca nuevamente la cuenta cuando un admin reasigna clave desde usuarios.
  - nuevo endpoint:
    - `POST /api/auth/password/change`.
  - `backend/middleware/authMiddleware.js` permite esta operacion incluso para cuentas `solo_lectura`.
  - `frontend/js/core.js` fuerza cambio de contraseña pendiente y agrega accion `Cambiar clave` en top bar.
  - `frontend/js/login.js` y `frontend/js/usuarios.js` muestran mensajes claros al ingresar/crear/actualizar usuarios.
- Portal publico deportivo:
  - `frontend/js/portal.js` vuelve a exponer `Playoff` como subtab por categoria consumiendo `GET /api/public/eventos/:evento_id/eliminatorias`.
  - la llave publica se renderiza por rondas con tarjetas propias y marcador progresivo.
  - `frontend/css/portal.css` y `frontend/js/portal.js` ya replican en portal los estados visuales del sistema:
    - fuera de clasificacion en naranja,
    - eliminados en rojo oscuro con causal visible.
  - `backend/controllers/tablaController.js` ya excluye equipos eliminados de `Fair Play`.
- Usuarios internos con correo o username:
  - nueva migracion `database/migrations/032_usuarios_username_opcional.sql`.
  - `backend/models/UsuarioAuth.js` ahora soporta `username` opcional, `email` nullable y validacion de al menos un identificador.
  - el login (`backend/controllers/authController.js`) acepta `identificador` y resuelve `correo o usuario`.
  - `frontend/login.html` y `frontend/js/login.js` muestran `Correo o usuario`.
  - `frontend/usuarios.html` y `frontend/js/usuarios.js` permiten alta/edicion con:
    - correo,
    - username,
    - o ambos.
  - la recuperacion de contraseña se mantiene exclusiva para cuentas con correo.

---

## 2026-03-09 - Eliminacion manual por categoria + clasificacion manual sugerida
- Configuracion compartida de playoff/clasificacion:
  - nueva tabla/versionado runtime `evento_playoff_config`,
  - nuevos endpoints:
    - `GET /api/eliminatorias/evento/:evento_id/configuracion`,
    - `PUT /api/eliminatorias/evento/:evento_id/configuracion`,
    - `DELETE /api/eliminatorias/evento/:evento_id/configuracion`.
  - `frontend/tablas.html` y `frontend/eliminatorias.html` quedan sincronizados sobre la misma configuracion guardada.
- Nueva migracion:
  - `database/migrations/030_evento_playoff_config.sql`.
- Estado competitivo por equipo en categoria:
  - nuevo servicio `backend/services/competitionStatusService.js` para centralizar:
    - causales de eliminacion manual,
    - lectura de estado competitivo por `evento_equipos`,
    - lectura de clasificados manuales por grupo.
  - nuevas causales soportadas:
    - `indisciplina`,
    - `deudas`,
    - `sin_justificativo_segunda_no_presentacion`.
  - `backend/controllers/eventoController.js` expone:
    - `PUT /api/eventos/:evento_id/equipos/:equipo_id/estado-competencia`,
    - campos extendidos en `GET /api/eventos/:evento_id/equipos`.
- Clasificacion manual con sugerencia del sistema:
  - nuevo almacenamiento `evento_clasificados_manuales`,
  - `backend/controllers/eliminatoriaController.js` incorpora:
    - `GET /api/eliminatorias/evento/:evento_id/clasificacion`,
    - `PUT /api/eliminatorias/evento/:evento_id/clasificacion-manual`.
  - `backend/models/Eliminatoria.js` ahora:
    - excluye equipos eliminados automaticos/manuales al generar llaves,
    - usa sugerencia por tabla como base,
    - respeta la decision manual del organizador por grupo/cupo,
    - propone mejores no clasificados del evento cuando un grupo queda incompleto,
    - guarda criterio manual por cupo para trazabilidad deportiva.
- Frontend eliminatorias:
  - `frontend/eliminatorias.html` agrega:
    - bloque `Estado competitivo de equipos`,
    - bloque `Clasificación manual con sugerencia`.
  - `frontend/js/eliminatorias.js` permite:
    - eliminar/rehabilitar equipos por causal,
    - seleccionar clasificados manuales por grupo,
    - seleccionar candidatos adicionales del evento,
    - guardar detalle opcional del criterio aplicado.
- Frontend sincronizado con el nuevo estado:
  - `frontend/js/tablas.js` marca en rojo eliminaciones manuales con su causal,
  - `frontend/js/equipos.js` muestra chips de eliminacion manual,
  - `backend/controllers/tablaController.js` reordena a los eliminados al final de la tabla,
  - los equipos fuera de clasificacion cambian a color naranja/marron y los eliminados a rojo oscuro,
  - la leyenda de causal de eliminacion se muestra con mas jerarquia visual dentro de la celda.
- Sistema visual de mensajes:
  - `frontend/js/core.js` incorpora notificaciones visuales, confirmaciones, alertas y formularios modales reutilizables,
  - se elimina dependencia de `alert/confirm/prompt` nativos en los modulos principales del panel.
- Nueva migracion:
  - `database/migrations/029_eliminacion_manual_y_clasificacion_manual.sql`.

---

## 2026-03-08 - Tablas por campeonato (aislamiento por organizador) + guardado explícito de formato
- Corrección de aislamiento de datos en categorías/tablas:
  - `backend/routes/eventoRoutes.js` ahora protege con `requireAuth + requireRoles` los endpoints de lectura:
    - `GET /api/eventos`
    - `GET /api/eventos/campeonato/:campeonato_id`
    - `GET /api/eventos/:id`
    - `GET /api/eventos/:evento_id/canchas`
  - `backend/controllers/eventoController.js` ahora filtra `listarEventos` por campeonatos permitidos del organizador y valida acceso por campeonato al listar/leer/editar/eliminar categoría.
  - se reforzó alcance del organizador también en:
    - asignación/listado de canchas del evento,
    - listado y baja de equipos en categoría.
- Endpoints de tablas internos ahora privados:
  - `backend/routes/tablaRoutes.js` exige autenticación y roles para:
    - `GET /api/tablas/grupo/:grupo_id`
    - `GET /api/tablas/campeonato/:campeonato_id`
    - `GET /api/tablas/evento/:evento_id/*`
  - se mantiene separado el consumo público vía `/api/public/eventos/:id/...`.
- UX/flujo de `frontend/tablas.html` + `frontend/js/tablas.js`:
  - nuevo selector de `Campeonato` encima de `Categoría`,
  - persistencia de contexto por usuario (`localStorage` con clave por `user_id`) para evitar cruce de selección entre cuentas distintas,
  - nuevo bloque `Formato de Clasificación` con:
    - `metodo_competencia`,
    - `clasificados_por_grupo`,
    - botón `Guardar formato` que ejecuta `PUT /api/eventos/:id`.
  - al guardar formato, se refrescan tablas automáticamente.
- Ajuste visual de soporte:
  - estilos añadidos en `frontend/css/style.css` para bloque `tablas-formato-config`.

---

## 2026-03-08 - Auditoria de edicion de planillas finalizadas
- Backend planilla con control de reapertura/edicion:
  - `backend/models/Partido.js` actualiza `guardarPlanilla` para recibir `opciones.usuario_id`,
  - cuando la planilla ya estaba finalizada y existe registro previo, se exige `motivo_edicion` (minimo 8 caracteres),
  - se agrega persistencia de auditoria en nueva tabla `partido_planilla_ediciones`.
- Nueva migracion:
  - `database/migrations/028_auditoria_edicion_planilla.sql`.
- Trazabilidad almacenada por edicion:
  - snapshot antes y despues de:
    - `partidos`,
    - `partido_planillas`,
    - `goleadores`,
    - `tarjetas`.
- Controlador y clientes mobile alineados:
  - `backend/controllers/partidoController.js` ahora propaga `usuario_id` del token y devuelve `statusCode` de errores de negocio,
  - `backend/services/mobileOperationsService.js` y `backend/services/mobileCompetitionService.js` soportan `editReason/motivoEdicion/motivo_edicion`.
- Frontend planilla:
  - `frontend/js/planilla.js` pide motivo de edicion al guardar planilla cerrada,
  - el selector de partido resalta partidos cerrados (`finalizado` y `no_presentaron_ambos`) para reducir errores operativos.

---

## 2026-03-07 - Disciplina operativa en planilla y partidos
- Correccion de logica disciplinaria en planilla:
  - la `doble amarilla` ya no se degrada a `roja directa` al guardar o reabrir una planilla,
  - se preserva como `Expulsion por doble amarilla` para mantener suspension de `1` partido.
- Refuerzo backend en `backend/models/Partido.js`:
  - nuevo calculo disciplinario defensivo para distinguir:
    - amarillas acumulables,
    - suspensiones por doble amarilla,
    - suspensiones por roja directa.
  - `obtenerPlanilla()` ahora expone tambien si la cédula del jugador es obligatoria para ese campeonato.
- Mejora operativa en `frontend/planilla.html` + `frontend/js/planilla.js`:
  - modal de `Inscribir jugador` dentro de la planilla,
  - alta por equipo sin salir del partido,
  - preservacion de goles/tarjetas/pagos/observaciones al refrescar el plantel,
  - reglas dinamicas de cédula/foto de cédula/foto carnet segun configuracion del campeonato.
- Ajuste adicional en planillaje:
  - faltas por tiempo (`1ER` / `2DO`) capturadas por clic y persistidas en `partidos` para fair play,
  - encabezado reorganizado con logos de equipos junto al marcador y auspiciantes en el bloque derecho,
  - no presentacion parcial aplicada por lado: se bloquea solo el equipo ausente y el equipo presente conserva pagos/captura operativa.
- Nuevo reporte disciplinario operativo en `frontend/partidos.html` + `frontend/js/partidos.js`:
  - pestaña `Reporte Sanciones`,
  - consolidado por categoria enfocado solo en novedades:
    - jugadores suspendidos,
    - jugadores con amarillas acumuladas,
    - resumen de equipos con casos activos,
  - salida por impresion y exportacion PDF.
- Nuevo bloque financiero ejecutivo en `frontend/finanzas.html` + `frontend/js/finanzas.js`:
  - `Resumen Ejecutivo por Equipo`,
  - consolidado por equipo con columnas de:
    - campeonato,
    - categoria,
    - cargos,
    - abonos,
    - saldo actual,
    - cargos abiertos,
    - cargos vencidos,
    - saldo inscripcion,
    - saldo arbitraje,
    - saldo multas,
  - impresion dedicada con membrete y pie de auspiciantes.
- Alertas operativas en `frontend/equipos.html` + `frontend/js/equipos.js`:
  - nuevo bloque `Alertas Operativas` sobre el listado de equipos,
  - consolidado rapido de:
    - equipos con deuda,
    - saldo pendiente total,
    - equipos con suspendidos,
    - equipos en seguimiento por amarillas,
  - cada tarjeta y la vista tabla muestran chips operativos por equipo:
    - `Deuda`,
    - `Suspendidos`,
    - `Seguimiento`,
    - `Sin alertas`.
- Alertas operativas en `frontend/partidos.html` + `frontend/js/partidos.js`:
  - nuevo bloque `Alertas Operativas de los Partidos Mostrados`,
  - resumen rapido de:
    - equipos con deuda,
    - saldo pendiente total,
    - equipos con suspendidos,
    - equipos en seguimiento por amarillas,
  - cada partido muestra detalle operativo de local y visitante,
  - la vista tabla suma columna `Alertas`.

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
  - ambos ausentes -> marcador vacio (`NULL/NULL`) y el partido no suma puntos/goles.
- Sincronización financiera desde planilla:
  - walkover individual -> multa de arbitraje solo al equipo ausente,
  - ambos ausentes -> multa de arbitraje a ambos equipos,
  - no se genera captura deportiva del equipo ausente; en inasistencia parcial el equipo presente mantiene pagos/captura habilitados.
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

---

## 16. Clasificacion por grupo y eliminacion automatica por no presentaciones
- **Ubicación:** `frontend/eventos.html`, `frontend/js/eventos.js`, `backend/controllers/eventoController.js`, `backend/controllers/tablaController.js`, `frontend/js/tablas.js`, `frontend/css/style.css`, `backend/models/Partido.js`, `database/migrations/026_ambos_no_presentes_sin_resultado.sql`, `database/migrations/027_clasificacion_y_no_presentacion_automatica.sql`
- Categorias/eventos:
  - nuevo campo `clasificados_por_grupo` para definir cuantos equipos siguen en carrera por grupo,
  - visible y editable desde `eventos.html`.
- Tablas:
  - resumen de posiciones ahora muestra `clasifican por grupo`,
  - equipos fuera del cupo se pintan en rojo,
  - equipos eliminados automaticamente por inasistencias tambien quedan marcados en rojo y con etiqueta visual.
- No presentaciones:
  - se agregan `no_presentaciones` y `eliminado_automatico` en `evento_equipos`,
  - el backend recalcula el acumulado al guardar planillas,
  - al llegar a `3` no presentaciones el equipo queda eliminado automaticamente en esa categoria.
- Doble ausencia:
  - `ambos no se presentan` ya no guarda `0-0`,
  - el marcador queda vacio (`NULL/NULL`) y el partido no suma como jugado,
  - se mantiene la multa por no presentacion/arbitraje para ambos equipos.

---

## 17. E2E operativo con datos reales (solo lectura)
- **Ubicación:** `backend/scripts/e2eOperationalFlowCheck.js`, `backend/package.json`
- Nuevo comando:
  - `npm run e2e:ops-flow`
- Objetivo:
  - validar flujo real sin escrituras ni creación de registros,
  - detectar cortes en endpoints operativos antes de pruebas de campo.
- Cobertura:
  - `auth/login`,
  - campeonatos/categorias/equipos/grupos/partidos/planilla,
  - tablas de posiciones/goleadores/tarjetas/fair play,
  - finanzas (`movimientos`, `estado-cuenta`, `morosidad`),
  - portal publico (campeonato, eventos, partidos, tablas).

---

## 18. Portal publico compartible por campeonato
- **Ubicacion backend:** `backend/services/publicPortalService.js`, `backend/controllers/publicPortalController.js`, `backend/routes/publicRoutes.js`, `backend/controllers/authController.js`
- **Ubicacion frontend:** `frontend/portal.html`, `frontend/js/portal.js`, `frontend/js/api.js`, `frontend/css/portal.css`
- Se agrego resumen por categoria a los payloads publicos del campeonato:
  - `categorias_resumen` con nombre de categoria y cantidad de equipos.
- Las cards del portal ahora muestran chips de categoria + equipos.
- El detalle del campeonato ya puede compartirse directamente con:
  - `portal.html?campeonato=<id>`
- La pagina compartible incluye:
  - header completo,
  - tabs por categoria,
  - subtabs deportivas,
  - auspiciantes del campeonato,
  - footer institucional completo.
- Nuevo endpoint publico:
  - `GET /api/public/campeonatos/:campeonato_id/auspiciantes`
- La landing publica del organizador tambien quedo alineada con ese mismo resumen de categorias para no divergir del portal general.

---

## 19. Tabla acumulada, zoom de foto carné y planilla del jugador
- **Ubicacion backend:** `backend/controllers/eventoController.js`, `backend/controllers/eliminatoriaController.js`, `backend/controllers/jugadorController.js`, `backend/models/Jugador.js`, `backend/services/publicPortalService.js`
- **Ubicacion frontend:** `frontend/eventos.html`, `frontend/jugadores.html`, `frontend/planilla.html`, `frontend/js/eventos.js`, `frontend/js/tablas.js`, `frontend/js/eliminatorias.js`, `frontend/js/jugadores.js`, `frontend/js/equipos.js`, `frontend/css/style.css`, `frontend/css/portal.css`
- **Migraciones:** `database/migrations/037_eventos_clasificacion_tabla_acumulada.sql`, `database/migrations/038_jugadores_foto_carnet_zoom.sql`
- Competencia:
  - nuevo metodo visible `tabla acumulada`,
  - pensado para clasificar desde grupos hacia una tabla global de rendimiento,
  - fuerza origen `grupos` + metodo `tabla_unica` en configuracion de playoff,
  - sin modificar `backend/models/Eliminatoria.js`.
- Jugadores:
  - nuevo control de zoom para la foto del carné,
  - direccional de ajuste fino para mover la foto,
  - persistencia de `foto_carnet_zoom`,
  - nueva `Planilla del jugador` con vista, impresion y PDF.
- UI:
  - tarjetas de equipo con nombre a la izquierda y logo a la derecha,
  - tarjetas de jugador reordenadas,
  - marca `ELIMINADO` reducida visualmente en tablas internas y portal.
- Posiciones:
  - se agrego `Polifuncional` en formularios de jugadores y planilla manual.

---

## 20. Recalculo automatico de tabla manual
- **Ubicacion backend:** `backend/controllers/tablaController.js`
- **Ubicacion frontend:** `frontend/js/tablas.js`
- La edicion manual de tablas ahora recalcula automaticamente:
  - `PJ = PG + PE + PP`
  - `DG = GF - GC`
  - `PTS` segun el sistema de puntuacion del campeonato/evento
- El backend ya no confia en `PTS` enviado por el navegador:
  - vuelve a derivarlo al guardar,
  - reordena con ese valor recalculado,
  - y mantiene el mismo resultado en local y Render.
- En la UI, `PJ` y `PTS` quedan como campos derivados para reducir errores del administrador al corregir la tabla.

---

## 21. Restauracion de tablas publicas y playoff tras el ajuste de puntos
- **Ubicacion backend:** `backend/controllers/tablaController.js`
- Se corrigio una regresion introducida al recalcular `PTS` en tablas manuales:
  - el backend publico estaba fallando con `ReferenceError: sistema is not defined`
  - esto afectaba:
    - `portal.html`
    - tablas publicas por evento
    - calculo de clasificados para eliminatorias
    - resumen de clasificacion manual.
- Se normalizo nuevamente el acceso a `evento.sistema_puntuacion` dentro del generador interno de tablas.
- Resultado:
  - las tablas publicas vuelven a cargar correctamente en local y Render,
  - el playoff publico vuelve a recibir la clasificacion correcta desde el backend.

---

## 22. Portal playoff programado y plantilla publicable unificada
- **Ubicacion backend:** `backend/models/Eliminatoria.js`
- **Ubicacion frontend:** `frontend/eliminatorias.html`, `frontend/js/eliminatorias.js`, `frontend/js/portal.js`, `frontend/css/style.css`, `frontend/css/portal.css`
- Portal publico:
  - el payload de eliminatorias ahora incluye datos del partido operativo enlazado:
    - `estado`
    - `fecha_partido`
    - `hora_partido`
    - `cancha`
    - `jornada`
    - `numero_campeonato`
  - la pestaña `Playoff` del portal ya muestra esa metadata en cada cruce cuando existe programación real.
- Módulo interno de eliminatorias:
  - reorganizado en pestañas:
    - `Configuración de llave`
    - `Estado competitivo`
    - `Clasificación manual`
    - `Playoff / Llave`
  - las secciones dejan de apilarse permanentemente y se muestran/ocultan por pestaña.
- Programación de playoff:
  - los formularios de `Programar` y `Auto-programar` ahora abren en modal real con overlay, cierre por `Esc` y click fuera.
- Playoff / Llave:
  - `Final` queda centrada,
  - `Tercer y cuarto` se renderiza debajo de `Final`,
  - las tarjetas del tercer puesto son más compactas,
  - el bracket interno se presenta horizontalmente.
- Plantilla para publicar:
  - nuevo botón `Plantilla para publicar` junto a `Auto-programar fechas`,
  - la vista previa y la publicación final se alinean visualmente,
  - para el caso principal `8vos -> 4tos -> semifinal -> final` se usa un layout especial de 7 columnas:
    - octavos a ambos lados,
    - cuartos intermedios,
    - semifinales frente al centro,
    - final al centro,
    - tercer puesto debajo del centro.
  - los nodos ya incluyen:
    - logo de equipo,
    - equipo local arriba,
    - `vs`,
    - equipo visitante abajo.

---

## 23. Fondo personalizado en plantillas de fixture y grupos
- **Ubicacion frontend:** `frontend/fixtureplantilla.html`, `frontend/gruposgen.html`, `frontend/js/fixtureplantilla.js`, `frontend/js/gruposgen.js`, `frontend/css/grupos.css`
- Fixture:
  - nuevo control `Fondo` para cargar imagen local,
  - botón `Quitar fondo`,
  - persistencia por `campeonato + evento`,
  - exportación `PNG/PDF` respetando el fondo personalizado.
- Grupos:
  - mismo flujo de carga/limpieza de fondo,
  - persistencia por `campeonato + evento`,
  - exportación `PNG/PDF` y compartir usando el fondo cargado.
- Implementación visual:
  - posters ahora soportan clase `has-custom-background`,
  - la imagen de fondo se aplica por CSS variable,
  - cada tema (`oscuro`, `clásico`, `torneo`) conserva un overlay diferente para no perder legibilidad.
- Se corrigió además el markup del selector de tema/fondo en `gruposgen.html` para evitar comillas tipográficas que podían romper atributos HTML.

---

## 24. Landing del organizador: bienvenida a equipos participantes
- **Ubicacion backend:** `backend/models/OrganizadorPortal.js`, `backend/controllers/organizadorPortalController.js`, `backend/controllers/authController.js`, `backend/routes/organizadorPortalRoutes.js`
- **Ubicacion frontend:** `frontend/index.html`, `frontend/organizador-portal.html`, `frontend/js/portal.js`, `frontend/js/organizador-portal.js`, `frontend/css/portal.css`
- Se agregó configuración pública para mostrar una bienvenida a equipos participantes en la landing del organizador:
  - `equipos_bienvenida_titulo`
  - `equipos_bienvenida_descripcion`
  - `equipos_bienvenida_imagen_url`
- El organizador puede subir una imagen específica de bienvenida para equipos desde su panel.
- El landing ahora incluye el listado de equipos participantes por campeonato visible:
  - deduplicado por nombre,
  - con logo cuando exista,
  - agrupado por campeonato.

---

## 25. Categorías juveniles y carnés enriquecidos
- **Ubicacion backend:** `backend/controllers/eventoController.js`
- **Ubicacion frontend:** `frontend/eventos.html`, `frontend/js/eventos.js`, `frontend/js/jugadores.js`
- Se incorporó el flag `categoria_juvenil` en los eventos/categorías.
- Cuando está activo:
  - el carné muestra fecha de nacimiento,
  - el carné muestra edad calculada automáticamente.
- Esto permite diferenciar categorías juveniles sin alterar el formato del resto de carnés.

---

## 26. Plan funcional para transmisiones de partidos
- **Documento:** `docs/PLAN_TRANSMISION_PARTIDOS.md`
- Se documentó la propuesta para un servicio de transmisión de partidos operado por el organizador:
  - configuración desde SGD,
  - publicación en portal público,
  - retransmisión a redes sociales mediante proveedor externo,
  - propuesta de tabla `partido_transmisiones`,
  - endpoints sugeridos y fases de implementación.

---

## 27. Fix de refresh en la landing pública
- **Ubicacion frontend:** `frontend/js/portal.js`
- Se corrigió la rehidratación indeseada del último torneo abierto en `index.html`.
- Ahora la portada principal:
  - no reutiliza `campeonato/evento` guardados en sesión para abrir el detalle por sí sola,
  - solo muestra detalle si esos valores llegan explícitamente por URL.
- `portal.html` conserva el contexto compartible del torneo sin contaminar la landing general.

---

## 28. Sincronización de fechas heredadas y fixture con programación parcial
- **Ubicación backend:** `backend/controllers/campeonatoController.js`, `backend/controllers/partidoController.js`, `backend/models/Partido.js`, `backend/services/mobileCompetitionService.js`
- **Ubicación frontend:** `frontend/partidos.html`, `frontend/js/partidos.js`
- Se corrigió la edición de campeonatos para que las categorías/eventos que heredaban `fecha_inicio` y `fecha_fin` se actualicen automáticamente al modificar el campeonato.
- La sincronización es conservadora y no pisa fechas ya personalizadas manualmente en una categoría.
- En la generación de fixture ahora existe selección explícita de modo:
  - `Programación automática`
  - `Programación manual`
- Si no se elige una opción, se muestra un modal y el fixture no se genera.
- En modo automático:
  - se programan los partidos que caben dentro de la ventana del evento,
  - los partidos restantes se crean sin `fecha/hora/cancha`,
  - se devuelve un resumen con `programados`, `sin_programar` y `capacidad_insuficiente`.
- Esta misma lógica aplica también a `Regenerar (preservar jugados)`.






