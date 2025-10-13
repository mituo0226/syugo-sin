/**
 * 合言葉更新API
 * リカバリートークンを使用して合言葉を更新する
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    console.log('=== 合言葉更新API開始 ===');

    const { token, newPassphrase } = await request.json();

    if (!token || !newPassphrase) {
      return new Response(JSON.stringify({
        success: false,
        message: 'トークンと新しい合言葉が必要です'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('トークン:', token);
    console.log('新しい合言葉:', newPassphrase);

    // トークンの検証
    const user = await env.DB.prepare(`
      SELECT * FROM user_profiles
      WHERE magic_link_token = ?
      AND magic_link_used = 0
      AND is_verified = 1
    `).bind(token).first();

    if (!user) {
      console.log('❌ トークンが無効です');
      return new Response(JSON.stringify({
        success: false,
        message: 'トークンが無効です'
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
        message: 'トークンの有効期限が切れています'
      }), { 
        status: 410,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 合言葉を更新し、トークンを使用済みにする
    await env.DB.prepare(`
      UPDATE user_profiles SET
        guardian_passphrase = ?,
        magic_link_used = 1
      WHERE user_id = ?
    `).bind(newPassphrase, user.user_id).run();

    console.log('✅ 合言葉を更新しました:', user.user_id);

    return new Response(JSON.stringify({
      success: true,
      message: '合言葉を更新しました'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== 合言葉更新エラー ===');
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

