/**
 * データベース状況のデバッグAPI
 * 実際のデータベース状況を詳細に確認
 */

export async function onRequestGet(context) {
  const { env } = context;

  try {
    console.log('=== データベース状況デバッグAPI開始 ===');

    if (!env.DB) {
      return new Response(JSON.stringify({
        success: false,
        error: 'データベース接続が見つかりません'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. すべてのテーブル一覧を取得
    const allTablesResult = await env.DB.prepare(`
      SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name
    `).all();

    console.log('すべてのテーブル・ビュー:', allTablesResult.results);

    // 2. 各テーブルの詳細情報を取得
    const detailedStats = [];
    for (const table of allTablesResult.results) {
      const tableName = table.name;
      
      try {
        // テーブル構造を取得
        const schemaResult = await env.DB.prepare(`PRAGMA table_info(${tableName})`).all();
        
        // 行数を取得
        const countResult = await env.DB.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).first();
        
        // 最初の数行のサンプルデータを取得
        const sampleResult = await env.DB.prepare(`SELECT * FROM ${tableName} LIMIT 3`).all();
        
        detailedStats.push({
          name: tableName,
          type: table.type,
          rowCount: countResult ? countResult.count : 0,
          columns: schemaResult.results || [],
          sampleData: sampleResult.results || []
        });
        
        console.log(`テーブル ${tableName}:`, {
          rowCount: countResult ? countResult.count : 0,
          columnCount: (schemaResult.results || []).length
        });
        
      } catch (error) {
        detailedStats.push({
          name: tableName,
          type: table.type,
          rowCount: 0,
          error: error.message,
          columns: [],
          sampleData: []
        });
        
        console.error(`テーブル ${tableName} の処理でエラー:`, error);
      }
    }

    // 3. user_profilesテーブルの詳細分析
    let userProfilesAnalysis = null;
    if (detailedStats.some(t => t.name === 'user_profiles')) {
      try {
        const userProfilesTable = detailedStats.find(t => t.name === 'user_profiles');
        
        // 詳細な統計情報を取得
        const detailedUserStats = await env.DB.prepare(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN is_verified = 1 THEN 1 END) as verified,
            COUNT(CASE WHEN is_active = 1 THEN 1 END) as active,
            COUNT(CASE WHEN magic_link_used = 1 THEN 1 END) as magic_link_used,
            COUNT(CASE WHEN created_at IS NOT NULL THEN 1 END) as has_created_at
          FROM user_profiles
        `).first();

        userProfilesAnalysis = {
          ...detailedUserStats,
          tableExists: true,
          actualRowCount: userProfilesTable.rowCount,
          columnCount: userProfilesTable.columns.length
        };
        
        console.log('user_profiles詳細分析:', userProfilesAnalysis);
        
      } catch (error) {
        userProfilesAnalysis = {
          error: error.message,
          tableExists: false
        };
      }
    } else {
      userProfilesAnalysis = {
        tableExists: false,
        error: 'user_profilesテーブルが見つかりません'
      };
    }

    // 4. 総計計算
    const totalTables = allTablesResult.results.length;
    const totalRows = detailedStats.reduce((sum, table) => sum + table.rowCount, 0);
    const userTables = detailedStats.filter(t => t.name.includes('user') || t.name.includes('profile'));
    const systemTables = detailedStats.filter(t => t.name.startsWith('sqlite_') || t.name.startsWith('_cf_'));

    const summary = {
      totalTables: totalTables,
      totalRows: totalRows,
      userTables: userTables.length,
      systemTables: systemTables.length,
      breakdown: {
        userTables: userTables.map(t => ({ name: t.name, rows: t.rowCount })),
        systemTables: systemTables.map(t => ({ name: t.name, rows: t.rowCount }))
      }
    };

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      summary: summary,
      detailedStats: detailedStats,
      userProfilesAnalysis: userProfilesAnalysis,
      environment: {
        ENVIRONMENT: env.ENVIRONMENT || 'unknown',
        DB_BOUND: !!env.DB
      }
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== データベース状況デバッグエラー ===');
    console.error('エラー詳細:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'データベース状況のデバッグに失敗しました',
      details: error.message,
      stack: error.stack
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
