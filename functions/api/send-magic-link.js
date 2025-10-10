/**
 * マジックリンク送信API（完全版）
 * ローカルストレージのデータを受け取り、D1にINSERTし、Resendでマジックリンクを送信する
 * 
 * 動作の流れ:
 * 1. リクエストからemailとlocalDataを取得
 * 2. ランダムUUIDトークンを生成
 * 3. D1データベースにユーザーデータをINSERT/UPDATE
 * 4. Resendでマジックリンクメールを送信
 * 5. 成功レスポンスを返却
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    console.log('=== マジックリンク送信API開始 ===');
    
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

    // D1データベースにユーザーデータを保存
    try {
      console.log('=== D1データベース保存開始 ===');
      console.log('email:', email);
      console.log('token:', token);
      console.log('localData:', localData);
      
      // 既存ユーザーの確認
      const existingUser = await env.DB.prepare(`
        SELECT id FROM user_profiles WHERE user_id = ?
      `).bind(email).first();

      let result;
      if (existingUser) {
        console.log('既存ユーザーが見つかりました、更新処理を実行');
        // 既存ユーザーの更新
        result = await env.DB.prepare(`
          UPDATE user_profiles SET
            nickname = ?,
            birth_year = ?,
            birth_month = ?,
            birth_day = ?,
            guardian_key = ?,
            guardian_name = ?,
            worry = ?,
            registration_info = ?,
            magic_link_token = ?,
            magic_link_created_at = datetime('now'),
            magic_link_used = 0,
            is_verified = 0,
            is_active = 1,
            created_at = datetime('now')
          WHERE user_id = ?
        `).bind(
          localData.nickname || '',
          localData.birthYear || '',
          localData.birthMonth || '',
          localData.birthDay || '',
          localData.guardianKey || '',
          localData.guardian ? localData.guardian.name : '',
          localData.worry || '',
          JSON.stringify(localData),
          token,
          email
        ).run();
      } else {
        console.log('新規ユーザーとして登録処理を実行');
        // 新規ユーザーの挿入
        result = await env.DB.prepare(`
          INSERT INTO user_profiles (
            user_id, nickname, birth_year, birth_month, birth_day,
            guardian_key, guardian_name, worry, registration_info,
            magic_link_token, magic_link_created_at, magic_link_used,
            is_verified, is_active, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0, 0, 1, datetime('now'))
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
      }
      
      console.log('D1データベース保存結果:', result);
      console.log('✅ ユーザーデータをD1に保存しました');
    } catch (dbError) {
      console.error('=== D1データベース保存エラー ===');
      console.error('エラー詳細:', dbError);
      console.error('エラーメッセージ:', dbError.message);
      console.error('エラースタック:', dbError.stack);
      return new Response(JSON.stringify({
        success: false,
        error: 'ユーザーデータの保存に失敗しました',
        details: dbError.message,
        stack: dbError.stack
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Resendでマジックリンクメールを送信
    console.log('=== Resendメール送信開始 ===');
    try {
      const emailSent = await sendMagicLinkEmail(email, magicLinkUrl, env);
      
      if (emailSent) {
        console.log('✅ マジックリンクメールの送信が完了しました');
        
        return new Response(JSON.stringify({
          success: true,
          message: 'マジックリンクを送信しました',
          token: token
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        console.error('❌ メール送信に失敗しました');
        return new Response(JSON.stringify({
          success: false,
          error: 'メール送信に失敗しました'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (emailError) {
      console.error('=== メール送信エラー ===');
      console.error('メール送信エラー詳細:', emailError);
      return new Response(JSON.stringify({
        success: false,
        error: 'メール送信中にエラーが発生しました',
        details: emailError.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('=== マジックリンク送信APIエラー ===');
    console.error('エラー詳細:', error);
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
 * Resendでマジックリンクメールを送信する関数
 * @param {string} email - 送信先メールアドレス
 * @param {string} magicLinkUrl - マジックリンクのURL
 * @param {object} env - 環境変数
 * @returns {boolean} 送信成功の場合true
 */
async function sendMagicLinkEmail(email, magicLinkUrl, env) {
  try {
    console.log('=== sendMagicLinkEmail 関数開始 ===');
    console.log('メール送信先:', email);
    console.log('マジックリンクURL:', magicLinkUrl);
    
    if (!env.RESEND_API_KEY) {
      console.error('Resend APIキーが設定されていません');
      console.log('環境変数一覧:', Object.keys(env));
      return false;
    }
    
    console.log('Resend APIキー確認完了');

    const emailData = {
      from: 'AI鑑定師 龍 <noreply@syugo-sin.com>',
      to: [email],
      subject: '【守護神占い】メール認証のご案内',
      html: `
        <div style="font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #66ccff; font-size: 24px; margin: 0;">守護神占い</h1>
            <p style="color: #666; font-size: 14px; margin: 10px 0 0 0;">AI鑑定師 龍</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #333; font-size: 20px; margin: 0 0 20px 0;">メール認証のご案内</h2>
            <p style="color: #666; line-height: 1.6; margin: 0 0 20px 0;">
              守護神占いの会員登録にお申し込みいただき、ありがとうございます。<br>
              会員登録を完了するため、下記のリンクをクリックしてメール認証を行ってください。
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${magicLinkUrl}" 
                 style="display: inline-block; background: #66ccff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                メール認証を完了する
              </a>
            </div>
            
            <p style="color: #999; font-size: 12px; margin: 20px 0 0 0;">
              ※このリンクの有効期限は30分です。<br>
              ※もしこのメールに心当たりがない場合は、このメールを無視してください。
            </p>
          </div>
          
          <div style="text-align: center; color: #999; font-size: 12px;">
            <p>守護神占い - AI鑑定師 龍</p>
            <p>このメールに返信はできません。</p>
          </div>
        </div>
      `
    };

    console.log('Resend APIに送信開始');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    console.log('Resend API応答:', response.status, response.statusText);

    if (response.ok) {
      const result = await response.json();
      console.log('メール送信成功:', result);
      return true;
    } else {
      const errorText = await response.text();
      console.error('=== メール送信失敗 ===');
      console.error('HTTPステータス:', response.status);
      console.error('エラーレスポンス:', errorText);
      return false;
    }

  } catch (error) {
    console.error('メール送信エラー:', error);
    return false;
  }
}
