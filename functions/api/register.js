import { getCorsHeaders, createErrorResponse, createSuccessResponse } from '../utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  console.log("Register API endpoint hit:", { method: request.method, pathname: request.url });
  
  // OPTIONS リクエストの処理（プリフライトリクエスト）
  if (request.method === "OPTIONS") {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders
    });
  }

  if (request.method !== "POST") {
    console.log("Method not allowed:", request.method);
    return createErrorResponse("Method not allowed", 405, corsHeaders);
  }

  try {
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (jsonError) {
      console.error("JSON parse error:", jsonError);
      return createErrorResponse("Invalid JSON format", 400, corsHeaders);
    }
    
    const { email, nickname, birthdate, guardian, topic } = requestBody;
    
    if (!email || !nickname) {
      return createErrorResponse("Email and nickname are required", 400, corsHeaders);
    }

    // D1データベースのバインド確認
    if (!env.DB) {
      console.error("D1 database not bound");
      throw new Error("Database not available");
    }

    console.log("Attempting to insert user data:", { email, nickname, birthdate, guardian, topic });

    // 重複チェック：同じメールアドレスが既に存在するか確認
    const existingUser = await env.DB.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(email).first();

    let userId;
    if (existingUser) {
      console.log("Duplicate email found, updating existing user:", email);
      userId = existingUser.id;
      
      // 既存ユーザーの情報を更新
      await env.DB.prepare(`
        UPDATE users SET nickname=?, birthdate=?, guardian=?, topic=? WHERE id=?
      `).bind(
        nickname,
        birthdate || null,
        guardian || null,
        topic || null,
        userId
      ).run();
    } else {
      // 新規ユーザーを作成
      userId = "usr_" + crypto.randomUUID();
      
      const result = await env.DB.prepare(`
        INSERT INTO users (id, email, nickname, birthdate, guardian, topic)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        email,
        nickname,
        birthdate || null,
        guardian || null,
        topic || null
      ).run();
      
      if (!result.success) {
        throw new Error("Failed to insert user data");
      }
    }

    // 保存されたデータを取得
    const savedUser = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ?
    `).bind(userId).first();

    // セッションCookieを設定
    const cookie = [
      `session_user=${userId}`,
      "Path=/",
      "SameSite=Lax",
      "HttpOnly",
      `Max-Age=${60 * 60 * 24 * 30}`,
      "Secure"
    ].join("; ");

    return new Response(JSON.stringify({ 
      success: true,
      id: userId,
      email: savedUser.email,
      nickname: savedUser.nickname,
      birthdate: savedUser.birthdate,
      guardian: savedUser.guardian,
      topic: savedUser.topic,
      created_at: savedUser.created_at
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Set-Cookie": cookie
      }
    });

  } catch (error) {
    console.error("User registration error:", error);
    return createErrorResponse("Failed to register user", 500, corsHeaders);
  }
}
