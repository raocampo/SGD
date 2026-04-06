-- Migración 058: Ampliar CHECK constraint plan_codigo para incluir planes técnicos
-- campeonato_base/competencia/premium y anual_base/competencia/premium
-- Estos planes ahora tienen límites técnicos reales en planLimits.js

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usuarios_plan_codigo_check'
      AND conrelid = 'usuarios'::regclass
  ) THEN
    ALTER TABLE usuarios DROP CONSTRAINT usuarios_plan_codigo_check;
  END IF;

  ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_plan_codigo_check
    CHECK (plan_codigo IN (
      'demo', 'free', 'base', 'competencia', 'premium',
      'campeonato_base', 'campeonato_competencia', 'campeonato_premium',
      'anual_base', 'anual_competencia', 'anual_premium'
    ));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
