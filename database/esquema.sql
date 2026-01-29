-- =============================================
-- SISTEMA DE GESTIÓN DEPORTIVA - ESQUEMA BASE
-- =============================================

-- Tabla de Campeonatos
CREATE TABLE IF NOT EXISTS campeonatos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo_futbol VARCHAR(10) CHECK (tipo_futbol IN ('futbol_11', 'futbol_7', 'futbol_5')),
    fecha_inicio DATE,
    fecha_fin DATE,
    max_equipos INTEGER DEFAULT 16,
    min_jugadores INTEGER,
    max_jugadores INTEGER,
    estado VARCHAR(20) DEFAULT 'planificacion',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Equipos
CREATE TABLE IF NOT EXISTS equipos (
    id SERIAL PRIMARY KEY,
    campeonato_id INTEGER REFERENCES campeonatos(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    director_tecnico VARCHAR(100),
    asistente_tecnico VARCHAR(100),
    color_equipo VARCHAR(50),
    telefono VARCHAR(20),
    email VARCHAR(100),
    cabeza_serie BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Jugadores
CREATE TABLE IF NOT EXISTS jugadores (
    id SERIAL PRIMARY KEY,
    equipo_id INTEGER REFERENCES equipos(id) ON DELETE CASCADE,
    nombre VARCHAR(50) NOT NULL,
    apellido VARCHAR(50) NOT NULL,
    dni VARCHAR(20) UNIQUE,
    fecha_nacimiento DATE,
    posicion VARCHAR(30),
    numero_camiseta INTEGER,
    es_capitan BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Grupos
CREATE TABLE IF NOT EXISTS grupos (
    id SERIAL PRIMARY KEY,
    campeonato_id INTEGER REFERENCES campeonatos(id) ON DELETE CASCADE,
    nombre_grupo VARCHAR(50),
    letra_grupo CHAR(1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Relación Grupos-Equipos
CREATE TABLE IF NOT EXISTS grupo_equipos (
    grupo_id INTEGER REFERENCES grupos(id) ON DELETE CASCADE,
    equipo_id INTEGER REFERENCES equipos(id) ON DELETE CASCADE,
    orden_sorteo INTEGER,
    fecha_sorteo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (grupo_id, equipo_id)
);

-- Tabla de Partidos
CREATE TABLE IF NOT EXISTS partidos (
    id SERIAL PRIMARY KEY,
    campeonato_id INTEGER REFERENCES campeonatos(id) ON DELETE CASCADE,
    grupo_id INTEGER REFERENCES grupos(id),
    equipo_local_id INTEGER REFERENCES equipos(id),
    equipo_visitante_id INTEGER REFERENCES equipos(id),
    fecha_partido DATE,
    hora_partido TIME,
    cancha VARCHAR(100),
    resultado_local INTEGER DEFAULT 0,
    resultado_visitante INTEGER DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'pendiente',
    jornada INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Goleadores
CREATE TABLE IF NOT EXISTS goleadores (
    id SERIAL PRIMARY KEY,
    partido_id INTEGER REFERENCES partidos(id) ON DELETE CASCADE,
    jugador_id INTEGER REFERENCES jugadores(id),
    goles INTEGER DEFAULT 1,
    tipo_gol VARCHAR(20) DEFAULT 'campo',
    minuto INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Partidos
CREATE TABLE IF NOT EXISTS partidos (
    id SERIAL PRIMARY KEY,
    campeonato_id INTEGER REFERENCES campeonatos(id) ON DELETE CASCADE,
    grupo_id INTEGER REFERENCES grupos(id),
    equipo_local_id INTEGER REFERENCES equipos(id),
    equipo_visitante_id INTEGER REFERENCES equipos(id),
    fecha_partido DATE,
    hora_partido TIME,
    cancha VARCHAR(100),
    resultado_local INTEGER DEFAULT 0,
    resultado_visitante INTEGER DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'pendiente',
    jornada INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- ÍNDICES PARA MEJOR RENDIMIENTO
-- =============================================
CREATE INDEX idx_equipos_campeonato ON equipos(campeonato_id);
CREATE INDEX idx_jugadores_equipo ON jugadores(equipo_id);
CREATE INDEX idx_partidos_fecha ON partidos(fecha_partido);
CREATE INDEX idx_partidos_estado ON partidos(estado);
CREATE INDEX idx_partidos_campeonato ON partidos(campeonato_id);
CREATE INDEX idx_partidos_grupo ON partidos(grupo_id);
CREATE INDEX idx_partidos_jornada ON partidos(jornada);
CREATE INDEX idx_grupos_campeonato ON grupos(campeonato_id);
CREATE INDEX idx_grupo_equipos_grupo ON grupo_equipos(grupo_id);
CREATE INDEX idx_grupo_equipos_equipo ON grupo_equipos(equipo_id);