"use strict";

const pool = require("../config/database");
const TransmisionOverlay = require("../models/TransmisionOverlay");
const { emitOverlayState } = require("../services/socketService");

/**
 * GET /api/transmisiones/:id/overlay
 * Obtener estado actual del overlay (requiere auth como director).
 */
async function getOverlay(req, res) {
  try {
    const transmisionId = parseInt(req.params.id, 10);
    if (!transmisionId) return res.status(400).json({ error: "ID inválido" });

    const state = await TransmisionOverlay.obtenerOCrear(transmisionId);
    res.json(state);
  } catch (err) {
    console.error("overlayController.getOverlay:", err);
    res.status(500).json({ error: "Error obteniendo overlay" });
  }
}

/**
 * PUT /api/transmisiones/:id/overlay
 * Actualizar estado del overlay y hacer broadcast por Socket.io.
 */
async function putOverlay(req, res) {
  try {
    const transmisionId = parseInt(req.params.id, 10);
    if (!transmisionId) return res.status(400).json({ error: "ID inválido" });

    const state = await TransmisionOverlay.actualizar(transmisionId, req.body);
    emitOverlayState(transmisionId, state);
    res.json(state);
  } catch (err) {
    console.error("overlayController.putOverlay:", err);
    res.status(500).json({ error: "Error actualizando overlay" });
  }
}

/**
 * POST /api/transmisiones/:id/overlay/reset
 * Resetear marcador a cero.
 */
async function resetOverlay(req, res) {
  try {
    const transmisionId = parseInt(req.params.id, 10);
    if (!transmisionId) return res.status(400).json({ error: "ID inválido" });

    const state = await TransmisionOverlay.reset(transmisionId);
    emitOverlayState(transmisionId, state);
    res.json(state);
  } catch (err) {
    console.error("overlayController.resetOverlay:", err);
    res.status(500).json({ error: "Error reseteando overlay" });
  }
}

/**
 * GET /api/public/overlay/:overlay_token
 * Estado público por token (sin autenticación) — usado por overlay.html en OBS.
 */
async function getOverlayPublico(req, res) {
  try {
    const { overlay_token } = req.params;
    if (!overlay_token) return res.status(400).json({ error: "Token requerido" });

    // Buscar transmisión por token
    const txResult = await pool.query(
      `SELECT t.id, t.overlay_token, t.titulo,
              p.equipo_local_id, p.equipo_visitante_id,
              el.nombre AS equipo_local_nombre, el.logo_url AS equipo_local_logo,
              ev2.nombre AS equipo_visitante_nombre, ev2.logo_url AS equipo_visitante_logo
       FROM partido_transmisiones t
       LEFT JOIN partidos p ON p.id = t.partido_id
       LEFT JOIN equipos el ON el.id = p.equipo_local_id
       LEFT JOIN equipos ev2 ON ev2.id = p.equipo_visitante_id
       WHERE t.overlay_token = $1`,
      [overlay_token]
    );

    if (!txResult.rows.length) {
      return res.status(404).json({ error: "Transmisión no encontrada" });
    }

    const tx = txResult.rows[0];
    const state = await TransmisionOverlay.obtenerOCrear(tx.id);

    res.json({
      transmision_id: tx.id,
      titulo: tx.titulo,
      equipo_local: {
        nombre: tx.equipo_local_nombre,
        logo_url: tx.equipo_local_logo,
      },
      equipo_visitante: {
        nombre: tx.equipo_visitante_nombre,
        logo_url: tx.equipo_visitante_logo,
      },
      overlay: state,
    });
  } catch (err) {
    console.error("overlayController.getOverlayPublico:", err);
    res.status(500).json({ error: "Error obteniendo overlay público" });
  }
}

module.exports = { getOverlay, putOverlay, resetOverlay, getOverlayPublico };
