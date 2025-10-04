export async function onRequestPost(context) {
  const { env } = context;

  try {
    // 既存のテーブル一覧を取得
    const tablesResult = await env.DB.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();

    // 各テーブルを削除
    for (const table of tablesResult.results) {
      await env.DB.prepare(`DROP TABLE ${table.name}`).run();
    }

    return new Response(JSON.stringify({
      success: true,
      message: `データベースをリセットしました。${tablesResult.results.length}個のテーブルを削除しました。`
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Database reset error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
