export async function onRequestGet(context) {
  const { env } = context;

  try {
    console.log("Database test API called");
    console.log("Environment:", env);
    console.log("DB binding exists:", !!env.DB);
    console.log("DB type:", typeof env.DB);
    
    if (!env.DB) {
      return new Response(JSON.stringify({
        success: false,
        error: "Database binding not found",
        env: Object.keys(env)
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 簡単なクエリをテスト
    const result = await env.DB.prepare("SELECT 1 as test").first();
    console.log("Test query result:", result);

    return new Response(JSON.stringify({
      success: true,
      message: "Database connection successful",
      testResult: result
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Database test error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack,
      env: Object.keys(env)
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
