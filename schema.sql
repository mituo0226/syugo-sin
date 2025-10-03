-- D1データベース用のテーブル定義
-- 会員登録テスト用のusersテーブル

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  nickname TEXT NOT NULL,
  birthdate TEXT,
  guardian_id TEXT,
  theme TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 購入履歴テーブル
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  ticket_type TEXT NOT NULL,
  ticket_name TEXT NOT NULL,
  price INTEGER NOT NULL,
  minutes INTEGER NOT NULL,
  payment_method TEXT DEFAULT 'square',
  payment_status TEXT DEFAULT 'completed',
  square_order_id TEXT,
  purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_square_order_id ON purchases(square_order_id);
