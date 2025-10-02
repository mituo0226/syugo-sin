import { getCorsHeaders, createErrorResponse, createSuccessResponse } from '../utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // データベースの接続確認
    if (!env.DB) {
      return createErrorResponse("データベースがバインドされていません", 500, corsHeaders);
    }

    const inspectionResults = {};

    // 1. すべてのテーブル一覧を取得
    let tables;
    try {
      tables = await env.DB.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all();
      inspectionResults.tables = tables.results || [];
    } catch (error) {
      console.error("Table listing error:", error);
      inspectionResults.tables = [];
    }

    // 2. 各テーブルの構造を詳細に調査
    inspectionResults.tableSchemas = {};
    for (const table of inspectionResults.tables) {
      try {
        // テーブル構造
        const schema = await env.DB.prepare(`
          PRAGMA table_info(${table.name})
        `).all();
        
        // インデックス情報
        const indexes = await env.DB.prepare(`
          PRAGMA index_list(${table.name})
        `).all();
        
        // 外部キー情報
        const foreignKeys = await env.DB.prepare(`
          PRAGMA foreign_key_list(${table.name})
        `).all();
        
        // レコード数
        const countResult = await env.DB.prepare(`
          SELECT COUNT(*) as count FROM ${table.name}
        `).first();
        
        inspectionResults.tableSchemas[table.name] = {
          columns: schema.results || [],
          indexes: indexes.results || [],
          foreignKeys: foreignKeys.results || [],
          recordCount: countResult?.count || 0
        };
        
      } catch (error) {
        console.error(`Error inspecting table ${table.name}:`, error);
        inspectionResults.tableSchemas[table.name] = {
          error: error.message
        };
      }
    }

    // 3. usersテーブルを参照している可能性のあるテーブルを特定
    inspectionResults.referencesToUsers = [];
    for (const tableName in inspectionResults.tableSchemas) {
      const schema = inspectionResults.tableSchemas[tableName];
      if (schema.foreignKeys) {
        for (const fk of schema.foreignKeys) {
          if (fk.table === 'users') {
            inspectionResults.referencesToUsers.push({
              referencingTable: tableName,
              referencingColumn: fk.from,
              referencedColumn: fk.to,
              foreignKey: fk
            });
          }
        }
      }
    }

    // 4. 特定のユーザー（mituo0226@gmail.com）に関連するデータを調査
    inspectionResults.userRelatedData = {};
    try {
      const testUser = await env.DB.prepare(`
        SELECT * FROM users WHERE email = ?
      `).bind('mituo0226@gmail.com').first();
      
      if (testUser) {
        inspectionResults.userRelatedData.user = testUser;
        
        // 各テーブルでこのユーザーに関連するデータを検索
        for (const tableName in inspectionResults.tableSchemas) {
          const schema = inspectionResults.tableSchemas[tableName];
          if (schema.columns) {
            // user_id, email, id などのカラムがあるかチェック
            const userRelatedColumns = schema.columns.filter(col => 
              col.name.toLowerCase().includes('user') || 
              col.name.toLowerCase().includes('email') ||
              col.name.toLowerCase().includes('id')
            );
            
            if (userRelatedColumns.length > 0) {
              try {
                // 各関連カラムでデータを検索
                for (const col of userRelatedColumns) {
                  let query;
                  let bindValue;
                  
                  if (col.name.toLowerCase().includes('email')) {
                    query = `SELECT * FROM ${tableName} WHERE ${col.name} = ?`;
                    bindValue = testUser.email;
                  } else if (col.name.toLowerCase().includes('user') && col.name.toLowerCase().includes('id')) {
                    query = `SELECT * FROM ${tableName} WHERE ${col.name} = ?`;
                    bindValue = testUser.id;
                  } else if (col.name.toLowerCase() === 'id') {
                    query = `SELECT * FROM ${tableName} WHERE ${col.name} = ?`;
                    bindValue = testUser.id;
                  }
                  
                  if (query && bindValue !== undefined) {
                    const relatedData = await env.DB.prepare(query).bind(bindValue).all();
                    if (relatedData.results && relatedData.results.length > 0) {
                      if (!inspectionResults.userRelatedData[tableName]) {
                        inspectionResults.userRelatedData[tableName] = [];
                      }
                      inspectionResults.userRelatedData[tableName].push({
                        column: col.name,
                        data: relatedData.results
                      });
                    }
                  }
                }
              } catch (searchError) {
                console.error(`Error searching related data in ${tableName}:`, searchError);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error finding test user:", error);
    }

    // 5. 外部キー制約の状態
    try {
      const fkStatus = await env.DB.prepare(`PRAGMA foreign_keys`).first();
      inspectionResults.foreignKeysEnabled = fkStatus?.foreign_keys || false;
    } catch (error) {
      inspectionResults.foreignKeysEnabled = null;
    }

    return createSuccessResponse({
      success: true,
      timestamp: new Date().toISOString(),
      ...inspectionResults
    }, corsHeaders);

  } catch (error) {
    console.error("Database inspection error:", error);
    return createErrorResponse(`データベース調査中にエラーが発生しました: ${error.message}`, 500, corsHeaders);
  }
}
