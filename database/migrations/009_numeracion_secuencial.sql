-- Migracion 009: Numeracion secuencial por organizador/campeonato
-- Fecha: 2026-02-20

-- Campeonatos: secuencia por organizador
ALTER TABLE IF EXISTS campeonatos
  ADD COLUMN IF NOT EXISTS numero_organizador INTEGER;

WITH ranked_campeonatos AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(COALESCE(TRIM(organizador), 'sin_organizador'))
      ORDER BY id
    )::int AS rn
  FROM campeonatos
)
UPDATE campeonatos c
SET numero_organizador = ranked_campeonatos.rn
FROM ranked_campeonatos
WHERE c.id = ranked_campeonatos.id
  AND c.numero_organizador IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_campeonatos_org_numero
  ON campeonatos ((LOWER(COALESCE(TRIM(organizador), 'sin_organizador'))), numero_organizador)
  WHERE numero_organizador IS NOT NULL;

-- Eventos/Categorias: secuencia por campeonato
ALTER TABLE IF EXISTS eventos
  ADD COLUMN IF NOT EXISTS numero_campeonato INTEGER;

WITH ranked_eventos AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY campeonato_id
      ORDER BY id
    )::int AS rn
  FROM eventos
  WHERE campeonato_id IS NOT NULL
)
UPDATE eventos e
SET numero_campeonato = ranked_eventos.rn
FROM ranked_eventos
WHERE e.id = ranked_eventos.id
  AND e.numero_campeonato IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_eventos_numero_campeonato
  ON eventos(campeonato_id, numero_campeonato)
  WHERE numero_campeonato IS NOT NULL;

-- Equipos: secuencia por campeonato
ALTER TABLE IF EXISTS equipos
  ADD COLUMN IF NOT EXISTS numero_campeonato INTEGER;

WITH ranked_equipos AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY campeonato_id
      ORDER BY id
    )::int AS rn
  FROM equipos
  WHERE campeonato_id IS NOT NULL
)
UPDATE equipos e
SET numero_campeonato = ranked_equipos.rn
FROM ranked_equipos
WHERE e.id = ranked_equipos.id
  AND e.numero_campeonato IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_equipos_numero_campeonato
  ON equipos(campeonato_id, numero_campeonato)
  WHERE numero_campeonato IS NOT NULL;

-- Partidos: secuencia por campeonato
ALTER TABLE IF EXISTS partidos
  ADD COLUMN IF NOT EXISTS numero_campeonato INTEGER;

WITH ranked_partidos AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY campeonato_id
      ORDER BY id
    )::int AS rn
  FROM partidos
  WHERE campeonato_id IS NOT NULL
)
UPDATE partidos p
SET numero_campeonato = ranked_partidos.rn
FROM ranked_partidos
WHERE p.id = ranked_partidos.id
  AND p.numero_campeonato IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_partidos_numero_campeonato
  ON partidos(campeonato_id, numero_campeonato)
  WHERE numero_campeonato IS NOT NULL;

-- Finanzas: secuencia de recibos por campeonato (solo origen manual)
ALTER TABLE IF EXISTS finanzas_movimientos
  ADD COLUMN IF NOT EXISTS numero_recibo_campeonato INTEGER;

WITH maximos AS (
  SELECT
    campeonato_id,
    COALESCE(MAX(numero_recibo_campeonato), 0)::int AS max_num
  FROM finanzas_movimientos
  WHERE numero_recibo_campeonato IS NOT NULL
  GROUP BY campeonato_id
),
ranked_recibos AS (
  SELECT
    fm.id,
    (COALESCE(mx.max_num, 0) + ROW_NUMBER() OVER (
      PARTITION BY fm.campeonato_id
      ORDER BY fm.id
    ))::int AS rn
  FROM finanzas_movimientos fm
  LEFT JOIN maximos mx ON mx.campeonato_id = fm.campeonato_id
  WHERE fm.numero_recibo_campeonato IS NULL
    AND COALESCE(fm.origen, 'manual') = 'manual'
)
UPDATE finanzas_movimientos fm
SET numero_recibo_campeonato = ranked_recibos.rn
FROM ranked_recibos
WHERE fm.id = ranked_recibos.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_finanzas_movimientos_num_recibo
  ON finanzas_movimientos(campeonato_id, numero_recibo_campeonato)
  WHERE numero_recibo_campeonato IS NOT NULL;
