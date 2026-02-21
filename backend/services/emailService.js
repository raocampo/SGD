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

module.exports = {
  enviarEmailRecuperacionPassword,
  construirUrlReset,
};
