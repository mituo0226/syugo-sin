/**
 * データベーステーブル構造確認API
 * user_profilesテーブルの現在の構造を確認
 */

export async function onRequestGet(context) {
  const { env } = context;

  try {
    console.log("=== テーブル構造確認API開始 ===");

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

    // テーブル構造を取得
    const tableInfo = await env.DB.prepare(`
      PRAGMA table_info(user_profiles)
    `).all();

    console.log("テーブル構造:", tableInfo);

    // テーブルが存在するかチェック
    if (!tableInfo.results || tableInfo.results.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "user_profilesテーブルが存在しません"
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      tableStructure: tableInfo.results,
      columns: tableInfo.results.map(col => ({
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
    console.error("テーブル構造確認エラー:", error);
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
