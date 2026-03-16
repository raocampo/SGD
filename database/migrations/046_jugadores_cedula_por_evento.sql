ALTER TABLE jugadores
DROP CONSTRAINT IF EXISTS jugadores_dni_key;

DROP INDEX IF EXISTS jugadores_cedidentidad_evento_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS jugadores_cedidentidad_evento_uidx
  ON jugadores (cedidentidad, evento_id)
  WHERE cedidentidad IS NOT NULL
    AND evento_id IS NOT NULL;
