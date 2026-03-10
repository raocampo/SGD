# Despliegue en Render

Ultima actualizacion: 2026-03-10

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
UPLOADS_DIR=/var/data/uploads
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
5. Define tambien la ruta persistente de archivos:
```env
UPLOADS_DIR=/var/data/uploads
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
5. Agrega un disco persistente:
   - `Name`: `uploads`
   - `Mount path`: `/var/data`
   - `Size`: segun necesidad (recomendado 5 GB o mas si manejaras fotos/documentos)

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

## Uploads estables en Render
El backend ya soporta `UPLOADS_DIR`.

Comportamiento:
1. Si `UPLOADS_DIR` no esta definido:
   - usa `backend/uploads` (solo adecuado para local).
2. Si `UPLOADS_DIR` esta definido:
   - escribe, lee y elimina archivos desde esa ruta,
   - mantiene las URLs publicas como `/uploads/...`.

Configuracion recomendada en Render:
```env
UPLOADS_DIR=/var/data/uploads
```

Con esto:
- el servicio sigue sirviendo archivos por `https://tu-servicio.onrender.com/uploads/...`
- los archivos viven en el disco persistente y sobreviven a reinicios/redeploys

## Restaurar la carpeta de uploads actual
La base de datos ya puede restaurarse por dump, pero los logos/fotos/documentos existentes requieren copiar tambien la estructura de archivos.

Debes preservar la misma estructura relativa:
```text
uploads/
  campeonatos/
  equipos/
  jugadores/
  auspiciantes/
  noticias/
  galeria/
  portal/
```

El contenido actual de `backend/uploads/` debe copiarse dentro de `UPLOADS_DIR`.

En Render, el destino practico es:
```text
/var/data/uploads
```

Por tanto, el objetivo final es:
```text
/var/data/uploads/campeonatos
/var/data/uploads/equipos
/var/data/uploads/jugadores
...
```

## Checklist de uploads despues del deploy
1. Crear el disco persistente.
2. Definir `UPLOADS_DIR=/var/data/uploads`.
3. Redeploy del servicio.
4. Verificar que el backend arranca sin errores.
5. Copiar el contenido historico de `backend/uploads/` al disco persistente.
6. Probar URLs reales:
   - `https://tu-servicio.onrender.com/uploads/campeonatos/...`
   - `https://tu-servicio.onrender.com/uploads/equipos/...`
   - `https://tu-servicio.onrender.com/uploads/jugadores/...`

## Recomendacion de mediano plazo
Para operacion real a escala, conviene evaluar almacenamiento externo:
- S3 compatible
- Cloudinary
- Supabase Storage

Pero para la primera salida productiva en Render, disco persistente + `UPLOADS_DIR` es la via mas pragmatica.

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
