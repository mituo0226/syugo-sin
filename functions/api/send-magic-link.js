/**
 * マジックリンク送信API（新構造対応）
 * ユーザーデータを新規作成し、マジックリンクを送信します
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

    // ランダムなトークンを生成
    const token = crypto.randomUUID();
    console.log('生成されたトークン:', token);

    // 認証リンクのURLを生成
    const baseUrl = new URL(request.url).origin;
    const magicLinkUrl = `${baseUrl}/api/verify-magic-link?token=${token}`;
    console.log('生成されたマジックリンク:', magicLinkUrl);

    // 新規レコードを作成（UPSERT方式）
    try {
      console.log('新規レコードを作成中...');
      console.log('localData:', localData);
      
      await env.DB.prepare(`
        INSERT INTO user_profiles (
          user_id, nickname, birth_year, birth_month, birth_day,
          guardian_key, guardian_name, worry, registration_info,
          magic_link_token, magic_link_created_at, magic_link_used,
          is_verified, is_active, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0, 0, 1, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          nickname = excluded.nickname,
          birth_year = excluded.birth_year,
          birth_month = excluded.birth_month,
          birth_day = excluded.birth_day,
          guardian_key = excluded.guardian_key,
          guardian_name = excluded.guardian_name,
          worry = excluded.worry,
          registration_info = excluded.registration_info,
          magic_link_token = excluded.magic_link_token,
          magic_link_created_at = excluded.magic_link_created_at,
          magic_link_used = 0,
          is_verified = 0,
          is_active = 1,
          created_at = excluded.created_at
      `).bind(
        email,
        localData.nickname || '',
        localData.birthYear || '',
        localData.birthMonth || '',
        localData.birthDay || '',
        localData.guardianKey || '',
        localData.guardian ? localData.guardian.name : '',
        localData.worry || '',
        JSON.stringify(localData),
        token
      ).run();
      
      console.log('ユーザーデータとマジックリンク情報をデータベースに保存しました');
    } catch (dbError) {
      console.error('データベース保存エラー:', dbError);
      return new Response(JSON.stringify({
        success: false,
        error: 'ユーザーデータの保存に失敗しました',
        details: dbError.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // メール送信処理
    const emailSent = await sendMagicLinkEmail(email, magicLinkUrl, env);
    
    if (emailSent) {
      console.log('マジックリンクメールの送信が完了しました');
      
      return new Response(JSON.stringify({
        success: true,
        message: 'マジックリンクを送信しました',
        token: token
      }), {
        status: 200,
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
 * @param {string} magicLinkUrl - マジックリンクのURL
 * @param {object} env - 環境変数
 * @returns {boolean} 送信成功の場合true
 */
async function sendMagicLinkEmail(email, magicLinkUrl, env) {
  try {
    console.log('メール送信開始:', email);
    
    if (!env.RESEND_API_KEY) {
      console.error('Resend APIキーが設定されていません');
      return false;
    }

    const emailData = {
      from: 'AI鑑定師 龍 <noreply@syugo-sin.com>',
      to: [email],
      subject: '【AI鑑定師 龍】会員登録の認証をお願いします',
      html: `
        <div style="font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #66ccff; font-size: 24px; margin: 0;">AI鑑定師 龍</h1>
            <p style="color: #666; font-size: 14px; margin: 10px 0 0 0;">守護神占い</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #333; font-size: 20px; margin: 0 0 20px 0;">会員登録の認証をお願いします</h2>
            <p style="color: #666; line-height: 1.6; margin: 0 0 20px 0;">
              ご登録いただき、ありがとうございます。<br>
              会員登録を完了するため、下記のリンクをクリックして認証を行ってください。
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${magicLinkUrl}" 
                 style="display: inline-block; background: #66ccff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                認証を完了する
              </a>
            </div>
            
            <p style="color: #999; font-size: 12px; margin: 20px 0 0 0;">
              ※このリンクの有効期限は30分です。<br>
              ※もしこのメールに心当たりがない場合は、このメールを無視してください。
            </p>
          </div>
          
          <div style="text-align: center; color: #999; font-size: 12px;">
            <p>AI鑑定師 龍 - 守護神占い</p>
            <p>このメールに返信はできません。</p>
          </div>
        </div>
      `
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('メール送信成功:', result);
      return true;
    } else {
      const errorText = await response.text();
      console.error('メール送信失敗:', response.status, errorText);
      return false;
    }

  } catch (error) {
    console.error('メール送信エラー:', error);
    return false;
  }
}
