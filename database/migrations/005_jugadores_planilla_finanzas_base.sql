-- Migración 005: Jugadores con documentos + Planilla de partido + Base financiera
-- Fecha: 2026-02-17

-- Requisitos de documentos por campeonato
ALTER TABLE campeonatos
  ADD COLUMN IF NOT EXISTS requiere_foto_cedula BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requiere_foto_carnet BOOLEAN DEFAULT FALSE;

-- Soporte de documentos en jugadores
ALTER TABLE jugadores
  ADD COLUMN IF NOT EXISTS foto_cedula_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_carnet_url TEXT;

-- Planilla por partido (incluye campos financieros básicos)
CREATE TABLE IF NOT EXISTS partido_planillas (
  id SERIAL PRIMARY KEY,
  partido_id INTEGER UNIQUE REFERENCES partidos(id) ON DELETE CASCADE,
  pago_arbitraje NUMERIC(10,2) DEFAULT 0,
  pago_local NUMERIC(10,2) DEFAULT 0,
  pago_visitante NUMERIC(10,2) DEFAULT 0,
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Goleadores (si no existe)
CREATE TABLE IF NOT EXISTS goleadores (
  id SERIAL PRIMARY KEY,
  partido_id INTEGER REFERENCES partidos(id) ON DELETE CASCADE,
  jugador_id INTEGER REFERENCES jugadores(id) ON DELETE SET NULL,
  goles INTEGER DEFAULT 1,
  tipo_gol VARCHAR(20) DEFAULT 'campo',
  minuto INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tarjetas por partido/jugador
CREATE TABLE IF NOT EXISTS tarjetas (
  id SERIAL PRIMARY KEY,
  partido_id INTEGER REFERENCES partidos(id) ON DELETE CASCADE,
  jugador_id INTEGER REFERENCES jugadores(id) ON DELETE SET NULL,
  equipo_id INTEGER REFERENCES equipos(id) ON DELETE SET NULL,
  tipo_tarjeta VARCHAR(20) NOT NULL,
  minuto INTEGER,
  observacion TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_goleadores_partido ON goleadores(partido_id);
CREATE INDEX IF NOT EXISTS idx_tarjetas_partido ON tarjetas(partido_id);
CREATE INDEX IF NOT EXISTS idx_planillas_partido ON partido_planillas(partido_id);
