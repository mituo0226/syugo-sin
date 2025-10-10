/**
 * user_idカラムにUNIQUE制約を追加するAPI
 * D1データベースのuser_profilesテーブルのuser_idカラムにUNIQUE制約を追加
 */

export async function onRequestPost(context) {
  const { env } = context;

  try {
    console.log('=== user_id UNIQUE制約追加API開始 ===');

    if (!env.DB) {
      return new Response(JSON.stringify({
        success: false,
        error: 'データベース接続エラー'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 現在のテーブル構造を確認
    console.log('現在のテーブル構造を確認中...');
    const pragmaResult = await env.DB.prepare('PRAGMA table_info(user_profiles)').all();
    console.log('テーブル構造:', pragmaResult);

    // user_idカラムにUNIQUE制約を追加するための新しいテーブルを作成
    console.log('user_id UNIQUE制約付きの新しいテーブルを作成中...');
    
    // 1. 既存データをバックアップ
    const backupData = await env.DB.prepare('SELECT * FROM user_profiles').all();
    console.log('バックアップデータ件数:', backupData.results.length);

    // 2. 古いテーブルをリネーム
    await env.DB.prepare('ALTER TABLE user_profiles RENAME TO user_profiles_old').run();
    console.log('古いテーブルをリネーム完了');

    // 3. 新しいテーブルを作成（user_idにUNIQUE制約付き）
    await env.DB.prepare(`
      CREATE TABLE user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL UNIQUE,
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        worry_type TEXT
      )
    `).run();
    console.log('新しいテーブル作成完了');

    // 4. データを復元
    if (backupData.results.length > 0) {
      console.log('データを復元中...');
      for (const row of backupData.results) {
        await env.DB.prepare(`
          INSERT INTO user_profiles (
            id, user_id, nickname, birth_year, birth_month, birth_day,
            guardian_key, guardian_name, worry, registration_info,
            magic_link_token, magic_link_created_at, magic_link_used,
            is_verified, is_active, created_at, worry_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          row.id, row.user_id, row.nickname, row.birth_year, row.birth_month, row.birth_day,
          row.guardian_key, row.guardian_name, row.worry, row.registration_info,
          row.magic_link_token, row.magic_link_created_at, row.magic_link_used,
          row.is_verified, row.is_active, row.created_at, row.worry_type
        ).run();
      }
      console.log('データ復元完了');
    }

    // 5. インデックスを作成
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id)').run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_user_profiles_magic_link_token ON user_profiles(magic_link_token)').run();
    console.log('インデックス作成完了');

    // 6. 古いテーブルを削除
    await env.DB.prepare('DROP TABLE user_profiles_old').run();
    console.log('古いテーブル削除完了');

    // 7. 最終確認
    const finalCheck = await env.DB.prepare('PRAGMA table_info(user_profiles)').all();
    console.log('最終テーブル構造:', finalCheck);

    return new Response(JSON.stringify({
      success: true,
      message: 'user_id UNIQUE制約を追加しました',
      backupCount: backupData.results.length,
      tableStructure: finalCheck.results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== user_id UNIQUE制約追加エラー ===');
    console.error('エラー詳細:', error);
    console.error('エラーメッセージ:', error.message);
    console.error('エラースタック:', error.stack);

    return new Response(JSON.stringify({
      success: false,
      error: 'user_id UNIQUE制約の追加に失敗しました',
      details: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
