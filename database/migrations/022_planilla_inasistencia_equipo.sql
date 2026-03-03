ALTER TABLE partido_planillas
ADD COLUMN IF NOT EXISTS inasistencia_equipo VARCHAR(20) NOT NULL DEFAULT 'ninguno';
