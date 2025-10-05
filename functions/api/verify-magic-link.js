/**
 * マジックリンク認証API（完全版）
 * メール内リンククリック時にトークンを検証し、該当ユーザーの認証状態を更新する
 * 
 * 動作の流れ:
 * 1. クエリパラメータからtokenを取得
 * 2. D1でトークンの有効性を確認（存在・未使用）
 * 3. 有効な場合、is_verified=1, magic_link_used=1に更新
 * 4. 認証完了HTMLレスポンスを返却
 */

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    console.log('=== マジックリンク認証API開始 ===');
    
    // URLからクエリパラメータを取得
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    
    console.log('取得されたトークン:', token);

    // トークンのバリデーション
    if (!token) {
      console.error('トークンが提供されていません');
      return new Response(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>認証エラー - 守護神占い</title>
          <style>
            body { font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: white; }
            .error { background: rgba(255, 0, 0, 0.1); padding: 20px; border-radius: 10px; border: 1px solid #ff0000; }
          </style>
        </head>
        <body>
          <h1>認証エラー</h1>
          <div class="error">
            <p>認証トークンが見つかりません。</p>
            <p>メール内のリンクを正しくクリックしてください。</p>
          </div>
        </body>
        </html>
      `, {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // データベース接続確認
    if (!env.DB) {
      console.error('データベース接続が見つかりません');
      return new Response(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>システムエラー - 守護神占い</title>
          <style>
            body { font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: white; }
            .error { background: rgba(255, 0, 0, 0.1); padding: 20px; border-radius: 10px; border: 1px solid #ff0000; }
          </style>
        </head>
        <body>
          <h1>システムエラー</h1>
          <div class="error">
            <p>データベース接続エラーが発生しました。</p>
            <p>しばらく時間をおいて再度お試しください。</p>
          </div>
        </body>
        </html>
      `, {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // トークンの有効性を確認
    try {
      console.log('=== トークン検証開始 ===');
      
      const userResult = await env.DB.prepare(`
        SELECT id, user_id, nickname, magic_link_used, is_verified
        FROM user_profiles 
        WHERE magic_link_token = ?
      `).bind(token).first();

      console.log('トークン検索結果:', userResult);

      if (!userResult) {
        console.error('トークンが見つかりません:', token);
        return new Response(`
          <!DOCTYPE html>
          <html lang="ja">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>認証エラー - 守護神占い</title>
            <style>
              body { font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: white; }
              .error { background: rgba(255, 0, 0, 0.1); padding: 20px; border-radius: 10px; border: 1px solid #ff0000; }
            </style>
          </head>
          <body>
            <h1>認証エラー</h1>
            <div class="error">
              <p>無効な認証トークンです。</p>
              <p>メール内のリンクを正しくクリックしてください。</p>
            </div>
          </body>
          </html>
        `, {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // トークンが既に使用済みかチェック
      if (userResult.magic_link_used === 1) {
        console.error('トークンが既に使用済みです:', token);
        return new Response(`
          <!DOCTYPE html>
          <html lang="ja">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>認証済み - 守護神占い</title>
            <style>
              body { font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: white; }
              .success { background: rgba(0, 255, 0, 0.1); padding: 20px; border-radius: 10px; border: 1px solid #00ff00; }
            </style>
          </head>
          <body>
            <h1>既に認証済み</h1>
            <div class="success">
              <p>このメールアドレスは既に認証済みです。</p>
              <p>会員登録が完了しています。</p>
            </div>
          </body>
          </html>
        `, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // ユーザーを認証済みに更新
      console.log('=== ユーザー認証更新開始 ===');
      const updateResult = await env.DB.prepare(`
        UPDATE user_profiles 
        SET is_verified = 1, magic_link_used = 1
        WHERE magic_link_token = ?
      `).bind(token).run();

      console.log('認証更新結果:', updateResult);
      console.log('✅ ユーザー認証が完了しました:', userResult.user_id);

      // 認証完了HTMLレスポンス
      return new Response(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>認証完了 - 守護神占い</title>
          <style>
            body { 
              font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif; 
              text-align: center; 
              padding: 50px; 
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
              color: white; 
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              max-width: 600px;
              padding: 40px;
              background: rgba(255, 255, 255, 0.05);
              border-radius: 20px;
              border: 1px solid rgba(102, 204, 255, 0.3);
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            }
            .success { 
              background: rgba(0, 255, 0, 0.1); 
              padding: 30px; 
              border-radius: 15px; 
              border: 1px solid #00ff00;
              margin-bottom: 30px;
            }
            .title {
              color: #66ccff;
              font-size: 28px;
              margin-bottom: 20px;
              text-shadow: 0 0 20px rgba(102, 204, 255, 0.6);
            }
            .message {
              font-size: 18px;
              line-height: 1.6;
              margin-bottom: 20px;
            }
            .user-info {
              background: rgba(102, 204, 255, 0.1);
              padding: 20px;
              border-radius: 10px;
              margin: 20px 0;
              border: 1px solid rgba(102, 204, 255, 0.3);
            }
            .button {
              display: inline-block;
              background: #66ccff;
              color: white;
              padding: 15px 30px;
              text-decoration: none;
              border-radius: 10px;
              font-weight: bold;
              margin: 10px;
              transition: all 0.3s ease;
            }
            .button:hover {
              background: #4db8ff;
              transform: translateY(-2px);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="title">🎉 認証完了！</h1>
            <div class="success">
              <div class="message">
                <p><strong>メール認証が正常に完了しました！</strong></p>
                <p>守護神占いの会員登録が完了いたします。</p>
              </div>
              <div class="user-info">
                <p>登録ユーザー: <strong>${userResult.nickname || userResult.user_id}</strong></p>
                <p>メールアドレス: <strong>${userResult.user_id}</strong></p>
              </div>
            </div>
            <p>これで守護神占いのすべての機能をご利用いただけます。</p>
            <div style="margin-top: 30px;">
              <a href="https://syugo-sin.com" class="button">ホームページへ</a>
              <a href="https://syugo-sin.com/consult/chat.html" class="button">鑑定を開始する</a>
            </div>
          </div>
        </body>
        </html>
      `, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });

    } catch (dbError) {
      console.error('=== データベースエラー ===');
      console.error('エラー詳細:', dbError);
      console.error('エラーメッセージ:', dbError.message);
      console.error('エラースタック:', dbError.stack);
      
      return new Response(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>システムエラー - 守護神占い</title>
          <style>
            body { font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: white; }
            .error { background: rgba(255, 0, 0, 0.1); padding: 20px; border-radius: 10px; border: 1px solid #ff0000; }
          </style>
        </head>
        <body>
          <h1>システムエラー</h1>
          <div class="error">
            <p>認証処理中にエラーが発生しました。</p>
            <p>しばらく時間をおいて再度お試しください。</p>
          </div>
        </body>
        </html>
      `, {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

  } catch (error) {
    console.error('=== マジックリンク認証APIエラー ===');
    console.error('エラー詳細:', error);
    console.error('エラースタック:', error.stack);
    
    return new Response(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>システムエラー - 守護神占い</title>
        <style>
          body { font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: white; }
          .error { background: rgba(255, 0, 0, 0.1); padding: 20px; border-radius: 10px; border: 1px solid #ff0000; }
        </style>
      </head>
      <body>
        <h1>システムエラー</h1>
        <div class="error">
          <p>予期しないエラーが発生しました。</p>
          <p>システム管理者にお問い合わせください。</p>
        </div>
      </body>
      </html>
    `, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}
