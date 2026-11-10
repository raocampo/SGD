-- tipo_futbol sigue como alias de tipo_deporte (063) y el modelo guarda el
-- mismo valor en ambas columnas, pero tipo_futbol era VARCHAR(10) con un
-- CHECK solo de fútbol: crear un campeonato de básquetbol fallaba con 500.
-- Lista alineada con backend/config/sportsConfig.js (CONFIGS).
ALTER TABLE campeonatos ALTER COLUMN tipo_futbol TYPE VARCHAR(30);

ALTER TABLE campeonatos DROP CONSTRAINT IF EXISTS campeonatos_tipo_futbol_check;

ALTER TABLE campeonatos
  ADD CONSTRAINT campeonatos_tipo_futbol_check
  CHECK (
    tipo_futbol IN (
      'futbol_11', 'futbol_9', 'futbol_8', 'futbol_7', 'futbol_6', 'futbol_5',
      'futsala', 'indor',
      'basquetbol', 'basquetbol_3x3', 'basquetbol_minibasket', 'basquetbol_callejero'
    )
  );
