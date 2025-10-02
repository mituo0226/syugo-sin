import { getCorsHeaders, createErrorResponse, createSuccessResponse } from '../utils.js';

// 関連データを段階的に削除する関数
async function deleteRelatedData(user, db) {
  console.log("Starting to delete related data for user:", user);
  
  try {
    // すべてのテーブル一覧を取得
    const tables = await db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();
    
    console.log("Found tables:", tables.results?.map(t => t.name));
    
    // 各テーブルで関連データを削除
    for (const table of tables.results || []) {
      const tableName = table.name;
      
      // usersテーブル自体は最後に削除するのでスキップ
      if (tableName === 'users') {
        continue;
      }
      
      try {
        // テーブル構造を取得
        const schema = await db.prepare(`PRAGMA table_info(${tableName})`).all();
        const columns = schema.results || [];
        
        // ユーザーに関連する可能性のあるカラムを特定
        const userRelatedColumns = columns.filter(col => 
          col.name.toLowerCase().includes('user') || 
          col.name.toLowerCase().includes('email') ||
          (col.name.toLowerCase() === 'id' && columns.some(c => c.name.toLowerCase().includes('user')))
        );
        
        console.log(`Checking table ${tableName} for user-related columns:`, 
          userRelatedColumns.map(c => c.name));
        
        // 各関連カラムでデータを削除
        for (const col of userRelatedColumns) {
          let deleteQuery;
          let bindValue;
          
          if (col.name.toLowerCase().includes('email')) {
            deleteQuery = `DELETE FROM ${tableName} WHERE ${col.name} = ?`;
            bindValue = user.email;
          } else if (col.name.toLowerCase().includes('user') && col.name.toLowerCase().includes('id')) {
            deleteQuery = `DELETE FROM ${tableName} WHERE ${col.name} = ?`;
            bindValue = user.id;
          }
          
          if (deleteQuery && bindValue !== undefined) {
            try {
              console.log(`Attempting to delete from ${tableName} where ${col.name} = ${bindValue}`);
              const deleteResult = await db.prepare(deleteQuery).bind(bindValue).run();
              console.log(`Deleted ${deleteResult.changes} rows from ${tableName}`);
              
              if (deleteResult.changes > 0) {
                console.log(`Successfully deleted related data from ${tableName}`);
              }
            } catch (deleteError) {
              console.error(`Error deleting from ${tableName}:`, deleteError);
              // 個別のテーブル削除エラーは続行
            }
          }
        }
        
      } catch (tableError) {
        console.error(`Error processing table ${tableName}:`, tableError);
        // 個別のテーブルエラーは続行
      }
    }
    
    console.log("Finished deleting related data");
    
  } catch (error) {
    console.error("Error in deleteRelatedData:", error);
    throw error;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // OPTIONS リクエストの処理（プリフライトリクエスト）
  if (request.method === "OPTIONS") {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders
    });
  }

  if (request.method !== "POST") {
    return createErrorResponse("Method not allowed", 405, corsHeaders);
  }

  try {
    const payload = await request.json();
    const { userId, email } = payload;
    
    console.log("Withdraw request payload:", payload);
    console.log("Database bound:", !!env.DB);
    
    // userId または email のどちらかが必要
    if (!userId && !email) {
      return createErrorResponse("userId or email is required", 400, corsHeaders);
    }

    let user;
    let deleteQuery;
    let bindParams;

    if (userId) {
      console.log("Searching user by ID:", userId);
      // ユーザーIDでユーザーを検索
      try {
        user = await env.DB.prepare(`
          SELECT * FROM users WHERE id = ?
        `).bind(userId).first();
        console.log("User found by ID:", user);
      } catch (dbError) {
        console.error("Database error when searching by ID:", dbError);
        return createErrorResponse(`データベースエラー: ${dbError.message}`, 500, corsHeaders);
      }
      
      if (!user) {
        return createErrorResponse("ユーザーが見つかりません", 404, corsHeaders);
      }

      // ユーザーを削除（退会処理）
      deleteQuery = `DELETE FROM users WHERE id = ?`;
      bindParams = [userId];
    } else {
      console.log("Searching user by email:", email);
      // メールアドレスでユーザーを検索
      try {
        user = await env.DB.prepare(`
          SELECT * FROM users WHERE email = ?
        `).bind(email).first();
        console.log("User found by email:", user);
      } catch (dbError) {
        console.error("Database error when searching by email:", dbError);
        return createErrorResponse(`データベースエラー: ${dbError.message}`, 500, corsHeaders);
      }
      
      if (!user) {
        return createErrorResponse("ユーザーが見つかりません", 404, corsHeaders);
      }

      // ユーザーを削除（退会処理）
      deleteQuery = `DELETE FROM users WHERE email = ?`;
      bindParams = [email];
    }

    console.log("Executing delete query:", deleteQuery, "with params:", bindParams);
    
    try {
      // まず関連データを段階的に削除
      await deleteRelatedData(user, env.DB);
      
      // 最後にユーザーを削除
      const result = await env.DB.prepare(deleteQuery).bind(...bindParams).run();
      console.log("Delete result:", result);
      
      if (result.changes === 0) {
        return createErrorResponse("退会処理に失敗しました", 500, corsHeaders);
      }
    } catch (deleteError) {
      console.error("Database delete error:", deleteError);
      return createErrorResponse(`削除処理エラー: ${deleteError.message}`, 500, corsHeaders);
    }

    return createSuccessResponse({ 
      success: true,
      message: "退会処理が完了しました",
      email: user.email,
      deleted_user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email
      }
    }, corsHeaders);

  } catch (error) {
    console.error("Withdrawal error:", error);
    return createErrorResponse("退会処理中にエラーが発生しました", 500, corsHeaders);
  }
}
