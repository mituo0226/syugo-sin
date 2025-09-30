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
    // テスト用メールアドレスのデータを全削除
    const result = await env.DB.prepare(`
      DELETE FROM users WHERE email = 'mituo0226@gmail.com'
    `).run();

    return createSuccessResponse({ 
      success: true,
      message: "テストデータを全削除しました",
      deleted_count: result.changes
    }, corsHeaders);

  } catch (error) {
    console.error("Test data deletion error:", error);
    return createErrorResponse("Failed to delete test data", 500, corsHeaders);
  }
}
