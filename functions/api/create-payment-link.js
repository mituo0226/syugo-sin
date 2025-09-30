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
    
    const { uid } = requestBody;
    
    if (!uid) {
      return createErrorResponse("UID is required", 400, corsHeaders);
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
      redirect_url: `${new URL(request.url).origin}/confirm.html?uid=${uid}`,
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
      return createSuccessResponse({ 
        checkoutUrl: squareData.checkout.checkout_page_url 
      }, corsHeaders);
    } else {
      throw new Error("Failed to create checkout - invalid response");
    }

  } catch (error) {
    console.error("Payment link creation error:", error);
    return createErrorResponse("Failed to create payment link", 500, corsHeaders);
  }
}
