#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

has() { command -v "$1" >/dev/null 2>&1; }

echo "=== Warp ChatMock Gateway setup (macOS/Linux) ==="
echo "Project: $ROOT"

PYTHON="python3"
if ! has python3; then PYTHON="python"; fi

if ! has "$PYTHON"; then
  if [[ "$(uname -s)" == "Darwin" ]] && has brew; then
    read -r -p "Python 3 not found. Install with Homebrew now? (Y/n) " install_python
    [[ "$install_python" =~ ^[nN]$ ]] || brew install python
    PYTHON="python3"
  else
    echo "Python 3 was not found. Install it first." >&2
    exit 1
  fi
fi

if ! has node; then
  if [[ "$(uname -s)" == "Darwin" ]] && has brew; then
    read -r -p "Node.js not found. Install with Homebrew now? (Y/n) " install_node
    [[ "$install_node" =~ ^[nN]$ ]] || brew install node
  else
    echo "Node.js 20+ was not found. Install it first: https://nodejs.org/" >&2
    exit 1
  fi
fi

echo
echo "[1/4] Installing/updating ChatMock..."
"$PYTHON" -m pip install --upgrade chatmock

echo
echo "[2/4] Installing/checking ngrok..."
if ! has ngrok; then
  if [[ "$(uname -s)" == "Darwin" ]] && has brew; then
    brew install ngrok/ngrok/ngrok
  else
    echo "ngrok was not found. Install it first: https://ngrok.com/download" >&2
    exit 1
  fi
else
  ngrok version || true
fi

echo
echo "[3/4] ngrok token"
TOKEN_URL="https://dashboard.ngrok.com/get-started/your-authtoken"
echo "Get your token here: $TOKEN_URL"
read -r -p "Open ngrok token page in your browser? (Y/n) " open_ngrok
if [[ ! "$open_ngrok" =~ ^[nN]$ ]]; then
  if command -v open >/dev/null 2>&1; then open "$TOKEN_URL" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$TOKEN_URL" >/dev/null 2>&1 || true
  fi
fi
read -r -p "Paste ngrok authtoken (leave empty to skip if already configured): " token
if [[ -n "${token// }" ]]; then ngrok config add-authtoken "$token"; else echo "Skipping token setup."; fi

echo
echo "[4/4] ChatMock login"
echo "A browser/OAuth login may open. Log in with your ChatGPT/Codex account."
read -r -p "Run 'chatmock login' now? (Y/n) " do_login
if [[ ! "$do_login" =~ ^[nN]$ ]]; then chatmock login; fi

echo
echo "Setup complete. Start with: ./scripts/macos/run.sh"
