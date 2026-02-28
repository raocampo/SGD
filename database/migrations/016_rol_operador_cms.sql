-- Migracion 016: agregar rol operador para CMS del portal publico

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;

ALTER TABLE usuarios
ADD CONSTRAINT usuarios_rol_check
CHECK (rol IN ('administrador', 'operador', 'organizador', 'tecnico', 'dirigente'));
