// Configuración de la API
const API_BASE_URL = 'http://localhost:5000/api';
const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

// Utilidad para hacer requests a la API
class ApiClient {
    static async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error en la petición API:', error);
            mostrarNotificacion(`Error: ${error.message}`, 'error');
            throw error;
        }
    }

    static async get(endpoint) {
        return this.request(endpoint);
    }

    static async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: data
        });
    }

    static async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: data
        });
    }

    static async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }
}

// Módulo de Campeonatos
const CampeonatosAPI = {
    async obtenerTodos() {
        return await ApiClient.get('/campeonatos');
    },

    async obtenerPorId(id) {
        return await ApiClient.get(`/campeonatos/${id}`);
    },

    async crear(campeonato) {
        return await ApiClient.post('/campeonatos', campeonato);
    },

    async actualizar(id, campeonato) {
        return await ApiClient.put(`/campeonatos/${id}`, campeonato);
    },

    async eliminar(id) {
        return await ApiClient.delete(`/campeonatos/${id}`);
    }
};

// Módulo de Equipos
const EquiposAPI = {
    async obtenerPorCampeonato(campeonatoId) {
        return await ApiClient.get(`/equipos/campeonato/${campeonatoId}`);
    },

    async crear(equipo) {
        return await ApiClient.post('/equipos', equipo);
    },

    async designarCabezaSerie(equipoId, esCabezaSerie) {
        return await ApiClient.put(`/equipos/${equipoId}/cabeza-serie`, {
            es_cabeza_serie: esCabezaSerie
        });
    }
};

// Módulo de Grupos
const GruposAPI = {
    async crear(campeonatoId, cantidadGrupos) {
        return await ApiClient.post('/grupos', {
            campeonato_id: campeonatoId,
            cantidad_grupos: cantidadGrupos
        });
    },

    async obtenerPorCampeonato(campeonatoId) {
        return await ApiClient.get(`/grupos/campeonato/${campeonatoId}`);
    }
};

// Módulo de Sorteo
const SorteoAPI = {
    async aleatorio(campeonatoId, cantidadGrupos) {
        return await ApiClient.post('/sorteo/aleatorio', {
            campeonato_id: campeonatoId,
            cantidad_grupos: cantidadGrupos
        });
    },

    async conCabezaSerie(campeonatoId, cantidadGrupos) {
        return await ApiClient.post('/sorteo/cabeza-serie', {
            campeonato_id: campeonatoId,
            cantidad_grupos: cantidadGrupos
        });
    }
};

// Módulo de Tablas
const TablasAPI = {
    async obtenerPorGrupo(grupoId) {
        return await ApiClient.get(`/tablas/grupo/${grupoId}`);
    },

    async obtenerPorCampeonato(campeonatoId) {
        return await ApiClient.get(`/tablas/campeonato/${campeonatoId}`);
    }
};

// Utilidades de la UI
/*function mostrarNotificacion(mensaje, tipo = 'info') {
    // Crear notificación temporal
    const notification = document.createElement('div');
    notification.className = `notification ${tipo}`;
    notification.textContent = mensaje;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${tipo === 'error' ? '#e74c3c' : tipo === 'success' ? '#27ae60' : '#3498db'};
        color: white;
        border-radius: 5px;
        z-index: 10000;
        box-shadow: 0 3px 10px rgba(0,0,0,0.2);
    `;

    document.body.appendChild(notification);

    // Remover después de 3 segundos
    setTimeout(() => {
        notification.remove();
    }, 3000);
}*/
function mostrarNotificacion(mensaje, tipo = 'info') {
    console.log(`🔔 ${tipo.toUpperCase()}: ${mensaje}`);
    
    // Crear notificación temporal
    const notification = document.createElement('div');
    notification.className = `notification ${tipo}`;
    notification.textContent = mensaje;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${tipo === 'error' ? '#e74c3c' : tipo === 'success' ? '#27ae60' : '#3498db'};
        color: white;
        border-radius: 5px;
        z-index: 10000;
        box-shadow: 0 3px 10px rgba(0,0,0,0.2);
        animation: slideInRight 0.3s ease;
    `;

    // Asegurarnos de que el body existe antes de appendChild
    if (document.body) {
        document.body.appendChild(notification);
    } else {
        // Si el body no está disponible, usar console.log
        console.log(`NOTIFICATION [${tipo}]: ${mensaje}`);
        return;
    }

    // Remover después de 3 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

function mostrarCargando(mensaje = 'Cargando...') {
    // Puedes implementar un spinner o mensaje de carga
    console.log(mensaje);
}

function ocultarCargando() {
    // Ocultar el spinner o mensaje de carga
    console.log('Carga completada');
}