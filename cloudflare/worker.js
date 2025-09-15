import { runConsult } from "../public/consult/consult.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS ヘッダー
    const corsHeaders = {
      "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // OPTIONS リクエストの処理
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // API エンドポイント
    if (url.pathname === "/api/consult") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      try {
        const payload = await request.json();
        const result = await runConsult(payload, env.OPENAI_API_KEY);
        
        // 結果を段落ごとに分割
        const paragraphs = result
          .split(/\n{2,}/)
          .map(p => p.trim())
          .filter(p => p);

        return new Response(
          JSON.stringify({ ok: true, paragraphs }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } catch (error) {
        console.error("API Error:", error);
        return new Response(
          JSON.stringify({ ok: false, error: "Internal Server Error" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }


    // 管理API エンドポイント
    if (url.pathname === "/admin/session" && request.method === "POST") {
      try {
        const { password } = await request.json();
        
        if (password === "admin123") {
          const sessionId = "admin_" + Date.now();
          return new Response(
            JSON.stringify({ ok: true, sessionId }),
            { headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        } else {
          return new Response(
            JSON.stringify({ ok: false, error: "Invalid password" }),
            { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      } catch (error) {
        return new Response(
          JSON.stringify({ ok: false, error: "Invalid request" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    if (url.pathname === "/admin/time" && request.method === "POST") {
      try {
        const { sessionId, action, minutes } = await request.json();
        
        if (!sessionId || !sessionId.startsWith("admin_")) {
          return new Response(
            JSON.stringify({ ok: false, error: "Invalid session" }),
            { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        
        let message = "";
        switch (action) {
          case "add":
            message = `${minutes}分を追加しました`;
            break;
          case "unlimited":
            message = "無制限モードを切り替えました";
            break;
          default:
            return new Response(
              JSON.stringify({ ok: false, error: "Invalid action" }),
              { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }
        
        return new Response(
          JSON.stringify({ ok: true, message }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ ok: false, error: "Invalid request" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // 静的ファイルやその他のリクエストはCloudflare Pagesに委譲
    // WorkerはAPIエンドポイントのみを処理し、それ以外はPagesに任せる
    return fetch(request);
  }
};
