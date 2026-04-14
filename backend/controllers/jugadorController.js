const fs = require("fs");
const Jugador = require('../models/Jugador');
const Partido = require("../models/Partido");
const pool = require("../config/database");
const { resolveUploadPath } = require("../config/uploads");
const {
    tecnicoPuedeAccederEquipo,
    obtenerEquiposPermitidosTecnico,
} = require("../services/roleScope");

let columnasDocsCampeonatoAseguradas = false;

async function asegurarColumnasDocsCampeonato() {
    if (columnasDocsCampeonatoAseguradas) return;
    await pool.query(`
        ALTER TABLE campeonatos
        ADD COLUMN IF NOT EXISTS requiere_cedula_jugador BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS requiere_foto_cedula BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS requiere_foto_carnet BOOLEAN DEFAULT FALSE
    `);
    columnasDocsCampeonatoAseguradas = true;
}

async function obtenerReglasDocumentosPorEquipo(equipo_id) {
    await asegurarColumnasDocsCampeonato();
    const q = `
        SELECT
            COALESCE(c.requiere_cedula_jugador, true) AS requiere_cedula_jugador,
            COALESCE(c.requiere_foto_cedula, false) AS requiere_foto_cedula,
            COALESCE(c.requiere_foto_carnet, false) AS requiere_foto_carnet
        FROM equipos e
        JOIN campeonatos c ON c.id = e.campeonato_id
        WHERE e.id = $1
        LIMIT 1
    `;
    const r = await pool.query(q, [equipo_id]);
    return r.rows[0] || {
        requiere_cedula_jugador: true,
        requiere_foto_cedula: false,
        requiere_foto_carnet: false,
    };
}

async function validarAccesoTecnicoEquipo(req, res, equipoId, mensaje = "No autorizado para operar sobre este equipo") {
    const permitido = await tecnicoPuedeAccederEquipo(req, equipoId);
    if (permitido) return true;
    res.status(403).json({ error: mensaje });
    return false;
}

function construirUrlArchivoJugador(req, file) {
    if (!file) return null;
    const folder =
        req.uploadFolderByField?.[file.fieldname] ||
        req.uploadFolder ||
        "jugadores";
    return `/uploads/${String(folder).replace(/^\/+|\/+$/g, "")}/${file.filename}`;
}

function parseBooleanFlag(value) {
    if (typeof value === "boolean") return value;
    const normalized = String(value ?? "").trim().toLowerCase();
    return ["true", "1", "si", "sí", "on"].includes(normalized);
}

function parsePhotoPosition(value, fallback = 50) {
    if (value === undefined || value === null || value === "") return fallback;
    const numero = Number.parseFloat(String(value).replace(",", "."));
    if (!Number.isFinite(numero)) return fallback;
    return Math.max(0, Math.min(100, Number(numero.toFixed(2))));
}

function parsePhotoZoom(value, fallback = 1) {
    if (value === undefined || value === null || value === "") return fallback;
    const numero = Number.parseFloat(String(value).replace(",", "."));
    if (!Number.isFinite(numero)) return fallback;
    return Math.max(0.6, Math.min(2.5, Number(numero.toFixed(2))));
}

function eliminarArchivoJugador(urlPath) {
    const raw = String(urlPath || "").trim();
    if (!raw) return;
    if (!raw.startsWith("/uploads/") && !raw.startsWith("uploads/")) return;

    const filePath = resolveUploadPath(raw);
    fs.unlink(filePath, () => {});
}

function normalizarUrlInternaJugador(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    if (raw.startsWith("/uploads/") || raw.startsWith("uploads/")) {
        return raw.startsWith("/") ? raw : `/${raw}`;
    }
    return null;
}

function normalizarCedulaController(value) {
    return Jugador.normalizarCedidentidad(value);
}

const jugadorController = {

    // CREAR - Nuevo jugador
    crearJugador: async (req, res) => {
        try {
            if (req.fileValidationError) {
                return res.status(400).json({ error: req.fileValidationError });
            }
            const {
                equipo_id,
                evento_id,
                nombre,
                apellido,
                cedidentidad,
                fecha_nacimiento,
                posicion,
                numero_camiseta,
                es_capitan,
                foto_carnet_pos_x,
                foto_carnet_pos_y,
                foto_carnet_zoom,
            } = req.body;
            const fotoCedula =
                construirUrlArchivoJugador(req, req.files?.foto_cedula?.[0]) ||
                normalizarUrlInternaJugador(req.body?.foto_cedula_url);
            const fotoCarnet =
                construirUrlArchivoJugador(req, req.files?.foto_carnet?.[0]) ||
                normalizarUrlInternaJugador(req.body?.foto_carnet_url);
            const fotoCarnetRecorte =
                construirUrlArchivoJugador(req, req.files?.foto_carnet_recorte?.[0]) ||
                normalizarUrlInternaJugador(req.body?.foto_carnet_recorte_url);
            const fotoCarnetPosX = parsePhotoPosition(foto_carnet_pos_x, 50);
            const fotoCarnetPosY = parsePhotoPosition(foto_carnet_pos_y, 35);
            const fotoCarnetZoom = parsePhotoZoom(foto_carnet_zoom, 1);

            // Validaciones básicas
            if (!equipo_id || !nombre || !apellido) {
                return res.status(400).json({
                    error: 'equipo_id, nombre y apellido son obligatorios'
                });
            }
            if (!(await validarAccesoTecnicoEquipo(req, res, equipo_id))) {
                return;
            }

            const cedulaNormalizada = normalizarCedulaController(cedidentidad);
            const reglasDocs = await obtenerReglasDocumentosPorEquipo(Number(equipo_id));
            if (reglasDocs.requiere_cedula_jugador && !cedulaNormalizada) {
                return res.status(400).json({
                    error: "Este campeonato exige cédula de identidad para inscribir jugadores"
                });
            }
            if (reglasDocs.requiere_foto_cedula && !fotoCedula) {
                return res.status(400).json({
                    error: "Este campeonato exige foto de cédula para inscribir jugadores"
                });
            }
            if (reglasDocs.requiere_foto_carnet && !fotoCarnet) {
                return res.status(400).json({
                    error: "Este campeonato exige foto carné para inscribir jugadores"
                });
            }

            const nuevoJugador = await Jugador.crear(
                equipo_id,
                nombre,
                apellido,
                cedulaNormalizada,
                fecha_nacimiento,
                posicion,
                numero_camiseta,
                es_capitan,
                fotoCedula,
                fotoCarnet,
                fotoCarnetRecorte,
                fotoCarnetPosX,
                fotoCarnetPosY,
                fotoCarnetZoom,
                evento_id
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
                error.message.includes('cédula') ||
                error.message.includes('Cedula') ||
                error.message.includes('número de camiseta') ||
                error.message.includes('no puede estar en dos equipos')) {
                return res.status(400).json({
                    error: error.message
                });
            }

            res.status(500).json({
                error: 'Error interno del servidor',
                detalle: error.message
            });
        }
    },

    // CREATE - Importación masiva de jugadores (filas ya normalizadas en frontend)
    importarJugadoresMasivo: async (req, res) => {
        try {
            const equipo_id = Number(req.body?.equipo_id);
            const evento_id = Number(req.body?.evento_id);
            const filas = Array.isArray(req.body?.jugadores) ? req.body.jugadores : [];

            if (!Number.isFinite(equipo_id) || equipo_id <= 0) {
                return res.status(400).json({ error: "equipo_id inválido" });
            }
            if (!(await validarAccesoTecnicoEquipo(req, res, equipo_id))) {
                return;
            }

            if (!filas.length) {
                return res.status(400).json({ error: "No se recibieron jugadores para importar" });
            }

            if (filas.length > 500) {
                return res.status(400).json({ error: "Máximo 500 filas por importación" });
            }

            const reglasDocs = await obtenerReglasDocumentosPorEquipo(equipo_id);
            const creados = [];
            const errores = [];

            for (let i = 0; i < filas.length; i += 1) {
                const row = filas[i] || {};
                const nombre = String(row.nombre || "").trim();
                const apellido = String(row.apellido || "").trim();
                const cedidentidad = normalizarCedulaController(row.cedidentidad || row.cedula || "");
                const fecha_nacimiento = row.fecha_nacimiento ? String(row.fecha_nacimiento).trim() : null;
                const posicion = row.posicion ? String(row.posicion).trim() : null;
                const numero_camiseta = Number.isFinite(Number(row.numero_camiseta))
                    ? Number(row.numero_camiseta)
                    : null;
                const foto_cedula_url_raw = row.foto_cedula_url || row.foto_cedula || null;
                const foto_carnet_url_raw = row.foto_carnet_url || row.foto_carnet || null;
                const foto_cedula_url = foto_cedula_url_raw ? String(foto_cedula_url_raw).trim() : null;
                const foto_carnet_url = foto_carnet_url_raw ? String(foto_carnet_url_raw).trim() : null;

                const capRaw = String(row.es_capitan ?? row.capitan ?? "").trim().toLowerCase();
                const es_capitan = capRaw === "si" || capRaw === "sí" || capRaw === "true" || capRaw === "1";

                if (!nombre || !apellido) {
                    errores.push({
                        fila: i + 1,
                        error: "nombre y apellido son obligatorios"
                    });
                    continue;
                }
                if (reglasDocs.requiere_cedula_jugador && !cedidentidad) {
                    errores.push({
                        fila: i + 1,
                        error: "Este campeonato exige cedidentidad"
                    });
                    continue;
                }

                if (reglasDocs.requiere_foto_cedula && !foto_cedula_url) {
                    errores.push({
                        fila: i + 1,
                        cedidentidad,
                        error: "Este campeonato exige foto de cédula"
                    });
                    continue;
                }

                if (reglasDocs.requiere_foto_carnet && !foto_carnet_url) {
                    errores.push({
                        fila: i + 1,
                        cedidentidad,
                        error: "Este campeonato exige foto carné"
                    });
                    continue;
                }

                try {
                    const jugador = await Jugador.crear(
                        equipo_id,
                        nombre,
                        apellido,
                        cedidentidad,
                        fecha_nacimiento,
                        posicion,
                        numero_camiseta,
                        es_capitan,
                        foto_cedula_url,
                        foto_carnet_url,
                        null,
                        50,
                        35,
                        1,
                        Number.isFinite(evento_id) ? evento_id : null
                    );
                    creados.push(jugador);
                } catch (errorFila) {
                    errores.push({
                        fila: i + 1,
                        cedidentidad,
                        error: errorFila.message || "Error importando jugador"
                    });
                }
            }

            return res.json({
                ok: true,
                equipo_id,
                total_filas: filas.length,
                total_creados: creados.length,
                total_errores: errores.length,
                creados,
                errores
            });
        } catch (error) {
            console.error("Error en importación masiva de jugadores:", error);
            return res.status(500).json({
                error: "Error en importación masiva",
                detalle: error.message
            });
        }
    },

    // LEER - Obtener jugadores por equipo
    obtenerJugadoresPorEquipo: async (req, res) => {
        try {
            const { equipo_id } = req.params;
            const eventoId = Number.parseInt(req.query?.evento_id, 10);
            if (!(await validarAccesoTecnicoEquipo(req, res, equipo_id))) {
                return;
            }
            
            let jugadores = await Jugador.obtenerPorEquipo(
                equipo_id,
                Number.isFinite(eventoId) && eventoId > 0 ? eventoId : null
            );

            if (Number.isFinite(eventoId) && eventoId > 0 && jugadores.length) {
                const estadoDisciplinario = await Partido.obtenerEstadoDisciplinarioEquipoEnEvento(
                    eventoId,
                    equipo_id,
                    jugadores
                );

                jugadores = jugadores.map((jugador) => ({
                    ...jugador,
                    suspension: estadoDisciplinario.get(Number.parseInt(jugador.id, 10)) || null,
                }));
            }
            
            res.json({
                mensaje: `Jugadores del equipo ${equipo_id}`,
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
            const equiposPermitidos = await obtenerEquiposPermitidosTecnico(req);
            let jugadores = [];

            if (equiposPermitidos === null) {
                jugadores = await Jugador.obtenerTodos();
            } else {
                const jugadoresPorEquipo = await Promise.all(
                    equiposPermitidos.map((equipoId) => Jugador.obtenerPorEquipo(equipoId))
                );
                jugadores = jugadoresPorEquipo.flat();
            }
            
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
            if (!(await validarAccesoTecnicoEquipo(req, res, jugador.equipo_id))) {
                return;
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

    buscarJugadorPorCedula: async (req, res) => {
        try {
                const cedula = normalizarCedulaController(req.params?.cedula || "");
                if (!cedula) {
                    return res.status(400).json({ error: "Debes indicar una cédula válida." });
                }

            const jugador = await Jugador.buscarPerfilPorCedula(cedula);
            return res.json({
                encontrado: Boolean(jugador),
                jugador: jugador || null,
            });
        } catch (error) {
            console.error("Error buscando jugador por cédula:", error);
            return res.status(500).json({
                error: "Error buscando jugador por cédula",
                detalle: error.message,
            });
        }
    },

    // ACTUALIZAR - Modificar jugador
    actualizarJugador: async (req, res) => {
        try {
            const { id } = req.params;
            const datos = req.body;
            const eventoIdContexto = Number.parseInt(datos?.evento_id, 10);
            if (req.fileValidationError) {
                return res.status(400).json({ error: req.fileValidationError });
            }
            const fotoCedula = construirUrlArchivoJugador(req, req.files?.foto_cedula?.[0]);
            const fotoCarnet = construirUrlArchivoJugador(req, req.files?.foto_carnet?.[0]);
            const fotoCarnetRecorte = construirUrlArchivoJugador(req, req.files?.foto_carnet_recorte?.[0]);
            const eliminarFotoCedula = parseBooleanFlag(datos.eliminar_foto_cedula);
            const eliminarFotoCarnet = parseBooleanFlag(datos.eliminar_foto_carnet);

            if (fotoCedula) datos.foto_cedula_url = fotoCedula;
            if (fotoCarnet) datos.foto_carnet_url = fotoCarnet;
            if (fotoCarnetRecorte) datos.foto_carnet_recorte_url = fotoCarnetRecorte;
            if (datos.foto_carnet_pos_x !== undefined) {
                datos.foto_carnet_pos_x = parsePhotoPosition(datos.foto_carnet_pos_x, 50);
            }
            if (datos.foto_carnet_pos_y !== undefined) {
                datos.foto_carnet_pos_y = parsePhotoPosition(datos.foto_carnet_pos_y, 35);
            }
            if (datos.foto_carnet_zoom !== undefined) {
                datos.foto_carnet_zoom = parsePhotoZoom(datos.foto_carnet_zoom, 1);
            }
            if (eliminarFotoCedula && !fotoCedula) datos.foto_cedula_url = null;
            if (eliminarFotoCarnet && !fotoCarnet) {
                datos.foto_carnet_url = null;
                datos.foto_carnet_recorte_url = null;
            }
            delete datos.eliminar_foto_cedula;
            delete datos.eliminar_foto_carnet;

            // Validación de requisitos del campeonato en actualización.
            const jugadorActual = await Jugador.obtenerPorId(id);
            if (!jugadorActual) {
                return res.status(404).json({
                    error: 'Jugador no encontrado'
                });
            }
            if (!(await validarAccesoTecnicoEquipo(req, res, jugadorActual.equipo_id))) {
                return;
            }
            if (datos.equipo_id && !(await validarAccesoTecnicoEquipo(req, res, datos.equipo_id))) {
                return;
            }

            const equipoEvaluar = Number(datos.equipo_id || jugadorActual.equipo_id);
            const reglasDocs = await obtenerReglasDocumentosPorEquipo(equipoEvaluar);
            const fotoCedulaFinal =
                Object.prototype.hasOwnProperty.call(datos, "foto_cedula_url")
                    ? datos.foto_cedula_url
                    : jugadorActual.foto_cedula_url || null;
            const fotoCarnetFinal =
                Object.prototype.hasOwnProperty.call(datos, "foto_carnet_url")
                    ? datos.foto_carnet_url
                    : jugadorActual.foto_carnet_url || null;
            const cedulaFinal = datos.cedidentidad ?? jugadorActual.cedidentidad ?? null;

            if (reglasDocs.requiere_cedula_jugador && !String(cedulaFinal || "").trim()) {
                return res.status(400).json({
                    error: "Este campeonato exige cédula de identidad para el jugador"
                });
            }
            if (reglasDocs.requiere_foto_cedula && !fotoCedulaFinal) {
                return res.status(400).json({
                    error: "Este campeonato exige foto de cédula para el jugador"
                });
            }
            if (reglasDocs.requiere_foto_carnet && !fotoCarnetFinal) {
                return res.status(400).json({
                    error: "Este campeonato exige foto carné para el jugador"
                });
            }

            datos.evento_id_contexto = Number.isFinite(eventoIdContexto) ? eventoIdContexto : null;
            if (datos.evento_id_contexto) {
                datos.evento_id = datos.evento_id_contexto;
            } else {
                delete datos.evento_id;
            }

            const jugadorActualizado = await Jugador.actualizar(id, datos);

            if (!jugadorActualizado) {
                return res.status(404).json({
                    error: 'Jugador no encontrado'
                });
            }

            if (jugadorActual.foto_cedula_url && jugadorActual.foto_cedula_url !== (jugadorActualizado.foto_cedula_url || null)) {
                eliminarArchivoJugador(jugadorActual.foto_cedula_url);
            }
            if (jugadorActual.foto_carnet_url && jugadorActual.foto_carnet_url !== (jugadorActualizado.foto_carnet_url || null)) {
                eliminarArchivoJugador(jugadorActual.foto_carnet_url);
            }
            if (
                jugadorActual.foto_carnet_recorte_url &&
                jugadorActual.foto_carnet_recorte_url !== (jugadorActualizado.foto_carnet_recorte_url || null)
            ) {
                eliminarArchivoJugador(jugadorActual.foto_carnet_recorte_url);
            }

            res.json({
                mensaje: '✅ Jugador actualizado exitosamente',
                jugador: jugadorActualizado
            });

        } catch (error) {
            console.error('Error actualizando jugador:', error);
            if (error.message.includes('Límite') ||
                error.message.includes('Equipo no encontrado') ||
                error.message.includes('cédula') ||
                error.message.includes('Cedula') ||
                error.message.includes('número de camiseta') ||
                error.message.includes('no puede estar en dos equipos') ||
                error.message.includes('Solo se permite bajar jugadores')) {
                return res.status(400).json({
                    error: error.message
                });
            }
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
            const jugadorActual = await Jugador.obtenerPorId(id);
            if (!jugadorActual) {
                return res.status(404).json({
                    error: 'Jugador no encontrado'
                });
            }
            if (!(await validarAccesoTecnicoEquipo(req, res, jugadorActual.equipo_id))) {
                return;
            }
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
            if (!(await validarAccesoTecnicoEquipo(req, res, equipo_id))) {
                return;
            }

            const jugadorActual = await Jugador.obtenerPorId(jugador_id);
            if (!jugadorActual) {
                return res.status(404).json({
                    error: 'Jugador no encontrado'
                });
            }
            if (Number(jugadorActual.equipo_id) !== Number(equipo_id)) {
                return res.status(400).json({
                    error: 'El jugador no pertenece al equipo seleccionado'
                });
            }

            const eventoId = Number.parseInt(req.body?.evento_id, 10);
            const capitan = await Jugador.designarCapitan(
                jugador_id,
                equipo_id,
                Number.isFinite(eventoId) ? eventoId : null
            );

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
