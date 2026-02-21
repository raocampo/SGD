// frontend/js/api.js
(() => {
  if (window.API_BASE_URL && window.ApiClient && window.CampeonatosAPI && window.EventosAPI) {
    return;
  }

  window.API_BASE_URL = window.API_BASE_URL || "http://localhost:5000/api";

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
    if (payload.error) return payload.error;
    if (payload.message) return payload.message;
    return "Error HTTP";
  }

  async function handleHttpError(resp, endpoint) {
    const data = await parseResponse(resp);
    const msg = extractErrorMessage(data);
    if (resp.status === 401 && !String(endpoint || "").includes("/auth/login")) {
      window.Auth?.handleUnauthorized?.();
    }
    throw new Error(msg);
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
    login(payload) {
      return window.ApiClient.post("/auth/login", payload);
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
    asignarEquipo(usuarioId, equipoId) {
      return window.ApiClient.post(`/auth/usuarios/${usuarioId}/equipos`, {
        equipo_id: equipoId,
      });
    },
    quitarEquipo(usuarioId, equipoId) {
      return window.ApiClient.delete(`/auth/usuarios/${usuarioId}/equipos/${equipoId}`);
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
})();
