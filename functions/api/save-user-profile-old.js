/**
 * ユーザープロフィール保存API
 * マジックリンク認証後にユーザープロフィールを保存します
 * （主に内部APIとして使用、フロントエンドから直接呼び出されることは想定していません）
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    console.log('=== ユーザープロフィール保存APIが呼び出されました ===');
    
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

    // ユーザープロフィールを保存
    const saveResult = await saveUserProfileToDatabase(email, userData, env);
    
    if (saveResult.success) {
      console.log('ユーザープロフィールの保存が完了しました');
      return new Response(JSON.stringify({
        success: true,
        message: 'ユーザープロフィールを保存しました',
        user_id: email
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      console.error('ユーザープロフィールの保存に失敗:', saveResult.error);
      return new Response(JSON.stringify({
        success: false,
        error: saveResult.error
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

/**
 * データベースにユーザープロフィールを保存する関数
 * @param {string} email - メールアドレス
 * @param {object} userData - ユーザーデータ
 * @param {object} env - 環境変数
 * @returns {object} 保存結果
 */
async function saveUserProfileToDatabase(email, userData, env) {
  try {
    console.log('データベースへの保存を開始:', { email, userData });

    // 生年月日の分解
    let birthYear = null, birthMonth = null, birthDay = null;
    if (userData.birthYear && userData.birthMonth && userData.birthDay) {
      birthYear = userData.birthYear;
      birthMonth = userData.birthMonth;
      birthDay = userData.birthDay;
    }

    // 既存のユーザーをチェック
    const existingUser = await env.DB.prepare(`
      SELECT id FROM user_profiles WHERE user_id = ?
    `).bind(email).first();

    let result;
    if (existingUser) {
      // 既存ユーザーの更新
      console.log('既存ユーザーの情報を更新します');
      result = await env.DB.prepare(`
        UPDATE user_profiles SET
          birth_year = ?,
          birth_month = ?,
          birth_day = ?,
          guardian_key = ?,
          guardian_name = ?,
          worry_type = ?,
          registration_info = ?,
          created_at = datetime('now')
        WHERE user_id = ?
      `).bind(
        birthYear,
        birthMonth,
        birthDay,
        userData.guardianKey || null,
        userData.guardianName || null,
        userData.worryType || null,
        JSON.stringify(userData),
        email
      ).run();
    } else {
      // 新規ユーザーの作成
      console.log('新規ユーザーを作成します');
      result = await env.DB.prepare(`
        INSERT INTO user_profiles (
          user_id, birth_year, birth_month, birth_day,
          guardian_key, guardian_name, worry_type,
          registration_info, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        email,
        birthYear,
        birthMonth,
        birthDay,
        userData.guardianKey || null,
        userData.guardianName || null,
        userData.worryType || null,
        JSON.stringify(userData)
      ).run();
    }

    console.log('データベース保存結果:', result);

    if (result.success) {
      return { success: true, result: result };
    } else {
      return { success: false, error: 'データベース保存に失敗しました' };
    }

  } catch (error) {
    console.error('データベース保存エラー:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ユーザープロフィール取得API（GET）
 * 管理画面などでユーザー情報を取得する際に使用
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = url.searchParams.get('email');

  try {
    console.log('=== ユーザープロフィール取得APIが呼び出されました ===');
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

    // ユーザープロフィールを取得
    const userProfile = await env.DB.prepare(`
      SELECT * FROM user_profiles WHERE user_id = ?
    `).bind(email).first();

    if (!userProfile) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ユーザーが見つかりません'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // registration_infoをパース
    let registrationInfo = null;
    if (userProfile.registration_info) {
      try {
        registrationInfo = JSON.parse(userProfile.registration_info);
      } catch (parseError) {
        console.error('registration_infoのパースエラー:', parseError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      user: {
        ...userProfile,
        registration_info: registrationInfo
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('ユーザープロフィール取得APIエラー:', error);
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
