# Checklist QA - CMS Portal Publico LT&C

Ultima actualizacion: 2026-03-05

## Objetivo
Validar que el CMS institucional (noticias, galeria, contenido y contacto) quede estable para uso real sin afectar el panel deportivo ni la app movil consumidora del backend.

## 1. Accesos por rol
- `administrador`:
  - puede entrar a `portal-cms.html`.
  - puede entrar a `noticias.html`, `galeria-admin.html`, `contenido-portal.html`, `contacto-admin.html`.
  - puede usar CRUD completo en todos esos modulos.
- `operador`:
  - puede entrar a `portal-cms.html`.
  - puede usar CRUD en noticias, galeria, contenido y contacto.
  - no debe entrar a modulos deportivos (`campeonatos`, `equipos`, `planilla`, `finanzas`).
- `organizador`:
  - no puede entrar a pantallas CMS.
  - no puede consumir `/api/noticias`, `/api/galeria`, `/api/portal-contenido`, `/api/contacto`.
- `tecnico`, `dirigente`, `jugador`:
  - no pueden entrar a pantallas CMS.
  - no pueden consumir APIs privadas CMS.

## 2. Noticias / Blog
- Crear noticia en `borrador`.
- Editar noticia y cambiar `slug`.
- Publicar noticia y validar que aparece en `blog.html`.
- Abrir detalle por `noticia.html?slug=...`.
- Despublicar noticia y validar que desaparece del blog publico.
- Eliminar noticia y validar remocion en listado admin y blog publico.

## 3. Galeria
- Crear item con URL valida (https).
- Editar orden y estado.
- Validar orden en landing publica.
- Desactivar item y validar que no aparezca en portal publico.
- Probar URL invalida y confirmar rechazo (HTTP 400).

## 4. Contenido institucional
- Editar hero, seccion nosotros, contacto y cards.
- Validar persistencia tras recargar pantalla de admin.
- Validar reflejo de cambios en `index.html`.
- Probar enlaces invalidos en redes y confirmar rechazo (HTTP 400).
- Probar email de contacto invalido y confirmar rechazo (HTTP 400).

## 5. Contacto publico
- Enviar mensaje valido desde formulario publico.
- Confirmar registro en `contacto-admin.html`.
- Cambiar estado: `nuevo -> leido -> respondido -> archivado`.
- Validar anti-spam:
  - realizar 4 envios consecutivos con mismo IP+email en menos de 10 minutos,
  - el cuarto debe responder `429`.
- Validar honeypot:
  - enviar campo `website` con valor,
  - backend debe responder `ok` sin crear mensaje real.

## 6. No regresiones deportivas
- Confirmar que login/admin/organizador siguen operativos en:
  - campeonatos,
  - categorias/eventos,
  - equipos/jugadores,
  - partidos/planilla,
  - finanzas.
- Confirmar que mobile endpoints deportivos no cambian contrato por este bloque CMS.

## 7. Criterio de cierre de fase
- Todos los checks anteriores en verde.
- Sin errores 500 en consola backend durante flujo QA.
- Documentacion actualizada (`BITACORA`, `ESTADO`, `PLAN_CMS`).

## 8. Estado de ejecucion actual (2026-03-05)
- Ejecutado y validado:
  - seguridad pública CMS (endpoints y anti-spam),
  - matrix API por rol (`administrador`, `operador`, `organizador`, `tecnico`, `dirigente`, `jugador`),
  - auditoria de guard frontend por rol (`canAccessPage` y `getDefaultPageByRole`) con `smoke:frontend`,
  - corrección de fuga de `operador` a `/api/campeonatos`,
  - corrección de `500` en publicar/despublicar noticias,
  - smoke de cuentas provistas por app mobile (`smoke:provided`) en `organizador/tecnico/dirigente`.
- Estado:
  - Fase 6 cerrada técnicamente.
  - El recorrido visual/manual en navegador por rol queda como control operativo opcional previo a despliegue.
