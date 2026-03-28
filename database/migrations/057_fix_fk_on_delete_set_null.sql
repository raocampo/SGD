-- Migración 057: Corregir FK ON DELETE SET NULL en goleadores y tarjetas
-- Las tablas fueron creadas antes de que la migración 005 incluyera ON DELETE SET NULL,
-- por lo que en producción el FK tiene comportamiento RESTRICT (bloquea eliminar jugadores).

DO $$
BEGIN
  -- Goleadores: jugador_id
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'goleadores_jugador_id_fkey'
      AND conrelid = 'goleadores'::regclass
  ) THEN
    ALTER TABLE goleadores DROP CONSTRAINT goleadores_jugador_id_fkey;
  END IF;
  ALTER TABLE goleadores
    ADD CONSTRAINT goleadores_jugador_id_fkey
    FOREIGN KEY (jugador_id) REFERENCES jugadores(id) ON DELETE SET NULL;

  -- Tarjetas: jugador_id
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tarjetas_jugador_id_fkey'
      AND conrelid = 'tarjetas'::regclass
  ) THEN
    ALTER TABLE tarjetas DROP CONSTRAINT tarjetas_jugador_id_fkey;
  END IF;
  ALTER TABLE tarjetas
    ADD CONSTRAINT tarjetas_jugador_id_fkey
    FOREIGN KEY (jugador_id) REFERENCES jugadores(id) ON DELETE SET NULL;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error en migración 057: %', SQLERRM;
END $$;
