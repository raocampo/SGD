ALTER TABLE evento_reclasificaciones_playoff
ADD COLUMN IF NOT EXISTS partido_id INTEGER REFERENCES partidos(id) ON DELETE SET NULL;
