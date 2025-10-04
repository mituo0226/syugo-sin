export async function onRequestPost(context) {
  const { env } = context;

  try {
    // 標準的なテーブルを作成
    const tables = [
      {
        name: "users",
        schema: `CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          nickname TEXT,
          birthdate TEXT,
          guardian TEXT,
          topic TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: "magic_links",
        schema: `CREATE TABLE magic_links (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token TEXT UNIQUE NOT NULL,
          email TEXT NOT NULL,
          birthdate TEXT,
          guardian TEXT,
          nickname TEXT,
          topic TEXT,
          expires_at TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          used BOOLEAN DEFAULT FALSE
        )`
      }
    ];

    const createdTables = [];

    for (const table of tables) {
      try {
        // テーブルが存在するかチェック
        const existing = await env.DB.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name = ?
        `).bind(table.name).first();

        if (!existing) {
          await env.DB.prepare(table.schema).run();
          createdTables.push(table.name);
        }
      } catch (tableError) {
        console.error(`Error creating table ${table.name}:`, tableError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `データベースを初期化しました。${createdTables.length}個のテーブルを作成しました。`,
      createdTables: createdTables
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Database init error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
