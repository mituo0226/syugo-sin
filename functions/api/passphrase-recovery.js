/**
 * 合言葉リカバリーAPI
 * ニックネーム + 生年月日 + メールアドレスで本人確認し、
 * 合言葉リセット用のマジックリンクを送信する
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    console.log('=== 合言葉リカバリーAPI開始 ===');

    // リクエストボディを取得
    const { nickname, birthYear, birthMonth, birthDay, email } = await request.json();

    console.log('リカバリーリクエスト:');
    console.log('- ニックネーム:', nickname);
    console.log('- 生年月日:', `${birthYear}/${birthMonth}/${birthDay}`);
    console.log('- メールアドレス:', email);

    // バリデーション
    if (!nickname || !birthYear || !birthMonth || !birthDay || !email) {
      return new Response(JSON.stringify({
        success: false,
        message: 'すべての項目を入力してください'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // データベースでユーザーを確認
    const user = await env.DB.prepare(`
      SELECT * FROM user_profiles
      WHERE nickname = ?
      AND birth_year = ?
      AND birth_month = ?
      AND birth_day = ?
      AND user_id = ?
      AND is_verified = 1
      LIMIT 1
    `).bind(nickname, birthYear, birthMonth, birthDay, email).first();

    if (!user) {
      console.log('❌ ユーザーが見つかりません');
      return new Response(JSON.stringify({
        success: false,
        message: 'ご入力の情報と一致するユーザーが見つかりません'
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ ユーザー確認成功:', user.user_id);

    // リカバリートークンを生成
    const recoveryToken = crypto.randomUUID();
    console.log('生成されたトークン:', recoveryToken);

    // トークンをデータベースに保存
    await env.DB.prepare(`
      UPDATE user_profiles SET
        magic_link_token = ?,
        magic_link_created_at = datetime('now'),
        magic_link_used = 0
      WHERE user_id = ?
    `).bind(recoveryToken, email).run();

    console.log('✅ リカバリートークンを保存しました');

    // リカバリーリンクを生成
    const recoveryUrl = `https://syugo-sin.com/passphrase-reset.html?token=${recoveryToken}`;
    console.log('リカバリーURL:', recoveryUrl);

    // Resendでメール送信
    try {
      const resendApiKey = env.RESEND_API_KEY;
      if (!resendApiKey) {
        console.error('❌ RESEND_API_KEY が設定されていません');
        throw new Error('メール送信の設定エラー');
      }

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: 'noreply@syugo-sin.com',
          to: email,
          subject: '【守護神占い】合言葉の再発行のご案内',
          html: `
            <!DOCTYPE html>
            <html lang="ja">
            <head>
              <meta charset="UTF-8">
              <style>
                body {
                  font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', sans-serif;
                  background: #f5f5f5;
                  padding: 20px;
                }
                .container {
                  max-width: 600px;
                  margin: 0 auto;
                  background: white;
                  border-radius: 10px;
                  overflow: hidden;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                }
                .header {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  padding: 30px;
                  text-align: center;
                }
                .content {
                  padding: 40px 30px;
                }
                .button {
                  display: inline-block;
                  background: linear-gradient(45deg, #667eea, #764ba2);
                  color: white;
                  padding: 15px 40px;
                  text-decoration: none;
                  border-radius: 50px;
                  font-weight: bold;
                  margin: 20px 0;
                }
                .footer {
                  background: #f8f9fa;
                  padding: 20px;
                  text-align: center;
                  font-size: 12px;
                  color: #666;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🔮 合言葉の再発行</h1>
                </div>
                <div class="content">
                  <p>こんにちは、<strong>${nickname}</strong> 様</p>
                  
                  <p>守護神占いの合言葉再発行のリクエストを受け付けました。</p>
                  
                  <p>下記のリンクをクリックして、新しい合言葉を選択してください。</p>
                  
                  <p style="text-align: center;">
                    <a href="${recoveryUrl}" class="button">
                      ✨ 新しい合言葉を選択する
                    </a>
                  </p>
                  
                  <p style="color: #666; font-size: 14px;">
                    ※ このリンクは24時間有効です。<br>
                    ※ お心当たりがない場合は、このメールを無視してください。
                  </p>
                  
                  <p>あなたの守護神: <strong>${user.guardian_name}</strong></p>
                </div>
                <div class="footer">
                  <p>守護神占い - syugo-sin.com</p>
                </div>
              </div>
            </body>
            </html>
          `
        })
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json();
        console.error('❌ Resendメール送信エラー:', errorData);
        throw new Error('メール送信に失敗しました');
      }

      console.log('✅ リカバリーメールを送信しました');

      return new Response(JSON.stringify({
        success: true,
        message: '確認メールを送信しました'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (emailError) {
      console.error('=== メール送信エラー ===');
      console.error(emailError);
      return new Response(JSON.stringify({
        success: false,
        message: 'メール送信に失敗しました',
        error: emailError.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('=== 合言葉リカバリーエラー ===');
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

