# Memoria de continuidad LT&C

Actualizada: 2026-10-15 (America/Guayaquil).

## Punto de partida verificado

- `git pull --ff-only` completado en el equipo Windows: `main` avanzó de `e9e8aa4` a `20f37d9`, alineada con `origin/main` antes de actualizar documentación. Los siete archivos modificados y dos nuevos que había al iniciar coincidían íntegramente con los commits remotos; se respaldaron con stash y se retiró ese respaldo solo tras comparar los nueve archivos con `HEAD`. No quedó trabajo local perdido ni pendiente de reaplicar.
- Sistema de gestión deportiva LT&C: frontend HTML/CSS/JS y backend Node/Express con PostgreSQL. Scripts operativos en `backend/package.json`.
- Última migración disponible: `075_recrear_partido_mega_construgrid.sql`. Esta sesión no ejecutó migraciones ni modificó datos.
- Producción, según la bitácora reciente: backend Railway y frontend Vercel, con despliegue automático desde `main`. Las menciones antiguas a Render son referencias históricas que deben contrastarse antes de operar.
- Validación del 15-oct: `node backend/scripts/qaPublicacionJornadas.js` **PASS** (filtros, guardado, errores y logos con frontend/backend separados); `npm --prefix backend run smoke:frontend` **49/49 PASS**. Son pruebas locales sin BD ni credenciales; no acreditan QA visual ni flujos reales de backend/producción.

## Fuentes para retomar

1. `docs/BITACORA_AVANCES.md`: entrada del 15-oct para esta sincronización; «2026-10-14 - Estado consolidado» para la lista A–D y las entradas superiores de ese día para jornadas y logos.
2. `docs/ESTADO_IMPLEMENTACION_SGD.md`: primera entrada del 15-oct; actualización de continuidad sobre el consolidado del 14-oct.
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
- Al cerrar trabajo funcional: actualizar bitácora y estado cuando corresponda. El alcance del 15-oct es sincronización, revisión, pruebas locales y documentación de continuidad; no se implementaron pendientes funcionales ni se modificaron datos.

## Preferencia de trabajo del usuario

- Desde el 2026-10-14: al terminar cada tarea, realizar commit y push de los cambios del proyecto. Mantener credenciales y respaldos fuera del repositorio.
