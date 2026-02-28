-- Migración 015: Permitir definir si la cédula del jugador es obligatoria por campeonato
-- Fecha: 2026-02-25

ALTER TABLE campeonatos
  ADD COLUMN IF NOT EXISTS requiere_cedula_jugador BOOLEAN DEFAULT TRUE;

UPDATE campeonatos
SET requiere_cedula_jugador = COALESCE(requiere_cedula_jugador, TRUE);
