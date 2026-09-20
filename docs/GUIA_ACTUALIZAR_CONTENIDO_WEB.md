# Guía: cómo actualizar imágenes, texto y contenido de la página (LT&C)

Ultima actualizacion: 2026-09-19

## Objetivo

Dejar documentado, en un solo lugar, **cómo se actualiza cada parte visible del
sitio** (`index.html` y el portal público en general): qué se cambia desde un
panel sin tocar código, qué requiere subir un archivo, y qué todavía exige
editar código + `git commit` + `git push` + esperar el deploy. Esto evita
repetir lo que pasó el 19-sep-2026: se copiaron imágenes nuevas del slider
directo en la carpeta de `assets`, pero `index.html` seguía apuntando a los
nombres viejos y el carrusel quedó roto hasta que se sincronizó manualmente
(ver `BITACORA_AVANCES.md` sección `2026-09-19`).

## Resumen — 4 formas de actualizar contenido, según qué es

| # | Tipo de contenido | Dónde se edita | ¿Necesita deploy/redeploy? | Rol necesario |
|---|---|---|---|---|
| 1 | Textos del home institucional (hero, "quiénes somos", contacto, redes, 3 tarjetas) | `portal-cms.html` | No — se guarda en BD, se ve al recargar | `administrador` / `operador` |
| 2 | Imágenes con selector de archivo real (logo de auspiciante, escudo de equipo, foto de jugador, comprobantes, avatar de usuario) | Formularios propios de cada módulo (`auspiciantes.html`, `equipos.html`, `jugadores.html`, `usuarios.html`, etc.) | No — sube a `/uploads` en el backend y queda servido al instante | Según el módulo (admin/organizador) |
| 3 | Imágenes que piden **URL de imagen** en vez de selector de archivo (galería, noticias, imagen de "quiénes somos" del CMS) | `galeria-admin.html`, `noticias.html`, `portal-cms.html` (campo `about_image_url`) | No, pero **hoy no hay botón "subir archivo" ahí** — hay que conseguir la URL primero (ver más abajo) | `administrador` / `operador` |
| 4 | Contenido 100% estático en el código: slider de banners publicitarios y slider de fondo del hero en la portada, textos que no están en el CMS, estructura de secciones | Archivos del repo (`frontend/index.html`, `frontend/css/portal.css`, `frontend/assets/ltc/home/slider/`) | **Sí** — commit + push + esperar el deploy de Vercel (frontend) | Acceso al repo (equipo técnico) |

---

## Vía 1 — Textos del home institucional (`portal-cms.html`)

Entrar como `administrador` u `operador` → sección **Contenido del portal**
(`portal-cms.html`). Los campos disponibles hoy (tabla `portal_contenido`,
fila única, modelo `backend/models/PortalContenido.js`):

- **Hero**: título, descripción, chip (etiqueta pequeña), texto del botón CTA.
- **Quiénes somos**: título, párrafo 1, párrafo 2, y `about_image_url`
  (ver Vía 3 — es un campo de texto, no un selector de archivo).
- **Contacto**: título, descripción, email, teléfono.
- **Redes sociales**: Facebook, Instagram, WhatsApp (URLs completas).
- **3 tarjetas de características** (`cards_json`): título + descripción +
  icono (nombre de un icono de Font Awesome, ej. `fa-layer-group`).

Guardar ahí se refleja de inmediato en `index.html` (y en la landing pública
`/liga/<slug>` cuando el organizador no personalizó su propio contenido) sin
necesidad de ningún deploy — el frontend lo lee vía
`GET /api/public/portal-contenido`.

## Vía 2 — Módulos con carga real de archivo (multer → `/uploads`)

Estos formularios sí tienen un botón para elegir un archivo del computador
(`<input type="file">`) y lo suben al backend (carpeta `backend/uploads/...`,
servida en runtime en `/uploads/...`, sin pasar por git):

- `auspiciantes.html` → logo del auspiciante.
- `equipos.html` → escudo del equipo.
- `jugadores.html` → foto del jugador.
- `usuarios.html` → foto/avatar según el rol.
- `register.html` → documento de identidad / comprobante.
- Módulos de planillaje (`planilla.html`, `tablasplantilla.html`,
  `fixtureplantilla.html`, `jornadasplantilla.html`, `gruposgen.html`,
  `eliminatorias.html`) → importación de archivos (Excel/CSV), no imágenes.

Estos **no requieren tocar código ni hacer deploy**: se sube el archivo, el
backend lo guarda y lo sirve de inmediato.

> Nota de infraestructura: en Railway, si el disco no es un volumen
> persistente, un redeploy del backend puede borrar lo subido a `/uploads`.
> Confirmarlo antes de depender de esto para contenido que no se quiera
> volver a subir (pendiente de verificar, no confirmado en esta sesión).

## Vía 3 — Campos que piden "URL de imagen" (sin selector de archivo)

`galeria-admin.html`, `noticias.html` y el campo `about_image_url` de
`portal-cms.html` **no tienen hoy un botón de subir archivo** — piden una URL
ya existente. Dos formas de conseguir esa URL sin tocar código:

1. **Reusar una imagen que ya subiste por la Vía 2** (por ejemplo, un logo de
   auspiciante ya subido queda en algo como
   `https://api.ltyc.corpsimtelec.com/uploads/auspiciantes/169..._logo.png`).
   Copiar esa URL y pegarla en el campo de galería/noticias/`about_image_url`
   funciona, pero mezcla contenido de módulos distintos — usar solo si no
   importa que la imagen "pertenezca" lógicamente a otro módulo.
2. **Subir la imagen al repo** (carpeta `frontend/assets/...`) y usar una ruta
   relativa (`assets/ltc/....png`) — esto sí es la Vía 4, con commit/push.

**Pendiente propuesto** (no implementado, ver sección final): agregar un
selector de archivo real a estos 3 formularios para no depender de ninguna
de las dos opciones de arriba.

## Vía 4 — Contenido estático en el código (sliders de la portada, textos fuera del CMS)

Esto es lo que se hizo el 19-sep-2026 para el slider publicitario. Aplica a:

- **Slider de fondo del hero** (`.ltc-home-hero-slider`, 4 imágenes que rotan
  detrás del título principal).
- **Slider publicitario "Liga Interempresarial"** (`.ltc-home-promo-slider`,
  banners de campañas puntuales).
- Imagen del trofeo, imagen de "bienvenida a equipos", vista previa de la app
  móvil, y cualquier texto de `index.html` que no esté listado en la Vía 1.

### Paso a paso para reemplazar o agregar un banner del slider

1. **Ubicar la carpeta**: `frontend/assets/ltc/home/slider/`.
2. **Copiar el archivo nuevo ahí**, con un nombre descriptivo en minúsculas y
   guiones (convención ya usada: `liga-interempresarial-wide.png`,
   `liga-interempresarial-wide2.png`, `liga-interempresarial-square.jpg`...).
   - `wide` = banner horizontal (≈1920×810, aspecto ~2.37:1).
   - `square` = banner más cuadrado/vertical para el mismo carrusel.
   - Antes de copiar, **optimizar el peso**: hoy varios banners pesan
     2–2.5 MB en PNG. Preferir JPG (fotos con degradados) o WebP, apuntar a
     **≤500 KB** por imagen sin perder legibilidad del texto del banner.
3. **Editar `frontend/index.html`**, sección `.ltc-home-promo-slider`
   (buscar `ltc-home-promo-slider` — hoy ~línea 224): agregar/quitar la
   etiqueta `<img src="assets/ltc/home/slider/<archivo>" alt="<texto
   descriptivo>" />` por cada slide. El `alt` debe describir el contenido del
   banner (para accesibilidad y SEO), no ser genérico.
4. **Si cambia la cantidad de slides**, editar
   `frontend/css/portal.css` → `.ltc-home-promo-slider img` (buscar
   `ltcHomePromoFade`):
   - `animation: ltcHomePromoFade <N * 6>s infinite;` donde `N` = número de
     slides (6s de "tiempo por slide" es la convención actual).
   - Un bloque `.ltc-home-promo-slider img:nth-child(k) { animation-delay:
     <(k-1) * 6>s; }` por cada slide a partir del segundo.
5. **Borrar del repo las imágenes que ya no se usan** (`git rm` o dejarlas si
   se quieren conservar como referencia, pero entonces **no** deben quedar
   huérfanas sin trackear — o se comitean o se sacan de la carpeta servida).
6. **Probar localmente** antes de subir: servir `frontend/` con cualquier
   servidor estático (ej. `npx serve frontend` o un server Node de una línea)
   y confirmar en el navegador que el carrusel rota bien y las rutas
   responden 200.
7. **Commit + push**:
   ```
   git add frontend/index.html frontend/css/portal.css frontend/assets/ltc/home/slider/<archivos>
   git commit -m "feat(home): actualizar slides publicitarios ..."
   git push
   ```
8. **Confirmar el deploy en Vercel** (frontend) — Vercel redepliega
   automáticamente al detectar el push a `main`. Si las imágenes viejas siguen
   apareciendo, es cache del navegador o del CDN de Vercel: hacer hard-refresh
   (`Ctrl+Shift+R`) antes de asumir que falló el deploy.

### Mapa rápido de `index.html` (qué imagen/texto viene de dónde)

| Sección de la portada | Elemento | Fuente |
|---|---|---|
| Hero (arriba de todo) | Título, descripción, chip, botón CTA | Vía 1 (CMS) |
| Hero | 4 imágenes de fondo rotando | Vía 4 (código, `hero-*.png`) |
| Banner "Liga Interempresarial" | 3–5 banners publicitarios | Vía 4 (código, `liga-interempresarial-*`) |
| "Cada torneo con su portal público" | 1 imagen fija | Vía 4 (código, reusa `liga-interempresarial-wide.png`) |
| "Torneos en funcionamiento" | Tarjetas de campeonatos | Dinámico — viene de la API de campeonatos, no se edita a mano |
| "Nuestros clientes" | Logos de organizadores | Dinámico — logo que cada organizador subió (Vía 2, en su propio perfil) |
| "Quiénes somos" | Título, 2 párrafos, imagen | Vía 1 (texto) + Vía 3 (imagen, campo URL) |
| "Premios y planes" | Precios | Dinámico — vienen de la tabla de precios editable en el panel admin |
| 3 tarjetas de características | Título/descripción/icono ×3 | Vía 1 (CMS, `cards_json`) |
| Contacto | Título, descripción, email, teléfono, redes | Vía 1 (CMS) |
| Footer | Logo, enlaces, redes | Logo: Vía 4 (código) · Redes: Vía 1 (CMS) |

---

## Checklist antes de publicar cualquier imagen nueva

- [ ] Formato: JPG/WebP para fotos, PNG solo si necesita transparencia real.
- [ ] Peso objetivo: ≤500 KB por imagen de slider/banner, ≤200 KB para logos.
- [ ] Nombre de archivo en minúsculas, sin espacios ni tildes, descriptivo.
- [ ] `alt` descriptivo (no genérico) si se referencia desde HTML.
- [ ] Si reemplaza un archivo existente con el mismo nombre: hard-refresh
      para descartar cache antes de reportar que "no cambió".
- [ ] Si el archivo viejo ya no se usa en ningún lado: `git rm` (o confirmar
      que no quede sin trackear en la carpeta servida, ver Nota más abajo).

## Nota sobre archivos "de respaldo" sueltos

El 19-sep-2026 quedaron 3 imágenes viejas sin trackear en
`frontend/assets/ltc/home/slider/` (`liga-interempresarial-square12.png`,
`wide-23.png`, `wide12.png`) — copias de seguridad manuales del usuario antes
de reemplazar los banners. **No se subieron a git** a propósito (no están
referenciadas por ningún código y abultarían el repo). Si se quieren guardar
como respaldo, mejor fuera de `frontend/assets/` (que es todo lo que se
publica) — por ejemplo en `docs/imagenes/` o una carpeta local no versionada.

## Recomendación a futuro (propuesta, no implementada)

Para eliminar por completo la Vía 4 (la más lenta, la única que depende del
equipo técnico) y la fricción de la Vía 3 (URLs sin uploader):

1. Agregar un `<input type="file">` real a `galeria-admin.html`,
   `noticias.html` y al campo `about_image_url` de `portal-cms.html`,
   reusando el mismo `multerConfig.js` que ya usan auspiciantes/equipos.
2. Mover el slider de banners publicitarios de la portada
   (`.ltc-home-promo-slider`) a una tabla editable desde `portal-cms.html`
   (array de `{ imagen_url, alt }`, similar a `cards_json`), con upload real.
   Esto permitiría a `administrador`/`operador` cambiar las campañas del
   home sin depender de un commit — justo el caso de uso de esta sesión.
3. Si se hace lo anterior, evaluar mover también el slider de fondo del hero
   (`hero-*.png`) al mismo esquema.

Ver `project_pending.md` (memoria de sesión) para el seguimiento de esta
propuesta.

## Documentos relacionados

- `docs/BITACORA_AVANCES.md` — sección `2026-09-19` (caso real que motivó esta guía).
- `docs/GUIA_OPERATIVA_CLIENTE_LT_C.md` — manual operativo general del cliente.
- `docs/GUIA_DESPLIEGUE_CMS_PORTAL_PUBLICO.md` — despliegue del CMS institucional.
- `docs/PLAN_CMS_PORTAL_PUBLICO.md` — plan maestro del CMS del portal público.
