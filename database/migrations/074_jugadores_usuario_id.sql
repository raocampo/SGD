-- Vincula un jugador cargado en planilla (jugadores.cedidentidad) con su
-- cuenta de login (usuarios), cuando el propio jugador se autoregistra
-- y elige su equipo + cédula en la pantalla de asociación post-registro.
-- Nullable: la inmensa mayoria de jugadores no tienen ni necesitan cuenta.
ALTER TABLE jugadores
  ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jugadores_usuario_id ON jugadores(usuario_id);
