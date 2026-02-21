// Estado global de la aplicación
const AppState = {
    campeonatos: [],
    equipos: [],
    grupos: [],
    sorteo: {
        campeonatoSeleccionado: null,
        equiposPendientes: [],
        gruposCreados: []
    }
};

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', function() {
    inicializarNavegacion();
    cargarEstadisticasIniciales();
    //cargarCampeonatos();
    inicializarModales();
    cargarCampeonatosParaSorteo();

});

// Navegación entre secciones
function inicializarNavegacion() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.section');

    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetSection = this.getAttribute('data-section');
            
            // Actualizar botones activos
            navButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Mostrar sección correspondiente
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === targetSection) {
                    section.classList.add('active');
                }
            });

            // Cargar contenido específico de la sección
            switch(targetSection) {
                case 'campeonatos':
                    cargarCampeonatos();
                    break;
                case 'sorteo':
                    cargarCampeonatosParaSorteo();
                    break;
                case 'partidos':
                    cargarPartidos();
                    break;
                case 'tablas':
                    cargarTablas();
                    break;
            }
        });
    });
}

// Cargar estadísticas del dashboard
async function cargarEstadisticasIniciales() {
    try {
        const user = window.Auth?.getUser?.() || null;
        const rol = String(user?.rol || "").toLowerCase();
        const stats = await calcularEstadisticasReales(rol);

        const set = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = String(value ?? 0);
        };

        set("stats-campeonatos", stats.campeonatos);
        set("stats-eventos", stats.eventos);
        set("stats-equipos", stats.equipos);
        set("stats-jugadores", stats.jugadores);
        set("stats-partidos", stats.partidos);
    } catch (error) {
        console.error("Error cargando estadísticas:", error);
    }
}

async function calcularEstadisticasReales(rol = "") {
    const campResp = await CampeonatosAPI.obtenerTodos();
    const campeonatos = Array.isArray(campResp)
        ? campResp
        : (campResp?.campeonatos || campResp?.data || []);

    if (!campeonatos.length) {
        return { campeonatos: 0, eventos: 0, equipos: 0, jugadores: 0, partidos: 0 };
    }

    // Para organizador, CampeonatosAPI ya devuelve solo sus campeonatos.
    const campeonatoIds = campeonatos.map((c) => Number(c.id)).filter((x) => Number.isFinite(x) && x > 0);

    const resultados = await Promise.all(
        campeonatoIds.map(async (campeonatoId) => {
            const [evResp, eqResp, paResp] = await Promise.all([
                EventosAPI.obtenerPorCampeonato(campeonatoId).catch(() => ({ eventos: [] })),
                window.ApiClient.get(`/equipos/campeonato/${campeonatoId}`).catch(() => ({ equipos: [] })),
                window.ApiClient.get(`/partidos/campeonato/${campeonatoId}`).catch(() => ({ partidos: [] })),
            ]);
            return {
                eventos: Array.isArray(evResp) ? evResp : (evResp?.eventos || []),
                equipos: Array.isArray(eqResp) ? eqResp : (eqResp?.equipos || []),
                partidos: Array.isArray(paResp) ? paResp : (paResp?.partidos || []),
            };
        })
    );

    const eventosMap = new Map();
    const equiposMap = new Map();
    let partidosTotal = 0;

    resultados.forEach((r) => {
        (r.eventos || []).forEach((e) => eventosMap.set(Number(e.id), e));
        (r.equipos || []).forEach((e) => equiposMap.set(Number(e.id), e));
        partidosTotal += (r.partidos || []).length;
    });

    const equipos = Array.from(equiposMap.values());
    const jugadoresPorEquipo = await Promise.all(
        equipos.map((equipo) =>
            window.ApiClient
                .get(`/jugadores/equipo/${equipo.id}`)
                .then((r) => (Array.isArray(r) ? r.length : ((r?.jugadores || []).length)))
                .catch(() => 0)
        )
    );
    const jugadoresTotal = jugadoresPorEquipo.reduce((acc, n) => acc + (Number(n) || 0), 0);

    return {
        campeonatos: campeonatos.length,
        eventos: eventosMap.size,
        equipos: equiposMap.size,
        jugadores: jugadoresTotal,
        partidos: partidosTotal,
    };
}

// Hook explícito usado por admin.html
window.initStatsAdmin = cargarEstadisticasIniciales;

// Inicializar modales
function inicializarModales() {
    // Cerrar modal al hacer click en la X
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });

    // Cerrar modal al hacer click fuera del contenido
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    });

    // Formulario de campeonato
    document.getElementById('form-campeonato').addEventListener('submit', manejarSubmitCampeonato);
}

// Utilidades de modales
function mostrarModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function cerrarModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Manejar envío del formulario de campeonato
async function manejarSubmitCampeonato(e) {
    e.preventDefault();
    
    const campeonatoId = document.getElementById('campeonato-id').value;
    const datos = {
        nombre: document.getElementById('campeonato-nombre').value,
        tipo_futbol: document.getElementById('campeonato-tipo').value,
        sistema_puntuacion: document.getElementById('campeonato-sistema').value,
        fecha_inicio: document.getElementById('campeonato-fecha-inicio').value,
        fecha_fin: document.getElementById('campeonato-fecha-fin').value,
        max_equipos: 16,
        min_jugadores: 15,
        max_jugadores: 22
    };

    try {
        if (campeonatoId) {
            // Actualizar campeonato existente
            await CampeonatosAPI.actualizar(campeonatoId, datos);
            mostrarNotificacion('Campeonato actualizado exitosamente', 'success');
        } else {
            // Crear nuevo campeonato
            await CampeonatosAPI.crear(datos);
            mostrarNotificacion('Campeonato creado exitosamente', 'success');
        }

        cerrarModal('modal-campeonato');
        cargarCampeonatos(); // Recargar lista
        cargarCampeonatosParaSorteo(); // Actualizar selector de sorteo
        
    } catch (error) {
        mostrarNotificacion('Error guardando el campeonato', 'error');
    }
}

// Cargar campeonatos para el selector de sorteo
async function cargarCampeonatosParaSorteo() {
    try {
        const campeonatos = await CampeonatosAPI.obtenerTodos();
        const select = document.getElementById('campeonato-select');
        
        select.innerHTML = '<option value="">Seleccionar campeonato...</option>';
        
        if (campeonatos.campeonatos && campeonatos.campeonatos.length > 0) {
            campeonatos.campeonatos.forEach(campeonato => {
                const option = document.createElement('option');
                option.value = campeonato.id;
                option.textContent = campeonato.nombre;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error cargando campeonatos para sorteo:', error);
    }
}

// Función de notificaciones (si no existe)
/*function mostrarNotificacion(mensaje, tipo = 'info') {
    const notifications = document.getElementById('notifications');
    const notification = document.createElement('div');
    notification.className = `notification ${tipo}`;
    notification.innerHTML = `
        <span>${mensaje}</span>
        <button class="close-notification">&times;</button>
    `;
    
    notifications.appendChild(notification);
    
    // Auto-eliminar después de 5 segundos
    setTimeout(() => {
        notification.remove();
    }, 5000);
    
    // Cerrar manualmente
    notification.querySelector('.close-notification').addEventListener('click', () => {
        notification.remove();
    });
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
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
    `;

    // VERIFICAR que el body existe antes de agregar la notificación
    if (document.body) {
        document.body.appendChild(notification);
        
        // Remover después de 3 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    } else {
        // Si el body no está disponible, solo mostrar en consola
        console.log(`NOTIFICATION [${tipo}]: ${mensaje}`);
    }
}
// En app.js - función para cargar campeonatos en el selector de sorteo
async function cargarCampeonatosParaSorteo() {
    try {
        const campeonatos = await CampeonatosAPI.obtenerTodos();
        const select = document.getElementById('select-campeonato');
        
        select.innerHTML = '<option value="">-- Selecciona un campeonato --</option>';
        
        if (campeonatos.campeonatos && campeonatos.campeonatos.length > 0) {
            campeonatos.campeonatos.forEach(campeonato => {
                const option = document.createElement('option');
                option.value = campeonato.id;
                option.textContent = campeonato.nombre;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error cargando campeonatos para sorteo:', error);
    }
}

