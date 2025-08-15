// functions/api/consult.js
export const onRequestPost = async ({ request, env }) => {
  const { text } = await request.json().catch(() => ({}));
  if (!text) {
    return new Response(JSON.stringify({ error: "text required" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "穏やかな占い師として答えてください。" },
          { role: "user", content: text }
        ]
      }),
    });

    if (!r.ok) {
      return new Response(JSON.stringify({ error: "upstream_error" }),
        { status: 502, headers: { "Content-Type": "application/json" } });
    }

    const data = await r.json();
    return new Response(JSON.stringify({ message: data.choices[0].message.content }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "server_error", detail: err.message }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
};
export default {
  async fetch(request, env, ctx) {
    return new Response("Hello from Cloudflare Worker!", {
      headers: { "content-type": "text/plain" },
    });
  },
};
