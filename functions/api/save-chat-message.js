import { getCorsHeaders, createErrorResponse, createSuccessResponse } from '../utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // JSON パース
    let payload;
    try {
      const requestText = await request.text();
      console.log("Raw request body:", requestText);
      
      if (!requestText || requestText.trim() === '') {
        console.error("Empty request body");
        return createErrorResponse("Empty request body", 400, corsHeaders);
      }
      
      payload = JSON.parse(requestText);
      console.log("Save chat message request payload:", payload);
    } catch (jsonError) {
      console.error("JSON parse error:", jsonError);
      return createErrorResponse(`Invalid JSON body: ${jsonError.message}`, 400, corsHeaders);
    }

    const { userId, sender, content } = payload;
    
    console.log("Save chat message request:", { userId, sender, content });
    console.log("D1 database binding check:", !!env.DB);
    
    if (!userId || !sender || !content) {
      return createErrorResponse("ユーザーID、送信者、内容が必要です", 400, corsHeaders);
    }

    // D1データベースの存在確認
    if (!env.DB) {
      console.error("D1 database not bound");
      return createErrorResponse("データベースが利用できません", 500, corsHeaders);
    }

    try {
      // 会話履歴を保存
      const insertQuery = `
        INSERT INTO chat_messages (user_id, sender, content, timestamp)
        VALUES (?, ?, ?, ?)
      `;
      
      const timestamp = new Date().toISOString();
      const bindParams = [userId, sender, content, timestamp];

      console.log("Executing insert query:", insertQuery, "with params:", bindParams);
      const result = await env.DB.prepare(insertQuery).bind(...bindParams).run();
      console.log("Insert result:", result);

      // ユーザーの最終アクセス日時を更新
      const updateQuery = `
        UPDATE user_profiles 
        SET last_access = ? 
        WHERE user_id = ?
      `;
      
      await env.DB.prepare(updateQuery).bind(timestamp, userId).run();
      console.log("Updated last_access for user:", userId);

      return createSuccessResponse({
        success: true,
        messageId: result.meta.last_row_id,
        timestamp: timestamp
      }, corsHeaders);

    } catch (dbError) {
      console.error("Database query error:", dbError);
      return createErrorResponse(`データベースクエリエラー: ${dbError.message}`, 500, corsHeaders);
    }

  } catch (error) {
    console.error("Save chat message error:", error);
    console.error("Error stack:", error.stack);
    
    return createErrorResponse(`会話履歴保存中にエラーが発生しました: ${error.message}`, 500, corsHeaders);
  }
}




