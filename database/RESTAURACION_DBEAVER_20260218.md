# Restauracion en DBeaver - gestionDeportiva

## Diagnostico del backup original
- El archivo `database/dump-gestionDeportiva-202602172247.sql` **no esta dañado**.
- Es un dump de PostgreSQL en formato **CUSTOM** (`PGDMP`), no SQL plano.
- Si se intenta abrir/ejecutar como script SQL en DBeaver, falla.

## Archivos listos para usar
1. Esquema completo (actualizado, incluye modulo financiero base):
- `database/SGD_ESQUEMA_COMPLETO_DBEAVER.sql`

2. Restauracion completa en SQL plano (estructura + datos, con `INSERT`):
- `database/dump-gestionDeportiva-202602172247-restaurable-inserts-dbeaver.sql`

## Opcion recomendada (restaurar todo)
1. Crear base vacia en PostgreSQL (por ejemplo `gestionDeportiva`).
2. Abrir y ejecutar:
- `database/dump-gestionDeportiva-202602172247-restaurable-inserts-dbeaver.sql`

## Opcion solo estructura
1. Crear base vacia.
2. Ejecutar:
- `database/SGD_ESQUEMA_COMPLETO_DBEAVER.sql`

## Validacion tecnica realizada
- Ambos scripts fueron probados en PostgreSQL 17.6 con `ON_ERROR_STOP=1` sin errores.
- Se eliminaron comandos especiales de `psql` (`\restrict`, `\unrestrict`) para compatibilidad con DBeaver.
- El esquema incluye el extra vigente del proyecto:
  - tabla `finanzas_movimientos` (migracion 006).

## Nota tecnica
- Estos scripts fueron preparados para DBeaver (se removieron comandos `\restrict/\unrestrict` de `psql`).
- El dump incluye una tabla `public.archivos` que no afecta el flujo principal deportivo.
