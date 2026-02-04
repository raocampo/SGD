// controllers/partidoController.js
const Partido = require("../models/Partido");
const pool = require("../config/database");

const partidoController = {
  // =========================
  // CRUD BÁSICO
  // =========================
  crearPartido: async (req, res) => {
    try {
      const {
        campeonato_id,
        grupo_id,
        equipo_local_id,
        equipo_visitante_id,
        fecha_partido,
        hora_partido,
        cancha,
        jornada,
      } = req.body;

      if (
        !campeonato_id ||
        !grupo_id ||
        !equipo_local_id ||
        !equipo_visitante_id
      ) {
        return res.status(400).json({
          error:
            "campeonato_id, grupo_id, equipo_local_id y equipo_visitante_id son obligatorios",
        });
      }

      const nuevoPartido = await Partido.crear(
        campeonato_id,
        grupo_id,
        equipo_local_id,
        equipo_visitante_id,
        fecha_partido,
        hora_partido,
        cancha,
        jornada,
      );

      res.status(201).json({
        mensaje: "⚽ Partido creado exitosamente",
        partido: nuevoPartido,
      });
    } catch (error) {
      console.error("Error creando partido:", error);

      if (
        error.message.includes("no puede jugar contra sí mismo") ||
        error.message.includes("pertenecer al mismo grupo")
      ) {
        return res.status(400).json({ error: error.message });
      }

      res
        .status(500)
        .json({ error: "Error creando partido", detalle: error.message });
    }
  },

  actualizarPartido: async (req, res) => {
    try {
      const { id } = req.params;
      const datos = req.body;

      // ✅ Si quieres permitir editar la jornada, ya lo soporta tu método actualizar()
      // solo asegúrate que el frontend mande { jornada: X } si cambia.

      const partidoActualizado = await Partido.actualizar(id, datos);

      if (!partidoActualizado) {
        return res.status(404).json({ error: "Partido no encontrado" });
      }

      res.json({
        mensaje: "✅ Partido actualizado exitosamente",
        partido: partidoActualizado,
      });
    } catch (error) {
      console.error("Error actualizando partido:", error);
      res
        .status(500)
        .json({ error: "Error interno del servidor", detalle: error.message });
    }
  },

  eliminarPartido: async (req, res) => {
    try {
      const { id } = req.params;
      const partidoEliminado = await Partido.eliminar(id);

      if (!partidoEliminado) {
        return res.status(404).json({ error: "Partido no encontrado" });
      }

      res.json({
        mensaje: "🗑️ Partido eliminado exitosamente",
        partido: partidoEliminado,
      });
    } catch (error) {
      console.error("Error eliminando partido:", error);
      res
        .status(500)
        .json({ error: "Error interno del servidor", detalle: error.message });
    }
  },

  obtenerPartido: async (req, res) => {
    try {
      const { id } = req.params;
      const partido = await Partido.obtenerPorId(id);

      if (!partido)
        return res.status(404).json({ error: "Partido no encontrado" });

      res.json({ mensaje: "📖 Detalles del partido", partido });
    } catch (error) {
      console.error("Error obteniendo partido:", error);
      res
        .status(500)
        .json({ error: "Error interno del servidor", detalle: error.message });
    }
  },

  // =========================
  // LECTURA (FILTROS)
  // =========================
  obtenerPartidosPorGrupo: async (req, res) => {
    try {
      const { grupo_id } = req.params;
      const partidos = await Partido.obtenerPorGrupo(grupo_id);

      res.json({
        mensaje: "📋 Partidos del grupo",
        total: partidos.length,
        partidos,
      });
    } catch (error) {
      console.error("Error obteniendo partidos por grupo:", error);
      res
        .status(500)
        .json({ error: "Error interno del servidor", detalle: error.message });
    }
  },

  obtenerPartidosPorCampeonato: async (req, res) => {
    try {
      const { campeonato_id } = req.params;
      const partidos = await Partido.obtenerPorCampeonato(campeonato_id);

      res.json({
        mensaje: "🏆 Partidos del campeonato",
        total: partidos.length,
        partidos,
      });
    } catch (error) {
      console.error("Error obteniendo partidos por campeonato:", error);
      res
        .status(500)
        .json({ error: "Error interno del servidor", detalle: error.message });
    }
  },

  // ✅ ESTE ES CLAVE para tu “Tarjeta de Jornada” con TODOS los grupos
  obtenerPartidosPorCampeonatoYJornada: async (req, res) => {
    try {
      const { campeonato_id, jornada } = req.params;

      const partidos = await Partido.obtenerPorCampeonatoYJornada(
        parseInt(campeonato_id),
        parseInt(jornada),
      );

      res.json({
        mensaje: "📅 Fixture por jornada (todos los grupos)",
        total: partidos.length,
        partidos,
      });
    } catch (error) {
      console.error("Error obteniendo fixture por jornada:", error);
      res
        .status(500)
        .json({ error: "Error interno del servidor", detalle: error.message });
    }
  },

  // controllers/partidoController.js (AGREGAR)

  obtenerPartidosPorEvento: async (req, res) => {
    try {
      const { evento_id } = req.params;

      const result = await pool.query(
        `
      SELECT p.*,
             el.nombre AS equipo_local_nombre,
             ev.nombre AS equipo_visitante_nombre,
             g.nombre_grupo,
             g.letra_grupo
      FROM partidos p
      JOIN equipos el ON p.equipo_local_id = el.id
      JOIN equipos ev ON p.equipo_visitante_id = ev.id
      LEFT JOIN grupos g ON p.grupo_id = g.id
      WHERE p.evento_id = $1
      ORDER BY p.jornada, p.fecha_partido NULLS LAST, p.hora_partido NULLS LAST
    `,
        [evento_id],
      );

      res.json({ partidos: result.rows });
    } catch (error) {
      console.error("Error obteniendo partidos por evento:", error);
      res.status(500).json({ error: "Error interno", detalle: error.message });
    }
  },

  obtenerPartidosPorEventoYJornada: async (req, res) => {
    try {
      const { evento_id, jornada } = req.params;

      const result = await pool.query(
        `
      SELECT p.*,
             el.nombre AS equipo_local_nombre,
             ev.nombre AS equipo_visitante_nombre,
             g.nombre_grupo,
             g.letra_grupo
      FROM partidos p
      JOIN equipos el ON p.equipo_local_id = el.id
      JOIN equipos ev ON p.equipo_visitante_id = ev.id
      LEFT JOIN grupos g ON p.grupo_id = g.id
      WHERE p.evento_id = $1 AND p.jornada = $2
      ORDER BY g.letra_grupo, p.hora_partido NULLS LAST, p.id
    `,
        [evento_id, jornada],
      );

      res.json({ partidos: result.rows });
    } catch (error) {
      console.error("Error obteniendo partidos por evento y jornada:", error);
      res.status(500).json({ error: "Error interno", detalle: error.message });
    }
  },

  /*generarFixtureEventoCompleto: async (req, res) => {
    try {
      const {
        evento_id,
        reemplazar,
        ida_y_vuelta,
        duracion_min,
        descanso_min,
        // si el usuario decide programar manual: false => genera sin fecha/hora/cancha
        programar_automatico = true,
      } = req.body;

      if (!evento_id)
        return res.status(400).json({ error: "evento_id es obligatorio" });

      // 1) Fechas del evento
      const evRes = await pool.query(
        `
      SELECT id,
             fecha_inicio::date AS fecha_inicio,
             fecha_fin::date AS fecha_fin
      FROM eventos
      WHERE id = $1
    `,
        [evento_id],
      );

      if (!evRes.rows.length)
        return res.status(404).json({ error: "Evento no encontrado" });

      const { fecha_inicio, fecha_fin } = evRes.rows[0];

      if (programar_automatico && (!fecha_inicio || !fecha_fin)) {
        return res.status(400).json({
          error:
            "El evento debe tener fecha_inicio y fecha_fin para programar automáticamente.",
        });
      }

      // 2) Reemplazo
      if (reemplazar === true) {
        await pool.query(`DELETE FROM partidos WHERE evento_id = $1`, [
          evento_id,
        ]);
      }

      // 3) Canchas del evento (si no hay, se puede generar sin cancha)
      const canchasRes = await pool.query(
        `
      SELECT id, nombre
      FROM canchas
      WHERE evento_id = $1
      ORDER BY id
    `,
        [evento_id],
      );

      const canchas = canchasRes.rows; // [{id,nombre},...]

      // 4) Generación en el MODEL (tú lo implementas / ajustamos)
      const partidosGenerados = await Partido.generarFixtureEventoFinDeSemana({
        evento_id: parseInt(evento_id),
        fecha_inicio,
        fecha_fin,
        ida_y_vuelta: ida_y_vuelta === true,
        duracion_min: duracion_min ? parseInt(duracion_min) : 60,
        descanso_min: descanso_min ? parseInt(descanso_min) : 10,
        canchas, // lista de canchas del evento
        programar_automatico, // si false => fecha/hora/cancha NULL
      });

      res.status(201).json({
        mensaje: "✅ Fixture por evento generado",
        evento_id: parseInt(evento_id),
        fecha_inicio: fecha_inicio || null,
        fecha_fin: fecha_fin || null,
        total_partidos: partidosGenerados.length,
        partidos: partidosGenerados,
      });
    } catch (error) {
      console.error("Error generando fixture por evento:", error);
      res
        .status(500)
        .json({ error: "Error generando fixture", detalle: error.message });
    }
  },*/

  // ===============================
  // 🎯 FIXTURE POR EVENTO (CATEGORÍA)
  // ===============================
  generarFixtureEvento: async (req, res) => {
    try {
      const {
        evento_id,
        ida_y_vuelta = false,
        reemplazar = true,
        duracion_min = 90,
        descanso_min = 10,
        // si más adelante agregas “solo entre semana / ambos”, lo pones aquí
        modo_programacion = "FIN_SEMANA", // FIN_SEMANA | MANUAL
      } = req.body;

      if (!evento_id) {
        return res.status(400).json({ error: "evento_id es obligatorio" });
      }

      // 1) Obtener el evento (y sus fechas)
      const evRes = await pool.query(
        `SELECT id, campeonato_id, nombre, fecha_inicio, fecha_fin
       FROM eventos WHERE id = $1`,
        [evento_id],
      );
      const evento = evRes.rows[0];
      if (!evento)
        return res.status(404).json({ error: "Evento no encontrado" });

      // 2) Si modo MANUAL: generar partidos SIN fecha/hora/cancha (NULL)
      if (modo_programacion === "MANUAL") {
        const creados = await Partido.generarFixtureEventoManual({
          evento_id: evento.id,
          campeonato_id: evento.campeonato_id,
          ida_y_vuelta,
          reemplazar,
        });

        return res.json({
          mensaje:
            "✅ Fixture generado en modo MANUAL (sin fecha/hora/cancha).",
          total: creados.length,
          partidos: creados,
        });
      }

      // 3) FIN_SEMANA: usa sábado/domingo y canchas del evento
      const creados = await Partido.generarFixtureEventoFinDeSemana({
        evento_id: evento.id,
        campeonato_id: evento.campeonato_id, // para fallback mientras migras
        fecha_inicio: evento.fecha_inicio,
        fecha_fin: evento.fecha_fin,
        ida_y_vuelta,
        duracion_min: parseInt(duracion_min, 10),
        descanso_min: parseInt(descanso_min, 10),
        reemplazar,
      });

      res.json({
        mensaje:
          "✅ Fixture por EVENTO (fin de semana) generado correctamente.",
        total: creados.length,
        partidos: creados,
      });
    } catch (error) {
      console.error("Error generando fixture por evento:", error);
      res.status(500).json({
        error: "Error generando fixture por evento",
        detalle: error.message,
      });
    }
  },

  // =========================
  // RESULTADOS / ESTADÍSTICAS
  // =========================
  registrarResultado: async (req, res) => {
    try {
      const { id } = req.params;
      const { resultado_local, resultado_visitante, estado } = req.body;

      if (resultado_local === undefined || resultado_visitante === undefined) {
        return res.status(400).json({
          error: "resultado_local y resultado_visitante son obligatorios",
        });
      }

      const partidoActualizado = await Partido.actualizarResultado(
        id,
        resultado_local,
        resultado_visitante,
        estado || "finalizado",
      );

      if (!partidoActualizado)
        return res.status(404).json({ error: "Partido no encontrado" });

      res.json({
        mensaje: "📊 Resultado registrado exitosamente",
        partido: partidoActualizado,
      });
    } catch (error) {
      console.error("Error registrando resultado:", error);
      res
        .status(500)
        .json({ error: "Error interno del servidor", detalle: error.message });
    }
  },

  registrarResultadoConShootouts: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        resultado_local,
        resultado_visitante,
        shootouts_local,
        shootouts_visitante,
        estado,
      } = req.body;

      if (resultado_local === undefined || resultado_visitante === undefined) {
        return res.status(400).json({
          error: "resultado_local y resultado_visitante son obligatorios",
        });
      }

      const partidoActualizado = await Partido.actualizarResultadoConShootouts(
        id,
        resultado_local,
        resultado_visitante,
        shootouts_local,
        shootouts_visitante,
        estado || "finalizado",
      );

      if (!partidoActualizado)
        return res.status(404).json({ error: "Partido no encontrado" });

      res.json({
        mensaje: "📊 Resultado con shootouts registrado exitosamente",
        partido: partidoActualizado,
      });
    } catch (error) {
      console.error("Error registrando resultado con shootouts:", error);
      res
        .status(500)
        .json({ error: "Error interno del servidor", detalle: error.message });
    }
  },

  obtenerEstadisticasEquipo: async (req, res) => {
    try {
      const { equipo_id, campeonato_id } = req.params;
      const estadisticas = await Partido.obtenerEstadisticasEquipo(
        equipo_id,
        campeonato_id,
      );

      res.json({
        mensaje: "📈 Estadísticas del equipo",
        equipo_id,
        estadisticas,
      });
    } catch (error) {
      console.error("Error obteniendo estadísticas:", error);
      res
        .status(500)
        .json({ error: "Error interno del servidor", detalle: error.message });
    }
  },

  // =========================
  // GENERACIÓN DE FIXTURE
  // =========================

  // 1) Fixture por GRUPO (usa fechas reales de campeonato si no mandas fecha_inicio)
  generarFixture: async (req, res) => {
    try {
      const {
        grupo_id,
        fecha_inicio, // opcional
        intervalo_dias, // opcional (si quieres seguir usándolo)
        ida_y_vuelta,
        reemplazar,
        hora_inicio,
        hora_fin,
        cancha_base,
        duracion_min,
        descanso_min,
      } = req.body;

      if (!grupo_id)
        return res.status(400).json({ error: "grupo_id es obligatorio" });

      // obtener campeonato y fechas reales
      const datosGrupo = await pool.query(
        `
        SELECT g.id, g.campeonato_id,
               c.fecha_inicio::date AS camp_fecha_inicio,
               c.fecha_fin::date AS camp_fecha_fin
        FROM grupos g
        JOIN campeonatos c ON c.id = g.campeonato_id
        WHERE g.id = $1
        `,
        [grupo_id],
      );

      if (datosGrupo.rows.length === 0)
        return res.status(404).json({ error: "Grupo no encontrado" });

      const camp = datosGrupo.rows[0];
      const fechaInicioFinal = fecha_inicio || camp.camp_fecha_inicio;
      const fechaFinCampeonato = camp.camp_fecha_fin;

      if (!fechaInicioFinal) {
        return res.status(400).json({
          error: "No se pudo determinar fecha_inicio (revisa el campeonato).",
        });
      }

      // reemplazar si corresponde
      const countRes = await pool.query(
        "SELECT COUNT(*)::int AS count FROM partidos WHERE grupo_id = $1",
        [grupo_id],
      );

      const yaHay = countRes.rows[0].count > 0;
      if (yaHay && !reemplazar) {
        return res.status(409).json({
          codigo: "YA_EXISTEN_PARTIDOS_GRUPO",
          mensaje: "Ya existen partidos para este grupo",
        });
      }
      if (yaHay && reemplazar) {
        await pool.query("DELETE FROM partidos WHERE grupo_id = $1", [
          grupo_id,
        ]);
      }

      // ✅ llama a tu generarFixture(params) (el que ya tienes)
      const partidosGenerados = await Partido.generarFixture({
        grupo_id: parseInt(grupo_id),
        fecha_inicio: fechaInicioFinal,
        fecha_fin: fechaFinCampeonato || null,
        intervalo_dias: parseInt(intervalo_dias || 7),
        ida_y_vuelta: ida_y_vuelta === true,
        hora_inicio: hora_inicio || "13:00",
        hora_fin: hora_fin || "18:00",
        cancha_base: cancha_base || null,
        duracion_min: duracion_min ? parseInt(duracion_min) : 90,
        descanso_min: descanso_min ? parseInt(descanso_min) : 10,
      });

      res.status(201).json({
        mensaje: "📅 Fixture generado (por grupo)",
        grupo_id: parseInt(grupo_id),
        campeonato_id: camp.campeonato_id,
        fecha_inicio_usada: fechaInicioFinal,
        fecha_fin_campeonato: fechaFinCampeonato || null,
        total_partidos: partidosGenerados.length,
        partidos: partidosGenerados,
      });
    } catch (error) {
      console.error("Error generando fixture (grupo):", error);
      res
        .status(500)
        .json({ error: "Error generando fixture", detalle: error.message });
    }
  },

  // 2) Todos contra todos (campeonato) - si usas esta modalidad
  generarFixtureTodosContraTodos: async (req, res) => {
    try {
      const {
        campeonato_id,
        fecha_inicio,
        intervalo_dias,
        ida_y_vuelta,
        reemplazar,
        hora_inicio,
        hora_fin,
        cancha_base,
        duracion_min,
        descanso_min,
      } = req.body;

      if (!campeonato_id)
        return res.status(400).json({ error: "campeonato_id es obligatorio" });

      const campRes = await pool.query(
        `SELECT fecha_inicio::date AS fecha_inicio, fecha_fin::date AS fecha_fin
         FROM campeonatos WHERE id = $1`,
        [campeonato_id],
      );
      if (campRes.rows.length === 0)
        return res.status(404).json({ error: "Campeonato no encontrado" });

      const camp = campRes.rows[0];
      const fechaInicioFinal = fecha_inicio || camp.fecha_inicio;
      const fechaFinCampeonato = camp.fecha_fin;

      // reemplazar si corresponde
      const countRes = await pool.query(
        "SELECT COUNT(*)::int AS count FROM partidos WHERE campeonato_id = $1",
        [campeonato_id],
      );
      const yaHay = countRes.rows[0].count > 0;
      if (yaHay && !reemplazar) {
        return res.status(409).json({
          codigo: "YA_EXISTEN_PARTIDOS_CAMPEONATO",
          mensaje: "Ya existen partidos para este campeonato",
        });
      }
      if (yaHay && reemplazar) {
        await pool.query("DELETE FROM partidos WHERE campeonato_id = $1", [
          campeonato_id,
        ]);
      }

      const partidosGenerados = await Partido.generarFixtureTodosContraTodos({
        campeonato_id: parseInt(campeonato_id),
        fecha_inicio: fechaInicioFinal,
        fecha_fin: fechaFinCampeonato || null,
        intervalo_dias: parseInt(intervalo_dias || 7),
        ida_y_vuelta: ida_y_vuelta === true,
        hora_inicio: hora_inicio || "13:00",
        hora_fin: hora_fin || "18:00",
        cancha_base: cancha_base || "Cancha General",
        duracion_min: duracion_min ? parseInt(duracion_min) : 90,
        descanso_min: descanso_min ? parseInt(descanso_min) : 10,
      });

      res.status(201).json({
        mensaje: "📅 Fixture todos contra todos generado",
        campeonato_id: parseInt(campeonato_id),
        fecha_inicio_usada: fechaInicioFinal,
        fecha_fin_campeonato: fechaFinCampeonato || null,
        total_partidos: partidosGenerados.length,
        partidos: partidosGenerados,
      });
    } catch (error) {
      console.error("Error generando fixture todos:", error);
      res
        .status(500)
        .json({ error: "Error generando fixture", detalle: error.message });
    }
  },

  // 3) ✅ FIXTURE COMPLETO POR JORNADAS (TODOS LOS GRUPOS) FIN DE SEMANA
  //    Este es el que te deja: Jornada 1 => A,B,C,D / Jornada 2 => A,B,C,D ...
  generarFixtureCompleto: async (req, res) => {
    try {
      const {
        campeonato_id,
        reemplazar,
        ida_y_vuelta,
        duracion_min,
        descanso_min,
        cancha_base,
      } = req.body;

      if (!campeonato_id) {
        return res.status(400).json({ error: "campeonato_id es obligatorio" });
      }

      // ✅ traer fechas reales del campeonato
      const campRes = await pool.query(
        `SELECT fecha_inicio::date AS fecha_inicio, fecha_fin::date AS fecha_fin
         FROM campeonatos WHERE id = $1`,
        [campeonato_id],
      );

      if (campRes.rows.length === 0) {
        return res.status(404).json({ error: "Campeonato no encontrado" });
      }

      const { fecha_inicio, fecha_fin } = campRes.rows[0];

      if (!fecha_inicio || !fecha_fin) {
        return res.status(400).json({
          error:
            "El campeonato debe tener fecha_inicio y fecha_fin para generar fixture por fin de semana.",
        });
      }

      // ✅ aquí se llama tu método NUEVO del model
      const partidosGenerados =
        await Partido.generarFixtureCampeonatoFinDeSemana({
          campeonato_id: parseInt(campeonato_id),
          fecha_inicio,
          fecha_fin,
          reemplazar: reemplazar === true,
          ida_y_vuelta: ida_y_vuelta === true,
          duracion_min: duracion_min ? parseInt(duracion_min) : 60,
          descanso_min: descanso_min ? parseInt(descanso_min) : 10,
          cancha_base: cancha_base || "Don Rafa",
        });

      res.status(201).json({
        mensaje: "✅ Fixture completo por jornadas (fin de semana) generado",
        campeonato_id: parseInt(campeonato_id),
        fecha_inicio,
        fecha_fin,
        total_partidos: partidosGenerados.length,
        partidos: partidosGenerados,
      });
    } catch (error) {
      console.error("Error generando fixture completo (fin semana):", error);
      res.status(500).json({
        error: "Error generando fixture completo (fin de semana)",
        detalle: error.message,
      });
    }
  },

  // 4) ✅ FIXTURE UNIFICADO POR EVENTO (VARIAS CATEGORÍAS)
  generarFixtureEvento: async (req, res) => {
    try {
      const {
        evento_id,
        reemplazar,
        ida_y_vuelta,
        duracion_min,
        descanso_min,
        canchas, // array de strings, ej: ["Don Rafa","Cancha 2"]
        modo_programacion = "FIN DE SEMANA", //FIN DE SEMANA | MANUAL
      } = req.body;

      if (!evento_id)
        return res.status(400).json({ error: "evento_id es obligatorio" });

      // traer fechas del evento (si no existen, puedes caer a las de los campeonatos)
      // 1) Obtener el evento (y sus fechas)
      const evRes = await pool.query(
        `SELECT fecha_inicio::date AS fecha_inicio, fecha_fin::date AS fecha_fin
       FROM eventos WHERE id = $1`,
        [evento_id],
      );
      if (evRes.rows.length === 0)
        return res.status(404).json({ error: "Evento no encontrado" });

      const { fecha_inicio, fecha_fin } = evRes.rows[0];
      if (!fecha_inicio || !fecha_fin) {
        return res
          .status(400)
          .json({ error: "El evento debe tener fecha_inicio y fecha_fin." });
      }

      const listaCanchas =
        Array.isArray(canchas) && canchas.length
          ? canchas
          : ["Cancha Principal"];

      const partidosGenerados = await Partido.generarFixtureEventoFinDeSemana({
        evento_id: parseInt(evento_id),
        fecha_inicio,
        fecha_fin,
        reemplazar: reemplazar === true,
        ida_y_vuelta: ida_y_vuelta === true,
        duracion_min: duracion_min ? parseInt(duracion_min) : 60,
        descanso_min: descanso_min ? parseInt(descanso_min) : 10,
        canchas: listaCanchas,
      });

      res.status(201).json({
        mensaje: "✅ Fixture unificado por evento generado",
        evento_id: parseInt(evento_id),
        fecha_inicio,
        fecha_fin,
        canchas: listaCanchas,
        total_partidos: partidosGenerados.length,
        partidos: partidosGenerados,
      });
    } catch (error) {
      console.error("Error generando fixture por evento:", error);
      res.status(500).json({
        error: "Error generando fixture por evento",
        detalle: error.message,
      });
    }
  },

  // =========================
  // EXPORTAR CSV
  // =========================
  exportarFixtureCampeonatoCSV: async (req, res) => {
    try {
      const { campeonato_id } = req.params;
      const partidos = await Partido.obtenerPorCampeonato(campeonato_id);

      if (!partidos || partidos.length === 0)
        return res.status(404).send("No hay partidos para este campeonato.");

      let csv =
        "Jornada,Fecha,Hora,Cancha,Grupo,Equipo Local,Equipo Visitante\n";

      partidos.forEach((p) => {
        const fila = [
          p.jornada || "",
          p.fecha_partido || "",
          (p.hora_partido || "").toString().substring(0, 5),
          p.cancha || "",
          (p.nombre_grupo || p.letra_grupo || "").toString().replace(/,/g, " "),
          (p.equipo_local_nombre || "").replace(/,/g, " "),
          (p.equipo_visitante_nombre || "").replace(/,/g, " "),
        ];
        csv += fila.join(",") + "\n";
      });

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="fixture_campeonato_${campeonato_id}.csv"`,
      );
      res.send(csv);
    } catch (error) {
      console.error("Error exportando fixture campeonato:", error);
      res.status(500).send("Error exportando fixture.");
    }
  },

  exportarFixtureGrupoCSV: async (req, res) => {
    try {
      const { grupo_id } = req.params;
      const partidos = await Partido.obtenerPorGrupo(grupo_id);

      if (!partidos || partidos.length === 0)
        return res.status(404).send("No hay partidos para este grupo.");

      let csv =
        "Jornada,Fecha,Hora,Cancha,Grupo,Equipo Local,Equipo Visitante\n";

      partidos.forEach((p) => {
        const fila = [
          p.jornada || "",
          p.fecha_partido || "",
          (p.hora_partido || "").toString().substring(0, 5),
          p.cancha || "",
          (p.nombre_grupo || "").toString().replace(/,/g, " "),
          (p.equipo_local_nombre || "").replace(/,/g, " "),
          (p.equipo_visitante_nombre || "").replace(/,/g, " "),
        ];
        csv += fila.join(",") + "\n";
      });

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="fixture_grupo_${grupo_id}.csv"`,
      );
      res.send(csv);
    } catch (error) {
      console.error("Error exportando fixture grupo:", error);
      res.status(500).send("Error exportando fixture.");
    }
  },
};

module.exports = partidoController;
