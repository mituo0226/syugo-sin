// Cloudflare Workers API for syugo-sin
export default {
  async fetch(request, env, ctx) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only handle POST requests to /api/consult
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/api/consult') {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      const payload = await request.json().catch(() => ({}));
      const text = (payload.text ?? payload.prompt ?? payload.question ?? "").toString().trim();
      const year = Number.isInteger(payload.year) ? payload.year : null;
      const month = Number.isInteger(payload.month) ? payload.month : null;
      const day = Number.isInteger(payload.day) ? payload.day : null;
      
      if (!text) {
        return new Response(JSON.stringify({ error: "text required" }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 干支と星座の計算
      function zodiacFromYear(y) {
        const zodiacs = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
        const idx = ((y - 4) % 12 + 12) % 12;
        return zodiacs[idx];
      }
      
      function westernZodiac(m, d) {
        const edges = [
          [1,20,'山羊座'], [2,19,'水瓶座'], [3,21,'魚座'], [4,20,'牡羊座'],
          [5,21,'牡牛座'], [6,22,'双子座'], [7,23,'蟹座'], [8,23,'獅子座'],
          [9,23,'乙女座'], [10,24,'天秤座'], [11,23,'蠍座'], [12,22,'射手座'], [12,32,'山羊座']
        ];
        for (let i=0; i<edges.length-1; i++){
          const [sm,sd,name] = edges[i];
          const [nm,nd] = edges[i+1];
          const afterStart = (m>sm) || (m===sm && d>=sd);
          const beforeNext = (m<nm) || (m===nm && d<nd);
          if (afterStart && beforeNext) return name;
        }
        return '不明';
      }

      const GUARDIANS = {
        '子': '千手観音','丑':'虚空蔵菩薩','寅':'虚空蔵菩薩','卯':'文殊菩薩',
        '辰': '普賢菩薩','巳':'普賢菩薩','午':'勢至菩薩','未':'大日如来',
        '申': '大日如来','酉':'不動明王','戌':'阿弥陀如来','亥':'阿弥陀如来'
      };

      let known = "";
      if (year && month && day) {
        const eto = zodiacFromYear(year);
        const seiza = westernZodiac(month, day);
        const guardian = GUARDIANS[eto] || '不明';
        known = `【把握済み】生年月日:${year}年${month}月${day}日 / 干支:${eto} / 星座:${seiza} / 守護神:${guardian}`;
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

      const userContent = (known ? known + "\n\n" : "") + `【相談文】\n${text}`;

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.6,
          max_tokens: 700,
          messages: [
            { role: "system", content: persona },
            { role: "user", content: userContent }
          ]
        })
      });

      const data = await r.json().catch(() => null);
      if (!r.ok) {
        return new Response(JSON.stringify({
          code: "upstream_error",
          error: "現在接続できません。時間を置いてお試しください。"
        }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        message: data?.choices?.[0]?.message?.content ?? "" 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (err) {
      return new Response(JSON.stringify({ 
        code: "server_error", 
        error: "現在接続できません。",
        detail: err.message 
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },
};
