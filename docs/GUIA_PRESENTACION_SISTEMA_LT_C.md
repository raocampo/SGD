# Guia de Presentacion del Sistema LT&C

Ultima actualizacion: 2026-02-28

## Objetivo
Disponer de un guion claro para presentar el funcionamiento del sistema LT&C sin improvisar el recorrido funcional.

## Recomendacion previa
Antes de presentar:

1. Verificar que el backend este levantado.
2. Verificar conexion a la BD con datos de prueba reales.
3. Confirmar que las migraciones `016`, `017`, `018`, `019` y `020` ya fueron aplicadas.
4. Tener al menos:
   - 1 campeonato creado,
   - 1 categoria creada,
   - varios equipos y jugadores cargados,
   - grupos generados,
   - fixture generado,
   - al menos un partido planillado,
   - 1 noticia publicada,
   - 1 item de galeria,
   - 1 mensaje en contacto.

## Usuarios sugeridos para demo

### 1. Administrador
Usar para mostrar:
- gestion deportiva completa,
- usuarios,
- CMS del portal publico.

### 2. Organizador
Usar para mostrar:
- operacion deportiva de sus campeonatos,
- restriccion de acceso al CMS institucional.

### 3. Tecnico o dirigente
Usar para mostrar:
- acceso limitado,
- visualizacion de equipo/jugadores/tablas/finanzas segun permisos.

### 4. Operador
Usar para mostrar:
- acceso exclusivo al CMS del portal,
- noticias, galeria, contenido y contacto,
- sin acceso al panel deportivo.

## Guion recomendado de presentacion

### Bloque 1: Landing publica
Objetivo: mostrar la cara visible del sistema.

Recorrido:
1. Abrir `index.html`.
2. Mostrar hero principal y branding LT&C.
3. Mostrar cards institucionales.
4. Mostrar seccion de torneos.
5. Mostrar ultima noticia publicada.
6. Mostrar galeria.
7. Mostrar formulario de contacto.

Mensaje clave:
- LT&C no solo administra torneos; tambien publica informacion institucional y comercial del portal.

### Bloque 2: Login y control de acceso
Objetivo: demostrar RBAC.

Recorrido:
1. Ingresar como `administrador`.
2. Mostrar acceso al panel deportivo y al CMS.
3. Cerrar sesion.
4. Ingresar como `organizador`.
5. Mostrar que no accede al CMS institucional.
6. Cerrar sesion.
7. Ingresar como `operador`.
8. Mostrar que entra a `portal-cms.html` y no al panel deportivo.

Mensaje clave:
- el sistema ya separa la operacion deportiva del portal publico institucional.

### Bloque 3: Gestion deportiva
Objetivo: mostrar flujo principal del sistema.

Recorrido sugerido:
1. Campeonatos
2. Categorias
3. Equipos
4. Jugadores
5. Sorteo
6. Grupos
7. Partidos / Fixture
8. Planillaje
9. Tablas
10. Finanzas

Puntos a remarcar:
- numeracion operativa,
- control por roles,
- planilla oficial,
- actualizacion de tablas desde resultados reales,
- cuenta corriente por equipo.

### Bloque 4: CMS del portal publico
Objetivo: mostrar que el portal ya es administrable sin tocar codigo.

Recorrido:
1. Entrar con `administrador` u `operador` a `portal-cms.html`.
2. Mostrar `Noticias`:
   - crear noticia,
   - publicar,
   - abrir `blog.html`,
   - abrir detalle `noticia.html`.
3. Mostrar `Galeria`:
   - crear item,
   - mostrarlo luego en landing.
4. Mostrar `Contenido portal`:
   - editar titulo hero,
   - editar textos de Nosotros,
   - editar cards,
   - editar correo/redes.
5. Mostrar `Contacto`:
   - revisar mensajes recibidos,
   - cambiar estado de seguimiento.

Mensaje clave:
- el contenido institucional del portal se administra desde el sistema y ya no depende del organizador.

### Bloque 5: Portal tecnico/dirigente
Objetivo: mostrar acceso restringido.

Recorrido:
1. Ingresar como tecnico o dirigente.
2. Mostrar jugadores de su equipo.
3. Mostrar tablas.
4. Mostrar parte financiera visible de su equipo.

Mensaje clave:
- cada actor ve solo lo que le corresponde.

## Demo corta recomendada (10 a 15 minutos)
1. Landing publica
2. Login administrador
3. Campeonatos -> Equipos -> Partidos -> Planilla
4. Tablas
5. Finanzas
6. Portal CMS
7. Blog y contacto publico

## Demo completa recomendada (20 a 30 minutos)
1. Landing publica
2. Login por rol:
   - administrador,
   - organizador,
   - operador,
   - tecnico/dirigente
3. Flujo deportivo completo
4. Flujo CMS completo
5. Cierre con roadmap mobile y pendientes

## Mensajes de cierre sugeridos
- LT&C centraliza gestion deportiva y portal institucional en una sola plataforma.
- El backend principal ya sirve tanto al panel web como al frente mobile.
- El portal publico ya tiene base CMS propia con rol `operador`.
- El siguiente frente es consolidar pruebas, cierre de UX y despliegue.

## Riesgos a evitar durante la presentacion
- No presentar con datos vacios en noticias/galeria/contacto.
- No usar usuarios sin permisos claros.
- No improvisar cambios estructurales durante la demo.
- Evitar rutas antiguas o pantallas legacy si no forman parte del flujo actual.
