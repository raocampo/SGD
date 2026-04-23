-- Categorías Sub-4 a Sub-19: fecha de corte para validación de edad exacta
ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS fecha_corte_edad DATE;
