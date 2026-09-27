-- Migración 072: agregar tipo 'campeonato_resultado' a organizador_portal_media
-- Permite subir imágenes de resultados del torneo que aparecen en el portal público.

DO $$
BEGIN
  -- Eliminar el constraint CHECK anterior (nombre por defecto generado por PG)
  ALTER TABLE organizador_portal_media
    DROP CONSTRAINT IF EXISTS organizador_portal_media_tipo_check;

  -- Agregar el constraint actualizado con el nuevo tipo
  ALTER TABLE organizador_portal_media
    ADD CONSTRAINT organizador_portal_media_tipo_check
    CHECK (tipo IN (
      'landing_hero',
      'landing_gallery',
      'campeonato_card',
      'campeonato_gallery',
      'campeonato_resultado'
    ));
EXCEPTION WHEN OTHERS THEN
  -- Si el constraint tenía un nombre personalizado o ya fue modificado, no abortar
  NULL;
END $$;
