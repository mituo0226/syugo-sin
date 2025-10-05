/**
 * ユーザープロフィール保存API（完全版）
 * マジックリンク認証後、追加データ（または修正）を反映し、ユーザープロフィールを更新する
 * 
 * 動作の流れ:
 * 1. リクエストからemailとlocalDataを取得
 * 2. 該当ユーザーが存在するか確認
 * 3. ユーザープロフィール情報を更新
 * 4. 更新完了レスポンスを返却
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

    console.log('=== ユーザー検索開始 ===');
    console.log('検索対象メール:', email);

    // 該当ユーザーの存在確認
    try {
      const existingUser = await env.DB.prepare(`
        SELECT id, user_id, nickname, is_verified, is_active
        FROM user_profiles 
        WHERE user_id = ?
      `).bind(email).first();

      console.log('ユーザー検索結果:', existingUser);

      if (!existingUser) {
        console.error('ユーザーが見つかりません:', email);
        return new Response(JSON.stringify({
          success: false,
          error: 'ユーザーが見つかりません。先に会員登録を行ってください。'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 認証状態の確認
      if (existingUser.is_verified !== 1) {
        console.error('ユーザーが未認証です:', email);
        return new Response(JSON.stringify({
          success: false,
          error: 'メール認証が完了していません。先にメール認証を行ってください。'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log('=== ユーザープロフィール更新開始 ===');
      console.log('更新対象ユーザーID:', existingUser.id);

      // ユーザープロフィールを更新
      const updateResult = await env.DB.prepare(`
        UPDATE user_profiles SET
          nickname = ?,
          birth_year = ?,
          birth_month = ?,
          birth_day = ?,
          guardian_key = ?,
          guardian_name = ?,
          worry = ?,
          registration_info = ?,
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

      console.log('プロフィール更新結果:', updateResult);
      console.log('✅ ユーザープロフィールを更新しました');

      // 更新後のユーザー情報を取得
      const updatedUser = await env.DB.prepare(`
        SELECT id, user_id, nickname, birth_year, birth_month, birth_day,
               guardian_key, guardian_name, worry, is_verified, is_active, created_at
        FROM user_profiles 
        WHERE user_id = ?
      `).bind(email).first();

      console.log('更新後のユーザー情報:', updatedUser);

      return new Response(JSON.stringify({
        success: true,
        message: 'ユーザー情報を更新しました',
        data: {
          id: updatedUser.id,
          email: updatedUser.user_id,
          nickname: updatedUser.nickname,
          birthYear: updatedUser.birth_year,
          birthMonth: updatedUser.birth_month,
          birthDay: updatedUser.birth_day,
          guardianKey: updatedUser.guardian_key,
          guardianName: updatedUser.guardian_name,
          worry: updatedUser.worry,
          isVerified: updatedUser.is_verified,
          isActive: updatedUser.is_active,
          createdAt: updatedUser.created_at
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (dbError) {
      console.error('=== データベースエラー ===');
      console.error('エラー詳細:', dbError);
      console.error('エラーメッセージ:', dbError.message);
      console.error('エラースタック:', dbError.stack);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'データベース処理中にエラーが発生しました',
        details: dbError.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('=== ユーザープロフィール保存APIエラー ===');
    console.error('エラー詳細:', error);
    console.error('エラースタック:', error.stack);
    
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

/**
 * ユーザー情報取得API（追加機能）
 * 認証済みユーザーの情報を取得する
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    console.log('=== ユーザー情報取得API開始 ===');

    // URLからクエリパラメータを取得
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    
    console.log('取得対象メール:', email);

    if (!email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'メールアドレスが必要です'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!env.DB) {
      return new Response(JSON.stringify({
        success: false,
        error: 'データベース接続エラー'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await env.DB.prepare(`
      SELECT id, user_id, nickname, birth_year, birth_month, birth_day,
             guardian_key, guardian_name, worry, is_verified, is_active, created_at
      FROM user_profiles 
      WHERE user_id = ?
    `).bind(email).first();

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ユーザーが見つかりません'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: user.id,
        email: user.user_id,
        nickname: user.nickname,
        birthYear: user.birth_year,
        birthMonth: user.birth_month,
        birthDay: user.birth_day,
        guardianKey: user.guardian_key,
        guardianName: user.guardian_name,
        worry: user.worry,
        isVerified: user.is_verified,
        isActive: user.is_active,
        createdAt: user.created_at
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('ユーザー情報取得APIエラー:', error);
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
