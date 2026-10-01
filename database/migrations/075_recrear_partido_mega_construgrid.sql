-- Migración 075: Recrear partido MEGA SANTIAGO vs CONSTRUGRID (Grupo B)
-- borrado accidentalmente en producción.
-- El partido es de la misma jornada que los otros dos finalizados del 2026-09-26
-- (TELCONET LATAM FC vs IASA S.A. y CORPORACIÓN PROAUTO vs DISTRI MAJAS).
-- Se inserta con estado='finalizado' y fecha=2026-09-26 para que
-- renumerarJornadasPreservadas lo agrupe en jornada 1 junto a los demás.
-- El usuario debe re-ingresar el resultado real en la planilla del partido.

DO $$
DECLARE
  v_campeonato_id  integer;
  v_evento_id      integer;
  v_grupo_id       integer;
  v_mega_id        integer;
  v_construgrid_id integer;
  v_existe         boolean;
BEGIN
  -- Buscar equipos por nombre (insensible a mayúsculas/tildes)
  SELECT id INTO v_mega_id
  FROM equipos
  WHERE LOWER(unaccent(nombre)) LIKE '%mega santiago%'
  ORDER BY id DESC LIMIT 1;

  SELECT id INTO v_construgrid_id
  FROM equipos
  WHERE LOWER(unaccent(nombre)) LIKE '%construgrid%'
     OR LOWER(unaccent(nombre)) LIKE '%constructora grid%'
  ORDER BY id DESC LIMIT 1;

  IF v_mega_id IS NULL OR v_construgrid_id IS NULL THEN
    RAISE EXCEPTION 'No se encontraron los equipos. MEGA SANTIAGO: %, CONSTRUGRID: %',
      v_mega_id, v_construgrid_id;
  END IF;

  -- Buscar el grupo B donde ambos equipos están inscritos
  SELECT g.id, g.evento_id INTO v_grupo_id, v_evento_id
  FROM grupos g
  JOIN grupo_equipos ge1 ON ge1.grupo_id = g.id AND ge1.equipo_id = v_mega_id
  JOIN grupo_equipos ge2 ON ge2.grupo_id = g.id AND ge2.equipo_id = v_construgrid_id
  WHERE (LOWER(g.letra_grupo) = 'b' OR LOWER(g.nombre_grupo) LIKE '%grupo b%')
  ORDER BY g.id DESC LIMIT 1;

  IF v_grupo_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró un Grupo B con ambos equipos (IDs % y %)',
      v_mega_id, v_construgrid_id;
  END IF;

  SELECT campeonato_id INTO v_campeonato_id
  FROM eventos WHERE id = v_evento_id;

  -- Verificar si ya existe un partido finalizado entre estos equipos en este evento
  SELECT EXISTS (
    SELECT 1 FROM partidos
    WHERE evento_id = v_evento_id
      AND estado = 'finalizado'
      AND (
        (equipo_local_id = v_mega_id AND equipo_visitante_id = v_construgrid_id)
        OR (equipo_local_id = v_construgrid_id AND equipo_visitante_id = v_mega_id)
      )
  ) INTO v_existe;

  IF v_existe THEN
    RAISE NOTICE 'Ya existe un partido finalizado entre MEGA SANTIAGO y CONSTRUGRID. No se creó duplicado.';
    RETURN;
  END IF;

  -- Eliminar la versión pendiente generada por el regenerar (si existe)
  DELETE FROM partidos
  WHERE evento_id = v_evento_id
    AND (estado IS NULL OR estado IN ('pendiente', 'programado'))
    AND (
      (equipo_local_id = v_mega_id AND equipo_visitante_id = v_construgrid_id)
      OR (equipo_local_id = v_construgrid_id AND equipo_visitante_id = v_mega_id)
    );

  -- Insertar el partido como finalizado
  -- resultado_local y resultado_visitante quedan en 0/0 como placeholder
  -- → el usuario debe re-ingresar el resultado real desde la planilla
  INSERT INTO partidos (
    campeonato_id,
    grupo_id,
    equipo_local_id,
    equipo_visitante_id,
    estado,
    fecha_partido,
    jornada,
    evento_id,
    resultado_local,
    resultado_visitante
  ) VALUES (
    v_campeonato_id,
    v_grupo_id,
    v_mega_id,
    v_construgrid_id,
    'finalizado',
    '2026-09-26',
    3,           -- jornada tentativa; será renumerada por regenerarFixturePreservandoJugados
    v_evento_id,
    0,           -- placeholder — actualizar con resultado real desde planilla
    0            -- placeholder — actualizar con resultado real desde planilla
  );

  RAISE NOTICE 'Partido recreado: MEGA SANTIAGO (id=%) vs CONSTRUGRID (id=%) | grupo_id=% evento_id=% campeonato_id=%',
    v_mega_id, v_construgrid_id, v_grupo_id, v_evento_id, v_campeonato_id;
  RAISE NOTICE 'SIGUIENTE PASO: ir a Partidos → Regenerar (preservar jugados) para que quede en jornada 1.';
  RAISE NOTICE 'PENDIENTE: re-ingresar el resultado real en la planilla del partido recreado.';
END $$;
