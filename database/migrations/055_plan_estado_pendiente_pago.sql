-- 055_plan_estado_pendiente_pago.sql
-- Amplía el constraint de plan_estado para permitir 'pendiente_pago'
-- cuando un organizador se registra con plan pagado (base/competencia/premium)
-- y aún no ha confirmado el pago con el administrador.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usuarios_plan_estado_check'
      AND conrelid = 'usuarios'::regclass
  ) THEN
    ALTER TABLE usuarios DROP CONSTRAINT usuarios_plan_estado_check;
  END IF;

  ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_plan_estado_check
  CHECK (plan_estado IN ('activo', 'suspendido', 'pendiente_pago'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
