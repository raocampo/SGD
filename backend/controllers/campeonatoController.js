const fs = require("fs");
const pool = require("../config/database");
const Campeonato = require("../models/Campeonato");
const { obtenerPlanUsuarioPorId } = require("../services/planLimits");
const { resolveUploadPath } = require("../config/uploads");

function esOrganizador(user) {
  return String(user?.rol || "").toLowerCase() === "organizador";
}

function esAdministrador(user) {
  return String(user?.rol || "").toLowerCase() === "administrador";
}

function organizadorCoincideConTexto(user, campeonato) {
  const campo = String(campeonato?.organizador || "").trim().toLowerCase();
  if (!campo) return false;
  const nombre = String(user?.nombre || "").trim().toLowerCase();
  const organizacion = String(user?.organizacion_nombre || "").trim().toLowerCase();
  const email = String(user?.email || "").trim().toLowerCase();
  return campo === nombre || campo === organizacion || campo === email;
}

async function puedeAccederCampeonato(req, campeonato) {
  if (!esOrganizador(req?.user)) return true;
  if (!campeonato) return false;

  const creador = Number.parseInt(campeonato.creador_usuario_id, 10);
  const userId = Number.parseInt(req.user?.id, 10);
  if (Number.isFinite(creador) && creador > 0) {
    return creador === userId;
  }

  if (organizadorCoincideConTexto(req.user, campeonato)) {
    await Campeonato.asignarCreador(campeonato.id, userId);
    return true;
  }

  return false;
}

function parseBooleanFlag(value) {
  return value === true || String(value || "").trim().toLowerCase() === "true";
}

function safeUnlinkUpload(relativeUrl) {
  if (!relativeUrl) return;
  const filePath = resolveUploadPath(relativeUrl);
  fs.unlink(filePath, (err) => {
    if (err) {
      console.warn("No se pudo eliminar archivo de campeonato:", err.message);
    }
  });
}

const campeonatoController = {
  // Crear nuevo campeonato
  crearCampeonato: async (req, res) => {
    try {
      const {
        nombre,
        organizador,
        fecha_inicio,
        fecha_fin,
        tipo_futbol,
        sistema_puntuacion,
        max_equipos,
        min_jugador,
        max_jugador,
        color_primario,
        color_secundario,
        color_acento,
        requiere_cedula_jugador = true,
        requiere_foto_cedula = false,
        requiere_foto_carnet = false,
        genera_carnets = false,
        costo_arbitraje = 0,
        costo_tarjeta_amarilla = 0,
        costo_tarjeta_roja = 0,
        costo_carnet = 0,
        bloquear_morosos = false,
        bloqueo_morosidad_monto = 0,
      } = req.body;
      const userId = Number.parseInt(req.user?.id, 10);
      const plan = Number.isFinite(userId) && userId > 0
        ? await obtenerPlanUsuarioPorId(userId)
        : null;
      const esAdmin = esAdministrador(req.user);
      const limiteJugadoresPlan = plan?.max_jugadores_por_equipo;
      const limiteEquiposPlan = plan?.max_equipos_por_campeonato;

      // Validaciones básicas
      /*if (!nombre || !tipo_futbol) {
                return res.status(400).json({
                    error: 'Nombre y tipo de fútbol son obligatorios'
                });
            }*/
      if (!nombre || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({
          error: "nombre, fecha_inicio y fecha_fin son obligatorios",
        });
      }

      if (!esAdmin && plan?.max_campeonatos !== null && plan?.max_campeonatos !== undefined) {
        const nombreUser = String(req.user?.nombre || "").trim().toLowerCase();
        const organizacionUser = String(req.user?.organizacion_nombre || "").trim().toLowerCase();
        const emailUser = String(req.user?.email || "").trim().toLowerCase();
        const countR = await pool.query(
          `
            SELECT COUNT(*)::int AS total
            FROM campeonatos
            WHERE creador_usuario_id = $1
               OR (
                 creador_usuario_id IS NULL
                 AND LOWER(COALESCE(TRIM(organizador), '')) = ANY($2::text[])
               )
          `,
          [userId, [nombreUser, organizacionUser, emailUser].filter(Boolean)]
        );
        const totalActual = Number(countR.rows[0]?.total || 0);
        if (totalActual >= plan.max_campeonatos) {
          return res.status(400).json({
            error: `Tu plan ${plan.nombre} permite máximo ${plan.max_campeonatos} campeonatos`,
          });
        }
      }

      if (
        !esAdmin &&
        limiteEquiposPlan !== null &&
        limiteEquiposPlan !== undefined &&
        max_equipos !== undefined &&
        max_equipos !== null &&
        String(max_equipos).trim() !== ""
      ) {
        const maxEquiposNum = Number.parseInt(max_equipos, 10);
        if (Number.isFinite(maxEquiposNum) && maxEquiposNum > limiteEquiposPlan) {
          return res.status(400).json({
            error: `Tu plan ${plan.nombre} permite máximo ${limiteEquiposPlan} equipos por campeonato`,
          });
        }
      }

      if (
        !esAdmin &&
        limiteJugadoresPlan !== null &&
        limiteJugadoresPlan !== undefined &&
        max_jugador !== undefined &&
        max_jugador !== null &&
        String(max_jugador).trim() !== ""
      ) {
        const maxJugadoresNum = Number.parseInt(max_jugador, 10);
        if (Number.isFinite(maxJugadoresNum) && maxJugadoresNum > limiteJugadoresPlan) {
          return res.status(400).json({
            error: `Tu plan ${plan.nombre} permite máximo ${limiteJugadoresPlan} jugadores por equipo`,
          });
        }
      }

      if (!esAdmin && genera_carnets === true && plan?.permite_carnets === false) {
        return res.status(400).json({
          error: `Tu plan ${plan.nombre} no permite generar carnés`,
        });
      }

      if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
      }

      const logoFile = req.files?.logo?.[0] || req.file || null;
      const carnetFondoFile = req.files?.carnet_fondo?.[0] || null;
      const logo_url = logoFile ? `/uploads/campeonatos/${logoFile.filename}` : null;
      const carnet_fondo_url = carnetFondoFile
        ? `/uploads/campeonatos/carnets/${carnetFondoFile.filename}`
        : null;
      const organizadorFinal =
        organizador ||
        req.user?.organizacion_nombre ||
        req.user?.nombre ||
        req.user?.email ||
        null;

      const nuevoCampeonato = await Campeonato.crear(
        nombre,
        organizadorFinal,
        fecha_inicio,
        fecha_fin,
        tipo_futbol,
        sistema_puntuacion,
        max_equipos,
        min_jugador,
        max_jugador,
        color_primario,
        color_secundario,
        color_acento,
        logo_url,
        requiere_cedula_jugador,
        requiere_foto_cedula,
        requiere_foto_carnet,
        genera_carnets,
        req.user?.id || null,
        costo_arbitraje,
        costo_tarjeta_amarilla,
        costo_tarjeta_roja,
        costo_carnet,
        bloquear_morosos,
        bloqueo_morosidad_monto,
        carnet_fondo_url
      );

      res.status(201).json({
        mensaje: "🏆 Campeonato creado exitosamente",
        campeonato: nuevoCampeonato,
      });
    } catch (error) {
      console.error("Error creando campeonato:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // Obtener todos los campeonatos
  obtenerCampeonatos: async (req, res) => {
    try {
      const campeonatosAll = await Campeonato.obtenerTodos();
      let campeonatos = campeonatosAll;

      if (esOrganizador(req.user)) {
        const filtrados = [];
        for (const c of campeonatosAll) {
          if (await puedeAccederCampeonato(req, c)) filtrados.push(c);
        }
        campeonatos = filtrados;
      }

      res.json({
        mensaje: "📋 Lista de campeonatos",
        total: campeonatos.length,
        campeonatos: campeonatos,
      });
    } catch (error) {
      console.error("Error obteniendo campeonatos:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // Obtener campeonato por ID
  obtenerCampeonato: async (req, res) => {
    try {
      const { id } = req.params;
      const campeonato = await Campeonato.obtenerPorId(id);

      if (!campeonato) {
        return res.status(404).json({
          error: "Campeonato no encontrado",
        });
      }
      if (!(await puedeAccederCampeonato(req, campeonato))) {
        return res.status(403).json({ error: "No autorizado para consultar este campeonato" });
      }

      res.json({
        mensaje: "📖 Detalles del campeonato",
        campeonato: campeonato,
      });
    } catch (error) {
      console.error("Error obteniendo campeonato:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // Actualizar campeonato
  actualizarCampeonato: async (req, res) => {
    try {
      const { id } = req.params;
      const datos = req.body;
      const campeonatoActual = await Campeonato.obtenerPorId(id);
      if (!campeonatoActual) {
        return res.status(404).json({
          error: "Campeonato no encontrado",
        });
      }
      if (!(await puedeAccederCampeonato(req, campeonatoActual))) {
        return res.status(403).json({ error: "No autorizado para actualizar este campeonato" });
      }

      const userId = Number.parseInt(req.user?.id, 10);
      const plan = Number.isFinite(userId) && userId > 0
        ? await obtenerPlanUsuarioPorId(userId)
        : null;
      const esAdmin = esAdministrador(req.user);

      if (
        !esAdmin &&
        plan?.max_equipos_por_campeonato !== null &&
        plan?.max_equipos_por_campeonato !== undefined &&
        datos.max_equipos !== undefined &&
        datos.max_equipos !== null &&
        String(datos.max_equipos).trim() !== ""
      ) {
        const maxEquiposNum = Number.parseInt(datos.max_equipos, 10);
        if (Number.isFinite(maxEquiposNum) && maxEquiposNum > plan.max_equipos_por_campeonato) {
          return res.status(400).json({
            error: `Tu plan ${plan.nombre} permite máximo ${plan.max_equipos_por_campeonato} equipos por campeonato`,
          });
        }
      }

      if (
        !esAdmin &&
        plan?.max_jugadores_por_equipo !== null &&
        plan?.max_jugadores_por_equipo !== undefined &&
        datos.max_jugador !== undefined &&
        datos.max_jugador !== null &&
        String(datos.max_jugador).trim() !== ""
      ) {
        const maxJugadoresNum = Number.parseInt(datos.max_jugador, 10);
        if (Number.isFinite(maxJugadoresNum) && maxJugadoresNum > plan.max_jugadores_por_equipo) {
          return res.status(400).json({
            error: `Tu plan ${plan.nombre} permite máximo ${plan.max_jugadores_por_equipo} jugadores por equipo`,
          });
        }
      }

      if (datos.requiere_foto_cedula !== undefined) {
        datos.requiere_foto_cedula =
          datos.requiere_foto_cedula === true ||
          String(datos.requiere_foto_cedula).toLowerCase() === "true";
      }
      if (datos.requiere_cedula_jugador !== undefined) {
        datos.requiere_cedula_jugador =
          datos.requiere_cedula_jugador === true ||
          String(datos.requiere_cedula_jugador).toLowerCase() === "true";
      }
      if (datos.requiere_foto_carnet !== undefined) {
        datos.requiere_foto_carnet =
          datos.requiere_foto_carnet === true ||
          String(datos.requiere_foto_carnet).toLowerCase() === "true";
      }
      if (datos.genera_carnets !== undefined) {
        datos.genera_carnets =
          datos.genera_carnets === true ||
          String(datos.genera_carnets).toLowerCase() === "true";

        if (!esAdmin && datos.genera_carnets === true && plan?.permite_carnets === false) {
          return res.status(400).json({
            error: `Tu plan ${plan.nombre} no permite generar carnés`,
          });
        }
      }
      if (datos.bloquear_morosos !== undefined) {
        datos.bloquear_morosos =
          datos.bloquear_morosos === true ||
          String(datos.bloquear_morosos).toLowerCase() === "true";
      }
      if (datos.bloqueo_morosidad_monto !== undefined) {
        const monto = Number.parseFloat(String(datos.bloqueo_morosidad_monto).replace(",", "."));
        datos.bloqueo_morosidad_monto = Number.isFinite(monto) && monto >= 0 ? monto : 0;
      }

      if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
      }

      const logoFile = req.files?.logo?.[0] || req.file || null;
      const carnetFondoFile = req.files?.carnet_fondo?.[0] || null;
      const eliminarCarnetFondo = parseBooleanFlag(datos.eliminar_carnet_fondo);

      if (logoFile) {
        datos.logo_url = `/uploads/campeonatos/${logoFile.filename}`;
      }
      if (carnetFondoFile) {
        datos.carnet_fondo_url = `/uploads/campeonatos/carnets/${carnetFondoFile.filename}`;
      } else if (eliminarCarnetFondo) {
        datos.carnet_fondo_url = null;
      }
      delete datos.eliminar_carnet_fondo;

      const campeonatoActualizado = await Campeonato.actualizar(id, datos);

      if (!campeonatoActualizado) {
        return res.status(404).json({
          error: "Campeonato no encontrado",
        });
      }

      if (
        Object.prototype.hasOwnProperty.call(datos, "carnet_fondo_url") &&
        campeonatoActual.carnet_fondo_url &&
        campeonatoActual.carnet_fondo_url !== (campeonatoActualizado.carnet_fondo_url || null)
      ) {
        safeUnlinkUpload(campeonatoActual.carnet_fondo_url);
      }

      res.json({
        mensaje: "✅ Campeonato actualizado exitosamente",
        campeonato: campeonatoActualizado,
      });
    } catch (error) {
      console.error("Error actualizando campeonato:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // Eliminar campeonato
  eliminarCampeonato: async (req, res) => {
    try {
      const { id } = req.params;
      const campeonatoActual = await Campeonato.obtenerPorId(id);
      if (!campeonatoActual) {
        return res.status(404).json({
          error: "Campeonato no encontrado",
        });
      }
      if (!(await puedeAccederCampeonato(req, campeonatoActual))) {
        return res.status(403).json({ error: "No autorizado para eliminar este campeonato" });
      }

      const campeonatoEliminado = await Campeonato.eliminar(id);

      if (!campeonatoEliminado) {
        return res.status(404).json({
          error: "Campeonato no encontrado",
        });
      }

      if (campeonatoEliminado.logo_url) {
        safeUnlinkUpload(campeonatoEliminado.logo_url);
      }
      if (campeonatoEliminado.carnet_fondo_url) {
        safeUnlinkUpload(campeonatoEliminado.carnet_fondo_url);
      }

      res.json({
        mensaje: "🗑️ Campeonato eliminado exitosamente",
        campeonato: campeonatoEliminado,
      });
    } catch (error) {
      console.error("Error eliminando campeonato:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // Cambiar estado del torneo
  cambiarEstado: async (req, res) => {
    try {
      const { id } = req.params;
      const { estado } = req.body;
      const campeonatoActual = await Campeonato.obtenerPorId(id);
      if (!campeonatoActual) {
        return res.status(404).json({ error: "Campeonato no encontrado" });
      }
      if (!(await puedeAccederCampeonato(req, campeonatoActual))) {
        return res.status(403).json({ error: "No autorizado para cambiar el estado de este campeonato" });
      }

      if (!estado) {
        return res.status(400).json({
          error: "El campo 'estado' es obligatorio",
        });
      }

      const campeonato = await Campeonato.cambiarEstado(id, estado);

      if (!campeonato) {
        return res.status(404).json({
          error: "Campeonato no encontrado",
        });
      }

      res.json({
        mensaje: "✅ Estado actualizado",
        campeonato,
      });
    } catch (error) {
      console.error("Error cambiando estado:", error);
      res.status(400).json({
        error: error.message,
        detalle: error.message,
      });
    }
  },
};

module.exports = campeonatoController;
