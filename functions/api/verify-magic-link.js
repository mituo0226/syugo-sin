// GET 専用エンドポイント
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(
      JSON.stringify({ status: "error", message: "token is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // D1データベースの存在確認
  if (!env.DB) {
    console.error("D1 database not bound");
    return new Response(
      JSON.stringify({ status: "error", message: "Database not available" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // トークンの検証
    const magicLinkData = await env.DB.prepare(`
      SELECT * FROM magic_links 
      WHERE token = ? AND used = FALSE AND expires_at > datetime('now')
    `).bind(token).first();

    if (!magicLinkData) {
      // 無効または期限切れトークンの場合もHTMLページを返す
      const errorHtml = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>リンク無効 | AI鑑定師 龍</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background: #0d0d1a;
              color: #fff;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              text-align: center;
            }
            .container {
              background: rgba(13, 13, 26, 0.95);
              border-radius: 20px;
              padding: 40px;
              border: 2px solid rgba(255, 99, 99, 0.4);
              box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
            }
            .error-icon {
              font-size: 4em;
              color: #ff6363;
              margin-bottom: 20px;
            }
            h1 { color: #ff6363; margin-bottom: 20px; }
            .redirect-message {
              margin: 20px 0;
              color: rgba(255, 255, 255, 0.8);
            }
            .manual-link {
              margin-top: 20px;
              padding: 10px;
              background: rgba(255, 99, 99, 0.1);
              border-radius: 8px;
            }
            .manual-link a {
              color: #ff6363;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">⚠️</div>
            <h1>リンクが無効です</h1>
            <p>このリンクは無効または期限切れです。</p>
            <div class="redirect-message">
              <p>トップページに移動しています...</p>
              <p>自動的に移動しない場合は、以下のリンクをクリックしてください。</p>
            </div>
            <div class="manual-link">
              <a href="/">トップページへ</a>
            </div>
          </div>
          <script>
            // 3秒後に自動リダイレクト
            setTimeout(() => {
              window.location.href = '/';
            }, 3000);
          </script>
        </body>
        </html>
      `;

      return new Response(errorHtml, {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // 既存ユーザーの確認
    const existingUser = await env.DB.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(magicLinkData.email).first();

    if (existingUser) {
      // 既に登録済みの場合はトークンを無効化
      await env.DB.prepare(`
        UPDATE magic_links SET used = TRUE WHERE token = ?
      `).bind(token).run();

      // 既存ユーザーの場合も直接ritual-guardian.htmlにリダイレクト
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/ritual-guardian.html"
        }
      });
    }

    // ユーザー登録処理（ローカルストレージ情報も含めて）
    try {
      // usersテーブルに基本情報を登録
      const userResult = await env.DB.prepare(`
        INSERT INTO users (email, nickname)
        VALUES (?, ?)
      `).bind(
        magicLinkData.email,
        magicLinkData.nickname
      ).run();
      
      const userId = userResult.meta.last_row_id;
      
      // マジックリンクデータから追加情報を抽出
      const additionalInfo = {
        birthYear: magicLinkData.birth_year || null,
        birthMonth: magicLinkData.birth_month || null,
        birthDay: magicLinkData.birth_day || null,
        guardianKey: magicLinkData.guardian_key || null,
        guardianName: magicLinkData.guardian_name || null,
        worryType: magicLinkData.worry_type || null,
        registrationInfo: magicLinkData.registration_info || null
      };
      
      // user_profilesテーブルに詳細情報を保存（存在する場合）
      try {
        await env.DB.prepare(`
          INSERT INTO user_profiles (
            user_id, birth_year, birth_month, birth_day, 
            guardian_key, guardian_name, worry_type, registration_info
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          userId,
          additionalInfo.birthYear,
          additionalInfo.birthMonth,
          additionalInfo.birthDay,
          additionalInfo.guardianKey,
          additionalInfo.guardianName,
          additionalInfo.worryType,
          JSON.stringify(additionalInfo.registrationInfo)
        ).run();
        
        console.log("User profile created successfully for user ID:", userId);
        
      } catch (profileError) {
        console.error("Error creating user profile:", profileError);
        // プロフィール作成に失敗してもユーザー登録は続行
      }

      // トークンを無効化
      await env.DB.prepare(`
        UPDATE magic_links SET used = TRUE WHERE token = ?
      `).bind(token).run();

      console.log("User registered successfully:", { 
        email: magicLinkData.email, 
        nickname: magicLinkData.nickname 
      });

      // 成功時は直接ritual-guardian.htmlにリダイレクト
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/ritual-guardian.html"
        }
      });

    } catch (dbError) {
      console.error("Database error during user registration:", dbError);
      return new Response(
        JSON.stringify({ 
          status: "error", 
          message: `Database error: ${dbError.message}` 
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Token verification error:", error);
    return new Response(
      JSON.stringify({ 
        status: "error", 
        message: "Internal server error" 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}