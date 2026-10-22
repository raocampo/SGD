const pool = require("../config/database");

// Catálogo mínimo para elegir equipo antes de tener usuario_equipos.
// No usa las lecturas operativas, que ya exigen una asociación previa.
async function consultarOpciones(client, equipoId = null) {
  const result = await client.query(`
    SELECT org.id AS organizador_id, org.nombre AS organizador_nombre,
           org.organizacion_nombre, c.id AS campeonato_id, c.nombre AS campeonato_nombre,
           ev.id AS evento_id, ev.nombre AS evento_nombre,
           e.id AS equipo_id, e.nombre AS equipo_nombre, e.numero_campeonato
    FROM campeonatos c
    JOIN usuarios org ON (
      org.id = c.creador_usuario_id
      OR (
        c.creador_usuario_id IS NULL
        AND LOWER(NULLIF(TRIM(c.organizador), '')) = ANY(ARRAY[
          LOWER(NULLIF(TRIM(org.nombre), '')),
          LOWER(NULLIF(TRIM(org.organizacion_nombre), '')),
          LOWER(NULLIF(TRIM(org.email), ''))
        ])
      )
    )
    LEFT JOIN eventos ev ON ev.campeonato_id = c.id
    LEFT JOIN evento_equipos ee ON ee.evento_id = ev.id
    LEFT JOIN equipos e ON e.id = ee.equipo_id AND e.campeonato_id = c.id
    WHERE org.activo = TRUE
      AND LOWER(org.rol) = 'organizador'
      AND LOWER(c.estado) IN ('inscripcion', 'en_curso', 'finalizado')
      ${equipoId === null ? "" : "AND e.id = $1"}
    ORDER BY org.organizacion_nombre, org.nombre, c.nombre, ev.nombre, e.nombre, e.id
  `, equipoId === null ? [] : [equipoId]);
  return result.rows;
}

async function listarOpcionesAsociacion(client = pool) {
  const rows = await consultarOpciones(client);
  const organizadores = new Map();
  for (const row of rows) {
    const orgId = Number(row.organizador_id);
    if (!organizadores.has(orgId)) {
      organizadores.set(orgId, {
        id: orgId,
        nombre: row.organizacion_nombre
          ? `${row.organizacion_nombre} (${row.organizador_nombre})`
          : row.organizador_nombre,
        campeonatos: new Map(),
      });
    }
    const org = organizadores.get(orgId);
    const campId = Number(row.campeonato_id);
    if (!org.campeonatos.has(campId)) {
      org.campeonatos.set(campId, { id: campId, nombre: row.campeonato_nombre, categorias: new Map() });
    }
    const categorias = org.campeonatos.get(campId).categorias;
    if (row.evento_id == null) continue;
    const eventoId = Number(row.evento_id);
    if (!categorias.has(eventoId)) {
      categorias.set(eventoId, { id: eventoId, nombre: row.evento_nombre, equipos: new Map() });
    }
    if (row.equipo_id != null) {
      categorias.get(eventoId).equipos.set(Number(row.equipo_id), {
        id: Number(row.equipo_id), nombre: row.equipo_nombre, numero: row.numero_campeonato,
      });
    }
  }
  return [...organizadores.values()].map((org) => ({ ...org, campeonatos: [...org.campeonatos.values()].map((camp) => {
    const categorias = [...camp.categorias.values()].map((cat) => {
      const equipos = [...cat.equipos.values()];
      return { ...cat, equipos: equipos.map((equipo) => ({
        id: equipo.id, nombre: equipo.nombre,
        etiqueta: equipos.filter(e => e.nombre.trim().toLowerCase() === equipo.nombre.trim().toLowerCase()).length > 1
          ? `${equipo.nombre} (N.º ${equipo.numero || equipo.id})` : equipo.nombre,
      })) };
    });
    // Compatibilidad con clientes anteriores: solo inscritos, sin repetir IDs.
    const equipos = new Map();
    for (const cat of categorias) for (const equipo of cat.equipos) {
      if (!equipos.has(equipo.id)) equipos.set(equipo.id, { id: equipo.id, nombre: `${equipo.etiqueta} — ${cat.nombre}` });
    }
    return { ...camp, categorias, equipos: [...equipos.values()] };
  }) }));
}

function idSeleccion(valor, nombre, obligatorio = false) {
  if (!obligatorio && (valor === undefined || valor === null || valor === "")) return null;
  const texto = String(valor ?? "").trim();
  const id = Number(texto);
  if (!/^[1-9]\d*$/.test(texto) || !Number.isSafeInteger(id) || id > 2147483647) {
    throw Object.assign(new Error(`${nombre} invalido`), { status: 400 });
  }
  return id;
}

async function validarSeleccionAsociacion(seleccion = {}, client = pool) {
  const equipoId = idSeleccion(seleccion.equipo_id, "equipo_id", true);
  // Los clientes antiguos solo enviaban equipo_id; se deriva el resto de la BD.
  const campeonatoId = idSeleccion(seleccion.campeonato_id, "campeonato_id");
  const organizadorId = idSeleccion(seleccion.organizador_id, "organizador_id");
  const eventoId = idSeleccion(seleccion.evento_id, "evento_id");
  const rows = await consultarOpciones(client, equipoId);
  const matches = rows.filter((row) => Number(row.equipo_id) === equipoId
    && (campeonatoId === null || Number(row.campeonato_id) === campeonatoId)
    && (organizadorId === null || Number(row.organizador_id) === organizadorId)
    && (eventoId === null || Number(row.evento_id) === eventoId));
  const match = matches[0];
  if (!match) {
    throw Object.assign(new Error("El equipo no está inscrito en la organización, campeonato y categoría seleccionados o ya no está disponible. Vuelve a seleccionarlo."), { status: 400 });
  }
  if (eventoId === null && new Set(matches.map(row => Number(row.evento_id))).size > 1) {
    throw Object.assign(new Error("Selecciona la categoría de tu equipo."), { status: 400 });
  }
  return { equipo_id: equipoId, evento_id: Number(match.evento_id), campeonato_id: Number(match.campeonato_id), organizador_id: Number(match.organizador_id) };
}

module.exports = { listarOpcionesAsociacion, validarSeleccionAsociacion };
