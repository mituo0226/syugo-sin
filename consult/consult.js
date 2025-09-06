export async function consult(body) {
  const { text, year, month, day, category, prompt } = body;

  // 本来は OpenAI API を呼び出して応答を生成する
  // とりあえずテスト用のダミー応答を返す
  return {
    paragraphs: [
      `相談内容: ${text}`,
      `生年月日: ${year}-${month}-${day}`,
      `守護神情報: ${prompt}`,
      "（ここにAIからの鑑定結果が入ります）"
    ]
  };
}
