import { getCorsHeaders, createErrorResponse, createSuccessResponse } from '../utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // --- セッション認証ガード ---
  try {
    const cookieHeader = request.headers.get('Cookie') || '';
    const sessionMatch = cookieHeader.match(/(?:^|;\s*)session_user=([^;]+)/);
    const sessionUserId = sessionMatch ? sessionMatch[1] : null;

    if (!sessionUserId) {
      return new Response(
        JSON.stringify({ error: 'SESSION_EXPIRED', message: '鑑定時間が終了しました' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const activeSession = await env.DB.prepare(`
      SELECT id FROM user_sessions
      WHERE user_id = ?
        AND is_active = 1
        AND session_end_time > datetime('now')
      LIMIT 1
    `).bind(sessionUserId).first();

    if (!activeSession) {
      return new Response(
        JSON.stringify({ error: 'SESSION_EXPIRED', message: '鑑定時間が終了しました' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (authError) {
    console.error('Session auth error:', authError);
    return new Response(
      JSON.stringify({ error: 'SESSION_EXPIRED', message: '鑑定時間が終了しました' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  // --- セッション認証ガード ここまで ---

  try {
    const requestText = await request.text();
    console.log('Raw request body length:', requestText.length);
    console.log('Raw request body:', requestText);
    
    let payload;
    try {
      payload = JSON.parse(requestText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Problematic JSON:', requestText);
      return createErrorResponse(`JSON parse error: ${parseError.message}`, 400, corsHeaders);
    }
    
    console.log('Consult API payload:', payload);
    
    // runConsult関数を動的にインポート
    const { runConsult } = await import('../../public/consult/consult.js');
    const result = await runConsult(payload, env.OPENAI_API_KEY);
    
    // 結果を段落ごとに分割
    const paragraphs = result
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(p => p);

    return createSuccessResponse({ ok: true, paragraphs }, corsHeaders);
  } catch (error) {
    console.error("API Error:", error);
    return createErrorResponse("Internal Server Error", 500, corsHeaders);
  }
}
