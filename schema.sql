-- 守護神占い 会員登録システム用データベーススキーマ
-- Cloudflare D1 データベース用

-- ユーザープロフィールテーブル（会員情報を保存）
CREATE TABLE IF NOT EXISTS user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,                    -- メールアドレス（ユーザー識別子）
    birth_year TEXT,                          -- 生年
    birth_month TEXT,                         -- 生月
    birth_day TEXT,                           -- 生日
    guardian_key TEXT,                        -- 守護神キー
    guardian_name TEXT,                       -- 守護神名
    worry_type TEXT,                          -- 悩みの種類
    registration_info TEXT,                   -- ローカルストレージの全データ（JSON形式）
    created_at TEXT DEFAULT CURRENT_TIMESTAMP -- 登録日時
);

-- マジックリンクテーブル（一時的な認証トークンを保存）
CREATE TABLE IF NOT EXISTS magic_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,                      -- メールアドレス
    token TEXT UNIQUE NOT NULL,               -- 認証トークン（UUID）
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, -- 作成日時
    used INTEGER DEFAULT 0                    -- 使用済みフラグ（0:未使用, 1:使用済み）
);

-- インデックスを作成（検索性能向上のため）
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);
CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(email);