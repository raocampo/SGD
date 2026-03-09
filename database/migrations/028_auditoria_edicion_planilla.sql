-- 028_auditoria_edicion_planilla.sql
-- Auditoria de ediciones en planillas ya finalizadas

CREATE TABLE IF NOT EXISTS partido_planilla_ediciones (
  id SERIAL PRIMARY KEY,
  partido_id INTEGER NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  motivo TEXT NOT NULL,
  estado_anterior JSONB NOT NULL,
  estado_nuevo JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_partido_planilla_ediciones_partido
  ON partido_planilla_ediciones(partido_id, created_at DESC);

