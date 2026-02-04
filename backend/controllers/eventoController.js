const pool = require("../config/database");

function pick(v, fallback = null) {
  return v === undefined ? fallback : v;
}

function parseTimeHHMM(value, fallback) {
  if (!value) return fallback;
  // admite "19:00" o "19:00:00"
  const s = String(value).trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.length === 5 ? `${s}:00` : s;
  return fallback;
}

const EventoController = {
  // POST /eventos
  async crearEvento(req, res) {
    try {
      const {
        campeonato_id,
        nombre,
        organizador,
        fecha_inicio,
        fecha_fin,

        // vienen del frontend (aunque aún no existan columnas, las usaremos si las agregaste)
        modalidad,
        horarios,
      } = req.body;

      if (!campeonato_id || !nombre || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({ error: "Faltan campos obligatorios." });
      }

      // defaults
      const mod = (modalidad || "weekend").toLowerCase();
      const wkStart = parseTimeHHMM(horarios?.weekday?.start, "19:00:00");
      const wkEnd = parseTimeHHMM(horarios?.weekday?.end, "22:00:00");

      const satStart = parseTimeHHMM(horarios?.weekend?.sat_start, "13:00:00");
      const satEnd = parseTimeHHMM(horarios?.weekend?.sat_end, "18:00:00");
      const sunStart = parseTimeHHMM(horarios?.weekend?.sun_start, "08:00:00");
      const sunEnd = parseTimeHHMM(horarios?.weekend?.sun_end, "17:00:00");

      // Si NO agregaste columnas, puedes quitar estas columnas del INSERT y listo.
      // Como tú ya vas a dejar “fino”, recomiendo mantenerlas.
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
      const { id } = req.params;
      const q = `
        SELECT e.*,
               c.nombre AS campeonato_nombre
        FROM eventos e
        JOIN campeonatos c ON e.campeonato_id = c.id
        WHERE e.id = $1
      `;
      const result = await pool.query(q, [id]);
      if (!result.rows.length) return res.status(404).json({ error: "Evento no encontrado." });
      return res.json({ evento: result.rows[0] });
    } catch (error) {
      console.error("Error obtenerEvento:", error);
      return res.status(500).json({ error: "Error obteniendo evento." });
    }
  },

  // PUT /eventos/:id
  async actualizarEvento(req, res) {
    try {
      const { id } = req.params;

      const campos = [];
      const valores = [];
      let i = 1;

      for (const [k, v] of Object.entries(req.body)) {
        // no permitir actualizar id
        if (k === "id") continue;
        campos.push(`${k} = $${i}`);
        valores.push(v);
        i++;
      }

      if (!campos.length) {
        return res.status(400).json({ error: "No hay campos para actualizar." });
      }

      valores.push(id);
      const q = `
        UPDATE eventos
        SET ${campos.join(", ")}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${i}
        RETURNING *
      `;
      const result = await pool.query(q, valores);
      if (!result.rows.length) return res.status(404).json({ error: "Evento no encontrado." });
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
      if (!result.rows.length) return res.status(404).json({ error: "Evento no encontrado." });
      return res.json({ evento: result.rows[0] });
    } catch (error) {
      console.error("Error eliminarEvento:", error);
      return res.status(500).json({ error: "Error eliminando evento." });
    }
  },

  // POST /eventos/:evento_id/canchas   body: { cancha_ids: [1,2,3] }
  async asignarCanchasAEvento(req, res) {
    const client = await pool.connect();
    try {
      const { evento_id } = req.params;
      const { cancha_ids } = req.body;

      if (!Array.isArray(cancha_ids)) {
        return res.status(400).json({ error: "cancha_ids debe ser un arreglo." });
      }

      await client.query("BEGIN");

      // limpiamos asignaciones previas
      await client.query(`DELETE FROM evento_canchas WHERE evento_id = $1`, [evento_id]);

      // insertamos nuevas
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
      return res.status(500).json({ error: "Error asignando canchas al evento." });
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
      return res.status(500).json({ error: "Error listando canchas del evento." });
    }
  },
};

module.exports = EventoController;