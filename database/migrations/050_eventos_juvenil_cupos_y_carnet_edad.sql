ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS categoria_juvenil_cupos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS categoria_juvenil_max_diferencia INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS carnet_mostrar_edad BOOLEAN DEFAULT FALSE;

UPDATE eventos
SET categoria_juvenil_cupos = CASE
  WHEN categoria_juvenil = TRUE THEN 2
  ELSE 0
END
WHERE categoria_juvenil_cupos IS NULL;

UPDATE eventos
SET categoria_juvenil_max_diferencia = CASE
  WHEN categoria_juvenil = TRUE THEN 2
  ELSE 1
END
WHERE categoria_juvenil_max_diferencia IS NULL;

UPDATE eventos
SET carnet_mostrar_edad = FALSE
WHERE carnet_mostrar_edad IS NULL;
