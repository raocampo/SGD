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
        const campeonatos = await CampeonatosAPI.obtenerTodos();
        const stats = calcularEstadisticas(campeonatos.campeonatos || []);
        
        document.getElementById('stats-campeonatos').textContent = stats.campeonatos;
        document.getElementById('stats-equipos').textContent = stats.equipos;
        document.getElementById('stats-jugadores').textContent = stats.jugadores;
        document.getElementById('stats-partidos').textContent = stats.partidos;
        
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

function calcularEstadisticas(campeonatos) {
    // Por ahora retornamos datos de ejemplo
    // En una implementación real, haríamos más llamadas a la API
    return {
        campeonatos: campeonatos.length,
        equipos: campeonatos.reduce((acc, camp) => acc + (camp.max_equipos || 0), 0),
        jugadores: campeonatos.reduce((acc, camp) => acc + (camp.max_jugadores || 0) * (camp.max_equipos || 0), 0),
        partidos: campeonatos.length * 10 // Ejemplo
    };
}

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