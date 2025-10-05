/**
 * データベーステーブル構造更新API
 * user_profilesテーブルに新しいカラムを追加
 */

export async function onRequestPost(context) {
  const { env } = context;

  try {
    console.log("=== テーブル構造更新API開始 ===");

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

    // 新しいカラムを追加
    const alterQueries = [
      "ALTER TABLE user_profiles ADD COLUMN is_verified INTEGER DEFAULT 0",
      "ALTER TABLE user_profiles ADD COLUMN is_active INTEGER DEFAULT 1"
    ];

    const results = [];

    for (const query of alterQueries) {
      try {
        console.log("実行中のクエリ:", query);
        const result = await env.DB.prepare(query).run();
        results.push({ query, success: true, result });
        console.log("クエリ実行成功:", query);
      } catch (error) {
        // カラムが既に存在する場合はエラーを無視
        if (error.message.includes("duplicate column name")) {
          console.log("カラムは既に存在します:", query);
          results.push({ query, success: true, skipped: true, message: "カラムは既に存在します" });
        } else {
          console.error("クエリ実行エラー:", query, error);
          results.push({ query, success: false, error: error.message });
        }
      }
    }

    // 更新後のテーブル構造を確認
    const tableInfo = await env.DB.prepare(`
      PRAGMA table_info(user_profiles)
    `).all();

    return new Response(JSON.stringify({
      success: true,
      message: "テーブル構造の更新が完了しました",
      results: results,
      updatedTableStructure: tableInfo.results.map(col => ({
        name: col.name,
        type: col.type,
        notnull: col.notnull,
        default: col.dflt_value
      }))
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("テーブル構造更新エラー:", error);
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
