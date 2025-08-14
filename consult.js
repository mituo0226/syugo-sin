
// functions/api/consult.js
// Ryuu persona backend: accepts {text} (or {prompt}), optional {year,month,day},
// recomputes zodiac/guardian on server, and feeds a stable system prompt.

function zodiacFromYear(y) {
  const zodiacs = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const idx = ((y - 4) % 12 + 12) % 12;
  return zodiacs[idx];
}

function westernZodiac(m, d) {
  // Sun-sign boundaries (approx.)
  const edges = [
    [1,20,'山羊座'], [2,19,'水瓶座'], [3,21,'魚座'], [4,20,'牡羊座'],
    [5,21,'牡牛座'], [6,22,'双子座'], [7,23,'蟹座'], [8,23,'獅子座'],
    [9,23,'乙女座'], [10,24,'天秤座'], [11,23,'蠍座'], [12,22,'射手座'], [12,32,'山羊座']
  ];
  for (let i=0;i<edges.length-1;i++){
    const [sm,sd,name] = edges[i];
    const [nm,nd] = edges[i+1];
    const afterStart = (m>sm) || (m===sm && d>=sd);
    const beforeNext = (m<nm) || (m===nm && d<nd);
    if (afterStart && beforeNext) return name;
  }
  return '不明';
}

const GUARDIANS = {
  '子': '千手観音',
  '丑': '虚空蔵菩薩',
  '寅': '虚空蔵菩薩',
  '卯': '文殊菩薩',
  '辰': '普賢菩薩',
  '巳': '普賢菩薩',
  '午': '勢至菩薩',
  '未': '大日如来',
  '申': '大日如来',
  '酉': '不動明王',
  '戌': '阿弥陀如来',
  '亥': '阿弥陀如来'
};

export const onRequestPost = async ({ request, env }) => {
  let payload = {};
  try { payload = await request.json(); } catch (_) {}

  const raw = ((payload?.text ?? payload?.prompt) ?? "").toString().trim();
  const year  = Number.isInteger(payload?.year)  ? payload.year  : null;
  const month = Number.isInteger(payload?.month) ? payload.month : null;
  const day   = Number.isInteger(payload?.day)   ? payload.day   : null;

  if (!raw) {
    return new Response(JSON.stringify({ error: "text required" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  // Known context from DOB (server-side authoritative)
  let known = "";
  if (year && month && day) {
    const eto = zodiacFromYear(year);
    const seiza = westernZodiac(month, day);
    const guardian = GUARDIANS[eto] || '不明';
    known = [
      "【把握済み】",
      `生年月日: ${year}年${month}月${day}日`,
      `干支: ${eto}`,
      `星座: ${seiza}`,
      `守護神: ${guardian}`
    ].join(" / ");
  }

  const persona = [
    "あなたはテレビ番組の専属鑑定士であり霊能者でもある「龍」として回答します。",
    "・1962年2月生まれ。終始、穏やかな敬語で話す。",
    "・相談者の生年月日、干支、西洋占星術由来の資質を把握している体で助言する。",
    "・日本国内の地名が出たら、具体的な地域名と特徴を一言添える。",
    "・相談内容に応じ、目的に合う日本の神社仏閣を具体名で1〜3件候補提示（所在地＋ご利益を簡潔に）。",
    "・相談者の守護霊・守護神に触れる際は、安心できる表現で具体的な後押しを述べる。",
    "・ネガティブ断定や不安を煽る表現は避け、前向きな代替案を示す。",
    "・本文は原則500字前後。最後は次の一歩を促す具体的な質問で締める。",
    "・医療／法律／投資など確定判断は行わず、専門家相談の提案を添える。"
  ].join("\n");

  const userContent = (known ? `${known}\n\n` : "") + `【相談文】\n${raw}`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6,
        max_tokens: 700,
        messages: [
          { role: "system", content: persona },
          { role: "user", content: userContent }
        ]
      }),
    });

    if (!r.ok) {
      let code = "upstream_error"; let message = "現在混雑または通信エラーにより鑑定を実行できません。しばらくしてからお試しください。";
      try {
        const ej = await r.clone().json();
        if (ej?.error?.code === "unsupported_country_region_territory") {
          code = "region_blocked";
          message = "現在の接続経路の都合により鑑定サーバへ到達できません。時間を置いてお試しください。";
        }
      } catch(_) {}
      return new Response(JSON.stringify({ error: message, code }), {
        status: 503, headers: { "Content-Type": "application/json" }
      });
    }

    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ message: content }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "server_error", detail: err?.message || String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
};
