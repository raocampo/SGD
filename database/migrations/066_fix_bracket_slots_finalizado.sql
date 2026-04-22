-- Migración 066: corrige partidos bracket que quedaron en estado 'pendiente'
-- pese a tener un resultado registrado en partidos_eliminatoria (ganador_id set).
--
-- Causa: cuando los resultados se ingresaron directamente en partidos_eliminatoria
-- (sin pasar por el flujo normal), el registro relacionado en `partidos` no se
-- actualizó a estado='finalizado'. El portal público mostraba esos partidos
-- como "pendientes" aunque ya tenían resultado.
--
-- Esta migración es idempotente: solo afecta partidos cuyo estado siga siendo
-- 'pendiente' Y cuyo slot en partidos_eliminatoria ya tenga ganador_id resuelto.

UPDATE partidos p
SET
  estado            = 'finalizado',
  resultado_local   = pe.resultado_local,
  resultado_visitante = pe.resultado_visitante,
  updated_at        = NOW()
FROM partidos_eliminatoria pe
WHERE pe.partido_id          = p.id
  AND pe.ganador_id          IS NOT NULL
  AND pe.resultado_local     IS NOT NULL
  AND pe.resultado_visitante IS NOT NULL
  AND p.estado               = 'pendiente';
