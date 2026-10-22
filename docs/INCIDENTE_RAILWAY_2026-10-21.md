# Respuesta al incidente de Railway del 21 de octubre de 2026

Estado: **Gmail rotado en el proveedor y configurado en Railway; activación del backend y rotación de PostgreSQL pendientes**. Alcance intervenido: proyecto `sgd-ltc`, entorno `production`, servicios backend y Postgres. Fecha local: 21-oct (America/Guayaquil); las comprobaciones finales corresponden al 22-oct UTC. No se han intervenido otros proyectos de la cuenta.

## Acciones y comprobaciones

| Elemento | Estado comprobado |
| --- | --- |
| Configuración local | `.env.local` de la raíz normalizado y protegido mediante ACL para el usuario actual y SYSTEM. Git lo ignora. Conserva la configuración productiva y distingue reemplazos pendientes mediante el sufijo `_NEXT` y campos `SECURITY_*`. El backend local no carga este archivo automáticamente. |
| Respaldos | Configuración anterior, variables de Railway, tokens afectados y muestra de registros guardados en `database/backups/`, excluido de Git. Cifrado DPAPI ligado al usuario Windows de este equipo; no basta copiar esos respaldos a otro equipo para descifrarlos. |
| Sesiones | Revocados **16 refresh tokens** vigentes en una transacción con respaldo previo. Comprobación posterior: **0** refresh tokens vigentes. No había enlaces de recuperación pendientes sin consumir. No se cambiaron contraseñas de usuarios ni datos deportivos. |
| JWT | Reemplazo criptográficamente aleatorio generado y guardado como `JWT_SECRET_NEXT`. Actualizado en las variables de Railway con `skipDeploys: true`, con lectura posterior coincidente. **El proceso activo sigue usando el secreto anterior**: la prueba con un JWT de ID inexistente reconoció la firma anterior y rechazó la nueva, sin abrir una sesión real. Los JWT de acceso anteriores todavía no están invalidados por este cambio. |
| PostgreSQL | Contraseña nueva y URLs correspondientes preparadas en `POSTGRES_PASSWORD_NEXT`, `DATABASE_PUBLIC_URL_NEXT` y `DATABASE_URL_NEXT`. **No aplicada** al rol ni a las variables del servicio: el backend activo conserva la contraseña anterior y Railway impide desplegar su reemplazo. Verificada la conexión actual, PostgreSQL 18 y un único rol con login, superusuario. |
| Gmail | **Nueva contraseña autenticada correctamente por TLS desde este equipo; contraseña anterior rechazada por Gmail con `EAUTH/535`.** `SMTP_PASS` actualizado en Railway con `skipDeploys: true` y lectura posterior coincidente. En `.env.local`, la clave válida quedó en **`SMTP_PASS`** y se retiró el campo consumido `SMTP_PASS_NEXT`; la copia local anterior solo se conserva en respaldos cifrados. Estado `PROVIDER_ROTATED_RAILWAY_CONFIGURED_RUNTIME_PENDING`. **El proceso activo todavía necesita un despliegue para tomarla.** Cero correos enviados durante la verificación. |
| Credenciales adicionales | No se encontraron claves de otros proveedores en las variables de estos dos servicios. Backend procede de GitHub y Postgres de la imagen pública de Railway; no se identificó uso de un registro privado en esas fuentes. Dos URLs históricas ajenas al Postgres actual se conservaron con nombres `LEGACY_DATABASE_URL_*`; no se verificó su vigencia ni se rotaron servicios externos históricos. Los tokens OIDC locales de Vercel ya estaban vencidos. |
| Disponibilidad | `/salud` devuelve HTTP 200 y PostgreSQL responde. Esto no acredita todos los flujos de la aplicación. |

Railway rechazó el intento de desplegar la imagen existente con el error **`Paused temporarily`**. El despliegue activo sigue siendo `e3af70d`, del 20-oct. La corrección del primer ingreso de dirigentes/técnicos está publicada en Git en `b28f702`, pero `/api/auth/mi-equipo/opciones` continúa devolviendo **404** en producción. El frontend actualizado requiere que ese backend llegue a desplegarse.

La validación inicial de Gmail identificó que se estaban emitiendo claves para otra cuenta Google y que el archivo todavía conservaba valores anteriores. Se abrió el `.env.local` correcto en Bloc de notas. Tras guardar la clave de la cuenta configurada en `SMTP_USER`, autenticó correctamente y se verificó también el rechazo de la contraseña anterior. Los valores se respaldaron cifrados antes de verificarlos; nunca se imprimieron. La clave válida se configuró en Railway y se promovió a `SMTP_PASS` local, con referencia al respaldo cifrado anterior para evitar confundir ambas al repetir una comprobación. El posterior intento de desplegar volvió a ser rechazado con `Paused temporarily`.

Comprobación final tras actualizar las variables: `/salud` **200**, conexión PostgreSQL correcta, **0** refresh tokens vigentes, firma JWT anterior reconocida y reemplazo todavía rechazado por el proceso activo; catálogo de asociación aún **404**. No se ejecutaron migraciones ni se cambiaron contraseñas de usuarios, roles de PostgreSQL o datos deportivos en este seguimiento.

## Registros revisados y límites

Se respaldaron y revisaron **42 líneas de Postgres** y **67 del backend**, consultadas desde el 21-oct 00:00 UTC, con límite de 1.000 por servicio. La muestra del backend contenía 47 errores de archivo `/app/frontend/index.html` inexistente, 14 timeouts enviando correos y un registro rechazado por correo ya existente. No se identificaron fallos de autenticación de PostgreSQL ni los patrones de sondeo buscados en esa muestra. La consulta de auditoría del proyecto desde el 20-oct devolvió dos eventos `Deployment.created` y no indicó más páginas.

La base no registra todas las conexiones/desconexiones ni todas las sentencias SQL. Esta revisión es parcial y **no demuestra ausencia de acceso indebido**; el alcance de la exposición debe contrastarse con las actualizaciones de Railway.

El workspace es **Hobby**. Railway documenta que ese plan no admite SMTP saliente; los timeouts observados son compatibles con esa restricción, sin haber capturado tráfico para demostrar su causa. Cambiar la clave Gmail no elimina ese bloqueo. La recuperación del correo requiere un servicio con API HTTPS o un plan que permita SMTP; no se contrató ningún servicio ni se modificó el plan.

## Pendientes para cerrar la rotación

1. Cuando Railway restablezca los despliegues, consultar otra vez configuración y estado para detectar cambios de otras sesiones. Coordinar la contraseña real del rol de PostgreSQL, `POSTGRES_PASSWORD` del servicio y las referencias `PGPASSWORD`/URLs, conservando las plantillas existentes. Actualizar el backend y desplegar con el nuevo JWT y la conexión nueva. No cambiar solo la variable de Postgres: eso no cambia la contraseña de una base ya inicializada. El nuevo `SMTP_PASS` ya está configurado; no volver a copiar la contraseña antigua.
2. Verificar una conexión nueva con la contraseña nueva de PostgreSQL y el rechazo de la anterior; verificar salud y consultas autenticadas del backend. Comprobar en el proceso nuevo que la firma JWT anterior se rechaza y la nueva se reconoce. Revocar de nuevo cualquier refresh token emitido durante la transición; conservar el cierre de sesiones como incompleto hasta invalidar también los JWT de acceso.
3. Confirmar que el nuevo despliegue recoge la configuración SMTP, sin imprimir secretos. La entrega de correos sigue requiriendo resolver el bloqueo SMTP de Hobby mediante API HTTPS o plan compatible; la autenticación verificada desde Windows no acredita envíos desde Railway.
4. Desplegar al menos `b28f702` para el catálogo de asociación. Sin autenticación, el endpoint debe pasar de 404 a 401; después comprobar con la cuenta real organizador -> campeonato -> equipo e inscripción de jugadores.
5. Tras comprobar los reemplazos pendientes, actualizar sus campos activos de `.env.local`, retirar los valores `_NEXT` consumidos y registrar fecha/estado. El reemplazo Gmail ya se consumió y está en `SMTP_PASS`; JWT/PostgreSQL conservan sus campos `_NEXT`. No marcar `SECURITY_INCIDENT_REMEDIATION_COMPLETE` como verdadero mientras queden credenciales anteriores válidas o verificaciones pendientes. No restaurar un secreto expuesto como solución permanente.

El auxiliar de esta sesión está en `tmp/railway-security.cjs`, ignorado por Git; permite consultar estado y respaldos sin imprimir valores. No es un rotador automático de PostgreSQL ni un servicio que vaya a reintentar por sí solo. No se ha programado ninguna tarea en segundo plano.

## Fuentes

- [Divulgación oficial del incidente](https://blog.railway.com/p/security-disclosure-wednesday-october-21st): recomendación de rotar secretos y revisar registros.
- [Estado de Railway](https://status.railway.com/): bloqueo de builds/despliegues vigente al comprobarlo.
- [Variables mediante API de Railway](https://docs.railway.com/integrations/api/manage-variables): cambios de variables y despliegues.
- [Networking saliente de Railway](https://docs.railway.com/networking/outbound-networking): disponibilidad de SMTP por plan.
- [Contraseñas de aplicación de Google](https://support.google.com/accounts/answer/185833?hl=es): creación y revocación; requiere verificación en dos pasos.
- [Verificación SMTP de Nodemailer](https://nodemailer.com/smtp#verifying-the-configuration): prueba de conexión, TLS y autenticación sin enviar correos; no acredita la entrega de mensajes.
