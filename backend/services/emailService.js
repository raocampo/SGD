let nodemailer = null;
try {
  // Dependencia opcional en desarrollo; si no existe se registra el enlace en consola.
  nodemailer = require("nodemailer");
} catch (_) {
  nodemailer = null;
}

function boolFromEnv(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).trim().toLowerCase() === "true";
}

function construirUrlReset(token, email) {
  const base =
    process.env.FRONTEND_RESET_URL ||
    process.env.FRONTEND_URL ||
    "http://127.0.0.1:5500/frontend/login.html";
  const url = new URL(base);
  url.searchParams.set("reset_token", String(token || ""));
  url.searchParams.set("email", String(email || ""));
  return url.toString();
}

function smtpConfig() {
  return {
    host: String(process.env.SMTP_HOST || "").trim(),
    port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
    user: String(process.env.SMTP_USER || "").trim(),
    pass: String(process.env.SMTP_PASS || "").trim(),
    secure: boolFromEnv(process.env.SMTP_SECURE, false),
    ignoreTLS: boolFromEnv(process.env.SMTP_IGNORE_TLS, false),
    from: String(process.env.MAIL_FROM || process.env.SMTP_USER || "").trim(),
  };
}

function smtpDisponible(cfg) {
  return Boolean(
    nodemailer &&
      cfg.host &&
      Number.isFinite(cfg.port) &&
      cfg.port > 0 &&
      cfg.user &&
      cfg.pass &&
      cfg.from
  );
}

async function enviarEmailRecuperacionPassword({ to, nombre, token }) {
  const destino = String(to || "").trim();
  const tokenPlano = String(token || "").trim();
  if (!destino || !tokenPlano) return { sent: false, reason: "payload_incompleto" };

  const resetUrl = construirUrlReset(tokenPlano, destino);
  const cfg = smtpConfig();
  if (!smtpDisponible(cfg)) {
    console.warn(`[auth] SMTP no configurado. Enlace de recuperación para ${destino}: ${resetUrl}`);
    return { sent: false, reason: "smtp_no_configurado", resetUrl };
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    ignoreTLS: cfg.ignoreTLS,
  });

  const saludo = nombre ? `Hola ${nombre},` : "Hola,";
  const text = `${saludo}

Recibimos una solicitud para restablecer tu contraseña en SGD.
Usa este enlace para continuar:
${resetUrl}

Si no solicitaste este cambio, puedes ignorar este mensaje.`;
  const html = `
    <p>${saludo}</p>
    <p>Recibimos una solicitud para restablecer tu contraseña en <strong>SGD</strong>.</p>
    <p>
      <a href="${resetUrl}" target="_blank" rel="noopener noreferrer">
        Restablecer contraseña
      </a>
    </p>
    <p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
  `;

  await transporter.sendMail({
    from: cfg.from,
    to: destino,
    subject: "Recuperación de contraseña - SGD",
    text,
    html,
  });

  return { sent: true };
}

// ── Helpers de plantilla ──────────────────────────────────────────────────────

function construirUrlLogin() {
  const base = String(
    process.env.FRONTEND_URL || "http://127.0.0.1:5500/frontend"
  ).replace(/\/$/, "");
  return `${base}/login.html`;
}

function wrapHtml(contenido) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8" /><style>
  body{font-family:sans-serif;color:#1e293b;margin:0;padding:0;background:#f8fafc;}
  .wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:12px;padding:32px 28px;border:1px solid #e2e8f0;}
  h2{margin:0 0 16px;font-size:20px;color:#0f172a;}
  p{margin:0 0 12px;font-size:14px;line-height:1.6;}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:#dbeafe;color:#1d4ed8;}
  .btn{display:inline-block;padding:10px 22px;background:#3498db;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-top:8px;}
  .footer{margin-top:24px;font-size:11px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:14px;}
  .data-row{display:flex;gap:8px;margin-bottom:6px;font-size:13px;}
  .data-lbl{color:#64748b;min-width:110px;font-weight:600;}
</style></head><body><div class="wrap">${contenido}</div></body></html>`;
}

async function enviarEmail({ to, subject, text, html }) {
  const cfg = smtpConfig();
  if (!smtpDisponible(cfg)) {
    console.info(`[email] SMTP no configurado. Correo para ${to}: ${subject}`);
    return { sent: false, reason: "smtp_no_configurado" };
  }
  const transporter = nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    ignoreTLS: cfg.ignoreTLS,
  });
  await transporter.sendMail({ from: cfg.from, to, subject, text, html });
  return { sent: true };
}

// ── Email bienvenida al nuevo usuario ────────────────────────────────────────

async function enviarEmailBienvenida({ nombre, email, rol, plan }) {
  const destino = String(email || "").trim();
  if (!destino) return { sent: false, reason: "sin_email" };

  const planNombre  = String(plan?.nombre || plan || "Demo");
  const rolLabel    = { organizador: "Organizador", dirigente: "Dirigente", tecnico: "Técnico", jugador: "Jugador" };
  const rolTexto    = rolLabel[String(rol || "").toLowerCase()] || String(rol || "");
  const loginUrl    = construirUrlLogin();
  const esPagado    = !["demo", "free"].includes(String(plan?.codigo || plan || "").toLowerCase());

  const pagadoAviso = esPagado
    ? `<p>Tu plan <strong>${planNombre}</strong> requiere confirmación de pago para activarse completamente. Contacta a LT&amp;C por WhatsApp o email para completar el proceso.</p>`
    : "";

  const text = `Hola ${nombre},\n\nBienvenido/a a LT&C (Loja Torneos & Competencias).\n\nTu cuenta ha sido creada exitosamente.\n\nDatos de tu cuenta:\n  Nombre: ${nombre}\n  Correo: ${destino}\n  Rol: ${rolTexto}\n  Plan: ${planNombre}\n\n${esPagado ? `Tu plan ${planNombre} requiere confirmación de pago. Contáctanos por WhatsApp.\n\n` : ""}Ingresa a tu cuenta: ${loginUrl}\n\n— LT&C`;

  const html = wrapHtml(`
    <h2>¡Bienvenido/a a LT&C!</h2>
    <p>Hola <strong>${nombre}</strong>, tu cuenta ha sido creada exitosamente.</p>
    <div class="data-row"><span class="data-lbl">Correo:</span><span>${destino}</span></div>
    <div class="data-row"><span class="data-lbl">Rol:</span><span>${rolTexto}</span></div>
    <div class="data-row"><span class="data-lbl">Plan:</span><span><span class="badge">${planNombre}</span></span></div>
    ${pagadoAviso}
    <a class="btn" href="${loginUrl}" target="_blank" rel="noopener noreferrer">Ingresar ahora</a>
    <div class="footer">LT&C — Loja Torneos &amp; Competencias · lojatorneosycompetencia@gmail.com</div>
  `);

  try {
    return await enviarEmail({ to: destino, subject: `Bienvenido/a a LT&C — Plan ${planNombre}`, text, html });
  } catch (err) {
    console.warn("[email] Error enviando bienvenida:", err.message);
    return { sent: false, reason: err.message };
  }
}

// ── Notificación al admin: nuevo registro ─────────────────────────────────────

async function enviarEmailNotificacionAdminNuevoRegistro({ nombre, email, rol, plan, organizacion }) {
  const adminEmail = String(
    process.env.ADMIN_EMAIL || process.env.SMTP_USER || ""
  ).trim();
  if (!adminEmail) return { sent: false, reason: "sin_admin_email" };

  const planNombre  = String(plan?.nombre || plan || "Demo");
  const planCodigo  = String(plan?.codigo || plan || "demo").toLowerCase();
  const esPagado    = !["demo", "free"].includes(planCodigo);
  const rolLabel    = { organizador: "Organizador", dirigente: "Dirigente", tecnico: "Técnico", jugador: "Jugador" };
  const rolTexto    = rolLabel[String(rol || "").toLowerCase()] || String(rol || "");
  const ahora       = new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" });

  const text = `Nuevo registro en LT&C\n\nNombre: ${nombre}\nCorreo: ${email}\nRol: ${rolTexto}\nPlan: ${planNombre}${organizacion ? `\nOrganización: ${organizacion}` : ""}\nFecha: ${ahora}\n\n${esPagado ? `⚠️  Este usuario seleccionó el plan ${planNombre} (de pago). Confirma el pago antes de activar su cuenta completa.` : ""}`;

  const urgencia = esPagado ? `<p style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;font-size:13px;color:#78350f;">⚠️ Plan de pago seleccionado — confirmar pago antes de activar acceso completo.</p>` : "";

  const html = wrapHtml(`
    <h2>Nuevo registro${esPagado ? " — Plan pagado" : ""}</h2>
    ${urgencia}
    <div class="data-row"><span class="data-lbl">Nombre:</span><span>${nombre}</span></div>
    <div class="data-row"><span class="data-lbl">Correo:</span><span>${email}</span></div>
    <div class="data-row"><span class="data-lbl">Rol:</span><span>${rolTexto}</span></div>
    <div class="data-row"><span class="data-lbl">Plan:</span><span><span class="badge">${planNombre}</span></span></div>
    ${organizacion ? `<div class="data-row"><span class="data-lbl">Organización:</span><span>${organizacion}</span></div>` : ""}
    <div class="data-row"><span class="data-lbl">Fecha:</span><span>${ahora}</span></div>
    <div class="footer">LT&C — notificación automática del sistema</div>
  `);

  const asunto = esPagado
    ? `⚠️ Nuevo organizador con plan ${planNombre} — confirmar pago`
    : `Nuevo registro LT&C — ${rolTexto} (${planNombre})`;

  try {
    return await enviarEmail({ to: adminEmail, subject: asunto, text, html });
  } catch (err) {
    console.warn("[email] Error enviando notificación admin:", err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = {
  enviarEmailRecuperacionPassword,
  enviarEmailBienvenida,
  enviarEmailNotificacionAdminNuevoRegistro,
  construirUrlReset,
};
