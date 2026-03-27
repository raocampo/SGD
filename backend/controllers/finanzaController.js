const Finanza = require("../models/Finanza");
const pool = require("../config/database");
const { PLANES, normalizarPlanCodigo } = require("../services/planLimits");
const {
  esTecnicoOdirigente,
  obtenerEquiposPermitidosTecnico,
  tecnicoPuedeAccederEquipo,
} = require("../services/roleScope");
const {
  isOrganizador,
  obtenerCampeonatoIdsOrganizador,
} = require("../services/organizadorScope");

function statusParaError(error) {
  const msg = String(error?.message || "").toLowerCase();
  if (
    msg.includes("invalido") ||
    msg.includes("obligatorio") ||
    msg.includes("formato") ||
    msg.includes("debe") ||
    msg.includes("no pertenece") ||
    msg.includes("no encontrado")
  ) {
    return 400;
  }
  if (msg.includes("duplicate key")) return 409;
  return 500;
}

const finanzaController = {
  async crearMovimiento(req, res) {
    try {
      if (esTecnicoOdirigente(req.user?.rol)) {
        return res.status(403).json({ error: "No autorizado para registrar movimientos" });
      }
      if (isOrganizador(req.user)) {
        const permitidos = await obtenerCampeonatoIdsOrganizador(req.user);
        if (!permitidos.length) {
          return res.status(403).json({ error: "No tienes campeonatos asignados" });
        }
        const payload = req.body || {};
        let campId = payload.campeonato_id
          ? Number.parseInt(payload.campeonato_id, 10)
          : null;
        if (!campId && payload.equipo_id) {
          campId = await Finanza.resolverCampeonatoIdPorEquipo(payload.equipo_id);
        }
        if (!campId || !permitidos.includes(campId)) {
          return res.status(403).json({ error: "No autorizado para registrar movimientos en ese campeonato" });
        }
      }
      const movimiento = await Finanza.crearMovimiento(req.body || {});
      return res.status(201).json({
        ok: true,
        mensaje: "Movimiento financiero creado",
        movimiento,
      });
    } catch (error) {
      console.error("Error creando movimiento financiero:", error);
      return res.status(statusParaError(error)).json({ error: error.message });
    }
  },

  async listarMovimientos(req, res) {
    try {
      const filtros = { ...(req.query || {}) };
      if (esTecnicoOdirigente(req.user?.rol)) {
        const equiposPermitidos = await obtenerEquiposPermitidosTecnico(req);
        if (!equiposPermitidos || !equiposPermitidos.length) {
          return res.json({ ok: true, total: 0, movimientos: [] });
        }

        if (filtros.equipo_id) {
          const autorizado = await tecnicoPuedeAccederEquipo(req, filtros.equipo_id);
          if (!autorizado) {
            return res.status(403).json({ error: "No autorizado para consultar este equipo" });
          }
        } else if (equiposPermitidos.length === 1) {
          filtros.equipo_id = equiposPermitidos[0];
        } else {
          filtros.equipo_ids = equiposPermitidos;
        }
      }
      if (isOrganizador(req.user)) {
        const campeonatos = await obtenerCampeonatoIdsOrganizador(req.user);
        if (!campeonatos.length) return res.json({ ok: true, total: 0, movimientos: [] });
        if (filtros.campeonato_id) {
          const campId = Number.parseInt(filtros.campeonato_id, 10);
          if (!campeonatos.includes(campId)) {
            return res.status(403).json({ error: "No autorizado para consultar ese campeonato" });
          }
        } else if (campeonatos.length === 1) {
          filtros.campeonato_id = campeonatos[0];
        } else {
          filtros.campeonato_ids = campeonatos;
        }
      }

      const movimientos = await Finanza.listarMovimientos(filtros);
      return res.json({
        ok: true,
        total: movimientos.length,
        movimientos,
      });
    } catch (error) {
      console.error("Error listando movimientos financieros:", error);
      return res.status(statusParaError(error)).json({ error: error.message });
    }
  },

  async obtenerEstadoCuentaEquipo(req, res) {
    try {
      const equipo_id = Number.parseInt(req.params.equipo_id, 10);
      if (esTecnicoOdirigente(req.user?.rol)) {
        const autorizado = await tecnicoPuedeAccederEquipo(req, equipo_id);
        if (!autorizado) {
          return res.status(403).json({ error: "No autorizado para consultar este equipo" });
        }
      }
      if (isOrganizador(req.user)) {
        const campeonatos = await obtenerCampeonatoIdsOrganizador(req.user);
        if (!campeonatos.length) {
          return res.status(403).json({ error: "No tienes campeonatos asignados" });
        }
        const campIdEquipo = await Finanza.resolverCampeonatoIdPorEquipo(equipo_id);
        if (!campeonatos.includes(campIdEquipo)) {
          return res.status(403).json({ error: "No autorizado para consultar este equipo" });
        }
      }
      const estadoCuenta = await Finanza.obtenerEstadoCuentaEquipo(
        equipo_id,
        req.query || {}
      );
      return res.json({
        ok: true,
        ...estadoCuenta,
      });
    } catch (error) {
      console.error("Error obteniendo estado de cuenta:", error);
      return res.status(statusParaError(error)).json({ error: error.message });
    }
  },

  async obtenerMorosidad(req, res) {
    try {
      const filtros = { ...(req.query || {}) };
      if (esTecnicoOdirigente(req.user?.rol)) {
        const equiposPermitidos = await obtenerEquiposPermitidosTecnico(req);
        if (!equiposPermitidos || !equiposPermitidos.length) {
          return res.json({ ok: true, total: 0, equipos: [] });
        }

        if (filtros.equipo_id) {
          const autorizado = await tecnicoPuedeAccederEquipo(req, filtros.equipo_id);
          if (!autorizado) {
            return res.status(403).json({ error: "No autorizado para consultar este equipo" });
          }
        } else if (equiposPermitidos.length === 1) {
          filtros.equipo_id = equiposPermitidos[0];
        } else {
          filtros.equipo_ids = equiposPermitidos;
        }
      }
      if (isOrganizador(req.user)) {
        const campeonatos = await obtenerCampeonatoIdsOrganizador(req.user);
        if (!campeonatos.length) return res.json({ ok: true, total: 0, equipos: [] });
        if (filtros.campeonato_id) {
          const campId = Number.parseInt(filtros.campeonato_id, 10);
          if (!campeonatos.includes(campId)) {
            return res.status(403).json({ error: "No autorizado para consultar ese campeonato" });
          }
        } else if (campeonatos.length === 1) {
          filtros.campeonato_id = campeonatos[0];
        } else {
          filtros.campeonato_ids = campeonatos;
        }
      }

      const equipos = await Finanza.obtenerMorosidad(filtros);
      return res.json({
        ok: true,
        total: equipos.length,
        equipos,
      });
    } catch (error) {
      console.error("Error obteniendo morosidad:", error);
      return res.status(statusParaError(error)).json({ error: error.message });
    }
  },

  async dashboardOrganizador(req, res) {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: "No autenticado" });

      const esAdmin = String(user.rol || "").toLowerCase() === "administrador";
      const esOrg = String(user.rol || "").toLowerCase() === "organizador";
      if (!esAdmin && !esOrg) {
        return res.status(403).json({ error: "Acceso no permitido" });
      }

      const campeonatoIds = esAdmin ? [] : await obtenerCampeonatoIdsOrganizador(user);
      const campFiltroSQL = esAdmin
        ? "1=1"
        : campeonatoIds.length === 0
        ? "c.id = -1"
        : "c.id = ANY($1::int[])";
      const campParams = esAdmin || campeonatoIds.length === 0 ? [] : [campeonatoIds];

      // Torneos activos
      const rTorneos = await pool.query(
        `SELECT COUNT(*) AS total FROM campeonatos c WHERE c.estado NOT IN ('archivado') AND ${campFiltroSQL}`,
        campParams
      );

      // Total equipos inscritos (en eventos del organizador)
      const rEquipos = await pool.query(
        `SELECT COUNT(DISTINCT ee.equipo_id) AS total
         FROM evento_equipos ee
         JOIN eventos ev ON ee.evento_id = ev.id
         JOIN campeonatos c ON ev.campeonato_id = c.id
         WHERE ${campFiltroSQL}`,
        campParams
      );

      // Jugadores distintos por cedula
      const rJugadores = await pool.query(
        `SELECT COUNT(DISTINCT j.cedidentidad) AS total
         FROM jugadores j
         JOIN equipos eq ON j.equipo_id = eq.id
         JOIN campeonatos c ON eq.campeonato_id = c.id
         WHERE j.cedidentidad IS NOT NULL AND j.cedidentidad <> '' AND ${campFiltroSQL}`,
        campParams
      );

      // Ingresos mes actual (abonos)
      const rIngresosMes = await pool.query(
        `SELECT COALESCE(SUM(fm.monto), 0) AS total
         FROM finanzas_movimientos fm
         JOIN campeonatos c ON fm.campeonato_id = c.id
         WHERE fm.tipo_movimiento = 'abono'
           AND fm.fecha_movimiento >= DATE_TRUNC('month', CURRENT_DATE)
           AND ${campFiltroSQL}`,
        campParams
      );

      // Ingresos por concepto (mes actual)
      const rPorConcepto = await pool.query(
        `SELECT fm.concepto, COALESCE(SUM(fm.monto), 0) AS total
         FROM finanzas_movimientos fm
         JOIN campeonatos c ON fm.campeonato_id = c.id
         WHERE fm.tipo_movimiento = 'abono'
           AND fm.fecha_movimiento >= DATE_TRUNC('month', CURRENT_DATE)
           AND ${campFiltroSQL}
         GROUP BY fm.concepto
         ORDER BY total DESC`,
        campParams
      );

      // Próximos encuentros (7 días)
      const rEncuentros = await pool.query(
        `SELECT p.id, p.fecha_partido, p.hora_partido, p.cancha,
                p.estado, p.numero_campeonato AS numero_partido_visible,
                el.nombre AS equipo_local_nombre,
                evis.nombre AS equipo_visitante_nombre,
                ev.nombre AS evento_nombre,
                c.nombre AS campeonato_nombre
         FROM partidos p
         JOIN campeonatos c ON p.campeonato_id = c.id
         LEFT JOIN equipos el ON p.equipo_local_id = el.id
         LEFT JOIN equipos evis ON p.equipo_visitante_id = evis.id
         LEFT JOIN eventos ev ON p.evento_id = ev.id
         WHERE p.estado = 'programado'
           AND p.fecha_partido BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
           AND ${campFiltroSQL}
         ORDER BY p.fecha_partido ASC, p.hora_partido ASC
         LIMIT 10`,
        campParams
      );

      // Morosidad (top 5)
      const filtrosMor = {};
      if (!esAdmin && campeonatoIds.length === 1) {
        filtrosMor.campeonato_id = campeonatoIds[0];
      } else if (!esAdmin && campeonatoIds.length > 1) {
        filtrosMor.campeonato_ids = campeonatoIds;
      }
      const morosos = await Finanza.obtenerMorosidad(filtrosMor);

      // Plan del organizador
      const planCodigo = normalizarPlanCodigo(user.plan_codigo, "free");
      const plan = PLANES[planCodigo] || PLANES.free;

      return res.json({
        ok: true,
        kpis: {
          torneos_activos: Number(rTorneos.rows[0]?.total || 0),
          equipos_inscritos: Number(rEquipos.rows[0]?.total || 0),
          jugadores_registrados: Number(rJugadores.rows[0]?.total || 0),
          ingresos_mes: Number(rIngresosMes.rows[0]?.total || 0),
        },
        ingresos_por_concepto: rPorConcepto.rows,
        proximos_encuentros: rEncuentros.rows,
        morosos: morosos.slice(0, 5),
        plan: {
          codigo: plan.codigo,
          nombre: plan.nombre,
          precio_mensual: plan.precio_mensual,
          max_campeonatos: plan.max_campeonatos,
          campeonatos_usados: Number(rTorneos.rows[0]?.total || 0),
        },
      });
    } catch (error) {
      console.error("Error en dashboardOrganizador:", error);
      return res.status(500).json({ error: "No se pudo obtener el dashboard" });
    }
  },

  // ─── Gastos operativos ───────────────────────────────────────────────────

  async crearGasto(req, res) {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: "No autenticado" });

      const body = req.body || {};

      // El organizador solo puede registrar gastos de sus campeonatos
      if (isOrganizador(user)) {
        const ids = await obtenerCampeonatoIdsOrganizador(user.id);
        if (!ids.includes(Number(body.campeonato_id))) {
          return res.status(403).json({ error: "No autorizado para este campeonato" });
        }
      }

      const gasto = await Finanza.crearGasto({ ...body, created_by: user.id });
      return res.status(201).json({ ok: true, gasto });
    } catch (error) {
      const status = statusParaError(error);
      return res.status(status).json({ error: error.message });
    }
  },

  async listarGastos(req, res) {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: "No autenticado" });

      const filtros = { ...req.query };

      if (isOrganizador(user)) {
        const ids = await obtenerCampeonatoIdsOrganizador(user.id);
        if (!ids.length) return res.json({ ok: true, gastos: [] });
        // Si no filtra por campeonato específico, devuelve todos los suyos
        if (!filtros.campeonato_id) {
          // Devolvemos con el primer campeonato solicitado o todos
        } else if (!ids.includes(Number(filtros.campeonato_id))) {
          return res.status(403).json({ error: "No autorizado para este campeonato" });
        }
      }

      const gastos = await Finanza.listarGastos(filtros);
      return res.json({ ok: true, total: gastos.length, gastos });
    } catch (error) {
      return res.status(500).json({ error: "No se pudo listar los gastos" });
    }
  },

  async actualizarGasto(req, res) {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: "No autenticado" });

      const id = Number(req.params.id);
      const gastos = await Finanza.listarGastos({});
      const existente = gastos.find((g) => g.id === id);
      if (!existente) return res.status(404).json({ error: "Gasto no encontrado" });

      if (isOrganizador(user)) {
        const ids = await obtenerCampeonatoIdsOrganizador(user.id);
        if (!ids.includes(Number(existente.campeonato_id))) {
          return res.status(403).json({ error: "No autorizado" });
        }
      }

      const gasto = await Finanza.actualizarGasto(id, req.body || {});
      return res.json({ ok: true, gasto });
    } catch (error) {
      const status = statusParaError(error);
      return res.status(status).json({ error: error.message });
    }
  },

  async eliminarGasto(req, res) {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: "No autenticado" });

      const id = Number(req.params.id);
      const gastos = await Finanza.listarGastos({});
      const existente = gastos.find((g) => g.id === id);
      if (!existente) return res.status(404).json({ error: "Gasto no encontrado" });

      if (isOrganizador(user)) {
        const ids = await obtenerCampeonatoIdsOrganizador(user.id);
        if (!ids.includes(Number(existente.campeonato_id))) {
          return res.status(403).json({ error: "No autorizado" });
        }
      }

      await Finanza.eliminarGasto(id);
      return res.json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  async resumenGastos(req, res) {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: "No autenticado" });

      const campeonato_id = Number(req.params.campeonato_id);

      if (isOrganizador(user)) {
        const ids = await obtenerCampeonatoIdsOrganizador(user.id);
        if (!ids.includes(campeonato_id)) {
          return res.status(403).json({ error: "No autorizado" });
        }
      }

      const resumen = await Finanza.resumenGastosPorCategoria(campeonato_id);
      return res.json({ ok: true, resumen });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
};

module.exports = finanzaController;
