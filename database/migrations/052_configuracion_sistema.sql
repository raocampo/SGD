-- Migración 052: Tabla de configuración global del sistema
-- Almacena precios de planes y otros parámetros configurables desde el panel admin.

CREATE TABLE IF NOT EXISTS configuracion_sistema (
  clave   VARCHAR(120) PRIMARY KEY,
  valor   TEXT         NOT NULL,
  tipo    VARCHAR(20)  NOT NULL DEFAULT 'string'
            CHECK (tipo IN ('string', 'number', 'boolean', 'json')),
  descripcion TEXT,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Precios mensuales por plan (en USD)
INSERT INTO configuracion_sistema (clave, valor, tipo, descripcion)
VALUES
  ('plan_precio_demo',        '0',  'number', 'Precio mensual del plan Demo (USD)'),
  ('plan_precio_free',        '0',  'number', 'Precio mensual del plan Free (USD)'),
  ('plan_precio_base',        '15', 'number', 'Precio mensual del plan Base (USD)'),
  ('plan_precio_competencia', '35', 'number', 'Precio mensual del plan Competencia (USD)'),
  ('plan_precio_premium',     '70', 'number', 'Precio mensual del plan Premium (USD)')
ON CONFLICT (clave) DO NOTHING;
