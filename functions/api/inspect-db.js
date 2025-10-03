import { getCorsHeaders, createErrorResponse, createSuccessResponse } from '../utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  console.log("Database inspection started");

  try {
    // データベースの接続確認
    if (!env.DB) {
      console.error("Database not bound");
      return new Response(JSON.stringify({ 
        error: "データベースがバインドされていません" 
      }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        }
      });
    }

    console.log("Database is bound, starting inspection");

    const inspectionResults = {};

    // 1. すべてのテーブル一覧を取得
    let tables;
    try {
      console.log("Fetching table list...");
      tables = await env.DB.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all();
      inspectionResults.tables = tables.results || [];
      console.log("Tables found:", inspectionResults.tables);
    } catch (error) {
      console.error("Table listing error:", error);
      inspectionResults.tables = [];
      // エラーが発生した場合は、基本的なテーブル情報のみを返す
      return new Response(JSON.stringify({
        success: false,
        error: "テーブル一覧の取得に失敗しました",
        message: error.message,
        tables: [],
        tableSchemas: {},
        referencesToUsers: [],
        userRelatedData: {},
        foreignKeysEnabled: null
      }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        }
      });
    }

    // 2. 各テーブルの構造を詳細に調査（簡略化）
    inspectionResults.tableSchemas = {};
    console.log("Starting table inspection...");
    
    // テーブル数が多すぎる場合は制限
    const maxTables = 10;
    const tablesToInspect = inspectionResults.tables.slice(0, maxTables);
    
    for (const table of tablesToInspect) {
      try {
        console.log(`Inspecting table: ${table.name}`);
        
        // 基本的な情報のみを取得
        const countResult = await env.DB.prepare(`
          SELECT COUNT(*) as count FROM ${table.name}
        `).first();
        
        inspectionResults.tableSchemas[table.name] = {
          recordCount: countResult?.count || 0,
          inspected: true
        };
        
        console.log(`Table ${table.name} inspected successfully`);
        
      } catch (error) {
        console.error(`Error inspecting table ${table.name}:`, error);
        inspectionResults.tableSchemas[table.name] = {
          error: error.message,
          inspected: false
        };
      }
    }
    
    // 残りのテーブルはスキップ
    if (inspectionResults.tables.length > maxTables) {
      console.log(`Skipped ${inspectionResults.tables.length - maxTables} tables due to limit`);
    }

    // 3. 簡略化された調査
    inspectionResults.referencesToUsers = [];
    inspectionResults.userRelatedData = {};
    inspectionResults.foreignKeysEnabled = null;
    
    console.log("Skipping detailed inspection to avoid timeout");

    // 成功レスポンスを確実に返す
    try {
      console.log("Creating response with data:", {
        tables: inspectionResults.tables?.length || 0,
        tableSchemas: Object.keys(inspectionResults.tableSchemas || {}).length,
        referencesToUsers: inspectionResults.referencesToUsers?.length || 0,
        userRelatedData: Object.keys(inspectionResults.userRelatedData || {}).length
      });
      
      // データを安全にシリアライズ
      const safeData = {
        success: true,
        timestamp: new Date().toISOString(),
        tables: inspectionResults.tables || [],
        tableSchemas: inspectionResults.tableSchemas || {},
        referencesToUsers: inspectionResults.referencesToUsers || [],
        userRelatedData: inspectionResults.userRelatedData || {},
        foreignKeysEnabled: inspectionResults.foreignKeysEnabled
      };
      
      const jsonString = JSON.stringify(safeData);
      console.log("JSON string length:", jsonString.length);
      
      return new Response(jsonString, {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        }
      });
    } catch (responseError) {
      console.error("Failed to create success response:", responseError);
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to serialize response data",
        message: responseError.message
      }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        }
      });
    }

  } catch (error) {
    console.error("Database inspection error:", error);
    console.error("Error stack:", error.stack);
    
    // エラーレスポンスを確実に返す
    try {
      return createErrorResponse(`データベース調査中にエラーが発生しました: ${error.message}`, 500, corsHeaders);
    } catch (responseError) {
      console.error("Failed to create error response:", responseError);
      return new Response(JSON.stringify({ 
        error: "Internal server error",
        message: error.message 
      }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        }
      });
    }
  }
}
