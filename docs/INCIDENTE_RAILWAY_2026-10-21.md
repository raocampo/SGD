# Respuesta al incidente de Railway del 21 de octubre de 2026

Estado al **22-oct-2026 (America/Guayaquil): rotación de credenciales conocidas completada y backend desplegado**. Alcance intervenido: proyecto `sgd-ltc`, entorno `production`, servicios backend y Postgres. Respuesta iniciada el 21-oct. No se han intervenido otros proyectos de la cuenta ni se realizó una auditoría forense completa.

## Cierre operativo del 22 de octubre

- Railway aceptó el despliegue real de este proyecto Hobby el 22-oct, aunque el aviso público consultado aún indicaba Hobby pendiente. No se cambió de plan. Despliegues `077a9b8d-66d4-409e-98fe-dd2a16c14890` y `98c75b86-90c6-4de8-bf92-8dc93e3dce0f`, ambos **SUCCESS**, iniciados a las 12:40 y 12:50 de Ecuador. Fuente `e3b5ed3`, que incluye la corrección de asociación `b28f702`.
- JWT nuevo activo y firma anterior rechazada. Contraseña PostgreSQL cambiada en el rol real con verificador SCRAM-SHA-256; conexión nueva correcta y anterior rechazada con **28P01**. Variables del servicio y referencias de conexión sincronizadas, sin cambiar nombres ni permisos del rol. Gmail conserva la clave válida configurada y recogida por el despliegue nuevo.
- Revocados **3 refresh tokens adicionales** emitidos durante la espera: **19 en total**, contando los 16 del 21-oct. Comprobación final: **0 vigentes**; no había enlaces de recuperación pendientes. Después del despliegue se comprobaron y cerraron las conexiones antiguas elegibles de PostgreSQL; ninguna seguía abierta aparte de la conexión de mantenimiento, cerrada al terminar.
- `.env.local` contiene valores vigentes en `JWT_SECRET`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `DATABASE_PUBLIC_URL`, `RAILWAY_DATABASE_PRIVATE_URL` y `SMTP_PASS`. Los campos de secretos `_NEXT` se consumieron. Estado local `SECURITY_CREDENTIAL_ROTATION_COMPLETE=true`; alcance de cierre explícito a secretos conocidos de SGD y revocación de sesiones.
- Catálogo real, con un dirigente activo sin equipo: **HTTP 200, 4 organizadores, 7 campeonatos y 212 equipos**. Sin token: 401. Salud: 200. El frontend publicado incluye la cascada Organizador -> Campeonato -> Equipo. No se asignó un equipo ni se registraron jugadores reales para probar.
- Conteos antes/después de la rotación: **38 usuarios, 212 equipos, 3.594 jugadores y 910 partidos**, iguales al respaldo. No se ejecutaron operaciones de edición deportiva ni cambios de contraseñas de usuarios; no había migraciones nuevas en esta versión. Los conteos no equivalen a comparar íntegramente el contenido de las tablas.

## Acciones y comprobaciones

| Elemento | Estado comprobado |
| --- | --- |
| Configuración local | `.env.local` de la raíz normalizado y protegido mediante ACL para el usuario actual y SYSTEM. Git lo ignora. Contiene los valores productivos vigentes y estados `SECURITY_*`; los secretos `_NEXT` ya consumidos se retiraron. El backend local no carga este archivo automáticamente. |
| Respaldos | Configuración anterior, variables de Railway, tokens afectados y muestra de registros guardados en `database/backups/`, excluido de Git. Cifrado DPAPI ligado al usuario Windows de este equipo; no basta copiar esos respaldos a otro equipo para descifrarlos. |
| Sesiones | **19 refresh tokens revocados** en dos transacciones respaldadas; **0 vigentes** en la comprobación final. Sin enlaces de recuperación pendientes. Los JWT firmados con el secreto anterior también son rechazados por el backend nuevo. |
| JWT | Reemplazo criptográficamente aleatorio activo en Railway y en `JWT_SECRET` local. Verificación con ID inexistente: firma anterior rechazada y nueva reconocida, sin abrir una sesión real. Campo `JWT_SECRET_NEXT` retirado. |
| PostgreSQL | Contraseña cambiada en el rol real y sincronizada en `POSTGRES_PASSWORD`, `PGPASSWORD` y URLs mediante las referencias existentes de Railway. Conexión con la nueva correcta y contraseña anterior rechazada con **28P01**. Verificador SCRAM generado localmente: no se envió la contraseña en claro como sentencia SQL. El despliegue nuevo usa esa conexión. |
| Gmail | **Nueva contraseña autenticada correctamente por TLS desde este equipo; anterior rechazada con `EAUTH/535`.** `SMTP_PASS` coincide entre Railway y `.env.local` y la nueva configuración quedó incluida en el despliegue. Estado `ROTATED_ACTIVE`. No se enviaron mensajes durante la verificación; la entrega desde Hobby sigue limitada por el bloqueo de SMTP saliente. |
| Credenciales adicionales | No se encontraron claves de otros proveedores en las variables de estos dos servicios. Backend procede de GitHub y Postgres de la imagen pública de Railway; no se identificó uso de un registro privado en esas fuentes. Dos URLs históricas ajenas al Postgres actual se conservaron con nombres `LEGACY_DATABASE_URL_*`; no se verificó su vigencia ni se rotaron servicios externos históricos. Los tokens OIDC locales de Vercel ya estaban vencidos. |
| Disponibilidad | `/salud` 200, conexión PostgreSQL nueva correcta, catálogo autenticado 200 y catálogo sin token 401. Comprobaciones dirigidas; no acreditan todos los flujos de la aplicación. |

Durante el 21-oct, Railway rechazaba los despliegues con **`Paused temporarily`** y producción seguía en `e3af70d`. El 22-oct se confirmó la habilitación mediante un despliegue real, sin basarse únicamente en la ausencia del aviso del panel. El backend publicado ya incluye `b28f702`; `/api/auth/mi-equipo/opciones` pasó de **404** a **401 sin token / 200 autenticado**.

La validación inicial de Gmail identificó claves emitidas para otra cuenta Google y una copia local desactualizada. El 21-oct se corrigió y verificó la credencial. El 22-oct se detectó que `.env.local` había vuelto a contener el valor anterior; se respaldó íntegramente, se contrastó con la variable correcta de Railway y el respaldo verificado, y se autenticó otra vez con la clave vigente antes de reconciliar el archivo. No se imprimieron secretos ni se aplicaron las claves rechazadas.

El cambio de contraseña de PostgreSQL se coordinó con el paso a `DEPLOYING` del segundo backend. Se mantuvo una conexión de mantenimiento para verificar la credencial nueva y conservar una vía de recuperación. El segundo despliegue terminó en `SUCCESS`; no fue necesario revertir la contraseña. Los respaldos incluyen el estado del rol, variables, archivo local, sesiones revocadas y evidencia final, cifrados con DPAPI.

## Registros revisados y límites

Se respaldaron y revisaron **42 líneas de Postgres** y **67 del backend**, consultadas desde el 21-oct 00:00 UTC, con límite de 1.000 por servicio. La muestra del backend contenía 47 errores de archivo `/app/frontend/index.html` inexistente, 14 timeouts enviando correos y un registro rechazado por correo ya existente. No se identificaron fallos de autenticación de PostgreSQL ni los patrones de sondeo buscados en esa muestra. La consulta de auditoría del proyecto desde el 20-oct devolvió dos eventos `Deployment.created` y no indicó más páginas.

La base no registra todas las conexiones/desconexiones ni todas las sentencias SQL. Esta revisión es parcial y **no demuestra ausencia de acceso indebido**; el alcance de la exposición debe contrastarse con las actualizaciones de Railway.

El workspace es **Hobby**. Railway documenta que ese plan no admite SMTP saliente; los timeouts observados son compatibles con esa restricción, sin haber capturado tráfico para demostrar su causa. Cambiar la clave Gmail no elimina ese bloqueo. La recuperación del correo requiere un servicio con API HTTPS o un plan que permita SMTP; no se contrató ningún servicio ni se modificó el plan.

## Pendientes operativos y límites

1. Volver a iniciar sesión y comprobar visualmente Organizador -> Campeonato -> Equipo con la selección real del usuario; luego confirmar la inscripción/carga de jugadores. Se verificaron API y archivos frontend publicados, pero no se hizo esa asignación ni una carga real de prueba. Browser no tiene navegadores disponibles en esta sesión.
2. Resolver por separado la entrega de correo desde Hobby mediante API HTTPS o plan compatible. No se contrató un proveedor ni se modificó el plan. La rotación de Gmail no elimina esa restricción de red.
3. La revisión de registros conserva el alcance parcial indicado arriba. El cierre documenta la rotación de secretos conocidos de SGD y las sesiones; no certifica ausencia de acceso indebido ni resolución global del incidente de Railway. Las dos URLs históricas de otros proveedores quedan fuera de la intervención.

Auxiliares locales, ignorados por Git: `tmp/railway-security.cjs` y `tmp/railway-resume.cjs`. Para consultar la evidencia activa: `node tmp/railway-resume.cjs final-verify`. No repetir los modos de preparación/rotación: el cierre ya consumió los valores `_NEXT` y los auxiliares rechazan una segunda rotación de este incidente. No hay tareas de reintento programadas ni procesos de rotación pendientes.

## Fuentes

- [Divulgación oficial del incidente](https://blog.railway.com/p/security-disclosure-wednesday-october-21st): recomendación de rotar secretos y revisar registros.
- [Estado de Railway](https://status.railway.com/): evolución del incidente; la habilitación de este proyecto se comprobó con despliegues reales.
- [Variables mediante API de Railway](https://docs.railway.com/integrations/api/manage-variables): cambios de variables y despliegues.
- [Networking saliente de Railway](https://docs.railway.com/networking/outbound-networking): disponibilidad de SMTP por plan.
- [Contraseñas de aplicación de Google](https://support.google.com/accounts/answer/185833?hl=es): creación y revocación; requiere verificación en dos pasos.
- [Verificación SMTP de Nodemailer](https://nodemailer.com/smtp#verifying-the-configuration): prueba de conexión, TLS y autenticación sin enviar correos; no acredita la entrega de mensajes.
- [ALTER ROLE de PostgreSQL 18](https://www.postgresql.org/docs/18/sql-alterrole.html): cambio de contraseña sin modificar los demás atributos del rol.
- [SCRAM en PostgreSQL](https://www.postgresql.org/docs/18/sasl-authentication.html): mecanismo de autenticación utilizado.
