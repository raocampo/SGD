-- Migracion 019: contenido institucional editable del portal publico

CREATE TABLE IF NOT EXISTS portal_contenido (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hero_title TEXT NOT NULL DEFAULT 'Organiza tus torneos de forma rápida',
  hero_description TEXT NOT NULL DEFAULT 'Gestiona campeonatos, categorías y equipos en una plataforma clara, moderna y enfocada en el rendimiento deportivo.',
  hero_chip VARCHAR(120) NOT NULL DEFAULT 'EMPIEZA UNA DEMO',
  hero_cta_label VARCHAR(120) NOT NULL DEFAULT 'Entra',
  about_title VARCHAR(180) NOT NULL DEFAULT 'Loja Torneos & Competencias',
  about_text_1 TEXT NOT NULL DEFAULT 'LT&C impulsa campeonatos de futbol con una gestion ordenada de equipos, jugadores, calendarios, reportes y control administrativo.',
  about_text_2 TEXT NOT NULL DEFAULT 'Nuestro objetivo es brindar una experiencia clara tanto para organizadores como para dirigentes y aficionados.',
  about_image_url TEXT,
  contact_title VARCHAR(180) NOT NULL DEFAULT 'Escríbenos',
  contact_description TEXT NOT NULL DEFAULT 'Si quieres organizar tu campeonato con LT&C, contáctanos y te ayudamos a implementar todo el flujo deportivo.',
  contact_email VARCHAR(180) NOT NULL DEFAULT 'lojatorneosycompetencia@gmail.com',
  contact_phone VARCHAR(40),
  facebook_url TEXT,
  instagram_url TEXT,
  whatsapp_url TEXT,
  cards_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO portal_contenido (
  id,
  facebook_url,
  instagram_url,
  whatsapp_url,
  cards_json
)
SELECT
  1,
  'https://www.facebook.com/LojaTorneosCompetencia',
  'https://www.instagram.com/lojatorneoycompetencia',
  'https://wa.me/593982413081',
  '[
    {"titulo":"Gestión clara","descripcion":"Organiza torneos, equipos y cronogramas con una operación centralizada.","icono":"fa-layer-group"},
    {"titulo":"Control deportivo","descripcion":"Administra planillas, estadísticas, reportes y seguimiento competitivo.","icono":"fa-clipboard-list"},
    {"titulo":"Portal institucional","descripcion":"Publica novedades, galería y contacto oficial de LT&C desde el CMS.","icono":"fa-globe"}
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM portal_contenido WHERE id = 1);
