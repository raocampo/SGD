const pool = require("../config/database");

class ContactoMensaje {
  static _schemaReady = false;

  static limpiarTexto(value, maxLen = 0) {
    const texto = String(value || "").trim();
    if (!maxLen || texto.length <= maxLen) return texto;
    return texto.slice(0, maxLen).trim();
  }

  static async asegurarEsquema(client = pool) {
    if (this._schemaReady && client === pool) return;

    await client.query(`
      CREATE TABLE IF NOT EXISTS contacto_mensajes (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(160) NOT NULL,
        telefono VARCHAR(40),
        email VARCHAR(180) NOT NULL,
        mensaje TEXT NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'leido', 'respondido', 'archivado')),
        origen VARCHAR(40) NOT NULL DEFAULT 'portal_publico',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacto_mensajes_estado ON contacto_mensajes(estado)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacto_mensajes_created_at ON contacto_mensajes(created_at DESC)`);

    if (client === pool) this._schemaReady = true;
  }

  static async crear(data = {}, client = pool) {
    await this.asegurarEsquema(client);
    const nombre = this.limpiarTexto(data.nombre, 160);
    const telefono = this.limpiarTexto(data.telefono, 40) || null;
    const email = this.limpiarTexto(data.email, 180).toLowerCase();
    const mensaje = this.limpiarTexto(data.mensaje, 4000);
    const origen = this.limpiarTexto(data.origen || "portal_publico", 40) || "portal_publico";

    if (!nombre || !email || !mensaje) {
      throw new Error("nombre, email y mensaje son obligatorios");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("email invalido");
    }
    if (mensaje.length < 8) {
      throw new Error("mensaje demasiado corto");
    }

    const r = await client.query(
      `
        INSERT INTO contacto_mensajes (nombre, telefono, email, mensaje, origen)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [nombre, telefono, email, mensaje, origen]
    );
    return r.rows[0] || null;
  }

  static async listar({ estado = "" } = {}, client = pool) {
    await this.asegurarEsquema(client);
    const estadoNorm = String(estado || "").trim().toLowerCase();
    const where = ["1=1"];
    const params = [];
    if (estadoNorm) {
      params.push(estadoNorm);
      where.push(`estado = $${params.length}`);
    }
    const r = await client.query(
      `
        SELECT *
        FROM contacto_mensajes
        WHERE ${where.join(" AND ")}
        ORDER BY created_at DESC, id DESC
      `,
      params
    );
    return r.rows;
  }

  static async obtenerPorId(id, client = pool) {
    await this.asegurarEsquema(client);
    const msgId = Number.parseInt(id, 10);
    if (!Number.isFinite(msgId) || msgId <= 0) return null;
    const r = await client.query(`SELECT * FROM contacto_mensajes WHERE id = $1 LIMIT 1`, [msgId]);
    return r.rows[0] || null;
  }

  static async actualizarEstado(id, estado, client = pool) {
    await this.asegurarEsquema(client);
    const msgId = Number.parseInt(id, 10);
    if (!Number.isFinite(msgId) || msgId <= 0) throw new Error("mensaje_id invalido");
    const estadoNorm = String(estado || "").trim().toLowerCase();
    if (!["nuevo", "leido", "respondido", "archivado"].includes(estadoNorm)) {
      throw new Error("estado invalido");
    }

    const r = await client.query(
      `
        UPDATE contacto_mensajes
        SET estado = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `,
      [estadoNorm, msgId]
    );
    return r.rows[0] || null;
  }
}

module.exports = ContactoMensaje;
