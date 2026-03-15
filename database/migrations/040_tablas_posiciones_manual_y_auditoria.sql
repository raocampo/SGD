CREATE TABLE IF NOT EXISTS tabla_posiciones_manuales (
  id SERIAL PRIMARY KEY,
  evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  grupo_id INTEGER REFERENCES grupos(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tabla_posiciones_manuales_scope
ON tabla_posiciones_manuales(evento_id, COALESCE(grupo_id, 0));

CREATE TABLE IF NOT EXISTS tabla_posiciones_auditoria (
  id SERIAL PRIMARY KEY,
  evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  grupo_id INTEGER REFERENCES grupos(id) ON DELETE CASCADE,
  comentario TEXT NOT NULL,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  snapshot_anterior JSONB,
  snapshot_nuevo JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tabla_posiciones_auditoria_evento
ON tabla_posiciones_auditoria(evento_id, created_at DESC);
