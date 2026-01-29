// frontend/js/sorteo.js - VERSIÓN COMPLETA Y FUNCIONAL
class RuletaSorteo {
  constructor() {
    this.campeonatoId = null;
    this.equiposPendientes = [];
    this.grupos = [];
    this.ruletaGirando = false;
    this.equipoSeleccionado = null;
    this.API_BASE = "http://localhost:5000/api";
    console.log("✅ RuletaSorteo inicializada");
  }

  async iniciarSorteo() {
    console.log("🎯 Iniciando sorteo desde la clase...");

    const campeonatoSelect = document.getElementById("select-campeonato");
    const cantidadGrupos = document.getElementById("cantidad-grupos").value;
    const tipoSorteo = document.getElementById("sistema-sorteo").value;

    console.log("Datos del formulario:", {
      campeonato: campeonatoSelect.value,
      cantidadGrupos: cantidadGrupos,
      tipoSorteo: tipoSorteo,
    });

    if (!campeonatoSelect.value) {
      this.mostrarNotificacion("❌ Selecciona un campeonato", "error");
      return;
    }

    if (!cantidadGrupos || cantidadGrupos < 2) {
      this.mostrarNotificacion(
        "❌ La cantidad de grupos debe ser al menos 2",
        "error"
      );
      return;
    }

    this.campeonatoId = campeonatoSelect.value;

    try {
      this.mostrarNotificacion("🔄 Inicializando sorteo...", "info");

      if (tipoSorteo === "automatico") {
        await this.ejecutarSorteoAutomatico("aleatorio", cantidadGrupos);
      } else if (tipoSorteo === "cabezas-serie") {
        await this.ejecutarSorteoAutomatico("cabeza-serie", cantidadGrupos);
      } else if (tipoSorteo === "manual") {
        await this.prepararSorteoManual(cantidadGrupos);
      } else {
        this.mostrarNotificacion("❌ Tipo de sorteo no válido", "error");
      }
    } catch (error) {
      console.error("❌ Error en iniciarSorteo:", error);
      this.mostrarNotificacion(
        "❌ Error iniciando el sorteo: " + error.message,
        "error"
      );
    }
  }

  async ejecutarSorteoAutomatico(tipoSorteo, cantidadGrupos) {
    const endpoint =
      tipoSorteo === "cabeza-serie"
        ? `${this.API_BASE}/sorteo/cabeza-serie`
        : `${this.API_BASE}/sorteo/aleatorio`;

    try {
      console.log(`🎲 Ejecutando sorteo ${tipoSorteo}...`);

      const rehacer = await this.confirmarRehacerSorteoSiYaHayGrupos();
      if (!rehacer) return;

      await this.limpiarGruposExistentes();

      this.mostrarNotificacion(`🎲 Realizando sorteo ${tipoSorteo}...`, "info");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campeonato_id: parseInt(this.campeonatoId),
          cantidad_grupos: parseInt(cantidadGrupos),
        }),
      });

      if (response.ok) {
        const resultado = await response.json();
        console.log("✅ Resultado del sorteo:", resultado);
        this.mostrarNotificacion("✅ " + resultado.mensaje, "success");

        // ESPERAR un momento para que el backend procese
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // MOSTRAR RESULTADOS
        await this.mostrarGruposResultantes();

        // OCULTAR COMPLETAMENTE LA INTERFAZ DE RULETA EN SORTEO AUTOMÁTICO
        this.ocultarInterfazRuletaCompleta();

        console.log("🎉 Sorteo automático completado exitosamente");

        /*window.location.href = `grupos.html?campeonato=${this.campeonatoId}`,;*/
        window.open(`gruposgen.html?campeonato=${this.campeonatoId}`, "_blank");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error en el sorteo automático");
      }
    } catch (error) {
      console.error("❌ Error en sorteo automático:", error);
      this.mostrarNotificacion(
        "❌ Error en el sorteo: " + error.message,
        "error"
      );
    }
  }

  async prepararSorteoManual(cantidadGrupos) {
    try {
      console.log("🎡 Preparando sorteo manual con ruleta...");

      const rehacer = await this.confirmarRehacerSorteoSiYaHayGrupos();
      if (!rehacer) return;

      await this.limpiarGruposExistentes();
      await this.crearGruposVacios(cantidadGrupos);

      // CARGAR LOS GRUPOS RECIÉN CREADOS
      await this.cargarGrupos();

      await this.cargarTodosEquiposComoPendientes();
      this.mostrarInterfazRuleta();

      this.mostrarNotificacion(
        "✅ Sorteo manual listo. Usa la ruleta para asignar equipos.",
        "success"
      );
    } catch (error) {
      console.error("Error preparando sorteo manual:", error);
      this.mostrarNotificacion("Error preparando el sorteo manual", "error");
    }
  }

  async crearGruposVacios(cantidadGrupos) {
    try {
      console.log(`🔄 Creando ${cantidadGrupos} grupos vacíos...`);

      const response = await fetch(`${this.API_BASE}/grupos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campeonato_id: parseInt(this.campeonatoId),
          cantidad_grupos: parseInt(cantidadGrupos),
        }),
      });

      if (response.ok) {
        const resultado = await response.json();
        console.log("✅ Grupos vacíos creados:", resultado);

        // ACTUALIZAR this.grupos CON LOS GRUPOS RECIÉN CREADOS
        if (resultado.grupos && Array.isArray(resultado.grupos)) {
          this.grupos = resultado.grupos;
          console.log(
            `✅ ${this.grupos.length} grupos asignados a this.grupos`
          );
        }

        this.mostrarNotificacion(
          `✅ ${cantidadGrupos} grupos creados para sorteo manual`,
          "success"
        );
      } else {
        // Fallback: usar sorteo aleatorio
        await this.crearGruposConSorteoAleatorio(cantidadGrupos);
      }
    } catch (error) {
      console.error("❌ Error creando grupos vacíos:", error);
      await this.crearGruposConSorteoAleatorio(cantidadGrupos);
    }
  }

  async crearGruposConSorteoAleatorio(cantidadGrupos) {
    try {
      console.log(
        `🔄 Creando ${cantidadGrupos} grupos mediante sorteo aleatorio...`
      );

      const response = await fetch(`${this.API_BASE}/sorteo/aleatorio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campeonato_id: parseInt(this.campeonatoId),
          cantidad_grupos: parseInt(cantidadGrupos),
        }),
      });

      if (response.ok) {
        const resultado = await response.json();
        console.log("✅ Grupos creados mediante sorteo:", resultado);

        // ACTUALIZAR this.grupos CON LOS GRUPOS RECIÉN CREADOS
        if (resultado.grupos && Array.isArray(resultado.grupos)) {
          this.grupos = resultado.grupos;
          console.log(
            `✅ ${this.grupos.length} grupos asignados a this.grupos`
          );
        }

        this.mostrarNotificacion(
          `✅ ${cantidadGrupos} grupos creados para sorteo manual`,
          "success"
        );
      } else {
        throw new Error("No se pudieron crear los grupos");
      }
    } catch (error) {
      console.error("❌ Error creando grupos:", error);
      throw error;
    }
  }

  async limpiarGruposExistentes() {
    try {
      console.log("🗑️ Verificando grupos existentes...");
      const response = await fetch(
        `${this.API_BASE}/grupos/campeonato/${this.campeonatoId}`
      );

      if (!response.ok) {
        console.log("✅ No hay grupos existentes");
        return 0;
      }

      const data = await response.json();
      console.log("📦 Respuesta completa de grupos:", data);

      let gruposArray = [];

      if (Array.isArray(data)) {
        gruposArray = data;
      } else if (data.grupos && Array.isArray(data.grupos)) {
        gruposArray = data.grupos;
      } else if (data.data && Array.isArray(data.data)) {
        gruposArray = data.data;
      } else {
        console.warn("⚠️ Formato de respuesta inesperado para grupos:", data);
        return 0;
      }

      console.log(`📋 Encontrados ${gruposArray.length} grupos existentes`);

      if (gruposArray.length === 0) {
        console.log("✅ No hay grupos para eliminar");
        return 0;
      }

      this.mostrarNotificacion(
        `🗑️ Eliminando ${gruposArray.length} grupos existentes...`,
        "info"
      );

      let eliminados = 0;
      /*for (const grupo of gruposArray)*/ for (
        let i = 0;
        i < gruposArray.length;
        i++
      ) {
        const grupo = gruposArray[i];
        try {
          const nombreGrupo = this.obtenerNombreGrupo(grupo, i);

          console.log(`❌ Eliminando grupo: ${nombreGrupo} (ID: ${grupo.id})`);

          const deleteResponse = await fetch(
            `${this.API_BASE}/grupos/${grupo.id}`,
            {
              method: "DELETE",
            }
          );

          if (deleteResponse.ok) {
            eliminados++;
            console.log(`✅ Grupo eliminado: ${nombreGrupo}`);
          } else {
            console.warn(`⚠️ No se pudo eliminar el grupo ${nombreGrupo}`);
          }
        } catch (error) {
          console.error(`❌ Error eliminando grupo:`, error);
        }
      }

      console.log(`🗑️ Total eliminados: ${eliminados} grupos`);
      this.mostrarNotificacion(`✅ ${eliminados} grupos eliminados`, "success");
      return eliminados;
    } catch (error) {
      console.error("❌ Error limpiando grupos:", error);
      this.mostrarNotificacion(
        "❌ Error eliminando grupos existentes",
        "error"
      );
      return 0;
    }
  }

  async confirmarRehacerSorteoSiYaHayGrupos() {
    try {
      const res = await fetch(
        `${this.API_BASE}/grupos/campeonato/${this.campeonatoId}/completo`
      );
      const data = await res.json();

      const grupos = data.grupos || [];
      if (grupos.length === 0) return true; // no hay grupos, sigue normal

      // Si ya hay grupos, preguntamos al usuario
      const ok = confirm(
        "⚠️ Este campeonato ya tiene grupos creados.\n\n" +
          "Si continúas, se eliminarán los grupos y asignaciones actuales y se hará un nuevo sorteo.\n\n" +
          "¿Deseas rehacer el sorteo?"
      );

      if (!ok) {
        this.mostrarNotificacion(
          "Se mantuvieron los grupos existentes. No se rehizo el sorteo.",
          "info"
        );

        // Importante: volver a mostrarlos si ya existen
        if (typeof this.mostrarGruposResultantes === "function") {
          await this.mostrarGruposResultantes();
        }
        return false;
      }

      return true;
    } catch (e) {
      console.error("Error verificando grupos existentes:", e);
      // Si falla la verificación, mejor no borrar nada sin confirmación
      this.mostrarNotificacion(
        "No se pudo verificar si ya existen grupos. No se realizará el sorteo por seguridad.",
        "error"
      );
      return false;
    }
  }

  obtenerNombreGrupo(grupo, index = 0) {
    // Generar nombres consistentes: Grupo A, Grupo B, etc.
    if (grupo.nombre) return grupo.nombre;
    if (grupo.letra) return `Grupo ${grupo.letra}`;

    // Si no hay nombre ni letra, generar basado en el índice
    const letras = ["A", "B", "C", "D", "E", "F", "G", "H"];

    // Buscar si ya existe un índice en el array de grupos
    /*if (this.grupos && this.grupos.length > 0) {
            const index = this.grupos.findIndex(g => g.id === grupo.id);
            if (index !== -1 && index < letras.length) {
                return `Grupo ${letras[index]}`;
            }
        }*/
    // Usar el índice proporcionado para nombres secuenciales A, B, C...
    //const letras = ["A", "B", "C", "D", "E", "F", "G", "H"];
    if (index !== undefined && index < letras.length) {
      return `Grupo ${letras[index]}`;
    }

    // Fallback: usar ID o posición
    //const index = grupo.id ? (grupo.id % letras.length) : 0;
    //return `Grupo ${letras[index]}`;
    return `Grupo ${letras[0]}`;
  }

  async cargarGrupos() {
    try {
      console.log("🔄 Cargando grupos desde el backend...");
      const response = await fetch(
        `${this.API_BASE}/grupos/campeonato/${this.campeonatoId}`
      );

      if (response.ok) {
        const data = await response.json();
        console.log("📦 Respuesta de grupos para cargar:", data);

        if (Array.isArray(data)) {
          this.grupos = data;
        } else if (data.grupos && Array.isArray(data.grupos)) {
          this.grupos = data.grupos;
        } else if (data.data && Array.isArray(data.data)) {
          this.grupos = data.data;
        } else {
          console.warn("⚠️ Formato inesperado en cargarGrupos:", data);
          this.grupos = [];
        }

        console.log(`✅ ${this.grupos.length} grupos cargados en this.grupos`);

        // Asignar nombres consistentes A, B, C... en ORDEN a los grupos
        const letras = ["A", "B", "C", "D", "E", "F", "G", "H"];
        this.grupos.forEach((grupo, index) => {
          grupo.nombre = `Grupo ${letras[index]}`;
        });
      } else {
        console.error("❌ Error cargando grupos:", response.status);
        this.grupos = [];
      }
    } catch (error) {
      console.error("❌ Error en cargarGrupos:", error);
      this.grupos = [];
    }
  }

  async cargarTodosEquiposComoPendientes() {
    try {
      console.log("🔄 Cargando todos los equipos para ruleta...");
      const response = await fetch(
        `${this.API_BASE}/equipos/campeonato/${this.campeonatoId}`
      );

      if (response.ok) {
        const data = await response.json();
        console.log("📦 Datos de equipos recibidos:", data);

        if (Array.isArray(data)) {
          this.equiposPendientes = data;
        } else if (data.equipos && Array.isArray(data.equipos)) {
          this.equiposPendientes = data.equipos;
        } else {
          this.equiposPendientes = [];
        }

        console.log(
          `✅ ${this.equiposPendientes.length} equipos cargados para ruleta`
        );
        this.actualizarListaEquiposPendientes();

        if (this.equiposPendientes.length > 0) {
          this.prepararRuletaCanvas();
        } else {
          this.mostrarNotificacion(
            "⚠️ No hay equipos para mostrar en la ruleta",
            "warning"
          );
        }
      }
    } catch (error) {
      console.error("Error cargando equipos para ruleta:", error);
      this.mostrarNotificacion(
        "Error cargando equipos para la ruleta",
        "error"
      );
    }
  }

  async cargarEstadoActual() {
    if (!this.campeonatoId) return;

    try {
      console.log(
        "🔎 Verificando si ya existen grupos para este campeonato..."
      );

      const res = await fetch(
        `${this.API_BASE}/grupos/campeonato/${this.campeonatoId}/completo`
      );

      if (!res.ok) {
        console.log("⚠️ No se pudo consultar grupos completos");
        // fallback: tratar como si no existieran
        await this.cargarTodosEquiposComoPendientes();
        this.mostrarInterfazRuleta(); // opcional
        return;
      }

      const data = await res.json();
      const grupos = data.grupos || [];

      // ✅ Si hay grupos existentes: mostrarlos y NO mostrar pendientes
      if (grupos.length > 0) {
        console.log(`✅ Ya existen ${grupos.length} grupos. Mostrando...`);

        // Guardar por si lo usas después
        this.grupos = grupos;

        // Mostrar panel de grupos
        await this.mostrarGruposResultantes();

        // Ocultar ruleta + pendientes
        this.ocultarInterfazRuletaCompleta();

        // (opcional) ocultar también contenedor de pendientes si lo tienes visible
        const pendientesBox = document.querySelector(".equipos-pendientes");
        if (pendientesBox) pendientesBox.style.display = "none";

        return; // importante
      }

      // ❌ No hay grupos -> modo sorteo (pendientes)
      console.log("ℹ️ No hay grupos aún. Mostrando equipos pendientes...");
      await this.cargarTodosEquiposComoPendientes();
    } catch (err) {
      console.error("❌ Error en cargarEstadoActual:", err);
      this.mostrarNotificacion("Error consultando grupos existentes", "error");
    }
  }

  actualizarListaEquiposPendientes() {
    const container = document.getElementById("lista-equipos-pendientes");
    if (!container) {
      console.error("❌ No se encontró el contenedor de equipos pendientes");
      return;
    }

    container.innerHTML = "";

    if (this.equiposPendientes.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle" style="color: #27ae60; font-size: 2rem;"></i>
                    <p>✅ Todos los equipos han sido asignados</p>
                </div>
            `;
      return;
    }

    this.equiposPendientes.forEach((equipo) => {
      const equipoElement = document.createElement("div");
      equipoElement.className = "equipo-card";
      equipoElement.innerHTML = `
                <div class="equipo-info">
                    <strong>${equipo.nombre}</strong>
                    <span class="equipo-estado">Pendiente</span>
                </div>
            `;
      container.appendChild(equipoElement);
    });

    const btnGirar = document.getElementById("btn-girar");
    if (btnGirar) btnGirar.disabled = this.equiposPendientes.length === 0;

    console.log(
      `📊 ${this.equiposPendientes.length} equipos pendientes mostrados`
    );
  }

  mostrarInterfazRuleta() {
    const ruletaContainer = document.querySelector(".ruleta-container"); // 👈 clave
    const ruletaArea = document.querySelector(".ruleta-area");
    const equiposPendientes = document.querySelector(".equipos-pendientes");
    const gruposPanel = document.querySelector(".grupos-panel");

    // 🔥 volver a mostrar el contenedor real de la ruleta
    if (ruletaContainer) ruletaContainer.style.display = "block";

    if (ruletaArea) ruletaArea.style.display = "flex";
    if (equiposPendientes) equiposPendientes.style.display = "block";

    // ocultar panel de grupos durante sorteo manual
    if (gruposPanel) gruposPanel.style.display = "none";

    // reset visual por si quedó rotada
    const canvas = document.getElementById("ruletaCanvas");
    if (canvas) canvas.style.transform = "rotate(0deg)";

    const btnGirar = document.getElementById("btn-girar");
    if (btnGirar) btnGirar.disabled = this.equiposPendientes.length === 0;

    this.actualizarSelectorGrupos();
    console.log("🎡 Ruleta mostrada (container + area)");
  }

  ocultarInterfazRuletaCompleta() {
    const ruletaContainer = document.querySelector(".ruleta-container");
    const equiposPendientes = document.querySelector(".equipos-pendientes");
    const gruposPanel = document.querySelector(".grupos-panel");

    if (ruletaContainer) ruletaContainer.style.display = "none";
    if (equiposPendientes) equiposPendientes.style.display = "none";

    // Asegurar grupos visibles en automático / al mostrar existentes
    if (gruposPanel) gruposPanel.style.display = "block";

    console.log("🎡 Ruleta oculta (container), grupos visibles");
  }

  ocultarInterfazRuleta() {
    // SOLO OCULTAR LA RULETA, NO LOS GRUPOS
    const ruletaContainer = document.querySelector(".ruleta-container");
    const equiposPendientes = document.querySelector(".equipos-pendientes");

    if (ruletaContainer) ruletaContainer.style.display = "none";
    if (equiposPendientes) equiposPendientes.style.display = "none";

    console.log("🎡 Ruleta ocultada, grupos permanecen visibles");
  }

  actualizarSelectorGrupos() {
    let grupoDestino = document.getElementById("grupo-destino");
    if (!grupoDestino) {
      const ruletaControls = document.querySelector(".ruleta-controls");
      if (ruletaControls) {
        const selectorHTML = `
                    <div class="form-group">
                        <label for="grupo-destino">Grupo destino:</label>
                        <select id="grupo-destino" class="form-select">
                            <option value="">Seleccionar grupo...</option>
                        </select>
                    </div>
                `;
        ruletaControls.insertAdjacentHTML("beforeend", selectorHTML);
        grupoDestino = document.getElementById("grupo-destino");
      }
    }

    if (!grupoDestino) {
      console.log("⚠️ No se pudo crear el selector de grupos destino");
      return;
    }

    grupoDestino.innerHTML = '<option value="">Seleccionar grupo...</option>';

    if (this.grupos.length === 0) {
      console.log("⚠️ No hay grupos para mostrar en el selector");
      return;
    }

    this.grupos.forEach((grupo, index) => {
      const option = document.createElement("option");
      option.value = grupo.id;
      option.textContent = this.obtenerNombreGrupo(grupo, index);
      grupoDestino.appendChild(option);
    });

    console.log(
      `✅ Selector de grupos actualizado con ${this.grupos.length} grupos`
    );
  }

  prepararRuletaCanvas() {
    const canvas = document.getElementById("ruletaCanvas");
    if (!canvas) {
      console.error("❌ No se encontró el canvas de la ruleta");
      return;
    }

    const ctx = canvas.getContext("2d");
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 200;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.equiposPendientes.length === 0) {
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#666";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("No hay equipos", centerX, centerY);
      return;
    }

    const segmentAngle = (2 * Math.PI) / this.equiposPendientes.length;

    this.equiposPendientes.forEach((equipo, index) => {
      const startAngle = index * segmentAngle;
      const endAngle = (index + 1) * segmentAngle;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = this.generarColor(index);
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + segmentAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "white";
      ctx.font = "bold 12px Arial";
      const nombreCorto =
        equipo.nombre.length > 8
          ? equipo.nombre.substring(0, 8) + "..."
          : equipo.nombre;
      ctx.fillText(nombreCorto, radius - 15, 5);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(centerX, centerY, 15, 0, 2 * Math.PI);
    ctx.fillStyle = "#ff6b6b";
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.stroke();

    console.log(
      `🎨 Ruleta preparada con ${this.equiposPendientes.length} equipos`
    );
  }

  generarColor(index) {
    const colores = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FFEAA7",
      "#DDA0DD",
      "#98D8C8",
      "#F7DC6F",
      "#BB8FCE",
      "#85C1E9",
      "#F8C471",
      "#82E0AA",
      "#F1948A",
      "#85C1E9",
      "#D7BDE2",
    ];
    return colores[index % colores.length];
  }

  removerEquipoDeRuleta(equipoId) {
    // Remover equipo de la lista de pendientes
    this.equiposPendientes = this.equiposPendientes.filter(
      (e) => e.id !== equipoId
    );

    console.log(`🗑️ Equipo ${equipoId} removido de la ruleta`);

    // Actualizar la ruleta visualmente
    this.prepararRuletaCanvas();

    // Actualizar estado del botón girar
    const btnGirar = document.getElementById("btn-girar");
    if (btnGirar) {
      btnGirar.disabled = this.equiposPendientes.length === 0;
    }

    // Actualizar lista de equipos pendientes
    this.actualizarListaEquiposPendientes();

    // Si no quedan equipos, mostrar mensaje
    if (this.equiposPendientes.length === 0) {
      this.mostrarNotificacion(
        "🎉¡Todos los equipos han sido asignados! Puedes ver los grupos completos.",
        "success"
      );
    }
  }

  async girarRuleta() {
    if (this.equiposPendientes.length === 1) {
      this.equipoSeleccionado = this.equiposPendientes[0];

      this.mostrarNotificacion(
        `⚠️ Último equipo: ${this.equipoSeleccionado.nombre}. Selecciona el grupo destino.`,
        "info"
      );

      // Habilitar botón asignar
      const btnAsignar = document.getElementById("btn-asignar");
      if (btnAsignar) btnAsignar.disabled = false;

      // 🔴 Enfocar selector de grupo
      const selector = document.getElementById("grupo-destino");
      if (selector) {
        selector.focus();
        selector.style.border = "2px solid #e67e22";
      }

      return; // ⛔ NO girar ruleta
    }

    if (this.ruletaGirando || this.equiposPendientes.length === 0) {
      this.mostrarNotificacion("No hay equipos para girar", "error");
      return;
    }

    if (this.equiposPendientes.length === 1) {
      this.equipoSeleccionado = this.equiposPendientes[0];

      this.mostrarNotificacion(
        `✅ Último equipo: ${this.equipoSeleccionado.nombre}. Seleccionado automáticamente.`,
        "info"
      );

      const btnAsignar = document.getElementById("btn-asignar");
      if (btnAsignar) btnAsignar.disabled = false;

      const canvas = document.getElementById("ruletaCanvas");
      if (canvas) canvas.style.transform = "rotate(0deg)";

      return;
    }

    this.ruletaGirando = true;
    const btnGirar = document.getElementById("btn-girar");
    if (btnGirar) btnGirar.disabled = true;

    const canvas = document.getElementById("ruletaCanvas");
    const equipoSeleccionado =
      this.equiposPendientes[
        Math.floor(Math.random() * this.equiposPendientes.length)
      ];

    console.log(`🎯 Equipo seleccionado: ${equipoSeleccionado.nombre}`);

    let rotation = 0;
    const targetRotation = 1800 + Math.random() * 1800;
    const duration = 3000;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      rotation = targetRotation * progress;
      if (canvas) canvas.style.transform = `rotate(${rotation}deg)`;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.ruletaGirando = false;
        if (btnGirar) btnGirar.disabled = false;
        this.mostrarNotificacion(
          `🎯 Seleccionado: ${equipoSeleccionado.nombre}`,
          "info"
        );

        this.equipoSeleccionado = equipoSeleccionado;
        const btnAsignar = document.getElementById("btn-asignar");
        if (btnAsignar) btnAsignar.disabled = false;

        console.log(`✅ Ruleta detenida en: ${equipoSeleccionado.nombre}`);
      }
    };

    requestAnimationFrame(animate);
  }

  async asignarEquipoSeleccionado() {
    if (!this.equipoSeleccionado) {
      this.mostrarNotificacion("No hay equipo seleccionado", "error");
      return;
    }

    if (!this.grupos || this.grupos.length === 0) {
      this.mostrarNotificacion("No hay grupos disponibles", "error");
      return;
    }

    const grupoDestino = document.getElementById("grupo-destino");
    if (!grupoDestino || !grupoDestino.value) {
      this.mostrarNotificacion("❌ Selecciona un grupo destino", "error");
      return;
    }

    const grupoId = grupoDestino.value;

    try {
      console.log(
        `📤 Asignando equipo ${this.equipoSeleccionado.nombre} al grupo ${grupoId}`
      );

      const endpoints = [
        /*`${this.API_BASE}/sorteo/ruleta`,
        `${this.API_BASE}/grupos/${grupoId}/equipos`,*/
        `${this.API_BASE}/grupos/asignar-equipo`,
      ];

      let asignado = false;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              campeonato_id: parseInt(this.campeonatoId),
              equipo_id: parseInt(this.equipoSeleccionado.id),
              grupo_id: parseInt(grupoId),
            }),
          });

          if (response.ok) {
            const resultado = await response.json();
            this.mostrarNotificacion(
              `✅ ${this.equipoSeleccionado.nombre} asignado al grupo`,
              "success"
            );
            asignado = true;

            const btnAsignar = document.getElementById("btn-asignar");
            if (btnAsignar) btnAsignar.disabled = true;

            /*await this.cargarTodosEquiposComoPendientes();
            await this.cargarGrupos();
            await this.mostrarGruposResultantes();

            console.log("✅ Asignación completada correctamente");
            break;*/

            // REMOVER EL EQUIPO DE LA RULETA INMEDIATAMENTE
            this.removerEquipoDeRuleta(this.equipoSeleccionado.id);

            await this.cargarGrupos();
            await this.mostrarGruposResultantes();
          }
        } catch (error) {
          console.warn(`⚠️ Endpoint ${endpoint} falló:`, error);
        }
      }

      if (!asignado) {
        await this.asignacionLocalEquipo(grupoId);
      }
    } catch (error) {
      console.error("Error asignando equipo:", error);
      this.mostrarNotificacion(
        "Error asignando el equipo: " + error.message,
        "error"
      );
    }
  }

  async asignacionLocalEquipo(grupoId) {
    try {
      console.log("🔄 Usando asignación local...");

      const grupo = this.grupos.find((g) => g.id == grupoId);
      if (grupo) {
        if (!grupo.equipos) grupo.equipos = [];
        grupo.equipos.push(this.equipoSeleccionado);

        /*this.equiposPendientes = this.equiposPendientes.filter(
          (e) => e.id !== this.equipoSeleccionado.id
        );*/

        // REMOVER EL EQUIPO DE LA RULETA
        this.removerEquipoDeRuleta(this.equipoSeleccionado.id);

        this.mostrarNotificacion(
          `✅ ${this.equipoSeleccionado.nombre} asignado al grupo (local)`,
          "success"
        );

        const btnAsignar = document.getElementById("btn-asignar");
        if (btnAsignar) btnAsignar.disabled = true;

        this.actualizarListaEquiposPendientes();
        this.mostrarGruposConEquipos(this.grupos);

        console.log("✅ Asignación local completada");
      } else {
        throw new Error("Grupo no encontrado");
      }
    } catch (error) {
      throw new Error("Error en asignación local: " + error.message);
    }
  }

  async mostrarGruposResultantes() {
    try {
      console.log("🔄 Cargando grupos resultantes...");

      const endpoints = [
        `${this.API_BASE}/grupos/campeonato/${this.campeonatoId}/completo`,
        `${this.API_BASE}/grupos/campeonato/${this.campeonatoId}`,
        `${this.API_BASE}/campeonatos/${this.campeonatoId}/grupos`,
      ];

      let grupos = [];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          if (response.ok) {
            const data = await response.json();
            console.log("📦 Datos recibidos de", endpoint, data);

            if (Array.isArray(data)) {
              grupos = data;
              break;
            } else if (data.grupos && Array.isArray(data.grupos)) {
              grupos = data.grupos;
              break;
            } else if (data.data && Array.isArray(data.data)) {
              grupos = data.data;
              break;
            } else {
              console.warn("⚠️ Formato inesperado en:", endpoint, data);
            }
          }
        } catch (error) {
          console.warn(`⚠️ Endpoint ${endpoint} falló:`, error);
        }
      }

      if (grupos.length === 0) {
        console.warn("❌ No se pudieron cargar grupos de ningún endpoint");
        this.mostrarNotificacion("No se pudieron cargar los grupos", "error");
        return;
      }

      console.log(`✅ ${grupos.length} grupos cargados exitosamente`);
      this.mostrarGruposConEquipos(grupos);
    } catch (error) {
      console.error("❌ Error mostrando resultados:", error);
      this.mostrarNotificacion(
        "Error cargando los grupos: " + error.message,
        "error"
      );
    }
  }

  mostrarGruposConEquipos(grupos) {
    const container = document.getElementById("lista-grupos");
    if (!container) {
      console.error(
        "❌ No se encontró el contenedor de grupos con ID 'lista-grupos'"
      );
      return;
    }

    container.innerHTML = "";

    if (grupos.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users" style="font-size: 2rem; color: #bdc3c7;"></i>
                    <p>No se han creado grupos aún</p>
                </div>
            `;
      return;
    }

    // Ordenar grupos
    grupos.sort((a, b) => {
      const nombreA = this.obtenerNombreGrupo(a).toLowerCase();
      const nombreB = this.obtenerNombreGrupo(b).toLowerCase();
      return nombreA.localeCompare(nombreB);
    });

    grupos.forEach((grupo, index) => {
      let equiposHTML = "";

      const equipos = grupo.equipos || grupo.Equipos || [];

      if (equipos.length > 0) {
        equipos.forEach((equipo, index) => {
          equiposHTML += `
                        <div class="equipo-en-grupo">
                            <span class="posicion">${index + 1}.</span>
                            <span class="nombre-equipo">${
                              equipo.nombre || equipo.Nombre
                            }</span>
                            ${
                              equipo.es_cabeza_serie
                                ? '<i class="fas fa-crown cabeza-serie" title="Cabeza de serie"></i>'
                                : ""
                            }
                        </div>
                    `;
        });
      } else {
        equiposHTML = `
                    <div class="empty-equipos">
                        <i class="fas fa-user-slash"></i>
                        <span>No hay equipos asignados</span>
                    </div>
                `;
      }

      const grupoElement = document.createElement("div");
      grupoElement.className = "grupo-card";
      grupoElement.innerHTML = `
                <div class="grupo-header">
                    <h4>${this.obtenerNombreGrupo(grupo, index)}</h4>
                    <span class="contador-equipos">${
                      equipos.length
                    } equipos</span>
                </div>
                <div class="equipos-grupo">
                    ${equiposHTML}
                </div>
            `;
      container.appendChild(grupoElement);
    });

    console.log(`📋 ${grupos.length} grupos mostrados con éxito`);
  }

  mostrarNotificacion(mensaje, tipo = "info") {
    if (typeof mostrarNotificacion === "function") {
      mostrarNotificacion(mensaje, tipo);
    } else {
      console.log(`${tipo.toUpperCase()}: ${mensaje}`);
      const notification = document.createElement("div");
      notification.className = `notification ${tipo}`;
      notification.textContent = mensaje;

      if (document.body) {
        document.body.appendChild(notification);
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 3000);
      }
    }
  }
}

// Inicializar cuando el DOM esté listo
/*document.addEventListener("DOMContentLoaded", function () {
  window.ruletaSorteo = new RuletaSorteo();
  console.log("🎯 Sistema de sorteo listo");
});*/
document.addEventListener("DOMContentLoaded", function () {
  window.ruletaSorteo = new RuletaSorteo();
  console.log("🎯 Sistema de sorteo listo");

  const campeonatoSelect = document.getElementById("select-campeonato");
  if (campeonatoSelect) {
    campeonatoSelect.addEventListener("change", async () => {
      const id = campeonatoSelect.value;

      // si no selecciona nada, limpia UI
      if (!id) return;

      window.ruletaSorteo.campeonatoId = id;

      // ✅ aquí detectamos si ya hay grupos y los mostramos
      await window.ruletaSorteo.cargarEstadoActual();
    });
  }
});

// Funciones globales para llamar desde el HTML
function iniciarSorteo() {
  if (window.ruletaSorteo) {
    window.ruletaSorteo.iniciarSorteo();
  } else {
    console.error("❌ RuletaSorteo no está inicializada");
    alert("Error: El sistema de sorteo no está listo. Recarga la página.");
  }
}

function girarRuleta() {
  if (window.ruletaSorteo) {
    window.ruletaSorteo.girarRuleta();
  }
}

function verGruposSorteo() {
  const select = document.getElementById("select-campeonato");
  const campeonatoId =
    (window.ruletaSorteo && window.ruletaSorteo.campeonatoId) ||
    (select && select.value);

  if (!campeonatoId) {
    alert("Primero selecciona un campeonato.");
    return;
  }

  window.open(`gruposgen.html?campeonato=${campeonatoId}`, "_blank");
}

function asignarEquipoSeleccionado() {
  if (window.ruletaSorteo) {
    window.ruletaSorteo.asignarEquipoSeleccionado();
  }
  const selector = document.getElementById("grupo-destino");
  if (selector) {
    selector.style.border = "";
  }
}
