ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS carnet_estilo VARCHAR(30),
  ADD COLUMN IF NOT EXISTS carnet_color_primario VARCHAR(20),
  ADD COLUMN IF NOT EXISTS carnet_color_secundario VARCHAR(20),
  ADD COLUMN IF NOT EXISTS carnet_color_acento VARCHAR(20);

ALTER TABLE jugadores
  ADD COLUMN IF NOT EXISTS foto_carnet_pos_x NUMERIC(5,2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS foto_carnet_pos_y NUMERIC(5,2) DEFAULT 35;

UPDATE jugadores
SET
  foto_carnet_pos_x = COALESCE(foto_carnet_pos_x, 50),
  foto_carnet_pos_y = COALESCE(foto_carnet_pos_y, 35);
