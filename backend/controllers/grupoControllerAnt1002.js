// controllers/grupoController.js
const Grupo = require("../models/Grupo");

// ===============================
// ✅ EVENTO (nuevo)
// ===============================

exports.obtenerGruposPorEvento = async (req, res) => {
  try {
    const { evento_id } = req.params;
    const grupos = await Grupo.obtenerPorEvento(Number(evento_id));
    return res.json({ grupos });
  } catch (error) {
    console.error("Error obtenerGruposPorEvento:", error);
    return res.status(500).json({ error: "Error al obtener grupos por evento" });
  }
};

exports.obtenerGruposPorEventoConEquipos = async (req, res) => {
  try {
    const { evento_id } = req.params;
    const data = await Grupo.obtenerPorEventoConEquipos(Number(evento_id));
    return res.json({ grupos: data });
  } catch (error) {
    console.error("Error obtenerGruposPorEventoConEquipos:", error);
    return res.status(500).json({ error: "Error al obtener grupos con equipos" });
  }
};

// Genera grupos: A, B, C... y los guarda con evento_id
exports.generarGruposParaEvento = async (req, res) => {
  try {
    const { evento_id } = req.params;
    const { cantidad_grupos = 4 } = req.body;

    const grupos = await Grupo.generarParaEvento({
      evento_id: Number(evento_id),
      cantidad_grupos: Number(cantidad_grupos),
    });

    return res.json({
      ok: true,
      mensaje: "Grupos generados correctamente para el evento",
      grupos,
    });
  } catch (error) {
    console.error("Error generarGruposParaEvento:", error);
    return res.status(500).json({ error: error.message || "Error al generar grupos" });
  }
};

// ===============================
// ⚠️ CAMPEONATO (compatibilidad)
// ===============================

exports.obtenerGruposPorCampeonato = async (req, res) => {
  try {
    const { campeonato_id } = req.params;
    const grupos = await Grupo.obtenerPorCampeonato(Number(campeonato_id));
    return res.json({ grupos });
  } catch (error) {
    console.error("Error obtenerGruposPorCampeonato:", error);
    return res.status(500).json({ error: "Error al obtener grupos por campeonato" });
  }
};

exports.generarGrupos = async (req, res) => {
  try {
    // (mantengo tu endpoint viejo si aún existe en frontend)
    const { campeonato_id, cantidad_grupos = 4 } = req.body;
    const grupos = await Grupo.generarPorCampeonato({
      campeonato_id: Number(campeonato_id),
      cantidad_grupos: Number(cantidad_grupos),
    });
    return res.json({ ok: true, grupos });
  } catch (error) {
    console.error("Error generarGrupos:", error);
    return res.status(500).json({ error: error.message || "Error al generar grupos" });
  }
};

// ===============================
// CRUD básico (si lo usas)
// ===============================

exports.crearGrupo = async (req, res) => {
  try {
    const grupo = await Grupo.crear(req.body);
    return res.json({ ok: true, grupo });
  } catch (error) {
    console.error("Error crearGrupo:", error);
    return res.status(500).json({ error: error.message || "Error al crear grupo" });
  }
};

exports.actualizarGrupo = async (req, res) => {
  try {
    const { id } = req.params;
    const grupo = await Grupo.actualizar(Number(id), req.body);
    return res.json({ ok: true, grupo });
  } catch (error) {
    console.error("Error actualizarGrupo:", error);
    return res.status(500).json({ error: error.message || "Error al actualizar grupo" });
  }
};

exports.eliminarGrupo = async (req, res) => {
  try {
    const { id } = req.params;
    const eliminado = await Grupo.eliminar(Number(id));
    return res.json({ ok: true, eliminado });
  } catch (error) {
    console.error("Error eliminarGrupo:", error);
    return res.status(500).json({ error: error.message || "Error al eliminar grupo" });
  }
};

exports.obtenerGrupoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const grupo = await Grupo.obtenerPorId(Number(id));
    return res.json({ grupo });
  } catch (error) {
    console.error("Error obtenerGrupoPorId:", error);
    return res.status(500).json({ error: error.message || "Error al obtener grupo" });
  }
};
