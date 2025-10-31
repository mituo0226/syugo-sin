import { getCorsHeaders, createErrorResponse, createSuccessResponse } from '../utils.js';

// 入金履歴（日/月集計）取得API
// クエリ:
// - date=YYYY-MM-DD もしくは month=YYYY-MM
// - includeTest=true|false （既定: true）
export async function onRequestGet(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    if (!env.DB) {
      return createErrorResponse("Database not available", 500, corsHeaders);
    }

    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const month = url.searchParams.get('month');
    const includeTestParam = url.searchParams.get('includeTest');
    const includeTest = includeTestParam == null ? true : includeTestParam === 'true' || includeTestParam === '1';

    // 期間指定がない場合は直近30日を既定とする
    let whereClauses = [];
    let bindParams = [];

    // created_at もしくは purchased_at を許容
    // SQLite用にCOALESCEで存在する方を採用
    const tsExpr = "COALESCE(p.purchased_at, p.created_at)";

    if (date) {
      whereClauses.push(`DATE(${tsExpr}) = DATE(?)`);
      bindParams.push(date);
    } else if (month) {
      // month は YYYY-MM 形式を想定
      whereClauses.push(`strftime('%Y-%m', ${tsExpr}) = ?`);
      bindParams.push(month);
    } else {
      whereClauses.push(`${tsExpr} >= datetime('now', '-30 days')`);
    }

    if (!includeTest) {
      whereClauses.push(`(p.payment_method IS NULL OR p.payment_method <> 'test')`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT 
        p.id,
        p.user_id,
        p.ticket_type,
        p.ticket_name,
        p.price,
        p.minutes,
        p.payment_method,
        p.payment_status,
        p.square_order_id,
        ${tsExpr} AS purchase_date,
        up.user_id AS email,
        up.nickname AS nickname
      FROM purchases p
      LEFT JOIN user_profiles up ON up.id = p.user_id
      ${whereSql}
      ORDER BY purchase_date DESC
    `;

    const results = await env.DB.prepare(query).bind(...bindParams).all();

    const purchases = (results.results || []).map(r => ({
      id: r.id,
      ticket_type: r.ticket_type,
      ticket_name: r.ticket_name,
      price: r.price,
      minutes: r.minutes,
      payment_method: r.payment_method,
      payment_status: r.payment_status,
      square_order_id: r.square_order_id,
      purchase_date: r.purchase_date,
      user: {
        id: r.user_id,
        nickname: r.nickname,
        email: r.email
      }
    }));

    // 簡易統計
    const totalAmount = purchases.reduce((sum, p) => sum + (p.price || 0), 0);
    const completedCount = purchases.filter(p => p.payment_status === 'completed').length;

    return createSuccessResponse({
      purchases,
      statistics: {
        totalPurchases: purchases.length,
        totalAmount,
        completedCount
      }
    }, corsHeaders);
  } catch (error) {
    console.error('Payment history aggregate error:', error);
    return createErrorResponse('Failed to fetch payment history', 500, corsHeaders);
  }
}


