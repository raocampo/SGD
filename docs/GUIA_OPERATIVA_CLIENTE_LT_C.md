# Guia Operativa para Cliente - LT&C

Ultima actualizacion: 2026-11-09

## Objetivo
Entregar una guia practica para operar LT&C (Loja Torneos & Competencias) en un campeonato real, sin depender del equipo tecnico.

## Perfiles y alcance
- `administrador`: configura todo el sistema, usuarios, CMS institucional y operacion deportiva completa.
- `operador`: administra solo portal publico (noticias, galeria, contenido y contacto).
- `organizador`: administra solo sus campeonatos/categorias/equipos/jugadores/sorteo/partidos/planilla/tablas/finanzas.
  - Una organizacion puede tener varios accesos de organizador (ver "Accesos adicionales de una organizacion").
- `tecnico` y `dirigente`: gestion limitada de su equipo y consulta de informacion autorizada.
- `jugador`: consulta de informacion de su equipo en modo solo lectura.

## Flujo operativo recomendado (inicio de torneo)
1. Crear campeonato:
   - definir fechas, costos, reglamento operativo y configuracion de cedula/documentos.
2. Crear categorias:
   - una categoria por division/modalidad.
3. Registrar equipos:
   - cargar datos de contacto y logo.
4. Registrar jugadores:
   - manual o importacion masiva.
5. Generar sorteo y grupos:
   - aleatorio, manual o cabezas de serie.
6. Generar fixture:
   - por categoria con jornadas.
7. Ejecutar planilla en cada partido:
   - resultado, goles, tarjetas, observaciones y pagos.
8. Revisar tablas y reportes:
   - posiciones, goleadores, tarjetas, fair play.
9. Revisar financiero:
   - movimientos, estado de cuenta y morosidad por equipo.

## Operacion diaria en competencia
1. Antes de la jornada:
   - verificar partidos y canchas en `Partidos`.
   - imprimir o preparar planillas en `Planillaje`.
2. Durante la jornada:
   - registrar planilla por partido.
   - validar firmas y observaciones.
3. Despues de jornada:
   - revisar tablas actualizadas.
   - revisar sanciones y estados financieros.

## Modulo de pases de jugadores
- Registrar pase en `pases.html` (admin/organizador).
- Estados operativos:
  - `pendiente`, `pagado`, `aprobado`, `anulado`.
- Al aprobar/pagar:
  - puede transferir jugador al equipo destino.
  - se registra salida contable automatica (cargo/abono).
- Historial disponible:
  - por jugador (resumen + detalle).
  - por equipo (entradas/salidas + detalle).

## Accesos adicionales de una organizacion (co-organizador)
Cuando otra persona de la misma organizacion necesita entrar con sus propias credenciales (por ejemplo, socios que no comparten la contraseña):
1. Iniciar sesion como `administrador` y abrir `Usuarios`.
2. Completar nombre, correo o usuario y una contraseña temporal.
3. En `Rol` elegir `Organizador`.
4. En `Organizacion del organizador` elegir `<organizacion> — acceso adicional` (no `Nueva organizacion`).
   - Se ocultan nombre de organizacion, plan, contacto y logo: se toman del organizador principal.
5. `Crear usuario`. Al primer ingreso el sistema obliga a cambiar la contraseña.

Que comparte y que no:
- Comparte con el organizador principal: campeonatos, categorias, equipos, jugadores, partidos, planillas, finanzas, Mi Landing y plan.
- Es propio de cada cuenta: usuario, correo, contraseña y estado (activo/inactivo).
- Desactivar o eliminar al organizador principal no desactiva el acceso adicional, y viceversa. Si se elimina al principal, el acceso queda desvinculado y sin campeonatos.
- Para quitarle el acceso a la organizacion: editarlo y ponerlo `Inactivo`, o elegir `Nueva organizacion` para desvincularlo.
- No se puede vincular una cuenta que ya tenga campeonatos propios ni encadenar accesos (siempre se elige al organizador principal).
- En el listado de usuarios aparece dentro de la tarjeta de su organizacion, en `Accesos adicionales de la organizacion`.
- En la auditoria, las acciones de cada acceso quedan a nombre de la persona que las hizo; el detalle indica la organizacion (`organizacion_titular_id`).

## Transmisiones en vivo (OBS / Prism Live)
1. Transmitir con camaras (OBS en PC) o con el celular (Prism Live) hacia YouTube, Facebook y TikTok al mismo tiempo.
2. En `Partidos`, boton de transmision del partido: `Agregar plataforma` por cada directo y pegar su enlace. El portal muestra un boton por plataforma.
3. En `Transmisiones` abrir el `Panel de Director` del partido y copiar la URL del overlay. En OBS agregarla como `Browser Source` del tamano del lienzo (1920 x 1080).
4. Durante el partido, desde el Panel de Director:
   - actualizar marcador y periodo con `Enviar ahora`;
   - los auspiciantes activos del campeonato rotan en una esquina (se administran en `Auspiciantes`, con su logo);
   - en el descanso elegir el periodo `Entretiempo`: se muestra la pantalla de entretiempo con el marcador y los auspiciantes; al elegir `2T` se quita.

## Portal publico y CMS institucional
- Contenido gestionado por `administrador` u `operador`:
  - noticias/blog,
  - galeria,
  - contenido institucional,
  - mensajes de contacto.
- El organizador no administra este dominio.

## Checklist de cierre semanal
- Planillas de todos los partidos registradas.
- Tablas publicadas y validadas.
- Sanciones revisadas.
- Movimientos financieros conciliados.
- Noticias/galeria/contacto actualizados en portal publico.
- Backup de base de datos generado.

## Checklist de cierre de campeonato
- Estado de cuenta final por equipo.
- Reportes finales deportivos y financieros.
- Publicacion de cierre en portal publico.
- Export de respaldo (BD + archivos de uploads).

## Buenas practicas de operacion
- No editar datos historicos sin respaldo previo.
- Ejecutar backup antes de cambios estructurales.
- Mantener usuarios por rol y no compartir credenciales.
- Registrar observaciones claras en planilla y movimientos.
- Validar datos clave (fechas, categorias, equipos) antes de publicar.

## Escalamiento de soporte
Cuando reportar al equipo tecnico:
- errores 500/401/403 no esperados,
- inconsistencias entre planilla y tablas,
- inconsistencias entre planilla y finanzas,
- caida de endpoints publicos o mobile,
- fallos de carga de archivos y exportaciones.

## Documentos complementarios
- `docs/GUIA_PRESENTACION_SISTEMA_LT_C.md`
- `docs/GUIA_DESPLIEGUE_CMS_PORTAL_PUBLICO.md`
- `docs/GUIA_ACTUALIZAR_CONTENIDO_WEB.md` — cómo subir imágenes/texto de la página (qué es autogestionable y qué requiere al equipo técnico)
- `docs/BITACORA_AVANCES.md`
- `docs/ESTADO_IMPLEMENTACION_SGD.md`
