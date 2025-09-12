// filename: cloudflare/worker.js (Cloudflare Worker)
// Routes: /api/consult で鑑定本文を返す
// ENV:
// - OPENAI_API_KEY: OpenAI APIキー
// - ALLOW_ORIGIN: CORS許可オリジン（未指定なら "*"）

import { runConsult } from "../src/consult/consult.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ---- CORS preflight ----
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // ---- health check ----
    if (url.pathname === "/health") {
      return json({ ok: true, ts: Date.now() }, env, request);
    }

    // ---- /api/consult endpoint ----
    if (url.pathname === "/api/consult" && request.method === "POST") {
      try {
        const payload = await safeJson(request);
        const { text, year, month, day, guardian, category } = payload;

        // 必須パラメータの検証
        if (!text) {
          return json({ 
            ok: false, 
            error: "相談内容が指定されていません" 
          }, env, request, 400);
        }

        // runConsult()を呼び出し
        const result = await runConsult({
          text,
          year,
          month,
          day,
          guardian,
          category
        }, env.OPENAI_API_KEY);

        // 結果を段落配列に分割
        const paragraphs = result.split("\n\n");

        return json({ ok: true, paragraphs }, env, request);
      } catch (err) {
        console.error('API Error:', err);
        return json({ ok: false, error: String(err?.message || err) }, env, request, 500);
      }
    }

    // ---- not found ----
    return json({ ok: false, error: "Not found" }, env, request, 404);
  },
};


/* ========= 便利関数 ========= */
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(obj, env, request, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

async function safeJson(request) {
  if (request.method !== "POST") return {};
  const txt = await request.text();
  try { return JSON.parse(txt || "{}"); } catch { return {}; }
}
