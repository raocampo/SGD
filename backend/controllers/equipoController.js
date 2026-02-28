//controller/equipo.Controller.js
const Equipo = require("../models/Equipo");
const path = require("path");
const fs = require("fs");
const pool = require("../config/database");
const {
  obtenerEquiposPermitidosTecnico,
  tecnicoPuedeAccederEquipo,
} = require("../services/roleScope");
const {
  isOrganizador,
  obtenerCampeonatoIdsOrganizador,
  organizadorPuedeAccederCampeonato,
} = require("../services/organizadorScope");

async function filtrarEquiposParaTecnico(req, equipos = []) {
  const permitidos = await obtenerEquiposPermitidosTecnico(req);
  if (permitidos === null) return equipos;
  const set = new Set(permitidos);
  return equipos.filter((e) => set.has(Number(e.id)));
}

async function filtrarEquiposPorOrganizador(req, equipos = []) {
  if (!isOrganizador(req?.user)) return equipos;
  const ids = await obtenerCampeonatoIdsOrganizador(req.user);
  const set = new Set(ids);
  return equipos.filter((e) => set.has(Number(e.campeonato_id)));
}

function normalizarNombreEquipo(valor) {
  return String(valor || "").trim().toLowerCase();
}

async function existeNombreEquipoEnEvento(eventoId, nombreEquipo, excluirEquipoId = null, client = pool) {
  const evento = Number.parseInt(eventoId, 10);
  const nombre = normalizarNombreEquipo(nombreEquipo);
  if (!Number.isFinite(evento) || evento <= 0 || !nombre) return false;

  const params = [evento, nombre];
  let query = `
    SELECT 1
    FROM evento_equipos ee
    JOIN equipos e ON e.id = ee.equipo_id
    WHERE ee.evento_id = $1
      AND LOWER(TRIM(e.nombre)) = $2
  `;
  if (Number.isFinite(Number(excluirEquipoId)) && Number(excluirEquipoId) > 0) {
    params.push(Number(excluirEquipoId));
    query += ` AND e.id <> $3`;
  }
  query += ` LIMIT 1`;

  const r = await client.query(query, params);
  return r.rows.length > 0;
}

const equipoController = {
  // CREAR - Nuevo equipo
  crearEquipo: async (req, res) => {
    try {
      const {
        campeonato_id,
        evento_id,
        nombre,
        director_tecnico,
        asistente_tecnico,
        medico,
        color_equipo,
        color_primario,
        color_secundario,
        color_terciario,
        telefono,
        email,
        cabeza_serie,
      } = req.body;

      // Validaciones básicas
      if (!campeonato_id || !nombre) {
        return res.status(400).json({
          error: "campeonato_id y nombre son obligatorios",
        });
      }
      if (!director_tecnico || !String(director_tecnico).trim()) {
        return res.status(400).json({
          error: "El nombre del técnico o dueño es obligatorio",
        });
      }
      if (isOrganizador(req.user)) {
        const puede = await organizadorPuedeAccederCampeonato(req.user, campeonato_id);
        if (!puede) {
          return res.status(403).json({ error: "No autorizado para crear equipo en ese campeonato" });
        }
      }

      const eventoIdNum =
        evento_id === undefined || evento_id === null || `${evento_id}`.trim() === ""
          ? null
          : Number.parseInt(evento_id, 10);
      if (eventoIdNum !== null) {
        if (!Number.isFinite(eventoIdNum) || eventoIdNum <= 0) {
          return res.status(400).json({ error: "evento_id inválido" });
        }

        const eventoR = await pool.query(
          `SELECT id, campeonato_id FROM eventos WHERE id = $1 LIMIT 1`,
          [eventoIdNum]
        );
        if (!eventoR.rows.length) {
          return res.status(400).json({ error: "La categoría seleccionada no existe" });
        }
        const evento = eventoR.rows[0];
        if (Number(evento.campeonato_id) !== Number(campeonato_id)) {
          return res.status(400).json({
            error: "La categoría seleccionada no pertenece al campeonato seleccionado",
          });
        }

        const nombreDuplicadoEvento = await existeNombreEquipoEnEvento(eventoIdNum, nombre, null, pool);
        if (nombreDuplicadoEvento) {
          return res.status(400).json({
            error: "Ya existe un equipo con ese nombre en la categoría seleccionada",
          });
        }
      }

      const logo_url = req.file
        ? `/uploads/equipos/${req.file.filename}`
        : null;

      const nuevoEquipo = await Equipo.crear(
        campeonato_id,
        nombre,
        director_tecnico?.trim(),
        asistente_tecnico?.trim() || null,
        medico?.trim() || null,
        color_equipo || null,
        color_primario || null,
        color_secundario || null,
        color_terciario || null,
        telefono || null,
        email?.trim() || null,
        logo_url,
        cabeza_serie
      );

      if (eventoIdNum && nuevoEquipo?.id) {
        await pool.query(
          `
            INSERT INTO evento_equipos (evento_id, equipo_id)
            VALUES ($1, $2)
            ON CONFLICT (evento_id, equipo_id) DO NOTHING
          `,
          [eventoIdNum, nuevoEquipo.id]
        );
      }

      res.status(201).json({
        mensaje: eventoIdNum
          ? "⚽ Equipo creado y asignado a la categoría exitosamente"
          : "⚽ Equipo creado exitosamente",
        equipo: nuevoEquipo,
      });
    } catch (error) {
      console.error("Error creando equipo:", error);

      if (
        error.message.includes("Límite") ||
        error.message.includes("Campeonato no encontrado") ||
        error.message.includes("Ya existe un equipo con ese nombre") ||
        error.message.includes("obligatorio") ||
        error.message.includes("invalido")
      ) {
        return res.status(400).json({
          error: error.message,
        });
      }

      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  importarEquiposMasivo: async (req, res) => {
    try {
      const campeonato_id = Number.parseInt(req.body?.campeonato_id, 10);
      const evento_id_raw = req.body?.evento_id;
      const evento_id = evento_id_raw === undefined || evento_id_raw === null || `${evento_id_raw}`.trim() === ""
        ? null
        : Number.parseInt(evento_id_raw, 10);
      const filas = Array.isArray(req.body?.equipos) ? req.body.equipos : [];

      if (!Number.isFinite(campeonato_id) || campeonato_id <= 0) {
        return res.status(400).json({ error: "campeonato_id inválido" });
      }
      if (isOrganizador(req.user)) {
        const puede = await organizadorPuedeAccederCampeonato(req.user, campeonato_id);
        if (!puede) {
          return res.status(403).json({ error: "No autorizado para importar equipos en este campeonato" });
        }
      }
      if (!filas.length) {
        return res.status(400).json({ error: "No se recibieron equipos para importar" });
      }
      if (filas.length > 500) {
        return res.status(400).json({ error: "Máximo 500 filas por importación" });
      }

      let eventoDestino = null;
      if (Number.isFinite(evento_id) && evento_id > 0) {
        const rEvento = await pool.query(
          `SELECT id, campeonato_id FROM eventos WHERE id = $1 LIMIT 1`,
          [evento_id]
        );
        if (!rEvento.rows.length) {
          return res.status(400).json({ error: "La categoría destino no existe" });
        }
        eventoDestino = rEvento.rows[0];
        if (Number(eventoDestino.campeonato_id) !== Number(campeonato_id)) {
          return res.status(400).json({
            error: "La categoría destino no pertenece al campeonato seleccionado",
          });
        }
      }

      const creados = [];
      const errores = [];
      const nombresTomadosEnEventoLote = new Set();

      for (let i = 0; i < filas.length; i += 1) {
        const row = filas[i] || {};
        const nombre = String(row.nombre || "").trim();
        const director_tecnico = String(row.director_tecnico || "").trim();
        const asistente_tecnico = String(row.asistente_tecnico || "").trim();
        const medico = String(row.medico || "").trim();
        const telefono = String(row.telefono || "").trim();
        const email = String(row.email || "").trim();
        const color_primario = String(row.color_primario || "").trim();
        const color_secundario = String(row.color_secundario || "").trim();
        const color_terciario = String(row.color_terciario || "").trim();
        const color_equipo = color_primario || color_secundario || color_terciario || "";
        const logo_url = String(row.logo_url || "").trim();
        const cabezaRaw = String(row.cabeza_serie || "").trim().toLowerCase();
        const cabeza_serie = ["1", "true", "si", "sí", "x", "yes"].includes(cabezaRaw);

        if (!nombre || !director_tecnico) {
          errores.push({
            fila: i + 1,
            error: "nombre y director_tecnico son obligatorios",
          });
          continue;
        }

        if (eventoDestino?.id) {
          const nombreNorm = normalizarNombreEquipo(nombre);
          if (nombresTomadosEnEventoLote.has(nombreNorm)) {
            errores.push({
              fila: i + 1,
              nombre,
              error: "Nombre de equipo duplicado dentro del archivo para la misma categoría",
            });
            continue;
          }
          const existeEnEvento = await existeNombreEquipoEnEvento(eventoDestino.id, nombre, null, pool);
          if (existeEnEvento) {
            errores.push({
              fila: i + 1,
              nombre,
              error: "Ya existe un equipo con ese nombre en la categoría seleccionada",
            });
            continue;
          }
          nombresTomadosEnEventoLote.add(nombreNorm);
        }

        try {
          const equipo = await Equipo.crear(
            campeonato_id,
            nombre,
            director_tecnico,
            asistente_tecnico || null,
            medico || null,
            color_equipo || null,
            color_primario || null,
            color_secundario || null,
            color_terciario || null,
            telefono || null,
            email || null,
            logo_url || null,
            cabeza_serie
          );

          if (eventoDestino?.id && equipo?.id) {
            await pool.query(
              `
                INSERT INTO evento_equipos (evento_id, equipo_id)
                VALUES ($1, $2)
                ON CONFLICT (evento_id, equipo_id) DO NOTHING
              `,
              [eventoDestino.id, equipo.id]
            );
          }

          creados.push(equipo);
        } catch (errorFila) {
          errores.push({
            fila: i + 1,
            nombre,
            error: errorFila.message || "Error importando equipo",
          });
        }
      }

      return res.json({
        ok: true,
        campeonato_id,
        evento_id: eventoDestino?.id || null,
        total_filas: filas.length,
        total_creados: creados.length,
        total_errores: errores.length,
        creados,
        errores,
      });
    } catch (error) {
      console.error("Error importando equipos masivo:", error);
      return res.status(500).json({
        error: "Error en importación masiva de equipos",
        detalle: error.message,
      });
    }
  },

  // LEER - Obtener TODOS los equipos
  obtenerTodosLosEquipos: async (req, res) => {
    try {
      const equiposAll = await Equipo.obtenerTodos();
      const equiposTecnico = await filtrarEquiposParaTecnico(req, equiposAll);
      const equipos = await filtrarEquiposPorOrganizador(req, equiposTecnico);

      res.json({
        mensaje: "📋 Todos los equipos del sistema",
        total: equipos.length,
        equipos: equipos,
      });
    } catch (error) {
      console.error("Error obteniendo equipos:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // LEER - Obtener equipos por campeonato
  obtenerEquiposPorCampeonato: async (req, res) => {
    try {
      const { campeonato_id } = req.params;
      if (isOrganizador(req.user)) {
        const puede = await organizadorPuedeAccederCampeonato(req.user, campeonato_id);
        if (!puede) {
          return res.status(403).json({ error: "No autorizado para consultar ese campeonato" });
        }
      }

      const equiposAll = await Equipo.obtenerPorCampeonato(campeonato_id);
      const equiposTecnico = await filtrarEquiposParaTecnico(req, equiposAll);
      const equipos = await filtrarEquiposPorOrganizador(req, equiposTecnico);

      res.json({
        mensaje: `📋 Equipos del campeonato ${campeonato_id}`,
        total: equipos.length,
        equipos: equipos,
      });
    } catch (error) {
      console.error("Error obteniendo equipos:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // LEER - Obtener equipo específico
  obtenerEquipo: async (req, res) => {
    try {
      const { id } = req.params;
      const equipo = await Equipo.obtenerPorId(id);

      if (!equipo) {
        return res.status(404).json({
          error: "Equipo no encontrado",
        });
      }
      const permitido = await tecnicoPuedeAccederEquipo(req, id);
      if (!permitido) {
        return res.status(403).json({
          error: "No autorizado para consultar este equipo",
        });
      }
      if (isOrganizador(req.user)) {
        const puede = await organizadorPuedeAccederCampeonato(req.user, equipo.campeonato_id);
        if (!puede) {
          return res.status(403).json({ error: "No autorizado para consultar este equipo" });
        }
      }

      res.json({
        mensaje: "📖 Detalles del equipo",
        equipo: equipo,
      });
    } catch (error) {
      console.error("Error obteniendo equipo:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // ACTUALIZAR - Modificar equipo
  /*actualizarEquipo: async (req, res) => {
    try {
      const { id } = req.params;
      const datos = req.body;

      const equipoActualizado = await Equipo.actualizar(id, datos);

      if (!equipoActualizado) {
        return res.status(404).json({
          error: "Equipo no encontrado",
        });
      }

      res.json({
        mensaje: "✅ Equipo actualizado exitosamente",
        equipo: equipoActualizado,
      });
    } catch (error) {
      console.error("Error actualizando equipo:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },*/
  // ACTUALIZAR - Modificar equipo
  // controllers/equipoController.js
  /*actualizarEquipo: async (req, res) => {
    try {
      const { id } = req.params;

      // Si viene multipart/form-data, req.body existe pero todo es string
      const datos = req.body ? { ...req.body } : {};

      if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
      }

      // Normalizar boolean (viene "true"/"false" cuando es FormData)
      if (typeof datos.cabeza_serie === "string") {
        datos.cabeza_serie = datos.cabeza_serie === "true";
      }

      // Si subieron un logo nuevo, setear logo_url
      if (req.file) {
        datos.logo_url = `/uploads/equipos/${req.file.filename}`;

        // (Opcional pero recomendado) borrar logo anterior
        const equipoAntes = await Equipo.obtenerPorId(id);
        if (equipoAntes?.logo_url) {
          const path = require("path");
          const fs = require("fs");

          const filePath = path.join(
            __dirname,
            "..",
            equipoAntes.logo_url.replace(/^\//, "")
          );

          fs.unlink(filePath, (err) => {
            if (err)
              console.warn("No se pudo eliminar logo anterior:", err.message);
          });
        }
      }

      // ✅ si no mandó nada para actualizar
      if (!datos || Object.keys(datos).length === 0) {
        return res.status(400).json({ error: "No hay campos para actualizar" });
      }

      const equipoActualizado = await Equipo.actualizar(id, datos);

      if (!equipoActualizado) {
        return res.status(404).json({ error: "Equipo no encontrado" });
      }

      res.json({
        mensaje: "✅ Equipo actualizado exitosamente",
        equipo: equipoActualizado,
      });
    } catch (error) {
      console.error("Error actualizando equipo:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },*/
  actualizarEquipo: async (req, res) => {
    try {
      const { id } = req.params;
      const datos = req.body || {};
      const eventoIdRaw = datos.evento_id;
      if (Object.prototype.hasOwnProperty.call(datos, "evento_id")) {
        delete datos.evento_id;
      }
      const equipoActual = await Equipo.obtenerPorId(id);
      if (!equipoActual) {
        return res.status(404).json({ error: "Equipo no encontrado" });
      }
      if (isOrganizador(req.user)) {
        const campObjetivo = datos.campeonato_id || equipoActual.campeonato_id;
        const puede = await organizadorPuedeAccederCampeonato(req.user, campObjetivo);
        if (!puede) {
          return res.status(403).json({ error: "No autorizado para actualizar este equipo" });
        }
      }

      const eventoIdNum =
        eventoIdRaw === undefined || eventoIdRaw === null || `${eventoIdRaw}`.trim() === ""
          ? null
          : Number.parseInt(eventoIdRaw, 10);
      if (eventoIdNum !== null) {
        if (!Number.isFinite(eventoIdNum) || eventoIdNum <= 0) {
          return res.status(400).json({ error: "evento_id inválido" });
        }
        const eventoR = await pool.query(
          `SELECT id, campeonato_id FROM eventos WHERE id = $1 LIMIT 1`,
          [eventoIdNum]
        );
        if (!eventoR.rows.length) {
          return res.status(400).json({ error: "La categoría seleccionada no existe" });
        }
        const evento = eventoR.rows[0];
        const campObjetivo = Number(datos.campeonato_id || equipoActual.campeonato_id);
        if (Number(evento.campeonato_id) !== campObjetivo) {
          return res.status(400).json({
            error: "La categoría seleccionada no pertenece al campeonato seleccionado",
          });
        }
        const nombreObjetivo = String(datos.nombre || equipoActual.nombre || "").trim();
        if (nombreObjetivo) {
          const duplicadoEnCategoria = await existeNombreEquipoEnEvento(
            eventoIdNum,
            nombreObjetivo,
            id,
            pool
          );
          if (duplicadoEnCategoria) {
            return res.status(400).json({
              error: "Ya existe un equipo con ese nombre en la categoría seleccionada",
            });
          }
        }
      }

      // ✅ si subieron archivo, seteamos logo_url
      if (req.file) {
        datos.logo_url = `/uploads/equipos/${req.file.filename}`;
      }

      const equipoActualizado = await Equipo.actualizar(id, datos);

      if (!equipoActualizado) {
        return res.status(404).json({ error: "Equipo no encontrado" });
      }

      res.json({
        mensaje: "✅ Equipo actualizado exitosamente",
        equipo: equipoActualizado,
      });
    } catch (error) {
      console.error("Error actualizando equipo:", error);
      if (
        error.message?.includes("Ya existe un equipo con ese nombre") ||
        error.message?.includes("obligatorio") ||
        error.message?.includes("invalido") ||
        error.message?.includes("No hay campos")
      ) {
        return res.status(400).json({
          error: error.message,
        });
      }
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },
  // ELIMINAR - Borrar equipo
  /*eliminarEquipo: async (req, res) => {
    try {
      const { id } = req.params;
      const equipoEliminado = await Equipo.eliminar(id);

      if (!equipoEliminado) {
        return res.status(404).json({
          error: "Equipo no encontrado",
        });
      }

      res.json({
        mensaje: "🗑️ Equipo eliminado exitosamente",
        equipo: equipoEliminado,
      });
    } catch (error) {
      console.error("Error eliminando equipo:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },*/
  eliminarEquipo: async (req, res) => {
    try {
      const { id } = req.params;
      const equipoActual = await Equipo.obtenerPorId(id);
      if (!equipoActual) {
        return res.status(404).json({
          error: "Equipo no encontrado",
        });
      }
      if (isOrganizador(req.user)) {
        const puede = await organizadorPuedeAccederCampeonato(req.user, equipoActual.campeonato_id);
        if (!puede) {
          return res.status(403).json({ error: "No autorizado para eliminar este equipo" });
        }
      }
      const equipoEliminado = await Equipo.eliminar(id);

      if (!equipoEliminado) {
        return res.status(404).json({
          error: "Equipo no encontrado",
        });
      }

      // 👉 Si tenía logo, intentamos borrarlo del disco
      if (equipoEliminado.logo_url) {
        const filePath = path.join(
          __dirname,
          "..",
          equipoEliminado.logo_url.replace(/^\//, "") // quitar "/" inicial
        );

        fs.unlink(filePath, (err) => {
          if (err) {
            console.warn(
              "No se pudo eliminar el logo del equipo:",
              err.message
            );
          }
        });
      }

      res.json({
        mensaje: "🗑️ Equipo eliminado exitosamente",
        equipo: equipoEliminado,
      });
    } catch (error) {
      console.error("Error eliminando equipo:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // Designar/Remover cabeza de serie
  designarCabezaSerie: async (req, res) => {
    try {
      const { id } = req.params;
      const { cabeza_serie } = req.body;
      const equipoActual = await Equipo.obtenerPorId(id);
      if (!equipoActual) {
        return res.status(404).json({
          error: "Equipo no encontrado",
        });
      }
      if (isOrganizador(req.user)) {
        const puede = await organizadorPuedeAccederCampeonato(req.user, equipoActual.campeonato_id);
        if (!puede) {
          return res.status(403).json({ error: "No autorizado para modificar este equipo" });
        }
      }

      const equipoActualizado = await Equipo.designarCabezaSerie(
        id,
        cabeza_serie
      );

      if (!equipoActualizado) {
        return res.status(404).json({
          error: "Equipo no encontrado",
        });
      }

      const accion = cabeza_serie ? "designado" : "removido";
      res.json({
        mensaje: `👑 Equipo ${accion} como cabeza de serie exitosamente`,
        equipo: equipoActualizado,
      });
    } catch (error) {
      console.error("Error designando cabeza de serie:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },

  // Obtener cabezas de serie por campeonato
  obtenerCabezasDeSerie: async (req, res) => {
    try {
      const { campeonato_id } = req.params;
      if (isOrganizador(req.user)) {
        const puede = await organizadorPuedeAccederCampeonato(req.user, campeonato_id);
        if (!puede) {
          return res.status(403).json({ error: "No autorizado para consultar ese campeonato" });
        }
      }

      const cabezasAll = await Equipo.obtenerCabezasDeSerie(campeonato_id);
      const cabezasTecnico = await filtrarEquiposParaTecnico(req, cabezasAll);
      const cabezasDeSerie = await filtrarEquiposPorOrganizador(req, cabezasTecnico);

      res.json({
        mensaje: `👑 Cabezas de serie del campeonato`,
        total: cabezasDeSerie.length,
        cabezas_serie: cabezasDeSerie,
      });
    } catch (error) {
      console.error("Error obteniendo cabezas de serie:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        detalle: error.message,
      });
    }
  },
};

module.exports = equipoController;
