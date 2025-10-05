export async function onRequestGet(context) {
  const { env } = context;

  try {
    console.log("Database tables API called");
    console.log("DB binding exists:", !!env.DB);
    
    // テーブル一覧を取得
    const tablesResult = await env.DB.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();
    
    console.log("Tables query result:", tablesResult);

    const tables = [];
    
    if (tablesResult.results && tablesResult.results.length > 0) {
      for (const table of tablesResult.results) {
        try {
          // 各行のテーブルの行数を取得
          const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM ${table.name}
          `).first();
          
          tables.push({
            name: table.name,
            rowCount: countResult ? countResult.count || 0 : 0
          });
        } catch (countError) {
          console.error(`Error counting rows for table ${table.name}:`, countError);
          // 行数取得に失敗してもテーブル名は追加
          tables.push({
            name: table.name,
            rowCount: 0
          });
        }
      }
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
