-- Migración 059: Tabla de auditoría de acciones críticas del sistema
-- Registra quién hizo qué, cuándo y desde dónde

CREATE TABLE IF NOT EXISTS auditoria (
  id           SERIAL PRIMARY KEY,
  usuario_id   INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  accion       VARCHAR(80)  NOT NULL,
  entidad      VARCHAR(60),
  entidad_id   INTEGER,
  detalle_json JSONB,
  ip           VARCHAR(45),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario   ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion    ON auditoria(accion);
CREATE INDEX IF NOT EXISTS idx_auditoria_created   ON auditoria(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad   ON auditoria(entidad, entidad_id);
