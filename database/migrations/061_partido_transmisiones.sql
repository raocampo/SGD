CREATE TABLE IF NOT EXISTS partido_transmisiones (
  id SERIAL PRIMARY KEY,
  partido_id INTEGER NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  campeonato_id INTEGER REFERENCES campeonatos(id) ON DELETE SET NULL,
  evento_id INTEGER REFERENCES eventos(id) ON DELETE SET NULL,
  titulo VARCHAR(200),
  descripcion TEXT,
  plataforma VARCHAR(60),
  url_publica TEXT,
  embed_url TEXT,
  estado VARCHAR(30) NOT NULL DEFAULT 'programada',
  fecha_inicio_programada TIMESTAMPTZ,
  fecha_inicio_real TIMESTAMPTZ,
  fecha_fin_real TIMESTAMPTZ,
  thumbnail_url TEXT,
  creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transmisiones_partido ON partido_transmisiones(partido_id);
CREATE INDEX IF NOT EXISTS idx_transmisiones_estado ON partido_transmisiones(estado);
CREATE INDEX IF NOT EXISTS idx_transmisiones_campeonato ON partido_transmisiones(campeonato_id);
