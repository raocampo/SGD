// controllers/eventoController.js
const pool = require("../config/database");
let eventoEsquemaAsegurado = false;

function pick(v, fallback = null) {
  return v === undefined ? fallback : v;
}

function parseTimeHHMM(value, fallback) {
  if (!value) return fallback;
  const s = String(value).trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.length === 5 ? `${s}:00` : s;
  return fallback;
}

async function asegurarEsquemaEventos() {
  if (eventoEsquemaAsegurado) return;

  const colR = await pool.query(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'eventos'
      AND column_name = 'campeonato_id'
    LIMIT 1
  `);

  if (!colR.rows.length) {
    await pool.query(`ALTER TABLE eventos ADD COLUMN campeonato_id INTEGER`);

    // Compatibilidad con esquema legado donde campeonatos apuntaba a eventos.
    await pool.query(`
      UPDATE eventos e
      SET campeonato_id = c.id
      FROM campeonatos c
      WHERE c.evento_id = e.id
        AND e.campeonato_id IS NULL
    `);
  }

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_eventos_campeonato'
      ) THEN
        ALTER TABLE eventos
        ADD CONSTRAINT fk_eventos_campeonato
        FOREIGN KEY (campeonato_id) REFERENCES campeonatos(id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_eventos_campeonato_id ON eventos(campeonato_id)
  `);

  eventoEsquemaAsegurado = true;
}

const eventoController = {
  // =====================================================
  // CRUD EVENTOS
  // =====================================================

  // POST /eventos
  async crearEvento(req, res) {
    try {
      await asegurarEsquemaEventos();

      const {
        campeonato_id,
        nombre,
        organizador,
        fecha_inicio,
        fecha_fin,
        modalidad,
        horarios,
      } = req.body;

      if (!campeonato_id || !nombre || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({ error: "Faltan campos obligatorios." });
      }

      // defaults (según lo que ya definiste)
      const mod = (modalidad || "weekend").toLowerCase();

      const wkStart = parseTimeHHMM(horarios?.weekday?.start, "19:00:00");
      const wkEnd = parseTimeHHMM(horarios?.weekday?.end, "22:00:00");

      const satStart = parseTimeHHMM(horarios?.weekend?.sat_start, "13:00:00");
      const satEnd = parseTimeHHMM(horarios?.weekend?.sat_end, "18:00:00");
      const sunStart = parseTimeHHMM(horarios?.weekend?.sun_start, "08:00:00");
      const sunEnd = parseTimeHHMM(horarios?.weekend?.sun_end, "17:00:00");

      const query = `
        INSERT INTO eventos (
          campeonato_id, nombre, organizador, fecha_inicio, fecha_fin, estado,
          modalidad,
          horario_weekday_inicio, horario_weekday_fin,
          horario_sab_inicio, horario_sab_fin,
          horario_dom_inicio, horario_dom_fin
        )
        VALUES ($1,$2,$3,$4,$5,'activo',$6,$7,$8,$9,$10,$11,$12)
        RETURNING *
      `;

      const values = [
        campeonato_id,
        nombre,
        pick(organizador, null),
        fecha_inicio,
        fecha_fin,
        mod,
        wkStart,
        wkEnd,
        satStart,
        satEnd,
        sunStart,
        sunEnd,
      ];

      const result = await pool.query(query, values);
      return res.json({ evento: result.rows[0] });
    } catch (error) {
      console.error("Error crearEvento:", error);
      return res.status(500).json({ error: "Error creando evento." });
    }
  },

  // GET /eventos
  async listarEventos(req, res) {
    try {
      await asegurarEsquemaEventos();

      const q = `
        SELECT e.*,
               c.nombre AS campeonato_nombre
        FROM eventos e
        JOIN campeonatos c ON e.campeonato_id = c.id
        ORDER BY e.id DESC
      `;
      const result = await pool.query(q);
      return res.json({ eventos: result.rows });
    } catch (error) {
      console.error("Error listarEventos:", error);
      return res.status(500).json({ error: "Error listando eventos." });
    }
  },

  // GET /eventos/campeonato/:campeonato_id
  async listarEventosPorCampeonato(req, res) {
    try {
      await asegurarEsquemaEventos();

      const { campeonato_id } = req.params;
      const q = `
        SELECT e.*,
               c.nombre AS campeonato_nombre
        FROM eventos e
        JOIN campeonatos c ON e.campeonato_id = c.id
        WHERE e.campeonato_id = $1
        ORDER BY e.id DESC
      `;
      const result = await pool.query(q, [campeonato_id]);
      return res.json({ eventos: result.rows });
    } catch (error) {
      console.error("Error listarEventosPorCampeonato:", error);
      return res.status(500).json({ error: "Error listando eventos." });
    }
  },

  // GET /eventos/:id
  async obtenerEvento(req, res) {
    try {
      await asegurarEsquemaEventos();

      const { id } = req.params;
      const q = `
        SELECT e.*,
               c.nombre AS campeonato_nombre
        FROM eventos e
        JOIN campeonatos c ON e.campeonato_id = c.id
        WHERE e.id = $1
      `;
      const result = await pool.query(q, [id]);
      if (!result.rows.length)
        return res.status(404).json({ error: "Evento no encontrado." });
      return res.json({ evento: result.rows[0] });
    } catch (error) {
      console.error("Error obtenerEvento:", error);
      return res.status(500).json({ error: "Error obteniendo evento." });
    }
  },

  // PUT /eventos/:id
  async actualizarEvento(req, res) {
    try {
      await asegurarEsquemaEventos();

      const { id } = req.params;

      const campos = [];
      const valores = [];
      let i = 1;

      for (const [k, v] of Object.entries(req.body)) {
        if (k === "id") continue;
        campos.push(`${k} = $${i}`);
        valores.push(v);
        i++;
      }

      if (!campos.length) {
        return res
          .status(400)
          .json({ error: "No hay campos para actualizar." });
      }

      valores.push(id);
      const q = `
        UPDATE eventos
        SET ${campos.join(", ")}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${i}
        RETURNING *
      `;
      const result = await pool.query(q, valores);
      if (!result.rows.length)
        return res.status(404).json({ error: "Evento no encontrado." });
      return res.json({ evento: result.rows[0] });
    } catch (error) {
      console.error("Error actualizarEvento:", error);
      return res.status(500).json({ error: "Error actualizando evento." });
    }
  },

  // DELETE /eventos/:id
  async eliminarEvento(req, res) {
    try {
      const { id } = req.params;
      const q = `DELETE FROM eventos WHERE id = $1 RETURNING *`;
      const result = await pool.query(q, [id]);
      if (!result.rows.length)
        return res.status(404).json({ error: "Evento no encontrado." });
      return res.json({ evento: result.rows[0] });
    } catch (error) {
      console.error("Error eliminarEvento:", error);
      return res.status(500).json({ error: "Error eliminando evento." });
    }
  },

  // =====================================================
  // CANCHAS DEL EVENTO (evento_canchas)
  // =====================================================

  // POST /eventos/:evento_id/canchas   body: { cancha_ids: [1,2,3] }
  async asignarCanchasAEvento(req, res) {
    const client = await pool.connect();
    try {
      const { evento_id } = req.params;
      const { cancha_ids } = req.body;

      if (!Array.isArray(cancha_ids)) {
        return res
          .status(400)
          .json({ error: "cancha_ids debe ser un arreglo." });
      }

      await client.query("BEGIN");

      await client.query(`DELETE FROM evento_canchas WHERE evento_id = $1`, [
        evento_id,
      ]);

      for (const cid of cancha_ids) {
        await client.query(
          `INSERT INTO evento_canchas (evento_id, cancha_id) VALUES ($1,$2)`,
          [evento_id, cid]
        );
      }

      await client.query("COMMIT");
      return res.json({ ok: true, evento_id, cancha_ids });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error asignarCanchasAEvento:", error);
      return res
        .status(500)
        .json({ error: "Error asignando canchas al evento." });
    } finally {
      client.release();
    }
  },

  // GET /eventos/:evento_id/canchas
  async listarCanchasDeEvento(req, res) {
    try {
      const { evento_id } = req.params;
      const q = `
        SELECT c.*
        FROM evento_canchas ec
        JOIN canchas c ON ec.cancha_id = c.id
        WHERE ec.evento_id = $1
        ORDER BY c.id
      `;
      const result = await pool.query(q, [evento_id]);
      return res.json({ canchas: result.rows });
    } catch (error) {
      console.error("Error listarCanchasDeEvento:", error);
      return res
        .status(500)
        .json({ error: "Error listando canchas del evento." });
    }
  },

  // =====================================================
  // EQUIPOS DEL EVENTO (evento_equipos)
  // =====================================================

  // POST /eventos/:evento_id/equipos  body: { equipo_id: 123 }
  async asignarEquipoAEvento(req, res) {
    try {
      const evento_id = parseInt(req.params.evento_id, 10);
      const equipo_id = parseInt(req.body.equipo_id, 10);

      if (!Number.isFinite(evento_id) || !Number.isFinite(equipo_id)) {
        return res
          .status(400)
          .json({ message: "evento_id y equipo_id son obligatorios" });
      }

      await pool.query(
        `
        INSERT INTO evento_equipos (evento_id, equipo_id)
        VALUES ($1, $2)
        ON CONFLICT (evento_id, equipo_id) DO NOTHING
      `,
        [evento_id, equipo_id]
      );

      return res.json({ ok: true, message: "Equipo asignado al evento" });
    } catch (error) {
      console.error("asignarEquipoAEvento:", error);
      return res
        .status(500)
        .json({ message: "Error asignando equipo al evento" });
    }
  },

  // GET /eventos/:evento_id/equipos
  async listarEquiposDeEvento(req, res) {
    try {
      const evento_id = parseInt(req.params.evento_id, 10);
      if (!Number.isFinite(evento_id)) {
        return res.status(400).json({ message: "evento_id inválido" });
      }

      const result = await pool.query(
        `
        SELECT e.*
        FROM equipos e
        JOIN evento_equipos ee ON ee.equipo_id = e.id
        WHERE ee.evento_id = $1
        ORDER BY e.nombre
      `,
        [evento_id]
      );

      return res.json({ equipos: result.rows });
    } catch (error) {
      console.error("listarEquiposDeEvento:", error);
      return res
        .status(500)
        .json({ message: "Error listando equipos del evento" });
    }
  },

  // DELETE /eventos/:evento_id/equipos/:equipo_id
  async quitarEquipoDeEvento(req, res) {
    try {
      const evento_id = parseInt(req.params.evento_id, 10);
      const equipo_id = parseInt(req.params.equipo_id, 10);

      if (!Number.isFinite(evento_id) || !Number.isFinite(equipo_id)) {
        return res
          .status(400)
          .json({ message: "evento_id y equipo_id inválidos" });
      }

      await pool.query(
        `DELETE FROM evento_equipos WHERE evento_id = $1 AND equipo_id = $2`,
        [evento_id, equipo_id]
      );

      return res.json({ ok: true, message: "Equipo quitado del evento" });
    } catch (error) {
      console.error("quitarEquipoDeEvento:", error);
      return res
        .status(500)
        .json({ message: "Error quitando equipo del evento" });
    }
  },
};

module.exports = eventoController;
