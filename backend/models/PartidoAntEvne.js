/*models\Partido.js*/

const pool = require("../config/database");

class Partido {
  // CREATE - Crear nuevo partido (con validación de grupo)
  static async crear(
    campeonato_id,
    grupo_id,
    equipo_local_id,
    equipo_visitante_id,
    fecha_partido,
    hora_partido,
    cancha,
    jornada,
  ) {
    // Validar que los equipos sean diferentes
    if (equipo_local_id === equipo_visitante_id) {
      throw new Error("Un equipo no puede jugar contra sí mismo");
    }

    // Validar que los equipos pertenezcan al mismo grupo
    const validacionQuery = `
      SELECT COUNT(*) as count 
      FROM grupo_equipos 
      WHERE grupo_id = $1 AND equipo_id IN ($2, $3)
    `;
    const validacionResult = await pool.query(validacionQuery, [
      grupo_id,
      equipo_local_id,
      equipo_visitante_id,
    ]);

    if (parseInt(validacionResult.rows[0].count) !== 2) {
      throw new Error("Los equipos deben pertenecer al mismo grupo");
    }

    const query = `
      INSERT INTO partidos 
      (campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, jornada) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *
    `;
    const values = [
      campeonato_id,
      grupo_id,
      equipo_local_id,
      equipo_visitante_id,
      fecha_partido,
      hora_partido,
      cancha,
      jornada,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // === CREATE sin validar que estén en grupo (para "todos contra todos" sin grupos) ===
  static async crearSinValidarGrupo(
    campeonato_id,
    grupo_id, // puede ser null
    equipo_local_id,
    equipo_visitante_id,
    fecha_partido,
    hora_partido,
    cancha,
    jornada,
  ) {
    if (equipo_local_id === equipo_visitante_id) {
      throw new Error("Un equipo no puede jugar contra sí mismo");
    }

    const query = `
      INSERT INTO partidos 
      (campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, jornada) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *
    `;
    const values = [
      campeonato_id,
      grupo_id,
      equipo_local_id,
      equipo_visitante_id,
      fecha_partido,
      hora_partido,
      cancha,
      jornada,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async generarFixture(params) {
    // ✅ Soporta llamado antiguo (por compatibilidad)
    // generarFixture(grupo_id, fecha_inicio, intervalo_dias, ida_y_vuelta, hora_inicio, hora_fin, cancha_base)
    let cfg = {};
    if (
      typeof params !== "object" ||
      params === null ||
      Array.isArray(params)
    ) {
      const [
        grupo_id,
        fecha_inicio,
        intervalo_dias = 7,
        ida_y_vuelta = false,
        hora_inicio = "13:00",
        hora_fin = "18:00",
        cancha_base = null,
      ] = arguments;

      cfg = {
        grupo_id,
        fecha_inicio,
        fecha_fin: null,
        intervalo_dias,
        ida_y_vuelta,
        hora_inicio,
        hora_fin,
        cancha_base,
        duracion_min: 90,
        descanso_min: 10,
      };
    } else {
      cfg = {
        grupo_id: params.grupo_id,
        fecha_inicio: params.fecha_inicio,
        fecha_fin: params.fecha_fin || null,
        intervalo_dias: params.intervalo_dias ?? 7,
        ida_y_vuelta: params.ida_y_vuelta === true,
        hora_inicio: params.hora_inicio || "13:00",
        hora_fin: params.hora_fin || "18:00",
        cancha_base: params.cancha_base || null,
        duracion_min: Number.isFinite(params.duracion_min)
          ? params.duracion_min
          : 90,
        descanso_min: Number.isFinite(params.descanso_min)
          ? params.descanso_min
          : 10,
      };
    }

    const {
      grupo_id,
      fecha_inicio,
      fecha_fin,
      intervalo_dias,
      ida_y_vuelta,
      hora_inicio,
      hora_fin,
      cancha_base,
      duracion_min,
      descanso_min,
    } = cfg;

    // 1) Equipos del grupo
    const equiposQuery = `
    SELECT equipo_id
    FROM grupo_equipos
    WHERE grupo_id = $1
    ORDER BY equipo_id
  `;
    const equiposResult = await pool.query(equiposQuery, [grupo_id]);
    const equipos = equiposResult.rows.map((row) => row.equipo_id);

    if (equipos.length < 2) {
      throw new Error(
        "El grupo debe tener al menos 2 equipos para generar fixture",
      );
    }

    // 2) Info grupo + campeonato
    const grupoQuery = `
    SELECT g.*, c.id as campeonato_id
    FROM grupos g
    JOIN campeonatos c ON g.campeonato_id = c.id
    WHERE g.id = $1
  `;
    const grupoResult = await pool.query(grupoQuery, [grupo_id]);
    const grupo = grupoResult.rows[0];
    if (!grupo) throw new Error("Grupo no encontrado");

    // 3) Fixture base (IDA)
    const fixtureIda = this.generarRoundRobin(equipos);

    // Helpers fecha/hora
    const formatearFecha = (fecha) => fecha.toISOString().split("T")[0];

    const toMinutes = (hhmm) => {
      const [h, m] = String(hhmm || "0:0")
        .split(":")
        .map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const fromMinutesSQL = (min) => {
      const h = String(Math.floor(min / 60)).padStart(2, "0");
      const m = String(min % 60).padStart(2, "0");
      return `${h}:${m}:00`;
    };

    const formatYMD = (d) => d.toISOString().split("T")[0];

    const DEFAULT_WINDOWS_WEEKEND = {
      6: { start: "13:00", end: "20:00" }, // sábado
      0: { start: "08:00", end: "15:00" }, // domingo
    };

    // Retorna ventana para fecha (solo sábado/domingo)
    const getWeekendWindow = (dateObj) => {
      const w = DEFAULT_WINDOWS_WEEKEND[dateObj.getDay()];
      if (!w) return null;
      return { startMin: toMinutes(w.start), endMin: toMinutes(w.end) };
    };

    const inicioMin = toMinutes(hora_inicio);
    const finMin = toMinutes(hora_fin);

    if (
      !Number.isFinite(inicioMin) ||
      !Number.isFinite(finMin) ||
      finMin <= inicioMin
    ) {
      throw new Error(
        "Rango de horas inválido. Revisa hora_inicio y hora_fin.",
      );
    }

    const dur = Math.max(1, parseInt(duracion_min || 90));
    const desc = Math.max(0, parseInt(descanso_min || 10));
    const slotMin = dur + desc;

    const canchaSQLBase = cancha_base || `Cancha ${grupo.letra_grupo || "A"}`;

    let fechaActual = new Date(fecha_inicio);
    const fechaFin = fecha_fin ? new Date(fecha_fin) : null;

    const partidosGenerados = [];
    let jornada = 1;

    // ✅ Función que agenda una jornada completa con horarios reales
    const agendarJornada = async (jornadaFixture, invertirLocalia = false) => {
      // Si hay fecha_fin, validar que no nos pasemos
      if (fechaFin && fechaActual > fechaFin) {
        throw new Error(
          `No hay suficientes fechas para calendarizar. Se excede la fecha_fin del campeonato (${formatearFecha(
            fechaFin,
          )}).`,
        );
      }

      const fechaJornada = formatearFecha(fechaActual);

      let cursor = inicioMin;
      for (let i = 0; i < jornadaFixture.length; i++) {
        // Si no cabe el siguiente partido, pasar al siguiente día (1 día)
        if (cursor + dur > finMin) {
          fechaActual.setDate(fechaActual.getDate() + 1);

          if (fechaFin && fechaActual > fechaFin) {
            throw new Error(
              `No hay suficientes fechas para calendarizar. Se excede la fecha_fin del campeonato (${formatearFecha(
                fechaFin,
              )}).`,
            );
          }

          cursor = inicioMin;
        }

        const [a, b] = jornadaFixture[i];
        const local = invertirLocalia ? b : a;
        const visitante = invertirLocalia ? a : b;

        const horaSQL = fromMinutesSQL(cursor);

        const partidoCreado = await this.crear(
          grupo.campeonato_id,
          grupo_id,
          local,
          visitante,
          formatearFecha(fechaActual),
          horaSQL,
          canchaSQLBase,
          jornada,
        );

        partidosGenerados.push(partidoCreado);

        cursor += slotMin; // siguiente partido = duración + descanso
      }

      // Al terminar la jornada, avanzar según intervalo_dias
      fechaActual.setDate(
        fechaActual.getDate() + parseInt(intervalo_dias || 7),
      );
      jornada++;
    };

    // ---------- IDA ----------
    for (const jornadaFixture of fixtureIda) {
      await agendarJornada(jornadaFixture, false);
    }

    // ---------- VUELTA ----------
    if (ida_y_vuelta) {
      for (const jornadaFixture of fixtureIda) {
        await agendarJornada(jornadaFixture, true);
      }
    }

    return partidosGenerados;
  }

  static async generarFixtureCampeonatoFinDeSemana({
    campeonato_id,
    fecha_inicio,
    fecha_fin,
    ida_y_vuelta = false,
    duracion_min = 60,
    descanso_min = 10,
    cancha_base = "Cancha Principal",
    reemplazar = false,
  }) {
    // 1) Traer grupos del campeonato
    const gruposRes = await pool.query(
      `SELECT id, letra_grupo, nombre_grupo FROM grupos WHERE campeonato_id=$1 ORDER BY letra_grupo`,
      [campeonato_id],
    );
    const grupos = gruposRes.rows;
    if (!grupos.length) throw new Error("No hay grupos para este campeonato.");

    // 2) Reemplazar si piden
    if (reemplazar) {
      await pool.query(`DELETE FROM partidos WHERE campeonato_id=$1`, [
        campeonato_id,
      ]);
    }

    // 3) Para cada grupo: obtener equipos y generar round robin (lista de jornadas)
    const jornadasPorGrupo = [];
    for (const g of grupos) {
      const eqRes = await pool.query(
        `SELECT equipo_id FROM grupo_equipos WHERE grupo_id=$1 ORDER BY equipo_id`,
        [g.id],
      );
      const equipos = eqRes.rows.map((r) => r.equipo_id);
      if (equipos.length < 2)
        throw new Error(`Grupo ${g.letra_grupo} necesita al menos 2 equipos.`);

      const ida = this.generarRoundRobin(equipos); // array de jornadas => [[a,b],[c,d]] ...
      const total = ida_y_vuelta ? [...ida, ...ida] : ida;

      jornadasPorGrupo.push({
        grupo: g,
        jornadas: total.map((j, idx) => ({
          numero: idx + 1,
          partidos: j.map(([a, b], i) => {
            // si es vuelta, invertir localía
            const isVuelta = ida_y_vuelta && idx >= ida.length;
            return isVuelta ? [b, a] : [a, b];
          }),
        })),
      });
    }

    // 4) Cantidad de jornadas del campeonato = máximo de jornadas entre grupos
    const maxJornadas = Math.max(
      ...jornadasPorGrupo.map((x) => x.jornadas.length),
    );

    // 5) Scheduler: agenda todos los partidos de la Jornada N (todos los grupos) en sábado/domingo
    const dur = Math.max(1, parseInt(duracion_min));
    const desc = Math.max(0, parseInt(descanso_min));
    const slotMin = dur + desc;

    let cursorDate = new Date(fecha_inicio);
    const fechaFin = fecha_fin ? new Date(fecha_fin) : null;

    const isAfterFin = (d) => (fechaFin ? d > fechaFin : false);

    const getWindow = (d) => {
      const w = DEFAULT_WINDOWS_WEEKEND[d.getDay()];
      if (!w) return null;
      return { startMin: toMinutes(w.start), endMin: toMinutes(w.end) };
    };

    const nextWeekendSlot = (dateObj, cursorMin) => {
      let d = new Date(dateObj);
      let curMin = cursorMin || 0;

      while (true) {
        if (isAfterFin(d)) {
          throw new Error(
            `No hay fechas suficientes antes de fecha_fin (${formatYMD(
              fechaFin,
            )}).`,
          );
        }

        const win = getWindow(d);
        if (!win) {
          d.setDate(d.getDate() + 1);
          curMin = 0;
          continue;
        }

        let cur = Math.max(curMin, win.startMin);
        if (cur + dur > win.endMin) {
          d.setDate(d.getDate() + 1);
          curMin = 0;
          continue;
        }

        return { dateObj: d, min: cur, horaSQL: fromMinutesSQL(cur) };
      }
    };

    const creados = [];

    for (let j = 1; j <= maxJornadas; j++) {
      // juntar partidos de TODOS los grupos para esta jornada
      const partidosJornada = [];
      for (const item of jornadasPorGrupo) {
        const jData = item.jornadas.find((x) => x.numero === j);
        if (!jData) continue;
        for (const [local, visitante] of jData.partidos) {
          partidosJornada.push({
            grupo_id: item.grupo.id,
            local,
            visitante,
            jornada: j,
            cancha: cancha_base,
          });
        }
      }

      // ordenar por letra de grupo (para que salga bonito)
      // (opcional: si quieres un orden específico)
      // partidosJornada ya viene por gruposRes ordenado.

      // agenda slots uno por uno (se derrama a domingo si sábado no alcanza)
      let cursorMin = 0;

      for (const p of partidosJornada) {
        const slot = nextWeekendSlot(cursorDate, cursorMin);
        cursorDate = new Date(slot.dateObj);

        const partidoCreado = await this.crear(
          campeonato_id,
          p.grupo_id,
          p.local,
          p.visitante,
          formatYMD(cursorDate),
          slot.horaSQL,
          p.cancha,
          p.jornada,
        );

        creados.push(partidoCreado);
        cursorMin = slot.min + slotMin;
      }

      // al terminar la jornada: avanzar al siguiente día y dejar que el scheduler caiga al próximo sábado/domingo
      cursorDate.setDate(cursorDate.getDate() + 1);
    }

    return creados;
  }

  static async generarFixtureTodosContraTodos(params) {
    let cfg = {};
    if (
      typeof params !== "object" ||
      params === null ||
      Array.isArray(params)
    ) {
      const [
        campeonato_id,
        fecha_inicio,
        intervalo_dias = 7,
        ida_y_vuelta = false,
        hora_base = "15:00",
        cancha_base = "Cancha General",
        grupo_id = null,
      ] = arguments;

      cfg = {
        campeonato_id,
        grupo_id,
        fecha_inicio,
        fecha_fin: null,
        intervalo_dias,
        ida_y_vuelta,
        hora_inicio: hora_base,
        hora_fin: "18:00",
        cancha_base,
        duracion_min: 90,
        descanso_min: 10,
        solo_fines_semana: true,
      };
    } else {
      cfg = {
        campeonato_id: params.campeonato_id,
        grupo_id: params.grupo_id ?? null,
        fecha_inicio: params.fecha_inicio,
        fecha_fin: params.fecha_fin || null,
        intervalo_dias: params.intervalo_dias ?? 7,
        ida_y_vuelta: params.ida_y_vuelta === true,
        hora_inicio: params.hora_inicio || "13:00",
        hora_fin: params.hora_fin || "18:00",
        cancha_base: params.cancha_base || "Cancha General",
        duracion_min: Number.isFinite(params.duracion_min)
          ? params.duracion_min
          : 90,
        descanso_min: Number.isFinite(params.descanso_min)
          ? params.descanso_min
          : 10,
        solo_fines_semana: params.solo_fines_semana !== false,
      };
    }

    const {
      campeonato_id,
      grupo_id,
      fecha_inicio,
      fecha_fin,
      intervalo_dias,
      ida_y_vuelta,
      cancha_base,
      duracion_min,
      descanso_min,
      solo_fines_semana,
    } = cfg;

    // Equipos del campeonato
    const equiposQuery = `
    SELECT id
    FROM equipos
    WHERE campeonato_id = $1
    ORDER BY id
  `;
    const equiposResult = await pool.query(equiposQuery, [campeonato_id]);
    const equipos = equiposResult.rows.map((row) => row.id);

    if (equipos.length < 2) {
      throw new Error(
        "El campeonato debe tener al menos 2 equipos para generar fixture",
      );
    }

    const fixtureIda = this.generarRoundRobin(equipos);

    // Helpers
    const formatearFecha = (fecha) => fecha.toISOString().split("T")[0];

    const toMinutes = (hhmm) => {
      const [h, m] = String(hhmm).split(":").map(Number);
      return h * 60 + (m || 0);
    };

    const fromMinutesSQL = (min) => {
      const h = String(Math.floor(min / 60)).padStart(2, "0");
      const m = String(min % 60).padStart(2, "0");
      return `${h}:${m}:00`;
    };

    const dur = Math.max(1, parseInt(duracion_min || 90));
    const desc = Math.max(0, parseInt(descanso_min || 10));
    const slotMin = dur + desc;

    let fechaActual = new Date(fecha_inicio);
    const fechaFinObj = fecha_fin ? new Date(fecha_fin) : null;

    const partidosGenerados = [];
    let jornada = 1;

    // Ventanas por día (0=domingo, 6=sábado)
    const DEFAULT_WINDOWS = {
      6: { start: "13:00", end: "18:00" }, // sábado
      0: { start: "08:00", end: "17:00" }, // domingo
    };

    const isAfterFin = (d) => (fechaFinObj ? d > fechaFinObj : false);

    function getWindowForDate(dateObj) {
      const w = DEFAULT_WINDOWS[dateObj.getDay()];
      if (!w) return null;
      return { startMin: toMinutes(w.start), endMin: toMinutes(w.end) };
    }

    function nextSlot(cursorDate, cursorMin) {
      let d = new Date(cursorDate);

      while (true) {
        if (isAfterFin(d)) {
          throw new Error(
            `No hay suficientes fechas. Se excede la fecha_fin (${formatearFecha(
              fechaFinObj,
            )}).`,
          );
        }

        if (solo_fines_semana) {
          const win = getWindowForDate(d);
          if (!win) {
            d.setDate(d.getDate() + 1);
            cursorMin = 0;
            continue;
          }

          let cur = Math.max(cursorMin || 0, win.startMin);

          if (cur + dur > win.endMin) {
            d.setDate(d.getDate() + 1);
            cursorMin = 0;
            continue;
          }

          return { dateObj: d, min: cur, horaSQL: fromMinutesSQL(cur) };
        }

        // Si no es solo fines de semana, usa hora_inicio/hora_fin del cfg
        const startMin = toMinutes(cfg.hora_inicio || "13:00");
        const endMin = toMinutes(cfg.hora_fin || "18:00");

        let cur = Math.max(cursorMin || 0, startMin);

        if (cur + dur > endMin) {
          d.setDate(d.getDate() + 1);
          cursorMin = 0;
          continue;
        }

        return { dateObj: d, min: cur, horaSQL: fromMinutesSQL(cur) };
      }
    }

    const agendarJornada = async (jornadaFixture, invertirLocalia = false) => {
      let cursorMin = 0;
      let cursorDate = new Date(fechaActual);

      for (let i = 0; i < jornadaFixture.length; i++) {
        const slot = nextSlot(cursorDate, cursorMin);

        cursorDate = new Date(slot.dateObj);
        const fechaSQL = formatearFecha(cursorDate);

        const [a, b] = jornadaFixture[i];
        const local = invertirLocalia ? b : a;
        const visitante = invertirLocalia ? a : b;

        const partidoCreado = await this.crearSinValidarGrupo(
          campeonato_id,
          grupo_id,
          local,
          visitante,
          fechaSQL,
          slot.horaSQL,
          cancha_base || "Cancha General",
          jornada,
        );

        partidosGenerados.push(partidoCreado);

        cursorMin = slot.min + slotMin;
      }

      // Al terminar una jornada
      if (solo_fines_semana) {
        cursorDate.setDate(cursorDate.getDate() + 1);
        fechaActual = cursorDate;
      } else {
        fechaActual.setDate(
          fechaActual.getDate() + parseInt(intervalo_dias || 7),
        );
      }

      jornada++;
    };

    for (const jf of fixtureIda) await agendarJornada(jf, false);
    if (ida_y_vuelta)
      for (const jf of fixtureIda) await agendarJornada(jf, true);

    return partidosGenerados;
  }

  // READ - Obtener partidos por grupo
  static async obtenerPorGrupo(grupo_id) {
    const query = `
      SELECT p.*, 
           el.nombre AS equipo_local_nombre,
           ev.nombre AS equipo_visitante_nombre,
           el.logo_url AS equipo_local_logo_url,
           ev.logo_url AS equipo_visitante_logo_url,
           g.nombre_grupo,
           c.nombre AS nombre_campeonato,
           c.organizador,
           c.logo_url AS logo_campeonato_url,
           c.color_primario,
           c.color_secundario,
           c.color_acento
    FROM partidos p
    JOIN equipos el ON p.equipo_local_id = el.id
    JOIN equipos ev ON p.equipo_visitante_id = ev.id
    JOIN grupos g   ON p.grupo_id = g.id
    JOIN campeonatos c ON p.campeonato_id = c.id
    WHERE p.grupo_id = $1
    ORDER BY p.jornada, p.fecha_partido, p.hora_partido
    `;
    const result = await pool.query(query, [grupo_id]);
    return result.rows;
  }

  // READ - Obtener partidos por campeonato
  static async obtenerPorCampeonato(campeonato_id) {
    const query = `
      SELECT p.*, 
           el.nombre AS equipo_local_nombre,
           ev.nombre AS equipo_visitante_nombre,
           el.logo_url AS equipo_local_logo_url,
           ev.logo_url AS equipo_visitante_logo_url,
           g.nombre_grupo,
           g.letra_grupo,
           c.nombre AS nombre_campeonato,
           c.organizador,
           c.logo_url AS logo_campeonato_url,
           c.color_primario,
           c.color_secundario,
           c.color_acento
    FROM partidos p
    JOIN equipos el ON p.equipo_local_id = el.id
    JOIN equipos ev ON p.equipo_visitante_id = ev.id
    JOIN grupos g   ON p.grupo_id = g.id
    JOIN campeonatos c ON p.campeonato_id = c.id
    WHERE p.campeonato_id = $1
    ORDER BY p.fecha_partido, p.hora_partido, p.jornada
    `;
    const result = await pool.query(query, [campeonato_id]);
    return result.rows;
  }

  // READ - Obtener partido por ID
  static async obtenerPorId(id) {
    const query = `
      SELECT p.*, 
             el.nombre as equipo_local_nombre,
             ev.nombre as equipo_visitante_nombre,
             g.nombre_grupo,
             c.nombre as nombre_campeonato
      FROM partidos p
      JOIN equipos el ON p.equipo_local_id = el.id
      JOIN equipos ev ON p.equipo_visitante_id = ev.id
      JOIN grupos g ON p.grupo_id = g.id
      JOIN campeonatos c ON p.campeonato_id = c.id
      WHERE p.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // READ - Obtener partidos por campeonato y jornada (TODOS los grupos)
  static async obtenerPorCampeonatoYJornada(campeonato_id, jornada) {
    const query = `
    SELECT p.*,
           el.nombre AS equipo_local_nombre,
           ev.nombre AS equipo_visitante_nombre,
           el.logo_url AS equipo_local_logo_url,
           ev.logo_url AS equipo_visitante_logo_url,
           g.nombre_grupo,
           g.letra_grupo,
           c.nombre AS nombre_campeonato,
           c.organizador,
           c.logo_url AS logo_campeonato_url,
           c.color_primario,
           c.color_secundario,
           c.color_acento
    FROM partidos p
    JOIN equipos el ON p.equipo_local_id = el.id
    JOIN equipos ev ON p.equipo_visitante_id = ev.id
    LEFT JOIN grupos g ON p.grupo_id = g.id
    JOIN campeonatos c ON p.campeonato_id = c.id
    WHERE p.campeonato_id = $1 AND p.jornada = $2
    ORDER BY p.fecha_partido, g.letra_grupo, p.hora_partido, p.fecha_partido, g.nombre_grupo, p.id `;
    const result = await pool.query(query, [campeonato_id, jornada]);
    return result.rows;
  }

  // UPDATE - Actualizar resultado de partido
  static async actualizarResultado(
    id,
    resultado_local,
    resultado_visitante,
    estado = "finalizado",
  ) {
    const query = `
      UPDATE partidos 
      SET resultado_local = $1, resultado_visitante = $2, estado = $3, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $4 
      RETURNING *
    `;
    const values = [resultado_local, resultado_visitante, estado, id];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // UPDATE - Actualizar información del partido
  static async actualizar(id, datos) {
    const campos = [];
    const valores = [];
    let contador = 1;

    for (const [key, value] of Object.entries(datos)) {
      if (value !== undefined) {
        campos.push(`${key} = $${contador}`);
        valores.push(value);
        contador++;
      }
    }

    if (campos.length === 0) {
      throw new Error("No hay campos para actualizar");
    }

    valores.push(id);
    const query = `
      UPDATE partidos 
      SET ${campos.join(", ")}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $${contador} 
      RETURNING *
    `;

    const result = await pool.query(query, valores);
    return result.rows[0];
  }

  // DELETE - Eliminar partido
  static async eliminar(id) {
    const query = "DELETE FROM partidos WHERE id = $1 RETURNING *";
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // MÉTODO AUXILIAR: Generar fixture round-robin (solo IDA)
  static generarRoundRobin(equipos) {
    const n = equipos.length;
    const fixture = [];

    const equiposConBye = n % 2 === 0 ? [...equipos] : [...equipos, null];
    const numEquipos = equiposConBye.length;

    for (let jornada = 0; jornada < numEquipos - 1; jornada++) {
      const partidosJornada = [];

      for (let i = 0; i < numEquipos / 2; i++) {
        const local = equiposConBye[i];
        const visitante = equiposConBye[numEquipos - 1 - i];

        if (local && visitante) {
          if (jornada % 2 === 0) {
            partidosJornada.push([local, visitante]);
          } else {
            partidosJornada.push([visitante, local]);
          }
        }
      }

      fixture.push(partidosJornada);

      const ultimo = equiposConBye.pop();
      equiposConBye.splice(1, 0, ultimo);
    }

    return fixture;
  }

  // CALCULAR puntos según sistema de puntuación
  static calcularPuntos(
    sistema_puntuacion,
    resultado_local,
    resultado_visitante,
    shootouts_local,
    shootouts_visitante,
    shootouts,
  ) {
    let puntosLocal = 0;
    let puntosVisitante = 0;

    switch (sistema_puntuacion) {
      case "tradicional":
        if (resultado_local > resultado_visitante) {
          puntosLocal = 3;
          puntosVisitante = 0;
        } else if (resultado_local < resultado_visitante) {
          puntosLocal = 0;
          puntosVisitante = 3;
        } else {
          puntosLocal = 1;
          puntosVisitante = 1;
        }
        break;

      case "shootouts":
        if (resultado_local > resultado_visitante) {
          puntosLocal = 3;
          puntosVisitante = 0;
        } else if (resultado_local < resultado_visitante) {
          puntosLocal = 0;
          puntosVisitante = 3;
        } else {
          if (shootouts) {
            if (shootouts_local > shootouts_visitante) {
              puntosLocal = 2;
              puntosVisitante = 1;
            } else {
              puntosLocal = 1;
              puntosVisitante = 2;
            }
          } else {
            puntosLocal = 1;
            puntosVisitante = 1;
          }
        }
        break;

      default:
        if (resultado_local > resultado_visitante) {
          puntosLocal = 3;
          puntosVisitante = 0;
        } else if (resultado_local < resultado_visitante) {
          puntosLocal = 0;
          puntosVisitante = 3;
        } else {
          puntosLocal = 1;
          puntosVisitante = 1;
        }
    }

    return { puntosLocal, puntosVisitante };
  }

  // ACTUALIZAR resultado con shootouts
  static async actualizarResultadoConShootouts(
    id,
    resultado_local,
    resultado_visitante,
    shootouts_local,
    shootouts_visitante,
    estado = "finalizado",
  ) {
    const query = `
      UPDATE partidos 
      SET resultado_local = $1, resultado_visitante = $2, 
          resultado_local_shootouts = $3, resultado_visitante_shootouts = $4,
          tiene_shootouts = $5, estado = $6, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $7 
      RETURNING *
    `;
    const values = [
      resultado_local,
      resultado_visitante,
      shootouts_local,
      shootouts_visitante,
      true,
      estado,
      id,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // OBTENER estadísticas de equipo considerando sistema de puntuación
  static async obtenerEstadisticasEquipoAvanzado(equipo_id, campeonato_id) {
    const query = `
      SELECT 
          c.sistema_puntuacion,
          COUNT(*) as partidos_jugados,
          COUNT(CASE WHEN p.estado = 'finalizado' THEN 1 END) as partidos_completados,
          
          SUM(CASE WHEN p.equipo_local_id = $1 THEN p.resultado_local ELSE p.resultado_visitante END) as goles_favor,
          SUM(CASE WHEN p.equipo_local_id = $1 THEN p.resultado_visitante ELSE p.resultado_local END) as goles_contra,
          
          SUM(CASE WHEN p.equipo_local_id = $1 THEN COALESCE(p.resultado_local_shootouts, 0) ELSE COALESCE(p.resultado_visitante_shootouts, 0) END) as shootouts_favor,
          SUM(CASE WHEN p.equipo_local_id = $1 THEN COALESCE(p.resultado_visitante_shootouts, 0) ELSE COALESCE(p.resultado_local_shootouts, 0) END) as shootouts_contra,
          
          COUNT(CASE WHEN (p.equipo_local_id = $1 AND p.resultado_local > p.resultado_visitante) OR 
                            (p.equipo_visitante_id = $1 AND p.resultado_visitante > p.resultado_local) THEN 1 END) as victorias_tiempo,
          COUNT(CASE WHEN (p.equipo_local_id = $1 AND p.resultado_local = p.resultado_visitante) OR 
                            (p.equipo_visitante_id = $1 AND p.resultado_visitante = p.resultado_local) THEN 1 END) as empates,
          COUNT(CASE WHEN (p.equipo_local_id = $1 AND p.resultado_local < p.resultado_visitante) OR 
                            (p.equipo_visitante_id = $1 AND p.resultado_visitante < p.resultado_local) THEN 1 END) as derrotas_tiempo,
          
          COUNT(CASE WHEN shootouts = true AND 
                          ((p.equipo_local_id = $1 AND p.resultado_local_shootouts > p.resultado_visitante_shootouts) OR 
                           (p.equipo_visitante_id = $1 AND p.resultado_visitante_shootouts > p.resultado_local_shootouts)) THEN 1 END) as victorias_shootouts,
          COUNT(CASE WHEN shootouts = true AND 
                          ((p.equipo_local_id = $1 AND p.resultado_local_shootouts < p.resultado_visitante_shootouts) OR 
                           (p.equipo_visitante_id = $1 AND p.resultado_visitante_shootouts < p.resultado_local_shootouts)) THEN 1 END) as derrotas_shootouts
          
      FROM partidos p
      JOIN campeonatos c ON p.campeonato_id = c.id
      WHERE p.campeonato_id = $2 AND (p.equipo_local_id = $1 OR p.equipo_visitante_id = $1)
    `;
    const result = await pool.query(query, [equipo_id, campeonato_id]);
    return result.rows[0];
  }

  // OBTENER estadísticas de partidos por equipo (modo simple)
  static async obtenerEstadisticasEquipo(equipo_id, campeonato_id) {
    const query = `
      SELECT 
          COUNT(*) as partidos_jugados,
          COUNT(CASE WHEN resultado_local IS NOT NULL OR resultado_visitante IS NOT NULL THEN 1 END) as partidos_completados,
          SUM(CASE WHEN equipo_local_id = $1 THEN resultado_local ELSE resultado_visitante END) as goles_favor,
          SUM(CASE WHEN equipo_local_id = $1 THEN resultado_visitante ELSE resultado_local END) as goles_contra,
          COUNT(CASE WHEN (equipo_local_id = $1 AND resultado_local > resultado_visitante) OR 
                        (equipo_visitante_id = $1 AND resultado_visitante > resultado_local) THEN 1 END) as partidos_ganados,
          COUNT(CASE WHEN (equipo_local_id = $1 AND resultado_local = resultado_visitante) OR 
                        (equipo_visitante_id = $1 AND resultado_visitante = resultado_local) THEN 1 END) as partidos_empatados,
          COUNT(CASE WHEN (equipo_local_id = $1 AND resultado_local < resultado_visitante) OR 
                        (equipo_visitante_id = $1 AND resultado_visitante < resultado_local) THEN 1 END) as partidos_perdidos
      FROM partidos 
      WHERE campeonato_id = $2 AND (equipo_local_id = $1 OR equipo_visitante_id = $1)
    `;
    const result = await pool.query(query, [equipo_id, campeonato_id]);
    return result.rows[0];
  }
}

module.exports = Partido;
