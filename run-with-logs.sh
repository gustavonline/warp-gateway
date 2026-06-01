#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

command -v chatmock >/dev/null 2>&1 || "$PYTHON" -m pip install --upgrade chatmock
NGROK="$(command -v ngrok || true)"
if [[ -z "$NGROK" ]]; then
  echo "ngrok not found. Install with: brew install ngrok/ngrok/ngrok"
  exit 1
fi

echo "Starting ChatMock and ngrok in background, gateway in this terminal..."
start_bg chatmock chatmock serve
sleep 2
start_bg ngrok "$NGROK" http 8320
sleep 2

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
  echo "API key:      dev-key-change-me"
  echo "Model:        gpt-5.4"
  echo
  echo "Endpoint copied to clipboard when available."
fi

echo
echo "Gateway logs below. Press Ctrl+C to stop viewing logs; run ./stop-all.sh to stop background services."
node src/server.js
