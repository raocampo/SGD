-- Sello (stamp) y firma (signature) del organizador, para que los recibos
-- financieros salgan "firmados" automáticamente al emitirse/imprimirse,
-- sin depender de una firma física por documento. Configuración por
-- organizador_id (mismo criterio multi-tenant que el resto de
-- facturacion_config).
ALTER TABLE facturacion_config
  ADD COLUMN IF NOT EXISTS sello_url TEXT,
  ADD COLUMN IF NOT EXISTS firma_url TEXT;
