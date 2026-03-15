CREATE TABLE IF NOT EXISTS evento_reclasificaciones_playoff (
  id SERIAL PRIMARY KEY,
  evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  grupo_id INTEGER NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  slot_posicion INTEGER NOT NULL,
  equipo_a_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  equipo_b_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  ganador_id INTEGER REFERENCES equipos(id) ON DELETE SET NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  detalle TEXT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_evento_reclasificaciones_playoff_slot
ON evento_reclasificaciones_playoff(evento_id, grupo_id, slot_posicion);
