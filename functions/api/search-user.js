import { getCorsHeaders, createErrorResponse, createSuccessResponse } from '../utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // JSON パース
    let payload;
    try {
      payload = await request.json();
    } catch (jsonError) {
      console.error("JSON parse error:", jsonError);
      return createErrorResponse("Invalid JSON body", 400, corsHeaders);
    }

    const { email, nickname, birthdate, searchType } = payload;
    
    console.log("Search request:", { email, nickname, birthdate, searchType });
    console.log("D1 database binding check:", !!env.DB);
    
    if (!email && !nickname && !birthdate) {
      return createErrorResponse("検索条件を少なくとも1つ入力してください", 400, corsHeaders);
    }

    // D1データベースの存在確認
    if (!env.DB) {
      console.error("D1 database not bound");
      return createErrorResponse("データベースが利用できません", 500, corsHeaders);
    }

    let users;
    let query;
    let bindParams = [];

    // 検索タイプに応じてクエリを構築
    if (searchType === "email" && email) {
      query = "SELECT * FROM users WHERE email = ?";
      bindParams = [email];
    } else if (searchType === "nickname" && nickname) {
      query = "SELECT * FROM users WHERE nickname LIKE ?";
      bindParams = [`%${nickname}%`];
    } else if (searchType === "birthdate" && birthdate) {
      query = "SELECT * FROM users WHERE birthdate = ?";
      bindParams = [birthdate];
    } else {
      // 複数条件検索
      let conditions = [];
      if (email) {
        conditions.push("email = ?");
        bindParams.push(email);
      }
      if (nickname) {
        conditions.push("nickname LIKE ?");
        bindParams.push(`%${nickname}%`);
      }
      if (birthdate) {
        conditions.push("birthdate = ?");
        bindParams.push(birthdate);
      }
      query = `SELECT * FROM users WHERE ${conditions.join(" AND ")}`;
    }

    console.log("Executing query:", query, "with params:", bindParams);

    try {
      users = await env.DB.prepare(query).bind(...bindParams).all();
      console.log("Query result:", users);
    } catch (dbError) {
      console.error("Database query error:", dbError);
      return createErrorResponse(`データベースクエリエラー: ${dbError.message}`, 500, corsHeaders);
    }

    if (!users.results || users.results.length === 0) {
      return createErrorResponse("検索されたユーザーは登録されていません", 404, corsHeaders);
    }

    // ユーザーデータを整形
    const formattedUsers = users.results.map(user => ({
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      birthdate: user.birthdate,
      guardian_id: user.guardian_id,
      theme: user.theme,
      created_at: user.created_at
    }));

    console.log("Formatted users:", formattedUsers);

    return createSuccessResponse({
      success: true,
      users: formattedUsers,
      count: formattedUsers.length
    }, corsHeaders);

  } catch (error) {
    console.error("User search error:", error);
    return createErrorResponse(`ユーザー検索中にエラーが発生しました: ${error.message}`, 500, corsHeaders);
  }
}
