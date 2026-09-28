-- Agrega la categoria 'premios' a gastos_operativos, para poder cruzar
-- el costo de premios contra el ingreso de inscripcion y calcular la
-- utilidad real de esa parte del campeonato (antes solo existian
-- categorias operativas de cancha/arbitraje/logistica, sin premios).
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'gastos_operativos'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%categoria%';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE gastos_operativos DROP CONSTRAINT %I', v_conname);
  END IF;

  ALTER TABLE gastos_operativos
    ADD CONSTRAINT gastos_operativos_categoria_check
    CHECK (categoria IN (
      'arbitraje','alquiler_cancha','tizado',
      'delegado','transporte','comida','premios','otro'));
END $$;
