-- Migración: módulo de pases de jugadores entre equipos

CREATE TABLE IF NOT EXISTS pases_jugadores (
    id SERIAL PRIMARY KEY,
    campeonato_id INTEGER REFERENCES campeonatos(id) ON DELETE SET NULL,
    evento_id INTEGER REFERENCES eventos(id) ON DELETE SET NULL,
    jugador_id INTEGER NOT NULL REFERENCES jugadores(id) ON DELETE CASCADE,
    equipo_origen_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE RESTRICT,
    equipo_destino_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE RESTRICT,
    monto NUMERIC(12,2) NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    fecha_pase DATE NOT NULL DEFAULT CURRENT_DATE,
    pagado_en TIMESTAMP NULL,
    observacion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pases_campeonato ON pases_jugadores(campeonato_id);
CREATE INDEX IF NOT EXISTS idx_pases_evento ON pases_jugadores(evento_id);
CREATE INDEX IF NOT EXISTS idx_pases_jugador ON pases_jugadores(jugador_id);
CREATE INDEX IF NOT EXISTS idx_pases_estado ON pases_jugadores(estado);
