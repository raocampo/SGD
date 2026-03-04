-- 024_rol_jugador.sql
-- Habilita el rol "jugador" en usuarios para acceso de solo lectura por equipo.

BEGIN;

DO $$
DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'usuarios'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%rol%';

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE usuarios DROP CONSTRAINT %I', c_name);
  END IF;

  ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('administrador', 'operador', 'organizador', 'tecnico', 'dirigente', 'jugador'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Asegura lectura para usuarios jugador existentes
UPDATE usuarios
SET solo_lectura = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE LOWER(COALESCE(rol, '')) = 'jugador'
  AND COALESCE(solo_lectura, FALSE) = FALSE;

COMMIT;

