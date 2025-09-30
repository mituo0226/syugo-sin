// GET 専用エンドポイント
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(
      JSON.stringify({ status: "error", message: "token is required" }),
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
    // トークンの検証
    const magicLinkData = await env.DB.prepare(`
      SELECT * FROM magic_links 
      WHERE token = ? AND used = FALSE AND expires_at > datetime('now')
    `).bind(token).first();

    if (!magicLinkData) {
      return new Response(
        JSON.stringify({ 
          status: "error", 
          message: "Invalid or expired token" 
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 既存ユーザーの確認
    const existingUser = await env.DB.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(magicLinkData.email).first();

    if (existingUser) {
      // 既に登録済みの場合はトークンを無効化
      await env.DB.prepare(`
        UPDATE magic_links SET used = TRUE WHERE token = ?
      `).bind(token).run();

      return new Response(
        JSON.stringify({
          status: "ok",
          message: "User already registered",
          email: magicLinkData.email,
          nickname: magicLinkData.nickname
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ユーザー登録処理（ローカルストレージ情報も含めて）
    try {
      // usersテーブルに基本情報を登録
      const userResult = await env.DB.prepare(`
        INSERT INTO users (email, nickname)
        VALUES (?, ?)
      `).bind(
        magicLinkData.email,
        magicLinkData.nickname
      ).run();
      
      const userId = userResult.meta.last_row_id;
      
      // user_profilesテーブルに詳細情報を保存（存在する場合）
      try {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS user_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            birth_year TEXT,
            birth_month TEXT,
            birth_day TEXT,
            guardian_key TEXT,
            guardian_name TEXT,
            worry_type TEXT,
            registration_info TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `).run();
        
        // マジックリンクデータから追加情報を抽出
        const additionalInfo = {
          birthYear: magicLinkData.birth_year || null,
          birthMonth: magicLinkData.birth_month || null,
          birthDay: magicLinkData.birth_day || null,
          guardianKey: magicLinkData.guardian_key || null,
          guardianName: magicLinkData.guardian_name || null,
          worryType: magicLinkData.worry_type || null,
          registrationInfo: magicLinkData.registration_info || null
        };
        
        await env.DB.prepare(`
          INSERT INTO user_profiles (
            user_id, birth_year, birth_month, birth_day, 
            guardian_key, guardian_name, worry_type, registration_info
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          userId,
          additionalInfo.birthYear,
          additionalInfo.birthMonth,
          additionalInfo.birthDay,
          additionalInfo.guardianKey,
          additionalInfo.guardianName,
          additionalInfo.worryType,
          JSON.stringify(additionalInfo.registrationInfo)
        ).run();
        
        console.log("User profile created successfully for user ID:", userId);
        
      } catch (profileError) {
        console.error("Error creating user profile:", profileError);
        // プロフィール作成に失敗してもユーザー登録は続行
      }

      // トークンを無効化
      await env.DB.prepare(`
        UPDATE magic_links SET used = TRUE WHERE token = ?
      `).bind(token).run();

      console.log("User registered successfully:", { 
        email: magicLinkData.email, 
        nickname: magicLinkData.nickname 
      });

      return new Response(
        JSON.stringify({
          status: "ok",
          message: "User registered successfully",
          userId: userId,
          email: magicLinkData.email,
          nickname: magicLinkData.nickname,
          additionalInfo: additionalInfo
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    } catch (dbError) {
      console.error("Database error during user registration:", dbError);
      return new Response(
        JSON.stringify({ 
          status: "error", 
          message: `Database error: ${dbError.message}` 
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Token verification error:", error);
    return new Response(
      JSON.stringify({ 
        status: "error", 
        message: "Internal server error" 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}