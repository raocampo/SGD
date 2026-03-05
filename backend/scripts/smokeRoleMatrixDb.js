/* eslint-disable no-console */
require("dotenv").config();

const jwt = require("jsonwebtoken");
const { Client } = require("pg");

const DEFAULT_BASE_URL = "http://localhost:5000";
const baseUrl = String(process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
const jwtSecret = process.env.JWT_SECRET || "sgd-dev-secret-change-me";
const roles = ["administrador", "operador", "organizador", "tecnico", "dirigente", "jugador"];

function joinUrl(path) {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function compact(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function short(value, max = 180) {
  const content = compact(value);
  return content.length > max ? `${content.slice(0, max)}...` : content;
}

function toStatusList(map, role) {
  const value = map[role];
  if (Array.isArray(value)) return value;
  return [value];
}

async function request(path, token, method = "GET", body) {
  const res = await fetch(joinUrl(path), {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = null;
  }

  return {
    status: res.status,
    preview: short(json ? JSON.stringify(json) : text),
  };
}

async function getUsersByRole() {
  const client = new Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number.parseInt(String(process.env.DB_PORT || 5432), 10),
  });
  await client.connect();
  try {
    const users = {};
    for (const role of roles) {
      const row = await client.query(
        `
          SELECT id, nombre, email, rol, activo
          FROM usuarios
          WHERE activo = true AND LOWER(rol) = $1
          ORDER BY id ASC
          LIMIT 1
        `,
        [role]
      );
      users[role] = row.rows[0] || null;
    }
    return users;
  } finally {
    await client.end();
  }
}

function buildToken(user) {
  return jwt.sign(
    {
      id: Number(user.id),
      email: String(user.email || ""),
      rol: String(user.rol || "").toLowerCase(),
    },
    jwtSecret,
    { expiresIn: "20m" }
  );
}

async function main() {
  console.log(`[rbac-matrix] baseUrl=${baseUrl}`);
  const usersByRole = await getUsersByRole();

  const missingRoles = roles.filter((role) => !usersByRole[role]);
  if (missingRoles.length > 0) {
    throw new Error(`Faltan usuarios activos para roles: ${missingRoles.join(", ")}`);
  }

  const checks = [
    {
      name: "cms-noticias",
      method: "GET",
      path: "/api/noticias",
      expected: {
        administrador: 200,
        operador: 200,
        organizador: 403,
        tecnico: 403,
        dirigente: 403,
        jugador: 403,
      },
    },
    {
      name: "cms-galeria",
      method: "GET",
      path: "/api/galeria",
      expected: {
        administrador: 200,
        operador: 200,
        organizador: 403,
        tecnico: 403,
        dirigente: 403,
        jugador: 403,
      },
    },
    {
      name: "cms-contenido",
      method: "GET",
      path: "/api/portal-contenido",
      expected: {
        administrador: 200,
        operador: 200,
        organizador: 403,
        tecnico: 403,
        dirigente: 403,
        jugador: 403,
      },
    },
    {
      name: "cms-contacto",
      method: "GET",
      path: "/api/contacto",
      expected: {
        administrador: 200,
        operador: 200,
        organizador: 403,
        tecnico: 403,
        dirigente: 403,
        jugador: 403,
      },
    },
    {
      name: "deportivo-campeonatos",
      method: "GET",
      path: "/api/campeonatos",
      expected: {
        administrador: 200,
        operador: 403,
        organizador: 200,
        tecnico: 200,
        dirigente: 200,
        jugador: 200,
      },
    },
    {
      name: "mobile-session",
      method: "GET",
      path: "/api/mobile/v1/session",
      expected: {
        administrador: 200,
        operador: 200,
        organizador: 200,
        tecnico: 200,
        dirigente: 200,
        jugador: 200,
      },
    },
    {
      name: "mobile-usuarios",
      method: "GET",
      path: "/api/mobile/v1/usuarios",
      expected: {
        administrador: 200,
        operador: 403,
        organizador: 200,
        tecnico: 403,
        dirigente: 403,
        jugador: 403,
      },
    },
    {
      name: "web-usuarios",
      method: "GET",
      path: "/api/auth/usuarios",
      expected: {
        administrador: 200,
        operador: 403,
        organizador: 200,
        tecnico: 403,
        dirigente: 403,
        jugador: 403,
      },
    },
  ];

  const results = [];
  for (const role of roles) {
    const user = usersByRole[role];
    const token = buildToken(user);
    for (const check of checks) {
      const response = await request(check.path, token, check.method);
      const expectedStatus = toStatusList(check.expected, role);
      const ok = expectedStatus.includes(response.status);
      const row = {
        role,
        name: check.name,
        method: check.method,
        path: check.path,
        status: response.status,
        expected: expectedStatus.join("/"),
        ok,
        preview: response.preview,
      };
      results.push(row);
      console.log(
        `${ok ? "PASS" : "FAIL"} | ${row.role} | ${row.name} | ${row.method} ${row.path} | status=${row.status} expected=${row.expected} | ${row.preview}`
      );
    }
  }

  const failed = results.filter((row) => !row.ok);
  console.log(`[rbac-matrix] total=${results.length} passed=${results.length - failed.length} failed=${failed.length}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[rbac-matrix] fatal ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
