const pool = require('../config/database');

class Grupo {
    
    // CREATE - Crear grupos para un campeonato
    static async crearGrupos(campeonato_id, cantidad_grupos, nombres_grupos = null) {
        // Verificar que el campeonato existe
        const campeonatoQuery = 'SELECT * FROM campeonatos WHERE id = $1';
        const campeonatoResult = await pool.query(campeonatoQuery, [campeonato_id]);
        
        if (campeonatoResult.rows.length === 0) {
            throw new Error('Campeonato no encontrado');
        }

        const gruposCreados = [];
        const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

        // Crear cada grupo
        for (let i = 0; i < cantidad_grupos; i++) {
            const letra_grupo = letras[i];
            const nombre_grupo = nombres_grupos ? nombres_grupos[i] : `Grupo ${letra_grupo}`;

            const query = `
                INSERT INTO grupos (campeonato_id, nombre_grupo, letra_grupo) 
                VALUES ($1, $2, $3) 
                RETURNING *
            `;
            const values = [campeonato_id, nombre_grupo, letra_grupo];
            
            const result = await pool.query(query, values);
            gruposCreados.push(result.rows[0]);
        }

        return gruposCreados;
    }

    // READ - Obtener grupos por campeonato
    static async obtenerPorCampeonato(campeonato_id) {
        const query = `
            SELECT g.*, c.nombre as nombre_campeonato,
                   COUNT(ge.equipo_id) as cantidad_equipos
            FROM grupos g 
            JOIN campeonatos c ON g.campeonato_id = c.id 
            LEFT JOIN grupo_equipos ge ON g.id = ge.grupo_id
            WHERE g.campeonato_id = $1 
            GROUP BY g.id, c.nombre
            ORDER BY g.letra_grupo
        `;
        const result = await pool.query(query, [campeonato_id]);
        return result.rows;
    }

    // READ - Obtener grupo por ID con detalles completos
    static async obtenerPorId(id) {
        const query = `
            SELECT g.*, c.nombre as nombre_campeonato,
                   COUNT(ge.equipo_id) as cantidad_equipos
            FROM grupos g 
            JOIN campeonatos c ON g.campeonato_id = c.id 
            LEFT JOIN grupo_equipos ge ON g.id = ge.grupo_id
            WHERE g.id = $1 
            GROUP BY g.id, c.nombre
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    // READ - Obtener equipos de un grupo específico
    static async obtenerEquiposDelGrupo(grupo_id) {
        const query = `
            SELECT e.*, ge.orden_sorteo, ge.fecha_sorteo
            FROM equipos e 
            JOIN grupo_equipos ge ON e.id = ge.equipo_id 
            WHERE ge.grupo_id = $1 
            ORDER BY ge.orden_sorteo, e.nombre
        `;
        const result = await pool.query(query, [grupo_id]);
        return result.rows;
    }

    // UPDATE - Actualizar grupo
    static async actualizar(id, datos) {
        const campos = [];
        const valores = [];
        let contador = 1;

        for (const [key, value] of Object.entries(datos)) {
            if (value !== undefined) {
                campos.push(`${key} = $${contador}`);
                valores.push(value);
                contador++;
            }
        }

        if (campos.length === 0) {
            throw new Error('No hay campos para actualizar');
        }

        valores.push(id);
        const query = `
            UPDATE grupos 
            SET ${campos.join(', ')} 
            WHERE id = $${contador} 
            RETURNING *
        `;

        const result = await pool.query(query, valores);
        return result.rows[0];
    }

    // DELETE - Eliminar grupo y sus asignaciones
    static async eliminar(id) {
        // Primero eliminar las asignaciones de equipos
        await pool.query('DELETE FROM grupo_equipos WHERE grupo_id = $1', [id]);
        
        // Luego eliminar el grupo
        const query = 'DELETE FROM grupos WHERE id = $1 RETURNING *';
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    // ASIGNAR equipo a grupo
    static async asignarEquipo(grupo_id, equipo_id, orden_sorteo = null) {
        // Verificar que el equipo no esté ya en otro grupo del mismo campeonato
        const verificarQuery = `
            SELECT ge.grupo_id, g.nombre_grupo 
            FROM grupo_equipos ge 
            JOIN grupos g ON ge.grupo_id = g.id 
            WHERE ge.equipo_id = $1 AND g.campeonato_id = (
                SELECT campeonato_id FROM grupos WHERE id = $2
            )
        `;
        const verificarResult = await pool.query(verificarQuery, [equipo_id, grupo_id]);
        
        if (verificarResult.rows.length > 0) {
            throw new Error(`El equipo ya está asignado al ${verificarResult.rows[0].nombre_grupo}`);
        }

        const query = `
            INSERT INTO grupo_equipos (grupo_id, equipo_id, orden_sorteo) 
            VALUES ($1, $2, $3) 
            RETURNING *
        `;
        const values = [grupo_id, equipo_id, orden_sorteo];
        
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    // REMOVER equipo de grupo
    static async removerEquipo(grupo_id, equipo_id) {
        const query = 'DELETE FROM grupo_equipos WHERE grupo_id = $1 AND equipo_id = $2 RETURNING *';
        const result = await pool.query(query, [grupo_id, equipo_id]);
        return result.rows[0];
    }

    // OBTENER grupos con equipos completos (para sorteos)
    static async obtenerConEquipos(campeonato_id) {
        const query = `
            SELECT g.*, 
                   JSON_AGG(
                       JSON_BUILD_OBJECT(
                           'id', e.id,
                           'nombre', e.nombre,
                           'logo_url', e.logo_url,
                           'cabeza_serie', e.cabeza_serie,
                           'orden_sorteo', ge.orden_sorteo
                       ) ORDER BY ge.orden_sorteo
                   ) as equipos
            FROM grupos g 
            LEFT JOIN grupo_equipos ge ON g.id = ge.grupo_id 
            LEFT JOIN equipos e ON ge.equipo_id = e.id 
            WHERE g.campeonato_id = $1 
            GROUP BY g.id 
            ORDER BY g.letra_grupo
        `;
        const result = await pool.query(query, [campeonato_id]);
        return result.rows;
    }
}

module.exports = Grupo;