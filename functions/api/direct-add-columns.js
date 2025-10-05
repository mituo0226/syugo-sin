/**
 * user_profilesテーブルに直接カラムを追加するAPI
 * Cloudflareダッシュボードで確認できるように直接実行
 */

export async function onRequestPost(context) {
  const { env } = context;

  try {
    console.log("=== 直接カラム追加API開始 ===");

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
    const beforeInfo = await env.DB.prepare(`
      PRAGMA table_info(user_profiles)
    `).all();

    console.log("追加前のテーブル構造:", beforeInfo.results);
    const beforeColumns = beforeInfo.results.map(col => col.name);
    console.log("追加前のカラム数:", beforeColumns.length);

    // 2. 各カラムを個別に追加（エラーハンドリング付き）
    const columnsToAdd = [
      { name: "nickname", type: "TEXT" },
      { name: "worry", type: "TEXT" },
      { name: "magic_link_token", type: "TEXT" },
      { name: "magic_link_created_at", type: "TEXT" },
      { name: "magic_link_used", type: "INTEGER DEFAULT 0" },
      { name: "is_verified", type: "INTEGER DEFAULT 0" },
      { name: "is_active", type: "INTEGER DEFAULT 1" }
    ];

    for (const column of columnsToAdd) {
      try {
        const sql = `ALTER TABLE user_profiles ADD COLUMN ${column.name} ${column.type}`;
        console.log(`実行SQL: ${sql}`);
        
        await env.DB.prepare(sql).run();
        
        results.push({ 
          operation: `ADD COLUMN ${column.name}`, 
          success: true, 
          message: `カラム ${column.name} を追加しました`,
          sql: sql
        });
        console.log(`✅ カラム ${column.name} を追加しました`);
        
      } catch (error) {
        if (error.message.includes("duplicate column name")) {
          results.push({ 
            operation: `ADD COLUMN ${column.name}`, 
            success: true, 
            skipped: true, 
            message: `カラム ${column.name} は既に存在します`,
            sql: `ALTER TABLE user_profiles ADD COLUMN ${column.name} ${column.type}`
          });
          console.log(`⚠️ カラム ${column.name} は既に存在します`);
        } else {
          results.push({ 
            operation: `ADD COLUMN ${column.name}`, 
            success: false, 
            error: error.message,
            sql: `ALTER TABLE user_profiles ADD COLUMN ${column.name} ${column.type}`
          });
          console.error(`❌ カラム ${column.name} 追加エラー:`, error);
        }
      }
    }

    // 3. worry_typeをworryに変更（存在する場合）
    if (beforeColumns.includes("worry_type") && !beforeColumns.includes("worry")) {
      try {
        console.log("worry_typeカラムをworryに変更中...");
        await env.DB.prepare(`
          ALTER TABLE user_profiles RENAME COLUMN worry_type TO worry
        `).run();
        results.push({ 
          operation: "RENAME COLUMN worry_type TO worry", 
          success: true, 
          message: "worry_typeカラムをworryに変更しました",
          sql: "ALTER TABLE user_profiles RENAME COLUMN worry_type TO worry"
        });
        console.log("✅ worry_typeカラムをworryに変更しました");
      } catch (error) {
        results.push({ 
          operation: "RENAME COLUMN worry_type TO worry", 
          success: false, 
          error: error.message,
          sql: "ALTER TABLE user_profiles RENAME COLUMN worry_type TO worry"
        });
        console.error("❌ worry_typeカラムの変更エラー:", error);
      }
    }

    // 4. 追加後のテーブル構造を確認
    const afterInfo = await env.DB.prepare(`
      PRAGMA table_info(user_profiles)
    `).all();

    console.log("追加後のテーブル構造:", afterInfo.results);
    const afterColumns = afterInfo.results.map(col => col.name);
    console.log("追加後のカラム数:", afterColumns.length);

    // 5. 追加されたカラムを確認
    const newColumns = afterColumns.filter(col => !beforeColumns.includes(col));
    console.log("新しく追加されたカラム:", newColumns);

    return new Response(JSON.stringify({
      success: true,
      message: "直接カラム追加が完了しました",
      results: results,
      beforeColumns: beforeColumns,
      afterColumns: afterColumns,
      beforeCount: beforeColumns.length,
      afterCount: afterColumns.length,
      newColumns: newColumns,
      finalTableStructure: afterInfo.results.map(col => ({
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
    console.error("直接カラム追加エラー:", error);
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
