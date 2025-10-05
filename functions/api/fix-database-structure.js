/**
 * データベース構造を修正するAPI
 * magic_linksテーブルを削除し、user_profilesテーブルを正しく修正
 */

export async function onRequestPost(context) {
  const { env } = context;

  try {
    console.log("=== データベース構造修正API開始 ===");

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

    // 1. magic_linksテーブルを削除
    try {
      console.log("magic_linksテーブルを削除中...");
      await env.DB.prepare(`DROP TABLE IF EXISTS magic_links`).run();
      results.push({ operation: "DROP magic_links", success: true, message: "magic_linksテーブルを削除しました" });
      console.log("magic_linksテーブルを削除しました");
    } catch (error) {
      console.error("magic_linksテーブル削除エラー:", error);
      results.push({ operation: "DROP magic_links", success: false, error: error.message });
    }

    // 2. user_profilesテーブルの構造を確認
    let tableExists = false;
    try {
      const tableInfo = await env.DB.prepare(`
        PRAGMA table_info(user_profiles)
      `).all();
      
      if (tableInfo.results && tableInfo.results.length > 0) {
        tableExists = true;
        console.log("user_profilesテーブルが存在します:", tableInfo.results);
      }
    } catch (error) {
      console.log("user_profilesテーブルが存在しません");
    }

    // 3. user_profilesテーブルが存在しない場合は作成
    if (!tableExists) {
      try {
        console.log("user_profilesテーブルを作成中...");
        await env.DB.prepare(`
          CREATE TABLE user_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            nickname TEXT,
            birth_year TEXT,
            birth_month TEXT,
            birth_day TEXT,
            guardian_key TEXT,
            guardian_name TEXT,
            worry TEXT,
            registration_info TEXT,
            magic_link_token TEXT,
            magic_link_created_at TEXT,
            magic_link_used INTEGER DEFAULT 0,
            is_verified INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
        results.push({ operation: "CREATE user_profiles", success: true, message: "user_profilesテーブルを作成しました" });
        console.log("user_profilesテーブルを作成しました");
      } catch (error) {
        console.error("user_profilesテーブル作成エラー:", error);
        results.push({ operation: "CREATE user_profiles", success: false, error: error.message });
      }
    } else {
      // 4. 既存のuser_profilesテーブルに不足しているカラムを追加
      const alterQueries = [
        { sql: "ALTER TABLE user_profiles ADD COLUMN is_verified INTEGER DEFAULT 0", name: "is_verified" },
        { sql: "ALTER TABLE user_profiles ADD COLUMN is_active INTEGER DEFAULT 1", name: "is_active" }
      ];

      for (const query of alterQueries) {
        try {
          console.log(`カラム ${query.name} を追加中...`);
          await env.DB.prepare(query.sql).run();
          results.push({ operation: `ADD COLUMN ${query.name}`, success: true, message: `カラム ${query.name} を追加しました` });
          console.log(`カラム ${query.name} を追加しました`);
        } catch (error) {
          if (error.message.includes("duplicate column name")) {
            console.log(`カラム ${query.name} は既に存在します`);
            results.push({ operation: `ADD COLUMN ${query.name}`, success: true, skipped: true, message: `カラム ${query.name} は既に存在します` });
          } else {
            console.error(`カラム ${query.name} 追加エラー:`, error);
            results.push({ operation: `ADD COLUMN ${query.name}`, success: false, error: error.message });
          }
        }
      }

      // 5. worry_typeカラムをworryに変更（存在する場合）
      try {
        console.log("worry_typeカラムをworryに変更中...");
        await env.DB.prepare(`
          ALTER TABLE user_profiles RENAME COLUMN worry_type TO worry
        `).run();
        results.push({ operation: "RENAME COLUMN worry_type TO worry", success: true, message: "worry_typeカラムをworryに変更しました" });
        console.log("worry_typeカラムをworryに変更しました");
      } catch (error) {
        if (error.message.includes("no such column")) {
          console.log("worry_typeカラムが存在しないか、既にworryに変更済みです");
          results.push({ operation: "RENAME COLUMN worry_type TO worry", success: true, skipped: true, message: "worry_typeカラムが存在しないか、既にworryに変更済みです" });
        } else {
          console.error("worry_typeカラムの変更エラー:", error);
          results.push({ operation: "RENAME COLUMN worry_type TO worry", success: false, error: error.message });
        }
      }
    }

    // 6. 修正後のテーブル構造を確認
    const finalTableInfo = await env.DB.prepare(`
      PRAGMA table_info(user_profiles)
    `).all();

    return new Response(JSON.stringify({
      success: true,
      message: "データベース構造の修正が完了しました",
      results: results,
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
    console.error("データベース構造修正エラー:", error);
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
