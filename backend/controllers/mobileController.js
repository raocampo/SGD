const Campeonato = require("../models/Campeonato");
const {
  mapTournamentStatusToApi,
} = require("../services/mobileAccessService");
const {
  getMobileSession,
  listarCampeonatos,
  listarEquiposEvento,
  listarEventosCampeonato,
  listarJugadores,
  obtenerCampeonatoDetalle,
  obtenerDashboard,
  obtenerEquipoDetalle,
  obtenerEventoDetalle,
} = require("../services/mobileReadService");
const {
  generarFixtureEvento,
  crearMovimientoFinanciero,
  marcarMovimientoPagado,
  obtenerEstadoCuentaEquipo,
  obtenerCompetenciaEvento,
  obtenerFairPlayEvento,
  obtenerFinanzasCampeonato,
  registrarResultadoResumen,
} = require("../services/mobileCompetitionService");
const {
  asignarEquipoAGrupo,
  crearGruposEvento,
  generarSorteoAutomatico,
  obtenerSorteoEvento,
  removerEquipoDeGrupo,
  reiniciarSorteoEvento,
} = require("../services/mobileDrawService");
const {
  actualizarResultadoEliminatoria,
  generarEliminatoriasEvento,
  obtenerEliminatoriasEvento,
} = require("../services/mobileKnockoutService");
const {
  crearEventoMovil,
  crearEquipoMovil,
  crearJugadorMovil,
  actualizarEstadoPase,
  eliminarJugadorMovil,
  guardarPlanillaPartido,
  listarEquiposVisibles,
  listarEventosVisibles,
  listarPartidosEvento,
  listarPasesVisibles,
  listarUsuariosVisibles,
  obtenerPlanillaPartido,
} = require("../services/mobileOperationsService");

function parseCreateCampeonatoBody(body = {}, user = null) {
  return {
    nombre: String(body.name || "").trim(),
    organizador:
      String(body.organizer || "").trim() ||
      user?.organizacion_nombre ||
      user?.nombre ||
      user?.email ||
      null,
    fecha_inicio: body.startDate ? String(body.startDate).slice(0, 10) : null,
    fecha_fin: body.endDate ? String(body.endDate).slice(0, 10) : null,
    tipo_futbol: String(body.footballType || "futbol_11").trim(),
    sistema_puntuacion: String(body.scoringSystem || "tradicional").trim(),
    max_equipos: body.maxTeams ?? null,
    min_jugador: body.minPlayers ?? null,
    max_jugador: body.maxPlayers ?? null,
    color_primario: body.primaryColor || null,
    color_secundario: body.secondaryColor || null,
    color_acento: body.accentColor || null,
    requiere_cedula_jugador: body.requireNationalId !== false,
    requiere_foto_cedula: body.requireNationalIdPhoto === true,
    requiere_foto_carnet: body.requirePlayerCardPhoto === true,
    genera_carnets: body.generatePlayerCards === true,
    costo_arbitraje: body.refereeFeePerTeam ?? 0,
    costo_tarjeta_amarilla: body.yellowCardFee ?? 0,
    costo_tarjeta_roja: body.redCardFee ?? 0,
    costo_carnet: body.playerCardFee ?? 0,
    bloquear_morosos: body.blockDebtors === true,
    bloqueo_morosidad_monto: body.debtBlockAmount ?? 0,
  };
}

function statusFor(error, fallback = 500) {
  const msg = String(error?.message || "");
  const normalized = msg.toLowerCase();
  if (normalized.includes("no autorizado")) return 403;
  if (normalized.includes("no encontrado")) return 404;
  if (
    normalized.includes("invalido") ||
    normalized.includes("inválido") ||
    normalized.includes("obligatorio") ||
    normalized.includes("limite") ||
    normalized.includes("límite") ||
    normalized.includes("exige") ||
    normalized.includes("ya existe") ||
    normalized.includes("ya está") ||
    normalized.includes("no pertenece")
  ) {
    return 400;
  }
  return fallback;
}

const mobileController = {
  async session(req, res) {
    return res.json(getMobileSession(req.user));
  },

  async dashboard(req, res) {
    try {
      const data = await obtenerDashboard(req.user);
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile dashboard:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo cargar dashboard" });
    }
  },

  async listCampeonatos(req, res) {
    try {
      const campeonatos = await listarCampeonatos(req.user);
      return res.json({ ok: true, campeonatos });
    } catch (error) {
      console.error("Error mobile listCampeonatos:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo cargar campeonatos" });
    }
  },

  async listEventos(req, res) {
    try {
      const eventos = await listarEventosVisibles(req.user);
      return res.json({ ok: true, eventos });
    } catch (error) {
      console.error("Error mobile listEventos:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudieron cargar eventos" });
    }
  },

  async postEvento(req, res) {
    try {
      const evento = await crearEventoMovil(req.user, req.body || {});
      return res.status(201).json({ ok: true, evento });
    } catch (error) {
      console.error("Error mobile postEvento:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo crear categoría" });
    }
  },

  async getCampeonato(req, res) {
    try {
      const campeonato = await obtenerCampeonatoDetalle(req.user, req.params.id);
      return res.json({ ok: true, campeonato });
    } catch (error) {
      console.error("Error mobile getCampeonato:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo cargar campeonato" });
    }
  },

  async createCampeonato(req, res) {
    try {
      const payload = parseCreateCampeonatoBody(req.body, req.user);
      if (!payload.nombre || !payload.fecha_inicio || !payload.fecha_fin) {
        return res.status(400).json({ error: "name, startDate y endDate son obligatorios" });
      }

      const campeonato = await Campeonato.crear(
        payload.nombre,
        payload.organizador,
        payload.fecha_inicio,
        payload.fecha_fin,
        payload.tipo_futbol,
        payload.sistema_puntuacion,
        payload.max_equipos,
        payload.min_jugador,
        payload.max_jugador,
        payload.color_primario,
        payload.color_secundario,
        payload.color_acento,
        null,
        payload.requiere_cedula_jugador,
        payload.requiere_foto_cedula,
        payload.requiere_foto_carnet,
        payload.genera_carnets,
        req.user?.id || null,
        payload.costo_arbitraje,
        payload.costo_tarjeta_amarilla,
        payload.costo_tarjeta_roja,
        payload.costo_carnet
      );

      if (req.body?.status && mapTournamentStatusToApi(req.body.status) !== "borrador") {
        await Campeonato.cambiarEstado(campeonato.id, mapTournamentStatusToApi(req.body.status));
      }

      const detalle = await obtenerCampeonatoDetalle(req.user, campeonato.id);
      return res.status(201).json({ ok: true, campeonato: detalle });
    } catch (error) {
      console.error("Error mobile createCampeonato:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo crear campeonato" });
    }
  },

  async listEventosCampeonato(req, res) {
    try {
      const eventos = await listarEventosCampeonato(req.user, req.params.id);
      return res.json({ ok: true, eventos });
    } catch (error) {
      console.error("Error mobile listEventosCampeonato:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo cargar categorías" });
    }
  },

  async getEvento(req, res) {
    try {
      const evento = await obtenerEventoDetalle(req.user, req.params.id);
      return res.json({ ok: true, evento });
    } catch (error) {
      console.error("Error mobile getEvento:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo cargar categoría" });
    }
  },

  async listEquiposEvento(req, res) {
    try {
      const equipos = await listarEquiposEvento(req.user, req.params.id);
      return res.json({ ok: true, equipos });
    } catch (error) {
      console.error("Error mobile listEquiposEvento:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo cargar equipos" });
    }
  },

  async listEquipos(req, res) {
    try {
      const equipos = await listarEquiposVisibles(req.user);
      return res.json({ ok: true, equipos });
    } catch (error) {
      console.error("Error mobile listEquipos:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudieron cargar equipos" });
    }
  },

  async postEquipo(req, res) {
    try {
      const equipo = await crearEquipoMovil(req.user, req.body || {});
      return res.status(201).json({ ok: true, equipo });
    } catch (error) {
      console.error("Error mobile postEquipo:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo crear equipo" });
    }
  },

  async getEquipo(req, res) {
    try {
      const equipo = await obtenerEquipoDetalle(req.user, req.params.id);
      return res.json({ ok: true, equipo });
    } catch (error) {
      console.error("Error mobile getEquipo:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo cargar equipo" });
    }
  },

  async listJugadores(req, res) {
    try {
      const jugadores = await listarJugadores(req.user, req.query || {});
      return res.json({ ok: true, jugadores });
    } catch (error) {
      console.error("Error mobile listJugadores:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo cargar jugadores" });
    }
  },

  async postJugador(req, res) {
    try {
      const jugador = await crearJugadorMovil(req.user, req.body || {});
      return res.status(201).json({ ok: true, jugador });
    } catch (error) {
      console.error("Error mobile postJugador:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo crear jugador" });
    }
  },

  async deleteJugador(req, res) {
    try {
      const data = await eliminarJugadorMovil(req.user, req.params.id);
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile deleteJugador:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo eliminar jugador" });
    }
  },

  async listJugadoresEquipo(req, res) {
    try {
      const jugadores = await listarJugadores(req.user, { equipo_id: req.params.id });
      return res.json({ ok: true, jugadores });
    } catch (error) {
      console.error("Error mobile listJugadoresEquipo:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo cargar plantilla" });
    }
  },

  async getEstadoCuentaEquipo(req, res) {
    try {
      const data = await obtenerEstadoCuentaEquipo(req.user, req.params.id, req.query || {});
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile getEstadoCuentaEquipo:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo cargar estado de cuenta" });
    }
  },

  async getCompetenciaEvento(req, res) {
    try {
      const data = await obtenerCompetenciaEvento(req.user, req.params.id);
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile getCompetenciaEvento:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo cargar competencia" });
    }
  },

  async getFairPlayEvento(req, res) {
    try {
      const data = await obtenerFairPlayEvento(req.user, req.params.id, req.query || {});
      return res.json(data);
    } catch (error) {
      console.error("Error mobile getFairPlayEvento:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo cargar fair play" });
    }
  },

  async listPartidosEvento(req, res) {
    try {
      const data = await listarPartidosEvento(req.user, req.params.id);
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile listPartidosEvento:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudieron cargar partidos" });
    }
  },

  async getSorteoEvento(req, res) {
    try {
      const data = await obtenerSorteoEvento(req.user, req.params.id);
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile getSorteoEvento:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo cargar sorteo" });
    }
  },

  async postCrearGruposEvento(req, res) {
    try {
      const data = await crearGruposEvento(req.user, req.params.id, req.body || {});
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile postCrearGruposEvento:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudieron crear grupos" });
    }
  },

  async postSorteoAutomatico(req, res) {
    try {
      const data = await generarSorteoAutomatico(req.user, req.params.id, req.body || {});
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile postSorteoAutomatico:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo generar el sorteo" });
    }
  },

  async postAsignarEquipoGrupo(req, res) {
    try {
      const data = await asignarEquipoAGrupo(req.user, req.params.id, req.body || {});
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile postAsignarEquipoGrupo:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo asignar el equipo" });
    }
  },

  async deleteEquipoGrupo(req, res) {
    try {
      const data = await removerEquipoDeGrupo(req.user, req.params.id, req.params.teamId);
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile deleteEquipoGrupo:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo remover el equipo" });
    }
  },

  async postReiniciarSorteo(req, res) {
    try {
      const data = await reiniciarSorteoEvento(req.user, req.params.id);
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile postReiniciarSorteo:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo reiniciar el sorteo" });
    }
  },

  async postGenerarFixture(req, res) {
    try {
      const data = await generarFixtureEvento(req.user, req.params.id, req.body || {});
      return res.json(data);
    } catch (error) {
      console.error("Error mobile postGenerarFixture:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo generar fixture" });
    }
  },

  async postResultadoPartido(req, res) {
    try {
      const data = await registrarResultadoResumen(req.user, req.params.id, req.body || {});
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile postResultadoPartido:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo registrar resultado" });
    }
  },

  async getPlanillaPartido(req, res) {
    try {
      const data = await obtenerPlanillaPartido(req.user, req.params.id);
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile getPlanillaPartido:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo cargar la planilla" });
    }
  },

  async putPlanillaPartido(req, res) {
    try {
      const data = await guardarPlanillaPartido(req.user, req.params.id, req.body || {});
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile putPlanillaPartido:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo guardar la planilla" });
    }
  },

  async getEliminatoriasEvento(req, res) {
    try {
      const data = await obtenerEliminatoriasEvento(req.user, req.params.id);
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile getEliminatoriasEvento:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo cargar eliminatorias" });
    }
  },

  async postGenerarEliminatorias(req, res) {
    try {
      const data = await generarEliminatoriasEvento(req.user, req.params.id, req.body || {});
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile postGenerarEliminatorias:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo generar eliminatorias" });
    }
  },

  async putResultadoEliminatoria(req, res) {
    try {
      const data = await actualizarResultadoEliminatoria(req.user, req.params.id, req.body || {});
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile putResultadoEliminatoria:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo registrar el resultado" });
    }
  },

  async getFinanzasCampeonato(req, res) {
    try {
      const data = await obtenerFinanzasCampeonato(req.user, req.params.id, req.query || {});
      return res.json({ ok: true, ...data });
    } catch (error) {
      console.error("Error mobile getFinanzasCampeonato:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo cargar finanzas" });
    }
  },

  async listPases(req, res) {
    try {
      const pases = await listarPasesVisibles(req.user, req.query || {});
      return res.json({ ok: true, pases });
    } catch (error) {
      console.error("Error mobile listPases:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudieron cargar pases" });
    }
  },

  async putEstadoPase(req, res) {
    try {
      const pase = await actualizarEstadoPase(req.user, req.params.id, req.body || {});
      return res.json({ ok: true, pase });
    } catch (error) {
      console.error("Error mobile putEstadoPase:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo actualizar el pase" });
    }
  },

  async listUsuarios(req, res) {
    try {
      const usuarios = await listarUsuariosVisibles(req.user);
      return res.json({ ok: true, usuarios });
    } catch (error) {
      console.error("Error mobile listUsuarios:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudieron cargar usuarios" });
    }
  },

  async postMovimientoFinanciero(req, res) {
    try {
      const data = await crearMovimientoFinanciero(req.user, req.body || {});
      return res.status(201).json({ ok: true, movimiento: data });
    } catch (error) {
      console.error("Error mobile postMovimientoFinanciero:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo registrar el movimiento" });
    }
  },

  async payMovimiento(req, res) {
    try {
      const data = await marcarMovimientoPagado(req.user, req.params.id, req.body || {});
      return res.json({ ok: true, movimiento: data });
    } catch (error) {
      console.error("Error mobile payMovimiento:", error);
      return res.status(statusFor(error)).json({ error: error.message || "No se pudo registrar el pago" });
    }
  },
};

module.exports = mobileController;
