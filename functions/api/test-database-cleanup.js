/**
 * データベース整理ページ用のテストAPI
 * ページが正常に動作するかテストするためのAPI
 */

export async function onRequestGet(context) {
  const { env } = context;

  try {
    console.log('=== データベース整理ページテストAPI開始 ===');

    if (!env.DB) {
      return new Response(JSON.stringify({
        success: false,
        error: 'データベース接続が見つかりません',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 基本的なデータベース情報を取得
    const dbInfo = {
      binding: 'DB',
      databaseName: 'syugo-sin-db',
      databaseId: '0eee225f-f4a4-41ea-a64b-1ae31cb92138',
      environment: env.ENVIRONMENT || 'unknown'
    };

    // テーブル一覧を取得
    let tables = [];
    let tableStats = [];
    
    try {
      const tablesResult = await env.DB.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
      `).all();
      
      tables = tablesResult.results.map(row => row.name);
      console.log('テーブル一覧:', tables);

      // 各テーブルの行数を取得
      for (const tableName of tables) {
        try {
          const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM ${tableName}
          `).first();
          
          tableStats.push({
            name: tableName,
            rowCount: countResult ? countResult.count : 0
          });
          
          console.log(`テーブル ${tableName}: ${countResult ? countResult.count : 0} 行`);
        } catch (error) {
          tableStats.push({
            name: tableName,
            rowCount: 0,
            error: error.message
          });
          console.error(`テーブル ${tableName} の行数取得エラー:`, error);
        }
      }
    } catch (error) {
      console.error('テーブル一覧取得エラー:', error);
    }

    // user_profilesテーブルの詳細情報
    let userProfilesInfo = null;
    if (tables.includes('user_profiles')) {
      try {
        const userProfilesResult = await env.DB.prepare(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN is_verified = 1 THEN 1 END) as verified,
            COUNT(CASE WHEN is_active = 1 THEN 1 END) as active
          FROM user_profiles
        `).first();

        userProfilesInfo = {
          totalUsers: userProfilesResult.total || 0,
          verifiedUsers: userProfilesResult.verified || 0,
          activeUsers: userProfilesResult.active || 0
        };
        
        console.log('user_profiles情報:', userProfilesInfo);
      } catch (error) {
        userProfilesInfo = { 
          error: error.message,
          totalUsers: 0,
          verifiedUsers: 0,
          activeUsers: 0
        };
        console.error('user_profiles情報取得エラー:', error);
      }
    } else {
      userProfilesInfo = {
        error: 'user_profilesテーブルが見つかりません',
        totalUsers: 0,
        verifiedUsers: 0,
        activeUsers: 0
      };
    }

    const summary = {
      totalTables: tables.length,
      totalRows: tableStats.reduce((sum, table) => sum + table.rowCount, 0),
      apiStatus: 'working',
      timestamp: new Date().toISOString()
    };

    const response = {
      success: true,
      database: dbInfo,
      tables: tables,
      tableStats: tableStats,
      userProfiles: userProfilesInfo,
      summary: summary,
      debug: {
        tablesFound: tables.length,
        tableStatsGenerated: tableStats.length,
        userProfilesExists: tables.includes('user_profiles'),
        environment: env.ENVIRONMENT || 'unknown'
      }
    };

    console.log('テストAPI応答準備完了:', {
      success: response.success,
      totalTables: summary.totalTables,
      totalRows: summary.totalRows,
      userProfilesExists: tables.includes('user_profiles')
    });

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('=== データベース整理ページテストAPIエラー ===');
    console.error('エラー詳細:', error);
    console.error('エラースタック:', error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'データベース整理ページテストAPIでエラーが発生しました',
      details: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
}
