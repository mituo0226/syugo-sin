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
    
    const { uid, ticketType, price, minutes } = requestBody;
    
    console.log("Payment request body:", requestBody);
    console.log("Environment variables check:");
    console.log("- SQUARE_LOCATION_ID:", env.SQUARE_LOCATION_ID ? "SET" : "NOT SET");
    console.log("- SQUARE_ACCESS_TOKEN:", env.SQUARE_ACCESS_TOKEN ? "SET" : "NOT SET");
    
    if (!uid) {
      return createErrorResponse("UID is required", 400, corsHeaders);
    }
    
    // 環境変数の確認
    if (!env.SQUARE_LOCATION_ID) {
      console.error("SQUARE_LOCATION_ID is not set");
      return createErrorResponse("Square configuration error: Location ID not set", 500, corsHeaders);
    }
    
    if (!env.SQUARE_ACCESS_TOKEN) {
      console.error("SQUARE_ACCESS_TOKEN is not set");
      return createErrorResponse("Square configuration error: Access token not set", 500, corsHeaders);
    }

    // Square API Checkoutを直接HTTPリクエストで呼び出し
    const checkoutData = {
      idempotency_key: `${uid}-${Date.now()}`,
      order: {
        location_id: env.SQUARE_LOCATION_ID,
        line_items: [
          {
            name: ticketType ? `AI鑑定師 龍 - ${ticketType}チケット` : "AI鑑定師 龍 - 鑑定チケット",
            quantity: "1",
            base_price_money: {
              amount: price || 10, // 指定された価格、デフォルト10円（テスト用）
              currency: "JPY"
            }
          }
        ]
      },
      ask_for_shipping_address: false,
      merchant_support_email: "support@example.com",
      pre_populate_buyer_email: "test@example.com",
      redirect_url: `${new URL(request.url).origin}/confirm.html?uid=${uid}`,
      note: `Ticket purchase for UID: ${uid}, Type: ${ticketType || 'default'}, Price: ${price || 10}円, Minutes: ${minutes || 5}`
    };

    console.log('Square API request data:', JSON.stringify(checkoutData, null, 2));
    
    try {
      const squareResponse = await fetch(`https://connect.squareupsandbox.com/v2/locations/${env.SQUARE_LOCATION_ID}/checkouts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-04-17'
        },
        body: JSON.stringify(checkoutData)
      });

      console.log('Square API response status:', squareResponse.status);
      console.log('Square API response headers:', Object.fromEntries(squareResponse.headers.entries()));

      if (!squareResponse.ok) {
        const errorText = await squareResponse.text();
        console.error('Square API error response:', errorText);
        throw new Error(`Square API error: ${squareResponse.status} - ${errorText}`);
      }
      
      const squareData = await squareResponse.json();
      console.log('Square API success response:', JSON.stringify(squareData, null, 2));
      
      if (squareData.checkout && squareData.checkout.checkout_page_url) {
        return createSuccessResponse({ 
          checkoutUrl: squareData.checkout.checkout_page_url 
        }, corsHeaders);
      } else {
        console.error('Invalid Square response structure:', squareData);
        throw new Error("Failed to create checkout - invalid response structure");
      }
      
    } catch (fetchError) {
      console.error('Square API fetch error:', fetchError);
      throw new Error(`Square API request failed: ${fetchError.message}`);
    }

  } catch (error) {
    console.error("Payment link creation error:", error);
    return createErrorResponse("Failed to create payment link", 500, corsHeaders);
  }
}
