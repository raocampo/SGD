// controllers/grupoController.js
const Grupo = require("../models/Grupo");

function statusForGrupo(error) {
  const msg = String(error?.message || "").toLowerCase();
  if (
    msg.includes("no se puede reiniciar el sorteo") ||
    msg.includes("ya tiene partidos programados") ||
    msg.includes("ya tiene eliminatorias generadas") ||
    msg.includes("requerido") ||
    msg.includes("inválido") ||
    msg.includes("invalido") ||
    msg.includes("no encontrado")
  ) {
    return 400;
  }
  return 500;
}

exports.crearGruposPorEvento = async (req, res) => {
  try {
    const { evento_id, cantidad_grupos, nombres_grupos } = req.body;

    if (!evento_id || !cantidad_grupos) {
      return res.status(400).json({ error: "evento_id y cantidad_grupos son requeridos." });
    }

    const grupos = await Grupo.crearGruposPorEvento(
      parseInt(evento_id),
      parseInt(cantidad_grupos),
      Array.isArray(nombres_grupos) ? nombres_grupos : null
    );

    res.json({ ok: true, grupos });
  } catch (err) {
    console.error("crearGruposPorEvento:", err);
    res.status(statusForGrupo(err)).json({ error: err.message });
  }
};

exports.obtenerGruposPorEvento = async (req, res) => {
  try {
    const { evento_id } = req.params;
    const grupos = await Grupo.obtenerPorEvento(parseInt(evento_id));
    res.json({ ok: true, grupos });
  } catch (err) {
    console.error("obtenerGruposPorEvento:", err);
    res.status(statusForGrupo(err)).json({ error: err.message });
  }
};

exports.obtenerGruposPorEventoCompleto = async (req, res) => {
  try {
    const { evento_id } = req.params;
    const grupos = await Grupo.obtenerConEquiposPorEvento(parseInt(evento_id));
    res.json({ ok: true, grupos });
  } catch (err) {
    console.error("obtenerGruposPorEventoCompleto:", err);
    res.status(statusForGrupo(err)).json({ error: err.message });
  }
};

exports.obtenerGruposPorCampeonato = async (req, res) => {
  try {
    const { campeonato_id } = req.params;
    const grupos = await Grupo.obtenerPorCampeonato(parseInt(campeonato_id, 10));
    res.json({ ok: true, grupos });
  } catch (err) {
    console.error("obtenerGruposPorCampeonato:", err);
    res.status(statusForGrupo(err)).json({ error: err.message });
  }
};

exports.obtenerGruposPorCampeonatoCompleto = async (req, res) => {
  try {
    const { campeonato_id } = req.params;
    const grupos = await Grupo.obtenerConEquiposPorCampeonato(parseInt(campeonato_id, 10));
    res.json({ ok: true, grupos });
  } catch (err) {
    console.error("obtenerGruposPorCampeonatoCompleto:", err);
    res.status(statusForGrupo(err)).json({ error: err.message });
  }
};

exports.obtenerGrupo = async (req, res) => {
  try {
    const g = await Grupo.obtenerPorId(parseInt(req.params.id));
    if (!g) return res.status(404).json({ error: "Grupo no encontrado" });
    res.json({ ok: true, grupo: g });
  } catch (err) {
    console.error("obtenerGrupo:", err);
    res.status(statusForGrupo(err)).json({ error: err.message });
  }
};

exports.obtenerEquiposDelGrupo = async (req, res) => {
  try {
    const equipos = await Grupo.obtenerEquiposDelGrupo(parseInt(req.params.grupo_id));
    res.json({ ok: true, equipos });
  } catch (err) {
    console.error("obtenerEquiposDelGrupo:", err);
    res.status(statusForGrupo(err)).json({ error: err.message });
  }
};

exports.asignarEquipo = async (req, res) => {
  try {
    const { grupo_id } = req.params;
    const { equipo_id, orden_sorteo } = req.body;

    if (!equipo_id) return res.status(400).json({ error: "equipo_id es requerido" });

    const asignacion = await Grupo.asignarEquipo(
      parseInt(grupo_id),
      parseInt(equipo_id),
      orden_sorteo ?? null
    );

    res.json({ ok: true, asignacion });
  } catch (err) {
    console.error("asignarEquipo:", err);
    res.status(statusForGrupo(err)).json({ error: err.message });
  }
};

exports.removerEquipo = async (req, res) => {
  try {
    const { grupo_id, equipo_id } = req.params;
    const r = await Grupo.removerEquipo(parseInt(grupo_id), parseInt(equipo_id));
    res.json({ ok: true, removed: r });
  } catch (err) {
    console.error("removerEquipo:", err);
    res.status(statusForGrupo(err)).json({ error: err.message });
  }
};

exports.actualizarGrupo = async (req, res) => {
  try {
    const g = await Grupo.actualizar(parseInt(req.params.id), req.body);
    res.json({ ok: true, grupo: g });
  } catch (err) {
    console.error("actualizarGrupo:", err);
    res.status(statusForGrupo(err)).json({ error: err.message });
  }
};

exports.eliminarGrupo = async (req, res) => {
  try {
    const g = await Grupo.eliminar(parseInt(req.params.id));
    res.json({ ok: true, eliminado: g });
  } catch (err) {
    console.error("eliminarGrupo:", err);
    res.status(statusForGrupo(err)).json({ error: err.message });
  }
};
