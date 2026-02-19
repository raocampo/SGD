-- Migracion 006: Modulo financiero base (cuenta corriente)
-- Fecha: 2026-02-18

CREATE TABLE IF NOT EXISTS finanzas_movimientos (
  id SERIAL PRIMARY KEY,
  campeonato_id INTEGER NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
  evento_id INTEGER REFERENCES eventos(id) ON DELETE SET NULL,
  equipo_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  partido_id INTEGER REFERENCES partidos(id) ON DELETE SET NULL,
  tipo_movimiento VARCHAR(10) NOT NULL CHECK (tipo_movimiento IN ('cargo','abono')),
  concepto VARCHAR(20) NOT NULL CHECK (concepto IN ('inscripcion','arbitraje','multa','pago','ajuste','otro')),
  descripcion TEXT,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','parcial','pagado','vencido','anulado')),
  fecha_movimiento DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  metodo_pago VARCHAR(30),
  referencia VARCHAR(120),
  origen VARCHAR(20) NOT NULL DEFAULT 'manual',
  origen_clave VARCHAR(120) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_finanzas_movimientos_campeonato ON finanzas_movimientos(campeonato_id);
CREATE INDEX IF NOT EXISTS idx_finanzas_movimientos_evento ON finanzas_movimientos(evento_id);
CREATE INDEX IF NOT EXISTS idx_finanzas_movimientos_equipo ON finanzas_movimientos(equipo_id);
CREATE INDEX IF NOT EXISTS idx_finanzas_movimientos_estado ON finanzas_movimientos(estado);
CREATE INDEX IF NOT EXISTS idx_finanzas_movimientos_fecha ON finanzas_movimientos(fecha_movimiento);
