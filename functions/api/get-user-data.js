export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const cookie = request.headers.get("Cookie") || "";
    const match = cookie.match(/session_user=([^;]+)/);
    if (!match) {
      return new Response(JSON.stringify({ error: "no_session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const userId = match[1];

    const user = await env.DB.prepare(`
      SELECT email, birthdate, guardian, nickname, topic
      FROM users WHERE id = ?
    `).bind(userId).first();

    if (!user) {
      return new Response(JSON.stringify({ error: "user_not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, user }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("get-user-data error:", err);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}