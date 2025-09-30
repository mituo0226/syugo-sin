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

    const { email, nickname } = payload || {};
    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // マジックリンク生成
    const token = crypto.randomUUID();
    const origin = new URL(request.url).origin;
    const magicLink = `${origin}/api/verify-magic-link?token=${token}`;

    // メール本文のHTML
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>【守護神占い】ログインリンク</h2>
        <p>${nickname} 様</p>
        <p>以下のリンクをクリックしてログインを完了してください：</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${magicLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            ログインリンクをクリック
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          このリンクは一度だけ有効です。<br>
          もしボタンがクリックできない場合は、以下のURLをコピーしてブラウザに貼り付けてください：<br>
          <a href="${magicLink}">${magicLink}</a>
        </p>
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
        subject: "ログイン用マジックリンク",
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