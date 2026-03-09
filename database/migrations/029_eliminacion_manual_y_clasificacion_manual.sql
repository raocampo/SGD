ALTER TABLE evento_equipos
ADD COLUMN IF NOT EXISTS eliminado_manual BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS motivo_eliminacion VARCHAR(80),
ADD COLUMN IF NOT EXISTS detalle_eliminacion TEXT,
ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMP,
ADD COLUMN IF NOT EXISTS eliminado_por_usuario_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_evento_equipos_eliminado_por_usuario'
  ) THEN
    ALTER TABLE evento_equipos
    ADD CONSTRAINT fk_evento_equipos_eliminado_por_usuario
    FOREIGN KEY (eliminado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS evento_clasificados_manuales (
  id SERIAL PRIMARY KEY,
  evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  grupo_id INTEGER NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  slot_posicion INTEGER NOT NULL,
  equipo_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  criterio VARCHAR(120) NOT NULL DEFAULT 'decision_organizador',
  detalle TEXT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_evento_clasificados_manuales_slot
ON evento_clasificados_manuales(evento_id, grupo_id, slot_posicion);

CREATE INDEX IF NOT EXISTS idx_evento_clasificados_manuales_equipo
ON evento_clasificados_manuales(evento_id, grupo_id, equipo_id);

UPDATE evento_equipos
SET eliminado_manual = FALSE,
    motivo_eliminacion = NULL,
    detalle_eliminacion = NULL,
    eliminado_en = NULL,
    eliminado_por_usuario_id = NULL
WHERE eliminado_manual = FALSE
  AND (
    motivo_eliminacion IS NOT NULL
    OR detalle_eliminacion IS NOT NULL
    OR eliminado_en IS NOT NULL
    OR eliminado_por_usuario_id IS NOT NULL
  );
