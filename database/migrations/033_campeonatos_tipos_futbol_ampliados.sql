ALTER TABLE campeonatos
  DROP CONSTRAINT IF EXISTS campeonatos_tipo_futbol_check;

ALTER TABLE campeonatos
  ADD CONSTRAINT campeonatos_tipo_futbol_check
  CHECK (
    tipo_futbol IN (
      'futbol_11',
      'futbol_9',
      'futbol_8',
      'futbol_7',
      'futbol_6',
      'futbol_5',
      'futsala',
      'indor'
    )
  );
