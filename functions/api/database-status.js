/**
 * データベース状況確認API
 * 現在接続されているデータベースの詳細情報を取得
 */

export async function onRequestGet(context) {
  const { env } = context;

  try {
    console.log('=== データベース状況確認API開始 ===');

    if (!env.DB) {
      return new Response(JSON.stringify({
        success: false,
        error: 'データベース接続が見つかりません'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // データベース情報を取得
    const dbInfo = {
      binding: 'DB',
      databaseName: 'syugo-sin-db',
      databaseId: '0eee225f-f4a4-41ea-a64b-1ae31cb92138',
      environment: env.ENVIRONMENT || 'unknown'
    };

    // テーブル一覧を取得
    const tablesResult = await env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `).all();

    const tables = tablesResult.results.map(row => row.name);

    // 各テーブルの行数を取得
    const tableStats = [];
    for (const tableName of tables) {
      try {
        const countResult = await env.DB.prepare(`
          SELECT COUNT(*) as count FROM ${tableName}
        `).first();
        tableStats.push({
          name: tableName,
          rowCount: countResult ? countResult.count : 0
        });
      } catch (error) {
        // システムテーブルのアクセス制限エラーを特別処理
        if (error.message.includes('SQLITE_AUTH') && (tableName.startsWith('_cf_') || tableName.startsWith('sqlite_'))) {
          tableStats.push({
            name: tableName,
            rowCount: '制限',
            isSystemTable: true,
            accessRestricted: true,
            message: 'システムテーブル（アクセス制限）'
          });
          console.log(`システムテーブル ${tableName} はアクセス制限されています（正常）`);
        } else {
          tableStats.push({
            name: tableName,
            rowCount: 0,
            error: error.message
          });
        }
      }
    }

    // user_profilesテーブルの詳細情報
    let userProfilesInfo = null;
    if (tables.includes('user_profiles')) {
      try {
        const userProfilesResult = await env.DB.prepare(`
          SELECT COUNT(*) as total,
                 COUNT(CASE WHEN is_verified = 1 THEN 1 END) as verified,
                 COUNT(CASE WHEN is_active = 1 THEN 1 END) as active
          FROM user_profiles
        `).first();

        userProfilesInfo = {
          totalUsers: userProfilesResult.total || 0,
          verifiedUsers: userProfilesResult.verified || 0,
          activeUsers: userProfilesResult.active || 0
        };
      } catch (error) {
        userProfilesInfo = { error: error.message };
      }
    }

    return new Response(JSON.stringify({
      success: true,
      database: dbInfo,
      tables: tables,
      tableStats: tableStats,
      userProfiles: userProfilesInfo,
      summary: {
        totalTables: tables.length,
        totalRows: tableStats.reduce((sum, table) => sum + table.rowCount, 0)
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== データベース状況確認エラー ===');
    console.error('エラー詳細:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'データベース状況の取得に失敗しました',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
