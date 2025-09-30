import { getCorsHeaders, createErrorResponse, createSuccessResponse } from '../utils.js';

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  console.log("Magic link API called:", request.method, "from origin:", origin);
  
  // OPTIONS リクエストの処理（プリフライトリクエスト）
  if (request.method === "OPTIONS") {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders
    });
  }

  if (request.method !== "POST") {
    return createErrorResponse("Method not allowed", 405, corsHeaders);
  }

  try {
    const { email, nickname, birthdate, guardian_id, theme } = await request.json();
    
    if (!email || !nickname) {
      return createErrorResponse("メールアドレスとニックネームは必須です", 400, corsHeaders);
    }

    // 重複チェック
    const existingUser = await env.DB.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(email).first();
    
    if (existingUser) {
      return createErrorResponse("このメールアドレスは既に登録されています", 409, corsHeaders);
    }

    // マジックリンク用のトークンを生成
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30分後
    
    // マジックリンクデータを一時保存
    const magicLinkData = {
      email,
      nickname,
      birthdate,
      guardian_id,
      theme,
      token,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString()
    };

    // マジックリンクデータをD1データベースのmagic_linksテーブルに保存
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS magic_links (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token TEXT UNIQUE NOT NULL,
          email TEXT NOT NULL,
          nickname TEXT NOT NULL,
          birthdate TEXT,
          guardian_id TEXT,
          theme TEXT,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          used BOOLEAN DEFAULT FALSE
        )
      `).run();

      // マジックリンクデータを保存
      await env.DB.prepare(`
        INSERT INTO magic_links (token, email, nickname, birthdate, guardian_id, theme, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        token,
        email,
        nickname,
        birthdate,
        guardian_id,
        theme,
        expiresAt.toISOString(),
        new Date().toISOString()
      ).run();

      console.log("Magic link data saved to database:", { token, email, nickname });
    } catch (dbError) {
      console.error("Failed to save magic link data:", dbError);
      // データベースエラーでも処理を続行（テスト用）
    }

    // マジックリンクURLを生成（フルURL）
    const baseUrl = origin || "https://syugo-sin.com";
    const magicLink = `${baseUrl}/api/verify-magic-link?token=${token}`;
    
    console.log("Magic Link Data:", magicLinkData);
    console.log("Magic Link URL:", magicLink);

    return createSuccessResponse({
      success: true,
      magicLink: magicLink,
      token: token,
      expires_at: expiresAt.toISOString()
    }, corsHeaders);

  } catch (error) {
    console.error("Magic link send error:", error);
    return createErrorResponse("マジックリンク生成中にエラーが発生しました", 500, corsHeaders);
  }
}
