const pool = require('../config/database');

class Jugador {
    
    // CREATE - Crear nuevo jugador
    static async crear(equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan = false) {
        // Verificar límites de jugadores en el equipo
        const equipoQuery = `
            SELECT e.*, min_jugador, max_jugador 
            FROM equipos e 
            JOIN campeonatos c ON e.campeonato_id = c.id 
            WHERE e.id = $1
        `;
        const equipoResult = await pool.query(equipoQuery, [equipo_id]);
        
        if (equipoResult.rows.length === 0) {
            throw new Error('Equipo no encontrado');
        }

        const equipo = equipoResult.rows[0];
        const minJugadores = equipo.min_jugador;
        const maxJugadores = equipo.max_jugador;

        // Contar jugadores actuales en el equipo
        const countQuery = 'SELECT COUNT(*) FROM jugadores WHERE equipo_id = $1';
        const countResult = await pool.query(countQuery, [equipo_id]);
        const jugadoresActuales = parseInt(countResult.rows[0].count);

        if (jugadoresActuales >= maxJugadores) {
            throw new Error(`Límite de ${maxJugadores} jugadores alcanzado en este equipo`);
        }

        // Verificar si la Cedula ya existe
        const cedQuery = 'SELECT id FROM jugadores WHERE cedIdentidad = $1';
        const cedResult = await pool.query(cedQuery, [cedidentidad]);
        if (cedResult.rows.length > 0) {
            throw new Error('La Cedula de Identidad ya está registrado en el sistema');
        }

        // Verificar si el número de camiseta ya está en uso en el equipo
        if (numero_camiseta) {
            const camisetaQuery = 'SELECT id FROM jugadores WHERE equipo_id = $1 AND numero_camiseta = $2';
            const camisetaResult = await pool.query(camisetaQuery, [equipo_id, numero_camiseta]);
            if (camisetaResult.rows.length > 0) {
                throw new Error('El número de camiseta ya está en uso en este equipo');
            }
        }

        // Si es capitán, quitar capitán anterior
        if (es_capitan) {
            await pool.query('UPDATE jugadores SET es_capitan = false WHERE equipo_id = $1', [equipo_id]);
        }

        // Crear jugador
        const insertQuery = `
            INSERT INTO jugadores 
            (equipo_id, nombre, apellido, cedIdentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
            RETURNING *
        `;
        const values = [equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan];
        
        const result = await pool.query(insertQuery, values);
        return result.rows[0];
    }

    // READ - Obtener jugadores por equipo
    static async obtenerPorEquipo(equipo_id) {
        const query = `
            SELECT j.*, e.nombre as nombre_equipo, c.nombre as nombre_campeonato
            FROM jugadores j 
            JOIN equipos e ON j.equipo_id = e.id 
            JOIN campeonatos c ON e.campeonato_id = c.id 
            WHERE j.equipo_id = $1 
            ORDER BY j.es_capitan DESC, j.apellido, j.nombre
        `;
        const result = await pool.query(query, [equipo_id]);
        return result.rows;
    }

    // READ - Obtener jugador por ID
    static async obtenerPorId(id) {
        const query = `
            SELECT j.*, e.nombre as nombre_equipo, c.nombre as nombre_campeonato
            FROM jugadores j 
            JOIN equipos e ON j.equipo_id = e.id 
            JOIN campeonatos c ON e.campeonato_id = c.id 
            WHERE j.id = $1
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    // READ - Obtener todos los jugadores
    static async obtenerTodos() {
        const query = `
            SELECT j.*, e.nombre as nombre_equipo, c.nombre as nombre_campeonato
            FROM jugadores j 
            JOIN equipos e ON j.equipo_id = e.id 
            JOIN campeonatos c ON e.campeonato_id = c.id 
            ORDER BY c.nombre, e.nombre, j.apellido, j.nombre
        `;
        const result = await pool.query(query);
        return result.rows;
    }

    // UPDATE - Actualizar jugador
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
            UPDATE jugadores 
            SET ${campos.join(', ')} 
            WHERE id = $${contador} 
            RETURNING *
        `;

        const result = await pool.query(query, valores);
        return result.rows[0];
    }

    // DELETE - Eliminar jugador
    static async eliminar(id) {
        const query = 'DELETE FROM jugadores WHERE id = $1 RETURNING *';
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    // Método especial: Designar capitán
    static async designarCapitan(jugador_id, equipo_id) {
        // Quitar capitán anterior
        await pool.query('UPDATE jugadores SET es_capitan = false WHERE equipo_id = $1', [equipo_id]);
        
        // Designar nuevo capitán
        const query = 'UPDATE jugadores SET es_capitan = true WHERE id = $1 RETURNING *';
        const result = await pool.query(query, [jugador_id]);
        return result.rows[0];
    }
}

module.exports = Jugador;