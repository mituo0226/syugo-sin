#!/bin/bash
# 🚨 Pre-commit セキュリティチェック
# ResendやOpenAIなどのAPIキーを誤ってコミットしないためのフック

echo "🔍 Running security check..."

# Resendキー (re_ で始まる)
if git diff --cached | grep -E "re_[A-Za-z0-9]{20,}" > /dev/null; then
  echo "❌ ERROR: Resend API Key detected in staged files! Commit aborted."
  echo "   Please remove the API key from your changes."
  exit 1
fi

# OpenAIキー (sk- で始まる)
if git diff --cached | grep -E "sk-[A-Za-z0-9]{20,}" > /dev/null; then
  echo "❌ ERROR: OpenAI API Key detected in staged files! Commit aborted."
  echo "   Please remove the API key from your changes."
  exit 1
fi

# Google OAuth credentials
if git diff --cached | grep -E "GOOGLE_[A-Z_]+=[^=]*[A-Za-z0-9]{20,}" > /dev/null; then
  echo "❌ ERROR: Google OAuth credentials detected in staged files! Commit aborted."
  echo "   Please remove the credentials from your changes."
  exit 1
fi

# Square API credentials
if git diff --cached | grep -E "SQUARE_[A-Z_]+=[^=]*[A-Za-z0-9]{20,}" > /dev/null; then
  echo "❌ ERROR: Square API credentials detected in staged files! Commit aborted."
  echo "   Please remove the credentials from your changes."
  exit 1
fi

# 一般的な secret/token/key/credential パターン
if git diff --cached | grep -Ei "(secret|token|apikey|api_key|credential|password)" > /dev/null; then
  echo "⚠️ WARNING: Possible secret detected. Please double-check before committing."
  echo "   Make sure you're not committing sensitive information."
  # 非対話環境（GitHub Desktop 等）では stdin が TTY でないため自動続行
  if [ -t 0 ]; then
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  else
    echo "   (Non-interactive environment detected — continuing automatically)"
  fi
fi

echo "✅ Security check passed. Safe to commit."
