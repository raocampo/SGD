# Memoria de continuidad LT&C

Actualizada: 2026-10-23 (America/Guayaquil).

## Último trabajo: error al cargar equipos del campeonato 22 (23-oct)

- Causa reproducida en producción con administrador y organizador: `GET /api/equipos/campeonato/22` devolvía 500 por `idx_equipos_numero_campeonato`. La lectura intentaba compactar números con un hueco y el UPDATE colisionaba con el índice único. La categoría 36 «ABIERTA VARONES» conserva **23 inscritos**; el campeonato tiene **37 registros creados** y tenía 171 jugadores al diagnosticar. No confundir creados con inscritos ni borrar/fusionar equipos.
- `backend/models/Equipo.js`: listar deja de renumerar. Crear, editar y eliminar guardan el cambio y su numeración en una sola transacción, con bloqueo del campeonato para serializar altas/cambios. Renumerado en dos pasos dentro de la transacción para conservar el índice único; un fallo revierte también la escritura principal. Traslados bloquean origen/destino en orden y devuelven el número definitivo. Inicialización de números nulos a partir del máximo existente, sin modificar los ya asignados.
- Regresión `npm --prefix backend run test:equipo-numeracion`: **12/12 PASS** con `SGD_TEST_LOCAL_DB=1`, PostgreSQL local y esquema aislado que se elimina al terminar. Incluye colisión real del índice, consulta READ ONLY, alta/edición/baja, rollback de cada operación, traslado y concurrencia/límite de equipos. Sin activación explícita solo ejecuta las dos pruebas unitarias. Asociación existente **12/12 PASS**; sintaxis y diff correctos.
- Respaldo previo local cifrado DPAPI de IDs/números e inscritos: 213 equipos, 3.627 jugadores y 910 partidos en total. Sin reparación manual de datos productivos, migración ni rotación adicional de credenciales. El organizador de este campeonato está activo; los avisos de limpieza de cuentas y `ENOENT /app/frontend/index.html` compartidos en Railway son distintos del error reproducido.
- **Publicado y verificado:** `e7d5e9b` en `origin/main`; Railway `838e4e58-1fa2-4ae0-bb31-b933e291f159` **SUCCESS**, único activo, salud 200. Administrador y organizador: listado del campeonato **200/37**, categoría **200/23**, campeonato/evento/finanzas **200**. Comparación READ ONLY contra el respaldo: IDs, campeonato y números de los 213 equipos idénticos; 23 inscripciones idénticas; 910 partidos. El total de jugadores pasó de 3.627 a 3.630 durante la sesión, sin escrituras de QA; no se revirtieron cambios concurrentes. Sin QA visual del navegador en esta comprobación. La asociación directa sigue vigente; la verificación de pertenencia por código permanece en espera por instrucción del usuario.

## Trabajo anterior: filas impresas según los planteles reales (22-oct)

- Solicitud del usuario: ambos lados de la planilla deben tener `max(inscritos local, inscritos visitante)` filas. Ejemplos: 20/15 -> 20 filas (5 vacías solo en visitante); 15/15 -> 15, sin filas vacías; ambos sin inscritos -> 0 filas de jugadores. La regla aplica a todos los deportes/modelos del sistema.
- `frontend/js/planilla.js`: vista previa oficial/resumen, impresión y PDF con/sin observaciones usan el plantel real; se retiraron el relleno por `max_jugador`, los mínimos por modalidad y el recorte fijo a 30. Se conserva el orden por apellido, los datos y las estadísticas; el reporte tampoco recorta un plantel ya inscrito que supere el cupo configurado. Los límites de inscripción siguen validándose en backend.
- XLSX: la hoja del partido se reduce/amplía al mismo máximo real, desplazando celdas, combinaciones y pie de firmas/observaciones/pagos. `LISTAJUGADORES` usa la cantidad real del plantel local. La plantilla base conserva su archivo original; sin migración ni cambios de backend/datos productivos.
- Regresión reproducible: `node --test frontend/tests/planilla-impresion.test.cjs`, **15/15 PASS**, con 13 modalidades/tipos y diez combinaciones de planteles/cupos, nulos, ceros, 35 inscritos, estadísticas, orden y desplazamiento del pie Excel. Guards frontend **49/49 PASS**; sintaxis y diff correctos.
- QA de las funciones completas con las mismas versiones de pdfMake/SheetJS que carga la página: **7 PDF y 6 XLSX** de datos sintéticos. PDF renderizados/revisados: 1 página sin observaciones en los casos probados (incluido 35/20) y 2 con observaciones; 20/15 con cinco filas vacías solo en el menor, 15/15 sin relleno. XLSX reabiertos y contados, sin errores de fórmula; sin prueba de impresión física ni revisión en Excel de escritorio. Material temporal gitignored en `tmp/qa-planilla-exports/`.
- **Publicado:** código `6351301` en `origin/main`. `https://ltyc.corpsimtelec.com/js/planilla.js` devuelve 200 y coincide con el archivo local; contiene el cálculo por plantel real y el ajuste Excel, sin el antiguo tope de impresión. Backend salud 200 y despliegue `21fce9f8-1340-4576-a75b-698060e37888` **SUCCESS**, sin build adicional por este commit gracias a Watch Paths. La verificación de pertenencia por código sigue en espera por instrucción del usuario.

## Trabajo anterior: fallo de build documental y filtros de despliegue (22-oct)

- La captura corresponde al build `e11ae716-9407-4a87-ac43-30156553c4f0`, commit documental `3578a8e`, **FAILED antes del despliegue**. Eventos: `BUILD_IMAGE` con error genérico; único registro de build: inicio de builder v4. No hay detalle que permita afirmar la causa exacta ni evidencia de un error de aplicación en ese intento. Evidencia respaldada localmente con DPAPI.
- La versión funcional `003956f`, despliegue `f21f6b91-c6d6-4031-8ecb-c43f705439f3`, seguía **SUCCESS**: salud 200, catálogo sin token 401 y autenticado 200, 23 inscritos sin nombres repetidos en campeonato 22/categoría 36, frontend actualizado. El fallo documental no revirtió el código ni las credenciales rotadas.
- **Reintento completado:** `21fce9f8-1340-4576-a75b-698060e37888`, mismo commit `3578a8e`, **SUCCESS**, único despliegue activo. No se lanzaron reintentos duplicados mientras estaba pendiente. Sin cambios de código, dependencias ni credenciales para recuperarlo: compatible con fallo transitorio de construcción, sin causa exacta detallada en los registros. Railway todavía reportaba recuperación del servicio y recomendaba un reintento para fallos al inicio: https://status.railway.com/.
- **Configuración aplicada en Railway, backend/production:** Watch Paths `/backend/**`, `/database/**`, `/Dockerfile.railway`, `/.dockerignore`, `/railway.json`, `/railway.toml`. Antes estaban vacíos: cualquier cambio, incluso de memoria, disparaba builds. Ahora los commits solo de documentación/frontend no requieren reconstruir este backend; Vercel conserva su despliegue propio. Root `/`, Dockerfile, builder, healthcheck y variables sin cambios. Respaldo previo cifrado y lectura posterior coincidente; 10/10 comprobaciones de patrones con Git. Referencia: https://docs.railway.com/builds/build-configuration.
- Comprobación después del reintento: salud 200, catálogo sin token 401 y autenticado 200 para dirigente sin equipo, **23 inscritos y 23 nombres únicos** iguales a la tabla de inscripciones; frontend vigente. Conteos: 212 equipos, 3.594 jugadores, 910 partidos. Watch Paths conservados tras el despliegue. El intento fallido permanece como antecedente en el historial, sin afectar al nuevo activo.

## Trabajo anterior: equipos inscritos por categoría al primer ingreso (22-oct)

- Causa confirmada con lectura de producción: campeonato 22 con **36 equipos creados**, pero categoría 36 «ABIERTA VARONES» con **23 inscritos**. Diez nombres aparecían dos veces porque el selector incluía un registro inscrito y otro sin categoría. No había nombres duplicados dentro de esa categoría.
- El primer ingreso pasa a **Organización -> Campeonato -> Evento/Categoría -> Equipo**. El catálogo usa `evento_equipos`, deduplica por ID dentro de cada categoría y conserva equipos homónimos distintos, identificándolos por número si coinciden en la misma categoría. Cambiar cualquier selección limpia las dependientes; vacíos explícitos. No se eliminan ni fusionan equipos y no requiere migración.
- El servidor valida también `evento_id` y la inscripción del equipo. Los clientes anteriores conservan el catálogo plano de equipos inscritos con categoría en la etiqueta; el cuerpo de solo `equipo_id` se acepta cuando la categoría se puede determinar sin ambigüedad.
- **Decisión explícita del usuario:** dejar en espera la verificación de pertenencia por teléfono, aprobación o código de registro. Se mantiene la asociación directa existente. No hay solicitudes de aprobación, OTP, cambios al registro ni migración 077. Retomar después para definir cómo generar y entregar el código al registrarse; nombre/apellido y conocer un teléfono no prueban identidad.
- Verificación: backend **12/12 PASS**, formulario de asociación **13/13 escenarios DOM PASS**, Usuarios y Roles **14/14 DOM PASS**, guards frontend **49/49 PASS**. Consulta nueva ejecutada en transacción `READ ONLY` contra producción: **23 equipos, 23 nombres únicos**, registro sin categoría y categoría incorrecta rechazados. No se asignaron equipos ni se inscribieron jugadores para probar. QA visual y operación real por el usuario pendientes.
- **Publicado:** código `003956f` en `origin/main`, Railway `f21f6b91-c6d6-4031-8ecb-c43f705439f3` **SUCCESS**. API autenticada de producción: 200 para dirigente sin equipo, campeonato 22/categoría 36 con **23 equipos y 23 nombres únicos**, IDs iguales a `evento_equipos`; sin sesión, 401; salud, 200. `core.js` publicado coincide con el local y contiene el cuarto selector. Conteos: 212 equipos, 3.594 jugadores, 910 partidos. Verificación mediante lecturas, sin asignaciones ni jugadores reales de prueba. Rotación anterior completada; SMTP saliente de Hobby sigue pendiente por separado.

## Trabajo anterior: despliegue y cierre de rotación de credenciales (22-oct)

- `sgd-ltc/production` continúa en **Hobby**. Railway aceptó el despliegue real aunque su aviso público todavía indicaba Hobby pendiente. Sin cambio de plan. Despliegues `077a9b8d-66d4-409e-98fe-dd2a16c14890` y `98c75b86-90c6-4de8-bf92-8dc93e3dce0f`, **SUCCESS**, fuente `e3b5ed3` que incluye la corrección `b28f702`.
- **Backend de asociación publicado y comprobado:** `/api/auth/mi-equipo/opciones` ya devuelve 401 sin token y **200 para un dirigente real sin equipo**, con **4 organizadores, 7 campeonatos y 212 equipos**. Frontend publicado contiene la cascada y el método API nuevos. No se asignaron equipos ni se inscribieron jugadores reales de prueba; QA visual y selección/carga del usuario siguen pendientes.
- **JWT activo:** firma anterior rechazada y nueva reconocida. **PostgreSQL rotado:** contraseña cambiada en el rol real mediante verificador SCRAM, variables/referencias sincronizadas y segundo despliegue exitoso. Conexión nueva correcta y anterior rechazada con **28P01**. Sin cambios de rol/permisos ni nuevas migraciones. No quedaban conexiones antiguas elegibles al cerrar la conexión de mantenimiento.
- **Gmail activo en configuración del despliegue:** clave válida nuevamente autenticada desde este equipo y coincidente con Railway. Se detectó una copia local de `.env.local` que había vuelto a valores antiguos; se respaldó y reconcilió con Railway y el respaldo verificado. El archivo ahora contiene valores vigentes en `SMTP_PASS`, `JWT_SECRET`, `POSTGRES_PASSWORD` y URLs. Secretos `_NEXT` consumidos; anteriores solo en respaldos locales cifrados DPAPI. ACL usuario actual/SYSTEM, ignorado por Git.
- **Sesiones:** 16 refresh tokens revocados el 21-oct y **3 adicionales el 22-oct: 19 en total**. Verificación final: **0 vigentes**, sin enlaces de recuperación pendientes. No se cambiaron contraseñas de usuarios ni datos deportivos. Conteos iguales al respaldo: **38 usuarios, 212 equipos, 3.594 jugadores, 910 partidos**; no es una comparación íntegra de contenido.
- Cierre local `SECURITY_CREDENTIAL_ROTATION_COMPLETE=true`, limitado a secretos conocidos de SGD y revocación de sesiones. Estado final de las credenciales y evidencia en `.env.local` y respaldos privados. `node tmp/railway-resume.cjs final-verify` consulta la verificación; no repetir preparación/rotación. Ambos auxiliares en `tmp/` son gitignored; no quedan procesos de rotación ni reintentos programados.
- **Correo pendiente por separado:** Hobby bloquea SMTP saliente según la documentación de Railway. Rotar Gmail y desplegar no acredita envíos; no se enviaron mensajes de prueba, no se contrató proveedor ni se cambió el plan. Requiere API HTTPS o plan compatible. La revisión de registros del incidente sigue siendo parcial, sin certificación de ausencia de intrusión.
- Informe actualizado: `docs/INCIDENTE_RAILWAY_2026-10-21.md`. Los demás pendientes funcionales A–D conservan su alcance; la falta de despliegue de `b28f702` ya está resuelta.

## Trabajo anterior: contención parcial del incidente de Railway (21-oct)

- Autorizada la rotación de secretos y su conservación en `.env.local` de la raíz. Sesión de Railway renovada por el usuario; proyecto verificado `sgd-ltc/production`. Archivo normalizado, ignorado por Git y restringido por ACL al usuario Windows actual/SYSTEM. Respaldos cifrados DPAPI en `database/backups/`; no publicar secretos ni respaldos.
- **Aplicado:** revocación transaccional de 16 refresh tokens vigentes, con respaldo previo y comprobación de 0 restantes. Sin cambios de contraseñas de usuarios, jugadores, equipos ni otros datos deportivos.
- **JWT pendiente de activación:** reemplazo guardado en `JWT_SECRET_NEXT` y en Railway con `skipDeploys: true`, con lectura posterior coincidente. El proceso activo sigue aceptando la firma anterior y rechazando la nueva; los JWT de acceso todavía no están invalidados. Railway rechazó desplegar incluso la imagen existente con `Paused temporarily`.
- **Postgres pendiente:** contraseña/URLs nuevas preparadas en campos `_NEXT`, sin cambiar el rol ni las variables del servicio hasta coordinar un despliegue del backend que use la nueva conexión.
- **Gmail rotado en proveedor y configurado en Railway:** tras emitir la clave para la cuenta correcta de `SMTP_USER` y guardarla en el archivo raíz, autenticación SMTP por TLS **correcta**, contraseña anterior **rechazada (`EAUTH/535`)** y cero correos enviados. `SMTP_PASS` actualizado en Railway con `skipDeploys: true` y lectura posterior coincidente. La clave válida quedó en `SMTP_PASS` de `.env.local`; se retiró `SMTP_PASS_NEXT` y la copia local anterior solo queda en respaldos cifrados. Estado `PROVIDER_ROTATED_RAILWAY_CONFIGURED_RUNTIME_PENDING`: falta que el proceso backend se despliegue y use esa configuración. Nuevo intento rechazado con `Paused temporarily`.
- Producción todavía ejecuta `e3af70d` (20-oct); comprobación final tras configurar SMTP: `/salud` 200, BD responde y 0 refresh tokens vigentes. El JWT anterior sigue reconocido y el nuevo no. El catálogo de asociación de `b28f702` sigue en 404; frontend nuevo ya publicado. Esto explica el modal de error actual; pendiente desplegar y probar asociación/inscripción real.
- Registros revisados: 42 líneas de Postgres y 67 del backend; errores de archivo frontend inexistente, timeouts de correo y correo duplicado. Auditoría parcial: dos eventos de creación de despliegue. No demuestra ausencia de intrusión. Plan confirmado Hobby: SMTP saliente bloqueado según Railway; rotar Gmail no basta para recuperar el envío de correo.
- Detalle, evidencia, límites y pasos de cierre: `docs/INCIDENTE_RAILWAY_2026-10-21.md`. Estado por secreto y reemplazos exclusivamente en `.env.local`; **respuesta al incidente incompleta**. Auxiliar local gitignored: `tmp/railway-security.cjs`; no hay reintentos automáticos programados.

## Trabajo anterior: asociación de equipo al primer ingreso (21-oct)

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
- Última migración disponible: `076_partidos_arbitro_suplente.sql` (20-oct, planilla móvil). La asociación no añadió migraciones; la respuesta al incidente del 21/22-oct revocó 19 refresh tokens y rotó las credenciales conocidas de producción, con respaldos cifrados. No se modificaron datos deportivos ni contraseñas de usuarios.
- Producción, según la bitácora reciente: backend Railway y frontend Vercel, con despliegue automático desde `main`. Las menciones antiguas a Render son referencias históricas que deben contrastarse antes de operar.
- Validación del 15-oct: `node backend/scripts/qaPublicacionJornadas.js` **PASS** (filtros, guardado, errores y logos con frontend/backend separados); `npm --prefix backend run smoke:frontend` **49/49 PASS**. Son pruebas locales sin BD ni credenciales; no acreditan QA visual ni flujos reales de backend/producción.

## Fuentes para retomar

1. `docs/BITACORA_AVANCES.md`: entrada del 22-oct para despliegue y cierre de rotación; entradas del 21-oct para el incidente y asociación inicial; las del 20-oct para planilla móvil; «2026-10-14 - Estado consolidado» para la lista A–D, complementada por las entradas posteriores.
2. `docs/ESTADO_IMPLEMENTACION_SGD.md`: primera entrada del 22-oct; categorías en la asociación y verificación de pertenencia pospuesta por el usuario.
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

- Confirmar primer ingreso de dirigente/técnico en producción: organizador, campeonato, categoría y equipo; después, consultar e inscribir jugadores del equipo elegido. En campeonato 22/categoría 36 deben mostrarse los 23 inscritos. No hay migración de este cambio.
- **En espera por instrucción del usuario:** diseñar código de registro/invitación para verificar pertenencia. Mantener la asociación directa hasta retomar esta decisión; no activar validación telefónica ni aprobación sin esa nueva definición.
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
