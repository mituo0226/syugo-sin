import { runConsult } from "../public/consult/consult.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS ヘッダー
    const corsHeaders = {
      "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // OPTIONS リクエストの処理
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
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
        const payload = await request.json();
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
          JSON.stringify({ ok: false, error: "Internal Server Error" }),
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
