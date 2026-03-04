# Plan CMS Portal Publico LT&C

Ultima actualizacion: 2026-03-04

## Objetivo
Separar formalmente el portal web publico de LT&C del panel de gestion deportiva, de forma que:

- el backend principal siga siendo la unica fuente de datos,
- el equipo mobile pueda consumir el backend sin cambios disruptivos,
- el contenido institucional/publico no dependa de organizadores,
- exista un rol dedicado para operar el CMS del portal.

## Regla de negocio base

### Dominio 1: Gestion deportiva
- Roles: `administrador`, `organizador`, `tecnico`, `dirigente`
- Modulos:
  - campeonatos
  - categorias/eventos
  - equipos
  - jugadores
  - sorteo/grupos
  - partidos/planilla
  - tablas/estadisticas
  - finanzas
  - carnets

### Dominio 2: Portal web publico / CMS
- Roles: `administrador`, `operador`
- Modulos:
  - noticias
  - blog
  - galeria
  - nosotros
  - cards/home
  - formulario de contacto
  - banners / bloques institucionales

## Regla de acceso
- `administrador`: acceso total a gestion deportiva y CMS.
- `operador`: acceso exclusivo a CMS publico.
- `organizador`: sin acceso al CMS publico institucional.
- `tecnico` y `dirigente`: sin acceso al CMS publico institucional.

## Fases de implementacion

### Fase 1: Separacion base de roles y accesos
Objetivo: dejar la arquitectura preparada para el CMS sin afectar el panel deportivo ni el consumo mobile.

Entregables:
- nueva migracion para rol `operador`,
- actualizacion de validaciones backend de usuarios/roles,
- permisos de sesion para `operador`,
- restriccion de noticias a `administrador` + `operador`,
- panel base `portal-cms.html`,
- redireccion y control de acceso frontend para `operador`,
- alta/edicion de `operador` desde `usuarios.html` solo por `administrador`.

Estado: base cerrada y operativa.

### Fase 2: Noticias / Blog
Objetivo: habilitar gestion editorial real del portal publico.

Entregables:
- CRUD visual de noticias,
- campos editoriales definidos,
- borrador/publicacion,
- slugs publicos,
- integracion con landing publica.

Estado: base operativa iniciada.

### Fase 3: Galeria
Objetivo: administrar contenido visual institucional del portal.

Entregables:
- categorias de galeria,
- carga de imagenes,
- orden y estado,
- vista publica.

Estado: base operativa iniciada.

### Fase 4: Contenido institucional
Objetivo: administrar secciones estaticas del portal sin editar codigo.

Entregables:
- seccion Nosotros,
- cards del home,
- banners principales,
- precios / planes,
- bloques destacados.

Estado: base operativa iniciada.

### Fase 5: Contacto
Objetivo: centralizar y administrar mensajes del formulario del portal.

Entregables:
- persistencia de mensajes,
- estados de seguimiento,
- datos de contacto configurables,
- posible integracion futura con correo/WhatsApp.

Estado: base operativa iniciada.

### Fase 6: Cierre operativo
Objetivo: dejar el CMS listo para uso real.

Entregables:
- pruebas por rol,
- endurecimiento de permisos,
- documentacion de despliegue,
- respaldo/migraciones actualizadas,
- checklist de QA para web publica.

Estado: pendiente.

## Criterios tecnicos
- Ninguna tabla nueva del CMS debe depender de auto-creacion silenciosa en runtime como estrategia principal.
- Todo cambio estructural debe tener migracion SQL versionada.
- El backend mobile no debe consumir controladores internos del frontend web administrativo.
- El CMS no debe reutilizar vistas del panel deportivo salvo componentes visuales compartidos.
- El organizador no debe operar contenido institucional/publico de LT&C.

## Riesgos identificados al inicio
- noticias actualmente abiertas a `organizador`,
- rol `operador` inexistente en validaciones y BD,
- panel `portal-admin` mezclado con gestion deportiva,
- ausencia de segregacion entre contenido institucional y landing de organizador.

## Secuencia recomendada inmediata
1. Cerrar Fase 1.
2. Crear CRUD visual de noticias.
3. Definir estructura de galeria.
4. Crear modelo editable para home/nosotros/contacto.

## Estado real al cierre de esta iteracion

- Fase 1:
  - rol `operador` agregado al dominio CMS,
  - permisos y redireccion de acceso ajustados,
  - noticias restringidas a `administrador` y `operador`.
- Fase 2:
  - CRUD base de noticias en `frontend/noticias.html`,
  - vistas publicas `frontend/blog.html` y `frontend/noticia.html`,
  - integracion de ultima noticia en landing.
- Fase 3:
  - modelo, controlador, rutas y migracion base de galeria,
  - nueva administracion `frontend/galeria-admin.html`,
  - consumo publico de galeria en la landing.
- Fase 4:
  - modelo editable `portal_contenido` para hero, nosotros, cards y datos de contacto/redes,
  - nueva administracion `frontend/contenido-portal.html`,
  - landing conectada a `/api/public/portal-contenido`.
- Fase 5:
  - persistencia base de mensajes de contacto,
  - nueva administracion `frontend/contacto-admin.html`,
  - formulario publico conectado a `/api/public/contacto`.
- Fase 6:
  - pendiente endurecimiento de permisos, pruebas funcionales completas y cierre operativo.

## Nota de coexistencia con app movil

- El backend de este repositorio se mantiene como fuente principal de datos para web y app movil.
- Los cambios de esta iteracion (morosidad en modo aviso y nuevo rol `jugador`) no rompen el consumo mobile:
  - se conserva compatibilidad de endpoints existentes,
  - se mantiene retorno de `aviso_morosidad` como mensaje informativo en planilla,
  - no se introduce bloqueo transaccional por deudas en guardado de planilla.
