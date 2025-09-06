import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import { consult } from "./consult/consult.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8787;

app.use(cors());
app.use(bodyParser.json());

// 静的ファイル配信
app.use(express.static(path.join(process.cwd())));

// 個別フォルダをマウント
app.use("/consult", express.static(path.join(process.cwd(), "consult")));
app.use("/pay", express.static(path.join(process.cwd(), "pay")));
app.use("/shop", express.static(path.join(process.cwd(), "shop")));

app.post("/api/consult", async (req, res) => {
  try {
    const result = await consult(req.body);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "APIエラー", detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`APIサーバー起動中 → http://localhost:${PORT}`);
});
