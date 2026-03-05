# Resultado QA CMS - 2026-03-05

## Alcance ejecutado
Pruebas automáticas y de seguridad sobre CMS/portal público en entorno local.

## Entorno
- Fecha: 2026-03-05
- Backend levantado localmente en `http://localhost:5000`
- Fuente: backend principal LT&C (compatible con consumo mobile)

## Resultado de pruebas automáticas

1. Endpoints públicos base:
- `GET /api/public/portal-contenido` -> `200` OK
- `GET /api/public/noticias` -> `200` OK

2. Endpoints CMS privados sin token:
- `GET /api/noticias` -> `401` OK (protegido)
- `GET /api/campeonatos` -> `401` OK (protegido)

3. Smoke técnico de integración (`npm run smoke`):
- fecha ejecución: `2026-03-05`
- cobertura:
  - `GET /salud` -> `200`
  - `GET /testDb` -> `200`
  - `GET /api/public/campeonatos` -> `200`
  - `GET /api/public/noticias` -> `200`
  - `GET /api/noticias` sin token -> `401`
  - `GET /api/campeonatos` sin token -> `401`
  - `GET /api/mobile/v1/session` sin token -> `401`
  - `GET /api/mobile/v1/eventos/1/sorteo` sin token -> `401`
  - `POST /api/mobile/v1/finanzas/movimientos` sin token -> `401`
- resultado: `9/9 PASS`

3.1 Smoke RBAC mobile (`npm run smoke:roles`):
- fecha ejecución: `2026-03-05`
- roles evaluados: `organizador`, `tecnico`, `dirigente`
- checks por rol:
  - `session` (`GET /api/mobile/v1/session`) -> `200`
  - `refresh` (`POST /api/auth/refresh`) -> `200`
  - `usuarios-scope` (`GET /api/mobile/v1/usuarios`) -> `200` solo organizador, `403` tecnico/dirigente
  - `campeonatos-write-guard` (`POST /api/mobile/v1/campeonatos`) -> `400` organizador (validacion de payload), `403` tecnico/dirigente
  - `eventos-write-guard` (`POST /api/mobile/v1/eventos`) -> `400` organizador, `403` tecnico/dirigente
  - `finanzas-write-guard` (`POST /api/mobile/v1/finanzas/movimientos`) -> `400` organizador, `403` tecnico/dirigente
- resultado: `18/18 PASS`

3.2 Auditoría de guard frontend por rol (`npm run smoke:frontend`):
- fecha ejecución: `2026-03-05`
- fuente evaluada: `frontend/js/core.js` (`canAccessPage`, `getDefaultPageByRole`)
- cobertura:
  - acceso anónimo solo a páginas públicas,
  - `administrador` acceso a deportivo + CMS,
  - `operador` acceso exclusivo a CMS/portal público,
  - `organizador` sin acceso a páginas CMS,
  - `tecnico/dirigente` sin acceso a CMS ni módulos administrativos deportivos,
  - `jugador` sin acceso a CMS ni `pases`.
- resultado: `38/38 PASS`

3.3 Matriz RBAC por rol usando usuarios activos de BD (`npm run smoke:matrix`):
- fecha ejecución: `2026-03-05`
- roles cubiertos: `administrador`, `operador`, `organizador`, `tecnico`, `dirigente`, `jugador`
- endpoints cubiertos:
  - CMS privados: `/api/noticias`, `/api/galeria`, `/api/portal-contenido`, `/api/contacto`
  - Deportivo: `/api/campeonatos`
  - Mobile: `/api/mobile/v1/session`, `/api/mobile/v1/usuarios`
  - Web usuarios: `/api/auth/usuarios`
- resultado: `48/48 PASS`

3.4 Smoke con cuentas provistas por app mobile (`npm run smoke:provided`):
- fecha ejecución: `2026-03-05`
- cuentas validadas por login real:
  - `organizador`,
  - `tecnico`,
  - `dirigente`.
- cobertura por cuenta:
  - `session` + `refresh`,
  - lectura `mobile-usuarios`,
  - guardas de escritura mobile (campeonatos/finanzas),
  - denegación CMS para roles no permitidos.
- resultado: `27/27 PASS`

3.5 Corrida consolidada de QA CMS (`npm run qa:cms`):
- fecha ejecución: `2026-03-05`
- bloque ejecutado:
  - `smoke` (`9/9 PASS`)
  - `smoke:frontend` (`38/38 PASS`)
  - `smoke:matrix` (`48/48 PASS`)
- resultado consolidado: **`95/95 PASS`**

4. Contacto público (hardening):
- Rate-limit por `IP + email`:
  - intento 1 -> `201`
  - intento 2 -> `201`
  - intento 3 -> `201`
  - intento 4 -> `429`
  - Resultado: OK
- Honeypot `website`:
  - envío con `website` poblado -> `201` (aceptación silenciosa)
  - Resultado: OK
- Mensaje demasiado corto:
  - `POST /api/public/contacto` con `mensaje='hola'` -> `400`
  - Resultado: OK

## Estado de verificación por bloque
- Seguridad pública CMS: **OK**
- Protección anti-spam de contacto: **OK**
- Endpoints públicos del portal: **OK**
- Restricción de API CMS sin autenticación: **OK**

## QA manual por rol (API autenticada)

### Usuarios QA creados para prueba
- `operador` (id `4`)
- `organizador` (id `5`)
- `tecnico` (id `6`)
- `dirigente` (id `7`)
- `jugador` (id `8`)

### Matriz final
- `administrador`:
  - `GET /api/noticias` -> `200`
  - `GET /api/campeonatos` -> `200`
- `operador`:
  - `GET /api/noticias` -> `200`
  - `GET /api/campeonatos` -> `403`
- `organizador`:
  - `GET /api/noticias` -> `403`
  - `GET /api/campeonatos` -> `200`
- `tecnico`:
  - `GET /api/noticias` -> `403`
  - `GET /api/campeonatos` -> `200`
- `dirigente`:
  - `GET /api/noticias` -> `403`
  - `GET /api/campeonatos` -> `200`
- `jugador`:
  - `GET /api/noticias` -> `403`
  - `GET /api/campeonatos` -> `200`

### Hallazgo y corrección aplicada
- Hallazgo inicial: `operador` accedía a `GET /api/campeonatos` con `200`.
- Corrección: `backend/routes/campeonatoRoutes.js`
  - `GET /` y `GET /:id` ahora usan:
    - `requireAuth`
    - `requireRoles(\"administrador\", \"organizador\", \"tecnico\", \"dirigente\", \"jugador\")`
- Resultado post-fix: `operador` recibe `403` en `campeonatos` y mantiene acceso CMS.

### Hallazgo adicional y corrección
- Hallazgo: `POST /api/noticias/:id/publicar` y `despublicar` devolvían `500`.
- Causa: conflicto de tipado SQL en `Noticia.cambiarEstado` al reusar el parámetro `$1`.
- Corrección: casteo explícito a `varchar` en la consulta de actualización.
- Validación post-fix:
  - `create noticia` -> `201`
  - `publicar` -> `200`
  - `despublicar` -> `200`
  - `operador` mantiene CRUD noticias (`create/publish/delete` en `201/200/200`).

## Control operativo opcional previo a despliegue
1. Validar en navegador (UI) con `administrador`:
- CRUD completo en noticias/galería/contenido/contacto.
2. Validar en navegador (UI) con `operador`:
- CRUD CMS permitido,
- acceso denegado a pantallas deportivas.
3. Validar en navegador (UI) con `organizador`, `tecnico`, `dirigente`, `jugador`:
- denegación de pantallas CMS (redirección/control de navegación).

## Conclusión
La Fase 6 CMS queda técnicamente reforzada y validada para cierre con evidencia automatizada por API, RBAC y guard frontend. La corrida visual/manual por rol queda como control operativo opcional previo a despliegue.
