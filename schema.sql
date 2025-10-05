-- 守護神占い 会員登録システム用データベーススキーマ
-- Cloudflare D1 データベース用（ユーザープロフィールテーブルのみ）

-- ユーザープロフィールテーブル（会員情報を保存）
CREATE TABLE IF NOT EXISTS user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,                    -- メールアドレス（ユーザー識別子）
    nickname TEXT,                            -- ニックネーム
    birth_year TEXT,                          -- 生年
    birth_month TEXT,                         -- 生月
    birth_day TEXT,                           -- 生日
    guardian_key TEXT,                        -- 守護神キー
    guardian_name TEXT,                       -- 守護神名
    worry_type TEXT,                          -- 悩みの種類
    registration_info TEXT,                   -- ローカルストレージの全データ（JSON形式）
    magic_link_token TEXT,                    -- マジックリンクトークン（一時的）
    magic_link_created_at TEXT,               -- マジックリンク作成日時
    magic_link_used INTEGER DEFAULT 0,        -- マジックリンク使用済みフラグ
    created_at TEXT DEFAULT CURRENT_TIMESTAMP -- 登録日時
);

-- インデックスを作成（検索性能向上のため）
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_magic_link_token ON user_profiles(magic_link_token);

-- マジックリンクテーブルを削除（不要になったため）
DROP TABLE IF EXISTS magic_links;