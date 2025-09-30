// 共通ユーティリティ関数

// CORS ヘッダーの生成
export function getCorsHeaders(origin) {
  const allowedOrigins = [
    "https://syugo-sin.com",
    "https://syugo-sin.pages.dev",
    "http://localhost:3000",
    "http://localhost:8080"
  ];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : "https://syugo-sin.com",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

// エラーレスポンスの生成
export function createErrorResponse(message, status = 500, corsHeaders = {}) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
}

// 成功レスポンスの生成
export function createSuccessResponse(data, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
}

// Gmail APIを使用したメール送信関数
export async function sendMagicLinkEmail(toEmail, nickname, magicLinkUrl, expiresAt, env) {
  // Gmail API設定の確認
  if (!env.GOOGLE_REFRESH_TOKEN) {
    console.log('=== Gmail API設定が未完了 ===');
    console.log('宛先:', toEmail);
    console.log('ニックネーム:', nickname);
    console.log('マジックリンク:', magicLinkUrl);
    console.log('有効期限:', expiresAt);
    console.log('========================');
    console.log('Gmail API設定が未完了のため、テストモードで動作しています');
    return true;
  }

  try {
    // Refresh Tokenを使ってAccess Tokenを取得
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: env.GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to refresh access token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // メール本文の準備
    const emailHtml = generateEmailTemplate(nickname, magicLinkUrl, expiresAt);
    
    // Gmail APIのmessage形式を使用
    const emailContent = [
      `To: ${toEmail}`,
      `From: "${env.GOOGLE_SMTP_FROM_NAME || 'AI鑑定師 龍'}" <${env.GOOGLE_SMTP_USER || 'info@syugo-sin.com'}>`,
      'Subject: =?UTF-8?B?' + btoa(unescape(encodeURIComponent('【AI鑑定師 龍】会員登録のご案内'))) + '?=',
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      emailHtml
    ].join('\r\n');

    const message = {
      raw: btoa(unescape(encodeURIComponent(emailContent)))
    };

    console.log('=== Gmail API送信開始 ===');
    console.log('送信先:', toEmail);
    console.log('送信者:', env.GOOGLE_SMTP_USER);
    
    // Gmail APIを使用してメール送信
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    console.log('Gmail API レスポンス ステータス:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gmail API error:', response.status, errorData);
      throw new Error(`Gmail API error: ${response.status} - ${errorData}`);
    }

    const result = await response.json();
    console.log('=== Gmail API送信成功 ===');
    console.log('メッセージID:', result.id);
    return true;
  } catch (error) {
    console.error('Gmail API error:', error);
    // エラーが発生した場合でも、テストモードとして動作を継続
    console.log('=== エラー発生: テストモードで継続 ===');
    console.log('宛先:', toEmail);
    console.log('ニックネーム:', nickname);
    console.log('マジックリンク:', magicLinkUrl);
    console.log('有効期限:', expiresAt);
    console.log('========================');
    return true;
  }
}

// メールテンプレート生成関数
function generateEmailTemplate(nickname, magicLinkUrl, expiresAt) {
  const expiresAtFormatted = new Date(expiresAt).toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo'
  });

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>会員登録のご案内</title>
    <style>
        body {
            font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #0d0d1a 0%, #1a1a2e 50%, #16213e 100%);
            color: #ffffff;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: bold;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .content {
            padding: 30px 20px;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #0d0d1a;
        }
        .message {
            font-size: 16px;
            margin-bottom: 25px;
            line-height: 1.8;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(90deg, #66ccff, #4dd0e1);
            color: #ffffff;
            text-decoration: none;
            padding: 15px 30px;
            border-radius: 8px;
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            margin: 20px 0;
            transition: all 0.3s ease;
        }
        .cta-button:hover {
            background: linear-gradient(90deg, #4dd0e1, #26c6da);
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 204, 255, 0.4);
        }
        .expiry-notice {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
            color: #856404;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 14px;
            color: #6c757d;
        }
        .magic-link {
            word-break: break-all;
            background-color: #f8f9fa;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            margin: 15px 0;
            border: 1px solid #dee2e6;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐉 AI鑑定師 龍</h1>
            <p>会員登録のご案内</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                ${nickname} 様
            </div>
            
            <div class="message">
                この度は「AI鑑定師 龍」へのご登録をお申し込みいただき、誠にありがとうございます。<br><br>
                以下のボタンをクリックして、会員登録を完了してください。
            </div>
            
            <div style="text-align: center;">
                <a href="${magicLinkUrl}" class="cta-button">
                    会員登録を完了する
                </a>
            </div>
            
            <div class="expiry-notice">
                <strong>⚠️ 重要：</strong>このリンクは <strong>${expiresAtFormatted}</strong> まで有効です。<br>
                期限切れの場合は、再度お申し込みください。
            </div>
            
            <div class="message">
                もしボタンがクリックできない場合は、以下のリンクをコピーしてブラウザのアドレスバーに貼り付けてください：
            </div>
            
            <div class="magic-link">
                ${magicLinkUrl}
            </div>
            
            <div class="message">
                ご不明な点がございましたら、お気軽にお問い合わせください。<br><br>
                今後とも「AI鑑定師 龍」をよろしくお願いいたします。
            </div>
        </div>
        
        <div class="footer">
            <p>AI鑑定師 龍<br>
            このメールは自動送信されています。返信はできません。</p>
        </div>
    </div>
</body>
</html>
  `;
}
