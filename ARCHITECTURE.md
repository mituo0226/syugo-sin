# AI鑑定師 龍 — システム再設計書 v1.0
## Cursor への実装指示書付き

作成日: 2026-03-09

---

## A. 現状構造の分析（実態）

### 認証フロー（実際に動いているパス）

```
【正規フロー】
send-magic-link.js
  → user_profiles テーブルに INSERT (email = user_id)
  → Gmail/Resend でメール送信

verify-magic-link.js
  → user_profiles の is_verified = 1 に更新
  → Cookie: session_user={email} をセット

save-user-profile.js
  → user_profiles の nickname/birth/guardian 等を UPDATE
```

```
【register.js は実質デッドコード】
register.js
  → SELECT FROM users (← このテーブルはschema.sqlに存在しない)
  → INSERT INTO users (← 同上)
  → エラーか DB 自動作成か不明
```

**結論**: マジックリンクフローが主で `register.js` は独立した古いエンドポイント。
`login.js` は `user_profiles` を正しく参照している。

---

### 決済フロー（実際の動き）

```
chat.html フッター「チケット購入」
  → payment/ticket.html (チケット選択)
  → POST /api/create-payment-link
      { uid: email, ticketData: { name, price, minutes } }
  → Square Checkout URL 生成 → ユーザーをSquareへリダイレクト

Square 決済完了
  → redirect_url: /payment/confirm.html?uid={email}

confirm.html
  → POST /api/verify
      { uid, checkoutId, ticketData }
  → [verify.js内] Square Orders API で検証
  → purchases テーブルに INSERT (動的CREATE)
  → user_sessions テーブルに INSERT (動的CREATE)
      session_end_time = now + minutes * 60秒
  → レスポンス: { ok: true, expireAt: "ISO文字列" }

confirm.html
  → localStorage.expireAt = expireAt を保存
  → chat.html にリダイレクト

chat.html 起動時
  → GET /api/user-session?userId={email}
      session_end_time - now = remainingSeconds を計算して返す
  → remainingSeconds をクライアント変数にセット
```

---

### チャット/セッション管理（実態）

```
chat.html の タイマー管理フロー:

1. 起動時: loadRemainingTimeFromDatabase()
   → GET /api/user-session?userId=localStorage上のemail
   → session_end_time を基準にサーバー側で残り秒数計算 ✅

2. 初回メッセージ送信時: startCountdown()
   → setInterval(1秒) で loadRemainingTimeFromDatabase() を毎秒実行
   → remainingSeconds が 0 → handleSessionExpired()

3. カウントダウン中の保存: saveRemainingTimeToDatabase()
   → POST /api/user-session { action:'update', remainingSeconds, sessionEndTime }
   ※ ただし session_end_time を再計算して POST している (冗長)

4. タイムアウト時: handleSessionExpired()
   → 入力欄 disabled
   → 「チケット購入」ボタン表示 (フッターの payment/ticket.html へのリンク)
```

---

### /api/consult の致命的問題

```javascript
// functions/api/consult.js の実態
export async function onRequestPost(context) {
  const payload = await request.json();
  const { runConsult } = await import('../../public/consult/consult.js');
  const result = await runConsult(payload, env.OPENAI_API_KEY);
  // ← Cookie 検証なし
  // ← user_sessions チェックなし
  // ← 誰でも何回でも POST 可能
  return createSuccessResponse({ ok: true, paragraphs }, corsHeaders);
}
```

---

## B. 最大のボトルネック 3 つ（優先順）

### ボトルネック #1 — `/api/consult` が完全無防備

```
影響: 課金を完全に迂回できる
攻撃: curl -X POST /api/consult -d '{"text":"占って","year":1990,...}'
結果: OpenAI API コストだけが発生し、売上ゼロ
```

クライアント側の `isSessionExpired` チェックは **JS を無効化すれば即回避**。
サーバー側に時間チェックが存在しないため、**現状は課金が全く機能していない**。

---

### ボトルネック #2 — 無料体験がなく初回コンバージョンが発生しない

```
現状:
  オンボーディング完了 → chat.html 遷移
  → loadRemainingTimeFromDatabase() = 0秒 (セッションなし)
  → 即タイムアウト画面「チケットを購入してください」
  → ユーザー離脱
```

体験前に購入を求める構造。**コンバージョン率は理論上ほぼ0**。

---

### ボトルネック #3 — タイムアウト後の購入導線が弱い

```
現状: handleSessionExpired() → チャット下部に小さい「チケット購入」ボタン
問題: 勢いが切れる / 選択肢が見えない / なぜ買うかが伝わらない
```

---

## C. 最短収益化構造（設計）

```
【新フロー】

index.html
↓
ritual（守護神儀式 → 短縮版OK）
↓
auth/regist.html → マジックリンク登録
↓
verify-magic-link.js ← ここで 3分(180秒)の無料セッションを付与
↓
chat.html (残り3:00 でスタート)
↓ (自動で初回鑑定が走る)
残り60秒 → 「もうすぐ終了」バナー点滅 ← 既存実装あり
↓
残り0秒 → handleSessionExpired() → 【全画面購入モーダル】← ここを改善
         └ 「続きが気になりますか？」
           └ チケット選択 (500/1000/3000円)
           └ Square決済 → confirm.html → セッション加算
           └ → チャット継続
```

---

## D. 実装修正の優先順位

---

### P0 — 致命問題（今日中）

#### P0-1: `/api/consult` にセッション認証を追加

**対象ファイル**: `functions/api/consult.js`

```
修正内容:
1. Cookie から session_user (= email) を取得
2. user_sessions テーブルで is_active=1 AND session_end_time > now を確認
3. セッションなし → 401 { error: 'SESSION_EXPIRED' } を返す
4. セッションあり → OpenAI 呼び出し (既存ロジック)

伴う変更:
- chat.html の getAIResponse() が 401 を受け取ったら handleSessionExpired() を呼ぶ
```

**Cursor 指示**:
```
functions/api/consult.js を修正してください。

onRequestPost の先頭に以下を追加:
1. request.headers.get('Cookie') から session_user=xxx を抽出
2. env.DB.prepare で user_sessions テーブルを検索:
   SELECT * FROM user_sessions
   WHERE user_id = ? AND is_active = 1
   AND session_end_time > datetime('now')
   LIMIT 1
3. 結果が null なら return new Response(JSON.stringify({error:'SESSION_EXPIRED'}), {status:401, headers:{...corsHeaders,'Content-Type':'application/json'}})
4. 既存の runConsult 呼び出しへ進む

※ user_sessions テーブルが存在しない場合は 401 で返す (tableExists チェック不要、シンプルに)
※ getCorsHeaders と createErrorResponse は既存の import を使う
```

---

#### P0-2: `register.js` の `users` テーブル参照を修正

**対象ファイル**: `functions/api/register.js`

```
現状: SELECT/INSERT FROM users (存在しない)
修正: user_profiles テーブルの列定義に合わせて書き直し
     または: このエンドポイントを404に設定し、マジックリンクフローに統一
```

**Cursor 指示**:
```
functions/api/register.js を確認し、
このエンドポイントが実際に呼ばれているHTMLページがあるか grep で検索してください。

呼ばれていない場合:
  onRequestPost を "Method not allowed" 405 を返すだけにして、
  コメントで「廃止予定。マジックリンクフローに統一済み」と記載。

呼ばれている場合:
  users テーブルへの参照を user_profiles テーブルに書き直す。
  INSERT するカラムは: user_id(=email), nickname, birth_year, birth_month, birth_day, guardian_key, guardian_name, worry
  重複チェックは user_id カラムで行う。
```

---

### P1 — 1〜2週間で売上を作る修正

#### P1-1: マジックリンク認証完了時に無料セッション付与

**対象ファイル**: `functions/api/verify-magic-link.js`

**Cursor 指示**:
```
functions/api/verify-magic-link.js を修正してください。

is_verified = 1 に更新した直後 (成功時) に以下を追加:

// 無料トライアルセッションを付与 (3分)
const FREE_TRIAL_SECONDS = 180;
const sessionEndTime = new Date(Date.now() + FREE_TRIAL_SECONDS * 1000).toISOString();

// user_sessions テーブルが存在しない場合は作成
await env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  remaining_seconds INTEGER DEFAULT 0,
  session_end_time TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)`).run();

// 既存の無料セッションがない場合のみ付与 (2回登録防止)
const existingFreeSession = await env.DB.prepare(
  `SELECT id FROM user_sessions WHERE user_id = ? AND is_active = 1 LIMIT 1`
).bind(email).first();

if (!existingFreeSession) {
  await env.DB.prepare(
    `INSERT INTO user_sessions (user_id, remaining_seconds, session_end_time, is_active)
     VALUES (?, ?, ?, 1)`
  ).bind(email, FREE_TRIAL_SECONDS, sessionEndTime).run();
}
```

---

#### P1-2: タイムアウト時に全画面購入モーダルを表示

**対象ファイル**: `public/consult/chat.html`

**Cursor 指示**:
```
public/consult/chat.html の handleSessionExpired() 関数を修正してください。

現在の処理はそのままに、以下の全画面モーダルを追加表示してください:

モーダルの要件:
- 全画面オーバーレイ (z-index: 500)
- 背景: rgba(0,0,0,0.85) blur
- タイトル: 「✨ 鑑定を続けますか？」
- サブテキスト: 「龍との対話はまだ続いています。\nチケットを選んで鑑定を再開してください。」
- チケット選択肢 (ボタン3つ、縦並び):
    [🔮 5分チケット — 500円]
    [⭐ 10分チケット — 1,000円]
    [👑 30分チケット — 3,000円]
- 各ボタンクリック → payment/ticket.html?type=5min などにリダイレクト
- 下部に小さく [今はやめておく] テキストリンク → href="../index.html"

スタイル: 既存のカラーパレット (#0d0d1a, #66ccff, #9d4edd, #ffd700) に合わせる
```

---

#### P1-3: `chat.html` が `/api/consult` から 401 を受け取った時の処理

**対象ファイル**: `public/consult/chat.html`

**Cursor 指示**:
```
public/consult/chat.html の getAIResponse() 関数内、
fetch('/api/consult') のレスポンス処理に以下を追加:

if (response.status === 401) {
  handleSessionExpired(); // 既存関数を呼ぶ
  return;
}
```

---

#### P1-4: `/api/user-session` GET に簡易認証追加

**対象ファイル**: `functions/api/user-session.js`

**Cursor 指示**:
```
functions/api/user-session.js の onRequestGet の先頭に以下を追加:

// Cookie から session_user を取得して userId と照合
const cookieHeader = request.headers.get('Cookie') || '';
const cookieMatch = cookieHeader.match(/session_user=([^;]+)/);
const cookieUserId = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;

// クエリパラメータの userId
const queryUserId = url.searchParams.get('userId');

// Cookie の userId とクエリパラメータの userId が一致しない場合は拒否
if (cookieUserId && queryUserId && cookieUserId !== queryUserId) {
  return new Response(JSON.stringify({ success: false, message: '認証エラー' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}

// 以降は既存ロジック
```

---

### P2 — 後回しでよい改善

| # | 内容 | ファイル |
|---|---|---|
| 2-1 | `schema.sql` に `user_sessions`, `purchases` を正式追加 | schema.sql |
| 2-2 | 護符グッズを鑑定結果の守護神に連動表示 | payment/shop/gofu.html |
| 2-3 | チャット終了後に「鑑定結果をシェア」OGP 画像生成 | 新規 API |
| 2-4 | リマインダーメール（チケット切れ24時間後） | 新規 API + Resend |
| 2-5 | 月額サブスク (Square Subscriptions API) | 新規 |

---

## E. 修正対象ファイル 一覧

```
P0 修正 (今日):
├── functions/api/consult.js           ← セッション認証追加
└── functions/api/register.js          ← users→user_profiles 修正 or 廃止

P1 修正 (1〜2週間):
├── functions/api/verify-magic-link.js ← 無料3分セッション付与
├── functions/api/user-session.js      ← Cookie 認証追加
└── public/consult/chat.html           ← 購入モーダル強化 / 401 ハンドリング

スキーマ (P2):
└── schema.sql                         ← user_sessions, purchases を正式定義
```

---

## F. Cursor への最終渡し指示（コピー用）

```
プロジェクト: AI鑑定師 龍 (Cloudflare Pages + D1 + Square + OpenAI)

【作業1: P0 — /api/consult にセッション認証を追加】
ファイル: functions/api/consult.js

onRequestPost 関数の先頭 (try ブロック内、payload パース前) に以下を追加:
1. Cookie ヘッダーから session_user={userId} を正規表現で抽出
2. env.DB で user_sessions テーブルを検索
   条件: user_id = cookieUserId AND is_active = 1 AND session_end_time > datetime('now')
3. 結果が null なら createErrorResponse でステータス 401 を返す
   ボディ: { error: 'SESSION_EXPIRED', message: '鑑定時間が終了しました' }
4. セッションあり → 既存の runConsult 処理へ

---

【作業2: P1 — verify-magic-link.js に無料セッション付与】
ファイル: functions/api/verify-magic-link.js

is_verified を 1 に UPDATE した直後の成功パスに以下を追加:
- FREE_TRIAL_SECONDS = 180
- CREATE TABLE IF NOT EXISTS user_sessions (id, user_id, remaining_seconds, session_end_time, is_active, created_at, updated_at)
- SELECT COUNT(*) FROM user_sessions WHERE user_id = email → 0件なら INSERT
- INSERT: user_id=email, remaining_seconds=180, session_end_time=now+180s, is_active=1

---

【作業3: P1 — chat.html タイムアウトモーダル強化】
ファイル: public/consult/chat.html

handleSessionExpired() 関数に以下を追加:
- 全画面モーダルを body に動的に appendChild
- モーダル内容: タイトル/サブテキスト/チケットボタン3種/やめるリンク
- チケットボタン各クリック → window.location.href = '../payment/ticket.html'
- 既存カラーパレット (#0d0d1a, #66ccff, #9d4edd, #ffd700) を使用
- z-index: 500 でチャット画面の上に被せる

---

【作業4: P0 — register.js の確認と修正】
ファイル: functions/api/register.js

まず grep で register.js を呼んでいる HTML ページを探す。
呼んでいるページが存在しない場合:
  ファイルを「廃止済みエンドポイント」としてコメントを書き、
  onRequestPost を即座に 404 を返すだけに変更。
呼んでいるページが存在する場合:
  users テーブルへの全参照を user_profiles に置換
  列マッピング: email → user_id, nickname → nickname,
              birthdate → (birth_year/birth_month/birth_day に分割),
              guardian → guardian_key, topic → worry
```

---

## サマリー

| 優先度 | 作業 | 効果 |
|---|---|---|
| **P0** | `/api/consult` 認証追加 | 無制限利用を遮断 → 課金が機能する |
| **P0** | `register.js` 修正 | 認証バグ解消 |
| **P1** | 無料3分セッション付与 | 初回体験 → 購入コンバージョン発生 |
| **P1** | 購入モーダル強化 | タイムアウト後の転換率向上 |
| **P1** | `user-session` Cookie認証 | 他人のセッション参照を防止 |

**P0 の2件だけで「課金が実際に機能する」状態になります。P1 まで完了すると初めて有機的な収益化フローが完成します。**
