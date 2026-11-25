-- Publicidad pagada en las transmisiones (además de los auspiciantes del
-- campeonato): imágenes o videos cortos/reels que rotan en el overlay de OBS.
-- También se asegura desde TransmisionAnuncio.asegurarTabla y
-- TransmisionOverlay.asegurarTabla.

CREATE TABLE IF NOT EXISTS transmision_anuncios (
  id SERIAL PRIMARY KEY,
  campeonato_id INTEGER NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
  -- NULL: se muestra en todas las transmisiones del campeonato.
  transmision_id INTEGER REFERENCES partido_transmisiones(id) ON DELETE CASCADE,
  anunciante VARCHAR(120) NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('imagen', 'video')),
  archivo_url TEXT NOT NULL,
  ubicacion VARCHAR(15) NOT NULL DEFAULT 'ambos' CHECK (ubicacion IN ('esquina', 'entretiempo', 'ambos')),
  duracion_segundos INTEGER NOT NULL DEFAULT 10,
  con_sonido BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  orden INTEGER NOT NULL DEFAULT 0,
  fecha_desde DATE,
  fecha_hasta DATE,
  creado_por INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transmision_anuncios_campeonato ON transmision_anuncios(campeonato_id);
CREATE INDEX IF NOT EXISTS idx_transmision_anuncios_transmision ON transmision_anuncios(transmision_id);

-- Permite apagar los auspiciantes del campeonato y dejar solo los anuncios.
ALTER TABLE transmision_overlay_state
  ADD COLUMN IF NOT EXISTS incluir_auspiciantes BOOLEAN NOT NULL DEFAULT TRUE;
