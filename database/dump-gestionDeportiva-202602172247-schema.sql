--
-- PostgreSQL database dump
--

\restrict wlN7LiWRujRSqXUnq3EQvqTBWjPiWEqrUoVUQ9d33vi8INj6VDYwtKBImcMXVFd

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.tarjetas DROP CONSTRAINT IF EXISTS tarjetas_partido_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tarjetas DROP CONSTRAINT IF EXISTS tarjetas_jugador_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tarjetas DROP CONSTRAINT IF EXISTS tarjetas_equipo_id_fkey;
ALTER TABLE IF EXISTS ONLY public.partidos DROP CONSTRAINT IF EXISTS partidos_grupo_id_fkey;
ALTER TABLE IF EXISTS ONLY public.partidos DROP CONSTRAINT IF EXISTS partidos_equipo_visitante_id_fkey;
ALTER TABLE IF EXISTS ONLY public.partidos DROP CONSTRAINT IF EXISTS partidos_equipo_local_id_fkey;
ALTER TABLE IF EXISTS ONLY public.partidos_eliminatoria DROP CONSTRAINT IF EXISTS partidos_eliminatoria_slot_visitante_id_fkey;
ALTER TABLE IF EXISTS ONLY public.partidos_eliminatoria DROP CONSTRAINT IF EXISTS partidos_eliminatoria_slot_local_id_fkey;
ALTER TABLE IF EXISTS ONLY public.partidos_eliminatoria DROP CONSTRAINT IF EXISTS partidos_eliminatoria_partido_id_fkey;
ALTER TABLE IF EXISTS ONLY public.partidos_eliminatoria DROP CONSTRAINT IF EXISTS partidos_eliminatoria_ganador_id_fkey;
ALTER TABLE IF EXISTS ONLY public.partidos_eliminatoria DROP CONSTRAINT IF EXISTS partidos_eliminatoria_evento_id_fkey;
ALTER TABLE IF EXISTS ONLY public.partidos_eliminatoria DROP CONSTRAINT IF EXISTS partidos_eliminatoria_equipo_visitante_id_fkey;
ALTER TABLE IF EXISTS ONLY public.partidos_eliminatoria DROP CONSTRAINT IF EXISTS partidos_eliminatoria_equipo_local_id_fkey;
ALTER TABLE IF EXISTS ONLY public.partidos DROP CONSTRAINT IF EXISTS partidos_campeonato_id_fkey;
ALTER TABLE IF EXISTS ONLY public.partido_planillas DROP CONSTRAINT IF EXISTS partido_planillas_partido_id_fkey;
ALTER TABLE IF EXISTS ONLY public.jugadores DROP CONSTRAINT IF EXISTS jugadores_equipo_id_fkey;
ALTER TABLE IF EXISTS ONLY public.grupos DROP CONSTRAINT IF EXISTS grupos_campeonato_id_fkey;
ALTER TABLE IF EXISTS ONLY public.grupo_equipos DROP CONSTRAINT IF EXISTS grupo_equipos_grupo_id_fkey;
ALTER TABLE IF EXISTS ONLY public.grupo_equipos DROP CONSTRAINT IF EXISTS grupo_equipos_equipo_id_fkey;
ALTER TABLE IF EXISTS ONLY public.goleadores DROP CONSTRAINT IF EXISTS goleadores_partido_id_fkey;
ALTER TABLE IF EXISTS ONLY public.goleadores DROP CONSTRAINT IF EXISTS goleadores_jugador_id_fkey;
ALTER TABLE IF EXISTS ONLY public.partidos DROP CONSTRAINT IF EXISTS fk_partidos_evento;
ALTER TABLE IF EXISTS ONLY public.grupos DROP CONSTRAINT IF EXISTS fk_grupos_evento;
ALTER TABLE IF EXISTS ONLY public.eventos DROP CONSTRAINT IF EXISTS fk_eventos_campeonato;
ALTER TABLE IF EXISTS ONLY public.evento_equipos DROP CONSTRAINT IF EXISTS evento_equipos_evento_id_fkey;
ALTER TABLE IF EXISTS ONLY public.evento_equipos DROP CONSTRAINT IF EXISTS evento_equipos_equipo_id_fkey;
ALTER TABLE IF EXISTS ONLY public.evento_canchas DROP CONSTRAINT IF EXISTS evento_canchas_evento_id_fkey;
ALTER TABLE IF EXISTS ONLY public.evento_canchas DROP CONSTRAINT IF EXISTS evento_canchas_cancha_id_fkey;
ALTER TABLE IF EXISTS ONLY public.equipos DROP CONSTRAINT IF EXISTS equipos_campeonato_id_fkey;
ALTER TABLE IF EXISTS ONLY public.campeonatos DROP CONSTRAINT IF EXISTS campeonatos_evento_id_fkey;
DROP INDEX IF EXISTS public.idx_tarjetas_partido;
DROP INDEX IF EXISTS public.idx_partidos_grupo;
DROP INDEX IF EXISTS public.idx_partidos_fecha;
DROP INDEX IF EXISTS public.idx_partidos_estado;
DROP INDEX IF EXISTS public.idx_partidos_campeonato;
DROP INDEX IF EXISTS public.idx_jugadores_equipo;
DROP INDEX IF EXISTS public.idx_grupos_campeonato;
DROP INDEX IF EXISTS public.idx_grupo_equipos_grupo;
DROP INDEX IF EXISTS public.idx_grupo_equipos_equipo;
DROP INDEX IF EXISTS public.idx_goleadores_partido;
DROP INDEX IF EXISTS public.idx_equipos_campeonato;
DROP INDEX IF EXISTS public.idx_eliminatoria_ronda;
DROP INDEX IF EXISTS public.idx_eliminatoria_evento;
ALTER TABLE IF EXISTS ONLY public.tarjetas DROP CONSTRAINT IF EXISTS tarjetas_pkey;
ALTER TABLE IF EXISTS ONLY public.partidos DROP CONSTRAINT IF EXISTS partidos_pkey;
ALTER TABLE IF EXISTS ONLY public.partidos_eliminatoria DROP CONSTRAINT IF EXISTS partidos_eliminatoria_pkey;
ALTER TABLE IF EXISTS ONLY public.partidos_eliminatoria DROP CONSTRAINT IF EXISTS partidos_eliminatoria_evento_id_ronda_partido_numero_key;
ALTER TABLE IF EXISTS ONLY public.partido_planillas DROP CONSTRAINT IF EXISTS partido_planillas_pkey;
ALTER TABLE IF EXISTS ONLY public.partido_planillas DROP CONSTRAINT IF EXISTS partido_planillas_partido_id_key;
ALTER TABLE IF EXISTS ONLY public.jugadores DROP CONSTRAINT IF EXISTS jugadores_pkey;
ALTER TABLE IF EXISTS ONLY public.jugadores DROP CONSTRAINT IF EXISTS jugadores_dni_key;
ALTER TABLE IF EXISTS ONLY public.grupos DROP CONSTRAINT IF EXISTS grupos_pkey;
ALTER TABLE IF EXISTS ONLY public.grupo_equipos DROP CONSTRAINT IF EXISTS grupo_equipos_pkey;
ALTER TABLE IF EXISTS ONLY public.goleadores DROP CONSTRAINT IF EXISTS goleadores_pkey;
ALTER TABLE IF EXISTS ONLY public.eventos DROP CONSTRAINT IF EXISTS eventos_pkey;
ALTER TABLE IF EXISTS ONLY public.evento_equipos DROP CONSTRAINT IF EXISTS evento_equipos_pkey;
ALTER TABLE IF EXISTS ONLY public.evento_canchas DROP CONSTRAINT IF EXISTS evento_canchas_pkey;
ALTER TABLE IF EXISTS ONLY public.equipos DROP CONSTRAINT IF EXISTS equipos_pkey;
ALTER TABLE IF EXISTS ONLY public.canchas DROP CONSTRAINT IF EXISTS canchas_pkey;
ALTER TABLE IF EXISTS ONLY public.campeonatos DROP CONSTRAINT IF EXISTS campeonatos_pkey;
ALTER TABLE IF EXISTS ONLY public.archivos DROP CONSTRAINT IF EXISTS archivos_pkey;
ALTER TABLE IF EXISTS public.tarjetas ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.partidos_eliminatoria ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.partidos ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.partido_planillas ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.jugadores ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.grupos ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.goleadores ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.eventos ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.equipos ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.canchas ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.campeonatos ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.archivos ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.tarjetas_id_seq;
DROP TABLE IF EXISTS public.tarjetas;
DROP SEQUENCE IF EXISTS public.partidos_id_seq;
DROP SEQUENCE IF EXISTS public.partidos_eliminatoria_id_seq;
DROP TABLE IF EXISTS public.partidos_eliminatoria;
DROP TABLE IF EXISTS public.partidos;
DROP SEQUENCE IF EXISTS public.partido_planillas_id_seq;
DROP TABLE IF EXISTS public.partido_planillas;
DROP SEQUENCE IF EXISTS public.jugadores_id_seq;
DROP TABLE IF EXISTS public.jugadores;
DROP SEQUENCE IF EXISTS public.grupos_id_seq;
DROP TABLE IF EXISTS public.grupos;
DROP TABLE IF EXISTS public.grupo_equipos;
DROP SEQUENCE IF EXISTS public.goleadores_id_seq;
DROP TABLE IF EXISTS public.goleadores;
DROP SEQUENCE IF EXISTS public.eventos_id_seq;
DROP TABLE IF EXISTS public.eventos;
DROP TABLE IF EXISTS public.evento_equipos;
DROP TABLE IF EXISTS public.evento_canchas;
DROP SEQUENCE IF EXISTS public.equipos_id_seq;
DROP TABLE IF EXISTS public.equipos;
DROP SEQUENCE IF EXISTS public.canchas_id_seq;
DROP TABLE IF EXISTS public.canchas;
DROP SEQUENCE IF EXISTS public.campeonatos_id_seq;
DROP TABLE IF EXISTS public.campeonatos;
DROP SEQUENCE IF EXISTS public.archivos_id_seq;
DROP TABLE IF EXISTS public.archivos;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: archivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.archivos (
    id integer NOT NULL,
    pacienteid integer NOT NULL,
    consultaid integer,
    nombreoriginal character varying(255) NOT NULL,
    nombrearchivo character varying(255) NOT NULL,
    tipoarchivo character varying(10) NOT NULL,
    tamano integer NOT NULL,
    url character varying(500) NOT NULL,
    categoria character varying(50) NOT NULL,
    tipoexamen character varying(100) NOT NULL,
    descripcion text,
    fechaexamen date NOT NULL,
    fechacarga timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    uploadedby integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    createdat timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedat timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: archivos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.archivos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: archivos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.archivos_id_seq OWNED BY public.archivos.id;


--
-- Name: campeonatos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campeonatos (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    tipo_futbol character varying(10),
    fecha_inicio date,
    fecha_fin date,
    max_equipos integer DEFAULT 16,
    min_jugador integer,
    max_jugador integer,
    estado character varying(20) DEFAULT 'planificacion'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    sistema_puntuacion character varying(20),
    organizador character varying(150),
    logo_url character varying(255),
    color_primario character varying(7),
    color_secundario character varying(7),
    color_acento character varying(7),
    evento_id integer,
    reglas_desempate text DEFAULT '["puntos","diferencia_goles","goles_favor"]'::text,
    requiere_foto_cedula boolean DEFAULT false,
    requiere_foto_carnet boolean DEFAULT false,
    genera_carnets boolean DEFAULT false,
    CONSTRAINT campeonatos_tipo_futbol_check CHECK (((tipo_futbol)::text = ANY (ARRAY[('futbol_11'::character varying)::text, ('futbol_7'::character varying)::text, ('futbol_5'::character varying)::text])))
);


--
-- Name: COLUMN campeonatos.reglas_desempate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campeonatos.reglas_desempate IS 'Orden de criterios para desempate: puntos, diferencia_goles, goles_favor, goles_contra, enfrentamiento_directo, fair_play';


--
-- Name: campeonatos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campeonatos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campeonatos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campeonatos_id_seq OWNED BY public.campeonatos.id;


--
-- Name: canchas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.canchas (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    ubicacion text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: canchas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.canchas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: canchas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.canchas_id_seq OWNED BY public.canchas.id;


--
-- Name: equipos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipos (
    id integer NOT NULL,
    campeonato_id integer,
    nombre character varying(100) NOT NULL,
    director_tecnico character varying(100),
    asistente_tecnico character varying(100),
    color_equipo character varying(50),
    telefono character varying(20),
    email character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    cabeza_serie boolean DEFAULT false,
    logo_url character varying(255),
    evento_id integer,
    medico character varying(100),
    color_primario character varying(7),
    color_secundario character varying(7),
    color_terciario character varying(7)
);


--
-- Name: equipos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.equipos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.equipos_id_seq OWNED BY public.equipos.id;


--
-- Name: evento_canchas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evento_canchas (
    evento_id integer NOT NULL,
    cancha_id integer NOT NULL
);


--
-- Name: evento_equipos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evento_equipos (
    evento_id integer NOT NULL,
    equipo_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eventos (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    organizador text,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    estado character varying(20) DEFAULT 'activo'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    campeonato_id integer,
    modalidad character varying(10) DEFAULT 'weekend'::character varying,
    horario_weekday_inicio time without time zone DEFAULT '19:00:00'::time without time zone,
    horario_weekday_fin time without time zone DEFAULT '22:00:00'::time without time zone,
    horario_sab_inicio time without time zone DEFAULT '13:00:00'::time without time zone,
    horario_sab_fin time without time zone DEFAULT '18:00:00'::time without time zone,
    horario_dom_inicio time without time zone DEFAULT '08:00:00'::time without time zone,
    horario_dom_fin time without time zone DEFAULT '17:00:00'::time without time zone
);


--
-- Name: eventos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.eventos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: eventos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.eventos_id_seq OWNED BY public.eventos.id;


--
-- Name: goleadores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goleadores (
    id integer NOT NULL,
    partido_id integer,
    jugador_id integer,
    goles integer DEFAULT 1,
    tipo_gol character varying(20) DEFAULT 'campo'::character varying,
    minuto integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: goleadores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.goleadores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: goleadores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.goleadores_id_seq OWNED BY public.goleadores.id;


--
-- Name: grupo_equipos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grupo_equipos (
    grupo_id integer NOT NULL,
    equipo_id integer NOT NULL,
    orden_sorteo integer,
    fecha_sorteo timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: grupos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grupos (
    id integer NOT NULL,
    campeonato_id integer,
    nombre_grupo character varying(50),
    letra_grupo character(1),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    evento_id integer
);


--
-- Name: grupos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.grupos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: grupos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.grupos_id_seq OWNED BY public.grupos.id;


--
-- Name: jugadores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jugadores (
    id integer NOT NULL,
    equipo_id integer,
    nombre character varying(50) NOT NULL,
    apellido character varying(50) NOT NULL,
    cedidentidad character varying(20),
    fecha_nacimiento date,
    posicion character varying(30),
    numero_camiseta integer,
    es_capitan boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    foto_cedula_url text,
    foto_carnet_url text
);


--
-- Name: jugadores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jugadores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jugadores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jugadores_id_seq OWNED BY public.jugadores.id;


--
-- Name: partido_planillas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partido_planillas (
    id integer NOT NULL,
    partido_id integer,
    pago_arbitraje numeric(10,2) DEFAULT 0,
    pago_local numeric(10,2) DEFAULT 0,
    pago_visitante numeric(10,2) DEFAULT 0,
    observaciones text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: partido_planillas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.partido_planillas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: partido_planillas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.partido_planillas_id_seq OWNED BY public.partido_planillas.id;


--
-- Name: partidos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partidos (
    id integer NOT NULL,
    campeonato_id integer,
    grupo_id integer,
    equipo_local_id integer,
    equipo_visitante_id integer,
    fecha_partido date,
    hora_partido time without time zone,
    cancha character varying(100),
    resultado_local integer DEFAULT 0,
    resultado_visitante integer DEFAULT 0,
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    jornada integer,
    update_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    shootouts boolean DEFAULT false,
    resultado_local_shootouts integer,
    resultado_visitante_shootouts integer,
    es_ida boolean DEFAULT true,
    evento_id integer
);


--
-- Name: partidos_eliminatoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partidos_eliminatoria (
    id integer NOT NULL,
    evento_id integer,
    ronda character varying(30) NOT NULL,
    partido_numero integer NOT NULL,
    equipo_local_id integer,
    equipo_visitante_id integer,
    ganador_id integer,
    resultado_local integer DEFAULT 0,
    resultado_visitante integer DEFAULT 0,
    partido_id integer,
    slot_local_id integer,
    slot_visitante_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE partidos_eliminatoria; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.partidos_eliminatoria IS 'Llave eliminatoria: 32vos, 16vos, 8vos, 4tos, semifinal, final';


--
-- Name: partidos_eliminatoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.partidos_eliminatoria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: partidos_eliminatoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.partidos_eliminatoria_id_seq OWNED BY public.partidos_eliminatoria.id;


--
-- Name: partidos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.partidos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: partidos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.partidos_id_seq OWNED BY public.partidos.id;


--
-- Name: tarjetas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tarjetas (
    id integer NOT NULL,
    partido_id integer,
    jugador_id integer,
    equipo_id integer,
    tipo_tarjeta character varying(20) NOT NULL,
    minuto integer,
    observacion text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tarjetas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tarjetas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tarjetas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tarjetas_id_seq OWNED BY public.tarjetas.id;


--
-- Name: archivos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archivos ALTER COLUMN id SET DEFAULT nextval('public.archivos_id_seq'::regclass);


--
-- Name: campeonatos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campeonatos ALTER COLUMN id SET DEFAULT nextval('public.campeonatos_id_seq'::regclass);


--
-- Name: canchas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canchas ALTER COLUMN id SET DEFAULT nextval('public.canchas_id_seq'::regclass);


--
-- Name: equipos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos ALTER COLUMN id SET DEFAULT nextval('public.equipos_id_seq'::regclass);


--
-- Name: eventos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos ALTER COLUMN id SET DEFAULT nextval('public.eventos_id_seq'::regclass);


--
-- Name: goleadores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goleadores ALTER COLUMN id SET DEFAULT nextval('public.goleadores_id_seq'::regclass);


--
-- Name: grupos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupos ALTER COLUMN id SET DEFAULT nextval('public.grupos_id_seq'::regclass);


--
-- Name: jugadores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jugadores ALTER COLUMN id SET DEFAULT nextval('public.jugadores_id_seq'::regclass);


--
-- Name: partido_planillas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partido_planillas ALTER COLUMN id SET DEFAULT nextval('public.partido_planillas_id_seq'::regclass);


--
-- Name: partidos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partidos ALTER COLUMN id SET DEFAULT nextval('public.partidos_id_seq'::regclass);


--
-- Name: partidos_eliminatoria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partidos_eliminatoria ALTER COLUMN id SET DEFAULT nextval('public.partidos_eliminatoria_id_seq'::regclass);


--
-- Name: tarjetas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarjetas ALTER COLUMN id SET DEFAULT nextval('public.tarjetas_id_seq'::regclass);


--
-- Name: archivos archivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archivos
    ADD CONSTRAINT archivos_pkey PRIMARY KEY (id);


--
-- Name: campeonatos campeonatos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campeonatos
    ADD CONSTRAINT campeonatos_pkey PRIMARY KEY (id);


--
-- Name: canchas canchas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canchas
    ADD CONSTRAINT canchas_pkey PRIMARY KEY (id);


--
-- Name: equipos equipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_pkey PRIMARY KEY (id);


--
-- Name: evento_canchas evento_canchas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_canchas
    ADD CONSTRAINT evento_canchas_pkey PRIMARY KEY (evento_id, cancha_id);


--
-- Name: evento_equipos evento_equipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_equipos
    ADD CONSTRAINT evento_equipos_pkey PRIMARY KEY (evento_id, equipo_id);


--
-- Name: eventos eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_pkey PRIMARY KEY (id);


--
-- Name: goleadores goleadores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goleadores
    ADD CONSTRAINT goleadores_pkey PRIMARY KEY (id);


--
-- Name: grupo_equipos grupo_equipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupo_equipos
    ADD CONSTRAINT grupo_equipos_pkey PRIMARY KEY (grupo_id, equipo_id);


--
-- Name: grupos grupos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_pkey PRIMARY KEY (id);


--
-- Name: jugadores jugadores_dni_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jugadores
    ADD CONSTRAINT jugadores_dni_key UNIQUE (cedidentidad);


--
-- Name: jugadores jugadores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jugadores
    ADD CONSTRAINT jugadores_pkey PRIMARY KEY (id);


--
-- Name: partido_planillas partido_planillas_partido_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partido_planillas
    ADD CONSTRAINT partido_planillas_partido_id_key UNIQUE (partido_id);


--
-- Name: partido_planillas partido_planillas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partido_planillas
    ADD CONSTRAINT partido_planillas_pkey PRIMARY KEY (id);


--
-- Name: partidos_eliminatoria partidos_eliminatoria_evento_id_ronda_partido_numero_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partidos_eliminatoria
    ADD CONSTRAINT partidos_eliminatoria_evento_id_ronda_partido_numero_key UNIQUE (evento_id, ronda, partido_numero);


--
-- Name: partidos_eliminatoria partidos_eliminatoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partidos_eliminatoria
    ADD CONSTRAINT partidos_eliminatoria_pkey PRIMARY KEY (id);


--
-- Name: partidos partidos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partidos
    ADD CONSTRAINT partidos_pkey PRIMARY KEY (id);


--
-- Name: tarjetas tarjetas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarjetas
    ADD CONSTRAINT tarjetas_pkey PRIMARY KEY (id);


--
-- Name: idx_eliminatoria_evento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eliminatoria_evento ON public.partidos_eliminatoria USING btree (evento_id);


--
-- Name: idx_eliminatoria_ronda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eliminatoria_ronda ON public.partidos_eliminatoria USING btree (evento_id, ronda);


--
-- Name: idx_equipos_campeonato; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipos_campeonato ON public.equipos USING btree (campeonato_id);


--
-- Name: idx_goleadores_partido; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goleadores_partido ON public.goleadores USING btree (partido_id);


--
-- Name: idx_grupo_equipos_equipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grupo_equipos_equipo ON public.grupo_equipos USING btree (equipo_id);


--
-- Name: idx_grupo_equipos_grupo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grupo_equipos_grupo ON public.grupo_equipos USING btree (grupo_id);


--
-- Name: idx_grupos_campeonato; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grupos_campeonato ON public.grupos USING btree (campeonato_id);


--
-- Name: idx_jugadores_equipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jugadores_equipo ON public.jugadores USING btree (equipo_id);


--
-- Name: idx_partidos_campeonato; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partidos_campeonato ON public.partidos USING btree (campeonato_id);


--
-- Name: idx_partidos_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partidos_estado ON public.partidos USING btree (estado);


--
-- Name: idx_partidos_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partidos_fecha ON public.partidos USING btree (fecha_partido);


--
-- Name: idx_partidos_grupo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partidos_grupo ON public.partidos USING btree (grupo_id);


--
-- Name: idx_tarjetas_partido; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarjetas_partido ON public.tarjetas USING btree (partido_id);


--
-- Name: campeonatos campeonatos_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campeonatos
    ADD CONSTRAINT campeonatos_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id);


--
-- Name: equipos equipos_campeonato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_campeonato_id_fkey FOREIGN KEY (campeonato_id) REFERENCES public.campeonatos(id) ON DELETE CASCADE;


--
-- Name: evento_canchas evento_canchas_cancha_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_canchas
    ADD CONSTRAINT evento_canchas_cancha_id_fkey FOREIGN KEY (cancha_id) REFERENCES public.canchas(id);


--
-- Name: evento_canchas evento_canchas_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_canchas
    ADD CONSTRAINT evento_canchas_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE CASCADE;


--
-- Name: evento_equipos evento_equipos_equipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_equipos
    ADD CONSTRAINT evento_equipos_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES public.equipos(id) ON DELETE CASCADE;


--
-- Name: evento_equipos evento_equipos_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_equipos
    ADD CONSTRAINT evento_equipos_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE CASCADE;


--
-- Name: eventos fk_eventos_campeonato; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT fk_eventos_campeonato FOREIGN KEY (campeonato_id) REFERENCES public.campeonatos(id) ON DELETE CASCADE;


--
-- Name: grupos fk_grupos_evento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT fk_grupos_evento FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE SET NULL;


--
-- Name: partidos fk_partidos_evento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partidos
    ADD CONSTRAINT fk_partidos_evento FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE SET NULL;


--
-- Name: goleadores goleadores_jugador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goleadores
    ADD CONSTRAINT goleadores_jugador_id_fkey FOREIGN KEY (jugador_id) REFERENCES public.jugadores(id);


--
-- Name: goleadores goleadores_partido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goleadores
    ADD CONSTRAINT goleadores_partido_id_fkey FOREIGN KEY (partido_id) REFERENCES public.partidos(id) ON DELETE CASCADE;


--
-- Name: grupo_equipos grupo_equipos_equipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupo_equipos
    ADD CONSTRAINT grupo_equipos_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES public.equipos(id) ON DELETE CASCADE;


--
-- Name: grupo_equipos grupo_equipos_grupo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupo_equipos
    ADD CONSTRAINT grupo_equipos_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos(id) ON DELETE CASCADE;


--
-- Name: grupos grupos_campeonato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_campeonato_id_fkey FOREIGN KEY (campeonato_id) REFERENCES public.campeonatos(id) ON DELETE CASCADE;


--
-- Name: jugadores jugadores_equipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jugadores
    ADD CONSTRAINT jugadores_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES public.equipos(id) ON DELETE CASCADE;


--
-- Name: partido_planillas partido_planillas_partido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partido_planillas
    ADD CONSTRAINT partido_planillas_partido_id_fkey FOREIGN KEY (partido_id) REFERENCES public.partidos(id) ON DELETE CASCADE;


--
-- Name: partidos partidos_campeonato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partidos
    ADD CONSTRAINT partidos_campeonato_id_fkey FOREIGN KEY (campeonato_id) REFERENCES public.campeonatos(id) ON DELETE CASCADE;


--
-- Name: partidos_eliminatoria partidos_eliminatoria_equipo_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partidos_eliminatoria
    ADD CONSTRAINT partidos_eliminatoria_equipo_local_id_fkey FOREIGN KEY (equipo_local_id) REFERENCES public.equipos(id);


--
-- Name: partidos_eliminatoria partidos_eliminatoria_equipo_visitante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partidos_eliminatoria
    ADD CONSTRAINT partidos_eliminatoria_equipo_visitante_id_fkey FOREIGN KEY (equipo_visitante_id) REFERENCES public.equipos(id);


--
-- Name: partidos_eliminatoria partidos_eliminatoria_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partidos_eliminatoria
    ADD CONSTRAINT partidos_eliminatoria_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE CASCADE;


--
-- Name: partidos_eliminatoria partidos_eliminatoria_ganador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partidos_eliminatoria
    ADD CONSTRAINT partidos_eliminatoria_ganador_id_fkey FOREIGN KEY (ganador_id) REFERENCES public.equipos(id);


--
-- Name: partidos_eliminatoria partidos_eliminatoria_partido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partidos_eliminatoria
    ADD CONSTRAINT partidos_eliminatoria_partido_id_fkey FOREIGN KEY (partido_id) REFERENCES public.partidos(id);


--
-- Name: partidos_eliminatoria partidos_eliminatoria_slot_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partidos_eliminatoria
    ADD CONSTRAINT partidos_eliminatoria_slot_local_id_fkey FOREIGN KEY (slot_local_id) REFERENCES public.partidos_eliminatoria(id);


--
-- Name: partidos_eliminatoria partidos_eliminatoria_slot_visitante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partidos_eliminatoria
    ADD CONSTRAINT partidos_eliminatoria_slot_visitante_id_fkey FOREIGN KEY (slot_visitante_id) REFERENCES public.partidos_eliminatoria(id);


--
-- Name: partidos partidos_equipo_local_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partidos
    ADD CONSTRAINT partidos_equipo_local_id_fkey FOREIGN KEY (equipo_local_id) REFERENCES public.equipos(id);


--
-- Name: partidos partidos_equipo_visitante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partidos
    ADD CONSTRAINT partidos_equipo_visitante_id_fkey FOREIGN KEY (equipo_visitante_id) REFERENCES public.equipos(id);


--
-- Name: partidos partidos_grupo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partidos
    ADD CONSTRAINT partidos_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos(id);


--
-- Name: tarjetas tarjetas_equipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarjetas
    ADD CONSTRAINT tarjetas_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES public.equipos(id) ON DELETE SET NULL;


--
-- Name: tarjetas tarjetas_jugador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarjetas
    ADD CONSTRAINT tarjetas_jugador_id_fkey FOREIGN KEY (jugador_id) REFERENCES public.jugadores(id) ON DELETE SET NULL;


--
-- Name: tarjetas tarjetas_partido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tarjetas
    ADD CONSTRAINT tarjetas_partido_id_fkey FOREIGN KEY (partido_id) REFERENCES public.partidos(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict wlN7LiWRujRSqXUnq3EQvqTBWjPiWEqrUoVUQ9d33vi8INj6VDYwtKBImcMXVFd

