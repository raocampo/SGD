# Memoria de continuidad LT&C

Actualizada: 2026-10-21 (America/Guayaquil).

## Último trabajo: asociación de equipo al primer ingreso (21-oct)

- Resuelto el selector vacío de una cuenta nueva de dirigente/técnico/jugador: el primer ingreso consultaba `/api/campeonatos`, que exige un equipo previamente asociado. El cambio del 16-oct era del formulario administrativo; este corrige el ingreso de la propia cuenta nueva.
- Nuevo `GET /api/auth/mi-equipo/opciones`, autenticado y exclusivo de esos tres roles. Devuelve solo IDs/nombres de organizadores activos, campeonatos publicados (`inscripcion`, `en_curso`, `finalizado`) y equipos; admite el vínculo legacy por texto si falta creador. Las lecturas deportivas siguen restringidas al equipo propio.
- Un diálogo con Organizador -> Campeonato -> Equipo, opciones dependientes y mensajes de vacío/reintento. `POST /api/auth/mi-equipo` valida la relación antes de asignar; sigue aceptando clientes con solo `equipo_id`. Actualiza la sesión y recarga para consultar el equipo e inscribir jugadores. Cédula opcional del jugador conservada.
- Pruebas: `npm --prefix backend run test:equipo-asociacion` **11/11 PASS**, guards frontend **49/49 PASS** y **12/12 escenarios DOM PASS** en `tmp/qa-usuarios-dom/asociacion.cjs` (temporal gitignored). Autenticación/rutas/controladores reales con modelos/datos simulados; probada la inscripción de jugadores del equipo propio y el rechazo de otro equipo. No se modificaron datos reales.
- Pendiente: QA visual y asociación/inscripción reales tras desplegar backend y frontend. Browser continúa sin navegadores disponibles. Sin migraciones nuevas. Base de esta tarea: `e3af70d`, alineada con el remoto al iniciar.
- Archivos principales: `backend/services/equipoAsociacionService.js`, `controllers/authController.js`, `routes/authRoutes.js`, `tests/equipo-asociacion.test.js`, `frontend/js/core.js` y `api.js`.

## Trabajo anterior: cabecera y modalidades de la planilla móvil (20-oct)

- API GET/PUT móvil añade `matchDetails` (árbitro, asistentes/segundo árbitro, suplente, delegado, ciudad, número de partido) y `rules`, derivadas del tipo del campeonato. El tipo recibido en el cuerpo no decide las reglas.
- Faltas acumuladas únicamente en fútbol 7, 6, 5 y sala; fútbol 11/9/8 e indor ocultan esa sección y el backend conserva las faltas previas sin aceptar cambios nuevos de esos formatos.
- Arbitraje: fútbol 11 central + dos asistentes + suplente; fútbol 5/sala dos árbitros + suplente; 7/6/9/8 e indor central con segundo árbitro opcional. Para indor se adoptó esa última opción al no indicarse otra cantidad. Son campos disponibles según formato; no se exige completar todos los nombres para guardar una planilla en elaboración.
- Migración aditiva `076_partidos_arbitro_suplente.sql`: columna nullable `partidos.arbitro_suplente`. Incluida también en preparación de esquema, guardado y snapshot de auditoría de `Partido.js`. Los otros campos reutilizan columnas existentes. La web conserva sus campos actuales; el nuevo suplente se captura desde la app y se preserva cuando clientes antiguos lo omiten.
- Regresión: móvil **31/31 PASS**, backend **22/22 PASS** con dependencias simuladas; TypeScript, sintaxis y revisión de parámetros SQL aprobados. Sin escrituras de planillas reales de prueba. Publicar backend/migración antes de la OTA Android preview runtime 1.0.1; registrar entrega y QA en la memoria móvil.
- Fuentes: `backend/services/mobilePlanillaDetails.js`, `mobileOperationsService.js`, `models/Partido.js`, `tests/mobile-planilla-fouls.test.js`. Respaldo: `../_codex_backups/gestionDeportivaAppMovil_datosPartido_2026-10-20_before.zip`.

## Trabajo anterior: faltas por tiempo para la app móvil (20-oct)

- La app hermana `../gestionDeportivaAppMovil` reemplaza el contador total de faltas por casillas 1–6 para primer y segundo tiempo de cada equipo. Se retiraron los textos instructivos repetidos de su planilla. La web conserva su implementación actual.
- `backend/services/mobileOperationsService.js` expone y recibe `fouls.homeFirstHalfFouls`, `homeSecondHalfFouls`, `awayFirstHalfFouls`, `awaySecondHalfFouls`; `mobilePlanillaFouls.js` los adapta a `local_1er`, `local_2do`, `visitante_1er`, `visitante_2do` del modelo existente. Totales derivados de los tiempos, rango 0–6 por tiempo, sin migración.
- Los APK antiguos que mandan solo totales conservan los tiempos ya registrados por web/app nueva; sus totales no se usan para inventar un reparto por tiempo. Las actualizaciones parciales conservan los tiempos omitidos. El móvil nuevo bloquea el guardado si el servidor aún no devuelve los cuatro tiempos, evitando pérdida silenciosa durante el despliegue.
- Verificación: `npm --prefix backend run test:mobile-planilla`, **8/8 PASS** con servicio real y modelo/acceso simulados, sin conexión a BD. Cubre lectura, guardado/reapertura, ceros, límites, clientes antiguos, cambios parciales y permisos. Sintaxis y `git diff --check` sin errores. Móvil: 20/20 pruebas, TypeScript y exportación Android/Hermes aprobados.
- Publicación: seguir la preferencia de commit/push al cerrar; backend antes de OTA preview del APK 1.0.1. El QA visual y el guardado real en celular siguen pendientes; no se modificaron datos productivos para probar.
- Respaldo: `../_codex_backups/gestionDeportivaAppMovil_faltas_2026-10-20_before.zip`. Memoria móvil: `../gestionDeportivaAppMovil/docs/retomaMovil_2026-10-20.md`.

## Trabajo anterior: Usuarios y Roles (16-oct)

- Implementado selector Campeonato para organizadores; Equipo solo muestra los del campeonato seleccionado y permanece deshabilitado hasta elegirlo. Administrador conserva Organización -> Campeonato -> Equipo, incluida la edición. Archivos: `frontend/usuarios.html`, `frontend/js/usuarios.js`.
- Se reutilizan las APIs autenticadas de campeonatos/equipos y sus permisos existentes. Cambiar campeonato limpia el equipo; Recargar conserva selecciones válidas; validación al guardar y mensajes de vacío/error. No requiere migración ni cambios de backend.
- Verificación local: **14/14 escenarios DOM PASS** con jsdom y API simulada (arnés temporal en `tmp/qa-usuarios-dom/qa.cjs`, gitignored); `smoke:frontend` **49/49 PASS**; `qaPublicacionJornadas.js` **PASS**. No se usaron BD ni credenciales reales.
- QA visual pendiente: Browser no tiene navegadores disponibles. Confirmar tras despliegue la selección de campeonatos/equipos como organizador y el formulario en celular; las pruebas DOM no verifican renderizado ni guardado real en producción.
- Base de esta tarea: `0a12a0e`; `git fetch origin` del 16-oct confirmó que no había commits remotos adicionales antes de cerrar.

## Punto de partida verificado

- Sincronización del 15-oct: `git pull --ff-only` completado en Windows de `e9e8aa4` a `20f37d9`. Los siete archivos modificados y dos nuevos coincidían íntegramente con los commits remotos; se respaldaron con stash y se retiró ese respaldo solo tras comparar los nueve archivos con `HEAD`. La documentación se publicó después en `0a12a0e`.
- Sistema de gestión deportiva LT&C: frontend HTML/CSS/JS y backend Node/Express con PostgreSQL. Scripts operativos en `backend/package.json`.
- Última migración disponible: `076_partidos_arbitro_suplente.sql` (20-oct, planilla móvil). La sesión del 21-oct no ejecutó migraciones ni modificó datos reales.
- Producción, según la bitácora reciente: backend Railway y frontend Vercel, con despliegue automático desde `main`. Las menciones antiguas a Render son referencias históricas que deben contrastarse antes de operar.
- Validación del 15-oct: `node backend/scripts/qaPublicacionJornadas.js` **PASS** (filtros, guardado, errores y logos con frontend/backend separados); `npm --prefix backend run smoke:frontend` **49/49 PASS**. Son pruebas locales sin BD ni credenciales; no acreditan QA visual ni flujos reales de backend/producción.

## Fuentes para retomar

1. `docs/BITACORA_AVANCES.md`: entrada del 21-oct para asociación inicial; las del 20-oct para planilla móvil; «2026-10-14 - Estado consolidado» para la lista A–D, complementada por las entradas posteriores.
2. `docs/ESTADO_IMPLEMENTACION_SGD.md`: primera entrada del 21-oct; asociación inicial y continuidad de Usuarios y Roles.
3. `docs/INDICE_DOCUMENTACION.md`: mapa de guías y planes.

El README conserva un cierre de junio y la tabla histórica de módulos tiene fecha de mayo. Priorizar las entradas fechadas más recientes; no reabrir tareas antiguas ya resueltas (por ejemplo, Facturación Fases 2 y 3 ya implementadas). Los planes de transmisión y baloncesto también incluyen fases iniciales ya superadas; contrastarlos con la bitácora y el código antes de implementar.

## Trabajo reciente ya documentado

- Logos de jornadas/resultados/playoff: corrección publicada en `20f37d9`; `renderLogoEquipoPortal` resuelve las rutas relativas contra el backend. La sesión del 14-oct reportó los 27 logos distintos de Abierta accesibles. Regresión con dominios separados repetida el 15-oct: PASS; pendiente confirmación visual tras despliegue.

- Publicación de jornadas: corrección preventiva y regresión publicadas en `e9bcbdd`. `null` significa todas, incluidas futuras; `[]` oculta las jornadas regulares y sus resultados; una lista publica solo las jornadas elegidas. Guardar sin cambios conserva `null`; el portal distingue restricción de publicación de fallo de carga.

- Póster «Jornada / Resultados» con marcadores reales y acceso visible en la pestaña principal de Partidos.
- Resultados de landing centralizados en `publicPortalService`: última fecha con resultado por categoría/grupo y ventana de 3 días; la sesión anterior reportó 12 resultados del 02/03-oct para Liga InterEmpresarial.
- Regenerar fixture preservando jugados programa lo nuevo después de la fecha más reciente existente.
- Liga InterEmpresarial: corrección de dos fechas y renumeración por grupo realizadas en producción con respaldo, según bitácora. No se volvieron a consultar ni alterar en esta sesión.
- Finanzas: administrador y organizador según alcance; dirigente/técnico solo lectura de su equipo; jugador sin acceso. Importación Excel multihoja y mejoras de modales ya implementadas.

## Próximos pasos

- Confirmar primer ingreso de dirigente/técnico en producción: organizador, campeonato y equipo; después, consultar e inscribir jugadores del equipo elegido. El despliegue requiere tanto backend como frontend; no hay migración de este cambio.
- Confirmar en producción Usuarios y Roles: campeonatos propios visibles para organizador, equipos filtrados y equipo anterior limpio al cambiar campeonato; revisar el formulario en celular.
- Confirmar visualmente en producción las correcciones de jornadas y logos ya presentes en `origin/main`; no necesitan volver a publicarse. Según la sesión del 14-oct, el evento 34 se restauró a `null` con respaldo previo y 84 partidos intactos; la API devolvió 84 partidos, 10 jornadas y 20 finalizados con marcador. Es evidencia histórica, no una consulta del 15-oct.
- Código pendiente comprobado el 15-oct: aplicar el modo lectura de `planilla.html` desde el inicio (actualmente se aplica al cargar una planilla); revisar scroll y botones fijos de los modales de Facturación, Playoff y Transmisión en celular; adaptar la bienvenida de `portal-tecnico.html` para que el jugador no vea la mención al estado financiero. Son candidatos para la siguiente tarea, todavía sin implementar.
- Evaluar dividir «Nuevo Campeonato» en secciones, como «Editar categoría», si se continúa el ajuste de formularios.
- Validación pendiente en producción: 12 resultados en landing, póster/selector tras renumeración, guardado real de categoría, modales en celular, Excel Induloja multihoja, permisos por rol y vínculo de jugador por cédula. Detalle completo en la lista A de la bitácora.
- QA pendiente: `smoke:matrix` y `smoke:roles` requieren usuarios QA sembrados; prueba real de transmisiones entre dispositivos; QA responsive con datos reales.
- Mantener en backlog: formatos libres de importación, reportes financieros por periodos, desempates avanzados, formatos adicionales de playoff y actualización del resumen histórico por módulos.

## Decisiones e insumos pendientes

- Definir situación de partidos pasados aún programados sin planilla; eventual renumeración de eventos 16, 18, 19 y 30 de otros organizadores; duplicado «80 FC» (IDs 81 y 54). No aplicar correcciones de datos sin resolver esas decisiones.
- RUC/razón social reales, certificado digital para SRI, credenciales PayPhone/PayPal, proveedor TURN y credenciales/contrato para QA mobile.

## Entorno y cautelas de continuidad

- Esta sesión se ejecutó en Windows/PowerShell, con Node `v24.14.1` y npm `11.11.0`. No se inició servidor ni se consultó o refrescó la BD local o de producción.
- Según el cierre anterior, la BD local del otro equipo Fedora proviene del respaldo del 10-oct y no contiene las correcciones recientes ni los equipos nuevos de Liga InterEmpresarial. Esa advertencia corresponde a Fedora; la antigüedad de la BD de este Windows no se comprobó. Verificar el destino y la vigencia de la base antes de validar datos reales.
- MEGA no sincroniza `.git` ni `.env`, según la bitácora. Revisar configuración local antes de iniciar servicios, sin copiar secretos a documentación.
- Al cerrar trabajo funcional: actualizar bitácora y estado cuando corresponda. El 15-oct fue preparación de continuidad; el 16-oct se implementó el filtro de campeonatos/equipos en Usuarios y Roles. No se modificaron datos reales en estas sesiones.

## Preferencia de trabajo del usuario

- Desde el 2026-10-14: al terminar cada tarea, realizar commit y push de los cambios del proyecto. Mantener credenciales y respaldos fuera del repositorio.
