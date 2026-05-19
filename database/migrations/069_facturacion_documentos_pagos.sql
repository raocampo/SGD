-- Migracion 069: Facturacion y vinculo de documentos con movimientos financieros
-- Fecha: 2026-05-15

CREATE TABLE IF NOT EXISTS facturacion_config (
  id SERIAL PRIMARY KEY,
  organizador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_contribuyente VARCHAR(10) NOT NULL DEFAULT 'ruc'
    CHECK (tipo_contribuyente IN ('ruc', 'rise')),
  ruc_ci VARCHAR(20),
  razon_social VARCHAR(200),
  nombre_comercial VARCHAR(200),
  direccion_matriz TEXT,
  codigo_establecimiento VARCHAR(3) NOT NULL DEFAULT '001',
  punto_emision VARCHAR(3) NOT NULL DEFAULT '001',
  iva_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  secuencial_factura INTEGER NOT NULL DEFAULT 0,
  secuencial_nota_venta INTEGER NOT NULL DEFAULT 0,
  secuencial_recibo INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organizador_id)
);

CREATE TABLE IF NOT EXISTS documentos_facturacion (
  id SERIAL PRIMARY KEY,
  organizador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  campeonato_id INTEGER REFERENCES campeonatos(id) ON DELETE SET NULL,
  equipo_id INTEGER REFERENCES equipos(id) ON DELETE SET NULL,
  tipo VARCHAR(15) NOT NULL CHECK (tipo IN ('factura', 'nota_venta', 'recibo')),
  serie VARCHAR(10),
  secuencial INTEGER,
  numero_completo VARCHAR(30),
  receptor_nombre VARCHAR(200),
  receptor_ruc_ci VARCHAR(20),
  receptor_email VARCHAR(150),
  receptor_direccion TEXT,
  subtotal_sin_iva NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento NUMERIC(12,2) NOT NULL DEFAULT 0,
  base_imponible NUMERIC(12,2) NOT NULL DEFAULT 0,
  iva_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  iva_valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado VARCHAR(15) NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'emitido', 'anulado')),
  observaciones TEXT,
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documentos_items (
  id SERIAL PRIMARY KEY,
  documento_id INTEGER NOT NULL REFERENCES documentos_facturacion(id) ON DELETE CASCADE,
  descripcion VARCHAR(300) NOT NULL,
  cantidad NUMERIC(10,2) NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(12,2) NOT NULL,
  descuento NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documentos_pagos (
  id SERIAL PRIMARY KEY,
  documento_id INTEGER NOT NULL REFERENCES documentos_facturacion(id) ON DELETE CASCADE,
  movimiento_id INTEGER NOT NULL REFERENCES finanzas_movimientos(id) ON DELETE RESTRICT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (documento_id, movimiento_id),
  UNIQUE (movimiento_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_facturacion_org
  ON documentos_facturacion(organizador_id);

CREATE INDEX IF NOT EXISTS idx_doc_facturacion_campeonato
  ON documentos_facturacion(campeonato_id);

CREATE INDEX IF NOT EXISTS idx_doc_facturacion_estado
  ON documentos_facturacion(estado);

CREATE INDEX IF NOT EXISTS idx_documentos_pagos_doc
  ON documentos_pagos(documento_id);

CREATE INDEX IF NOT EXISTS idx_documentos_pagos_mov
  ON documentos_pagos(movimiento_id);
