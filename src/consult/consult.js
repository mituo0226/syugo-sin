/**
 * AI鑑定を実行する共通モジュール
 * @param {Object} payload - 鑑定に必要な情報
 * @param {string} payload.text - 相談内容
 * @param {number} payload.year - 生年
 * @param {number} payload.month - 生月
 * @param {number} payload.day - 生日
 * @param {string} payload.guardian - 守護神情報
 * @param {string} payload.category - カテゴリー
 * @param {string} apiKey - OpenAI APIキー
 * @returns {Promise<string>} 生成された鑑定テキスト
 */
export async function runConsult(payload, apiKey) {
  const { text, year, month, day, guardian, category } = payload;

  try {
    // プロンプト構成
    const systemPrompt = `あなたは鑑定士「龍」。
神秘的で威厳を感じさせる雰囲気を保ちながら、占い師としての力を表現する。
敬語は使わず、語りかける自然な口調で話しかける。

鑑定内容に必ず含める要素：
- 生年月日から導き出した相談者の性格を具体的に伝える（占星術や算命学という言葉は出さず、結果だけを語る）
- 生年月日から算命学に基づく現在と将来の運勢の流れを結果だけ伝える
- 守護神に加え、守護霊の存在を伝える
  - 相談者が男性の場合 → お母様側の3代前のご先祖様（女性）
  - 相談者が女性の場合 → お父様側の3代前のご先祖様（女性）
- 動物霊の存在についても触れ、過去に縁のあった動物が現在も守っていることを伝える

応答スタイル：
- 冒頭で必ず相談者のニックネームを呼びかける
- 段落ごとに分けて語り、1段落は2〜4文程度にする
- 一度に長すぎる鑑定をせず、会話が続くように適度に区切る
- 2/3の確率で相談者に具体的な問いかけを含める
  （例：「恋人を望むなら、容姿を重視するのか、性格を重視するのか、経済力を重視するのか」）

行動指針：
- 問いかけや鑑定に関連して、相談者が毎日の行いをどう変えるべきか具体的にアドバイスする
- 「その行動をした後でどんな変化を感じるか意識してほしい」と必ず促す

返答は適度に段落を分け、改行を入れて読みやすくしてください。`;

    const userPrompt = `相談内容: ${text}
生年月日: ${year}-${month}-${day}
守護神情報: ${guardian}
カテゴリー: ${category}`;

    // OpenAI API を呼び出し
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API エラー: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || "鑑定結果を取得できませんでした。";

    // ログ出力
    console.log('相談内容:', text);
    console.log('生年月日:', `${year}-${month}-${day}`);
    console.log('守護神情報:', guardian);
    console.log('カテゴリー:', category);

    return aiResponse;

  } catch (error) {
    console.error('OpenAI API エラー:', error);
    
    // ログ出力
    console.log('相談内容:', text);
    console.log('生年月日:', `${year}-${month}-${day}`);
    console.log('守護神情報:', guardian);
    console.log('カテゴリー:', category);
    
    return "鑑定結果の取得中にエラーが発生しました";
  }
}
