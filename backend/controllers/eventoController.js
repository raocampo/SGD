// controllers/eventoController.js
const pool = require("../config/database");
const { obtenerEquiposPermitidosTecnico } = require("../services/roleScope");
const {
  isOrganizador,
  organizadorPuedeAccederCampeonato,
  obtenerCampeonatoIdsOrganizador,
} = require("../services/organizadorScope");
const { obtenerPlanPorCampeonatoId } = require("../services/planLimits");
const {
  MOTIVOS_ELIMINACION,
  normalizarMotivoEliminacion,
  formatearMotivoEliminacion,
  asegurarEsquemaEstadoCompeticion,
} = require("../services/competitionStatusService");
let eventoEsquemaAsegurado = false;
let eventoColumnaActualizacion = null;

function pick(v, fallback = null) {
  return v === undefined ? fallback : v;
}

function parseTimeHHMM(value, fallback) {
  if (!value) return fallback;
  const s = String(value).trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.length === 5 ? `${s}:00` : s;
  return fallback;
}

function parseDecimalNonNegative(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const num = Number.parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Number(num.toFixed(2));
}

function parseDecimalNullable(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const num = Number.parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Number(num.toFixed(2));
}

function normalizarMetodoCompetencia(value, fallback = "grupos") {
  const raw = String(value || fallback).trim().toLowerCase();
  const map = {
    grupos: "grupos",
    liga: "liga",
    todos: "liga",
    todos_contra_todos: "liga",
    eliminatoria: "eliminatoria",
    eliminacion: "eliminatoria",
    eliminacion_directa: "eliminatoria",
    eliminatoria_directa: "eliminatoria",
    mixto: "mixto",
    grupos_y_eliminatoria: "mixto",
  };
  return map[raw] || null;
}

function normalizarEliminatoriaEquipos(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  if (![4, 8, 16, 32].includes(n)) return null;
  return n;
}

function normalizarClasificadosPorGrupo(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function esAdministrador(user) {
  return String(user?.rol || "").toLowerCase() === "administrador";
}

async function validarAccesoCampeonatoOrganizador(req, res, campeonatoId, mensaje) {
  if (!isOrganizador(req?.user)) return true;
  const puede = await organizadorPuedeAccederCampeonato(req.user, campeonatoId);
  if (puede) return true;
  res.status(403).json({ error: mensaje || "No autorizado para este campeonato." });
  return false;
}

async function resolverColumnaActualizacionEvento() {
  if (eventoColumnaActualizacion !== null) return eventoColumnaActualizacion;

  const r = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'eventos'
      AND column_name IN ('updated_at', 'update_at')
  `);

  const cols = new Set(r.rows.map((row) => row.column_name));
  if (cols.has("updated_at")) eventoColumnaActualizacion = "updated_at";
  else if (cols.has("update_at")) eventoColumnaActualizacion = "update_at";
  else eventoColumnaActualizacion = "";

  return eventoColumnaActualizacion;
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

  await pool.query(`
    ALTER TABLE eventos
    ADD COLUMN IF NOT EXISTS costo_inscripcion NUMERIC(12,2) DEFAULT 0
  `);
  await pool.query(`
    ALTER TABLE eventos
    ADD COLUMN IF NOT EXISTS numero_campeonato INTEGER
  `);
  await pool.query(`
    ALTER TABLE eventos
    ADD COLUMN IF NOT EXISTS metodo_competencia VARCHAR(30) DEFAULT 'grupos'
  `);
  await pool.query(`
    ALTER TABLE eventos
    ADD COLUMN IF NOT EXISTS eliminatoria_equipos INTEGER
  `);
  await pool.query(`
    ALTER TABLE eventos
    ADD COLUMN IF NOT EXISTS clasificados_por_grupo INTEGER
  `);
  await pool.query(`
    ALTER TABLE eventos
    ADD COLUMN IF NOT EXISTS bloquear_morosos BOOLEAN
  `);
  await pool.query(`
    ALTER TABLE eventos
    ADD COLUMN IF NOT EXISTS bloqueo_morosidad_monto NUMERIC(12,2)
  `);

  await pool.query(`
    UPDATE eventos
    SET costo_inscripcion = 0
    WHERE costo_inscripcion IS NULL
  `);
  await pool.query(`
    UPDATE eventos
    SET metodo_competencia = 'grupos'
    WHERE metodo_competencia IS NULL OR TRIM(metodo_competencia) = ''
  `);
  await pool.query(`
    UPDATE eventos
    SET eliminatoria_equipos = NULL
    WHERE eliminatoria_equipos IS NOT NULL
      AND eliminatoria_equipos NOT IN (4, 8, 16, 32)
  `);
  await pool.query(`
    UPDATE eventos
    SET clasificados_por_grupo = 2
    WHERE (clasificados_por_grupo IS NULL OR clasificados_por_grupo <= 0)
      AND LOWER(COALESCE(metodo_competencia, 'grupos')) IN ('grupos', 'mixto')
  `);
  await pool.query(`
    UPDATE eventos
    SET bloqueo_morosidad_monto = NULL
    WHERE bloqueo_morosidad_monto IS NOT NULL
      AND bloqueo_morosidad_monto < 0
  `);
  await asegurarEsquemaEstadoCompeticion(pool);
  await pool.query(`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY campeonato_id
          ORDER BY id
        )::int AS rn
      FROM eventos
      WHERE campeonato_id IS NOT NULL
    )
    UPDATE eventos e
    SET numero_campeonato = ranked.rn
    FROM ranked
    WHERE e.id = ranked.id
      AND e.numero_campeonato IS NULL
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_eventos_numero_campeonato
    ON eventos(campeonato_id, numero_campeonato)
    WHERE numero_campeonato IS NOT NULL
  `);

  await resolverColumnaActualizacionEvento();

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
        costo_inscripcion,
        clasificados_por_grupo,
        metodo_competencia,
        eliminatoria_equipos,
        bloquear_morosos,
        bloqueo_morosidad_monto,
      } = req.body;

      if (!campeonato_id || !nombre || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({ error: "Faltan campos obligatorios." });
      }

      if (isOrganizador(req.user)) {
        const puede = await organizadorPuedeAccederCampeonato(req.user, campeonato_id);
        if (!puede) {
          return res.status(403).json({ error: "No autorizado para crear categorías en este campeonato." });
        }
      }

      if (!esAdministrador(req.user)) {
        const plan = await obtenerPlanPorCampeonatoId(campeonato_id);
        if (
          plan?.max_categorias_por_campeonato !== null &&
          plan?.max_categorias_por_campeonato !== undefined
        ) {
          const countR = await pool.query(
            `SELECT COUNT(*)::int AS total FROM eventos WHERE campeonato_id = $1`,
            [campeonato_id]
          );
          const totalActual = Number(countR.rows[0]?.total || 0);
          if (totalActual >= plan.max_categorias_por_campeonato) {
            return res.status(400).json({
              error: `Tu plan ${plan.nombre} permite máximo ${plan.max_categorias_por_campeonato} categorías por campeonato`,
            });
          }
        }
      }

      // defaults (según lo que ya definiste)
      const mod = (modalidad || "weekend").toLowerCase();

      const wkStart = parseTimeHHMM(horarios?.weekday?.start, "19:00:00");
      const wkEnd = parseTimeHHMM(horarios?.weekday?.end, "22:00:00");

      const satStart = parseTimeHHMM(horarios?.weekend?.sat_start, "13:00:00");
      const satEnd = parseTimeHHMM(horarios?.weekend?.sat_end, "18:00:00");
      const sunStart = parseTimeHHMM(horarios?.weekend?.sun_start, "08:00:00");
      const sunEnd = parseTimeHHMM(horarios?.weekend?.sun_end, "17:00:00");
      const costoInscripcion = parseDecimalNonNegative(costo_inscripcion, 0);
      const clasificadosPorGrupo = normalizarClasificadosPorGrupo(clasificados_por_grupo, null);
      const bloquearMorososValor =
        bloquear_morosos === undefined || bloquear_morosos === null || bloquear_morosos === ""
          ? null
          : bloquear_morosos === true || String(bloquear_morosos).toLowerCase() === "true";
      const bloqueoMorosidadMonto = parseDecimalNullable(bloqueo_morosidad_monto, null);
      const metodoCompetencia = normalizarMetodoCompetencia(metodo_competencia, "grupos");
      if (!metodoCompetencia) {
        return res.status(400).json({
          error:
            "metodo_competencia invalido. Usa: grupos, liga, eliminatoria o mixto.",
        });
      }
      const eliminatoriaEquipos = normalizarEliminatoriaEquipos(eliminatoria_equipos, null);
      if (eliminatoria_equipos !== undefined && eliminatoria_equipos !== null && eliminatoriaEquipos === null) {
        return res.status(400).json({
          error: "eliminatoria_equipos invalido. Valores permitidos: 4, 8, 16, 32.",
        });
      }
      if (
        clasificados_por_grupo !== undefined &&
        clasificados_por_grupo !== null &&
        clasificados_por_grupo !== "" &&
        clasificadosPorGrupo === null
      ) {
        return res.status(400).json({
          error: "clasificados_por_grupo invalido. Debe ser un entero mayor a 0.",
        });
      }
      const clasificadosFinal =
        ["grupos", "mixto"].includes(metodoCompetencia) ? clasificadosPorGrupo || 2 : null;

      const query = `
        WITH next_num AS (
          SELECT COALESCE(MAX(numero_campeonato), 0) + 1 AS next_num
          FROM eventos
          WHERE campeonato_id = $1
        )
        INSERT INTO eventos (
          campeonato_id, nombre, organizador, fecha_inicio, fecha_fin, estado,
          modalidad,
          metodo_competencia, eliminatoria_equipos,
          costo_inscripcion, clasificados_por_grupo,
          bloquear_morosos, bloqueo_morosidad_monto,
          horario_weekday_inicio, horario_weekday_fin,
          horario_sab_inicio, horario_sab_fin,
          horario_dom_inicio, horario_dom_fin,
          numero_campeonato
        )
        SELECT
          $1,$2,$3,$4,$5,'activo',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,next_num.next_num
        FROM next_num
        RETURNING *
      `;

      const values = [
        campeonato_id,
        nombre,
        pick(organizador, null),
        fecha_inicio,
        fecha_fin,
        mod,
        metodoCompetencia,
        eliminatoriaEquipos,
        costoInscripcion,
        clasificadosFinal,
        bloquearMorososValor,
        bloqueoMorosidadMonto,
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
      let q = `
        SELECT e.*,
               c.nombre AS campeonato_nombre
        FROM eventos e
        JOIN campeonatos c ON e.campeonato_id = c.id
      `;
      const valores = [];

      if (isOrganizador(req.user)) {
        const campeonatoIds = await obtenerCampeonatoIdsOrganizador(req.user);
        if (!campeonatoIds.length) {
          return res.json({ eventos: [] });
        }
        q += ` WHERE e.campeonato_id = ANY($1::int[])`;
        valores.push(campeonatoIds);
      }

      q += ` ORDER BY e.campeonato_id DESC, e.numero_campeonato DESC, e.id DESC`;
      const result = await pool.query(q, valores);
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
      const campeonatoId = Number.parseInt(campeonato_id, 10);
      if (!Number.isFinite(campeonatoId) || campeonatoId <= 0) {
        return res.status(400).json({ error: "campeonato_id inválido." });
      }
      const autorizado = await validarAccesoCampeonatoOrganizador(
        req,
        res,
        campeonatoId,
        "No autorizado para listar categorías de este campeonato."
      );
      if (!autorizado) return;
      const q = `
        SELECT e.*,
               c.nombre AS campeonato_nombre
        FROM eventos e
        JOIN campeonatos c ON e.campeonato_id = c.id
        WHERE e.campeonato_id = $1
        ORDER BY e.numero_campeonato ASC, e.id ASC
      `;
      const result = await pool.query(q, [campeonatoId]);
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

      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "id de evento inválido." });
      }
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
      const autorizado = await validarAccesoCampeonatoOrganizador(
        req,
        res,
        result.rows[0]?.campeonato_id,
        "No autorizado para consultar esta categoría."
      );
      if (!autorizado) return;
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
      const actualR = await pool.query(`SELECT * FROM eventos WHERE id = $1 LIMIT 1`, [id]);
      if (!actualR.rows.length) {
        return res.status(404).json({ error: "Evento no encontrado." });
      }
      const eventoActual = actualR.rows[0];
      const autorizado = await validarAccesoCampeonatoOrganizador(
        req,
        res,
        eventoActual.campeonato_id,
        "No autorizado para actualizar esta categoría."
      );
      if (!autorizado) return;
      const metodoObjetivo =
        req.body.metodo_competencia !== undefined
          ? normalizarMetodoCompetencia(req.body.metodo_competencia, null)
          : normalizarMetodoCompetencia(eventoActual.metodo_competencia, "grupos");

      const campos = [];
      const valores = [];
      let i = 1;

      for (const [k, v] of Object.entries(req.body)) {
        if (k === "id") continue;
        if (k === "metodo_competencia") {
          const metodo = normalizarMetodoCompetencia(v, null);
          if (!metodo) {
            return res.status(400).json({
              error:
                "metodo_competencia invalido. Usa: grupos, liga, eliminatoria o mixto.",
            });
          }
          campos.push(`${k} = $${i}`);
          valores.push(metodo);
          i++;
          continue;
        }
        if (k === "eliminatoria_equipos") {
          const n = normalizarEliminatoriaEquipos(v, null);
          if (v !== null && v !== "" && n === null) {
            return res.status(400).json({
              error: "eliminatoria_equipos invalido. Valores permitidos: 4, 8, 16, 32.",
            });
          }
          campos.push(`${k} = $${i}`);
          valores.push(v === null || v === "" ? null : n);
          i++;
          continue;
        }
        if (k === "costo_inscripcion") {
          const costoParseado = parseDecimalNonNegative(v, null);
          if (costoParseado === null) {
            return res
              .status(400)
              .json({ error: "costo_inscripcion debe ser un número >= 0." });
          }
          campos.push(`${k} = $${i}`);
          valores.push(costoParseado);
          i++;
          continue;
        }
        if (k === "clasificados_por_grupo") {
          const clasificados = normalizarClasificadosPorGrupo(v, null);
          if (v !== null && v !== "" && clasificados === null) {
            return res.status(400).json({
              error: "clasificados_por_grupo debe ser un entero mayor a 0.",
            });
          }
          campos.push(`${k} = $${i}`);
          valores.push(
            ["grupos", "mixto"].includes(metodoObjetivo) ? clasificados || 2 : null
          );
          i++;
          continue;
        }
        if (k === "bloquear_morosos") {
          campos.push(`${k} = $${i}`);
          valores.push(
            v === null || v === ""
              ? null
              : v === true || String(v).toLowerCase() === "true"
          );
          i++;
          continue;
        }
        if (k === "bloqueo_morosidad_monto") {
          const montoParseado = parseDecimalNullable(v, null);
          if (v !== null && v !== "" && montoParseado === null) {
            return res
              .status(400)
              .json({ error: "bloqueo_morosidad_monto debe ser un número >= 0." });
          }
          campos.push(`${k} = $${i}`);
          valores.push(montoParseado);
          i++;
          continue;
        }
        campos.push(`${k} = $${i}`);
        valores.push(v);
        i++;
      }

      if (!campos.length) {
        return res
          .status(400)
          .json({ error: "No hay campos para actualizar." });
      }

      if (
        req.body.metodo_competencia !== undefined &&
        !Object.prototype.hasOwnProperty.call(req.body, "clasificados_por_grupo")
      ) {
        campos.push(`clasificados_por_grupo = $${i}`);
        valores.push(
          ["grupos", "mixto"].includes(metodoObjetivo)
            ? normalizarClasificadosPorGrupo(eventoActual.clasificados_por_grupo, 2) || 2
            : null
        );
        i++;
      }

      const colActualizacion = await resolverColumnaActualizacionEvento();
      const setCampos = colActualizacion
        ? `${campos.join(", ")}, ${colActualizacion} = CURRENT_TIMESTAMP`
        : campos.join(", ");

      valores.push(id);
      const q = `
        UPDATE eventos
        SET ${setCampos}
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
      await asegurarEsquemaEventos();

      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "id de evento inválido." });
      }

      const actualR = await pool.query(
        `SELECT id, campeonato_id FROM eventos WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (!actualR.rows.length) {
        return res.status(404).json({ error: "Evento no encontrado." });
      }
      const autorizado = await validarAccesoCampeonatoOrganizador(
        req,
        res,
        actualR.rows[0]?.campeonato_id,
        "No autorizado para eliminar esta categoría."
      );
      if (!autorizado) return;

      const q = `DELETE FROM eventos WHERE id = $1 RETURNING *`;
      const result = await pool.query(q, [id]);
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
      const evento_id = Number.parseInt(req.params.evento_id, 10);
      const { cancha_ids } = req.body;

      if (!Number.isFinite(evento_id) || evento_id <= 0) {
        return res.status(400).json({ error: "evento_id inválido." });
      }

      if (!Array.isArray(cancha_ids)) {
        return res
          .status(400)
          .json({ error: "cancha_ids debe ser un arreglo." });
      }

      const eventoR = await client.query(
        `SELECT id, campeonato_id FROM eventos WHERE id = $1 LIMIT 1`,
        [evento_id]
      );
      if (!eventoR.rows.length) {
        return res.status(404).json({ error: "Evento no encontrado." });
      }
      const autorizado = await validarAccesoCampeonatoOrganizador(
        req,
        res,
        eventoR.rows[0]?.campeonato_id,
        "No autorizado para configurar canchas en esta categoría."
      );
      if (!autorizado) return;

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
      const evento_id = Number.parseInt(req.params.evento_id, 10);
      if (!Number.isFinite(evento_id) || evento_id <= 0) {
        return res.status(400).json({ error: "evento_id inválido." });
      }

      const eventoR = await pool.query(
        `SELECT id, campeonato_id FROM eventos WHERE id = $1 LIMIT 1`,
        [evento_id]
      );
      if (!eventoR.rows.length) {
        return res.status(404).json({ error: "Evento no encontrado." });
      }
      const autorizado = await validarAccesoCampeonatoOrganizador(
        req,
        res,
        eventoR.rows[0]?.campeonato_id,
        "No autorizado para consultar canchas de esta categoría."
      );
      if (!autorizado) return;

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
      await asegurarEsquemaEventos();
      const evento_id = parseInt(req.params.evento_id, 10);
      const equipo_id = parseInt(req.body.equipo_id, 10);

      if (!Number.isFinite(evento_id) || !Number.isFinite(equipo_id)) {
        return res
          .status(400)
          .json({ message: "evento_id y equipo_id son obligatorios" });
      }

      const eventoR = await pool.query(
        `SELECT id, campeonato_id FROM eventos WHERE id = $1 LIMIT 1`,
        [evento_id]
      );
      if (!eventoR.rows.length) {
        return res.status(404).json({ message: "Evento no encontrado" });
      }
      const evento = eventoR.rows[0];

      if (isOrganizador(req.user)) {
        const puede = await organizadorPuedeAccederCampeonato(req.user, evento.campeonato_id);
        if (!puede) {
          return res.status(403).json({ message: "No autorizado para asignar equipos en este evento" });
        }
      }

      const equipoR = await pool.query(
        `SELECT id, campeonato_id FROM equipos WHERE id = $1 LIMIT 1`,
        [equipo_id]
      );
      if (!equipoR.rows.length) {
        return res.status(404).json({ message: "Equipo no encontrado" });
      }
      const equipo = equipoR.rows[0];
      if (Number(equipo.campeonato_id) !== Number(evento.campeonato_id)) {
        return res.status(400).json({
          message: "El equipo no pertenece al campeonato de esta categoría",
        });
      }

      const yaExisteR = await pool.query(
        `SELECT 1 FROM evento_equipos WHERE evento_id = $1 AND equipo_id = $2 LIMIT 1`,
        [evento_id, equipo_id]
      );
      if (yaExisteR.rows.length) {
        return res.json({ ok: true, message: "Equipo ya estaba asignado al evento" });
      }

      const nombreDuplicadoR = await pool.query(
        `
          SELECT e2.id, e2.nombre
          FROM evento_equipos ee
          JOIN equipos e2 ON e2.id = ee.equipo_id
          WHERE ee.evento_id = $1
            AND LOWER(TRIM(e2.nombre)) = LOWER(TRIM($2))
            AND e2.id <> $3
          LIMIT 1
        `,
        [evento_id, equipo.nombre, equipo_id]
      );
      if (nombreDuplicadoR.rows.length) {
        return res.status(400).json({
          message: "Ya existe un equipo con ese nombre en la categoría seleccionada",
        });
      }

      if (!esAdministrador(req.user)) {
        const plan = await obtenerPlanPorCampeonatoId(evento.campeonato_id);
        if (
          plan?.max_equipos_por_categoria !== null &&
          plan?.max_equipos_por_categoria !== undefined
        ) {
          const countR = await pool.query(
            `SELECT COUNT(*)::int AS total FROM evento_equipos WHERE evento_id = $1`,
            [evento_id]
          );
          const totalActual = Number(countR.rows[0]?.total || 0);
          if (totalActual >= plan.max_equipos_por_categoria) {
            return res.status(400).json({
              message: `Tu plan ${plan.nombre} permite máximo ${plan.max_equipos_por_categoria} equipos por categoría`,
            });
          }
        }
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
      await asegurarEsquemaEventos();
      const evento_id = parseInt(req.params.evento_id, 10);
      if (!Number.isFinite(evento_id)) {
        return res.status(400).json({ message: "evento_id inválido" });
      }

      const eventoR = await pool.query(
        `SELECT id, campeonato_id FROM eventos WHERE id = $1 LIMIT 1`,
        [evento_id]
      );
      if (!eventoR.rows.length) {
        return res.status(404).json({ message: "Evento no encontrado" });
      }
      const autorizado = await validarAccesoCampeonatoOrganizador(
        req,
        res,
        eventoR.rows[0]?.campeonato_id,
        "No autorizado para listar equipos de esta categoría."
      );
      if (!autorizado) return;

      const result = await pool.query(
        `
        SELECT
          e.*,
          COALESCE(ee.no_presentaciones, 0)::int AS no_presentaciones,
          COALESCE(ee.eliminado_automatico, FALSE) AS eliminado_automatico,
          COALESCE(ee.eliminado_manual, FALSE) AS eliminado_manual,
          ee.motivo_eliminacion,
          ee.detalle_eliminacion,
          ee.eliminado_en
        FROM equipos e
        JOIN evento_equipos ee ON ee.equipo_id = e.id
        WHERE ee.evento_id = $1
        ORDER BY
          (COALESCE(ee.eliminado_automatico, FALSE) OR COALESCE(ee.eliminado_manual, FALSE)) ASC,
          e.numero_campeonato ASC NULLS LAST,
          e.nombre
      `,
        [evento_id]
      );
      const permitidos = await obtenerEquiposPermitidosTecnico(req);
      const equipos =
        permitidos === null
          ? result.rows
          : result.rows.filter((e) => permitidos.includes(Number(e.id)));

      return res.json({
        equipos: equipos.map((equipo) => ({
          ...equipo,
          eliminado_manual: equipo.eliminado_manual === true,
          motivo_eliminacion: equipo.motivo_eliminacion || null,
          motivo_eliminacion_label: equipo.motivo_eliminacion
            ? formatearMotivoEliminacion(equipo.motivo_eliminacion)
            : null,
          detalle_eliminacion: equipo.detalle_eliminacion || null,
          eliminado_en: equipo.eliminado_en || null,
          eliminado_competencia:
            equipo.eliminado_automatico === true || equipo.eliminado_manual === true,
        })),
        motivos_eliminacion: MOTIVOS_ELIMINACION,
      });
    } catch (error) {
      console.error("listarEquiposDeEvento:", error);
      return res
        .status(500)
        .json({ message: "Error listando equipos del evento" });
    }
  },

  // PUT /eventos/:evento_id/equipos/:equipo_id/estado-competencia
  async actualizarEstadoCompetenciaEquipo(req, res) {
    try {
      await asegurarEsquemaEventos();
      const evento_id = parseInt(req.params.evento_id, 10);
      const equipo_id = parseInt(req.params.equipo_id, 10);
      if (!Number.isFinite(evento_id) || !Number.isFinite(equipo_id)) {
        return res.status(400).json({ message: "evento_id o equipo_id inválidos" });
      }

      const eventoR = await pool.query(
        `SELECT id, campeonato_id FROM eventos WHERE id = $1 LIMIT 1`,
        [evento_id]
      );
      if (!eventoR.rows.length) {
        return res.status(404).json({ message: "Evento no encontrado" });
      }

      const autorizado = await validarAccesoCampeonatoOrganizador(
        req,
        res,
        eventoR.rows[0]?.campeonato_id,
        "No autorizado para actualizar el estado del equipo en esta categoría."
      );
      if (!autorizado) return;

      const relacionR = await pool.query(
        `
          SELECT evento_id, equipo_id
          FROM evento_equipos
          WHERE evento_id = $1 AND equipo_id = $2
          LIMIT 1
        `,
        [evento_id, equipo_id]
      );
      if (!relacionR.rows.length) {
        return res.status(404).json({ message: "El equipo no está inscrito en esta categoría" });
      }

      const eliminarManual = req.body?.eliminado_manual === true;
      const detalle = String(req.body?.detalle_eliminacion || "").trim() || null;
      const usuarioId = Number.parseInt(req.user?.id, 10);

      let motivo = null;
      if (eliminarManual) {
        motivo = normalizarMotivoEliminacion(req.body?.motivo_eliminacion, null);
        if (!motivo) {
          return res.status(400).json({
            message:
              "motivo_eliminacion inválido. Usa: indisciplina, deudas o sin_justificativo_segunda_no_presentacion.",
          });
        }
      }

      const r = await pool.query(
        `
          UPDATE evento_equipos
          SET eliminado_manual = $3,
              motivo_eliminacion = $4,
              detalle_eliminacion = $5,
              eliminado_en = CASE WHEN $3::boolean THEN CURRENT_TIMESTAMP ELSE NULL END,
              eliminado_por_usuario_id = CASE WHEN $3::boolean THEN $6::integer ELSE NULL END
          WHERE evento_id = $1 AND equipo_id = $2
          RETURNING
            evento_id,
            equipo_id,
            no_presentaciones,
            eliminado_automatico,
            eliminado_manual,
            motivo_eliminacion,
            detalle_eliminacion,
            eliminado_en
        `,
        [
          evento_id,
          equipo_id,
          eliminarManual,
          motivo,
          detalle,
          Number.isFinite(usuarioId) && usuarioId > 0 ? usuarioId : null,
        ]
      );

      return res.json({
        ok: true,
        estado: {
          ...r.rows[0],
          eliminado_automatico: r.rows[0]?.eliminado_automatico === true,
          eliminado_manual: r.rows[0]?.eliminado_manual === true,
          motivo_eliminacion_label: r.rows[0]?.motivo_eliminacion
            ? formatearMotivoEliminacion(r.rows[0].motivo_eliminacion)
            : null,
          eliminado_competencia:
            r.rows[0]?.eliminado_automatico === true || r.rows[0]?.eliminado_manual === true,
        },
        motivos_eliminacion: MOTIVOS_ELIMINACION,
      });
    } catch (error) {
      console.error("actualizarEstadoCompetenciaEquipo:", error);
      return res.status(500).json({ message: "Error actualizando estado competitivo del equipo" });
    }
  },

  // DELETE /eventos/:evento_id/equipos/:equipo_id
  async quitarEquipoDeEvento(req, res) {
    try {
      await asegurarEsquemaEventos();
      const evento_id = parseInt(req.params.evento_id, 10);
      const equipo_id = parseInt(req.params.equipo_id, 10);

      if (!Number.isFinite(evento_id) || !Number.isFinite(equipo_id)) {
        return res
          .status(400)
          .json({ message: "evento_id y equipo_id inválidos" });
      }

      const eventoR = await pool.query(
        `SELECT id, campeonato_id FROM eventos WHERE id = $1 LIMIT 1`,
        [evento_id]
      );
      if (!eventoR.rows.length) {
        return res.status(404).json({ message: "Evento no encontrado" });
      }
      const autorizado = await validarAccesoCampeonatoOrganizador(
        req,
        res,
        eventoR.rows[0]?.campeonato_id,
        "No autorizado para quitar equipos de esta categoría."
      );
      if (!autorizado) return;

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
