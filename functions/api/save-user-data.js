/**
 * ユーザーデータ保存API
 * メールアドレス入力時に即座にユーザーデータをデータベースに保存
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    console.log("=== ユーザーデータ保存API開始 ===");

    // リクエストボディを取得
    const body = await request.json();
    const { email, userData } = body;

    console.log("受信データ:", { email, userData });

    // バリデーション
    if (!email) {
      return new Response(JSON.stringify({
        success: false,
        error: "メールアドレスが必要です"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!userData) {
      return new Response(JSON.stringify({
        success: false,
        error: "ユーザーデータが必要です"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({
        success: false,
        error: "有効なメールアドレスを入力してください"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log("バリデーション完了、データベース保存開始");

    // 既存ユーザーの確認
    const existingUser = await env.DB.prepare(`
      SELECT id, is_active FROM user_profiles WHERE user_id = ?
    `).bind(email).first();

    if (existingUser) {
      console.log("既存ユーザーが見つかりました:", existingUser);
      
      // 既存ユーザーのデータを更新（未認証状態で上書き）
      await env.DB.prepare(`
        UPDATE user_profiles SET
          nickname = ?,
          birth_year = ?,
          birth_month = ?,
          birth_day = ?,
          guardian_key = ?,
          guardian_name = ?,
          worry = ?,
          registration_info = ?,
          magic_link_token = NULL,
          magic_link_created_at = NULL,
          magic_link_used = 0,
          is_verified = 0,
          is_active = 1,
          created_at = datetime('now')
        WHERE user_id = ?
      `).bind(
        userData.nickname || '',
        userData.birthYear || '',
        userData.birthMonth || '',
        userData.birthDay || '',
        userData.guardianKey || '',
        userData.guardian ? userData.guardian.name : '',
        userData.worry || '',  // worry → worry_type にマッピング
        JSON.stringify(userData),
        email
      ).run();

      console.log("既存ユーザーのデータを更新しました");
    } else {
      console.log("新規ユーザーとして登録します");
      
      // 新規ユーザーとして登録
      await env.DB.prepare(`
        INSERT INTO user_profiles (
          user_id, nickname, birth_year, birth_month, birth_day,
          guardian_key, guardian_name, worry, registration_info,
          magic_link_token, magic_link_created_at, magic_link_used,
          is_verified, is_active, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, 0, 1, datetime('now'))
      `).bind(
        email,
        userData.nickname || '',
        userData.birthYear || '',
        userData.birthMonth || '',
        userData.birthDay || '',
        userData.guardianKey || '',
        userData.guardian ? userData.guardian.name : '',
        userData.worry || '',  // worry → worry_type にマッピング
        JSON.stringify(userData)
      ).run();

      console.log("新規ユーザーを登録しました");
    }

    console.log("ユーザーデータの保存が完了しました");

    return new Response(JSON.stringify({
      success: true,
      message: "ユーザーデータを保存しました",
      data: {
        email: email,
        isVerified: false,
        isActive: true
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("ユーザーデータ保存エラー:", error);
    console.error("エラーの詳細:", error.stack);

    return new Response(JSON.stringify({
      success: false,
      error: "データベース保存に失敗しました",
      details: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
