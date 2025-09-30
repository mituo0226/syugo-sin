import { getCorsHeaders, createErrorResponse, createSuccessResponse } from '../utils.js';

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
    
    const { uid, checkoutId } = requestBody;
    
    if (!uid || !checkoutId) {
      return createErrorResponse("UID and checkoutId are required", 400, corsHeaders);
    }

    // テスト用のダミーcheckoutIdの場合は成功として扱う
    if (checkoutId.startsWith('test-checkout-')) {
      console.log('テスト用決済検証:', { uid, checkoutId });
      const expireAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
      
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
        // 有効期限を設定（10円＝3分）
        const expireAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
        
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
