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
      console.log("Database viewer request body:", requestText);
      
      if (!requestText || requestText.trim() === '') {
        return createErrorResponse("Empty request body", 400, corsHeaders);
      }
      
      payload = JSON.parse(requestText);
      console.log("Database viewer payload:", payload);
    } catch (jsonError) {
      console.error("JSON parse error:", jsonError);
      return createErrorResponse(`Invalid JSON body: ${jsonError.message}`, 400, corsHeaders);
    }

    const { email } = payload;
    
    console.log("Database viewer search for email:", email);
    console.log("D1 database binding check:", !!env.DB);
    
    if (!email) {
      return createErrorResponse("メールアドレスを入力してください", 400, corsHeaders);
    }

    // D1データベースの存在確認
    if (!env.DB) {
      console.error("D1 database not bound");
      return createErrorResponse("データベースが利用できません", 500, corsHeaders);
    }

    try {
      // ユーザー基本情報を取得
      const usersResult = await env.DB.prepare(`
        SELECT * FROM users WHERE email = ?
      `).bind(email).all();
      
      console.log("Users query result:", usersResult);

      if (!usersResult.success || usersResult.results.length === 0) {
        return createSuccessResponse({
          success: true,
          message: "ユーザーが見つかりません",
          user: null,
          userProfile: null,
          magicLinks: []
        }, corsHeaders);
      }

      const user = usersResult.results[0];
      console.log("Found user:", user);

      // ユーザープロフィール情報を取得
      let userProfile = null;
      try {
        const profileResult = await env.DB.prepare(`
          SELECT * FROM user_profiles WHERE user_id = ?
        `).bind(user.id).all();
        
        if (profileResult.success && profileResult.results.length > 0) {
          userProfile = profileResult.results[0];
          console.log("Found user profile:", userProfile);
        }
      } catch (profileError) {
        console.error("Error fetching user profile:", profileError);
      }

      // マジックリンク情報を取得
      let magicLinks = [];
      try {
        const magicLinksResult = await env.DB.prepare(`
          SELECT * FROM magic_links WHERE email = ? ORDER BY created_at DESC
        `).bind(email).all();
        
        if (magicLinksResult.success) {
          magicLinks = magicLinksResult.results;
          console.log("Found magic links:", magicLinks.length);
        }
      } catch (magicLinksError) {
        console.error("Error fetching magic links:", magicLinksError);
      }

      // 購入履歴を取得
      let purchases = [];
      try {
        const purchasesResult = await env.DB.prepare(`
          SELECT * FROM purchases WHERE user_id = ? ORDER BY created_at DESC
        `).bind(user.id).all();
        
        if (purchasesResult.success) {
          purchases = purchasesResult.results;
          console.log("Found purchases:", purchases.length);
        }
      } catch (purchasesError) {
        console.error("Error fetching purchases:", purchasesError);
      }

      // 守護神名変換関数
      function getGuardianName(guardianKey) {
        const guardianMap = {
          'amida': '阿弥陀如来',
          'senju': '千手観音',
          'monju': '文殊菩薩',
          'fugen': '普賢菩薩',
          'jizo': '地蔵菩薩',
          'kannon': '観音菩薩',
          'kokuzo': '虚空蔵菩薩',
          'seishi': '勢至菩薩',
          'dainichi': '大日如来',
          'fudo': '不動明王'
        };
        return guardianMap[guardianKey] || guardianKey;
      }

      // データを整形
      const formattedData = {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          birthdate: user.birthdate,
          guardian_id: user.guardian_id,
          guardian_name: getGuardianName(user.guardian_id),
          theme: user.theme,
          created_at: user.created_at
        },
        userProfile: userProfile ? {
          id: userProfile.id,
          user_id: userProfile.user_id,
          birth_year: userProfile.birth_year,
          birth_month: userProfile.birth_month,
          birth_day: userProfile.birth_day,
          guardian_key: userProfile.guardian_key,
          guardian_name: userProfile.guardian_name || getGuardianName(userProfile.guardian_key),
          worry_type: userProfile.worry_type,
          registration_info: userProfile.registration_info,
          created_at: userProfile.created_at
        } : null,
        magicLinks: magicLinks.map(link => ({
          id: link.id,
          email: link.email,
          token: link.token,
          nickname: link.nickname,
          birth_year: link.birth_year,
          birth_month: link.birth_month,
          birth_day: link.birth_day,
          guardian_key: link.guardian_key,
          guardian_name: link.guardian_name || getGuardianName(link.guardian_key),
          worry_type: link.worry_type,
          registration_info: link.registration_info,
          used: link.used,
          created_at: link.created_at,
          expires_at: link.expires_at
        })),
        purchases: purchases.map(purchase => ({
          id: purchase.id,
          user_id: purchase.user_id,
          product_name: purchase.product_name,
          amount: purchase.amount,
          status: purchase.status,
          created_at: purchase.created_at
        }))
      };

      console.log("Formatted data:", formattedData);

      return createSuccessResponse(formattedData, corsHeaders);

    } catch (dbError) {
      console.error("Database error:", dbError);
      return createErrorResponse(`データベースエラー: ${dbError.message}`, 500, corsHeaders);
    }

  } catch (error) {
    console.error("API Error:", error);
    return createErrorResponse(`Internal Server Error: ${error.message}`, 500, corsHeaders);
  }
}
