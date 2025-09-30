import { getCorsHeaders, createErrorResponse, createSuccessResponse } from '../../utils.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // OPTIONS リクエストの処理（プリフライトリクエスト）
  if (request.method === "OPTIONS") {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders
    });
  }

  if (request.method !== "GET") {
    return createErrorResponse("Method not allowed", 405, corsHeaders);
  }

  try {
    const userId = params.userId;
    
    if (!userId) {
      return createErrorResponse("User ID is required", 400, corsHeaders);
    }

    // D1データベースからユーザーデータを取得
    const userData = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ?
    `).bind(userId).first();

    if (!userData) {
      return createErrorResponse("User not found", 404, corsHeaders);
    }

    return createSuccessResponse({
      success: true,
      id: userData.id,
      email: userData.email,
      nickname: userData.nickname,
      birthdate: userData.birthdate,
      guardian_id: userData.guardian_id,
      theme: userData.theme,
      created_at: userData.created_at
    }, corsHeaders);

  } catch (error) {
    console.error("User verification error:", error);
    return createErrorResponse("Failed to verify user", 500, corsHeaders);
  }
}
