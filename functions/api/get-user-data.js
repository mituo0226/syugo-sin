// ユーザーデータ取得API
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = url.searchParams.get("email");

  if (!email) {
    return new Response(
      JSON.stringify({ status: "error", message: "email parameter is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // D1データベースの存在確認
  if (!env.DB) {
    console.error("D1 database not bound");
    return new Response(
      JSON.stringify({ status: "error", message: "Database not available" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // ユーザー基本情報を取得
    const user = await env.DB.prepare(`
      SELECT * FROM users WHERE email = ?
    `).bind(email).first();

    if (!user) {
      return new Response(
        JSON.stringify({ status: "error", message: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // ユーザープロフィール情報を取得（存在する場合）
    let userProfile = null;
    try {
      userProfile = await env.DB.prepare(`
        SELECT * FROM user_profiles WHERE user_id = ?
      `).bind(user.id).first();
    } catch (profileError) {
      console.log("User profile table not found or error:", profileError);
      // プロフィールテーブルが存在しない場合は無視
    }

    // マジックリンクデータから最新の情報を取得（存在する場合）
    let magicLinkData = null;
    try {
      magicLinkData = await env.DB.prepare(`
        SELECT * FROM magic_links 
        WHERE email = ? AND used = TRUE 
        ORDER BY created_at DESC LIMIT 1
      `).bind(email).first();
    } catch (magicLinkError) {
      console.log("Magic links table not found or error:", magicLinkError);
      // マジックリンクテーブルが存在しない場合は無視
    }

    // データを統合
    const userData = {
      // 基本情報
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      birthdate: user.birthdate,
      guardian_id: user.guardian_id,
      theme: user.theme,
      created_at: user.created_at,
      
      // プロフィール情報（存在する場合）
      ...(userProfile && {
        birth_year: userProfile.birth_year,
        birth_month: userProfile.birth_month,
        birth_day: userProfile.birth_day,
        guardian_key: userProfile.guardian_key,
        guardian_name: userProfile.guardian_name,
        worry_type: userProfile.worry_type,
        registration_info: userProfile.registration_info
      }),
      
      // マジックリンクデータ（存在する場合）
      ...(magicLinkData && {
        magic_nickname: magicLinkData.nickname,
        magic_birth_year: magicLinkData.birth_year,
        magic_birth_month: magicLinkData.birth_month,
        magic_birth_day: magicLinkData.birth_day,
        magic_guardian_key: magicLinkData.guardian_key,
        magic_guardian_name: magicLinkData.guardian_name,
        magic_worry_type: magicLinkData.worry_type,
        magic_registration_info: magicLinkData.registration_info
      })
    };

    console.log("User data retrieved successfully:", { email, userId: user.id });

    return new Response(
      JSON.stringify({ 
        status: "success", 
        data: userData 
      }),
      { 
        status: 200, 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        } 
      }
    );

  } catch (error) {
    console.error("Error retrieving user data:", error);
    return new Response(
      JSON.stringify({ 
        status: "error", 
        message: "Internal server error" 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
