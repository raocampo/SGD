--
-- PostgreSQL database dump
--

\restrict 8jlXsYbCrfBgkfgWhaHkh4cGIVqKAM46c9T3uVECTxmZF2RGvJqwaxiocy5g7ta

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
-- Data for Name: archivos; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: campeonatos; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.campeonatos (id, nombre, tipo_futbol, fecha_inicio, fecha_fin, max_equipos, min_jugador, max_jugador, estado, created_at, updated_at, sistema_puntuacion, organizador, logo_url, color_primario, color_secundario, color_acento, evento_id, reglas_desempate, requiere_foto_cedula, requiere_foto_carnet, genera_carnets) VALUES (1, 'Torneo de Invierno 2026', 'futbol_7', '2026-03-20', '2026-06-20', NULL, 5, 20, 'planificacion', '2026-02-10 21:55:24.265045', '2026-02-10 21:55:24.265045', 'tradicional', 'Loja Torneos y Competencia (LT&C)', '/uploads/campeonatos/1770778524120-398565661.jpeg', '#c4b36e', '#cdd6ea', '#000000', NULL, '["puntos","diferencia_goles","goles_favor"]', false, false, false);


--
-- Data for Name: canchas; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: equipos; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (1, 1, 'Rock United FC', 'Marco Alvarado', 'Cristian Alvarado', '#e53935', '0997172786', 'rockunited@email.com', '2026-02-16 21:30:55.280327', false, '/uploads/equipos/1771295455238-880748753.png', NULL, 'Marlon Carrion', NULL, NULL, NULL);
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (2, 1, 'Los Panitas FC', 'Edison Malla', 'Jorge Herrera', '#3949ab', '0978893520', 'panitasfc@correo.com', '2026-02-16 21:55:41.366675', false, '/uploads/equipos/1771296941325-791665700.png', NULL, 'Jhonatan Paute', '#3949ab', '#fffff', '#ffb300');
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (3, 1, 'Exodo', 'Geovanny Lopez', 'Yordy Paucar', '#212121', '0978893520', 'exodo@mail.com', '2026-02-16 22:42:08.965116', false, '/uploads/equipos/1771299728797-298975829.png', NULL, 'Camila Malla', '#212121', '#fffff', '#ffb300');
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (4, 1, 'Hueca Guayaca', 'El mono', 'El mono Uno', '#3949ab', '0997172786', 'huecaguayaca@email.com', '2026-02-16 22:43:34.313039', false, '/uploads/equipos/1771299814278-191674898.png', NULL, NULL, '#3949ab', '#00acc1', '#fb8c00');
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (5, 1, '80 FC', 'Gonzalo Valle', 'David Luzuriaga', '#e53935', '0931176591', '80fc@correo.com', '2026-02-17 09:24:08.798909', false, '/uploads/equipos/1771338248759-186586007.png', NULL, NULL, '#e53935', '#212121', '#00acc1');
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (6, 1, 'Guerreros del Patron', 'Jhonatan Paute', 'German Malla', '#00897b', '0999219699', 'guerrerospatron@email.com', '2026-02-17 09:25:49.117383', false, '/uploads/equipos/1771338349080-282243478.png', NULL, NULL, '#00897b', '#d81b60', '#3949ab');
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (7, 1, 'Megafiestas', 'Miguel Paucar', 'Jorge Paucar', '#3949ab', '0991467383', 'megafiestas@email.com', '2026-02-17 09:27:28.21649', false, '/uploads/equipos/1771338448043-684653733.png', NULL, NULL, '#3949ab', '#757575', NULL);
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (8, 1, 'Templarios', 'Steve Chicaiza', 'Jorge Chicaiza', '#212121', '0939238787', 'templario@correo.com', '2026-02-17 09:28:43.521481', false, '/uploads/equipos/1771338523486-446468184.png', NULL, NULL, '#212121', '#00acc1', NULL);
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (9, 1, 'Talleres Valarezo', 'Jorge Valarezo', 'Enrique Herrera', '#e53935', '0967023551', 'talleresvalarezo@email.com', '2026-02-17 09:30:23.668783', false, '/uploads/equipos/1771338623632-449306450.png', NULL, NULL, '#e53935', '#039be5', NULL);
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (10, 1, 'Sauces Legend Crew', 'Luis Loyola', 'Jhon Elizalde', '#00897b', '0980217804', 'sauceslegend@correo.com', '2026-02-17 09:33:00.563372', false, '/uploads/equipos/1771338780526-913654317.png', NULL, NULL, '#00897b', '#fb8c00', NULL);
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (11, 1, 'Oro Sporting', 'Alberto Oro', 'Angel Oro', '#ffb300', '0997955935', 'orosporting@email.com', '2026-02-17 09:34:05.443634', false, '/uploads/equipos/1771338845406-374229285.png', NULL, NULL, '#ffb300', '#212121', NULL);
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (12, 1, 'Pupilos FC', 'Samuel Guaman', 'Kevin Saragocin', '#1e88e5', '099493500', 'pupilos@email.com', '2026-02-17 09:35:11.472096', false, '/uploads/equipos/1771338911426-453677029.png', NULL, NULL, '#1e88e5', '#3949ab', NULL);
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (13, 1, 'Club Deportivo Embajadores', 'Robert Ocampo', 'Liliana Herrera', '#d81b60', '0978893520', 'clubembajadores@email.com', '2026-02-17 09:36:27.518237', false, '/uploads/equipos/1771338987481-709804370.png', NULL, 'Ramón Aguirre', '#d81b60', '#3949ab', '#212121');
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (14, 1, 'Granada Futbol Club', 'Jose Guachisaca', 'Luis Guachisaca', '#212121', '0998297980', 'granadafc@email.com', '2026-02-17 09:38:03.090085', false, '/uploads/equipos/1771339083054-599714082.png', NULL, NULL, '#212121', '#fdd835', NULL);
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (15, 1, 'Club Deportivo Embajadores Z', 'Erick Vallejo', 'Robert Ocampo', '#d81b60', '0996323106', 'cdembajadoresz@email.com', '2026-02-17 09:39:54.017773', false, '/uploads/equipos/1771339193981-297032639.png', NULL, 'Camila Herrera', '#d81b60', '#3949ab', NULL);
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (16, 1, 'San Rafael', 'Jostin Jaramillo', 'Leiner Jaramillo', '#e53935', '0986971284', 'sanrafael@correo.com', '2026-02-17 09:41:45.205694', false, '/uploads/equipos/1771339305170-632653171.jpg', NULL, 'Ivan Acaro', '#e53935', '#1e88e5', '#6d4c41');
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (17, 1, 'Serviplast FC', 'Jose Rodriguez', 'Luis Adrianzen', '#212121', '0995296900', 'serviplastfc@email.com', '2026-02-17 09:43:50.746084', false, '/uploads/equipos/1771339430571-26923051.jpg', NULL, NULL, '#212121', '#43a047', '#c0ca33');
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (18, 1, 'La Roma', 'Fernando Ocampo', 'Mijael Rosero', '#00897b', '0986595632', 'laroma@correo.com', '2026-02-17 09:47:40.358141', false, '/uploads/equipos/1771339660322-403369755.jpg', NULL, NULL, '#00897b', '#212121', NULL);
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (19, 1, 'Alianza FC', 'Jorge Montoya', 'Cesar Montoya', '#fb8c00', '0995516865', 'alianzafc@correo.com', '2026-02-17 09:50:10.519915', false, '/uploads/equipos/1771339810484-400782350.jpg', NULL, NULL, '#fb8c00', '#3949ab', NULL);
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (20, 1, 'Inter FC', 'Marco Ayora', 'Edwin Ayora', '#3949ab', '0990357634', 'interfc@email.com', '2026-02-17 09:52:11.038226', false, '/uploads/equipos/1771339930892-906917323.png', NULL, 'Jose Ayora', '#3949ab', '#212121', NULL);
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (21, 1, 'Borussia Dormund', 'Mateo Malla', 'Sofia Herrera', '#00897b', '0982229033', 'borussidormund@email.com', '2026-02-17 10:06:27.207378', false, '/uploads/equipos/1771340787167-213875060.png', NULL, 'Camila Herrera', '#00897b', '#fb8c00', NULL);
INSERT INTO public.equipos (id, campeonato_id, nombre, director_tecnico, asistente_tecnico, color_equipo, telefono, email, created_at, cabeza_serie, logo_url, evento_id, medico, color_primario, color_secundario, color_terciario) VALUES (22, 1, 'Leones FC', 'Richard León', 'Antonio León', '#ffb300', '0931176591', 'leonesfc@correo.com', '2026-02-17 14:38:08.785356', false, '/uploads/equipos/1771357088746-867936870.jpg', NULL, 'Richard Pachar', '#ffb300', '#3949ab', NULL);


--
-- Data for Name: evento_canchas; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: evento_equipos; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 1, '2026-02-16 21:30:55.303238');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 2, '2026-02-16 21:55:41.380251');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 4, '2026-02-16 22:43:34.334441');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 5, '2026-02-17 09:24:08.81886');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 6, '2026-02-17 09:25:49.12211');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 7, '2026-02-17 09:27:28.221739');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 8, '2026-02-17 09:28:43.526199');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 9, '2026-02-17 09:30:23.673815');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 10, '2026-02-17 09:33:00.568084');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 11, '2026-02-17 09:34:05.448977');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 12, '2026-02-17 09:35:11.481324');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 13, '2026-02-17 09:36:27.522983');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 14, '2026-02-17 09:38:03.094877');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 15, '2026-02-17 09:39:54.022691');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 16, '2026-02-17 09:41:45.210317');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 17, '2026-02-17 09:43:50.751434');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 18, '2026-02-17 09:47:40.362763');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 19, '2026-02-17 09:50:10.524381');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 20, '2026-02-17 09:52:11.043491');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 21, '2026-02-17 10:06:27.221441');
INSERT INTO public.evento_equipos (evento_id, equipo_id, created_at) VALUES (4, 22, '2026-02-17 14:38:08.793111');


--
-- Data for Name: eventos; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.eventos (id, nombre, organizador, fecha_inicio, fecha_fin, estado, created_at, updated_at, campeonato_id, modalidad, horario_weekday_inicio, horario_weekday_fin, horario_sab_inicio, horario_sab_fin, horario_dom_inicio, horario_dom_fin) VALUES (2, 'Sub +40', NULL, '2026-03-20', '2026-06-20', 'activo', '2026-02-11 12:10:08.431837', '2026-02-11 12:10:08.431837', 1, 'weekend', '19:00:00', '22:00:00', '13:00:00', '18:00:00', '08:00:00', '17:00:00');
INSERT INTO public.eventos (id, nombre, organizador, fecha_inicio, fecha_fin, estado, created_at, updated_at, campeonato_id, modalidad, horario_weekday_inicio, horario_weekday_fin, horario_sab_inicio, horario_sab_fin, horario_dom_inicio, horario_dom_fin) VALUES (3, 'Femenino', NULL, '2026-03-20', '2026-06-20', 'activo', '2026-02-11 12:10:38.660627', '2026-02-11 12:10:38.660627', 1, 'weekend', '19:00:00', '22:00:00', '13:00:00', '18:00:00', '08:00:00', '17:00:00');
INSERT INTO public.eventos (id, nombre, organizador, fecha_inicio, fecha_fin, estado, created_at, updated_at, campeonato_id, modalidad, horario_weekday_inicio, horario_weekday_fin, horario_sab_inicio, horario_sab_fin, horario_dom_inicio, horario_dom_fin) VALUES (4, 'Abierta', NULL, '2026-03-20', '2026-06-20', 'activo', '2026-02-15 18:09:28.44023', '2026-02-15 18:09:28.44023', 1, 'weekend', '19:00:00', '22:00:00', '13:00:00', '18:00:00', '08:00:00', '17:00:00');


--
-- Data for Name: goleadores; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: grupo_equipos; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (9, 19, 1, '2026-02-17 11:32:38.555631');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (10, 18, 1, '2026-02-17 11:32:44.217109');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (11, 21, 1, '2026-02-17 11:32:50.890583');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (12, 11, 1, '2026-02-17 11:32:59.183249');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (9, 15, 2, '2026-02-17 11:33:06.315148');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (10, 2, 2, '2026-02-17 11:33:27.784451');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (11, 9, 2, '2026-02-17 11:33:36.482681');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (12, 14, 2, '2026-02-17 11:33:43.605773');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (9, 16, 3, '2026-02-17 11:33:49.782332');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (10, 17, 3, '2026-02-17 11:33:55.176787');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (11, 5, 3, '2026-02-17 11:34:03.021159');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (12, 12, 3, '2026-02-17 11:34:11.326166');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (9, 7, 4, '2026-02-17 11:34:16.538786');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (10, 20, 4, '2026-02-17 11:34:23.482383');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (11, 6, 4, '2026-02-17 11:34:33.746402');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (12, 13, 4, '2026-02-17 11:34:39.786017');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (9, 8, 5, '2026-02-17 11:34:45.020354');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (10, 10, 5, '2026-02-17 11:34:50.652669');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (11, 1, 5, '2026-02-17 11:34:56.666769');
INSERT INTO public.grupo_equipos (grupo_id, equipo_id, orden_sorteo, fecha_sorteo) VALUES (12, 4, 5, '2026-02-17 11:35:02.216945');


--
-- Data for Name: grupos; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.grupos (id, campeonato_id, nombre_grupo, letra_grupo, created_at, evento_id) VALUES (9, NULL, 'Grupo A', 'A', '2026-02-17 11:32:29.687135', 4);
INSERT INTO public.grupos (id, campeonato_id, nombre_grupo, letra_grupo, created_at, evento_id) VALUES (10, NULL, 'Grupo B', 'B', '2026-02-17 11:32:29.689082', 4);
INSERT INTO public.grupos (id, campeonato_id, nombre_grupo, letra_grupo, created_at, evento_id) VALUES (11, NULL, 'Grupo C', 'C', '2026-02-17 11:32:29.689533', 4);
INSERT INTO public.grupos (id, campeonato_id, nombre_grupo, letra_grupo, created_at, evento_id) VALUES (12, NULL, 'Grupo D', 'D', '2026-02-17 11:32:29.689904', 4);


--
-- Data for Name: jugadores; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.jugadores (id, equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan, created_at, foto_cedula_url, foto_carnet_url) VALUES (12, 13, 'Angel', 'Gauchichulca', '1523698250', '2000-08-06', 'Volante', NULL, false, '2026-02-17 21:05:14.508776', NULL, NULL);
INSERT INTO public.jugadores (id, equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan, created_at, foto_cedula_url, foto_carnet_url) VALUES (13, 13, 'Romel', 'Ramón', '1756983451', '2004-11-20', 'Volante', NULL, false, '2026-02-17 21:51:33.13363', NULL, NULL);
INSERT INTO public.jugadores (id, equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan, created_at, foto_cedula_url, foto_carnet_url) VALUES (1, 5, 'David', 'Castillo', '1103565240', '2000-06-25', 'Defensa', NULL, false, '2026-02-17 16:21:33.749797', NULL, NULL);
INSERT INTO public.jugadores (id, equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan, created_at, foto_cedula_url, foto_carnet_url) VALUES (2, 5, 'Yuren', 'Castillo', '1105846296', '2000-05-20', 'Defensa', NULL, false, '2026-02-17 16:22:14.274997', NULL, NULL);
INSERT INTO public.jugadores (id, equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan, created_at, foto_cedula_url, foto_carnet_url) VALUES (3, 5, 'Kevin', 'Ocampo', '1104598653', '1998-02-01', 'Volante', NULL, false, '2026-02-17 20:18:23.476195', NULL, NULL);
INSERT INTO public.jugadores (id, equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan, created_at, foto_cedula_url, foto_carnet_url) VALUES (4, 5, 'Andy', 'Jumbo', '1105987453', '1999-04-02', 'Defensa', NULL, false, '2026-02-17 20:19:04.124757', NULL, NULL);
INSERT INTO public.jugadores (id, equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan, created_at, foto_cedula_url, foto_carnet_url) VALUES (5, 5, 'Pablo', 'Guerrero', '145698321', '1995-07-15', 'Arquero', NULL, false, '2026-02-17 20:27:45.621916', NULL, NULL);
INSERT INTO public.jugadores (id, equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan, created_at, foto_cedula_url, foto_carnet_url) VALUES (6, 5, 'Byron', 'Reyes', '1589324687', '2003-03-10', 'Delantero', NULL, false, '2026-02-17 20:28:32.364814', NULL, NULL);
INSERT INTO public.jugadores (id, equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan, created_at, foto_cedula_url, foto_carnet_url) VALUES (7, 5, 'Edison', 'Estrella', '1456329510', '2002-04-05', 'Volante', NULL, false, '2026-02-17 20:29:11.56595', NULL, NULL);
INSERT INTO public.jugadores (id, equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan, created_at, foto_cedula_url, foto_carnet_url) VALUES (8, 5, 'Yony', 'Iñiguez', '1587423699', '2005-05-03', 'Delantero', NULL, false, '2026-02-17 20:29:53.543338', NULL, NULL);
INSERT INTO public.jugadores (id, equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan, created_at, foto_cedula_url, foto_carnet_url) VALUES (9, 5, 'Oscar', 'Terreros', '1489526710', '1995-04-02', 'Delantero', NULL, false, '2026-02-17 20:30:57.29314', NULL, NULL);
INSERT INTO public.jugadores (id, equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan, created_at, foto_cedula_url, foto_carnet_url) VALUES (10, 5, 'Cristopher', 'Pardo', '1038965421', '1998-06-07', 'Volante', NULL, false, '2026-02-17 20:31:45.003428', NULL, NULL);
INSERT INTO public.jugadores (id, equipo_id, nombre, apellido, cedidentidad, fecha_nacimiento, posicion, numero_camiseta, es_capitan, created_at, foto_cedula_url, foto_carnet_url) VALUES (11, 5, 'Diego', 'Iñiguez', '1789652364', '2004-01-06', 'Defensa', NULL, false, '2026-02-17 20:32:53.475685', NULL, NULL);


--
-- Data for Name: partido_planillas; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: partidos; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (2, 1, 9, 15, 16, '2026-03-21', '14:40:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.198726', 1, '2026-02-17 12:12:52.198726', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (3, 1, 10, 10, 20, '2026-03-21', '16:20:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.200246', 1, '2026-02-17 12:12:52.200246', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (4, 1, 10, 17, 18, '2026-03-22', '08:00:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.201789', 1, '2026-02-17 12:12:52.201789', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (5, 1, 11, 5, 21, '2026-03-22', '09:40:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.203079', 1, '2026-02-17 12:12:52.203079', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (6, 1, 11, 6, 9, '2026-03-22', '11:20:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.20416', 1, '2026-02-17 12:12:52.20416', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (7, 1, 12, 11, 14, '2026-03-22', '13:00:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.205093', 1, '2026-02-17 12:12:52.205093', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (8, 1, 12, 12, 13, '2026-03-22', '14:40:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.205857', 1, '2026-02-17 12:12:52.205857', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (9, 1, 9, 19, 7, '2026-03-28', '13:00:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.20677', 2, '2026-02-17 12:12:52.20677', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (10, 1, 9, 15, 8, '2026-03-28', '14:40:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.20772', 2, '2026-02-17 12:12:52.20772', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (11, 1, 10, 20, 2, '2026-03-28', '16:20:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.208643', 2, '2026-02-17 12:12:52.208643', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (12, 1, 10, 17, 10, '2026-03-29', '08:00:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.209425', 2, '2026-02-17 12:12:52.209425', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (13, 1, 11, 21, 1, '2026-03-29', '09:40:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.21017', 2, '2026-02-17 12:12:52.21017', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (14, 1, 11, 6, 5, '2026-03-29', '11:20:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.211049', 2, '2026-02-17 12:12:52.211049', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (15, 1, 12, 14, 4, '2026-03-29', '13:00:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.211955', 2, '2026-02-17 12:12:52.211955', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (16, 1, 12, 12, 11, '2026-03-29', '14:40:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.212975', 2, '2026-02-17 12:12:52.212975', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (17, 1, 9, 7, 16, '2026-04-04', '13:00:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.214519', 3, '2026-02-17 12:12:52.214519', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (18, 1, 9, 19, 15, '2026-04-04', '14:40:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.21626', 3, '2026-02-17 12:12:52.21626', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (19, 1, 10, 2, 18, '2026-04-04', '16:20:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.217446', 3, '2026-02-17 12:12:52.217446', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (20, 1, 10, 20, 17, '2026-04-05', '08:00:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.218601', 3, '2026-02-17 12:12:52.218601', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (21, 1, 11, 1, 9, '2026-04-05', '09:40:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.219398', 3, '2026-02-17 12:12:52.219398', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (22, 1, 11, 21, 6, '2026-04-05', '11:20:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.220352', 3, '2026-02-17 12:12:52.220352', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (23, 1, 12, 4, 13, '2026-04-05', '13:00:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.221502', 3, '2026-02-17 12:12:52.221502', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (24, 1, 12, 14, 12, '2026-04-05', '14:40:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.222973', 3, '2026-02-17 12:12:52.222973', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (25, 1, 9, 15, 7, '2026-04-11', '13:00:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.224072', 4, '2026-02-17 12:12:52.224072', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (26, 1, 9, 8, 16, '2026-04-11', '14:40:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.22499', 4, '2026-02-17 12:12:52.22499', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (27, 1, 10, 17, 2, '2026-04-11', '16:20:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.225773', 4, '2026-02-17 12:12:52.225773', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (28, 1, 10, 10, 18, '2026-04-12', '08:00:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.22662', 4, '2026-02-17 12:12:52.22662', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (29, 1, 11, 6, 1, '2026-04-12', '09:40:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.227338', 4, '2026-02-17 12:12:52.227338', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (30, 1, 11, 5, 9, '2026-04-12', '11:20:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.228053', 4, '2026-02-17 12:12:52.228053', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (31, 1, 12, 12, 4, '2026-04-12', '13:00:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.228875', 4, '2026-02-17 12:12:52.228875', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (32, 1, 12, 11, 13, '2026-04-12', '14:40:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.229647', 4, '2026-02-17 12:12:52.229647', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (33, 1, 9, 7, 8, '2026-04-18', '13:00:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.231103', 5, '2026-02-17 12:12:52.231103', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (34, 1, 9, 16, 19, '2026-04-18', '14:40:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.232821', 5, '2026-02-17 12:12:52.232821', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (35, 1, 10, 2, 10, '2026-04-18', '16:20:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.23376', 5, '2026-02-17 12:12:52.23376', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (36, 1, 10, 18, 20, '2026-04-19', '08:00:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.234571', 5, '2026-02-17 12:12:52.234571', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (37, 1, 11, 1, 5, '2026-04-19', '09:40:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.235308', 5, '2026-02-17 12:12:52.235308', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (38, 1, 11, 9, 21, '2026-04-19', '11:20:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.236072', 5, '2026-02-17 12:12:52.236072', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (39, 1, 12, 4, 11, '2026-04-19', '13:00:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.236783', 5, '2026-02-17 12:12:52.236783', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (40, 1, 12, 13, 14, '2026-04-19', '14:40:00', 'Cancha 1', 0, 0, 'pendiente', '2026-02-17 12:12:52.237947', 5, '2026-02-17 12:12:52.237947', false, NULL, NULL, true, 4);
INSERT INTO public.partidos (id, campeonato_id, grupo_id, equipo_local_id, equipo_visitante_id, fecha_partido, hora_partido, cancha, resultado_local, resultado_visitante, estado, created_at, jornada, update_at, shootouts, resultado_local_shootouts, resultado_visitante_shootouts, es_ida, evento_id) VALUES (1, 1, 9, 8, 19, '2026-03-21', '13:00:00', 'Sintética Don Rafa', 0, 0, 'pendiente', '2026-02-17 12:12:52.188144', 1, '2026-02-17 14:29:05.518415', false, NULL, NULL, true, 4);


--
-- Data for Name: partidos_eliminatoria; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tarjetas; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: archivos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.archivos_id_seq', 1, false);


--
-- Name: campeonatos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.campeonatos_id_seq', 1, true);


--
-- Name: canchas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.canchas_id_seq', 1, false);


--
-- Name: equipos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.equipos_id_seq', 22, true);


--
-- Name: eventos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.eventos_id_seq', 4, true);


--
-- Name: goleadores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.goleadores_id_seq', 1, false);


--
-- Name: grupos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.grupos_id_seq', 12, true);


--
-- Name: jugadores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.jugadores_id_seq', 13, true);


--
-- Name: partido_planillas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.partido_planillas_id_seq', 1, false);


--
-- Name: partidos_eliminatoria_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.partidos_eliminatoria_id_seq', 1, false);


--
-- Name: partidos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.partidos_id_seq', 40, true);


--
-- Name: tarjetas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tarjetas_id_seq', 1, false);


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

\unrestrict 8jlXsYbCrfBgkfgWhaHkh4cGIVqKAM46c9T3uVECTxmZF2RGvJqwaxiocy5g7ta

