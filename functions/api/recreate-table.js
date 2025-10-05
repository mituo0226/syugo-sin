/**
 * user_profilesテーブルを完全に再作成するAPI
 * 既存データを保持してカラムを追加
 */

export async function onRequestPost(context) {
  const { env } = context;

  try {
    console.log("=== テーブル再作成API開始 ===");

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

    // 1. 既存データをバックアップ
    const existingData = await env.DB.prepare(`
      SELECT * FROM user_profiles
    `).all();

    console.log("既存データのバックアップ:", existingData.results);

    // 2. 既存テーブルを削除
    try {
      await env.DB.prepare(`DROP TABLE IF EXISTS user_profiles`).run();
      results.push({ 
        operation: "DROP TABLE user_profiles", 
        success: true, 
        message: "既存テーブルを削除しました" 
      });
      console.log("既存テーブルを削除しました");
    } catch (error) {
      results.push({ 
        operation: "DROP TABLE user_profiles", 
        success: false, 
        error: error.message 
      });
      console.error("テーブル削除エラー:", error);
    }

    // 3. 新しいテーブルを作成（全カラム含む）
    try {
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
      results.push({ 
        operation: "CREATE TABLE user_profiles", 
        success: true, 
        message: "新しいテーブルを作成しました（全17カラム）" 
      });
      console.log("新しいテーブルを作成しました");
    } catch (error) {
      results.push({ 
        operation: "CREATE TABLE user_profiles", 
        success: false, 
        error: error.message 
      });
      console.error("テーブル作成エラー:", error);
      throw error;
    }

    // 4. 既存データを復元（可能なカラムのみ）
    if (existingData.results && existingData.results.length > 0) {
      for (const row of existingData.results) {
        try {
          await env.DB.prepare(`
            INSERT INTO user_profiles (
              id, user_id, nickname, birth_year, birth_month, birth_day,
              guardian_key, guardian_name, worry, registration_info,
              magic_link_token, magic_link_created_at, magic_link_used,
              is_verified, is_active, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            row.id,
            row.user_id,
            row.nickname || null,
            row.birth_year,
            row.birth_month,
            row.birth_day,
            row.guardian_key,
            row.guardian_name,
            row.worry_type || row.worry || null,  // worry_typeまたはworryから取得
            row.registration_info,
            row.magic_link_token || null,
            row.magic_link_created_at || null,
            row.magic_link_used || 0,
            row.is_verified || 0,
            row.is_active || 1,
            row.created_at
          ).run();
        } catch (error) {
          console.error("データ復元エラー:", error, "行:", row);
        }
      }
      results.push({ 
        operation: "RESTORE DATA", 
        success: true, 
        message: `既存データ ${existingData.results.length} 行を復元しました` 
      });
      console.log("既存データを復元しました");
    }

    // 5. 最終的なテーブル構造を確認
    const finalInfo = await env.DB.prepare(`
      PRAGMA table_info(user_profiles)
    `).all();

    // 6. 行数を確認
    const rowCount = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM user_profiles
    `).first();

    return new Response(JSON.stringify({
      success: true,
      message: "テーブル再作成が完了しました",
      results: results,
      finalTableStructure: finalInfo.results.map(col => ({
        name: col.name,
        type: col.type,
        notnull: col.notnull,
        default: col.dflt_value
      })),
      totalColumns: finalInfo.results.length,
      totalRows: rowCount ? rowCount.count : 0,
      restoredRows: existingData.results ? existingData.results.length : 0
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("テーブル再作成エラー:", error);
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
