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

    // テーブル一覧を取得
    let tables;
    try {
      tables = await env.DB.prepare(`
        SELECT name FROM sqlite_master WHERE type='table'
      `).all();
      console.log("Tables found:", tables);
    } catch (error) {
      console.error("Table listing error:", error);
      return createErrorResponse(`テーブル一覧取得エラー: ${error.message}`, 500, corsHeaders);
    }

    // usersテーブルの構造を確認
    let tableInfo;
    try {
      tableInfo = await env.DB.prepare(`
        PRAGMA table_info(users)
      `).all();
      console.log("Users table info:", tableInfo);
    } catch (error) {
      console.error("Table info error:", error);
      return createErrorResponse(`テーブル構造取得エラー: ${error.message}`, 500, corsHeaders);
    }

    // usersテーブルのレコード数を確認
    let userCount;
    try {
      const countResult = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM users
      `).first();
      userCount = countResult.count;
      console.log("User count:", userCount);
    } catch (error) {
      console.error("User count error:", error);
      return createErrorResponse(`ユーザー数取得エラー: ${error.message}`, 500, corsHeaders);
    }

    // 特定のメールアドレスでユーザーを検索
    let testUser;
    try {
      testUser = await env.DB.prepare(`
        SELECT * FROM users WHERE email = ?
      `).bind('mituo0226@gmail.com').first();
      console.log("Test user found:", testUser);
    } catch (error) {
      console.error("Test user search error:", error);
      return createErrorResponse(`テストユーザー検索エラー: ${error.message}`, 500, corsHeaders);
    }

    return createSuccessResponse({
      success: true,
      database_bound: !!env.DB,
      tables: tables.results || [],
      users_table_info: tableInfo.results || [],
      user_count: userCount,
      test_user: testUser,
      debug_info: {
        timestamp: new Date().toISOString(),
        environment: context.env ? Object.keys(context.env) : []
      }
    }, corsHeaders);

  } catch (error) {
    console.error("Debug DB error:", error);
    return createErrorResponse(`デバッグ処理中にエラーが発生しました: ${error.message}`, 500, corsHeaders);
  }
}
