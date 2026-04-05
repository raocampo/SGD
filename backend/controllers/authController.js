const pool = require("../config/database");
const UsuarioAuth = require("../models/UsuarioAuth");
const OrganizadorPortal = require("../models/OrganizadorPortal");
const {
  isOrganizador,
  obtenerEquipoIdsOrganizador,
} = require("../services/organizadorScope");
const {
  enviarEmailRecuperacionPassword,
  enviarEmailBienvenida,
  enviarEmailNotificacionAdminNuevoRegistro,
} = require("../services/emailService");
const {
  buildSessionPayload,
  cerrarSession,
  crearSession,
  permisosPorRol,
  refrescarSession,
} = require("../services/sessionService");
const {
  PLANES,
  normalizarPlanCodigo,
  esPlanPublico,
  esPlanPagado,
  obtenerPlan,
  obtenerCatalogoPreciosPublicos,
  obtenerPreciosPlanes,
  actualizarPrecioPlan,
  obtenerFormasPago,
  actualizarFormasPago,
} = require("../services/planLimits");
const ROLES_REGISTRO_PUBLICO = new Set(["organizador", "dirigente", "tecnico", "jugador"]);

function esAdministrador(user) {
  return String(user?.rol || "").toLowerCase() === "administrador";
}

function estaContenido(subset = [], superset = []) {
  const setSuper = new Set((superset || []).map((x) => Number.parseInt(x, 10)));
  return (subset || []).every((x) => setSuper.has(Number.parseInt(x, 10)));
}

function planLandingHabilitado(planCodigo) {
  return esPlanPagado(planCodigo);
}

async function sincronizarPerfilOrganizador(usuario, data = {}) {
  if (String(usuario?.rol || "").toLowerCase() !== "organizador") return;

  const organizacionNombre = String(
    data.organizacion_nombre ?? usuario.organizacion_nombre ?? ""
  ).trim();
  const lema = String(data.lema ?? "").trim();
  const contactEmail = String(
    data.contact_email_publico ?? data.contact_email ?? usuario.email ?? ""
  ).trim();
  const contactPhone = String(data.contact_phone ?? "").trim();

  await OrganizadorPortal.guardarConfig(usuario.id, {
    organizacion_nombre: organizacionNombre || null,
    lema: lema || null,
    contact_email: contactEmail || null,
    contact_phone: contactPhone || null,
  });
}

async function listarUsuariosVisiblesPorOrganizador(user) {
  const equiposPermitidos = await obtenerEquipoIdsOrganizador(user);
  if (!equiposPermitidos?.length) return [];

  const ROLES_VISIBLES = new Set(["dirigente", "tecnico"]);
  const usuarios = await UsuarioAuth.listar();
  return usuarios.filter((u) => {
    if (!ROLES_VISIBLES.has(String(u.rol || "").toLowerCase())) return false;
    if (!Array.isArray(u.equipo_ids) || !u.equipo_ids.length) return false;
    return estaContenido(u.equipo_ids, equiposPermitidos);
  });
}

const authController = {
  async bootstrapStatus(req, res) {
    try {
      const total = await UsuarioAuth.contarUsuarios();
      return res.json({
        ok: true,
        total_usuarios: total,
        requiere_registro_inicial: total === 0,
      });
    } catch (error) {
      console.error("Error bootstrapStatus:", error);
      return res.status(500).json({ error: "No se pudo validar el estado inicial" });
    }
  },

  async bootstrapRegister(req, res) {
    try {
      const total = await UsuarioAuth.contarUsuarios();
      if (total > 0) {
        return res.status(409).json({ error: "El registro inicial ya fue completado" });
      }

      const nombre = String(req.body?.nombre || "").trim();
      const email = String(req.body?.email || "").trim();
      const password = String(req.body?.password || "");
      if (!nombre || !email || !password) {
        return res.status(400).json({ error: "nombre, email y password son obligatorios" });
      }

      const creado = await UsuarioAuth.crear({
        nombre,
        email,
        password,
        rol: "administrador",
        activo: true,
        debe_cambiar_password: false,
      });
      const user = await UsuarioAuth.obtenerPorId(creado.id);
      const limpio = UsuarioAuth.limpiarUsuario(user || creado);
      const session = await crearSession(limpio, {
        client_type: req.body?.client_type || "web",
        user_agent: req.headers["user-agent"] || null,
        ip_address: req.ip,
      });

      return res.status(201).json(session);
    } catch (error) {
      console.error("Error bootstrapRegister:", error);
      const msg = String(error?.message || "");
      const status =
        msg.includes("obligatorio") ||
        msg.includes("invalido") ||
        msg.includes("username") ||
        msg.includes("Ya existe") ||
        msg.includes("password")
          ? 400
          : 500;
      return res.status(status).json({ error: msg || "No se pudo completar registro inicial" });
    }
  },

  async registerPublic(req, res) {
    try {
      const nombre = String(req.body?.nombre || "").trim();
      const email = String(req.body?.email || "").trim();
      const password = String(req.body?.password || "");
      const rolSolicitado = String(req.body?.rol || "").trim().toLowerCase();
      const organizacionNombre = String(req.body?.organizacion_nombre || "").trim();
      const planCodigoRaw = String(req.body?.plan_codigo || "demo").trim().toLowerCase();

      if (!nombre || !email || !password || !rolSolicitado) {
        return res.status(400).json({ error: "nombre, email, password y rol son obligatorios" });
      }
      if (!ROLES_REGISTRO_PUBLICO.has(rolSolicitado)) {
        return res.status(400).json({ error: "rol invalido. Use: organizador, dirigente, tecnico o jugador" });
      }
      if (rolSolicitado === "organizador" && !organizacionNombre) {
        return res.status(400).json({
          error: "organizacion_nombre es obligatorio para organizador",
        });
      }
      if (!esPlanPublico(planCodigoRaw)) {
        return res.status(400).json({ error: "plan invalido. Use: demo, free, base, competencia o premium" });
      }
      const planCodigo = normalizarPlanCodigo(planCodigoRaw, "demo");
      const plan = obtenerPlan(planCodigo);

      // Planes pagados quedan en pendiente_pago hasta que el admin confirme el cobro
      const planEstadoInicial = esPlanPagado(planCodigo) ? "pendiente_pago" : "activo";

      const creado = await UsuarioAuth.crear({
        nombre,
        email,
        password,
        rol: rolSolicitado,
        activo: true,
        solo_lectura: false,
        debe_cambiar_password: false,
        plan_codigo: planCodigo,
        plan_estado: planEstadoInicial,
        organizacion_nombre: rolSolicitado === "organizador" ? organizacionNombre : null,
      });

      if (rolSolicitado === "organizador") {
        await sincronizarPerfilOrganizador(creado, {
          organizacion_nombre: organizacionNombre,
          contact_email_publico: email,
          lema: req.body?.lema,
          contact_phone: req.body?.contact_phone,
        });
      }

      const user = await UsuarioAuth.obtenerPorId(creado.id);
      const limpio = UsuarioAuth.limpiarUsuario(user || creado);

      // Enviar emails en background (sin bloquear respuesta al usuario)
      Promise.allSettled([
        enviarEmailBienvenida({
          nombre: limpio.nombre,
          email: limpio.email,
          rol:   limpio.rol,
          plan,
        }),
        enviarEmailNotificacionAdminNuevoRegistro({
          nombre:       limpio.nombre,
          email:        limpio.email,
          rol:          limpio.rol,
          plan,
          organizacion: rolSolicitado === "organizador" ? organizacionNombre : null,
        }),
      ]).catch(() => {});

      // Plan pagado: NO crear sesión — el acceso se activa cuando el admin confirme el pago
      if (planEstadoInicial === "pendiente_pago") {
        return res.status(201).json({
          ok: true,
          pendiente_pago: true,
          plan_nombre: plan?.nombre || planCodigo,
          mensaje: `Cuenta registrada en ${plan?.nombre || planCodigo}. El acceso se activará una vez confirmado el pago.`,
        });
      }

      const session = await crearSession(limpio, {
        client_type: req.body?.client_type || "web",
        user_agent: req.headers["user-agent"] || null,
        ip_address: req.ip,
      });

      return res.status(201).json({
        ...session,
        mensaje: `Cuenta creada en plan ${plan?.nombre || planCodigo}`,
      });
    } catch (error) {
      console.error("Error registerPublic:", error);
      const msg = String(error?.message || "");
      const status =
        msg.includes("obligatorio") ||
        msg.includes("invalido") ||
        msg.includes("Ya existe") ||
        msg.includes("password")
          ? 400
          : 500;
      return res.status(status).json({ error: msg || "No se pudo completar el registro" });
    }
  },

  async login(req, res) {
    try {
      const identificador = String(
        req.body?.identificador || req.body?.email || req.body?.username || ""
      ).trim();
      const password = String(req.body?.password || "");
      if (!identificador || !password) {
        return res.status(400).json({ error: "identificador y password son obligatorios" });
      }

      const user = await UsuarioAuth.validarCredenciales(identificador, password);
      if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

      if (String(user.plan_estado || "").toLowerCase() === "pendiente_pago") {
        const plan = obtenerPlan(user.plan_codigo);
        return res.status(402).json({
          codigo: "pendiente_pago",
          plan_nombre: plan?.nombre || user.plan_codigo,
          error: "Tu cuenta está registrada pero el pago aún no ha sido confirmado. Comunícate con LT&C para activar tu acceso.",
        });
      }

      const session = await crearSession(user, {
        client_type: req.body?.client_type || "web",
        user_agent: req.headers["user-agent"] || null,
        ip_address: req.ip,
      });
      return res.json(session);
    } catch (error) {
      console.error("Error login:", error);
      return res.status(500).json({ error: "No se pudo iniciar sesión" });
    }
  },

  async me(req, res) {
    return res.json(
      buildSessionPayload(req.user, {
        accessToken: null,
        refreshToken: null,
        refreshTokenExpiresAt: null,
      })
    );
  },

  async refresh(req, res) {
    try {
      const refreshToken = String(req.body?.refreshToken || req.body?.refresh_token || "").trim();
      if (!refreshToken) {
        return res.status(400).json({ error: "refreshToken es obligatorio" });
      }

      const session = await refrescarSession(refreshToken, {
        client_type: req.body?.client_type || "web",
        user_agent: req.headers["user-agent"] || null,
        ip_address: req.ip,
      });
      return res.json(session);
    } catch (error) {
      console.error("Error refresh:", error);
      const msg = String(error?.message || "");
      const status = msg.includes("refreshToken") ? 401 : 500;
      return res.status(status).json({ error: msg || "No se pudo refrescar la sesión" });
    }
  },

  async logout(req, res) {
    try {
      const refreshToken = String(req.body?.refreshToken || req.body?.refresh_token || "").trim();
      await cerrarSession(refreshToken);
      return res.json({ ok: true, mensaje: "Sesión cerrada" });
    } catch (error) {
      console.error("Error logout:", error);
      return res.status(500).json({ error: "No se pudo cerrar la sesión" });
    }
  },

  async listarUsuarios(req, res) {
    try {
      let usuarios = [];
      if (esAdministrador(req.user)) {
        usuarios = await UsuarioAuth.listar();
      } else if (isOrganizador(req.user)) {
        usuarios = await listarUsuariosVisiblesPorOrganizador(req.user);
      } else {
        return res.status(403).json({ error: "No autorizado para listar usuarios" });
      }
      return res.json({
        ok: true,
        total: usuarios.length,
        usuarios,
      });
    } catch (error) {
      console.error("Error listar usuarios:", error);
      return res.status(500).json({ error: "No se pudo listar usuarios" });
    }
  },

  async landingOrganizadorPublica(req, res) {
    try {
      const organizadorId = Number.parseInt(req.params?.id, 10);
      if (!Number.isFinite(organizadorId) || organizadorId <= 0) {
        return res.status(400).json({ error: "id de organizador invalido" });
      }

      const userRow = await UsuarioAuth.obtenerPorId(organizadorId);
      const organizador = UsuarioAuth.limpiarUsuario(userRow);
      if (!organizador || organizador.activo !== true) {
        return res.status(404).json({ error: "Organizador no encontrado" });
      }
      if (String(organizador.rol || "").toLowerCase() !== "organizador") {
        return res.status(404).json({ error: "Perfil no disponible para landing pública" });
      }

      if (!planLandingHabilitado(organizador.plan_codigo)) {
        return res.status(403).json({
          error:
            "La landing pública está disponible solo para organizadores con plan pagado (Base, Competencia o Premium).",
        });
      }
      if (String(organizador.plan_estado || "activo").toLowerCase() !== "activo") {
        return res.status(403).json({
          error: "La landing pública del organizador está suspendida.",
        });
      }

      const campeonatosR = await pool.query(
        `
          SELECT
            c.*,
            (
              SELECT COUNT(*)::int
              FROM eventos e
              WHERE e.campeonato_id = c.id
            ) AS total_categorias,
            (
              SELECT COUNT(*)::int
              FROM equipos eq
              WHERE eq.campeonato_id = c.id
            ) AS total_equipos,
            (
              SELECT COALESCE(
                json_agg(
                  json_build_object(
                    'id', e.id,
                    'nombre', e.nombre,
                    'total_equipos', (
                      SELECT COUNT(DISTINCT ee.equipo_id)::int
                      FROM evento_equipos ee
                      WHERE ee.evento_id = e.id
                    )
                  )
                  ORDER BY COALESCE(e.numero_campeonato, 999999), e.id
                ),
                '[]'::json
              )
              FROM eventos e
              WHERE e.campeonato_id = c.id
            ) AS categorias_resumen
            ,
            (
              SELECT COALESCE(
                json_agg(
                  json_build_object(
                    'id', eqx.id,
                    'nombre', eqx.nombre,
                    'logo_url', eqx.logo_url
                  )
                  ORDER BY eqx.sort_nombre, eqx.id
                ),
                '[]'::json
              )
              FROM (
                SELECT DISTINCT ON (LOWER(COALESCE(eq.nombre, '')))
                  eq.id,
                  eq.nombre,
                  eq.logo_url,
                  LOWER(COALESCE(eq.nombre, '')) AS sort_nombre
                FROM equipos eq
                WHERE eq.campeonato_id = c.id
                ORDER BY LOWER(COALESCE(eq.nombre, '')), eq.id DESC
              ) eqx
            ) AS equipos_participantes
          FROM campeonatos c
          WHERE c.creador_usuario_id = $1
          ORDER BY c.fecha_inicio DESC NULLS LAST, c.id DESC
        `,
        [organizadorId]
      );

      const [portalConfig, auspiciantes, landingGallery] = await Promise.all([
        OrganizadorPortal.obtenerConfig(organizadorId, pool),
        OrganizadorPortal.listarAuspiciantesConFallback(organizadorId, pool),
        OrganizadorPortal.listarMedia(
          organizadorId,
          { tipo: "landing_gallery", activo: true, campeonato_id: null },
          pool
        ),
      ]);
      const campeonatos = await Promise.all(
        (campeonatosR.rows || []).map(async (campeonato) => {
          const mediaCard = await OrganizadorPortal.obtenerMediaCardCampeonato(
            organizadorId,
            campeonato.id,
            pool
          );
          return {
            ...campeonato,
            card_image_url:
              mediaCard?.imagen_url ||
              portalConfig?.logo_url ||
              campeonato.logo_url ||
              null,
            organizador_logo_url: portalConfig?.logo_url || null,
          };
        })
      );

      return res.json({
        ok: true,
        organizador: {
          id: organizador.id,
          nombre: organizador.nombre,
          organizacion_nombre: organizador.organizacion_nombre || "",
          email: organizador.email,
          plan_codigo: organizador.plan_codigo,
          plan_nombre: obtenerPlan(organizador.plan_codigo)?.nombre || "Plan",
          landing_url: `/index.html?organizador=${organizador.id}`,
        },
        portal_config: portalConfig,
        auspiciantes,
        landing_gallery: landingGallery,
        campeonatos,
      });
    } catch (error) {
      console.error("Error landingOrganizadorPublica:", error);
      return res.status(500).json({ error: "No se pudo cargar la landing del organizador" });
    }
  },

  async crearUsuario(req, res) {
    try {
      const body = { ...(req.body || {}) };
      const equipoId = Number.parseInt(body?.equipo_id, 10);
      const esAdmin = esAdministrador(req.user);

      if (isOrganizador(req.user)) {
        if (!Number.isFinite(equipoId) || equipoId <= 0) {
          return res.status(400).json({ error: "equipo_id es obligatorio para crear dirigente o técnico" });
        }
        const equiposPermitidos = await obtenerEquipoIdsOrganizador(req.user);
        if (!equiposPermitidos.length || !equiposPermitidos.includes(equipoId)) {
          return res.status(403).json({ error: "No autorizado para crear usuarios en ese equipo" });
        }
        const ROLES_ORG = new Set(["dirigente", "tecnico"]);
        const rolSolicitado = String(body?.rol || "dirigente").trim().toLowerCase();
        body.rol = ROLES_ORG.has(rolSolicitado) ? rolSolicitado : "dirigente";
        body.plan_codigo = req.user?.plan_codigo || "free";
        body.plan_estado = "activo";
        body.debe_cambiar_password = true;
      } else if (esAdmin) {
        const rolDestino = String(body?.rol || "").trim().toLowerCase();
        body.debe_cambiar_password = true;
        if (rolDestino === "organizador") {
          const organizacionNombre = String(body?.organizacion_nombre || "").trim();
          if (!organizacionNombre) {
            return res
              .status(400)
              .json({ error: "organizacion_nombre es obligatorio para organizador" });
          }
          body.organizacion_nombre = organizacionNombre;
          body.plan_codigo = normalizarPlanCodigo(body?.plan_codigo, "free");
          body.plan_estado =
            String(body?.plan_estado || "activo").trim().toLowerCase() === "suspendido"
              ? "suspendido"
              : "activo";
        }
      }

      const user = await UsuarioAuth.crear(body);

      if (String(user?.rol || "").toLowerCase() === "organizador") {
        await sincronizarPerfilOrganizador(user, body);
      }

      if (
        (user.rol === "tecnico" || user.rol === "dirigente" || user.rol === "jugador") &&
        Number.isFinite(equipoId) &&
        equipoId > 0
      ) {
        await UsuarioAuth.asignarEquipo(user.id, equipoId);
      }
      const actualizado = await UsuarioAuth.obtenerPorId(user.id);
      return res.status(201).json({
        ok: true,
        usuario: UsuarioAuth.limpiarUsuario(actualizado),
      });
    } catch (error) {
      console.error("Error crear usuario:", error);
      const msg = String(error?.message || "");
      const status =
        msg.includes("obligatorio") ||
        msg.includes("invalido") ||
        msg.includes("username") ||
        msg.includes("Ya existe") ||
        msg.includes("password")
          ? 400
          : 500;
      return res.status(status).json({ error: msg || "No se pudo crear usuario" });
    }
  },

  async asignarEquipo(req, res) {
    try {
      const usuarioId = Number.parseInt(req.params?.id, 10);
      const equipoId = Number.parseInt(req.body?.equipo_id, 10);
      const user = await UsuarioAuth.asignarEquipo(usuarioId, equipoId);
      return res.json({ ok: true, usuario: user });
    } catch (error) {
      console.error("Error asignando equipo a técnico:", error);
      const msg = String(error?.message || "");
      const status =
        msg.includes("invalido") || msg.includes("encontrado") || msg.includes("Solo se pueden")
          ? 400
          : 500;
      return res.status(status).json({ error: msg || "No se pudo asignar equipo" });
    }
  },

  async quitarEquipo(req, res) {
    try {
      const usuarioId = Number.parseInt(req.params?.id, 10);
      const equipoId = Number.parseInt(req.params?.equipo_id, 10);
      const user = await UsuarioAuth.quitarEquipo(usuarioId, equipoId);
      return res.json({ ok: true, usuario: user });
    } catch (error) {
      console.error("Error quitando equipo de técnico:", error);
      const msg = String(error?.message || "");
      const status = msg.includes("invalido") ? 400 : 500;
      return res.status(status).json({ error: msg || "No se pudo quitar equipo" });
    }
  },

  async actualizarUsuario(req, res) {
    try {
      const usuarioId = Number.parseInt(req.params?.id, 10);
      const payload = { ...(req.body || {}) };
      if (payload.password !== undefined && String(payload.password || "").trim() !== "") {
        payload.debe_cambiar_password = true;
      }
      const actualizado = await UsuarioAuth.actualizar(usuarioId, payload);
      await sincronizarPerfilOrganizador(actualizado, payload);
      return res.json({ ok: true, usuario: actualizado });
    } catch (error) {
      console.error("Error actualizando usuario:", error);
      const msg = String(error?.message || "");
      const msgL = msg.toLowerCase();
      const status =
        msgL.includes("obligatorio") ||
        msgL.includes("invalido") ||
        msgL.includes("username") ||
        msgL.includes("ya existe") ||
        msgL.includes("password") ||
        msgL.includes("no hay campos") ||
        msgL.includes("no encontrado")
          ? 400
          : 500;
      return res.status(status).json({ error: msg || "No se pudo actualizar usuario" });
    }
  },

  async eliminarUsuario(req, res) {
    try {
      const usuarioId = Number.parseInt(req.params?.id, 10);
      if (Number(req.user?.id) === usuarioId) {
        return res.status(400).json({ error: "No puedes eliminar tu propio usuario" });
      }

      if (isOrganizador(req.user)) {
        const objetivo = await UsuarioAuth.obtenerPorId(usuarioId);
        const limpio = UsuarioAuth.limpiarUsuario(objetivo);
        if (!limpio) return res.status(404).json({ error: "Usuario no encontrado" });
        const rolObjetivo = String(limpio.rol || "").toLowerCase();
        if (rolObjetivo !== "dirigente" && rolObjetivo !== "tecnico") {
          return res.status(403).json({ error: "Solo puedes eliminar usuarios dirigentes o técnicos" });
        }

        const equiposPermitidos = await obtenerEquipoIdsOrganizador(req.user);
        if (!equiposPermitidos.length) {
          return res.status(403).json({ error: "No tienes equipos habilitados para gestionar usuarios" });
        }
        if (
          !Array.isArray(limpio.equipo_ids) ||
          !limpio.equipo_ids.length ||
          !estaContenido(limpio.equipo_ids, equiposPermitidos)
        ) {
          return res.status(403).json({ error: "No autorizado para eliminar este usuario" });
        }
      }

      const eliminado = await UsuarioAuth.eliminar(usuarioId);
      if (!eliminado) return res.status(404).json({ error: "Usuario no encontrado" });
      return res.json({ ok: true, usuario: eliminado });
    } catch (error) {
      console.error("Error eliminando usuario:", error);
      const msg = String(error?.message || "");
      const status = msg.includes("invalido") ? 400 : 500;
      return res.status(status).json({ error: msg || "No se pudo eliminar usuario" });
    }
  },

  async solicitarRecuperacionPassword(req, res) {
    try {
      const email = String(req.body?.email || "").trim();
      if (!email) {
        return res.status(400).json({ error: "email es obligatorio" });
      }

      const solicitud = await UsuarioAuth.crearTokenRecuperacion(email);
      if (solicitud?.token && solicitud?.usuario?.email) {
        try {
          await enviarEmailRecuperacionPassword({
            to: solicitud.usuario.email,
            nombre: solicitud.usuario.nombre,
            token: solicitud.token,
          });
        } catch (errorMail) {
          console.error("Error enviando correo de recuperación:", errorMail);
        }
      }

      return res.json({
        ok: true,
        mensaje:
          "Si el correo existe y está activo, se envió un enlace para restablecer la contraseña.",
      });
    } catch (error) {
      console.error("Error solicitando recuperación de contraseña:", error);
      return res.status(500).json({ error: "No se pudo procesar la recuperación de contraseña" });
    }
  },

  async resetearPassword(req, res) {
    try {
      const email = String(req.body?.email || "").trim();
      const token = String(req.body?.token || "").trim();
      const password = String(req.body?.password || "");
      if (!email || !token || !password) {
        return res.status(400).json({ error: "email, token y password son obligatorios" });
      }

      await UsuarioAuth.resetearPasswordConToken(email, token, password, pool);
      return res.json({ ok: true, mensaje: "Contraseña actualizada correctamente" });
    } catch (error) {
      console.error("Error reseteando contraseña:", error);
      const msg = String(error?.message || "");
      const status = msg.includes("Token") || msg.includes("password") ? 400 : 500;
      return res.status(status).json({ error: msg || "No se pudo restablecer la contraseña" });
    }
  },

  async cambiarPasswordActual(req, res) {
    try {
      const currentPassword = String(
        req.body?.current_password || req.body?.actual_password || req.body?.password_actual || ""
      );
      const newPassword = String(
        req.body?.new_password || req.body?.nuevo_password || req.body?.password_nuevo || ""
      );

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: "current_password y new_password son obligatorios",
        });
      }

      const usuario = await UsuarioAuth.cambiarPasswordActual(
        req.user?.id,
        currentPassword,
        newPassword,
        pool
      );

      return res.json({
        ok: true,
        mensaje: "Contraseña actualizada correctamente",
        usuario,
      });
    } catch (error) {
      console.error("Error cambiarPasswordActual:", error);
      const msg = String(error?.message || "");
      const status =
        msg.includes("current_password") ||
        msg.includes("new_password") ||
        msg.includes("contraseña actual") ||
        msg.includes("password")
          ? 400
          : 500;
      return res.status(status).json({ error: msg || "No se pudo actualizar la contraseña" });
    }
  },

  async preciosPublicos(req, res) {
    try {
      const precios = await obtenerPreciosPlanes();
      const catalogo = obtenerCatalogoPreciosPublicos();
      const planes = Object.values(catalogo).map((item) => ({
        codigo: item.codigo,
        nombre: item.nombre,
        tipo: item.tipo,
        familia: item.familia || "general",
        nivel: item.nivel || item.codigo,
        registrable: item.registrable === true,
        plan_registro: item.plan_registro || null,
        periodicidad: item.sufijo_precio || "/ mes",
        precio_mensual: precios[item.codigo] ?? item.precio_default ?? 0,
      }));
      return res.json({ ok: true, planes });
    } catch (error) {
      console.error("Error preciosPublicos:", error);
      return res.status(500).json({ error: "No se pudo obtener los precios" });
    }
  },

  async listarPreciosPlanes(req, res) {
    try {
      if (!esAdministrador(req.user)) {
        return res.status(403).json({ error: "Solo el administrador puede gestionar precios de planes" });
      }
      const precios = await obtenerPreciosPlanes();
      const catalogo = obtenerCatalogoPreciosPublicos();
      const planes = Object.values(catalogo).map((item) => ({
        codigo: item.codigo,
        nombre: item.nombre,
        tipo: item.tipo,
        familia: item.familia || "general",
        nivel: item.nivel || item.codigo,
        registrable: item.registrable === true,
        plan_registro: item.plan_registro || null,
        periodicidad: item.sufijo_precio || "/ mes",
        precio_mensual: precios[item.codigo] ?? item.precio_default ?? 0,
      }));
      return res.json({ ok: true, planes });
    } catch (error) {
      console.error("Error listarPreciosPlanes:", error);
      return res.status(500).json({ error: "No se pudo obtener los precios" });
    }
  },

  async actualizarPrecioPlanes(req, res) {
    try {
      if (!esAdministrador(req.user)) {
        return res.status(403).json({ error: "Solo el administrador puede modificar precios de planes" });
      }
      const precios = req.body?.precios;
      if (!precios || typeof precios !== "object") {
        return res.status(400).json({ error: "Se esperan precios como objeto { codigo: precio }" });
      }
      const actualizados = [];
      for (const [codigo, precio] of Object.entries(precios)) {
        const result = await actualizarPrecioPlan(codigo, precio);
        actualizados.push(result);
      }
      return res.json({ ok: true, actualizados });
    } catch (error) {
      console.error("Error actualizarPrecioPlanes:", error);
      const status = String(error?.message || "").includes("inválido") ? 400 : 500;
      return res.status(status).json({ error: error.message || "No se pudo actualizar los precios" });
    }
  },

  // ── Formas de pago ──────────────────────────────────────────────────────────

  async formasPagoPublicas(req, res) {
    try {
      const formas = await obtenerFormasPago();
      return res.json({ ok: true, formas });
    } catch (error) {
      console.error("Error formasPagoPublicas:", error);
      return res.status(500).json({ error: "No se pudo obtener las formas de pago" });
    }
  },

  async listarFormasPago(req, res) {
    try {
      if (!esAdministrador(req.user)) {
        return res.status(403).json({ error: "Solo el administrador puede ver la configuración de pagos" });
      }
      const formas = await obtenerFormasPago();
      return res.json({ ok: true, formas });
    } catch (error) {
      console.error("Error listarFormasPago:", error);
      return res.status(500).json({ error: "No se pudo obtener las formas de pago" });
    }
  },

  async actualizarFormasPagoAdmin(req, res) {
    try {
      if (!esAdministrador(req.user)) {
        return res.status(403).json({ error: "Solo el administrador puede modificar las formas de pago" });
      }
      const campos = req.body?.formas;
      if (!campos || typeof campos !== "object") {
        return res.status(400).json({ error: "Se esperan campos de formas de pago como objeto" });
      }
      await actualizarFormasPago(campos);
      const formas = await obtenerFormasPago();
      return res.json({ ok: true, formas });
    } catch (error) {
      console.error("Error actualizarFormasPagoAdmin:", error);
      return res.status(500).json({ error: error.message || "No se pudo actualizar las formas de pago" });
    }
  },

  async dashboardAdmin(req, res) {
    try {
      const user = req.user;
      if (!esAdministrador(user)) {
        return res.status(403).json({ error: "Solo el administrador puede acceder a este dashboard" });
      }

      // Organizadores activos totales
      const rOrgs = await pool.query(
        `SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'organizador' AND activo = true`
      );

      // Nuevos este mes
      const rNuevos = await pool.query(
        `SELECT COUNT(*) AS total FROM usuarios
         WHERE rol = 'organizador' AND activo = true
           AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`
      );

      // Por plan
      const rPorPlan = await pool.query(
        `SELECT COALESCE(plan_codigo, 'free') AS plan_codigo, COUNT(*) AS total
         FROM usuarios
         WHERE rol = 'organizador' AND activo = true
         GROUP BY plan_codigo
         ORDER BY total DESC`
      );

      // MRR estimado (usando precios desde BD)
      const preciosDB = await obtenerPreciosPlanes();
      let mrr = 0;
      for (const row of rPorPlan.rows) {
        const codigo = normalizarPlanCodigo(row.plan_codigo, "free");
        const precio = preciosDB[codigo] ?? PLANES[codigo]?.precio_mensual ?? 0;
        mrr += precio * Number(row.total || 0);
      }

      // Plan más popular
      const planPopular = rPorPlan.rows[0]?.plan_codigo || "free";

      // Tabla de organizadores (con torneos activos)
      const rTablaOrgs = await pool.query(
        `SELECT u.id, u.nombre, u.email, COALESCE(u.plan_codigo, 'free') AS plan_codigo,
                u.plan_estado, u.activo, u.created_at,
                COUNT(c.id) FILTER (WHERE c.estado NOT IN ('archivado')) AS torneos_activos
         FROM usuarios u
         LEFT JOIN campeonatos c ON c.creador_usuario_id = u.id
         WHERE u.rol = 'organizador'
         GROUP BY u.id
         ORDER BY u.created_at DESC
         LIMIT 50`
      );

      // Métricas globales
      const rGlobal = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM campeonatos) AS total_campeonatos,
           (SELECT COUNT(*) FROM equipos) AS total_equipos,
           (SELECT COUNT(*) FROM jugadores) AS total_jugadores`
      );

      return res.json({
        ok: true,
        kpis: {
          organizadores_activos: Number(rOrgs.rows[0]?.total || 0),
          nuevos_este_mes: Number(rNuevos.rows[0]?.total || 0),
          mrr_estimado: mrr,
          plan_popular: planPopular,
        },
        por_plan: rPorPlan.rows,
        organizadores: rTablaOrgs.rows,
        global: {
          total_campeonatos: Number(rGlobal.rows[0]?.total_campeonatos || 0),
          total_equipos: Number(rGlobal.rows[0]?.total_equipos || 0),
          total_jugadores: Number(rGlobal.rows[0]?.total_jugadores || 0),
        },
      });
    } catch (error) {
      console.error("Error en dashboardAdmin:", error);
      return res.status(500).json({ error: "No se pudo obtener el dashboard de administrador" });
    }
  },
};

module.exports = authController;
