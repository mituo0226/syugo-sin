// Pages Functions ルーティング設定
export const onRequest = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);
  
  // API エンドポイント以外は静的ファイルとして処理
  if (!url.pathname.startsWith('/api/')) {
    return fetch(request);
  }
  
  // D1データベースをPages Functionsにバインド
  // env.DB は Cloudflare Pages の設定で D1 データベースにバインドされている必要があります
  return next();
};
