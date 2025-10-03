export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // JSON パース（不正JSONを明示的に 400 に）
    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { email, nickname, userData } = payload || {};
    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // D1データベースの存在確認
    if (!env.DB) {
      console.error("D1 database not bound");
      return new Response(JSON.stringify({ error: "Database not available" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 既存ユーザーの確認
    const existingUser = await env.DB.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(email).first();

    if (existingUser) {
      return new Response(JSON.stringify({ 
        error: "このメールアドレスは既に登録されています" 
      }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    // マジックリンク生成
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30分後
    const origin = new URL(request.url).origin;
    const magicLink = `${origin}/api/verify-magic-link?token=${token}`;

    // magic_linksテーブルに保存（ローカルストレージ情報も含めて）
    try {
      // magic_linksテーブルのスキーマを拡張
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS magic_links (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token TEXT UNIQUE NOT NULL,
          email TEXT NOT NULL,
          nickname TEXT,
          birth_year TEXT,
          birth_month TEXT,
          birth_day TEXT,
          guardian_key TEXT,
          guardian_name TEXT,
          worry_type TEXT,
          registration_info TEXT,
          expires_at TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          used BOOLEAN DEFAULT FALSE
        )
      `).run();
      
      await env.DB.prepare(`
        INSERT INTO magic_links (
          token, email, nickname, birth_year, birth_month, birth_day,
          guardian_key, guardian_name, worry_type, registration_info, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        token,
        email,
        nickname || null,
        userData?.birthYear || null,
        userData?.birthMonth || null,
        userData?.birthDay || null,
        userData?.guardianKey || null,
        userData?.guardian?.name || null,
        userData?.worry || null,
        JSON.stringify(userData || {}),
        expiresAt.toISOString()
      ).run();
      
      console.log("Magic link data saved:", { token, email, nickname, expiresAt });
    } catch (dbError) {
      console.error("Failed to save magic link data:", dbError);
      return new Response(JSON.stringify({ 
        error: "Failed to create magic link" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // メール本文のHTML
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; color: #333333; padding: 30px; border-radius: 15px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; margin-bottom: 30px; background: #ffffff; padding: 25px; border-radius: 12px; border: 3px solid #66ccff; box-shadow: 0 4px 15px rgba(102, 204, 255, 0.3);">
          <h1 style="color: #1a1a2e; font-size: 24px; margin: 0; font-weight: bold; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">【守護神】メール登録完了</h1>
          <p style="color: #2c3e50; font-size: 16px; margin: 10px 0; font-weight: bold;">会員登録のご案内</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #66ccff; box-shadow: 0 2px 8px rgba(102, 204, 255, 0.2);">
          <p style="font-size: 18px; margin: 0; color: #1a1a2e; font-weight: bold; text-align: center;">${nickname || 'ユーザー'} 様</p>
        </div>
        
        <div style="background: #f0f8ff; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #4a90e2; box-shadow: 0 2px 8px rgba(74, 144, 226, 0.15);">
          <p style="font-size: 16px; line-height: 1.6; margin: 0; color: #2c3e50; text-align: center; font-weight: 500;">
            守護神との交信を完了するために、以下のリンクをクリックして会員登録を完了してください。
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${magicLink}" style="background: linear-gradient(45deg, #66ccff, #9d4edd); color: #ffffff; padding: 18px 35px; text-decoration: none; border-radius: 30px; display: inline-block; font-size: 18px; font-weight: bold; box-shadow: 0 6px 20px rgba(102, 204, 255, 0.4); border: 2px solid #ffffff;">
            ✨ 登録を確認 ✨
          </a>
        </div>
        
        <div style="background: #fff8dc; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #ffa500; box-shadow: 0 2px 8px rgba(255, 165, 0, 0.2);">
          <p style="color: #8b4513; font-size: 14px; margin: 0; line-height: 1.6; font-weight: 500;">
            ⏰ <strong>このリンクは30分間有効です</strong><br><br>
            📧 もしボタンがクリックできない場合は、以下のURLをコピーしてブラウザに貼り付けてください：<br><br>
            <a href="${magicLink}" style="color: #0066cc; word-break: break-all; text-decoration: underline; font-weight: bold; background: #e6f3ff; padding: 5px 8px; border-radius: 4px; display: inline-block; margin-top: 8px;">${magicLink}</a>
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e0e0e0;">
          <p style="color: #666666; font-size: 12px; margin: 0; font-style: italic;">
            【守護神】AIjudgment - あなたの運命を導くAI鑑定師
          </p>
        </div>
      </div>
    `;

    // Resend APIでメール送信
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "noreply@syugo-sin.com",
        to: email,
        subject: "【守護神】メール登録完了",
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Resend API error: ${response.status} ${errorText}`);
    }

    const resendData = await response.json();
    console.log("Email sent successfully via Resend:", resendData);

    return new Response(
      JSON.stringify({ 
        status: "ok", 
        email, 
        nickname, 
        magicLink,
        expiresAt: expiresAt.toISOString(),
        messageId: resendData.id 
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Send magic link error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}