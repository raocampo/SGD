-- Migracion 017: tabla de noticias para CMS del portal publico

CREATE TABLE IF NOT EXISTS noticias (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(180) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  resumen TEXT,
  contenido TEXT NOT NULL,
  imagen_portada_url TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicada')),
  fuente_sistema VARCHAR(40) NOT NULL DEFAULT 'LOJA_ADMIN_WEB',
  autor_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  publicada_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_noticias_estado ON noticias(estado);
CREATE INDEX IF NOT EXISTS idx_noticias_slug ON noticias(slug);
CREATE INDEX IF NOT EXISTS idx_noticias_publicada_at ON noticias(publicada_at);
