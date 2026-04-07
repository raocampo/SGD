/**
 * sportsConfig.js — Configuración centralizada por deporte para SGD
 *
 * Principio: toda lógica sport-específica (umbrales de suspensión, cuartos,
 * tipos de infracción, posiciones) se lee desde aquí en lugar de estar
 * dispersa en modelos y controladores.
 *
 * Uso:
 *   const { getSportConfig, isFutbol } = require('./sportsConfig');
 *   const cfg = getSportConfig(campeonato.tipo_deporte);
 */

"use strict";

// ──────────────────────────────────────────────────────────────────────────────
// Configuraciones base
// ──────────────────────────────────────────────────────────────────────────────

const CONFIGS = {
  // ── Básquetbol ────────────────────────────────────────────────────────────
  basquetbol: {
    nombre: "Básquetbol",
    familia: "basquetbol",
    posiciones: ["Base", "Escolta", "Alero", "Ala-Pívot", "Pívot"],
    jugadoresEnCancha: 5,
    tiempos: 4,
    minutosPorTiempo: 10,
    labelTiempo: "cuarto",
    labelTiempos: "cuartos",
    tiposTiempo: ["1er", "2do", "3er", "4to"],
    labelMarcador: "puntos",
    labelGoleador: "Anotador",
    walkovorLocal: 20,
    walkovorVisitante: 0,
    tienePenales: false,
    tieneOvertime: true,
    tieneArbitrosLinea: false,
    cambiosIlimitados: true,
    tiposPunto: [
      { valor: "2pt_campo",  etiqueta: "Canasta (2 pts)", puntos: 2 },
      { valor: "3pt_triple", etiqueta: "Triple (3 pts)",  puntos: 3 },
      { valor: "1pt_libre",  etiqueta: "Tiro libre",      puntos: 1 },
    ],
    tiposInfraccion: [
      { valor: "personal",      etiqueta: "Falta personal",      esGrave: false },
      { valor: "tecnica",       etiqueta: "Falta técnica",       esGrave: true  },
      { valor: "antideportiva", etiqueta: "Antideportiva",       esGrave: true  },
      { valor: "flagrante",     etiqueta: "Flagrante",           esGrave: true  },
    ],
    suspensiones: {
      // expulsión en el propio partido (no genera suspensión para partidos futuros por defecto)
      maxFaltasPersonalesPorPartido: 6,
      maxFaltasTecnicasPorPartido: 2,
      // acumulación entre partidos: null = no aplica (configurar por reglamento local)
      umbralInfraccionesLeves: null,
      umbralInfraccionesGraves: null,
    },
    labelCostoInfraccionLeve: "Costo falta técnica",
    labelCostoInfraccionGrave: "Costo expulsión",
  },

  // ── Fútbol 11 ─────────────────────────────────────────────────────────────
  futbol_11: {
    nombre: "Fútbol 11",
    familia: "futbol",
    posiciones: ["Arquero", "Defensa", "Lateral Derecho", "Lateral Izquierdo", "Mediocampista", "Delantero"],
    jugadoresEnCancha: 11,
    tiempos: 2,
    minutosPorTiempo: 45,
    labelTiempo: "tiempo",
    labelTiempos: "tiempos",
    tiposTiempo: ["1er", "2do"],
    labelMarcador: "goles",
    labelGoleador: "Goleador",
    walkovorLocal: 3,
    walkovorVisitante: 0,
    tienePenales: true,
    tieneOvertime: true,
    tieneArbitrosLinea: true,
    cambiosIlimitados: false,
    tiposPunto: [
      { valor: "campo",  etiqueta: "Gol de juego",  puntos: 1 },
      { valor: "penal",  etiqueta: "Penal",          puntos: 1 },
      { valor: "libre",  etiqueta: "Tiro libre",     puntos: 1 },
      { valor: "propio", etiqueta: "Gol en contra",  puntos: 1 },
    ],
    tiposInfraccion: [
      { valor: "amarilla", etiqueta: "Tarjeta amarilla", esGrave: false },
      { valor: "roja",     etiqueta: "Tarjeta roja",     esGrave: true  },
    ],
    suspensiones: {
      maxFaltasPersonalesPorPartido: null,
      maxFaltasTecnicasPorPartido: null,
      umbralInfraccionesLeves: 4,    // 4 amarillas = 1 partido suspendido
      umbralInfraccionesGraves: 1,   // 1 roja = 1 partido suspendido (mínimo)
    },
    labelCostoInfraccionLeve: "Costo tarjeta amarilla",
    labelCostoInfraccionGrave: "Costo tarjeta roja",
  },

  // ── Fútbol 9 ──────────────────────────────────────────────────────────────
  futbol_9: {
    nombre: "Fútbol 9",
    familia: "futbol",
    posiciones: ["Arquero", "Defensa", "Mediocampista", "Delantero"],
    jugadoresEnCancha: 9,
    tiempos: 2,
    minutosPorTiempo: 40,
    labelTiempo: "tiempo",
    labelTiempos: "tiempos",
    tiposTiempo: ["1er", "2do"],
    labelMarcador: "goles",
    labelGoleador: "Goleador",
    walkovorLocal: 3,
    walkovorVisitante: 0,
    tienePenales: true,
    tieneOvertime: true,
    tieneArbitrosLinea: false,
    cambiosIlimitados: false,
    tiposPunto: [
      { valor: "campo",  etiqueta: "Gol de juego",  puntos: 1 },
      { valor: "penal",  etiqueta: "Penal",          puntos: 1 },
      { valor: "propio", etiqueta: "Gol en contra",  puntos: 1 },
    ],
    tiposInfraccion: [
      { valor: "amarilla", etiqueta: "Tarjeta amarilla", esGrave: false },
      { valor: "roja",     etiqueta: "Tarjeta roja",     esGrave: true  },
    ],
    suspensiones: {
      maxFaltasPersonalesPorPartido: null,
      maxFaltasTecnicasPorPartido: null,
      umbralInfraccionesLeves: 0,    // retrocompat: solo futbol_11 tenía acumulación de amarillas
      umbralInfraccionesGraves: 1,
    },
    labelCostoInfraccionLeve: "Costo tarjeta amarilla",
    labelCostoInfraccionGrave: "Costo tarjeta roja",
  },

  // ── Fútbol 8 ──────────────────────────────────────────────────────────────
  futbol_8: {
    nombre: "Fútbol 8",
    familia: "futbol",
    posiciones: ["Arquero", "Defensa", "Mediocampista", "Delantero"],
    jugadoresEnCancha: 8,
    tiempos: 2,
    minutosPorTiempo: 35,
    labelTiempo: "tiempo",
    labelTiempos: "tiempos",
    tiposTiempo: ["1er", "2do"],
    labelMarcador: "goles",
    labelGoleador: "Goleador",
    walkovorLocal: 3,
    walkovorVisitante: 0,
    tienePenales: true,
    tieneOvertime: true,
    tieneArbitrosLinea: false,
    cambiosIlimitados: false,
    tiposPunto: [
      { valor: "campo",  etiqueta: "Gol de juego",  puntos: 1 },
      { valor: "penal",  etiqueta: "Penal",          puntos: 1 },
      { valor: "propio", etiqueta: "Gol en contra",  puntos: 1 },
    ],
    tiposInfraccion: [
      { valor: "amarilla", etiqueta: "Tarjeta amarilla", esGrave: false },
      { valor: "roja",     etiqueta: "Tarjeta roja",     esGrave: true  },
    ],
    suspensiones: {
      maxFaltasPersonalesPorPartido: null,
      maxFaltasTecnicasPorPartido: null,
      umbralInfraccionesLeves: 0,
      umbralInfraccionesGraves: 1,
    },
    labelCostoInfraccionLeve: "Costo tarjeta amarilla",
    labelCostoInfraccionGrave: "Costo tarjeta roja",
  },

  // ── Fútbol 7 ──────────────────────────────────────────────────────────────
  futbol_7: {
    nombre: "Fútbol 7",
    familia: "futbol",
    posiciones: ["Arquero", "Defensa", "Mediocampista", "Delantero"],
    jugadoresEnCancha: 7,
    tiempos: 2,
    minutosPorTiempo: 35,
    labelTiempo: "tiempo",
    labelTiempos: "tiempos",
    tiposTiempo: ["1er", "2do"],
    labelMarcador: "goles",
    labelGoleador: "Goleador",
    walkovorLocal: 3,
    walkovorVisitante: 0,
    tienePenales: false,
    tieneOvertime: false,
    tieneArbitrosLinea: false,
    cambiosIlimitados: false,
    tiposPunto: [
      { valor: "campo",  etiqueta: "Gol de juego",  puntos: 1 },
      { valor: "propio", etiqueta: "Gol en contra",  puntos: 1 },
    ],
    tiposInfraccion: [
      { valor: "amarilla", etiqueta: "Tarjeta amarilla", esGrave: false },
      { valor: "roja",     etiqueta: "Tarjeta roja",     esGrave: true  },
    ],
    suspensiones: {
      maxFaltasPersonalesPorPartido: null,
      maxFaltasTecnicasPorPartido: null,
      umbralInfraccionesLeves: 0,
      umbralInfraccionesGraves: 1,
    },
    labelCostoInfraccionLeve: "Costo tarjeta amarilla",
    labelCostoInfraccionGrave: "Costo tarjeta roja",
  },

  // ── Fútbol 6 ──────────────────────────────────────────────────────────────
  futbol_6: {
    nombre: "Fútbol 6",
    familia: "futbol",
    posiciones: ["Arquero", "Defensa", "Mediocampista", "Delantero"],
    jugadoresEnCancha: 6,
    tiempos: 2,
    minutosPorTiempo: 30,
    labelTiempo: "tiempo",
    labelTiempos: "tiempos",
    tiposTiempo: ["1er", "2do"],
    labelMarcador: "goles",
    labelGoleador: "Goleador",
    walkovorLocal: 3,
    walkovorVisitante: 0,
    tienePenales: false,
    tieneOvertime: false,
    tieneArbitrosLinea: false,
    cambiosIlimitados: true,
    tiposPunto: [
      { valor: "campo",  etiqueta: "Gol de juego",  puntos: 1 },
      { valor: "propio", etiqueta: "Gol en contra",  puntos: 1 },
    ],
    tiposInfraccion: [
      { valor: "amarilla", etiqueta: "Tarjeta amarilla", esGrave: false },
      { valor: "roja",     etiqueta: "Tarjeta roja",     esGrave: true  },
    ],
    suspensiones: {
      maxFaltasPersonalesPorPartido: null,
      maxFaltasTecnicasPorPartido: null,
      umbralInfraccionesLeves: 0,
      umbralInfraccionesGraves: 1,
    },
    labelCostoInfraccionLeve: "Costo tarjeta amarilla",
    labelCostoInfraccionGrave: "Costo tarjeta roja",
  },

  // ── Fútbol 5 / Futsal / Futsala ───────────────────────────────────────────
  futbol_5: {
    nombre: "Fútbol 5",
    familia: "futbol",
    posiciones: ["Portero", "Cierre", "Ala", "Pívot"],
    jugadoresEnCancha: 5,
    tiempos: 2,
    minutosPorTiempo: 20,
    labelTiempo: "tiempo",
    labelTiempos: "tiempos",
    tiposTiempo: ["1er", "2do"],
    labelMarcador: "goles",
    labelGoleador: "Goleador",
    walkovorLocal: 3,
    walkovorVisitante: 0,
    tienePenales: false,
    tieneOvertime: false,
    tieneArbitrosLinea: false,
    cambiosIlimitados: true,
    tiposPunto: [
      { valor: "campo",  etiqueta: "Gol de juego",  puntos: 1 },
      { valor: "propio", etiqueta: "Gol en contra",  puntos: 1 },
    ],
    tiposInfraccion: [
      { valor: "amarilla", etiqueta: "Tarjeta amarilla", esGrave: false },
      { valor: "roja",     etiqueta: "Tarjeta roja",     esGrave: true  },
    ],
    suspensiones: {
      maxFaltasPersonalesPorPartido: null,
      maxFaltasTecnicasPorPartido: null,
      umbralInfraccionesLeves: 0,    // sin acumulación entre partidos en futsala típico
      umbralInfraccionesGraves: 1,
    },
    labelCostoInfraccionLeve: "Costo tarjeta amarilla",
    labelCostoInfraccionGrave: "Costo tarjeta roja",
  },

  // ── Fútbol Sala / Indor ───────────────────────────────────────────────────
  futsala: {
    nombre: "Fútbol Sala",
    familia: "futbol",
    posiciones: ["Portero", "Cierre", "Ala", "Pívot"],
    jugadoresEnCancha: 5,
    tiempos: 2,
    minutosPorTiempo: 20,
    labelTiempo: "tiempo",
    labelTiempos: "tiempos",
    tiposTiempo: ["1er", "2do"],
    labelMarcador: "goles",
    labelGoleador: "Goleador",
    walkovorLocal: 3,
    walkovorVisitante: 0,
    tienePenales: false,
    tieneOvertime: false,
    tieneArbitrosLinea: false,
    cambiosIlimitados: true,
    tiposPunto: [
      { valor: "campo",  etiqueta: "Gol de juego",  puntos: 1 },
      { valor: "propio", etiqueta: "Gol en contra",  puntos: 1 },
    ],
    tiposInfraccion: [
      { valor: "amarilla", etiqueta: "Tarjeta amarilla", esGrave: false },
      { valor: "roja",     etiqueta: "Tarjeta roja",     esGrave: true  },
    ],
    suspensiones: {
      maxFaltasPersonalesPorPartido: null,
      maxFaltasTecnicasPorPartido: null,
      umbralInfraccionesLeves: 0,
      umbralInfraccionesGraves: 1,
    },
    labelCostoInfraccionLeve: "Costo tarjeta amarilla",
    labelCostoInfraccionGrave: "Costo tarjeta roja",
  },

  indor: {
    nombre: "Indor",
    familia: "futbol",
    posiciones: ["Portero", "Defensa", "Mediocampista", "Delantero"],
    jugadoresEnCancha: 6,
    tiempos: 2,
    minutosPorTiempo: 25,
    labelTiempo: "tiempo",
    labelTiempos: "tiempos",
    tiposTiempo: ["1er", "2do"],
    labelMarcador: "goles",
    labelGoleador: "Goleador",
    walkovorLocal: 3,
    walkovorVisitante: 0,
    tienePenales: false,
    tieneOvertime: false,
    tieneArbitrosLinea: false,
    cambiosIlimitados: true,
    tiposPunto: [
      { valor: "campo",  etiqueta: "Gol de juego",  puntos: 1 },
      { valor: "propio", etiqueta: "Gol en contra",  puntos: 1 },
    ],
    tiposInfraccion: [
      { valor: "amarilla", etiqueta: "Tarjeta amarilla", esGrave: false },
      { valor: "roja",     etiqueta: "Tarjeta roja",     esGrave: true  },
    ],
    suspensiones: {
      maxFaltasPersonalesPorPartido: null,
      maxFaltasTecnicasPorPartido: null,
      umbralInfraccionesLeves: 0,
      umbralInfraccionesGraves: 1,
    },
    labelCostoInfraccionLeve: "Costo tarjeta amarilla",
    labelCostoInfraccionGrave: "Costo tarjeta roja",
  },
};

// Alias para retrocompatibilidad con valores de tipo_futbol que existan en BD
const ALIASES = {
  futbol_sala: "futsala",
  futsal:      "futsala",
  futbol_indor: "indor",
  basquetball: "basquetbol",
  basketball:  "basquetbol",
};

// Config por defecto si el deporte no se reconoce (asume fútbol genérico)
const DEFAULT_CONFIG = { ...CONFIGS.futbol_11, nombre: "Deporte" };

// ──────────────────────────────────────────────────────────────────────────────
// API pública
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Retorna la configuración del deporte. Nunca lanza — usa DEFAULT_CONFIG como fallback.
 * @param {string} tipoDeporte — valor de campeonato.tipo_deporte o tipo_futbol
 */
function getSportConfig(tipoDeporte) {
  const clave = String(tipoDeporte || "").trim().toLowerCase();
  const resolved = ALIASES[clave] || clave;
  return CONFIGS[resolved] || DEFAULT_CONFIG;
}

/**
 * true si el deporte es de la familia fútbol
 */
function isFutbol(tipoDeporte) {
  return getSportConfig(tipoDeporte).familia === "futbol";
}

/**
 * true si el deporte es baloncesto
 */
function isBasquetbol(tipoDeporte) {
  return getSportConfig(tipoDeporte).familia === "basquetbol";
}

/**
 * Retorna el umbral de amarillas para suspensión según el deporte.
 * Mantiene compatibilidad con la firma anterior usada en Partido.js.
 */
function obtenerUmbralAmarillasSuspension(tipoDeporte) {
  const cfg = getSportConfig(tipoDeporte);
  return cfg.suspensiones?.umbralInfraccionesLeves ?? 0;
}

/**
 * Lista de todos los tipos de deporte registrados con nombre legible.
 * Útil para selects en frontend.
 */
function listarDeportes() {
  return Object.entries(CONFIGS).map(([valor, cfg]) => ({
    valor,
    nombre: cfg.nombre,
    familia: cfg.familia,
  }));
}

module.exports = {
  CONFIGS,
  getSportConfig,
  isFutbol,
  isBasquetbol,
  obtenerUmbralAmarillasSuspension,
  listarDeportes,
};
