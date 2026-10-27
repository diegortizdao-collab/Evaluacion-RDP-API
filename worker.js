import { neon } from "@neondatabase/serverless";

const CRIT = ["c1","c2","c3","c4","c5","c6","c7","c8","c9a","c9b"];
const FACTOR = { c1:2.5,c2:1.25,c3:1.25,c4:5,c5:3.75,c6:5,c7:2.5,c8:1.25,c9a:1.25,c9b:1.25 };

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": origin === env.ALLOWED_ORIGIN ? origin : env.ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const sql = neon(env.DATABASE_URL);
    const url = new URL(req.url);

    try {
      if (req.method === "GET" && url.pathname === "/evals") {
        const rows = await sql`SELECT key, evaluador, circle, scores, total, pct, ts FROM rdp_evals ORDER BY ts DESC`;
        return json(rows.map(r => ({ _id: r.key, evaluador: r.evaluador, circle: r.circle,
          scores: r.scores, total: Number(r.total), pct: r.pct, ts: Number(r.ts) })));
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
      return json({ error: "server error" }, 500);
    }
  },
};
