DROP TABLE IF EXISTS magic_links;
DROP TABLE IF EXISTS users;

CREATE TABLE magic_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  birthdate TEXT,
  guardian TEXT,
  nickname TEXT,
  topic TEXT,
  expires_at TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used BOOLEAN DEFAULT FALSE
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  birthdate TEXT,
  guardian TEXT,
  nickname TEXT,
  topic TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);