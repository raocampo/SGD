# Guion de Video y Tutoriales - LT&C

Ultima actualizacion: 2026-03-05

## Objetivo
Definir una estructura estandar para grabar videos del sistema LT&C orientados a cliente final, operadores y capacitacion interna.

## Publico objetivo
- Administrador del sistema.
- Organizador de campeonato.
- Operador CMS del portal publico.
- Tecnico/dirigente con acceso limitado.

## Formato recomendado
- Duracion por video: 4 a 8 minutos.
- Resolucion: 1920x1080.
- Audio: narracion clara + subtitulos breves.
- Estilo: demostracion real con dataset de prueba.

## Estructura base de cada video
1. Objetivo del modulo (10-20 segundos).
2. Datos previos requeridos.
3. Flujo paso a paso.
4. Resultado esperado.
5. Errores comunes y como resolverlos.
6. Cierre con accion siguiente.

## Serie de tutoriales sugerida

### T1 - Acceso y roles
- Login y recuperacion de contraseña.
- Diferencias entre administrador, organizador, operador, tecnico/dirigente/jugador.

### T2 - Crear campeonato y categorias
- Configuracion de campeonato.
- Creacion de categorias y costos.

### T3 - Equipos y jugadores
- Registro manual de equipos.
- Importacion de jugadores.
- Reglas de cedula/documentos por campeonato.

### T4 - Sorteo, grupos y fixture
- Sorteo manual/aleatorio/cabezas de serie.
- Generacion de grupos.
- Generacion de fixture y filtros.

### T5 - Planilla oficial de partido
- Carga de resultado, goles, tarjetas, observaciones y pagos.
- Casos de no presentacion/walkover.
- Impresion/exportacion.

### T6 - Tablas y estadisticas
- Posiciones, goleadores, tarjetas y fair play.
- Lectura operativa para organizador.

### T7 - Finanzas
- Registro de movimientos.
- Estado de cuenta por equipo.
- Morosidad y resumen ejecutivo.

### T8 - Pases de jugadores
- Registro y estados del pase.
- Aprobacion/anulacion.
- Historial por jugador y equipo.

### T9 - CMS del portal publico
- Noticias y blog.
- Galeria.
- Contenido institucional.
- Bandeja de contacto.

### T10 - Cierre operativo y respaldos
- Checklist semanal.
- Backup de base de datos.
- Checklist de cierre de campeonato.

## Guion corto para video demo comercial (5-7 min)
1. Landing publica LT&C.
2. Login por rol.
3. Flujo deportivo rapido (campeonato -> equipo -> partido -> planilla).
4. Tablas y finanzas.
5. CMS institucional.
6. Cierre con propuesta de valor.

## Guion tecnico para video de implantacion (15-20 min)
1. Requisitos e instalacion.
2. Migraciones.
3. Variables de entorno.
4. Verificacion de salud y QA.
5. Roles y pruebas minimas por rol.

## Checklist antes de grabar
- Backend y DB activos.
- Dataset de demostracion validado.
- Usuario y contraseña listos por rol.
- Logos/imagenes sin rutas rotas.
- Navegador limpio (cache/controla zoom 100%).
- Sin notificaciones del sistema operativo en pantalla.

## Dataset recomendado para tutoriales
- 1 campeonato activo.
- Minimo 2 categorias.
- Minimo 8 equipos por categoria.
- Minimo 15 jugadores por equipo.
- Sorteo/grupos/fixture ya generados.
- Al menos 2 partidos planillados.
- Al menos 1 pase de jugador.
- Al menos 1 noticia y 1 item de galeria.

## Evidencias y entregables por video
- Archivo MP4 final.
- Miniatura PNG.
- PDF corto de pasos.
- Version de texto (script narrado).

## Mantenimiento del material
- Revisar tutoriales cada vez que cambie flujo de UI o permisos.
- Versionar por fecha en titulo del video.
- Mantener historial en `docs/BITACORA_AVANCES.md`.
