export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { query } = await request.json();

    if (!query) {
      return new Response(JSON.stringify({
        success: false,
        error: "SQLクエリが必要です"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 危険なクエリをチェック（基本的な保護）
    const dangerousKeywords = ['DROP DATABASE', 'DELETE FROM', 'UPDATE', 'INSERT INTO', 'ALTER TABLE'];
    const upperQuery = query.toUpperCase();
    
    // SELECT文以外は制限
    if (!upperQuery.trim().startsWith('SELECT') && !upperQuery.trim().startsWith('PRAGMA')) {
      return new Response(JSON.stringify({
        success: false,
        error: "SELECT文とPRAGMA文のみ実行可能です。テーブル操作は専用のAPIを使用してください。"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // クエリを実行
    const result = await env.DB.prepare(query).all();

    return new Response(JSON.stringify({
      success: true,
      result: result.results,
      meta: result.meta
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Database execute error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
