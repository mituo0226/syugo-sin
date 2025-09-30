// GET 専用エンドポイント
export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(
      JSON.stringify({ status: "error", message: "token is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 今はまだ DB 照合なし → 常に「成功」と返す
  return new Response(
    JSON.stringify({
      status: "ok",
      message: "Token verified successfully",
      token,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}