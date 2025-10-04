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
      // テストモード：ローカルストレージからデータを取得してデータベースに保存
      const html = `<!doctype html>
<html lang="ja">
<head>
    <meta charset="utf-8">
    <title>マジックリンクテスト - 完了</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center">
    <div class="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div class="text-center">
            <i class="fas fa-check-circle text-green-500 text-6xl mb-4"></i>
            <h1 class="text-2xl font-bold text-gray-800 mb-2">マジックリンクテスト完了</h1>
            <p class="text-gray-600 mb-6">テスト用のマジックリンクが正常に動作しました！</p>
            
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <h3 class="font-semibold text-green-900 mb-2">
                    <i class="fas fa-check-circle mr-2"></i>テスト成功
                </h3>
                <p class="text-sm text-green-800">マジックリンクの生成と動作確認が完了しました。</p>
            </div>
            
            <div class="space-y-2">
                <button onclick="registerFromLocalStorage()" class="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
                    <i class="fas fa-database mr-2"></i>データベースに登録
                </button>
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
        async function registerFromLocalStorage() {
            try {
                // ローカルストレージからデータを取得
                const userData = localStorage.getItem('userData');
                if (!userData) {
                    alert('ローカルストレージにデータがありません');
                    return;
                }
                
                const data = JSON.parse(userData);
                
                // データ構造を確認してログ出力
                console.log('Local storage data:', data);
                
                // 登録APIを呼び出し
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: data.email,
                        nickname: data.nickname,
                        birthdate: data.birthdate,
                        guardian: data.guardian,
                        topic: data.topic
                    })
                });
                
                if (response.ok) {
                    alert('データベースに登録完了しました！');
                    window.location.href = '/welcome';
                } else {
                    const error = await response.text();
                    alert('登録エラー: ' + error);
                }
            } catch (error) {
                console.error('Registration error:', error);
                alert('登録エラーが発生しました');
            }
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