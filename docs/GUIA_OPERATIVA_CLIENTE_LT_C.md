# Guia Operativa para Cliente - LT&C

Ultima actualizacion: 2026-03-05

## Objetivo
Entregar una guia practica para operar LT&C (Loja Torneos & Competencias) en un campeonato real, sin depender del equipo tecnico.

## Perfiles y alcance
- `administrador`: configura todo el sistema, usuarios, CMS institucional y operacion deportiva completa.
- `operador`: administra solo portal publico (noticias, galeria, contenido y contacto).
- `organizador`: administra solo sus campeonatos/categorias/equipos/jugadores/sorteo/partidos/planilla/tablas/finanzas.
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
- `docs/BITACORA_AVANCES.md`
- `docs/ESTADO_IMPLEMENTACION_SGD.md`
