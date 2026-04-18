-- Migración 065: columnas overlay_token y director_token en partido_transmisiones
-- overlay_token: URL pública para OBS Browser Source (sin auth)
-- director_token: token secreto para el panel de director (autenticado por JWT)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partido_transmisiones' AND column_name = 'overlay_token'
  ) THEN
    ALTER TABLE partido_transmisiones ADD COLUMN overlay_token UUID DEFAULT gen_random_uuid() UNIQUE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partido_transmisiones' AND column_name = 'director_token'
  ) THEN
    ALTER TABLE partido_transmisiones ADD COLUMN director_token UUID DEFAULT gen_random_uuid() UNIQUE;
  END IF;
END $$;

-- Asignar tokens a filas existentes que no los tengan
UPDATE partido_transmisiones
  SET overlay_token  = gen_random_uuid()
  WHERE overlay_token IS NULL;

UPDATE partido_transmisiones
  SET director_token = gen_random_uuid()
  WHERE director_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_transmisiones_overlay_token  ON partido_transmisiones(overlay_token);
CREATE INDEX IF NOT EXISTS idx_transmisiones_director_token ON partido_transmisiones(director_token);
