ALTER TABLE partidos_eliminatoria
ADD COLUMN IF NOT EXISTS slot_local_fuente_tipo VARCHAR(20) NOT NULL DEFAULT 'ganador';

ALTER TABLE partidos_eliminatoria
ADD COLUMN IF NOT EXISTS slot_visitante_fuente_tipo VARCHAR(20) NOT NULL DEFAULT 'ganador';

UPDATE partidos_eliminatoria
SET slot_local_fuente_tipo = CASE
      WHEN LOWER(COALESCE(slot_local_fuente_tipo, '')) IN ('ganador', 'perdedor') THEN LOWER(slot_local_fuente_tipo)
      ELSE 'ganador'
    END,
    slot_visitante_fuente_tipo = CASE
      WHEN LOWER(COALESCE(slot_visitante_fuente_tipo, '')) IN ('ganador', 'perdedor') THEN LOWER(slot_visitante_fuente_tipo)
      ELSE 'ganador'
    END;
