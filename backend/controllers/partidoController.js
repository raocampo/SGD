// controllers/partidoController.js
const Partido = require("../models/Partido");
const Eliminatoria = require("../models/Eliminatoria");
const pool = require("../config/database");

// ===============================
// 🎯 FIXTURE POR EVENTO (CATEGORÍA)
// ===============================
exports.generarFixtureEvento = async (req, res) => {
  try {
    const evento_id = parseInt(req.params.evento_id || req.body?.evento_id, 10);
    if (!Number.isFinite(evento_id)) {
      return res.status(400).json({ error: "evento_id inválido" });
    }

    const {
      ida_y_vuelta = false,
      duracion_min = 90,
      descanso_min = 10,
      reemplazar = true,
      programacion_manual = false,
      modo = "auto",
      cantidad_equipos = null,
      // opcional: si algún día quieres sobreescribir fechas del evento
      fecha_inicio = null,
      fecha_fin = null,
    } = req.body || {};

    const eventoR = await pool.query(
      `SELECT id, metodo_competencia, eliminatoria_equipos FROM eventos WHERE id = $1 LIMIT 1`,
      [evento_id]
    );
    const evento = eventoR.rows[0];
    if (!evento) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    const metodoCompetencia = String(evento.metodo_competencia || "grupos").toLowerCase();
    let modoEfectivo = String(modo || "auto").toLowerCase();

    if (modoEfectivo === "auto") {
      if (metodoCompetencia === "eliminatoria") modoEfectivo = "eliminatoria";
      else if (metodoCompetencia === "liga") modoEfectivo = "todos";
      else modoEfectivo = "grupos";
    }

    if (modoEfectivo === "eliminatoria") {
      const cantidadObjetivo =
        Number.parseInt(cantidad_equipos, 10) ||
        Number.parseInt(evento.eliminatoria_equipos, 10) ||
        null;

      const bracket = await Eliminatoria.generarBracket(evento_id, cantidadObjetivo);
      return res.json({
        ok: true,
        tipo_generacion: "eliminatoria",
        total: bracket.length,
        partidos: bracket,
      });
    }

    const partidos = await Partido.generarFixtureEvento({
      evento_id,
      ida_y_vuelta: ida_y_vuelta === true,
      duracion_min: parseInt(duracion_min, 10),
      descanso_min: parseInt(descanso_min, 10),
      reemplazar: reemplazar === true,
      programacion_manual: programacion_manual === true,
      fecha_inicio,
      fecha_fin,
      modo: modoEfectivo,
    });

    return res.json({
      ok: true,
      tipo_generacion: "fixture",
      total: partidos.length,
      partidos,
    });
  } catch (error) {
    console.error("Error generando fixture evento:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.generarFixtureEventoTodos = async (req, res) => {
  req.body = { ...(req.body || {}), modo: "todos" };
  return exports.generarFixtureEvento(req, res);
};

// ===============================
// 🗑️ ELIMINAR FIXTURE COMPLETO DEL EVENTO
// ===============================
exports.eliminarFixtureEvento = async (req, res) => {
  try {
    const evento_id = parseInt(req.params.evento_id, 10);
    if (!Number.isFinite(evento_id)) {
      return res.status(400).json({ error: "evento_id inválido" });
    }

    const force = req.query.force === "true" || req.body?.force === true;

    const resultado = await Partido.eliminarFixtureEvento(evento_id, { force });
    return res.json({
      ok: true,
      mensaje: `Fixture eliminado: ${resultado.eliminados} partido(s) borrados.`,
      ...resultado,
    });
  } catch (error) {
    console.error("Error eliminando fixture evento:", error);
    const status = Number.isFinite(Number(error?.statusCode)) ? Number(error.statusCode) : 500;
    return res.status(status).json({
      error: error.message,
      jugados: error.jugados ?? undefined,
    });
  }
};

// ===============================
// 🔄 REGENERAR FIXTURE PRESERVANDO PARTIDOS JUGADOS
// ===============================
exports.regenerarFixturePreservando = async (req, res) => {
  try {
    const evento_id = parseInt(req.params.evento_id, 10);
    if (!Number.isFinite(evento_id)) {
      return res.status(400).json({ error: "evento_id inválido" });
    }

    const {
      ida_y_vuelta = false,
      duracion_min = 90,
      descanso_min = 10,
      programacion_manual = false,
    } = req.body || {};

    const partidos = await Partido.regenerarFixturePreservandoJugados({
      evento_id,
      ida_y_vuelta: ida_y_vuelta === true,
      duracion_min: parseInt(duracion_min, 10) || 90,
      descanso_min: parseInt(descanso_min, 10) || 10,
      programacion_manual: programacion_manual === true,
    });

    return res.json({
      ok: true,
      mensaje: partidos.length
        ? `Fixture regenerado: ${partidos.length} partido(s) nuevo(s) creado(s).`
        : "No hay partidos pendientes que regenerar. Todos los enfrentamientos posibles ya fueron jugados.",
      total: partidos.length,
      partidos,
    });
  } catch (error) {
    console.error("Error regenerando fixture preservando:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ===============================
// 📋 CONSULTAS (LECTURA)
// ===============================
exports.obtenerPartidosPorEvento = async (req, res) => {
  try {
    const evento_id = parseInt(req.params.evento_id, 10);
    const partidos = await Partido.obtenerPorEvento(evento_id);
    return res.json({ ok: true, partidos });
  } catch (error) {
    console.error("Error obteniendo partidos por evento:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.obtenerPartidosPorGrupo = async (req, res) => {
  try {
    const grupo_id = parseInt(req.params.grupo_id, 10);
    const partidos = await Partido.obtenerPorGrupo(grupo_id);
    return res.json({ ok: true, partidos });
  } catch (error) {
    console.error("Error obteniendo partidos por grupo:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.obtenerPartidosPorCampeonato = async (req, res) => {
  try {
    const campeonato_id = parseInt(req.params.campeonato_id, 10);
    const partidos = await Partido.obtenerPorCampeonato(campeonato_id);
    return res.json({ ok: true, partidos });
  } catch (error) {
    console.error("Error obteniendo partidos por campeonato:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.obtenerPartidosPorCampeonatoYJornada = async (req, res) => {
  try {
    const campeonato_id = parseInt(req.params.campeonato_id, 10);
    const jornada = parseInt(req.params.jornada, 10);

    const partidos = await Partido.obtenerPorCampeonatoYJornada(
      campeonato_id,
      jornada
    );

    return res.json({ ok: true, partidos });
  } catch (error) {
    console.error("Error obteniendo por campeonato y jornada:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ===============================
// 🔄 CRUD BÁSICO
// ===============================
exports.crearPartido = async (req, res) => {
  try {
    const {
      campeonato_id,
      evento_id = null,
      grupo_id,
      equipo_local_id,
      equipo_visitante_id,
      fecha_partido = null,
      hora_partido = null,
      cancha = null,
      jornada,
    } = req.body;

    const partido = await Partido.crear(
      parseInt(campeonato_id, 10),
      grupo_id ? parseInt(grupo_id, 10) : null,
      parseInt(equipo_local_id, 10),
      parseInt(equipo_visitante_id, 10),
      fecha_partido,
      hora_partido,
      cancha,
      jornada ? parseInt(jornada, 10) : null,
      evento_id ? parseInt(evento_id, 10) : null
    );

    return res.status(201).json({ ok: true, partido });
  } catch (error) {
    console.error("Error creando partido:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.obtenerPartido = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const partido = await Partido.obtenerPorId(id);
    return res.json({ ok: true, partido });
  } catch (error) {
    console.error("Error obteniendo partido:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.obtenerPlanillaPartido = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "id de partido invalido" });
    }

    const planilla = await Partido.obtenerPlanilla(id);
    if (!planilla) {
      return res.status(404).json({ error: "Partido no encontrado" });
    }

    return res.json({ ok: true, ...planilla });
  } catch (error) {
    console.error("Error obteniendo planilla de partido:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.actualizarPartido = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    // Permitimos editar jornada también
    const datos = {
      fecha_partido: req.body.fecha_partido ?? undefined,
      hora_partido: req.body.hora_partido ?? undefined,
      cancha: req.body.cancha ?? undefined,
      jornada: req.body.jornada ?? undefined,
      grupo_id: req.body.grupo_id ?? undefined,
    };

    // Auto-transición de estado al programar o des-programar un partido.
    // Estados terminales/manuales no se tocan.
    if (req.body.fecha_partido !== undefined) {
      const actual = await Partido.obtenerPorId(id);
      const estadoActual = String(actual?.estado || "").toLowerCase();
      const protegidos = ["finalizado", "no_presentaron_ambos", "suspendido", "aplazado", "en_curso"];
      if (!protegidos.includes(estadoActual)) {
        datos.estado = req.body.fecha_partido ? "programado" : "pendiente";
      }
    }

    const partido = await Partido.actualizar(id, datos);
    return res.json({ ok: true, partido });
  } catch (error) {
    console.error("Error actualizando partido:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.eliminarPartido = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const partido = await Partido.eliminar(id);
    return res.json({ ok: true, partido });
  } catch (error) {
    console.error("Error eliminando partido:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ===============================
// 📊 RESULTADOS / ESTADÍSTICAS
// ===============================
exports.registrarResultado = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { resultado_local, resultado_visitante, estado = "finalizado" } =
      req.body;

    const partido = await Partido.actualizarResultado(
      id,
      resultado_local,
      resultado_visitante,
      estado
    );

    return res.json({ ok: true, partido });
  } catch (error) {
    console.error("Error registrando resultado:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.registrarResultadoConShootouts = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      resultado_local,
      resultado_visitante,
      shootouts_local,
      shootouts_visitante,
      estado = "finalizado",
    } = req.body;

    const partido = await Partido.actualizarResultadoConShootouts(
      id,
      resultado_local,
      resultado_visitante,
      shootouts_local,
      shootouts_visitante,
      estado
    );

    return res.json({ ok: true, partido });
  } catch (error) {
    console.error("Error registrando shootouts:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.obtenerEstadisticasEquipo = async (req, res) => {
  try {
    const equipo_id = parseInt(req.params.equipo_id, 10);
    const campeonato_id = parseInt(req.params.campeonato_id, 10);
    const estadisticas = await Partido.obtenerEstadisticasEquipo(
      equipo_id,
      campeonato_id
    );
    return res.json({ ok: true, estadisticas });
  } catch (error) {
    console.error("Error estadísticas:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.guardarPlanillaPartido = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "id de partido invalido" });
    }

    const planilla = await Partido.guardarPlanilla(
      id,
      req.body || {},
      {
        usuario_id: req.user?.id || null,
      }
    );
    return res.json({
      ok: true,
      mensaje: "Planilla guardada correctamente",
      ...planilla,
    });
  } catch (error) {
    console.error("Error guardando planilla de partido:", error);
    const status = Number.isFinite(Number(error?.statusCode))
      ? Number(error.statusCode)
      : 500;
    return res.status(status).json({ error: error.message });
  }
};
