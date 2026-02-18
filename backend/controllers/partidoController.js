// controllers/partidoController.js
const Partido = require("../models/Partido");

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
      // opcional: si algún día quieres sobreescribir fechas del evento
      fecha_inicio = null,
      fecha_fin = null,
    } = req.body || {};

    const partidos = await Partido.generarFixtureEvento({
      evento_id,
      ida_y_vuelta: ida_y_vuelta === true,
      duracion_min: parseInt(duracion_min, 10),
      descanso_min: parseInt(descanso_min, 10),
      reemplazar: reemplazar === true,
      programacion_manual: programacion_manual === true,
      fecha_inicio,
      fecha_fin,
      modo,
    });

    return res.json({
      ok: true,
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

    const planilla = await Partido.guardarPlanilla(id, req.body || {});
    return res.json({
      ok: true,
      mensaje: "Planilla guardada correctamente",
      ...planilla,
    });
  } catch (error) {
    console.error("Error guardando planilla de partido:", error);
    return res.status(500).json({ error: error.message });
  }
};
