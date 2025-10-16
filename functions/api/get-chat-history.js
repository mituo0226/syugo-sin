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
      console.log("Get chat history request payload:", payload);
    } catch (jsonError) {
      console.error("JSON parse error:", jsonError);
      return createErrorResponse(`Invalid JSON body: ${jsonError.message}`, 400, corsHeaders);
    }

    const { userId } = payload;
    
    console.log("Chat history request for userId:", userId);
    console.log("D1 database binding check:", !!env.DB);
    
    if (!userId) {
      return createErrorResponse("ユーザーIDが必要です", 400, corsHeaders);
    }

    // D1データベースの存在確認
    if (!env.DB) {
      console.error("D1 database not bound");
      return createErrorResponse("データベースが利用できません", 500, corsHeaders);
    }

    let messages;
    let query;
    let bindParams = [];

    try {
      // 会話履歴を取得（chat_messagesテーブルから）
      query = `
        SELECT 
          id,
          user_id,
          sender,
          content,
          timestamp,
          created_at
        FROM chat_messages 
        WHERE user_id = ? 
        ORDER BY timestamp ASC
      `;
      bindParams = [userId];

      console.log("Executing query:", query, "with params:", bindParams);
      messages = await env.DB.prepare(query).bind(...bindParams).all();
      console.log("Query result:", messages);

    } catch (dbError) {
      console.error("Database query error:", dbError);
      return createErrorResponse(`データベースクエリエラー: ${dbError.message}`, 500, corsHeaders);
    }

    // メッセージデータを整形
    const formattedMessages = messages.results.map((message) => {
      return {
        id: message.id,
        userId: message.user_id,
        sender: message.sender, // 'user' or 'assistant'
        content: message.content,
        timestamp: message.timestamp,
        createdAt: message.created_at
      };
    });

    console.log("Formatted messages:", formattedMessages);

    // 成功レスポンスを返す
    try {
      const safeData = {
        success: true,
        messages: formattedMessages,
        count: formattedMessages.length,
        userId: userId
      };
      
      return new Response(JSON.stringify(safeData), {
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
    console.error("Get chat history error:", error);
    console.error("Error stack:", error.stack);
    
    // エラーレスポンスを確実に返す
    try {
      return createErrorResponse(`会話履歴取得中にエラーが発生しました: ${error.message}`, 500, corsHeaders);
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


