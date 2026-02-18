// backend/models/Partido.js
const pool = require("../config/database");

// ===============================
// Helpers (NO se redeclaran)
// ===============================
const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const fromMinutesSQL = (min) => {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}:00`;
};

const formatYMD = (d) => d.toISOString().split("T")[0];

// ===============================
// Round Robin
// ===============================
function generarRoundRobin(equipos) {
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
        if (jornada % 2 === 0) partidosJornada.push([local, visitante]);
        else partidosJornada.push([visitante, local]);
      }
    }

    fixture.push(partidosJornada);

    const ultimo = equiposConBye.pop();
    equiposConBye.splice(1, 0, ultimo);
  }

  return fixture;
}

// ===============================
// Scheduler por modalidad + canchas
// ===============================
function buildWindowsFromEvento(evento) {
  // Defaults pedidos:
  // weekday: 19:00-22:00
  // sab: 13:00-18:00
  // dom: 08:00-17:00
  const weekdayStart = evento.horario_weekday_ini || "19:00:00";
  const weekdayEnd = evento.horario_weekday_fin || "22:00:00";
  const sabStart = evento.horario_sab_ini || "13:00:00";
  const sabEnd = evento.horario_sab_fin || "18:00:00";
  const domStart = evento.horario_dom_ini || "08:00:00";
  const domEnd = evento.horario_dom_fin || "17:00:00";

  const win = {
    weekday: { startMin: toMinutes(weekdayStart), endMin: toMinutes(weekdayEnd) },
    sab: { startMin: toMinutes(sabStart), endMin: toMinutes(sabEnd) },
    dom: { startMin: toMinutes(domStart), endMin: toMinutes(domEnd) },
  };

  return win;
}

function isWeekend(day) {
  return day === 0 || day === 6; // dom=0, sab=6
}

function isWeekday(day) {
  return day >= 1 && day <= 5;
}

function dayWindowByDate(evento, dateObj, windows) {
  const day = dateObj.getDay();
  const modalidad = (evento.modalidad || "weekend").toLowerCase();

  if (modalidad === "weekend") {
    if (day === 6) return windows.sab;
    if (day === 0) return windows.dom;
    return null;
  }

  if (modalidad === "weekday") {
    if (isWeekday(day)) return windows.weekday;
    return null;
  }

  // mixed
  if (day === 6) return windows.sab;
  if (day === 0) return windows.dom;
  if (isWeekday(day)) return windows.weekday;
  return null;
}

/**
 * Devuelve el siguiente "bloque horario" válido:
 * - En cada bloque (misma hora) caben N partidos en paralelo = N canchas.
 * - slot: { dateObj, timeMin }
 */
function nextBlockSlot(evento, windows, cursorDate, cursorTimeMin, slotMin) {
  let d = new Date(cursorDate);
  let t = cursorTimeMin ?? 0;

  const fin = evento.fecha_fin ? new Date(evento.fecha_fin) : null;

  while (true) {
    if (fin && d > fin) {
      throw new Error(`No hay fechas suficientes. Se excede la fecha_fin (${formatYMD(fin)}).`);
    }

    const w = dayWindowByDate(evento, d, windows);
    if (!w) {
      d.setDate(d.getDate() + 1);
      t = 0;
      continue;
    }

    // arrancar dentro del rango
    const cur = Math.max(t, w.startMin);

    // si ya no cabe ni un partido (por duración), pasar al siguiente día
    // (NOTA: aquí solo evaluamos la existencia del bloque, no la cantidad de canchas)
    if (cur + slotMin > w.endMin + 1) {
      d.setDate(d.getDate() + 1);
      t = 0;
      continue;
    }

    return { dateObj: d, timeMin: cur };
  }
}

class Partido {
  static _columnaTimestampActualizacion = undefined;
  static _esquemaPlanillaAsegurado = false;

  static async obtenerEventoPorId(evento_id) {
    const q = `SELECT * FROM eventos WHERE id = $1`;
    const r = await pool.query(q, [evento_id]);
    return r.rows[0] || null;
  }

  static async contarGruposPorEvento(evento_id) {
    const q = `SELECT COUNT(*)::int AS total FROM grupos WHERE evento_id = $1`;
    const r = await pool.query(q, [evento_id]);
    return r.rows[0]?.total || 0;
  }

  // Compatibilidad de esquema:
  // algunas BD tienen "updated_at" y otras "update_at".
  static async obtenerColumnaTimestampActualizacion() {
    if (this._columnaTimestampActualizacion !== undefined) {
      return this._columnaTimestampActualizacion;
    }

    const q = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'partidos'
        AND column_name IN ('updated_at', 'update_at')
    `;
    const r = await pool.query(q);
    const cols = new Set(r.rows.map((x) => x.column_name));

    if (cols.has("updated_at")) this._columnaTimestampActualizacion = "updated_at";
    else if (cols.has("update_at")) this._columnaTimestampActualizacion = "update_at";
    else this._columnaTimestampActualizacion = null;

    return this._columnaTimestampActualizacion;
  }

  // Compatibilidad con controladores/rutas anteriores
  static async generarFixtureEvento({
    evento_id,
    ida_y_vuelta = false,
    duracion_min = 90,
    descanso_min = 10,
    reemplazar = true,
    programacion_manual = false,
    fecha_inicio = null,
    fecha_fin = null,
    modo = "auto",
  }) {
    const evento = await this.obtenerEventoPorId(evento_id);
    if (!evento) throw new Error("Evento no encontrado");

    const eventoNormalizado = {
      ...evento,
      fecha_inicio: fecha_inicio || evento.fecha_inicio,
      fecha_fin: fecha_fin || evento.fecha_fin,
      horario_weekday_ini: evento.horario_weekday_ini || evento.horario_weekday_inicio,
      horario_weekday_fin: evento.horario_weekday_fin || evento.horario_weekday_fin,
      horario_sab_ini: evento.horario_sab_ini || evento.horario_sab_inicio,
      horario_sab_fin: evento.horario_sab_fin || evento.horario_sab_fin,
      horario_dom_ini: evento.horario_dom_ini || evento.horario_dom_inicio,
      horario_dom_fin: evento.horario_dom_fin || evento.horario_dom_fin,
    };

    const totalGrupos = await this.contarGruposPorEvento(evento_id);
    const modoEfectivo = String(modo || "auto").toLowerCase();

    if (modoEfectivo === "todos") {
      return this.generarFixtureEventoTodosContraTodos({
        evento: eventoNormalizado,
        ida_y_vuelta,
        reemplazar,
        duracion_min,
        descanso_min,
        manual: programacion_manual,
      });
    }

    if (modoEfectivo === "grupos") {
      return this.generarFixtureEventoUnificado({
        evento: eventoNormalizado,
        ida_y_vuelta,
        reemplazar,
        duracion_min,
        descanso_min,
        manual: programacion_manual,
      });
    }

    if (totalGrupos > 0) {
      return this.generarFixtureEventoUnificado({
        evento: eventoNormalizado,
        ida_y_vuelta,
        reemplazar,
        duracion_min,
        descanso_min,
        manual: programacion_manual,
      });
    }

    return this.generarFixtureEventoTodosContraTodos({
      evento: eventoNormalizado,
      ida_y_vuelta,
      reemplazar,
      duracion_min,
      descanso_min,
      manual: programacion_manual,
    });
  }

  // CREATE - ahora soporta NULL en fecha/hora/cancha
  static async crear(
    campeonato_id,
    grupo_id,
    equipo_local_id,
    equipo_visitante_id,
    fecha_partido,
    hora_partido,
    cancha,
    jornada,
    evento_id
  ) {
    if (equipo_local_id === equipo_visitante_id) {
      throw new Error("Un equipo no puede jugar contra sí mismo");
    }

    // Si hay grupo_id, validamos que estén en el grupo
    if (grupo_id) {
      const validacionQuery = `
        SELECT COUNT(*) as count 
        FROM grupo_equipos 
        WHERE grupo_id = $1 AND equipo_id IN ($2, $3)
      `;
      const validacionResult = await pool.query(validacionQuery, [grupo_id, equipo_local_id, equipo_visitante_id]);
      if (parseInt(validacionResult.rows[0].count) !== 2) {
        throw new Error("Los equipos deben pertenecer al mismo grupo");
      }
    }

    const query = `
      INSERT INTO partidos 
      (campeonato_id, evento_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, jornada) 
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `;
    const values = [
      campeonato_id ?? null,
      evento_id ?? null,
      grupo_id ?? null,
      equipo_local_id,
      equipo_visitante_id,
      fecha_partido ?? null,
      hora_partido ?? null,
      cancha ?? null,
      jornada ?? null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // ===============================
  // FIXTURE: EVENTO unificado por jornada (todos los grupos)
  // ===============================
  static async generarFixtureEventoUnificado({ evento, ida_y_vuelta, reemplazar, duracion_min, descanso_min, manual }) {
    const evento_id = evento.id;
    const campeonato_id = evento.campeonato_id;

    // Reemplazar si piden
    if (reemplazar) {
      await pool.query(`DELETE FROM partidos WHERE evento_id = $1`, [evento_id]);
    }

    // Traer grupos del evento:
    // Si sigues con grupo.evento_id, funciona.
    // Si vas full pivote, cambia aquí por join con evento_grupos (si lo creas luego).
    const gruposRes = await pool.query(
      `SELECT id, letra_grupo, nombre_grupo
       FROM grupos
       WHERE evento_id = $1
       ORDER BY letra_grupo`,
      [evento_id]
    );
    const grupos = gruposRes.rows;
    if (!grupos.length) throw new Error("Este evento no tiene grupos.");

    // Canchas del evento (por pivote evento_canchas)
    const canchasRes = await pool.query(
      `SELECT c.id, c.nombre
       FROM evento_canchas ec
       JOIN canchas c ON c.id = ec.cancha_id
       WHERE ec.evento_id = $1
       ORDER BY c.id`,
      [evento_id]
    );
    let canchas = canchasRes.rows.map((r) => r.nombre);

    // Si no hay canchas asignadas, por defecto 1 cancha
    if (!canchas.length) canchas = ["Cancha 1"];

    const dur = Math.max(1, parseInt(duracion_min || 90));
    const desc = Math.max(0, parseInt(descanso_min || 10));
    const slotMin = dur + desc;

    // Para cada grupo: obtener equipos (puede ser evento_equipos o equipos.evento_id)
    const jornadasPorGrupo = [];

    for (const g of grupos) {
      // Equipos del grupo (grupo_equipos)
      const eqRes = await pool.query(
        `SELECT equipo_id FROM grupo_equipos WHERE grupo_id=$1 ORDER BY equipo_id`,
        [g.id]
      );
      const equipos = eqRes.rows.map((r) => r.equipo_id);
      if (equipos.length < 2) throw new Error(`Grupo ${g.letra_grupo} necesita al menos 2 equipos.`);

      const ida = generarRoundRobin(equipos);
      const total = ida_y_vuelta
        ? [
            ...ida.map((j) => j.map(([a, b]) => [a, b])),
            ...ida.map((j) => j.map(([a, b]) => [b, a])),
          ]
        : ida;

      jornadasPorGrupo.push({
        grupo: g,
        jornadas: total.map((partidos, idx) => ({
          numero: idx + 1,
          partidos,
        })),
      });
    }

    const maxJornadas = Math.max(...jornadasPorGrupo.map((x) => x.jornadas.length));

    // Si manual => crear sin fecha/hora/cancha
    if (manual) {
      const creados = [];
      for (let j = 1; j <= maxJornadas; j++) {
        for (const item of jornadasPorGrupo) {
          const jData = item.jornadas.find((x) => x.numero === j);
          if (!jData) continue;
          for (const [local, visitante] of jData.partidos) {
            const p = await this.crear(
              campeonato_id,
              item.grupo.id,
              local,
              visitante,
              null,
              null,
              null,
              j,
              evento_id
            );
            creados.push(p);
          }
        }
      }
      return creados;
    }

    // Scheduler real
    const windows = buildWindowsFromEvento(evento);

    // arrancar desde fecha_inicio del evento (o hoy si está null)
    let cursorDate = evento.fecha_inicio ? new Date(evento.fecha_inicio) : new Date();
    let cursorTimeMin = 0;

    const creados = [];

    for (let j = 1; j <= maxJornadas; j++) {
      // Jornada unificada (todos los grupos)
      const partidosJornada = [];
      for (const item of jornadasPorGrupo) {
        const jData = item.jornadas.find((x) => x.numero === j);
        if (!jData) continue;
        for (const [local, visitante] of jData.partidos) {
          partidosJornada.push({
            grupo_id: item.grupo.id,
            grupo_letra: item.grupo.letra_grupo || "",
            local,
            visitante,
            jornada: j,
          });
        }
      }

      // Ordenar por grupo para que en la tarjeta salga A,B,C,D
      partidosJornada.sort((a, b) => String(a.grupo_letra).localeCompare(String(b.grupo_letra)));

      // Asignación por bloques: en cada bloque caben N partidos en paralelo
      let idx = 0;
      while (idx < partidosJornada.length) {
        const slot = nextBlockSlot(evento, windows, cursorDate, cursorTimeMin, slotMin);

        // En este bloque, asignar hasta N canchas
        for (let c = 0; c < canchas.length && idx < partidosJornada.length; c++) {
          const p = partidosJornada[idx++];
          const creado = await this.crear(
            campeonato_id,
            p.grupo_id,
            p.local,
            p.visitante,
            formatYMD(slot.dateObj),
            fromMinutesSQL(slot.timeMin),
            canchas[c], // cancha por paralelo
            p.jornada,
            evento_id
          );
          creados.push(creado);
        }

        // Próximo bloque = +slotMin
        cursorDate = new Date(slot.dateObj);
        cursorTimeMin = slot.timeMin + slotMin;
      }

      // Al finalizar la jornada, pasar al siguiente día (el scheduler cae al siguiente día válido según modalidad)
      cursorDate.setDate(cursorDate.getDate() + 1);
      cursorTimeMin = 0;
    }

    return creados;
  }

  // ===============================
  // FIXTURE: EVENTO todos contra todos (sin grupos)
  // ===============================
  static async generarFixtureEventoTodosContraTodos({ evento, ida_y_vuelta, reemplazar, duracion_min, descanso_min, manual }) {
    const evento_id = evento.id;
    const campeonato_id = evento.campeonato_id;

    if (reemplazar) {
      await pool.query(`DELETE FROM partidos WHERE evento_id = $1`, [evento_id]);
    }

    // Equipos del evento:
    // 1) pivote evento_equipos
    const eqRes = await pool.query(
      `SELECT ee.equipo_id
       FROM evento_equipos ee
       WHERE ee.evento_id = $1
       ORDER BY ee.equipo_id`,
      [evento_id]
    );
    const equipos = eqRes.rows.map((r) => r.equipo_id);
    if (equipos.length < 2) throw new Error("El evento debe tener al menos 2 equipos.");

    const ida = generarRoundRobin(equipos);
    const jornadas = ida_y_vuelta
      ? [
          ...ida.map((j) => j.map(([a, b]) => [a, b])),
          ...ida.map((j) => j.map(([a, b]) => [b, a])),
        ]
      : ida;

    // canchas
    const canchasRes = await pool.query(
      `SELECT c.id, c.nombre
       FROM evento_canchas ec
       JOIN canchas c ON c.id = ec.cancha_id
       WHERE ec.evento_id = $1
       ORDER BY c.id`,
      [evento_id]
    );
    let canchas = canchasRes.rows.map((r) => r.nombre);
    if (!canchas.length) canchas = ["Cancha 1"];

    const dur = Math.max(1, parseInt(duracion_min || 90));
    const desc = Math.max(0, parseInt(descanso_min || 10));
    const slotMin = dur + desc;

    if (manual) {
      const creados = [];
      let jornada = 1;
      for (const jf of jornadas) {
        for (const [local, visitante] of jf) {
          const p = await this.crear(campeonato_id, null, local, visitante, null, null, null, jornada, evento_id);
          creados.push(p);
        }
        jornada++;
      }
      return creados;
    }

    const windows = buildWindowsFromEvento(evento);
    let cursorDate = evento.fecha_inicio ? new Date(evento.fecha_inicio) : new Date();
    let cursorTimeMin = 0;

    const creados = [];
    let jornada = 1;

    for (const jf of jornadas) {
      let idx = 0;
      while (idx < jf.length) {
        const slot = nextBlockSlot(evento, windows, cursorDate, cursorTimeMin, slotMin);

        for (let c = 0; c < canchas.length && idx < jf.length; c++) {
          const [local, visitante] = jf[idx++];
          const creado = await this.crear(
            campeonato_id,
            null,
            local,
            visitante,
            formatYMD(slot.dateObj),
            fromMinutesSQL(slot.timeMin),
            canchas[c],
            jornada,
            evento_id
          );
          creados.push(creado);
        }

        cursorDate = new Date(slot.dateObj);
        cursorTimeMin = slot.timeMin + slotMin;
      }

      cursorDate.setDate(cursorDate.getDate() + 1);
      cursorTimeMin = 0;
      jornada++;
    }

    return creados;
  }

  // ===============================
  // READS
  // ===============================
  static async obtenerPorGrupo(grupo_id) {
    const q = `
      SELECT p.*,
             el.nombre AS equipo_local_nombre,
             ev.nombre AS equipo_visitante_nombre,
             el.logo_url AS equipo_local_logo_url,
             ev.logo_url AS equipo_visitante_logo_url,
             g.nombre_grupo,
             g.letra_grupo
      FROM partidos p
      JOIN equipos el ON p.equipo_local_id = el.id
      JOIN equipos ev ON p.equipo_visitante_id = ev.id
      LEFT JOIN grupos g ON p.grupo_id = g.id
      WHERE p.grupo_id = $1
      ORDER BY p.jornada, p.fecha_partido NULLS LAST, p.hora_partido NULLS LAST
    `;
    const r = await pool.query(q, [grupo_id]);
    return r.rows;
  }

  static async obtenerPorEvento(evento_id) {
    const q = `
      SELECT p.*,
             el.nombre AS equipo_local_nombre,
             ev.nombre AS equipo_visitante_nombre,
             el.logo_url AS equipo_local_logo_url,
             ev.logo_url AS equipo_visitante_logo_url,
             g.nombre_grupo,
             g.letra_grupo
      FROM partidos p
      JOIN equipos el ON p.equipo_local_id = el.id
      JOIN equipos ev ON p.equipo_visitante_id = ev.id
      LEFT JOIN grupos g ON p.grupo_id = g.id
      WHERE p.evento_id = $1
      ORDER BY p.jornada, g.letra_grupo, p.fecha_partido NULLS LAST, p.hora_partido NULLS LAST, p.id
    `;
    const r = await pool.query(q, [evento_id]);
    return r.rows;
  }

  static async obtenerPorEventoYJornada(evento_id, jornada) {
    const q = `
      SELECT p.*,
             el.nombre AS equipo_local_nombre,
             ev.nombre AS equipo_visitante_nombre,
             el.logo_url AS equipo_local_logo_url,
             ev.logo_url AS equipo_visitante_logo_url,
             g.nombre_grupo,
             g.letra_grupo
      FROM partidos p
      JOIN equipos el ON p.equipo_local_id = el.id
      JOIN equipos ev ON p.equipo_visitante_id = ev.id
      LEFT JOIN grupos g ON p.grupo_id = g.id
      WHERE p.evento_id = $1 AND p.jornada = $2
      ORDER BY g.letra_grupo, p.fecha_partido NULLS LAST, p.hora_partido NULLS LAST, p.id
    `;
    const r = await pool.query(q, [evento_id, jornada]);
    return r.rows;
  }

  static async obtenerPorCampeonato(campeonato_id) {
    const q = `
      SELECT p.*,
             el.nombre AS equipo_local_nombre,
             ev.nombre AS equipo_visitante_nombre,
             el.logo_url AS equipo_local_logo_url,
             ev.logo_url AS equipo_visitante_logo_url,
             g.nombre_grupo,
             g.letra_grupo
      FROM partidos p
      JOIN equipos el ON p.equipo_local_id = el.id
      JOIN equipos ev ON p.equipo_visitante_id = ev.id
      LEFT JOIN grupos g ON p.grupo_id = g.id
      WHERE p.campeonato_id = $1
      ORDER BY p.jornada, g.letra_grupo, p.fecha_partido NULLS LAST, p.hora_partido NULLS LAST, p.id
    `;
    const r = await pool.query(q, [campeonato_id]);
    return r.rows;
  }

  static async obtenerPorCampeonatoYJornada(campeonato_id, jornada) {
    const q = `
      SELECT p.*,
             el.nombre AS equipo_local_nombre,
             ev.nombre AS equipo_visitante_nombre,
             el.logo_url AS equipo_local_logo_url,
             ev.logo_url AS equipo_visitante_logo_url,
             g.nombre_grupo,
             g.letra_grupo
      FROM partidos p
      JOIN equipos el ON p.equipo_local_id = el.id
      JOIN equipos ev ON p.equipo_visitante_id = ev.id
      LEFT JOIN grupos g ON p.grupo_id = g.id
      WHERE p.campeonato_id = $1 AND p.jornada = $2
      ORDER BY g.letra_grupo, p.fecha_partido NULLS LAST, p.hora_partido NULLS LAST, p.id
    `;
    const r = await pool.query(q, [campeonato_id, jornada]);
    return r.rows;
  }

  static async obtenerPorId(id) {
    const q = `
      SELECT p.*,
             el.nombre as equipo_local_nombre,
             ev.nombre as equipo_visitante_nombre
      FROM partidos p
      JOIN equipos el ON p.equipo_local_id = el.id
      JOIN equipos ev ON p.equipo_visitante_id = ev.id
      WHERE p.id = $1
    `;
    const r = await pool.query(q, [id]);
    return r.rows[0];
  }

  // ===============================
  // UPDATE / DELETE
  // ===============================
  static async actualizarResultado(id, resultado_local, resultado_visitante, estado = "finalizado") {
    const columnaTs = await this.obtenerColumnaTimestampActualizacion();
    const setTs = columnaTs ? `,\n          ${columnaTs} = CURRENT_TIMESTAMP` : "";

    const q = `
      UPDATE partidos 
      SET resultado_local = $1,
          resultado_visitante = $2,
          estado = $3
          ${setTs}
      WHERE id = $4
      RETURNING *
    `;
    const r = await pool.query(q, [resultado_local, resultado_visitante, estado, id]);
    return r.rows[0];
  }

  static async actualizarResultadoConShootouts(
    id,
    resultado_local,
    resultado_visitante,
    shootouts_local,
    shootouts_visitante,
    estado = "finalizado"
  ) {
    const columnaTs = await this.obtenerColumnaTimestampActualizacion();
    const setTs = columnaTs ? `,\n          ${columnaTs} = CURRENT_TIMESTAMP` : "";

    const q = `
      UPDATE partidos
      SET resultado_local = $1,
          resultado_visitante = $2,
          resultado_local_shootouts = $3,
          resultado_visitante_shootouts = $4,
          shootouts = true,
          estado = $5
          ${setTs}
      WHERE id = $6
      RETURNING *
    `;
    const r = await pool.query(q, [
      resultado_local,
      resultado_visitante,
      shootouts_local,
      shootouts_visitante,
      estado,
      id,
    ]);
    return r.rows[0];
  }

  static async actualizar(id, datos) {
    const campos = [];
    const valores = [];
    let i = 1;

    for (const [k, v] of Object.entries(datos)) {
      if (v !== undefined) {
        campos.push(`${k} = $${i}`);
        valores.push(v);
        i++;
      }
    }

    if (!campos.length) throw new Error("No hay campos para actualizar");

    valores.push(id);
    const columnaTs = await this.obtenerColumnaTimestampActualizacion();
    const setTs = columnaTs ? `,\n          ${columnaTs} = CURRENT_TIMESTAMP` : "";

    const q = `
      UPDATE partidos
      SET ${campos.join(", ")}
          ${setTs}
      WHERE id = $${i}
      RETURNING *
    `;
    const r = await pool.query(q, valores);
    return r.rows[0];
  }

  static async eliminar(id) {
    const r = await pool.query("DELETE FROM partidos WHERE id = $1 RETURNING *", [id]);
    return r.rows[0];
  }

  // Calcular puntos por partido (tradicional 3-1-0 o shootouts)
  static calcularPuntos(sistema_puntuacion, resultado_local, resultado_visitante, resultado_local_shootouts, resultado_visitante_shootouts, shootouts) {
    const rL = parseInt(resultado_local, 10) || 0;
    const rV = parseInt(resultado_visitante, 10) || 0;
    if (sistema_puntuacion === "shootouts" && shootouts) {
      const sL = parseInt(resultado_local_shootouts, 10) || 0;
      const sV = parseInt(resultado_visitante_shootouts, 10) || 0;
      return { puntosLocal: sL > sV ? 2 : sL < sV ? 1 : 0, puntosVisitante: sV > sL ? 2 : sV < sL ? 1 : 0 };
    }
    if (rL > rV) return { puntosLocal: 3, puntosVisitante: 0 };
    if (rL < rV) return { puntosLocal: 0, puntosVisitante: 3 };
    return { puntosLocal: 1, puntosVisitante: 1 };
  }

  // Estadísticas avanzadas por grupo (para tabla de posiciones)
  static async obtenerEstadisticasEquipoAvanzado(equipo_id, grupo_id) {
    const q = `
      SELECT 
        COUNT(*) as partidos_jugados,
        COALESCE(SUM(CASE WHEN equipo_local_id = $1 AND (COALESCE(resultado_local,0) > COALESCE(resultado_visitante,0) OR (COALESCE(shootouts,false) AND COALESCE(resultado_local_shootouts,0) > COALESCE(resultado_visitante_shootouts,0))) THEN 1
                 WHEN equipo_visitante_id = $1 AND (COALESCE(resultado_visitante,0) > COALESCE(resultado_local,0) OR (COALESCE(shootouts,false) AND COALESCE(resultado_visitante_shootouts,0) > COALESCE(resultado_local_shootouts,0))) THEN 1 ELSE 0 END), 0)::int as victorias_tiempo,
        COALESCE(SUM(CASE WHEN COALESCE(shootouts,false) AND ((equipo_local_id = $1 AND COALESCE(resultado_local_shootouts,0) > COALESCE(resultado_visitante_shootouts,0)) OR (equipo_visitante_id = $1 AND COALESCE(resultado_visitante_shootouts,0) > COALESCE(resultado_local_shootouts,0))) THEN 1 ELSE 0 END), 0)::int as victorias_shootouts,
        COALESCE(SUM(CASE WHEN COALESCE(resultado_local,0) = COALESCE(resultado_visitante,0) AND estado = 'finalizado' AND (NOT COALESCE(shootouts,false)) THEN 1 ELSE 0 END), 0)::int as empates,
        COALESCE(SUM(CASE WHEN equipo_local_id = $1 AND (COALESCE(resultado_local,0) < COALESCE(resultado_visitante,0) OR (COALESCE(shootouts,false) AND COALESCE(resultado_local_shootouts,0) < COALESCE(resultado_visitante_shootouts,0))) THEN 1
                 WHEN equipo_visitante_id = $1 AND (COALESCE(resultado_visitante,0) < COALESCE(resultado_local,0) OR (COALESCE(shootouts,false) AND COALESCE(resultado_visitante_shootouts,0) < COALESCE(resultado_local_shootouts,0))) THEN 1 ELSE 0 END), 0)::int as derrotas_tiempo,
        COALESCE(SUM(CASE WHEN COALESCE(shootouts,false) AND ((equipo_local_id = $1 AND COALESCE(resultado_local_shootouts,0) < COALESCE(resultado_visitante_shootouts,0)) OR (equipo_visitante_id = $1 AND COALESCE(resultado_visitante_shootouts,0) < COALESCE(resultado_local_shootouts,0))) THEN 1 ELSE 0 END), 0)::int as derrotas_shootouts,
        COALESCE(SUM(CASE WHEN equipo_local_id = $1 THEN COALESCE(resultado_local,0) ELSE COALESCE(resultado_visitante,0) END), 0)::int as goles_favor,
        COALESCE(SUM(CASE WHEN equipo_local_id = $1 THEN COALESCE(resultado_visitante,0) ELSE COALESCE(resultado_local,0) END), 0)::int as goles_contra
      FROM partidos
      WHERE grupo_id = $2 AND (equipo_local_id = $1 OR equipo_visitante_id = $1) AND estado = 'finalizado'
    `;
    try {
      const r = await pool.query(q, [equipo_id, grupo_id]);
      return r.rows[0] || {};
    } catch (e) {
      return {};
    }
  }

  // ===============================
  // STATS por evento (simple)
  // ===============================
  static async obtenerEstadisticasEquipoPorEvento(equipo_id, evento_id) {
    const q = `
      SELECT 
        COUNT(*) as partidos_jugados,
        COUNT(CASE WHEN resultado_local IS NOT NULL OR resultado_visitante IS NOT NULL THEN 1 END) as partidos_completados,
        SUM(CASE WHEN equipo_local_id = $1 THEN COALESCE(resultado_local,0) ELSE COALESCE(resultado_visitante,0) END) as goles_favor,
        SUM(CASE WHEN equipo_local_id = $1 THEN COALESCE(resultado_visitante,0) ELSE COALESCE(resultado_local,0) END) as goles_contra
      FROM partidos
      WHERE evento_id = $2 AND (equipo_local_id = $1 OR equipo_visitante_id = $1)
    `;
    const r = await pool.query(q, [equipo_id, evento_id]);
    return r.rows[0];
  }

  static async obtenerEstadisticasEquipo(equipo_id, campeonato_id) {
    const q = `
      SELECT
        COUNT(*) as partidos_jugados,
        COUNT(CASE WHEN estado = 'finalizado' THEN 1 END) as partidos_completados,
        COALESCE(SUM(CASE WHEN equipo_local_id = $1 THEN COALESCE(resultado_local,0) ELSE COALESCE(resultado_visitante,0) END),0)::int as goles_favor,
        COALESCE(SUM(CASE WHEN equipo_local_id = $1 THEN COALESCE(resultado_visitante,0) ELSE COALESCE(resultado_local,0) END),0)::int as goles_contra
      FROM partidos
      WHERE campeonato_id = $2
        AND (equipo_local_id = $1 OR equipo_visitante_id = $1)
    `;
    const r = await pool.query(q, [equipo_id, campeonato_id]);
    return r.rows[0];
  }

  static async asegurarEsquemaPlanilla() {
    if (this._esquemaPlanillaAsegurado) return;

    await pool.query(`
      ALTER TABLE campeonatos
      ADD COLUMN IF NOT EXISTS requiere_foto_cedula BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS requiere_foto_carnet BOOLEAN DEFAULT FALSE
    `);

    await pool.query(`
      ALTER TABLE jugadores
      ADD COLUMN IF NOT EXISTS foto_cedula_url TEXT,
      ADD COLUMN IF NOT EXISTS foto_carnet_url TEXT
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS partido_planillas (
        id SERIAL PRIMARY KEY,
        partido_id INTEGER UNIQUE REFERENCES partidos(id) ON DELETE CASCADE,
        pago_arbitraje NUMERIC(10,2) DEFAULT 0,
        pago_local NUMERIC(10,2) DEFAULT 0,
        pago_visitante NUMERIC(10,2) DEFAULT 0,
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS goleadores (
        id SERIAL PRIMARY KEY,
        partido_id INTEGER REFERENCES partidos(id) ON DELETE CASCADE,
        jugador_id INTEGER REFERENCES jugadores(id) ON DELETE SET NULL,
        goles INTEGER DEFAULT 1,
        tipo_gol VARCHAR(20) DEFAULT 'campo',
        minuto INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tarjetas (
        id SERIAL PRIMARY KEY,
        partido_id INTEGER REFERENCES partidos(id) ON DELETE CASCADE,
        jugador_id INTEGER REFERENCES jugadores(id) ON DELETE SET NULL,
        equipo_id INTEGER REFERENCES equipos(id) ON DELETE SET NULL,
        tipo_tarjeta VARCHAR(20) NOT NULL,
        minuto INTEGER,
        observacion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_goleadores_partido ON goleadores(partido_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tarjetas_partido ON tarjetas(partido_id)`);

    this._esquemaPlanillaAsegurado = true;
  }

  static async obtenerPlanilla(partido_id) {
    await this.asegurarEsquemaPlanilla();

    const partidoQ = `
      SELECT p.*,
             c.tipo_futbol,
             c.nombre AS campeonato_nombre,
             COALESCE(c.requiere_foto_cedula, false) AS requiere_foto_cedula,
             COALESCE(c.requiere_foto_carnet, false) AS requiere_foto_carnet,
             evt.nombre AS evento_nombre,
             el.nombre AS equipo_local_nombre,
             ev.nombre AS equipo_visitante_nombre,
             el.director_tecnico AS equipo_local_director_tecnico,
             ev.director_tecnico AS equipo_visitante_director_tecnico,
             el.logo_url AS equipo_local_logo_url,
             ev.logo_url AS equipo_visitante_logo_url
      FROM partidos p
      LEFT JOIN campeonatos c ON c.id = p.campeonato_id
      LEFT JOIN eventos evt ON evt.id = p.evento_id
      JOIN equipos el ON el.id = p.equipo_local_id
      JOIN equipos ev ON ev.id = p.equipo_visitante_id
      WHERE p.id = $1
      LIMIT 1
    `;
    const partidoR = await pool.query(partidoQ, [partido_id]);
    const partido = partidoR.rows[0] || null;
    if (!partido) return null;

    const planillaQ = `
      SELECT *
      FROM partido_planillas
      WHERE partido_id = $1
      LIMIT 1
    `;
    const planillaR = await pool.query(planillaQ, [partido_id]);
    const planilla = planillaR.rows[0] || null;

    const goleadoresQ = `
      SELECT g.*,
             TRIM(CONCAT(COALESCE(j.nombre, ''), ' ', COALESCE(j.apellido, ''))) AS jugador_nombre,
             j.equipo_id,
             e.nombre AS equipo_nombre
      FROM goleadores g
      LEFT JOIN jugadores j ON j.id = g.jugador_id
      LEFT JOIN equipos e ON e.id = j.equipo_id
      WHERE g.partido_id = $1
      ORDER BY g.id
    `;
    const goleadoresR = await pool.query(goleadoresQ, [partido_id]);

    const tarjetasQ = `
      SELECT t.*,
             TRIM(CONCAT(COALESCE(j.nombre, ''), ' ', COALESCE(j.apellido, ''))) AS jugador_nombre,
             e.nombre AS equipo_nombre
      FROM tarjetas t
      LEFT JOIN jugadores j ON j.id = t.jugador_id
      LEFT JOIN equipos e ON e.id = COALESCE(t.equipo_id, j.equipo_id)
      WHERE t.partido_id = $1
      ORDER BY t.id
    `;
    const tarjetasR = await pool.query(tarjetasQ, [partido_id]);

    const plantelLocalQ = `
      SELECT id, nombre, apellido, cedidentidad, numero_camiseta, posicion, equipo_id, foto_cedula_url, foto_carnet_url
      FROM jugadores
      WHERE equipo_id = $1
      ORDER BY numero_camiseta NULLS LAST, apellido, nombre
    `;
    const plantelVisitanteQ = `
      SELECT id, nombre, apellido, cedidentidad, numero_camiseta, posicion, equipo_id, foto_cedula_url, foto_carnet_url
      FROM jugadores
      WHERE equipo_id = $1
      ORDER BY numero_camiseta NULLS LAST, apellido, nombre
    `;
    const [localR, visitaR] = await Promise.all([
      pool.query(plantelLocalQ, [partido.equipo_local_id]),
      pool.query(plantelVisitanteQ, [partido.equipo_visitante_id]),
    ]);

    return {
      partido,
      documentos_requeridos: {
        foto_cedula: partido.requiere_foto_cedula === true,
        foto_carnet: partido.requiere_foto_carnet === true,
      },
      planilla: {
        pago_arbitraje: Number(planilla?.pago_arbitraje || 0),
        pago_local: Number(planilla?.pago_local || 0),
        pago_visitante: Number(planilla?.pago_visitante || 0),
        observaciones: planilla?.observaciones || "",
      },
      goleadores: goleadoresR.rows,
      tarjetas: tarjetasR.rows,
      plantel_local: localR.rows,
      plantel_visitante: visitaR.rows,
    };
  }

  static async guardarPlanilla(partido_id, datos = {}) {
    await this.asegurarEsquemaPlanilla();

    const resultadoLocal = Number.parseInt(datos.resultado_local, 10) || 0;
    const resultadoVisitante = Number.parseInt(datos.resultado_visitante, 10) || 0;
    const estado = datos.estado || "finalizado";
    const goles = Array.isArray(datos.goles) ? datos.goles : [];
    const tarjetas = Array.isArray(datos.tarjetas) ? datos.tarjetas : [];
    const pagos = datos.pagos || {};
    const pagoArbitraje = Number.parseFloat(pagos.pago_arbitraje ?? 0) || 0;
    const pagoLocal = Number.parseFloat(pagos.pago_local ?? 0) || 0;
    const pagoVisitante = Number.parseFloat(pagos.pago_visitante ?? 0) || 0;
    const observaciones = (datos.observaciones || "").toString().trim();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const partidoR = await client.query(
        `SELECT * FROM partidos WHERE id = $1 LIMIT 1`,
        [partido_id]
      );
      const partido = partidoR.rows[0];
      if (!partido) throw new Error("Partido no encontrado");

      const columnaTs = await this.obtenerColumnaTimestampActualizacion();
      const setTs = columnaTs ? `, ${columnaTs} = CURRENT_TIMESTAMP` : "";

      await client.query(
        `
          UPDATE partidos
          SET resultado_local = $1,
              resultado_visitante = $2,
              estado = $3
              ${setTs}
          WHERE id = $4
        `,
        [resultadoLocal, resultadoVisitante, estado, partido_id]
      );

      await client.query(
        `
          INSERT INTO partido_planillas
            (partido_id, pago_arbitraje, pago_local, pago_visitante, observaciones, updated_at)
          VALUES
            ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
          ON CONFLICT (partido_id)
          DO UPDATE SET
            pago_arbitraje = EXCLUDED.pago_arbitraje,
            pago_local = EXCLUDED.pago_local,
            pago_visitante = EXCLUDED.pago_visitante,
            observaciones = EXCLUDED.observaciones,
            updated_at = CURRENT_TIMESTAMP
        `,
        [partido_id, pagoArbitraje, pagoLocal, pagoVisitante, observaciones]
      );

      await client.query(`DELETE FROM goleadores WHERE partido_id = $1`, [partido_id]);
      for (const item of goles) {
        const jugadorId = Number.parseInt(item.jugador_id, 10);
        const golesJugador = Number.parseInt(item.goles, 10);
        if (!Number.isFinite(jugadorId) || !Number.isFinite(golesJugador) || golesJugador <= 0) continue;
        const tipoGol = (item.tipo_gol || "campo").toString().trim().toLowerCase();
        const minuto = Number.isFinite(Number.parseInt(item.minuto, 10))
          ? Number.parseInt(item.minuto, 10)
          : null;
        await client.query(
          `
            INSERT INTO goleadores
              (partido_id, jugador_id, goles, tipo_gol, minuto)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [partido_id, jugadorId, golesJugador, tipoGol, minuto]
        );
      }

      await client.query(`DELETE FROM tarjetas WHERE partido_id = $1`, [partido_id]);
      for (const item of tarjetas) {
        const tipo = (item.tipo_tarjeta || "").toString().trim().toLowerCase();
        if (!tipo) continue;
        const jugadorId = Number.isFinite(Number.parseInt(item.jugador_id, 10))
          ? Number.parseInt(item.jugador_id, 10)
          : null;
        const equipoId = Number.isFinite(Number.parseInt(item.equipo_id, 10))
          ? Number.parseInt(item.equipo_id, 10)
          : null;
        const minuto = Number.isFinite(Number.parseInt(item.minuto, 10))
          ? Number.parseInt(item.minuto, 10)
          : null;
        const observacion = (item.observacion || "").toString().trim() || null;
        await client.query(
          `
            INSERT INTO tarjetas
              (partido_id, jugador_id, equipo_id, tipo_tarjeta, minuto, observacion)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [partido_id, jugadorId, equipoId, tipo, minuto, observacion]
        );
      }

      await client.query("COMMIT");
      return this.obtenerPlanilla(partido_id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Partido;
