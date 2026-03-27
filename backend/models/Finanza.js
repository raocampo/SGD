const pool = require("../config/database");

const TIPOS_MOVIMIENTO = new Set(["cargo", "abono"]);
const CONCEPTOS_MOVIMIENTO = new Set([
  "inscripcion",
  "arbitraje",
  "multa",
  "pago",
  "ajuste",
  "otro",
]);
const ESTADOS_MOVIMIENTO = new Set([
  "pendiente",
  "parcial",
  "pagado",
  "vencido",
  "anulado",
]);

class Finanza {
  static _esquemaAsegurado = false;

  static async asegurarEsquema(client = pool) {
    if (this._esquemaAsegurado && client === pool) return;

    await client.query(`
      CREATE TABLE IF NOT EXISTS finanzas_movimientos (
        id SERIAL PRIMARY KEY,
        campeonato_id INTEGER NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
        evento_id INTEGER REFERENCES eventos(id) ON DELETE SET NULL,
        equipo_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
        partido_id INTEGER REFERENCES partidos(id) ON DELETE SET NULL,
        tipo_movimiento VARCHAR(10) NOT NULL CHECK (tipo_movimiento IN ('cargo', 'abono')),
        concepto VARCHAR(20) NOT NULL CHECK (concepto IN ('inscripcion','arbitraje','multa','pago','ajuste','otro')),
        descripcion TEXT,
        monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
        estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','parcial','pagado','vencido','anulado')),
        fecha_movimiento DATE NOT NULL DEFAULT CURRENT_DATE,
        numero_recibo_campeonato INTEGER,
        fecha_vencimiento DATE,
        metodo_pago VARCHAR(30),
        referencia VARCHAR(120),
        origen VARCHAR(20) NOT NULL DEFAULT 'manual',
        origen_clave VARCHAR(120) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      ALTER TABLE finanzas_movimientos
      ADD COLUMN IF NOT EXISTS numero_recibo_campeonato INTEGER
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_finanzas_movimientos_campeonato ON finanzas_movimientos(campeonato_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_finanzas_movimientos_evento ON finanzas_movimientos(evento_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_finanzas_movimientos_equipo ON finanzas_movimientos(equipo_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_finanzas_movimientos_estado ON finanzas_movimientos(estado)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_finanzas_movimientos_fecha ON finanzas_movimientos(fecha_movimiento)`
    );
    await client.query(`
      WITH maximos AS (
        SELECT
          campeonato_id,
          COALESCE(MAX(numero_recibo_campeonato), 0)::int AS max_num
        FROM finanzas_movimientos
        WHERE numero_recibo_campeonato IS NOT NULL
        GROUP BY campeonato_id
      ),
      ranked AS (
        SELECT
          fm.id,
          (COALESCE(mx.max_num, 0) + ROW_NUMBER() OVER (
            PARTITION BY fm.campeonato_id
            ORDER BY fm.id
          ))::int AS rn
        FROM finanzas_movimientos fm
        LEFT JOIN maximos mx ON mx.campeonato_id = fm.campeonato_id
        WHERE fm.numero_recibo_campeonato IS NULL
          AND COALESCE(fm.origen, 'manual') = 'manual'
      )
      UPDATE finanzas_movimientos fm
      SET numero_recibo_campeonato = ranked.rn
      FROM ranked
      WHERE fm.id = ranked.id
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_finanzas_movimientos_num_recibo
      ON finanzas_movimientos(campeonato_id, numero_recibo_campeonato)
      WHERE numero_recibo_campeonato IS NOT NULL
    `);

    if (client === pool) this._esquemaAsegurado = true;
  }

  static normalizarTipo(tipo) {
    const valor = String(tipo || "").trim().toLowerCase();
    if (!TIPOS_MOVIMIENTO.has(valor)) {
      throw new Error("tipo_movimiento invalido. Use: cargo o abono");
    }
    return valor;
  }

  static normalizarConcepto(concepto) {
    const valor = String(concepto || "").trim().toLowerCase();
    if (!CONCEPTOS_MOVIMIENTO.has(valor)) {
      throw new Error(
        "concepto invalido. Use: inscripcion, arbitraje, multa, pago, ajuste u otro"
      );
    }
    return valor;
  }

  static normalizarEstado(estado, tipo) {
    if (estado === undefined || estado === null || estado === "") {
      return tipo === "abono" ? "pagado" : "pendiente";
    }
    const valor = String(estado).trim().toLowerCase();
    if (!ESTADOS_MOVIMIENTO.has(valor)) {
      throw new Error(
        "estado invalido. Use: pendiente, parcial, pagado, vencido o anulado"
      );
    }
    return valor;
  }

  static parseNumeroPositivo(valor, campo) {
    const num = Number.parseFloat(valor);
    if (!Number.isFinite(num) || num <= 0) {
      throw new Error(`${campo} debe ser un numero mayor que cero`);
    }
    return Number(num.toFixed(2));
  }

  static parseEntero(valor, campo) {
    const num = Number.parseInt(valor, 10);
    if (!Number.isFinite(num) || num <= 0) {
      throw new Error(`${campo} invalido`);
    }
    return num;
  }

  static parseFecha(valor, campo) {
    if (!valor) return null;
    const s = String(valor).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      throw new Error(`${campo} debe tener formato YYYY-MM-DD`);
    }
    return s;
  }

  static async resolverCampeonatoIdPorEquipo(equipo_id, client = pool) {
    const r = await client.query(
      "SELECT campeonato_id FROM equipos WHERE id = $1 LIMIT 1",
      [equipo_id]
    );
    if (!r.rows.length) throw new Error("Equipo no encontrado");
    return Number(r.rows[0].campeonato_id);
  }

  static async obtenerCampeonatosConCostoInscripcion(client = pool) {
    const r = await client.query(`
      SELECT DISTINCT campeonato_id
      FROM eventos
      WHERE COALESCE(costo_inscripcion, 0) > 0
    `);
    return r.rows
      .map((row) => Number.parseInt(row.campeonato_id, 10))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  static async sincronizarCargosInscripcionCampeonato(campeonato_id, client = pool) {
    const campeonatoId = this.parseEntero(campeonato_id, "campeonato_id");

    const eventosR = await client.query(
      `
        SELECT id, COALESCE(costo_inscripcion, 0)::numeric(12,2) AS costo_inscripcion
        FROM eventos
        WHERE campeonato_id = $1
      `,
      [campeonatoId]
    );

    const clavesVigentes = [];

    for (const ev of eventosR.rows) {
      const eventoId = Number.parseInt(ev.id, 10);
      const costo = Number.parseFloat(ev.costo_inscripcion || 0);
      if (!Number.isFinite(eventoId) || eventoId <= 0) continue;
      if (!Number.isFinite(costo) || costo <= 0) continue;

      let equiposR;
      try {
        equiposR = await client.query(
          `
            SELECT DISTINCT x.equipo_id
            FROM (
              SELECT ee.equipo_id
              FROM evento_equipos ee
              WHERE ee.evento_id = $1
              UNION
              SELECT p.equipo_local_id AS equipo_id
              FROM partidos p
              WHERE p.evento_id = $1
              UNION
              SELECT p.equipo_visitante_id AS equipo_id
              FROM partidos p
              WHERE p.evento_id = $1
            ) x
            JOIN equipos e ON e.id = x.equipo_id
            WHERE x.equipo_id IS NOT NULL
              AND e.campeonato_id = $2
          `,
          [eventoId, campeonatoId]
        );
      } catch (error) {
        const msg = String(error?.message || "").toLowerCase();
        if (!msg.includes("evento_equipos")) throw error;
        equiposR = await client.query(
          `
            SELECT DISTINCT x.equipo_id
            FROM (
              SELECT p.equipo_local_id AS equipo_id
              FROM partidos p
              WHERE p.evento_id = $1
              UNION
              SELECT p.equipo_visitante_id AS equipo_id
              FROM partidos p
              WHERE p.evento_id = $1
            ) x
            JOIN equipos e ON e.id = x.equipo_id
            WHERE x.equipo_id IS NOT NULL
              AND e.campeonato_id = $2
          `,
          [eventoId, campeonatoId]
        );
      }

      for (const eq of equiposR.rows) {
        const equipoId = Number.parseInt(eq.equipo_id, 10);
        if (!Number.isFinite(equipoId) || equipoId <= 0) continue;
        const origenClave = `inscripcion:evento:${eventoId}:equipo:${equipoId}`;
        clavesVigentes.push(origenClave);

        await client.query(
          `
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
              $1, $2, $3, 'cargo', 'inscripcion',
              'Cargo inscripción de categoría',
              $4, 'pendiente', CURRENT_DATE,
              $5, 'sistema', $6
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
              fecha_movimiento = EXCLUDED.fecha_movimiento,
              referencia = EXCLUDED.referencia,
              origen = EXCLUDED.origen,
              updated_at = CURRENT_TIMESTAMP
          `,
          [
            campeonatoId,
            eventoId,
            equipoId,
            Number(costo.toFixed(2)),
            `INSCRIPCION-E${eventoId}-EQ${equipoId}`,
            origenClave,
          ]
        );
      }
    }

    if (clavesVigentes.length) {
      await client.query(
        `
          DELETE FROM finanzas_movimientos fm
          WHERE fm.campeonato_id = $1
            AND fm.origen = 'sistema'
            AND fm.tipo_movimiento = 'cargo'
            AND fm.concepto = 'inscripcion'
            AND fm.origen_clave LIKE 'inscripcion:evento:%'
            AND NOT (fm.origen_clave = ANY($2::text[]))
        `,
        [campeonatoId, clavesVigentes]
      );
    } else {
      await client.query(
        `
          DELETE FROM finanzas_movimientos fm
          WHERE fm.campeonato_id = $1
            AND fm.origen = 'sistema'
            AND fm.tipo_movimiento = 'cargo'
            AND fm.concepto = 'inscripcion'
            AND fm.origen_clave LIKE 'inscripcion:evento:%'
        `,
        [campeonatoId]
      );
    }
  }

  static async sincronizarCargosInscripcion(filtros = {}, client = pool) {
    const campeonatos = new Set();

    if (filtros.campeonato_id) {
      campeonatos.add(this.parseEntero(filtros.campeonato_id, "campeonato_id"));
    }
    if (Array.isArray(filtros.campeonato_ids) && filtros.campeonato_ids.length) {
      filtros.campeonato_ids.forEach((id) => {
        campeonatos.add(this.parseEntero(id, "campeonato_id"));
      });
    }

    if (filtros.equipo_id) {
      const equipoId = this.parseEntero(filtros.equipo_id, "equipo_id");
      const campeonatoId = await this.resolverCampeonatoIdPorEquipo(equipoId, client);
      campeonatos.add(campeonatoId);
    }

    if (campeonatos.size === 0) {
      const ids = await this.obtenerCampeonatosConCostoInscripcion(client);
      ids.forEach((id) => campeonatos.add(id));
    }

    for (const campeonatoId of campeonatos) {
      await this.sincronizarCargosInscripcionCampeonato(campeonatoId, client);
    }
  }

  static async crearMovimiento(data = {}, client = pool) {
    await this.asegurarEsquema(client);

    const equipo_id = this.parseEntero(data.equipo_id, "equipo_id");
    const tipo_movimiento = this.normalizarTipo(data.tipo_movimiento);
    const concepto = this.normalizarConcepto(data.concepto);
    const monto = this.parseNumeroPositivo(data.monto, "monto");

    const campeonato_id = data.campeonato_id
      ? this.parseEntero(data.campeonato_id, "campeonato_id")
      : await this.resolverCampeonatoIdPorEquipo(equipo_id, client);

    const evento_id =
      data.evento_id === undefined || data.evento_id === null || data.evento_id === ""
        ? null
        : this.parseEntero(data.evento_id, "evento_id");
    const partido_id =
      data.partido_id === undefined || data.partido_id === null || data.partido_id === ""
        ? null
        : this.parseEntero(data.partido_id, "partido_id");

    const estado = this.normalizarEstado(data.estado, tipo_movimiento);
    const fecha_movimiento = this.parseFecha(data.fecha_movimiento, "fecha_movimiento");
    const fecha_vencimiento = this.parseFecha(data.fecha_vencimiento, "fecha_vencimiento");
    const descripcion = (data.descripcion || "").toString().trim() || null;
    const metodo_pago = (data.metodo_pago || "").toString().trim() || null;
    const referencia = (data.referencia || "").toString().trim() || null;
    const origen = ((data.origen || "manual").toString().trim() || "manual").slice(0, 20);
    const origen_clave = (data.origen_clave || "").toString().trim() || null;
    const generarRecibo = origen === "manual";

    if (evento_id) {
      const ev = await client.query(
        "SELECT id FROM eventos WHERE id = $1 AND campeonato_id = $2 LIMIT 1",
        [evento_id, campeonato_id]
      );
      if (!ev.rows.length) {
        throw new Error("evento_id no pertenece al campeonato indicado");
      }
    }

    const q = `
      WITH next_num AS (
        SELECT COALESCE(MAX(numero_recibo_campeonato), 0) + 1 AS next_num
        FROM finanzas_movimientos
        WHERE campeonato_id = $1
          AND numero_recibo_campeonato IS NOT NULL
      )
      INSERT INTO finanzas_movimientos (
        campeonato_id,
        evento_id,
        equipo_id,
        partido_id,
        tipo_movimiento,
        concepto,
        descripcion,
        monto,
        estado,
        fecha_movimiento,
        numero_recibo_campeonato,
        fecha_vencimiento,
        metodo_pago,
        referencia,
        origen,
        origen_clave
      )
      SELECT
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        COALESCE($10::date, CURRENT_DATE),
        CASE WHEN $16::boolean THEN next_num.next_num ELSE NULL END,
        $11,$12,$13,$14,$15
      FROM next_num
      RETURNING *
    `;
    const values = [
      campeonato_id,
      evento_id,
      equipo_id,
      partido_id,
      tipo_movimiento,
      concepto,
      descripcion,
      monto,
      estado,
      fecha_movimiento,
      fecha_vencimiento,
      metodo_pago,
      referencia,
      origen,
      origen_clave,
      generarRecibo,
    ];

    const r = await client.query(q, values);
    return r.rows[0];
  }

  static async listarMovimientos(filtros = {}) {
    await this.asegurarEsquema();
    await this.sincronizarCargosInscripcion(filtros, pool);

    const where = [];
    const values = [];
    let i = 1;

    const addEq = (campo, valor) => {
      if (valor === undefined || valor === null || valor === "") return;
      where.push(`fm.${campo} = $${i++}`);
      values.push(valor);
    };

    if (filtros.campeonato_id) {
      addEq("campeonato_id", this.parseEntero(filtros.campeonato_id, "campeonato_id"));
    }
    if (Array.isArray(filtros.campeonato_ids) && filtros.campeonato_ids.length) {
      const ids = filtros.campeonato_ids
        .map((x) => this.parseEntero(x, "campeonato_id"))
        .filter((x) => Number.isFinite(x) && x > 0);
      if (ids.length) {
        where.push(`fm.campeonato_id = ANY($${i++}::int[])`);
        values.push(ids);
      }
    }
    if (filtros.evento_id) {
      addEq("evento_id", this.parseEntero(filtros.evento_id, "evento_id"));
    }
    if (filtros.equipo_id) {
      addEq("equipo_id", this.parseEntero(filtros.equipo_id, "equipo_id"));
    }
    if (Array.isArray(filtros.equipo_ids) && filtros.equipo_ids.length) {
      const ids = filtros.equipo_ids
        .map((x) => this.parseEntero(x, "equipo_id"))
        .filter((x) => Number.isFinite(x) && x > 0);
      if (ids.length) {
        where.push(`fm.equipo_id = ANY($${i++}::int[])`);
        values.push(ids);
      }
    }
    addEq("tipo_movimiento", filtros.tipo_movimiento);
    addEq("concepto", filtros.concepto);
    addEq("estado", filtros.estado);

    if (filtros.desde) {
      where.push(`fm.fecha_movimiento >= $${i++}`);
      values.push(this.parseFecha(filtros.desde, "desde"));
    }
    if (filtros.hasta) {
      where.push(`fm.fecha_movimiento <= $${i++}`);
      values.push(this.parseFecha(filtros.hasta, "hasta"));
    }

    const incluirSistema =
      String(filtros.incluir_sistema || "").trim().toLowerCase() === "true";
    if (!incluirSistema) {
      where.push(`fm.origen <> 'sistema'`);
    }

    const limitRaw = Number.parseInt(filtros.limit ?? filtros.limite ?? 200, 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(1000, limitRaw))
      : 200;

    const q = `
      SELECT fm.*,
             e.nombre AS equipo_nombre,
             c.nombre AS campeonato_nombre,
             ev.nombre AS evento_nombre
      FROM finanzas_movimientos fm
      JOIN equipos e ON e.id = fm.equipo_id
      JOIN campeonatos c ON c.id = fm.campeonato_id
      LEFT JOIN eventos ev ON ev.id = fm.evento_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY fm.fecha_movimiento DESC, fm.id DESC
      LIMIT ${limit}
    `;

    const r = await pool.query(q, values);
    return r.rows;
  }

  static async obtenerEstadoCuentaEquipo(equipo_id, filtros = {}) {
    await this.asegurarEsquema();

    const eqId = this.parseEntero(equipo_id, "equipo_id");
    const eqR = await pool.query(
      `
      SELECT e.id, e.nombre, e.campeonato_id, c.nombre AS campeonato_nombre
      FROM equipos e
      JOIN campeonatos c ON c.id = e.campeonato_id
      WHERE e.id = $1
      LIMIT 1
    `,
      [eqId]
    );
    if (!eqR.rows.length) throw new Error("Equipo no encontrado");

    await this.sincronizarCargosInscripcion(
      {
        campeonato_id: filtros.campeonato_id || eqR.rows[0].campeonato_id,
        equipo_id: eqId,
      },
      pool
    );

    const where = ["equipo_id = $1"];
    const whereFm = ["fm.equipo_id = $1"];
    const values = [eqId];
    let i = 2;

    if (filtros.campeonato_id) {
      where.push(`campeonato_id = $${i++}`);
      whereFm.push(`fm.campeonato_id = $${i - 1}`);
      values.push(this.parseEntero(filtros.campeonato_id, "campeonato_id"));
    }
    if (filtros.evento_id) {
      where.push(`evento_id = $${i++}`);
      whereFm.push(`fm.evento_id = $${i - 1}`);
      values.push(this.parseEntero(filtros.evento_id, "evento_id"));
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;

    const resumenQ = `
      SELECT
        COALESCE(SUM(CASE WHEN tipo_movimiento = 'cargo' AND estado <> 'anulado' THEN monto ELSE 0 END), 0)::numeric(12,2) AS total_cargos,
        COALESCE(SUM(CASE WHEN tipo_movimiento = 'abono' AND estado <> 'anulado' THEN monto ELSE 0 END), 0)::numeric(12,2) AS total_abonos,
        COALESCE(SUM(CASE WHEN tipo_movimiento = 'cargo' AND concepto = 'inscripcion' AND estado <> 'anulado' THEN monto ELSE 0 END), 0)::numeric(12,2) AS cargos_inscripcion,
        COALESCE(SUM(CASE WHEN tipo_movimiento = 'abono' AND concepto = 'inscripcion' AND estado <> 'anulado' THEN monto ELSE 0 END), 0)::numeric(12,2) AS abonos_inscripcion,
        COALESCE(SUM(CASE WHEN tipo_movimiento = 'cargo' AND concepto = 'arbitraje' AND estado <> 'anulado' THEN monto ELSE 0 END), 0)::numeric(12,2) AS cargos_arbitraje,
        COALESCE(SUM(CASE WHEN tipo_movimiento = 'abono' AND concepto = 'arbitraje' AND estado <> 'anulado' THEN monto ELSE 0 END), 0)::numeric(12,2) AS abonos_arbitraje,
        COALESCE(SUM(CASE WHEN tipo_movimiento = 'cargo' AND concepto = 'multa' AND estado <> 'anulado' THEN monto ELSE 0 END), 0)::numeric(12,2) AS cargos_multa,
        COALESCE(SUM(CASE WHEN tipo_movimiento = 'abono' AND concepto = 'multa' AND estado <> 'anulado' THEN monto ELSE 0 END), 0)::numeric(12,2) AS abonos_multa,
        COALESCE(SUM(CASE WHEN tipo_movimiento = 'cargo' AND estado IN ('pendiente','parcial','vencido') THEN monto ELSE 0 END), 0)::numeric(12,2) AS cargos_pendientes,
        COALESCE(SUM(CASE WHEN tipo_movimiento = 'cargo' AND estado IN ('pendiente','parcial','vencido') AND fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURRENT_DATE THEN monto ELSE 0 END), 0)::numeric(12,2) AS cargos_vencidos
      FROM finanzas_movimientos
      ${whereSql}
    `;
    const resumenR = await pool.query(resumenQ, values);
    const resumenRaw = resumenR.rows[0] || {};

    const movimientosQ = `
      SELECT fm.*,
             ev.nombre AS evento_nombre
      FROM finanzas_movimientos fm
      LEFT JOIN eventos ev ON ev.id = fm.evento_id
      WHERE ${whereFm.join(" AND ")}
      ORDER BY fm.fecha_movimiento DESC, fm.id DESC
      LIMIT 250
    `;
    const movimientosR = await pool.query(movimientosQ, values);

    const totalCargos = Number(resumenRaw.total_cargos || 0);
    const totalAbonos = Number(resumenRaw.total_abonos || 0);
    const saldo = Number((totalCargos - totalAbonos).toFixed(2));
    const cargosInscripcion = Number(resumenRaw.cargos_inscripcion || 0);
    const abonosInscripcion = Number(resumenRaw.abonos_inscripcion || 0);
    const saldoInscripcion = Number((cargosInscripcion - abonosInscripcion).toFixed(2));
    const cargosArbitraje = Number(resumenRaw.cargos_arbitraje || 0);
    const abonosArbitraje = Number(resumenRaw.abonos_arbitraje || 0);
    const saldoArbitraje = Number((cargosArbitraje - abonosArbitraje).toFixed(2));
    const cargosMulta = Number(resumenRaw.cargos_multa || 0);
    const abonosMulta = Number(resumenRaw.abonos_multa || 0);
    const saldoMulta = Number((cargosMulta - abonosMulta).toFixed(2));

    return {
      equipo: eqR.rows[0],
      resumen: {
        total_cargos: totalCargos,
        total_abonos: totalAbonos,
        saldo,
        cargos_inscripcion: cargosInscripcion,
        abonos_inscripcion: abonosInscripcion,
        saldo_inscripcion: saldoInscripcion,
        cargos_arbitraje: cargosArbitraje,
        abonos_arbitraje: abonosArbitraje,
        saldo_arbitraje: saldoArbitraje,
        cargos_multa: cargosMulta,
        abonos_multa: abonosMulta,
        saldo_multa: saldoMulta,
        cargos_pendientes: Number(resumenRaw.cargos_pendientes || 0),
        cargos_vencidos: Number(resumenRaw.cargos_vencidos || 0),
        estado: saldo > 0 ? "deudor" : "al_dia",
      },
      movimientos: movimientosR.rows,
    };
  }

  static async obtenerMorosidad(filtros = {}) {
    await this.asegurarEsquema();
    await this.sincronizarCargosInscripcion(filtros, pool);

    const where = [];
    const values = [];
    let i = 1;

    if (filtros.campeonato_id) {
      where.push(`fm.campeonato_id = $${i++}`);
      values.push(this.parseEntero(filtros.campeonato_id, "campeonato_id"));
    }
    if (Array.isArray(filtros.campeonato_ids) && filtros.campeonato_ids.length) {
      const ids = filtros.campeonato_ids
        .map((x) => this.parseEntero(x, "campeonato_id"))
        .filter((x) => Number.isFinite(x) && x > 0);
      if (ids.length) {
        where.push(`fm.campeonato_id = ANY($${i++}::int[])`);
        values.push(ids);
      }
    }
    if (filtros.evento_id) {
      where.push(`fm.evento_id = $${i++}`);
      values.push(this.parseEntero(filtros.evento_id, "evento_id"));
    }
    if (filtros.equipo_id) {
      where.push(`fm.equipo_id = $${i++}`);
      values.push(this.parseEntero(filtros.equipo_id, "equipo_id"));
    }
    if (Array.isArray(filtros.equipo_ids) && filtros.equipo_ids.length) {
      const ids = filtros.equipo_ids
        .map((x) => this.parseEntero(x, "equipo_id"))
        .filter((x) => Number.isFinite(x) && x > 0);
      if (ids.length) {
        where.push(`fm.equipo_id = ANY($${i++}::int[])`);
        values.push(ids);
      }
    }

    const baseWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const incluirSaldados =
      String(filtros.incluir_saldados || "").toLowerCase() === "true";

    const q = `
      SELECT
        e.id AS equipo_id,
        e.nombre AS equipo_nombre,
        c.id AS campeonato_id,
        c.nombre AS campeonato_nombre,
        COALESCE(SUM(CASE WHEN fm.tipo_movimiento = 'cargo' AND fm.estado <> 'anulado' THEN fm.monto ELSE 0 END), 0)::numeric(12,2) AS total_cargos,
        COALESCE(SUM(CASE WHEN fm.tipo_movimiento = 'abono' AND fm.estado <> 'anulado' THEN fm.monto ELSE 0 END), 0)::numeric(12,2) AS total_abonos,
        COALESCE(SUM(CASE WHEN fm.tipo_movimiento = 'cargo' AND fm.estado IN ('pendiente','parcial','vencido') AND fm.fecha_vencimiento IS NOT NULL AND fm.fecha_vencimiento < CURRENT_DATE THEN fm.monto ELSE 0 END), 0)::numeric(12,2) AS saldo_vencido
      FROM finanzas_movimientos fm
      JOIN equipos e ON e.id = fm.equipo_id
      JOIN campeonatos c ON c.id = fm.campeonato_id
      ${baseWhere}
      GROUP BY e.id, e.nombre, c.id, c.nombre
      ORDER BY (COALESCE(SUM(CASE WHEN fm.tipo_movimiento = 'cargo' AND fm.estado <> 'anulado' THEN fm.monto ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN fm.tipo_movimiento = 'abono' AND fm.estado <> 'anulado' THEN fm.monto ELSE 0 END), 0)) DESC,
        e.nombre ASC
    `;
    const r = await pool.query(q, values);

    const filas = r.rows.map((row) => {
      const total_cargos = Number(row.total_cargos || 0);
      const total_abonos = Number(row.total_abonos || 0);
      const saldo = Number((total_cargos - total_abonos).toFixed(2));
      const saldo_vencido = Number(row.saldo_vencido || 0);
      return {
        ...row,
        total_cargos,
        total_abonos,
        saldo,
        saldo_vencido,
        estado_morosidad: saldo > 0 ? "moroso" : "al_dia",
      };
    });

    return incluirSaldados ? filas : filas.filter((f) => f.saldo > 0);
  }

  static async marcarMovimientoPagado(movimiento_id, data = {}, client = pool) {
    await this.asegurarEsquema(client);

    const id = this.parseEntero(movimiento_id, "movimiento_id");
    const estado = "pagado";
    const metodoPago = (data.metodo_pago || "movil").toString().trim() || "movil";
    const referencia = (data.referencia || "").toString().trim() || null;
    const fechaMovimiento = this.parseFecha(data.fecha_movimiento, "fecha_movimiento") || null;

    const r = await client.query(
      `
        UPDATE finanzas_movimientos
        SET estado = $1,
            metodo_pago = $2,
            referencia = COALESCE($3, referencia),
            fecha_movimiento = COALESCE($4::date, fecha_movimiento),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `,
      [estado, metodoPago, referencia, fechaMovimiento, id]
    );

    if (!r.rows.length) {
      throw new Error("Movimiento no encontrado");
    }

    return r.rows[0];
  }

  // ─── Gastos operativos ───────────────────────────────────────────────────

  static async crearGasto(data = {}) {
    const {
      campeonato_id,
      evento_id = null,
      partido_id = null,
      categoria,
      descripcion = null,
      monto,
      fecha_gasto = null,
      referencia = null,
      created_by = null,
    } = data;

    const CATEGORIAS = new Set([
      "arbitraje", "alquiler_cancha", "tizado",
      "delegado", "transporte", "comida", "otro",
    ]);

    if (!campeonato_id) throw new Error("campeonato_id es requerido");
    if (!CATEGORIAS.has(String(categoria || "")))
      throw new Error(`Categoría inválida: ${categoria}`);
    if (!monto || Number(monto) <= 0) throw new Error("monto debe ser mayor a 0");

    const r = await pool.query(
      `INSERT INTO gastos_operativos
         (campeonato_id, evento_id, partido_id, categoria, descripcion,
          monto, fecha_gasto, referencia, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,
               COALESCE($7::date, CURRENT_DATE),
               $8,$9)
       RETURNING *`,
      [campeonato_id, evento_id || null, partido_id || null,
       categoria, descripcion, monto,
       fecha_gasto || null, referencia || null, created_by || null]
    );
    return r.rows[0];
  }

  static async listarGastos(filtros = {}) {
    const { campeonato_id, evento_id, partido_id, categoria, desde, hasta } = filtros;
    const params = [];
    const where = [];

    if (campeonato_id) { params.push(campeonato_id); where.push(`g.campeonato_id = $${params.length}`); }
    if (evento_id)     { params.push(evento_id);     where.push(`g.evento_id = $${params.length}`); }
    if (partido_id)    { params.push(partido_id);    where.push(`g.partido_id = $${params.length}`); }
    if (categoria)     { params.push(categoria);     where.push(`g.categoria = $${params.length}`); }
    if (desde)         { params.push(desde);         where.push(`g.fecha_gasto >= $${params.length}::date`); }
    if (hasta)         { params.push(hasta);         where.push(`g.fecha_gasto <= $${params.length}::date`); }

    const sql = `
      SELECT g.*,
             c.nombre AS campeonato_nombre,
             e.nombre AS evento_nombre,
             p.numero_partido_visible AS partido_numero,
             u.nombre AS registrado_por
        FROM gastos_operativos g
        LEFT JOIN campeonatos c ON c.id = g.campeonato_id
        LEFT JOIN eventos e     ON e.id = g.evento_id
        LEFT JOIN partidos p    ON p.id = g.partido_id
        LEFT JOIN usuarios u    ON u.id = g.created_by
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY g.fecha_gasto DESC, g.id DESC`;

    const r = await pool.query(sql, params);
    return r.rows;
  }

  static async actualizarGasto(id, data = {}) {
    const {
      categoria, descripcion, monto,
      fecha_gasto, referencia, evento_id, partido_id,
    } = data;

    const r = await pool.query(
      `UPDATE gastos_operativos
          SET categoria    = COALESCE($1, categoria),
              descripcion  = $2,
              monto        = COALESCE($3, monto),
              fecha_gasto  = COALESCE($4::date, fecha_gasto),
              referencia   = $5,
              evento_id    = $6,
              partido_id   = $7,
              updated_at   = CURRENT_TIMESTAMP
        WHERE id = $8
        RETURNING *`,
      [categoria || null, descripcion ?? null,
       monto || null, fecha_gasto || null,
       referencia ?? null,
       evento_id || null, partido_id || null,
       id]
    );
    if (!r.rows.length) throw new Error("Gasto no encontrado");
    return r.rows[0];
  }

  static async eliminarGasto(id) {
    const r = await pool.query(
      `DELETE FROM gastos_operativos WHERE id = $1 RETURNING id`, [id]
    );
    if (!r.rows.length) throw new Error("Gasto no encontrado");
    return r.rows[0];
  }

  static async resumenGastosPorCategoria(campeonato_id) {
    const r = await pool.query(
      `SELECT categoria,
              COUNT(*)::int          AS cantidad,
              SUM(monto)::numeric    AS total
         FROM gastos_operativos
        WHERE campeonato_id = $1
        GROUP BY categoria
        ORDER BY total DESC`,
      [campeonato_id]
    );
    return r.rows;
  }
}

module.exports = Finanza;
