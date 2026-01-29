const Partido = require('../models/Partido');
const pool = require('../config/database');

const tablaController = {

    // GENERAR tabla de posición por grupo
    generarTablaGrupo: async (req, res) => {
        try {
            const { grupo_id } = req.params;

            // Obtener información del grupo y campeonato
            const grupoQuery = `
                SELECT g.*, c.sistema_puntuacion, c.tipo_futbol, c.nombre as nombre_campeonato
                FROM grupos g 
                JOIN campeonatos c ON g.campeonato_id = c.id 
                WHERE g.id = $1
            `;
            const grupoResult = await pool.query(grupoQuery, [grupo_id]);
            
            if (grupoResult.rows.length === 0) {
                return res.status(404).json({ error: 'Grupo no encontrado' });
            }

            const grupo = grupoResult.rows[0];
            const sistemaPuntuacion = grupo.sistema_puntuacion || 'tradicional';

            // Obtener equipos del grupo
            const equiposQuery = `
                SELECT e.* 
                FROM equipos e 
                JOIN grupo_equipos ge ON e.id = ge.equipo_id 
                WHERE ge.grupo_id = $1
            `;
            const equiposResult = await pool.query(equiposQuery, [grupo_id]);
            const equipos = equiposResult.rows;

            // Calcular estadísticas para cada equipo
            const tabla = [];
            for (const equipo of equipos) {
                const estadisticas = await Partido.obtenerEstadisticasEquipoAvanzado(equipo.id, grupo.campeonato_id);
                const puntos = await calcularPuntosEquipo(equipo.id, grupo_id, sistemaPuntuacion);
                
                // Calcular partidos ganados totales (tiempo + shootouts)
                const partidosGanados = (estadisticas.victorias_tiempo || 0) + (estadisticas.victorias_shootouts || 0);
                const partidosPerdidos = (estadisticas.derrotas_tiempo || 0) + (estadisticas.derrotas_shootouts || 0);
                const partidosEmpatados = (estadisticas.empates || 0) - (estadisticas.victorias_shootouts || 0) - (estadisticas.derrotas_shootouts || 0);

                tabla.push({
                    posicion: 0, // Se asignará después del ordenamiento
                    equipo: {
                        id: equipo.id,
                        nombre: equipo.nombre,
                        director_tecnico: equipo.director_tecnico,
                        color_equipo: equipo.color_equipo
                    },
                    estadisticas: {
                        partidos_jugados: estadisticas.partidos_jugados || 0,
                        partidos_ganados: partidosGanados,
                        partidos_empatados: partidosEmpatados > 0 ? partidosEmpatados : 0,
                        partidos_perdidos: partidosPerdidos,
                        goles_favor: estadisticas.goles_favor || 0,
                        goles_contra: estadisticas.goles_contra || 0,
                        diferencia_goles: (estadisticas.goles_favor || 0) - (estadisticas.goles_contra || 0),
                        victorias_tiempo: estadisticas.victorias_tiempo || 0,
                        victorias_shootouts: estadisticas.victorias_shootouts || 0,
                        derrotas_tiempo: estadisticas.derrotas_tiempo || 0,
                        derrotas_shootouts: estadisticas.derrotas_shootouts || 0
                    },
                    puntos: puntos,
                    diferencia_goles: (estadisticas.goles_favor || 0) - (estadisticas.goles_contra || 0)
                });
            }

            // Ordenar tabla
            tabla.sort((a, b) => {
                // 1. Por puntos (descendente)
                if (b.puntos !== a.puntos) return b.puntos - a.puntos;
                // 2. Por diferencia de goles (descendente)
                if (b.diferencia_goles !== a.diferencia_goles) return b.diferencia_goles - a.diferencia_goles;
                // 3. Por goles a favor (descendente)
                if ((b.estadisticas.goles_favor || 0) !== (a.estadisticas.goles_favor || 0)) 
                    return (b.estadisticas.goles_favor || 0) - (a.estadisticas.goles_favor || 0);
                // 4. Por menos partidos perdidos
                return (a.estadisticas.partidos_perdidos || 0) - (b.estadisticas.partidos_perdidos || 0);
            });

            // Asignar posiciones
            tabla.forEach((equipo, index) => {
                equipo.posicion = index + 1;
            });

            res.json({
                mensaje: `📊 Tabla de posición - ${grupo.nombre_grupo}`,
                grupo: {
                    id: grupo.id,
                    nombre_grupo: grupo.nombre_grupo,
                    letra_grupo: grupo.letra_grupo,
                    campeonato: grupo.nombre_campeonato
                },
                sistema_puntuacion: sistemaPuntuacion,
                tipo_futbol: grupo.tipo_futbol,
                total_equipos: tabla.length,
                tabla: tabla
            });

        } catch (error) {
            console.error('Error generando tabla:', error);
            res.status(500).json({
                error: 'Error generando tabla de posición',
                detalle: error.message
            });
        }
    },

    // GENERAR tabla completa del campeonato (todas los grupos)
    generarTablaCompleta: async (req, res) => {
        try {
            const { campeonato_id } = req.params;

            // Obtener grupos del campeonato
            const gruposQuery = 'SELECT * FROM grupos WHERE campeonato_id = $1 ORDER BY letra_grupo';
            const gruposResult = await pool.query(gruposQuery, [campeonato_id]);
            
            if (gruposResult.rows.length === 0) {
                return res.status(404).json({ error: 'No hay grupos en este campeonato' });
            }

            const tablasGrupos = [];
            
            // Generar tabla para cada grupo
            for (const grupo of gruposResult.rows) {
                try {
                    // Llamar a la función interna para generar tabla del grupo
                    const tablaGrupo = await generarTablaGrupoInterna(grupo.id);
                    tablasGrupos.push(tablaGrupo);
                } catch (error) {
                    tablasGrupos.push({
                        grupo: grupo,
                        error: error.message
                    });
                }
            }

            res.json({
                mensaje: `🏆 Tablas de posición completas del campeonato`,
                total_grupos: tablasGrupos.length,
                grupos: tablasGrupos
            });

        } catch (error) {
            console.error('Error generando tabla completa:', error);
            res.status(500).json({
                error: 'Error generando tablas de posición',
                detalle: error.message
            });
        }
    }
};

// Función auxiliar para calcular puntos de equipo
async function calcularPuntosEquipo(equipo_id, grupo_id, sistema_puntuacion) {
    const query = `
        SELECT p.*, 
               c.sistema_puntuacion
        FROM partidos p
        JOIN campeonatos c ON p.campeonato_id = c.id
        WHERE p.grupo_id = $1 AND (p.equipo_local_id = $2 OR p.equipo_visitante_id = $2) AND p.estado = 'finalizado'
    `;
    const result = await pool.query(query, [grupo_id, equipo_id]);
    
    let puntosTotales = 0;
    
    for (const partido of result.rows) {
        const esLocal = partido.equipo_local_id === equipo_id;
        const { puntosLocal, puntosVisitante } = Partido.calcularPuntos(
            sistema_puntuacion,
            partido.resultado_local,
            partido.resultado_visitante,
            partido.resultado_local_shootouts,
            partido.resultado_visitante_shootouts,
            partido.shootouts
        );
        
        puntosTotales += esLocal ? puntosLocal : puntosVisitante;
    }
    
    return puntosTotales;
}

// Función auxiliar para generar tabla de grupo (uso interno)
async function generarTablaGrupoInterna(grupo_id) {
    const grupoQuery = `
        SELECT g.*, c.sistema_puntuacion, c.tipo_futbol, c.nombre as nombre_campeonato
        FROM grupos g 
        JOIN campeonatos c ON g.campeonato_id = c.id 
        WHERE g.id = $1
    `;
    const grupoResult = await pool.query(grupoQuery, [grupo_id]);
    
    if (grupoResult.rows.length === 0) {
        throw new Error('Grupo no encontrado');
    }

    const grupo = grupoResult.rows[0];
    const sistemaPuntuacion = grupo.sistema_puntuacion || 'tradicional';

    // Obtener equipos del grupo
    const equiposQuery = `
        SELECT e.* 
        FROM equipos e 
        JOIN grupo_equipos ge ON e.id = ge.equipo_id 
        WHERE ge.grupo_id = $1
    `;
    const equiposResult = await pool.query(equiposQuery, [grupo_id]);
    const equipos = equiposResult.rows;

    // Calcular estadísticas para cada equipo
    const tabla = [];
    for (const equipo of equipos) {
        const estadisticas = await Partido.obtenerEstadisticasEquipoAvanzado(equipo.id, grupo.campeonato_id);
        const puntos = await calcularPuntosEquipo(equipo.id, grupo_id, sistemaPuntuacion);
        
        // Calcular partidos ganados totales (tiempo + shootouts)
        const partidosGanados = (estadisticas.victorias_tiempo || 0) + (estadisticas.victorias_shootouts || 0);
        const partidosPerdidos = (estadisticas.derrotas_tiempo || 0) + (estadisticas.derrotas_shootouts || 0);
        const partidosEmpatados = (estadisticas.empates || 0) - (estadisticas.victorias_shootouts || 0) - (estadisticas.derrotas_shootouts || 0);

        tabla.push({
            posicion: 0,
            equipo: {
                id: equipo.id,
                nombre: equipo.nombre,
                director_tecnico: equipo.director_tecnico
            },
            estadisticas: {
                partidos_jugados: estadisticas.partidos_jugados || 0,
                partidos_ganados: partidosGanados,
                partidos_empatados: partidosEmpatados > 0 ? partidosEmpatados : 0,
                partidos_perdidos: partidosPerdidos,
                goles_favor: estadisticas.goles_favor || 0,
                goles_contra: estadisticas.goles_contra || 0,
                diferencia_goles: (estadisticas.goles_favor || 0) - (estadisticas.goles_contra || 0)
            },
            puntos: puntos
        });
    }

    // Ordenar tabla
    tabla.sort((a, b) => {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        if (b.estadisticas.diferencia_goles !== a.estadisticas.diferencia_goles) 
            return b.estadisticas.diferencia_goles - a.estadisticas.diferencia_goles;
        return (b.estadisticas.goles_favor || 0) - (a.estadisticas.goles_favor || 0);
    });

    // Asignar posiciones
    tabla.forEach((equipo, index) => {
        equipo.posicion = index + 1;
    });

    return {
        grupo: {
            id: grupo.id,
            nombre_grupo: grupo.nombre_grupo,
            letra_grupo: grupo.letra_grupo
        },
        sistema_puntuacion: sistemaPuntuacion,
        tipo_futbol: grupo.tipo_futbol,
        tabla: tabla
    };
}

module.exports = tablaController;