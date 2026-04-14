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
};
