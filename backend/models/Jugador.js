const pool = require('../config/database');
const { obtenerPlan } = require("../services/planLimits");

class Jugador {
    static _columnasDocumentosAseguradas = false;

    static normalizarCedidentidad(valor) {
        const texto = String(valor ?? "").trim();
        return texto ? texto : null;
    }

    static normalizarFechaNacimiento(valor) {
        const texto = String(valor ?? "").trim();
        return texto ? texto : null;
    }

    static normalizarNumeroCamiseta(valor) {
        const texto = String(valor ?? "").trim();
        if (!texto) return null;
        const numero = Number.parseInt(texto, 10);
        return Number.isFinite(numero) && numero > 0 ? numero : null;
    }

    static async asegurarColumnasDocumentos() {
        if (this._columnasDocumentosAseguradas) return;
        await pool.query(`
            ALTER TABLE jugadores
            ADD COLUMN IF NOT EXISTS foto_cedula_url TEXT,
            ADD COLUMN IF NOT EXISTS foto_carnet_url TEXT
        `);
        this._columnasDocumentosAseguradas = true;
    }

    static calcularMaximoJugadoresPermitido(maxJugadoresCampeonato, planCodigo) {
        const plan = obtenerPlan(planCodigo);
        const limitePlan = plan?.max_jugadores_por_equipo;
        const limites = [];

        if (maxJugadoresCampeonato !== null && maxJugadoresCampeonato !== undefined) {
            const maxCamp = Number(maxJugadoresCampeonato);
            if (Number.isFinite(maxCamp) && maxCamp > 0) limites.push(maxCamp);
        }
        if (limitePlan !== null && limitePlan !== undefined) {
            const maxPlan = Number(limitePlan);
            if (Number.isFinite(maxPlan) && maxPlan > 0) limites.push(maxPlan);
        }

        if (!limites.length) return { maximo: null, plan };
        return { maximo: Math.min(...limites), plan };
    }

    static async obtenerEquipoConLimites(equipo_id) {
        const equipoQuery = `
            SELECT
              e.id,
              e.campeonato_id,
              c.min_jugador,
              c.max_jugador,
              COALESCE(u.plan_codigo, 'premium') AS plan_codigo
            FROM equipos e
            JOIN campeonatos c ON e.campeonato_id = c.id
            LEFT JOIN usuarios u ON u.id = c.creador_usuario_id
            WHERE e.id = $1
            LIMIT 1
        `;
        const equipoResult = await pool.query(equipoQuery, [equipo_id]);
        return equipoResult.rows[0] || null;
    }

    /**
     * Validación: un jugador no puede estar en dos equipos del mismo torneo/campeonato.
     * Usa cédula como identificador único.
     * @param {string} cedula
     * @param {number} equipo_destino_id - equipo al que se asigna
     * @param {number} [excluir_jugador_id] - al actualizar, excluir este jugador del chequeo
     */
    static async verificarJugadorUnicoPorCampeonato(cedula, equipo_destino_id, excluir_jugador_id = null) {
        if (!cedula || !equipo_destino_id) return;

        let q = `
            SELECT j.id, j.nombre, j.apellido, e.nombre as equipo_nombre
            FROM jugadores j
            JOIN equipos e ON e.id = j.equipo_id
            WHERE j.cedidentidad = $1
              AND j.equipo_id != $2
              AND e.campeonato_id = (
                SELECT campeonato_id FROM equipos WHERE id = $2
              )
        `;
        const params = [cedula, equipo_destino_id];
        if (excluir_jugador_id) {
            q += ` AND j.id != $3`;
            params.push(excluir_jugador_id);
        }
        q += ` LIMIT 1`;

        const r = await pool.query(q, params);
        if (r.rows.length > 0) {
            const otro = r.rows[0];
            throw new Error(
                `Un jugador no puede estar en dos equipos del mismo torneo. ` +
                `La cédula ya está registrada en el equipo "${otro.equipo_nombre}".`
            );
        }
    }
    
    // CREATE - Crear nuevo jugador
    static async crear(equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan = false, foto_cedula_url = null, foto_carnet_url = null) {
        await this.asegurarColumnasDocumentos();
        const cedulaNormalizada = this.normalizarCedidentidad(cedidentidad);
        const fechaNacimientoNormalizada = this.normalizarFechaNacimiento(fecha_nacimiento);
        const numeroCamisetaNormalizado = this.normalizarNumeroCamiseta(numero_camiseta);

        // Verificar límites de jugadores en el equipo
        const equipo = await this.obtenerEquipoConLimites(equipo_id);

        if (!equipo) {
            throw new Error('Equipo no encontrado');
        }

        const { maximo: maxJugadoresPermitido, plan } = this.calcularMaximoJugadoresPermitido(
            equipo.max_jugador,
            equipo.plan_codigo
        );

        // Contar jugadores actuales en el equipo
        const countQuery = 'SELECT COUNT(*) FROM jugadores WHERE equipo_id = $1';
        const countResult = await pool.query(countQuery, [equipo_id]);
        const jugadoresActuales = parseInt(countResult.rows[0].count);

        if (maxJugadoresPermitido != null && jugadoresActuales >= maxJugadoresPermitido) {
            if (plan?.max_jugadores_por_equipo != null && maxJugadoresPermitido === Number(plan.max_jugadores_por_equipo)) {
                throw new Error(`Límite del plan ${plan.nombre}: máximo ${maxJugadoresPermitido} jugadores por equipo`);
            }
            throw new Error(`Límite de ${maxJugadoresPermitido} jugadores alcanzado en este equipo`);
        }

        // Verificar si la cédula ya existe en otro equipo del mismo campeonato
        await this.verificarJugadorUnicoPorCampeonato(cedulaNormalizada, equipo_id);

        // Verificar cédula duplicada en el mismo equipo (fallback)
        if (cedulaNormalizada) {
            const cedQuery = 'SELECT id FROM jugadores WHERE cedidentidad = $1 AND equipo_id = $2';
            const cedResult = await pool.query(cedQuery, [cedulaNormalizada, equipo_id]);
            if (cedResult.rows.length > 0) {
                throw new Error('La cédula de identidad ya está registrada en este equipo');
            }
        }

        // Verificar si el número de camiseta ya está en uso en el equipo
        if (numeroCamisetaNormalizado) {
            const camisetaQuery = 'SELECT id FROM jugadores WHERE equipo_id = $1 AND numero_camiseta = $2';
            const camisetaResult = await pool.query(camisetaQuery, [equipo_id, numeroCamisetaNormalizado]);
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
            (equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan, foto_cedula_url, foto_carnet_url) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
            RETURNING *
        `;
        const values = [
            equipo_id,
            nombre,
            apellido,
            cedulaNormalizada,
            fechaNacimientoNormalizada,
            posicion,
            numeroCamisetaNormalizado,
            es_capitan,
            foto_cedula_url,
            foto_carnet_url,
        ];
        
        const result = await pool.query(insertQuery, values);
        return result.rows[0];
    }

    // READ - Obtener jugadores por equipo
    static async obtenerPorEquipo(equipo_id) {
        await this.asegurarColumnasDocumentos();
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
        await this.asegurarColumnasDocumentos();
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
        await this.asegurarColumnasDocumentos();
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
        await this.asegurarColumnasDocumentos();
        if (Object.prototype.hasOwnProperty.call(datos, "cedidentidad")) {
            datos.cedidentidad = this.normalizarCedidentidad(datos.cedidentidad);
        }
        if (Object.prototype.hasOwnProperty.call(datos, "fecha_nacimiento")) {
            datos.fecha_nacimiento = this.normalizarFechaNacimiento(datos.fecha_nacimiento);
        }
        if (Object.prototype.hasOwnProperty.call(datos, "numero_camiseta")) {
            datos.numero_camiseta = this.normalizarNumeroCamiseta(datos.numero_camiseta);
        }
        // Si cambia equipo_id o cedidentidad, validar jugador único por campeonato
        if (datos.equipo_id) {
            const jugadorActual = await pool.query(
                'SELECT cedidentidad FROM jugadores WHERE id = $1',
                [id]
            );
            const cedula = datos.cedidentidad ?? jugadorActual.rows[0]?.cedidentidad;
            if (cedula) {
                await this.verificarJugadorUnicoPorCampeonato(cedula, datos.equipo_id, parseInt(id, 10));
            }

            const equipoLimites = await this.obtenerEquipoConLimites(datos.equipo_id);
            if (!equipoLimites) {
                throw new Error("Equipo no encontrado");
            }
            const { maximo: maxJugadoresPermitido, plan } = this.calcularMaximoJugadoresPermitido(
                equipoLimites.max_jugador,
                equipoLimites.plan_codigo
            );
            if (maxJugadoresPermitido != null) {
                const countResult = await pool.query(
                    `SELECT COUNT(*)::int AS total FROM jugadores WHERE equipo_id = $1 AND id <> $2`,
                    [datos.equipo_id, id]
                );
                const jugadoresActuales = Number(countResult.rows[0]?.total || 0);
                if (jugadoresActuales >= maxJugadoresPermitido) {
                    if (plan?.max_jugadores_por_equipo != null && maxJugadoresPermitido === Number(plan.max_jugadores_por_equipo)) {
                        throw new Error(`Límite del plan ${plan.nombre}: máximo ${maxJugadoresPermitido} jugadores por equipo`);
                    }
                    throw new Error(`Límite de ${maxJugadoresPermitido} jugadores alcanzado en este equipo`);
                }
            }
        }

        const campos = [];
        const valores = [];
        let contador = 1;
        const allowed = new Set([
            'equipo_id', 'nombre', 'apellido', 'cedidentidad', 'fecha_nacimiento',
            'posicion', 'numero_camiseta', 'es_capitan', 'foto_cedula_url', 'foto_carnet_url'
        ]);

        for (const [key, value] of Object.entries(datos)) {
            if (value !== undefined && allowed.has(key)) {
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
