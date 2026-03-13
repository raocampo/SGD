ALTER TABLE eventos
ADD COLUMN IF NOT EXISTS clasificacion_tabla_acumulada BOOLEAN DEFAULT FALSE;

UPDATE eventos
SET clasificacion_tabla_acumulada = FALSE
WHERE clasificacion_tabla_acumulada IS NULL;

UPDATE eventos e
SET clasificacion_tabla_acumulada = TRUE
FROM evento_playoff_config cfg
WHERE cfg.evento_id = e.id
  AND LOWER(COALESCE(e.metodo_competencia, '')) = 'mixto'
  AND LOWER(COALESCE(cfg.origen, '')) = 'grupos'
  AND LOWER(COALESCE(cfg.metodo_clasificacion, '')) = 'tabla_unica';
