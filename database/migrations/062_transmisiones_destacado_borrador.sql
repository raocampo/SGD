-- Fase 2: Agrega columna destacado a partido_transmisiones
-- El estado 'borrador' no requiere cambio de esquema (estado es VARCHAR(30))

ALTER TABLE partido_transmisiones ADD COLUMN IF NOT EXISTS destacado BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_transmisiones_destacado ON partido_transmisiones(destacado) WHERE destacado = TRUE;
