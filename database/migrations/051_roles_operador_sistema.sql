-- Migration 051: agregar rol operador_sistema al CHECK constraint de usuarios
-- operador         = gestiona CMS web (noticias, galeria, contenido del portal)
-- operador_sistema = gestiona planillas de partido y consulta módulos deportivos

-- 1. Eliminar el constraint existente
ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_rol_check;

-- 2. Recrear con los nuevos roles (operador_sistema añadido)
ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN (
    'administrador',
    'operador',
    'operador_sistema',
    'organizador',
    'tecnico',
    'dirigente',
    'jugador'
  ));
