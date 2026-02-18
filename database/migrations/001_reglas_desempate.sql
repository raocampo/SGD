-- Migración: Reglas de desempate configurables por campeonato
-- Ejecutar en dBeaver: selecciona todo y usa Execute SQL Script (Ctrl+Alt+X)

ALTER TABLE campeonatos ADD COLUMN IF NOT EXISTS reglas_desempate TEXT DEFAULT '["puntos","diferencia_goles","goles_favor"]';

COMMENT ON COLUMN campeonatos.reglas_desempate IS 'Orden de criterios para desempate: puntos, diferencia_goles, goles_favor, goles_contra, enfrentamiento_directo, fair_play';
