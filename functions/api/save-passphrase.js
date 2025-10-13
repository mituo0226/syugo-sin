/**
 * 合言葉保存API
 * ユーザーの合言葉をデータベースに保存する
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    console.log('=== 合言葉保存API開始 ===');

    const { email, passphrase } = await request.json();

    if (!email || !passphrase) {
      return new Response(JSON.stringify({
        success: false,
        message: 'メールアドレスと合言葉が必要です'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('メールアドレス:', email);
    console.log('合言葉:', passphrase);

    // ユーザー存在確認
    const user = await env.DB.prepare(`
      SELECT * FROM user_profiles WHERE user_id = ?
    `).bind(email).first();

    if (!user) {
      console.log('❌ ユーザーが見つかりません');
      return new Response(JSON.stringify({
        success: false,
        message: 'ユーザーが見つかりません'
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 合言葉を保存
    await env.DB.prepare(`
      UPDATE user_profiles SET
        guardian_passphrase = ?
      WHERE user_id = ?
    `).bind(passphrase, email).run();

    console.log('✅ 合言葉を保存しました');

    return new Response(JSON.stringify({
      success: true,
      message: '合言葉を保存しました'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== 合言葉保存エラー ===');
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

