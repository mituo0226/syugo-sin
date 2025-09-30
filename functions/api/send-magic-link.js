// POST 専用エンドポイント
export async function onRequestPost(context) {
  const { request } = context;

  try {
    const { email, nickname } = await request.json();

    // マジックリンクを生成
    const token = crypto.randomUUID();
    const origin = new URL(request.url).origin;
    const magicLink = `${origin}/verify-magic-link?token=${token}`;

    // TODO: D1 データベース保存処理を後で追加予定

    return new Response(
      JSON.stringify({
        status: "ok",
        email,
        nickname,
        magicLink,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}