-- Migracion 007: Compatibilidad eventos.campeonato_id
-- Fecha: 2026-02-18

ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS campeonato_id INTEGER;

-- Compatibilidad con esquema legado (campeonatos.evento_id -> eventos.id)
UPDATE eventos e
SET campeonato_id = c.id
FROM campeonatos c
WHERE c.evento_id = e.id
  AND e.campeonato_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_eventos_campeonato'
  ) THEN
    ALTER TABLE eventos
      ADD CONSTRAINT fk_eventos_campeonato
      FOREIGN KEY (campeonato_id) REFERENCES campeonatos(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_eventos_campeonato_id
  ON eventos(campeonato_id);
