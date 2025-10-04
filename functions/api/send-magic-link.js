export async function onRequestPost(context) {
  const { request, env } = context;
  
  console.log("Send magic link API called");
  console.log("Environment variables available:", {
    hasDB: !!env.DB,
    environment: env.ENVIRONMENT,
    hasResendApiKey: !!env.RESEND_API_KEY,
    resendApiKeyLength: env.RESEND_API_KEY ? env.RESEND_API_KEY.length : 0,
    resendApiKeyPrefix: env.RESEND_API_KEY ? env.RESEND_API_KEY.substring(0, 10) + "..." : "none"
  });

  try {
    const requestText = await request.text();
    console.log("Raw request body:", requestText);
    
    let requestBody;
    try {
      requestBody = JSON.parse(requestText);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return new Response("invalid_json", { status: 400 });
    }
    
    console.log("Parsed request body:", requestBody);
    
    const { email, userData } = requestBody;

    if (!email) {
      return new Response("email_required", { status: 400 });
    }

    // トークン生成
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30分

    // DBに保存
    console.log("Inserting into magic_links:", {
      token,
      email,
      birthdate: userData?.birthdate || null,
      guardian: userData?.guardian || null,
      nickname: userData?.nickname || null,
      topic: userData?.topic || null,
      expiresAt: expiresAt.toISOString()
    });
    
    const result = await env.DB.prepare(`
      INSERT INTO magic_links (token, email, birthdate, guardian, nickname, topic, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      token,
      email,
      userData?.birthdate || null,
      userData?.guardian || null,
      userData?.nickname || null,
      userData?.topic || null,
      expiresAt.toISOString()
    ).run();
    
    console.log("Database insert result:", result);

    // 認証URL
    const origin = new URL(request.url).origin;
    const magicLink = `${origin}/api/verify-magic-link?token=${token}`;

    console.log("Magic link generated:", magicLink);

    // 開発環境の場合はメール送信をスキップ
    if (env.ENVIRONMENT === "development") {
      console.log("Development environment - skipping email send");
      console.log("Magic link for testing:", magicLink);
      return new Response(JSON.stringify({ 
        ok: true, 
        magicLink,
        message: "開発環境ではメール送信をスキップしてマジックリンクを直接返します"
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // APIキーの確認
    console.log("=== 環境変数デバッグ情報 ===");
    console.log("Environment:", env.ENVIRONMENT);
    console.log("All environment keys:", Object.keys(env));
    console.log("RESEND_API_KEY exists:", !!env.RESEND_API_KEY);
    console.log("RESEND_API_KEY length:", env.RESEND_API_KEY ? env.RESEND_API_KEY.length : 0);
    console.log("RESEND_API_KEY prefix:", env.RESEND_API_KEY ? env.RESEND_API_KEY.substring(0, 10) + "..." : "none");
    console.log("=============================");
    
    if (!env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY not found");
      return new Response(JSON.stringify({ 
        error: "api_key_missing", 
        message: "メール送信に必要なAPIキーが設定されていません。Cloudflareダッシュボードで環境変数を設定してください。",
        debug: {
          environment: env.ENVIRONMENT,
          hasApiKey: !!env.RESEND_API_KEY,
          availableEnvKeys: Object.keys(env).filter(key => key.includes('RESEND') || key.includes('API')),
          allEnvKeys: Object.keys(env)
        }
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const apiKey = env.RESEND_API_KEY;

    // APIキーの確認
    console.log("Environment variables:", {
      ENVIRONMENT: env.ENVIRONMENT,
      hasRESEND_API_KEY: !!env.RESEND_API_KEY,
      RESEND_API_KEY_length: env.RESEND_API_KEY ? env.RESEND_API_KEY.length : 0
    });

    console.log("Sending email via Resend API to:", email);
    console.log("Using API key:", apiKey.substring(0, 10) + "...");
    
    // 本番では Resend API でメール送信
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "noreply@syugo-sin.com",
        to: email,
        subject: "【守護神】会員登録確認",
        html: `<p>以下のリンクをクリックして登録を完了してください。</p>
               <p><a href="${magicLink}">${magicLink}</a></p>`
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Resend API error:", text);
      console.error("Response status:", response.status);
      return new Response(JSON.stringify({ 
        error: "send_error", 
        message: text,
        status: response.status 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const resendData = await response.json();
    console.log("Email sent successfully:", resendData);

    return new Response(JSON.stringify({ 
      ok: true,
      message: "メールが正常に送信されました",
      emailId: resendData.id 
    }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("send-magic-link error:", err);
    console.error("Error stack:", err.stack);
    return new Response(JSON.stringify({ 
      error: "internal_error", 
      message: err.message,
      stack: err.stack 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}