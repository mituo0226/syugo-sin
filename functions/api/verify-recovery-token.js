/**
 * リカバリートークン検証API
 * 合言葉リセット用のトークンを検証し、ユーザー情報を返す
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    console.log('=== リカバリートークン検証API開始 ===');

    const { token } = await request.json();

    if (!token) {
      return new Response(JSON.stringify({
        success: false,
        message: 'トークンが提供されていません'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('検証するトークン:', token);

    // データベースでトークンを確認
    const user = await env.DB.prepare(`
      SELECT * FROM user_profiles
      WHERE magic_link_token = ?
      AND magic_link_used = 0
      AND is_verified = 1
    `).bind(token).first();

    if (!user) {
      console.log('❌ トークンが無効または期限切れです');
      return new Response(JSON.stringify({
        success: false,
        message: 'トークンが無効または期限切れです'
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // トークンの有効期限チェック（24時間）
    const createdAt = new Date(user.magic_link_created_at);
    const now = new Date();
    const hoursDiff = (now - createdAt) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      console.log('❌ トークンの有効期限が切れています');
      return new Response(JSON.stringify({
        success: false,
        message: 'トークンの有効期限が切れています。再度リカバリーをリクエストしてください。'
      }), { 
        status: 410,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ トークン検証成功:', user.user_id);

    return new Response(JSON.stringify({
      success: true,
      user: {
        nickname: user.nickname,
        guardian_name: user.guardian_name,
        guardian_key: user.guardian_key,
        email: user.user_id
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== トークン検証エラー ===');
    console.error(error);
    return new Response(JSON.stringify({
      success: false,
      message: 'エラーが発生しました',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

