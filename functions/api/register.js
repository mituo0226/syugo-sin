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
    
    const { email, nickname, birthdate, guardian_id, theme } = requestBody;
    
    if (!email || !nickname) {
      return createErrorResponse("Email and nickname are required", 400, corsHeaders);
    }

    // D1データベースのバインド確認
    if (!env.DB) {
      console.error("D1 database not bound");
      throw new Error("Database not available");
    }

    console.log("Attempting to insert user data:", { email, nickname, birthdate, guardian_id, theme });

    // 重複チェック：同じメールアドレスが既に存在するか確認
    const existingUser = await env.DB.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(email).first();

    if (existingUser) {
      console.log("Duplicate email found:", email);
      return createErrorResponse("このメールアドレスは既に登録されています", 409, corsHeaders);
    }

    // D1データベースに保存
    const result = await env.DB.prepare(`
      INSERT INTO users (email, nickname, birthdate, guardian_id, theme)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      email,
      nickname,
      birthdate || null,
      guardian_id || null,
      theme || null
    ).run();

    console.log('User registration result:', result);

    if (result.success) {
      // 保存されたデータを取得
      const savedUser = await env.DB.prepare(`
        SELECT * FROM users WHERE id = ?
      `).bind(result.meta.last_row_id).first();

      return createSuccessResponse({ 
        success: true,
        id: result.meta.last_row_id,
        email: savedUser.email,
        nickname: savedUser.nickname,
        birthdate: savedUser.birthdate,
        guardian_id: savedUser.guardian_id,
        theme: savedUser.theme,
        created_at: savedUser.created_at
      }, corsHeaders);
    } else {
      throw new Error("Failed to insert user data");
    }

  } catch (error) {
    console.error("User registration error:", error);
    return createErrorResponse("Failed to register user", 500, corsHeaders);
  }
}
