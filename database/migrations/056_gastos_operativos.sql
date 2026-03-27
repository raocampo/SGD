-- Migración 056: Gastos operativos del organizador
-- Fecha: 2026-03-27
-- Registra costos que paga el organizador (arbitraje, alquiler, tizado,
-- delegado, transporte, comida, etc.) separados de la cuenta corriente de equipos.

CREATE TABLE IF NOT EXISTS gastos_operativos (
  id             SERIAL PRIMARY KEY,
  campeonato_id  INTEGER NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
  evento_id      INTEGER REFERENCES eventos(id) ON DELETE SET NULL,
  partido_id     INTEGER REFERENCES partidos(id) ON DELETE SET NULL,
  categoria      VARCHAR(30) NOT NULL CHECK (categoria IN (
                   'arbitraje','alquiler_cancha','tizado',
                   'delegado','transporte','comida','otro')),
  descripcion    TEXT,
  monto          NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha_gasto    DATE NOT NULL DEFAULT CURRENT_DATE,
  referencia     VARCHAR(120),
  created_by     INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gastos_operativos_campeonato ON gastos_operativos(campeonato_id);
CREATE INDEX IF NOT EXISTS idx_gastos_operativos_evento     ON gastos_operativos(evento_id);
CREATE INDEX IF NOT EXISTS idx_gastos_operativos_partido    ON gastos_operativos(partido_id);
CREATE INDEX IF NOT EXISTS idx_gastos_operativos_fecha      ON gastos_operativos(fecha_gasto);
CREATE INDEX IF NOT EXISTS idx_gastos_operativos_categoria  ON gastos_operativos(categoria);
