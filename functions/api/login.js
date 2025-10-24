/**
 * ログインAPI
 * ニックネーム + 生年月日 + 合言葉で認証
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    console.log('=== ログインAPI開始 ===');

    const { nickname, birthYear, birthMonth, birthDay, passphrase } = await request.json();

    console.log('ログイン試行:');
    console.log('- ニックネーム:', nickname);
    console.log('- 生年月日:', `${birthYear}/${birthMonth}/${birthDay}`);
    console.log('- 合言葉:', passphrase);

    // バリデーション
    if (!nickname || !birthYear || !birthMonth || !birthDay || !passphrase) {
      return new Response(JSON.stringify({
        success: false,
        message: 'すべての項目を入力してください'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ユーザー検索（3要素で認証）
    const user = await env.DB.prepare(`
      SELECT * FROM user_profiles
      WHERE nickname = ?
      AND birth_year = ?
      AND birth_month = ?
      AND birth_day = ?
      AND guardian_passphrase = ?
      AND is_verified = 1
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(nickname, birthYear, birthMonth, birthDay, passphrase).first();

    if (!user) {
      console.log('❌ ログイン失敗: 認証情報が一致しません');
      return new Response(JSON.stringify({
        success: false,
        message: 'ニックネーム、生年月日、または合言葉が正しくありません'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ ログイン成功:', user.user_id);

    // セッションCookie設定
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Set-Cookie': `session_user=${user.user_id}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`
    });

    return new Response(JSON.stringify({
      success: true,
      userData: {
        nickname: user.nickname,
        email: user.user_id,
        guardianName: user.guardian_name,
        guardianKey: user.guardian_key,
        worry: user.worry,
        birthYear: user.birth_year,
        birthMonth: user.birth_month,
        birthDay: user.birth_day,
        passphrase: user.guardian_passphrase
      }
    }), { headers });

  } catch (error) {
    console.error('=== ログインエラー ===');
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

