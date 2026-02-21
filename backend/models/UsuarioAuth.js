const bcrypt = require("bcryptjs");
const pool = require("../config/database");

const ROLES = new Set(["administrador", "organizador", "tecnico", "dirigente"]);

class UsuarioAuth {
  static _schemaReady = false;

  static normalizarEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  static limpiarUsuario(row) {
    if (!row) return null;
    return {
      id: Number(row.id),
      nombre: row.nombre,
      email: row.email,
      rol: row.rol,
      activo: row.activo === true,
      equipo_ids: Array.isArray(row.equipo_ids)
        ? row.equipo_ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
        : [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  static async asegurarEsquema(client = pool) {
    if (this._schemaReady && client === pool) return;

    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(140) NOT NULL,
        email VARCHAR(180) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        rol VARCHAR(20) NOT NULL CHECK (rol IN ('administrador', 'organizador', 'tecnico', 'dirigente')),
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      DO $$
      DECLARE
        c_name text;
      BEGIN
        SELECT conname INTO c_name
        FROM pg_constraint
        WHERE conrelid = 'usuarios'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%rol%'
        LIMIT 1;

        IF c_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE usuarios DROP CONSTRAINT %I', c_name);
        END IF;

        ALTER TABLE usuarios
        ADD CONSTRAINT usuarios_rol_check
        CHECK (rol IN ('administrador', 'organizador', 'tecnico', 'dirigente'));
      EXCEPTION WHEN duplicate_object THEN
        NULL;
      END $$;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuario_equipos (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        equipo_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (usuario_id, equipo_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol)`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_usuario_equipos_usuario ON usuario_equipos(usuario_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_usuario_equipos_equipo ON usuario_equipos(equipo_id)`
    );

    await this.asegurarAdminInicial(client);

    if (client === pool) this._schemaReady = true;
  }

  static async asegurarAdminInicial(client = pool) {
    const adminEmail = this.normalizarEmail(
      process.env.AUTH_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@sgd.local"
    );
    const adminPass = String(
      process.env.AUTH_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "Admin123*"
    );
    const adminNombre = String(process.env.AUTH_ADMIN_NOMBRE || "Administrador SGD");

    if (!adminEmail || !adminPass) return;

    const check = await client.query("SELECT id FROM usuarios WHERE email = $1 LIMIT 1", [
      adminEmail,
    ]);
    if (check.rows.length) return;

    const hash = await bcrypt.hash(adminPass, 10);
    await client.query(
      `
        INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
        VALUES ($1, $2, $3, 'administrador', TRUE)
      `,
      [adminNombre, adminEmail, hash]
    );
    console.log(`[auth] usuario administrador inicial creado: ${adminEmail}`);
  }

  static async obtenerPorEmail(email, client = pool) {
    await this.asegurarEsquema(client);
    const q = `
      SELECT
        u.*,
        COALESCE(ARRAY_AGG(ue.equipo_id) FILTER (WHERE ue.equipo_id IS NOT NULL), '{}') AS equipo_ids
      FROM usuarios u
      LEFT JOIN usuario_equipos ue ON ue.usuario_id = u.id
      WHERE u.email = $1
      GROUP BY u.id
      LIMIT 1
    `;
    const r = await client.query(q, [this.normalizarEmail(email)]);
    return r.rows[0] || null;
  }

  static async obtenerPorId(id, client = pool) {
    await this.asegurarEsquema(client);
    const userId = Number.parseInt(id, 10);
    if (!Number.isFinite(userId) || userId <= 0) return null;
    const q = `
      SELECT
        u.*,
        COALESCE(ARRAY_AGG(ue.equipo_id) FILTER (WHERE ue.equipo_id IS NOT NULL), '{}') AS equipo_ids
      FROM usuarios u
      LEFT JOIN usuario_equipos ue ON ue.usuario_id = u.id
      WHERE u.id = $1
      GROUP BY u.id
      LIMIT 1
    `;
    const r = await client.query(q, [userId]);
    return r.rows[0] || null;
  }

  static async listar(client = pool) {
    await this.asegurarEsquema(client);
    const q = `
      SELECT
        u.*,
        COALESCE(ARRAY_AGG(ue.equipo_id) FILTER (WHERE ue.equipo_id IS NOT NULL), '{}') AS equipo_ids
      FROM usuarios u
      LEFT JOIN usuario_equipos ue ON ue.usuario_id = u.id
      GROUP BY u.id
      ORDER BY u.id ASC
    `;
    const r = await client.query(q);
    return r.rows.map((x) => this.limpiarUsuario(x));
  }

  static async crear(data = {}, client = pool) {
    await this.asegurarEsquema(client);

    const nombre = String(data.nombre || "").trim();
    const email = this.normalizarEmail(data.email);
    const password = String(data.password || "");
    const rol = String(data.rol || "tecnico").trim().toLowerCase();
    const activo =
      data.activo === undefined
        ? true
        : data.activo === true || String(data.activo).toLowerCase() === "true";

    if (!nombre) throw new Error("nombre es obligatorio");
    if (!email) throw new Error("email es obligatorio");
    if (!password || password.length < 6) {
      throw new Error("password debe tener al menos 6 caracteres");
    }
    if (!ROLES.has(rol)) {
      throw new Error("rol invalido. Use: administrador, organizador, tecnico o dirigente");
    }

    const exists = await client.query("SELECT 1 FROM usuarios WHERE email = $1 LIMIT 1", [email]);
    if (exists.rows.length) throw new Error("Ya existe un usuario con ese email");

    const hash = await bcrypt.hash(password, 10);
    const r = await client.query(
      `
        INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [nombre, email, hash, rol, activo]
    );
    return this.limpiarUsuario(r.rows[0]);
  }

  static async validarCredenciales(email, password, client = pool) {
    const row = await this.obtenerPorEmail(email, client);
    if (!row) return null;
    if (!row.activo) return null;

    const ok = await bcrypt.compare(String(password || ""), row.password_hash || "");
    if (!ok) return null;
    return this.limpiarUsuario(row);
  }

  static async asignarEquipo(usuarioId, equipoId, client = pool) {
    await this.asegurarEsquema(client);
    const uId = Number.parseInt(usuarioId, 10);
    const eId = Number.parseInt(equipoId, 10);
    if (!Number.isFinite(uId) || uId <= 0) throw new Error("usuario_id invalido");
    if (!Number.isFinite(eId) || eId <= 0) throw new Error("equipo_id invalido");

    const user = await this.obtenerPorId(uId, client);
    if (!user) throw new Error("Usuario no encontrado");
    if (user.rol !== "tecnico" && user.rol !== "dirigente") {
      throw new Error("Solo se pueden asignar equipos a usuarios con rol tecnico/dirigente");
    }

    await client.query(
      `
        INSERT INTO usuario_equipos (usuario_id, equipo_id)
        VALUES ($1, $2)
        ON CONFLICT (usuario_id, equipo_id) DO NOTHING
      `,
      [uId, eId]
    );
    const actualizado = await this.obtenerPorId(uId, client);
    return this.limpiarUsuario(actualizado);
  }

  static async quitarEquipo(usuarioId, equipoId, client = pool) {
    await this.asegurarEsquema(client);
    const uId = Number.parseInt(usuarioId, 10);
    const eId = Number.parseInt(equipoId, 10);
    if (!Number.isFinite(uId) || uId <= 0) throw new Error("usuario_id invalido");
    if (!Number.isFinite(eId) || eId <= 0) throw new Error("equipo_id invalido");

    await client.query(
      `DELETE FROM usuario_equipos WHERE usuario_id = $1 AND equipo_id = $2`,
      [uId, eId]
    );
    const actualizado = await this.obtenerPorId(uId, client);
    return this.limpiarUsuario(actualizado);
  }

  static async obtenerEquipoIds(usuarioId, client = pool) {
    await this.asegurarEsquema(client);
    const uId = Number.parseInt(usuarioId, 10);
    if (!Number.isFinite(uId) || uId <= 0) return [];
    const r = await client.query(
      `SELECT equipo_id FROM usuario_equipos WHERE usuario_id = $1 ORDER BY equipo_id ASC`,
      [uId]
    );
    return r.rows
      .map((x) => Number.parseInt(x.equipo_id, 10))
      .filter((x) => Number.isFinite(x) && x > 0);
  }
}

module.exports = UsuarioAuth;
