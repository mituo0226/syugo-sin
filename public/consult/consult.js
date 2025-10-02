/**
 * AI鑑定を実行する共通モジュール
 * @param {Object} payload - 鑑定に必要な情報
 * @param {string} payload.text - 相談内容
 * @param {number} payload.year - 生年
 * @param {number} payload.month - 生月
 * @param {number} payload.day - 生日
 * @param {string} payload.guardian - 守護神情報
 * @param {string} payload.category - カテゴリー
 * @param {Array} payload.conversationHistory - 会話履歴
 * @param {string} apiKey - OpenAI APIキー
 * @returns {Promise<string>} 生成された鑑定テキスト
 */
export async function runConsult(payload, apiKey) {
  const { text, year, month, day, guardian, category, conversationHistory = [] } = payload;

  try {
    // 会話履歴の長さに基づいてプロンプトを調整
    const isFirstConversation = conversationHistory.length === 0;
    const isSecondConversation = conversationHistory.length === 1;
    
    let systemPrompt = `あなたは鑑定士「龍」。
神秘的で威厳を感じさせる雰囲気を保ちながら、占い師としての力を表現する。
敬語は使わず、語りかける自然な口調で話しかける。

応答スタイル：
- 冒頭で必ず相談者のニックネームを呼びかける
- 段落ごとに分けて語り、1段落は2〜4文程度にする
- 一度に長すぎる鑑定をせず、会話が続くように適度に区切る
- 2/3の確率で相談者に具体的な問いかけを含める

行動指針：
- 問いかけや鑑定に関連して、相談者が毎日の行いをどう変えるべきか具体的にアドバイスする
- 「その行動をした後でどんな変化を感じるか意識してほしい」と必ず促す

返答は適度に段落を分け、改行を入れて読みやすくしてください。`;

    // 初回会話の場合のみ詳細な鑑定要素を含める
    if (isFirstConversation) {
      systemPrompt += `

初回鑑定で必ず含める要素：
- 生年月日から導き出した相談者の性格を具体的に伝える（占星術や算命学という言葉は出さず、結果だけを語る）
- 生年月日から算命学に基づく現在と将来の運勢の流れを結果だけ伝える
- 守護神に加え、守護霊の存在を伝える
  - 相談者が男性の場合 → お母様側の3代前のご先祖様（女性）
  - 相談者が女性の場合 → お父様側の3代前のご先祖様（女性）
- 動物霊の存在についても触れ、過去に縁のあった動物が現在も守っていることを伝える`;
    } else if (isSecondConversation) {
      systemPrompt += `

2回目の会話では：
- 前回の鑑定内容は既に伝えているので、同じ内容を繰り返さない
- 相談者の具体的な悩みや質問に焦点を当てて回答する
- より深い洞察や具体的なアドバイスを提供する`;
    } else {
      systemPrompt += `

継続会話では：
- 既に伝えた鑑定内容（性格、運勢、守護霊、動物霊など）は繰り返さない
- 相談者の新しい質問や悩みに直接答える
- 自然な会話として、必要に応じて簡潔なアドバイスを提供する
- 同じ内容を何度も言わず、会話の流れに沿って回答する`;
    }

    // 守護神情報からニックネームを抽出
    // guardianが文字列の場合はそのまま使用、分割可能な場合は分割
    let nickname = '相談者';
    let guardianName = guardian || '守護神';
    let worry = '';
    
    if (typeof guardian === 'string' && guardian.includes(' / ')) {
      const guardianParts = guardian.split(' / ');
      nickname = guardianParts[0] || '相談者';
      guardianName = guardianParts[1] || '守護神';
      worry = guardianParts[2] || '';
    }
    
    const userPrompt = `相談内容: ${text}
生年月日: ${year}-${month}-${day}
ニックネーム: ${nickname}
守護神: ${guardianName}
相談者の悩み: ${worry}
カテゴリー: ${category}`;

    // 会話履歴をメッセージ配列に変換
    const messages = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    // 会話履歴を追加（最新の5件まで）
    const recentHistory = conversationHistory.slice(-5);
    for (const historyItem of recentHistory) {
      if (historyItem.user) {
        messages.push({
          role: "user",
          content: historyItem.user
        });
      }
      if (historyItem.assistant) {
        messages.push({
          role: "assistant",
          content: historyItem.assistant
        });
      }
    }

    // 現在のユーザーメッセージを追加
    messages.push({
      role: "user",
      content: userPrompt
    });

    // OpenAI API を呼び出し
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: messages,
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
    console.log('ニックネーム:', nickname);
    console.log('守護神:', guardianName);
    console.log('相談者の悩み:', worry);
    console.log('カテゴリー:', category);

    return aiResponse;

  } catch (error) {
    console.error('OpenAI API エラー:', error);
    
    // ログ出力
    console.log('相談内容:', text);
    console.log('生年月日:', `${year}-${month}-${day}`);
    console.log('ニックネーム:', nickname);
    console.log('守護神:', guardianName);
    console.log('相談者の悩み:', worry);
    console.log('カテゴリー:', category);
    
    return "鑑定結果の取得中にエラーが発生しました";
  }
}