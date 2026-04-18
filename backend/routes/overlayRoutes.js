"use strict";

const express = require("express");
const router = express.Router({ mergeParams: true });
const overlay = require("../controllers/overlayController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

// GET  /api/transmisiones/:id/overlay
router.get("/", requireAuth, requireRoles("administrador", "organizador", "operador"), overlay.getOverlay);

// PUT  /api/transmisiones/:id/overlay
router.put("/", requireAuth, requireRoles("administrador", "organizador", "operador"), overlay.putOverlay);

// POST /api/transmisiones/:id/overlay/reset
router.post("/reset", requireAuth, requireRoles("administrador", "organizador", "operador"), overlay.resetOverlay);

module.exports = router;
