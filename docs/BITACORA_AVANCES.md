## 2026-03-31 - Portal público: fix de playoff y tabla pública con planillas

- `frontend/js/portal.js`: se corrigió la referencia rota `formatearRondaPortal(...)` por `formatearRondaPlayoffPortal(...)`, que estaba rompiendo el detalle de torneos con playoff en el portal público.
- `backend/controllers/tablaController.js`: las tablas públicas ya consideran como partidos publicados los `finalizado / no_presentaron_ambos` y también los partidos con `partido_planillas` guardada.
- Esto corrige el caso donde la pestaña `Resultados` sí mostraba partidos y la `Tabla de posiciones` seguía vacía o en cero por depender solo de `estado='finalizado'`.
# Bitácora de Avances - LT&C

Ultima actualizacion: 2026-03-31 (sesión 20)

## 2026-03-31 - Portal público: jornadas y resultados con planilla publicada

- `backend/models/Partido.js`: se corrigió un bug en `obtenerPorEvento`, `obtenerPorEventoYJornada`, `obtenerPorCampeonato` y `obtenerPorCampeonatoYJornada` donde se seleccionaban campos de `partidos_eliminatoria` sin el `LEFT JOIN` correspondiente. Eso provocaba que algunos campeonatos aparecieran sin jornadas ni resultados en el portal.
- En esas mismas lecturas se añadió `tiene_planilla_publicada` para que el frontend pueda distinguir partidos con planilla guardada aunque no tengan `estado = 'finalizado'`.
- `backend/services/publicPortalService.js`: el resumen público de eventos ya cuenta como partidos publicados tanto los `finalizado / no_presentaron_ambos` como los partidos con `partido_planillas` guardada.
- `frontend/js/portal.js`: la subtab `Resultados` y los badges de jornada ya consideran `tiene_planilla_publicada`, evitando ocultar jornadas parciales con información deportiva ya cargada.
- Validación local: el evento `SENIOR` del campeonato `CAMPEONATO BARRIAL DE FUTBOL` volvió a exponer `55` partidos en el servicio público y el resumen pasó de `0/55` a `2/55` partidos publicados, consistente con las dos planillas guardadas.
# Bitácora de Avances - LT&C

Ultima actualizacion: 2026-03-30 (sesión 19)

## 2026-03-30 - Sembrado manual asistido de playoff

- `frontend/eliminatorias.html` y `frontend/eventos.html` agregan la plantilla `Manual asistida (definir P1..Pn)`.
- `frontend/js/eliminatorias.js` parte de una sugerencia balanceada y permite redefinir manualmente el orden `P1..Pn` con clasificados vigentes antes de generar la llave.
- `backend/models/Eliminatoria.js` valida el sembrado manual, evita repetir equipos y genera la llave exactamente con el orden elegido por el organizador.
- `backend/controllers/eventoController.js` ya normaliza `manual_asistida` como valor válido de `playoff_plantilla`.
- Pendiente inmediato: validar en operación real que la vista previa, la llave generada y la plantilla exportable respeten el mismo orden manual.

### Fix de sembrado balanceado por slot_posicion

- Se corrigió `backend/models/Eliminatoria.js` para que el armado balanceado de playoff use el `slot_posicion` real de cada clasificado y no la posición accidental del arreglo.
- Además se ordenan los clasificados de cada grupo antes de construir el sembrado.
- Esto corrige el caso donde la vista previa sugerida mostraba un orden balanceado correcto, pero la llave real se generaba corrida en `P1..P8`.

## Avances recientes (2026-03-30 — sesión 18)
### Cierre de migración 057 en local y Render

- Se aplicó y verificó formalmente `database/migrations/057_fix_fk_on_delete_set_null.sql` tanto en BD local como en PostgreSQL de Render.
- Verificación posterior:
  - `goleadores_jugador_id_fkey` -> `ON DELETE SET NULL`
  - `tarjetas_jugador_id_fkey` -> `ON DELETE SET NULL`
- Con esto queda alineado el fix estructural para eliminación de jugadores, complementando el `UPDATE ... SET jugador_id = NULL` defensivo ya incorporado en `backend/models/Jugador.js`.

## Avances recientes (2026-03-29 — sesión 17)

### Playoff — penales en planilla y publicación pública

- `frontend/planilla.html`, `frontend/js/planilla.js` y `frontend/css/style.css`: la planilla de partidos de `playoff` ya soporta captura de `penales` cuando el marcador regular termina empatado.
- `backend/models/Partido.js`: al guardar una planilla de playoff finalizada con empate, el backend ya exige penales válidos, resuelve el ganador y propaga al clasificado en la llave.
- `backend/models/Eliminatoria.js`: la sincronización de cruces/reclasificaciones ya considera `resultado_local_shootouts`, `resultado_visitante_shootouts` y `shootouts`.
- `frontend/js/portal.js` + `frontend/css/portal.css`: el portal público ya muestra debajo del resultado el resumen `Penales: X - Y • Clasifica ... por penales` cuando corresponde.

### Pendiente prioritario para la siguiente sesión

- Recomponer y validar la llave de playoff en los campeonatos afectados de producción, asegurando que los cruces recuperados queden visibles y consistentes tanto en el módulo interno como en el portal público.

## Avances recientes (2026-03-27 — sesión 16)

### Fix: admin redirige a admin.html como página inicial

- `core.js` — `getDefaultPageByRole()`: administrador ahora retorna `admin.html`, organizador retorna `portal-admin.html`.
- `core.js` — `canAccessPage()`: se bloquea explícitamente al rol `administrador` en `portal-admin.html`; si intenta acceder directamente por URL, es redirigido a `admin.html`.
- Criterio de negocio: el administrador no organiza torneos — administra la plataforma. Para organizar debe crear cuenta de organizador (trazabilidad y auditoría).

### Fix: error al eliminar jugador (violación FK en goleadores/tarjetas)

- **Causa**: el FK `goleadores_jugador_id_fkey` en Render fue creado sin `ON DELETE SET NULL` (table pre-existente antes de la migración 005). Lo mismo aplica a `tarjetas_jugador_id_fkey`.
- **Fix inmediato** — `backend/models/Jugador.js` → `static async eliminar()`: antes del `DELETE`, se nullifican las referencias en `goleadores` y `tarjetas` con `UPDATE ... SET jugador_id = NULL WHERE jugador_id = $1`. Funciona independientemente del comportamiento del FK en la BD.
- **Fix estructural** — Migración `057_fix_fk_on_delete_set_null.sql`: recrea ambos FK con `ON DELETE SET NULL`. Aplicada y verificada en BD local y Render.

### Fix: error al crear jugador ocultaba el mensaje real de PostgreSQL

- `backend/controllers/jugadorController.js`: el catch del endpoint de creación retornaba `error: 'Error creando jugador'` que no coincidía con el regex `/interno/i` de `api.js`, por lo que `detalle` (el error real de PG) nunca llegaba al usuario.
- Corregido a `error: 'Error interno del servidor'` para que `extractErrorMessage` en `api.js` exponga el `detalle` real al frontend.
- Permite diagnosticar la causa raíz si el error de creación persiste tras el redespliegue.

## Avances recientes (2026-03-27 — sesión 15)

### Finanzas — permisos correctos para gastos operativos del organizador

- Se corrigió el módulo de `gastos_operativos` para que un organizador ya no pueda listar gastos fuera de sus campeonatos cuando no envía `campeonato_id`.
- `backend/models/Finanza.js` ahora acepta `campeonato_ids` en `listarGastos(...)` y agrega `obtenerGastoPorId(...)` para recuperar un gasto puntual sin cargar toda la tabla.
- `backend/controllers/finanzaController.js` ahora:
  - usa `obtenerCampeonatoIdsOrganizador(user)` con el objeto `user` correcto,
  - restringe el listado a `campeonato_ids` permitidos cuando no se filtra un campeonato puntual,
  - valida edición y eliminación con `obtenerGastoPorId(...)` en lugar de listar todos los gastos.
- Resultado: el organizador solo puede crear, listar, editar, eliminar y resumir gastos de campeonatos propios, sin fugas de datos ni consultas innecesariamente amplias.

## Avances recientes (2026-03-27 — sesión 14)

### Alineación de migraciones entre local y Render

- Se revisó el estado documental vs. el estado real de las bases local y Render.
- Verificación realizada sobre migraciones recientes:
  - `051_roles_operador_sistema.sql`
  - `052_configuracion_sistema.sql`
  - `053_formas_pago.sql`
  - `054_formas_pago_paypal_tarjeta.sql`
  - `055_plan_estado_pendiente_pago.sql`
  - `056_gastos_operativos.sql`
- Resultado:
  - `051`, `052`, `053` y `054` ya estaban aplicadas en local y Render.
  - `055` faltaba en local y quedó aplicada.
  - `056` faltaba en local y Render y quedó aplicada en ambos entornos.
- Verificación posterior:
  - `usuarios_plan_estado_check` ya acepta `pendiente_pago` en local y Render.
  - la tabla `gastos_operativos` ya existe en local y Render.
- Se identificó además un desajuste documental previo:
  - `050_eventos_juvenil_cupos_y_carnet_edad.sql` ya estaba aplicada también en Render y no solo en local.

## Avances recientes (2026-03-26 — sesión 13)

### Formas de pago — modal en landing y configuración desde admin

- Al hacer clic en una card de plan de pago en `index.html`, ya no navega directo a `register.html`; abre un modal que muestra las formas de pago disponibles antes de continuar el registro.
- Nuevas migraciones `053_formas_pago.sql` y `054_formas_pago_paypal_tarjeta.sql` agregaron 16 claves en `configuracion_sistema` para WhatsApp, transferencia, efectivo, PayPal y tarjeta de crédito/débito.
- `backend/services/planLimits.js`: funciones `obtenerFormasPago()` y `actualizarFormasPago()` con validación de claves permitidas.
- `backend/controllers/authController.js`: endpoints `GET /auth/formas-pago` (público), `GET/PUT /auth/admin/formas-pago` (admin).
- `backend/routes/authRoutes.js`: rutas para las tres formas de pago.
- `frontend/admin.html` + `frontend/js/dashboard-admin.js`: panel "Formas de pago" con formulario completo de configuración de métodos.
- `frontend/index.html`: modal intercepción con `renderMetodosPago()`, botones de WhatsApp, PayPal, tarjeta y transferencia bancaria.

### Notificaciones por email — infraestructura completa

- `backend/services/emailService.js` ampliado con:
  - `wrapHtml()` — plantilla HTML con CSS embebido reutilizable.
  - `enviarEmail()` — helper genérico SMTP con fallback graceful a consola si no está configurado.
  - `enviarEmailBienvenida()` — bienvenida al nuevo usuario con datos de cuenta y enlace de login.
  - `enviarEmailNotificacionAdminNuevoRegistro()` — alerta al admin con ⚠️ si el plan es de pago.
  - `enviarEmailNotificacionContacto()` — notifica al admin cuando se recibe un mensaje del formulario de contacto.
- `backend/controllers/authController.js`: en `registerPublic()` dispara bienvenida + alerta admin en `Promise.allSettled()` background.
- `backend/controllers/contactoController.js`: dispara `enviarEmailNotificacionContacto()` en background tras guardar el mensaje en BD.
- Configuración requerida en producción: `ADMIN_EMAIL`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (sin estas vars solo logea en consola).

### Responsive web — módulos campeonatos, equipos, eventos, jugadores y usuarios

- Añadida clase `page-campeonatos` a `campeonatos.html`, `page-equipos` a `equipos.html`, `page-eventos` a `eventos.html`, `page-usuarios` a `usuarios.html`.
- Corrección de overflow en grid de `#lista-campeonatos` y `#lista-eventos`: cambiado `minmax(300px, 1fr)` → `minmax(min(300px, 100%), 1fr)` para evitar desborde en pantallas < 313px.
- `.usuarios-table-wrap` ya tiene `overflow-x: auto` explícito para garantizar scroll horizontal en cualquier viewport.
- Nuevos bloques `@media (max-width: 768px)` y `@media (max-width: 520px)` en `style.css`:
  - tarjetas de campeonato/equipo/jugador: padding compacto, `h3` reducido en móvil.
  - botones de `campeonato-actions`, `equipo-actions`, `jugador-actions`: pasan a `flex: 1 1 100%` en ≤ 520px.
  - `select-estado` en campeonato: ancho 100% en móvil.
  - `#lista-equipos` y `#jugadores-lista`: forzados a 1 columna en ≤ 520px.
  - `form-grid` de selección en eventos/equipos/usuarios: 1 columna en ≤ 768px.

### Spinner de carga durante verificación de sesión (UX)
- Reemplaza el `visibility: hidden` en body (pantalla en blanco) por un overlay con spinner animado y texto "Verificando sesión…" mientras se valida la sesión.
- El overlay usa `visibility: visible` para escapar del heredado `visibility: hidden` del body.
- Se elimina al completar la verificación y el sidebar + topbar están listos.
- Archivos modificados: `frontend/js/core.js`.

### Portal de organizador — alta de técnicos
- Organizador ahora puede crear usuarios con rol `técnico` además de `dirigente` desde `usuarios.html`.
- Backend `authController.crearUsuario`: acepta `rol='tecnico'` del organizador (antes forzaba `dirigente`).
- Backend `authController.eliminarUsuario`: permite eliminar tanto `dirigente` como `tecnico` para organizadores.
- Backend `listarUsuariosVisiblesPorOrganizador`: ahora incluye `tecnico` además de `dirigente`.
- Frontend `usuarios.js`: selector de rol con dos opciones, título y botón dinámicos según rol seleccionado.
- Archivos modificados: `backend/controllers/authController.js`, `frontend/js/usuarios.js`.

### Documentación de despliegue actualizada
- `docs/DEPLOY_RENDER.md`: añadidas variables `ADMIN_EMAIL` y `FRONTEND_URL` con nota explicativa.
- `backend/.env.example`: añadidas mismas variables con comentarios descriptivos.
- README §11 actualizado: dashboard de estadísticas marcado como IMPLEMENTADO.

---

## Avances recientes (2026-03-25 — sesión 12)

### Rol Operador Sistema (nuevo)
- Se divide el rol `operador` en dos perfiles distintos con responsabilidades separadas:
  - `operador` → **Operador CMS**: gestiona contenido del sitio web (noticias, galería, contenido del portal). Redirige a `portal-cms.html`.
  - `operador_sistema` → **Operador Sistema**: registra planillas de partido y consulta todos los módulos deportivos en solo lectura. Redirige a `portal-operador.html`.
- Migración `051_roles_operador_sistema.sql` aplicada en BD local y remota (Render actualiza en arranque via `asegurarEsquema`).
- Archivos modificados:
  - `backend/models/UsuarioAuth.js`: ROLES set, constraint en initTable, mensajes de error.
  - `backend/services/sessionService.js`: permisos separados por tipo de operador.
  - `backend/routes/partidoRoutes.js`: `operador_sistema` habilitado en `GET` y `PUT /planilla`; `operador` CMS eliminado de esas rutas.
  - `frontend/js/core.js`: `OPERADOR_SISTEMA_ALLOWED_PAGES`, función `esOperadorSistema()`, redirección y bloque de sidebar diferenciados por tipo.
  - `frontend/js/planilla.js`: `operador_sistema` puede inscribir jugadores de último momento en la planilla.
  - `frontend/usuarios.html` + `frontend/js/usuarios.js`: dos opciones en el selector de rol con etiquetas descriptivas.
  - `frontend/portal-operador.html` (nuevo): panel de bienvenida para `operador_sistema` con lista de partidos pendientes de planilla y accesos rápidos a módulos en solo lectura.
- Commit: `eadf562` — `feat(roles): agregar operador_sistema y separar roles de operador`

### Pendiente identificado — Dashboard de Estadísticas (próxima sesión)
- Se detecta la ausencia de un dashboard estadístico/financiero para organizadores y administrador.
- Ver sección §11 del README para el detalle completo del plan de implementación.

## Avances recientes (2026-03-25)
- Categorías / juvenil:
  - se agrega la migración `database/migrations/050_eventos_juvenil_cupos_y_carnet_edad.sql`.
  - `eventos` ahora soporta:
    - `categoria_juvenil_cupos`,
    - `categoria_juvenil_max_diferencia`,
    - `carnet_mostrar_edad`.
  - la configuración juvenil ya queda limitada a categorías `Sub/U 30` hasta `Sub/U 60`.
  - si una categoría activa juveniles, ahora debe definir:
    - cuántos cupos juveniles permite por equipo,
    - si tolera `1` o `2` años menor.
- Jugadores:
  - `backend/models/Jugador.js` ahora valida elegibilidad etaria por `evento_id` al crear y editar.
  - en categorías etarias:
    - se exige fecha de nacimiento,
    - se habilita o rechaza al jugador según la edad base,
    - y si aplica juvenil, se controlan también los cupos consumidos por equipo.
  - `frontend/js/jugadores.js` ya muestra la edad en tarjetas y tabla.
  - los jugadores juveniles se marcan con chip `Juvenil`.
  - el resumen del equipo muestra `Juveniles: X / cupos`.
- Carnés:
  - el carné ahora puede imprimir `Fecha nac.` y `Edad` cuando la categoría activa `Mostrar edad en carné`.
  - si el jugador entra como juvenil, el carné imprime además `Condición: Juvenil`.
- Planilla:
  - la posición `Arquero` ahora se resalta con color en:
    - plantel lateral,
    - tabla de captura,
    - vista previa oficial.
- Migración local:
  - `050_eventos_juvenil_cupos_y_carnet_edad.sql` aplicada y verificada en la BD local.

- Jugadores / cédula:
  - la cédula ya se normaliza y guarda como texto numérico conservando ceros iniciales.
  - creación y edición de jugadores ahora validan `10 dígitos` exactos cuando la cédula está informada.
  - el mismo criterio ya se aplica en búsqueda local, importación y flujo mobile.
- Planilla de juego:
  - `planilla.html` ahora permite editar el `Número de partido` y guardarlo desde la propia planilla.
  - la cabecera, vista previa y PDF reutilizan ese mismo número visible.
  - el guardado de planilla ya intercepta errores de duplicidad del número visible con mensaje funcional.
- Auspiciantes:
  - la planilla ahora intenta cargar primero auspiciantes activos y, si no existen, hace fallback al listado completo del campeonato.
  - la vista previa mantiene auspiciantes en cabecera y el PDF ahora también los imprime en el encabezado.

## Avances recientes (2026-03-23)
- Partidos / fixture:
  - el organizador ya puede definir el `N° visible del partido` sin tocar el identificador interno de BD.
  - el número visible se puede editar desde `Editar partido` y también se puede definir al crear un `Partido manual`.
  - el backend ahora valida este número y responde un mensaje claro si el valor se repite dentro del mismo campeonato.
  - la visualización pública/interna deja de depender del `id` interno como fallback cuando el partido no tiene número visible asignado.
- Planilla de juego / playoff:
  - `planilla.html` ya soporta dos fases:
    - `Fase regular`
    - `Playoff`
  - en modo `Playoff`:
    - se ocultan `Grupo` y `Jornada`,
    - aparece selector por `Ronda`,
    - se cargan partidos reales de `reclasificación`, `32vos`, `16vos`, `12vos`, `8vos`, `4tos`, `semifinal`, `final` y `tercer y cuarto`.
  - la cabecera, vista previa y PDF ya muestran `Llave` / `Ronda` cuando el partido pertenece a playoff.
  - cada card de `eliminatorias.html` con partido enlazado ya permite abrir su `Planilla` directa.
- Plantillas / posters:
  - `jornadasplantilla.html` ya soporta modo `playoff` además de la fase regular, con navegación por ronda.
  - `gruposgen.html` corrige la exportación duplicada:
    - se elimina el doble disparo de `html2canvas`,
    - los botones quedan bloqueados mientras la exportación está en curso,
    - ya no se generan dos archivos ni dos toasts de éxito por un solo click.

## Avances recientes (2026-03-22)
- Playoff / publicación:
  - la plantilla publicable del playoff ahora muestra también la programación del cruce (`fecha`, `hora`, `cancha`) cuando el partido ya fue agendado, reutilizando el mismo fondo del bracket.
  - se compacta el layout especial `8vos -> 4tos -> semis -> final`:
    - tarjetas más angostas,
    - conectores más cortos,
    - nombres con quiebre controlado,
    - fondo personalizado más contenido en la exportación.
- Jugadores / reportes:
  - se agrega el nuevo tipo `Nómina simple de jugadores`.
  - esta variante solo muestra:
    - nombres y apellidos,
    - cédula,
    - fecha de nacimiento.
  - `jugadores.html` incorpora botón `Exportar Excel` para:
    - nómina oficial,
    - nómina simple,
    - reporte de sanciones,
    - consolidado disciplinario por categoría,
    - ficha individual del jugador.
- Planillaje:
  - la planilla oficial ya separa observaciones por actor:
    - `observacion local`,
    - `observacion visitante`,
    - `observacion arbitro`.
  - se agrega migracion `database/migrations/048_planilla_observaciones_por_lado.sql` para persistir:
    - `partido_planillas.observaciones_local`,
    - `partido_planillas.observaciones_visitante`.
  - en impresion/PDF:
    - `Delegado` ya no se repite en la cabecera,
    - cuando el formato es `liga` se imprime `Liga` en lugar de `Grupo: Sin grupo`,
    - las observaciones pasan a una segunda hoja y ahora ocupan todo el ancho, una debajo de otra.
  - la planilla ya toma `max_jugador` como cantidad real de filas por equipo; en `futbol 11` soporta correctamente `25` jugadores cuando así fue configurado por el organizador.

## Avances recientes (2026-03-21)
- Planillaje:
  - se extiende la planilla para `futbol 11` con terna arbitral:
    - `arbitro central`,
    - `arbitro linea 1`,
    - `arbitro linea 2`.
  - se agrega `observaciones del arbitro` como campo separado de las observaciones generales del partido.
  - el guardado / recarga de planilla ya persiste estos campos en BD:
    - `partidos.arbitro_linea_1`,
    - `partidos.arbitro_linea_2`,
    - `partido_planillas.observaciones_arbitro`.
  - la vista previa oficial, el resumen y el PDF ya muestran la terna arbitral y el bloque especifico de observaciones del arbitro.
  - la exportacion XLSX mantiene compatibilidad combinando ambas observaciones en el area de observaciones de la plantilla oficial.

## Avances recientes (2026-03-20)
- Playoff / eliminatorias:
  - se corrige la herencia de `playoff_plantilla` y `playoff_tercer_puesto` desde la categoría hacia `eliminatorias.html`; la categoría pasa a ser la fuente de verdad visual aunque exista una fila previa en `evento_playoff_config`.
  - `backend/controllers/eventoController.js` ahora sincroniza una configuración `evento_playoff_config` existente cuando el organizador edita la categoría desde `eventos.html`.
  - `backend/models/Eliminatoria.js` prioriza los valores actuales del evento al leer la configuración de playoff, evitando que una configuración antigua deje la UI en `Estándar automático` cuando la categoría ya está en `balanceada`.
  - se habilita edición manual básica de cruces pendientes desde la propia llave (`Editar cruce`), reasignando equipos y `seed_ref` de forma segura.
  - la edición manual valida que:
    - el partido siga pendiente y sin resultado,
    - no se repita un equipo dentro de la misma ronda,
    - el local y visitante sean distintos.
- Operación:
  - si el playoff ya estaba generado con una plantilla anterior, ahora puede corregirse desde la llave regenerando con la plantilla heredada correcta o ajustando un cruce puntual manualmente.

## Pendientes (al 2026-03-18)

### Playoff / Eliminatorias
- [ ] Validación operativa del nuevo sembrado interleaved con datos reales de campeonato activo (confirmar que la semif siempre cruza grupos distintos).
- [ ] Verificar que `auto-programar` funciona correctamente cuando hay slots sin partido_id en rounds 2+ (endpoint nuevo `/programar` debe crearlos).
- [ ] Plantilla `balanceada_8vos` con 4 grupos × 2 clasificados: actualmente cae al algoritmo estándar (interleaved). Evaluar si el usuario quiere un sembrado específico distinto para ese caso también.
- [ ] Cierre de formatos no potencia de 2 adicionales (ej: 6, 10, 12 equipos) si el cliente los confirma.

### Portal público
- [ ] Revisar subtab **Playoff** en portal: validación de llave contra clasificación vigente (equipos eliminados, vacantes pendientes).
- [ ] Programación de partidos de playoff visible en portal (fecha/hora/cancha) cuando estén asignados.

### Plantillas de publicación
- [ ] Aplicar selector de tema visual (`tema-oscuro`, `tema-clasico`, `tema-torneo`) a la nueva página `jornadasplantilla.html` (ya implementado, pendiente verificar integración de colores del campeonato).
- [ ] Exportación PNG/PDF de llaves eliminatorias en la sección "Plantilla para Publicar" del bracket.

### Módulo Liga
- [ ] Verificar que la tab **Liga** en `gruposgen.html` carga correctamente los equipos cuando se selecciona una categoría con `metodo_competencia='liga'`.
- [ ] Exportación de plantilla de liga (poster con equipos inscritos) con temas visuales.

### General / Infraestructura
- [ ] Pruebas integrales de flujo real con carga de datos de campeonato completo.
- [ ] Copiar histórico de `backend/uploads/` al disco persistente de Render antes de validar carga completa de imágenes/documentos en producción.
- [ ] Notificaciones (email/push) para partidos y resultados — pendiente de confirmar alcance.
- [ ] Auditoría completa y reportes ejecutivos.

---

## Objetivo
Mantener un registro vivo del progreso del proyecto para retomar trabajo sin perder contexto.

## Estado General
- Backend y frontend funcionales para flujo base de campeonatos, eventos, equipos, grupos, partidos, tablas y portal.
- Se corrigieron desalineaciones clave entre rutas, controladores, modelos y frontend.
- Modulo financiero en estado funcional inicial con cuenta corriente y morosidad.
- Pendiente continuar pruebas integrales de flujo real con carga de datos.

## Avances Recientes

### 2026-03-18 (sesión 7)
- Corrección de 3 bugs en módulo de eliminatorias/playoff:

**Bug 1: `playoff_tercer_puesto` y `playoff_plantilla` no se guardaban para método "grupos" o "liga"**
  - Causa: `frontend/js/eventos.js` líneas 749-754 tenían condición restrictiva que excluía los métodos `'grupos'` y `'liga'` al leer esos campos del formulario, asignando siempre `"estandar"` y `false`.
  - Solución: Eliminada la condición — ahora siempre se lee el valor real del formulario sin importar el `metodo_competencia`.

**Bug 2: El bracket playoff no evitaba que equipos del mismo cruce se enfrentaran en semifinal**
  - Causa: `construirSembradoCrucesGrupos` en `backend/models/Eliminatoria.js` iteraba todos los partidos de [A,C] juntos, luego todos los de [B,D]. Resultado: ambos partidos del cruce A-C quedaban en la misma mitad del bracket → semifinal entre A y C era posible.
  - Solución: El algoritmo ahora **intercala** los partidos de distintos cruces. Con cruces [[A,C],[B,D]] y 2 clasificados por grupo el resultado es:
    - QF1: 1A vs 2C | QF2: 1B vs 2D → Semi 1: ganador(A o C) vs ganador(B o D) ✓
    - QF3: 2A vs 1C | QF4: 2B vs 1D → Semi 2: ganador(A o C) vs ganador(B o D) ✓
    - Las semifinales siempre son entre cruces distintos; equipos del mismo grupo solo se pueden encontrar en la final.

**Bug 3: Botón "Programar" no visible en partidos de ronda 2+ (cuartos, semis, final)**
  - Causa: El botón solo se mostraba si `c.partido_id` era truthy. En las rondas 2+ los slots no tienen `partido_id` aún (el registro en `partidos` se crea solo en ronda 1 cuando se conocen los equipos).
  - Solución completa:
    - Nuevo endpoint `PUT /eliminatorias/:id/programar` en backend que:
      - Si el slot no tiene `partido_id`: crea un registro en `partidos` (con equipos null si aún no están definidos) y vincula `partido_id` al slot en `partidos_eliminatoria`.
      - Si ya tiene `partido_id`: actualiza `fecha_partido`, `hora_partido` y `cancha`.
    - El botón "Programar" ahora aparece en **todos** los cruces (usa `c.id` del slot, no `c.partido_id`).
    - `guardarProgPartidoEli()` y `ejecutarAutoProgEli()` llaman al nuevo endpoint `/eliminatorias/:id/programar`.
    - Auto-programar ahora incluye todos los slots (no solo los que ya tienen partido_id).
  - Archivos modificados:
    - `backend/models/Eliminatoria.js`: nuevo método estático `programarSlot()`
    - `backend/controllers/eliminatoriaController.js`: nuevo handler `programarSlot`
    - `backend/routes/eliminatoriaRoutes.js`: nueva ruta `PUT /:id/programar`
    - `frontend/js/eliminatorias.js`: botón, `guardarProgPartidoEli`, `ejecutarAutoProgEli`
    - `frontend/js/eventos.js`: condición restrictiva eliminada
  - Commit: `fix(eliminatorias): corregir 3 bugs de playoff`

---

### 2026-03-18 (sesión 6)
- Modo Liga en página de grupos (`gruposgen.html` / `gruposgen.js`):
  - Cuando `metodo_competencia = 'liga'`, el tab "Plantilla de Grupos" cambia a **"Plantilla Liga"**.
  - Se oculta el grid de grupos (`poster-grupos`) y se muestra un bloque `poster-liga` con todos los equipos del evento en lista ordenada (con logo y número).
  - `contextoGrupos` ahora almacena `metodoCompetencia`; se detecta desde `gruposEventosCache` al seleccionar la categoría.
  - Nueva función `cargarEquiposLiga(eventoId)` carga equipos via `/evento_equipos/:id`.
  - Nueva función `actualizarModoLiga(metodo)` actualiza visibilidad de elementos y label del tab.
  - CSS: `.poster-liga-equipos-grid` en `grupos.css`.
- Programación de partidos de playoff (`eliminatorias.html` / `eliminatorias.js`):
  - Cada match card del bracket ahora muestra **fecha, hora y cancha** si están asignadas (badge "Programado" en amarillo, badge "Programado" distingue de "Pendiente").
  - Botón **"Programar"** en cada card (solo admin/organizador) → abre modal con campos fecha, hora, cancha. Guarda via `PUT /partidos/:partido_id`.
  - Barra de herramientas sobre el bracket (solo admin) con botón **"Auto-programar fechas"**.
  - Modal **Auto-programar**: fecha inicio, hora inicio, hora límite, duración por partido (min), cancha, opción sobrescribir. Asigna tiempo secuencial a todos los partidos pendientes del bracket; si supera el horario límite, avanza al día siguiente.
  - CSS nuevos: `.eli-badge-programado` (amarillo), `.eli-match-schedule`, `.eli-match-actions`, `.eli-prog-toolbar`.
  - Commits de la sesión:
    - `feat(grupos+eli): modo liga en grupos y programación de partidos playoff`

### 2026-03-18 (sesión 5)
- Selección de carnets para imprimir / exportar PDF:
  - Cada carnet en `bloque-carnets-jugadores` ahora muestra un **checkbox** en la esquina superior derecha (oculto en impresión via `@media print`).
  - Barra de selección (`carnets-sel-bar`) con toggle "Seleccionar todos / ninguno" y contador `N de M seleccionados`.
  - `imprimirCarnetsJugadores()` y `exportarCarnetsPDF()` usan `obtenerIdsCarnetSeleccionados()`: si hay checkboxes marcados, solo se incluyen esos; si ninguno marcado, se imprimen todos (backward compatible).
  - El PDF lleva sufijo `_selN` en el nombre de archivo cuando hay selección parcial.
  - CSS: `.carnet-sel-overlay`, `.carnets-sel-bar`, efecto outline azul en carnets seleccionados (`:has()` selector).
- Temas visuales para posters de exportación:
  - 3 temas aplicables a todos los posters: **Oscuro** (default, gradiente navy), **Clásico** (gradiente claro), **Colores del torneo** (usa `color_primario`/`color_secundario`/`color_acento` del campeonato via CSS vars `--t-primario`, `--t-secundario`, `--t-acento`).
  - Selector de tema visible en `gruposgen.html` (poster de grupos) y en `fixtureplantilla.html`.
  - `cargarCabeceraCampeonato()` en `gruposgen.js` ya carga y aplica los CSS vars del campeonato al poster.
  - `cargarContexto()` en `fixtureplantilla.js` idem para el poster de fixture.
  - CSS de temas en `grupos.css` con variables `--poster-bg`, `--poster-color`, `--poster-card-bg`, `--poster-card-border`, `--poster-card-text`.
- Nueva página de plantilla para jornadas: `jornadasplantilla.html` + `jornadasplantilla.js`:
  - Accesible desde `partidos.html` > pestaña Plantilla Fixture > botón "Plantilla Jornada".
  - Carga el evento/campeonato por `RouteContext` (`evento`, `jornada`).
  - Renderiza un poster con: cabecera (logo, nombre torneo, categoría), selector de jornada (cuando hay más de una), y cards de partidos de la jornada seleccionada con logos, marcador, fecha, hora y cancha.
  - Auto-selecciona la primera jornada con partidos en estado `programado`.
  - Soporta exportación PNG y PDF (via `html2canvas` + `jsPDF`).
  - Soporta los 3 temas visuales.
  - CSS de cards de partido en poster: `.poster-jornada-partido`, `.poster-partido-row`, `.poster-partido-score`, `.poster-jornada-logo`, etc. (agregado en `grupos.css`).
- Commits de la sesión:
  - `feat(plantillas): selección carnets, temas poster, página jornadas`

### 2026-03-17 (sesión 3)
- Portal público / mejoras visuales y lógica de jornadas:
  - Cards de partidos en Jornadas ahora muestran **logos de equipos** (`equipo_local_logo_url` / `equipo_visitante_logo_url`) con fallback a inicial del nombre en círculo.
  - Subtab **Jornadas** separado de nuevo subtab **Resultados**: Jornadas muestra solo partidos pendientes/programados; Resultados muestra jornadas completamente finalizadas.
  - Card de jornada centrada con `max-width: 680px` para no ocupar todo el ancho del body.
  - Corrección definitiva del desfase UTC en fechas: `parseFechaLocalPortal()` ahora captura también el formato `"YYYY-MM-DDT00:00:00.000Z"` que devuelve el driver `pg` para columnas `DATE`, extrayendo solo la parte de fecha y construyendo como hora local.
  - Botones de jornada en selector: habilitado **solo si la jornada tiene partidos con `estado='programado'`**. Deshabilitados con tooltip contextual: `"Por programar"` (sin fecha) o `"Jornada finalizada"` (todas completadas). Opacity 0.38 + `cursor: not-allowed`.
  - Jornada activa auto-seleccionada: primera con al menos un partido en `estado='programado'`.
- Auto-estado de partidos (`estado` automático por programación):
  - `actualizarPartido` (backend): al asignar `fecha_partido` → `estado='programado'` automático; al borrarla → `estado='pendiente'`. Estados terminales (`finalizado`, `no_presentaron_ambos`, `suspendido`, `aplazado`, `en_curso`) no se modifican.
  - Migración inline en `asegurarEsquemaSecuencia`: al arrancar Render, partidos existentes con `fecha_partido IS NOT NULL AND estado='pendiente'` migran automáticamente a `estado='programado'`.
  - Resultado del flujo completo de estados:
    - Fixture generado sin fecha → `pendiente`
    - Se programa fecha/hora → `programado` (automático)
    - Se ingresan resultados → `finalizado` (ya existía por defecto)
    - Se borra la fecha → vuelve a `pendiente`
- Commits de la sesión:
  - `ec2727e` fix(portal): corregir desfase UTC en fechas (primera versión parcial)
  - `372dfda` feat(portal): logos de equipos, separar Jornadas/Resultados y centrar cards
  - `cfa025f` fix(portal): corregir fecha ISO de pg y deshabilitar botones de jornadas finalizadas
  - `ad0c58e` feat(partidos): auto-estado programado/pendiente y activación de jornadas por estado

### 2026-03-17 (sesión 2)
- Portal publico / tab Jornadas:
  - nueva subtab `Jornadas` agregada como primera pestaña en el panel de cada categoria del portal.
  - `portalVerCampeonato()` ahora fetcha `GET /api/public/eventos/:id/partidos` en paralelo con el resto de datos del evento.
  - `renderJornadasPortal()` mejorado:
    - selector de jornada con botones numerados (`J1`, `J2`, ...) para navegar entre fechas sin scrollear.
    - la jornada activa se determina automaticamente: primera con partidos pendientes, o ultima si todo esta finalizado.
    - cada card de jornada muestra la fecha/rango de fechas extraída de `fecha_partido` de los partidos.
    - badge de estado por jornada: `Próxima` (azul), `En curso` (amarillo), `Finalizada` (verde).
    - solo se muestra una jornada a la vez (toggled por selector), sin scroll lateral.
  - el filtro de `portal_jornadas_habilitadas` del organizador se aplica correctamente: el backend ya filtra, el frontend renderiza solo las jornadas recibidas.
  - nuevos estilos en `portal.css`:
    - `.portal-jornadas-wrap`, `.portal-jornadas-selector`, `.portal-jornada-selector-btn`
    - `.portal-jornada-badge` con variantes `badge-proxima`, `badge-en-curso`, `badge-finalizada`
    - `.portal-jornada-card-title`, `.portal-jornada-fecha`, `.portal-jornada-card-meta`
  - validacion tecnica:
    - `node --check frontend/js/portal.js` => OK

### 2026-03-17
- Fixture / gestion avanzada:
  - nuevo endpoint `DELETE /partidos/evento/:evento_id/fixture` para eliminar el fixture completo de un evento.
    - detecta partidos finalizados y exige confirmacion (`force=true`) antes de borrarlos.
    - boton `Eliminar Fixture` (rojo) en `partidos.html` > seccion Generacion de Fixture.
  - nuevo endpoint `POST /partidos/evento/:evento_id/regenerar-preservando` para regenerar el fixture conservando partidos ya jugados.
    - conserva partidos en estado `finalizado` / `no_presentaron_ambos`.
    - elimina solo partidos pendientes y regenera round-robin completo para los equipos actuales.
    - soporta modo con grupos (`grupo_equipos`) y sin grupos (`evento_equipos`).
    - continua numeracion de jornadas desde la ultima jugada + 1.
    - boton `Regenerar (preservar jugados)` (amarillo) en `partidos.html`.
  - ambos botones se muestran solo cuando existe fixture generado en el evento.
- Portal publico / control de jornadas visibles:
  - nueva columna `portal_jornadas_habilitadas JSONB` en tabla `eventos` (agregada via `ALTER TABLE IF NOT EXISTS`, sin migracion separada).
    - `null` = mostrar todas las jornadas (backward compatible).
    - `[1,2]` = solo esas jornadas visibles en el portal.
    - `[]` = ninguna jornada visible.
  - filtro aplicado en `publicPortalService` al servir partidos publicos por categoria.
  - nuevos endpoints:
    - `GET /organizador-portal/eventos/:id/jornadas-portal`
    - `PUT /organizador-portal/eventos/:id/jornadas-portal`
    - `GET /organizador-portal/campeonatos/:id/eventos`
  - UI en `organizador-portal.html`: seccion con checkboxes por jornada, botones `marcar todas`, `desmarcar todas` y `sin filtro (todas)`.
  - validacion tecnica:
    - `node --check backend/controllers/organizadorPortalController.js`
    - `node --check backend/controllers/partidoController.js`
    - `node --check backend/models/Partido.js`
    - `node --check backend/services/publicPortalService.js`
    - `node --check frontend/js/organizador-portal.js`
    - `node --check frontend/js/partidos.js`

### 2026-03-16
- Playoff / eliminatorias:
  - `eliminatorias.html` ya soporta valores de `clasificados_por_grupo` mayores a `6` en la UI de playoff.
  - se corrigio la herencia del valor guardado en la categoria para que el selector no quede vacio cuando una categoria clasifica `8` o mas por grupo.
  - `frontend/js/eliminatorias.js` ahora usa el valor persistido del evento/configuracion como fallback operativo antes de cargar clasificacion manual o generar la llave.
  - con esto la logica existente de reemplazo por equipos eliminados vuelve a aplicarse correctamente en categorias distintas a Abierta, porque el flujo deja de degradarse a `0`/`2` cupos por un problema visual del selector.
  - la plantilla `balanceada_8vos` se renombro en UI como `Evitar reencuentros tempranos de grupo (balanceada)`.
  - esa plantilla ahora cubre dos escenarios:
    - `4 grupos x 4 clasificados`: sugiere `A vs C` y `B vs D`, mostrando la vista previa `P1..P8`.
    - `2 grupos x N clasificados`: arma un sembrado espejo `A/B` siguiendo el orden deportivo solicitado por el cliente (ej. para `8` clasificados: `1A-8B`, `2B-7A`, `3A-6B`, `4B-5A`, espejo al lado derecho).
  - la vista previa ya refleja ambos casos y, cuando el playoff arranca en `8vos`, se dibuja una grilla tipo bracket para que el organizador confirme visualmente el armado antes de generarlo.
- Jugadores / roster por categoria:
  - se incorporo la migracion `045_jugadores_evento_categoria.sql`.
  - se agrego la migracion `046_jugadores_cedula_por_evento.sql` para eliminar la restriccion global `jugadores_dni_key`.
  - `jugadores` ahora soporta `evento_id` para que la nomina quede asociada a la categoria/evento y no solo al `equipo_id`.
  - `backend/models/Jugador.js` ya separa por categoria:
    - lectura de plantel,
    - conteo maximo de jugadores,
    - validacion de cédula,
    - validacion de numero de camiseta,
    - capitan por categoria.
  - `backend/models/Partido.js` arma la planilla usando `Jugador.obtenerPorEquipo(equipo_id, partido.evento_id)`, por lo que el plantel visible del partido ya queda acotado a la categoria real.
  - `frontend/js/planilla.js` y el flujo mobile ya envian `evento_id` en el alta de jugadores para que las inscripciones hechas desde planilla/app tambien queden en la categoria correcta.
  - compatibilidad:
    - equipos de una sola categoria siguen leyendo filas legacy `evento_id IS NULL` hasta completar migracion.
    - equipos de multiples categorias ya se leen solo por `evento_id` para cortar el problema de nomina compartida.
  - validacion local:
    - migracion `045` aplicada en BD local: `OK`
    - migracion `046` aplicada en BD local: `OK`
    - verificacion posterior: `733/733` jugadores con `evento_id` cargado.
    - verificacion posterior: la unicidad vieja por `cedidentidad` fue reemplazada por `jugadores_cedidentidad_evento_uidx`.
  - despliegue:
    - migraciones `045` y `046` aplicadas en Render: `OK`
    - verificacion remota:
      - restriccion vieja `jugadores_dni_key` ausente,
      - indice `jugadores_cedidentidad_evento_uidx` presente.
- Jugadores / categorías activas:
  - se corrigió la validación de cédula al crear/editar/importar jugadores para que use el `evento_id` actual enviado por la UI.
  - el bloqueo ya no se calcula con todas las categorías donde esté inscrito el equipo destino, sino con la categoría concreta desde la que se registra el jugador.
  - impacto: un jugador vuelve a poder inscribirse en distintas categorías del mismo campeonato, incluso con equipos diferentes, siempre que no repita en la misma categoría.
- Tablas manuales vs resultados reales:
  - se ajustó la invalidación automática al cargar resultados/planillas.
  - antes, un resultado nuevo en un grupo eliminaba las tablas manuales de todo el evento.
  - ahora:
    - en formato por grupos, solo se invalida la tabla manual, la clasificación manual y la reclasificación del grupo afectado,
    - la llave eliminatoria del evento se limpia completa para obligar regeneración coherente.
  - esto evita perder correcciones manuales de otros grupos no afectados.
- Eliminatorias / plantilla mejores perdedores:
  - se incorporo la nueva plantilla `Mejores perdedores (24 -> 12vos -> 8vos)` dentro de la configuracion de playoff.
  - la opcion ya queda visible en:
    - `eventos.html`,
    - `eliminatorias.html`.
  - comportamiento implementado:
    - genera una ronda inicial `12vos` con 24 clasificados,
    - clasifica automaticamente a los 12 ganadores,
    - reserva `4` cupos `MP1..MP4` para mejores perdedores,
    - al cerrarse los `12vos`, el backend calcula los mejores perdedores con las mismas reglas deportivas vigentes:
      - rendimiento/porcentaje,
      - diferencia de goles,
      - goles a favor,
      - enfrentamiento directo cuando aplique,
      - fair play final.
  - los cupos `MP` se completan automaticamente antes de `8vos` siempre que la ronda siguiente no haya empezado.
  - se agregaron etiquetas y soporte visual para la nueva ronda `12vos` en:
    - backend de eliminatorias,
    - `frontend/js/eliminatorias.js`,
    - `frontend/js/portal.js`.
  - tambien se blindo la logica de byes para que un ganador de `12vos` no avance solo mientras el slot del mejor perdedor siga pendiente.

### 2026-03-15
- Tablas manuales vs resultados reales:
  - se corrigio el desfase donde una `edicion manual activa` podia congelar puntos/posiciones antiguas despues de registrar nuevos partidos o guardar una planilla finalizada.
  - ahora, cuando cambia el resultado deportivo real de un partido (`resultado`, `estado`, `shootouts`), el sistema invalida automaticamente:
    - `tabla_posiciones_manuales`,
    - `evento_clasificados_manuales`,
    - `evento_reclasificaciones_playoff`,
    - `partidos_eliminatoria`
    del evento afectado.
  - ademas se registra auditoria automatica sobre la tabla manual removida con comentario de invalidacion por nuevo resultado real.
  - impacto funcional:
    - la tabla vuelve a calcularse con los datos reales del partido,
    - el playoff debe regenerarse despues de ese cambio para no quedar desfasado.
- Eliminatorias / llaves configurables desde categoria:
  - se agrego configuracion inicial de playoff directamente en la categoria/evento para definir:
    - `playoff_plantilla`,
    - `playoff_tercer_puesto`.
  - nuevas opciones visibles:
    - `Estandar`,
    - `Balanceada 8vos`.
  - la opcion `Balanceada 8vos` implementa el armado solicitado para 16 clasificados desde cruces de grupos, generando:
    - `8VO P1: 1A vs 4C`,
    - `8VO P2: 2B vs 3D`,
    - `8VO P3: 1D vs 4B`,
    - `8VO P4: 2C vs 3A`,
    - `8VO P5: 1B vs 4D`,
    - `8VO P6: 2A vs 3C`,
    - `8VO P7: 1C vs 4A`,
    - `8VO P8: 2D vs 3B`.
  - la configuracion tambien permite incluir `Tercer y cuarto puesto`, creando un cruce extra entre perdedores de semifinal.
  - se ajusto la rotulacion de llaves/exportaciones para mostrar:
    - `8VO P#`,
    - `4TO G#`,
    - `SEM G#`,
    - `FINAL`,
    - `TERCER Y CUARTO`.
  - nuevas migraciones:
    - `database/migrations/043_evento_playoff_templates_y_tercer_puesto.sql`
    - `database/migrations/044_partidos_eliminatoria_fuente_ganador_perdedor.sql`
  - migraciones `043` y `044` aplicadas y verificadas en:
    - BD local,
    - PostgreSQL de Render.
  - validacion tecnica:
    - `node --check backend/models/Eliminatoria.js`
    - `node --check backend/controllers/eventoController.js`
    - `node --check frontend/js/eliminatorias.js`
    - `node --check frontend/js/eventos.js`
    - `node --check frontend/js/portal.js`
    - `npm --prefix backend run smoke` => `PASS 9/9`.
- Eliminatorias / reclasificación operativa:
  - se corrigio el flujo de `partido_extra_reclasificacion` para que, al guardar la clasificacion manual, la reclasificacion ya no quede solo como registro logico.
  - ahora cada reclasificacion genera y enlaza un `partido` real mediante `evento_reclasificaciones_playoff.partido_id`.
  - desde `eliminatorias.html` ya queda visible:
    - `Ver en partidos`,
    - `Abrir planilla`,
    - numero de partido y estado operativo.
  - ese partido extra tambien aparece en `partidos.html` con badge `Partido extra playoff`, permitiendo registrar planilla y resultado como cualquier otro partido del evento.
  - cuando la planilla deja el partido `finalizado`, el backend sincroniza automaticamente el ganador hacia la reclasificacion y libera el cupo playoff correspondiente.
  - nueva migracion:
    - `database/migrations/042_reclasificacion_playoff_partido_operativo.sql`
  - migracion `042` aplicada y verificada en:
    - BD local,
    - PostgreSQL de Render.
  - validacion tecnica:
    - `node --check backend/models/Eliminatoria.js`
    - `node --check frontend/js/eliminatorias.js`
    - `node --check frontend/js/partidos.js`
    - `npm --prefix backend run smoke` => `PASS 9/9`.
- Portal publico / playoff:
  - se corrigio la publicacion del bloque `Playoff` en `portal.html` para que ya no muestre llaves desactualizadas.
  - el backend ahora compara la llave guardada en `partidos_eliminatoria` contra la clasificacion vigente del evento antes de publicarla.
  - si detecta equipos eliminados dentro de la llave, cambios de sembrado o cupos pendientes, el portal deja de renderizar la ronda y muestra un mensaje claro de regeneracion.
  - para eventos con cupo vacante, el portal tambien bloquea la publicacion hasta que se resuelva la reclasificacion o se regenere la llave.
  - validacion real ejecutada sobre el evento publico donde aparecian `Inter FC` y `San Rafael`:
    - resultado esperado: `inconsistente=true`, `codigo=bracket_desactualizado`,
    - detalle: `Equipos fuera de clasificación detectados: Inter FC, San Rafael. Regenera el playoff.`
  - archivos clave:
    - `backend/models/Eliminatoria.js`
    - `backend/services/publicPortalService.js`
    - `frontend/js/portal.js`

### 2026-03-14
- Tablas / auditoria / playoff:
  - se habilito edicion manual de tablas de posiciones solo para `administrador`.
  - la correccion manual exige comentario de auditoria y guarda:
    - snapshot anterior,
    - snapshot nuevo,
    - usuario responsable,
    - fecha de cambio.
  - nuevas migraciones:
    - `database/migrations/040_tablas_posiciones_manual_y_auditoria.sql`
    - `database/migrations/041_reclasificacion_playoff_vacantes.sql`
  - ambas migraciones quedaron aplicadas y verificadas en:
    - BD local,
    - PostgreSQL de Render.
  - la clasificacion a playoff ahora consume la misma tabla ajustada que ve el modulo `tablas`, por lo que:
    - los equipos eliminados no entran a los cupos playoff,
    - una correccion manual de posiciones hecha por administrador se refleja al calcular clasificados.
  - la tabla manual ahora se reordena automaticamente cuando el administrador cambia puntos o estadisticas; la `posicion manual` queda solo como desempate final si los equipos terminan igualados.
  - cuando un grupo queda con vacante real de clasificacion, el sistema ya puede abrir una `reclasificación playoff` entre los mejores opcionados externos al grupo.
  - la reclasificacion queda registrada por cupo, evita reutilizar equipos en varios cupos y exige resolver ganador antes de generar la llave definitiva.
  - validacion tecnica:
    - `node --check backend/controllers/tablaController.js`
    - `node --check backend/models/Eliminatoria.js`
    - `node --check backend/controllers/eliminatoriaController.js`
    - `node --check frontend/js/tablas.js`
    - `node --check frontend/js/eliminatorias.js`
    - `npm --prefix backend run smoke` => `PASS 9/9`.
- QA / despliegue / migraciones:
  - se sincronizo `main` con remoto y se aplico la migracion `039_jugadores_foto_carnet_recorte.sql` en:
    - BD local,
    - PostgreSQL de Render.
  - se detecto que los scripts de validacion con dataset real tomaban por defecto un campeonato QA/admin no publico y fallaban al llegar a `/api/public/...`.
  - `backend/scripts/e2eOperationalFlowCheck.js` y `backend/scripts/qaUiDatasetCheck.js` ahora descubren automaticamente un campeonato/evento/partido/equipo visibles en portal publico antes de ejecutar las comprobaciones deportivas/publicas.
  - validacion tecnica ejecutada:
    - `npm --prefix backend run smoke:roles` => `PASS 18/18`,
    - `npm --prefix backend run smoke:frontend` => `PASS 38/38`,
    - `npm --prefix backend run smoke:matrix` => `PASS 48/48`,
    - `npm --prefix backend run e2e:ops-flow` => `OK dataset campeonato=2 evento=8 partido=65 equipo=42`,
    - `npm --prefix backend run qa:ui-dataset` => `OK dataset campeonato=2 evento=8 partido=65 equipo=42`.
- Navegacion interna / UX:
  - se implemento `RouteContext` en `frontend/js/core.js` para guardar contexto de navegacion interna en `sessionStorage`.
  - las pantallas internas ya no dependen de `?campeonato=...&evento=...&equipo=...&partido=...` visibles en la barra del navegador.
  - el sistema ahora limpia la URL al cargar y mantiene el contexto entre:
    - `campeonatos -> eventos`
    - `eventos -> equipos`
    - `equipos -> jugadores`
    - `equipos -> sorteo`
    - `sorteo -> grupos`
    - `grupos -> playoff`
    - `partidos -> planilla`
    - `partidos -> fixture plantilla`
    - `partidos -> eliminatorias`
    - `planilla -> partidos`
    - `tablas`
  - se mantiene soporte de compatibilidad para enlaces antiguos con query string: el modulo toma el contexto una vez y luego limpia la barra.
  - validacion tecnica:
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
  - pendiente de prueba manual:
    - verificar visualmente todos los flujos internos despues de `Ctrl + F5` para confirmar que la barra quede limpia en cada modulo.
- Jugadores / carnés:
  - se agregó soporte de recorte estable para `foto carné`.
  - el ajuste visual ahora se previsualiza con `canvas` para representar el recorte real.
  - al guardar, el sistema genera y sube una imagen recortada específica del carné (`foto_carnet_recorte_url`) sin perder la foto original.
  - el PDF y la impresión del carné ahora priorizan esa imagen recortada, evitando desfases entre preview y exportación.
  - el ajuste ahora permite arrastrar la imagen con mouse o dedo, incluye guía visual para el rostro y añade botón `Restablecer` para volver al encuadre base.
  - se agregó la migración `database/migrations/039_jugadores_foto_carnet_recorte.sql`.
  - validación técnica:
    - `node --check backend/models/Jugador.js`
    - `node --check backend/controllers/jugadorController.js`
    - `node --check backend/routes/jugadorRoutes.js`
    - `node --check frontend/js/jugadores.js`
    - `npm --prefix backend run smoke` => `PASS 9/9`.
- Seguridad / sesion:
  - `frontend/js/core.js` ahora muestra una advertencia previa con cuenta regresiva antes del cierre automatico por inactividad.
  - el usuario puede elegir `Seguir conectado` para renovar la sesion o `Cerrar sesión ahora` si quiere salir manualmente.
  - la advertencia tambien se sincroniza correctamente con la actividad de otras pestañas.
  - validacion tecnica:
    - `node --check frontend/js/core.js`,
    - `npm --prefix backend run smoke` => `PASS 9/9`.
- Jugadores / uploads:
  - se corrigio el guardado de jugadores con foto/documentos para que use `ApiClient.requestForm(...)` y herede el token de autenticacion.
  - `frontend/js/api.js` ahora expone mejor el `detalle` de errores HTTP cuando el backend devuelve un mensaje tecnico controlado.
  - `backend/config/multerConfig.js` amplia el limite de imagenes a `8MB`.
  - `backend/server.js` transforma errores de `multer` (por ejemplo `LIMIT_FILE_SIZE`) en respuestas `400` con mensaje claro.
  - `backend/controllers/jugadorController.js` ya responde `400` cuando el archivo no pasa la validacion de tipo (`req.fileValidationError`), evitando que llegue como error interno generico.
  - validacion tecnica:
    - `node --check frontend/js/api.js`
    - `node --check frontend/js/jugadores.js`
    - `node --check backend/config/multerConfig.js`
    - `node --check backend/controllers/jugadorController.js`
    - `node --check backend/server.js`
    - `npm --prefix backend run smoke` => `PASS 9/9`.

### 2026-03-13
- Repositorio:
  - se auditaron y consolidaron cambios locales pendientes antes de sincronizar con remoto.
  - migraciones aplicadas en BD local:
    - `database/migrations/037_eventos_clasificacion_tabla_acumulada.sql`
    - `database/migrations/038_jugadores_foto_carnet_zoom.sql`
  - validacion tecnica:
    - `node --check` sobre backend/frontend modificados,
    - `npm --prefix backend run smoke` => `PASS 9/9`.
- UX del sistema deportivo:
  - `frontend/js/core.js` y `frontend/css/style.css` ahora muestran un boton visible `Salir` junto al badge del usuario en la topbar.
  - en movil el bloque de usuario hace wrap y el boton baja debajo del nombre cuando no entra en una sola fila.
- Seguridad / sesion:
  - `frontend/js/core.js` ya fuerza cierre de sesion automatico tras `1 hora` de inactividad en cualquier dispositivo.
  - la ultima actividad se sincroniza entre pestañas con `localStorage` y `login.html` muestra aviso cuando la sesion fue cerrada por timeout.
  - `frontend/js/api.js`, `frontend/js/login.js` y `frontend/js/register.js` ya consumen `refreshToken` para acompañar el cierre de sesion y el control de actividad.
- Jugadores:
  - `backend/models/Jugador.js` ya permite reutilizar la misma cedula en distintas categorias del mismo campeonato; el bloqueo solo aplica si el jugador intenta quedar en dos equipos de la misma categoria/evento.
  - `frontend/jugadores.html`, `frontend/js/jugadores.js` y `frontend/css/style.css` ajustaron la experiencia de fichas/tarjetas:
    - hero visual con `foto carné`,
    - fallback al logo del equipo o placeholder,
    - reubicacion de `Planilla` en la franja de acciones,
    - controles de ajuste de foto sin barras visibles, solo con botones de zoom y posicion.
  - pendiente de UX:
    - validar con datos reales si el layout final de cards de jugadores debe quedarse en `4/3/2/1` o endurecer un minimo mayor por card.

### 2026-03-12
- Usuarios / organizadores:
  - `frontend/usuarios.html` y `frontend/js/usuarios.js` ya alinean el alta/edicion del rol `organizador` con la base usada por `Mi Landing`.
  - desde el formulario de usuarios ya se puede capturar:
    - nombre de organizacion,
    - lema publico,
    - correo de contacto publico,
    - telefono / WhatsApp publico,
    - logo de la organizacion.
  - al editar un organizador, `usuarios.html` consulta su contexto real de `Mi Landing` y precarga:
    - branding,
    - contacto,
    - logo actual.
  - si el administrador sube logo desde usuarios, el archivo se sincroniza contra `organizador_portal_config` sin obligar a entrar luego a `organizador-portal.html`.
- Backend / sincronizacion:
  - `backend/controllers/authController.js` ahora sincroniza automaticamente el perfil base del organizador hacia `OrganizadorPortal` en:
    - registro publico del organizador,
    - alta de usuario organizador por administrador,
    - actualizacion de usuario organizador.
  - `backend/models/OrganizadorPortal.js` ya mantiene sincronizado `usuarios.organizacion_nombre` cuando el nombre de organizacion se cambia desde `Mi Landing`, evitando divergencia entre ambos modulos.
- Verificacion:
  - validacion de sintaxis OK en:
    - `frontend/js/usuarios.js`,
    - `frontend/js/api.js`,
    - `backend/controllers/authController.js`,
    - `backend/models/OrganizadorPortal.js`.
  - smoke backend:
    - `npm --prefix backend run smoke` => `PASS 9/9`.

### 2026-03-11
- Carnés:
  - nueva migracion:
    - `database/migrations/035_campeonato_fondo_carnet.sql`.
  - `campeonatos` ya permite gestionar un `fondo de carné / marca de agua` independiente del logo.
  - el fondo se usa como capa visual sobre el carné mezclando:
    - imagen subida,
    - colores del campeonato,
    - logo del campeonato.
  - el organizador puede:
    - subirlo,
    - reemplazarlo,
    - eliminarlo.
  - el render queda unificado para:
    - vista previa,
    - impresion,
    - exportacion PDF.
  - la migracion `035` ya fue aplicada:
    - en BD local,
    - en PostgreSQL remoto de Render.
- Portal del organizador:
  - se implemento la base de branding/media propia por organizador con nueva migracion:
    - `database/migrations/034_organizador_portal_branding.sql`.
  - nuevo modulo privado `Mi Landing` para organizadores con gestion de:
    - configuracion basica del portal,
    - auspiciantes propios,
    - media publica para landing,
    - media publica para cards/galeria de campeonatos.
  - el portal publico ya separa los auspiciantes del organizador de los auspiciantes institucionales LT&C.
  - las cards de campeonatos ahora pueden consumir primero:
    - media publica del campeonato,
    - logo del organizador,
    - y solo despues fallback LT&C.
  - la migracion `034` ya fue aplicada:
    - en BD local,
    - en PostgreSQL remoto de Render.
- Textos visibles:
  - se corrigio la ortografia visible de `carnet/carnets` a `carné/carnés` en formularios, reportes y mensajes al usuario sin tocar claves tecnicas (`foto_carnet_url`, ids internos, etc.).
- Jugadores:
  - se corrigio el bug de `fecha_nacimiento` que restaba un dia en tarjetas/listados por conversion de zona horaria del navegador.
  - ahora se puede eliminar la `foto carné` desde el modal/perfil del jugador y el backend limpia el archivo reemplazado o marcado para borrado.
  - los campos de `foto_cedula` y `foto_carnet` quedan listos para captura directa desde celular (`capture=environment` / `capture=user`), facilitando la toma de foto en cancha.
- Portal publico:
  - el listado general vuelve a mostrar torneos `borrador` / `inscripcion` cuando son campeonatos reales del organizador o registros legacy con `organizador` informado.
  - se mantiene fuera del portal cualquier campeonato de `administrador` o QA.
- Campeonatos:
  - se ampliaron los tipos de futbol soportados en backend/frontend:
    - `futbol_11`,
    - `futbol_9`,
    - `futbol_8`,
    - `futbol_7`,
    - `futbol_6`,
    - `futbol_5`,
    - `futsala`,
    - `indor`.
  - nueva migracion agregada:
    - `database/migrations/033_campeonatos_tipos_futbol_ampliados.sql`.
  - la migracion `033` ya fue aplicada:
    - en BD local,
    - en PostgreSQL de Render.
- Portal/landing:
  - `Ingresar` y `Registrarse` ahora abren en nueva ventana para no romper la navegacion del portal publico compartible.

### 2026-03-10
- Render ya quedo operativo en produccion inicial:
  - servicio `https://ltyc.onrender.com` en estado `Live`,
  - verificados endpoints:
    - `/salud`,
    - `/testDb`.
  - favicon LT&C visible en navegador.
- Sorteo endurecido para no romper integridad:
  - `backend/models/Grupo.js` ya impide reiniciar/eliminar grupos si la categoria tiene:
    - partidos programados,
    - eliminatorias generadas.
  - `backend/controllers/grupoController.js` devuelve error de negocio controlado (`400`) en vez de fallo FK/`500`.
- Portal publico refinado para operacion real:
  - `frontend/js/portal.js` ya lista todas las cards reales visibles del organizador, incluyendo torneos proximos creados en el sistema.
  - se eliminan cards estaticas/de relleno de proximos torneos.
  - las cards ahora muestran:
    - nombre del organizador sobre el nombre del campeonato,
    - fecha consistente aun cuando falte `fecha_fin`.
  - la palabra `ELIMINADO` en tablas publicas/internas se redujo visualmente para no endurecer tanto la fila.
- Auspiciantes del portal compartible reforzados:
  - `backend/services/publicPortalService.js` ya usa fallback por filesystem (`/uploads/auspiciantes`) cuando no existen relaciones cargadas en BD.
  - pendiente operativo en Render:
    - copiar tambien los archivos reales de `uploads/` al almacenamiento persistente para que el portal muestre imagenes reales.
- Proteccion visual de rutas privadas:
  - `frontend/js/core.js` ahora oculta el `body` de paginas privadas mientras se valida la sesion/rol.
  - objetivo:
    - evitar que se vea contenido interno durante la navegacion directa antes del redirect/autorizacion.

- Portal publico deportivo ajustado para operacion real:
  - `backend/services/publicPortalService.js` ahora expone solo campeonatos creados por usuarios con rol `organizador`.
  - quedan excluidos del portal general:
    - campeonatos creados por `administrador`,
    - campeonatos de QA/pruebas ligados a cuentas administrativas.
  - `backend/controllers/publicPortalController.js` y `backend/routes/publicRoutes.js` ahora protegen tambien en dominio publico:
    - `goleadores`,
    - `tarjetas`,
    - `fair play`,
    de modo que no puedan consultarse por `evento_id` oculto si el campeonato no es publico.
- Landing publica por organizador endurecida:
  - `backend/controllers/authController.js` deja de mezclar campeonatos por alias de texto,
  - la landing de organizador ahora lista solo campeonatos con `creador_usuario_id = organizador`.
- UX del detalle publico del campeonato refinada:
  - `frontend/js/portal.js` mantiene nombre del campeonato arriba y tabs por categoria,
  - las subtabs deportivas quedan alineadas a la operacion solicitada:
    - `Tabla de posiciones`,
    - `Goleadores`,
    - `Fair play`,
    - `Tarjetas amarillas`,
    - `Tarjetas rojas`.
  - se elimina de esta vista publica el foco en `Jornadas`/`Tarjetas` combinadas para simplificar lectura estadistica.
- Layout responsive de tablas publicas:
  - `frontend/css/portal.css` y `frontend/js/portal.js` ahora muestran tablas de posiciones:
    - `2` bloques por fila en desktop,
    - `1` bloque por fila en tablet/movil.

- Preparacion de despliegue en Render:
  - nuevo documento `docs/DEPLOY_RENDER.md` con:
    - variables requeridas,
    - uso de `DATABASE_URL`,
    - `render.yaml`,
    - consideraciones de `uploads/`.
  - nuevo archivo `render.yaml` para bootstrap de un solo servicio Node en Render.
- Backend listo para despliegue por URL de conexion:
  - `backend/config/database.js` ahora soporta:
    - `DATABASE_URL`,
    - `DATABASE_SSL` / `PGSSLMODE`,
    - fallback al esquema clasico `DB_*`.
- Frontend preparado para mismo origen en produccion:
  - `frontend/js/core.js` y `frontend/js/api.js` resuelven automaticamente la base de API segun entorno.
  - en local con Live Server se mantiene compatibilidad con `http://localhost:5000/api`.
  - en produccion el frontend consume `/api` sobre el mismo dominio.
- Portal publico mejorado:
  - `frontend/portal.html`, `frontend/js/portal.js` y `frontend/css/portal.css` ahora muestran:
    - detalle de campeonato con tabs por categoria,
    - subtabs por posiciones, jornadas, goleadores, tarjetas, fair play y playoff,
    - vista de jornadas agrupadas con metadatos de fecha/hora/cancha.
- Branding tecnico:
  - nuevo `frontend/favicon.svg`.
  - favicon agregado al portal y a las pantallas principales del sistema.
- Uploads estables para despliegue:
  - nuevo archivo `backend/config/uploads.js` para centralizar la ruta real de almacenamiento.
  - `backend/server.js` ahora publica `/uploads` desde `UPLOADS_DIR` si existe; en local mantiene fallback a `backend/uploads`.
  - `backend/config/multerConfig.js` escribe siempre sobre la misma ruta configurada.
  - controladores que eliminan o leen archivos (`campeonatos`, `equipos`, `auspiciantes`) ya no dependen de una ruta fija dentro del contenedor.
  - `render.yaml` queda preparado con disco persistente en `/var/data` y `UPLOADS_DIR=/var/data/uploads`.
  - documentado el paso operativo para copiar el contenido historico de `backend/uploads/` al disco persistente en Render.
- Jugadores: uploads reorganizados sin romper compatibilidad:
  - `backend/config/multerConfig.js` ahora permite carpetas por campo.
  - `backend/routes/jugadorRoutes.js` enruta:
    - `foto_cedula` -> `uploads/jugadores/cedulas`,
    - `foto_carnet` -> `uploads/jugadores/fotos`.
  - `backend/controllers/jugadorController.js` ya guarda nuevas URLs por subcarpeta manteniendo los campos existentes:
    - `foto_cedula_url`,
    - `foto_carnet_url`.
  - impacto operativo:
    - los carnets siguen reimprimiendose regenerando PDF desde BD + foto del jugador,
    - no se almacena una imagen final del carnet, por lo que no se rompe reimpresion historica.
- Seguridad de usuarios reforzada:
  - nueva migracion `database/migrations/031_usuarios_cambio_password_obligatorio.sql`.
  - `usuarios.debe_cambiar_password` ya queda disponible en backend.
  - usuarios creados por `administrador` u `organizador` quedan obligados a cambiar contraseña al primer ingreso.
  - nuevo endpoint autenticado:
    - `POST /api/auth/password/change`.
  - `frontend/js/core.js` ya fuerza el cambio al detectar una cuenta pendiente y expone accion visible `Cambiar clave` en el top bar.
  - `frontend/js/login.js` y `frontend/js/usuarios.js` ya informan al usuario/administrador cuando la cuenta exige cambio de contraseña.
  - `backend/middleware/authMiddleware.js` permite esta operacion incluso para roles en modo `solo_lectura` (`jugador`).
- Portal publico deportivo refinado para cierre visual:
  - `frontend/js/portal.js` reincorpora la subtab `Playoff` por categoria consumiendo `GET /api/public/eventos/:evento_id/eliminatorias`.
  - la llave publica ahora se muestra por rondas con tarjetas propias, manteniendo el avance del cuadro eliminatorio.
  - el portal ya replica el color de estados de la tabla interna:
    - fuera de clasificacion en naranja,
    - eliminados en rojo oscuro con causal visible.
  - `backend/controllers/tablaController.js` excluye equipos eliminados de `Fair Play`, tanto en panel interno como en portal publico.
- Usuarios internos con correo o username:
  - nueva migracion `database/migrations/032_usuarios_username_opcional.sql`.
  - `backend/models/UsuarioAuth.js` ahora acepta `email` nullable y `username` opcional/unique, con regla obligatoria de al menos un identificador.
  - `backend/controllers/authController.js` permite login por `identificador` (`correo o usuario`).
  - `frontend/login.html` y `frontend/js/login.js` cambian la UX de acceso a `Correo o usuario`.
  - `frontend/usuarios.html` y `frontend/js/usuarios.js` permiten crear/editar usuarios con:
    - correo,
    - username,
    - o ambos.
  - la recuperacion de contraseña sigue funcionando solo para cuentas con correo.

### 2026-03-09
- Configuracion compartida de clasificacion/playoff:
  - nueva persistencia `evento_playoff_config` para mantener sincronizados `tablas.html` y `eliminatorias.html`.
  - nuevos endpoints:
    - `GET /api/eliminatorias/evento/:evento_id/configuracion`,
    - `PUT /api/eliminatorias/evento/:evento_id/configuracion`,
    - `DELETE /api/eliminatorias/evento/:evento_id/configuracion`.
  - `frontend/tablas.html` y `frontend/eliminatorias.html` ahora consumen la misma fuente de verdad para:
    - `metodo_competencia`,
    - `clasificados_por_grupo`,
    - `origen_playoff`,
    - `metodo_playoff`,
    - `cruces_grupos`.
  - nueva migracion agregada:
    - `database/migrations/030_evento_playoff_config.sql`.
- Eliminacion manual por categoria:
  - nuevo servicio `backend/services/competitionStatusService.js` para centralizar estados competitivos de `evento_equipos`.
  - nuevas causales operativas soportadas:
    - `indisciplina`,
    - `deudas`,
    - `sin_justificativo_segunda_no_presentacion`.
  - nuevo endpoint `PUT /api/eventos/:evento_id/equipos/:equipo_id/estado-competencia` para eliminar o rehabilitar equipos dentro de una categoria.
- Clasificacion manual con sugerencia del sistema:
  - nuevo almacenamiento `evento_clasificados_manuales` para guardar decisiones del organizador por `grupo` y `slot_posicion`.
  - nuevos endpoints:
    - `GET /api/eliminatorias/evento/:evento_id/clasificacion`,
    - `PUT /api/eliminatorias/evento/:evento_id/clasificacion-manual`.
  - `backend/models/Eliminatoria.js` ahora:
    - excluye eliminados automaticos/manuales de llaves directas y playoff desde grupos,
    - permite sugerencia automatica por tabla y sobrescritura manual por grupo,
    - cuando un grupo queda incompleto puede proponer al mejor no clasificado elegible del evento,
    - permite guardar criterio manual por cupo:
      - `decision_organizador`,
      - `mejor_no_clasificado_evento`,
      - `partido_extra_reclasificacion`.
- UI operativa en eliminatorias:
  - `frontend/eliminatorias.html` agrega bloque `Estado competitivo de equipos`,
  - `frontend/eliminatorias.html` agrega bloque `Clasificación manual con sugerencia`,
  - `frontend/js/eliminatorias.js` permite:
    - marcar causal y detalle de eliminacion,
    - rehabilitar equipos manualmente eliminados,
    - escoger clasificados por grupo y guardar criterio del organizador,
    - usar candidatos adicionales del evento cuando no hay suficientes elegibles dentro del grupo.
- Tablas y equipos ya reflejan el nuevo estado:
  - `frontend/js/tablas.js` pinta eliminaciones manuales con su causal,
  - `frontend/js/equipos.js` muestra chips de eliminacion manual en tarjetas y tabla,
  - `backend/controllers/tablaController.js` reordena posiciones competitivas para que los eliminados bajen al final aunque tengan mejor puntaje,
  - los equipos fuera de clasificacion ahora se pintan en naranja/marron y los eliminados en rojo oscuro,
  - la leyenda de eliminacion/no presentacion ocupa mas espacio visual dentro de la celda.
- Sistema visual de avisos y dialogos unificado:
  - `frontend/js/core.js` reemplaza `alert/confirm/prompt` por dialogos reutilizables y notificaciones visuales.
  - integracion aplicada en modulos operativos:
    - usuarios,
    - campeonatos,
    - equipos,
    - sorteo,
    - grupos,
    - partidos,
    - planilla,
    - eliminatorias,
    - CMS.
- Migraciones agregadas del bloque:
  - `database/migrations/029_eliminacion_manual_y_clasificacion_manual.sql`,
  - `database/migrations/030_evento_playoff_config.sql`.
- Validacion tecnica:
  - `node --check backend/controllers/eventoController.js` (`PASS`),
  - `node --check backend/controllers/eliminatoriaController.js` (`PASS`),
  - `node --check backend/controllers/tablaController.js` (`PASS`),
  - `node --check backend/models/Eliminatoria.js` (`PASS`),
  - `node --check backend/services/competitionStatusService.js` (`PASS`),
  - `node --check frontend/js/eliminatorias.js` (`PASS`),
  - `node --check frontend/js/tablas.js` (`PASS`),
  - `node --check frontend/js/equipos.js` (`PASS`),
  - `node --check frontend/js/core.js` (`PASS`),
  - `npm --prefix backend run smoke` (`PASS`, 9/9).

### 2026-03-08
- Auditoria de edicion de planillas finalizadas:
  - `backend/models/Partido.js` incorpora control de motivo obligatorio (minimo 8 caracteres) cuando se edita una planilla ya finalizada.
  - se registra traza en `partido_planilla_ediciones` con:
    - `partido_id`,
    - `usuario_id`,
    - `motivo`,
    - `estado_anterior` (snapshot JSON),
    - `estado_nuevo` (snapshot JSON).
  - se agrega migracion `database/migrations/028_auditoria_edicion_planilla.sql`.
- API de planilla y mobile ajustadas para auditoria:
  - `backend/controllers/partidoController.js` ahora envia `usuario_id` a `Partido.guardarPlanilla` y respeta `statusCode` de errores de negocio.
  - `backend/services/mobileOperationsService.js` y `backend/services/mobileCompetitionService.js` soportan `editReason/motivoEdicion/motivo_edicion` para reapertura/edicion controlada desde clientes mobile.
- UX de planillaje:
  - en `frontend/planilla.js` al guardar una planilla finalizada se solicita motivo de edicion antes de enviar.
  - el selector de partidos resalta en amarillo estados cerrados (`finalizado` y `no_presentaron_ambos`) para evitar ediciones accidentales.

- Tablas por categoría: aislamiento por usuario y campeonato corregido.
  - `GET /api/eventos`, `GET /api/eventos/campeonato/:id` y `GET /api/eventos/:id` ahora requieren autenticación y respetan alcance de organizador por campeonato.
  - `GET /api/tablas/*` ahora es privado (autenticado) para evitar cruces de datos internos; el portal público mantiene sus endpoints propios en `/api/public/*`.
  - se reforzó control de acceso por organizador también en lectura/edición de canchas y equipos de categoría.
- Pantalla `tablas.html` mejorada para operación multi-campeonato:
  - nuevo selector de campeonato (`Campeonato -> Categoría`),
  - selección de contexto persistida por usuario en `localStorage` para evitar arrastre de contexto entre cuentas (ejemplo: administrador vs organizador),
  - nuevo bloque `Formato de Clasificación` con botón explícito `Guardar formato` para persistir `metodo_competencia` y `clasificados_por_grupo` de la categoría.
- Resultado del ajuste:
  - organizador ya no recibe categorías de campeonatos ajenos,
  - las tablas se generan sobre el campeonato/categoría seleccionados,
  - el formato de clasificación se guarda de forma explícita desde el módulo de tablas.

- Clasificacion por grupo y tablas:
  - `eventos/categorias` ahora permite configurar `clasificados_por_grupo`,
  - `tablas` muestra el cupo por grupo en el resumen,
  - los equipos fuera de clasificacion se pintan en rojo,
  - si un equipo queda eliminado automaticamente por inasistencias, tambien se marca en rojo y se etiqueta como `Eliminado`.
- No presentacion acumulada por categoria:
  - nueva persistencia en `evento_equipos` para `no_presentaciones` y `eliminado_automatico`,
  - al guardar una planilla, el backend recalcula no presentaciones por equipo dentro de la categoria,
  - con `3` no presentaciones el equipo queda eliminado automaticamente en esa categoria.
- Correccion de doble inasistencia:
  - `ambos no se presentan` ahora guarda `resultado_local/resultado_visitante = NULL`,
  - el estado del partido queda `no_presentaron_ambos`,
  - no se contabiliza como partido jugado,
  - se mantiene la multa por arbitraje/no presentacion para ambos equipos.
- Migraciones aplicadas en la BD local:
  - `database/migrations/026_ambos_no_presentes_sin_resultado.sql`,
  - `database/migrations/027_clasificacion_y_no_presentacion_automatica.sql`.
- Prueba E2E operativa agregada (solo lectura, datos reales):
  - nuevo script `backend/scripts/e2eOperationalFlowCheck.js`,
  - nuevo comando `npm run e2e:ops-flow`,
  - valida punta a punta: autenticacion -> campeonato -> categoria -> equipos -> grupos -> partidos -> planilla -> tablas -> finanzas -> portal publico.

### 2026-03-07
- Planillaje y disciplina:
  - se corrigio el tratamiento de `doble amarilla` para no perder la trazabilidad disciplinaria al guardar/reabrir planillas,
  - ahora la roja generada por `2 TA` queda marcada explicitamente como `Expulsion por doble amarilla`,
  - la suspension conserva la regla correcta:
    - `doble amarilla` -> `1 partido`,
    - `roja directa` -> `2 partidos`.
- Planilla operativa mejorada:
  - nueva inscripcion rapida de jugadores desde `planilla.html`,
  - alta por equipo sin salir del formulario del partido,
  - recarga del plantel sin perder goles/tarjetas/pagos/observaciones ya capturados en pantalla.
- Ajustes operativos de planilla:
  - faltas de `1ER` y `2DO` tiempo ahora se capturan por clic y se guardan por equipo/tiempo para alimentar fair play,
  - el encabezado de planilla mueve los logos de los equipos junto al marcador y reserva el bloque derecho para auspiciantes,
  - la no presentacion parcial ya bloquea solo el lado ausente y mantiene habilitados los pagos/evidencia del equipo que si se presenta.
- Reporteria operativa adicional de disciplina:
  - `frontend/partidos.html` incorpora nueva pestaña `Reporte Sanciones`,
  - consolidado operativo por categoria con foco en:
    - jugadores suspendidos,
    - jugadores con amarillas acumuladas,
    - resumen por equipos con novedades,
  - incluye impresion y exportacion PDF para uso previo a programacion/partidos.
- Modulo financiero ampliado en reporteria ejecutiva:
  - `frontend/finanzas.html` incorpora nuevo bloque `Resumen Ejecutivo por Equipo`,
  - consolidado por equipo con:
    - campeonato y categoria,
    - cargos, abonos y saldo actual,
    - cargos abiertos y vencidos,
    - saldo por inscripcion, arbitraje y multas,
  - incluye impresion dedicada para salida operativa/administrativa.
- Alertas operativas extendidas a gestion de equipos:
  - `frontend/equipos.html` suma bloque `Alertas Operativas`,
  - cada tarjeta/tabla de equipo ahora muestra chips de:
    - deuda pendiente,
    - jugadores suspendidos,
    - seguimiento por amarillas acumuladas,
  - la vista se alimenta con:
    - morosidad del equipo desde finanzas,
    - estado disciplinario por categoria desde jugadores/partidos.
- Alertas operativas extendidas a gestion de partidos:
  - `frontend/partidos.html` suma bloque `Alertas Operativas de los Partidos Mostrados`,
  - cada partido ahora muestra alertas separadas para local y visitante:
    - deuda,
    - suspendidos,
    - seguimiento por amarillas,
  - la tabla de partidos incorpora nueva columna `Alertas` con el mismo detalle operativo.
- Validacion tecnica del bloque:
  - `node --check backend/models/Partido.js` (`PASS`),
  - `node --check frontend/js/planilla.js` (`PASS`),
  - `node --check frontend/js/partidos.js` (`PASS`),
  - `node --check frontend/js/finanzas.js` (`PASS`),
  - `node --check frontend/js/equipos.js` (`PASS`).

### 2026-03-05
- CMS Portal Publico - Fase 6 (cierre operativo) avanzando:
  - endurecimiento de validaciones en backend para modelos CMS:
    - `Noticia`: limpieza de texto y validacion de `imagen_portada_url`,
    - `GaleriaItem`: validacion de `imagen_url` y limites de texto,
    - `PortalContenido`: validacion de email de contacto, URLs sociales y normalizacion de cards/iconos,
    - `ContactoMensaje`: validacion de formato de email y longitud minima de mensaje.
- Formulario publico de contacto reforzado contra abuso:
  - rate-limit por `IP + email` (maximo 3 envios cada 10 minutos),
  - campo honeypot `website` integrado para mitigar bots basicos,
  - respuesta `429` para exceso de solicitudes.
- Frontend landing actualizado para hardening de contacto:
  - nuevo input oculto honeypot en `index.html`,
  - envio del campo `website` desde `frontend/js/portal.js`.
- Documentacion de cierre de fases CMS agregada:
  - `docs/CHECKLIST_QA_CMS_PORTAL_PUBLICO.md`,
  - `docs/GUIA_DESPLIEGUE_CMS_PORTAL_PUBLICO.md`.
- QA automatizado ejecutado para CMS/portal publico:
  - evidencia en `docs/RESULTADO_QA_CMS_2026-03-05.md`,
  - validado:
    - endpoints publicos (`/public/portal-contenido`, `/public/noticias`),
    - proteccion de endpoints CMS privados sin token (`401`),
    - rate-limit de contacto (`3x201 + 429`),
    - honeypot `website` (aceptacion silenciosa),
    - validacion de mensaje corto (`400`).
- QA por rol ejecutado con usuarios de prueba:
  - `administrador` y `operador` con acceso CMS correcto,
  - `organizador/tecnico/dirigente/jugador` bloqueados en endpoints CMS (`403`).
- Hallazgo corregido en esta iteracion:
  - `operador` podia consultar `GET /api/campeonatos`,
  - se ajusto `backend/routes/campeonatoRoutes.js` para exigir `requireAuth + requireRoles` en `GET /` y `GET /:id`,
  - resultado post-fix: `operador` ahora recibe `403` en campeonatos.
- Panel CMS reforzado para operacion diaria:
  - `frontend/portal-cms.html` ahora muestra KPIs editoriales,
  - nuevo script `frontend/js/portal-cms.js` con metricas en tiempo real:
    - noticias publicadas,
    - imagenes activas de galeria,
    - mensajes nuevos de contacto,
    - fecha de ultima actualizacion de contenido institucional.
- Bug CMS corregido en noticias:
  - `publicar/despublicar` devolvia `500` por conflicto de tipos SQL en `Noticia.cambiarEstado`,
  - ajustado casteo explicito y validado en QA:
    - crear noticia `201`,
    - publicar `200`,
    - despublicar `200`.
- Saneamiento de integracion backend (web + mobile + CMS):
  - se agrego script reutilizable `backend/scripts/smokeIntegration.js` y comando `npm run smoke` en `backend/package.json`,
  - se agrego script de verificacion RBAC mobile `backend/scripts/smokeRoleAccess.js` con comando `npm run smoke:roles`,
  - integracion de script del equipo mobile `backend/scripts/smokeProvidedUsers.js` con comando `npm run smoke:provided`,
  - nuevo smoke de matriz RBAC multi-rol desde usuarios activos de BD: `backend/scripts/smokeRoleMatrixDb.js` (`npm run smoke:matrix`),
  - nueva auditoria automatizada de guard frontend por rol sobre `frontend/js/core.js`: `backend/scripts/smokeFrontendRoleGuards.js` (`npm run smoke:frontend`),
  - cobertura base del smoke:
    - salud/DB (`/salud`, `/testDb`),
    - portal publico (`/api/public/campeonatos`, `/api/public/noticias`),
    - endpoints privados sin token (`/api/noticias`, `/api/campeonatos`),
    - endpoints mobile sin token (`/api/mobile/v1/session`, `/api/mobile/v1/eventos/:id/sorteo`, `/api/mobile/v1/finanzas/movimientos`).
  - corrida local validada en esta sesion: `9/9` pruebas en `PASS`.
  - corrida RBAC mobile validada en esta sesion: `18/18` pruebas en `PASS` (`organizador`, `tecnico`, `dirigente`).
  - corrida auditoria frontend por roles: `38/38 PASS`.
  - corrida matriz RBAC completa por rol (DB): `48/48 PASS`.
  - corrida smoke con cuentas provistas app mobile: `27/27 PASS` (`organizador`, `tecnico`, `dirigente`).
  - con esta evidencia, Fase 6 CMS queda cerrada tecnicamente; se mantiene solo validacion visual/manual opcional en navegador como control final operativo.
- Cierre operativo formalizado:
  - nueva acta `docs/ACTA_ACEPTACION_CMS_FASE6_2026-03-05.md`,
  - nuevo comando consolidado de QA CMS en backend: `npm run qa:cms` (`smoke + smoke:frontend + smoke:matrix`).
  - corrida consolidada ejecutada en esta sesion: `95/95 PASS`.
- Modulo de pases: integracion contable completada para el flujo deportivo-financiero:
  - `backend/models/Pase.js` ahora sincroniza movimientos en `finanzas_movimientos` al aprobar/pagar/anular pases,
  - se crean/actualizan dos movimientos por pase (`cargo` equipo destino y `abono` equipo origen),
  - se usa `origen='sistema'` + `origen_clave='pase:{id}:{tipo}'` para idempotencia y trazabilidad.
- Validacion tecnica del bloque de pases-finanzas:
  - chequeo de sintaxis backend: `node --check backend/models/Pase.js` (`PASS`),
  - corrida QA consolidada: `npm run qa:cms` (`95/95 PASS`),
  - prueba controlada de pase temporal en BD: `2 movimientos` contables generados (`cargo/abono`) y limpieza posterior ejecutada.
- Modulo de pases: historial por jugador y por equipo implementado:
  - nuevos endpoints backend:
    - `GET /api/pases/historial/jugadores`
    - `GET /api/pases/historial/jugadores/:jugadorId`
    - `GET /api/pases/historial/equipos`
    - `GET /api/pases/historial/equipos/:equipoId`
  - `frontend/pases.html` ahora incluye bloque visual de historial dedicado:
    - selector de jugador y selector de equipo,
    - resumen consolidado por entidad,
    - tabla de detalle cronologico.
  - `frontend/js/pases.js` sincroniza filtros globales (`campeonato/categoria/estado`) con historial para analisis operativo.
- Validacion de coexistencia con equipo mobile:
  - nuevo script de QA de dataset UI en backend: `npm run qa:ui-dataset`,
  - corrida ejecutada en esta sesion sobre dataset real (`campeonato=6`, `evento=13`, `partido=195`, `equipo=91`) con resultado `PASS`.
- Documentacion ampliada para entrega a cliente y capacitacion:
  - nuevo manual operativo: `docs/GUIA_OPERATIVA_CLIENTE_LT_C.md`,
  - nuevo guion de tutoriales: `docs/GUIA_VIDEO_TUTORIALES_LT_C.md`,
  - actualizacion de referencias en `README.md`, `docs/INDICE_DOCUMENTACION.md` y `docs/GUIA_PRESENTACION_SISTEMA_LT_C.md`.

### 2026-03-04
- Planilla y morosidad:
  - se retiro el bloqueo por deuda al guardar planillas,
  - ahora la planilla siempre se puede registrar y el backend devuelve `aviso_morosidad` como mensaje informativo.
- Avisos de deuda por rol de equipo:
  - tecnico/dirigente/jugador reciben notificacion de deuda acumulada del equipo (toast global),
  - en `portal-tecnico.html` se muestra ademas un banner fijo con el detalle de deuda.
- Nuevo rol `jugador` incorporado:
  - alta de rol en autenticacion y validaciones de usuarios,
  - rol permitido en consultas de lectura de equipo/jugadores/finanzas/planilla,
  - usuario `jugador` forzado a `solo_lectura=true`,
  - migracion agregada: `database/migrations/024_rol_jugador.sql`.
- Coexistencia web + app movil validada para este bloque:
  - el backend principal mantiene contratos de lectura/escritura vigentes,
  - `aviso_morosidad` se entrega como dato informativo sin bloqueo de planilla.
- Modulo financiero extendido con reporte disciplinario-contable:
  - nuevo bloque `Consolidado de Sanciones (TA/TR)` en `frontend/finanzas.html`,
  - calculo agrupado por equipo en `frontend/js/finanzas.js` usando movimientos `concepto=multa`,
  - clasificacion de sanciones entre:
    - `TA` (tarjeta amarilla),
    - `TR` (tarjeta roja),
    - `otras multas`.
  - resumen de saldos por bloque (`TA`, `TR`, `otras`) y saldo total de sanciones.
- Reporteria del consolidado financiero de sanciones:
  - impresion dedicada (`Imprimir sanciones`) con membrete y pie de auspiciantes,
  - filtros integrados con campeonato/categoria/equipo y recarga conjunta con movimientos/morosidad/estado de cuenta.
- Salida ejecutiva global financiera implementada:
  - nuevo bloque `Resumen Ejecutivo por Campeonato` en `frontend/finanzas.html`,
  - consolidado por campeonato en `frontend/js/finanzas.js` con:
    - total cargos/abonos/saldo,
    - cargos de inscripcion,
    - cargos de arbitraje,
    - saldo de multas,
    - cantidad de equipos con movimiento,
  - impresion dedicada (`Imprimir ejecutivo`) con membrete y pie de auspiciantes.
- Alcance pendiente que sigue abierto en finanzas:
  - reforzar reglas de aviso/gestion de morosidad parametrizable.
- Politica de morosidad parametrizable implementada (base):
  - nueva migracion `database/migrations/023_bloqueo_morosidad_parametrizable.sql`,
  - configuracion en campeonato:
    - `bloquear_morosos`,
    - `bloqueo_morosidad_monto`,
  - override opcional por categoria/evento:
    - `bloquear_morosos` (`null` hereda),
    - `bloqueo_morosidad_monto` (`null` hereda),
  - validacion aplicada en guardado de planilla (`backend/models/Partido.js`) en modo informativo:
    - si existe deuda, no bloquea el guardado,
    - retorna aviso de deuda para web y mobile (mismo flujo backend).
- Alcance pendiente que sigue abierto para morosidad:
  - definir si se mantiene solo como aviso o se activa bloqueo en otros flujos operativos fuera de planilla (segun reglas de negocio finales).

### 2026-03-03
- Planilla directa mejorada para operacion por grupo:
  - nuevo selector `grupo` en `frontend/planilla.html`,
  - filtrado encadenado `categoria -> grupo -> jornada -> partido` en `frontend/js/planilla.js`,
  - el selector de partidos ahora muestra el grupo dentro de la etiqueta para identificar mas rapido cada encuentro.
- Estado disciplinario visible fuera de planilla:
  - `backend/models/Partido.js` centraliza el calculo de suspensiones y acumulacion de amarillas por `evento/equipo/jugador`,
  - `backend/controllers/jugadorController.js` ahora puede enriquecer `/jugadores/equipo/:id?evento_id=...` con el estado disciplinario,
  - `frontend/js/jugadores.js` muestra `habilitado`, `acumula TA` o `suspendido` en tarjetas y tabla,
  - nuevo `Reporte de sanciones` en `jugadores.html` con impresion y exportacion PDF por equipo/categoria,
  - nuevo `Consolidado sanciones categoria` en `jugadores.html` con resumen global y detalle por `equipo/jugador`, tambien imprimible y exportable a PDF sin exigir equipo seleccionado.
- Alcance pendiente que sigue abierto en disciplina:
  - ya existe reporte formal por `equipo/jugador`,
  - ya existe consolidado global por `categoria/equipo/jugador`,
  - falta seguir mostrando estas sanciones en otros reportes operativos ademas de `jugadores.html`.

### 2026-03-02
- Planillaje reforzado para escenarios disciplinarios y de inasistencia:
  - nuevo flujo de `inasistencia / walkover` en `frontend/planilla.html` y `frontend/js/planilla.js`,
  - soporte para:
    - no se presenta equipo local,
    - no se presenta equipo visitante,
    - no se presentan ambos equipos.
  - resultado automatico aplicado desde planilla:
    - local ausente -> `0-3`,
    - visitante ausente -> `3-0`,
    - ambos ausentes -> marcador vacio (`NULL/NULL`) con estado `no_presentaron_ambos`.
  - al existir inasistencia:
    - se bloquea captura por jugador,
    - se limpian pagos manuales,
    - se generan multas por arbitraje en finanzas segun corresponda.
- Persistencia backend para inasistencia de planilla:
  - `backend/models/Partido.js` ahora guarda `ambos_no_presentes` e `inasistencia_equipo`,
  - nuevas migraciones:
    - `database/migrations/021_planilla_ambos_no_presentes.sql`,
    - `database/migrations/022_planilla_inasistencia_equipo.sql`.
- Regla disciplinaria aplicada en planilla:
  - `2 tarjetas amarillas` del mismo jugador en un partido se convierten automaticamente en `1 tarjeta roja`,
  - el resumen del partido, la exportacion y finanzas ya reflejan solo roja,
  - no se cobra amarilla + roja en el mismo caso.
- Suspensiones automaticas visibles en planillaje:
  - un jugador suspendido llega marcado en rojo en la planilla y con sus campos bloqueados,
  - reglas activas:
    - doble amarilla en el partido -> suspension de `1` partido,
    - roja directa -> suspension de `2` partidos,
    - futbol 11 -> suspension de `1` partido al acumular `4` amarillas.
  - el calculo se realiza con historial del jugador dentro del `evento/categoria`, previo al partido actual.

### 2026-02-28
- Inicio formal del plan de separacion entre panel deportivo y CMS del portal publico:
  - nuevo documento maestro `docs/PLAN_CMS_PORTAL_PUBLICO.md`,
  - definicion de dos dominios de operacion:
    - gestion deportiva,
    - portal web publico / CMS.
- Fase 1 iniciada:
  - nuevo rol `operador` definido como rol exclusivo para CMS publico,
  - nueva migracion `database/migrations/016_rol_operador_cms.sql`,
  - backend actualizado para aceptar `operador` en autenticacion/permisos,
  - noticias restringidas a `administrador` y `operador`,
  - organizador removido del alcance editorial del portal institucional.
- Frontend base de CMS habilitado:
  - nueva vista `frontend/portal-cms.html`,
  - redireccion de `operador` hacia panel propio,
  - control de acceso por pagina para evitar ingreso de `operador` al panel deportivo,
  - `usuarios.html` actualizado para alta/edicion del rol `operador` por parte del administrador.
- Ajuste semantico de navegacion:
  - `portal-admin.html` pasa a identificarse como `Portal Deportivo` para diferenciarlo del CMS.
- Fase 2 iniciada para noticias/blog:
  - nueva pagina administrativa `frontend/noticias.html` con formulario y listado CRUD,
  - nuevo script `frontend/js/noticias.js`,
  - API frontend extendida con `NoticiasAPI`,
  - nuevas vistas publicas `frontend/blog.html` y `frontend/noticia.html`,
  - la landing principal consume la ultima noticia publicada desde `/api/public/noticias`,
  - nueva migracion formal `database/migrations/017_noticias_cms.sql` para versionar la tabla `noticias`.
- Fases 3, 4 y 5 iniciadas en base funcional:
  - nueva migracion `database/migrations/018_galeria_cms.sql` para galeria institucional,
  - nueva migracion `database/migrations/019_portal_contenido_cms.sql` para contenido editable del portal,
  - nueva migracion `database/migrations/020_contacto_portal.sql` para mensajes del formulario de contacto,
  - nuevos modulos backend:
    - `GaleriaItem`,
    - `PortalContenido`,
    - `ContactoMensaje`,
  - nuevas rutas administrativas:
    - `/api/galeria`,
    - `/api/portal-contenido`,
    - `/api/contacto`,
  - nuevas rutas publicas:
    - `/api/public/galeria`,
    - `/api/public/portal-contenido`,
    - `/api/public/contacto`,
  - nuevas vistas CMS:
    - `frontend/galeria-admin.html`,
    - `frontend/contenido-portal.html`,
    - `frontend/contacto-admin.html`,
  - la landing publica ahora consume contenido institucional editable para:
    - hero,
    - cards destacadas,
    - seccion nosotros,
    - galeria,
    - datos/redes/contacto,
  - el formulario `Escribenos` ya persiste mensajes en base de datos.
- Soporte para presentacion del sistema:
  - nuevo documento `docs/GUIA_PRESENTACION_SISTEMA_LT_C.md` con guion de demo por bloques, roles y flujo sugerido.

### 2026-02-27
- Cierre de lote de ajustes funcionales y de consistencia para organizadores/operacion diaria:
  - refinamientos en autenticacion/usuarios/alcances de organizador,
  - ajustes en campeonatos, categorias, equipos, grupos, partidos, planilla, tablas y registro publico,
  - continuidad del trabajo responsive/mobile en vistas administrativas.
- Configuracion flexible de inscripcion de jugadores por campeonato:
  - nuevo flag `requiere_cedula_jugador` para permitir torneos donde la cedula no sea obligatoria,
  - nuevo check en `campeonatos.html` para activar/desactivar la solicitud de cedula,
  - validacion integrada en backend y frontend para creacion, edicion e importacion de jugadores.
- Nueva migracion agregada:
  - `database/migrations/015_campeonato_cedula_opcional.sql`.
- Documentacion sincronizada para continuidad de trabajo:
  - actualizacion de bitacora,
  - actualizacion de estado de implementacion,
  - actualizacion de README con migracion 015 y estado reciente.

### 2026-02-24
- Inicio de ejecucion del plan mobile (`Fase 1`) en frontend administrativo:
  - refuerzo de layout global para evitar desbordes horizontales en `app-layout`,
  - `container` con padding fluido por viewport para mejorar lectura en movil/tablet,
  - ajuste de `top-bar` y titulo para pantallas pequenas,
  - normalizacion de barras de acciones (incluye `actions`, `action-bar`, `partidos-actions`, `reportes-actions`, etc.) para mejor uso tactil,
  - ajuste responsive dedicado para paginas con `main.container` (caso `equipos.html`).
- Navegacion responsive estabilizada:
  - sidebar responsive unificado para `<=1200px` en CSS,
  - ajuste de breakpoint en `frontend/js/core.js`:
    - paginas con sidebar: comportamiento movil hasta `1200px`,
    - paginas publicas sin sidebar: comportamiento movil hasta `768px`.
- Cierre parcial de responsive por modulo:
  - `tablas`: filtros con botones tactiles full-width en movil, ajuste de anchos minimos y correccion de `overflow-x` en cards de grupo,
  - `finanzas`: formularios en una sola columna para `<=900px`, botones de acciones de registro adaptados a movil, tablas compactadas para anchos pequenos,
  - `partidos`: acciones de generacion/exportacion ajustadas a grilla tactil y tabs apilables en movil,
  - `planilla`: barra superior de acciones responsive, tabla de captura compactada en moviles pequenos y footer de pagos adaptado a una sola columna.
- Documentacion de continuidad sincronizada:
  - `docs/PLAN_MOBILE_LT_C.md` actualizado con estado `implementacion iniciada`,
  - `docs/ESTADO_IMPLEMENTACION_SGD.md` actualizado a `adaptacion mobile web: en progreso`.

### 2026-02-23
- Correccion integral de exportaciones en `Grupos` y `Eliminatorias`:
  - se resolvio bloqueo de `Exportar imagen / PDF / Compartir` cuando existen logos faltantes (imagenes con `404`),
  - se ajusto espera de imagenes para no quedar colgado en estados de carga incompletos.
- Modulo `Grupos` reorganizado con pestanas:
  - nueva pestana `Plantilla de Grupos`,
  - nueva pestana `Clasificacion / Playoff` embebida en la misma pantalla,
  - acceso a playoff en pantalla completa desde la misma pestana.
- Navegacion del sidebar refinada:
  - se removio el item directo `Eliminatorias` del menu lateral para concentrar flujo en `Grupos -> Clasificacion/Playoff`.
- Plantilla de eliminatorias mejorada para publicacion:
  - nuevo armado de llaves con conectores reales (SVG) entre rondas,
  - correcciones de recorte horizontal para exportar el diagrama completo,
  - fondo tipo arte (linea visual similar a grupos/fixture).
- Eliminatorias ahora incluyen bloque de auspiciantes en la zona exportable.
- Diagnostico y ajuste backend para auspiciantes:
  - se detecto entorno con tabla `campeonato_auspiciantes` vacia (aunque habia logos en disco),
  - se implemento fallback en `GET /api/auspiciantes/campeonato/:id` para leer desde `backend/uploads/auspiciantes` cuando no hay registros en BD.
- Pendiente tecnico identificado para siguiente iteracion:
  - normalizar definitivamente auspiciantes por campeonato en BD (evitar depender del fallback por filesystem).

### 2026-02-22
- Categorias/eventos ahora soportan configuracion de metodo de competencia:
  - `metodo_competencia`: `grupos`, `liga`, `eliminatoria`, `mixto`.
  - `eliminatoria_equipos`: objetivo de llave (`4/8/16/32`) o automatico.
  - cambios aplicados en backend (`eventoController`) y frontend (`eventos.html/js`) incluyendo visualizacion en cards y tabla.
- Generacion de partidos conectada al metodo de competencia:
  - `POST /api/partidos/evento/:evento_id/generar-fixture` ahora resuelve `modo=auto` segun categoria.
  - si la categoria es `eliminatoria`, genera llave en `partidos_eliminatoria` en lugar de fixture de grupos.
- Eliminatorias reforzadas (backend + frontend de partidos):
  - siembra automatica de equipos inscritos al evento.
  - soporte de `byes` y propagacion automatica de clasificados.
  - actualizacion de resultados propagando ganador al siguiente cruce.
  - vista de cruces eliminatorios en `partidos.html` (cards/tabla) y accion para registrar resultado por cruce.
- Modulo de pases (fase 1 backend) implementado:
  - nueva tabla `pases_jugadores` (runtime + migracion `014_pases_jugadores.sql`).
  - nuevos endpoints:
    - `GET /api/pases`
    - `GET /api/pases/:id`
    - `POST /api/pases`
    - `PUT /api/pases/:id/estado`
  - al confirmar pase (`pagado/aprobado`) se puede aplicar transferencia de jugador al equipo destino.
- API frontend extendida con `PasesAPI` para integrar UI de pases en la siguiente iteracion.
- UI de pases implementada para pruebas operativas:
  - nueva pagina `frontend/pases.html` + `frontend/js/pases.js`,
  - registro de pase, filtros, estado y acciones de aprobacion/pago/anulacion,
  - actualizacion de estado con opcion de aplicar transferencia.
- UI dedicada de eliminatorias implementada:
  - nueva pagina `frontend/eliminatorias.html` + `frontend/js/eliminatorias.js`,
  - vista de bracket por rondas y carga por categoria,
  - generacion/regeneracion de llave (admin/organizador) y registro de resultados.
  - nuevo flujo de playoff desde grupos:
    - selector de `clasificados por grupo`,
    - metodo `cruces entre grupos` (A vs C, B vs D, etc.),
    - metodo `tabla unica` (ranking global y cruces 1 vs ultimo).
- Navegacion mejorada:
  - sidebar dinamico (`core.js`) ahora inyecta accesos a `Pases` y `Eliminatorias`.
  - desde `partidos.html` se agrego acceso directo a la vista de llave eliminatoria.

- Planes por usuario/organizador consolidados en gestion de usuarios:
  - `usuarios.html/js` ahora permite al administrador crear/editar organizadores con `plan` (`demo/free/base/competencia/premium`) y `estado del plan` (`activo/suspendido`),
  - listado de usuarios muestra columnas de plan y estado de plan,
  - para organizadores con plan pagado se muestra enlace de landing publica.
- Landing publica por organizador implementada:
  - backend: nuevo endpoint `GET /api/auth/organizadores/:id/landing`,
  - disponibilidad restringida a planes pagados (`base`, `competencia`, `premium`) y plan activo,
  - frontend: `index.html` soporta modo landing con query `?organizador=ID` y personaliza textos/contacto/torneos segun el organizador.
- Portal de organizador mejorado:
  - `portal-admin.html` incorpora bloque "Landing publica de organizador",
  - permite abrir/copiar enlace de landing cuando el plan es pagado,
  - muestra aviso de upgrade cuando el organizador esta en plan `demo/free`.
- Correccion tecnica importante en backend:
  - `backend/models/Campeonato.js` corregido en el orden de parametros SQL al crear campeonatos (`creador_usuario_id` quedaba desfasado por costos), evitando inconsistencias en ownership y filtros por organizador/plan.

### 2026-02-21
- Landing page LT&C ajustada con linea visual final:
  - branding consolidado a `LT&C (Loja Torneos & Competencias)` en textos visibles del frontend,
  - cabecera y pie de pagina en paleta LT&C (negro/amarillo/azules),
  - enlaces reales integrados (Facebook, Instagram, WhatsApp y correo oficial).
- Seccion de torneos mejorada:
  - tarjetas de torneos/proximos torneos con imagenes locales,
  - soporte visual para imagenes pequenas con fondo de respaldo `bannerLTC`,
  - ajuste de tarjeta destacada para mayor altura.
- Nueva seccion `Planes y Precios` incorporada en landing.
- Seccion de auspiciantes redisenada:
  - carrusel unico sin cards ni nombres,
  - animacion acelerada para mejor dinamica visual.
- Seccion `Escribenos` actualizada:
  - texto `Sociales` corregido,
  - formulario ajustado en ancho/alto para mejor proporcion visual.
- README actualizado para denominacion oficial del sistema:
  - de `SGD - Sistema de Gestion Deportiva` a `LT&C - Loja Torneos & Competencias`.
- Iconografia del sistema/web incorporada:
  - nuevo favicon LT&C (`frontend/assets/ltc/favicon.svg`),
  - aplicacion global desde `frontend/js/core.js`.
- Ajustes finales UX en portal admin y landing:
  - se elimino leyenda inferior en bloque `Accesos rapidos` del portal administrador,
  - hover del menu principal con linea amarilla,
  - CTA de demo convertido en texto operativo y enlace principal a `registro`.
- Plan mobile web creado:
  - nuevo documento `docs/PLAN_MOBILE_LT_C.md` con roadmap por fases, criterios de aceptacion y checklist de ejecucion.

### 2026-02-20
- Documentacion de continuidad sincronizada para evitar perdida de contexto entre sesiones:
  - `README.md` creado y estructurado para GitHub con:
    - arquitectura,
    - requisitos e instalacion,
    - scripts y endpoints,
    - modulos implementados,
    - mapa de documentacion y pendientes prioritarios.
- Documento de estado actualizado:
  - `docs/ESTADO_IMPLEMENTACION_SGD.md` sincronizado a fecha actual (`2026-02-20`) con matriz real por modulo y prioridades vigentes.
- Bitacora operativa actualizada:
  - este archivo mantiene fecha vigente y nuevo bloque de sesion para continuidad inmediata.
- Se mantiene foco operativo actual:
  - pruebas funcionales del planillaje con datos reales para capturar bugs de campo y cerrar ajustes UX/impresion.
- Ajustes de navegacion global y responsive:
  - sidebar administrativo configurado para iniciar contraido por defecto en todas las paginas con layout lateral,
  - correccion de superposicion `sidebar/overlay` para que el menu sea clickeable en movil y no se cierre al intentar usar enlaces.
- Ajustes UX en modulo financiero (`finanzas.html/js/css`):
  - formularios de filtros y registro compactados por breakpoints para evitar desbordes horizontales,
  - reordenamiento visual priorizando `Estado de Cuenta` y controles de reporte mas claros en pantallas pequenas,
  - tablas de estado/morosidad/movimientos con modo compacto y mejor legibilidad responsive,
  - toggles por seccion para expandir/colapsar `Morosidad` y `Movimientos` sin scroll excesivo.
- Ajustes funcionales en reglas financieras:
  - sincronizacion automatica de cargos de inscripcion por categoria/equipo al consultar estado/morosidad/listados,
  - sincronizacion de planilla -> finanzas por equipo con cargos de arbitraje/multas y abonos registrados en planilla,
  - estado de cuenta con resumen por concepto (inscripcion, arbitraje, multas) ademas de totales,
  - filtro de movimientos para excluir por defecto registros internos de sistema (`origen='sistema'`).
- Configuracion economica extendida:
  - campeonato ahora gestiona costos base (`costo_arbitraje`, `costo_tarjeta_amarilla`, `costo_tarjeta_roja`, `costo_carnet`),
  - categoria/evento incorpora `costo_inscripcion` para cuenta corriente por equipo.
- Compatibilidades backend reforzadas:
  - soporte de columnas de timestamp alternativas (`updated_at` / `update_at`) en actualizacion de eventos y partidos.
- Nuevos reportes operativos en modulo financiero:
  - al registrar `Movimiento` se genera recibo de pago imprimible (con opcion de reimpresion),
  - se agregaron reportes imprimibles para:
    - estado de cuenta del equipo (incluye resumen + movimientos),
    - morosidad por equipo,
    - movimientos financieros filtrados en pantalla.
- Mejora funcional en carnets de jugadores:
  - selector de fuente de foto para anverso (`automatico`, `solo carnet`, `solo cedula`),
  - se incorpora `categoria` visible en el carnet,
  - se incorpora codigo QR que direcciona al portal del torneo/categoria.
- Portal publico mejorado para QR:
  - `index.html` ahora soporta abrir campeonato/categoria por query params (`?campeonato=ID&evento=ID`).
- Ajustes solicitados en modulo de carnets y tablas:
  - carnet muestra nombre real de categoria (no `Evento X`) usando contexto activo de evento,
  - exportacion/impresion de carnets ajustada a tamano fisico por tarjeta (`8.5cm x 5.5cm`) con layout A4,
  - modulo `Tablas` reorganizado a 2 columnas para reducir scroll horizontal en posiciones.
- Fair Play ampliado por modalidad:
  - para futbol 7 / futbol 5 / sala se incorpora conteo y penalizacion por faltas,
  - para futbol 11 e indor se mantiene comportamiento anterior (sin faltas en calculo).
- Finanzas (estado de cuenta) simplificado:
  - resumen en pantalla y reporte impreso ahora priorizan valores operativos por concepto:
    - inscripcion (cargo/pago/saldo),
    - arbitraje (pago/saldo),
    - tarjetas amarillas (pago/saldo),
    - tarjetas rojas (pago/saldo),
  - se elimina visualmente del resumen el bloque confuso de `saldo total` y `cargos pendientes`.
- Campeonatos/Eventos/Equipos:
  - fechas de campeonato normalizadas para evitar textos con sufijo `T...` y conservar fechas al editar,
  - en crear evento las fechas se rellenan automaticamente desde el campeonato seleccionado,
  - selector de colores en equipos simplificado a controles tipo color (alineado al estilo de campeonatos),
  - bloque de costos del formulario de campeonato ajustado para mejor alineacion visual.
- Ajuste terminologico UX:
  - se estandariza el texto visible a `Categoria/Categorias` en pantallas clave para evitar confusion con el termino tecnico `evento`.
- Modulo de auspiciantes implementado:
  - nueva migracion `database/migrations/008_auspiciantes.sql`,
  - nueva API `api/auspiciantes` (listar por campeonato, crear, actualizar y eliminar con logo),
  - nueva pantalla administrativa `frontend/auspiciantes.html` + `frontend/js/auspiciantes.js`.
- Reporteria con membrete + pie de auspiciantes:
  - reportes financieros (recibo, estado de cuenta, morosidad, movimientos) ahora generan encabezado con membrete del campeonato/organizador,
  - recibo de pago ajustado segun observacion operativa (titulo centrado, sin subtitulo redundante, mas espacio para firmas),
  - pie de reportes financieros incorpora logos de auspiciantes activos,
  - plantillas de `Grupos` y `Fixture` ahora muestran logos de auspiciantes en pie para impresion/exportacion.

### 2026-02-19
- Correccion de bug critico en planillaje de pagos:
  - los campos `Tarjetas amarillas (pago)` y `Tarjetas rojas (pago)` ahora son independientes por equipo (local/visitante),
  - se elimino el comportamiento espejo que copiaba automaticamente el valor de un equipo al otro.
- Planillaje financiero por equipo extendido:
  - frontend usa nuevos campos separados:
    - `pago_ta_local`, `pago_ta_visitante`,
    - `pago_tr_local`, `pago_tr_visitante`,
  - backend persiste estos campos en `partido_planillas` manteniendo compatibilidad con columnas globales previas (`pago_ta`, `pago_tr`).
- Confirmacion funcional de criterio operativo:
  - los totales de tarjetas ubicados bajo nomina (`Tarjetas amarillas/rojas`) se mantienen como conteo deportivo/Fair Play,
  - pagos de tarjetas quedan exclusivamente en la seccion `Pagos y Observaciones`.
- Ajustes de reporte (vista y PDF) alineados a operacion:
  - bloque de pagos muestra importes por equipo (inscripcion, arbitraje, TA pago, TR pago),
  - bajo firma se mantienen dos filas por equipo (Tarjetas amarillas / Tarjetas rojas),
  - se elimino la linea compacta `TA | TR` para evitar ambiguedad.
- Planillaje migrado a flujo de captura directa estilo formulario oficial:
  - se elimino la dependencia operativa de seleccionar goleador/tarjeta fila por fila,
  - ahora el ingreso principal se hace por jugador (columnas `G`, `TA`, `TR`) para local y visitante.
- Marcador automatico integrado al formulario:
  - `Goles Local` y `Goles Visitante` se calculan por suma de goles ingresados en la tabla de jugadores,
  - los resultados se envian al backend dentro del mismo payload de guardado.
- Formulario de planilla redisenado con estructura tipo planilla impresa (segun referencia):
  - cabecera con organizador, tipo de futbol, logos y metadatos del partido,
  - bloque visual de faltas para futbol 7/5/sala,
  - seccion de captura por jugador en dos tablas (local/visitante),
  - footer por equipo con resumen de tarjetas, director tecnico y pagos.
- Exportacion e impresion:
  - nuevo boton `Exportar PDF` que imprime directamente el formulario oficial,
  - `Imprimir Vista Previa` mantiene impresion de la vista previa alternativa,
  - estilos de impresion separados por modo (`print-planilla-form` / `print-planilla-preview`).
- Vista previa oficial mejorada y mantenida:
  - pestañas de vista previa: `Formato PDF` y `Resumen Anterior`,
  - la vista anterior se mantiene como respaldo para comparacion y continuidad.
- Backend ajustado para soportar cabecera oficial de planilla:
  - `backend/models/Partido.js` ahora incluye en `obtenerPlanilla`:
    - `max_jugador`,
    - `campeonato_organizador`,
    - `campeonato_logo_url`.
- Se mantiene exportacion XLSX oficial ya implementada previamente, alineada con `templates/PlanillaJuego.xlsx`.

### 2026-02-18
- Modulo financiero base implementado (backend + frontend):
  - nueva migracion `database/migrations/006_finanzas_cuenta_corriente.sql`,
  - nueva API `api/finanzas` con endpoints:
    - `GET /api/finanzas/movimientos`
    - `POST /api/finanzas/movimientos`
    - `GET /api/finanzas/equipo/:equipo_id/estado-cuenta`
    - `GET /api/finanzas/morosidad`
  - nuevo modelo/controlador/rutas en backend:
    - `backend/models/Finanza.js`
    - `backend/controllers/finanzaController.js`
    - `backend/routes/finanzaRoutes.js`
  - nueva pantalla administrativa `frontend/finanzas.html` + `frontend/js/finanzas.js` para:
    - registrar cargos/abonos,
    - consultar movimientos,
    - revisar morosidad por equipo,
    - ver estado de cuenta detallado.
- Navegacion global del admin actualizada para incluir `Finanzas` en sidebar mediante `frontend/js/core.js`.
- Importacion masiva de jugadores habilitada de extremo a extremo:
  - backend: endpoint `POST /api/jugadores/importar-masivo`,
  - frontend: botones `Descargar Plantilla` e `Importar Archivo` en `jugadores.html`,
  - parser en `frontend/js/jugadores.js` para `.xlsx/.xls/.csv` con normalizacion de encabezados comunes.
- Plantilla oficial de carga de jugadores disponible para equipos:
  - archivo `.xlsx` con hoja `Datos` (columnas esperadas) y hoja `Instrucciones`,
  - validaciones previas en cliente (nombre, apellido, cedidentidad) antes de enviar.
- Resumen de importacion implementado:
  - total de filas leidas/enviadas/creadas/errores,
  - vista rapida de errores detectados por backend.
- Exportacion e impresion de nomina de jugadores:
  - nueva plantilla visual de nomina por equipo en `jugadores.html`,
  - acciones `Imprimir Nomina` y `Exportar Nomina PDF`.
- Soporte documental en importacion de jugadores:
  - plantilla de carga agrega `foto_cedula_url` y `foto_carnet_url`,
  - backend valida documentos requeridos del campeonato tambien en importacion masiva.
- Carnets de jugadores (base funcional):
  - nuevo ajuste de campeonato `genera_carnets` (crear/editar),
  - vista de carnets por equipo en modulo jugadores,
  - exportacion PDF e impresion de carnets desde plantilla predefinida.
- Ajuste UX en `jugadores.html`:
  - barra principal simplificada (accion primaria `Nuevo Jugador`),
  - nuevo bloque ordenado `Reportes e Importaciones`,
  - acciones habilitadas solo con contexto seleccionado (campeonato/categoria/equipo).
- Navegacion por pestanas en modulo de jugadores:
  - nueva pestana `Jugadores` y nueva pestana `Reportes e Importaciones`,
  - evita scroll largo para llegar a reportes/importaciones.
- Mejoras de visualizacion en listados principales:
  - `campeonatos`, `equipos` y `jugadores` ahora tienen selector de vista `Tarjetas / Tabla`,
  - preferencia guardada por modulo en `localStorage`,
  - en vista tabla se mantienen acciones clave (editar, eliminar, navegar) en columna final.
- Vista dual extendida a otros modulos:
  - `eventos` y `partidos` tambien tienen selector `Tarjetas / Tabla`,
  - filtros, acciones y flujo de fixture se mantienen sin cambios funcionales.
- Checkpoint Git de interfaz:
  - consolidado el cambio de visualizacion dual en modulos administrativos para evitar scroll extenso,
  - se mantiene preferencia de vista por modulo para continuidad de uso.
- Importacion documental avanzada:
  - nuevo flujo `ZIP + mapeo por cédula` para cargar foto de cédula/carnet en lote,
  - deteccion de tipo de documento por nombre de archivo (`cedula` / `carnet`) y asignacion automatica a jugador.

### 2026-02-17
- Se alinearon endpoints y compatibilidades de `partidos`:
  - Generacion de fixture por evento (grupos y todos contra todos).
  - Rutas de compatibilidad para frontend anterior.
  - Registro de resultados y resultados con shootouts.
- Se agregaron metodos faltantes en `backend/models/Partido.js` para evitar errores de ejecucion:
  - fixture por evento (modo auto/grupos/todos),
  - consultas por campeonato/jornada,
  - estadisticas por equipo,
  - resultado con shootouts.
- Se agrego compatibilidad por campeonato en `grupos`:
  - rutas y controladores para `GET /grupos/campeonato/:id` y `/completo`.
- Se corrigio UX visual global en admin:
  - espaciados y distribucion de contenedores/botones,
  - consistencia de tarjetas entre `admin`, `campeonatos`, `eventos`,
  - mejora de layout responsivo en dashboard y listados.
- Se ajusto layout de equipos:
  - 1 columna movil (<=768px),
  - 2 columnas base,
  - 3 columnas en pantallas grandes,
  - 4 columnas en pantallas muy grandes.
- Se separo codigo inline del portal:
  - estilos a `frontend/css/portal.css`,
  - scripts a `frontend/js/portal.js`.
- Se corrigio carga de logos en portal y campeonatos:
  - normalizacion de `logo_url` para rutas relativas/absolutas,
  - eliminacion del error 404 por resolucion incorrecta de URL.
- Se mejoro seguridad/configuracion DB:
  - `backend/config/database.js` ahora usa variables de entorno.
  - se agrego `backend/.env.example`.
- Se corrigio `database/esquema.sql`:
  - eliminada definicion duplicada de tabla `partidos`,
  - limpiado error estructural asociado.
- Se corrigio modulo de sorteo (flujo por categoria/evento):
  - se alineo `sorteo.html` con `sorteo.js` (IDs y funciones),
  - se agrego selector de categoria (evento),
  - se removio script inline duplicado que generaba conflictos,
  - se implemento flujo funcional de sorteo:
    - creacion de grupos por evento,
    - asignacion automatica,
    - asignacion con cabezas de serie,
    - modo manual con ruleta y asignacion de equipo seleccionado,
  - se corrigio el error `Cannot set properties of null (innerHTML)` y `iniciarSorteo is not defined`.
- Se mejoro modulo de equipos:
  - numeracion visual de equipos en listado,
  - resumen con cantidad de equipos inscritos por categoria,
  - boton `Ir a Sorteo` que abre `sorteo.html` con campeonato y categoria preseleccionados.
- Se reforzo backend de grupos:
  - validacion de pertenencia del equipo al evento mediante tabla pivote `evento_equipos` (en lugar de `equipos.evento_id`).
- Se mejoro la experiencia del sorteo manual:
  - ruleta con etiquetas por equipo, mejor contraste de texto y seleccion final sincronizada con la flecha,
  - mejor distribucion de botones de accion de ruleta en desktop y movil.
- Se corrigio flujo `Sorteo -> Ver grupos`:
  - `gruposgen.js` ahora soporta contexto por `evento` desde URL,
  - carga grupos por endpoint de evento cuando corresponde,
  - exportaciones (PNG/PDF/compartir) nombran archivo por evento cuando aplica,
  - cabecera del poster muestra tambien la categoria en contexto.
- Ajustes UX adicionales en sorteo:
  - nombres en ruleta orientados a lo largo del segmento para mejor lectura,
  - boton `Ver grupos` movido junto a controles de configuracion y visible solo cuando el sorteo ya finalizo.
- Correccion backend para plantilla de grupos por campeonato:
  - consultas por campeonato ahora recuperan grupos mediante `eventos.campeonato_id` (antes consultaban `grupos.campeonato_id`, que quedaba vacio en el flujo actual por evento).
- Ajustes responsive de plantilla de grupos (`grupos.css`):
  - poster adaptativo con tipografia y espaciado con `clamp`,
  - mejor centrado del bloque de titulo en pantallas grandes,
  - columnas y nombres de equipos menos sobredimensionados en pantallas amplias.
- Modulo de partidos mejorado:
  - corregido error `generarFixtureEvento is not defined` en `partidos.html/js`,
  - agregado filtro por jornada en UI,
  - agregada plantilla visual de fixture (agrupada por jornada y grupo),
  - agregado exportar fixture en PNG y PDF.
- Continuacion visual y funcional de fixture:
  - la plantilla de fixture ahora usa estilo tipo poster igual al modulo de grupos (logo organizador, encabezado completo y datos de categoria),
  - integracion de `partidos.html` con `grupos.css` para mantener lenguaje visual consistente,
  - cabecera de fixture alimentada por evento + campeonato (nombre, organizador, tipo, fechas y logo),
  - distribucion de columnas de jornada adaptable por tamano de pantalla,
  - filtros de visualizacion por grupo, jornada y fecha.
- Mejora de navegacion en plantilla de fixture:
  - agregadas pestanas de vista: `Todos`, `Por Grupo`, `Por Jornada`.
- Ajuste de formato de fecha en partidos/fixture:
  - cuando el backend retorna fecha ISO (`2026-04-11T05:00:00.000Z`), se muestra solo la parte de fecha (`2026-04-11`) sin el bloque de hora/UTC.
- Reorganizacion de pantalla de partidos:
  - la vista principal mantiene cards de partidos,
  - la plantilla poster de fixture se movio a un bloque acordeon para no saturar la pagina,
  - se agrego boton para abrir la plantilla en pantalla dedicada `fixtureplantilla.html` con filtros actuales.
- Ajuste UX solicitado en `partidos.html`:
  - reemplazo del acordeon por pestanas principales: `Filtrar Partidos` y `Plantilla Fixture`,
  - `Buscar` queda visualmente separado del bloque `Generacion de Fixture`,
  - checkboxes de configuracion alineados correctamente con sus labels.
- Correccion adicional de alineacion en `Generacion de Fixture`:
  - se encapsularon opciones en `fixture-generation-options` para orden vertical estable,
  - se forzo estilo de checkbox (`width:auto`, sin padding/border globales) para evitar desalineado por reglas generales de `input`,
  - se agrego accion rapida `Volver a Cards` desde la pestana de plantilla para editar partidos sin friccion.
- Correccion backend en edicion de partidos:
  - `backend/models/Partido.js` ahora detecta automaticamente la columna de timestamp de actualizacion en la tabla `partidos` (`updated_at` o `update_at`),
  - las operaciones `actualizar`, `actualizarResultado` y `actualizarResultadoConShootouts` ya no fallan por diferencia de nombre de columna entre entornos.
- Ajuste UX en tarjetas de equipos (`equipos.html`):
  - encabezado de card reestructurado (indice + logo + titulo) para evitar cortes raros de nombre,
  - titulo con salto de linea balanceado y alineacion consistente en nombres largos,
  - eliminado estilo inline del logo para que el tamano dependa de CSS unificado.
- Modulo `Tablas/Estadisticas` habilitado por evento:
  - backend `tablaController` reescrito para esquema actual por `evento` (sin dependencia de `grupos.campeonato_id`),
  - nuevos endpoints:
    - `GET /api/tablas/evento/:evento_id/posiciones`
    - `GET /api/tablas/evento/:evento_id/goleadores`
    - `GET /api/tablas/evento/:evento_id/tarjetas`
    - `GET /api/tablas/evento/:evento_id/fair-play`
  - compatibilidad mantenida para portal/legacy:
    - `GET /api/tablas/grupo/:grupo_id`
    - `GET /api/tablas/campeonato/:campeonato_id`
- Frontend `tablas.html` + `frontend/js/tablas.js` implementado:
  - filtro por evento y busqueda,
  - pestanas de vista: Posiciones, Goleadores, Tarjetas y Fair Play,
  - render de tablas en UI con estados vacios y mensajes utiles cuando no hay datos.
- Estilos globales agregados en `frontend/css/style.css` para `page-tablas`:
  - contenedor con `max-width` estable en desktop,
  - tablas responsive con scroll horizontal controlado en movil/tablet.
- Flujo equipos -> jugadores mejorado:
  - agregado boton `Jugadores` en cada card de equipo para navegar con contexto de campeonato/categoria.
- Gestion documental de jugadores por campeonato:
  - `campeonatos.html/js` ahora guarda y edita:
    - `requiere_foto_cedula`
    - `requiere_foto_carnet`
  - `jugadores.html/js` ahora permite cargar:
    - foto de cedula,
    - foto carnet,
    - y valida requisitos segun configuracion del campeonato.
- Planilla de juego por partido implementada:
  - nueva pantalla `frontend/planilla.html`,
  - nuevo script `frontend/js/planilla.js`,
  - integrada desde `partidos` con boton `Planilla` por card.
  - permite registrar:
    - resultado/estado,
    - goleadores,
    - tarjetas,
    - pagos (arbitraje/local/visitante),
    - observaciones.
  - exportacion de planilla en `.xlsx`.
- Backend de planilla consolidado para UI:
  - `Partido.obtenerPlanilla` ahora devuelve:
    - requisitos documentales del campeonato,
    - planteles con URLs de foto de cedula/carnet.
- Navegacion y flujo directo de jugadores mejorado:
  - agregado item global `Jugadores` en el menu lateral de modulos administrativos,
  - `jugadores.html` ahora soporta modo directo (sin venir desde equipos):
    - selector de campeonato,
    - selector de categoria/evento,
    - selector de equipo,
    - carga de jugadores por seleccion.
- Exportacion XLSX de planilla alineada al formato oficial:
  - `frontend/js/planilla.js` ahora exporta sobre `frontend/templates/PlanillaJuego.xlsx` (sin hojas genericas nuevas),
  - se completa automaticamente la hoja correcta segun `tipo_futbol` (`FUTBOL 11` o `FUTBOL 7/5/SALA`),
  - se rellenan datos de partido, equipos, resultado, planteles, goles, tarjetas, pagos y observaciones en las celdas del template,
  - se llena tambien `LISTAJUGADORES` con el plantel local.
- Vista previa en pantalla de planilla oficial:
  - `frontend/planilla.html` incorpora boton `Vista Previa` y panel dedicado,
  - `frontend/js/planilla.js` renderiza una maqueta visual tipo formato de impresion (encabezado, score, planteles, goles/tarjetas, pagos, observaciones),
  - la vista previa se actualiza en vivo al cambiar cualquier campo del formulario o filas de eventos.
- Planillaje directo y navegacion independiente:
  - `planilla.html` ahora permite acceso directo sin depender de tarjetas:
    - selector de evento,
    - selector de jornada,
    - selector de partido,
    - carga de planilla con boton dedicado.
  - se agrego item de menu lateral `Planillaje` en modulos admin para entrada directa.
- Impresion directa desde planilla:
  - nuevo boton `Imprimir` en acciones principales y en la barra de vista previa,
  - estilos `@media print` para imprimir el formato visual de la planilla (sin sidebar ni formularios).
- UX de modales mejorada (centrado global):
  - correccion en `frontend/js/core.js` para abrir modales con `display:flex` (antes `block`, causando apertura en esquina),
  - bloqueo de scroll del body mientras hay modal abierto (`body.modal-open`),
  - ajuste de `frontend/css/style.css` para mayor ancho util y mejor espaciado en modales con `h3 + form`.
  - los modales ya no se cierran al hacer click fuera; cierre solo por accion explicita (`X`, boton cancelar o `cerrarModal(...)`).
- Ajustes backend para soporte de exportacion oficial:
  - `backend/models/Partido.js` incluye `tipo_futbol`, `campeonato_nombre`, `evento_nombre` y director tecnico local/visitante en `obtenerPlanilla`,
  - `obtenerPlanilla` ahora retorna `cedidentidad` en planteles para alimentar `LISTAJUGADORES`.
- Documento de control de alcance actualizado:
  - nuevo archivo `docs/ESTADO_IMPLEMENTACION_SGD.md` con matriz:
    - modulo vs estado real (hecho/parcial/pendiente),
    - pendientes prioritarios (financiero, roles, eliminatorias, auditoria).

## En Curso
- Pruebas reales de operacion en planillaje y finanzas para cerrar ultimos bugs de consistencia contable.
- Pulido visual final de planillaje oficial (alineaciones finas, espacios y ajustes de impresion en distintos tamanos de papel).
- Ajustes UX finales en finanzas para pantallas pequenas (<= 1366 px) sin perder densidad de informacion.

## Pendientes Prioritarios
- Ejecutar pruebas end-to-end con datos reales (validar que todo el flujo quede estable).
- Validar en operacion real:
  - eliminacion manual por causal,
  - clasificacion manual con sugerencia,
  - generacion de playoff con equipos sustituidos manualmente.
- Consolidar autenticacion y roles (RBAC) minimo.
- Completar alta/edicion de usuario organizador con campos de perfil:
  - alinear `usuarios.html` con los datos base usados por `Mi Landing`,
  - nombre de la organizacion,
  - logo de la organizacion,
  - contacto minimo.
- Habilitar en el portal del organizador la gestion de usuarios internos:
  - crear usuarios con rol dirigente,
  - crear usuarios con rol tecnico.
- En formulario de registro desde cards de planes pagados, agregar:
  - nombre de la organizacion (obligatorio),
  - logo (opcional),
  - lema (opcional).
- Implementar flujo de cobro/pasarela para planes pagados:
  - seleccionar plan,
  - registrar organizador con datos de organizacion,
  - continuar a formulario/pantalla de cobro y confirmacion de pago.
- Revisar y ordenar archivos legacy/antiguos para reducir deuda tecnica.
- Continuar modulo financiero: sanciones/suspensiones por reglas deportivas, bloqueos por morosidad y reportes ejecutivos.
- Ajustar detalles de UX del nuevo formulario de planilla segun retroalimentacion de operacion en campo.
- Completar visibilidad de disciplina fuera de la planilla:
  - ya visible en `jugadores.html`,
  - ya disponible reporte/listado de sanciones por categoria/equipo/jugador,
  - pendiente extender la disciplina a otros reportes operativos.
- Completar carga inicial del disco persistente de `uploads` en Render con el contenido historico local antes de validar logos/fotos/documentos en produccion.
- Ejecutar migracion `031_usuarios_cambio_password_obligatorio.sql` en todos los entornos antes de probar el nuevo flujo de cambio obligatorio de contraseña.
- Validar en produccion Render:
  - carga real de logos/fotos/documentos desde el disco persistente,
  - reimpresion de carnets usando jugadores con foto existente.
- Validar visualmente el nuevo `fondo de carné` en:
  - vista previa,
  - impresion,
  - exportacion PDF,
  para confirmar opacidad/mezcla adecuados con logo y colores.
- Verificar en operacion real de campo la captura directa de foto desde celular para:
  - foto de cedula,
  - foto de jugador/foto carnet.
- Validar visualmente portal publico en produccion/local:
  - listado general sin campeonatos administrativos,
  - inclusion correcta de torneos `borrador` / `inscripcion` del organizador,
  - detalle por campeonato con tabs de categorias,
  - subtabs deportivas correctas por categoria,
  - tablas de posiciones en `2 columnas` desktop / `1 columna` movil.
- Reorientar plan mobile a aplicacion instalable para tiendas:
  - app Android (Play Store),
  - app iOS (App Store).

## Actualizacion 2026-03-10 (Portal publico compartible)
- Se enriquecio el listado publico de campeonatos con `categorias_resumen` para mostrar en cada card:
  - nombre de categoria,
  - cantidad de equipos por categoria.
- Se habilito vista publica compartible por campeonato en `portal.html?campeonato=<id>`:
  - header completo,
  - detalle del campeonato,
  - tabs por categoria,
  - subtabs deportivas (`Tabla de posiciones`, `Goleadores`, `Fair Play`, `Tarjetas amarillas`, `Tarjetas rojas`, `Playoff`),
  - seccion de auspiciantes,
  - footer institucional.
- Se agrego endpoint publico para auspiciantes del campeonato:
  - `GET /api/public/campeonatos/:campeonato_id/auspiciantes`
- La landing publica del organizador ahora tambien entrega `categorias_resumen`, manteniendo consistencia entre:
  - `index.html?organizador=<id>`
  - `portal.html?campeonato=<id>&organizador=<id>`

## En Curso
- Validacion visual del detalle compartible del portal en produccion (`portal.html?campeonato=<id>`), incluyendo auspiciantes, tabs y subtabs por categoria.
- Continuidad del hardening de despliegue Render:
  - carga historica de `uploads`,
  - verificacion real de logos, fotos y documentos.
- Validar en operacion real la nueva `plantilla balanceada 8vos` y la opcion `tercer y cuarto puesto` con datos de campeonato activo.

## Actualizacion 2026-03-12 (Tabla acumulada, foto carné y planilla del jugador)
- Se incorporo el tipo visible de competencia `tabla acumulada` para categorias/eventos:
  - pensado para grupos + clasificacion global por rendimiento,
  - soportado en `eventos`, `tablas`, `eliminatorias` y payloads del portal publico,
  - reutilizando la logica ya existente de `tabla_unica` sin tocar `backend/models/Eliminatoria.js`.
- Se agrego migracion formal:
  - `database/migrations/037_eventos_clasificacion_tabla_acumulada.sql`
- Se aplico/verifico en BD local:
  - columna `eventos.clasificacion_tabla_acumulada`.
- Se mejoro el ajuste de foto para carné en `jugadores.html`:
  - zoom `+/-`,
  - control direccional arriba/abajo/izquierda/derecha,
  - persistencia del zoom del jugador,
  - reubicacion del bloque informativo de `foto carné cargada` debajo del panel de ajuste.
- Se agrego migracion formal:
  - `database/migrations/038_jugadores_foto_carnet_zoom.sql`
- Se aplico/verifico en BD local:
  - columna `jugadores.foto_carnet_zoom`.
- Se implemento `Planilla del jugador` dentro de reportes:
  - selector individual,
  - vista previa,
  - impresion,
  - exportacion PDF,
  - acceso directo desde cards/listado del jugador.
- Se ajustaron cards:
  - equipos con nombre a la izquierda y logo a la derecha,
  - jugadores con layout mas ordenado en metadata/documentos.
- Se redujo visualmente la marca `ELIMINADO` en tablas internas y portal publico.
- Se agrego `Polifuncional` como posicion disponible para:
  - formulario de jugadores,
  - planilla/manual de jugador.
- Render / produccion:
  - las migraciones `037` y `038` quedaron versionadas en repo,
  - el backend ya incorpora endurecimiento de esquema para crear esas columnas al usar modulos de `eventos` / `jugadores` tras el redeploy,
  - pendiente ejecutar migracion formal directa sobre la BD de Render cuando se disponga de la cadena/console operativa del servicio.

## Checklist de Pruebas Siguiente Sesion
1. Crear/seleccionar campeonato y evento.
2. Registrar y asignar equipos al evento.
3. Generar grupos y validar distribucion.
4. Generar fixture por evento.
5. Registrar resultados.
6. Revisar tablas por grupo y portal publico.
7. Validar eliminatorias (si aplica al evento probado).

## Regla de Mantenimiento de Esta Bitacora
- Al cerrar cada sesion:
  - actualizar fecha de "Ultima actualizacion",
  - agregar bloque con cambios del dia,
  - marcar estado en "En Curso" y "Pendientes".

## 2026-03-15 - Ajuste de tabla manual derivada
- Se corrigio la edicion manual de `tablas.html` para que:
  - `PTS` ya no quede congelado ni dependa de un valor escrito manualmente,
  - `PJ` se derive automaticamente de `PG + PE + PP`,
  - `DG` siga derivandose de `GF - GC`,
  - la posicion se reordene en vivo con esos valores recalculados.
- El backend (`backend/controllers/tablaController.js`) ahora recalcula nuevamente `PTS` y `PJ` al guardar, para mantener consistencia entre local y Render aunque el navegador envie datos viejos.
- El frontend (`frontend/js/tablas.js`) marca `PJ` y `PTS` como campos derivados para evitar inconsistencias durante la correccion manual de la tabla.

## 2026-03-15 - Cierre de estabilidad tablas publicas / portal
- Se corrigio la regresion que rompia `tablas` y `playoff` publicos con el error:
  - `ReferenceError: sistema is not defined`
- La funcion `generarTablasEventoInterna()` del backend ya devuelve nuevamente:
  - tablas publicas por evento,
  - clasificacion usada por eliminatorias,
  - resumen de clasificacion manual para playoff.
- Se verifico localmente que vuelven a responder correctamente:
  - `GET /api/public/eventos/:id/tablas`
  - `GET /api/public/eventos/:id/eliminatorias`
- Render quedo alineado con el fix publicado en `origin/main`.

## Pendiente inmediato siguiente sesion
- Validar con un campeonato real de 24 clasificados la nueva plantilla `Mejores perdedores (24 -> 12vos -> 8vos)`.
- Confirmar con operacion real si el criterio de emparejamiento en `8vos` queda aprobado asi:
  - `W12-1 vs MP4`
  - `W12-2 vs MP3`
  - `W12-3 vs MP2`
  - `W12-4 vs MP1`
  - resto de cruces entre ganadores de `12vos`.
- Si el cliente pide un formato adicional para `20`, `12` u otros cupos no potencia de 2, ampliar esta misma plantilla a un modo mas general.

### 2026-03-17 (sesión 4)
- Fixture / gestión avanzada — corrección de regresión y nuevas herramientas:

  **Fix regenerarFixturePreservandoJugados (`backend/models/Partido.js`):**
  - El bug eliminaba partidos `programado` (con fecha asignada), destruyendo jornadas ya calendarizadas al regenerar tras ingresar un equipo nuevo.
  - Corrección: el DELETE ahora elimina SOLO partidos con `estado IS NULL OR estado = 'pendiente'`.
  - Se preservan: `programado`, `finalizado`, `no_presentaron_ambos`, `suspendido`, `aplazado`, `en_curso`.
  - `maxJornadaJugada` ahora toma el máximo sobre TODOS los estados preservados (no solo finalizado).
  - Las queries de `pairsJugados` (pares ya existentes) también incluyen los estados preservados para no regenerar enfrentamientos que ya existen en cualquier estado activo.
  - Efecto: si un equipo nuevo ingresa con Jornada 1 ya programada, esa jornada queda intacta y el nuevo equipo descansa automáticamente.

  **Estado manual de partidos (`backend/controllers/partidoController.js` + `frontend/js/partidos.js`):**
  - Backend: `actualizarPartido` acepta campo `estado` explícito (pendiente/programado/suspendido/aplazado/en_curso).
  - Si se envía `estado` explícito tiene precedencia sobre la auto-transición por fecha.
  - Frontend: formulario "Editar partido" incluye selector de Estado con 5 opciones.

  **Badge de estado en card de partido (`frontend/js/partidos.js`):**
  - Nueva función `renderEstadoPartidoBadge(estado)`.
  - Cada card muestra el estado actual con badge de color: azul=programado, gris=pendiente, verde=finalizado, rojo=suspendido, naranja=aplazado, amarillo=en curso.

  **Equipo que descansa (bye) por jornada:**
  - Nueva función `calcularByesPorJornada(todosPartidos)` en `partidos.js`: compara equipos del universo del evento contra los que aparecen en cada jornada; detecta automáticamente el equipo que no juega.
  - Vista de cards en `partidos.html`: agrupa por jornada con encabezado y muestra `"Descansa: [equipo]"` en morado cuando aplica.
  - Fixture exportable (vista jornada y vista todos): muestra `"☾ DESCANSA: [equipo]"` al pie de cada jornada.
  - Portal público (`frontend/js/portal.js`): nueva función `calcularByesPortal(todosPartidos)`; cada tarjeta de jornada muestra `"🌙 Descansa: [equipo]"` al pie, con estilos en `portal.css`.
  - Estilos nuevos en `style.css`: `.badge-estado-partido`, `.fixture-jornada-bloque`, `.fixture-jornada-titulo`, `.fixture-bye-notice`, `.fixture-bye-linea`.

  **Crear partido manual (`frontend/partidos.html` + `frontend/js/partidos.js`):**
  - Nuevo botón "Crear Partido Manual" en la sección de Generación de Fixture.
  - Modal con: dropdown Equipo Local, dropdown Equipo Visitante (cargados de `/eventos/:id/equipos`), Jornada, Fecha, Hora, Cancha.
  - Validación: no permite mismo equipo en local y visitante.
  - POST a `POST /partidos/` con campeonato_id, evento_id y estado automático.
  - Útil para construir jornadas parciales antes de regenerar, o para partidos especiales fuera del round-robin.

  **Edición de equipos en partido (solo Administrador):**
  - `editarPartido()` detecta `window.Auth.getUser().rol`.
  - Si es `administrador`: carga equipos del evento y muestra dropdowns de Equipo Local/Visitante en el formulario "Editar".
  - Backend `actualizarPartido`: acepta `equipo_local_id` y `equipo_visitante_id` solo si `req.user.rol === 'administrador'`.

  **Commits de la sesión:**
  - `5bec42c` feat(fixture): preservar jornadas programadas al regenerar, estados de partido y bye por jornada
  - `20d6bb7` feat(portal): mostrar equipo que descansa (bye) por jornada en portal público
  - `48b08c1` feat(fixture): crear partido manual y edición de equipos por administrador

## Pendiente inmediato sesion 5 (2026-03-18)
- Plantillas de exportación (sección 14 del ESTADO_IMPLEMENTACION):
  - **A)** Carné individual: dropdown "Jugador:" en toolbar de carnés → `jugadores.html`
  - **B)** Fondo personalizado en export de fixture → `fixtureplantilla.html`
  - **C)** Plantilla exportable de jornada (`jornadadplantilla.html`) — logo equipos, fecha/hora/cancha, para compartir en redes
  - **D)** Fondo personalizado en export de grupos → `gruposgen.js`
- Validar en operación real:
  - bye/descansa en portal público con campeonato activo real
  - botón "Crear Partido Manual" con el fixture del campeonato de 11 equipos
  - edición de equipos en partido (botón Editar como administrador)
  - regenerar fixture tras crear J1 manualmente → verifica que Academia Pedro Larrea descanse en J1
- Validar plantilla `Mejores perdedores (24 -> 12vos -> 8vos)` con campeonato real de 24 clasificados.

## 2026-03-20 - Portal playoff y plantilla publicable unificada
- Se amplió la carga pública de eliminatorias para que cada cruce exponga también su programación enlazada desde `partidos`:
  - `estado`
  - `fecha_partido`
  - `hora_partido`
  - `cancha`
  - `jornada`
  - `numero_campeonato`
- La pestaña pública `Playoff` del portal ya muestra esa metadata por encuentro cuando el cruce tiene partido operativo asociado.
- El módulo interno de `eliminatorias.html` se reorganizó en pestañas independientes:
  - `Configuración de llave`
  - `Estado competitivo`
  - `Clasificación manual`
  - `Playoff / Llave`
- La programación manual y la auto-programación de playoff ahora se trabajan en overlays reales tipo modal:
  - fondo oscurecido
  - cierre por `Esc`
  - cierre por click fuera
  - foco automático al abrir
- Se agregó el botón `Plantilla para publicar` junto a `Auto-programar fechas` para abrir/cerrar la vista exportable del playoff sin perder el contexto de la llave.
- La vista interna de `Playoff / Llave` ahora presenta:
  - `Final` en la columna central
  - `Tercer y cuarto` debajo de `Final`
  - tarjetas de tercer puesto más compactas
  - rounds en horizontal, no apilados verticalmente
- La plantilla exportable/publicable del playoff para el caso principal `8vos -> 4tos -> semifinal -> final` se rediseñó para seguir el mismo lenguaje visual del borrador:
  - layout horizontal de 7 columnas
  - fondo claro con grilla
  - tarjetas azules compactas
  - local arriba / `vs` / visitante abajo
  - logos de equipos dentro de cada nodo
  - `Final` centrada
  - `Tercer y cuarto` debajo de `Final`
- Se ajustó también la vista previa para que use el mismo esquema del arte final, evitando que la publicación se vea completamente distinta al borrador.

## Pendiente inmediato siguiente sesión
- Validar visualmente en Render la exportación `PNG/PDF` de la nueva plantilla de playoff para confirmar:
  - conectores
  - anchos finales de tarjetas
  - tamaño real de logos
  - legibilidad en móvil y escritorio
- Si el organizador lo solicita, refinar aún más el arte de conectores del playoff para acercarlo al estilo TV/gráfico compartido, manteniendo la estructura ya estabilizada.

## 2026-03-21 - Afinado visual de plantilla publicable del playoff
- La plantilla publicable `8vos -> 4tos -> semifinal -> final` se afinó para acercarse más al arte de referencia sin perder exportabilidad estable:
  - los nodos ya muestran solo `logo + nombre local`, `vs`, `nombre visitante + logo`, sin etiquetas internas tipo `8VO P1` ni sembrados `1A/4C`,
  - los títulos de ronda (`Octavos`, `Cuartos`, `Semifinal`, `Final`) se ubican sobre cada bloque de columnas,
  - el lado derecho ya alinea logos y texto desde la derecha para espejar el lado izquierdo.
- Se agregó personalización de fondo en `Plantilla para publicar`:
  - carga de imagen local,
  - persistencia por `campeonato + categoría` en `localStorage`,
  - botón para quitar el fondo,
  - overlay claro/oscuro compatible con exportación `PNG/PDF`.
- Los auspiciantes de la plantilla publicable ya no se deforman:
  - caja fija,
  - `object-fit: contain`,
  - padding y fondo estables.
- Los conectores del layout especial ahora se redibujan también justo antes de capturar/exportar, con doble trazo para ganar legibilidad sobre fondos personalizados.
- El ancho de columnas del bracket especial ahora se calcula dinámicamente según el string más largo de cada ronda, evitando que los cuadros queden demasiado estrechos o que el texto fuerce cortes innecesarios.
- `Tercer y cuarto` quedó como subbloque compacto real:
  - más pequeño,
  - centrado debajo de `Final`,
  - con reserva de espacio propia para no salirse del lienzo en la vista previa/exportación.

## 2026-03-21 - Fondo personalizado en exportación de fixture y grupos
- Se cerró el pendiente de publicación visual para `fixtureplantilla.html` y `gruposgen.html`:
  - ahora ambas vistas permiten cargar una imagen local como fondo del poster,
  - el fondo queda guardado en `localStorage` por contexto (`campeonato + evento`),
  - se puede limpiar con botón `Quitar fondo`.
- La exportación `PNG/PDF` de fixture y grupos ya respeta el fondo personalizado:
  - se retiró el `backgroundColor` fijo de `html2canvas`,
  - el poster conserva su propia capa visual durante la captura.
- La implementación reutiliza el mismo enfoque de playoff:
  - overlay por tema para mantener legibilidad,
  - imagen de fondo aplicada vía CSS variable,
  - persistencia por clave específica del contexto publicado.
- En grupos también se corrigió el markup del selector de tema/fondo para evitar comillas tipográficas inválidas en el HTML.

## Pendiente inmediato siguiente sesión
- Completar el bloque restante de plantillas de exportación:
  - dropdown `Jugador:` para carné individual
  - plantilla exportable de jornadas (`jornadasplantilla.html`) con arte listo para redes
- Validar visualmente en producción:
  - fixture con fondo personalizado
  - grupos con fondo personalizado
  - contraste de textos/logos sobre fondos cargados por el usuario

## 2026-03-22 - Landing del organizador con bienvenida a equipos y categorías juveniles
- Se incorporó un nuevo bloque público en la landing del organizador para dar la bienvenida a los equipos participantes:
  - título personalizado,
  - descripción personalizada,
  - imagen de bienvenida,
  - listado de equipos participantes visibles por campeonato.
- La configuración quedó integrada en `organizador-portal.html` y se guarda dentro de `organizador_portal_config`:
  - `equipos_bienvenida_titulo`
  - `equipos_bienvenida_descripcion`
  - `equipos_bienvenida_imagen_url`
- El landing público del organizador ahora expone `equipos_participantes` por campeonato:
  - se deduplican nombres repetidos,
  - se conservan logos cuando existan,
  - la sección solo se muestra si realmente hay equipos visibles para ese organizador.
- Se agregó la migración `049_portal_bienvenida_equipos_y_categoria_juvenil.sql`, aplicada en la BD local:
  - nuevos campos de bienvenida para `organizador_portal_config`,
  - nuevo flag `categoria_juvenil` en `eventos`.

## 2026-03-22 - Carnés con fecha de nacimiento y edad para categorías juveniles
- En la creación/edición de categorías ahora existe el selector `Categoría juvenil`.
- Cuando una categoría está marcada como juvenil:
  - los carnés de jugadores muestran fecha de nacimiento,
  - muestran también la edad calculada,
  - el resto de categorías mantiene el formato actual sin ruido extra.
- El ajuste quedó implementado en:
  - `frontend/eventos.html`
  - `frontend/js/eventos.js`
  - `frontend/js/jugadores.js`
  - `backend/controllers/eventoController.js`

## 2026-03-22 - Plan inicial para transmisión de partidos
- Se dejó documentado el plan base para un nuevo servicio de transmisión operado por el organizador:
  - administración desde SGD,
  - visibilidad pública en el portal,
  - retransmisión a redes mediante proveedor especializado,
  - recomendación de MVP con OBS / StreamYard / Restream.
- Documento nuevo:
  - `docs/PLAN_TRANSMISION_PARTIDOS.md`

## 2026-03-22 - Render alineado con migración 049 y ajuste de refresh en landing
- Se ejecutó formalmente `049_portal_bienvenida_equipos_y_categoria_juvenil.sql` en PostgreSQL de Render.
- Verificación positiva en Render:
  - `organizador_portal_config.equipos_bienvenida_titulo`
  - `organizador_portal_config.equipos_bienvenida_descripcion`
  - `organizador_portal_config.equipos_bienvenida_imagen_url`
  - `eventos.categoria_juvenil`
- También se corrigió un comportamiento molesto del portal público:
  - al hacer `refresh` en `index.html`, ya no se reabre automáticamente el último torneo visto,
  - la portada principal solo abre detalle si `campeonato` o `evento` vienen explícitamente en la URL,
  - `portal.html` mantiene su comportamiento de contexto compartible sin afectar la landing.

## Pendiente inmediato siguiente sesión
- Validar en el portal público del organizador:
  - carga de imagen de bienvenida,
  - cards/listado de equipos participantes,
  - comportamiento con organizadores sin equipos visibles.
- Diseñar la Fase 1 operativa del servicio de transmisión:
  - modelo de datos definitivo,
  - endpoints mínimos,
  - primer flujo en panel del organizador.

## 2026-03-23 - Sincronización de fechas de campeonato a categorías heredadas
- Se corrigió la actualización de campeonatos para que, cuando cambien `fecha_inicio` o `fecha_fin`, las categorías/eventos del mismo campeonato que seguían heredando esas fechas también se sincronicen automáticamente.
- La sincronización es conservadora:
  - actualiza solo eventos que mantenían la fecha anterior del campeonato,
  - no pisa categorías que ya fueron ajustadas manualmente a otra fecha.
- Implementado en:
  - `backend/controllers/campeonatoController.js`

## 2026-03-23 - Fixture con selección explícita automático/manual
- En `partidos.html` se añadió la selección explícita del modo de programación:
  - `Programación automática (fecha/hora/cancha)`
  - `Programación manual (sin fecha/hora/cancha)`
- Si el organizador no selecciona ninguna opción, el sistema ahora bloquea la generación y muestra un modal explicativo.
- Si se elige `automática`:
  - programa todos los partidos que entren dentro de la ventana del evento,
  - deja los partidos restantes sin `fecha/hora/cancha`,
  - muestra un resumen indicando cuántos quedaron para edición manual.
- También quedó aplicado a `Regenerar (preservar jugados)`.
- Implementado en:
  - `frontend/partidos.html`
  - `frontend/js/partidos.js`
  - `backend/controllers/partidoController.js`
  - `backend/models/Partido.js`
  - `backend/services/mobileCompetitionService.js`

## 2026-03-23 - Entorno local realineado con producción
- Se hizo respaldo preventivo de la BD local en:
  - `database/backups/pre-render-sync-20260323-115731.custom.backup`
- Se instaló cliente PostgreSQL 18 para compatibilidad con Render.
- Se descargó un dump actualizado de Render en:
  - `database/backups/render-sync-20260323-133148.custom.backup`
- La BD local `gestionDeportiva` fue restaurada desde ese dump para trabajar con datos reales de producción.
- Verificación posterior:
  - `campeonatos: 9`
  - `eventos: 15`
  - `equipos: 138`
  - `partidos: 414`
  - `usuarios: 18`
- El `smoke` del backend pasó `9/9` contra `http://localhost:5000`.







