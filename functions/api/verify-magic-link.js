export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("invalid_token", { status: 400 });
  }

  try {
    // magic_linksからデータ取得
    const row = await env.DB.prepare(
      `SELECT * FROM magic_links WHERE token = ? AND used = FALSE`
    ).bind(token).first();

    if (!row) {
      return new Response("invalid_or_used_token", { status: 400 });
    }

    if (new Date(row.expires_at) < new Date()) {
      return new Response("token_expired", { status: 400 });
    }

    // usersテーブルに登録 or 更新
    const existing = await env.DB.prepare(
      `SELECT id FROM users WHERE email = ?`
    ).bind(row.email).first();

    let userId;
    if (existing) {
      userId = existing.id;
      await env.DB.prepare(
        `UPDATE users SET birthdate=?, guardian=?, nickname=?, topic=? WHERE id=?`
      ).bind(row.birthdate, row.guardian, row.nickname, row.topic, userId).run();
    } else {
      userId = "usr_" + crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO users (id, email, birthdate, guardian, nickname, topic)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(userId, row.email, row.birthdate, row.guardian, row.nickname, row.topic).run();
    }

    // magic_links を使用済みに
    await env.DB.prepare(
      `UPDATE magic_links SET used = TRUE WHERE token = ?`
    ).bind(token).run();

    // Cookie発行（ローカルでは Secure を外す）
    const isLocal = env.ENVIRONMENT === "development";
    const cookie = [
      `session_user=${userId}`,
      "Path=/",
      "SameSite=Lax",
      "HttpOnly",
      `Max-Age=${60 * 60 * 24 * 30}`,
      ...(isLocal ? [] : ["Secure"])
    ].join("; ");

    const html = `<!doctype html>
<meta charset="utf-8">
<title>登録完了</title>
<p>登録処理が完了しました。画面を切り替えています…</p>
<script>setTimeout(()=>location.replace("/welcome"), 400);</script>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Set-Cookie": cookie,
        "Content-Type": "text/html; charset=utf-8"
      }
    });

  } catch (err) {
    console.error("verify-magic-link error:", err);
    return new Response("internal_error", { status: 500 });
  }
}