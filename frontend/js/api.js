// frontend/js/api.js
(() => {
  if (window.API_BASE_URL && window.ApiClient && window.CampeonatosAPI && window.EventosAPI) {
    return;
  }

  window.resolveApiBaseUrl =
    window.resolveApiBaseUrl ||
    function resolveApiBaseUrl() {
      const explicitBase = String(window.API_BASE_URL || "").trim();
      if (explicitBase) return explicitBase.replace(/\/$/, "");

      const openedFromFile = window.location.protocol === "file:";
      const usesStaticDevHost =
        /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname) &&
        window.location.port &&
        window.location.port !== "5000";

      if (openedFromFile || usesStaticDevHost) {
        return "http://localhost:5000/api";
      }

      return `${window.location.origin}/api`;
    };

  window.resolveBackendBaseUrl =
    window.resolveBackendBaseUrl ||
    function resolveBackendBaseUrl() {
      return window.resolveApiBaseUrl().replace(/\/api\/?$/, "");
    };

  window.API_BASE_URL = window.resolveApiBaseUrl();

  function authHeaders() {
    const token = window.Auth?.getToken?.() || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function parseResponse(resp) {
    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return resp.json();
    return resp.text();
  }

  function extractErrorMessage(payload) {
    if (!payload) return "Error HTTP";
    if (typeof payload === "string") return payload;
    if (payload.detalle && (!payload.error || /interno/i.test(String(payload.error)))) {
      return payload.detalle;
    }
    if (payload.error) return payload.error;
    if (payload.detalle) return payload.detalle;
    if (payload.message) return payload.message;
    return "Error HTTP";
  }

  async function handleHttpError(resp, endpoint) {
    const data = await parseResponse(resp);
    const msg = extractErrorMessage(data);
    if (resp.status === 401 && !String(endpoint || "").includes("/auth/login")) {
      window.Auth?.handleUnauthorized?.();
    }
    const err = new Error(msg);
    // Adjuntar payload original para que el caller pueda leer campos como `codigo`
    err.data = typeof data === "object" ? data : {};
    throw err;
  }

  window.ApiClient = window.ApiClient || {
    async request(method, endpoint, body = null) {
      const url = `${window.API_BASE_URL}${endpoint}`;
      const headers = {
        "Content-Type": "application/json",
        ...authHeaders(),
      };
      const options = { method, headers };
      if (body !== null && body !== undefined) {
        options.body = JSON.stringify(body);
      }

      const resp = await fetch(url, options);
      if (!resp.ok) return handleHttpError(resp, endpoint);
      return parseResponse(resp);
    },

    get(endpoint) {
      return this.request("GET", endpoint);
    },

    post(endpoint, body) {
      return this.request("POST", endpoint, body);
    },

    put(endpoint, body) {
      return this.request("PUT", endpoint, body);
    },

    delete(endpoint) {
      return this.request("DELETE", endpoint);
    },

    async requestForm(method, endpoint, formData) {
      const url = `${window.API_BASE_URL}${endpoint}`;
      const resp = await fetch(url, {
        method,
        headers: { ...authHeaders() },
        body: formData,
      });
      if (!resp.ok) return handleHttpError(resp, endpoint);
      return parseResponse(resp);
    },
  };

  window.AuthAPI = window.AuthAPI || {
    bootstrapStatus() {
      return window.ApiClient.get("/auth/bootstrap/status");
    },
    bootstrapRegister(payload) {
      return window.ApiClient.post("/auth/bootstrap/register", payload);
    },
    registerPublic(payload) {
      return window.ApiClient.post("/auth/register-public", payload);
    },
    login(payload) {
      return window.ApiClient.post("/auth/login", payload);
    },
    logout(payload) {
      return window.ApiClient.post("/auth/logout", payload);
    },
    forgotPassword(payload) {
      return window.ApiClient.post("/auth/password/forgot", payload);
    },
    resetPassword(payload) {
      return window.ApiClient.post("/auth/password/reset", payload);
    },
    changePassword(payload) {
      return window.ApiClient.post("/auth/password/change", payload);
    },
    landingOrganizadorPublica(organizadorId) {
      return window.ApiClient.get(`/auth/organizadores/${organizadorId}/landing`);
    },
    me() {
      return window.ApiClient.get("/auth/me");
    },
    listarUsuarios() {
      return window.ApiClient.get("/auth/usuarios");
    },
    crearUsuario(payload) {
      return window.ApiClient.post("/auth/usuarios", payload);
    },
    actualizarUsuario(usuarioId, payload) {
      return window.ApiClient.put(`/auth/usuarios/${usuarioId}`, payload);
    },
    eliminarUsuario(usuarioId) {
      return window.ApiClient.delete(`/auth/usuarios/${usuarioId}`);
    },
    asignarEquipo(usuarioId, equipoId) {
      return window.ApiClient.post(`/auth/usuarios/${usuarioId}/equipos`, {
        equipo_id: equipoId,
      });
    },
    quitarEquipo(usuarioId, equipoId) {
      return window.ApiClient.delete(`/auth/usuarios/${usuarioId}/equipos/${equipoId}`);
    },
  };

  window.NoticiasAPI = window.NoticiasAPI || {
    listar() {
      return window.ApiClient.get("/noticias");
    },
    obtener(id) {
      return window.ApiClient.get(`/noticias/${id}`);
    },
    crear(payload) {
      return window.ApiClient.post("/noticias", payload);
    },
    actualizar(id, payload) {
      return window.ApiClient.put(`/noticias/${id}`, payload);
    },
    eliminar(id) {
      return window.ApiClient.delete(`/noticias/${id}`);
    },
    publicar(id) {
      return window.ApiClient.post(`/noticias/${id}/publicar`, {});
    },
    despublicar(id) {
      return window.ApiClient.post(`/noticias/${id}/despublicar`, {});
    },
    listarPublicas() {
      return window.ApiClient.get("/public/noticias");
    },
    obtenerPublica(slug) {
      return window.ApiClient.get(`/public/noticias/${encodeURIComponent(slug)}`);
    },
  };

  window.GaleriaAPI = window.GaleriaAPI || {
    listar() {
      return window.ApiClient.get("/galeria");
    },
    obtener(id) {
      return window.ApiClient.get(`/galeria/${id}`);
    },
    crear(payload) {
      return window.ApiClient.post("/galeria", payload);
    },
    actualizar(id, payload) {
      return window.ApiClient.put(`/galeria/${id}`, payload);
    },
    eliminar(id) {
      return window.ApiClient.delete(`/galeria/${id}`);
    },
    listarPublica() {
      return window.ApiClient.get("/public/galeria");
    },
  };

  window.PortalContenidoAPI = window.PortalContenidoAPI || {
    obtener() {
      return window.ApiClient.get("/portal-contenido");
    },
    actualizar(payload) {
      return window.ApiClient.put("/portal-contenido", payload);
    },
    obtenerPublico() {
      return window.ApiClient.get("/public/portal-contenido");
    },
  };

  window.OrganizadorPortalAPI = window.OrganizadorPortalAPI || {
    obtenerContexto(params = {}) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && `${v}`.trim() !== "") qs.set(k, v);
      });
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return window.ApiClient.get(`/organizador-portal/contexto${suffix}`);
    },
    actualizarConfig(formData, params = {}) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && `${v}`.trim() !== "") qs.set(k, v);
      });
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return window.ApiClient.requestForm("PUT", `/organizador-portal/config${suffix}`, formData);
    },
    listarAuspiciantes(params = {}) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && `${v}`.trim() !== "") qs.set(k, v);
      });
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return window.ApiClient.get(`/organizador-portal/auspiciantes${suffix}`);
    },
    crearAuspiciante(formData) {
      return window.ApiClient.requestForm("POST", "/organizador-portal/auspiciantes", formData);
    },
    actualizarAuspiciante(id, formData) {
      return window.ApiClient.requestForm("PUT", `/organizador-portal/auspiciantes/${id}`, formData);
    },
    eliminarAuspiciante(id) {
      return window.ApiClient.delete(`/organizador-portal/auspiciantes/${id}`);
    },
    listarMedia(params = {}) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && `${v}`.trim() !== "") qs.set(k, v);
      });
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return window.ApiClient.get(`/organizador-portal/media${suffix}`);
    },
    crearMedia(formData) {
      return window.ApiClient.requestForm("POST", "/organizador-portal/media", formData);
    },
    actualizarMedia(id, formData) {
      return window.ApiClient.requestForm("PUT", `/organizador-portal/media/${id}`, formData);
    },
    eliminarMedia(id) {
      return window.ApiClient.delete(`/organizador-portal/media/${id}`);
    },
    listarEventosCampeonato(campeonatoId) {
      return window.ApiClient.get(`/organizador-portal/campeonatos/${campeonatoId}/eventos`);
    },
    obtenerJornadasPortal(eventoId) {
      return window.ApiClient.get(`/organizador-portal/eventos/${eventoId}/jornadas-portal`);
    },
    guardarJornadasPortal(eventoId, jornadasHabilitadas) {
      return window.ApiClient.put(`/organizador-portal/eventos/${eventoId}/jornadas-portal`, {
        jornadas_habilitadas: jornadasHabilitadas,
      });
    },
  };

  window.ContactoAPI = window.ContactoAPI || {
    enviar(payload) {
      return window.ApiClient.post("/public/contacto", payload);
    },
    listar(params = {}) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && `${v}`.trim() !== "") qs.set(k, v);
      });
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return window.ApiClient.get(`/contacto${suffix}`);
    },
    obtener(id) {
      return window.ApiClient.get(`/contacto/${id}`);
    },
    actualizarEstado(id, estado) {
      return window.ApiClient.put(`/contacto/${id}`, { estado });
    },
  };

  window.PortalPublicAPI = window.PortalPublicAPI || {
    listarCampeonatos() {
      return window.ApiClient.get("/public/campeonatos");
    },
    obtenerCampeonato(campeonatoId) {
      return window.ApiClient.get(`/public/campeonatos/${campeonatoId}`);
    },
    listarEventosPorCampeonato(campeonatoId) {
      return window.ApiClient.get(`/public/campeonatos/${campeonatoId}/eventos`);
    },
    listarAuspiciantesPorCampeonato(campeonatoId) {
      return window.ApiClient.get(`/public/campeonatos/${campeonatoId}/auspiciantes`);
    },
    listarMediaPorCampeonato(campeonatoId) {
      return window.ApiClient.get(`/public/campeonatos/${campeonatoId}/media`);
    },
    obtenerPartidosPorEvento(eventoId) {
      return window.ApiClient.get(`/public/eventos/${eventoId}/partidos`);
    },
    obtenerTablasPorEvento(eventoId) {
      return window.ApiClient.get(`/public/eventos/${eventoId}/tablas`);
    },
    obtenerEliminatoriasPorEvento(eventoId) {
      return window.ApiClient.get(`/public/eventos/${eventoId}/eliminatorias`);
    },
    obtenerGoleadoresPorEvento(eventoId) {
      return window.ApiClient.get(`/public/eventos/${eventoId}/goleadores`);
    },
    obtenerTarjetasPorEvento(eventoId) {
      return window.ApiClient.get(`/public/eventos/${eventoId}/tarjetas`);
    },
    obtenerFairPlayPorEvento(eventoId) {
      return window.ApiClient.get(`/public/eventos/${eventoId}/fair-play`);
    },
  };

  window.CampeonatosAPI = window.CampeonatosAPI || {
    obtenerTodos() {
      return window.ApiClient.get("/campeonatos");
    },
    obtenerPorId(id) {
      return window.ApiClient.get(`/campeonatos/${id}`);
    },
    crear(payload) {
      return window.ApiClient.post("/campeonatos", payload);
    },
    actualizar(id, payload) {
      return window.ApiClient.put(`/campeonatos/${id}`, payload);
    },
    eliminar(id) {
      return window.ApiClient.delete(`/campeonatos/${id}`);
    },
  };

  window.EventosAPI = window.EventosAPI || {
    obtenerPorCampeonato(campeonatoId) {
      return window.ApiClient.get(`/eventos/campeonato/${campeonatoId}`);
    },
    obtenerPorId(id) {
      return window.ApiClient.get(`/eventos/${id}`);
    },
    crear(payload) {
      return window.ApiClient.post("/eventos", payload);
    },
    actualizar(id, payload) {
      return window.ApiClient.put(`/eventos/${id}`, payload);
    },
    eliminar(id) {
      return window.ApiClient.delete(`/eventos/${id}`);
    },
  };

  window.FinanzasAPI = window.FinanzasAPI || {
    listarMovimientos(params = {}) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && `${v}`.trim() !== "") qs.set(k, v);
      });
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return window.ApiClient.get(`/finanzas/movimientos${suffix}`);
    },
    crearMovimiento(payload) {
      return window.ApiClient.post("/finanzas/movimientos", payload);
    },
    estadoCuentaEquipo(equipoId, params = {}) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && `${v}`.trim() !== "") qs.set(k, v);
      });
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return window.ApiClient.get(`/finanzas/equipo/${equipoId}/estado-cuenta${suffix}`);
    },
    morosidad(params = {}) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && `${v}`.trim() !== "") qs.set(k, v);
      });
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return window.ApiClient.get(`/finanzas/morosidad${suffix}`);
    },
  };

  window.AuspiciantesAPI = window.AuspiciantesAPI || {
    listarPorCampeonato(campeonatoId, soloActivos = false) {
      const qs = soloActivos ? "?activo=1" : "";
      return window.ApiClient.get(`/auspiciantes/campeonato/${campeonatoId}${qs}`);
    },
    crear(formData) {
      return window.ApiClient.requestForm("POST", "/auspiciantes", formData);
    },
    actualizar(id, formData) {
      return window.ApiClient.requestForm("PUT", `/auspiciantes/${id}`, formData);
    },
    eliminar(id) {
      return window.ApiClient.delete(`/auspiciantes/${id}`);
    },
  };

  window.PasesAPI = window.PasesAPI || {
    listar(params = {}) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && `${v}`.trim() !== "") qs.set(k, v);
      });
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return window.ApiClient.get(`/pases${suffix}`);
    },
    obtener(id) {
      return window.ApiClient.get(`/pases/${id}`);
    },
    crear(payload) {
      return window.ApiClient.post("/pases", payload);
    },
    actualizarEstado(id, payload) {
      return window.ApiClient.put(`/pases/${id}/estado`, payload);
    },
    historialJugadores(params = {}) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && `${v}`.trim() !== "") qs.set(k, v);
      });
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return window.ApiClient.get(`/pases/historial/jugadores${suffix}`);
    },
    historialJugador(jugadorId, params = {}) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && `${v}`.trim() !== "") qs.set(k, v);
      });
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return window.ApiClient.get(`/pases/historial/jugadores/${jugadorId}${suffix}`);
    },
    historialEquipos(params = {}) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && `${v}`.trim() !== "") qs.set(k, v);
      });
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return window.ApiClient.get(`/pases/historial/equipos${suffix}`);
    },
    historialEquipo(equipoId, params = {}) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && `${v}`.trim() !== "") qs.set(k, v);
      });
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return window.ApiClient.get(`/pases/historial/equipos/${equipoId}${suffix}`);
    },
  };
})();
