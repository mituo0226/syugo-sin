/**
 * マジックリンク送信API
 * ユーザーが入力したメールアドレスに認証用のマジックリンクを送信します
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    console.log('=== マジックリンク送信APIが呼び出されました ===');
    
    // リクエストボディを取得
    const requestBody = await request.json();
    console.log('リクエストデータ:', requestBody);
    
    const { email, localData } = requestBody;

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

    if (!localData) {
      console.error('ローカルデータが提供されていません');
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

    // ユニークなトークンを生成（UUID形式）
    const token = crypto.randomUUID();
    console.log('生成されたトークン:', token);

    // 認証リンクのURLを生成
    const baseUrl = new URL(request.url).origin;
    const magicLinkUrl = `${baseUrl}/api/verify-magic-link?token=${token}`;
    console.log('生成されたマジックリンク:', magicLinkUrl);

    // データベースにトークンとローカルデータを保存
    try {
      await env.DB.prepare(`
        INSERT INTO magic_links (email, token, created_at)
        VALUES (?, ?, datetime('now'))
      `).bind(email, token).run();
      
      console.log('マジックリンク情報をデータベースに保存しました');
    } catch (dbError) {
      console.error('データベース保存エラー:', dbError);
      return new Response(JSON.stringify({
        success: false,
        error: 'データベース保存に失敗しました'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ローカルデータを一時的に保存（検証時に使用）
    // 実際の実装では、セキュアな方法でデータを保存することを推奨
    try {
      await env.DB.prepare(`
        INSERT INTO user_profiles (user_id, registration_info, created_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          registration_info = excluded.registration_info,
          created_at = excluded.created_at
      `).bind(email, JSON.stringify(localData)).run();
      
      console.log('ローカルデータを一時保存しました');
    } catch (tempSaveError) {
      console.error('一時保存エラー:', tempSaveError);
      // 一時保存の失敗は致命的ではないので続行
    }

    // メール送信処理
    const emailSent = await sendMagicLinkEmail(email, magicLinkUrl, env);
    
    if (emailSent) {
      console.log('マジックリンクメールの送信が完了しました');
      return new Response(JSON.stringify({
        success: true,
        message: '認証リンクを送信しました',
        email: email
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      console.error('メール送信に失敗しました');
      return new Response(JSON.stringify({
        success: false,
        error: 'メール送信に失敗しました'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('マジックリンク送信APIエラー:', error);
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
 * マジックリンクメールを送信する関数
 * @param {string} email - 送信先メールアドレス
 * @param {string} magicLinkUrl - マジックリンクURL
 * @param {object} env - 環境変数
 * @returns {boolean} 送信成功かどうか
 */
async function sendMagicLinkEmail(email, magicLinkUrl, env) {
  try {
    // 開発環境の場合はメール送信をスキップ
    if (env.ENVIRONMENT === 'development') {
      console.log('開発環境のため、メール送信をスキップします');
      console.log('マジックリンクURL:', magicLinkUrl);
      return true;
    }

    // Resend APIキーの確認
    if (!env.RESEND_API_KEY) {
      console.error('RESEND_API_KEYが設定されていません');
      return false;
    }

    console.log('Resend APIを使用してメールを送信します');

    // Resend APIを使用してメール送信
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@syugo-sin.com',
        to: email,
        subject: '【守護神占い】会員登録の認証をお願いします',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #667eea; font-size: 24px;">🔮 守護神占い</h1>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h2 style="color: #333; margin-bottom: 15px;">会員登録の認証</h2>
              <p style="color: #666; line-height: 1.6;">
                この度は守護神占いをご利用いただき、ありがとうございます。<br>
                会員登録を完了するために、以下のボタンをクリックして認証を行ってください。
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${magicLinkUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 25px; 
                        font-weight: bold; 
                        display: inline-block;">
                認証を完了する
              </a>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-top: 20px;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                <strong>⚠️ ご注意:</strong><br>
                • このリンクは30分間有効です<br>
                • 心当たりのない場合は、このメールを無視してください<br>
                • リンクがクリックできない場合は、以下のURLをコピーしてブラウザに貼り付けてください
              </p>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; word-break: break-all;">
              <p style="color: #666; font-size: 12px; margin: 0;">
                ${magicLinkUrl}
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
              <p>このメールは自動送信されています。返信はできません。</p>
            </div>
          </div>
        `
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resend API エラー:', errorText);
      return false;
    }

    const result = await response.json();
    console.log('メール送信成功:', result);
    return true;

  } catch (error) {
    console.error('メール送信エラー:', error);
    return false;
  }
}