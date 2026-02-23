const pool = require("../config/database");

class Pase {
  static _schemaAsegurado = false;

  static normalizarEstado(estado, fallback = "pendiente") {
    const raw = String(estado || fallback).trim().toLowerCase();
    if (["pendiente", "pagado", "aprobado", "anulado"].includes(raw)) return raw;
    return null;
  }

  static async asegurarEsquema() {
    if (this._schemaAsegurado) return;

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pases_jugadores (
        id SERIAL PRIMARY KEY,
        campeonato_id INTEGER REFERENCES campeonatos(id) ON DELETE SET NULL,
        evento_id INTEGER REFERENCES eventos(id) ON DELETE SET NULL,
        jugador_id INTEGER NOT NULL REFERENCES jugadores(id) ON DELETE CASCADE,
        equipo_origen_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE RESTRICT,
        equipo_destino_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE RESTRICT,
        monto NUMERIC(12,2) NOT NULL DEFAULT 0,
        estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        fecha_pase DATE NOT NULL DEFAULT CURRENT_DATE,
        pagado_en TIMESTAMP NULL,
        observacion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pases_campeonato ON pases_jugadores(campeonato_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pases_evento ON pases_jugadores(evento_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pases_jugador ON pases_jugadores(jugador_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pases_estado ON pases_jugadores(estado)
    `);

    this._schemaAsegurado = true;
  }

  static async crear(payload = {}) {
    await this.asegurarEsquema();

    const jugadorId = Number.parseInt(payload.jugador_id, 10);
    const equipoDestinoId = Number.parseInt(payload.equipo_destino_id, 10);
    const monto = Number.parseFloat(payload.monto || 0);
    const fechaPase = payload.fecha_pase || null;
    const observacion = payload.observacion || null;
    const eventoId = payload.evento_id ? Number.parseInt(payload.evento_id, 10) : null;
    let campeonatoId = payload.campeonato_id ? Number.parseInt(payload.campeonato_id, 10) : null;
    const estado = this.normalizarEstado(payload.estado, "pendiente");

    if (!Number.isFinite(jugadorId) || !Number.isFinite(equipoDestinoId)) {
      throw new Error("jugador_id y equipo_destino_id son obligatorios");
    }
    if (!Number.isFinite(monto) || monto < 0) {
      throw new Error("monto invalido");
    }
    if (!estado) {
      throw new Error("estado invalido");
    }

    const jugadorR = await pool.query(
      `
      SELECT j.id, j.equipo_id, e.campeonato_id
      FROM jugadores j
      JOIN equipos e ON e.id = j.equipo_id
      WHERE j.id = $1
      LIMIT 1
    `,
      [jugadorId]
    );
    const jugador = jugadorR.rows[0];
    if (!jugador) throw new Error("Jugador no encontrado");

    const equipoDestinoR = await pool.query(
      `SELECT id, campeonato_id FROM equipos WHERE id = $1 LIMIT 1`,
      [equipoDestinoId]
    );
    const equipoDestino = equipoDestinoR.rows[0];
    if (!equipoDestino) throw new Error("Equipo destino no encontrado");

    const equipoOrigenId = Number(jugador.equipo_id);
    if (equipoOrigenId === equipoDestinoId) {
      throw new Error("El equipo destino debe ser distinto al equipo actual del jugador");
    }

    if (!Number.isFinite(campeonatoId)) {
      campeonatoId = Number(equipoDestino.campeonato_id || jugador.campeonato_id || null);
    }

    const q = `
      INSERT INTO pases_jugadores (
        campeonato_id, evento_id, jugador_id, equipo_origen_id, equipo_destino_id,
        monto, estado, fecha_pase, observacion
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::date, CURRENT_DATE),$9)
      RETURNING *
    `;
    const values = [
      Number.isFinite(campeonatoId) ? campeonatoId : null,
      Number.isFinite(eventoId) ? eventoId : null,
      jugadorId,
      equipoOrigenId,
      equipoDestinoId,
      Number(monto.toFixed(2)),
      estado,
      fechaPase,
      observacion,
    ];
    const r = await pool.query(q, values);
    return this.obtenerPorId(r.rows[0].id);
  }

  static async listar(filtros = {}) {
    await this.asegurarEsquema();

    const where = [];
    const vals = [];
    let i = 1;

    const setFiltro = (campo, valor) => {
      if (valor === undefined || valor === null || valor === "") return;
      where.push(`${campo} = $${i}`);
      vals.push(valor);
      i += 1;
    };

    setFiltro("p.campeonato_id", filtros.campeonato_id ? Number(filtros.campeonato_id) : null);
    setFiltro("p.evento_id", filtros.evento_id ? Number(filtros.evento_id) : null);
    setFiltro("p.id", filtros.id ? Number(filtros.id) : null);
    setFiltro("p.jugador_id", filtros.jugador_id ? Number(filtros.jugador_id) : null);
    setFiltro("p.equipo_origen_id", filtros.equipo_origen_id ? Number(filtros.equipo_origen_id) : null);
    setFiltro("p.equipo_destino_id", filtros.equipo_destino_id ? Number(filtros.equipo_destino_id) : null);

    if (filtros.estado) {
      const estado = this.normalizarEstado(filtros.estado, null);
      if (estado) setFiltro("p.estado", estado);
    }

    const q = `
      SELECT
        p.*,
        c.nombre AS campeonato_nombre,
        e.nombre AS evento_nombre,
        j.nombre AS jugador_nombre,
        j.apellido AS jugador_apellido,
        j.cedidentidad AS jugador_cedula,
        eo.nombre AS equipo_origen_nombre,
        ed.nombre AS equipo_destino_nombre
      FROM pases_jugadores p
      LEFT JOIN campeonatos c ON c.id = p.campeonato_id
      LEFT JOIN eventos e ON e.id = p.evento_id
      JOIN jugadores j ON j.id = p.jugador_id
      JOIN equipos eo ON eo.id = p.equipo_origen_id
      JOIN equipos ed ON ed.id = p.equipo_destino_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY p.fecha_pase DESC, p.id DESC
    `;
    const r = await pool.query(q, vals);
    return r.rows;
  }

  static async obtenerPorId(id) {
    await this.asegurarEsquema();
    const items = await this.listar({ id });
    if (items.length) return items.find((x) => Number(x.id) === Number(id)) || null;

    const q = `
      SELECT
        p.*,
        c.nombre AS campeonato_nombre,
        e.nombre AS evento_nombre,
        j.nombre AS jugador_nombre,
        j.apellido AS jugador_apellido,
        j.cedidentidad AS jugador_cedula,
        eo.nombre AS equipo_origen_nombre,
        ed.nombre AS equipo_destino_nombre
      FROM pases_jugadores p
      LEFT JOIN campeonatos c ON c.id = p.campeonato_id
      LEFT JOIN eventos e ON e.id = p.evento_id
      JOIN jugadores j ON j.id = p.jugador_id
      JOIN equipos eo ON eo.id = p.equipo_origen_id
      JOIN equipos ed ON ed.id = p.equipo_destino_id
      WHERE p.id = $1
      LIMIT 1
    `;
    const r = await pool.query(q, [id]);
    return r.rows[0] || null;
  }

  static async actualizarEstado(id, payload = {}) {
    await this.asegurarEsquema();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const paseR = await client.query(`SELECT * FROM pases_jugadores WHERE id = $1 LIMIT 1`, [id]);
      const pase = paseR.rows[0];
      if (!pase) {
        await client.query("ROLLBACK");
        return null;
      }

      const estado = this.normalizarEstado(payload.estado, pase.estado);
      if (!estado) throw new Error("estado invalido");

      const observacion =
        payload.observacion === undefined ? pase.observacion : payload.observacion || null;

      const pagadoEn =
        payload.pagado_en !== undefined
          ? payload.pagado_en || null
          : estado === "pagado" || estado === "aprobado"
            ? new Date()
            : pase.pagado_en;

      const actualizadoR = await client.query(
        `
        UPDATE pases_jugadores
        SET estado = $1,
            pagado_en = $2,
            observacion = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `,
        [estado, pagadoEn, observacion, id]
      );
      const actualizado = actualizadoR.rows[0];

      const aplicarTransferencia = payload.aplicar_transferencia !== false;
      if (aplicarTransferencia && ["pagado", "aprobado"].includes(estado)) {
        await client.query(
          `
          UPDATE jugadores
          SET equipo_id = $1
          WHERE id = $2
        `,
          [actualizado.equipo_destino_id, actualizado.jugador_id]
        );
      }

      await client.query("COMMIT");
      return this.obtenerPorId(id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Pase;
