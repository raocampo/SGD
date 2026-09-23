// Vercel Edge Middleware: OG tags dinámicos para /liga/<slug>.
//
// index.html sirve tanto la portada LT&C como la landing de cada
// organizador (rewrite en vercel.json). Los meta og:title/og:description/
// og:image SÍ se personalizan por organizador, pero solo vía JS
// (aplicarSeoLandingOrganizador() en portal.js) DESPUÉS de que carga la
// página. Los crawlers de preview de link (WhatsApp, Facebook, Twitter/X,
// Telegram, LinkedIn, Slack, Discord) NO ejecutan JavaScript -- piden la
// URL, leen el HTML estático tal cual llega, y listo. Resultado real: un
// organizador comparte /liga/<slug> y el preview que le sale a todo el
// mundo es "LT&C | Loja Torneos & Competencias" con el logo genérico de
// LT&C, nunca el título/imagen/descripcion que el organizador configuró en
// "Mi Landing".
//
// Este middleware intercepta SOLO pedidos de esos bots (detectados por
// User-Agent) a /liga/:slug*, pide los datos públicos del organizador a la
// API (misma ruta que ya usa portal.js: /auth/organizadores/by-slug/<slug>
// /landing) y reescribe el <head> del index.html estático antes de
// devolverlo. Para un visitante humano normal esto NO se activa (el
// User-Agent no matchea) -- sigue viendo exactamente lo mismo que antes,
// sin latencia extra, y la personalización visible en pantalla la sigue
// haciendo el JS de siempre.
//
// Si cualquier paso falla (API caída, fetch lento, organizador sin slug,
// etc.) se deja pasar el HTML original sin tocar -- nunca debe romper la
// página para nadie, bot o humano.

export const config = {
  matcher: ["/liga/:slug*"],
};

const BOT_UA_PATTERN =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|LinkedInBot|Slackbot|Discordbot|SkypeUriPreview|redditbot|Pinterest|Googlebot|Bingbot|W3C_Validator|Applebot/i;

const API_BASE = "https://api.ltyc.corpsimtelec.com";

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

// Mismo criterio de normalización de URLs de imagen que normalizarLogoUrl()
// en portal.js (rutas relativas del backend, "uploads/...", etc.).
function normalizarImagenAbsoluta(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return `${API_BASE}${s}`;
  return `${API_BASE}/${s}`;
}

function reemplazarMeta(html, selectorAttrs, contenido) {
  const contenidoEscapado = escapeHtml(contenido);
  for (const attrs of selectorAttrs) {
    const patron = new RegExp(`(<meta[^>]*${attrs}[^>]*content=")[^"]*(")`, "i");
    if (patron.test(html)) {
      html = html.replace(patron, `$1${contenidoEscapado}$2`);
    }
  }
  return html;
}

export default async function middleware(request) {
  const userAgent = request.headers.get("user-agent") || "";
  if (!BOT_UA_PATTERN.test(userAgent)) return; // humano: deja pasar tal cual

  const url = new URL(request.url);
  const match = url.pathname.match(/^\/liga\/([^/]+)/);
  const slug = match?.[1] ? decodeURIComponent(match[1]) : "";
  if (!slug) return;

  try {
    const [htmlResp, landingResp] = await Promise.all([
      fetch(new URL("/index.html", url), { headers: { "user-agent": userAgent } }),
      fetch(`${API_BASE}/api/auth/organizadores/by-slug/${encodeURIComponent(slug)}/landing`),
    ]);
    if (!htmlResp.ok || !landingResp.ok) return;

    const data = await landingResp.json();
    const organizador = data?.organizador || {};
    const cfg = data?.portal_config || {};

    const nombre =
      String(cfg.organizacion_nombre || organizador.organizacion_nombre || organizador.nombre || "").trim() ||
      "Organizador";
    const titulo = `${nombre} · Torneos y competencias`;
    const descripcion =
      String(cfg.hero_description || cfg.about_text_1 || "").trim() ||
      `Landing oficial de ${nombre}: campeonatos, categorias, fixture, tabla de posiciones y goleadores en tiempo real.`;
    const imagenRaw = cfg.hero_image_url || cfg.logo_url || "";
    const imagen = imagenRaw ? normalizarImagenAbsoluta(imagenRaw) : "";
    const urlCanonica = `${url.origin}${organizador.landing_url || url.pathname}`;

    let html = await htmlResp.text();
    html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(titulo)}</title>`);
    html = reemplazarMeta(html, ['name="description"'], descripcion);
    html = reemplazarMeta(html, ['property="og:title"'], titulo);
    html = reemplazarMeta(html, ['property="og:description"'], descripcion);
    html = reemplazarMeta(html, ['property="og:site_name"'], nombre);
    html = reemplazarMeta(html, ['property="og:url"'], urlCanonica);
    if (imagen) {
      html = reemplazarMeta(html, ['property="og:image"'], imagen);
    }

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (error) {
    return; // cualquier falla: deja pasar el HTML original sin tocar
  }
}
