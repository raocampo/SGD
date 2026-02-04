const pool = require("../config/database");

const CanchaController = {
  async crearCancha(req, res) {
    try {
      const { nombre, ubicacion } = req.body;
      if (!nombre) return res.status(400).json({ error: "nombre es obligatorio" });

      const q = `
        INSERT INTO canchas (nombre, ubicacion)
        VALUES ($1,$2)
        RETURNING *
      `;
      const result = await pool.query(q, [nombre, ubicacion || null]);
      return res.json({ cancha: result.rows[0] });
    } catch (error) {
      console.error("Error crearCancha:", error);
      return res.status(500).json({ error: "Error creando cancha." });
    }
  },

  async listarCanchas(req, res) {
    try {
      const result = await pool.query(`SELECT * FROM canchas ORDER BY id DESC`);
      return res.json({ canchas: result.rows });
    } catch (error) {
      console.error("Error listarCanchas:", error);
      return res.status(500).json({ error: "Error listando canchas." });
    }
  },

  async obtenerCancha(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query(`SELECT * FROM canchas WHERE id=$1`, [id]);
      if (!result.rows.length) return res.status(404).json({ error: "Cancha no encontrada" });
      return res.json({ cancha: result.rows[0] });
    } catch (error) {
      console.error("Error obtenerCancha:", error);
      return res.status(500).json({ error: "Error obteniendo cancha." });
    }
  },

  async actualizarCancha(req, res) {
    try {
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

      if (!campos.length) return res.status(400).json({ error: "No hay campos para actualizar" });

      valores.push(id);
      const q = `
        UPDATE canchas
        SET ${campos.join(", ")}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${i}
        RETURNING *
      `;
      const result = await pool.query(q, valores);
      if (!result.rows.length) return res.status(404).json({ error: "Cancha no encontrada" });
      return res.json({ cancha: result.rows[0] });
    } catch (error) {
      console.error("Error actualizarCancha:", error);
      return res.status(500).json({ error: "Error actualizando cancha." });
    }
  },

  async eliminarCancha(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query(`DELETE FROM canchas WHERE id=$1 RETURNING *`, [id]);
      if (!result.rows.length) return res.status(404).json({ error: "Cancha no encontrada" });
      return res.json({ cancha: result.rows[0] });
    } catch (error) {
      console.error("Error eliminarCancha:", error);
      return res.status(500).json({ error: "Error eliminando cancha." });
    }
  },
};

module.exports = CanchaController;