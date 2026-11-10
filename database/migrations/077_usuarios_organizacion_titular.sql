-- Co-organizadores: cuentas de login adicionales de una organización existente.
-- Un organizador con organizacion_titular_id opera con la identidad del
-- organizador titular (sus campeonatos, equipos, finanzas, landing y plan),
-- pero conserva su propio usuario, contraseña y estado activo.
-- ON DELETE SET NULL: eliminar al titular no borra la cuenta del co-organizador.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS organizacion_titular_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_organizacion_titular ON usuarios(organizacion_titular_id);
