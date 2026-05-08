DROP INDEX IF EXISTS jugadores_cedidentidad_evento_uidx;

CREATE INDEX IF NOT EXISTS jugadores_cedidentidad_evento_lookup_idx
  ON jugadores (cedidentidad, evento_id)
  WHERE cedidentidad IS NOT NULL
    AND evento_id IS NOT NULL;
