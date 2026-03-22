ALTER TABLE partidos
ADD COLUMN IF NOT EXISTS arbitro_linea_1 TEXT,
ADD COLUMN IF NOT EXISTS arbitro_linea_2 TEXT;

ALTER TABLE partido_planillas
ADD COLUMN IF NOT EXISTS observaciones_arbitro TEXT;
