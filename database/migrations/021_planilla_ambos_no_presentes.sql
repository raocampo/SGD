-- Migracion 021: soporte para doble no presentacion en planilla

ALTER TABLE partido_planillas
ADD COLUMN IF NOT EXISTS ambos_no_presentes BOOLEAN NOT NULL DEFAULT FALSE;
