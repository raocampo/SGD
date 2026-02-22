-- 013_planes_usuarios.sql
-- Planes de suscripción por usuario para límites operativos.

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS plan_codigo VARCHAR(24) NOT NULL DEFAULT 'premium';

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS plan_estado VARCHAR(20) NOT NULL DEFAULT 'activo';

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_plan_codigo_check;
ALTER TABLE usuarios
ADD CONSTRAINT usuarios_plan_codigo_check
CHECK (plan_codigo IN ('demo', 'free', 'base', 'competencia', 'premium'));

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_plan_estado_check;
ALTER TABLE usuarios
ADD CONSTRAINT usuarios_plan_estado_check
CHECK (plan_estado IN ('activo', 'suspendido'));

CREATE INDEX IF NOT EXISTS idx_usuarios_plan_codigo ON usuarios(plan_codigo);
CREATE INDEX IF NOT EXISTS idx_usuarios_plan_estado ON usuarios(plan_estado);

