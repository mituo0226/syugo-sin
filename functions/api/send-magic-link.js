import { sendMail } from "../../lib/gmail.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // JSON パース（不正JSONを明示的に 400 に）
    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { email, nickname } = payload || {};
    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // マジックリンク生成
    const token = crypto.randomUUID();
    const origin = new URL(request.url).origin;
    const magicLink = `${origin}/api/verify-magic-link?token=${token}`;

    // メール本文
    const subject = "【守護神占い】マジックリンクでログインしてください";
    const body = `${nickname} 様\n\n以下のリンクをクリックしてログインを完了してください:\n${magicLink}\n\nこのリンクは一度だけ有効です。`;

    // Gmail APIで送信
    await sendMail(env, email, subject, body);

    return new Response(
      JSON.stringify({ status: "ok", email, nickname, magicLink }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}