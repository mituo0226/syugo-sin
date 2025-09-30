import { getCorsHeaders, createErrorResponse, createSuccessResponse } from '../utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

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
    const payload = await request.json();
    const { userId, email } = payload;
    
    // userId または email のどちらかが必要
    if (!userId && !email) {
      return createErrorResponse("userId or email is required", 400, corsHeaders);
    }

    let user;
    let deleteQuery;
    let bindParams;

    if (userId) {
      // ユーザーIDでユーザーを検索
      user = await env.DB.prepare(`
        SELECT * FROM users WHERE id = ?
      `).bind(userId).first();
      
      if (!user) {
        return createErrorResponse("ユーザーが見つかりません", 404, corsHeaders);
      }

      // ユーザーを削除（退会処理）
      deleteQuery = `DELETE FROM users WHERE id = ?`;
      bindParams = [userId];
    } else {
      // メールアドレスでユーザーを検索
      user = await env.DB.prepare(`
        SELECT * FROM users WHERE email = ?
      `).bind(email).first();
      
      if (!user) {
        return createErrorResponse("ユーザーが見つかりません", 404, corsHeaders);
      }

      // ユーザーを削除（退会処理）
      deleteQuery = `DELETE FROM users WHERE email = ?`;
      bindParams = [email];
    }

    const result = await env.DB.prepare(deleteQuery).bind(...bindParams).run();

    if (result.changes === 0) {
      return createErrorResponse("退会処理に失敗しました", 500, corsHeaders);
    }

    return createSuccessResponse({ 
      success: true,
      message: "退会処理が完了しました",
      email: user.email,
      deleted_user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email
      }
    }, corsHeaders);

  } catch (error) {
    console.error("Withdrawal error:", error);
    return createErrorResponse("退会処理中にエラーが発生しました", 500, corsHeaders);
  }
}
