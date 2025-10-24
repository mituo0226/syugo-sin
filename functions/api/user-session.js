/**
 * ユーザーセッション管理API
 * 残り時間の管理をデータベースで行う
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  try {
    console.log('=== ユーザーセッション取得開始 ===');
    console.log('ユーザーID:', userId);

    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'ユーザーIDが必要です'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ユーザーセッションテーブルが存在するかチェック
    const tableExists = await env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='user_sessions'
    `).first();

    if (!tableExists) {
      // ユーザーセッションテーブルを作成
      await env.DB.prepare(`
        CREATE TABLE user_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          remaining_seconds INTEGER DEFAULT 0,
          session_end_time TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES user_profiles (user_id)
        )
      `).run();
      console.log('ユーザーセッションテーブルを作成しました');
    }

    // ユーザーのセッション情報を取得
    const session = await env.DB.prepare(`
      SELECT * FROM user_sessions 
      WHERE user_id = ? AND is_active = 1
      ORDER BY updated_at DESC
      LIMIT 1
    `).bind(userId).first();

    if (!session) {
      console.log('アクティブなセッションが見つかりません');
      return new Response(JSON.stringify({
        success: true,
        remainingSeconds: 0,
        sessionEndTime: null,
        hasActiveSession: false
      }), { 
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 現在時刻とセッション終了時刻を比較
    const currentTime = new Date().getTime();
    const sessionEndTime = new Date(session.session_end_time).getTime();
    const remainingTime = Math.max(0, Math.floor((sessionEndTime - currentTime) / 1000));

    console.log('セッション情報:', {
      userId,
      remainingSeconds: session.remaining_seconds,
      sessionEndTime: session.session_end_time,
      calculatedRemainingTime: remainingTime
    });

    return new Response(JSON.stringify({
      success: true,
      remainingSeconds: remainingTime,
      sessionEndTime: session.session_end_time,
      hasActiveSession: true,
      originalRemainingSeconds: session.remaining_seconds
    }), { 
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== ユーザーセッション取得エラー ===');
    console.error(error);
    return new Response(JSON.stringify({
      success: false,
      message: 'エラーが発生しました',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    console.log('=== ユーザーセッション更新開始 ===');

    const { userId, remainingSeconds, sessionEndTime, action } = await request.json();

    console.log('セッション更新:', {
      userId,
      remainingSeconds,
      sessionEndTime,
      action
    });

    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'ユーザーIDが必要です'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ユーザーセッションテーブルが存在するかチェック
    const tableExists = await env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='user_sessions'
    `).first();

    if (!tableExists) {
      // ユーザーセッションテーブルを作成
      await env.DB.prepare(`
        CREATE TABLE user_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          remaining_seconds INTEGER DEFAULT 0,
          session_end_time TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES user_profiles (user_id)
        )
      `).run();
      console.log('ユーザーセッションテーブルを作成しました');
    }

    if (action === 'update') {
      // 既存のセッションを非アクティブにする
      await env.DB.prepare(`
        UPDATE user_sessions 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND is_active = 1
      `).bind(userId).run();

      // 新しいセッションを作成
      const result = await env.DB.prepare(`
        INSERT INTO user_sessions (user_id, remaining_seconds, session_end_time, is_active)
        VALUES (?, ?, ?, 1)
      `).bind(userId, remainingSeconds, sessionEndTime).run();

      console.log('セッションを更新しました:', {
        userId,
        remainingSeconds,
        sessionEndTime,
        result
      });

    } else if (action === 'add_time') {
      // 残り時間を追加
      const currentSession = await env.DB.prepare(`
        SELECT * FROM user_sessions 
        WHERE user_id = ? AND is_active = 1
        ORDER BY updated_at DESC
        LIMIT 1
      `).bind(userId).first();

      if (currentSession) {
        const newRemainingSeconds = currentSession.remaining_seconds + remainingSeconds;
        const newSessionEndTime = new Date(Date.now() + newRemainingSeconds * 1000).toISOString();

        await env.DB.prepare(`
          UPDATE user_sessions 
          SET remaining_seconds = ?, session_end_time = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(newRemainingSeconds, newSessionEndTime, currentSession.id).run();

        console.log('残り時間を追加しました:', {
          userId,
          addedSeconds: remainingSeconds,
          newRemainingSeconds,
          newSessionEndTime
        });
      } else {
        // アクティブなセッションがない場合は新規作成
        const sessionEndTime = new Date(Date.now() + remainingSeconds * 1000).toISOString();
        await env.DB.prepare(`
          INSERT INTO user_sessions (user_id, remaining_seconds, session_end_time, is_active)
          VALUES (?, ?, ?, 1)
        `).bind(userId, remainingSeconds, sessionEndTime).run();

        console.log('新しいセッションを作成しました:', {
          userId,
          remainingSeconds,
          sessionEndTime
        });
      }

    } else if (action === 'reset') {
      // セッションをリセット
      await env.DB.prepare(`
        UPDATE user_sessions 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).bind(userId).run();

      console.log('セッションをリセットしました:', { userId });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'セッションを更新しました'
    }), { 
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== ユーザーセッション更新エラー ===');
    console.error(error);
    return new Response(JSON.stringify({
      success: false,
      message: 'エラーが発生しました',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
