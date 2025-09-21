import { runConsult } from "../public/consult/consult.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS ヘッダー（動的にOriginを設定）
    const origin = request.headers.get("Origin");
    const allowedOrigins = [
      "https://syugo-sin.com",
      "https://syugo-sin-worker.mituo0226.workers.dev",
      "http://localhost:3000",
      "http://localhost:8080"
    ];
    
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : "https://syugo-sin.com",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    };

    // OPTIONS リクエストの処理（プリフライトリクエスト）
    if (request.method === "OPTIONS") {
      return new Response(null, { 
        status: 200,
        headers: {
          ...corsHeaders,
          "Access-Control-Max-Age": "86400", // 24時間キャッシュ
        }
      });
    }

    // 静的ファイルの配信（決済ページのみ）
    if (url.pathname === "/payment.html") {
      const paymentHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>決済 | AI鑑定師 龍</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      background: #0d0d1a;
      font-family: "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
      color: #fff;
      padding: 20px;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: rgba(13, 13, 26, 0.9);
      border-radius: 20px;
      padding: 40px;
      border: 2px solid rgba(102, 204, 255, 0.4);
    }
    
    .title {
      font-size: 2em;
      color: #66ccff;
      text-align: center;
      margin-bottom: 30px;
    }
    
    .product-info {
      background: rgba(102, 204, 255, 0.1);
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 30px;
    }
    
    .product-name {
      font-size: 1.5em;
      color: #ffd700;
      margin-bottom: 10px;
    }
    
    .product-price {
      font-size: 1.2em;
      color: #66ccff;
    }
    
    .payment-form {
      margin-bottom: 30px;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    label {
      display: block;
      margin-bottom: 5px;
      color: #ccc;
    }
    
    input, select {
      width: 100%;
      padding: 12px;
      border: 1px solid #444;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      font-size: 16px;
      box-sizing: border-box;
    }
    
    input:focus, select:focus {
      outline: none;
      border-color: #66ccff;
      box-shadow: 0 0 10px rgba(102, 204, 255, 0.3);
    }
    
    .pay-button {
      width: 100%;
      padding: 20px;
      font-size: 1.3em;
      background: linear-gradient(90deg, #66ccff, #3399ff);
      border: none;
      border-radius: 15px;
      font-weight: bold;
      cursor: pointer;
      color: #000;
      box-shadow: 0 6px 20px rgba(102,204,255,0.4);
      transition: all 0.3s ease;
    }
    
    .pay-button:hover {
      background: linear-gradient(90deg, #99e0ff, #66ccff);
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(102,204,255,0.5);
    }
    
    .pay-button:disabled {
      background: #666;
      cursor: not-allowed;
      transform: none;
    }
    
    .error {
      color: #ff6b6b;
      margin-top: 10px;
      padding: 10px;
      background: rgba(255, 107, 107, 0.1);
      border-radius: 8px;
      border: 1px solid rgba(255, 107, 107, 0.3);
    }
    
    .success {
      color: #66ff66;
      margin-top: 10px;
      padding: 10px;
      background: rgba(102, 255, 102, 0.1);
      border-radius: 8px;
      border: 1px solid rgba(102, 255, 102, 0.3);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="title">決済</h1>
    
    <div class="product-info">
      <div class="product-name">AI鑑定師 龍 - 鑑定チケット</div>
      <div class="product-price">¥10</div>
    </div>
    
    <form id="payment-form" class="payment-form">
      <div class="form-group">
        <label for="card-number">カード番号</label>
        <input type="text" id="card-number" placeholder="4111 1111 1111 1111" maxlength="19">
      </div>
      
      <div class="form-group">
        <label for="expiry-date">有効期限</label>
        <input type="text" id="expiry-date" placeholder="MM/YY" maxlength="5">
      </div>
      
      <div class="form-group">
        <label for="cvv">CVC</label>
        <input type="text" id="cvv" placeholder="111" maxlength="4">
      </div>
      
      <div class="form-group">
        <label for="postal-code">郵便番号</label>
        <input type="text" id="postal-code" placeholder="12345" maxlength="10">
      </div>
      
      <button type="submit" class="pay-button" id="pay-button">
        決済する (¥10)
      </button>
    </form>
    
    <div id="error-message" class="error" style="display: none;"></div>
    <div id="success-message" class="success" style="display: none;"></div>
  </div>

  <script>
    // ページ読み込み時の処理
    window.addEventListener('load', function() {
      console.log('決済ページ読み込み完了');
      
      // URLパラメータからUIDを取得
      const urlParams = new URLSearchParams(window.location.search);
      const uid = urlParams.get('uid');
      
      if (!uid) {
        showError('ユーザーIDが取得できませんでした。');
        return;
      }
      
      console.log('UID:', uid);
      
      // フォームのイベントリスナーを設定
      setupFormEventListeners();
    });
    
    // フォームのイベントリスナーを設定
    function setupFormEventListeners() {
      const form = document.getElementById('payment-form');
      const cardNumber = document.getElementById('card-number');
      const expiryDate = document.getElementById('expiry-date');
      const cvv = document.getElementById('cvv');
      const postalCode = document.getElementById('postal-code');
      
      // カード番号のフォーマット
      cardNumber.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\\D/g, '');
        value = value.replace(/(\\d{4})(?=\\d)/g, '$1 ');
        e.target.value = value;
      });
      
      // 有効期限のフォーマット
      expiryDate.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\\D/g, '');
        if (value.length >= 2) {
          value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
        e.target.value = value;
      });
      
      // フォーム送信
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        processPayment();
      });
    }
    
    // 決済処理
    async function processPayment() {
      const payButton = document.getElementById('pay-button');
      const cardNumber = document.getElementById('card-number').value.replace(/\\s/g, '');
      const expiryDate = document.getElementById('expiry-date').value;
      const cvv = document.getElementById('cvv').value;
      const postalCode = document.getElementById('postal-code').value;
      
      // バリデーション
      if (!cardNumber || !expiryDate || !cvv || !postalCode) {
        showError('すべての項目を入力してください。');
        return;
      }
      
      if (cardNumber.length < 16) {
        showError('カード番号を正しく入力してください。');
        return;
      }
      
      if (expiryDate.length < 5) {
        showError('有効期限を正しく入力してください。');
        return;
      }
      
      if (cvv.length < 3) {
        showError('CVCを正しく入力してください。');
        return;
      }
      
      // ボタンを無効化
      payButton.disabled = true;
      payButton.textContent = '処理中...';
      
      try {
        // URLパラメータからUIDを取得
        const urlParams = new URLSearchParams(window.location.search);
        const uid = urlParams.get('uid');
        
        // 決済処理をシミュレート
        await simulatePayment(uid, cardNumber, expiryDate, cvv, postalCode);
        
      } catch (error) {
        console.error('決済エラー:', error);
        showError('決済処理中にエラーが発生しました。');
      } finally {
        // ボタンを有効化
        payButton.disabled = false;
        payButton.textContent = '決済する (¥10)';
      }
    }
    
    // 決済処理をシミュレート
    async function simulatePayment(uid, cardNumber, expiryDate, cvv, postalCode) {
      // テストカード番号のチェック
      if (cardNumber === '4111111111111111') {
        // 成功をシミュレート
        showSuccess('決済が完了しました！');
        
        // 3秒後にconfirm.htmlにリダイレクト
        setTimeout(() => {
          window.location.href = \`./confirm.html?uid=\${uid}&checkoutId=test-checkout-\${Date.now()}\`;
        }, 3000);
      } else {
        showError('テストカード番号を使用してください: 4111 1111 1111 1111');
      }
    }
    
    // エラーメッセージを表示
    function showError(message) {
      const errorDiv = document.getElementById('error-message');
      const successDiv = document.getElementById('success-message');
      
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      successDiv.style.display = 'none';
    }
    
    // 成功メッセージを表示
    function showSuccess(message) {
      const errorDiv = document.getElementById('error-message');
      const successDiv = document.getElementById('success-message');
      
      successDiv.textContent = message;
      successDiv.style.display = 'block';
      errorDiv.style.display = 'none';
    }
  </script>
</body>
</html>`;
      
      return new Response(paymentHtml, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          ...corsHeaders
        }
      });
    }

    // API エンドポイント
    if (url.pathname === "/api/consult") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      try {
        const requestText = await request.text();
        console.log('Raw request body length:', requestText.length);
        console.log('Raw request body:', requestText);
        
        let payload;
        try {
          payload = JSON.parse(requestText);
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          console.error('Problematic JSON:', requestText);
          throw new Error(`JSON parse error: ${parseError.message}`);
        }
        
        console.log('Consult API payload:', payload);
        
        const result = await runConsult(payload, env.OPENAI_API_KEY);
        
        // 結果を段落ごとに分割
        const paragraphs = result
          .split(/\n{2,}/)
          .map(p => p.trim())
          .filter(p => p);

        return new Response(
          JSON.stringify({ ok: true, paragraphs }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } catch (error) {
        console.error("API Error:", error);
        return new Response(
          JSON.stringify({ ok: false, error: "Internal Server Error", details: error.message }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }


    // 決済API エンドポイント
    if (url.pathname === "/api/create-payment-link") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      try {
        let requestBody;
        try {
          requestBody = await request.json();
        } catch (jsonError) {
          console.error("JSON parse error:", jsonError);
          return new Response(JSON.stringify({ 
            error: "Invalid JSON format",
            details: jsonError.message 
          }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        
        const { uid } = requestBody;
        
        if (!uid) {
          return new Response(JSON.stringify({ error: "UID is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // Square API Checkoutを直接HTTPリクエストで呼び出し
        const checkoutData = {
          idempotency_key: `${uid}-${Date.now()}`,
          order: {
            location_id: env.SQUARE_LOCATION_ID,
            line_items: [
              {
                name: "AI鑑定師 龍 - 鑑定チケット",
                quantity: "1",
                base_price_money: {
                  amount: 10, // 10円（テスト用）
                  currency: "JPY"
                }
              }
            ]
          },
          ask_for_shipping_address: false,
          merchant_support_email: "support@example.com",
          pre_populate_buyer_email: "test@example.com",
          redirect_url: `${url.origin}/confirm.html?uid=${uid}`,
          note: `Test payment for UID: ${uid}`
        };

        console.log('Square API request data:', JSON.stringify(checkoutData, null, 2));
        
        const squareResponse = await fetch(`https://connect.squareupsandbox.com/v2/locations/${env.SQUARE_LOCATION_ID}/checkouts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Square-Version': '2024-04-17'
          },
          body: JSON.stringify(checkoutData)
        });

        if (!squareResponse.ok) {
          const errorText = await squareResponse.text();
          throw new Error(`Square API error: ${squareResponse.status} - ${errorText}`);
        }

        const squareData = await squareResponse.json();
        
        if (squareData.checkout && squareData.checkout.checkout_page_url) {
          return new Response(JSON.stringify({ 
            checkoutUrl: squareData.checkout.checkout_page_url 
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        } else {
          throw new Error("Failed to create checkout - invalid response");
        }

      } catch (error) {
        console.error("Payment link creation error:", error);
        return new Response(JSON.stringify({ 
          error: "Failed to create payment link",
          details: error.message 
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // 決済検証API エンドポイント
    if (url.pathname === "/api/verify") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      try {
        let requestBody;
        try {
          requestBody = await request.json();
        } catch (jsonError) {
          console.error("JSON parse error:", jsonError);
          return new Response(JSON.stringify({ 
            error: "Invalid JSON format",
            details: jsonError.message 
          }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        
        const { uid, checkoutId } = requestBody;
        
        if (!uid || !checkoutId) {
          return new Response(JSON.stringify({ error: "UID and checkoutId are required" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // テスト用のダミーcheckoutIdの場合は成功として扱う
        if (checkoutId.startsWith('test-checkout-')) {
          console.log('テスト用決済検証:', { uid, checkoutId });
          const expireAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
          
          return new Response(JSON.stringify({ 
            ok: true, 
            expireAt: expireAt,
            orderId: checkoutId,
            isTest: true
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // Square API Ordersを直接HTTPリクエストで呼び出し
        const squareResponse = await fetch(`https://connect.squareupsandbox.com/v2/orders/${checkoutId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Square-Version': '2024-04-17'
          }
        });

        if (!squareResponse.ok) {
          const errorText = await squareResponse.text();
          throw new Error(`Square API error: ${squareResponse.status} - ${errorText}`);
        }

        const squareData = await squareResponse.json();
        
        if (squareData.order) {
          const order = squareData.order;
          
          // 決済が完了しているかチェック
          if (order.state === "COMPLETED") {
            // 有効期限を設定（10円＝3分）
            const expireAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
            
            return new Response(JSON.stringify({ 
              ok: true, 
              expireAt: expireAt,
              orderId: order.id
            }), {
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          } else {
            return new Response(JSON.stringify({ 
              ok: false, 
              error: "Payment not completed" 
            }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }
        } else {
          throw new Error("Failed to retrieve order - invalid response");
        }

      } catch (error) {
        console.error("Payment verification error:", error);
        return new Response(JSON.stringify({ 
          error: "Failed to verify payment",
          details: error.message 
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ユーザーデータ確認API エンドポイント
    if (url.pathname.startsWith("/api/verify-user/")) {
      const userId = url.pathname.split("/api/verify-user/")[1];
      
      if (!userId) {
        return new Response(JSON.stringify({ error: "User ID is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      try {
        // D1データベースからユーザーデータを取得
        const userData = await env.DB.prepare(`
          SELECT * FROM users WHERE id = ?
        `).bind(userId).first();

        if (!userData) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          id: userData.id,
          email: userData.email,
          nickname: userData.nickname,
          birthdate: userData.birthdate,
          guardian_id: userData.guardian_id,
          theme: userData.theme,
          created_at: userData.created_at
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });

      } catch (error) {
        console.error("User verification error:", error);
        return new Response(JSON.stringify({ 
          error: "Failed to verify user",
          details: error.message 
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // テストデータ削除API エンドポイント
    if (url.pathname === "/api/delete-user") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      try {
        const { userId } = await request.json();
        
        if (!userId) {
          return new Response(JSON.stringify({ error: "User ID is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // ユーザーを削除
        const result = await env.DB.prepare(`
          DELETE FROM users WHERE id = ?
        `).bind(userId).run();

        if (result.changes === 0) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        return new Response(JSON.stringify({ 
          success: true,
          message: "ユーザーデータを削除しました",
          deleted_id: userId
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });

      } catch (error) {
        console.error("User deletion error:", error);
        return new Response(JSON.stringify({ 
          error: "Failed to delete user",
          details: error.message 
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ユーザー検索API エンドポイント
    if (url.pathname === "/api/search-user") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      try {
        const { email, nickname, birthdate, searchType } = await request.json();
        
        if (!email && !nickname && !birthdate) {
          return new Response(JSON.stringify({ error: "検索条件を少なくとも1つ入力してください" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        let users;
        let query;
        let bindParams = [];

        // 検索タイプに応じてクエリを構築
        if (searchType === "email" && email) {
          query = "SELECT * FROM users WHERE email = ?";
          bindParams = [email];
        } else if (searchType === "nickname" && nickname) {
          query = "SELECT * FROM users WHERE nickname LIKE ?";
          bindParams = [`%${nickname}%`];
        } else if (searchType === "birthdate" && birthdate) {
          query = "SELECT * FROM users WHERE birthdate = ?";
          bindParams = [birthdate];
        } else {
          // 複数条件検索
          let conditions = [];
          if (email) {
            conditions.push("email = ?");
            bindParams.push(email);
          }
          if (nickname) {
            conditions.push("nickname LIKE ?");
            bindParams.push(`%${nickname}%`);
          }
          if (birthdate) {
            conditions.push("birthdate = ?");
            bindParams.push(birthdate);
          }
          query = `SELECT * FROM users WHERE ${conditions.join(" AND ")}`;
        }

        users = await env.DB.prepare(query).bind(...bindParams).all();

        if (!users.results || users.results.length === 0) {
          return new Response(JSON.stringify({ error: "ユーザーが見つかりません" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // ユーザーデータを整形
        const formattedUsers = users.results.map(user => ({
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          birthdate: user.birthdate,
          guardian_id: user.guardian_id,
          theme: user.theme,
          created_at: user.created_at
        }));

        return new Response(JSON.stringify({
          success: true,
          users: formattedUsers,
          count: formattedUsers.length
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });

      } catch (error) {
        console.error("User search error:", error);
        return new Response(JSON.stringify({ 
          error: "ユーザー検索中にエラーが発生しました",
          details: error.message 
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // マジックリンク送信API エンドポイント
    if (url.pathname === "/api/send-magic-link") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      try {
        const { email, nickname, birthdate, guardian_id, theme } = await request.json();
        
        if (!email || !nickname) {
          return new Response(JSON.stringify({ error: "メールアドレスとニックネームは必須です" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 重複チェック
        const existingUser = await env.DB.prepare(`
          SELECT id FROM users WHERE email = ?
        `).bind(email).first();
        
        if (existingUser) {
          return new Response(JSON.stringify({
            error: "このメールアドレスは既に登録されています",
            existing_id: existingUser.id
          }), {
            status: 409,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // マジックリンク用のトークンを生成
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30分後
        
        // マジックリンクデータを一時保存（実際の実装では別テーブルまたはRedisを使用）
        const magicLinkData = {
          email,
          nickname,
          birthdate,
          guardian_id,
          theme,
          token,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString()
        };

        // マジックリンクURLを生成
        const magicLinkUrl = `https://syugo-sin-worker.mituo0226.workers.dev/api/verify-magic-link?token=${token}`;
        
        // 実際の実装では、ここでメール送信サービス（SendGrid、Mailgun等）を使用
        // 今回はテスト用にログ出力のみ
        console.log("Magic Link Data:", magicLinkData);
        console.log("Magic Link URL:", magicLinkUrl);

        return new Response(JSON.stringify({
          success: true,
          message: "マジックリンクを送信しました",
          magic_link_url: magicLinkUrl, // テスト用にURLを返す
          email: email,
          expires_at: expiresAt.toISOString()
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });

      } catch (error) {
        console.error("Magic link send error:", error);
        return new Response(JSON.stringify({ 
          error: "マジックリンク送信中にエラーが発生しました",
          details: error.message 
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // マジックリンク検証・会員登録API エンドポイント
    if (url.pathname === "/api/verify-magic-link") {
      if (request.method !== "GET") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      try {
        const urlObj = new URL(request.url);
        const token = urlObj.searchParams.get('token');
        
        if (!token) {
          return new Response(JSON.stringify({ error: "トークンが指定されていません" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 実際の実装では、ここでトークンからマジックリンクデータを取得
        // 今回はテスト用に固定データを使用（実際はデータベースまたはRedisから取得）
        // トークンの検証と有効期限チェックを行う
        
        // テスト用の固定データ（実際の実装では動的に取得）
        const magicLinkData = {
          email: "test@example.com",
          nickname: "テストユーザー",
          birthdate: "1990-01-01",
          guardian_id: "千手観音",
          theme: "テスト用の相談内容"
        };

        // トークンの有効期限チェック（実際の実装ではデータベースから取得）
        const isExpired = false; // テスト用
        
        if (isExpired) {
          return new Response(JSON.stringify({ error: "マジックリンクの有効期限が切れています" }), {
            status: 410,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 重複チェック
        const existingUser = await env.DB.prepare(`
          SELECT id FROM users WHERE email = ?
        `).bind(magicLinkData.email).first();
        
        if (existingUser) {
          return new Response(JSON.stringify({
            error: "このメールアドレスは既に登録されています",
            existing_id: existingUser.id
          }), {
            status: 409,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // ユーザーをデータベースに登録
        const insertResult = await env.DB.prepare(`
          INSERT INTO users (email, nickname, birthdate, guardian_id, theme, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          magicLinkData.email,
          magicLinkData.nickname,
          magicLinkData.birthdate,
          magicLinkData.guardian_id,
          magicLinkData.theme,
          new Date().toISOString()
        ).run();

        if (!insertResult.success) {
          throw new Error("ユーザー登録に失敗しました");
        }

        // 実際の実装では、ここでマジックリンクデータを削除または無効化
        console.log("Magic link verified and user registered:", {
          user_id: insertResult.meta.last_row_id,
          email: magicLinkData.email
        });

        return new Response(JSON.stringify({
          success: true,
          message: "会員登録が完了しました",
          user: {
            id: insertResult.meta.last_row_id,
            email: magicLinkData.email,
            nickname: magicLinkData.nickname,
            birthdate: magicLinkData.birthdate,
            guardian_id: magicLinkData.guardian_id,
            theme: magicLinkData.theme,
            created_at: new Date().toISOString()
          }
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });

      } catch (error) {
        console.error("Magic link verification error:", error);
        return new Response(JSON.stringify({ 
          error: "マジックリンク検証中にエラーが発生しました",
          details: error.message 
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // 退会API エンドポイント
    if (url.pathname === "/api/withdraw") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      try {
        const { email } = await request.json();
        
        if (!email) {
          return new Response(JSON.stringify({ error: "Email is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // メールアドレスでユーザーを検索
        const user = await env.DB.prepare(`
          SELECT * FROM users WHERE email = ?
        `).bind(email).first();

        if (!user) {
          return new Response(JSON.stringify({ error: "ユーザーが見つかりません" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // ユーザーを削除（退会処理）
        const result = await env.DB.prepare(`
          DELETE FROM users WHERE email = ?
        `).bind(email).run();

        if (result.changes === 0) {
          return new Response(JSON.stringify({ error: "退会処理に失敗しました" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        return new Response(JSON.stringify({ 
          success: true,
          message: "退会処理が完了しました",
          email: email,
          deleted_user: {
            id: user.id,
            nickname: user.nickname,
            email: user.email
          }
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });

      } catch (error) {
        console.error("Withdrawal error:", error);
        return new Response(JSON.stringify({ 
          error: "退会処理中にエラーが発生しました",
          details: error.message 
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // 全テストデータ削除API エンドポイント
    if (url.pathname === "/api/delete-all-test-data") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      try {
        // テスト用メールアドレスのデータを全削除
        const result = await env.DB.prepare(`
          DELETE FROM users WHERE email = 'mituo0226@gmail.com'
        `).run();

        return new Response(JSON.stringify({ 
          success: true,
          message: "テストデータを全削除しました",
          deleted_count: result.changes
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });

      } catch (error) {
        console.error("Test data deletion error:", error);
        return new Response(JSON.stringify({ 
          error: "Failed to delete test data",
          details: error.message 
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // 会員登録API エンドポイント
    if (url.pathname === "/api/register") {
      console.log("Register API endpoint hit:", { method: request.method, pathname: url.pathname });
      
      if (request.method !== "POST") {
        console.log("Method not allowed:", request.method);
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      try {
        let requestBody;
        try {
          requestBody = await request.json();
        } catch (jsonError) {
          console.error("JSON parse error:", jsonError);
          return new Response(JSON.stringify({ 
            error: "Invalid JSON format",
            details: jsonError.message 
          }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        
        const { email, nickname, birthdate, guardian_id, theme } = requestBody;
        
        if (!email || !nickname) {
          return new Response(JSON.stringify({ error: "Email and nickname are required" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // D1データベースのバインド確認
        if (!env.DB) {
          console.error("D1 database not bound");
          throw new Error("Database not available");
        }

        console.log("Attempting to insert user data:", { email, nickname, birthdate, guardian_id, theme });

        // 重複チェック：同じメールアドレスが既に存在するか確認
        const existingUser = await env.DB.prepare(`
          SELECT id FROM users WHERE email = ?
        `).bind(email).first();

        if (existingUser) {
          console.log("Duplicate email found:", email);
          return new Response(JSON.stringify({ 
            error: "このメールアドレスは既に登録されています",
            existing_id: existingUser.id 
          }), {
            status: 409, // Conflict
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // D1データベースに保存
        const result = await env.DB.prepare(`
          INSERT INTO users (email, nickname, birthdate, guardian_id, theme)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          email,
          nickname,
          birthdate || null,
          guardian_id || null,
          theme || null
        ).run();

        console.log('User registration result:', result);

        if (result.success) {
          // 保存されたデータを取得
          const savedUser = await env.DB.prepare(`
            SELECT * FROM users WHERE id = ?
          `).bind(result.meta.last_row_id).first();

          return new Response(JSON.stringify({ 
            success: true,
            id: result.meta.last_row_id,
            email: savedUser.email,
            nickname: savedUser.nickname,
            birthdate: savedUser.birthdate,
            guardian_id: savedUser.guardian_id,
            theme: savedUser.theme,
            created_at: savedUser.created_at
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        } else {
          throw new Error("Failed to insert user data");
        }

      } catch (error) {
        console.error("User registration error:", error);
        return new Response(JSON.stringify({ 
          error: "Failed to register user",
          details: error.message 
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // 管理API エンドポイント
    if (url.pathname === "/admin/session" && request.method === "POST") {
      try {
        const { password } = await request.json();
        
        if (password === "admin123") {
          const sessionId = "admin_" + Date.now();
          return new Response(
            JSON.stringify({ ok: true, sessionId }),
            { headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        } else {
          return new Response(
            JSON.stringify({ ok: false, error: "Invalid password" }),
            { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      } catch (error) {
        return new Response(
          JSON.stringify({ ok: false, error: "Invalid request" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    if (url.pathname === "/admin/time" && request.method === "POST") {
      try {
        const { sessionId, action, minutes } = await request.json();
        
        if (!sessionId || !sessionId.startsWith("admin_")) {
          return new Response(
            JSON.stringify({ ok: false, error: "Invalid session" }),
            { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        
        let message = "";
        switch (action) {
          case "add":
            message = `${minutes}分を追加しました`;
            break;
          case "unlimited":
            message = "無制限モードを切り替えました";
            break;
          default:
            return new Response(
              JSON.stringify({ ok: false, error: "Invalid action" }),
              { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }
        
        return new Response(
          JSON.stringify({ ok: true, message }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ ok: false, error: "Invalid request" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // 静的ファイルやその他のリクエストはCloudflare Pagesに委譲
    // WorkerはAPIエンドポイントのみを処理し、それ以外はPagesに任せる
    return fetch(request);
  }
};
