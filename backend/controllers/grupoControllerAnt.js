const Grupo = require("../models/Grupo");
const pool = require("../config/database");

function letrasGrupo(i) {
  // 0->A, 1->B, ...
  return String.fromCharCode("A".charCodeAt(0) + i);
}

async function getCampeonatoIdFromEvento(evento_id) {
  const r = await pool.query(
    `SELECT campeonato_id FROM eventos WHERE id = $1`,
    [evento_id]
  );
  if (!r.rows.length) return null;
  return r.rows[0].campeonato_id;
}

const grupoController = {
  // ============================================================
  // ✅ NUEVO: CREAR GRUPOS POR EVENTO
  // body: { evento_id, cantidad_grupos, nombres_grupos? }
  // ============================================================
  crearGruposPorEvento: async (req, res) => {
    try {
      const { evento_id, cantidad_grupos, nombres_grupos } = req.body;

      if (!evento_id || !cantidad_grupos) {
        return res.status(400).json({
          error: "evento_id y cantidad_grupos son obligatorios",
        });
      }

      if (cantidad_grupos < 2 || cantidad_grupos > 8) {
        return res.status(400).json({
          error: "La cantidad de grupos debe estar entre 2 y 8",
        });
      }

      const campeonato_id = await getCampeonatoIdFromEvento(evento_id);
      if (!campeonato_id) {
        return res.status(404).json({ error: "Evento no encontrado" });
      }

      // Opcional: si ya existen grupos del evento, evitar duplicar
      const yaExisten = await pool.query(
        `SELECT COUNT(*)::int AS c FROM grupos WHERE evento_id = $1`,
        [evento_id]
      );
      if ((yaExisten.rows[0]?.c || 0) > 0) {
        return res.status(400).json({
          error:
            "Este evento ya tiene grupos creados. Elimina los grupos existentes si deseas recrearlos.",
        });
      }

      const gruposCreados = [];

      for (let i = 0; i < cantidad_grupos; i++) {
        const letra = letrasGrupo(i);

        let nombreGrupo = `Grupo ${letra}`;
        if (Array.isArray(nombres_grupos) && nombres_grupos[i]) {
          nombreGrupo = String(nombres_grupos[i]).trim();
        }

        const insert = await pool.query(
          `
          INSERT INTO grupos (campeonato_id, evento_id, nombre_grupo, letra_grupo)
          VALUES ($1, $2, $3, $4)
          RETURNING *
          `,
          [campeonato_id, evento_id, nombreGrupo, letra]
        );

        gruposCreados.push(insert.rows[0]);
      }

      return res.status(201).json({
        mensaje: `🎯 ${cantidad_grupos} grupos creados exitosamente para el evento`,
        grupos: gruposCreados,
      });
    } catch (error) {
      console.error("Error creando grupos por evento:", error);
      return res.status(500).json({
        error: "Error creando grupos por evento",
        detalle: error.message,
      });
    }
  },

  // ============================================================
  // ✅ NUEVO: OBTENER GRUPOS POR EVENTO
  // ============================================================
  obtenerGruposPorEvento: async (req, res) => {
    try {
      const { evento_id } = req.params;

      const gruposRes = await pool.query(
        `
        SELECT *
        FROM grupos
        WHERE evento_id = $1
        ORDER BY letra_grupo
        `,
        [evento_id]
      );

      return res.json({
        mensaje: "📊 Grupos del evento",
        total: gruposRes.rows.length,
        grupos: gruposRes.rows,
      });
    } catch (error) {
      console.error("Error obteniendo grupos por evento:", error);
      return res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // ============================================================
  // ✅ NUEVO: OBTENER GRUPOS + EQUIPOS POR EVENTO
  // (usa grupo_equipos para traer equipos)
  // ============================================================
  obtenerGruposConEquiposPorEvento: async (req, res) => {
    try {
      const { evento_id } = req.params;

      // 1) Traer grupos del evento
      const gruposRes = await pool.query(
        `
        SELECT *
        FROM grupos
        WHERE evento_id = $1
        ORDER BY letra_grupo
        `,
        [evento_id]
      );

      const grupos = gruposRes.rows;

      // 2) Por cada grupo, traer equipos del grupo (JOIN con equipos)
      for (const g of grupos) {
        const eqRes = await pool.query(
          `
          SELECT 
            e.*,
            ge.orden_sorteo,
            ge.fecha_sorteo
          FROM grupo_equipos ge
          JOIN equipos e ON e.id = ge.equipo_id
          WHERE ge.grupo_id = $1
          ORDER BY ge.orden_sorteo NULLS LAST, e.nombre
          `,
          [g.id]
        );

        g.equipos = eqRes.rows;
      }

      return res.json({
        mensaje: "🏆 Grupos con equipos del evento",
        total: grupos.length,
        grupos,
      });
    } catch (error) {
      console.error("Error obteniendo grupos con equipos por evento:", error);
      return res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // ============================================================
  // 🔄 LO QUE YA TENÍAS (CAMPEONATO) - SIN ROMPER
  // ============================================================

  // CREAR - Nuevos grupos para campeonato
  crearGrupos: async (req, res) => {
    try {
      const { campeonato_id, cantidad_grupos, nombres_grupos } = req.body;

      if (!campeonato_id || !cantidad_grupos) {
        return res.status(400).json({
          error: "campeonato_id y cantidad_grupos son obligatorios",
        });
      }

      if (cantidad_grupos < 2 || cantidad_grupos > 8) {
        return res.status(400).json({
          error: "La cantidad de grupos debe estar entre 2 y 8",
        });
      }

      const gruposCreados = await Grupo.crearGrupos(
        campeonato_id,
        cantidad_grupos,
        nombres_grupos
      );

      res.status(201).json({
        mensaje: `🎯 ${cantidad_grupos} grupos creados exitosamente`,
        grupos: gruposCreados,
      });
    } catch (error) {
      console.error("Error creando grupos:", error);

      if (error.message.includes("Campeonato no encontrado")) {
        return res.status(404).json({
          error: error.message,
        });
      }

      res.status(500).json({
        error: "Error creando grupos",
        detalle: error.message,
      });
    }
  },

  // LEER - Obtener grupos por campeonato
  obtenerGruposPorCampeonato: async (req, res) => {
    try {
      const { campeonato_id } = req.params;

      const grupos = await Grupo.obtenerPorCampeonato(campeonato_id);

      res.json({
        mensaje: `📊 Grupos del campeonato`,
        total: grupos.length,
        grupos: grupos,
      });
    } catch (error) {
      console.error("Error obteniendo grupos:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // LEER - Obtener grupo específico con detalles
  obtenerGrupo: async (req, res) => {
    try {
      const { id } = req.params;
      const grupo = await Grupo.obtenerPorId(id);

      if (!grupo) {
        return res.status(404).json({
          error: "Grupo no encontrado",
        });
      }

      const equipos = await Grupo.obtenerEquiposDelGrupo(id);

      res.json({
        mensaje: "📖 Detalles del grupo",
        grupo: grupo,
        equipos: equipos,
      });
    } catch (error) {
      console.error("Error obteniendo grupo:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // LEER - Obtener grupos con equipos completos
  obtenerGruposConEquipos: async (req, res) => {
    try {
      const { campeonato_id } = req.params;

      const grupos = await Grupo.obtenerConEquipos(campeonato_id);

      res.json({
        mensaje: `🏆 Grupos con equipos del campeonato`,
        total: grupos.length,
        grupos: grupos,
      });
    } catch (error) {
      console.error("Error obteniendo grupos con equipos:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // ACTUALIZAR - Modificar grupo
  actualizarGrupo: async (req, res) => {
    try {
      const { id } = req.params;
      const datos = req.body;

      const grupoActualizado = await Grupo.actualizar(id, datos);

      if (!grupoActualizado) {
        return res.status(404).json({
          error: "Grupo no encontrado",
        });
      }

      res.json({
        mensaje: "✅ Grupo actualizado exitosamente",
        grupo: grupoActualizado,
      });
    } catch (error) {
      console.error("Error actualizando grupo:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // ELIMINAR - Borrar grupo
  eliminarGrupo: async (req, res) => {
    try {
      const { id } = req.params;
      const grupoEliminado = await Grupo.eliminar(id);

      if (!grupoEliminado) {
        return res.status(404).json({
          error: "Grupo no encontrado",
        });
      }

      res.json({
        mensaje: "🗑️ Grupo eliminado exitosamente",
        grupo: grupoEliminado,
      });
    } catch (error) {
      console.error("Error eliminando grupo:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // ASIGNAR - Asignar equipo a grupo
  asignarEquipoAGrupo: async (req, res) => {
    try {
      const { grupo_id, equipo_id, orden_sorteo } = req.body;

      if (!grupo_id || !equipo_id) {
        return res.status(400).json({
          error: "grupo_id y equipo_id son obligatorios",
        });
      }

      const asignacion = await Grupo.asignarEquipo(
        grupo_id,
        equipo_id,
        orden_sorteo
      );

      res.status(201).json({
        mensaje: "⚽ Equipo asignado al grupo exitosamente",
        asignacion: asignacion,
      });
    } catch (error) {
      console.error("Error asignando equipo a grupo:", error);

      if (error.message.includes("ya está asignado")) {
        return res.status(400).json({
          error: error.message,
        });
      }

      res.status(500).json({
        error: "Error asignando equipo a grupo",
        detalle: error.message,
      });
    }
  },

  // REMOVER - Remover equipo de grupo
  removerEquipoDeGrupo: async (req, res) => {
    try {
      const { grupo_id, equipo_id } = req.body;

      if (!grupo_id || !equipo_id) {
        return res.status(400).json({
          error: "grupo_id y equipo_id son obligatorios",
        });
      }

      const eliminacion = await Grupo.removerEquipo(grupo_id, equipo_id);

      if (!eliminacion) {
        return res.status(404).json({
          error: "Asignación no encontrada",
        });
      }

      res.json({
        mensaje: "🔁 Equipo removido del grupo exitosamente",
        eliminacion: eliminacion,
      });
    } catch (error) {
      console.error("Error removiendo equipo de grupo:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },
};

module.exports = grupoController;
