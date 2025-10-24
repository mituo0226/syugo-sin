import { getCorsHeaders, createErrorResponse, createSuccessResponse } from '../utils.js';

// 購入履歴を保存する関数
async function savePurchaseHistory(db, uid, ticketData, orderId, isTest) {
  try {
    // ユーザーIDを取得（UIDから）
    const user = await db.prepare(`
      SELECT id FROM user_profiles WHERE user_id = ?
    `).bind(uid).first();

    if (!user) {
      console.error('ユーザーが見つかりません:', uid);
      return;
    }

    const userId = user.id;
    
    // 購入履歴テーブルが存在するかチェック
    const tableExists = await db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='purchases'
    `).first();

    if (!tableExists) {
      // 購入履歴テーブルを作成
      await db.prepare(`
        CREATE TABLE purchases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          ticket_type TEXT,
          ticket_name TEXT,
          price INTEGER,
          minutes INTEGER,
          payment_method TEXT,
          payment_status TEXT,
          square_order_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES user_profiles (id)
        )
      `).run();
      console.log('購入履歴テーブルを作成しました');
    }
    
    // 購入履歴を保存
    const result = await db.prepare(`
      INSERT INTO purchases (user_id, ticket_type, ticket_name, price, minutes, payment_method, payment_status, square_order_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      ticketData.type || 'default',
      ticketData.name || 'チケット',
      ticketData.price || 0,
      ticketData.minutes || 0,
      isTest ? 'test' : 'square',
      'completed',
      orderId
    ).run();

    console.log('購入履歴を保存しました:', {
      userId,
      ticketData,
      orderId,
      isTest,
      result
    });

  } catch (error) {
    console.error('購入履歴保存エラー:', error);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // OPTIONS リクエストの処理（プリフライトリクエスト）
  if (request.method === "OPTIONS") {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders
    });
  }

  if (request.method !== "POST") {
    return createErrorResponse("Method not allowed", 405, corsHeaders);
  }

  try {
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (jsonError) {
      console.error("JSON parse error:", jsonError);
      return createErrorResponse("Invalid JSON format", 400, corsHeaders);
    }
    
    const { uid, checkoutId, ticketData } = requestBody;
    
    if (!uid || !checkoutId) {
      return createErrorResponse("UID and checkoutId are required", 400, corsHeaders);
    }

    // テスト用のダミーcheckoutIdの場合は成功として扱う
    if (checkoutId.startsWith('test-checkout-')) {
      console.log('テスト用決済検証:', { uid, checkoutId, ticketData });
      
      // 購入履歴を保存
      if (ticketData && env.DB) {
        await savePurchaseHistory(env.DB, uid, ticketData, checkoutId, true);
      }
      
      const expireAt = new Date(Date.now() + (ticketData?.minutes || 3) * 60 * 1000).toISOString();
      
      return createSuccessResponse({ 
        ok: true, 
        expireAt: expireAt,
        orderId: checkoutId,
        isTest: true
      }, corsHeaders);
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
        // 購入履歴を保存
        if (ticketData && env.DB) {
          await savePurchaseHistory(env.DB, uid, ticketData, order.id, false);
        }
        
        // 有効期限を設定
        const expireAt = new Date(Date.now() + (ticketData?.minutes || 3) * 60 * 1000).toISOString();
        
        return createSuccessResponse({ 
          ok: true, 
          expireAt: expireAt,
          orderId: order.id
        }, corsHeaders);
      } else {
        return createErrorResponse("Payment not completed", 400, corsHeaders);
      }
    } else {
      throw new Error("Failed to retrieve order - invalid response");
    }

  } catch (error) {
    console.error("Payment verification error:", error);
    return createErrorResponse("Failed to verify payment", 500, corsHeaders);
  }
}
