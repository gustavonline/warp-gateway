#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_DIR="$ROOT/.run"
LOG_DIR="$ROOT/logs"
mkdir -p "$RUN_DIR" "$LOG_DIR"
cd "$ROOT"

PYTHON="python3"; command -v python3 >/dev/null 2>&1 || PYTHON="python"

start_bg() {
  local name="$1"; shift
  local pid_file="$RUN_DIR/$name.pid"
  if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" >/dev/null 2>&1; then
    echo "$name already running (PID $(cat "$pid_file"))"
    return
  fi
  nohup "$@" >"$LOG_DIR/$name.out.log" 2>"$LOG_DIR/$name.err.log" &
  echo $! > "$pid_file"
  echo "Started $name (PID $!)"
}

stop_bg() {
  local name="$1"
  local pid_file="$RUN_DIR/$name.pid"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      sleep 0.3
      kill -9 "$pid" >/dev/null 2>&1 || true
      echo "Stopped $name (PID $pid)"
    fi
    rm -f "$pid_file"
  fi
}

stop_port() {
  local port="$1"
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  fi
  for pid in $pids; do
    kill "$pid" >/dev/null 2>&1 || true
    sleep 0.2
    kill -9 "$pid" >/dev/null 2>&1 || true
    echo "Stopped existing process on port $port (PID $pid)"
  done
}

cleanup() {
  stop_bg ngrok
  stop_bg chatmock
}
trap cleanup EXIT INT TERM

command -v chatmock >/dev/null 2>&1 || "$PYTHON" -m pip install --upgrade chatmock
CONFIG_PATH="$ROOT/config/config.json"
[[ -f "$CONFIG_PATH" ]] || CONFIG_PATH="$ROOT/config/config.example.json"
GATEWAY_API_KEY="$(node -e "const fs=require('fs'); const c=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log((c.gatewayApiKeys&&c.gatewayApiKeys[0])||'dev-key-change-me')" "$CONFIG_PATH")"
NGROK="$(command -v ngrok || true)"
if [[ -z "$NGROK" ]]; then
  echo "ngrok not found. Run ./scripts/macos/setup.sh first."
  exit 1
fi

echo "Starting ChatMock and ngrok in background, gateway logs in this terminal..."
start_bg chatmock chatmock serve
sleep 2
start_bg ngrok "$NGROK" http 8320
sleep 2

# Clean up any gateway left behind by an older script/run.
stop_port 8320

endpoint=""
end=$((SECONDS + 25))
while (( SECONDS < end )); do
  endpoint="$(curl -fsS http://127.0.0.1:4040/api/tunnels 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const j=JSON.parse(s);const t=(j.tunnels||[]).find(t=>t.proto==="https"); if(t) console.log(t.public_url+"/v1");}catch{}})' || true)"
  [[ -n "$endpoint" ]] && break
  sleep 0.5
done

if [[ -n "$endpoint" ]]; then
  command -v pbcopy >/dev/null 2>&1 && printf "%s" "$endpoint" | pbcopy
  echo
  echo "Warp config:"
  echo "Endpoint URL: $endpoint"
  echo "API key:      $GATEWAY_API_KEY"
  echo "Model:        gpt-5.5"
  echo
  echo "Endpoint copied to clipboard when available."
fi

echo
echo "Gateway logs below. Keep this terminal open. Ctrl+C stops everything."
node src/server.js
