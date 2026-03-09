CREATE TABLE IF NOT EXISTS evento_playoff_config (
    evento_id INTEGER PRIMARY KEY REFERENCES eventos(id) ON DELETE CASCADE,
    origen VARCHAR(20) NOT NULL DEFAULT 'grupos',
    metodo_clasificacion VARCHAR(30) NOT NULL DEFAULT 'cruces_grupos',
    cruces_grupos JSONB,
    guardado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_evento_playoff_config_guardado_por
    ON evento_playoff_config(guardado_por_usuario_id);
