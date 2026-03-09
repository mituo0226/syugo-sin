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
    
    // guardian_id/theme は ritual-guardian.html 側が送る新フィールド名
    const {
      email,
      nickname,
      birthdate,
      guardian,
      guardian_id,
      topic,
      theme
    } = requestBody;

    // フィールド名の揺れを吸収
    const guardianKey = guardian || guardian_id || null;
    const worryText   = topic || theme || null;

    // birthdate (YYYY-MM-DD) を年月日に分割
    let birthYear = null, birthMonth = null, birthDay = null;
    if (birthdate) {
      const parts = birthdate.split('-');
      birthYear  = parts[0] || null;
      birthMonth = parts[1] ? String(parseInt(parts[1])) : null;
      birthDay   = parts[2] ? String(parseInt(parts[2])) : null;
    }
    
    if (!email || !nickname) {
      return createErrorResponse("Email and nickname are required", 400, corsHeaders);
    }

    // D1データベースのバインド確認
    if (!env.DB) {
      console.error("D1 database not bound");
      throw new Error("Database not available");
    }

    console.log("Attempting to insert/update user_profiles:", { email, nickname, birthdate, guardianKey, worryText });

    // 旧registerフロー。現在はマジックリンクフローへ統一。
    // user_profiles テーブルをベースに最小差分で動作させる。
    const existingUser = await env.DB.prepare(`
      SELECT user_id FROM user_profiles WHERE user_id = ?
    `).bind(email).first();

    if (existingUser) {
      console.log("Duplicate email found, updating existing user_profiles:", email);

      await env.DB.prepare(`
        UPDATE user_profiles
        SET nickname=?, birth_year=?, birth_month=?, birth_day=?,
            guardian_key=?, worry=?
        WHERE user_id=?
      `).bind(
        nickname,
        birthYear,
        birthMonth,
        birthDay,
        guardianKey,
        worryText,
        email
      ).run();
    } else {
      const result = await env.DB.prepare(`
        INSERT INTO user_profiles (user_id, nickname, birth_year, birth_month, birth_day, guardian_key, worry)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        email,
        nickname,
        birthYear,
        birthMonth,
        birthDay,
        guardianKey,
        worryText
      ).run();

      if (!result.success) {
        throw new Error("Failed to insert user data");
      }
    }

    // 保存されたデータを取得
    const savedUser = await env.DB.prepare(`
      SELECT * FROM user_profiles WHERE user_id = ?
    `).bind(email).first();

    // セッションCookieを設定（user_id = email）
    const cookie = [
      `session_user=${encodeURIComponent(email)}`,
      "Path=/",
      "SameSite=Lax",
      "HttpOnly",
      `Max-Age=${60 * 60 * 24 * 30}`,
      "Secure"
    ].join("; ");

    return new Response(JSON.stringify({ 
      success: true,
      id: savedUser.user_id,
      email: savedUser.user_id,
      nickname: savedUser.nickname,
      birthdate: birthdate || null,
      guardian: savedUser.guardian_key,
      topic: savedUser.worry,
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
