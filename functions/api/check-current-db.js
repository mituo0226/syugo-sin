/**
 * 現在のデータベース構造を確認するAPI
 * 全テーブルとその構造を表示
 */

export async function onRequestGet(context) {
  const { env } = context;

  try {
    console.log("=== 現在のデータベース構造確認API開始 ===");

    // データベース接続確認
    if (!env.DB) {
      return new Response(JSON.stringify({
        success: false,
        error: "データベース接続が見つかりません"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 全テーブル一覧を取得
    const tablesResult = await env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `).all();

    console.log("全テーブル一覧:", tablesResult);

    const tables = [];
    
    if (tablesResult.results && tablesResult.results.length > 0) {
      for (const table of tablesResult.results) {
        try {
          // 各テーブルの構造を取得
          const tableInfo = await env.DB.prepare(`
            PRAGMA table_info(${table.name})
          `).all();
          
          // 各行数を取得
          const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM ${table.name}
          `).first();
          
          tables.push({
            name: table.name,
            columns: tableInfo.results || [],
            rowCount: countResult ? countResult.count || 0 : 0
          });
          
          console.log(`テーブル ${table.name} の構造:`, tableInfo.results);
          console.log(`テーブル ${table.name} の行数:`, countResult ? countResult.count : 0);
          
        } catch (error) {
          console.error(`テーブル ${table.name} の情報取得エラー:`, error);
          tables.push({
            name: table.name,
            columns: [],
            rowCount: 0,
            error: error.message
          });
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: "データベース構造の確認が完了しました",
      tables: tables,
      totalTables: tables.length
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("データベース構造確認エラー:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
