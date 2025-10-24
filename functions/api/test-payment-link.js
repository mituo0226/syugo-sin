import { getCorsHeaders, createErrorResponse, createSuccessResponse } from '../utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // 環境変数の状態を確認
    const envStatus = {
      SQUARE_LOCATION_ID: env.SQUARE_LOCATION_ID ? "SET" : "NOT SET",
      SQUARE_ACCESS_TOKEN: env.SQUARE_ACCESS_TOKEN ? "SET" : "NOT SET",
      environment: Object.keys(env || {})
    };

    console.log("Environment status:", envStatus);

    // テスト用の決済リンク生成（環境変数が設定されていない場合）
    if (!env.SQUARE_LOCATION_ID || !env.SQUARE_ACCESS_TOKEN) {
      const requestBody = await request.json();
      const { uid, ticketType, price, minutes } = requestBody;
      
      const testCheckoutUrl = `${new URL(request.url).origin}/payment.html?uid=${uid || 'test'}&ticketType=${ticketType || 'first-time'}&price=${price || 100}&minutes=${minutes || 5}`;
      
      return createSuccessResponse({
        success: true,
        message: "Test mode - Square credentials not configured",
        checkoutUrl: testCheckoutUrl,
        environment: envStatus,
        fallback: true
      }, corsHeaders);
    }

    // 実際のSquare決済リンク生成
    const requestBody = await request.json();
    const { uid, ticketType, price, minutes } = requestBody;

    const checkoutData = {
      idempotency_key: `${uid}-${Date.now()}`,
      order: {
        location_id: env.SQUARE_LOCATION_ID,
        line_items: [
          {
            name: ticketType ? `AI鑑定師 龍 - ${ticketType}チケット` : "AI鑑定師 龍 - 鑑定チケット",
            quantity: "1",
            base_price_money: {
              amount: price || 100,
              currency: "JPY"
            }
          }
        ]
      },
      ask_for_shipping_address: false,
      merchant_support_email: "support@syugo-sin.com",
      pre_populate_buyer_email: "test@syugo-sin.com",
      redirect_url: `${new URL(request.url).origin}/confirm.html?uid=${uid}`,
      note: `Ticket purchase for UID: ${uid}, Type: ${ticketType || 'default'}, Price: ${price || 100}円, Minutes: ${minutes || 5}`
    };

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
      console.error('Square API error:', errorText);
      
      // Square API エラーの場合もテストページにフォールバック
      const fallbackUrl = `${new URL(request.url).origin}/payment.html?uid=${uid}&ticketType=${ticketType}&price=${price}&minutes=${minutes}`;
      
      return createSuccessResponse({
        success: true,
        message: "Square API error - using fallback",
        checkoutUrl: fallbackUrl,
        squareError: errorText,
        fallback: true
      }, corsHeaders);
    }

    const squareData = await squareResponse.json();
    
    if (squareData.checkout && squareData.checkout.checkout_page_url) {
      return createSuccessResponse({
        success: true,
        checkoutUrl: squareData.checkout.checkout_page_url,
        fallback: false
      }, corsHeaders);
    } else {
      throw new Error("Invalid Square response structure");
    }

  } catch (error) {
    console.error("Test payment link error:", error);
    
    // エラーが発生した場合もテストページにフォールバック
    try {
      const requestBody = await request.json();
      const { uid } = requestBody;
      const fallbackUrl = `${new URL(request.url).origin}/payment.html?uid=${uid || 'test'}&ticketType=first-time&price=100&minutes=5`;
      
      return createSuccessResponse({
        success: true,
        message: "Error occurred - using fallback",
        checkoutUrl: fallbackUrl,
        error: error.message,
        fallback: true
      }, corsHeaders);
    } catch (fallbackError) {
      return createErrorResponse(`Payment link creation failed: ${error.message}`, 500, corsHeaders);
    }
  }
}
