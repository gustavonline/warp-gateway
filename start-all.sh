#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

has() { command -v "$1" >/dev/null 2>&1; }

echo "=== Warp ChatMock Gateway setup ==="
echo "Project: $ROOT"

if ! has python; then
  echo "Python was not found. Install Python first, then rerun this script." >&2
  exit 1
fi
if ! has node; then
  echo "Node.js was not found. Install Node.js 20+, then rerun this script." >&2
  exit 1
fi

echo
echo "[1/5] Installing/updating ChatMock..."
python -m pip install --upgrade chatmock

echo
echo "[2/5] ChatMock login"
echo "Yes: login with your OpenAI ChatGPT/Codex account via the OAuth/browser flow."
read -r -p "Run 'chatmock login' now? (Y/n) " do_login
if [[ ! "$do_login" =~ ^[nN]$ ]]; then
  chatmock login
fi

echo
echo "[3/5] Starting ChatMock on http://127.0.0.1:8000/v1"
if has wt.exe; then
  wt.exe new-tab --title ChatMock bash -lc "cd '$ROOT' && chatmock serve" >/dev/null 2>&1 || (chatmock serve &)
else
  chatmock serve &
fi
sleep 3

echo
echo "[4/5] Starting Warp gateway on http://127.0.0.1:8320/v1"
if has wt.exe; then
  wt.exe new-tab --title WarpGateway bash -lc "cd '$ROOT' && node src/server.js" >/dev/null 2>&1 || (node src/server.js &)
else
  node src/server.js &
fi
sleep 2

echo
echo "[5/5] ngrok"
if has ngrok; then
  read -r -p "Start ngrok now? (Y/n) " do_ngrok
  if [[ ! "$do_ngrok" =~ ^[nN]$ ]]; then
    if has wt.exe; then
      wt.exe new-tab --title ngrok bash -lc "ngrok http 8320" >/dev/null 2>&1 || ngrok http 8320
    else
      ngrok http 8320
    fi
  fi
else
  echo "ngrok was not found. Install it or use Cloudflare Tunnel/Tailscale Funnel."
  echo "After install, run: ngrok http 8320"
fi

echo
echo "=== Warp settings ==="
echo "Endpoint URL: https://YOUR-NGROK-DOMAIN.ngrok-free.app/v1"
echo "API key:      dev-key-change-me"
echo "Model:        gpt-5.4"
echo
echo "Other models: gpt-5.5, gpt-5.4-mini, gpt-5.2, gpt-5.3-codex, gpt-5.3-codex-spark"
echo
echo "Local test:"
echo "curl -H 'Authorization: Bearer dev-key-change-me' http://127.0.0.1:8320/v1/models"
