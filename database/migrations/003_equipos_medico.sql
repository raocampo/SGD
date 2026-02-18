-- Migración: Campo médico en equipos
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS medico VARCHAR(100);
