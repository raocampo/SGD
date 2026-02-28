-- Migracion 020: mensajes del formulario de contacto del portal publico

CREATE TABLE IF NOT EXISTS contacto_mensajes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(160) NOT NULL,
  telefono VARCHAR(40),
  email VARCHAR(180) NOT NULL,
  mensaje TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'leido', 'respondido', 'archivado')),
  origen VARCHAR(40) NOT NULL DEFAULT 'portal_publico',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contacto_mensajes_estado ON contacto_mensajes(estado);
CREATE INDEX IF NOT EXISTS idx_contacto_mensajes_created_at ON contacto_mensajes(created_at DESC);
