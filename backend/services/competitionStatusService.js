const pool = require("../config/database");

const MOTIVOS_ELIMINACION = [
  "indisciplina",
  "deudas",
  "sin_justificativo_segunda_no_presentacion",
];

function normalizarMotivoEliminacion(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const raw = String(value).trim().toLowerCase();
  const map = {
    indisciplina: "indisciplina",
    disciplina: "indisciplina",
    deudas: "deudas",
    deuda: "deudas",
    mora: "deudas",
    morosidad: "deudas",
    sin_justificativo_segunda_no_presentacion:
      "sin_justificativo_segunda_no_presentacion",
    sin_justificativo: "sin_justificativo_segunda_no_presentacion",
    segunda_no_presentacion: "sin_justificativo_segunda_no_presentacion",
    no_presentacion_sin_justificativo:
      "sin_justificativo_segunda_no_presentacion",
  };
  return map[raw] || null;
}

function formatearMotivoEliminacion(value) {
  const motivo = normalizarMotivoEliminacion(value, null);
  if (motivo === "indisciplina") return "Indisciplina";
  if (motivo === "deudas") return "No paga cuentas";
  if (motivo === "sin_justificativo_segunda_no_presentacion") {
    return "2da no presentación sin justificativo";
  }
  return "Sin motivo";
}

function estaEliminadoCompetencia(row = {}) {
  return row?.eliminado_automatico === true || row?.eliminado_manual === true;
}

function construirClaveManual(grupoId, slotPosicion) {
  const g = Number.parseInt(grupoId, 10);
  const s = Number.parseInt(slotPosicion, 10);
  return `${Number.isFinite(g) ? g : 0}:${Number.isFinite(s) ? s : 0}`;
}

async function asegurarEsquemaEstadoCompeticion(db = pool) {
  await db.query(`
    ALTER TABLE evento_equipos
    ADD COLUMN IF NOT EXISTS no_presentaciones INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS eliminado_automatico BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS eliminado_manual BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS motivo_eliminacion VARCHAR(80),
    ADD COLUMN IF NOT EXISTS detalle_eliminacion TEXT,
    ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMP,
    ADD COLUMN IF NOT EXISTS eliminado_por_usuario_id INTEGER
  `);

  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_evento_equipos_eliminado_por_usuario'
      ) THEN
        ALTER TABLE evento_equipos
        ADD CONSTRAINT fk_evento_equipos_eliminado_por_usuario
        FOREIGN KEY (eliminado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS evento_clasificados_manuales (
      id SERIAL PRIMARY KEY,
      evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
      grupo_id INTEGER NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
      slot_posicion INTEGER NOT NULL,
      equipo_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
      criterio VARCHAR(120) NOT NULL DEFAULT 'decision_organizador',
      detalle TEXT,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_evento_clasificados_manuales_slot
    ON evento_clasificados_manuales(evento_id, grupo_id, slot_posicion)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_evento_clasificados_manuales_equipo
    ON evento_clasificados_manuales(evento_id, grupo_id, equipo_id)
  `);

  await db.query(`
    UPDATE evento_equipos
    SET eliminado_manual = FALSE,
        motivo_eliminacion = NULL,
        detalle_eliminacion = NULL,
        eliminado_en = NULL,
        eliminado_por_usuario_id = NULL
    WHERE eliminado_manual = FALSE
      AND (
        motivo_eliminacion IS NOT NULL
        OR detalle_eliminacion IS NOT NULL
        OR eliminado_en IS NOT NULL
        OR eliminado_por_usuario_id IS NOT NULL
      )
  `);
}

async function obtenerEstadosEquiposEvento(eventoId, db = pool) {
  await asegurarEsquemaEstadoCompeticion(db);
  const r = await db.query(
    `
      SELECT
        equipo_id,
        COALESCE(no_presentaciones, 0)::int AS no_presentaciones,
        COALESCE(eliminado_automatico, FALSE) AS eliminado_automatico,
        COALESCE(eliminado_manual, FALSE) AS eliminado_manual,
        motivo_eliminacion,
        detalle_eliminacion,
        eliminado_en,
        eliminado_por_usuario_id
      FROM evento_equipos
      WHERE evento_id = $1
    `,
    [eventoId]
  );

  return new Map(
    r.rows.map((row) => [
      Number(row.equipo_id),
      {
        no_presentaciones: Number(row.no_presentaciones || 0),
        eliminado_automatico: row.eliminado_automatico === true,
        eliminado_manual: row.eliminado_manual === true,
        motivo_eliminacion: row.motivo_eliminacion || null,
        motivo_eliminacion_label: row.motivo_eliminacion
          ? formatearMotivoEliminacion(row.motivo_eliminacion)
          : null,
        detalle_eliminacion: row.detalle_eliminacion || null,
        eliminado_en: row.eliminado_en || null,
        eliminado_por_usuario_id: Number(row.eliminado_por_usuario_id || 0) || null,
      },
    ])
  );
}

async function obtenerClasificadosManualesEvento(eventoId, db = pool) {
  await asegurarEsquemaEstadoCompeticion(db);
  const r = await db.query(
    `
      SELECT
        cm.id,
        cm.evento_id,
        cm.grupo_id,
        cm.slot_posicion,
        cm.equipo_id,
        cm.criterio,
        cm.detalle,
        cm.usuario_id,
        cm.created_at,
        cm.updated_at,
        e.nombre AS equipo_nombre,
        e.logo_url AS equipo_logo_url,
        g.letra_grupo
      FROM evento_clasificados_manuales cm
      JOIN equipos e ON e.id = cm.equipo_id
      JOIN grupos g ON g.id = cm.grupo_id
      WHERE cm.evento_id = $1
      ORDER BY g.letra_grupo, cm.slot_posicion
    `,
    [eventoId]
  );

  return r.rows.map((row) => ({
    id: Number(row.id),
    evento_id: Number(row.evento_id),
    grupo_id: Number(row.grupo_id),
    slot_posicion: Number(row.slot_posicion),
    equipo_id: Number(row.equipo_id),
    equipo_nombre: row.equipo_nombre || "",
    equipo_logo_url: row.equipo_logo_url || null,
    grupo_letra: String(row.letra_grupo || "").toUpperCase(),
    criterio: row.criterio || "decision_organizador",
    detalle: row.detalle || null,
    usuario_id: Number(row.usuario_id || 0) || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  }));
}

module.exports = {
  MOTIVOS_ELIMINACION,
  normalizarMotivoEliminacion,
  formatearMotivoEliminacion,
  estaEliminadoCompetencia,
  construirClaveManual,
  asegurarEsquemaEstadoCompeticion,
  obtenerEstadosEquiposEvento,
  obtenerClasificadosManualesEvento,
};
