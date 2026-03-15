ALTER TABLE eventos
ADD COLUMN IF NOT EXISTS playoff_plantilla VARCHAR(40) NOT NULL DEFAULT 'estandar';

ALTER TABLE eventos
ADD COLUMN IF NOT EXISTS playoff_tercer_puesto BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE eventos
SET playoff_plantilla = 'estandar'
WHERE playoff_plantilla IS NULL
   OR TRIM(COALESCE(playoff_plantilla, '')) = '';

UPDATE eventos
SET playoff_tercer_puesto = COALESCE(playoff_tercer_puesto, FALSE)
WHERE playoff_tercer_puesto IS NULL;

ALTER TABLE evento_playoff_config
ADD COLUMN IF NOT EXISTS plantilla_llave VARCHAR(40) NOT NULL DEFAULT 'estandar';

ALTER TABLE evento_playoff_config
ADD COLUMN IF NOT EXISTS incluir_tercer_puesto BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE evento_playoff_config cfg
SET plantilla_llave = COALESCE(NULLIF(TRIM(cfg.plantilla_llave), ''), e.playoff_plantilla, 'estandar'),
    incluir_tercer_puesto = COALESCE(cfg.incluir_tercer_puesto, e.playoff_tercer_puesto, FALSE)
FROM eventos e
WHERE e.id = cfg.evento_id;
