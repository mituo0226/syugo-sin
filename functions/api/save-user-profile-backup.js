/**
 * ユーザープロフィール保存API（新構造対応）
 * マジックリンク認証後にユーザーデータを更新します
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    console.log('=== ユーザープロフィール保存API開始 ===');

    // リクエストボディを取得
    const requestBody = await request.json();
    console.log('リクエストデータ:', requestBody);
    
    const { email, userData } = requestBody;

    // バリデーション
    if (!email) {
      console.error('メールアドレスが提供されていません');
      return new Response(JSON.stringify({
        success: false,
        error: 'メールアドレスが必要です'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!userData) {
      console.error('ユーザーデータが提供されていません');
      return new Response(JSON.stringify({
        success: false,
        error: 'ユーザーデータが必要です'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // データベース接続確認
    if (!env.DB) {
      console.error('データベース接続が見つかりません');
      return new Response(JSON.stringify({
        success: false,
        error: 'データベース接続エラー'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('バリデーション完了、データベース更新開始');

    // ユーザーデータを更新（認証済み状態に変更）
    try {
      const result = await env.DB.prepare(`
        UPDATE user_profiles SET
          nickname = ?,
          birth_year = ?,
          birth_month = ?,
          birth_day = ?,
          guardian_key = ?,
          guardian_name = ?,
          worry = ?,
          registration_info = ?,
          is_verified = 1,
          magic_link_used = 1,
          created_at = datetime('now')
        WHERE user_id = ?
      `).bind(
        userData.nickname || '',
        userData.birthYear || '',
        userData.birthMonth || '',
        userData.birthDay || '',
        userData.guardianKey || '',
        userData.guardian ? userData.guardian.name : '',
        userData.worry || '',
        JSON.stringify(userData),
        email
      ).run();

      console.log('ユーザープロフィールの更新完了:', result);

      return new Response(JSON.stringify({
        success: true,
        message: 'ユーザープロフィールを更新しました',
        data: {
          email: email,
          isVerified: true,
          isActive: true
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (dbError) {
      console.error('データベース更新エラー:', dbError);
      return new Response(JSON.stringify({
        success: false,
        error: 'ユーザープロフィールの更新に失敗しました',
        details: dbError.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('ユーザープロフィール保存APIエラー:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'サーバーエラーが発生しました',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
