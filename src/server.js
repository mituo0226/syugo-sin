import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import { runConsult } from "./consult/consult.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8787;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.use(cors());
app.use(bodyParser.json());

// 静的ファイル配信
app.use(express.static(path.join(process.cwd(), "public")));
app.use("/photo", express.static(path.join(process.cwd(), "photo")));
app.use("/rule", express.static(path.join(process.cwd(), "rule")));

// 個別フォルダをマウント
app.use("/consult", express.static(path.join(process.cwd(), "src/consult")));
app.use("/pay", express.static(path.join(process.cwd(), "pay")));
app.use("/shop", express.static(path.join(process.cwd(), "shop")));

// /consult エンドポイント
app.get("/consult", (req, res) => {
  res.json({ message: "consult API is alive" });
});

app.post("/consult", async (req, res) => {
  try {
    const result = await runConsult(req.body, OPENAI_API_KEY);
    res.json({ result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/consult", async (req, res) => {
  try {
    const { text, year, month, day, guardian, category } = req.body;
    
    // runConsult()を呼び出し
    const result = await runConsult({
      text,
      year,
      month,
      day,
      guardian,
      category
    }, process.env.OPENAI_API_KEY);
    
    // 結果を段落配列に分割
    const paragraphs = result.split("\n\n");
    
    res.json({ ok: true, paragraphs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 管理用APIエンドポイント
// 残り時間管理用のメモリストレージ（本番ではDBを使用）
let adminSessions = new Map();

// 管理用セッション作成
app.post("/admin/session", (req, res) => {
  const { password } = req.body;
  
  // 簡単なパスワード認証（本番では適切な認証を実装）
  if (password === "admin123") {
    const sessionId = Date.now().toString();
    adminSessions.set(sessionId, {
      createdAt: Date.now(),
      lastAccess: Date.now()
    });
    
    res.json({ 
      ok: true, 
      sessionId,
      message: "管理セッションを作成しました" 
    });
  } else {
    res.status(401).json({ 
      ok: false, 
      error: "認証に失敗しました" 
    });
  }
});

// 残り時間の一括管理
app.post("/admin/time", (req, res) => {
  const { sessionId, action, minutes, userId } = req.body;
  
  // セッション認証
  if (!adminSessions.has(sessionId)) {
    return res.status(401).json({ 
      ok: false, 
      error: "無効なセッションです" 
    });
  }
  
  // セッション更新
  adminSessions.set(sessionId, {
    ...adminSessions.get(sessionId),
    lastAccess: Date.now()
  });
  
  try {
    switch (action) {
      case "set":
        if (minutes < 0 || minutes > 999) {
          return res.status(400).json({ 
            ok: false, 
            error: "分数は0-999の範囲で指定してください" 
          });
        }
        res.json({ 
          ok: true, 
          message: `残り時間を${minutes}分に設定しました`,
          minutes 
        });
        break;
        
      case "add":
        if (minutes < 0 || minutes > 999) {
          return res.status(400).json({ 
            ok: false, 
            error: "追加分数は0-999の範囲で指定してください" 
          });
        }
        res.json({ 
          ok: true, 
          message: `${minutes}分を追加しました`,
          minutes 
        });
        break;
        
      case "unlimited":
        res.json({ 
          ok: true, 
          message: "無制限モードを切り替えました",
          unlimited: true 
        });
        break;
        
      default:
        res.status(400).json({ 
          ok: false, 
          error: "無効なアクションです" 
        });
    }
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: "サーバーエラーが発生しました" 
    });
  }
});

// 管理用セッション状態確認
app.get("/admin/status", (req, res) => {
  const { sessionId } = req.query;
  
  if (!sessionId || !adminSessions.has(sessionId)) {
    return res.status(401).json({ 
      ok: false, 
      error: "無効なセッションです" 
    });
  }
  
  const session = adminSessions.get(sessionId);
  res.json({ 
    ok: true, 
    session: {
      createdAt: session.createdAt,
      lastAccess: session.lastAccess
    }
  });
});

app.listen(PORT, () => {
  console.log(`APIサーバー起動中 → http://localhost:${PORT}`);
});
