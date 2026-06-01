#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT/.run"
LOG_DIR="$ROOT/logs"
mkdir -p "$RUN_DIR" "$LOG_DIR"
cd "$ROOT"

PYTHON="python3"
command -v python3 >/dev/null 2>&1 || PYTHON="python"

start_bg() {
  local name="$1"
  shift
  local pid_file="$RUN_DIR/$name.pid"
  local out_log="$LOG_DIR/$name.out.log"
  local err_log="$LOG_DIR/$name.err.log"

  if [[ -f "$pid_file" ]]; then
    local old_pid
    old_pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "$old_pid" ]] && kill -0 "$old_pid" >/dev/null 2>&1; then
      echo "$name already running (PID $old_pid)"
      return 0
    fi
  fi

  nohup "$@" >"$out_log" 2>"$err_log" &
  echo $! > "$pid_file"
  echo "Started $name (PID $!)"
}

wait_http() {
  local url="$1"
  local seconds="${2:-20}"
  local end=$((SECONDS + seconds))
  while (( SECONDS < end )); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  echo "Timed out waiting for $url" >&2
  return 1
}

if ! command -v chatmock >/dev/null 2>&1; then
  echo "ChatMock not found. Installing..."
  "$PYTHON" -m pip install --upgrade chatmock
fi

NGROK=""
if [[ -x "$ROOT/tools/ngrok/ngrok" ]]; then
  NGROK="$ROOT/tools/ngrok/ngrok"
elif [[ -x "$ROOT/tools/ngrok/ngrok.exe" ]]; then
  NGROK="$ROOT/tools/ngrok/ngrok.exe"
elif command -v ngrok >/dev/null 2>&1; then
  NGROK="$(command -v ngrok)"
else
  echo "ngrok not found. Install it on macOS with: brew install ngrok/ngrok/ngrok"
  echo "Then add token: ngrok config add-authtoken YOUR_TOKEN"
  exit 1
fi

echo "Starting services in background..."
start_bg chatmock chatmock serve
sleep 2
start_bg gateway node src/server.js
sleep 1
start_bg ngrok "$NGROK" http 8320

echo "Waiting for gateway..."
wait_http "http://127.0.0.1:8320/health" 25

echo "Waiting for ngrok public URL..."
endpoint=""
end=$((SECONDS + 25))
while (( SECONDS < end )); do
  endpoint="$(curl -fsS http://127.0.0.1:4040/api/tunnels 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const j=JSON.parse(s);const t=(j.tunnels||[]).find(t=>t.proto==="https"); if(t) console.log(t.public_url+"/v1");}catch{}})' || true)"
  if [[ -n "$endpoint" ]]; then break; fi
  sleep 0.5
done

if [[ -z "$endpoint" ]]; then
  echo "Services started, but could not read ngrok URL. Check logs/ngrok.err.log or open http://127.0.0.1:4040"
  exit 0
fi

echo "$endpoint" > "$RUN_DIR/endpoint.txt"
if command -v pbcopy >/dev/null 2>&1; then
  printf "%s" "$endpoint" | pbcopy
elif command -v clip.exe >/dev/null 2>&1; then
  printf "%s" "$endpoint" | clip.exe
fi

echo
echo "Ready."
echo "Warp Endpoint URL: $endpoint"
echo "API key:           dev-key-change-me"
echo "Model:             gpt-5.4"
echo
echo "Stop everything with: ./stop-all.sh"
