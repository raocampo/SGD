# Despliegue en Render

Ultima actualizacion: 2026-03-09

## Enfoque recomendado
Este proyecto ya esta preparado para desplegarse como un solo Web Service en Render:

- `backend/server.js` sirve la API bajo `/api`
- el mismo backend sirve el frontend de `frontend/`
- el frontend consume la API por mismo origen (`/api`) en produccion

No hace falta separar `frontend` y `backend` en dos servicios distintos para una primera publicacion.

## Archivos clave ya preparados
- `render.yaml`
- `backend/config/database.js`
- `backend/.env.example`

## Requisitos previos
1. Repositorio actualizado en GitHub.
2. Base de datos PostgreSQL 14+ disponible.
3. Variables de entorno listas para Render.

## Opcion A: Render con base de datos externa
Usa cualquier PostgreSQL compatible y pasa la cadena completa por `DATABASE_URL`.

Variables minimas:
```env
NODE_ENV=production
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME
DATABASE_SSL=false
JWT_SECRET=un-secret-largo-y-unico
FRONTEND_RESET_URL=https://tu-servicio.onrender.com/login.html
```

Variables opcionales:
```env
CORS_ORIGINS=https://tu-servicio.onrender.com,https://www.tudominio.com
AUTH_ADMIN_EMAIL=
AUTH_ADMIN_PASSWORD=
AUTH_ADMIN_NOMBRE=Administrador SGD
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=false
SMTP_IGNORE_TLS=false
MAIL_FROM=
```

## Opcion B: Render + PostgreSQL de Render
Si creas una base administrada en Render:

1. Crea el Postgres desde el dashboard.
2. Copia la `External Database URL` o `Internal Database URL`.
3. Pega esa URL en `DATABASE_URL` del Web Service.
4. Si tu URL requiere SSL, define:
```env
DATABASE_SSL=true
```

## Creacion del servicio
### Metodo recomendado: Blueprint
1. En Render: `New` -> `Blueprint`.
2. Conecta el repositorio.
3. Render detectara `render.yaml`.
4. Crea el servicio `sgd-ltc`.
5. Antes de confirmar, completa las variables obligatorias.

### Metodo manual: Web Service
1. En Render: `New` -> `Web Service`.
2. Conecta el repositorio.
3. Usa estos valores:
   - `Build Command`: `npm install --prefix backend`
   - `Start Command`: `npm start --prefix backend`
   - `Health Check Path`: `/salud`
   - `Runtime`: `Node`
4. Agrega las variables de entorno.

## Migraciones y esquema
Render no aplica tus migraciones automaticamente.

Debes cargar:
1. `database/esquema.sql`
2. migraciones pendientes en `database/migrations/`

Opciones practicas:
- restaurar un dump ya consolidado
- ejecutar las migraciones manualmente desde tu entorno local contra la BD remota
- usar un script posterior, si luego quieres automatizarlo

## Verificacion posterior al deploy
Prueba estas rutas:
- `https://tu-servicio.onrender.com/salud`
- `https://tu-servicio.onrender.com/testDb`
- `https://tu-servicio.onrender.com/index.html`
- `https://tu-servicio.onrender.com/login.html`
- `https://tu-servicio.onrender.com/portal.html`

Checklist minima:
1. login funcional
2. lectura de campeonatos
3. logos/imagenes cargando desde `/uploads`
4. portal publico mostrando torneos
5. modulo financiero y planillaje leyendo datos reales

## Limitacion importante: uploads
`backend/uploads/` es almacenamiento local del servidor.

En Render:
- un deploy o reinicio puede dejarte sin persistencia si no usas almacenamiento persistente
- logos, fotos de jugadores, cedulas, auspiciantes y adjuntos son sensibles a esto

Recomendacion operativa:
1. para pruebas: puedes desplegar asi y validar flujo
2. para produccion real:
   - usar disco persistente si tu plan lo permite, o
   - mover uploads a almacenamiento externo (S3, Cloudinary, Supabase Storage, etc.)

## Dominio personalizado
Cuando el servicio ya responda:
1. agrega tu dominio en Render
2. configura el DNS segun Render
3. actualiza:
```env
CORS_ORIGINS=https://tu-dominio.com,https://www.tu-dominio.com
FRONTEND_RESET_URL=https://tu-dominio.com/login.html
```

## Observaciones tecnicas
- El backend ahora acepta `DATABASE_URL` ademas de `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
- El frontend deja de depender de `http://localhost:5000/api` en produccion y usa mismo origen.
- En entorno local con Live Server sigue pudiendo caer a `localhost:5000` como compatibilidad de desarrollo.
