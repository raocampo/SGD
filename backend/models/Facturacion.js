const pool = require("../config/database");
const Finanza = require("./Finanza");

const TIPOS_DOC = new Set(["factura", "nota_venta", "recibo"]);
const ESTADOS_DOC = new Set(["borrador", "emitido", "anulado"]);
const TIPOS_CONTRIBUYENTE = new Set(["ruc", "rise"]);

class Facturacion {
  static _esquemaAsegurado = false;

  static async asegurarEsquema(client = pool) {
    if (this._esquemaAsegurado && client === pool) return;

    await client.query(`
      CREATE TABLE IF NOT EXISTS facturacion_config (
        id SERIAL PRIMARY KEY,
        organizador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        tipo_contribuyente VARCHAR(10) NOT NULL DEFAULT 'ruc'
          CHECK (tipo_contribuyente IN ('ruc', 'rise')),
        ruc_ci VARCHAR(20),
        razon_social VARCHAR(200),
        nombre_comercial VARCHAR(200),
        direccion_matriz TEXT,
        codigo_establecimiento VARCHAR(3) NOT NULL DEFAULT '001',
        punto_emision VARCHAR(3) NOT NULL DEFAULT '001',
        iva_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 15.00,
        secuencial_factura INTEGER NOT NULL DEFAULT 0,
        secuencial_nota_venta INTEGER NOT NULL DEFAULT 0,
        secuencial_recibo INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (organizador_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS documentos_facturacion (
        id SERIAL PRIMARY KEY,
        organizador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        campeonato_id INTEGER REFERENCES campeonatos(id) ON DELETE SET NULL,
        equipo_id INTEGER REFERENCES equipos(id) ON DELETE SET NULL,
        tipo VARCHAR(15) NOT NULL CHECK (tipo IN ('factura', 'nota_venta', 'recibo')),
        serie VARCHAR(10),
        secuencial INTEGER,
        numero_completo VARCHAR(30),
        receptor_nombre VARCHAR(200),
        receptor_ruc_ci VARCHAR(20),
        receptor_email VARCHAR(150),
        receptor_direccion TEXT,
        subtotal_sin_iva NUMERIC(12,2) NOT NULL DEFAULT 0,
        descuento NUMERIC(12,2) NOT NULL DEFAULT 0,
        base_imponible NUMERIC(12,2) NOT NULL DEFAULT 0,
        iva_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 15.00,
        iva_valor NUMERIC(12,2) NOT NULL DEFAULT 0,
        total NUMERIC(12,2) NOT NULL DEFAULT 0,
        estado VARCHAR(15) NOT NULL DEFAULT 'borrador'
          CHECK (estado IN ('borrador', 'emitido', 'anulado')),
        observaciones TEXT,
        fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS documentos_items (
        id SERIAL PRIMARY KEY,
        documento_id INTEGER NOT NULL
          REFERENCES documentos_facturacion(id) ON DELETE CASCADE,
        descripcion VARCHAR(300) NOT NULL,
        cantidad NUMERIC(10,2) NOT NULL DEFAULT 1,
        precio_unitario NUMERIC(12,2) NOT NULL,
        descuento NUMERIC(12,2) NOT NULL DEFAULT 0,
        subtotal NUMERIC(12,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await Finanza.asegurarEsquema(client);

    await client.query(`
      CREATE TABLE IF NOT EXISTS documentos_pagos (
        id SERIAL PRIMARY KEY,
        documento_id INTEGER NOT NULL
          REFERENCES documentos_facturacion(id) ON DELETE CASCADE,
        movimiento_id INTEGER NOT NULL
          REFERENCES finanzas_movimientos(id) ON DELETE RESTRICT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (documento_id, movimiento_id),
        UNIQUE (movimiento_id)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_doc_facturacion_org
        ON documentos_facturacion(organizador_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_doc_facturacion_campeonato
        ON documentos_facturacion(campeonato_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_doc_facturacion_estado
        ON documentos_facturacion(estado)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documentos_pagos_doc
        ON documentos_pagos(documento_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documentos_pagos_mov
        ON documentos_pagos(movimiento_id)
    `);

    if (client === pool) this._esquemaAsegurado = true;
  }

  static normalizarMovimientoIds(ids = []) {
    const valores = Array.isArray(ids) ? ids : [ids];
    const unicos = new Set();

    valores.forEach((valor) => {
      const id = Number.parseInt(valor, 10);
      if (Number.isFinite(id) && id > 0) {
        unicos.add(id);
      }
    });

    return Array.from(unicos);
  }

  static async obtenerMovimientosDocumento(documentoId, client = pool) {
    const { rows } = await client.query(
      `
        SELECT fm.*,
               ev.nombre AS evento_nombre
        FROM documentos_pagos dp
        JOIN finanzas_movimientos fm ON fm.id = dp.movimiento_id
        LEFT JOIN eventos ev ON ev.id = fm.evento_id
        WHERE dp.documento_id = $1
        ORDER BY fm.fecha_movimiento DESC, fm.id DESC
      `,
      [documentoId]
    );
    return rows;
  }

  static async vincularMovimientosDocumento(client, documento, movimientoIds = []) {
    const ids = this.normalizarMovimientoIds(movimientoIds);

    await client.query("DELETE FROM documentos_pagos WHERE documento_id = $1", [documento.id]);
    if (!ids.length) return [];

    if (!documento.campeonato_id || !documento.equipo_id) {
      throw new Error("Para documentar movimientos selecciona campeonato y equipo");
    }

    const { rows } = await client.query(
      `
        SELECT id, campeonato_id, equipo_id
        FROM finanzas_movimientos
        WHERE id = ANY($1::int[])
      `,
      [ids]
    );

    if (rows.length !== ids.length) {
      throw new Error("Uno o más movimientos no existen");
    }

    const fueraDeContexto = rows.find((mov) => (
      Number(mov.campeonato_id) !== Number(documento.campeonato_id) ||
      Number(mov.equipo_id) !== Number(documento.equipo_id)
    ));
    if (fueraDeContexto) {
      throw new Error("Los movimientos seleccionados no pertenecen al equipo/campeonato del documento");
    }

    const { rows: yaDocumentados } = await client.query(
      `
        SELECT movimiento_id
        FROM documentos_pagos
        WHERE movimiento_id = ANY($1::int[])
          AND documento_id <> $2
        LIMIT 1
      `,
      [ids, documento.id]
    );
    if (yaDocumentados.length) {
      throw new Error("Uno de los movimientos seleccionados ya está documentado");
    }

    for (const movimientoId of ids) {
      await client.query(
        `
          INSERT INTO documentos_pagos (documento_id, movimiento_id)
          VALUES ($1, $2)
          ON CONFLICT (documento_id, movimiento_id) DO NOTHING
        `,
        [documento.id, movimientoId]
      );
    }

    return this.obtenerMovimientosDocumento(documento.id, client);
  }

  // ─── CONFIG ────────────────────────────────────────────────────────────────

  static async obtenerConfig(organizadorId) {
    await this.asegurarEsquema();
    const { rows } = await pool.query(
      "SELECT * FROM facturacion_config WHERE organizador_id = $1",
      [organizadorId]
    );
    return rows[0] || null;
  }

  static async guardarConfig(organizadorId, datos) {
    await this.asegurarEsquema();
    const {
      tipo_contribuyente = "ruc",
      ruc_ci,
      razon_social,
      nombre_comercial,
      direccion_matriz,
      codigo_establecimiento = "001",
      punto_emision = "001",
      iva_porcentaje = 15,
    } = datos;

    if (!TIPOS_CONTRIBUYENTE.has(tipo_contribuyente)) {
      throw new Error("tipo_contribuyente inválido");
    }

    const { rows } = await pool.query(
      `INSERT INTO facturacion_config
         (organizador_id, tipo_contribuyente, ruc_ci, razon_social, nombre_comercial,
          direccion_matriz, codigo_establecimiento, punto_emision, iva_porcentaje)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (organizador_id) DO UPDATE SET
         tipo_contribuyente = EXCLUDED.tipo_contribuyente,
         ruc_ci = EXCLUDED.ruc_ci,
         razon_social = EXCLUDED.razon_social,
         nombre_comercial = EXCLUDED.nombre_comercial,
         direccion_matriz = EXCLUDED.direccion_matriz,
         codigo_establecimiento = EXCLUDED.codigo_establecimiento,
         punto_emision = EXCLUDED.punto_emision,
         iva_porcentaje = EXCLUDED.iva_porcentaje,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        organizadorId, tipo_contribuyente, ruc_ci, razon_social,
        nombre_comercial, direccion_matriz, codigo_establecimiento,
        punto_emision, iva_porcentaje,
      ]
    );
    return rows[0];
  }

  // ─── DOCUMENTOS ────────────────────────────────────────────────────────────

  static async listarDocumentos(filtros = {}) {
    await this.asegurarEsquema();
    const { organizador_id, campeonato_id, tipo, estado, limit = 100, offset = 0 } = filtros;

    const conds = [];
    const vals = [];

    if (organizador_id) { vals.push(organizador_id); conds.push(`d.organizador_id = $${vals.length}`); }
    if (campeonato_id)  { vals.push(campeonato_id);  conds.push(`d.campeonato_id = $${vals.length}`); }
    if (tipo)           { vals.push(tipo);           conds.push(`d.tipo = $${vals.length}`); }
    if (estado)         { vals.push(estado);         conds.push(`d.estado = $${vals.length}`); }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    vals.push(limit, offset);
    const { rows } = await pool.query(
      `SELECT d.*,
              c.nombre AS campeonato_nombre,
              e.nombre AS equipo_nombre,
              (
                SELECT COUNT(*)::int
                FROM documentos_pagos dp
                WHERE dp.documento_id = d.id
              ) AS movimientos_documentados
       FROM documentos_facturacion d
       LEFT JOIN campeonatos c ON c.id = d.campeonato_id
       LEFT JOIN equipos e ON e.id = d.equipo_id
       ${where}
       ORDER BY d.created_at DESC
       LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
      vals
    );
    return rows;
  }

  static async obtenerDocumento(id, organizadorId = null) {
    await this.asegurarEsquema();
    const cond = organizadorId
      ? "d.id = $1 AND d.organizador_id = $2"
      : "d.id = $1";
    const params = organizadorId ? [id, organizadorId] : [id];

    const { rows } = await pool.query(
      `SELECT d.*,
              c.nombre AS campeonato_nombre,
              e.nombre AS equipo_nombre,
              fc.tipo_contribuyente AS emisor_tipo_contribuyente,
              fc.ruc_ci AS emisor_ruc_ci,
              fc.razon_social AS emisor_razon_social,
              fc.nombre_comercial AS emisor_nombre_comercial,
              fc.direccion_matriz AS emisor_direccion_matriz,
              fc.codigo_establecimiento AS emisor_codigo_establecimiento,
              fc.punto_emision AS emisor_punto_emision,
              fc.iva_porcentaje AS emisor_iva_porcentaje
       FROM documentos_facturacion d
       LEFT JOIN campeonatos c ON c.id = d.campeonato_id
       LEFT JOIN equipos e ON e.id = d.equipo_id
       LEFT JOIN facturacion_config fc ON fc.organizador_id = d.organizador_id
       WHERE ${cond}`,
      params
    );
    if (!rows.length) throw new Error("Documento no encontrado");

    const { rows: items } = await pool.query(
      "SELECT * FROM documentos_items WHERE documento_id = $1 ORDER BY id",
      [id]
    );
    const movimientos = await this.obtenerMovimientosDocumento(id);
    return { ...rows[0], items, movimientos };
  }

  static async crearDocumento(organizadorId, datos, itemsArray, movimientoIds = undefined) {
    await this.asegurarEsquema();

    const {
      campeonato_id = null,
      equipo_id = null,
      tipo,
      receptor_nombre,
      receptor_ruc_ci,
      receptor_email,
      receptor_direccion,
      descuento = 0,
      observaciones,
      fecha_emision,
    } = datos;

    if (!TIPOS_DOC.has(tipo)) throw new Error("tipo de documento inválido");
    if (!itemsArray?.length) throw new Error("El documento debe tener al menos un ítem");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await this.asegurarEsquema(client);

      // Obtener/crear config y siguiente secuencial
      const colSecuencial = tipo === "factura"
        ? "secuencial_factura"
        : tipo === "nota_venta"
          ? "secuencial_nota_venta"
          : "secuencial_recibo";

      const { rows: cfgRows } = await client.query(
        `INSERT INTO facturacion_config (organizador_id)
         VALUES ($1)
         ON CONFLICT (organizador_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [organizadorId]
      );
      const cfg = cfgRows[0];

      const { rows: seqRows } = await client.query(
        `UPDATE facturacion_config
         SET ${colSecuencial} = ${colSecuencial} + 1, updated_at = CURRENT_TIMESTAMP
         WHERE organizador_id = $1
         RETURNING ${colSecuencial} AS seq,
                   codigo_establecimiento, punto_emision, iva_porcentaje`,
        [organizadorId]
      );
      const { seq, codigo_establecimiento, punto_emision, iva_porcentaje } = seqRows[0];

      const serie = `${codigo_establecimiento}-${punto_emision}`;
      const secuencial = seq;
      const numero_completo = `${serie}-${String(secuencial).padStart(9, "0")}`;

      // Calcular totales
      let subtotal_sin_iva = 0;
      const itemsCalculados = itemsArray.map((it) => {
        const cant = Number(it.cantidad) || 1;
        const precio = Number(it.precio_unitario) || 0;
        const desc = Number(it.descuento) || 0;
        const sub = parseFloat((cant * precio - desc).toFixed(2));
        subtotal_sin_iva += sub;
        return { ...it, cantidad: cant, precio_unitario: precio, descuento: desc, subtotal: sub };
      });
      subtotal_sin_iva = parseFloat(subtotal_sin_iva.toFixed(2));
      const desc_total = parseFloat((Number(descuento) || 0).toFixed(2));
      const base_imponible = parseFloat((subtotal_sin_iva - desc_total).toFixed(2));

      // Nota de venta y recibo no tienen IVA desglosado
      const aplica_iva = tipo === "factura";
      const iva_valor = aplica_iva
        ? parseFloat((base_imponible * (iva_porcentaje / 100)).toFixed(2))
        : 0;
      const total = parseFloat((base_imponible + iva_valor).toFixed(2));

      const { rows: docRows } = await client.query(
        `INSERT INTO documentos_facturacion
           (organizador_id, campeonato_id, equipo_id, tipo, serie, secuencial,
            numero_completo, receptor_nombre, receptor_ruc_ci, receptor_email,
            receptor_direccion, subtotal_sin_iva, descuento, base_imponible,
            iva_porcentaje, iva_valor, total, estado, observaciones, fecha_emision)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'borrador',$18,$19)
         RETURNING *`,
        [
          organizadorId, campeonato_id, equipo_id, tipo, serie, secuencial,
          numero_completo, receptor_nombre, receptor_ruc_ci, receptor_email,
          receptor_direccion, subtotal_sin_iva, desc_total, base_imponible,
          iva_porcentaje, iva_valor, total, observaciones,
          fecha_emision || new Date().toISOString().slice(0, 10),
        ]
      );
      const doc = docRows[0];

      for (const it of itemsCalculados) {
        await client.query(
          `INSERT INTO documentos_items
             (documento_id, descripcion, cantidad, precio_unitario, descuento, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [doc.id, it.descripcion, it.cantidad, it.precio_unitario, it.descuento, it.subtotal]
        );
      }

      const movimientos = movimientoIds !== undefined
        ? await this.vincularMovimientosDocumento(client, doc, movimientoIds)
        : [];

      await client.query("COMMIT");
      return { ...doc, items: itemsCalculados, movimientos };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  static async cambiarEstado(id, organizadorId, estado) {
    await this.asegurarEsquema();
    if (!ESTADOS_DOC.has(estado)) throw new Error("estado inválido");

    const { rows } = await pool.query(
      `UPDATE documentos_facturacion
       SET estado = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND organizador_id = $3
       RETURNING *`,
      [estado, id, organizadorId]
    );
    if (!rows.length) throw new Error("Documento no encontrado o no autorizado");
    return rows[0];
  }

  static async actualizarDocumento(id, organizadorId, datos, itemsArray, movimientoIds = undefined) {
    await this.asegurarEsquema();

    // Solo borradores se pueden editar
    const { rows: check } = await pool.query(
      "SELECT estado FROM documentos_facturacion WHERE id = $1 AND organizador_id = $2",
      [id, organizadorId]
    );
    if (!check.length) throw new Error("Documento no encontrado");
    if (check[0].estado !== "borrador") throw new Error("Solo se pueden editar documentos en borrador");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const {
        campeonato_id = null,
        equipo_id = null,
        receptor_nombre,
        receptor_ruc_ci,
        receptor_email,
        receptor_direccion,
        descuento = 0,
        observaciones,
        fecha_emision,
      } = datos;

      const { rows: cfgRows } = await client.query(
        "SELECT iva_porcentaje FROM facturacion_config WHERE organizador_id = $1",
        [organizadorId]
      );
      const iva_porcentaje = cfgRows[0]?.iva_porcentaje ?? 15;

      const { rows: docRows } = await client.query(
        "SELECT tipo FROM documentos_facturacion WHERE id = $1",
        [id]
      );
      const tipo = docRows[0].tipo;

      let subtotal_sin_iva = 0;
      const itemsCalc = (itemsArray || []).map((it) => {
        const cant = Number(it.cantidad) || 1;
        const precio = Number(it.precio_unitario) || 0;
        const desc = Number(it.descuento) || 0;
        const sub = parseFloat((cant * precio - desc).toFixed(2));
        subtotal_sin_iva += sub;
        return { ...it, cantidad: cant, precio_unitario: precio, descuento: desc, subtotal: sub };
      });
      subtotal_sin_iva = parseFloat(subtotal_sin_iva.toFixed(2));
      const desc_total = parseFloat((Number(descuento) || 0).toFixed(2));
      const base_imponible = parseFloat((subtotal_sin_iva - desc_total).toFixed(2));
      const aplica_iva = tipo === "factura";
      const iva_valor = aplica_iva
        ? parseFloat((base_imponible * (iva_porcentaje / 100)).toFixed(2))
        : 0;
      const total = parseFloat((base_imponible + iva_valor).toFixed(2));

      await client.query(
        `UPDATE documentos_facturacion SET
           campeonato_id=$1, equipo_id=$2, receptor_nombre=$3, receptor_ruc_ci=$4,
           receptor_email=$5, receptor_direccion=$6, subtotal_sin_iva=$7,
           descuento=$8, base_imponible=$9, iva_porcentaje=$10, iva_valor=$11,
           total=$12, observaciones=$13, fecha_emision=$14, updated_at=CURRENT_TIMESTAMP
         WHERE id=$15`,
        [
          campeonato_id, equipo_id, receptor_nombre, receptor_ruc_ci,
          receptor_email, receptor_direccion, subtotal_sin_iva,
          desc_total, base_imponible, iva_porcentaje, iva_valor,
          total, observaciones, fecha_emision || new Date().toISOString().slice(0, 10),
          id,
        ]
      );

      if (itemsCalc.length) {
        await client.query("DELETE FROM documentos_items WHERE documento_id = $1", [id]);
        for (const it of itemsCalc) {
          await client.query(
            `INSERT INTO documentos_items
               (documento_id, descripcion, cantidad, precio_unitario, descuento, subtotal)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [id, it.descripcion, it.cantidad, it.precio_unitario, it.descuento, it.subtotal]
          );
        }
      }

      if (movimientoIds !== undefined) {
        const { rows: docRowsActualizado } = await client.query(
          "SELECT * FROM documentos_facturacion WHERE id = $1",
          [id]
        );
        await this.vincularMovimientosDocumento(client, docRowsActualizado[0], movimientoIds);
      }

      await client.query("COMMIT");
      return this.obtenerDocumento(id, organizadorId);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = Facturacion;
