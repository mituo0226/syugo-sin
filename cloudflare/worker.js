// filename: cloudflare/worker.js (Cloudflare Worker)
// Routes: /api/consult で鑑定本文を返す
// ENV:
// - OPENAI_API_KEY: OpenAI APIキー
// - ALLOW_ORIGIN: CORS許可オリジン（未指定なら "*"）

import { runConsult } from "../src/consult/consult.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ---- CORS preflight ----
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // ---- health check ----
    if (url.pathname === "/health") {
      return json({ ok: true, ts: Date.now() }, env, request);
    }

    // ---- /api/consult endpoint ----
    if (url.pathname === "/api/consult" && request.method === "POST") {
      try {
        const payload = await safeJson(request);
        const { text, year, month, day, guardian, category } = payload;

        // 必須パラメータの検証
        if (!text) {
          return json({ 
            ok: false, 
            error: "相談内容が指定されていません" 
          }, env, request, 400);
        }

        // runConsult()を呼び出し
        const result = await runConsult({
          text,
          year,
          month,
          day,
          guardian,
          category
        }, env.OPENAI_API_KEY);

        // 結果を段落配列に分割
        const paragraphs = result
          .split(/\n{2,}/)
          .map(p => p.trim())
          .filter(p => p);

        return json({ ok: true, paragraphs }, env, request);
      } catch (err) {
        console.error('API Error:', err);
        return json({ ok: false, error: String(err?.message || err) }, env, request, 500);
      }
    }

    // ---- 管理用APIエンドポイント ----
    // 管理用セッション作成
    if (url.pathname === "/admin/session" && request.method === "POST") {
      const payload = await safeJson(request);
      const { password } = payload;
      
      // 簡単なパスワード認証
      if (password === "admin123") {
        const sessionId = Date.now().toString();
        return json({ 
          ok: true, 
          sessionId,
          message: "管理セッションを作成しました" 
        }, env, request);
      } else {
        return json({ 
          ok: false, 
          error: "認証に失敗しました" 
        }, env, request, 401);
      }
    }

    // 残り時間の一括管理
    if (url.pathname === "/admin/time" && request.method === "POST") {
      const payload = await safeJson(request);
      const { sessionId, action, minutes } = payload;
      
      // セッション認証（簡易版）
      if (!sessionId) {
        return json({ 
          ok: false, 
          error: "無効なセッションです" 
        }, env, request, 401);
      }
      
      try {
        switch (action) {
          case "set":
            if (minutes < 0 || minutes > 999) {
              return json({ 
                ok: false, 
                error: "分数は0-999の範囲で指定してください" 
              }, env, request, 400);
            }
            return json({ 
              ok: true, 
              message: `残り時間を${minutes}分に設定しました`,
              minutes 
            }, env, request);
            
          case "add":
            if (minutes < 0 || minutes > 999) {
              return json({ 
                ok: false, 
                error: "追加分数は0-999の範囲で指定してください" 
              }, env, request, 400);
            }
            return json({ 
              ok: true, 
              message: `${minutes}分を追加しました`,
              minutes 
            }, env, request);
            
          case "unlimited":
            return json({ 
              ok: true, 
              message: "無制限モードを切り替えました",
              unlimited: true 
            }, env, request);
            
          default:
            return json({ 
              ok: false, 
              error: "無効なアクションです" 
            }, env, request, 400);
        }
      } catch (error) {
        return json({ 
          ok: false, 
          error: "サーバーエラーが発生しました" 
        }, env, request, 500);
      }
    }

    // 管理用セッション状態確認
    if (url.pathname === "/admin/status" && request.method === "GET") {
      const sessionId = url.searchParams.get("sessionId");
      
      if (!sessionId) {
        return json({ 
          ok: false, 
          error: "無効なセッションです" 
        }, env, request, 401);
      }
      
      return json({ 
        ok: true, 
        session: {
          createdAt: Date.now(),
          lastAccess: Date.now()
        }
      }, env, request);
    }

    // ---- 静的ファイル配信 ----
    // 管理画面の配信
    if (url.pathname === "/admin.html") {
      // キャッシュ無効化のためのヘッダーを追加
      const headers = {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        ...corsHeaders(),
      };
      const adminHtml = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>管理画面 - 守護神占い v20250112</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
      background: linear-gradient(135deg, #0d0d1a, #1a1a2e);
      color: #fff;
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding: 20px;
      background: rgba(102, 204, 255, 0.1);
      border-radius: 15px;
      border: 1px solid rgba(102, 204, 255, 0.3);
    }
    
    .header h1 {
      color: #66ccff;
      font-size: 2.5em;
      margin-bottom: 10px;
      text-shadow: 0 0 10px rgba(102, 204, 255, 0.5);
    }
    
    .header p {
      color: #ccc;
      font-size: 1.1em;
    }
    
    .login-section {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 15px;
      padding: 30px;
      margin-bottom: 30px;
      border: 1px solid rgba(102, 204, 255, 0.2);
    }
    
    .login-section h2 {
      color: #66ccff;
      margin-bottom: 20px;
      text-align: center;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 8px;
      color: #ccc;
      font-weight: bold;
    }
    
    .form-group input {
      width: 100%;
      padding: 12px 15px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(102, 204, 255, 0.3);
      border-radius: 8px;
      color: #fff;
      font-size: 1em;
    }
    
    .form-group input:focus {
      outline: none;
      border-color: #66ccff;
      box-shadow: 0 0 10px rgba(102, 204, 255, 0.3);
    }
    
    .btn {
      background: linear-gradient(90deg, #66ccff, #3399ff);
      border: none;
      border-radius: 8px;
      padding: 12px 25px;
      color: #000;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 1em;
    }
    
    .btn:hover {
      background: linear-gradient(90deg, #99e0ff, #66ccff);
      transform: translateY(-2px);
    }
    
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    
    .admin-panel {
      display: none;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 15px;
      padding: 30px;
      border: 1px solid rgba(102, 204, 255, 0.2);
    }
    
    .admin-panel.show {
      display: block;
    }
    
    .admin-panel h2 {
      color: #66ccff;
      margin-bottom: 25px;
      text-align: center;
    }
    
    .control-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .control-card {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      padding: 20px;
      border: 1px solid rgba(102, 204, 255, 0.2);
    }
    
    .control-card h3 {
      color: #66ccff;
      margin-bottom: 15px;
      font-size: 1.2em;
    }
    
    .input-group {
      display: flex;
      gap: 10px;
      margin-bottom: 15px;
    }
    
    .input-group input {
      flex: 1;
      padding: 10px 12px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(102, 204, 255, 0.3);
      border-radius: 6px;
      color: #fff;
    }
    
    .input-group input:focus {
      outline: none;
      border-color: #66ccff;
    }
    
    .btn-small {
      padding: 10px 15px;
      font-size: 0.9em;
    }
    
    .quick-actions {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }
    
    .quick-btn {
      background: linear-gradient(90deg, #9d4edd, #7b2cbf);
      border: none;
      border-radius: 8px;
      padding: 15px;
      color: #fff;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      text-align: center;
    }
    
    .quick-btn:hover {
      background: linear-gradient(90deg, #b366e6, #9d4edd);
      transform: translateY(-2px);
    }
    
    .message {
      padding: 15px;
      border-radius: 8px;
      margin: 15px 0;
      font-weight: bold;
    }
    
    .message.success {
      background: rgba(76, 175, 80, 0.2);
      border: 1px solid rgba(76, 175, 80, 0.5);
      color: #4caf50;
    }
    
    .message.error {
      background: rgba(244, 67, 54, 0.2);
      border: 1px solid rgba(244, 67, 54, 0.5);
      color: #f44336;
    }
    
    @media (max-width: 768px) {
      .container {
        padding: 10px;
      }
      
      .header h1 {
        font-size: 2em;
      }
      
      .control-grid {
        grid-template-columns: 1fr;
      }
      
      .input-group {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔮 管理画面</h1>
      <p>守護神占い - 残り時間管理システム</p>
    </div>
    
    <!-- ログインセクション -->
    <div class="login-section" id="loginSection">
      <h2>管理者認証</h2>
      <div class="form-group">
        <label for="adminPassword">パスワード</label>
        <input type="password" id="adminPassword" placeholder="管理者パスワードを入力">
      </div>
      <button class="btn" onclick="login()">ログイン</button>
      <div id="loginMessage"></div>
    </div>
    
    <!-- 管理パネル -->
    <div class="admin-panel" id="adminPanel">
      <h2>残り時間管理</h2>
      
      <div class="control-grid">
        <!-- 時間追加 -->
        <div class="control-card">
          <h3>➕ 時間追加</h3>
          <div class="input-group">
            <input type="number" id="addMinutes" placeholder="追加分数 (0-999)" min="0" max="999">
            <button class="btn btn-small" onclick="addTime()">追加</button>
          </div>
          <p style="color: #ccc; font-size: 0.9em;">現在の残り時間に指定分数を追加します</p>
        </div>
        
        <!-- 無制限モード -->
        <div class="control-card">
          <h3>♾️ 無制限モード</h3>
          <button class="btn btn-small" onclick="toggleUnlimited()">無制限切り替え</button>
          <p style="color: #ccc; font-size: 0.9em;">時間制限を無効化/有効化します</p>
        </div>
      </div>
      
      <!-- クイックアクション -->
      <div class="quick-actions">
        <button class="quick-btn" onclick="quickAddTime(5)">5分追加</button>
        <button class="quick-btn" onclick="quickAddTime(10)">10分追加</button>
        <button class="quick-btn" onclick="quickAddTime(30)">30分追加</button>
        <button class="quick-btn" onclick="quickAddTime(60)">60分追加</button>
      </div>
      
      <!-- チャット画面へのリンク -->
      <div style="text-align: center; margin-top: 30px; padding: 20px; background: rgba(102, 204, 255, 0.1); border-radius: 10px; border: 1px solid rgba(102, 204, 255, 0.3);">
        <h3 style="color: #66ccff; margin-bottom: 15px;">💬 チャット画面</h3>
        <p style="color: #ccc; margin-bottom: 15px;">AI鑑定師 龍との対話画面に移動します</p>
        <a href="https://syugo-sin.com/consult/chat.html" target="_blank" style="display: inline-block; background: linear-gradient(90deg, #66ccff, #3399ff); color: #000; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-weight: bold; transition: all 0.3s ease;">チャット画面を開く</a>
      </div>
      
      <div id="messageContainer"></div>
    </div>
  </div>

  <script>
    let adminSessionId = null;
    
    // API接続先を環境によって自動切り替え
    function getApiEndpoint() {
      const hostname = window.location.hostname;
      console.log('Current hostname:', hostname);
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://127.0.0.1:8787';
      } else if (hostname.includes('syugo-sin.com')) {
        return 'https://syugo-sin-worker.mituo0226.workers.dev';
      } else {
        return 'https://syugo-sin-worker.mituo0226.workers.dev';
      }
    }
    
    // ログイン処理
    async function login() {
      const password = document.getElementById('adminPassword').value;
      
      if (!password) {
        showMessage('パスワードを入力してください', 'error');
        return;
      }
      
      const apiUrl = \`\${getApiEndpoint()}/admin/session\`;
      console.log('=== DEBUG INFO ===');
      console.log('Current hostname:', window.location.hostname);
      console.log('API endpoint:', getApiEndpoint());
      console.log('Full API URL:', apiUrl);
      console.log('Password:', password);
      console.log('==================');
      
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password })
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.ok) {
          adminSessionId = data.sessionId;
          document.getElementById('loginSection').style.display = 'none';
          document.getElementById('adminPanel').classList.add('show');
          showMessage('ログインに成功しました', 'success');
        } else {
          showMessage(data.error || 'ログインに失敗しました', 'error');
        }
      } catch (error) {
        showMessage('サーバーに接続できません', 'error');
        console.error('Login error:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          apiUrl: apiUrl
        });
      }
    }
    
    // 時間追加
    async function addTime() {
      const minutes = document.getElementById('addMinutes').value;
      
      if (!minutes || minutes < 0 || minutes > 999) {
        showMessage('有効な分数を入力してください (0-999)', 'error');
        return;
      }
      
      await adminAction('add', parseInt(minutes));
    }
    
    // 無制限モード切り替え
    async function toggleUnlimited() {
      await adminAction('unlimited');
    }
    
    // クイック時間追加
    async function quickAddTime(minutes) {
      await adminAction('add', minutes);
    }
    
    // 管理アクション実行
    async function adminAction(action, minutes = null) {
      if (!adminSessionId) {
        showMessage('ログインしてください', 'error');
        return;
      }
      
      const requestData = {
        sessionId: adminSessionId,
        action: action
      };
      
      if (minutes !== null) {
        requestData.minutes = minutes;
      }
      
      try {
        const response = await fetch(\`\${getApiEndpoint()}/admin/time\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (data.ok) {
          showMessage(data.message, 'success');
          notifyChatWindow(action, minutes);
        } else {
          showMessage(data.error || '操作に失敗しました', 'error');
        }
      } catch (error) {
        showMessage('サーバーに接続できません', 'error');
        console.error('Admin action error:', error);
      }
    }
    
    // チャット画面に通知を送信
    function notifyChatWindow(action, minutes) {
      const message = {
        type: 'ADMIN_TIME_UPDATE',
        action: action,
        minutes: minutes,
        timestamp: Date.now()
      };
      
      console.log('チャット画面に通知を送信:', message);
      
      // 同じオリジンのウィンドウにメッセージを送信
      if (window.opener && !window.opener.closed) {
        console.log('openerウィンドウに通知を送信');
        window.opener.postMessage(message, '*');
      }
      
      // 他のタブにも通知（BroadcastChannelを使用）
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('admin-updates');
        channel.postMessage(message);
        console.log('BroadcastChannelで通知を送信');
      }
      
      // フォールバック: localStorageを使用
      localStorage.setItem('adminTimeUpdate', JSON.stringify(message));
      console.log('localStorageに通知を保存');
    }
    
    // メッセージ表示
    function showMessage(message, type) {
      const container = document.getElementById('messageContainer');
      const messageDiv = document.createElement('div');
      messageDiv.className = \`message \${type}\`;
      messageDiv.textContent = message;
      
      container.innerHTML = '';
      container.appendChild(messageDiv);
      
      // 3秒後に自動削除
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.parentNode.removeChild(messageDiv);
        }
      }, 3000);
    }
    
    // Enterキーでログイン
    document.getElementById('adminPassword').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        login();
      }
    });
  </script>
</body>
</html>`;
      
      return new Response(adminHtml, {
        headers: headers,
      });
    }

    // ---- not found ----
    return json({ ok: false, error: "Not found" }, env, request, 404);
  },
};


/* ========= 便利関数 ========= */
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(obj, env, request, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

async function safeJson(request) {
  if (request.method !== "POST") return {};
  const txt = await request.text();
  try { return JSON.parse(txt || "{}"); } catch { return {}; }
}
