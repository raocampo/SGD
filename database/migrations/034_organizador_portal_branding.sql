-- Branding y media propia del portal publico por organizador

CREATE TABLE IF NOT EXISTS organizador_portal_config (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  organizacion_nombre VARCHAR(180),
  logo_url TEXT,
  lema VARCHAR(220),
  hero_title VARCHAR(220),
  hero_description TEXT,
  hero_chip VARCHAR(120),
  hero_cta_label VARCHAR(120),
  hero_image_url TEXT,
  about_title VARCHAR(180),
  about_text_1 TEXT,
  about_text_2 TEXT,
  contact_email VARCHAR(180),
  contact_phone VARCHAR(40),
  facebook_url TEXT,
  instagram_url TEXT,
  whatsapp_url TEXT,
  color_primario VARCHAR(20),
  color_secundario VARCHAR(20),
  color_acento VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organizador_portal_config_usuario
  ON organizador_portal_config(usuario_id);

CREATE TABLE IF NOT EXISTS organizador_portal_media (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  campeonato_id INTEGER REFERENCES campeonatos(id) ON DELETE CASCADE,
  tipo VARCHAR(40) NOT NULL CHECK (tipo IN (
    'landing_hero',
    'landing_gallery',
    'campeonato_card',
    'campeonato_gallery'
  )),
  titulo VARCHAR(180),
  descripcion TEXT,
  imagen_url TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 1,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organizador_portal_media_usuario
  ON organizador_portal_media(usuario_id, tipo, activo, orden, id);

CREATE INDEX IF NOT EXISTS idx_organizador_portal_media_campeonato
  ON organizador_portal_media(campeonato_id, tipo, activo, orden, id);

CREATE TABLE IF NOT EXISTS organizador_portal_auspiciantes (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre VARCHAR(180) NOT NULL,
  logo_url TEXT NOT NULL,
  enlace_url TEXT,
  orden INTEGER NOT NULL DEFAULT 1,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organizador_portal_auspiciantes_usuario
  ON organizador_portal_auspiciantes(usuario_id, activo, orden, id);

INSERT INTO organizador_portal_config (
  usuario_id,
  organizacion_nombre,
  contact_email
)
SELECT
  u.id,
  NULLIF(TRIM(COALESCE(u.organizacion_nombre, u.nombre, '')), ''),
  NULLIF(TRIM(COALESCE(u.email, '')), '')
FROM usuarios u
WHERE LOWER(COALESCE(u.rol, '')) = 'organizador'
  AND NOT EXISTS (
    SELECT 1
    FROM organizador_portal_config opc
    WHERE opc.usuario_id = u.id
  );
