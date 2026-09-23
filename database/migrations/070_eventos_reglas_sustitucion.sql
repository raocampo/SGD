-- Reglas de sustitución configurables por categoría (futbol_11/9/8):
-- modo "estandar" (FIFA, cambios limitados) vs "entra_sale" (futsal, ilimitado).
ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS modo_sustitucion VARCHAR(20) NOT NULL DEFAULT 'estandar',
  ADD COLUMN IF NOT EXISTS max_cambios_oficiales INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_cambios_salvamento INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'eventos_modo_sustitucion_check'
  ) THEN
    ALTER TABLE eventos
      ADD CONSTRAINT eventos_modo_sustitucion_check
      CHECK (modo_sustitucion IN ('estandar', 'entra_sale'));
  END IF;
END $$;

-- Registro de sustituciones por partido (quién sale, quién entra, minuto,
-- tipo normal/salvamento). Mismo criterio de FKs que goleadores/tarjetas.
CREATE TABLE IF NOT EXISTS partido_cambios (
  id SERIAL PRIMARY KEY,
  partido_id INTEGER REFERENCES partidos(id) ON DELETE CASCADE,
  equipo_id INTEGER REFERENCES equipos(id) ON DELETE SET NULL,
  jugador_sale_id INTEGER REFERENCES jugadores(id) ON DELETE SET NULL,
  jugador_entra_id INTEGER REFERENCES jugadores(id) ON DELETE SET NULL,
  minuto INTEGER,
  tipo VARCHAR(20) NOT NULL DEFAULT 'normal',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_partido_cambios_partido ON partido_cambios(partido_id);
