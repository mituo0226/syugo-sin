export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("invalid_token", { status: 400 });
  }

  try {
    // テスト用のトークンの場合はローカルストレージデータを使用
    const isTestToken = token.startsWith('test-') || token.length > 36; // UUIDの長さより長い場合はテストトークンと判断
    
    if (isTestToken) {
      // テストモード：ローカルストレージデータを使用してHTMLページを返す
      const html = `<!doctype html>
<html lang="ja">
<head>
    <meta charset="utf-8">
    <title>マジックリンクテスト - 登録完了</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center">
    <div class="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div class="text-center">
            <i class="fas fa-check-circle text-green-500 text-6xl mb-4"></i>
            <h1 class="text-2xl font-bold text-gray-800 mb-2">マジックリンクテスト完了</h1>
            <p class="text-gray-600 mb-6">テスト用のマジックリンクが正常に動作しました！</p>
            
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 class="font-semibold text-blue-900 mb-2">テストデータ確認</h3>
                <div id="testData" class="text-sm text-blue-800">
                    <p>ローカルストレージからデータを読み込み中...</p>
                </div>
            </div>
            
            <div class="space-y-2">
                <button onclick="window.close()" class="w-full bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600">
                    <i class="fas fa-times mr-2"></i>このタブを閉じる
                </button>
                <a href="/admin/magic-link-test.html" class="block w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-center">
                    <i class="fas fa-redo mr-2"></i>テストページに戻る
                </a>
            </div>
        </div>
    </div>
    
    <script>
        // ローカルストレージからテストデータを取得して表示
        const testData = localStorage.getItem('magicLinkTestData');
        if (testData) {
            const data = JSON.parse(testData);
            document.getElementById('testData').innerHTML = \`
                <p><strong>メール:</strong> \${data.email}</p>
                <p><strong>ニックネーム:</strong> \${data.nickname}</p>
                <p><strong>生年月日:</strong> \${data.birthdate}</p>
                <p><strong>守護神:</strong> \${data.guardian}</p>
                <p><strong>相談内容:</strong> \${data.topic}</p>
            \`;
        } else {
            document.getElementById('testData').innerHTML = '<p class="text-red-600">テストデータが見つかりません</p>';
        }
    </script>
</body>
</html>`;

      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8"
        }
      });
    }

    // 本番モード：データベースからデータを取得
    const row = await env.DB.prepare(
      `SELECT * FROM magic_links WHERE token = ? AND used = FALSE`
    ).bind(token).first();

    if (!row) {
      return new Response("invalid_or_used_token", { status: 400 });
    }

    if (new Date(row.expires_at) < new Date()) {
      return new Response("token_expired", { status: 400 });
    }

    // usersテーブルに登録 or 更新
    const existing = await env.DB.prepare(
      `SELECT id FROM users WHERE email = ?`
    ).bind(row.email).first();

    let userId;
    if (existing) {
      userId = existing.id;
      await env.DB.prepare(
        `UPDATE users SET birthdate=?, guardian=?, nickname=?, topic=? WHERE id=?`
      ).bind(row.birthdate, row.guardian, row.nickname, row.topic, userId).run();
    } else {
      userId = "usr_" + crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO users (id, email, birthdate, guardian, nickname, topic)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(userId, row.email, row.birthdate, row.guardian, row.nickname, row.topic).run();
    }

    // magic_links を使用済みに
    await env.DB.prepare(
      `UPDATE magic_links SET used = TRUE WHERE token = ?`
    ).bind(token).run();

    // Cookie発行（ローカルでは Secure を外す）
    const isLocal = env.ENVIRONMENT === "development";
    const cookie = [
      `session_user=${userId}`,
      "Path=/",
      "SameSite=Lax",
      "HttpOnly",
      `Max-Age=${60 * 60 * 24 * 30}`,
      ...(isLocal ? [] : ["Secure"])
    ].join("; ");

    const html = `<!doctype html>
<meta charset="utf-8">
<title>登録完了</title>
<p>登録処理が完了しました。画面を切り替えています…</p>
<script>setTimeout(()=>location.replace("/welcome"), 400);</script>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Set-Cookie": cookie,
        "Content-Type": "text/html; charset=utf-8"
      }
    });

  } catch (err) {
    console.error("verify-magic-link error:", err);
    return new Response("internal_error", { status: 500 });
  }
}