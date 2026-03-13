ALTER TABLE jugadores
ADD COLUMN IF NOT EXISTS foto_carnet_zoom NUMERIC(5,2) DEFAULT 1.00;

UPDATE jugadores
SET foto_carnet_zoom = COALESCE(foto_carnet_zoom, 1.00)
WHERE foto_carnet_zoom IS NULL;
