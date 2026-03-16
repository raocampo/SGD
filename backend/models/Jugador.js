const pool = require('../config/database');
const { obtenerPlan } = require("../services/planLimits");

class Jugador {
    static _columnasDocumentosAseguradas = false;

    static traducirErrorRestriccionJugador(error) {
        if (!error || error.code !== "23505") return error;
        const constraint = String(error.constraint || "");
        if (constraint === "jugadores_dni_key") {
            return new Error(
                "La cédula ya existe bajo la restricción antigua del sistema. Debes aplicar la migración 046 para permitir la misma cédula en distintas categorías."
            );
        }
        if (constraint === "jugadores_cedidentidad_evento_uidx") {
            return new Error("La cédula ya está registrada en esta misma categoría.");
        }
        return error;
    }

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

    static normalizarPosicionFoto(valor, fallback = 50) {
        if (valor === undefined || valor === null || valor === "") return fallback;
        const numero = Number.parseFloat(String(valor).replace(",", "."));
        if (!Number.isFinite(numero)) return fallback;
        return Math.max(0, Math.min(100, Number(numero.toFixed(2))));
    }

    static normalizarZoomFoto(valor, fallback = 1) {
        if (valor === undefined || valor === null || valor === "") return fallback;
        const numero = Number.parseFloat(String(valor).replace(",", "."));
        if (!Number.isFinite(numero)) return fallback;
        return Math.max(0.6, Math.min(2.5, Number(numero.toFixed(2))));
    }

    static normalizarEventoId(valor) {
        if (valor === undefined || valor === null || valor === "") return null;
        const numero = Number.parseInt(String(valor), 10);
        return Number.isFinite(numero) && numero > 0 ? numero : null;
    }

    static async asegurarColumnasDocumentos() {
        if (this._columnasDocumentosAseguradas) return;
        await pool.query(`
            ALTER TABLE jugadores
            ADD COLUMN IF NOT EXISTS foto_cedula_url TEXT,
            ADD COLUMN IF NOT EXISTS foto_carnet_url TEXT,
            ADD COLUMN IF NOT EXISTS foto_carnet_recorte_url TEXT,
            ADD COLUMN IF NOT EXISTS evento_id INTEGER,
            ADD COLUMN IF NOT EXISTS foto_carnet_pos_x NUMERIC(5,2) DEFAULT 50,
            ADD COLUMN IF NOT EXISTS foto_carnet_pos_y NUMERIC(5,2) DEFAULT 35,
            ADD COLUMN IF NOT EXISTS foto_carnet_zoom NUMERIC(5,2) DEFAULT 1.00
        `);
        await pool.query(`
            UPDATE jugadores
            SET
              foto_carnet_pos_x = COALESCE(foto_carnet_pos_x, 50),
              foto_carnet_pos_y = COALESCE(foto_carnet_pos_y, 35),
              foto_carnet_zoom = COALESCE(foto_carnet_zoom, 1.00)
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

    static async obtenerCantidadEventosEquipo(equipo_id) {
        const result = await pool.query(
            `
                SELECT COUNT(DISTINCT evento_id)::int AS total
                FROM evento_equipos
                WHERE equipo_id = $1
            `,
            [equipo_id]
        );
        return Number(result.rows[0]?.total || 0);
    }

    static async resolverContextoRosterEquipo(equipo_id, evento_id_contexto) {
        const eventoId = this.normalizarEventoId(evento_id_contexto);
        if (!eventoId) {
            return {
                eventoId: null,
                usaSoloEvento: false,
                usaCompatibilidadLegacy: false,
            };
        }

        const totalEventos = await this.obtenerCantidadEventosEquipo(equipo_id);
        return {
            eventoId,
            usaSoloEvento: totalEventos > 1,
            usaCompatibilidadLegacy: totalEventos <= 1,
        };
    }

    static construirFiltroRosterEvento(alias, placeholderEvento, contextoRoster) {
        if (!contextoRoster?.eventoId) return "";
        const prefijo = alias ? `${alias}.` : "";
        if (contextoRoster.usaSoloEvento) {
            return ` AND ${prefijo}evento_id = ${placeholderEvento}`;
        }
        return ` AND (${prefijo}evento_id = ${placeholderEvento} OR ${prefijo}evento_id IS NULL)`;
    }

    /**
     * Validación: un jugador no puede estar en dos equipos de la misma categoría/evento.
     * Puede repetirse en otras categorías del mismo campeonato.
     * @param {string} cedula
     * @param {number} equipo_destino_id - equipo al que se asigna
     * @param {number} [excluir_jugador_id] - al actualizar, excluir este jugador del chequeo
     */
    static async verificarJugadorUnicoPorEvento(
        cedula,
        equipo_destino_id,
        excluir_jugador_id = null,
        evento_contexto_id = null
    ) {
        if (!cedula || !equipo_destino_id) return;

        const eventoContextoId = Number.parseInt(evento_contexto_id, 10);
        let q = `
            WITH eventos_destino AS (
              SELECT ee.evento_id
              FROM evento_equipos ee
              WHERE ee.equipo_id = $2
                AND ($3::int IS NULL OR ee.evento_id = $3)
            ),
            conteo_eventos_equipo AS (
              SELECT
                ee.equipo_id,
                COUNT(DISTINCT ee.evento_id)::int AS total_eventos
              FROM evento_equipos ee
              GROUP BY ee.equipo_id
            )
            SELECT
              j.id,
              j.nombre,
              j.apellido,
              e.nombre as equipo_nombre,
              STRING_AGG(DISTINCT ev.nombre, ', ' ORDER BY ev.nombre) AS evento_nombre
            FROM jugadores j
            JOIN equipos e ON e.id = j.equipo_id
            JOIN evento_equipos ee_jugador ON ee_jugador.equipo_id = j.equipo_id
            JOIN eventos_destino ed ON ed.evento_id = ee_jugador.evento_id
            LEFT JOIN conteo_eventos_equipo cee ON cee.equipo_id = j.equipo_id
            LEFT JOIN eventos ev ON ev.id = ee_jugador.evento_id
            WHERE j.cedidentidad = $1
              AND j.equipo_id != $2
              AND (
                $3::int IS NULL
                OR (COALESCE(cee.total_eventos, 0) > 1 AND j.evento_id = ed.evento_id)
                OR (COALESCE(cee.total_eventos, 0) <= 1 AND (j.evento_id = ed.evento_id OR j.evento_id IS NULL))
              )
        `;
        const params = [cedula, equipo_destino_id, Number.isFinite(eventoContextoId) ? eventoContextoId : null];
        if (excluir_jugador_id) {
            q += ` AND j.id != $4`;
            params.push(excluir_jugador_id);
        }
        q += `
            GROUP BY j.id, j.nombre, j.apellido, e.nombre
            LIMIT 1
        `;

        const r = await pool.query(q, params);
        if (r.rows.length > 0) {
            const otro = r.rows[0];
            throw new Error(
                `Un jugador no puede estar en dos equipos de la misma categoría. ` +
                `La cédula ya está registrada en el equipo "${otro.equipo_nombre}"` +
                `${otro.evento_nombre ? ` de la categoría "${otro.evento_nombre}"` : ""}.`
            );
        }
    }
    
    // CREATE - Crear nuevo jugador
    static async crear(
        equipo_id,
        nombre,
        apellido,
        cedidentidad,
        fecha_nacimiento,
        posicion,
        numero_camiseta,
        es_capitan = false,
        foto_cedula_url = null,
        foto_carnet_url = null,
        foto_carnet_recorte_url = null,
        foto_carnet_pos_x = 50,
        foto_carnet_pos_y = 35,
        foto_carnet_zoom = 1,
        evento_id_contexto = null
    ) {
        await this.asegurarColumnasDocumentos();
        const cedulaNormalizada = this.normalizarCedidentidad(cedidentidad);
        const fechaNacimientoNormalizada = this.normalizarFechaNacimiento(fecha_nacimiento);
        const numeroCamisetaNormalizado = this.normalizarNumeroCamiseta(numero_camiseta);
        const fotoCarnetPosX = this.normalizarPosicionFoto(foto_carnet_pos_x, 50);
        const fotoCarnetPosY = this.normalizarPosicionFoto(foto_carnet_pos_y, 35);
        const fotoCarnetZoom = this.normalizarZoomFoto(foto_carnet_zoom, 1);
        const eventoContextoId = this.normalizarEventoId(evento_id_contexto);
        const contextoRoster = await this.resolverContextoRosterEquipo(equipo_id, eventoContextoId);

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
        const countQuery = `
            SELECT COUNT(*)::int AS total
            FROM jugadores
            WHERE equipo_id = $1
            ${this.construirFiltroRosterEvento("", "$2", contextoRoster)}
        `;
        const countParams = contextoRoster.eventoId ? [equipo_id, contextoRoster.eventoId] : [equipo_id];
        const countResult = await pool.query(countQuery, countParams);
        const jugadoresActuales = Number(countResult.rows[0]?.total || 0);

        if (maxJugadoresPermitido != null && jugadoresActuales >= maxJugadoresPermitido) {
            if (plan?.max_jugadores_por_equipo != null && maxJugadoresPermitido === Number(plan.max_jugadores_por_equipo)) {
                throw new Error(`Límite del plan ${plan.nombre}: máximo ${maxJugadoresPermitido} jugadores por equipo`);
            }
            throw new Error(`Límite de ${maxJugadoresPermitido} jugadores alcanzado en este equipo`);
        }

        // Verificar si la cédula ya existe en otro equipo de la misma categoría/evento
        await this.verificarJugadorUnicoPorEvento(
            cedulaNormalizada,
            equipo_id,
            null,
            contextoRoster.eventoId
        );

        // Verificar cédula duplicada en el mismo equipo (fallback)
        if (cedulaNormalizada) {
            const cedQuery = `
                SELECT id
                FROM jugadores
                WHERE cedidentidad = $1
                  AND equipo_id = $2
                  ${this.construirFiltroRosterEvento("", "$3", contextoRoster)}
            `;
            const cedParams = contextoRoster.eventoId
                ? [cedulaNormalizada, equipo_id, contextoRoster.eventoId]
                : [cedulaNormalizada, equipo_id];
            const cedResult = await pool.query(cedQuery, cedParams);
            if (cedResult.rows.length > 0) {
                throw new Error('La cédula de identidad ya está registrada en este equipo');
            }
        }

        // Verificar si el número de camiseta ya está en uso en el equipo
        if (numeroCamisetaNormalizado) {
            const camisetaQuery = `
                SELECT id
                FROM jugadores
                WHERE equipo_id = $1
                  AND numero_camiseta = $2
                  ${this.construirFiltroRosterEvento("", "$3", contextoRoster)}
            `;
            const camisetaParams = contextoRoster.eventoId
                ? [equipo_id, numeroCamisetaNormalizado, contextoRoster.eventoId]
                : [equipo_id, numeroCamisetaNormalizado];
            const camisetaResult = await pool.query(camisetaQuery, camisetaParams);
            if (camisetaResult.rows.length > 0) {
                throw new Error('El número de camiseta ya está en uso en este equipo');
            }
        }

        // Si es capitán, quitar capitán anterior
        if (es_capitan) {
            const capitanQuery = `
                UPDATE jugadores
                SET es_capitan = false
                WHERE equipo_id = $1
                ${this.construirFiltroRosterEvento("", "$2", contextoRoster)}
            `;
            const capitanParams = contextoRoster.eventoId ? [equipo_id, contextoRoster.eventoId] : [equipo_id];
            await pool.query(capitanQuery, capitanParams);
        }

        // Crear jugador
        const insertQuery = `
            INSERT INTO jugadores 
            (equipo_id, evento_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan, foto_cedula_url, foto_carnet_url, foto_carnet_recorte_url, foto_carnet_pos_x, foto_carnet_pos_y, foto_carnet_zoom) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
            RETURNING *
        `;
        const values = [
            equipo_id,
            contextoRoster.eventoId,
            nombre,
            apellido,
            cedulaNormalizada,
            fechaNacimientoNormalizada,
            posicion,
            numeroCamisetaNormalizado,
            es_capitan,
            foto_cedula_url,
            foto_carnet_url,
            foto_carnet_recorte_url,
            fotoCarnetPosX,
            fotoCarnetPosY,
            fotoCarnetZoom,
        ];
        
        try {
            const result = await pool.query(insertQuery, values);
            return result.rows[0];
        } catch (error) {
            throw this.traducirErrorRestriccionJugador(error);
        }
    }

    // READ - Obtener jugadores por equipo
    static async obtenerPorEquipo(equipo_id, evento_id_contexto = null) {
        await this.asegurarColumnasDocumentos();
        const contextoRoster = await this.resolverContextoRosterEquipo(equipo_id, evento_id_contexto);
        if (!contextoRoster.eventoId) {
            const query = `
                SELECT j.*, e.nombre as nombre_equipo, e.numero_campeonato as equipo_numero_campeonato, c.nombre as nombre_campeonato
                FROM jugadores j 
                JOIN equipos e ON j.equipo_id = e.id 
                JOIN campeonatos c ON e.campeonato_id = c.id 
                WHERE j.equipo_id = $1 
                ORDER BY j.es_capitan DESC, j.apellido, j.nombre
            `;
            const result = await pool.query(query, [equipo_id]);
            return result.rows;
        }

        const query = `
            WITH candidatos AS (
                SELECT
                    j.*,
                    e.nombre AS nombre_equipo,
                    e.numero_campeonato AS equipo_numero_campeonato,
                    c.nombre AS nombre_campeonato,
                    COALESCE(NULLIF(TRIM(j.cedidentidad), ''), CONCAT('__jugador__', j.id::text)) AS dedupe_key,
                    CASE WHEN j.evento_id = $2 THEN 0 ELSE 1 END AS prioridad_evento
                FROM jugadores j
                JOIN equipos e ON j.equipo_id = e.id
                JOIN campeonatos c ON e.campeonato_id = c.id
                WHERE j.equipo_id = $1
                  ${this.construirFiltroRosterEvento("j", "$2", contextoRoster)}
            ),
            dedupe AS (
                SELECT *
                FROM (
                    SELECT
                        candidatos.*,
                        ROW_NUMBER() OVER (
                            PARTITION BY candidatos.dedupe_key
                            ORDER BY candidatos.prioridad_evento, candidatos.es_capitan DESC, candidatos.apellido, candidatos.nombre, candidatos.id DESC
                        ) AS rn
                    FROM candidatos
                ) base
                WHERE rn = 1
            )
            SELECT *
            FROM dedupe
            ORDER BY es_capitan DESC, apellido, nombre
        `;
        const result = await pool.query(query, [equipo_id, contextoRoster.eventoId]);
        return result.rows;
    }

    // READ - Obtener jugador por ID
    static async obtenerPorId(id) {
        await this.asegurarColumnasDocumentos();
        const query = `
            SELECT j.*, e.nombre as nombre_equipo, e.numero_campeonato as equipo_numero_campeonato, c.nombre as nombre_campeonato
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
            SELECT j.*, e.nombre as nombre_equipo, e.numero_campeonato as equipo_numero_campeonato, c.nombre as nombre_campeonato
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
        if (Object.prototype.hasOwnProperty.call(datos, "foto_carnet_pos_x")) {
            datos.foto_carnet_pos_x = this.normalizarPosicionFoto(datos.foto_carnet_pos_x, 50);
        }
        if (Object.prototype.hasOwnProperty.call(datos, "foto_carnet_pos_y")) {
            datos.foto_carnet_pos_y = this.normalizarPosicionFoto(datos.foto_carnet_pos_y, 35);
        }
        if (Object.prototype.hasOwnProperty.call(datos, "foto_carnet_zoom")) {
            datos.foto_carnet_zoom = this.normalizarZoomFoto(datos.foto_carnet_zoom, 1);
        }
        if (Object.prototype.hasOwnProperty.call(datos, "evento_id")) {
            datos.evento_id = this.normalizarEventoId(datos.evento_id);
        }
        const jugadorActualResult = await pool.query(
            'SELECT cedidentidad, equipo_id, evento_id, numero_camiseta FROM jugadores WHERE id = $1',
            [id]
        );
        const jugadorActual = jugadorActualResult.rows[0];
        if (!jugadorActual) {
            return null;
        }
        const equipoDestinoId = datos.equipo_id ?? jugadorActual.equipo_id;
        const eventoDestinoId = datos.evento_id ?? this.normalizarEventoId(datos.evento_id_contexto) ?? jugadorActual.evento_id;
        const contextoRoster = await this.resolverContextoRosterEquipo(equipoDestinoId, eventoDestinoId);

        // Si cambia equipo_id o cedidentidad, validar jugador único por categoría/evento
        if (
            datos.equipo_id ||
            Object.prototype.hasOwnProperty.call(datos, "cedidentidad") ||
            Object.prototype.hasOwnProperty.call(datos, "evento_id") ||
            Object.prototype.hasOwnProperty.call(datos, "evento_id_contexto")
        ) {
            const cedula = datos.cedidentidad ?? jugadorActual.cedidentidad;
            if (cedula) {
                await this.verificarJugadorUnicoPorEvento(
                    cedula,
                    equipoDestinoId,
                    parseInt(id, 10),
                    contextoRoster.eventoId
                );
            }

            const equipoLimites = await this.obtenerEquipoConLimites(equipoDestinoId);
            if (!equipoLimites) {
                throw new Error("Equipo no encontrado");
            }
            const { maximo: maxJugadoresPermitido, plan } = this.calcularMaximoJugadoresPermitido(
                equipoLimites.max_jugador,
                equipoLimites.plan_codigo
            );
            if (maxJugadoresPermitido != null) {
                const countResult = await pool.query(
                    `
                        SELECT COUNT(*)::int AS total
                        FROM jugadores
                        WHERE equipo_id = $1
                          AND id <> $2
                          ${this.construirFiltroRosterEvento("", "$3", contextoRoster)}
                    `,
                    contextoRoster.eventoId ? [equipoDestinoId, id, contextoRoster.eventoId] : [equipoDestinoId, id]
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

        const cedulaDestino = datos.cedidentidad ?? jugadorActual.cedidentidad;
        if (cedulaDestino) {
            const cedulaEquipoResult = await pool.query(
                `
                    SELECT id
                    FROM jugadores
                    WHERE cedidentidad = $1
                      AND equipo_id = $2
                      AND id <> $3
                      ${this.construirFiltroRosterEvento("", "$4", contextoRoster)}
                    LIMIT 1
                `,
                contextoRoster.eventoId
                    ? [cedulaDestino, equipoDestinoId, id, contextoRoster.eventoId]
                    : [cedulaDestino, equipoDestinoId, id]
            );
            if (cedulaEquipoResult.rows.length > 0) {
                throw new Error("La cédula de identidad ya está registrada en este equipo para esta categoría");
            }
        }

        const numeroCamisetaDestino = Object.prototype.hasOwnProperty.call(datos, "numero_camiseta")
            ? datos.numero_camiseta
            : jugadorActual.numero_camiseta;
        if (numeroCamisetaDestino) {
            const numeroEquipoResult = await pool.query(
                `
                    SELECT id
                    FROM jugadores
                    WHERE equipo_id = $1
                      AND numero_camiseta = $2
                      AND id <> $3
                      ${this.construirFiltroRosterEvento("", "$4", contextoRoster)}
                    LIMIT 1
                `,
                contextoRoster.eventoId
                    ? [equipoDestinoId, numeroCamisetaDestino, id, contextoRoster.eventoId]
                    : [equipoDestinoId, numeroCamisetaDestino, id]
            );
            if (numeroEquipoResult.rows.length > 0) {
                throw new Error("El número de camiseta ya está en uso en este equipo para esta categoría");
            }
        }

        if (datos.es_capitan === true || datos.es_capitan === "true") {
            const limpiarCapitanQ = `
                UPDATE jugadores
                SET es_capitan = false
                WHERE equipo_id = $1
                  AND id <> $2
                  ${this.construirFiltroRosterEvento("", "$3", contextoRoster)}
            `;
            const limpiarCapitanParams = contextoRoster.eventoId
                ? [equipoDestinoId, id, contextoRoster.eventoId]
                : [equipoDestinoId, id];
            await pool.query(limpiarCapitanQ, limpiarCapitanParams);
        }

        const campos = [];
        const valores = [];
        let contador = 1;
        const allowed = new Set([
            'equipo_id', 'evento_id', 'nombre', 'apellido', 'cedidentidad', 'fecha_nacimiento',
            'posicion', 'numero_camiseta', 'es_capitan', 'foto_cedula_url', 'foto_carnet_url',
            'foto_carnet_recorte_url',
            'foto_carnet_pos_x', 'foto_carnet_pos_y', 'foto_carnet_zoom'
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

        try {
            const result = await pool.query(query, valores);
            return result.rows[0];
        } catch (error) {
            throw this.traducirErrorRestriccionJugador(error);
        }
    }

    // DELETE - Eliminar jugador
    static async eliminar(id) {
        const query = 'DELETE FROM jugadores WHERE id = $1 RETURNING *';
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    // Método especial: Designar capitán
    static async designarCapitan(jugador_id, equipo_id, evento_id_contexto = null) {
        // Quitar capitán anterior
        const contextoRoster = await this.resolverContextoRosterEquipo(equipo_id, evento_id_contexto);
        const limpiarCapitanQ = `
            UPDATE jugadores
            SET es_capitan = false
            WHERE equipo_id = $1
            ${this.construirFiltroRosterEvento("", "$2", contextoRoster)}
        `;
        const limpiarCapitanParams = contextoRoster.eventoId ? [equipo_id, contextoRoster.eventoId] : [equipo_id];
        await pool.query(limpiarCapitanQ, limpiarCapitanParams);
        
        // Designar nuevo capitán
        const query = 'UPDATE jugadores SET es_capitan = true WHERE id = $1 RETURNING *';
        const result = await pool.query(query, [jugador_id]);
        return result.rows[0];
    }

    static async buscarPerfilPorCedula(cedula) {
        await this.asegurarColumnasDocumentos();
        const cedulaNormalizada = this.normalizarCedidentidad(cedula);
        if (!cedulaNormalizada) return null;

        const query = `
            SELECT
              j.id,
              j.nombre,
              j.apellido,
              j.cedidentidad,
              j.fecha_nacimiento,
              j.posicion,
              j.numero_camiseta,
              j.foto_cedula_url,
              j.foto_carnet_url,
              j.foto_carnet_recorte_url,
              j.foto_carnet_pos_x,
              j.foto_carnet_pos_y,
              j.foto_carnet_zoom,
              e.id AS equipo_id,
              e.nombre AS equipo_nombre,
              c.id AS campeonato_id,
              c.nombre AS campeonato_nombre
            FROM jugadores j
            JOIN equipos e ON e.id = j.equipo_id
            JOIN campeonatos c ON c.id = e.campeonato_id
            WHERE j.cedidentidad = $1
            ORDER BY j.id DESC
            LIMIT 1
        `;
        const result = await pool.query(query, [cedulaNormalizada]);
        return result.rows[0] || null;
    }
}

module.exports = Jugador;
