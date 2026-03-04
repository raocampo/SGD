const pool = require("../config/database");
const Campeonato = require("../models/Campeonato");
const Finanza = require("../models/Finanza");
const Jugador = require("../models/Jugador");
const { buildSessionPayload } = require("./sessionService");
const {
  assertCampeonatoAccess,
  assertEquipoAccess,
  assertEventoAccess,
  mapEvent,
  mapPlayer,
  mapTeam,
  mapTournament,
  mapUser,
  obtenerCampeonatoIdsVisibles,
  obtenerEquipoIdsVisibles,
} = require("./mobileAccessService");

async function listarCampeonatos(user) {
  await Campeonato.asegurarColumnasDocumentos();
  const visibles = await obtenerCampeonatoIdsVisibles(user);
  const campeonatos = await Campeonato.obtenerTodos();

  const filtrados =
    visibles === null
      ? campeonatos
      : campeonatos.filter((item) => visibles.includes(Number(item.id)));

  const [categoriasR, equiposR] = await Promise.all([
    pool.query(`SELECT campeonato_id, COUNT(*)::int AS total FROM eventos GROUP BY campeonato_id`),
    pool.query(`SELECT campeonato_id, COUNT(*)::int AS total FROM equipos GROUP BY campeonato_id`),
  ]);

  const categoriasMap = new Map(
    categoriasR.rows.map((row) => [Number(row.campeonato_id), Number(row.total)])
  );
  const equiposMap = new Map(equiposR.rows.map((row) => [Number(row.campeonato_id), Number(row.total)]));

  return filtrados.map((row) =>
    mapTournament(row, {
      categories: categoriasMap.get(Number(row.id)) || 0,
      teams: equiposMap.get(Number(row.id)) || 0,
    })
  );
}

async function obtenerCampeonatoDetalle(user, campeonatoId) {
  const campId = await assertCampeonatoAccess(user, campeonatoId);
  const campeonato = await Campeonato.obtenerPorId(campId);
  if (!campeonato) throw new Error("Campeonato no encontrado");

  const [categoriasR, equiposR] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total FROM eventos WHERE campeonato_id = $1`, [campId]),
    pool.query(`SELECT COUNT(*)::int AS total FROM equipos WHERE campeonato_id = $1`, [campId]),
  ]);

  return mapTournament(campeonato, {
    categories: Number(categoriasR.rows[0]?.total || 0),
    teams: Number(equiposR.rows[0]?.total || 0),
  });
}

async function listarEventosCampeonato(user, campeonatoId) {
  const campId = await assertCampeonatoAccess(user, campeonatoId);
  const eventosR = await pool.query(
    `
      SELECT *
      FROM eventos
      WHERE campeonato_id = $1
      ORDER BY numero_campeonato ASC NULLS LAST, id ASC
    `,
    [campId]
  );

  const eventos = eventosR.rows || [];
  let filtrados = eventos;

  const equipoIds = await obtenerEquipoIdsVisibles(user);
  if (equipoIds !== null) {
    const permitidosR = await pool.query(
      `
        SELECT DISTINCT evento_id
        FROM evento_equipos
        WHERE equipo_id = ANY($1::int[])
      `,
      [equipoIds]
    );
    const permitidos = new Set(
      permitidosR.rows
        .map((row) => Number.parseInt(row.evento_id, 10))
        .filter((id) => Number.isFinite(id) && id > 0)
    );
    filtrados = eventos.filter((evento) => permitidos.has(Number(evento.id)));
  }

  const countsR = await pool.query(
    `
      SELECT ee.evento_id, COUNT(*)::int AS total
      FROM evento_equipos ee
      JOIN eventos e ON e.id = ee.evento_id
      WHERE e.campeonato_id = $1
      GROUP BY ee.evento_id
    `,
    [campId]
  );
  const countsMap = new Map(countsR.rows.map((row) => [Number(row.evento_id), Number(row.total)]));

  return filtrados.map((row) => mapEvent(row, countsMap.get(Number(row.id)) || 0));
}

async function obtenerEventoDetalle(user, eventoId) {
  const evento = await assertEventoAccess(user, eventoId);
  const countR = await pool.query(
    `SELECT COUNT(*)::int AS total FROM evento_equipos WHERE evento_id = $1`,
    [evento.id]
  );
  return mapEvent(evento, Number(countR.rows[0]?.total || 0));
}

async function listarEquiposEvento(user, eventoId) {
  const evento = await assertEventoAccess(user, eventoId);
  const equiposR = await pool.query(
    `
      WITH base AS (
        SELECT ee.equipo_id
        FROM evento_equipos ee
        WHERE ee.evento_id = $1
        UNION
        SELECT ge.equipo_id
        FROM grupos g
        JOIN grupo_equipos ge ON ge.grupo_id = g.id
        WHERE g.evento_id = $1
        UNION
        SELECT p.equipo_local_id AS equipo_id
        FROM partidos p
        WHERE p.evento_id = $1
        UNION
        SELECT p.equipo_visitante_id AS equipo_id
        FROM partidos p
        WHERE p.evento_id = $1
      )
      SELECT DISTINCT e.*
      FROM base b
      JOIN equipos e ON e.id = b.equipo_id
      ORDER BY e.numero_campeonato ASC NULLS LAST, e.nombre ASC
    `,
    [evento.id]
  );

  let equipos = equiposR.rows || [];
  const visibles = await obtenerEquipoIdsVisibles(user);
  if (visibles !== null) {
    const permitidos = new Set(visibles);
    equipos = equipos.filter((equipo) => permitidos.has(Number(equipo.id)));
  }

  const ids = equipos.map((equipo) => Number(equipo.id)).filter(Boolean);
  const playerCounts = new Map();
  if (ids.length) {
    const playerCountsR = await pool.query(
      `
        SELECT equipo_id, COUNT(*)::int AS total
        FROM jugadores
        WHERE equipo_id = ANY($1::int[])
        GROUP BY equipo_id
      `,
      [ids]
    );
    playerCountsR.rows.forEach((row) => {
      playerCounts.set(Number(row.equipo_id), Number(row.total));
    });
  }

  return equipos.map((row) => mapTeam(row, playerCounts.get(Number(row.id)) || 0));
}

async function obtenerEquipoDetalle(user, equipoId) {
  const equipo = await assertEquipoAccess(user, equipoId);
  const countR = await pool.query(`SELECT COUNT(*)::int AS total FROM jugadores WHERE equipo_id = $1`, [
    equipo.id,
  ]);
  return mapTeam(equipo, Number(countR.rows[0]?.total || 0));
}

async function listarJugadores(user, filters = {}) {
  const equipoId = filters.equipo_id ? Number.parseInt(filters.equipo_id, 10) : null;
  const eventoId = filters.evento_id ? Number.parseInt(filters.evento_id, 10) : null;
  const campeonatoId = filters.campeonato_id ? Number.parseInt(filters.campeonato_id, 10) : null;
  const visibles = await obtenerEquipoIdsVisibles(user);

  if (equipoId) {
    await assertEquipoAccess(user, equipoId);
    const jugadores = await Jugador.obtenerPorEquipo(equipoId);
    return jugadores.map(mapPlayer);
  }

  if (eventoId) {
    const evento = await assertEventoAccess(user, eventoId);
    if (campeonatoId && Number(evento.campeonato_id) !== campeonatoId) {
      throw new Error("El evento no pertenece al campeonato seleccionado");
    }

    const where = [`ee.evento_id = $1`];
    const values = [evento.id];
    let i = 2;

    if (visibles !== null) {
      if (!visibles.length) return [];
      where.push(`e.id = ANY($${i++}::int[])`);
      values.push(visibles);
    }

    const jugadoresR = await pool.query(
      `
        SELECT DISTINCT
          j.*,
          e.nombre AS nombre_equipo,
          e.numero_campeonato AS equipo_numero_campeonato,
          c.nombre AS nombre_campeonato
        FROM jugadores j
        JOIN equipos e ON e.id = j.equipo_id
        JOIN campeonatos c ON c.id = e.campeonato_id
        JOIN evento_equipos ee ON ee.equipo_id = e.id
        WHERE ${where.join(" AND ")}
        ORDER BY
          equipo_numero_campeonato ASC NULLS LAST,
          nombre_equipo ASC,
          j.apellido ASC,
          j.nombre ASC
      `,
      values
    );
    return jugadoresR.rows.map(mapPlayer);
  }

  if (campeonatoId) {
    const campId = await assertCampeonatoAccess(user, campeonatoId);
    const where = [`e.campeonato_id = $1`];
    const values = [campId];
    let i = 2;

    if (visibles !== null) {
      if (!visibles.length) return [];
      where.push(`e.id = ANY($${i++}::int[])`);
      values.push(visibles);
    }

    const jugadoresR = await pool.query(
      `
        SELECT j.*, e.nombre AS nombre_equipo, c.nombre AS nombre_campeonato
        FROM jugadores j
        JOIN equipos e ON e.id = j.equipo_id
        JOIN campeonatos c ON c.id = e.campeonato_id
        WHERE ${where.join(" AND ")}
        ORDER BY e.numero_campeonato ASC NULLS LAST, e.nombre ASC, j.apellido ASC, j.nombre ASC
      `,
      values
    );
    return jugadoresR.rows.map(mapPlayer);
  }

  let jugadores = [];
  if (visibles === null) {
    jugadores = await Jugador.obtenerTodos();
  } else {
    const grupos = await Promise.all((visibles || []).map((id) => Jugador.obtenerPorEquipo(id)));
    jugadores = grupos.flat();
  }

  return jugadores.map(mapPlayer);
}

async function obtenerDashboard(user) {
  await Finanza.asegurarEsquema();
  const campeonatos = await listarCampeonatos(user);
  const campeonatoIds = campeonatos.map((item) => Number.parseInt(item.id, 10)).filter(Boolean);

  let eventosTotal = 0;
  let equiposTotal = 0;
  let jugadoresTotal = 0;
  let pendientesFinancieros = 0;

  if (campeonatoIds.length) {
    const [eventosR, equiposR, jugadoresR, finanzasR] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM eventos WHERE campeonato_id = ANY($1::int[])`, [campeonatoIds]),
      pool.query(`SELECT COUNT(*)::int AS total FROM equipos WHERE campeonato_id = ANY($1::int[])`, [campeonatoIds]),
      pool.query(
        `
          SELECT COUNT(*)::int AS total
          FROM jugadores j
          JOIN equipos e ON e.id = j.equipo_id
          WHERE e.campeonato_id = ANY($1::int[])
        `,
        [campeonatoIds]
      ),
      pool.query(
        `
          SELECT COUNT(*)::int AS total
          FROM finanzas_movimientos
          WHERE campeonato_id = ANY($1::int[])
            AND tipo_movimiento = 'cargo'
            AND estado IN ('pendiente', 'parcial', 'vencido')
        `,
        [campeonatoIds]
      ),
    ]);

    eventosTotal = Number(eventosR.rows[0]?.total || 0);
    equiposTotal = Number(equiposR.rows[0]?.total || 0);
    jugadoresTotal = Number(jugadoresR.rows[0]?.total || 0);
    pendientesFinancieros = Number(finanzasR.rows[0]?.total || 0);
  }

  return {
    user: mapUser(user),
    metrics: {
      tournaments: campeonatos.length,
      events: eventosTotal,
      teams: equiposTotal,
      players: jugadoresTotal,
      pendingFinancialMovements: pendientesFinancieros,
    },
    recentTournaments: campeonatos.slice(0, 5),
  };
}

function getMobileSession(user) {
  const payload = buildSessionPayload(user, {
    accessToken: null,
    refreshToken: null,
    refreshTokenExpiresAt: null,
  });
  const mappedUser = mapUser(user);
  return {
    ...payload,
    user: mappedUser,
    usuario: mappedUser,
  };
}

module.exports = {
  getMobileSession,
  listarCampeonatos,
  listarEquiposEvento,
  listarEventosCampeonato,
  listarJugadores,
  obtenerCampeonatoDetalle,
  obtenerDashboard,
  obtenerEquipoDetalle,
  obtenerEventoDetalle,
};
