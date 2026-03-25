const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const pool = require("../config/database");
const { normalizarPlanCodigo } = require("../services/planLimits");

const ROLES = new Set(["administrador", "operador", "operador_sistema", "organizador", "tecnico", "dirigente", "jugador"]);

class UsuarioAuth {
  static _schemaReady = false;

  static normalizarEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  static normalizarUsername(username) {
    return String(username || "").trim().toLowerCase();
  }

  static validarEmail(email) {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
  }

  static validarUsername(username) {
    if (!username) return true;
    return /^[a-z0-9._-]{3,40}$/.test(String(username));
  }

  static hashToken(token) {
    return crypto.createHash("sha256").update(String(token || "")).digest("hex");
  }

  static limpiarUsuario(row) {
    if (!row) return null;
    return {
      id: Number(row.id),
      nombre: row.nombre,
      organizacion_nombre: row.organizacion_nombre || "",
      email: row.email,
      username: row.username || "",
      rol: row.rol,
      activo: row.activo === true,
      solo_lectura: row.solo_lectura === true,
      debe_cambiar_password: row.debe_cambiar_password === true,
      plan_codigo: normalizarPlanCodigo(row.plan_codigo, "premium"),
      plan_estado: String(row.plan_estado || "activo").toLowerCase(),
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
        email VARCHAR(180) UNIQUE,
        username VARCHAR(80),
        password_hash TEXT NOT NULL,
        rol VARCHAR(20) NOT NULL CHECK (rol IN ('administrador', 'operador', 'operador_sistema', 'organizador', 'tecnico', 'dirigente', 'jugador')),
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        solo_lectura BOOLEAN NOT NULL DEFAULT FALSE,
        debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE,
        plan_codigo VARCHAR(24) NOT NULL DEFAULT 'premium',
        plan_estado VARCHAR(20) NOT NULL DEFAULT 'activo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS username VARCHAR(80)
    `);
    await client.query(`
      ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS solo_lectura BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await client.query(`
      ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS organizacion_nombre VARCHAR(180)
    `);
    await client.query(`
      ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await client.query(`
      ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS plan_codigo VARCHAR(24) NOT NULL DEFAULT 'premium'
    `);
    await client.query(`
      ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS plan_estado VARCHAR(20) NOT NULL DEFAULT 'activo'
    `);
    await client.query(`
      ALTER TABLE usuarios
      ALTER COLUMN email DROP NOT NULL
    `);
    await client.query(`
      UPDATE usuarios
      SET email = NULL
      WHERE TRIM(COALESCE(email, '')) = ''
    `);
    await client.query(`
      UPDATE usuarios
      SET username = NULL
      WHERE TRIM(COALESCE(username, '')) = ''
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_username_unique
      ON usuarios(LOWER(username))
      WHERE username IS NOT NULL
    `);
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'usuarios_plan_codigo_check'
            AND conrelid = 'usuarios'::regclass
        ) THEN
          ALTER TABLE usuarios DROP CONSTRAINT usuarios_plan_codigo_check;
        END IF;

        ALTER TABLE usuarios
        ADD CONSTRAINT usuarios_plan_codigo_check
        CHECK (plan_codigo IN ('demo', 'free', 'base', 'competencia', 'premium'));
      EXCEPTION WHEN duplicate_object THEN
        NULL;
      END $$;
    `);
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'usuarios_plan_estado_check'
            AND conrelid = 'usuarios'::regclass
        ) THEN
          ALTER TABLE usuarios DROP CONSTRAINT usuarios_plan_estado_check;
        END IF;

        ALTER TABLE usuarios
        ADD CONSTRAINT usuarios_plan_estado_check
        CHECK (plan_estado IN ('activo', 'suspendido'));
      EXCEPTION WHEN duplicate_object THEN
        NULL;
      END $$;
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
        CHECK (rol IN ('administrador', 'operador', 'operador_sistema', 'organizador', 'tecnico', 'dirigente', 'jugador'));
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
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'usuarios_identificador_check'
            AND conrelid = 'usuarios'::regclass
        ) THEN
          ALTER TABLE usuarios DROP CONSTRAINT usuarios_identificador_check;
        END IF;

        ALTER TABLE usuarios
        ADD CONSTRAINT usuarios_identificador_check
        CHECK (
          (email IS NOT NULL AND btrim(email) <> '')
          OR (username IS NOT NULL AND btrim(username) <> '')
        );
      EXCEPTION WHEN duplicate_object THEN
        NULL;
      END $$;
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol)`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_usuario_equipos_usuario ON usuario_equipos(usuario_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_usuario_equipos_equipo ON usuario_equipos(equipo_id)`
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuario_password_resets (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_usuario_password_resets_usuario ON usuario_password_resets(usuario_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_usuario_password_resets_expires ON usuario_password_resets(expires_at)`
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuario_refresh_tokens (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        client_type VARCHAR(30) NOT NULL DEFAULT 'unknown',
        user_agent TEXT,
        ip_address VARCHAR(64),
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_usuario_refresh_tokens_usuario ON usuario_refresh_tokens(usuario_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_usuario_refresh_tokens_expires ON usuario_refresh_tokens(expires_at)`
    );

    await this.asegurarAdminInicial(client);

    if (client === pool) this._schemaReady = true;
  }

  static async asegurarAdminInicial(client = pool) {
    const adminEmailRaw = String(process.env.AUTH_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "").trim();
    const adminPassRaw = String(
      process.env.AUTH_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || ""
    ).trim();
    const adminEmail = this.normalizarEmail(adminEmailRaw);
    const adminPass = String(adminPassRaw);
    const adminNombre = String(process.env.AUTH_ADMIN_NOMBRE || "Administrador SGD");

    if (!adminEmail || !adminPass) return;

    const check = await client.query("SELECT id FROM usuarios WHERE LOWER(COALESCE(email, '')) = $1 LIMIT 1", [
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

  static async contarUsuarios(client = pool) {
    await this.asegurarEsquema(client);
    const r = await client.query("SELECT COUNT(*)::int AS total FROM usuarios");
    return Number(r.rows[0]?.total || 0);
  }

  static async requiereRegistroInicial(client = pool) {
    const total = await this.contarUsuarios(client);
    return total <= 0;
  }

  static async obtenerPorEmail(email, client = pool) {
    await this.asegurarEsquema(client);
    const emailNormalizado = this.normalizarEmail(email);
    if (!emailNormalizado) return null;
    const q = `
      SELECT
        u.*,
        COALESCE(ARRAY_AGG(ue.equipo_id) FILTER (WHERE ue.equipo_id IS NOT NULL), '{}') AS equipo_ids
      FROM usuarios u
      LEFT JOIN usuario_equipos ue ON ue.usuario_id = u.id
      WHERE LOWER(COALESCE(u.email, '')) = $1
      GROUP BY u.id
      LIMIT 1
    `;
    const r = await client.query(q, [emailNormalizado]);
    return r.rows[0] || null;
  }

  static async obtenerPorUsername(username, client = pool) {
    await this.asegurarEsquema(client);
    const usernameNormalizado = this.normalizarUsername(username);
    if (!usernameNormalizado) return null;
    const q = `
      SELECT
        u.*,
        COALESCE(ARRAY_AGG(ue.equipo_id) FILTER (WHERE ue.equipo_id IS NOT NULL), '{}') AS equipo_ids
      FROM usuarios u
      LEFT JOIN usuario_equipos ue ON ue.usuario_id = u.id
      WHERE LOWER(COALESCE(u.username, '')) = $1
      GROUP BY u.id
      LIMIT 1
    `;
    const r = await client.query(q, [usernameNormalizado]);
    return r.rows[0] || null;
  }

  static async obtenerPorIdentificador(identificador, client = pool) {
    await this.asegurarEsquema(client);
    const valor = this.normalizarEmail(identificador);
    if (!valor) return null;
    const q = `
      SELECT
        u.*,
        COALESCE(ARRAY_AGG(ue.equipo_id) FILTER (WHERE ue.equipo_id IS NOT NULL), '{}') AS equipo_ids
      FROM usuarios u
      LEFT JOIN usuario_equipos ue ON ue.usuario_id = u.id
      WHERE LOWER(COALESCE(u.email, '')) = $1 OR LOWER(COALESCE(u.username, '')) = $1
      GROUP BY u.id
      ORDER BY CASE WHEN LOWER(COALESCE(u.email, '')) = $1 THEN 0 ELSE 1 END
      LIMIT 1
    `;
    const r = await client.query(q, [valor]);
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
    const username = this.normalizarUsername(data.username);
    const password = String(data.password || "");
    const rol = String(data.rol || "tecnico").trim().toLowerCase();
    const activo =
      data.activo === undefined
        ? true
        : data.activo === true || String(data.activo).toLowerCase() === "true";
    const organizacionNombre = String(data.organizacion_nombre || "").trim();
    const rolEsJugador = rol === "jugador";
    const soloLectura = rolEsJugador
      ? true
      : data.solo_lectura === true || String(data.solo_lectura || "").toLowerCase() === "true";
    const debeCambiarPassword =
      data.debe_cambiar_password === true ||
      String(data.debe_cambiar_password || "").toLowerCase() === "true";
    const planCodigo = normalizarPlanCodigo(data.plan_codigo, "premium");
    const planEstado = String(data.plan_estado || "activo").trim().toLowerCase() === "suspendido"
      ? "suspendido"
      : "activo";

    if (!nombre) throw new Error("nombre es obligatorio");
    if (!email && !username) {
      throw new Error("Debes ingresar email o username");
    }
    if (!this.validarEmail(email)) {
      throw new Error("email invalido");
    }
    if (!this.validarUsername(username)) {
      throw new Error("username invalido. Use solo letras, numeros, punto, guion o guion bajo (3-40).");
    }
    if (!password || password.length < 6) {
      throw new Error("password debe tener al menos 6 caracteres");
    }
    if (!ROLES.has(rol)) {
      throw new Error("rol invalido. Use: administrador, operador, operador_sistema, organizador, tecnico, dirigente o jugador");
    }
    if (rol === "organizador" && !organizacionNombre) {
      throw new Error("organizacion_nombre es obligatorio para organizador");
    }

    if (email) {
      const exists = await client.query(
        "SELECT 1 FROM usuarios WHERE LOWER(COALESCE(email, '')) = $1 LIMIT 1",
        [email]
      );
      if (exists.rows.length) throw new Error("Ya existe un usuario con ese email");
    }
    if (username) {
      const existsUsername = await client.query(
        "SELECT 1 FROM usuarios WHERE LOWER(COALESCE(username, '')) = $1 LIMIT 1",
        [username]
      );
      if (existsUsername.rows.length) throw new Error("Ya existe un usuario con ese username");
    }

    const hash = await bcrypt.hash(password, 10);
    const r = await client.query(
      `
        INSERT INTO usuarios (
          nombre,
          organizacion_nombre,
          email,
          username,
          password_hash,
          rol,
          activo,
          solo_lectura,
          debe_cambiar_password,
          plan_codigo,
          plan_estado
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `,
      [
        nombre,
        rol === "organizador" ? organizacionNombre : null,
        email || null,
        username || null,
        hash,
        rol,
        activo,
        soloLectura,
        debeCambiarPassword,
        planCodigo,
        planEstado,
      ]
    );
    return this.limpiarUsuario(r.rows[0]);
  }

  static async actualizar(usuarioId, data = {}, client = pool) {
    await this.asegurarEsquema(client);

    const uId = Number.parseInt(usuarioId, 10);
    if (!Number.isFinite(uId) || uId <= 0) throw new Error("usuario_id invalido");

    const actual = await this.obtenerPorId(uId, client);
    if (!actual) throw new Error("Usuario no encontrado");

    const campos = [];
    const valores = [];
    let idx = 1;

    if (data.nombre !== undefined) {
      const nombre = String(data.nombre || "").trim();
      if (!nombre) throw new Error("nombre es obligatorio");
      campos.push(`nombre = $${idx++}`);
      valores.push(nombre);
    }

    if (data.email !== undefined) {
      const email = this.normalizarEmail(data.email);
      if (!this.validarEmail(email)) throw new Error("email invalido");
      if (email) {
        const exists = await client.query(
          "SELECT 1 FROM usuarios WHERE LOWER(COALESCE(email, '')) = $1 AND id <> $2 LIMIT 1",
          [email, uId]
        );
        if (exists.rows.length) throw new Error("Ya existe un usuario con ese email");
      }
      campos.push(`email = $${idx++}`);
      valores.push(email || null);
    }

    if (data.username !== undefined) {
      const username = this.normalizarUsername(data.username);
      if (!this.validarUsername(username)) {
        throw new Error("username invalido. Use solo letras, numeros, punto, guion o guion bajo (3-40).");
      }
      if (username) {
        const exists = await client.query(
          "SELECT 1 FROM usuarios WHERE LOWER(COALESCE(username, '')) = $1 AND id <> $2 LIMIT 1",
          [username, uId]
        );
        if (exists.rows.length) throw new Error("Ya existe un usuario con ese username");
      }
      campos.push(`username = $${idx++}`);
      valores.push(username || null);
    }

    if (data.password !== undefined && String(data.password || "").trim() !== "") {
      const password = String(data.password || "");
      if (password.length < 6) throw new Error("password debe tener al menos 6 caracteres");
      const hash = await bcrypt.hash(password, 10);
      campos.push(`password_hash = $${idx++}`);
      valores.push(hash);
    }

    if (data.debe_cambiar_password !== undefined) {
      const debeCambiarPassword =
        data.debe_cambiar_password === true ||
        String(data.debe_cambiar_password || "").toLowerCase() === "true";
      campos.push(`debe_cambiar_password = $${idx++}`);
      valores.push(debeCambiarPassword);
    }

    if (data.rol !== undefined) {
      const rol = String(data.rol || "").trim().toLowerCase();
      if (!ROLES.has(rol)) {
        throw new Error("rol invalido. Use: administrador, operador, operador_sistema, organizador, tecnico, dirigente o jugador");
      }
      if (rol === "organizador") {
        const orgDestino =
          data.organizacion_nombre !== undefined
            ? String(data.organizacion_nombre || "").trim()
            : String(actual.organizacion_nombre || "").trim();
        if (!orgDestino) {
          throw new Error("organizacion_nombre es obligatorio para organizador");
        }
      }
      campos.push(`rol = $${idx++}`);
      valores.push(rol);
    }

    if (data.organizacion_nombre !== undefined) {
      const org = String(data.organizacion_nombre || "").trim();
      const rolDestino = String(data.rol || actual.rol || "").trim().toLowerCase();
      if (rolDestino === "organizador" && !org) {
        throw new Error("organizacion_nombre es obligatorio para organizador");
      }
      campos.push(`organizacion_nombre = $${idx++}`);
      valores.push(org || null);
    }

    if (data.activo !== undefined) {
      const activo =
        data.activo === true || String(data.activo || "").toLowerCase() === "true";
      campos.push(`activo = $${idx++}`);
      valores.push(activo);
    }

    if (data.solo_lectura !== undefined) {
      const soloLectura =
        data.solo_lectura === true || String(data.solo_lectura || "").toLowerCase() === "true";
      campos.push(`solo_lectura = $${idx++}`);
      valores.push(soloLectura);
    }

    if (data.plan_codigo !== undefined) {
      const planCodigo = normalizarPlanCodigo(data.plan_codigo, "premium");
      campos.push(`plan_codigo = $${idx++}`);
      valores.push(planCodigo);
    }

    if (data.plan_estado !== undefined) {
      const planEstado =
        String(data.plan_estado || "").trim().toLowerCase() === "suspendido"
          ? "suspendido"
          : "activo";
      campos.push(`plan_estado = $${idx++}`);
      valores.push(planEstado);
    }

    const emailFinal =
      data.email !== undefined ? this.normalizarEmail(data.email) || null : actual.email || null;
    const usernameFinal =
      data.username !== undefined
        ? this.normalizarUsername(data.username) || null
        : actual.username || null;
    if (!emailFinal && !usernameFinal) {
      throw new Error("Debes mantener email o username");
    }

    if (!campos.length) throw new Error("No hay campos para actualizar");

    valores.push(uId);
    await client.query(
      `
        UPDATE usuarios
        SET ${campos.join(", ")}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${idx}
      `,
      valores
    );

    const actualizado = await this.obtenerPorId(uId, client);
    if (!actualizado) return null;

    if (actualizado.rol !== "tecnico" && actualizado.rol !== "dirigente" && actualizado.rol !== "jugador") {
      await client.query(`DELETE FROM usuario_equipos WHERE usuario_id = $1`, [uId]);
    }

    if (actualizado.rol === "jugador" && actualizado.solo_lectura !== true) {
      await client.query(
        `UPDATE usuarios SET solo_lectura = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [uId]
      );
    }

    const refreshed = await this.obtenerPorId(uId, client);
    return this.limpiarUsuario(refreshed);
  }

  static async validarCredenciales(email, password, client = pool) {
    const row = await this.obtenerPorIdentificador(email, client);
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
    if (user.rol !== "tecnico" && user.rol !== "dirigente" && user.rol !== "jugador") {
      throw new Error("Solo se pueden asignar equipos a usuarios con rol tecnico/dirigente/jugador");
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

  static async eliminar(usuarioId, client = pool) {
    await this.asegurarEsquema(client);
    const uId = Number.parseInt(usuarioId, 10);
    if (!Number.isFinite(uId) || uId <= 0) throw new Error("usuario_id invalido");

    const r = await client.query(`DELETE FROM usuarios WHERE id = $1 RETURNING *`, [uId]);
    return this.limpiarUsuario(r.rows[0] || null);
  }

  static async crearTokenRecuperacion(email, ttlMin = 45, client = pool) {
    await this.asegurarEsquema(client);
    const user = await this.obtenerPorEmail(email, client);
    if (!user || !user.activo) return null;

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(token);
    const minutos = Number.isFinite(Number(ttlMin)) ? Math.max(5, Number(ttlMin)) : 45;

    await client.query(
      `
        UPDATE usuario_password_resets
        SET used_at = CURRENT_TIMESTAMP
        WHERE usuario_id = $1
          AND used_at IS NULL
      `,
      [user.id]
    );

    await client.query(
      `
        INSERT INTO usuario_password_resets (usuario_id, token_hash, expires_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP + ($3 * INTERVAL '1 minute'))
      `,
      [user.id, tokenHash, minutos]
    );

    return {
      token,
      usuario: this.limpiarUsuario(user),
      expira_en_minutos: minutos,
    };
  }

  static async resetearPasswordConToken(email, token, nuevoPassword, client = pool) {
    await this.asegurarEsquema(client);

    const password = String(nuevoPassword || "");
    if (password.length < 6) {
      throw new Error("password debe tener al menos 6 caracteres");
    }
    const tokenPlano = String(token || "").trim();
    if (!tokenPlano) {
      throw new Error("token es obligatorio");
    }

    const user = await this.obtenerPorEmail(email, client);
    if (!user || !user.activo) {
      throw new Error("Token inválido o expirado");
    }

    const tokenHash = this.hashToken(tokenPlano);
    const tokenDb = await client.query(
      `
        SELECT id
        FROM usuario_password_resets
        WHERE usuario_id = $1
          AND token_hash = $2
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY id DESC
        LIMIT 1
      `,
      [user.id, tokenHash]
    );
    const resetId = Number.parseInt(tokenDb.rows[0]?.id, 10);
    if (!Number.isFinite(resetId) || resetId <= 0) {
      throw new Error("Token inválido o expirado");
    }

    await client.query("BEGIN");
    try {
      const hash = await bcrypt.hash(password, 10);
      await client.query(
        `
          UPDATE usuarios
          SET password_hash = $1, debe_cambiar_password = FALSE, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `,
        [hash, user.id]
      );
      await client.query(
        `
          UPDATE usuario_password_resets
          SET used_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [resetId]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    const actualizado = await this.obtenerPorId(user.id, client);
    return this.limpiarUsuario(actualizado);
  }

  static async cambiarPasswordActual(usuarioId, passwordActual, passwordNuevo, client = pool) {
    await this.asegurarEsquema(client);

    const uId = Number.parseInt(usuarioId, 10);
    if (!Number.isFinite(uId) || uId <= 0) {
      throw new Error("usuario_id invalido");
    }

    const currentPassword = String(passwordActual || "");
    const newPassword = String(passwordNuevo || "");
    if (!currentPassword) {
      throw new Error("current_password es obligatorio");
    }
    if (newPassword.length < 6) {
      throw new Error("new_password debe tener al menos 6 caracteres");
    }

    const row = await this.obtenerPorId(uId, client);
    if (!row || !row.activo) {
      throw new Error("Usuario no encontrado");
    }

    const ok = await bcrypt.compare(currentPassword, row.password_hash || "");
    if (!ok) {
      throw new Error("La contraseña actual no es válida");
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await client.query(
      `
        UPDATE usuarios
        SET password_hash = $1,
            debe_cambiar_password = FALSE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `,
      [hash, uId]
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

  static async crearRefreshToken(usuarioId, opciones = {}, client = pool) {
    await this.asegurarEsquema(client);

    const uId = Number.parseInt(usuarioId, 10);
    if (!Number.isFinite(uId) || uId <= 0) {
      throw new Error("usuario_id invalido");
    }

    const ttlDaysRaw = Number.parseInt(opciones.ttl_days ?? 30, 10);
    const ttlDays = Number.isFinite(ttlDaysRaw) ? Math.max(1, ttlDaysRaw) : 30;
    const token = crypto.randomBytes(48).toString("hex");
    const tokenHash = this.hashToken(token);
    const clientType = String(opciones.client_type || "unknown").trim().slice(0, 30) || "unknown";
    const userAgent = String(opciones.user_agent || "").trim() || null;
    const ipAddress = String(opciones.ip_address || "").trim() || null;

    const r = await client.query(
      `
        INSERT INTO usuario_refresh_tokens (
          usuario_id,
          token_hash,
          client_type,
          user_agent,
          ip_address,
          expires_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          CURRENT_TIMESTAMP + ($6 * INTERVAL '1 day')
        )
        RETURNING id, expires_at
      `,
      [uId, tokenHash, clientType, userAgent, ipAddress, ttlDays]
    );

    return {
      id: Number.parseInt(r.rows[0]?.id, 10),
      token,
      expires_at: r.rows[0]?.expires_at || null,
    };
  }

  static async obtenerRefreshToken(token, client = pool) {
    await this.asegurarEsquema(client);

    const tokenPlano = String(token || "").trim();
    if (!tokenPlano) return null;

    const tokenHash = this.hashToken(tokenPlano);
    const r = await client.query(
      `
        SELECT *
        FROM usuario_refresh_tokens
        WHERE token_hash = $1
        LIMIT 1
      `,
      [tokenHash]
    );

    return r.rows[0] || null;
  }

  static async revocarRefreshToken(token, client = pool) {
    await this.asegurarEsquema(client);

    const tokenPlano = String(token || "").trim();
    if (!tokenPlano) return false;

    const tokenHash = this.hashToken(tokenPlano);
    const r = await client.query(
      `
        UPDATE usuario_refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE token_hash = $1
          AND revoked_at IS NULL
        RETURNING id
      `,
      [tokenHash]
    );

    return r.rows.length > 0;
  }

  static async rotarRefreshToken(token, opciones = {}, client = pool) {
    await this.asegurarEsquema(client);

    const tokenPlano = String(token || "").trim();
    if (!tokenPlano) {
      throw new Error("refreshToken es obligatorio");
    }

    const tokenHash = this.hashToken(tokenPlano);
    await client.query("BEGIN");
    try {
      const actualR = await client.query(
        `
          SELECT *
          FROM usuario_refresh_tokens
          WHERE token_hash = $1
          FOR UPDATE
        `,
        [tokenHash]
      );
      const actual = actualR.rows[0] || null;
      if (!actual || actual.revoked_at || new Date(actual.expires_at) <= new Date()) {
        throw new Error("refreshToken invalido o expirado");
      }

      await client.query(
        `
          UPDATE usuario_refresh_tokens
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [actual.id]
      );

      const nuevo = await this.crearRefreshToken(
        actual.usuario_id,
        {
          ttl_days: opciones.ttl_days,
          client_type: opciones.client_type || actual.client_type,
          user_agent: opciones.user_agent || actual.user_agent,
          ip_address: opciones.ip_address || actual.ip_address,
        },
        client
      );

      const usuario = await this.obtenerPorId(actual.usuario_id, client);
      await client.query("COMMIT");

      return {
        refreshToken: nuevo.token,
        refreshTokenExpiresAt: nuevo.expires_at,
        usuario: this.limpiarUsuario(usuario),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
}

module.exports = UsuarioAuth;
