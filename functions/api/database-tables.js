export async function onRequestGet(context) {
  const { env } = context;

  try {
    // テーブル一覧を取得
    const tablesResult = await env.DB.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();

    const tables = [];
    
    for (const table of tablesResult.results) {
      // 各行のテーブルの行数を取得
      const countResult = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM ${table.name}
      `).first();
      
      tables.push({
        name: table.name,
        rowCount: countResult.count || 0
      });
    }

    return new Response(JSON.stringify({
      success: true,
      tables: tables
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Database tables error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
