ALTER TABLE partido_planillas
ADD COLUMN IF NOT EXISTS observaciones_local TEXT,
ADD COLUMN IF NOT EXISTS observaciones_visitante TEXT;
