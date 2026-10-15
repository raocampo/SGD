# Memoria de continuidad LT&C

Actualizada: 2026-10-14 (America/Guayaquil).

## Punto de partida verificado

- `git pull` completado: `Already up to date.` Rama `main`, HEAD `fe01e81`, alineada con `origin/main` al iniciar esta sesión; árbol limpio antes de actualizar documentación.
- Sistema de gestión deportiva LT&C: frontend HTML/CSS/JS y backend Node/Express con PostgreSQL. Scripts operativos en `backend/package.json`.
- Última migración disponible: `075_recrear_partido_mega_construgrid.sql`. Esta sesión no ejecutó migraciones ni modificó datos.
- Producción, según la bitácora reciente: backend Railway y frontend Vercel, con despliegue automático desde `main`. Las menciones antiguas a Render son referencias históricas que deben contrastarse antes de operar.
- `npm --prefix backend run smoke:frontend`: **49/49 PASS** en esta sesión. Esto verifica guards de frontend; no acredita QA visual ni flujos reales de backend/producción.

## Fuentes para retomar

1. `docs/BITACORA_AVANCES.md`: entrada «2026-10-14 - Estado consolidado»; lista vigente de pendientes A–D y detalle de los cambios recientes.
2. `docs/ESTADO_IMPLEMENTACION_SGD.md`: primera entrada del 14-oct; estado operativo consolidado.
3. `docs/INDICE_DOCUMENTACION.md`: mapa de guías y planes.

El README conserva un cierre de junio y la tabla histórica de módulos tiene fecha de mayo. Priorizar las entradas fechadas más recientes; no reabrir tareas antiguas ya resueltas (por ejemplo, Facturación Fases 2 y 3 ya implementadas).

## Trabajo reciente ya documentado

- Póster «Jornada / Resultados» con marcadores reales y acceso visible en la pestaña principal de Partidos.
- Resultados de landing centralizados en `publicPortalService`: última fecha con resultado por categoría/grupo y ventana de 3 días; la sesión anterior reportó 12 resultados del 02/03-oct para Liga InterEmpresarial.
- Regenerar fixture preservando jugados programa lo nuevo después de la fecha más reciente existente.
- Liga InterEmpresarial: corrección de dos fechas y renumeración por grupo realizadas en producción con respaldo, según bitácora. No se volvieron a consultar ni alterar en esta sesión.
- Finanzas: administrador y organizador según alcance; dirigente/técnico solo lectura de su equipo; jugador sin acceso. Importación Excel multihoja y mejoras de modales ya implementadas.

## Próximos pasos

- Sesión de publicación del 14-oct: corregido localmente el panel que dibujaba `null` como casillas desmarcadas y al guardar lo convertía en `[]`. Añadidos diagnóstico público de restricción y mensajes de fallo de carga. Regresión `node backend/scripts/qaPublicacionJornadas.js` PASS y guards 49/49. Railway accesible mediante la URL al final de `.env.local` (fuera de las variables estándar). Publicación del evento 34 restaurada a `null` con respaldo previo gitignored y 84 partidos intactos; API pública verificada: 84 partidos, 10 jornadas y 20 finalizados con marcador. Prevención del fallo del panel preparada para publicación en `main`; comprobar el despliegue automático después del push. Ver primera entrada de bitácora.
- Código disponible para continuar: modo lectura de `planilla.html` desde el inicio; revisión móvil y botones fijos en modales de Facturación, Playoff y Transmisión; bienvenida de jugador sin mención financiera.
- Validación pendiente en producción: 12 resultados en landing, póster/selector tras renumeración, guardado real de categoría, modales en celular, Excel Induloja multihoja, permisos por rol y vínculo de jugador por cédula. Detalle completo en la lista A de la bitácora.
- QA pendiente: `smoke:matrix` y `smoke:roles` requieren usuarios QA sembrados; prueba real de transmisiones entre dispositivos; QA responsive con datos reales.
- Mantener en backlog: formatos libres de importación, reportes financieros por periodos, desempates avanzados, formatos adicionales de playoff y actualización del resumen histórico por módulos.

## Decisiones e insumos pendientes

- Definir situación de partidos pasados aún programados sin planilla; eventual renumeración de eventos 16, 18, 19 y 30 de otros organizadores; duplicado «80 FC» (IDs 81 y 54). No aplicar correcciones de datos sin resolver esas decisiones.
- RUC/razón social reales, certificado digital para SRI, credenciales PayPhone/PayPal, proveedor TURN y credenciales/contrato para QA mobile.

## Entorno y cautelas de continuidad

- Según el cierre anterior, la BD local Fedora proviene del respaldo del 10-oct y no contiene las correcciones recientes ni los equipos nuevos de Liga InterEmpresarial. No se comprobó ni refrescó en esta sesión; actualizarla antes de validar esos datos.
- MEGA no sincroniza `.git` ni `.env`, según la bitácora. Revisar configuración local antes de iniciar servicios, sin copiar secretos a documentación.
- Al cerrar trabajo funcional: actualizar bitácora y estado cuando corresponda. Esta sesión solo prepara continuidad; no implementa los pendientes ni publica cambios.

## Preferencia de trabajo del usuario

- Desde el 2026-10-14: al terminar cada tarea, realizar commit y push de los cambios del proyecto. Mantener credenciales y respaldos fuera del repositorio.
