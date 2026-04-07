-- Migración 063: Generalizar tipo de deporte para soportar Baloncesto
-- Retrocompatible: tipo_futbol se mantiene, tipo_deporte lo copia y extiende

-- 1. Agregar columna tipo_deporte a campeonatos
ALTER TABLE campeonatos ADD COLUMN IF NOT EXISTS tipo_deporte VARCHAR(30);

-- 2. Copiar valores existentes de tipo_futbol a tipo_deporte
UPDATE campeonatos SET tipo_deporte = tipo_futbol WHERE tipo_deporte IS NULL;

-- 3. Índice para búsquedas por deporte
CREATE INDEX IF NOT EXISTS idx_campeonatos_tipo_deporte ON campeonatos(tipo_deporte);

-- 4. Cuartos adicionales para baloncesto (faltas por cuarto 3 y 4)
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS faltas_local_3er INTEGER DEFAULT 0;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS faltas_local_4to INTEGER DEFAULT 0;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS faltas_visitante_3er INTEGER DEFAULT 0;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS faltas_visitante_4to INTEGER DEFAULT 0;

-- 5. Overtime para baloncesto (reutiliza campo shootouts pero sin colisión)
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS overtime_utilizado BOOLEAN DEFAULT FALSE;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS overtime_puntos_local INTEGER DEFAULT 0;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS overtime_puntos_visitante INTEGER DEFAULT 0;

-- 6. Tipo de punto en goleadores (2pt, 3pt, libre para baloncesto)
ALTER TABLE goleadores ADD COLUMN IF NOT EXISTS tipo_punto VARCHAR(20);
-- Para fútbol: NULL (usa tipo_gol existente)
-- Para baloncesto: '2pt_campo', '3pt_triple', '1pt_libre'
