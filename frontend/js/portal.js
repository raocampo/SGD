const API = window.API_BASE_URL || "http://localhost:5000/api";
const BACKEND_BASE = API.replace(/\/api\/?$/, "");

function normalizarLogoUrl(logoUrl) {
  if (!logoUrl) return "";
  const s = String(logoUrl).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return `${BACKEND_BASE}${s}`;
  if (s.startsWith("uploads/")) return `${BACKEND_BASE}/${s}`;
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(s)) return `${BACKEND_BASE}/uploads/campeonatos/${s}`;
  return `${BACKEND_BASE}/${s}`;
}

async function portalCargarCampeonatos() {
  const cont = document.getElementById("portal-lista-campeonatos");
  try {
    const data = await fetch(`${API}/campeonatos`).then((r) => r.json());
    const lista = data.campeonatos || data || [];
    const activos = lista.filter((c) =>
      ["en_curso", "inscripcion", "planificacion", "borrador"].includes(c.estado || "")
    );

    if (!activos.length) {
      cont.innerHTML = '<p class="empty-msg">No hay torneos activos en este momento.</p>';
      return;
    }

    cont.innerHTML = activos
      .map((c) => {
        const estado = (c.estado || "planificacion").replace("planificacion", "borrador");
        const label = { borrador: "Borrador", inscripcion: "Inscripción", en_curso: "En Curso" }[estado] || estado;
        const logoUrl = normalizarLogoUrl(c.logo_url);
        return `
          <div class="portal-card" style="cursor:pointer" onclick="portalVerCampeonato(${c.id})">
            <div style="display:flex;align-items:center;gap:1rem">
              ${logoUrl ? `<img src="${logoUrl}" alt="" style="width:60px;height:60px;object-fit:contain" />` : ""}
              <div>
                <h3>${c.nombre || "Sin nombre"}</h3>
                <p><span class="badge-estado estado-${estado}">${label}</span></p>
                <p><small>${c.fecha_inicio || ""} - ${c.fecha_fin || ""}</small></p>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error(err);
    cont.innerHTML = '<p class="empty-msg">Error cargando torneos.</p>';
  }
}

async function portalVerCampeonato(campeonatoId) {
  document.getElementById("portal-inicio").classList.remove("active");
  document.getElementById("portal-detalle").classList.add("active");
  const cont = document.getElementById("portal-detalle-contenido");
  cont.innerHTML = "<p>Cargando...</p>";

  try {
    const [campRes, eventosRes] = await Promise.all([
      fetch(`${API}/campeonatos/${campeonatoId}`).then((r) => r.json()),
      fetch(`${API}/eventos/campeonato/${campeonatoId}`).then((r) => r.json()),
    ]);
    const camp = campRes.campeonato || campRes;
    const eventos = eventosRes.eventos || eventosRes || [];

    let html = `
      <div class="portal-card">
        <h2>${camp.nombre || "Torneo"}</h2>
        <p>${camp.organizador || ""} • ${camp.fecha_inicio || ""} - ${camp.fecha_fin || ""}</p>
      </div>
    `;

    for (const ev of eventos) {
      const partidosRes = await fetch(`${API}/partidos/evento/${ev.id}`).then((r) => r.json());
      const partidos = partidosRes.partidos || partidosRes || [];
      const gruposRes = await fetch(`${API}/grupos/evento/${ev.id}`)
        .then((r) => r.json())
        .catch(() => ({ grupos: [] }));
      const grupos = gruposRes.grupos || gruposRes || [];

      html += `<div class="portal-card"><h3>📅 ${ev.nombre || "Categoría"}</h3>`;

      if (partidos.length) {
        html += "<h4>Fixture / Resultados</h4>";
        partidos.slice(0, 20).forEach((p) => {
          const res =
            p.estado === "finalizado" ? `${p.resultado_local || 0} - ${p.resultado_visitante || 0}` : "vs";
          html += `
            <div class="partido-publico">
              <div class="equipo-nombre">${p.equipo_local_nombre || "-"}</div>
              <div class="marcador">${res}</div>
              <div class="equipo-nombre">${p.equipo_visitante_nombre || "-"}</div>
            </div>
          `;
        });
        if (partidos.length > 20) html += `<p><small>... y ${partidos.length - 20} partidos más</small></p>`;
      }

      if (grupos.length) {
        html += "<h4>Tablas de posición</h4>";
        for (const g of grupos) {
          try {
            const tablaRes = await fetch(`${API}/tablas/grupo/${g.id}`).then((r) => r.json());
            const tabla = tablaRes.tabla || [];
            if (tabla.length) {
              html += `<p><strong>${g.nombre_grupo || g.letra_grupo || "Grupo"}</strong></p>`;
              html +=
                "<table class=\"tabla-posicion\"><tr><th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th></tr>";
              tabla.forEach((row, i) => {
                const est = row.estadisticas || {};
                html += `<tr>
                  <td>${row.posicion || i + 1}</td>
                  <td>${row.equipo?.nombre || "-"}</td>
                  <td>${est.partidos_jugados || 0}</td>
                  <td>${est.partidos_ganados || 0}</td>
                  <td>${est.partidos_empatados || 0}</td>
                  <td>${est.partidos_perdidos || 0}</td>
                  <td>${est.goles_favor || 0}</td>
                  <td>${est.goles_contra || 0}</td>
                  <td>${(est.goles_favor || 0) - (est.goles_contra || 0)}</td>
                  <td><strong>${row.puntos || 0}</strong></td>
                </tr>`;
              });
              html += "</table>";
            }
          } catch (_) {}
        }
      }

      html += "</div>";
    }

    cont.innerHTML = html || '<p class="empty-msg">Sin datos disponibles.</p>';
  } catch (err) {
    console.error(err);
    cont.innerHTML = '<p class="empty-msg">Error cargando datos.</p>';
  }
}

function portalVolver() {
  document.getElementById("portal-detalle").classList.remove("active");
  document.getElementById("portal-inicio").classList.add("active");
}

window.portalVerCampeonato = portalVerCampeonato;
window.portalVolver = portalVolver;

document.addEventListener("DOMContentLoaded", portalCargarCampeonatos);
