CREATE TABLE IF NOT EXISTS campeonato_auspiciantes (
  id SERIAL PRIMARY KEY,
  campeonato_id INTEGER NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
  nombre VARCHAR(160) NOT NULL,
  logo_url TEXT,
  orden INTEGER NOT NULL DEFAULT 1,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auspiciantes_campeonato
  ON campeonato_auspiciantes (campeonato_id);

CREATE INDEX IF NOT EXISTS idx_auspiciantes_activo
  ON campeonato_auspiciantes (campeonato_id, activo, orden, id);
