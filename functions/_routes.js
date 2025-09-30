// Pages Functions ルーティング設定
export const onRequest = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  
  // API エンドポイント以外は静的ファイルとして処理
  if (!url.pathname.startsWith('/api/')) {
    return fetch(request);
  }
  
  // API エンドポイントは対応する関数にルーティング
  return fetch(request);
};
