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

app.listen(PORT, () => {
  console.log(`APIサーバー起動中 → http://localhost:${PORT}`);
});
