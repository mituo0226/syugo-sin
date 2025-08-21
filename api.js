// filename: src/worker.js
// Routes: /consult で鑑定本文を返す（段落化サポート）
// ENV:
// - ALLOW_ORIGIN: 例 "https://ai-par.com,https://ai-par.pages.dev"（未指定なら "*"）
// - OPENAI_API_KEY: （任意）OpenAI に中継する場合に設定
// - OPENAI_MODEL: （任意）例 "gpt-4o-mini" / "gpt-4.1-mini" など
// - FALLBACK_TEXT: （任意）上流未設定時のモック本文

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ---- CORS preflight ----
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env, request) });
    }

    // ---- health check ----
    if (url.pathname === "/health") {
      return json({ ok: true, ts: Date.now() }, env, request);
    }

    // ---- consult endpoint（末尾スラッシュ許容、GET/POST 受け付け）----
    const isConsultPath = url.pathname === "/api/consult" || url.pathname === "/consult" || url.pathname.startsWith("/consult/");
    if (isConsultPath && (request.method === "POST" || request.method === "GET")) {
      try {
        const payload = await safeJson(request);
        const {
          text = "",
          prompt = "",
          year = null,
          month = null,
          day = null,
          category = "",
          mode = "full",
          paragraphsPerBlock = 0, // 0=自動（将来拡張用）
        } = payload || {};

        // 生年月日の検証（個別鑑定の場合は必須ではない）
        let yearNum = null, monthNum = null, dayNum = null;
        
        if (year && month && day) {
          yearNum = Number(year);
          monthNum = Number(month);
          dayNum = Number(day);

          if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum) ||
              yearNum < 1900 || yearNum > 2100 ||
              monthNum < 1 || monthNum > 12 ||
              dayNum < 1 || dayNum > 31) {
            return json({ 
              ok: false, 
              error: "生年月日の形式が不正です" 
            }, env, request, 400);
          }
        }

        // 1) 本文生成：OpenAI に中継 or Fallback
        const seed = String(prompt || text || "").trim();
        if (!seed) {
          return json({ 
            ok: false, 
            error: "相談内容が指定されていません" 
          }, env, request, 400);
        }

        // デバッグ情報のログ
        console.log('API Request:', {
          seed: seed.substring(0, 100) + (seed.length > 100 ? '...' : ''),
          year: yearNum, month: monthNum, day: dayNum, category, mode
        });

        const fullText = await generateText(seed, { year: yearNum, month: monthNum, day: dayNum, category, mode }, env);

        // 2) 段落分割
        const paragraphs = toParagraphs(fullText, { minSentences: 2, maxSentences: 4 });

        // 3) HTML 生成（p タグ）
        const html = paragraphs.map(p => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");

        // 4) 念のためプレーンも同梱
        const body = {
          ok: true,
          message: fullText,        // 従来互換
          paragraphs,               // 推奨：段落配列
          html,                     // すぐ表示したいとき用
          meta: { 
            year: yearNum, 
            month: monthNum, 
            day: dayNum, 
            category, 
            mode,
            seed: seed.substring(0, 50) + (seed.length > 50 ? '...' : ''),
            hasBirthDate: !!(yearNum && monthNum && dayNum)
          },
        };
        return json(body, env, request);
      } catch (err) {
        return json({ ok: false, error: String(err?.message || err) }, env, request, 500);
      }
    }

    // ---- not found ----
    return json({ ok: false, error: "Not found" }, env, request, 404);
  },
};

/* ========= 本文生成（OpenAI が設定されていれば中継、なければモック） ========= */
async function generateText(seed, meta, env) {
  // OPENAI 経由
  if (env.OPENAI_API_KEY) {
    const model = env.OPENAI_MODEL || "gpt-4o-mini";
    const sys = [
      "あなたは“守護神占い”の鑑定師「龍」です。",
      "以下の条件を満たす日本語テキストを出力してください：",
      "- 相談者の不安を受け止めつつ、因縁・守護・行動指針を具体的に提示する",
      "- 2〜5文ごとに段落を分け、読点や改行を活かして読みやすくする",
      "- 段落間は空行（\\n\\n）を入れる",
      "- 禁止：誹謗中傷・医療/法律等の断定的助言・個人特定",
    ].join("\n");

    const user = [
      `【相談内容】\n${seed}`,
      meta.year && meta.month && meta.day
        ? `【生年月日】${meta.year}年${meta.month}月${meta.day}日`
        : null,
      meta.category ? `【ジャンル】${meta.category}` : null,
      `【出力要件】自然な日本語。段落間は\\n\\nで区切る。`,
    ].filter(Boolean).join("\n");

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: 0.7,
      }),
    });

    const txt = await r.text();
    if (!r.ok) {
      console.error('OpenAI API Error:', {
        status: r.status,
        statusText: r.statusText,
        response: txt.substring(0, 500)
      });
      throw new Error(`OpenAI API error ${r.status}: ${txt.substring(0, 200)}`);
    }
    
    let data;
    try {
      data = JSON.parse(txt);
    } catch (parseError) {
      console.error('OpenAI Response Parse Error:', parseError);
      throw new Error('OpenAI API response format error');
    }
    
    const content =
      data?.choices?.[0]?.message?.content?.trim?.() ||
      env.FALLBACK_TEXT ||
      defaultMock(seed, meta);

    return normalizeParagraphs(content);
  }

  // Fallback（モック）
  return normalizeParagraphs(env.FALLBACK_TEXT || defaultMock(seed, meta));
}

/* ========= 段落分割ユーティリティ ========= */
/**
 * LLM から返るテキストの段落を安定化
 * - 連続改行は1ブロックに正規化
 * - なければ日本語終止記号（。！？）で2〜4文ごとに段落化
 */
function toParagraphs(text, { minSentences = 2, maxSentences = 4 } = {}) {
  const t = (text || "").trim();

  // 既に段落（空行）を含む場合はそれを優先
  const blocks = t.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  if (blocks.length > 1) return blocks;

  // 1 段落しかない→文単位で再分割
  const sentences = splitSentencesJa(t);
  if (sentences.length <= maxSentences) return [t];

  const paras = [];
  for (let i = 0; i < sentences.length; ) {
    const take = Math.min(
      maxSentences,
      Math.max(minSentences, sentences.length - i)
    );
    const chunk = sentences.slice(i, i + take).join("");
    paras.push(chunk.trim());
    i += take;
  }
  return paras;
}

function splitSentencesJa(text) {
  // 終止記号（。！？）＋（"」』）を含む場合対応、改行も考慮
  const parts = [];
  let buf = "";
  for (const ch of text) {
    buf += ch;
    if (
      /[。！？]/.test(ch) ||
      (ch === "\n" && buf.trim().length > 0 && buf.trim().length >= 20)
    ) {
      // 後続の閉じカッコや引用符も巻き込む（必要なら拡張）
      parts.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function normalizeParagraphs(text) {
  // CRLF→LF、3連続以上の改行は 2 に縮める
  return String(text)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ========= 便利関数 ========= */
function corsHeaders(env, request) {
  const reqOrigin = request.headers.get("Origin") || "";
  const allow = (env.ALLOW_ORIGIN || "*")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  let origin = "*";
  if (allow[0] !== "*") {
    origin = allow.includes(reqOrigin) ? reqOrigin : allow[0] || "";
  }

  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(obj, env, request, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(env, request),
    },
  });
}

async function safeJson(request) {
  if (request.method !== "POST") return {};
  const txt = await request.text();
  try { return JSON.parse(txt || "{}"); } catch { return {}; }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function defaultMock(seed, meta) {
  return [
    "あなたが抱える問題は、過去の因縁と深く繋がっています。今この瞬間も、その因縁は無意識の選択や振る舞いに影響を及ぼしています。",
    "やがて現れる人物は、あなたに試練と成長の契機を与える存在です。恐れず、相手の言葉の裏にある“学び”を見つめることで、運命は好転を始めます。",
    "具体的には、今後一ヶ月は“受け身”ではなく“小さな決断を積み重ねる”こと。金銭面では固定費の見直し、人間関係では返信を一拍置くなど、微調整が大きな流れを変えます。",
    "守護の加護は、朝の静かな時間に最も届きやすい。深呼吸を三度、胸の前で手を合わせ、自分の中の『大切にしたいもの』を一言で唱えてください。それが灯となります。",
  ].join("\n\n");
}
