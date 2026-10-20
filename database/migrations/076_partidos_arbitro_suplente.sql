-- Nombre del suplente, separado de los arbitros en cancha.
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS arbitro_suplente TEXT;
