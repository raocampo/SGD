// frontend/js/api.js
// ✅ NO uses const API_BASE_URL aquí si también lo tienes en core.js.
// ✅ Usamos window.* para no redeclarar y no romper el resto de scripts.

(function () {
  window.API_BASE_URL = window.API_BASE_URL || "http://localhost:5000/api";

  class ApiClientClass {
    static async request(method, path, body) {
      const url = `${window.API_BASE_URL}${path}`;

      const options = {
        method,
        headers: { "Content-Type": "application/json" },
      };

      if (body !== undefined) options.body = JSON.stringify(body);

      const res = await fetch(url, options);
      const text = await res.text();

      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      if (!res.ok) {
        const msg =
          (data && (data.message || data.error)) ||
          `Error HTTP ${res.status} en ${path}`;
        throw new Error(msg);
      }

      return data;
    }

    static get(path) {
      return this.request("GET", path);
    }
    static post(path, body) {
      return this.request("POST", path, body);
    }
    static put(path, body) {
      return this.request("PUT", path, body);
    }
    static delete(path) {
      return this.request("DELETE", path);
    }
  }

  window.ApiClient = ApiClientClass;
})();

