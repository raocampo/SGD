ALTER TABLE jugadores
ADD COLUMN IF NOT EXISTS evento_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_jugadores_evento'
  ) THEN
    ALTER TABLE jugadores
    ADD CONSTRAINT fk_jugadores_evento
    FOREIGN KEY (evento_id)
    REFERENCES eventos(id)
    ON DELETE CASCADE;
  END IF;
END $$;

WITH equipos_un_evento AS (
  SELECT
    ee.equipo_id,
    MIN(ee.evento_id) AS evento_id
  FROM evento_equipos ee
  GROUP BY ee.equipo_id
  HAVING COUNT(DISTINCT ee.evento_id) = 1
)
UPDATE jugadores j
SET evento_id = eue.evento_id
FROM equipos_un_evento eue
WHERE j.equipo_id = eue.equipo_id
  AND j.evento_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_jugadores_evento_equipo
  ON jugadores (evento_id, equipo_id);

CREATE INDEX IF NOT EXISTS idx_jugadores_equipo_evento_cedula
  ON jugadores (equipo_id, evento_id, cedidentidad);

CREATE INDEX IF NOT EXISTS idx_jugadores_equipo_evento_numero
  ON jugadores (equipo_id, evento_id, numero_camiseta);
