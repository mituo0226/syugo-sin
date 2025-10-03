import { getCorsHeaders, createErrorResponse, createSuccessResponse } from '../utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  console.log("Purchase History API endpoint hit:", { method: request.method, pathname: request.url });

  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    
    if (!email) {
      return createErrorResponse("Email parameter is required", 400, corsHeaders);
    }

    // D1データベースのバインド確認
    if (!env.DB) {
      console.error("D1 database not bound");
      throw new Error("Database not available");
    }

    console.log("Fetching purchase history for email:", email);

    // ユーザーIDを取得
    const user = await env.DB.prepare(`
      SELECT id, nickname FROM users WHERE email = ?
    `).bind(email).first();

    if (!user) {
      return createErrorResponse("User not found", 404, corsHeaders);
    }

    // 購入履歴を取得
    const purchases = await env.DB.prepare(`
      SELECT 
        p.id,
        p.ticket_type,
        p.ticket_name,
        p.price,
        p.minutes,
        p.payment_method,
        p.payment_status,
        p.square_order_id,
        p.purchase_date
      FROM purchases p
      WHERE p.user_id = ?
      ORDER BY p.purchase_date DESC
    `).bind(user.id).all();

    console.log('Purchase history result:', {
      userId: user.id,
      purchaseCount: purchases.results?.length || 0
    });

    // 統計情報を計算
    const totalPurchases = purchases.results?.length || 0;
    const totalAmount = purchases.results?.reduce((sum, purchase) => sum + (purchase.price || 0), 0) || 0;
    const totalMinutes = purchases.results?.reduce((sum, purchase) => sum + (purchase.minutes || 0), 0) || 0;

    return createSuccessResponse({
      user: {
        id: user.id,
        nickname: user.nickname,
        email: email
      },
      purchases: purchases.results || [],
      statistics: {
        totalPurchases,
        totalAmount,
        totalMinutes
      }
    }, corsHeaders);

  } catch (error) {
    console.error("Purchase history fetch error:", error);
    return createErrorResponse("Failed to fetch purchase history", 500, corsHeaders);
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
    console.log("Method not allowed:", request.method);
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
    
    const { email, ticketType, ticketName, price, minutes, paymentMethod = 'square', squareOrderId } = requestBody;
    
    if (!email || !ticketType || !ticketName || !price || !minutes) {
      return createErrorResponse("Required fields missing", 400, corsHeaders);
    }

    // D1データベースのバインド確認
    if (!env.DB) {
      console.error("D1 database not bound");
      throw new Error("Database not available");
    }

    console.log("Creating purchase record:", { email, ticketType, ticketName, price, minutes, paymentMethod, squareOrderId });

    // ユーザーIDを取得
    const user = await env.DB.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(email).first();

    if (!user) {
      return createErrorResponse("User not found", 404, corsHeaders);
    }

    // 購入履歴を保存
    const result = await env.DB.prepare(`
      INSERT INTO purchases (user_id, ticket_type, ticket_name, price, minutes, payment_method, payment_status, square_order_id)
      VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)
    `).bind(
      user.id,
      ticketType,
      ticketName,
      price,
      minutes,
      paymentMethod,
      squareOrderId || null
    ).run();

    console.log('Purchase record created:', result);

    if (result.success) {
      // 保存されたデータを取得
      const savedPurchase = await env.DB.prepare(`
        SELECT * FROM purchases WHERE id = ?
      `).bind(result.meta.last_row_id).first();

      return createSuccessResponse({ 
        success: true,
        purchase: savedPurchase
      }, corsHeaders);
    } else {
      throw new Error("Failed to create purchase record");
    }

  } catch (error) {
    console.error("Purchase record creation error:", error);
    return createErrorResponse("Failed to create purchase record", 500, corsHeaders);
  }
}
