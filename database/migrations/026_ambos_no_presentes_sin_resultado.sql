UPDATE partidos p
SET
  resultado_local = NULL,
  resultado_visitante = NULL,
  estado = 'no_presentaron_ambos'
FROM partido_planillas pp
WHERE pp.partido_id = p.id
  AND (
    COALESCE(pp.ambos_no_presentes, FALSE) = TRUE
    OR COALESCE(pp.inasistencia_equipo, 'ninguno') = 'ambos'
  );
