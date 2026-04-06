-- Migración 060: Tabla para comprobantes de pago subidos por organizadores
-- Usada en la activación manual por transferencia, depósito, AHORITA, DE UNA, QR

CREATE TABLE IF NOT EXISTS comprobantes_pago (
  id            SERIAL PRIMARY KEY,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  archivo_url   TEXT    NOT NULL,
  estado        VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  nota_admin    TEXT,
  revisado_por  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comprobantes_usuario ON comprobantes_pago(usuario_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado  ON comprobantes_pago(estado);
CREATE INDEX IF NOT EXISTS idx_comprobantes_created ON comprobantes_pago(created_at DESC);
