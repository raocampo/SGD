const PartidoTransmision = require("../models/PartidoTransmision");

async function obtenerTransmision(req, res) {
  try {
    const partidoId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(partidoId) || partidoId <= 0) {
      return res.status(400).json({ error: "ID de partido inválido." });
    }
    const transmision = await PartidoTransmision.obtenerPorPartido(partidoId);
    return res.json({ transmision: transmision || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function crearTransmision(req, res) {
  try {
    const partidoId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(partidoId) || partidoId <= 0) {
      return res.status(400).json({ error: "ID de partido inválido." });
    }

    const existente = await PartidoTransmision.obtenerPorPartido(partidoId);
    if (existente) {
      return res.status(409).json({ error: "Ya existe una transmisión para este partido.", transmision: existente });
    }

    const {
      titulo,
      descripcion,
      plataforma,
      url_publica,
      embed_url,
      fecha_inicio_programada,
      thumbnail_url,
      campeonato_id,
      evento_id,
    } = req.body;

    const transmision = await PartidoTransmision.crear({
      partido_id: partidoId,
      campeonato_id: campeonato_id || null,
      evento_id: evento_id || null,
      titulo: titulo || null,
      descripcion: descripcion || null,
      plataforma: plataforma || null,
      url_publica: url_publica || null,
      embed_url: embed_url || null,
      estado: req.body.estado || 'programada',
      fecha_inicio_programada: fecha_inicio_programada || null,
      thumbnail_url: thumbnail_url || null,
      creado_por: req.user?.id || null,
    });

    return res.status(201).json({ transmision });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function actualizarTransmision(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "ID de transmisión inválido." });
    }

    const {
      titulo,
      descripcion,
      plataforma,
      url_publica,
      embed_url,
      fecha_inicio_programada,
      thumbnail_url,
      campeonato_id,
      evento_id,
    } = req.body;

    const transmision = await PartidoTransmision.actualizar(id, {
      titulo,
      descripcion,
      plataforma,
      url_publica,
      embed_url,
      fecha_inicio_programada: fecha_inicio_programada || null,
      thumbnail_url,
      campeonato_id: campeonato_id || null,
      evento_id: evento_id || null,
    });

    if (!transmision) {
      return res.status(404).json({ error: "Transmisión no encontrada." });
    }
    return res.json({ transmision });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function iniciarTransmision(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "ID de transmisión inválido." });
    }
    const transmision = await PartidoTransmision.iniciar(id);
    if (!transmision) {
      return res.status(404).json({ error: "Transmisión no encontrada." });
    }
    return res.json({ transmision });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function finalizarTransmision(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "ID de transmisión inválido." });
    }
    const transmision = await PartidoTransmision.finalizar(id);
    if (!transmision) {
      return res.status(404).json({ error: "Transmisión no encontrada." });
    }
    return res.json({ transmision });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function cancelarTransmision(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "ID de transmisión inválido." });
    }
    const transmision = await PartidoTransmision.cancelar(id);
    if (!transmision) {
      return res.status(404).json({ error: "Transmisión no encontrada." });
    }
    return res.json({ transmision });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function obtenerTransmisionPublica(req, res) {
  try {
    const partidoId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(partidoId) || partidoId <= 0) {
      return res.json({ transmision: null });
    }
    const transmision = await PartidoTransmision.obtenerPorPartido(partidoId);
    return res.json({ transmision: transmision || null });
  } catch (_err) {
    return res.json({ transmision: null });
  }
}

async function listarTransmisionesActivasPorCampeonato(req, res) {
  try {
    const campeonatoId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
      return res.json({ transmisiones: [] });
    }
    const transmisiones = await PartidoTransmision.listarActivasPorCampeonato(campeonatoId);
    return res.json({ transmisiones });
  } catch (_err) {
    return res.json({ transmisiones: [] });
  }
}

async function listarTransmisionesPorCampeonato(req, res) {
  try {
    const campeonatoId = Number.parseInt(req.query.campeonato_id, 10);
    if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
      return res.status(400).json({ error: "campeonato_id inválido." });
    }
    const transmisiones = await PartidoTransmision.listarPorCampeonato(campeonatoId);
    return res.json({ transmisiones });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function toggleDestacado(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: "ID de transmisión inválido." });
    }
    const transmision = await PartidoTransmision.toggleDestacado(id);
    if (!transmision) {
      return res.status(404).json({ error: "Transmisión no encontrada." });
    }
    return res.json({ transmision });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function listarDestacadasPublicas(req, res) {
  try {
    const transmisiones = await PartidoTransmision.listarDestacadas();
    return res.json({ transmisiones });
  } catch (_err) {
    return res.json({ transmisiones: [] });
  }
}

module.exports = {
  obtenerTransmision,
  crearTransmision,
  actualizarTransmision,
  iniciarTransmision,
  finalizarTransmision,
  cancelarTransmision,
  obtenerTransmisionPublica,
  listarTransmisionesActivasPorCampeonato,
  listarTransmisionesPorCampeonato,
  toggleDestacado,
  listarDestacadasPublicas,
};
