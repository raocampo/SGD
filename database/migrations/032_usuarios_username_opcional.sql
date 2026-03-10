ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS username VARCHAR(80);

ALTER TABLE usuarios
  ALTER COLUMN email DROP NOT NULL;

UPDATE usuarios
SET email = NULL
WHERE TRIM(COALESCE(email, '')) = '';

UPDATE usuarios
SET username = NULL
WHERE TRIM(COALESCE(username, '')) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_username_unique
ON usuarios(LOWER(username))
WHERE username IS NOT NULL;

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_identificador_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_identificador_check
  CHECK (
    (email IS NOT NULL AND btrim(email) <> '')
    OR (username IS NOT NULL AND btrim(username) <> '')
  );
