const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const UsuarioAuth = require("../models/UsuarioAuth");
const { getJwtSecret } = require("../middleware/authMiddleware");
const {
  isOrganizador,
  obtenerEquipoIdsOrganizador,
} = require("../services/organizadorScope");
const { enviarEmailRecuperacionPassword } = require("../services/emailService");
const ROLES_REGISTRO_PUBLICO = new Set(["organizador", "dirigente", "tecnico"]);

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      rol: user.rol,
    },
    getJwtSecret(),
    { expiresIn: "12h" }
  );
}

function esAdministrador(user) {
  return String(user?.rol || "").toLowerCase() === "administrador";
}

function estaContenido(subset = [], superset = []) {
  const setSuper = new Set((superset || []).map((x) => Number.parseInt(x, 10)));
  return (subset || []).every((x) => setSuper.has(Number.parseInt(x, 10)));
}

async function listarUsuariosVisiblesPorOrganizador(user) {
  const equiposPermitidos = await obtenerEquipoIdsOrganizador(user);
  if (!equiposPermitidos?.length) return [];

  const usuarios = await UsuarioAuth.listar();
  return usuarios.filter((u) => {
    if (String(u.rol || "").toLowerCase() !== "dirigente") return false;
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
      });
      const user = await UsuarioAuth.obtenerPorId(creado.id);
      const limpio = UsuarioAuth.limpiarUsuario(user || creado);
      const token = signToken(limpio);

      return res.status(201).json({
        ok: true,
        token,
        usuario: limpio,
      });
    } catch (error) {
      console.error("Error bootstrapRegister:", error);
      const msg = String(error?.message || "");
      const status =
        msg.includes("obligatorio") ||
        msg.includes("invalido") ||
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

      if (!nombre || !email || !password || !rolSolicitado) {
        return res.status(400).json({ error: "nombre, email, password y rol son obligatorios" });
      }
      if (!ROLES_REGISTRO_PUBLICO.has(rolSolicitado)) {
        return res.status(400).json({ error: "rol invalido. Use: organizador, dirigente o tecnico" });
      }

      const creado = await UsuarioAuth.crear({
        nombre,
        email,
        password,
        rol: rolSolicitado,
        activo: true,
        solo_lectura: true,
      });

      const user = await UsuarioAuth.obtenerPorId(creado.id);
      const limpio = UsuarioAuth.limpiarUsuario(user || creado);
      const token = signToken(limpio);

      return res.status(201).json({
        ok: true,
        token,
        usuario: limpio,
        mensaje: "Cuenta creada en modo solo lectura",
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
      const email = String(req.body?.email || "").trim();
      const password = String(req.body?.password || "");
      if (!email || !password) {
        return res.status(400).json({ error: "email y password son obligatorios" });
      }

      const user = await UsuarioAuth.validarCredenciales(email, password);
      if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

      const token = signToken(user);
      return res.json({
        ok: true,
        token,
        usuario: user,
      });
    } catch (error) {
      console.error("Error login:", error);
      return res.status(500).json({ error: "No se pudo iniciar sesión" });
    }
  },

  async me(req, res) {
    return res.json({
      ok: true,
      usuario: req.user,
    });
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

  async crearUsuario(req, res) {
    try {
      const body = { ...(req.body || {}) };
      const equipoId = Number.parseInt(body?.equipo_id, 10);

      if (isOrganizador(req.user)) {
        if (!Number.isFinite(equipoId) || equipoId <= 0) {
          return res.status(400).json({ error: "equipo_id es obligatorio para crear dirigente" });
        }
        const equiposPermitidos = await obtenerEquipoIdsOrganizador(req.user);
        if (!equiposPermitidos.length || !equiposPermitidos.includes(equipoId)) {
          return res.status(403).json({ error: "No autorizado para crear usuarios en ese equipo" });
        }
        body.rol = "dirigente";
      }

      const user = await UsuarioAuth.crear(body);

      if ((user.rol === "tecnico" || user.rol === "dirigente") && Number.isFinite(equipoId) && equipoId > 0) {
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
      const actualizado = await UsuarioAuth.actualizar(usuarioId, req.body || {});
      return res.json({ ok: true, usuario: actualizado });
    } catch (error) {
      console.error("Error actualizando usuario:", error);
      const msg = String(error?.message || "");
      const msgL = msg.toLowerCase();
      const status =
        msgL.includes("obligatorio") ||
        msgL.includes("invalido") ||
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
        if (String(limpio.rol || "").toLowerCase() !== "dirigente") {
          return res.status(403).json({ error: "Solo puedes eliminar usuarios dirigentes" });
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
};

module.exports = authController;
