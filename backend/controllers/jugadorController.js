const Jugador = require('../models/Jugador');

const jugadorController = {

    // CREAR - Nuevo jugador
    crearJugador: async (req, res) => {
        try {
            const { equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan } = req.body;

            // Validaciones básicas
            if (!equipo_id || !nombre || !apellido || !cedidentidad) {
                return res.status(400).json({
                    error: 'equipo_id, nombre, apellido y Cedula de Identidad son obligatorios'
                });
            }

            const nuevoJugador = await Jugador.crear(
                equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan
            );

            res.status(201).json({
                mensaje: '👤 Jugador creado exitosamente',
                jugador: nuevoJugador
            });

        } catch (error) {
            console.error('Error creando jugador:', error);
            
            // Manejo específico de errores
            if (error.message.includes('Límite') || 
                error.message.includes('Equipo no encontrado') ||
                error.message.includes('Cedula ya está registrado') ||
                error.message.includes('número de camiseta')) {
                return res.status(400).json({
                    error: error.message
                });
            }

            res.status(500).json({
                error: 'Error creando jugador',
                detalle: error.message
            });
        }
    },

    // LEER - Obtener jugadores por equipo
    obtenerJugadoresPorEquipo: async (req, res) => {
        try {
            const { equipo_id } = req.params;
            
            const jugadores = await Jugador.obtenerPorEquipo(equipo_id);
            
            res.json({
                mensaje: `👥 Jugadores del equipo ${equipo_id}`,
                total: jugadores.length,
                jugadores: jugadores
            });

        } catch (error) {
            console.error('Error obteniendo jugadores:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                detalle: error.message
            });
        }
    },

    // LEER - Obtener todos los jugadores
    obtenerTodosLosJugadores: async (req, res) => {
        try {
            const jugadores = await Jugador.obtenerTodos();
            
            res.json({
                mensaje: '👥 Todos los jugadores del sistema',
                total: jugadores.length,
                jugadores: jugadores
            });

        } catch (error) {
            console.error('Error obteniendo jugadores:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                detalle: error.message
            });
        }
    },

    // LEER - Obtener jugador específico
    obtenerJugador: async (req, res) => {
        try {
            const { id } = req.params;
            const jugador = await Jugador.obtenerPorId(id);

            if (!jugador) {
                return res.status(404).json({
                    error: 'Jugador no encontrado'
                });
            }

            res.json({
                mensaje: '📖 Detalles del jugador',
                jugador: jugador
            });

        } catch (error) {
            console.error('Error obteniendo jugador:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                detalle: error.message
            });
        }
    },

    // ACTUALIZAR - Modificar jugador
    actualizarJugador: async (req, res) => {
        try {
            const { id } = req.params;
            const datos = req.body;

            const jugadorActualizado = await Jugador.actualizar(id, datos);

            if (!jugadorActualizado) {
                return res.status(404).json({
                    error: 'Jugador no encontrado'
                });
            }

            res.json({
                mensaje: '✅ Jugador actualizado exitosamente',
                jugador: jugadorActualizado
            });

        } catch (error) {
            console.error('Error actualizando jugador:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                detalle: error.message
            });
        }
    },

    // ELIMINAR - Borrar jugador
    eliminarJugador: async (req, res) => {
        try {
            const { id } = req.params;
            const jugadorEliminado = await Jugador.eliminar(id);

            if (!jugadorEliminado) {
                return res.status(404).json({
                    error: 'Jugador no encontrado'
                });
            }

            res.json({
                mensaje: '🗑️ Jugador eliminado exitosamente',
                jugador: jugadorEliminado
            });

        } catch (error) {
            console.error('Error eliminando jugador:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                detalle: error.message
            });
        }
    },

    // MÉTODO ESPECIAL - Designar capitán
    designarCapitan: async (req, res) => {
        try {
            const { jugador_id, equipo_id } = req.body;

            if (!jugador_id || !equipo_id) {
                return res.status(400).json({
                    error: 'jugador_id y equipo_id son obligatorios'
                });
            }

            const capitan = await Jugador.designarCapitan(jugador_id, equipo_id);

            if (!capitan) {
                return res.status(404).json({
                    error: 'Jugador no encontrado'
                });
            }

            res.json({
                mensaje: '⭐ Capitán designado exitosamente',
                jugador: capitan
            });

        } catch (error) {
            console.error('Error designando capitán:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                detalle: error.message
            });
        }
    }
};

module.exports = jugadorController;