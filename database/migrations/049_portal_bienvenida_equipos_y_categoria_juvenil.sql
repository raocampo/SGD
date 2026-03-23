ALTER TABLE organizador_portal_config
ADD COLUMN IF NOT EXISTS equipos_bienvenida_titulo VARCHAR(220),
ADD COLUMN IF NOT EXISTS equipos_bienvenida_descripcion TEXT,
ADD COLUMN IF NOT EXISTS equipos_bienvenida_imagen_url TEXT;

ALTER TABLE eventos
ADD COLUMN IF NOT EXISTS categoria_juvenil BOOLEAN DEFAULT FALSE;

UPDATE eventos
SET categoria_juvenil = COALESCE(categoria_juvenil, FALSE)
WHERE categoria_juvenil IS NULL;
