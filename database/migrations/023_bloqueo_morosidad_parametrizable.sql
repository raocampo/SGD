-- 023_bloqueo_morosidad_parametrizable.sql
-- Configuracion de bloqueo por morosidad:
-- - nivel campeonato (base)
-- - nivel categoria/evento (override opcional)

ALTER TABLE campeonatos
  ADD COLUMN IF NOT EXISTS bloquear_morosos BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bloqueo_morosidad_monto NUMERIC(12,2) DEFAULT 0;

UPDATE campeonatos
SET
  bloquear_morosos = COALESCE(bloquear_morosos, FALSE),
  bloqueo_morosidad_monto = COALESCE(bloqueo_morosidad_monto, 0);

ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS bloquear_morosos BOOLEAN,
  ADD COLUMN IF NOT EXISTS bloqueo_morosidad_monto NUMERIC(12,2);

UPDATE eventos
SET bloqueo_morosidad_monto = NULL
WHERE bloqueo_morosidad_monto IS NOT NULL
  AND bloqueo_morosidad_monto < 0;
