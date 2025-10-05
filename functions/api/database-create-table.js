export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    console.log("Database create table API called");
    const requestBody = await request.json();
    console.log("Request body:", requestBody);
    
    const { tableName, schema } = requestBody;
    console.log("Table name:", tableName);
    console.log("Schema:", schema);

    if (!tableName || !schema) {
      return new Response(JSON.stringify({
        success: false,
        error: "テーブル名とスキーマが必要です"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // テーブル名の検証（基本的なセキュリティ）- ハイフンも許可
    if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(tableName)) {
      return new Response(JSON.stringify({
        success: false,
        error: "無効なテーブル名です（英数字、アンダースコア、ハイフンのみ使用可能）"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // データベース接続確認
    console.log("DB binding exists:", !!env.DB);
    
    // CREATE TABLE文を実行
    console.log("Executing SQL:", schema);
    const result = await env.DB.prepare(schema).run();
    console.log("SQL execution result:", result);

    return new Response(JSON.stringify({
      success: true,
      message: `テーブル "${tableName}" を作成しました`,
      result: result
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Database create table error:", error);
    console.error("Error stack:", error.stack);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack,
      type: error.constructor.name
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
