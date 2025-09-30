import { getCorsHeaders, createErrorResponse, createSuccessResponse } from '../utils.js';

export async function onRequest(context) {
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
    const { userId } = await request.json();
    
    if (!userId) {
      return createErrorResponse("User ID is required", 400, corsHeaders);
    }

    // ユーザーを削除
    const result = await env.DB.prepare(`
      DELETE FROM users WHERE id = ?
    `).bind(userId).run();

    if (result.changes === 0) {
      return createErrorResponse("User not found", 404, corsHeaders);
    }

    return createSuccessResponse({ 
      success: true,
      message: "ユーザーデータを削除しました",
      deleted_id: userId
    }, corsHeaders);

  } catch (error) {
    console.error("User deletion error:", error);
    return createErrorResponse("Failed to delete user", 500, corsHeaders);
  }
}
