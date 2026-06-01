#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

has() { command -v "$1" >/dev/null 2>&1; }

echo "=== Warp ChatMock Gateway setup ==="
echo "This will install ChatMock, install/configure ngrok, and run ChatMock login."
echo "Project: $ROOT"

PYTHON="python3"
if ! has python3; then PYTHON="python"; fi

if ! has "$PYTHON"; then
  echo "Python 3 was not found. Install it first." >&2
  if [[ "$(uname -s)" == "Darwin" ]] && has brew; then
    read -r -p "Install Python with Homebrew now? (Y/n) " install_python
    if [[ ! "$install_python" =~ ^[nN]$ ]]; then
      brew install python
      PYTHON="python3"
    fi
  else
    exit 1
  fi
fi

if ! has node; then
  echo "Node.js was not found."
  if [[ "$(uname -s)" == "Darwin" ]] && has brew; then
    read -r -p "Install Node.js with Homebrew now? (Y/n) " install_node
    if [[ ! "$install_node" =~ ^[nN]$ ]]; then
      brew install node
    fi
  else
    echo "Install Node.js 20+ first: https://nodejs.org/" >&2
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
  if command -v open >/dev/null 2>&1; then
    open "$TOKEN_URL" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$TOKEN_URL" >/dev/null 2>&1 || true
  elif command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "Start-Process '$TOKEN_URL'" >/dev/null 2>&1 || true
  fi
fi
read -r -p "Paste ngrok authtoken (leave empty to skip if already configured): " token
if [[ -n "${token// }" ]]; then
  ngrok config add-authtoken "$token"
else
  echo "Skipping token setup."
fi

echo
echo "[4/4] ChatMock login"
echo "A browser/OAuth login may open. Log in with your ChatGPT/Codex account."
read -r -p "Run 'chatmock login' now? (Y/n) " do_login
if [[ ! "$do_login" =~ ^[nN]$ ]]; then
  chatmock login
fi

echo
echo "Setup complete."
read -r -p "Start everything now in the background? (Y/n) " run_now
if [[ ! "$run_now" =~ ^[nN]$ ]]; then
  ./run.sh
else
  echo "Later, start with: ./run.sh"
  echo "That command will print the dynamic ngrok Endpoint URL to paste into Warp."
  echo "Warp values will be: Endpoint URL = printed by run.sh, API key = dev-key-change-me, Model = gpt-5.4"
fi
