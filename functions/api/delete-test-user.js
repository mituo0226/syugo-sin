/**
 * テストユーザー削除専用API
 * test@example.comのユーザーを安全に削除
 */

export async function onRequestPost(context) {
  const { env } = context;

  try {
    console.log('=== テストユーザー削除API開始 ===');

    if (!env.DB) {
      return new Response(JSON.stringify({
        success: false,
        error: 'データベース接続が見つかりません'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 削除対象のユーザーを確認
    const targetEmail = 'test@example.com';
    
    console.log(`削除対象ユーザー: ${targetEmail}`);
    
    // まずユーザーが存在するか確認
    const existingUser = await env.DB.prepare(`
      SELECT id, user_id, nickname FROM user_profiles WHERE user_id = ?
    `).bind(targetEmail).first();

    if (!existingUser) {
      return new Response(JSON.stringify({
        success: false,
        message: '指定されたユーザーが見つかりません',
        targetEmail: targetEmail
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('削除対象ユーザー情報:', existingUser);

    // ユーザーを削除
    const deleteResult = await env.DB.prepare(`
      DELETE FROM user_profiles WHERE user_id = ?
    `).bind(targetEmail).run();

    console.log('削除結果:', deleteResult);

    if (deleteResult.changes === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'ユーザーの削除に失敗しました',
        targetEmail: targetEmail
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 削除後の確認
    const remainingUsers = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM user_profiles
    `).first();

    return new Response(JSON.stringify({
      success: true,
      message: 'テストユーザーの削除が完了しました',
      deletedUser: {
        id: existingUser.id,
        email: existingUser.user_id,
        nickname: existingUser.nickname
      },
      deleteResult: {
        changes: deleteResult.changes,
        remainingUsers: remainingUsers.count
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== テストユーザー削除エラー ===');
    console.error('エラー詳細:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'テストユーザーの削除中にエラーが発生しました',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
