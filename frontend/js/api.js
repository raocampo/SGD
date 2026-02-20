// frontend/js/api.js
(() => {
  // Evita redeclarar si el script se carga 2 veces
  if (window.API_BASE_URL && window.ApiClient) {
    // si ya existen los wrappers, no hagas nada
    if (window.CampeonatosAPI && window.EventosAPI) return;
  }

  // Cambia solo esto si tu backend usa otro puerto
  window.API_BASE_URL = window.API_BASE_URL || "http://localhost:5000/api";

  window.ApiClient = window.ApiClient || {
    async request(method, endpoint, body = null) {
      const url = `${window.API_BASE_URL}${endpoint}`;
      const options = {
        method,
        headers: { "Content-Type": "application/json" },
      };
      if (body) options.body = JSON.stringify(body);

      const resp = await fetch(url, options);
      const contentType = resp.headers.get("content-type") || "";

      let data = null;
      if (contentType.includes("application/json")) data = await resp.json();
      else data = await resp.text();

      if (!resp.ok) {
        const msg =
          data && data.message ? data.message : data || "Error HTTP";
        throw new Error(msg);
      }
      return data;
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
        body: formData,
      });
      const contentType = resp.headers.get("content-type") || "";
      let data = null;
      if (contentType.includes("application/json")) data = await resp.json();
      else data = await resp.text();
      if (!resp.ok) {
        const msg =
          data && data.message ? data.message : data || "Error HTTP";
        throw new Error(msg);
      }
      return data;
    },
  };

  // =========================
  // ✅ APIs “bonitas” (wrappers)
  // =========================
  window.CampeonatosAPI = window.CampeonatosAPI || {
    obtenerTodos() {
      // Ajusta si tu endpoint real es otro
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
      // Ajusta si tu endpoint real es otro (ej: /eventos?campeonato_id=ID)
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
