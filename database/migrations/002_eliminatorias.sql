-- Migración: Fases eliminatorias (bracket)
-- Ejecutar: psql -U postgres -d gestionDeportiva -f 002_eliminatorias.sql

CREATE TABLE IF NOT EXISTS partidos_eliminatoria (
    id SERIAL PRIMARY KEY,
    evento_id INTEGER REFERENCES eventos(id) ON DELETE CASCADE,
    ronda VARCHAR(30) NOT NULL,  -- '32vos','16vos','8vos','4tos','semifinal','final'
    partido_numero INTEGER NOT NULL,
    equipo_local_id INTEGER REFERENCES equipos(id),
    equipo_visitante_id INTEGER REFERENCES equipos(id),
    ganador_id INTEGER REFERENCES equipos(id),
    resultado_local INTEGER DEFAULT 0,
    resultado_visitante INTEGER DEFAULT 0,
    partido_id INTEGER REFERENCES partidos(id),
    slot_local_id INTEGER REFERENCES partidos_eliminatoria(id),
    slot_visitante_id INTEGER REFERENCES partidos_eliminatoria(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(evento_id, ronda, partido_numero)
);

CREATE INDEX IF NOT EXISTS idx_eliminatoria_evento ON partidos_eliminatoria(evento_id);
CREATE INDEX IF NOT EXISTS idx_eliminatoria_ronda ON partidos_eliminatoria(evento_id, ronda);

COMMENT ON TABLE partidos_eliminatoria IS 'Llave eliminatoria: 32vos, 16vos, 8vos, 4tos, semifinal, final';
