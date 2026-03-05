# Guia de Despliegue - CMS Portal Publico LT&C

Ultima actualizacion: 2026-03-05

## Alcance
Esta guia cubre despliegue del CMS institucional (noticias, galeria, contenido, contacto) sobre el backend principal, manteniendo compatibilidad con frontend web y app movil.

## 1. Requisitos previos
- Backend y frontend en la misma version de `main`.
- Variables de entorno de backend configuradas (`DB_*`, `JWT_SECRET`, correo SMTP si aplica).
- Base de datos PostgreSQL accesible.

## 2. Migraciones minimas requeridas para CMS
Ejecutar en orden:
1. `database/migrations/016_rol_operador_cms.sql`
2. `database/migrations/017_noticias_cms.sql`
3. `database/migrations/018_galeria_cms.sql`
4. `database/migrations/019_portal_contenido_cms.sql`
5. `database/migrations/020_contacto_portal.sql`

## 3. Verificacion post-migracion
- Confirmar tablas:
  - `noticias`
  - `galeria_items`
  - `portal_contenido`
  - `contacto_mensajes`
- Confirmar que existe `rol='operador'` permitido en `usuarios`.

## 4. Arranque de servicios
- Backend:
  - iniciar servicio Node del backend.
  - verificar `/api/public/portal-contenido` responde `200`.
- Frontend:
  - iniciar servidor estatico del frontend.
  - abrir `index.html`, `blog.html`, `noticia.html`.

## 5. Verificaciones funcionales minimas
- Con `administrador`:
  - entrar a `portal-cms.html`,
  - crear noticia y publicarla,
  - crear item de galeria,
  - actualizar contenido institucional,
  - revisar bandeja de contacto.
- Con `operador`:
  - repetir pruebas CRUD CMS,
  - confirmar que no accede a modulos deportivos.
- Con `organizador`:
  - confirmar bloqueo de acceso CMS (frontend y API privada CMS).

## 5.1 Smoke tecnico recomendado (web + mobile + CMS)
Desde `backend/` ejecutar:

```bash
npm run smoke
```

El smoke valida en pocos segundos:
- salud y conectividad a BD,
- endpoints publicos del portal,
- bloqueo de endpoints privados CMS/deportivo sin token (`401`),
- bloqueo de endpoints mobile sin token (`401`).

Variables opcionales:
- `SMOKE_BASE_URL` (default `http://localhost:5000`)
- `SMOKE_TIMEOUT_MS` (default `12000`)
- `SMOKE_TOKEN` (si se desea probar checks autenticados opcionales)

Validacion RBAC mobile (opcional):

```bash
npm run smoke:roles
```

Notas:
- crea o reutiliza usuarios QA por rol (`organizador`, `tecnico`, `dirigente`) con prefijo `qa.*@ltc.local`,
- valida sesion/refresh y guardas de escritura en endpoints mobile.

Corrida consolidada recomendada para release CMS:

```bash
npm run qa:cms
```

Incluye:
- `smoke`,
- `smoke:frontend`,
- `smoke:matrix`.

Matriz RBAC completa (recomendado para cierre de release):

```bash
npm run smoke:matrix
```

Notas:
- usa usuarios activos existentes por rol en la BD (`administrador`, `operador`, `organizador`, `tecnico`, `dirigente`, `jugador`),
- valida permisos esperados en endpoints CMS, deportivo, mobile y usuarios web.

Auditoria de guard frontend por rol:

```bash
npm run smoke:frontend
```

Notas:
- ejecuta pruebas sobre `frontend/js/core.js`,
- valida `canAccessPage` y `getDefaultPageByRole` para asegurar redirecciones/permisos por rol.

Smoke de cuentas provistas (equipo app mobile):

```bash
npm run smoke:provided
```

Notas:
- usa variables `SMOKE_*_EMAIL` y `SMOKE_*_PASSWORD`,
- recomendado cuando se validan credenciales reales compartidas entre equipos.

## 6. Endurecimiento aplicado
- Validaciones de URLs CMS:
  - solo `http/https` o rutas relativas seguras en campos permitidos.
- Validaciones de formato:
  - email institucional valido en contenido portal,
  - longitudes maximas en textos clave.
- Contacto publico:
  - limite por IP+email (`3` envios cada `10` minutos),
  - honeypot `website` para mitigar bots basicos.

## 7. Rollback funcional
Si falla el despliegue:
1. restaurar backup de BD previo,
2. volver al commit anterior estable,
3. reiniciar backend,
4. revalidar endpoints publicos y login.

## 8. Evidencia recomendada de cierre
- Capturas de:
  - `portal-cms.html`,
  - `noticias.html` con item publicado,
  - `galeria-admin.html`,
  - `contenido-portal.html`,
  - `contacto-admin.html`.
- Resultado de checklist QA:
  - `docs/CHECKLIST_QA_CMS_PORTAL_PUBLICO.md`.
