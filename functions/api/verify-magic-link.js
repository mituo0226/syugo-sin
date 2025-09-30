// GET 専用エンドポイント
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(
      JSON.stringify({ status: "error", message: "token is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // D1データベースの存在確認
  if (!env.DB) {
    console.error("D1 database not bound");
    return new Response(
      JSON.stringify({ status: "error", message: "Database not available" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // トークンの検証
    const magicLinkData = await env.DB.prepare(`
      SELECT * FROM magic_links 
      WHERE token = ? AND used = FALSE AND expires_at > datetime('now')
    `).bind(token).first();

    if (!magicLinkData) {
      return new Response(
        JSON.stringify({ 
          status: "error", 
          message: "Invalid or expired token" 
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 既存ユーザーの確認
    const existingUser = await env.DB.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(magicLinkData.email).first();

    if (existingUser) {
      // 既に登録済みの場合はトークンを無効化
      await env.DB.prepare(`
        UPDATE magic_links SET used = TRUE WHERE token = ?
      `).bind(token).run();

      return new Response(
        JSON.stringify({
          status: "ok",
          message: "User already registered",
          email: magicLinkData.email,
          nickname: magicLinkData.nickname
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ユーザー登録処理
    try {
      await env.DB.prepare(`
        INSERT INTO users (email, nickname)
        VALUES (?, ?)
      `).bind(
        magicLinkData.email,
        magicLinkData.nickname
      ).run();

      // トークンを無効化
      await env.DB.prepare(`
        UPDATE magic_links SET used = TRUE WHERE token = ?
      `).bind(token).run();

      console.log("User registered successfully:", { 
        email: magicLinkData.email, 
        nickname: magicLinkData.nickname 
      });

      return new Response(
        JSON.stringify({
          status: "ok",
          message: "User registered successfully",
          email: magicLinkData.email,
          nickname: magicLinkData.nickname
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    } catch (dbError) {
      console.error("Database error during user registration:", dbError);
      return new Response(
        JSON.stringify({ 
          status: "error", 
          message: `Database error: ${dbError.message}` 
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Token verification error:", error);
    return new Response(
      JSON.stringify({ 
        status: "error", 
        message: "Internal server error" 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}