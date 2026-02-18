# Propuesta – Sistema de Gestión Deportiva (Torneos / Campeonatos)

## 1. Resumen Ejecutivo
El **Sistema de Gestión Deportiva** tiene como objetivo digitalizar y profesionalizar la organización de torneos y campeonatos, facilitando la administración de equipos, jugadores, grupos, fixture, tablas de posiciones y fases eliminatorias.  
Además, incluye un **Portal Web público** para que el público general consulte información actualizada de los torneos, resultados, noticias y contenido editorial.

---

## 2. Objetivos del Sistema
- Reducir tiempos operativos y errores manuales en la gestión de torneos.
- Automatizar la generación de **fixtures** por rangos de fechas y reglas de calendario.
- Mantener integridad de datos (ej. un jugador **no puede estar en dos equipos** a la vez).
- Publicar información en tiempo real para el público: tablas, partidos, resultados, clasificados, noticias.
- Soportar múltiples torneos simultáneos, categorías y temporadas.

---

## 3. Alcance Funcional (Módulos Principales)

### 3.1 Gestión de Torneos / Campeonatos
- Creación y administración de torneos (ej. **Campeonato Invierno 2026**).
- Configuración de:
  - Nombre, temporada, organizador, sede(s)
  - Fecha de inicio y fin
  - Reglamento / bases del torneo (PDF o enlace)
  - Número máximo de equipos por categoría
- Estados del torneo: **Borrador → Inscripción → En Curso → Finalizado → Archivado**

---

### 3.2 Categorías del Torneo
- Creación de categorías por torneo, por ejemplo:
  - Abierta
  - Sub +40
  - Sub +50
  - Femenino
  - Juvenil, etc.
- Reglas configurables por categoría:
  - Número de equipos
  - Formato (grupos, liga, eliminatoria, mixto)
  - Clasificados por grupo
  - Reglas de desempate (diferencia de goles, goles a favor, enfrentamiento directo, fair play, etc.)

---

### 3.3 Gestión de Equipos
- Registro de equipos por torneo/categoría:
  - Nombre del equipo
  - Técnico/DT
  - Dueño/Representante
  - Contactos (teléfono, correo)
  - Colores, logo, uniforme
- Validaciones:
  - Equipo no duplicado por categoría
  - Control de inscripción por cupos

---

### 3.4 Gestión de Jugadores
- Registro de jugadores:
  - Nombres, documento, fecha de nacimiento, posición
  - Contacto y foto
- Relación jugador–equipo:
  - Un jugador **no puede pertenecer a dos equipos simultáneamente** dentro del mismo torneo/categoría.
  - Control de transferencias (opcional) con historial:
    - Fecha de alta/baja
    - Equipo anterior
    - Motivo
- Validación de elegibilidad por categoría (opcional):
  - Edad mínima/máxima para categorías +40, +50, etc.

---

### 3.5 Creación de Grupos (Manual / Automática / Aleatoria)
El sistema permitirá generar grupos de tres formas:

#### A) Manual asistida con “Ruleta”
- Se muestra una **ruleta/listado** con todos los equipos disponibles.
- Al asignar un equipo a un grupo:
  - Se elimina de la ruleta/listado automáticamente
  - Queda bloqueado para evitar duplicaciones
- Permite “deshacer” o reubicar equipos antes de confirmar.

#### B) Aleatoria automática
- Distribución aleatoria equilibrada por grupos.
- Validación de reglas (ej. evitar repetir club/sede si se define como restricción).

#### C) Con Cabezas de Serie
- Permite marcar equipos como **cabezas de serie**.
- Distribución automática ubicando cabezas de serie en grupos distintos.
- Luego relleno aleatorio o manual de equipos restantes.

---

### 3.6 Generación del Fixture (Calendario de Partidos)
El sistema generará el fixture automáticamente según:

- **Fecha de inicio y fin** del torneo/categoría
- Días disponibles de juego:
  - Solo fines de semana
  - Solo entre semana
  - Mixto
- Horarios disponibles:
  - Rango horario configurable (ej. 08:00–22:00)
  - Duración por partido (ej. 60/80/90 min)
  - Intervalo entre partidos
- Escenarios / canchas disponibles (si aplica):
  - 1 o múltiples canchas por sede
- Reglas:
  - Evitar que un equipo juegue dos partidos el mismo día (si así se define)
  - Descansos mínimos entre partidos
  - Generación de fechas/jornadas (Fecha 1, Fecha 2, etc.)
- Reprogramaciones:
  - Cambio de horario/cancha
  - Suspensión por lluvia
  - Registro de motivo y notificaciones

---

### 3.7 Resultados, Tablas de Posiciones y Clasificados
- Registro de resultados por partido:
  - Marcador, goleadores (opcional), tarjetas (opcional), observaciones
- Cálculo automático de tabla:
  - PJ, PG, PE, PP, GF, GC, DG, PTS
- Reglas de desempate configurables por torneo/categoría
- Clasificación automática:
  - Clasificados por grupo según cupos (ej. 1° y 2°)
  - Mejores terceros (si aplica)
- Vista pública en portal y vista administrativa

---

### 3.8 Fases Eliminatorias (32vos → Final)
- Generación automática del bracket:
  - 32vos, 16vos, 8vos, 4tos, semifinal, final
- Configuración:
  - Cruces predefinidos (A1 vs B2, etc.)
  - Sorteo automático
  - Partido único o ida/vuelta
  - Reglas de desempate: penales, gol de visitante, etc.
- Fixture de eliminatorias considerando calendario y horarios disponibles

---

## 4. Portal Web Público (Acceso para el Público)
- Landing / Home con torneos activos y próximos
- Secciones:
  - Torneos y categorías
  - Fixture por fecha/jornada
  - Resultados
  - Tabla de posiciones
  - Clasificados y llaves eliminatorias (bracket)
  - Equipos y plantillas (si se habilita)
  - Noticias / Blog / Comunicados
  - Galería multimedia (opcional)
- Buscador y filtros:
  - Por torneo, categoría, equipo, fecha
- Diseño responsive (móvil y escritorio)

---

## 5. Roles y Permisos (RBAC)
Se contemplan roles con permisos diferentes:

- **Administrador**
  - Control total del sistema, configuración general
- **Organizador / Operador**
  - Gestiona torneos, equipos, fixture, resultados
- **Árbitro / Mesa**
  - Registro de resultados y eventos del partido (si aplica)
- **Representante de Equipo (opcional)**
  - Carga de plantilla, datos del equipo, solicitud de cambios
- **Público**
  - Solo lectura (portal web)

---

## 6. Características Profesionales Recomendadas (Extras)
Para que el sistema sea **muy profesional**, se recomienda incluir:

### 6.1 Notificaciones Automáticas
- Avisos por:
  - Programación de partido
  - Reprogramación / suspensión
  - Confirmación de resultado
- Canales: Email y WhatsApp (opcional)

### 6.2 Auditoría y Trazabilidad
- Registro de acciones:
  - Quién creó/edito fixture, resultados, equipos
  - Fecha y hora
- Historial de cambios y reprogramaciones

### 6.3 Panel de Reportes
- Reportes por torneo:
  - Partidos jugados, pendientes
  - Goleadores (opcional)
  - Disciplina (opcional)
  - Estadísticas por equipo

### 6.4 Exportación e Impresión
- Exportar fixture a PDF/Excel
- Imprimir tabla de posiciones
- Descargar bracket eliminatorio

### 6.5 Seguridad y Buenas Prácticas
- HTTPS (SSL/TLS)
- Contraseñas cifradas (bcrypt)
- Tokens de sesión (JWT)
- Control de acceso por roles
- Backups automáticos de base de datos (recomendado)

---

# 7 Módulo Financiero (Inscripciones, Pagos, Multas, Arbitraje)

## 7.1 Inscripciones y Pagos
- Registro de inscripción por:
  - torneo, categoría, equipo
- Gestión de pagos:
  - inscripción (valor configurable)
  - pagos por programación (ej. arbitraje)
  - estados: **pendiente / parcial / pagado / vencido**
- Soporte de métodos de pago:
  - efectivo, transferencia, tarjeta (configurable)
- Emisión de comprobantes/recibos internos (PDF opcional).

## 7.2 Programación y Arbitraje
- Registro de costos asociados a cada partido:
  - arbitraje
  - logística (si aplica)
- Liquidación por partido/fecha/categoría.

## 7.3 Multas y Sanciones Económicas
- Registro de multas por:
  - tarjetas amarilla/roja (valores configurables)
  - inasistencia (walkover)
  - sanciones disciplinarias
  - daños/logística (opcional)
- Asociación automática:
  - si se registra tarjeta amarilla/roja en un partido, el sistema puede generar la multa (si está habilitado).

## 7.4 Estado de Cuenta por Equipo
- Cuenta corriente del equipo:
  - cargos (inscripción, arbitraje, multas)
  - abonos (pagos)
  - saldo actual
- Reportes:
  - equipos morosos
  - ingresos por categoría/torneo
  - recaudación por fechas

## 7.5 Reglas Financieras (Opcional)
- Bloqueos por morosidad:
  - impedir programación o habilitación de jugadores si saldo vencido (según política).
- Alertas:
  - notificación de pagos pendientes o multas nuevas (email/WhatsApp opcional).


## 8. Alcance Técnico (Sugerencia de Arquitectura)
- **Frontend Web Admin**: Panel para organizadores (gestión interna)
- **Portal Público**: Web de consulta de información para audiencia
- **Backend API**: Lógica de negocio y seguridad (REST/GraphQL)
- **Base de Datos**: Relacional (PostgreSQL) por integridad y relaciones

**Tecnologías sugeridas (modernas y escalables):**
- Frontend: React + Vite + TypeScript + TailwindCSS
- Backend: Node.js + Express (o NestJS)
- DB: PostgreSQL
- Hosting: Vercel (frontend) + Render/Railway (backend) + PostgreSQL gestionado

---

## 9. Entregables Propuestos
- Plataforma administrativa (login + panel de gestión)
- Portal web público
- Base de datos con relaciones y reglas de integridad
- Motor de fixture configurable (fechas/horarios/reglas)
- Tablas y clasificación automática
- Eliminatorias con bracket
- Manual básico de usuario y guía de administración
- Capacitación inicial (opcional)

---

## 10. Próximos Pasos
1. Validación del alcance (módulos obligatorios vs opcionales).
2. Definición del formato de torneo por categoría (grupos, liga, eliminatoria, mixto).
3. Diseño UI/UX (wireframes del panel admin y portal público).
4. Implementación MVP (versión inicial) y pruebas con torneo real.
5. Iteraciones y mejoras (notificaciones, reportes, portal avanzado).

---

## 10. Conclusión
Este Sistema de Gestión Deportiva permitirá administrar torneos de forma profesional, automatizada y transparente, mejorando la experiencia para organizadores, equipos y público general. Su diseño modular permite escalar a múltiples torneos, temporadas y reglas de competencia.

---

## Anexo de Seguimiento
Para control de avance real (hecho/parcial/pendiente) y prioridades de implementación, revisar:

- `docs/ESTADO_IMPLEMENTACION_SGD.md`
- `docs/BITACORA_AVANCES.md`
