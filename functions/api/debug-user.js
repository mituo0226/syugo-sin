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
    const { email } = await request.json();
    
    // ユーザーテーブルから検索
    const user = await env.DB.prepare(`
      SELECT * FROM users WHERE email = ?
    `).bind(email).first();

    // マジックリンクテーブルから検索
    const magicLinks = await env.DB.prepare(`
      SELECT * FROM magic_links WHERE email = ? ORDER BY created_at DESC
    `).bind(email).all();

    return createSuccessResponse({
      success: true,
      email: email,
      user_exists: !!user,
      user_data: user,
      magic_links_count: magicLinks.results ? magicLinks.results.length : 0,
      magic_links: magicLinks.results || []
    }, corsHeaders);

  } catch (error) {
    console.error("Debug user error:", error);
    return createErrorResponse("デバッグ中にエラーが発生しました", 500, corsHeaders);
  }
}
