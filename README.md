# LT&C - Loja Torneos & Competencias

Sistema web para administracion de campeonatos: eventos/categorias, equipos, jugadores, sorteo, grupos, fixture, planillaje oficial, tablas, portal publico y modulo financiero base.

Estado del proyecto (2026-03-11): funcional en flujo principal; CMS institucional en cierre operativo, coexistencia web/mobile validada con QA automatizado, modulo de pases extendido con contabilidad e historial por jugador/equipo, tablas con clasificacion por grupo, eliminacion automatica/manual por categoria, configuracion compartida de playoff y clasificacion manual sugerida con candidatos externos del evento. Despliegue Render ya validado con PostgreSQL remoto y soporte para `uploads` en disco persistente. Portal publico ya expone `Playoff` por categoria, muestra torneos proximos/inscripcion legados cuando pertenecen a organizadores reales y autenticacion admite `correo o username` para cuentas internas.

## Tabla de Contenidos
- [1. Vision General](#1-vision-general)
- [2. Arquitectura](#2-arquitectura)
- [3. Estructura del Repositorio](#3-estructura-del-repositorio)
- [4. Requisitos](#4-requisitos)
- [5. Configuracion Rapida](#5-configuracion-rapida)
- [6. Scripts](#6-scripts)
- [7. Endpoints Utiles](#7-endpoints-utiles)
- [8. Modulos Implementados](#8-modulos-implementados)
- [9. Documentacion del Proyecto](#9-documentacion-del-proyecto)
- [10. Flujo de Trabajo Recomendado](#10-flujo-de-trabajo-recomendado)
- [11. Pendientes Prioritarios](#11-pendientes-prioritarios)
- [12. Solucion de Problemas](#12-solucion-de-problemas)

## 1. Vision General
El objetivo de LT&C (Loja Torneos & Competencias) es centralizar la operacion de torneos amateur/semi-profesionales, desde la inscripcion hasta reportes deportivos y financieros.

Flujo principal operativo:
1. Crear campeonato.
2. Crear eventos/categorias.
3. Registrar equipos y jugadores.
4. Realizar sorteo y crear grupos.
5. Generar fixture.
6. Registrar planilla de partido (resultado, goles, tarjetas, pagos, observaciones).
7. Consultar tablas y portal publico.

## Novedades Recientes (2026-03-11)
- Jugadores:
  - se corrigio el desfase de `fecha_nacimiento` en tarjetas/listados causado por conversion de zona horaria del navegador,
  - ya se puede eliminar la `foto carnet` desde el modal/perfil del jugador y el backend limpia tambien el archivo asociado cuando corresponde,
  - los inputs de `foto_cedula` y `foto_carnet` ya quedan preparados para captura directa desde celular (`capture=environment` / `capture=user`), facilitando alta en campo.
- Portal publico:
  - el listado general vuelve a mostrar campeonatos `borrador` / `inscripcion` cuando son torneos reales de organizador o registros legacy con `organizador` informado,
  - se mantiene excluido todo campeonato QA / administrativo del portal general.
- Campeonatos:
  - se ampliaron los tipos de futbol soportados en UI + BD:
    - `futbol_11`,
    - `futbol_9`,
    - `futbol_8`,
    - `futbol_7`,
    - `futbol_6`,
    - `futbol_5`,
    - `futsala`,
    - `indor`.
  - nueva migracion:
    - `database/migrations/033_campeonatos_tipos_futbol_ampliados.sql`.
- Navegacion publica:
  - `Ingresar` y `Registrarse` en landing/portal ahora abren en nueva ventana para no romper la lectura del portal compartible.

## Novedades Anteriores (2026-03-10)
- Portal publico deportivo:
  - el listado general ya expone solo campeonatos creados por usuarios con rol `organizador`,
  - quedan fuera campeonatos creados por `administrador` y torneos QA ligados a cuentas administrativas,
  - el detalle del campeonato mantiene tabs por categoria y ahora usa subtabs enfocadas en:
    - `Tabla de posiciones`,
    - `Goleadores`,
    - `Fair play`,
    - `Tarjetas amarillas`,
    - `Tarjetas rojas`,
    - `Playoff`,
  - las tablas de posiciones por grupo ahora se muestran en grid responsive:
    - `2 columnas` en desktop,
    - `1 columna` en tablet/movil.
  - el portal replica el estado competitivo del sistema:
    - equipos fuera de clasificacion en naranja,
    - equipos eliminados en rojo oscuro con causal visible,
    - `Fair play` excluye equipos eliminados.
  - los endpoints publicos de `goleadores`, `tarjetas` y `fair play` ya pasan por el filtro del `publicPortalController`, evitando exponer eventos no publicos por URL directa.
- Soporte estable para uploads en despliegue:
  - nuevo archivo `backend/config/uploads.js`,
  - `server.js`, `multerConfig.js` y controladores de borrado/lectura ahora usan `UPLOADS_DIR`,
  - si `UPLOADS_DIR` no existe, el sistema sigue usando `backend/uploads` como fallback local,
  - `render.yaml` queda preparado para disco persistente en `/var/data` con `UPLOADS_DIR=/var/data/uploads`.
- Documentos de jugadores reorganizados:
  - nuevas rutas fisicas para uploads por campo:
    - `uploads/jugadores/cedulas`,
    - `uploads/jugadores/fotos`,
  - se mantienen los campos BD `foto_cedula_url` y `foto_carnet_url`, por lo que no se rompe la reimpresion de carnets ni la compatibilidad con registros existentes.
- Seguridad de contraseñas reforzada:
  - nuevo flag `debe_cambiar_password` en usuarios,
  - usuarios creados por administrador/organizador quedan marcados para cambio obligatorio al primer ingreso,
  - nuevo endpoint autenticado `POST /api/auth/password/change`,
  - flujo de login y panel administrativo ya fuerzan/permiten cambio de contraseña desde UI.
- Identificadores de acceso internos mas flexibles:
  - nueva migracion `database/migrations/032_usuarios_username_opcional.sql`,
  - usuarios internos ahora pueden crearse con:
    - `correo`,
    - `username`,
    - o ambos.
  - el login web acepta `correo o usuario`.
  - la recuperacion de contraseña sigue siendo exclusiva para cuentas con correo.

## Novedades Anteriores (2026-03-09)
- Configuracion compartida de playoff/clasificacion:
  - `tablas.html` y `eliminatorias.html` ahora leen/guardan la misma configuracion por categoria,
  - incluye:
    - `metodo_competencia`,
    - `clasificados_por_grupo`,
    - `origen_playoff`,
    - `metodo_playoff`,
    - `cruces_grupos`.
  - nueva migracion:
    - `database/migrations/030_evento_playoff_config.sql`.
- Eliminacion manual por categoria:
  - nuevo estado competitivo por equipo en `evento_equipos` con causales:
    - `indisciplina`,
    - `deudas`,
    - `sin_justificativo_segunda_no_presentacion`.
  - `eliminatorias.html` ahora incluye bloque operativo para marcar/revertir equipos eliminados manualmente.
- Clasificacion manual con sugerencia del sistema:
  - nuevo resumen por grupo para elegir clasificados manuales cuando la definicion deportiva queda abierta,
  - el backend sugiere el clasificado segun tabla vigente y respeta la decision guardada del organizador al generar playoff,
  - si un grupo no completa cupos con sus equipos elegibles, el sistema propone mejores no clasificados del evento,
  - los equipos eliminados manualmente ya no ingresan a llaves directas ni a playoff desde grupos.
- Tablas competitivas ajustadas:
  - los equipos eliminados ya bajan al final de la tabla aunque tengan mayor puntaje,
  - fuera de clasificacion se pinta en naranja/marron,
  - eliminados se muestran en rojo oscuro con causal visible.
- Sistema visual de mensajes:
  - reemplazo de `alert/confirm/prompt` por dialogos y notificaciones visuales reutilizables en el panel.
- Nueva migracion:
  - `database/migrations/029_eliminacion_manual_y_clasificacion_manual.sql`.

## Novedades Anteriores (2026-03-08)
- Auditoria de planilla finalizada:
  - al editar una planilla cerrada ahora se exige motivo de edicion,
  - se guarda traza de auditoria (`antes/despues`) en `partido_planilla_ediciones`.
- Tablas por campeonato/organizador:
  - `tablas.html` ahora incluye selector de campeonato y ya no arrastra contexto entre usuarios,
  - se agregó bloque `Formato de Clasificación` con botón `Guardar formato` para persistir `metodo_competencia` y `clasificados_por_grupo` por categoría.
- Seguridad de endpoints deportivos:
  - `GET /api/eventos*` y `GET /api/tablas*` internos ahora requieren autenticación y rol,
  - el organizador solo ve categorías de sus campeonatos.
- Clasificacion por grupo y eliminacion automatica:
  - nuevo parametro `clasificados_por_grupo` en categorias/eventos,
  - tablas pintan en rojo a los equipos fuera del cupo,
  - equipos con `3` no presentaciones quedan eliminados automaticamente en su categoria.
- Correccion de doble ausencia:
  - `ambos no se presentan` ya no guarda `0-0`,
  - el marcador queda vacio (`NULL/NULL`) y no suma como partido jugado,
  - la multa financiera por no presentacion se mantiene para ambos equipos.

## Novedades Anteriores (2026-03-05)
- Modulo de pases extendido:
  - sincronizacion contable automatica a finanzas al aprobar/pagar/anular pases,
  - historial dedicado por jugador y por equipo (backend + UI).
- QA de coexistencia web/mobile reforzado:
  - nuevo script `npm run qa:ui-dataset` para validar dataset operativo (mobile/public/web).
- Documentacion para cliente y capacitacion:
  - `docs/GUIA_OPERATIVA_CLIENTE_LT_C.md`,
  - `docs/GUIA_VIDEO_TUTORIALES_LT_C.md`.

## Novedades Anteriores (2026-02-28)
- Inicio del plan de separacion entre gestion deportiva y CMS del portal publico:
  - nuevo documento `docs/PLAN_CMS_PORTAL_PUBLICO.md`,
  - nuevo rol `operador` para administracion institucional del portal,
  - nueva migracion `database/migrations/016_rol_operador_cms.sql`.
- Noticias institucionales cerradas para `administrador` + `operador`:
  - el organizador queda fuera del alcance editorial del portal publico.
- Frontend preparado para el nuevo dominio CMS:
  - nueva vista `portal-cms.html`,
  - redireccion por rol para `operador`,
  - `portal-admin.html` renombrado semanticamente como `Portal Deportivo`.
- Fase 2 de noticias/blog iniciada:
  - nueva migracion `database/migrations/017_noticias_cms.sql`,
  - nueva administracion `frontend/noticias.html`,
  - nuevas vistas publicas `frontend/blog.html` y `frontend/noticia.html`,
  - la landing principal ahora consume la ultima noticia publicada desde `/api/public/noticias`.
- Fases 3, 4 y 5 del CMS iniciadas:
  - nueva migracion `database/migrations/018_galeria_cms.sql`,
  - nueva migracion `database/migrations/019_portal_contenido_cms.sql`,
  - nueva migracion `database/migrations/020_contacto_portal.sql`,
  - nuevas vistas CMS:
    - `frontend/galeria-admin.html`,
    - `frontend/contenido-portal.html`,
    - `frontend/contacto-admin.html`,
  - la landing publica ya consume galeria, contenido institucional editable y formulario de contacto persistente.

## Novedades Anteriores (2026-02-27)
- Configuracion flexible de jugadores por campeonato:
  - nuevo campo `requiere_cedula_jugador`,
  - la cedula del jugador puede ser obligatoria u opcional segun la configuracion del organizador.
- Nueva migracion disponible:
  - `database/migrations/015_campeonato_cedula_opcional.sql`.
- Ajustes integrados recientes en frontend/backend para campeonatos, jugadores, usuarios, equipos, grupos, partidos, planilla y tablas.
 
## Novedades Anteriores (2026-02-22)
- Planes por organizador operativos en usuarios:
  - administrador puede crear/editar organizadores con `plan` y `estado del plan`.
- Landing pública por organizador habilitada para planes pagados:
  - endpoint `GET /api/auth/organizadores/:id/landing`,
  - acceso web con `index.html?organizador=ID`,
  - disponible para `base`, `competencia` y `premium`.
- Portal de organizador (`portal-admin.html`) ahora muestra acceso directo para abrir/copiar su landing pública cuando su plan lo permite.
- Branding visible unificado a `LT&C (Loja Torneos & Competencias)` en frontend.
- Landing renovada con:
  - precios,
  - auspiciantes en carrusel,
  - contacto y redes oficiales.
- Icono global web/sistema agregado (favicon LT&C) para todas las vistas que cargan `core.js`.
- Plan de adaptacion mobile documentado en `docs/PLAN_MOBILE_LT_C.md`.
- Sidebar administrativo unificado: inicia contraido por defecto y se corrigio la superposicion con overlay en movil.
- Finanzas:
  - estado de cuenta, morosidad y movimientos mejorados para responsive,
  - toggles por seccion para reducir scroll en pantallas pequenas,
  - estado de cuenta con resumen por concepto (inscripcion/arbitraje/multas),
  - sincronizacion automatica de cargos de inscripcion por categoria/equipo.
- Planilla -> Finanzas:
  - registro de arbitraje y multas por equipo,
  - abonos desde planilla aplicados a la cuenta corriente del equipo.
- Configuracion economica extendida:
  - campeonato con costos base (`costo_arbitraje`, `costo_tarjeta_amarilla`, `costo_tarjeta_roja`, `costo_carnet`),
  - categoria/evento con `costo_inscripcion`.

## 2. Arquitectura
- Backend: Node.js + Express + PostgreSQL.
- Frontend: HTML/CSS/JS vanilla (multi-pagina administrativa).
- Almacenamiento de archivos:
  - local: `backend/uploads/`,
  - despliegue: directorio configurable por `UPLOADS_DIR` (por ejemplo `/var/data/uploads` en Render).
- Exportaciones: XLSX y PDF para planillaje/plantillas.

## 3. Estructura del Repositorio
```text
backend/
  config/
  controllers/
  models/
  routes/
  uploads/
  server.js
  .env.example

database/
  esquema.sql
  migrations/

docs/
  BITACORA_AVANCES.md
  ESTADO_IMPLEMENTACION_SGD.md
  CAMBIOS_IMPLEMENTADOS.md
  PLAN_MOBILE_LT_C.md
  PLAN_CMS_PORTAL_PUBLICO.md
  propuestaDesarrolloSGD.md

frontend/
  *.html
  css/
  js/
  templates/
```

## 4. Requisitos
- Node.js 18+ (recomendado 20 LTS)
- PostgreSQL 14+
- NPM 9+

## 5. Configuracion Rapida
### 5.1 Backend
```bash
cd backend
npm install
```

Crear archivo `backend/.env` (basado en `backend/.env.example`):
```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=gestionDeportiva
DB_PASSWORD=tu_password
DB_PORT=5432
UPLOADS_DIR=
PORT=5000
```

### 5.2 Base de datos
1. Crear base de datos `gestionDeportiva`.
2. Cargar esquema base.
3. Aplicar migraciones pendientes en orden.

Ejemplo:
```bash
psql -U postgres -d gestionDeportiva -f database/esquema.sql
psql -U postgres -d gestionDeportiva -f database/migrations/001_reglas_desempate.sql
psql -U postgres -d gestionDeportiva -f database/migrations/002_eliminatorias.sql
psql -U postgres -d gestionDeportiva -f database/migrations/003_equipos_medico.sql
psql -U postgres -d gestionDeportiva -f database/migrations/004_equipos_colores.sql
psql -U postgres -d gestionDeportiva -f database/migrations/005_jugadores_planilla_finanzas_base.sql
psql -U postgres -d gestionDeportiva -f database/migrations/006_finanzas_cuenta_corriente.sql
psql -U postgres -d gestionDeportiva -f database/migrations/007_eventos_campeonato_id_compat.sql
psql -U postgres -d gestionDeportiva -f database/migrations/008_auspiciantes.sql
psql -U postgres -d gestionDeportiva -f database/migrations/009_numeracion_secuencial.sql
psql -U postgres -d gestionDeportiva -f database/migrations/010_auth_roles.sql
psql -U postgres -d gestionDeportiva -f database/migrations/011_auth_password_reset.sql
psql -U postgres -d gestionDeportiva -f database/migrations/012_usuarios_solo_lectura.sql
psql -U postgres -d gestionDeportiva -f database/migrations/013_planes_usuarios.sql
psql -U postgres -d gestionDeportiva -f database/migrations/014_pases_jugadores.sql
psql -U postgres -d gestionDeportiva -f database/migrations/015_campeonato_cedula_opcional.sql
psql -U postgres -d gestionDeportiva -f database/migrations/016_rol_operador_cms.sql
psql -U postgres -d gestionDeportiva -f database/migrations/017_noticias_cms.sql
psql -U postgres -d gestionDeportiva -f database/migrations/018_galeria_cms.sql
psql -U postgres -d gestionDeportiva -f database/migrations/019_portal_contenido_cms.sql
psql -U postgres -d gestionDeportiva -f database/migrations/020_contacto_portal.sql
psql -U postgres -d gestionDeportiva -f database/migrations/021_planilla_ambos_no_presentes.sql
psql -U postgres -d gestionDeportiva -f database/migrations/022_planilla_inasistencia_equipo.sql
psql -U postgres -d gestionDeportiva -f database/migrations/023_bloqueo_morosidad_parametrizable.sql
psql -U postgres -d gestionDeportiva -f database/migrations/024_rol_jugador.sql
psql -U postgres -d gestionDeportiva -f database/migrations/025_planilla_faltas_por_tiempo.sql
psql -U postgres -d gestionDeportiva -f database/migrations/026_ambos_no_presentes_sin_resultado.sql
psql -U postgres -d gestionDeportiva -f database/migrations/027_clasificacion_y_no_presentacion_automatica.sql
psql -U postgres -d gestionDeportiva -f database/migrations/028_auditoria_edicion_planilla.sql
psql -U postgres -d gestionDeportiva -f database/migrations/029_eliminacion_manual_y_clasificacion_manual.sql
psql -U postgres -d gestionDeportiva -f database/migrations/030_evento_playoff_config.sql
psql -U postgres -d gestionDeportiva -f database/migrations/031_usuarios_cambio_password_obligatorio.sql
psql -U postgres -d gestionDeportiva -f database/migrations/032_usuarios_username_opcional.sql
psql -U postgres -d gestionDeportiva -f database/migrations/033_campeonatos_tipos_futbol_ampliados.sql
```

### 5.3 Ejecutar
```bash
cd backend
npm run dev
```

Abrir en navegador:
- Admin/Frontend servido por backend: `http://localhost:5000/admin.html`
- Portal: `http://localhost:5000/index.html`

Tambien puedes abrir frontend con servidor estatico (por ejemplo Live Server), siempre que `window.API_BASE_URL` apunte al backend.

## 6. Scripts
En `backend/package.json`:
- `npm run dev`: inicia con nodemon.
- `npm start`: inicia servidor en modo normal.
- `npm run smoke`: smoke tecnico base.
- `npm run smoke:frontend`: auditoria de guardas frontend por rol.
- `npm run smoke:matrix`: matriz RBAC por usuarios activos de BD.
- `npm run qa:cms`: corrida consolidada (`smoke + smoke:frontend + smoke:matrix`).
- `npm run qa:ui-dataset`: validacion de dataset UI (web + mobile + portal publico).
- `npm run e2e:ops-flow`: verificacion operativa E2E en modo solo lectura sobre datos reales (campeonato/categoria/equipos/grupos/partidos/planilla/tablas/finanzas/portal).

## 7. Endpoints Utiles
- Salud del servidor: `GET /salud`
- Test de conexion DB: `GET /testDb`
- Listado de tablas DB: `GET /tablas`

APIs principales:
- `/api/campeonatos`
- `/api/eventos`
- `/api/equipos`
- `/api/jugadores`
- `/api/sorteo`
- `/api/grupos`
- `/api/partidos`
- `/api/tablas`
- `/api/eliminatorias`
- `/api/finanzas`
- `/api/auth/organizadores/:id/landing`
- `/api/noticias`
- `/api/galeria`
- `/api/portal-contenido`
- `/api/contacto`
- `/api/public/noticias`
- `/api/public/galeria`
- `/api/public/portal-contenido`
- `/api/public/contacto`

## 8. Modulos Implementados
Resumen rapido (detalle completo en `docs/ESTADO_IMPLEMENTACION_SGD.md`):
- Campeonatos: alto
- Eventos/categorias: alto
- Equipos: alto
- Jugadores: medio-alto
- Sorteo y grupos: alto
- Fixture/partidos: alto
- Planillaje oficial: alto (en pulido UX final)
- Tablas/estadisticas: medio-alto
- Portal publico: alto
- CMS portal publico: en progreso
- Finanzas: medio-alto
- RBAC/seguridad: medio-alto

## 9. Documentacion del Proyecto
- Indice general de documentos: `docs/INDICE_DOCUMENTACION.md`
- Bitacora operativa viva: `docs/BITACORA_AVANCES.md`
- Estado por modulo vs propuesta: `docs/ESTADO_IMPLEMENTACION_SGD.md`
- Cambios implementados historicos: `docs/CAMBIOS_IMPLEMENTADOS.md`
- Plan de adaptacion mobile web: `docs/PLAN_MOBILE_LT_C.md`
- Guia operativa para cliente: `docs/GUIA_OPERATIVA_CLIENTE_LT_C.md`
- Guia de video/tutoriales: `docs/GUIA_VIDEO_TUTORIALES_LT_C.md`
- Guia de despliegue en Render: `docs/DEPLOY_RENDER.md`
- Propuesta base del proyecto: `docs/propuestaDesarrolloSGD.md`

## 10. Flujo de Trabajo Recomendado
1. Antes de comenzar:
   - Revisar `docs/BITACORA_AVANCES.md`.
   - Verificar `git status` limpio.
2. Durante la sesion:
   - Registrar decisiones y cambios relevantes.
3. Al cerrar sesion:
   - Actualizar bitacora (fecha, avances, pendientes).
   - Actualizar estado de implementacion si cambia alcance.
   - Commit con mensaje claro por modulo.

## 11. Pendientes Prioritarios
1. Pruebas E2E con datos reales (flujo completo).
2. Validar en operacion real la nueva eliminacion manual por categoria, la promocion automatica de elegibles y la clasificacion manual sugerida antes de cerrar reglas de playoff.
3. Cierre de planillaje oficial (detalle visual y de impresion).
4. RBAC (autenticacion + roles).
5. Completar endurecimiento de seguridad:
   - rotacion operativa de secretos productivos (`DATABASE_URL`, `JWT_SECRET`),
   - politica final de cambio de contraseña y expiracion si el cliente la requiere.
6. Completar perfil de organizador en usuarios: agregar `nombre de la organizacion` y `logo` al crear/editar usuario organizador.
7. Habilitar en portal del organizador la creacion y gestion de usuarios con rol `dirigente` y `tecnico`.
8. En registro publico desde cards de planes pagados, agregar campos:
   - `nombre de la organizacion` (obligatorio),
   - `logo` (opcional),
   - `lema` (opcional).
9. Implementar flujo comercial de onboarding:
   - al seleccionar plan pagado -> formulario de registro completo -> pagina/formulario de cobro -> pasarela de pago.
10. Eliminatorias completas (llaves, reglas operativas y eventual partido extra/reclasificacion automatizado si el cliente lo define).
11. Financiero avanzado (multas automaticas, bloqueos por morosidad, reportes ejecutivos).
12. Plan mobile orientado a app instalable en tiendas:
   - Android (Play Store),
   - iOS (App Store).

## 11.1. Novedades Recientes del Portal Publico
- Las cards de campeonatos ahora muestran resumen por categoria con cantidad de equipos.
- El detalle deportivo de cada campeonato puede abrirse en `portal.html?campeonato=<id>` como pagina compartible con:
  - header completo,
  - tabs por categoria,
  - subtabs de posiciones, goleadores, fair play, tarjetas y playoff,
  - seccion de auspiciantes del campeonato,
  - footer institucional completo.
- Nuevo endpoint publico disponible:
  - `/api/public/campeonatos/:campeonato_id/auspiciantes`

## 12. Solucion de Problemas
- `DB_PASSWORD no definido`: configurar `backend/.env`.
- Error 404 de imagen/logo:
  - local: verificar rutas en `backend/uploads`,
  - despliegue: verificar `UPLOADS_DIR`, el contenido del disco persistente y la URL normalizada en BD.
- Frontend no conecta API: revisar `API_BASE_URL` y puerto del backend.
- Verificacion rapida:
  - `http://localhost:5000/salud`
  - `http://localhost:5000/testDb`

## Notas de Versionado
- `backend/uploads/` y cualquier ruta definida por `UPLOADS_DIR` deben permanecer fuera del versionado (runtime).
- Dumps pesados de DB deben mantenerse fuera del flujo principal de commits.
- No incluir secretos reales en archivos `.env`.
