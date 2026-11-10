-- Transmisión simultánea en varias plataformas y publicidad en el overlay.
-- También se asegura desde PartidoTransmision / TransmisionOverlay.asegurarTabla.

-- 1. Enlaces del directo por plataforma: [{"plataforma": "YouTube Live", "url": "https://..."}].
--    plataforma/url_publica se conservan como enlace principal (el primero).
ALTER TABLE partido_transmisiones
  ADD COLUMN IF NOT EXISTS enlaces JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE partido_transmisiones
SET enlaces = jsonb_build_array(
  jsonb_build_object('plataforma', COALESCE(plataforma, ''), 'url', url_publica)
)
WHERE COALESCE(TRIM(url_publica), '') <> ''
  AND enlaces = '[]'::jsonb;

-- 2. Publicidad (auspiciantes del campeonato) en el overlay de OBS.
ALTER TABLE transmision_overlay_state
  ADD COLUMN IF NOT EXISTS mostrar_publicidad BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pantalla_entretiempo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS publicidad_segundos INTEGER NOT NULL DEFAULT 8;
