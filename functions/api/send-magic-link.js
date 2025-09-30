// POST 専用エンドポイント
export async function onRequestPost(context) {
  const { request } = context;

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
    const magicLink = `${origin}/verify-magic-link?token=${token}`;

    // TODO: DB保存や Gmail 送信は後で段階的に復活

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