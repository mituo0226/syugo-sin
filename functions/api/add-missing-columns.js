/**
 * user_profilesテーブルに不足しているカラムを追加するAPI
 */

export async function onRequestPost(context) {
  const { env } = context;

  try {
    console.log("=== 不足カラム追加API開始 ===");

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

    const results = [];

    // 1. 現在のテーブル構造を確認
    const currentTableInfo = await env.DB.prepare(`
      PRAGMA table_info(user_profiles)
    `).all();

    console.log("現在のテーブル構造:", currentTableInfo.results);
    
    const existingColumns = currentTableInfo.results.map(col => col.name);
    console.log("既存カラム:", existingColumns);

    // 2. 必要なカラムの定義
    const requiredColumns = [
      { name: "nickname", sql: "ALTER TABLE user_profiles ADD COLUMN nickname TEXT" },
      { name: "worry", sql: "ALTER TABLE user_profiles ADD COLUMN worry TEXT" },
      { name: "magic_link_token", sql: "ALTER TABLE user_profiles ADD COLUMN magic_link_token TEXT" },
      { name: "magic_link_created_at", sql: "ALTER TABLE user_profiles ADD COLUMN magic_link_created_at TEXT" },
      { name: "magic_link_used", sql: "ALTER TABLE user_profiles ADD COLUMN magic_link_used INTEGER DEFAULT 0" },
      { name: "is_verified", sql: "ALTER TABLE user_profiles ADD COLUMN is_verified INTEGER DEFAULT 0" },
      { name: "is_active", sql: "ALTER TABLE user_profiles ADD COLUMN is_active INTEGER DEFAULT 1" }
    ];

    // 3. 不足しているカラムを追加
    for (const column of requiredColumns) {
      if (!existingColumns.includes(column.name)) {
        try {
          console.log(`カラム ${column.name} を追加中...`);
          await env.DB.prepare(column.sql).run();
          results.push({ 
            operation: `ADD COLUMN ${column.name}`, 
            success: true, 
            message: `カラム ${column.name} を追加しました` 
          });
          console.log(`カラム ${column.name} を追加しました`);
        } catch (error) {
          console.error(`カラム ${column.name} 追加エラー:`, error);
          results.push({ 
            operation: `ADD COLUMN ${column.name}`, 
            success: false, 
            error: error.message 
          });
        }
      } else {
        console.log(`カラム ${column.name} は既に存在します`);
        results.push({ 
          operation: `ADD COLUMN ${column.name}`, 
          success: true, 
          skipped: true, 
          message: `カラム ${column.name} は既に存在します` 
        });
      }
    }

    // 4. worry_typeカラムをworryに変更（存在する場合）
    if (existingColumns.includes("worry_type") && !existingColumns.includes("worry")) {
      try {
        console.log("worry_typeカラムをworryに変更中...");
        await env.DB.prepare(`
          ALTER TABLE user_profiles RENAME COLUMN worry_type TO worry
        `).run();
        results.push({ 
          operation: "RENAME COLUMN worry_type TO worry", 
          success: true, 
          message: "worry_typeカラムをworryに変更しました" 
        });
        console.log("worry_typeカラムをworryに変更しました");
      } catch (error) {
        console.error("worry_typeカラムの変更エラー:", error);
        results.push({ 
          operation: "RENAME COLUMN worry_type TO worry", 
          success: false, 
          error: error.message 
        });
      }
    }

    // 5. 修正後のテーブル構造を確認
    const finalTableInfo = await env.DB.prepare(`
      PRAGMA table_info(user_profiles)
    `).all();

    return new Response(JSON.stringify({
      success: true,
      message: "不足カラムの追加が完了しました",
      results: results,
      beforeColumns: existingColumns,
      afterColumns: finalTableInfo.results.map(col => col.name),
      finalTableStructure: finalTableInfo.results.map(col => ({
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
    console.error("不足カラム追加エラー:", error);
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
