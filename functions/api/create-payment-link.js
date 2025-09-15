import { Client, Environment } from "square";

export async function onRequestPost({ request, env }) {
  try {
    const { uid } = await request.json();

    const client = new Client({
      accessToken: env.SQUARE_ACCESS_TOKEN,
      environment: Environment.Sandbox, // Sandbox利用
    });

    const { result } = await client.checkoutApi.createPaymentLink({
      idempotencyKey: crypto.randomUUID(),
      order: {
        locationId: env.SQUARE_LOCATION_ID,
        lineItems: [
          {
            name: "テスト用鑑定チケット",
            quantity: "1",
            basePriceMoney: { amount: 10, currency: "JPY" }
          }
        ],
        referenceId: uid
      },
      checkoutOptions: {
        redirectUrl: `https://syugo-sin.com/confirm.html?uid=${uid}`
      }
    });

    return new Response(JSON.stringify({ checkoutUrl: result.paymentLink.url }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });

  } catch (error) {
    console.error("Square API Error:", error);
    return new Response(JSON.stringify({ 
      error: "Payment link creation failed",
      details: error.message 
    }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

// CORS preflight request handling
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
