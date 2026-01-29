const Grupo = require('../models/Grupo');

const grupoController = {

    // CREAR - Nuevos grupos para campeonato
    crearGrupos: async (req, res) => {
        try {
            const { campeonato_id, cantidad_grupos, nombres_grupos } = req.body;

            // Validaciones básicas
            if (!campeonato_id || !cantidad_grupos) {
                return res.status(400).json({
                    error: 'campeonato_id y cantidad_grupos son obligatorios'
                });
            }

            if (cantidad_grupos < 2 || cantidad_grupos > 8) {
                return res.status(400).json({
                    error: 'La cantidad de grupos debe estar entre 2 y 8'
                });
            }

            const gruposCreados = await Grupo.crearGrupos(campeonato_id, cantidad_grupos, nombres_grupos);

            res.status(201).json({
                mensaje: `🎯 ${cantidad_grupos} grupos creados exitosamente`,
                grupos: gruposCreados
            });

        } catch (error) {
            console.error('Error creando grupos:', error);
            
            if (error.message.includes('Campeonato no encontrado')) {
                return res.status(404).json({
                    error: error.message
                });
            }

            res.status(500).json({
                error: 'Error creando grupos',
                detalle: error.message
            });
        }
    },

    // LEER - Obtener grupos por campeonato
    obtenerGruposPorCampeonato: async (req, res) => {
        try {
            const { campeonato_id } = req.params;
            
            const grupos = await Grupo.obtenerPorCampeonato(campeonato_id);
            
            res.json({
                mensaje: `📊 Grupos del campeonato`,
                total: grupos.length,
                grupos: grupos
            });

        } catch (error) {
            console.error('Error obteniendo grupos:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                detalle: error.message
            });
        }
    },

    // LEER - Obtener grupo específico con detalles
    obtenerGrupo: async (req, res) => {
        try {
            const { id } = req.params;
            const grupo = await Grupo.obtenerPorId(id);

            if (!grupo) {
                return res.status(404).json({
                    error: 'Grupo no encontrado'
                });
            }

            // Obtener equipos del grupo
            const equipos = await Grupo.obtenerEquiposDelGrupo(id);

            res.json({
                mensaje: '📖 Detalles del grupo',
                grupo: grupo,
                equipos: equipos
            });

        } catch (error) {
            console.error('Error obteniendo grupo:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                detalle: error.message
            });
        }
    },

    // LEER - Obtener grupos con equipos completos
    obtenerGruposConEquipos: async (req, res) => {
        try {
            const { campeonato_id } = req.params;
            
            const grupos = await Grupo.obtenerConEquipos(campeonato_id);
            
            res.json({
                mensaje: `🏆 Grupos con equipos del campeonato`,
                total: grupos.length,
                grupos: grupos
            });

        } catch (error) {
            console.error('Error obteniendo grupos con equipos:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                detalle: error.message
            });
        }
    },

    // ACTUALIZAR - Modificar grupo
    actualizarGrupo: async (req, res) => {
        try {
            const { id } = req.params;
            const datos = req.body;

            const grupoActualizado = await Grupo.actualizar(id, datos);

            if (!grupoActualizado) {
                return res.status(404).json({
                    error: 'Grupo no encontrado'
                });
            }

            res.json({
                mensaje: '✅ Grupo actualizado exitosamente',
                grupo: grupoActualizado
            });

        } catch (error) {
            console.error('Error actualizando grupo:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                detalle: error.message
            });
        }
    },

    // ELIMINAR - Borrar grupo
    eliminarGrupo: async (req, res) => {
        try {
            const { id } = req.params;
            const grupoEliminado = await Grupo.eliminar(id);

            if (!grupoEliminado) {
                return res.status(404).json({
                    error: 'Grupo no encontrado'
                });
            }

            res.json({
                mensaje: '🗑️ Grupo eliminado exitosamente',
                grupo: grupoEliminado
            });

        } catch (error) {
            console.error('Error eliminando grupo:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                detalle: error.message
            });
        }
    },

    // ASIGNAR - Asignar equipo a grupo
    asignarEquipoAGrupo: async (req, res) => {
        try {
            const { grupo_id, equipo_id, orden_sorteo } = req.body;

            if (!grupo_id || !equipo_id) {
                return res.status(400).json({
                    error: 'grupo_id y equipo_id son obligatorios'
                });
            }

            const asignacion = await Grupo.asignarEquipo(grupo_id, equipo_id, orden_sorteo);

            res.status(201).json({
                mensaje: '⚽ Equipo asignado al grupo exitosamente',
                asignacion: asignacion
            });

        } catch (error) {
            console.error('Error asignando equipo a grupo:', error);
            
            if (error.message.includes('ya está asignado')) {
                return res.status(400).json({
                    error: error.message
                });
            }

            res.status(500).json({
                error: 'Error asignando equipo a grupo',
                detalle: error.message
            });
        }
    },

    // REMOVER - Remover equipo de grupo
    removerEquipoDeGrupo: async (req, res) => {
        try {
            const { grupo_id, equipo_id } = req.body;

            if (!grupo_id || !equipo_id) {
                return res.status(400).json({
                    error: 'grupo_id y equipo_id son obligatorios'
                });
            }

            const eliminacion = await Grupo.removerEquipo(grupo_id, equipo_id);

            if (!eliminacion) {
                return res.status(404).json({
                    error: 'Asignación no encontrada'
                });
            }

            res.json({
                mensaje: '🔁 Equipo removido del grupo exitosamente',
                eliminacion: eliminacion
            });

        } catch (error) {
            console.error('Error removiendo equipo de grupo:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                detalle: error.message
            });
        }
    }
};

module.exports = grupoController;