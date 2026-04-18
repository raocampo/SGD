-- Migración 064: tabla transmision_overlay_state para estado del marcador en vivo
-- Almacena el estado del overlay para cada transmisión activa

CREATE TABLE IF NOT EXISTS transmision_overlay_state (
  id              SERIAL PRIMARY KEY,
  transmision_id  INTEGER NOT NULL REFERENCES partido_transmisiones(id) ON DELETE CASCADE,
  goles_local     INTEGER NOT NULL DEFAULT 0,
  goles_visitante INTEGER NOT NULL DEFAULT 0,
  minuto          INTEGER NOT NULL DEFAULT 0,
  periodo         VARCHAR(30) NOT NULL DEFAULT '1T',
  estado          VARCHAR(30) NOT NULL DEFAULT 'esperando',  -- esperando | en_curso | descanso | finalizado
  texto_evento    TEXT,
  mostrar_marcador      BOOLEAN NOT NULL DEFAULT TRUE,
  mostrar_cronometro    BOOLEAN NOT NULL DEFAULT TRUE,
  mostrar_texto_evento  BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_overlay_transmision UNIQUE (transmision_id)
);

CREATE INDEX IF NOT EXISTS idx_overlay_transmision ON transmision_overlay_state(transmision_id);
