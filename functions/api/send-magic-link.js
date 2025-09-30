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

  // ダミー固定レスポンスを返す（テスト用）
  console.log("Returning dummy response for testing");
  
  return createSuccessResponse({
    success: true,
    magicLink: "https://example.com/verify-magic-link?token=12345"
  }, corsHeaders);
}
