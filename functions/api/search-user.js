import { getCorsHeaders, createErrorResponse, createSuccessResponse } from '../utils.js';

export async function onRequest(context) {
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
    const { email, nickname, birthdate, searchType } = await request.json();
    
    if (!email && !nickname && !birthdate) {
      return createErrorResponse("検索条件を少なくとも1つ入力してください", 400, corsHeaders);
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

    users = await env.DB.prepare(query).bind(...bindParams).all();

    if (!users.results || users.results.length === 0) {
      return createErrorResponse("ユーザーが見つかりません", 404, corsHeaders);
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

    return createSuccessResponse({
      success: true,
      users: formattedUsers,
      count: formattedUsers.length
    }, corsHeaders);

  } catch (error) {
    console.error("User search error:", error);
    return createErrorResponse("ユーザー検索中にエラーが発生しました", 500, corsHeaders);
  }
}
