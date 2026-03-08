ALTER TABLE eventos
ADD COLUMN IF NOT EXISTS clasificados_por_grupo INTEGER;

UPDATE eventos
SET clasificados_por_grupo = 2
WHERE (clasificados_por_grupo IS NULL OR clasificados_por_grupo <= 0)
  AND LOWER(COALESCE(metodo_competencia, 'grupos')) IN ('grupos', 'mixto');

ALTER TABLE evento_equipos
ADD COLUMN IF NOT EXISTS no_presentaciones INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS eliminado_automatico BOOLEAN NOT NULL DEFAULT FALSE;

WITH conteos AS (
  SELECT
    ee.evento_id,
    ee.equipo_id,
    COALESCE(
      SUM(
        CASE
          WHEN COALESCE(pp.inasistencia_equipo, 'ninguno') = 'ambos'
            AND (p.equipo_local_id = ee.equipo_id OR p.equipo_visitante_id = ee.equipo_id)
            THEN 1
          WHEN COALESCE(pp.inasistencia_equipo, 'ninguno') = 'local'
            AND p.equipo_local_id = ee.equipo_id
            THEN 1
          WHEN COALESCE(pp.inasistencia_equipo, 'ninguno') = 'visitante'
            AND p.equipo_visitante_id = ee.equipo_id
            THEN 1
          ELSE 0
        END
      ),
      0
    )::int AS total_no_presentaciones
  FROM evento_equipos ee
  LEFT JOIN partidos p
    ON p.evento_id = ee.evento_id
   AND (p.equipo_local_id = ee.equipo_id OR p.equipo_visitante_id = ee.equipo_id)
  LEFT JOIN partido_planillas pp ON pp.partido_id = p.id
  GROUP BY ee.evento_id, ee.equipo_id
)
UPDATE evento_equipos ee
SET
  no_presentaciones = conteos.total_no_presentaciones,
  eliminado_automatico = conteos.total_no_presentaciones >= 3
FROM conteos
WHERE ee.evento_id = conteos.evento_id
  AND ee.equipo_id = conteos.equipo_id;
