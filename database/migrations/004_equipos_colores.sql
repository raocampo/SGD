-- Migración: Colores primario, secundario y terciario en equipos
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS color_primario VARCHAR(7);
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS color_secundario VARCHAR(7);
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS color_terciario VARCHAR(7);
