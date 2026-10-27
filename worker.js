import { neon } from "@neondatabase/serverless";

const CRIT = ["c1","c2","c3","c4","c5","c6","c7","c8","c9a","c9b"];
const FACTOR = { c1:2.5,c2:1.25,c3:1.25,c4:5,c5:3.75,c6:5,c7:2.5,c8:1.25,c9a:1.25,c9b:1.25 };


async function secret(v) {
  if (v && typeof v.get === "function") v = await v.get();
  return typeof v === "string" ? v : "";
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": origin === env.ALLOWED_ORIGIN ? origin : env.ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
      "Vary": "Origin",
    };
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);

    try {
      // Acepta Secret de texto o binding de Secrets Store (objeto con .get())
      const dbUrl = await secret(env.NEON_URL);
      if (!dbUrl.startsWith("postgres"))
        return json({ error: "NEON_URL no contiene una cadena postgresql:// válida" }, 500);
      const sql = neon(dbUrl);
      if (req.method === "GET" && url.pathname === "/evals") {
        const rows = await sql`SELECT key, evaluador, circle, scores, total, pct, ts FROM rdp_evals ORDER BY ts DESC`;
        return json(rows.map(r => ({ _id: r.key, evaluador: r.evaluador, circle: r.circle,
          scores: r.scores, total: Number(r.total), pct: r.pct, ts: Number(r.ts) })));
      }

      // ── Catálogo de RDP ──
      if (req.method === "GET" && url.pathname === "/circles") {
        const rows = await sql`SELECT id, nombre, area FROM rdp_catalog ORDER BY lower(nombre)`;
        return json(rows);
      }
      const isAdminRoute = url.pathname === "/admin/check" || url.pathname.startsWith("/circles/");
      if (isAdminRoute) {
        const adminKey = await secret(env.ADMINRDP_KEY);
        if (!adminKey) return json({ error: "ADMINRDP_KEY no está configurada en el Worker" }, 503);
        if (!safeEqual(req.headers.get("X-Admin-Key") || "", adminKey)) return json({ error: "clave incorrecta" }, 401);
        if (url.pathname === "/admin/check") return json({ ok: true });
        const cm = url.pathname.match(/^\/circles\/([^/]+)$/);
        if (!cm) return json({ error: "not found" }, 404);
        const id = decodeURIComponent(cm[1]).slice(0, 120);
        if (req.method === "PUT") {
          const b = await req.json();
          const nombre = String(b.nombre || "").trim().slice(0, 160);
          const area = String(b.area || "").trim().slice(0, 120);
          if (!nombre) return json({ error: "nombre obligatorio" }, 400);
          await sql`INSERT INTO rdp_catalog (id, nombre, area, ts) VALUES (${id}, ${nombre}, ${area}, ${Date.now()})
            ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, area = EXCLUDED.area, ts = EXCLUDED.ts`;
          return json({ ok: true });
        }
        if (req.method === "DELETE") {
          await sql`DELETE FROM rdp_catalog WHERE id = ${id}`;
          return json({ ok: true });
        }
        return json({ error: "método no permitido" }, 405);
      }

      const m = url.pathname.match(/^\/evals\/([^/]+)$/);
      if (req.method === "PUT" && m) {
        const key = decodeURIComponent(m[1]).slice(0, 200);
        const b = await req.json();
        const evaluador = String(b.evaluador || "").trim().slice(0, 120);
        const circle = String(b.circle || "").trim().slice(0, 160);
        if (!evaluador || !circle) return json({ error: "evaluador y circle son obligatorios" }, 400);
        const scores = {};
        for (const c of CRIT) {
          const v = Number(b.scores?.[c]);
          if (![1, 2, 3, 4].includes(v)) return json({ error: `puntaje inválido en ${c}` }, 400);
          scores[c] = v;
        }
        // El total se recalcula en el servidor
        const total = Math.round(CRIT.reduce((s, c) => s + scores[c] * FACTOR[c], 0) * 100) / 100;
        const pct = Math.round(total);
        await sql`
          INSERT INTO rdp_evals (key, evaluador, circle, scores, total, pct, ts)
          VALUES (${key}, ${evaluador}, ${circle}, ${JSON.stringify(scores)}::jsonb, ${total}, ${pct}, ${Date.now()})
          ON CONFLICT (key) DO UPDATE SET evaluador = EXCLUDED.evaluador, circle = EXCLUDED.circle,
            scores = EXCLUDED.scores, total = EXCLUDED.total, pct = EXCLUDED.pct, ts = EXCLUDED.ts`;
        return json({ ok: true, total, pct });
      }
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: "server error", detail: String(e && e.message || e).slice(0, 200) }, 500);
    }
  },
};
