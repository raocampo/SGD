BEGIN;

CREATE TABLE IF NOT EXISTS usuario_password_resets (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuario_password_resets_usuario
  ON usuario_password_resets(usuario_id);

CREATE INDEX IF NOT EXISTS idx_usuario_password_resets_expires
  ON usuario_password_resets(expires_at);

COMMIT;
