// controllers/partidoController.js
const Partido = require("../models/Partido");
const Eliminatoria = require("../models/Eliminatoria");
const pool = require("../config/database");
const { ACCIONES, registrar: registrarAuditoria, extraerIp } = require("../services/auditoria");

function parseBooleanFlag(value) {
  return value === true || String(value || "").trim().toLowerCase() === "true";
}

function resolverModoProgramacion(body = {}) {
  const hasAuto = Object.prototype.hasOwnProperty.call(body, "programacion_automatica");
  const hasManual = Object.prototype.hasOwnProperty.call(body, "programacion_manual");
  const automatica = parseBooleanFlag(body.programacion_automatica);
  const manual = parseBooleanFlag(body.programacion_manual);

  if (hasAuto && hasManual) {
    if (automatica && manual) {
      const err = new Error("Selecciona solo una opción de programación: automática o manual.");
      err.statusCode = 400;
      throw err;
    }
    if (!automatica && !manual) {
      const err = new Error("No se puede generar el fixture porque no tiene seleccionada una opción de programación.");
      err.statusCode = 400;
      throw err;
    }
    return {
      programacion_automatica: automatica,
      programacion_manual: manual,
      permitir_sobrantes_sin_fecha: automatica,
      seleccion_explicita: true,
    };
  }

  if (hasAuto) {
    if (!automatica) {
      const err = new Error("No se puede generar el fixture porque no tiene seleccionada una opción de programación.");
      err.statusCode = 400;
      throw err;
    }
    return {
      programacion_automatica: true,
      programacion_manual: false,
      permitir_sobrantes_sin_fecha: true,
      seleccion_explicita: true,
    };
  }

  if (hasManual) {
    if (manual) {
      return {
        programacion_automatica: false,
        programacion_manual: true,
        permitir_sobrantes_sin_fecha: false,
        seleccion_explicita: true,
      };
    }
    // Compatibilidad con clientes antiguos: programacion_manual=false implicaba auto.
    return {
      programacion_automatica: false,
      programacion_manual: false,
      permitir_sobrantes_sin_fecha: false,
      seleccion_explicita: false,
    };
  }

  return {
    programacion_automatica: false,
    programacion_manual: false,
    permitir_sobrantes_sin_fecha: false,
    seleccion_explicita: false,
  };
}

function normalizarNumeroVisiblePartido(valor, { permitirVacio = true } = {}) {
  if (valor === undefined) return undefined;
  if (valor === null || valor === "") {
    return permitirVacio ? null : undefined;
  }

  const numero = Number.parseInt(valor, 10);
  if (!Number.isFinite(numero) || numero <= 0) {
    const err = new Error("El número visible del partido debe ser un entero mayor a 0.");
    err.statusCode = 400;
    throw err;
  }
  return numero;
}

function mapearErrorNumeroVisible(error) {
  if (String(error?.code || "") === "23505" && String(error?.constraint || "") === "idx_partidos_numero_campeonato") {
    const err = new Error("Ese número visible de partido ya está en uso en este campeonato.");
    err.statusCode = 400;
    return err;
  }
  return error;
}

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
      modo = "auto",
      cantidad_equipos = null,
      // opcional: si algún día quieres sobreescribir fechas del evento
      fecha_inicio = null,
      fecha_fin = null,
    } = req.body || {};
    const modoProgramacion = resolverModoProgramacion(req.body || {});

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

    const resultado = await Partido.generarFixtureEvento({
      evento_id,
      ida_y_vuelta: ida_y_vuelta === true,
      duracion_min: parseInt(duracion_min, 10),
      descanso_min: parseInt(descanso_min, 10),
      reemplazar: reemplazar === true,
      programacion_manual: modoProgramacion.programacion_manual,
      programacion_automatica: modoProgramacion.programacion_automatica,
      permitir_sobrantes_sin_fecha: modoProgramacion.permitir_sobrantes_sin_fecha,
      fecha_inicio,
      fecha_fin,
      modo: modoEfectivo,
    });
    const partidos = Array.isArray(resultado) ? resultado : resultado?.partidos || [];

    registrarAuditoria({
      usuarioId: req.user?.id,
      accion: ACCIONES.FIXTURE_GENERADO,
      entidad: "eventos",
      entidadId: evento_id,
      detalle: { total: partidos.length, modo: modoEfectivo },
      ip: extraerIp(req),
    });

    return res.json({
      ok: true,
      tipo_generacion: "fixture",
      total: partidos.length,
      partidos,
      ...(Array.isArray(resultado) ? {} : resultado),
    });
  } catch (error) {
    console.error("Error generando fixture evento:", error);
    const status = Number.isFinite(Number(error?.statusCode)) ? Number(error.statusCode) : 500;
    return res.status(status).json({ error: error.message });
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
    registrarAuditoria({
      usuarioId: req.user?.id,
      accion: ACCIONES.FIXTURE_ELIMINADO,
      entidad: "eventos",
      entidadId: evento_id,
      detalle: { eliminados: resultado.eliminados },
      ip: extraerIp(req),
    });
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
    } = req.body || {};
    const modoProgramacion = resolverModoProgramacion(req.body || {});

    const resultado = await Partido.regenerarFixturePreservandoJugados({
      evento_id,
      ida_y_vuelta: ida_y_vuelta === true,
      duracion_min: parseInt(duracion_min, 10) || 90,
      descanso_min: parseInt(descanso_min, 10) || 10,
      programacion_manual: modoProgramacion.programacion_manual,
      programacion_automatica: modoProgramacion.programacion_automatica,
      permitir_sobrantes_sin_fecha: modoProgramacion.permitir_sobrantes_sin_fecha,
    });
    const partidos = Array.isArray(resultado) ? resultado : resultado?.partidos || [];

    registrarAuditoria({
      usuarioId: req.user?.id,
      accion: ACCIONES.FIXTURE_REGENERADO,
      entidad: "eventos",
      entidadId: evento_id,
      detalle: { total: partidos.length },
      ip: extraerIp(req),
    });

    return res.json({
      ok: true,
      mensaje: partidos.length
        ? `Fixture regenerado: ${partidos.length} partido(s) nuevo(s) creado(s).`
        : "No hay partidos pendientes que regenerar. Todos los enfrentamientos posibles ya fueron jugados.",
      total: partidos.length,
      partidos,
      ...(Array.isArray(resultado) ? {} : resultado),
    });
  } catch (error) {
    console.error("Error regenerando fixture preservando:", error);
    const status = Number.isFinite(Number(error?.statusCode)) ? Number(error.statusCode) : 500;
    return res.status(status).json({ error: error.message });
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
      numero_campeonato = null,
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
      evento_id ? parseInt(evento_id, 10) : null,
      normalizarNumeroVisiblePartido(numero_campeonato)
    );

    return res.status(201).json({ ok: true, partido });
  } catch (error) {
    const mapped = mapearErrorNumeroVisible(error);
    console.error("Error creando partido:", mapped);
    return res.status(mapped.statusCode || 500).json({ error: mapped.message });
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

    // Permitimos editar jornada y — solo para administrador — los equipos
    const datos = {
      fecha_partido: req.body.fecha_partido ?? undefined,
      hora_partido: req.body.hora_partido ?? undefined,
      cancha: req.body.cancha ?? undefined,
      jornada: req.body.jornada ?? undefined,
      grupo_id: req.body.grupo_id ?? undefined,
      numero_campeonato: normalizarNumeroVisiblePartido(req.body.numero_campeonato),
    };

    // Cambio de equipos: solo el rol administrador puede hacerlo
    const rolUsuario = String(req.user?.rol || req.user?.role || "").toLowerCase();
    if (rolUsuario === "administrador") {
      if (req.body.equipo_local_id !== undefined)
        datos.equipo_local_id = parseInt(req.body.equipo_local_id, 10) || undefined;
      if (req.body.equipo_visitante_id !== undefined)
        datos.equipo_visitante_id = parseInt(req.body.equipo_visitante_id, 10) || undefined;
    }

    // Estado manual explícito (suspendido, aplazado, pendiente, programado, en_curso)
    const ESTADOS_EDITABLES = ["pendiente", "programado", "suspendido", "aplazado", "en_curso"];
    if (req.body.estado !== undefined && ESTADOS_EDITABLES.includes(req.body.estado)) {
      datos.estado = req.body.estado;
    } else if (req.body.fecha_partido !== undefined) {
      // Auto-transición de estado al programar o des-programar un partido.
      // Estados terminales/manuales no se tocan.
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
    const mapped = mapearErrorNumeroVisible(error);
    console.error("Error actualizando partido:", mapped);
    return res.status(mapped.statusCode || 500).json({ error: mapped.message });
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

    registrarAuditoria({
      usuarioId: req.user?.id,
      accion: ACCIONES.RESULTADO_REGISTRADO,
      entidad: "partidos",
      entidadId: id,
      detalle: { resultado_local, resultado_visitante, estado },
      ip: extraerIp(req),
    });

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

    registrarAuditoria({
      usuarioId: req.user?.id,
      accion: ACCIONES.PLANILLA_GUARDADA,
      entidad: "partidos",
      entidadId: id,
      detalle: {
        resultado_local: planilla?.partido?.resultado_local ?? null,
        resultado_visitante: planilla?.partido?.resultado_visitante ?? null,
        estado: planilla?.partido?.estado ?? null,
      },
      ip: extraerIp(req),
    });

    return res.json({
      ok: true,
      mensaje: "Planilla guardada correctamente",
      ...planilla,
    });
  } catch (error) {
    const mapped = mapearErrorNumeroVisible(error);
    console.error("Error guardando planilla de partido:", mapped);
    const status = Number.isFinite(Number(mapped?.statusCode))
      ? Number(mapped.statusCode)
      : 500;
    return res.status(status).json({ error: mapped.message });
  }
};
