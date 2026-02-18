// frontend/js/api.js
(() => {
  // Evita redeclarar si el script se carga 2 veces
  if (window.API_BASE_URL && window.ApiClient) return;

  // Cambia solo esto si tu backend usa otro puerto
  window.API_BASE_URL = window.API_BASE_URL || "http://localhost:5000/api";

  window.ApiClient = {
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
        const msg = (data && data.message) ? data.message : (data || "Error HTTP");
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
  };
})();
