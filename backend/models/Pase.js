const pool = require("../config/database");
const Finanza = require("./Finanza");

class Pase {
  static _schemaAsegurado = false;

  static _agregarFiltroNumero(where, vals, campo, valor) {
    if (valor === undefined || valor === null || `${valor}`.trim() === "") return;
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return;
    vals.push(numero);
    where.push(`${campo} = $${vals.length}`);
  }

  static _agregarFiltroFecha(where, vals, campo, valor, operador = "=") {
    if (!valor) return;
    const raw = String(valor).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return;
    vals.push(raw);
    where.push(`${campo} ${operador} $${vals.length}::date`);
  }

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
    this._agregarFiltroNumero(where, vals, "p.campeonato_id", filtros.campeonato_id);
    this._agregarFiltroNumero(where, vals, "p.evento_id", filtros.evento_id);
    this._agregarFiltroNumero(where, vals, "p.id", filtros.id);
    this._agregarFiltroNumero(where, vals, "p.jugador_id", filtros.jugador_id);
    this._agregarFiltroNumero(where, vals, "p.equipo_origen_id", filtros.equipo_origen_id);
    this._agregarFiltroNumero(where, vals, "p.equipo_destino_id", filtros.equipo_destino_id);

    if (filtros.estado) {
      const estado = this.normalizarEstado(filtros.estado, null);
      if (estado) {
        vals.push(estado);
        where.push(`p.estado = $${vals.length}`);
      }
    }
    this._agregarFiltroFecha(where, vals, "p.fecha_pase", filtros.fecha_desde, ">=");
    this._agregarFiltroFecha(where, vals, "p.fecha_pase", filtros.fecha_hasta, "<=");

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

  static async listarHistorialJugadores(filtros = {}) {
    await this.asegurarEsquema();

    const where = [];
    const vals = [];

    this._agregarFiltroNumero(where, vals, "p.campeonato_id", filtros.campeonato_id);
    this._agregarFiltroNumero(where, vals, "p.evento_id", filtros.evento_id);
    this._agregarFiltroNumero(where, vals, "p.jugador_id", filtros.jugador_id);
    this._agregarFiltroFecha(where, vals, "p.fecha_pase", filtros.fecha_desde, ">=");
    this._agregarFiltroFecha(where, vals, "p.fecha_pase", filtros.fecha_hasta, "<=");

    const equipoId = Number.parseInt(filtros.equipo_id, 10);
    if (Number.isFinite(equipoId) && equipoId > 0) {
      vals.push(equipoId);
      where.push(`(p.equipo_origen_id = $${vals.length} OR p.equipo_destino_id = $${vals.length})`);
    }

    if (filtros.estado) {
      const estado = this.normalizarEstado(filtros.estado, null);
      if (estado) {
        vals.push(estado);
        where.push(`p.estado = $${vals.length}`);
      }
    }

    const q = `
      SELECT
        p.jugador_id,
        j.nombre AS jugador_nombre,
        j.apellido AS jugador_apellido,
        j.cedidentidad AS jugador_cedula,
        COUNT(*)::int AS total_pases,
        COUNT(*) FILTER (WHERE p.estado = 'pendiente')::int AS pendientes,
        COUNT(*) FILTER (WHERE p.estado IN ('pagado', 'aprobado'))::int AS aprobados,
        COUNT(*) FILTER (WHERE p.estado = 'anulado')::int AS anulados,
        COALESCE(SUM(p.monto), 0)::numeric(12,2) AS monto_total,
        MAX(p.fecha_pase) AS ultimo_pase
      FROM pases_jugadores p
      JOIN jugadores j ON j.id = p.jugador_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY p.jugador_id, j.nombre, j.apellido, j.cedidentidad
      ORDER BY MAX(p.fecha_pase) DESC, p.jugador_id DESC
    `;

    const r = await pool.query(q, vals);
    return r.rows;
  }

  static async obtenerHistorialJugador(jugadorId, filtros = {}) {
    await this.asegurarEsquema();
    const id = Number.parseInt(jugadorId, 10);
    if (!Number.isFinite(id) || id <= 0) throw new Error("jugador_id inválido");

    const jugadorR = await pool.query(
      `
      SELECT
        j.id,
        j.nombre,
        j.apellido,
        j.cedidentidad,
        j.equipo_id,
        e.nombre AS equipo_nombre,
        e.campeonato_id
      FROM jugadores j
      LEFT JOIN equipos e ON e.id = j.equipo_id
      WHERE j.id = $1
      LIMIT 1
    `,
      [id]
    );
    const jugador = jugadorR.rows[0];
    if (!jugador) return null;

    const historial = await this.listar({
      ...filtros,
      jugador_id: id,
    });

    const resumen = historial.reduce(
      (acc, item) => {
        const estado = String(item.estado || "").toLowerCase();
        const monto = Number.parseFloat(item.monto || 0);
        acc.total_pases += 1;
        acc.monto_total += Number.isFinite(monto) ? monto : 0;
        if (estado === "pendiente") acc.pendientes += 1;
        else if (estado === "anulado") acc.anulados += 1;
        else if (["pagado", "aprobado"].includes(estado)) acc.aprobados += 1;
        return acc;
      },
      {
        total_pases: 0,
        pendientes: 0,
        aprobados: 0,
        anulados: 0,
        monto_total: 0,
      }
    );
    resumen.monto_total = Number(resumen.monto_total.toFixed(2));

    return {
      jugador: {
        id: jugador.id,
        nombre: jugador.nombre,
        apellido: jugador.apellido,
        cedidentidad: jugador.cedidentidad,
        equipo_id: jugador.equipo_id,
        equipo_nombre: jugador.equipo_nombre,
        campeonato_id: jugador.campeonato_id,
      },
      resumen,
      historial,
    };
  }

  static async listarHistorialEquipos(filtros = {}) {
    await this.asegurarEsquema();

    const where = [];
    const vals = [];

    this._agregarFiltroNumero(where, vals, "t.campeonato_id", filtros.campeonato_id);
    this._agregarFiltroNumero(where, vals, "t.evento_id", filtros.evento_id);
    this._agregarFiltroNumero(where, vals, "t.equipo_id", filtros.equipo_id);
    this._agregarFiltroFecha(where, vals, "t.fecha_pase", filtros.fecha_desde, ">=");
    this._agregarFiltroFecha(where, vals, "t.fecha_pase", filtros.fecha_hasta, "<=");

    if (filtros.estado) {
      const estado = this.normalizarEstado(filtros.estado, null);
      if (estado) {
        vals.push(estado);
        where.push(`t.estado = $${vals.length}`);
      }
    }

    const q = `
      SELECT
        t.equipo_id,
        eq.nombre AS equipo_nombre,
        c.nombre AS campeonato_nombre,
        COUNT(*)::int AS total_movimientos,
        COUNT(*) FILTER (WHERE t.rol_movimiento = 'origen')::int AS pases_salida,
        COUNT(*) FILTER (WHERE t.rol_movimiento = 'destino')::int AS pases_entrada,
        COALESCE(SUM(CASE WHEN t.rol_movimiento = 'origen' THEN t.monto ELSE 0 END), 0)::numeric(12,2) AS monto_salida,
        COALESCE(SUM(CASE WHEN t.rol_movimiento = 'destino' THEN t.monto ELSE 0 END), 0)::numeric(12,2) AS monto_entrada,
        COUNT(*) FILTER (WHERE t.estado = 'pendiente')::int AS pendientes,
        COUNT(*) FILTER (WHERE t.estado IN ('pagado', 'aprobado'))::int AS aprobados,
        COUNT(*) FILTER (WHERE t.estado = 'anulado')::int AS anulados,
        MAX(t.fecha_pase) AS ultimo_pase
      FROM (
        SELECT
          p.id,
          p.campeonato_id,
          p.evento_id,
          p.fecha_pase,
          p.estado,
          p.monto,
          p.equipo_origen_id AS equipo_id,
          'origen'::text AS rol_movimiento
        FROM pases_jugadores p
        UNION ALL
        SELECT
          p.id,
          p.campeonato_id,
          p.evento_id,
          p.fecha_pase,
          p.estado,
          p.monto,
          p.equipo_destino_id AS equipo_id,
          'destino'::text AS rol_movimiento
        FROM pases_jugadores p
      ) t
      JOIN equipos eq ON eq.id = t.equipo_id
      LEFT JOIN campeonatos c ON c.id = eq.campeonato_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY t.equipo_id, eq.nombre, c.nombre
      ORDER BY MAX(t.fecha_pase) DESC, t.equipo_id DESC
    `;

    const r = await pool.query(q, vals);
    return r.rows;
  }

  static async obtenerHistorialEquipo(equipoId, filtros = {}) {
    await this.asegurarEsquema();
    const id = Number.parseInt(equipoId, 10);
    if (!Number.isFinite(id) || id <= 0) throw new Error("equipo_id inválido");

    const equipoR = await pool.query(
      `
      SELECT
        e.id,
        e.nombre,
        e.campeonato_id,
        c.nombre AS campeonato_nombre
      FROM equipos e
      LEFT JOIN campeonatos c ON c.id = e.campeonato_id
      WHERE e.id = $1
      LIMIT 1
    `,
      [id]
    );
    const equipo = equipoR.rows[0];
    if (!equipo) return null;

    const where = [`(p.equipo_origen_id = $1 OR p.equipo_destino_id = $1)`];
    const vals = [id];

    this._agregarFiltroNumero(where, vals, "p.campeonato_id", filtros.campeonato_id);
    this._agregarFiltroNumero(where, vals, "p.evento_id", filtros.evento_id);
    this._agregarFiltroFecha(where, vals, "p.fecha_pase", filtros.fecha_desde, ">=");
    this._agregarFiltroFecha(where, vals, "p.fecha_pase", filtros.fecha_hasta, "<=");

    if (filtros.estado) {
      const estado = this.normalizarEstado(filtros.estado, null);
      if (estado) {
        vals.push(estado);
        where.push(`p.estado = $${vals.length}`);
      }
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
        ed.nombre AS equipo_destino_nombre,
        CASE
          WHEN p.equipo_origen_id = $1 THEN 'salida'
          ELSE 'entrada'
        END AS tipo_historial
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
    const historial = r.rows;

    const resumen = historial.reduce(
      (acc, item) => {
        const monto = Number.parseFloat(item.monto || 0);
        const tipo = String(item.tipo_historial || "").toLowerCase();
        const estado = String(item.estado || "").toLowerCase();
        if (tipo === "salida") {
          acc.pases_salida += 1;
          acc.monto_salida += Number.isFinite(monto) ? monto : 0;
        } else {
          acc.pases_entrada += 1;
          acc.monto_entrada += Number.isFinite(monto) ? monto : 0;
        }
        if (estado === "pendiente") acc.pendientes += 1;
        else if (estado === "anulado") acc.anulados += 1;
        else if (["pagado", "aprobado"].includes(estado)) acc.aprobados += 1;
        return acc;
      },
      {
        pases_entrada: 0,
        pases_salida: 0,
        monto_entrada: 0,
        monto_salida: 0,
        pendientes: 0,
        aprobados: 0,
        anulados: 0,
      }
    );
    resumen.monto_entrada = Number(resumen.monto_entrada.toFixed(2));
    resumen.monto_salida = Number(resumen.monto_salida.toFixed(2));

    return {
      equipo,
      resumen,
      historial,
    };
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

  static _origenClaveMovimiento(paseId, tipo) {
    return `pase:${Number(paseId)}:${String(tipo || "").trim().toLowerCase()}`;
  }

  static _normalizarFechaMovimiento(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }

    const raw = String(value).trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return null;
  }

  static async _obtenerContextoFinanciero(client, paseId) {
    const r = await client.query(
      `
        SELECT
          p.id,
          p.campeonato_id,
          p.evento_id,
          p.jugador_id,
          p.equipo_origen_id,
          p.equipo_destino_id,
          p.monto,
          p.fecha_pase,
          j.nombre AS jugador_nombre,
          j.apellido AS jugador_apellido,
          eo.nombre AS equipo_origen_nombre,
          eo.campeonato_id AS equipo_origen_campeonato_id,
          ed.nombre AS equipo_destino_nombre,
          ed.campeonato_id AS equipo_destino_campeonato_id
        FROM pases_jugadores p
        LEFT JOIN jugadores j ON j.id = p.jugador_id
        LEFT JOIN equipos eo ON eo.id = p.equipo_origen_id
        LEFT JOIN equipos ed ON ed.id = p.equipo_destino_id
        WHERE p.id = $1
        LIMIT 1
      `,
      [paseId]
    );
    return r.rows[0] || null;
  }

  static async _upsertMovimientoFinancieroPase(client, payload = {}) {
    const q = `
      INSERT INTO finanzas_movimientos (
        campeonato_id,
        evento_id,
        equipo_id,
        tipo_movimiento,
        concepto,
        descripcion,
        monto,
        estado,
        fecha_movimiento,
        referencia,
        origen,
        origen_clave
      )
      VALUES (
        $1,$2,$3,$4,'otro',$5,$6,$7,COALESCE($8::date, CURRENT_DATE),$9,'sistema',$10
      )
      ON CONFLICT (origen_clave)
      DO UPDATE SET
        campeonato_id = EXCLUDED.campeonato_id,
        evento_id = EXCLUDED.evento_id,
        equipo_id = EXCLUDED.equipo_id,
        tipo_movimiento = EXCLUDED.tipo_movimiento,
        concepto = EXCLUDED.concepto,
        descripcion = EXCLUDED.descripcion,
        monto = EXCLUDED.monto,
        estado = EXCLUDED.estado,
        fecha_movimiento = EXCLUDED.fecha_movimiento,
        referencia = EXCLUDED.referencia,
        origen = EXCLUDED.origen,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      payload.campeonato_id,
      payload.evento_id || null,
      payload.equipo_id,
      payload.tipo_movimiento,
      payload.descripcion || null,
      payload.monto,
      payload.estado || "pagado",
      payload.fecha_movimiento || null,
      payload.referencia || null,
      payload.origen_clave,
    ];

    const r = await client.query(q, values);
    return r.rows[0] || null;
  }

  static async _sincronizarFinanzasPorPase(client, paseId, estadoPase) {
    await Finanza.asegurarEsquema(client);

    const contexto = await this._obtenerContextoFinanciero(client, paseId);
    if (!contexto) return;

    const estado = String(estadoPase || "").trim().toLowerCase();
    const monto = Number.parseFloat(contexto.monto || 0);
    if (!Number.isFinite(monto) || monto <= 0) return;

    const campeonatoId = Number.parseInt(
      contexto.campeonato_id ||
        contexto.equipo_origen_campeonato_id ||
        contexto.equipo_destino_campeonato_id,
      10
    );

    if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
      throw new Error("No se pudo determinar campeonato del pase para registrar en finanzas");
    }

    if (estado === "anulado") {
      await client.query(
        `
          UPDATE finanzas_movimientos
          SET estado = 'anulado',
              updated_at = CURRENT_TIMESTAMP
          WHERE origen = 'sistema'
            AND origen_clave LIKE $1
        `,
        [`pase:${Number(paseId)}:%`]
      );
      return;
    }

    if (!["pagado", "aprobado"].includes(estado)) return;

    const jugadorNombre = [contexto.jugador_nombre, contexto.jugador_apellido]
      .filter(Boolean)
      .join(" ")
      .trim() || `Jugador #${Number(contexto.jugador_id)}`;
    const equipoOrigenNombre = contexto.equipo_origen_nombre || `Equipo #${Number(contexto.equipo_origen_id)}`;
    const equipoDestinoNombre = contexto.equipo_destino_nombre || `Equipo #${Number(contexto.equipo_destino_id)}`;
    const fechaMovimiento = this._normalizarFechaMovimiento(contexto.fecha_pase);

    await this._upsertMovimientoFinancieroPase(client, {
      campeonato_id: campeonatoId,
      evento_id: contexto.evento_id ? Number.parseInt(contexto.evento_id, 10) : null,
      equipo_id: Number.parseInt(contexto.equipo_destino_id, 10),
      tipo_movimiento: "cargo",
      descripcion: `Cargo por pase de ${jugadorNombre} (${equipoOrigenNombre} -> ${equipoDestinoNombre})`,
      monto: Number(monto.toFixed(2)),
      estado: "pagado",
      fecha_movimiento: fechaMovimiento,
      referencia: `PASE-${Number(paseId)}-CARGO`,
      origen_clave: this._origenClaveMovimiento(paseId, "cargo_destino"),
    });

    await this._upsertMovimientoFinancieroPase(client, {
      campeonato_id: campeonatoId,
      evento_id: contexto.evento_id ? Number.parseInt(contexto.evento_id, 10) : null,
      equipo_id: Number.parseInt(contexto.equipo_origen_id, 10),
      tipo_movimiento: "abono",
      descripcion: `Abono por pase de ${jugadorNombre} hacia ${equipoDestinoNombre}`,
      monto: Number(monto.toFixed(2)),
      estado: "pagado",
      fecha_movimiento: fechaMovimiento,
      referencia: `PASE-${Number(paseId)}-ABONO`,
      origen_clave: this._origenClaveMovimiento(paseId, "abono_origen"),
    });
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

      const registrarFinanzas = payload.registrar_finanzas !== false;
      if (registrarFinanzas) {
        await this._sincronizarFinanzasPorPase(client, id, estado);
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
