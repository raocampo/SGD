const pool = require("../config/database");
const Partido = require("../models/Partido");
const Eliminatoria = require("../models/Eliminatoria");
const Auspiciante = require("../models/Auspiciante");
const OrganizadorPortal = require("../models/OrganizadorPortal");
const tablaController = require("../controllers/tablaController");

const ESTADOS_PUBLICOS = new Set([
  "planificacion",
  "borrador",
  "inscripcion",
  "en_curso",
  "finalizado",
]);

const SQL_FILTRO_PUBLICO_CAMPEONATO = `
  (
    LOWER(COALESCE(u.rol, '')) = 'organizador'
    OR (
      c.creador_usuario_id IS NULL
      AND NULLIF(TRIM(COALESCE(c.organizador, '')), '') IS NOT NULL
    )
  )
`;

function esEstadoPublico(estado) {
  return ESTADOS_PUBLICOS.has(String(estado || "").trim().toLowerCase());
}

function normalizarEntero(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function ordenarJornadas(a, b) {
  const aNum = normalizarEntero(a?.numero);
  const bNum = normalizarEntero(b?.numero);
  if (aNum !== null && bNum !== null) return aNum - bNum;
  if (aNum !== null) return -1;
  if (bNum !== null) return 1;
  return String(a?.numero || "").localeCompare(String(b?.numero || ""));
}

function resumirCampeonato(campeonato, extras = {}) {
  if (!campeonato) return null;
  return {
    id: Number(campeonato.id),
    nombre: campeonato.nombre,
    organizador: campeonato.organizador || null,
    fecha_inicio: campeonato.fecha_inicio || null,
    fecha_fin: campeonato.fecha_fin || null,
    estado: campeonato.estado || "borrador",
    tipo_futbol: campeonato.tipo_futbol || null,
    tipo_deporte: campeonato.tipo_deporte || campeonato.tipo_futbol || null,
    sistema_puntuacion: campeonato.sistema_puntuacion || null,
    logo_url: campeonato.logo_url || null,
    color_primario: campeonato.color_primario || null,
    color_secundario: campeonato.color_secundario || null,
    color_acento: campeonato.color_acento || null,
    ...extras,
  };
}

async function enriquecerCampeonatoConAssets(campeonato, caches = {}) {
  if (!campeonato) return {};
  const usuarioId = normalizarEntero(campeonato.creador_usuario_id);
  const campeonatoId = normalizarEntero(campeonato.id);
  let portalConfig = null;
  let mediaCard = null;

  if (usuarioId) {
    if (!caches.portalConfig) caches.portalConfig = new Map();
    if (!caches.portalConfig.has(usuarioId)) {
      caches.portalConfig.set(usuarioId, await OrganizadorPortal.obtenerConfig(usuarioId));
    }
    portalConfig = caches.portalConfig.get(usuarioId) || null;
  }

  if (usuarioId && campeonatoId) {
    if (!caches.mediaCard) caches.mediaCard = new Map();
    if (!caches.mediaCard.has(campeonatoId)) {
      caches.mediaCard.set(
        campeonatoId,
        await OrganizadorPortal.obtenerMediaCardCampeonato(usuarioId, campeonatoId)
      );
    }
    mediaCard = caches.mediaCard.get(campeonatoId) || null;
  }

  return {
    card_image_url: mediaCard?.imagen_url || portalConfig?.logo_url || campeonato.logo_url || null,
    organizador_logo_url: portalConfig?.logo_url || null,
  };
}

function resumirEvento(evento) {
  if (!evento) return null;
  return {
    id: Number(evento.id),
    campeonato_id: Number(evento.campeonato_id),
    campeonato_nombre: evento.campeonato_nombre || null,
    nombre: evento.nombre,
    organizador: evento.organizador || null,
    fecha_inicio: evento.fecha_inicio || null,
    fecha_fin: evento.fecha_fin || null,
    modalidad: evento.modalidad || null,
    metodo_competencia: evento.metodo_competencia || "grupos",
    clasificacion_tabla_acumulada: evento.clasificacion_tabla_acumulada === true,
    eliminatoria_equipos: normalizarEntero(evento.eliminatoria_equipos),
    numero_campeonato: normalizarEntero(evento.numero_campeonato),
    costo_inscripcion: Number(evento.costo_inscripcion || 0),
    tipo_futbol: evento.tipo_futbol || evento.campeonato_tipo_futbol || null,
    tipo_deporte: evento.tipo_deporte || evento.campeonato_tipo_deporte || evento.tipo_futbol || evento.campeonato_tipo_futbol || null,
    sistema_puntuacion: evento.sistema_puntuacion || evento.campeonato_sistema_puntuacion || null,
    total_equipos: normalizarEntero(evento.total_equipos) || 0,
    total_grupos: normalizarEntero(evento.total_grupos) || 0,
    total_partidos: normalizarEntero(evento.total_partidos) || 0,
    partidos_finalizados: normalizarEntero(evento.partidos_finalizados) || 0,
  };
}

function normalizarCategoriasResumen(resumen) {
  if (!resumen) return [];
  const data =
    typeof resumen === "string"
      ? (() => {
          try {
            return JSON.parse(resumen);
          } catch (_) {
            return [];
          }
        })()
      : resumen;

  if (!Array.isArray(data)) return [];
  return data
    .map((item) => ({
      id: normalizarEntero(item?.id),
      nombre: item?.nombre || null,
      total_equipos: normalizarEntero(item?.total_equipos) || 0,
      modalidad: item?.modalidad || null,
      metodo_competencia: item?.metodo_competencia || "grupos",
      clasificacion_tabla_acumulada: item?.clasificacion_tabla_acumulada === true,
    }))
    .filter((item) => item.id !== null && item.nombre);
}

function deduplicarAuspiciantes(items = []) {
  const vistos = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const nombre = String(item?.nombre || "")
      .trim()
      .toLowerCase();
    const logo = String(item?.logo_url || "")
      .trim()
      .toLowerCase();
    const clave = `${nombre}|${logo}`;
    if (!nombre && !logo) return false;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

async function listarAuspiciantesAcotadosCampeonato(campeonato = null) {
  const campeonatoId = normalizarEntero(campeonato?.id);
  if (!campeonatoId) return [];

  let auspiciantes = await Auspiciante.listarPorCampeonato(campeonatoId, true);
  if (Array.isArray(auspiciantes) && auspiciantes.length) {
    return deduplicarAuspiciantes(auspiciantes);
  }

  const organizadorId = normalizarEntero(campeonato?.creador_usuario_id);
  const organizadorNombre = String(campeonato?.organizador || "").trim();

  auspiciantes = await OrganizadorPortal.listarAuspiciantesRelacionados({
    usuarioId: organizadorId,
    organizadorNombre,
  });
  if (Array.isArray(auspiciantes) && auspiciantes.length) {
    return deduplicarAuspiciantes(auspiciantes);
  }

  if (!organizadorId) return [];
  return deduplicarAuspiciantes(await OrganizadorPortal.listarAuspiciantesConFallback(organizadorId));
}

async function obtenerTotalesCampeonato(ids = []) {
  const idsValidos = ids.map((item) => normalizarEntero(item)).filter((item) => item !== null);
  if (!idsValidos.length) return new Map();

  const q = `
    SELECT
      e.campeonato_id,
      COUNT(DISTINCT e.id)::int AS total_eventos,
      COUNT(DISTINCT ee.equipo_id)::int AS total_equipos,
      COUNT(DISTINCT g.id)::int AS total_grupos
    FROM eventos e
    LEFT JOIN evento_equipos ee ON ee.evento_id = e.id
    LEFT JOIN grupos g ON g.evento_id = e.id
    WHERE e.campeonato_id = ANY($1::int[])
    GROUP BY e.campeonato_id
  `;
  const result = await pool.query(q, [idsValidos]);
  return new Map(
    result.rows.map((row) => [
      Number(row.campeonato_id),
      {
        total_eventos: Number(row.total_eventos || 0),
        total_equipos: Number(row.total_equipos || 0),
        total_grupos: Number(row.total_grupos || 0),
      },
    ])
  );
}

async function obtenerResumenCategoriasCampeonatos(ids = []) {
  const idsValidos = ids.map((item) => normalizarEntero(item)).filter((item) => item !== null);
  if (!idsValidos.length) return new Map();

  const q = `
    SELECT
      e.campeonato_id,
      COALESCE(
        json_agg(
          json_build_object(
            'id', e.id,
            'nombre', e.nombre,
            'total_equipos', COALESCE(eq.total_equipos, 0),
            'modalidad', e.modalidad,
            'metodo_competencia', e.metodo_competencia,
            'clasificacion_tabla_acumulada', COALESCE(e.clasificacion_tabla_acumulada, false)
          )
          ORDER BY COALESCE(e.numero_campeonato, 999999), e.id
        ),
        '[]'::json
      ) AS categorias_resumen
    FROM eventos e
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT ee.equipo_id)::int AS total_equipos
      FROM evento_equipos ee
      WHERE ee.evento_id = e.id
    ) eq ON TRUE
    WHERE e.campeonato_id = ANY($1::int[])
    GROUP BY e.campeonato_id
  `;
  const result = await pool.query(q, [idsValidos]);
  return new Map(
    result.rows.map((row) => [
      Number(row.campeonato_id),
      normalizarCategoriasResumen(row.categorias_resumen),
    ])
  );
}

async function obtenerCampeonatoVisible(campeonatoId) {
  const q = `
    SELECT c.*
    FROM campeonatos c
    LEFT JOIN usuarios u ON u.id = c.creador_usuario_id
    WHERE c.id = $1
      AND ${SQL_FILTRO_PUBLICO_CAMPEONATO}
    LIMIT 1
  `;
  const result = await pool.query(q, [campeonatoId]);
  const campeonato = result.rows[0] || null;
  if (!campeonato || !esEstadoPublico(campeonato.estado)) return null;
  return campeonato;
}

async function obtenerEventoPublico(eventoId) {
  const q = `
    SELECT
      e.*,
      c.nombre AS campeonato_nombre,
      c.estado AS campeonato_estado,
      c.organizador,
      c.fecha_inicio AS campeonato_fecha_inicio,
      c.fecha_fin AS campeonato_fecha_fin,
      c.tipo_futbol AS campeonato_tipo_futbol,
      COALESCE(c.tipo_deporte, c.tipo_futbol) AS campeonato_tipo_deporte,
      c.sistema_puntuacion AS campeonato_sistema_puntuacion
    FROM eventos e
    JOIN campeonatos c ON c.id = e.campeonato_id
    LEFT JOIN usuarios u ON u.id = c.creador_usuario_id
    WHERE e.id = $1
      AND ${SQL_FILTRO_PUBLICO_CAMPEONATO}
    LIMIT 1
  `;
  const result = await pool.query(q, [eventoId]);
  const evento = result.rows[0] || null;
  if (!evento || !esEstadoPublico(evento.campeonato_estado)) return null;
  return evento;
}

async function listarCampeonatosPublicos() {
  const q = `
    SELECT c.*
    FROM campeonatos c
    LEFT JOIN usuarios u ON u.id = c.creador_usuario_id
    WHERE ${SQL_FILTRO_PUBLICO_CAMPEONATO}
    ORDER BY c.created_at DESC
  `;
  const result = await pool.query(q);
  const campeonatos = result.rows;
  const visibles = campeonatos.filter((item) => esEstadoPublico(item.estado));
  const totales = await obtenerTotalesCampeonato(visibles.map((item) => item.id));
  const categorias = await obtenerResumenCategoriasCampeonatos(visibles.map((item) => item.id));

  const caches = {};
  const payload = [];
  for (const item of visibles) {
    const assets = await enriquecerCampeonatoConAssets(item, caches);
    payload.push(
      resumirCampeonato(item, {
        ...(totales.get(Number(item.id)) || {
          total_eventos: 0,
          total_equipos: 0,
          total_grupos: 0,
        }),
        categorias_resumen: categorias.get(Number(item.id)) || [],
        ...assets,
      })
    );
  }
  return payload;
}

async function obtenerCampeonatoPublico(campeonatoId) {
  const campeonato = await obtenerCampeonatoVisible(campeonatoId);
  if (!campeonato) return null;
  const totales = await obtenerTotalesCampeonato([campeonatoId]);
  const categorias = await obtenerResumenCategoriasCampeonatos([campeonatoId]);
  const assets = await enriquecerCampeonatoConAssets(campeonato);
  return resumirCampeonato(campeonato, {
    ...(totales.get(Number(campeonatoId)) || {
      total_eventos: 0,
      total_equipos: 0,
      total_grupos: 0,
    }),
    categorias_resumen: categorias.get(Number(campeonatoId)) || [],
    ...assets,
  });
}

async function listarEventosPublicosPorCampeonato(campeonatoId) {
  const campeonato = await obtenerCampeonatoVisible(campeonatoId);
  if (!campeonato) return null;

  const q = `
    SELECT
      e.*,
      c.nombre AS campeonato_nombre,
      c.organizador,
      c.fecha_inicio AS campeonato_fecha_inicio,
      c.fecha_fin AS campeonato_fecha_fin,
      c.tipo_futbol AS campeonato_tipo_futbol,
      COALESCE(c.tipo_deporte, c.tipo_futbol) AS campeonato_tipo_deporte,
      c.sistema_puntuacion AS campeonato_sistema_puntuacion,
      COUNT(DISTINCT ee.equipo_id)::int AS total_equipos,
      COUNT(DISTINCT g.id)::int AS total_grupos,
      COUNT(DISTINCT p.id)::int AS total_partidos,
      COUNT(DISTINCT CASE
        WHEN p.estado IN ('finalizado', 'no_presentaron_ambos')
          AND p.resultado_local IS NOT NULL
          AND p.resultado_visitante IS NOT NULL
        THEN p.id
      END)::int AS partidos_finalizados
    FROM eventos e
    JOIN campeonatos c ON c.id = e.campeonato_id
    LEFT JOIN usuarios u ON u.id = c.creador_usuario_id
    LEFT JOIN evento_equipos ee ON ee.evento_id = e.id
    LEFT JOIN grupos g ON g.evento_id = e.id
    LEFT JOIN partidos p ON p.evento_id = e.id
    WHERE e.campeonato_id = $1
      AND ${SQL_FILTRO_PUBLICO_CAMPEONATO}
    GROUP BY e.id, c.nombre, c.organizador, c.fecha_inicio, c.fecha_fin, c.tipo_futbol, c.tipo_deporte, c.sistema_puntuacion
    ORDER BY COALESCE(e.numero_campeonato, 999999), e.id
  `;
  const result = await pool.query(q, [campeonatoId]);
  return {
    campeonato: resumirCampeonato(campeonato),
    eventos: result.rows.map((row) => resumirEvento(row)),
  };
}

async function obtenerPartidosPublicosPorEvento(eventoId) {
  const evento = await obtenerEventoPublico(eventoId);
  if (!evento) return null;

  // Jornadas habilitadas: null = todas, array = solo las indicadas
  const jornadasHabilitadas = Array.isArray(evento.portal_jornadas_habilitadas)
    ? new Set(evento.portal_jornadas_habilitadas.map(Number))
    : null;

  const partidos = await Partido.obtenerPorEvento(eventoId);
  const jornadasMap = new Map();
  const rondasOrden = ["reclasificacion", "32vos", "16vos", "12vos", "8vos", "4tos", "semifinal", "final", "tercer_puesto"];
  const indiceRonda = (ronda = "") => {
    const idx = rondasOrden.indexOf(String(ronda || "").trim().toLowerCase());
    return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
  };
  const ordenarBloques = (a, b) => {
    const rondaA = String(a?.playoff_ronda || "").trim().toLowerCase();
    const rondaB = String(b?.playoff_ronda || "").trim().toLowerCase();
    if (rondaA && rondaB) {
      const idxA = indiceRonda(rondaA);
      const idxB = indiceRonda(rondaB);
      if (idxA !== idxB) return idxA - idxB;
    }
    if (rondaA !== rondaB) return rondaA ? 1 : -1;
    return ordenarJornadas(a, b);
  };

  for (const partido of partidos) {
    const playoffRonda = String(
      partido.playoff_ronda || (partido.es_reclasificacion_playoff ? "reclasificacion" : "")
    ).trim().toLowerCase();
    const numero = playoffRonda ? null : (partido.jornada ?? "Sin jornada");
    // Si hay filtro activo, saltar jornadas no habilitadas solo en fase regular
    if (jornadasHabilitadas !== null && !playoffRonda) {
      const numParsed = normalizarEntero(numero);
      if (numParsed === null || !jornadasHabilitadas.has(numParsed)) continue;
    }
    const clave = playoffRonda ? `playoff:${playoffRonda}` : String(numero);
    if (!jornadasMap.has(clave)) {
      jornadasMap.set(clave, {
        numero,
        playoff_ronda: playoffRonda || null,
        partidos: [],
      });
    }
    jornadasMap.get(clave).partidos.push(partido);
  }

  const jornadasFiltradas = Array.from(jornadasMap.values()).sort(ordenarBloques);
  const partidosFiltrados = jornadasFiltradas.flatMap((j) => j.partidos);

  return {
    evento: resumirEvento(evento),
    total: partidosFiltrados.length,
    jornadas: jornadasFiltradas,
    partidos: partidosFiltrados,
  };
}

async function obtenerTablasPublicasPorEvento(eventoId) {
  const evento = await obtenerEventoPublico(eventoId);
  if (!evento) return null;

  const data = await tablaController._internals.generarTablasEventoInterna(eventoId);
  return {
    ...data,
    ok: true,
    evento: {
      ...data.evento,
      metodo_competencia: evento.metodo_competencia || "grupos",
      tipo_futbol: evento.tipo_futbol || null,
      tipo_deporte: evento.tipo_deporte || evento.tipo_futbol || null,
      sistema_puntuacion: evento.sistema_puntuacion || null,
    },
  };
}

async function obtenerEliminatoriasPublicasPorEvento(eventoId) {
  const evento = await obtenerEventoPublico(eventoId);
  if (!evento) return null;

  const diagnostico = await Eliminatoria.obtenerDiagnosticoBracketActual(eventoId);
  const partidos = Array.isArray(diagnostico?.partidos) ? diagnostico.partidos : [];
  const rondas = Array.isArray(diagnostico?.rondas) ? diagnostico.rondas : [];

  if (diagnostico?.consistente === false) {
    return {
      ok: true,
      evento: resumirEvento(evento),
      total: 0,
      rondas: [],
      partidos: [],
      inconsistente: true,
      codigo: diagnostico?.codigo || "bracket_desactualizado",
      mensaje:
        diagnostico?.mensaje ||
        "La llave eliminatoria publicada ya no coincide con la clasificación vigente.",
      detalle:
        diagnostico?.detalle ||
        "Regenera el playoff para publicar una llave consistente con la clasificación actual.",
      reclasificaciones: Array.isArray(diagnostico?.reclasificaciones)
        ? diagnostico.reclasificaciones
        : [],
    };
  }

  return {
    ok: true,
    evento: resumirEvento(evento),
    total: partidos.length,
    rondas,
    partidos,
    inconsistente: false,
  };
}

async function obtenerGoleadoresPublicosPorEvento(eventoId) {
  const evento = await obtenerEventoPublico(eventoId);
  if (!evento) return null;

  const data = await tablaController._internals.obtenerGoleadoresEventoInterno(eventoId);
  return {
    ok: true,
    evento: resumirEvento(evento),
    evento_id: Number(eventoId),
    fuente: data.fuente,
    mensaje: data.mensaje,
    total: Array.isArray(data.goleadores) ? data.goleadores.length : 0,
    goleadores: Array.isArray(data.goleadores) ? data.goleadores : [],
  };
}

async function obtenerTarjetasPublicasPorEvento(eventoId) {
  const evento = await obtenerEventoPublico(eventoId);
  if (!evento) return null;

  const data = await tablaController._internals.obtenerTarjetasEventoInterno(eventoId);
  return {
    ok: true,
    evento: resumirEvento(evento),
    evento_id: Number(eventoId),
    fuente: data.fuente,
    mensaje: data.mensaje,
    total: Array.isArray(data.tarjetas) ? data.tarjetas.length : 0,
    tarjetas: Array.isArray(data.tarjetas) ? data.tarjetas : [],
  };
}

async function obtenerFairPlayPublicoPorEvento(eventoId, query = {}) {
  const evento = await obtenerEventoPublico(eventoId);
  if (!evento) return null;

  const data = await tablaController._internals.obtenerFairPlayEventoInterno(eventoId, query);
  return {
    ...data,
    ok: true,
    evento: resumirEvento(evento),
  };
}

async function listarAuspiciantesPublicosPorCampeonato(campeonatoId) {
  const campeonato = await obtenerCampeonatoVisible(campeonatoId);
  if (!campeonato) return null;

  const auspiciantes = await listarAuspiciantesAcotadosCampeonato(campeonato);
  return {
    ok: true,
    campeonato: resumirCampeonato(campeonato),
    total: auspiciantes.length,
    auspiciantes: auspiciantes.map((item) => ({
      id: normalizarEntero(item.id),
      campeonato_id: normalizarEntero(item.campeonato_id ?? campeonatoId),
      nombre: item.nombre,
      logo_url: item.logo_url || null,
      orden: normalizarEntero(item.orden) || 1,
      activo: item.activo === true,
    })),
  };
}

async function listarMediaPublicaPorCampeonato(campeonatoId) {
  const campeonato = await obtenerCampeonatoVisible(campeonatoId);
  if (!campeonato) return null;

  const organizadorId = normalizarEntero(campeonato.creador_usuario_id);
  const media = organizadorId
    ? await OrganizadorPortal.listarMedia(organizadorId, {
        tipo: "campeonato_gallery",
        campeonato_id: campeonatoId,
        activo: true,
      })
    : [];

  return {
    ok: true,
    campeonato: resumirCampeonato(campeonato),
    total: media.length,
    media: media.map((item) => ({
      id: Number(item.id),
      campeonato_id: normalizarEntero(item.campeonato_id),
      tipo: item.tipo,
      titulo: item.titulo || "",
      descripcion: item.descripcion || "",
      imagen_url: item.imagen_url || "",
      orden: normalizarEntero(item.orden) || 1,
      activo: item.activo === true,
    })),
  };
}

// ─── EQUIPOS Y JUGADORES PÚBLICOS ────────────────────────────────────────────

async function listarEquiposPublicosPorEvento(eventoId) {
  const evR = await pool.query(
    `SELECT e.id, e.nombre, e.metodo_competencia, e.campeonato_id,
            c.nombre AS campeonato_nombre, c.organizador, c.estado AS campeonato_estado
     FROM eventos e
     JOIN campeonatos c ON c.id = e.campeonato_id
     WHERE e.id = $1`,
    [eventoId]
  );
  if (!evR.rows.length) return null;
  const evento = evR.rows[0];

  const eqR = await pool.query(
    `SELECT eq.id, eq.nombre, eq.logo_url, eq.color_primario, eq.color_secundario,
            eq.director_tecnico, eq.numero_campeonato, eq.es_cabeza_serie,
            COUNT(DISTINCT j.id)::int AS total_jugadores,
            COUNT(DISTINCT CASE WHEN p.estado IN ('finalizado','no_presentaron_ambos') THEN p.id END)::int AS partidos_jugados,
            COALESCE(SUM(CASE
              WHEN p.estado IN ('finalizado','no_presentaron_ambos') AND p.equipo_local_id = eq.id
                THEN COALESCE(p.resultado_local,0)
              WHEN p.estado IN ('finalizado','no_presentaron_ambos') AND p.equipo_visitante_id = eq.id
                THEN COALESCE(p.resultado_visitante,0)
              ELSE 0 END),0)::int AS goles_favor,
            COALESCE(SUM(CASE
              WHEN p.estado IN ('finalizado','no_presentaron_ambos') AND p.equipo_local_id = eq.id
                THEN COALESCE(p.resultado_visitante,0)
              WHEN p.estado IN ('finalizado','no_presentaron_ambos') AND p.equipo_visitante_id = eq.id
                THEN COALESCE(p.resultado_local,0)
              ELSE 0 END),0)::int AS goles_contra
     FROM evento_equipos ee
     JOIN equipos eq ON eq.id = ee.equipo_id
     LEFT JOIN jugadores j ON j.equipo_id = eq.id AND j.evento_id = $1
     LEFT JOIN partidos p ON p.evento_id = $1
       AND (p.equipo_local_id = eq.id OR p.equipo_visitante_id = eq.id)
     WHERE ee.evento_id = $1
     GROUP BY eq.id
     ORDER BY eq.nombre`,
    [eventoId]
  );

  return {
    evento: resumirEvento(evento),
    total: eqR.rows.length,
    equipos: eqR.rows.map((r) => ({
      id: Number(r.id),
      nombre: r.nombre,
      logo_url: r.logo_url || null,
      color_primario: r.color_primario || null,
      color_secundario: r.color_secundario || null,
      director_tecnico: r.director_tecnico || null,
      numero_campeonato: normalizarEntero(r.numero_campeonato),
      es_cabeza_serie: r.es_cabeza_serie === true,
      total_jugadores: r.total_jugadores,
      partidos_jugados: r.partidos_jugados,
      goles_favor: r.goles_favor,
      goles_contra: r.goles_contra,
    })),
  };
}

async function obtenerEquipoPublico(equipoId) {
  const eqR = await pool.query(
    `SELECT eq.id, eq.nombre, eq.logo_url, eq.color_primario, eq.color_secundario,
            eq.color_terciario, eq.director_tecnico, eq.asistente_tecnico, eq.medico,
            eq.telefono, eq.email, eq.numero_campeonato, eq.es_cabeza_serie,
            c.id AS campeonato_id, c.nombre AS campeonato_nombre, c.estado AS campeonato_estado,
            c.tipo_futbol, c.tipo_deporte, c.logo_url AS campeonato_logo
     FROM equipos eq
     JOIN campeonatos c ON c.id = eq.campeonato_id
     WHERE eq.id = $1`,
    [equipoId]
  );
  if (!eqR.rows.length) return null;
  const eq = eqR.rows[0];

  // Eventos donde participa el equipo
  const evR = await pool.query(
    `SELECT ev.id, ev.nombre, ev.modalidad, ev.metodo_competencia
     FROM evento_equipos ee
     JOIN eventos ev ON ev.id = ee.evento_id
     WHERE ee.equipo_id = $1
     ORDER BY ev.id`,
    [equipoId]
  );

  // Stats globales (todos los eventos)
  const stR = await pool.query(
    `SELECT
       COUNT(DISTINCT CASE WHEN p.estado IN ('finalizado','no_presentaron_ambos') THEN p.id END)::int AS pj,
       COUNT(DISTINCT CASE
         WHEN p.estado IN ('finalizado','no_presentaron_ambos')
           AND ((p.equipo_local_id = $1 AND p.resultado_local > p.resultado_visitante)
             OR (p.equipo_visitante_id = $1 AND p.resultado_visitante > p.resultado_local))
         THEN p.id END)::int AS pg,
       COUNT(DISTINCT CASE
         WHEN p.estado IN ('finalizado','no_presentaron_ambos')
           AND p.resultado_local = p.resultado_visitante
         THEN p.id END)::int AS pe,
       COUNT(DISTINCT CASE
         WHEN p.estado IN ('finalizado','no_presentaron_ambos')
           AND ((p.equipo_local_id = $1 AND p.resultado_local < p.resultado_visitante)
             OR (p.equipo_visitante_id = $1 AND p.resultado_visitante < p.resultado_local))
         THEN p.id END)::int AS pp,
       COALESCE(SUM(CASE
         WHEN p.estado IN ('finalizado','no_presentaron_ambos') AND p.equipo_local_id = $1
           THEN COALESCE(p.resultado_local,0)
         WHEN p.estado IN ('finalizado','no_presentaron_ambos') AND p.equipo_visitante_id = $1
           THEN COALESCE(p.resultado_visitante,0)
         ELSE 0 END),0)::int AS gf,
       COALESCE(SUM(CASE
         WHEN p.estado IN ('finalizado','no_presentaron_ambos') AND p.equipo_local_id = $1
           THEN COALESCE(p.resultado_visitante,0)
         WHEN p.estado IN ('finalizado','no_presentaron_ambos') AND p.equipo_visitante_id = $1
           THEN COALESCE(p.resultado_local,0)
         ELSE 0 END),0)::int AS gc
     FROM partidos p
     WHERE p.equipo_local_id = $1 OR p.equipo_visitante_id = $1`,
    [equipoId]
  );
  const st = stR.rows[0] || {};

  return {
    id: Number(eq.id),
    nombre: eq.nombre,
    logo_url: eq.logo_url || null,
    color_primario: eq.color_primario || null,
    color_secundario: eq.color_secundario || null,
    color_terciario: eq.color_terciario || null,
    director_tecnico: eq.director_tecnico || null,
    asistente_tecnico: eq.asistente_tecnico || null,
    medico: eq.medico || null,
    telefono: eq.telefono || null,
    email: eq.email || null,
    numero_campeonato: normalizarEntero(eq.numero_campeonato),
    es_cabeza_serie: eq.es_cabeza_serie === true,
    campeonato: {
      id: Number(eq.campeonato_id),
      nombre: eq.campeonato_nombre,
      estado: eq.campeonato_estado,
      tipo_futbol: eq.tipo_futbol || eq.tipo_deporte || null,
      logo_url: eq.campeonato_logo || null,
    },
    eventos: evR.rows.map((e) => ({ id: Number(e.id), nombre: e.nombre, modalidad: e.modalidad, metodo_competencia: e.metodo_competencia })),
    estadisticas: { pj: st.pj || 0, pg: st.pg || 0, pe: st.pe || 0, pp: st.pp || 0, gf: st.gf || 0, gc: st.gc || 0, dg: (st.gf || 0) - (st.gc || 0) },
  };
}

async function listarJugadoresPublicosPorEquipo(equipoId, eventoId = null) {
  const eqR = await pool.query(
    `SELECT eq.id, eq.nombre, eq.logo_url, eq.color_primario, eq.color_secundario
     FROM equipos eq WHERE eq.id = $1`,
    [equipoId]
  );
  if (!eqR.rows.length) return null;

  const params = [equipoId];
  const eventoFiltro = eventoId ? `AND j.evento_id = $2` : "";
  if (eventoId) params.push(eventoId);

  const jR = await pool.query(
    `SELECT j.id, j.nombre, j.apellido, j.cedidentidad, j.posicion,
            j.numero_camiseta, j.es_capitan, j.fecha_nacimiento,
            j.foto_carnet_recorte_url, j.evento_id,
            COALESCE(g.total_goles,0)::int AS goles,
            COALESCE(t.amarillas,0)::int AS tarjetas_amarillas,
            COALESCE(t.rojas,0)::int AS tarjetas_rojas
     FROM jugadores j
     LEFT JOIN (
       SELECT jugador_id, SUM(goles)::int AS total_goles
       FROM goleadores gol
       JOIN partidos p ON p.id = gol.partido_id
       WHERE p.equipo_local_id = $1 OR p.equipo_visitante_id = $1
       GROUP BY jugador_id
     ) g ON g.jugador_id = j.id
     LEFT JOIN (
       SELECT jugador_id,
         COUNT(*) FILTER (WHERE tipo_tarjeta = 'amarilla')::int AS amarillas,
         COUNT(*) FILTER (WHERE tipo_tarjeta IN ('roja','roja_directa','doble_amarilla'))::int AS rojas
       FROM tarjetas tar
       JOIN partidos p ON p.id = tar.partido_id
       WHERE p.equipo_local_id = $1 OR p.equipo_visitante_id = $1
       GROUP BY jugador_id
     ) t ON t.jugador_id = j.id
     WHERE j.equipo_id = $1 ${eventoFiltro}
     ORDER BY j.apellido, j.nombre`,
    params
  );

  return {
    equipo: {
      id: Number(eqR.rows[0].id),
      nombre: eqR.rows[0].nombre,
      logo_url: eqR.rows[0].logo_url || null,
      color_primario: eqR.rows[0].color_primario || null,
      color_secundario: eqR.rows[0].color_secundario || null,
    },
    total: jR.rows.length,
    jugadores: jR.rows.map((j) => ({
      id: Number(j.id),
      nombre: j.nombre,
      apellido: j.apellido,
      nombre_completo: `${j.apellido} ${j.nombre}`.trim(),
      cedidentidad: j.cedidentidad || null,
      posicion: j.posicion || null,
      numero_camiseta: normalizarEntero(j.numero_camiseta),
      es_capitan: j.es_capitan === true,
      fecha_nacimiento: j.fecha_nacimiento || null,
      foto_url: j.foto_carnet_recorte_url || null,
      evento_id: normalizarEntero(j.evento_id),
      goles: j.goles,
      tarjetas_amarillas: j.tarjetas_amarillas,
      tarjetas_rojas: j.tarjetas_rojas,
    })),
  };
}

async function listarPartidosPublicosPorEquipo(equipoId, eventoId = null) {
  const eqR = await pool.query(`SELECT id, nombre, logo_url, color_primario FROM equipos WHERE id = $1`, [equipoId]);
  if (!eqR.rows.length) return null;

  const params = [equipoId];
  const eventoFiltro = eventoId ? `AND p.evento_id = $2` : "";
  if (eventoId) params.push(eventoId);

  const pR = await pool.query(
    `SELECT p.id, p.fecha_partido, p.hora_partido, p.cancha, p.jornada, p.estado,
            p.resultado_local, p.resultado_visitante, p.evento_id,
            el.id AS local_id, el.nombre AS local_nombre, el.logo_url AS local_logo,
            ev.id AS visitante_id, ev.nombre AS visitante_nombre, ev.logo_url AS visitante_logo,
            evo.id AS evento_id_num, evo.nombre AS evento_nombre,
            c.nombre AS campeonato_nombre
     FROM partidos p
     JOIN equipos el ON el.id = p.equipo_local_id
     JOIN equipos ev ON ev.id = p.equipo_visitante_id
     JOIN eventos evo ON evo.id = p.evento_id
     JOIN campeonatos c ON c.id = p.campeonato_id
     WHERE (p.equipo_local_id = $1 OR p.equipo_visitante_id = $1) ${eventoFiltro}
     ORDER BY p.fecha_partido DESC NULLS LAST, p.jornada DESC NULLS LAST`,
    params
  );

  return {
    equipo: { id: Number(eqR.rows[0].id), nombre: eqR.rows[0].nombre, logo_url: eqR.rows[0].logo_url || null },
    total: pR.rows.length,
    partidos: pR.rows.map((p) => {
      const esLocal = Number(p.local_id) === equipoId;
      const gf = esLocal ? normalizarEntero(p.resultado_local) : normalizarEntero(p.resultado_visitante);
      const gc = esLocal ? normalizarEntero(p.resultado_visitante) : normalizarEntero(p.resultado_local);
      let resultado = null;
      if (p.estado === "finalizado" && gf !== null && gc !== null) {
        resultado = gf > gc ? "V" : gf < gc ? "D" : "E";
      }
      return {
        id: Number(p.id),
        fecha: p.fecha_partido || null,
        hora: p.hora_partido || null,
        cancha: p.cancha || null,
        jornada: normalizarEntero(p.jornada),
        estado: p.estado || "pendiente",
        es_local: esLocal,
        rival: esLocal ? { id: Number(p.visitante_id), nombre: p.visitante_nombre, logo_url: p.visitante_logo } : { id: Number(p.local_id), nombre: p.local_nombre, logo_url: p.local_logo },
        goles_favor: gf,
        goles_contra: gc,
        resultado,
        evento_nombre: p.evento_nombre,
        campeonato_nombre: p.campeonato_nombre,
      };
    }),
  };
}

async function obtenerJugadorPublico(jugadorId) {
  const jR = await pool.query(
    `SELECT j.id, j.nombre, j.apellido, j.cedidentidad, j.posicion,
            j.numero_camiseta, j.es_capitan, j.fecha_nacimiento,
            j.foto_carnet_recorte_url, j.evento_id,
            eq.id AS equipo_id, eq.nombre AS equipo_nombre, eq.logo_url AS equipo_logo,
            eq.color_primario, eq.color_secundario,
            c.id AS campeonato_id, c.nombre AS campeonato_nombre
     FROM jugadores j
     JOIN equipos eq ON eq.id = j.equipo_id
     JOIN campeonatos c ON c.id = eq.campeonato_id
     WHERE j.id = $1`,
    [jugadorId]
  );
  if (!jR.rows.length) return null;
  const j = jR.rows[0];

  // Estadísticas del jugador
  const stR = await pool.query(
    `SELECT
       COALESCE(SUM(g.goles),0)::int AS total_goles,
       COUNT(DISTINCT g.partido_id)::int AS partidos_con_gol
     FROM goleadores g WHERE g.jugador_id = $1`,
    [jugadorId]
  );
  const tR = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE tipo_tarjeta = 'amarilla')::int AS amarillas,
       COUNT(*) FILTER (WHERE tipo_tarjeta IN ('roja','roja_directa','doble_amarilla'))::int AS rojas
     FROM tarjetas WHERE jugador_id = $1`,
    [jugadorId]
  );

  const st = stR.rows[0] || {};
  const ta = tR.rows[0] || {};

  return {
    id: Number(j.id),
    nombre: j.nombre,
    apellido: j.apellido,
    nombre_completo: `${j.apellido} ${j.nombre}`.trim(),
    posicion: j.posicion || null,
    numero_camiseta: normalizarEntero(j.numero_camiseta),
    es_capitan: j.es_capitan === true,
    fecha_nacimiento: j.fecha_nacimiento || null,
    foto_url: j.foto_carnet_recorte_url || null,
    equipo: {
      id: Number(j.equipo_id),
      nombre: j.equipo_nombre,
      logo_url: j.equipo_logo || null,
      color_primario: j.color_primario || null,
      color_secundario: j.color_secundario || null,
    },
    campeonato: { id: Number(j.campeonato_id), nombre: j.campeonato_nombre },
    estadisticas: {
      goles: st.total_goles || 0,
      partidos_con_gol: st.partidos_con_gol || 0,
      tarjetas_amarillas: ta.amarillas || 0,
      tarjetas_rojas: ta.rojas || 0,
    },
  };
}

async function listarParticipacionesPublicasJugador(jugadorId) {
  const jR = await pool.query(`SELECT id FROM jugadores WHERE id = $1`, [jugadorId]);
  if (!jR.rows.length) return null;

  // Partidos donde aparece en goleadores o tarjetas
  const pR = await pool.query(
    `SELECT DISTINCT p.id, p.fecha_partido, p.hora_partido, p.jornada, p.estado, p.cancha,
            p.resultado_local, p.resultado_visitante, p.equipo_local_id, p.equipo_visitante_id,
            el.nombre AS local_nombre, el.logo_url AS local_logo,
            ev.nombre AS visitante_nombre, ev.logo_url AS visitante_logo,
            evo.nombre AS evento_nombre, c.nombre AS campeonato_nombre
     FROM partidos p
     JOIN equipos el ON el.id = p.equipo_local_id
     JOIN equipos ev ON ev.id = p.equipo_visitante_id
     JOIN eventos evo ON evo.id = p.evento_id
     JOIN campeonatos c ON c.id = p.campeonato_id
     WHERE p.id IN (
       SELECT partido_id FROM goleadores WHERE jugador_id = $1
       UNION
       SELECT partido_id FROM tarjetas WHERE jugador_id = $1
     )
     ORDER BY p.fecha_partido DESC NULLS LAST, p.id DESC`,
    [jugadorId]
  );

  // Goles por partido
  const gR = await pool.query(
    `SELECT partido_id, SUM(goles)::int AS goles, MIN(minuto) AS minuto_primer_gol
     FROM goleadores WHERE jugador_id = $1 GROUP BY partido_id`,
    [jugadorId]
  );
  const golesMap = new Map(gR.rows.map((r) => [Number(r.partido_id), { goles: r.goles, minuto: r.minuto_primer_gol }]));

  // Tarjetas por partido
  const tR = await pool.query(
    `SELECT partido_id,
       COUNT(*) FILTER (WHERE tipo_tarjeta = 'amarilla')::int AS amarillas,
       COUNT(*) FILTER (WHERE tipo_tarjeta IN ('roja','roja_directa','doble_amarilla'))::int AS rojas
     FROM tarjetas WHERE jugador_id = $1 GROUP BY partido_id`,
    [jugadorId]
  );
  const tarjetasMap = new Map(tR.rows.map((r) => [Number(r.partido_id), { amarillas: r.amarillas, rojas: r.rojas }]));

  return {
    total: pR.rows.length,
    partidos: pR.rows.map((p) => ({
      id: Number(p.id),
      fecha: p.fecha_partido || null,
      jornada: normalizarEntero(p.jornada),
      estado: p.estado || "pendiente",
      cancha: p.cancha || null,
      local: { nombre: p.local_nombre, logo_url: p.local_logo || null },
      visitante: { nombre: p.visitante_nombre, logo_url: p.visitante_logo || null },
      resultado_local: normalizarEntero(p.resultado_local),
      resultado_visitante: normalizarEntero(p.resultado_visitante),
      evento_nombre: p.evento_nombre,
      campeonato_nombre: p.campeonato_nombre,
      goles: golesMap.get(Number(p.id))?.goles || 0,
      tarjetas_amarillas: tarjetasMap.get(Number(p.id))?.amarillas || 0,
      tarjetas_rojas: tarjetasMap.get(Number(p.id))?.rojas || 0,
    })),
  };
}

module.exports = {
  listarCampeonatosPublicos,
  obtenerCampeonatoPublico,
  listarEventosPublicosPorCampeonato,
  obtenerPartidosPublicosPorEvento,
  obtenerTablasPublicasPorEvento,
  obtenerEliminatoriasPublicasPorEvento,
  obtenerGoleadoresPublicosPorEvento,
  obtenerTarjetasPublicasPorEvento,
  obtenerFairPlayPublicoPorEvento,
  listarAuspiciantesPublicosPorCampeonato,
  listarMediaPublicaPorCampeonato,
  listarEquiposPublicosPorEvento,
  obtenerEquipoPublico,
  listarJugadoresPublicosPorEquipo,
  listarPartidosPublicosPorEquipo,
  obtenerJugadorPublico,
  listarParticipacionesPublicasJugador,
};
