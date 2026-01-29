const Grupo = require("../models/Grupo");
const Equipo = require("../models/Equipo");

const sorteoController = {
  // SORTEO ALEATORIO PURO
  sorteoAleatorio: async (req, res) => {
    try {
      const { campeonato_id, cantidad_grupos } = req.body;

      if (!campeonato_id || !cantidad_grupos) {
        return res.status(400).json({
          error: "campeonato_id y cantidad_grupos son obligatorios",
        });
      }

      // Obtener todos los equipos del campeonato
      const equipos = await Equipo.obtenerPorCampeonato(campeonato_id);

      if (equipos.length === 0) {
        return res.status(400).json({
          error: "No hay equipos en este campeonato",
        });
      }

      // Verificar si ya existen grupos
      const gruposExistentes = await Grupo.obtenerPorCampeonato(campeonato_id);
      if (gruposExistentes.length > 0) {
        return res.status(400).json({
          error: "Ya existen grupos para este campeonato. Elimínelos primero.",
        });
      }

      // Crear grupos
      const gruposCreados = await Grupo.crearGrupos(
        campeonato_id,
        cantidad_grupos
      );

      // Mezclar equipos aleatoriamente
      const equiposMezclados = mezclarArray([...equipos]);

      // Distribuir equitativamente
      const asignaciones = [];
      for (let i = 0; i < equiposMezclados.length; i++) {
        const grupoIndex = i % cantidad_grupos;
        const grupo = gruposCreados[grupoIndex];

        const asignacion = await Grupo.asignarEquipo(
          grupo.id,
          equiposMezclados[i].id,
          i + 1
        );
        asignaciones.push(asignacion);
      }

      // Obtener resultado final
      const resultadoFinal = await Grupo.obtenerConEquipos(campeonato_id);

      res.status(201).json({
        mensaje: `🎲 Sorteo aleatorio completado exitosamente`,
        grupos_creados: gruposCreados.length,
        equipos_asignados: asignaciones.length,
        grupos: resultadoFinal,
      });
    } catch (error) {
      console.error("Error en sorteo aleatorio:", error);
      res.status(500).json({
        error: "Error en el sorteo",
        detalle: error.message,
      });
    }
  },

  // SORTEO CON CABEZA DE SERIE
  sorteoConCabezaDeSerie: async (req, res) => {
    try {
      const { campeonato_id, cantidad_grupos } = req.body;

      if (!campeonato_id || !cantidad_grupos) {
        return res.status(400).json({
          error: "campeonato_id y cantidad_grupos son obligatorios",
        });
      }

      // Obtener cabezas de serie y equipos normales
      const cabezasDeSerie = await Equipo.obtenerCabezasDeSerie(campeonato_id);
      const equiposNormales = await Equipo.obtenerNoCabezasDeSerie(
        campeonato_id
      );

      if (cabezasDeSerie.length === 0) {
        return res.status(400).json({
          error: "No hay cabezas de serie designadas para este campeonato",
        });
      }

      if (cabezasDeSerie.length > cantidad_grupos) {
        return res.status(400).json({
          error: `Hay ${cabezasDeSerie.length} cabezas de serie pero solo ${cantidad_grupos} grupos`,
        });
      }

      // Verificar si ya existen grupos
      const gruposExistentes = await Grupo.obtenerPorCampeonato(campeonato_id);
      if (gruposExistentes.length > 0) {
        return res.status(400).json({
          error: "Ya existen grupos para este campeonato. Elimínelos primero.",
        });
      }

      // Crear grupos
      const gruposCreados = await Grupo.crearGrupos(
        campeonato_id,
        cantidad_grupos
      );

      const asignaciones = [];
      let ordenSorteo = 1;

      // 1. Asignar cabezas de serie a grupos diferentes
      for (let i = 0; i < cabezasDeSerie.length; i++) {
        const grupo = gruposCreados[i];
        const asignacion = await Grupo.asignarEquipo(
          grupo.id,
          cabezasDeSerie[i].id,
          ordenSorteo
        );
        asignaciones.push(asignacion);
        ordenSorteo++;
      }

      // 2. Mezclar equipos normales
      const equiposNormalesMezclados = mezclarArray([...equiposNormales]);

      // 3. Distribuir equipos normales equitativamente
      for (let i = 0; i < equiposNormalesMezclados.length; i++) {
        const grupoIndex = i % cantidad_grupos;
        const grupo = gruposCreados[grupoIndex];

        const asignacion = await Grupo.asignarEquipo(
          grupo.id,
          equiposNormalesMezclados[i].id,
          ordenSorteo
        );
        asignaciones.push(asignacion);
        ordenSorteo++;
      }

      // Obtener resultado final
      const resultadoFinal = await Grupo.obtenerConEquipos(campeonato_id);

      res.status(201).json({
        mensaje: `👑 Sorteo con cabeza de serie completado exitosamente`,
        cabezas_de_serie: cabezasDeSerie.length,
        equipos_normales: equiposNormales.length,
        grupos_creados: gruposCreados.length,
        grupos: resultadoFinal,
      });
    } catch (error) {
      console.error("Error en sorteo con cabeza de serie:", error);
      res.status(500).json({
        error: "Error en el sorteo",
        detalle: error.message,
      });
    }
  },

  // PREPARAR DATOS PARA RULETA
  prepararRuleta: async (req, res) => {
    try {
      const { campeonato_id } = req.params;

      // Obtener equipos sin asignar
      const equipos = await Equipo.obtenerPorCampeonato(campeonato_id);
      const grupos = await Grupo.obtenerPorCampeonato(campeonato_id);

      // Filtrar equipos que ya están en grupos
      const equiposEnGrupos = [];
      for (const grupo of grupos) {
        const equiposGrupo = await Grupo.obtenerEquiposDelGrupo(grupo.id);
        equiposEnGrupos.push(...equiposGrupo.map((e) => e.id));
      }

      const equiposSinAsignar = equipos.filter(
        (e) => !equiposEnGrupos.includes(e.id)
      );

      res.json({
        mensaje: "🎡 Datos preparados para ruleta",
        equipos_sin_asignar: equiposSinAsignar,
        grupos_disponibles: grupos,
        total_equipos_sin_asignar: equiposSinAsignar.length,
        total_grupos: grupos.length,
      });
    } catch (error) {
      console.error("Error preparando ruleta:", error);
      res.status(500).json({
        error: "Error preparando datos para ruleta",
        detalle: error.message,
      });
    }
  },

  // SORTEO POR RULETA - ASIGNACIÓN INDIVIDUAL
  sorteoPorRuleta: async (req, res) => {
    try {
      const { campeonato_id, equipo_id, grupo_id } = req.body;

      // Validaciones
      if (!campeonato_id || !equipo_id || !grupo_id) {
        return res.status(400).json({
          error: "campeonato_id, equipo_id y grupo_id son obligatorios",
        });
      }

      // Verificar que el equipo no esté asignado
      const equiposAsignados = await Grupo.obtenerTodosEquiposAsignados(
        campeonato_id
      );
      if (equiposAsignados.includes(parseInt(equipo_id))) {
        return res.status(400).json({
          error: "Este equipo ya está asignado a un grupo",
        });
      }

      // Obtener próximo orden de sorteo
      const maxOrden = await Grupo.obtenerMaxOrdenSorteo(campeonato_id);
      const nuevoOrden = (maxOrden || 0) + 1;

      // Asignar equipo al grupo
      const asignacion = await Grupo.asignarEquipo(
        grupo_id,
        equipo_id,
        nuevoOrden
      );

      res.json({
        mensaje: "✅ Equipo asignado exitosamente por ruleta",
        asignacion: asignacion,
        orden_sorteo: nuevoOrden,
      });
    } catch (error) {
      console.error("Error en sorteo por ruleta:", error);
      res.status(500).json({
        error: "Error en asignación por ruleta",
        detalle: error.message,
      });
    }
  },

  // OBTENER ESTADO ACTUAL DEL SORTEO
  obtenerEstadoSorteo: async (req, res) => {
    try {
      const { campeonato_id } = req.params;

      const grupos = await Grupo.obtenerConEquipos(campeonato_id);
      const todosEquipos = await Equipo.obtenerPorCampeonato(campeonato_id);

      // Calcular equipos sin asignar
      const equiposAsignados = grupos.flatMap((grupo) =>
        grupo.equipos.map((e) => e.id)
      );
      const equiposSinAsignar = todosEquipos.filter(
        (equipo) => !equiposAsignados.includes(equipo.id)
      );

      res.json({
        grupos: grupos,
        equipos_sin_asignar: equiposSinAsignar,
        total_equipos: todosEquipos.length,
        equipos_asignados: equiposAsignados.length,
        progreso: `${equiposAsignados.length}/${todosEquipos.length}`,
      });
    } catch (error) {
      console.error("Error obteniendo estado:", error);
      res.status(500).json({
        error: "Error obteniendo estado del sorteo",
        detalle: error.message,
      });
    }
  },
};

// Función auxiliar para mezclar array (Fisher-Yates)
function mezclarArray(array) {
  const nuevoArray = [...array];
  for (let i = nuevoArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nuevoArray[i], nuevoArray[j]] = [nuevoArray[j], nuevoArray[i]];
  }
  return nuevoArray;
}

module.exports = sorteoController;
