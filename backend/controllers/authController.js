const jwt = require("jsonwebtoken");
const UsuarioAuth = require("../models/UsuarioAuth");
const { getJwtSecret } = require("../middleware/authMiddleware");

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

const authController = {
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
      const usuarios = await UsuarioAuth.listar();
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
      const user = await UsuarioAuth.crear(req.body || {});

      const equipoId = Number.parseInt(req.body?.equipo_id, 10);
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
};

module.exports = authController;
