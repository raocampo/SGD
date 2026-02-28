-- Migracion 018: galeria institucional del portal

CREATE TABLE IF NOT EXISTS galeria_items (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(180) NOT NULL,
  descripcion TEXT,
  imagen_url TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_galeria_items_activo ON galeria_items(activo);
CREATE INDEX IF NOT EXISTS idx_galeria_items_orden ON galeria_items(orden, id);
