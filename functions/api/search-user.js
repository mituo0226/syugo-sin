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
      console.log("Request headers:", Object.fromEntries(request.headers.entries()));
      
      if (!requestText || requestText.trim() === '') {
        console.error("Empty request body");
        return createErrorResponse("Empty request body", 400, corsHeaders);
      }
      
      payload = JSON.parse(requestText);
      console.log("Search user request payload:", payload);
    } catch (jsonError) {
      console.error("JSON parse error:", jsonError);
      console.error("Request text that failed to parse:", requestText);
      return createErrorResponse(`Invalid JSON body: ${jsonError.message}`, 400, corsHeaders);
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

    // 守護神のキーから名前への変換関数
    function getGuardianName(guardianKey) {
      const guardianMap = {
        'senju': '千手観音',
        'yakushi': '薬師如来',
        'amida': '阿弥陀如来',
        'kokuzo': '虚空蔵菩薩',
        'monju': '文殊菩薩',
        'fugen': '普賢菩薩',
        'seishi': '勢至菩薩',
        'dainichi': '大日如来',
        'fudo': '不動明王'
      };
      return guardianMap[guardianKey] || '守護神';
    }

    // ユーザーデータを整形（守護神情報を含む）
    const formattedUsers = await Promise.all(users.results.map(async (user) => {
      let guardianName = '未設定';
      let guardianKey = null;
      let birthdate = user.birthdate;
      let worryType = user.theme;
      
      // user_profilesテーブルから詳細情報を取得
      try {
        const userProfile = await env.DB.prepare(`
          SELECT * FROM user_profiles WHERE user_id = ?
        `).bind(user.id).first();
        
        if (userProfile) {
          console.log(`User profile found for user ${user.id}:`, userProfile);
          
          // 守護神情報を取得
          guardianKey = userProfile.guardian_key;
          guardianName = userProfile.guardian_name || '未設定';
          
          // 生年月日を組み立て
          if (userProfile.birth_year && userProfile.birth_month && userProfile.birth_day) {
            birthdate = `${userProfile.birth_year}/${userProfile.birth_month}/${userProfile.birth_day}`;
          }
          
          // 悩みの相談内容を取得
          worryType = userProfile.worry_type || user.theme;
          
          // guardian_keyがオブジェクト形式の場合の処理
          if (typeof guardianKey === 'object' && guardianKey !== null) {
            console.log("guardian_keyがオブジェクト形式です:", guardianKey);
            guardianKey = guardianKey.name || guardianKey.key || guardianKey.guardian_key || null;
            console.log("変換後のguardian_key:", guardianKey);
          }
          
          // guardian_nameが無い場合は、guardian_keyから変換
          if (!guardianName || guardianName === '未設定') {
            if (guardianKey && typeof guardianKey === 'string') {
              guardianName = getGuardianName(guardianKey);
            }
          }
        } else {
          console.log(`No user profile found for user ${user.id}`);
          // user_profilesテーブルにデータがない場合は、usersテーブルのguardian_idを使用
          guardianKey = user.guardian_id;
          if (guardianKey && typeof guardianKey === 'string') {
            guardianName = getGuardianName(guardianKey);
          }
        }
      } catch (profileError) {
        console.error(`Error fetching user profile for user ${user.id}:`, profileError);
        // エラーの場合は、usersテーブルのguardian_idを使用
        guardianKey = user.guardian_id;
        if (guardianKey && typeof guardianKey === 'string') {
          guardianName = getGuardianName(guardianKey);
        }
      }
      
      return {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        birthdate: birthdate,
        guardian_id: user.guardian_id,
        guardian_key: guardianKey,
        guardian_name: guardianName,
        theme: worryType,
        created_at: user.created_at
      };
    }));

    console.log("Formatted users:", formattedUsers);

    // 成功レスポンスを確実に返す
    try {
      // データを安全にシリアライズ
      const safeData = {
        success: true,
        users: formattedUsers,
        count: formattedUsers.length
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
    console.error("User search error:", error);
    console.error("Error stack:", error.stack);
    
    // エラーレスポンスを確実に返す
    try {
      return createErrorResponse(`ユーザー検索中にエラーが発生しました: ${error.message}`, 500, corsHeaders);
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
