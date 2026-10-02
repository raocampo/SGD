// controllers/grupoController.js
const Grupo = require("../models/Grupo");
const pool = require("../config/database");
const { esTecnicoOdirigente, tecnicoPuedeAccederCampeonato } = require("../services/roleScope");

// Tecnico/dirigente/jugador: solo grupos/equipos de campeonatos donde
// tienen algun equipo asociado (organizador/admin/operador_sistema sin
// restriccion adicional aqui). Estos GET nunca tuvieron requireAuth hasta
// ahora -- quedaban alcanzables por cualquiera con solo el id.
async function validarAccesoEventoLecturaGrupos(req, res, eventoId) {
  if (!esTecnicoOdirigente(req?.user?.rol)) return true;
  const r = await pool.query(`SELECT campeonato_id FROM eventos WHERE id = $1 LIMIT 1`, [eventoId]);
  const campeonatoId = r.rows[0]?.campeonato_id;
  if (!campeonatoId) {
    res.status(404).json({ error: "Categoría no encontrada" });
    return false;
  }
  const puede = await tecnicoPuedeAccederCampeonato(req, campeonatoId);
  if (!puede) {
    res.status(403).json({ error: "No autorizado para esta categoría" });
    return false;
  }
  return true;
}

async function validarAccesoCampeonatoLecturaGrupos(req, res, campeonatoId) {
  if (!esTecnicoOdirigente(req?.user?.rol)) return true;
  const puede = await tecnicoPuedeAccederCampeonato(req, campeonatoId);
  if (!puede) {
    res.status(403).json({ error: "No autorizado para este campeonato" });
    return false;
  }
  return true;
}

async function validarAccesoGrupoLecturaGrupos(req, res, grupoId) {
  if (!esTecnicoOdirigente(req?.user?.rol)) return true;
  const r = await pool.query(
    `SELECT e.campeonato_id FROM grupos g JOIN eventos e ON e.id = g.evento_id WHERE g.id = $1 LIMIT 1`,
    [grupoId]
  );
  const campeonatoId = r.rows[0]?.campeonato_id;
  if (!campeonatoId) {
    res.status(404).json({ error: "Grupo no encontrado" });
    return false;
  }
  const puede = await tecnicoPuedeAccederCampeonato(req, campeonatoId);
  if (!puede) {
    res.status(403).json({ error: "No autorizado para este grupo" });
    return false;
  }
  return true;
}

function statusForGrupo(error) {
  const msg = String(error?.message || "").toLowerCase();
  if (
    msg.includes("no se puede reiniciar el sorteo") ||
    msg.includes("no se pueden editar los grupos") ||
    msg.includes("ya tiene partidos programados") ||
    msg.includes("ya tiene eliminatorias generadas") ||
    msg.includes("requerido") ||
    msg.includes("inválido") ||
    msg.includes("invalido") ||
    msg.includes("no encontrado") ||
    msg.includes("ya está asignado") ||
    msg.includes("ya esta asignado") ||
    msg.includes("ya está en") ||
    msg.includes("ya esta en") ||
    msg.includes("no pertenece a la categoria") ||
    msg.includes("no pertenece a la categoría") ||
    msg.includes("máximo") ||
    msg.includes("maximo") ||
    msg.includes("método 'liga'") ||
    msg.includes("metodo 'liga'")
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

exports.agregarGrupoAEvento = async (req, res) => {
  try {
    const { evento_id } = req.params;
    const { nombre_grupo } = req.body || {};
    const grupo = await Grupo.agregarGrupoAEvento(
      parseInt(evento_id, 10),
      nombre_grupo || null
    );
    res.json({ ok: true, grupo });
  } catch (err) {
    console.error("agregarGrupoAEvento:", err);
    res.status(statusForGrupo(err)).json({ error: err.message });
  }
};

exports.obtenerGruposPorEvento = async (req, res) => {
  try {
    const { evento_id } = req.params;
    const eventoId = parseInt(evento_id, 10);
    if (!(await validarAccesoEventoLecturaGrupos(req, res, eventoId))) return;
    await Grupo.asegurarGrupoLigaPorEvento(eventoId);
    const grupos = await Grupo.obtenerPorEvento(eventoId);
    res.json({ ok: true, grupos });
  } catch (err) {
    console.error("obtenerGruposPorEvento:", err);
    res.status(statusForGrupo(err)).json({ error: err.message });
  }
};

exports.obtenerGruposPorEventoCompleto = async (req, res) => {
  try {
    const { evento_id } = req.params;
    const eventoId = parseInt(evento_id, 10);
    if (!(await validarAccesoEventoLecturaGrupos(req, res, eventoId))) return;
    await Grupo.asegurarGrupoLigaPorEvento(eventoId);
    const grupos = await Grupo.obtenerConEquiposPorEvento(eventoId);
    res.json({ ok: true, grupos });
  } catch (err) {
    console.error("obtenerGruposPorEventoCompleto:", err);
    res.status(statusForGrupo(err)).json({ error: err.message });
  }
};

exports.obtenerGruposPorCampeonato = async (req, res) => {
  try {
    const { campeonato_id } = req.params;
    const campeonatoId = parseInt(campeonato_id, 10);
    if (!(await validarAccesoCampeonatoLecturaGrupos(req, res, campeonatoId))) return;
    const grupos = await Grupo.obtenerPorCampeonato(campeonatoId);
    res.json({ ok: true, grupos });
  } catch (err) {
    console.error("obtenerGruposPorCampeonato:", err);
    res.status(statusForGrupo(err)).json({ error: err.message });
  }
};

exports.obtenerGruposPorCampeonatoCompleto = async (req, res) => {
  try {
    const { campeonato_id } = req.params;
    const campeonatoId = parseInt(campeonato_id, 10);
    if (!(await validarAccesoCampeonatoLecturaGrupos(req, res, campeonatoId))) return;
    const grupos = await Grupo.obtenerConEquiposPorCampeonato(campeonatoId);
    res.json({ ok: true, grupos });
  } catch (err) {
    console.error("obtenerGruposPorCampeonatoCompleto:", err);
    res.status(statusForGrupo(err)).json({ error: err.message });
  }
};

exports.obtenerGrupo = async (req, res) => {
  try {
    const grupoId = parseInt(req.params.id, 10);
    if (!(await validarAccesoGrupoLecturaGrupos(req, res, grupoId))) return;
    const g = await Grupo.obtenerPorId(grupoId);
    if (!g) return res.status(404).json({ error: "Grupo no encontrado" });
    res.json({ ok: true, grupo: g });
  } catch (err) {
    console.error("obtenerGrupo:", err);
    res.status(statusForGrupo(err)).json({ error: err.message });
  }
};

exports.obtenerEquiposDelGrupo = async (req, res) => {
  try {
    const grupoId = parseInt(req.params.grupo_id, 10);
    if (!(await validarAccesoGrupoLecturaGrupos(req, res, grupoId))) return;
    const equipos = await Grupo.obtenerEquiposDelGrupo(grupoId);
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

exports.moverEquipoAGrupo = async (req, res) => {
  try {
    const { grupo_id } = req.params;
    const { equipo_id, orden_sorteo } = req.body || {};

    if (!equipo_id) return res.status(400).json({ error: "equipo_id es requerido" });

    const resultado = await Grupo.moverEquipoAGrupo(
      parseInt(grupo_id, 10),
      parseInt(equipo_id, 10),
      orden_sorteo ?? null
    );

    res.json({ ok: true, ...resultado });
  } catch (err) {
    console.error("moverEquipoAGrupo:", err);
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
