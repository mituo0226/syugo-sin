/**
 * マジックリンク検証API
 * メールで送信されたマジックリンクのトークンを検証し、
 * 認証成功時にユーザープロフィールを保存します
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  try {
    console.log('=== マジックリンク検証APIが呼び出されました ===');
    console.log('検証トークン:', token);

    // トークンの存在確認
    if (!token) {
      console.error('トークンが提供されていません');
      return new Response(createErrorPage('トークンが見つかりません'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // データベース接続確認
    if (!env.DB) {
      console.error('データベース接続が見つかりません');
      return new Response(createErrorPage('データベース接続エラー'), {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // トークンの有効性をチェック（ユーザープロフィールテーブルから）
    const userRecord = await env.DB.prepare(`
      SELECT * FROM user_profiles 
      WHERE magic_link_token = ? AND magic_link_used = 0
      ORDER BY magic_link_created_at DESC
      LIMIT 1
    `).bind(token).first();

    if (!userRecord) {
      console.error('無効または使用済みのトークンです');
      return new Response(createErrorPage('無効または期限切れのリンクです'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    console.log('有効なトークンが見つかりました:', userRecord);

    // トークンの有効期限チェック（30分）
    const createdAt = new Date(userRecord.magic_link_created_at);
    const now = new Date();
    const timeDiff = (now - createdAt) / (1000 * 60); // 分単位

    if (timeDiff > 30) {
      console.error('トークンの有効期限が切れています:', timeDiff, '分');
      
      // 期限切れのトークンを無効化
      await env.DB.prepare(`
        UPDATE user_profiles SET magic_link_used = 1 WHERE magic_link_token = ?
      `).bind(token).run();

      return new Response(createErrorPage('リンクの有効期限が切れています。再度登録を行ってください。'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // ユーザープロフィールを認証済みにマーク
    const registrationResult = await markUserAsVerified(userRecord.user_id, env);
    
    if (!registrationResult.success) {
      console.error('ユーザープロフィールの認証に失敗:', registrationResult.error);
      return new Response(createErrorPage('認証処理でエラーが発生しました'), {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // トークンを使用済みにマーク
    await env.DB.prepare(`
      UPDATE user_profiles SET magic_link_used = 1 WHERE magic_link_token = ?
    `).bind(token).run();

    console.log('マジックリンク認証が完了しました');

    // 成功ページを表示
    return new Response(createSuccessPage(userRecord.user_id), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (error) {
    console.error('マジックリンク検証APIエラー:', error);
    return new Response(createErrorPage('サーバーエラーが発生しました'), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

/**
 * ユーザーを認証済みにマークする関数
 * @param {string} email - メールアドレス
 * @param {object} env - 環境変数
 * @returns {object} 認証結果
 */
async function markUserAsVerified(email, env) {
  try {
    console.log('ユーザーの認証を開始:', email);

    // ユーザープロフィールを認証済みにマーク
    const result = await env.DB.prepare(`
      UPDATE user_profiles SET
        is_verified = 1,
        is_active = 1,
        magic_link_used = 1
      WHERE user_id = ?
    `).bind(email).run();

    console.log('ユーザーの認証完了:', result);

    return { success: true };

  } catch (error) {
    console.error('ユーザー認証エラー:', error);
    return { success: false, error: error.message };
  }
}

/**
 * エラーページのHTMLを生成
 * @param {string} message - エラーメッセージ
 * @returns {string} HTML
 */
function createErrorPage(message) {
  return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>認証エラー | 守護神占い</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-red-400 to-red-600 min-h-screen flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <div class="text-red-500 text-6xl mb-4">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h1 class="text-2xl font-bold text-gray-800 mb-4">認証エラー</h1>
            <p class="text-gray-600 mb-6">${message}</p>
            <div class="space-y-3">
                <a href="/register.html" class="block w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                    <i class="fas fa-redo mr-2"></i>再度登録する
                </a>
                <a href="/" class="block w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                    <i class="fas fa-home mr-2"></i>トップページに戻る
                </a>
            </div>
        </div>
    </body>
    </html>
  `;
}

/**
 * 成功ページのHTMLを生成
 * @param {string} email - 登録されたメールアドレス
 * @returns {string} HTML
 */
function createSuccessPage(email) {
  return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>登録完了 | 守護神占い</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-green-400 to-green-600 min-h-screen flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <div class="text-green-500 text-6xl mb-4">
                <i class="fas fa-check-circle"></i>
            </div>
            <h1 class="text-2xl font-bold text-gray-800 mb-4">登録完了！</h1>
            <p class="text-gray-600 mb-6">
                会員登録が正常に完了しました。<br>
                <strong>${email}</strong> で登録されました。
            </p>
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <h3 class="font-semibold text-green-900 mb-2">🎉 登録完了</h3>
                <p class="text-green-800 text-sm">
                    これで守護神占いの会員として、<br>
                    様々な機能をご利用いただけます。
                </p>
            </div>
            <div class="space-y-3">
                <a href="/welcome.html" class="block w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                    <i class="fas fa-home mr-2"></i>ダッシュボードへ
                </a>
                <a href="/" class="block w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                    <i class="fas fa-crystal-ball mr-2"></i>占いを始める
                </a>
            </div>
        </div>
    </body>
    </html>
  `;
}