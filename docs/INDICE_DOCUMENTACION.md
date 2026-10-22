# Indice de Documentacion LT&C

Ultima actualizacion: 2026-10-22

## Documentos clave
- `docs/MEMORIA_PROYECTO.md`
  - Memoria breve para retomar: filas de planillas según planteles reales (22-oct), Watch Paths, categorías y equipos inscritos, código de pertenencia pospuesto, rotación cerrada y límites de las verificaciones.
- `docs/INCIDENTE_RAILWAY_2026-10-21.md`
  - Respuesta al incidente y cierre del 22-oct: backend desplegado, JWT/PostgreSQL/Gmail rotados, 19 refresh tokens revocados, evidencia y límites de la revisión. Correo SMTP de Hobby y QA visual pendientes. No contiene credenciales.
- `docs/BITACORA_AVANCES.md`
  - Registro vivo por fecha de todo lo implementado y pendientes de la siguiente sesion. Última revisión: impresión/PDF/XLSX de planillas con filas según el mayor plantel inscrito (22-oct); filtros de despliegues, categorías y código de pertenencia en espera.
  - La entrada mas reciente va arriba. La del 2026-10-22 cierra el despliegue y rotacion de credenciales; las del 2026-10-21 registran la respuesta inicial al incidente Railway y la asociacion inicial de dirigente/tecnico/jugador; las del 2026-10-20, planilla movil y migracion 076; la del 2026-10-16, el selector Campeonato en Usuarios y Roles. "2026-10-14 - Estado consolidado" trae la lista de pendientes A-D, complementada por las entradas posteriores. Los cierres del 2026-10-10/11 explican el entorno Fedora y la continuidad entre equipos (MEGA no sincroniza `.git` ni `.env`).
- `docs/ESTADO_IMPLEMENTACION_SGD.md`
  - Estado por modulo frente a la propuesta original; priorizar las entradas del 2026-10-22 y la memoria vigente sobre las tablas historicas.
- `docs/propuestaDesarrolloSGD.md`
  - Documento base de alcance funcional del proyecto.
- `docs/CAMBIOS_IMPLEMENTADOS.md`
  - Resumen historico de cambios estructurales ya incorporados.
- `docs/PLAN_MOBILE_LT_C.md`
  - Plan maestro por fases para adaptar LT&C a uso mobile web/app y estado del contrato backend mobile.
- `docs/PLAN_CMS_PORTAL_PUBLICO.md`
  - Plan maestro por fases para separar el CMS del portal publico del panel de gestion deportiva, con estado real de fases, alcance institucional y hardening de perfiles publicos.
- `docs/PLAN_TRANSMISION_PARTIDOS.md`
  - Plan funcional inicial para habilitar transmisiones de partidos operadas por el organizador y visibles en portal/redes.
- `docs/GUIA_PRESENTACION_SISTEMA_LT_C.md`
  - Guion operativo recomendado para presentar el sistema LT&C por modulos y roles.
- `docs/GUIA_OPERATIVA_CLIENTE_LT_C.md`
  - Manual operativo para uso diario del cliente y cierre semanal/campeonato.
- `docs/GUIA_ACTUALIZAR_CONTENIDO_WEB.md`
  - Cómo actualizar imágenes, texto y contenido de la página: qué se edita desde el panel (CMS/formularios con upload) y qué todavía requiere código + commit + deploy, con mapa completo de `index.html` y checklist de imágenes.
- `docs/GUIA_VIDEO_TUTORIALES_LT_C.md`
  - Guion maestro para grabacion de videos tutoriales y demo comercial/tecnica.
- `docs/CHECKLIST_QA_CMS_PORTAL_PUBLICO.md`
  - Lista de pruebas funcionales y de seguridad para cierre operativo del CMS.
- `docs/GUIA_DESPLIEGUE_CMS_PORTAL_PUBLICO.md`
  - Pasos de despliegue, verificacion y rollback del CMS institucional.
- `docs/DEPLOY_RENDER.md`
  - Guia de despliegue del sistema completo LT&C en Render con un solo servicio Node.
- `docs/RESULTADO_QA_CMS_2026-03-05.md`
  - Evidencia de pruebas automáticas del CMS y estado de cierre de Fase 6.
- `docs/ACTA_ACEPTACION_CMS_FASE6_2026-03-05.md`
  - Acta de aceptación técnica-operativa del cierre de Fase 6 CMS.

## Documentos de referencia operativa
- `docs/PlanillaJuego.pdf`
  - Referencia visual del formato oficial de planilla de juego.
- `docs/PlanillaJuego.xlsx`
  - Plantilla oficial en Excel para exportacion/impresion.
- `docs/PlanillaJuego.zip`
  - Paquete de soporte del formato de planilla.

## Evidencia visual
- `docs/capturaImg/`
  - Capturas funcionales y de UX usadas para ajustes.

## Regla de mantenimiento
1. Al iniciar sesion:
   - revisar `docs/BITACORA_AVANCES.md` y este indice.
2. Durante la sesion:
   - registrar decisiones y cambios relevantes.
3. Al cerrar sesion:
   - actualizar bitacora,
   - actualizar estado si cambia el alcance,
   - registrar commit con mensaje claro.
