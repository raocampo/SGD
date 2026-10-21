const pool = require("../config/database");

// Catálogo mínimo para elegir equipo antes de tener usuario_equipos.
// No usa las lecturas operativas, que ya exigen una asociación previa.
async function consultarOpciones(client, equipoId = null) {
  const result = await client.query(`
    SELECT org.id AS organizador_id, org.nombre AS organizador_nombre,
           org.organizacion_nombre, c.id AS campeonato_id, c.nombre AS campeonato_nombre,
           e.id AS equipo_id, e.nombre AS equipo_nombre
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
    LEFT JOIN equipos e ON e.campeonato_id = c.id
    WHERE org.activo = TRUE
      AND LOWER(org.rol) = 'organizador'
      AND LOWER(c.estado) IN ('inscripcion', 'en_curso', 'finalizado')
      ${equipoId === null ? "" : "AND e.id = $1"}
    ORDER BY org.organizacion_nombre, org.nombre, c.nombre, e.nombre, e.id
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
      org.campeonatos.set(campId, { id: campId, nombre: row.campeonato_nombre, equipos: [] });
    }
    if (row.equipo_id != null) {
      org.campeonatos.get(campId).equipos.push({ id: Number(row.equipo_id), nombre: row.equipo_nombre });
    }
  }
  return [...organizadores.values()].map((org) => ({ ...org, campeonatos: [...org.campeonatos.values()] }));
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
  const rows = await consultarOpciones(client, equipoId);
  const match = rows.find((row) => Number(row.equipo_id) === equipoId
    && (campeonatoId === null || Number(row.campeonato_id) === campeonatoId)
    && (organizadorId === null || Number(row.organizador_id) === organizadorId));
  if (!match) {
    throw Object.assign(new Error("El equipo no pertenece al organizador y campeonato seleccionados o ya no está disponible. Vuelve a seleccionarlo."), { status: 400 });
  }
  return { equipo_id: equipoId, campeonato_id: Number(match.campeonato_id), organizador_id: Number(match.organizador_id) };
}

module.exports = { listarOpcionesAsociacion, validarSeleccionAsociacion };
